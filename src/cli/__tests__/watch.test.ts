import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'
import { spawn, type ChildProcess, execSync } from 'child_process'
import { resolve, join, dirname } from 'path'
import { mkdirSync, writeFileSync, rmSync, openSync, closeSync, fsyncSync, statSync, existsSync, readFileSync } from 'fs'
import { writeFile, rm } from 'fs/promises'
import fetch from 'node-fetch'
import find from 'find-process'
import { sleep, debug } from '../../test/setup.js'

const TEST_TIMEOUT = 120000 // 2 minutes
const testDir = join(process.cwd(), 'test-watch-mode')
const singleFile = join(testDir, 'test.mdx')
const contentDir = join(testDir, 'content')

let activeProcesses: Array<{ process: ChildProcess; cleanup: () => Promise<void> }> = []

async function cleanupTestFiles() {
  debug('Running cleanup...')
  try {
    // Kill any lingering watch processes
    const processes = await find('name', 'node')
    for (const proc of processes) {
      if (proc.cmd && proc.cmd.includes('--watch')) {
        debug(`Killing watch process ${proc.pid}...`)
        try {
          process.kill(proc.pid)
        } catch (err) {
          debug(`Error killing process ${proc.pid}:`, err)
        }
      }
    }

    // Ensure test directories are removed
    const testDirs = [testDir, contentDir]
    for (const dir of testDirs) {
      try {
        await rm(dir, { recursive: true, force: true })
        debug(`Removed directory: ${dir}`)
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          debug(`Error removing directory ${dir}:`, err)
        }
      }
    }
    debug('Cleanup complete')
  } catch (err) {
    debug('Error during cleanup:', err)
    throw err
  }
}

function syncFile(filepath: string) {
  debug(`Syncing file: ${filepath}`)
  try {
    const fd = openSync(filepath, 'r')
    try {
      fsyncSync(fd)
      debug(`Successfully synced file: ${filepath}`)
    } finally {
      closeSync(fd)
      debug(`Closed file descriptor for: ${filepath}`)
    }
  } catch (err) {
    debug(`Error syncing file ${filepath}:`, err)
    throw err
  }
}

async function setupTestDirectory() {
  debug('Setting up test directory...')
  try {
    // Ensure clean state
    await cleanupTestFiles()

    // Create test directories
    mkdirSync(testDir, { recursive: true })
    mkdirSync(contentDir, { recursive: true })
    debug('Created test directories:', { testDir, contentDir })

    // Create initial test files
    const singleFile = join(testDir, 'test.mdx')
    await writeFile(singleFile, '# Test\nThis is a test file.\n')
    syncFile(singleFile)
    debug('Created and synced single test file:', singleFile)

    const page1Path = join(contentDir, 'page1.mdx')
    const page2Path = join(contentDir, 'page2.mdx')
    await writeFile(page1Path, '# Page 1\nThis is a test file.\n')
    await writeFile(page2Path, '# Page 2\nThis is another test file.\n')
    syncFile(page1Path)
    syncFile(page2Path)
    debug('Created and synced directory test files:', { page1Path, page2Path })

    // Verify file creation
    const stats = statSync(singleFile)
    debug('Test file stats:', {
      size: stats.size,
      mode: stats.mode,
      mtime: stats.mtime
    })
  } catch (error) {
    console.error('Error setting up test directory:', error)
    throw error
  }
}

