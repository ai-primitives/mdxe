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

    debug('Waiting for initial processing...')
    await sleep(5000)

    debug('Modifying test file...')
    writeFileSync(
      singleFile,
      `
# Test File
Updated content
    `,
    )

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

    debug('Waiting for initial processing...')
    await sleep(5000)

    debug('Modifying page1.mdx...')
    writeFileSync(
      join(multiDir, 'page1.mdx'),
      `
# Page 1
Updated content for page 1
    `,
    )

    debug('Adding page3.mdx...')
    writeFileSync(
      join(multiDir, 'page3.mdx'),
      `
# Page 3
New page content
    `,
    )

    debug('Waiting for file change detection...')
    await sleep(10000)
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
