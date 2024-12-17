import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'
import { spawn, type ChildProcess } from 'child_process'
import { resolve, join, dirname } from 'path'
import { mkdirSync, writeFileSync, rmSync, openSync, closeSync, fsyncSync, statSync, existsSync } from 'fs'
import fetch from 'node-fetch'
import { sleep, debug } from '../../test/setup.js'

const TEST_TIMEOUT = 120000 // 2 minutes
const testDir = join(process.cwd(), 'test-watch-mode')
const singleFile = join(testDir, 'test.mdx')
const contentDir = join(testDir, 'content')

let activeProcesses: Array<{ process: ChildProcess; cleanup: () => Promise<void> }> = []

async function cleanupTestFiles() {
  for (const { process, cleanup } of activeProcesses) {
    try {
      process.kill()
      await cleanup()
    } catch (error) {
      debug('Error cleaning up process:', error)
    }
  }
  activeProcesses = []

  try {
    rmSync(testDir, { recursive: true, force: true })
    debug('Cleaned up test directory:', testDir)
  } catch (error) {
    debug('Error cleaning up test directory:', error)
  }
}

// Utility function to sync file to disk
function syncFile(filepath: string) {
  const fd = openSync(filepath, 'r')
  fsyncSync(fd)
  closeSync(fd)
  // Also sync the directory to ensure the file creation is persisted
  const dirFd = openSync(dirname(filepath), 'r')
  fsyncSync(dirFd)
  closeSync(dirFd)
  debug(`Synced file and directory: ${filepath}`)
}

async function setupTestDirectory() {
  try {
    mkdirSync(testDir, { recursive: true })
    mkdirSync(contentDir, { recursive: true })
    debug('Created test directories:', { testDir, contentDir })
  } catch (error) {
    debug('Error setting up test directories:', error)
  }
}