describe('Watch Mode', () => {
  beforeEach(async () => {
    debug('Running beforeEach cleanup...')
    // Kill any lingering processes first
    for (const { process, cleanup } of activeProcesses) {
      debug('Cleaning up active process:', process.pid)
      try {
        await cleanup()
        debug('Successfully cleaned up process:', process.pid)
      } catch (err) {
        debug('Error during process cleanup:', err)
      }
    }
    activeProcesses = []
    await cleanupTestFiles()
    await setupTestDirectory()
    // Additional wait to ensure system is ready
    await sleep(2000)
    debug('beforeEach cleanup complete')
  })

  afterEach(async () => {
    debug('Running afterEach cleanup...')
    // Ensure all processes are terminated
    for (const { process, cleanup } of activeProcesses) {
      debug('Cleaning up active process:', process.pid)
      try {
        await cleanup()
        debug('Successfully cleaned up process:', process.pid)
      } catch (err) {
        debug('Error during process cleanup:', err)
      }
    }
    activeProcesses = []
    await cleanupTestFiles()
    // Additional wait to ensure cleanup is complete
    await sleep(2000)
    debug('afterEach cleanup complete')
  })

  it('should detect changes in single file mode', async () => {
    debug('Starting single file mode test')
    const absolutePath = resolve(testDir, 'test.mdx')
    debug(`Test file path: ${absolutePath}`)
    let initialProcessingDone = false
    let fileChangeProcessed = false
    let resolveInitialProcessing: () => void
    let resolveFileChange: () => void

    // Create promises with proper timeouts
    const initialProcessingPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for initial processing'))
      }, 45000) // 45 seconds for initial processing
      resolveInitialProcessing = () => {
        clearTimeout(timeout)
        resolve()
      }
    })

    const fileChangePromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for file change processing'))
      }, 45000) // 45 seconds for file change processing
      resolveFileChange = () => {
        clearTimeout(timeout)
        resolve()
      }
    })

    debug('Starting watcher process...')
    const watchProcess = spawn('node', ['./bin/cli.js', '--watch', absolutePath], {
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    })
    debug(`Watch process started with PID: ${watchProcess.pid}`)

    // Enhanced error handling and debug logging for watch process
    watchProcess.on('error', (error) => {
      debug('Watch process error:', error)
    })

    watchProcess.on('exit', (code) => {
      debug(`Watch process exited with code: ${code}`)
    })

    // Wait for watcher to fully initialize
    debug('Waiting for watcher initialization...')
    await sleep(5000)
    debug('Watcher process initialization complete')

    watchProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString()
      debug(`Watch process output: ${output.trim()}`)
      if (output.includes('Successfully processed file:')) {
        if (!initialProcessingDone) {
          debug('Initial processing completed successfully')
          initialProcessingDone = true
          resolveInitialProcessing()
        } else if (!fileChangeProcessed) {
          debug('File change processing completed successfully')
          fileChangeProcessed = true
          resolveFileChange()
        }
      }
    })

    watchProcess.stderr.on('data', (data: Buffer) => {
      debug(`Watch process error output: ${data.toString().trim()}`)
    })

    activeProcesses.push({
      process: watchProcess,
      cleanup: async () => {
        debug('Starting watch process cleanup...')
        try {
          watchProcess.kill('SIGTERM')
          await sleep(2000)
          if (!watchProcess.killed) {
            debug('Process did not terminate with SIGTERM, using SIGKILL')
            watchProcess.kill('SIGKILL')
          }
          debug('Watch process cleanup completed')
        } catch (err) {
          debug('Error during watch process cleanup:', err)
          throw err
        }
      }
    })

    try {
      debug('Waiting for initial processing...')
      await initialProcessingPromise
      debug('Initial processing complete, preparing for file modification')

      // Add delay before modifying file
      debug('Waiting before file modification...')
      await sleep(2000)
      debug('Starting file modification...')

      const originalContent = readFileSync(absolutePath, 'utf-8')
      debug(`Original file content: ${originalContent.trim()}`)

      debug('Writing updated content to file...')
      await writeFile(absolutePath, 'Updated content')
      debug('File write complete, syncing to disk...')
      syncFile(absolutePath)

      const newContent = readFileSync(absolutePath, 'utf-8')
      debug(`New file content: ${newContent.trim()}`)
      debug('File modification complete')

      // Add delay after file modification
      debug('Waiting after file modification...')
      await sleep(2000)
      debug('Starting file change detection...')
      await fileChangePromise
      debug('File change detection completed successfully')
    } catch (error) {
      debug('Test error:', error)
      throw error
    }
  }, TEST_TIMEOUT)

  it('should detect changes in directory mode', async () => {
    debug('Starting directory mode test')
    debug(`Content directory path: ${contentDir}`)
    let initialProcessingDone = false
    let fileChangeProcessed = false
    let resolveInitialProcessing: () => void
    let resolveFileChange: () => void

    // Create promises with proper timeouts
    const initialProcessingPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for initial processing'))
      }, 45000)
      resolveInitialProcessing = () => {
        clearTimeout(timeout)
        resolve()
      }
    })

    const fileChangePromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for file change processing'))
      }, 45000)
      resolveFileChange = () => {
        clearTimeout(timeout)
        resolve()
      }
    })

    debug('Starting watch process for directory mode...')
    const watchProcess = spawn('node', ['./bin/cli.js', '--watch', contentDir], {
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    })
    debug(`Directory watch process started with PID: ${watchProcess.pid}`)

    // Enhanced error handling and debug logging for watch process
    watchProcess.on('error', (error) => {
      debug('Directory watch process error:', error)
    })

    watchProcess.on('exit', (code) => {
      debug(`Directory watch process exited with code: ${code}`)
    })

    // Wait for watcher to fully initialize
    debug('Waiting for directory watcher initialization...')
    await sleep(5000)
    debug('Directory watcher initialization complete')

    watchProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString()
      debug(`Directory watch process output: ${output.trim()}`)
      if (output.includes('Successfully processed file:')) {
        if (!initialProcessingDone) {
          debug('Directory initial processing completed successfully')
          initialProcessingDone = true
          resolveInitialProcessing()
        } else if (!fileChangeProcessed) {
          debug('Directory file change processing completed successfully')
          fileChangeProcessed = true
          resolveFileChange()
        }
      }
    })

    watchProcess.stderr.on('data', (data: Buffer) => {
      debug(`Directory watch process error output: ${data.toString().trim()}`)
    })

    activeProcesses.push({
      process: watchProcess,
      cleanup: async () => {
        debug('Starting directory watch process cleanup...')
        try {
          watchProcess.kill('SIGTERM')
          await sleep(2000)
          if (!watchProcess.killed) {
            debug('Process did not terminate with SIGTERM, using SIGKILL')
            watchProcess.kill('SIGKILL')
          }
          debug('Directory watch process cleanup completed')
        } catch (err) {
          debug('Error during directory watch process cleanup:', err)
          throw err
        }
      }
    })

    try {
      debug('Waiting for directory initial processing...')
      await initialProcessingPromise
      debug('Directory initial processing complete, preparing for file modification')

      // Add delay before modifying file
      debug('Waiting before directory file modification...')
      await sleep(2000)
      debug('Starting directory file modification...')

      const page1Path = join(contentDir, 'page1.mdx')
      debug(`Target file path: ${page1Path}`)
      const originalContent = readFileSync(page1Path, 'utf-8')
      debug(`Original directory file content: ${originalContent.trim()}`)

      debug('Writing updated content to directory file...')
      await writeFile(page1Path, 'Updated content')
      debug('Directory file write complete, syncing to disk...')
      syncFile(page1Path)

      const newContent = readFileSync(page1Path, 'utf-8')
      debug(`New directory file content: ${newContent.trim()}`)
      debug('Directory file modification complete')

      // Add delay after file modification
      debug('Waiting after directory file modification...')
      await sleep(2000)
      debug('Starting directory file change detection...')
      await fileChangePromise
      debug('Directory file change detection completed successfully')
    } catch (error) {
      debug('Directory test error:', error)
      throw error
    }
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
