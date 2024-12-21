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
      // Append new data to buffer
      stdoutBuffer += data.toString()
      
      // Process complete lines
      const lines = stdoutBuffer.split('\n')
      // Keep the last partial line in the buffer
      stdoutBuffer = lines.pop() || ''
      
      for (const line of lines) {
        if (line.trim()) {
          debug('Watch process output:', line)
          // Look for both change and add events since we're deleting and recreating the file
          if (line.includes('has been changed') || line.includes('has been added')) {
            debug('Change/Add event detected')
            hasProcessedFile = true
          }
          // Log all debug messages
          if (line.includes('[DEBUG]')) {
            debug('Debug message from watcher:', line)
          }
        }
      }
    })

    if (!watchProcess.stderr) {
      throw new Error('Failed to get stderr from watch process')
    }

    watchProcess.stderr.on('data', (data) => {
      debug('Watch process error:', data.toString())
    })

    // Wait for watcher to be ready
    debug('Waiting for watcher to be ready...')
    
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

    debug('Modifying test file...')
    try {
      // Modify file with explicit file descriptor
      debug('Opening file for modification...')
      const writefd = openSync(absolutePath, 'w')
      debug('Writing new content...')
      const timestamp = Date.now()
      const newContent = `# MAJOR UPDATE ${timestamp}\n${'='.repeat(50)}\nThis is a completely different file with timestamp ${timestamp}\n${'='.repeat(50)}\n`
      debug('=== File Modification ===')
      debug('Writing new content:', newContent)
      writeFileSync(writefd, newContent, 'utf-8')
      
      // Get file stats after modification
      try {
        const fileStat = statSync(absolutePath)
        debug('File stats after modification:', {
          inode: fileStat.ino,
          mode: fileStat.mode,
          size: fileStat.size,
          blocks: fileStat.blocks,
          atime: fileStat.atime,
          mtime: fileStat.mtime,
          ctime: fileStat.ctime
        })
      } catch (error) {
        debug('Error getting file stats:', error)
      }
      
      // Verify content was written
      const actualContent = readFileSync(absolutePath, 'utf-8')
      debug('Actual file content after write:', actualContent)
      if (actualContent !== newContent) {
        debug('WARNING: File content mismatch!')
        debug('Expected:', newContent)
        debug('Actual:', actualContent)
      }
      debug('Forcing sync...')
      const { closeSync } = await import('fs')
      closeSync(writefd)
      
      debug('Modification complete')
      debug('Modified file exists:', existsSync(absolutePath))
      debug('Modified file content:', readFileSync(absolutePath, 'utf-8'))
    } catch (error) {
      debug('Error modifying file:', error)
      throw error
    }
    
    // Wait for changes to be detected
    await sleep(2000)
    
    debug('File modification completed')
    debug('Current file content:', readFileSync(absolutePath, 'utf-8'))
    debug('File exists:', existsSync(absolutePath))

    debug('File modification completed, content:', readFileSync(absolutePath, 'utf-8'))
    debug('Waiting for file change detection...')
    // Wait for change event with timeout matching global vitest config
    const timeout = 120000 // Increased timeout to match global vitest config
    const startTime = Date.now()
    while (!hasProcessedFile && Date.now() - startTime < timeout) {
      await sleep(100)
      debug('Waiting for file change... Time elapsed:', Date.now() - startTime)
    }
    if (!hasProcessedFile) {
      debug('Timeout waiting for file change event after', timeout, 'ms')
      debug('Watch process output history:', watchProcess?.stdout?.read()?.toString())
      debug('Final file state:', {
        exists: existsSync(absolutePath),
        content: existsSync(absolutePath) ? readFileSync(absolutePath, 'utf-8') : 'FILE_NOT_FOUND'
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
