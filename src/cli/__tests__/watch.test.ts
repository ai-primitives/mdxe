import { describe, it, beforeEach, afterEach, expect } from 'vitest'
import { setTimeout, clearTimeout } from 'node:timers'
import { spawn } from 'child_process'
import { join, resolve } from 'path'
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync, statSync, watch } from 'fs'
import { sleep, debug } from '../../test/setup.js'

interface ProcessState {
  ready: boolean
  changed: boolean
  error: Error | null
  lastOutput: string
  hasProcessedFile: boolean
  hasProcessedFiles: boolean
  fileWatcher: ReturnType<typeof watch> | null
}

const createProcessState = (): ProcessState => ({
  ready: false,
  changed: false,
  error: null,
  lastOutput: '',
  hasProcessedFile: false,
  hasProcessedFiles: false,
  fileWatcher: null
})

let processState: ProcessState = createProcessState()

const log = {
  test: (msg: string, ...args: unknown[]) => debug(`[TEST] ${msg}`, ...args),
  fs: (msg: string, ...args: unknown[]) => debug(`[FS] ${msg}`, ...args),
  proc: (msg: string, ...args: unknown[]) => debug(`[PROC] ${msg}`, ...args)
}

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

    // Configuration handled by mdxe.config.js
  })

  afterEach(async () => {
    debug('Cleaning up watch process, file watcher, and test directory...')
    if (watchProcess) {
      try {
        watchProcess.kill('SIGTERM')
        await sleep(1000) // Wait for process to terminate
      } catch (error) {
        debug('Error killing watch process:', error)
      }
      watchProcess = null
    }
    
    if (processState.fileWatcher) {
      try {
        processState.fileWatcher.close()
      } catch (error) {
        debug('Error closing file watcher:', error)
      }
      processState.fileWatcher = null
    }

    try {
      rmSync(testDir, { recursive: true, force: true })
    } catch (error) {
      debug('Error removing test directory:', error)
    }
  })

  it('should detect changes in single file mode', async () => {
    processState = createProcessState()
    const absolutePath = resolve(process.cwd(), singleFile)
    const args = ['--watch', absolutePath]

    debug('=== Test Setup ===')
    debug('Test directory path:', testDir)
    debug('Absolute file path:', absolutePath)
    debug('Current working directory:', process.cwd())
    
    // Create initial file with synchronous operations
    try {
      writeFileSync(absolutePath, `# Initial Test\nThis is a test file.\n`, 'utf-8')
      debug('Initial file created successfully')
      debug('Initial file exists:', existsSync(absolutePath))
      debug('Initial file content:', readFileSync(absolutePath, 'utf-8'))
    } catch (error) {
      debug('Error creating initial file:', error)
      throw error
    }

    // Ensure file exists before starting watch
    await sleep(1000)
    debug('Pre-watch file check - exists:', existsSync(absolutePath))
    debug('Pre-watch file content:', readFileSync(absolutePath, 'utf-8'))

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
    
    stdout.on('data', (data) => {
      const output = data.toString()
      processState.lastOutput = output
      debug('Watch process output:', output)
      
      if (output.includes('Initial scan complete')) {
        processState.ready = true
        debug('Watch process ready')
      }
      
      if (output.includes('Processing file:') || output.includes('File changed:') || output.includes('Watch target:')) {
        processState.changed = true
        processState.hasProcessedFile = true
        debug('File change detected:', output.trim())
      }
    })

    if (!watchProcess.stderr) {
      if (processState.fileWatcher) processState.fileWatcher.close()
      throw new Error('Failed to get stderr from watch process')
    }

    watchProcess.stderr.on('data', (data) => {
      debug('Watch process error:', data.toString())
    })

    // Wait for watcher to be ready with enhanced logging
    debug('Waiting for watcher to be ready...')
    
    await new Promise<void>((resolve, reject) => {
      const startTime = Date.now()
      const state = {
        readyReceived: false,
        changeReceived: false
      }
      
      const debugState = () => ({
        elapsedMs: Date.now() - startTime,
        processState: {
          killed: watchProcess?.killed,
          exitCode: watchProcess?.exitCode,
          pid: watchProcess?.pid,
          env: process.env.NODE_DEBUG,
          cwd: process.cwd()
        },
        fileState: {
          exists: existsSync(absolutePath),
          content: existsSync(absolutePath) ? readFileSync(absolutePath, 'utf-8') : 'FILE_NOT_FOUND',
          stats: existsSync(absolutePath) ? statSync(absolutePath) : null
        },
        watcherState: state
      })

      let timeoutId: NodeJS.Timeout

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId)
        if (watchProcess?.stdout) watchProcess.stdout.removeListener('data', handleOutput)
        if (processState.fileWatcher) processState.fileWatcher.close()
      }

      const handleOutput = (data: Buffer) => {
        const output = data.toString()
        debug('Received output:', output)
        
        if (output.includes('Initial scan complete')) {
          state.readyReceived = true
          debug('Ready event received')
        }
        
        if (output.includes('File changed:')) {
          state.changeReceived = true
          debug('Change event received')
        }
        
        if (state.readyReceived && state.changeReceived) {
          debug('All required events received:', debugState())
          cleanup()
          resolve()
        }
      }

      timeoutId = setTimeout(() => {
        debug('Timeout waiting for watcher:', debugState())
        cleanup()
        reject(new Error('Timeout waiting for watcher to be ready'))
      }, 60000) // Increased timeout for watch mode tests

      if (watchProcess?.stdout) {
        watchProcess.stdout.on('data', handleOutput)
      }

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

    debug('Modifying test file...')
    try {
      const timestamp = Date.now()
      const newContent = `# Modified Content ${timestamp}\nThis is the updated content.\n`
      
      // Write content with atomic operation
      writeFileSync(absolutePath, newContent, { encoding: 'utf-8', flag: 'w' })
      debug('Content written to file')
      
      // Verify content
      const verifyContent = readFileSync(absolutePath, 'utf-8')
      debug('Verification read completed')
      
      
      if (verifyContent !== newContent) {
        debug('File content verification failed')
        debug('Expected:', newContent)
        debug('Actual:', verifyContent)
        throw new Error('File content verification failed')
      }
      
      debug('File modification completed and verified')
      debug('Modified content:', newContent)
      debug('File stats:', statSync(absolutePath))
    } catch (error) {
      debug('Error modifying file:', error)
      if (processState.fileWatcher) processState.fileWatcher.close()
      throw error
    }

    debug('Waiting for file change detection...')
    // Wait for change event with timeout matching global vitest config
    const timeout = 120000
    const startTime = Date.now()
    
    // Enhanced waiting logic with file system event verification
    while (!processState.hasProcessedFile && Date.now() - startTime < timeout) {
      await sleep(100)
      if (!watchProcess || watchProcess.killed) {
        debug('Watch process terminated unexpectedly')
        break
      }
      // Verify file content periodically
      try {
        const currentContent = readFileSync(absolutePath, 'utf-8')
        debug('Current file content:', currentContent)
      } catch (error) {
        debug('Error reading file during wait:', error)
      }
    }
    
    if (!processState.hasProcessedFile) {
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

    expect(processState.changed).toBe(true)
  })

  it('should detect changes in directory mode', async () => {
    processState = createProcessState()
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
      processState.lastOutput = output
      debug('Watch process output:', output)
      
      if (output.includes('Initial scan complete')) {
        processState.ready = true
        debug('Watch process ready')
      }
      
      if (output.includes('has been changed') || output.includes('Successfully processed file:')) {
        processState.changed = true
        processState.hasProcessedFiles = true
        debug('File change detected')
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
      }, 30000)

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
    while (!processState.hasProcessedFiles && Date.now() - startTime < timeout) {
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
    
    if (!processState.hasProcessedFiles) {
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

    expect(processState.changed).toBe(true)
  })

})
