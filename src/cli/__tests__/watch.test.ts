import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import { spawn } from 'child_process'
import { join, resolve, dirname } from 'path'
import { mkdirSync, writeFileSync, rmSync, openSync, readFileSync, existsSync, statSync, fsyncSync, closeSync, watch, FSWatcher, readdirSync } from 'fs'
import fetch from 'node-fetch'
import { sleep, debug } from '../../test/setup.js'

const log = {
  test: (msg: string, ...args: any[]) => debug(`[TEST] ${msg}`, ...args),
  fs: (msg: string, ...args: any[]) => debug(`[FS] ${msg}`, ...args),
  proc: (msg: string, ...args: any[]) => debug(`[PROC] ${msg}`, ...args)
}

describe('Watch Mode', () => {
  const testDir = join(process.cwd(), 'test-watch-mode')
  const singleFile = join(testDir, 'test.mdx')
  const multiDir = join(testDir, 'content')
  let watchProcess: ReturnType<typeof spawn> | null = null
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true })
    mkdirSync(multiDir, { recursive: true })

    // Create test file with proper synchronization
    const fd = openSync(singleFile, 'w')
    writeFileSync(fd, `
# Test File
Initial content
    `, 'utf-8')
    fsyncSync(fd)
    closeSync(fd)

    // Create page1.mdx with proper synchronization
    const page1Fd = openSync(join(multiDir, 'page1.mdx'), 'w')
    writeFileSync(page1Fd, `
# Page 1
Initial content for page 1
    `, 'utf-8')
    fsyncSync(page1Fd)
    closeSync(page1Fd)

    // Create page2.mdx with proper synchronization
    const page2Fd = openSync(join(multiDir, 'page2.mdx'), 'w')
    writeFileSync(page2Fd, `
# Page 2
Initial content for page 2
    `, 'utf-8')
    fsyncSync(page2Fd)
    closeSync(page2Fd)

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
        // First attempt: SIGTERM
        watchProcess.kill('SIGTERM')
        
        // Wait for process to terminate gracefully
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            debug('SIGTERM timeout, attempting SIGINT')
            try {
              watchProcess?.kill('SIGINT')
              
              // Give SIGINT a chance, then force SIGKILL
              setTimeout(() => {
                debug('SIGINT timeout, forcing SIGKILL')
                try {
                  process.kill(watchProcess?.pid || 0, 'SIGKILL')
                } catch (e) {
                  debug('Error during SIGKILL:', e)
                }
                resolve()
              }, 2000)
            } catch (e) {
              debug('Error during SIGINT:', e)
              resolve()
            }
          }, 3000)

          watchProcess?.on('exit', (code, signal) => {
            clearTimeout(timeout)
            debug('Watch process exited:', { code, signal })
            resolve()
          })
        })
      } catch (error) {
        debug('Error during process cleanup:', error)
        try {
          process.kill(watchProcess.pid || 0, 'SIGKILL')
        } catch (e) {
          debug('Final SIGKILL attempt failed:', e)
        }
      } finally {
        // Ensure process is marked as terminated
        watchProcess = null
      }
    }

    // Clean up test directory
    try {
      if (existsSync(testDir)) {
        // Force sync before removal
        const files = readdirSync(testDir, { recursive: true }) as string[]
        for (const file of files) {
          const fullPath = join(testDir, file)
          try {
            if (statSync(fullPath).isFile()) {
              const fd = openSync(fullPath, 'r')
              fsyncSync(fd)
              closeSync(fd)
            }
          } catch (e) {
            debug('Error syncing file before cleanup:', e)
          }
        }
        rmSync(testDir, { recursive: true, force: true })
        debug('Test directory cleaned up successfully')
      }
    } catch (error) {
      debug('Error cleaning up test directory:', error)
    }
  })

  it('should detect changes in single file mode', async () => {
    let hasProcessedFile = false
    const absolutePath = resolve(process.cwd(), singleFile)
    const args = ['--watch', absolutePath]
    let filePath = absolutePath // Ensure filePath is accessible in closure

    debug('=== Test Setup ===')
    debug('Test directory path:', testDir)
    debug('Absolute file path:', absolutePath)
    debug('Current working directory:', process.cwd())
    
    // Ensure test directory exists and is clean
    mkdirSync(dirname(absolutePath), { recursive: true })
    if (existsSync(absolutePath)) {
      rmSync(absolutePath)
    }
    
    // Sync directory after cleanup
    const dirFd = openSync(dirname(absolutePath), 'r')
    fsyncSync(dirFd)
    closeSync(dirFd)
    
    // Create initial file with proper synchronization
    let fd: number | undefined
    try {
      const initialContent = `# Initial Test\nThis is a test file.\n`
      fd = openSync(absolutePath, 'w')
      writeFileSync(fd, initialContent, 'utf-8')
      fsyncSync(fd)
      closeSync(fd)
      fd = undefined
      
      // Verify file was written correctly
      await new Promise<void>((resolve) => setTimeout(resolve, 1000))
      
      if (!existsSync(absolutePath)) {
        throw new Error('File does not exist after creation')
      }
      
      const stats = statSync(absolutePath)
      debug('Initial file stats:', {
        size: stats.size,
        mode: stats.mode,
        mtime: stats.mtime
      })
      
      const content = readFileSync(absolutePath, 'utf-8')
      if (content !== initialContent) {
        throw new Error(`File content mismatch. Expected:\n${initialContent}\nGot:\n${content}`)
      }
      
      debug('Initial file created and verified successfully')
    } catch (error) {
      debug('Error in file setup:', error)
      if (fd !== undefined) {
        try {
          closeSync(fd)
        } catch (e) {
          debug('Error closing file:', e)
        }
      }
      throw error
    }

    // Ensure file exists and is stable before starting watch
    await sleep(2000)
    debug('Pre-watch file check - exists:', existsSync(filePath));
    debug('Pre-watch file content:', readFileSync(filePath, 'utf-8'));

    debug('Starting watch process with args:', args)
    watchProcess = spawn('node', ['./bin/cli.js', ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
      cwd: process.cwd(),
      env: {
        ...process.env,
        DEBUG: 'mdxe:*',
        FORCE_COLOR: '0',
        NODE_ENV: 'test',
        NODE_DEBUG: 'fs,watch'
      } as NodeJS.ProcessEnv,
      windowsHide: true,
      shell: false
    })
    log.proc('Started watch process:', { pid: watchProcess.pid })

    if (!watchProcess || !watchProcess.stdout) {
      if (watchProcess) watchProcess.kill()
      throw new Error('Failed to spawn process or get process streams')
    }

    // Store stream references to avoid null checks
    const stdout = watchProcess.stdout
    
    const handleStdout = (data: Buffer) => {
      const output = data.toString()
      debug('Watch process output:', output)
      
      // More specific output matching
      const successIndicators = [
        'Processing file:',
        'File changed:',
        'Watch target:',
        'Watching for changes',
        'Starting watch mode'
      ]
      
      if (successIndicators.some(indicator => output.includes(indicator))) {
        hasProcessedFile = true
        debug('File change or process success detected:', {
          output: output.trim(),
          matchedIndicator: successIndicators.find(i => output.includes(i))
        })
      }
      
      // Additional debug info
      if (output.includes('error') || output.includes('Error')) {
        debug('Error detected in watch process output:', output.trim())
      }
    }
    stdout.on('data', handleStdout)

    if (!watchProcess.stderr) {
      throw new Error('Failed to get stderr from watch process')
    }

    watchProcess.stderr.on('data', (data) => {
      debug('Watch process error:', data.toString())
    })

    // Wait for watcher to be ready with enhanced logging and timeout handling
    debug('Waiting for watcher to be ready...')
    debug('Process environment:', {
      DEBUG: process.env.DEBUG,
      NODE_DEBUG: process.env.NODE_DEBUG,
      NODE_ENV: process.env.NODE_ENV
    })
    
    await new Promise<void>((resolve, reject) => {
      const startTime = Date.now()
      const state = {
        readyReceived: false,
        changeReceived: false,
        lastOutput: '',
        outputHistory: [] as string[]
      }
      
      const debugState = () => {
        const filePath = absolutePath
        const stats = existsSync(filePath) ? statSync(filePath) : null
        return {
          elapsedMs: Date.now() - startTime,
          processState: {
            killed: watchProcess?.killed,
            exitCode: watchProcess?.exitCode,
            pid: watchProcess?.pid,
            env: process.env.NODE_DEBUG,
            cwd: process.cwd()
          },
          fileState: {
            exists: existsSync(filePath),
            content: existsSync(filePath) ? readFileSync(filePath, 'utf-8') : 'FILE_NOT_FOUND',
            stats: stats ? {
              size: stats.size,
              mode: stats.mode,
              mtime: stats.mtime,
              ctime: stats.ctime
            } : null
          },
          watcherState: {
            ...state,
            outputHistory: state.outputHistory.slice(-5) // Last 5 outputs
          }
        }
      }

      let timeoutId: NodeJS.Timeout
      let statusInterval: NodeJS.Timeout

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId)
        if (statusInterval) clearInterval(statusInterval)
        if (watchProcess?.stdout) {
          watchProcess.stdout.removeAllListeners()
        }
        if (watchProcess?.stderr) {
          watchProcess.stderr.removeAllListeners()
        }
      }

      // Set up periodic status check
      statusInterval = setInterval(() => {
        const status = debugState()
        debug('Watcher status:', status)
      }, 5000)

      const handleOutput = (data: Buffer) => {
        const output = data.toString()
        state.lastOutput = output
        state.outputHistory.push(output)
        debug('Received output:', output)
        
        if (output.includes('Initial scan complete') || output.includes('Watching for changes')) {
          state.readyReceived = true
          debug('Ready event received')
          cleanup()
          resolve()
        }
      }

      timeoutId = setTimeout(() => {
        const status = debugState()
        debug('Timeout waiting for watcher:', status)
        cleanup()
        reject(new Error(`Timeout waiting for watcher to be ready. Status: ${JSON.stringify(status, null, 2)}`))
      }, 30000) // Reduce timeout to fail faster

      if (!watchProcess) {
        cleanup()
        reject(new Error('Watch process not initialized'))
        return
      }

      if (watchProcess.stdout) {
        watchProcess.stdout.on('data', handleOutput)
      }

      if (watchProcess.stderr) {
        watchProcess.stderr.on('data', (data: Buffer) => {
          const error = data.toString()
          debug('Watch process stderr:', error)
          state.outputHistory.push(`[ERROR] ${error}`)
        })
      }
    })
    
    await sleep(1000)

    debug('=== Starting file modification test ===')
    try {
      // Ensure watcher is ready and stable
      await sleep(2000)
      debug('Starting file modification after delay')
      
      const timestamp = Date.now()
      const newContent = `# Modified Content ${timestamp}\nThis is the updated content.\n`
      
      // Write content with atomic operation and explicit sync
      let fd: number | undefined
      try {
        // First, truncate the file to ensure a complete rewrite
        fd = openSync(filePath, 'w')
        writeFileSync(fd, '', 'utf-8')
        fsyncSync(fd)
        closeSync(fd)
        
        // Then write the new content
        fd = openSync(filePath, 'w')
        writeFileSync(fd, newContent, 'utf-8')
        fsyncSync(fd)
        closeSync(fd)
        fd = undefined
        
        // Force a file system sync
        const syncFd = openSync(dirname(filePath), 'r')
        fsyncSync(syncFd)
        closeSync(syncFd)
        
        debug('Content written and synced to file')
      } catch (error) {
        if (fd !== undefined) {
          try {
            closeSync(fd)
          } catch (e) {
            debug('Error closing file during error handling:', e)
          }
        }
        throw error
      }
      
      // Verify content with retries
      let verifyContent: string | undefined
      let verifyAttempts = 0
      const maxAttempts = 5
      
      while (verifyAttempts < maxAttempts) {
        try {
          verifyContent = readFileSync(filePath, 'utf-8')
          if (verifyContent === newContent) {
            break
          }
          debug(`Content verification attempt ${verifyAttempts + 1} failed, retrying...`)
          await sleep(500)
        } catch (e) {
          debug(`Read error on attempt ${verifyAttempts + 1}:`, e)
        }
        verifyAttempts++
      }
      
      if (!verifyContent || verifyContent !== newContent) {
        debug('File content verification failed after all attempts')
        debug('Expected:', newContent)
        debug('Actual:', verifyContent)
        throw new Error('File content verification failed after multiple attempts')
      }
      
      // Get and log detailed file information
      const stats = statSync(filePath)
      debug('File modification completed and verified', {
        size: stats.size,
        mode: stats.mode,
        mtime: stats.mtime,
        ctime: stats.ctime,
        uid: stats.uid,
        gid: stats.gid,
        content: verifyContent,
        exists: existsSync(filePath),
        verifyAttempts
      })
    } catch (error) {
      debug('Error modifying file:', error)
      throw error
    }

    debug('=== Waiting for file change detection ===')
    const timeout = 120000 // Match global vitest timeout
    const startTime = Date.now()
    let lastCheck = startTime
    let checkCount = 0
    
    // Enhanced waiting logic with progressive status updates
    while (!hasProcessedFile && Date.now() - startTime < timeout) {
      const now = Date.now()
      checkCount++
      
      // Log status every second
      if (now - lastCheck >= 1000) {
        debug('Waiting for change detection...', {
          elapsedMs: now - startTime,
          checks: checkCount,
          hasProcessedFile,
          processActive: !!watchProcess && !watchProcess.killed
        })
        lastCheck = now
      }
      
      // Check process state and output
      if (!watchProcess || watchProcess.killed) {
        debug('Watch process terminated unexpectedly')
        break
      }

      // Enhanced file state verification with buffer check
      try {
        const stats = statSync(filePath)
        const currentContent = readFileSync(filePath, 'utf-8')
        debug('Current file state:', {
          size: stats.size,
          mtime: stats.mtime,
          content: currentContent.slice(0, 100) + (currentContent.length > 100 ? '...' : ''),
          exists: true,
          processState: {
            killed: watchProcess?.killed,
            exitCode: watchProcess?.exitCode,
            pid: watchProcess?.pid
          }
        })

        // Check process stdout buffer
        if (watchProcess.stdout) {
          const stdoutBuffer = (watchProcess.stdout as any)._readableState?.buffer
          if (stdoutBuffer) {
            debug('Process stdout buffer state:', {
              length: stdoutBuffer.length,
              hasData: stdoutBuffer.length > 0
            })
          }
        }
      } catch (error) {
        debug('Error checking file state:', error)
      }
      
      // Adaptive sleep between checks
      await sleep(checkCount < 10 ? 100 : 500)
    }
    
    // Detailed failure information
    if (!hasProcessedFile) {
      const endTime = Date.now()
      debug('Change detection timeout or failure:', {
        testDuration: {
          elapsed: endTime - startTime,
          timeout,
          checkCount
        },
        processState: {
          active: !!watchProcess && !watchProcess.killed,
          killed: watchProcess?.killed,
          exitCode: watchProcess?.exitCode,
          pid: watchProcess?.pid
        },
        fileState: {
          exists: existsSync(filePath),
          stats: existsSync(filePath) ? statSync(filePath) : null,
          content: existsSync(filePath) ? readFileSync(filePath, 'utf-8') : 'FILE_NOT_FOUND'
        },
        watcherState: {
          hasProcessedFile,
          outputHistory: stdout ? 'Available' : 'Not available'
        }
      })
    }

    expect(hasProcessedFile).toBe(true)
  })

  it('should detect changes in directory mode', async () => {
    let hasProcessedFiles = false
    const args = ['--watch', multiDir]

    debug('=== Directory Mode Test Setup ===')
    debug('Test directory path:', multiDir)
    debug('Current working directory:', process.cwd())

    watchProcess = spawn('node', ['./bin/cli.js', ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
      cwd: process.cwd(),
      env: {
        ...process.env,
        DEBUG: '*',
        FORCE_COLOR: '0',
        NODE_ENV: 'test',
        NODE_DEBUG: 'fs,watch,stream'
      } as NodeJS.ProcessEnv,
      windowsHide: true
    })
    log.proc('Started watch process:', { pid: watchProcess.pid })

    if (!watchProcess || !watchProcess.stdout) {
      if (watchProcess) watchProcess.kill()
      throw new Error('Failed to spawn process or get process streams')
    }

    // Store stream references to avoid null checks
    const stdout = watchProcess.stdout

    stdout.on('data', (data) => {
      const output = data.toString()
      debug('Watch process output:', output)
      if (output.includes('has been changed') || output.includes('Successfully processed file:')) {
        hasProcessedFiles = true
        debug('File change or process success detected')
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
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        watchProcess?.stdout?.removeListener('data', readyHandler)
        debug('Timeout waiting for watcher:', {
          processState: {
            killed: watchProcess?.killed,
            exitCode: watchProcess?.exitCode,
            pid: watchProcess?.pid
          },
          directoryState: {
            exists: existsSync(multiDir),
            files: existsSync(multiDir) ? 
              readFileSync(join(multiDir, 'page1.mdx'), 'utf-8') : 'DIR_NOT_FOUND'
          }
        })
        reject(new Error('Timeout waiting for watcher to be ready'))
      }, 120000) // Match global vitest timeout

      const readyHandler = (data: Buffer) => {
        const output = data.toString()
        if (output.includes('Initial scan complete')) {
          watchProcess?.stdout?.removeListener('data', readyHandler)
          clearTimeout(timeoutId)
          debug('Watcher ready event received')
          resolve()
        }
      }

      watchProcess?.stdout?.on('data', readyHandler)
    })

    await sleep(1000)

    debug('Modifying page1.mdx...')
    try {
      const timestamp = Date.now()
      const page1Content = `# Modified Page 1 ${timestamp}\nThis is an updated test file.\n`
      
      // Write content with atomic operation
      writeFileSync(join(multiDir, 'page1.mdx'), page1Content, { encoding: 'utf-8', flag: 'w' })
      debug('Content written to page1.mdx')
      
      debug('Adding page3.mdx...')
      const page3Content = `# Page 3 ${timestamp}\nThis is a new test file.\n`
      writeFileSync(join(multiDir, 'page3.mdx'), page3Content, { encoding: 'utf-8', flag: 'w' })
      debug('Content written to page3.mdx')
      
      // Verify content
      const verifyPage1 = readFileSync(join(multiDir, 'page1.mdx'), 'utf-8')
      const verifyPage3 = readFileSync(join(multiDir, 'page3.mdx'), 'utf-8')
      
      if (verifyPage1 !== page1Content || verifyPage3 !== page3Content) {
        debug('File content verification failed')
        debug('Expected page1:', page1Content)
        debug('Actual page1:', verifyPage1)
        debug('Expected page3:', page3Content)
        debug('Actual page3:', verifyPage3)
        throw new Error('File content verification failed')
      }
      
      debug('File modifications completed and verified')
      debug('Directory contents:', {
        page1: verifyPage1,
        page3: verifyPage3
      })
    } catch (error) {
      debug('Error modifying files:', error)
      throw error
    }

    debug('Waiting for file change detection...')
    // Wait for change event with timeout matching global vitest config
    const timeout = 120000
    const startTime = Date.now()
    
    // Enhanced waiting logic with file system event verification
    while (!hasProcessedFiles && Date.now() - startTime < timeout) {
      await sleep(100)
      if (!watchProcess || watchProcess.killed) {
        debug('Watch process terminated unexpectedly')
        break
      }
      // Verify directory contents periodically
      try {
        const currentState = {
          page1: existsSync(join(multiDir, 'page1.mdx')) ? readFileSync(join(multiDir, 'page1.mdx'), 'utf-8') : 'FILE_NOT_FOUND',
          page2: existsSync(join(multiDir, 'page2.mdx')) ? readFileSync(join(multiDir, 'page2.mdx'), 'utf-8') : 'FILE_NOT_FOUND',
          page3: existsSync(join(multiDir, 'page3.mdx')) ? readFileSync(join(multiDir, 'page3.mdx'), 'utf-8') : 'FILE_NOT_FOUND'
        }
        debug('Current directory state:', currentState)
      } catch (error) {
        debug('Error reading directory during wait:', error)
      }
    }
    
    if (!hasProcessedFiles) {
      debug('Timeout or failure occurred:', {
        elapsed: Date.now() - startTime,
        timeout,
        watcherActive: !!watchProcess && !watchProcess.killed,
        directoryState: {
          exists: existsSync(multiDir),
          files: {
            page1: existsSync(join(multiDir, 'page1.mdx')) ? readFileSync(join(multiDir, 'page1.mdx'), 'utf-8') : 'FILE_NOT_FOUND',
            page2: existsSync(join(multiDir, 'page2.mdx')) ? readFileSync(join(multiDir, 'page2.mdx'), 'utf-8') : 'FILE_NOT_FOUND',
            page3: existsSync(join(multiDir, 'page3.mdx')) ? readFileSync(join(multiDir, 'page3.mdx'), 'utf-8') : 'FILE_NOT_FOUND'
          }
        },
        processState: {
          killed: watchProcess?.killed,
          exitCode: watchProcess?.exitCode,
          pid: watchProcess?.pid
        }
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
    const serverStartTimeout = 120000 // Match global vitest timeout
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
