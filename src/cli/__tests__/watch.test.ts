import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'child_process'
import { join } from 'path'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import fetch from 'node-fetch'
import { setTimeout } from 'node:timers/promises'

describe('Watch Mode', () => {
  const testDir = join(process.cwd(), 'test-watch-mode')
  const singleFile = join(testDir, 'test.mdx')
  const multiDir = join(testDir, 'content')
  let watchProcess: ReturnType<typeof spawn>

  beforeAll(() => {
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

  afterAll(() => {
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
      if (output.includes('Processed:') && output.includes('test.mdx')) {
        hasProcessedFile = true
      }
    })

    // Wait for initial processing
    await setTimeout(2000)

    // Modify the file
    writeFileSync(
      singleFile,
      `
# Test File
Updated content
    `,
    )

    // Wait for file change detection and verify processing
    await setTimeout(2000)
    expect(hasProcessedFile).toBe(true)

    watchProcess.kill()
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
      if (output.includes('Processed:') && output.includes('page1.mdx') && output.includes('page3.mdx')) {
        hasProcessedFiles = true
      }
    })

    // Wait for initial processing
    await setTimeout(2000)

    // Modify existing file
    writeFileSync(
      join(multiDir, 'page1.mdx'),
      `
# Page 1
Updated content for page 1
    `,
    )

    // Add new file
    writeFileSync(
      join(multiDir, 'page3.mdx'),
      `
# Page 3
New page content
    `,
    )

    // Wait for file change detection and verify processing
    await setTimeout(2000)
    expect(hasProcessedFiles).toBe(true)

    watchProcess.kill()
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
      expect(output).toContain('Watch Mode Test')
    })

    // Wait for Next.js dev server to start
    await setTimeout(5000)

    // Test initial page load
    const response = await fetch(`http://localhost:${port}`)
    const html = await response.text()
    expect(html).toContain('Watch Mode Test')

    // Modify the page
    writeFileSync(
      join(testDir, 'pages', 'index.mdx'),
      `
# Watch Mode Test
Updated content for testing
    `,
    )

    // Wait for hot reload
    await setTimeout(2000)

    // Test updated content
    const updatedResponse = await fetch(`http://localhost:${port}`)
    const updatedHtml = await updatedResponse.text()
    expect(updatedHtml).toContain('Updated content for testing')

    watchProcess.kill()
  })
})
