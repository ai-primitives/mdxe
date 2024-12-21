import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import { spawn } from 'child_process'
import { join, resolve } from 'path'
import { mkdirSync, writeFileSync, rmSync, openSync, readFileSync, existsSync, statSync } from 'fs'
import fetch from 'node-fetch'
import { sleep, debug } from '../../test/setup.js'

describe('Watch Mode', () => {
  const testDir = join(process.cwd(), 'test-watch-mode')
  const singleFile = join(testDir, 'test.mdx')
  const multiDir = join(testDir, 'content')
  let watchProcess: ReturnType<typeof spawn> | null = null

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true })
    mkdirSync(multiDir, { recursive: true })

    writeFileSync(
      singleFile,
      `
# Test File
Initial content
    `,
    )

    writeFileSync(
      join(multiDir, 'page1.mdx'),
      `
# Page 1
Initial content for page 1
    `,
    )

    writeFileSync(
      join(multiDir, 'page2.mdx'),
      `
# Page 2
Initial content for page 2
    `,
    )

    writeFileSync(
      join(testDir, 'next.config.js'),
      `
const { withMDXE } = require('../../dist')
module.exports = withMDXE({})
    `,
    )
  })

  afterEach(async () => {
    debug('Cleaning up watch process and test directory...')
    if (watchProcess) {
      try {
        watchProcess.kill('SIGTERM')
        await sleep(1000) // Wait for process to terminate
      } catch (error) {
        debug('Error killing watch process:', error)
      }
      watchProcess = null
    }

    try {
      rmSync(testDir, { recursive: true, force: true })
    } catch (error) {
      debug('Error removing test directory:', error)
    }
  })

  it('should detect changes in single file mode', async () => {
    let hasProcessedFile = false
    const absolutePath = resolve(process.cwd(), singleFile)
    const args = ['--watch', absolutePath]

    debug('=== Test Setup ===')
    debug('Test directory path:', testDir)
    debug('Absolute file path:', absolutePath)
    debug('Current working directory:', process.cwd())
    
    // Get initial filesystem state
    try {
      const dirStat = statSync(testDir)
      debug('Test directory stats:', {
        inode: dirStat.ino,
        mode: dirStat.mode,
        uid: dirStat.uid,
        gid: dirStat.gid,
        size: dirStat.size,
        blocks: dirStat.blocks,
        atime: dirStat.atime,
        mtime: dirStat.mtime,
        ctime: dirStat.ctime
      })
    } catch (error) {
      debug('Error getting directory stats:', error)
    }
    
    // Create initial file with explicit file descriptor
    try {
      const fd = openSync(absolutePath, 'w')
      writeFileSync(fd, `# Initial Test\nThis is a test file.\n`, 'utf-8')
      // Force sync to ensure changes are written to disk
      const { closeSync } = await import('fs')
      closeSync(fd)
      debug('Initial file created successfully')
      debug('Initial file exists:', existsSync(absolutePath))
      debug('Initial file content:', readFileSync(absolutePath, 'utf-8'))
      debug('File descriptor:', fd)
    } catch (error) {
      debug('Error creating initial file:', error)
      throw error
    }

    // Ensure file exists and is ready before starting watch
    await sleep(5000) // Increased wait time for more reliable initialization
    debug('Pre-watch file check - exists:', existsSync(absolutePath))
    debug('Pre-watch file content:', readFileSync(absolutePath, 'utf-8'))

    debug('Starting watch process with args:', args)
    debug('Initial file content:', readFileSync(absolutePath, 'utf-8'))
    // Set up environment variables for debug output
    const spawnEnv = {
      ...process.env,
      DEBUG: '*',
      FORCE_COLOR: '0', // Disable colors for cleaner output
      NODE_ENV: 'test'
    }

    debug('Spawning watch process with env:', spawnEnv)
    watchProcess = spawn('node', ['./bin/cli.js', ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false, // Changed to false for better process management
      cwd: process.cwd(),
      env: spawnEnv as NodeJS.ProcessEnv,
      windowsHide: true
    })

    if (!watchProcess || !watchProcess.stdout) {
      if (watchProcess) watchProcess.kill()
      throw new Error('Failed to spawn process or get process streams')
    }

    // Store stream references to avoid null checks
    const stdout = watchProcess.stdout

    // Buffer to store partial lines
    let stdoutBuffer = ''
    
    stdout.on('data', (data) => {
      const output = data.toString()
      debug('Raw watch process output:', output)
      
      // Look for specific success indicators with more detailed logging
      if (output.includes('Successfully processed')) {
        debug('File processing success detected:', output)
        debug('Setting hasProcessedFile to true')
        hasProcessedFile = true
      } else if (output.includes('Processing changed file')) {
        debug('File processing started:', output)
      } else if (output.includes('[DEBUG]')) {
        debug('Debug output:', output.trim())
      }
      
      // Log all output for debugging
      debug('Processing output:', { raw: output, hasProcessedFile })
    })

    if (!watchProcess.stderr) {
      throw new Error('Failed to get stderr from watch process')
    }

    watchProcess.stderr.on('data', (data) => {
      debug('Watch process error:', data.toString())
    })

    // Wait for watcher to be ready
    debug('Waiting for watcher to be ready...')
    
    // Wait for both initial scan and watched paths to be reported
    await new Promise<void>((resolve, reject) => {
      let hasInitialScan = false
      let hasWatchedPaths = false
      let timeoutId: NodeJS.Timeout

      const readyHandler = (data: Buffer) => {
        const output = data.toString()
        debug('Ready check output:', output)

        if (output.includes('Initial scan complete')) {
          debug('Initial scan completed')
          hasInitialScan = true
        }
        if (output.includes('Watched paths:')) {
          debug('Watched paths reported')
          hasWatchedPaths = true
        }

        if (hasInitialScan && hasWatchedPaths) {
          debug('Watcher is fully ready')
          watchProcess?.stdout?.removeListener('data', readyHandler)
          clearTimeout(timeoutId)
          resolve()
        }
      }

      timeoutId = setTimeout(() => {
        watchProcess?.stdout?.removeListener('data', readyHandler)
        reject(new Error('Timeout waiting for watcher to be ready'))
      }, 30000)

      watchProcess?.stdout?.on('data', readyHandler)
    })
    
    // Additional wait to ensure stability
    await sleep(2000)
    debug('Ready wait completed')

    debug('Modifying test file...')
    try {
      // Use a simpler file modification approach
      const timestamp = Date.now()
      const newContent = `# Modified Content ${timestamp}\nThis is the updated content.\n`
      
      // Write the file in a single operation
      writeFileSync(absolutePath, newContent, { encoding: 'utf-8', flag: 'w' })
      
      debug('File modification completed')
      debug('Modified content:', newContent)
      
      // Verify the file was modified
      const actualContent = readFileSync(absolutePath, 'utf-8')
      if (actualContent !== newContent) {
        debug('WARNING: File content verification failed')
        debug('Expected:', newContent)
        debug('Actual:', actualContent)
        throw new Error('File content verification failed')
      }
      
      debug('File modification verified successfully')
    } catch (error) {
      debug('Error modifying file:', error)
      throw error
    }
    debug('Waiting for file change detection...')
    // Wait for change event with timeout matching global vitest config
    const timeout = 120000
    const startTime = Date.now()
    
    // Enhanced waiting logic with better debug information
    const checkInterval = 1000 // Check every second
    while (!hasProcessedFile && Date.now() - startTime < timeout) {
      await sleep(checkInterval)
      const elapsed = Date.now() - startTime
      debug('Waiting for file change...', {
        elapsed,
        hasProcessedFile,
        fileExists: existsSync(absolutePath),
        fileContent: existsSync(absolutePath) ? readFileSync(absolutePath, 'utf-8') : 'FILE_NOT_FOUND',
        watcherActive: !!watchProcess && !watchProcess.killed
      })
      
      // Check watcher health
      if (!watchProcess || watchProcess.killed) {
        debug('Watch process is not active!')
        break
      }
    }
    
    if (!hasProcessedFile) {
      debug('Timeout or failure occurred:', {
        elapsed: Date.now() - startTime,
        timeout,
        watcherActive: !!watchProcess && !watchProcess.killed,
        fileState: {
          exists: existsSync(absolutePath),
          content: existsSync(absolutePath) ? readFileSync(absolutePath, 'utf-8') : 'FILE_NOT_FOUND'
        },
        processState: {
          killed: watchProcess?.killed,
          exitCode: watchProcess?.exitCode,
          pid: watchProcess?.pid
        }
      })
    }
    expect(hasProcessedFile).toBe(true)
  })

  it('should detect changes in directory mode', async () => {
    let hasProcessedFiles = false
    const args = ['--watch', multiDir]

    watchProcess = spawn('node', ['./bin/cli.js', ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
      env: process.env as NodeJS.ProcessEnv,
      windowsHide: true
    })

    if (!watchProcess || !watchProcess.stdout) {
      if (watchProcess) watchProcess.kill()
      throw new Error('Failed to spawn process or get process streams')
    }

    // Store stream references to avoid null checks
    const stdout = watchProcess.stdout

    stdout.on('data', (data) => {
      const output = data.toString()
      debug('Watch process output:', output)
      if (output.includes('has been changed') || output.includes('has been added')) {
        hasProcessedFiles = true
      }
    })

    if (!watchProcess.stderr) {
      throw new Error('Failed to get stderr from watch process')
    }

    watchProcess.stderr.on('data', (data) => {
      debug('Watch process error:', data.toString())
    })

    debug('Waiting for initial processing...')
    
    // Wait for the "Initial scan complete" message before proceeding
    await new Promise<void>((resolve) => {
      const readyHandler = (data: Buffer) => {
        const output = data.toString()
        if (output.includes('Initial scan complete')) {
          debug('Watcher is ready')
          watchProcess?.stdout?.removeListener('data', readyHandler)
          resolve()
        }
      }
      watchProcess?.stdout?.on('data', readyHandler)
    })

    debug('Modifying page1.mdx...')
    writeFileSync(
      join(multiDir, 'page1.mdx'),
      `
# Updated Page 1
This is an updated test file.
    `,
    )

    debug('Adding page3.mdx...')
    writeFileSync(
      join(multiDir, 'page3.mdx'),
      `
# Page 3
This is a new test file.
    `,
    )

    debug('File modifications completed')
    debug('page1.mdx content:', readFileSync(join(multiDir, 'page1.mdx'), 'utf-8'))
    debug('page3.mdx content:', readFileSync(join(multiDir, 'page3.mdx'), 'utf-8'))
    debug('Waiting for file change detection...')
    // Wait for change event with timeout matching global vitest config
    const timeout = 120000 // Increased timeout to match global vitest config
    const startTime = Date.now()
    while (!hasProcessedFiles && Date.now() - startTime < timeout) {
      await sleep(100)
      debug('Waiting for directory changes... Time elapsed:', Date.now() - startTime)
    }
    if (!hasProcessedFiles) {
      debug('Timeout waiting for file change events after', timeout, 'ms')
      debug('Watch process output history:', watchProcess?.stdout?.read()?.toString())
      debug('Final directory state:', {
        page1: existsSync(join(multiDir, 'page1.mdx')) ? readFileSync(join(multiDir, 'page1.mdx'), 'utf-8') : 'FILE_NOT_FOUND',
        page2: existsSync(join(multiDir, 'page2.mdx')) ? readFileSync(join(multiDir, 'page2.mdx'), 'utf-8') : 'FILE_NOT_FOUND',
        page3: existsSync(join(multiDir, 'page3.mdx')) ? readFileSync(join(multiDir, 'page3.mdx'), 'utf-8') : 'FILE_NOT_FOUND'
      })
    }
    expect(hasProcessedFiles).toBe(true)
  })

  it('should work with next dev', async () => {
    const port = 3457
    const args = ['--watch', '--next', testDir]

    mkdirSync(join(testDir, 'pages'), { recursive: true })
    writeFileSync(
      join(testDir, 'pages', 'index.mdx'),
      `
# Watch Mode Test
Testing next dev integration
    `,
    )

    watchProcess = spawn('node', ['../../bin/cli.js', ...args], {
      cwd: testDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
      env: {
        ...process.env,
        PORT: port.toString(),
      } as NodeJS.ProcessEnv,
      windowsHide: true
    })

    if (!watchProcess || !watchProcess.stdout) {
      if (watchProcess) watchProcess.kill()
      throw new Error('Failed to spawn process or get process streams')
    }

    // Store stream references to avoid null checks
    const stdout = watchProcess.stdout

    stdout.on('data', (data) => {
      const output = data.toString()
      debug(`Next dev output: ${output}`)
      expect(output).toContain('Watch Mode Test')
    })

    debug('Waiting for Next.js dev server to start...')
    const serverStartTimeout = 60000 // Allow up to 60 seconds for Next.js server startup
    const serverStartTime = Date.now()
    let serverStarted = false
    
    while (!serverStarted && Date.now() - serverStartTime < serverStartTimeout) {
      try {
        const response = await fetch(`http://localhost:${port}`)
        if (response.ok) {
          serverStarted = true
          debug('Next.js server started successfully after', Date.now() - serverStartTime, 'ms')
          break
        }
      } catch (error) {
        debug('Server not ready yet, waiting...', Date.now() - serverStartTime, 'ms elapsed')
        await sleep(1000)
      }
    }
    
    if (!serverStarted) {
      debug('Timeout waiting for Next.js server to start after', serverStartTimeout, 'ms')
      throw new Error('Next.js server failed to start within timeout period')
    }

    const response = await fetch(`http://localhost:${port}`)
    const html = await response.text()
    expect(html).toContain('Watch Mode Test')

    debug('Modifying index.mdx...')
    writeFileSync(
      join(testDir, 'pages', 'index.mdx'),
      `
# Watch Mode Test
Updated content for testing
    `,
    )

    debug('Waiting for hot reload...')
    await sleep(5000)

    const updatedResponse = await fetch(`http://localhost:${port}`)
    const updatedHtml = await updatedResponse.text()
    expect(updatedHtml).toContain('Updated content for testing')
  })
})