describe('Watch Mode', () => {
  beforeEach(async () => {
    debug('Running beforeEach cleanup...')
    // Kill any lingering processes first
    for (const { process, cleanup } of activeProcesses) {
      debug('Cleaning up active process:', process.pid)
      cleanup()
    }
    activeProcesses = []
    await cleanupTestFiles()
    await setupTestDirectory()
    debug('beforeEach cleanup complete')
  })

  afterEach(async () => {
    debug('Running afterEach cleanup...')
    // Ensure all processes are terminated
    for (const { process, cleanup } of activeProcesses) {
      debug('Cleaning up active process:', process.pid)
      cleanup()
    }
    activeProcesses = []
    await cleanupTestFiles()
    debug('afterEach cleanup complete')
  })

  it('should detect changes in single file mode', async () => {
    let hasProcessedFile = false
    const absolutePath = resolve(process.cwd(), singleFile)
    const cliPath = resolve(process.cwd(), 'bin', 'cli.js')
    const args = ['--watch', absolutePath]  // Ensure --watch flag is present

    debug('Starting single file mode test')
    debug('Test configuration:', {
      absolutePath,
      cliPath,
      args,
      cwd: process.cwd()
    })

    const fd = openSync(absolutePath, 'w')
    try {
      const initialContent = `# Initial Test\nThis is a test file.\n`
      writeFileSync(fd, initialContent, 'utf-8')
      fsyncSync(fd)
      debug('Initial file written:', {
        content: initialContent,
        path: absolutePath
      })
    } finally {
      closeSync(fd)
      debug('File descriptor closed')
    }

    try {
      const stats = statSync(absolutePath)
      debug('Initial file stats:', {
        size: stats.size,
        mode: stats.mode,
        mtime: stats.mtime,
        exists: existsSync(absolutePath)
      })
    } catch (error) {
      debug('Error checking file:', error)
      throw error
    }

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DEBUG: '*',
      NODE_ENV: 'test',
      FORCE_COLOR: '0',
      NO_COLOR: '1'
    }

    debug('Spawning watch process...')
    const watchProcess: ChildProcess = spawn('node', [cliPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
      cwd: process.cwd(),
      shell: false
    })

    debug('Watch process spawned:', {
      pid: watchProcess.pid,
      spawnargs: watchProcess.spawnargs
    })

    activeProcesses.push({
      process: watchProcess,
      cleanup: async () => {
        debug('Cleaning up watch process...')
        try {
          watchProcess.kill('SIGTERM')
          await sleep(1000)
          if (!watchProcess.killed) {
            watchProcess.kill('SIGKILL')
            debug('Process killed with SIGKILL')
          }
        } catch (error: any) {
          debug('Error force killing process:', error)
        }
      }
    })

    watchProcess.on('error', (error: Error) => {
      debug('Watch process error:', error)
      throw error
    })

    watchProcess.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      debug('Watch process exited:', { code, signal })
      if (code !== null && code !== 0) {
        throw new Error(`Watch process exited with code ${code}`)
      }
      if (signal !== null) {
        throw new Error(`Watch process killed with signal ${signal}`)
      }
    })

    let output = ''
    watchProcess.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString()
      output += chunk
      debug('Watch process stdout:', chunk)
      if (chunk.includes('Successfully processed file:')) {
        debug('Change detection success marker found in output')
        hasProcessedFile = true
      }
    })

    watchProcess.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString()
      debug('Watch process stderr:', chunk)
    })

    debug('Waiting for watcher initialization...')
    await sleep(5000) // Increase wait time to account for polling interval
    debug('Initialization wait complete')

    debug('Modifying test file...')
    const updateFd = openSync(absolutePath, 'w')
    try {
      const updatedContent = `# Updated Test\nThis file has been modified.\n`
      writeFileSync(updateFd, updatedContent, 'utf-8')
      fsyncSync(updateFd)
      const dirFd = openSync(dirname(absolutePath), 'r')
      try {
        fsyncSync(dirFd)
        debug('Directory synced')
      } finally {
        closeSync(dirFd)
      }
      debug('File modification completed:', {
        content: updatedContent,
        path: absolutePath,
        timestamp: new Date().toISOString()
      })
    } finally {
      closeSync(updateFd)
      debug('Update file descriptor closed')
    }

    try {
      const stats = statSync(absolutePath)
      debug('Modified file stats:', {
        size: stats.size,
        mode: stats.mode,
        mtime: stats.mtime,
        exists: existsSync(absolutePath)
      })
    } catch (error) {
      debug('Error checking modified file:', error)
      throw error
    }

    const startTime = Date.now()
    while (!hasProcessedFile && Date.now() - startTime < TEST_TIMEOUT - 2000) {
      debug('Still waiting for change detection...', {
        elapsed: Date.now() - startTime,
        hasProcessedFile,
        outputLength: output.length
      })
      await sleep(500)
    }

    debug('Test completion state:', {
      hasProcessedFile,
      elapsedTime: Date.now() - startTime,
      outputLength: output.length,
      output
    })

    expect(hasProcessedFile).toBe(true)
  }, TEST_TIMEOUT)

  it('should detect changes in directory mode', async () => {
    let hasProcessedFiles = false
    const args = ['--watch', contentDir]
    const cliPath = resolve(process.cwd(), 'bin', 'cli.js')

    const watchProcess: ChildProcess = spawn('node', [cliPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, DEBUG: '*', NODE_ENV: 'test', FORCE_COLOR: '0', NO_COLOR: '1' },
      cwd: process.cwd()
    })

    activeProcesses.push({
      process: watchProcess,
      cleanup: async () => {
        try {
          watchProcess.kill('SIGTERM')
          await sleep(1000)
          if (!watchProcess.killed) {
            watchProcess.kill('SIGKILL')
          }
        } catch (error) {
          debug('Error killing watch process:', error)
        }
      }
    })

    watchProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      debug('Watch process output:', output)
      if (output.includes('has been changed') || output.includes('has been added')) {
        debug('Change event detected')
        hasProcessedFiles = true
      }
    })

    watchProcess.stderr?.on('data', (data: Buffer) => {
      debug('Watch process error:', data.toString())
    })

    debug('Waiting for initial processing...')
    await sleep(5000) // Increase wait time to match single file mode
    debug('Initial wait complete')
    debug('Modifying page1.mdx...')
    const page1Path = join(contentDir, 'page1.mdx')
    const page1Fd = openSync(page1Path, 'w')
    try {
      writeFileSync(page1Fd, `# Updated Page 1\nThis is an updated test file.\n`, 'utf-8')
      fsyncSync(page1Fd)
      // Add additional fsync on the directory
      const dirFd = openSync(dirname(page1Path), 'r')
      try {
        fsyncSync(dirFd)
        debug('Directory synced')
      } finally {
        closeSync(dirFd)
      }
      debug('File modification completed:', { path: page1Path, timestamp: new Date().toISOString() })
    } finally {
      closeSync(page1Fd)
    }

    debug('Adding page3.mdx...')
    const page3Path = join(contentDir, 'page3.mdx')
    const page3Fd = openSync(page3Path, 'w')
    try {
      writeFileSync(page3Fd, `# Page 3\nThis is a new test file.\n`, 'utf-8')
      fsyncSync(page3Fd)
      // Add additional fsync on the directory
      const dirFd = openSync(dirname(page3Path), 'r')
      try {
        fsyncSync(dirFd)
        debug('Directory synced')
      } finally {
        closeSync(dirFd)
      }
      debug('File addition completed:', { path: page3Path, timestamp: new Date().toISOString() })
    } finally {
      closeSync(page3Fd)
    }

    const startTime = Date.now()
    while (!hasProcessedFiles && Date.now() - startTime < TEST_TIMEOUT - 2000) {
      await sleep(500)
      debug('Still waiting for change detection...')
    }

    expect(hasProcessedFiles, 'Directory changes should be detected').toBe(true)
  }, TEST_TIMEOUT)

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

    const cliPath = resolve(process.cwd(), 'bin', 'cli.js')
    const watchProcess: ChildProcess = spawn('node', [cliPath, ...args], {
      cwd: testDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: port.toString(),
      },
    })

    activeProcesses.push({
      process: watchProcess,
      cleanup: async () => {
        try {
          watchProcess.kill('SIGTERM')
          await sleep(1000)
          if (!watchProcess.killed) {
            watchProcess.kill('SIGKILL')
          }
        } catch (error) {
          debug('Error killing watch process:', error)
        }
      }
    })

    watchProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      debug(`Next dev output: ${output}`)
      expect(output).toContain('Watch Mode Test')
    })

    debug('Waiting for Next.js dev server to start...')
    await sleep(5000)

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
  }, TEST_TIMEOUT)
})
