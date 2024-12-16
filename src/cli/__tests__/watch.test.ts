import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest'
import { spawn } from 'child_process'
import { join } from 'path'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import fetch from 'node-fetch'
import { sleep } from '../../test/setup'

describe('Watch Mode', () => {
  const testDir = join(process.cwd(), 'test-watch-mode')
  const singleFile = join(testDir, 'test.mdx')
  const multiDir = join(testDir, 'content')
  let watchProcess: ReturnType<typeof spawn>

  // Add debug logging
  const debug = (msg: string) => console.log(`[Watch Test Debug] ${msg}`)

  beforeEach(() => {
    // Create test directories
    mkdirSync(testDir, { recursive: true })
    mkdirSync(multiDir, { recursive: true })

    // Create initial test files
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

    // Create test next.config.js
    writeFileSync(
      join(testDir, 'next.config.js'),
      `
const { withMDXE } = require('../../dist')
module.exports = withMDXE({})
    `,
    )
  })

  afterEach(() => {
    if (watchProcess) {
      watchProcess.kill()
      // Ensure child processes are cleaned up
      process.kill(-watchProcess.pid!, 'SIGKILL')
    }
    rmSync(testDir, { recursive: true, force: true })
  })

  it('should detect changes in single file mode', async () => {
    const args = ['--watch', singleFile]

    watchProcess = spawn('node', ['../../bin/cli.js', ...args], {
      cwd: testDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    if (!watchProcess.stdout) {
      throw new Error('Failed to get stdout from watch process')
    }
    let hasProcessedFile = false
    watchProcess.stdout.on('data', (data) => {
      const output = data.toString()
      debug(`Single file output: ${output}`)
      if (output.includes('Processed:') && output.includes('test.mdx')) {
        hasProcessedFile = true
        debug('Detected file processing')
      }
    })

    // Wait for initial processing
    debug('Waiting for initial processing...')
    await sleep(5000)

    // Modify the file
    debug('Modifying test file...')
    writeFileSync(
      singleFile,
      `
# Test File
Updated content
    `,
    )

    // Wait for file change detection and verify processing
    debug('Waiting for file change detection...')
    await sleep(10000)
    expect(hasProcessedFile).toBe(true)
  })

  it('should detect changes in directory mode', async () => {
    const args = ['--watch', multiDir]

    watchProcess = spawn('node', ['../../bin/cli.js', ...args], {
      cwd: testDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    if (!watchProcess.stdout) {
      throw new Error('Failed to get stdout from watch process')
    }
    let hasProcessedFiles = false
    watchProcess.stdout.on('data', (data) => {
      const output = data.toString()
      debug(`Directory mode output: ${output}`)
      if (output.includes('Processed:') && output.includes('page1.mdx') && output.includes('page3.mdx')) {
        hasProcessedFiles = true
        debug('Detected directory processing')
      }
    })

    // Wait for initial processing
    debug('Waiting for initial processing...')
    await sleep(5000)

    // Modify existing file
    debug('Modifying page1.mdx...')
    writeFileSync(
      join(multiDir, 'page1.mdx'),
      `
# Page 1
Updated content for page 1
    `,
    )

    // Add new file
    debug('Adding page3.mdx...')
    writeFileSync(
      join(multiDir, 'page3.mdx'),
      `
# Page 3
New page content
    `,
    )

    // Wait for file change detection and verify processing
    debug('Waiting for file change detection...')
    await sleep(10000)
    expect(hasProcessedFiles).toBe(true)
  })

  it('should work with next dev', async () => {
    const port = 3457
    const args = ['--watch', '--next', testDir]

    // Create pages directory for Next.js
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

    // Wait for Next.js dev server to start
    debug('Waiting for Next.js dev server to start...')
    await sleep(5000)

    // Test initial page load
    const response = await fetch(`http://localhost:${port}`)
    const html = await response.text()
    expect(html).toContain('Watch Mode Test')

    // Modify the page
    debug('Modifying index.mdx...')
    writeFileSync(
      join(testDir, 'pages', 'index.mdx'),
      `
# Watch Mode Test
Updated content for testing
    `,
    )

    // Wait for hot reload
    debug('Waiting for hot reload...')
    await sleep(5000)

    // Test updated content
    const updatedResponse = await fetch(`http://localhost:${port}`)
    const updatedHtml = await updatedResponse.text()
    expect(updatedHtml).toContain('Updated content for testing')
  })
})
