import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'
import { spawn } from 'child_process'
import { join, resolve } from 'path'
import { mkdirSync, writeFileSync, rmSync, openSync, closeSync } from 'fs'
import fetch from 'node-fetch'
import { sleep } from '../../test/setup'

describe('Watch Mode', () => {
  const testDir = join(process.cwd(), 'test-watch-mode')
  const singleFile = join(testDir, 'test.mdx')
  const multiDir = join(testDir, 'content')
  let watchProcess: ReturnType<typeof spawn>

  const debug = (...args: unknown[]) => console.log('[Watch Test Debug]', ...args)

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
    try {
      if (watchProcess) {
        try {
          watchProcess.kill()
        } catch (e) {
          debug('Error killing main process:', e)
        }

        if (watchProcess.pid) {
          try {
            process.kill(-watchProcess.pid, 'SIGTERM')
          } catch (e) {
            debug('Error killing child processes:', e)
          }
        }
      }
    } finally {
      try {
        rmSync(testDir, { recursive: true, force: true })
      } catch (e) {
        debug('Error cleaning up test directory:', e)
      }
    }
  })

  it('should detect changes in single file mode', async () => {
    let hasProcessedFile = false
    const absolutePath = resolve(process.cwd(), singleFile)
    const args = ['--watch', absolutePath]

    // Create initial file
    writeFileSync(
      absolutePath,
      `# Initial Test\nThis is a test file.\n`,
      'utf-8'
    )

    // Ensure file exists before starting watch
    await sleep(1000)

    debug('Starting watch process with args:', args)
    watchProcess = spawn('node', ['./bin/cli.js', ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
      cwd: process.cwd(),
    })

    if (!watchProcess.stdout) {
      throw new Error('Failed to get stdout from watch process')
    }

    watchProcess.stdout.on('data', (data) => {
      const output = data.toString()
      debug('Watch process output:', output)
      if (output.includes('has been changed')) {
        debug('Change event detected')
        hasProcessedFile = true
      }
    })

    if (!watchProcess.stderr) {
      throw new Error('Failed to get stderr from watch process')
    }

    watchProcess.stderr.on('data', (data) => {
      debug('Watch process error:', data.toString())
    })

    // Wait for watcher to be ready
    await sleep(5000)

    debug('Modifying test file...')
    writeFileSync(
      absolutePath,
      `
# Updated Test
This is an updated test file.
    `,
    )

    // Force a file system sync
    const fd = openSync(absolutePath, 'r')
    closeSync(fd)

    debug('Waiting for file change detection...')
    await sleep(30000) // Increased wait time
    expect(hasProcessedFile).toBe(true)
  })

  it('should detect changes in directory mode', async () => {
    let hasProcessedFiles = false
    const args = ['--watch', multiDir]

    watchProcess = spawn('node', ['./bin/cli.js', ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true
    })

    if (!watchProcess.stdout) {
      throw new Error('Failed to get stdout from watch process')
    }

    watchProcess.stdout.on('data', (data) => {
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
    await sleep(5000)

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

    debug('Waiting for file change detection...')
    await sleep(15000)
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
      env: {
        ...process.env,
        PORT: port.toString(),
      },
    })

    if (!watchProcess.stdout) {
      throw new Error('Failed to get stdout from watch process')
    }
    watchProcess.stdout.on('data', (data) => {
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
  })
})
