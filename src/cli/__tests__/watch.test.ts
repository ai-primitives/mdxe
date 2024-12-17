import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'
import { spawn, type ChildProcess, execSync } from 'child_process'
import { resolve, join, dirname } from 'path'
import { mkdirSync, writeFileSync, rmSync, openSync, closeSync, fsyncSync, statSync, existsSync, readFileSync } from 'fs'
import { writeFile } from 'fs/promises'
import fetch from 'node-fetch'
import { sleep, debug } from '../../test/setup.js'

const TEST_TIMEOUT = 120000 // 2 minutes
const testDir = join(process.cwd(), 'test-watch-mode')
const singleFile = join(testDir, 'test.mdx')
const contentDir = join(testDir, 'content')

let activeProcesses: Array<{ process: ChildProcess; cleanup: () => Promise<void> }> = []

async function cleanupTestFiles() {
  debug('Cleaning up test files...')
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
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
      debug('Test directory removed:', testDir)
    }
    // Wait a bit to ensure cleanup is complete
    await sleep(2000)
    debug('Cleanup complete')
  } catch (error) {
    console.error('Error during cleanup:', error)
  }
}

// Utility function to sync file to disk
function syncFile(filepath: string) {
  debug(`Syncing file: ${filepath}`)
  const fd = openSync(filepath, 'r')
  try {
    debug('Calling fsyncSync...')
    fsyncSync(fd)
    debug('fsyncSync completed')
    closeSync(fd)
    debug('File descriptor closed')
    // Force a file system sync to ensure changes are written to disk
    execSync('sync')
    debug('File system sync completed')
  } catch (error) {
    debug(`Error syncing file: ${error}`)
    if (fd !== undefined) closeSync(fd)
    throw error
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
    debug('Starting single file mode test')
    const absolutePath = resolve(testDir, 'test.mdx')
    let initialProcessingDone = false
    let fileChangeProcessed = false
    let resolveInitialProcessing: () => void
    let resolveFileChange: () => void

    const initialProcessingPromise = new Promise<void>((resolve) => {
      resolveInitialProcessing = resolve
    })

    const fileChangePromise = new Promise<void>((resolve) => {
      resolveFileChange = resolve
    })

    const env = { ...process.env }
    debug('Starting watch process...')
    const watchProcess = spawn('node', ['./bin/cli.js', '--watch', absolutePath], {
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    watchProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString()
      debug('Watch process output:', output)
      if (output.includes('Successfully processed file:')) {
        if (!initialProcessingDone) {
          debug('Initial processing completed')
          initialProcessingDone = true
          resolveInitialProcessing()
        } else {
          debug('File change processing completed')
          fileChangeProcessed = true
          resolveFileChange()
        }
      }
    })

    watchProcess.stderr.on('data', (data: Buffer) => {
      debug('Watch process error:', data.toString())
    })

    activeProcesses.push({
      process: watchProcess,
      cleanup: async () => {
        debug('Cleaning up watch process...')
        watchProcess.kill()
        await sleep(1000) // Wait for process to fully terminate
      }
    })

    debug('Waiting for initial processing...')
    await Promise.race([
      initialProcessingPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for initial processing')), 30000))
    ])
    debug('Initial processing complete')

    debug('Modifying test file...')
    const originalContent = readFileSync(absolutePath, 'utf-8')
    debug(`Original content: ${originalContent}`)
    await writeFile(absolutePath, 'Updated content')
    syncFile(absolutePath)
    const newContent = readFileSync(absolutePath, 'utf-8')
    debug(`New content: ${newContent}`)
    debug('Test file modified and synced')
    debug('Waiting for file change processing...')
    await Promise.race([
      fileChangePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for file change processing')), TEST_TIMEOUT - 30000))
    ])
    debug('File processing completed')
  }, TEST_TIMEOUT)

  it('should detect changes in directory mode', async () => {
    debug('Starting directory mode test')
    let initialProcessingDone = false
    let fileChangeProcessed = false
    let resolveInitialProcessing: () => void
    let resolveFileChange: () => void

    const initialProcessingPromise = new Promise<void>((resolve) => {
      resolveInitialProcessing = resolve
    })

    const fileChangePromise = new Promise<void>((resolve) => {
      resolveFileChange = resolve
    })

    const env = { ...process.env }
    debug('Starting watch process...')
    const watchProcess = spawn('node', ['./bin/cli.js', '--watch', contentDir], {
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    watchProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString()
      debug('Watch process output:', output)
      if (output.includes('Successfully processed file:')) {
        if (!initialProcessingDone) {
          debug('Initial processing completed')
          initialProcessingDone = true
          resolveInitialProcessing()
        } else {
          debug('File change processing completed')
          fileChangeProcessed = true
          resolveFileChange()
        }
      }
    })

    watchProcess.stderr.on('data', (data: Buffer) => {
      debug('Watch process error:', data.toString())
    })

    activeProcesses.push({
      process: watchProcess,
      cleanup: async () => {
        debug('Cleaning up watch process...')
        watchProcess.kill()
        await sleep(1000) // Wait for process to fully terminate
      }
    })

    debug('Waiting for initial processing...')
    await Promise.race([
      initialProcessingPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for initial processing')), 30000))
    ])
    debug('Initial processing complete')
    debug('Modifying page1.mdx...')
    const page1Path = join(contentDir, 'page1.mdx')
    const originalContent = readFileSync(page1Path, 'utf-8')
    debug(`Original content: ${originalContent}`)
    await writeFile(page1Path, 'Updated content')
    syncFile(page1Path)
    const newContent = readFileSync(page1Path, 'utf-8')
    debug(`New content: ${newContent}`)
    debug('Page1.mdx modified and synced')
    debug('Waiting for file change processing...')
    await Promise.race([
      fileChangePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for file change processing')), TEST_TIMEOUT - 30000))
    ])
    debug('File processing completed')
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
