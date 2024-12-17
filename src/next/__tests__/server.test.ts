import { execSync, spawn, ChildProcess } from 'child_process'
import { expect, describe, it, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import { setTimeout } from 'node:timers/promises'
import debug from 'debug'

const log = debug('mdxe:server-test')

describe('Production Server', () => {
  const testDir = path.join(process.cwd(), 'test-next-server')
  const port = 3456
  let serverProcess: ChildProcess

  beforeAll(() => {
    // Create test directory and files
    fs.mkdirSync(testDir, { recursive: true })
    fs.mkdirSync(path.join(testDir, 'pages'), { recursive: true })

    // Create test MDX file
    const mdxContent = `
---
title: Production Test
---

# Production Server Test

This page tests the production server functionality.
    `
    fs.writeFileSync(path.join(testDir, 'pages', 'index.mdx'), mdxContent)

    // Create next.config.js
    const nextConfig = `
      const withMDXE = async () => {
        const { default: mdxe } = await import('${process.cwd()}/dist/index.js')
        return mdxe.withMDXE
      }

      module.exports = async () => {
        const plugin = await withMDXE()
        return plugin({})
      }
    `
    fs.writeFileSync(path.join(testDir, 'next.config.js'), nextConfig)

    // Create package.json without type: module
    const packageJson = {
      name: 'test-next-server',
      version: '1.0.0',
      private: true,
      scripts: {
        build: 'next build',
        start: `next start -p ${port}`,
      },
    }
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2))

    // Install dependencies and build
    const cwd = process.cwd()
    process.chdir(testDir)
    execSync('pnpm install next react react-dom', { stdio: 'inherit' })
    execSync('pnpm build', { stdio: 'inherit' })
    process.chdir(cwd)
  })

  afterAll(() => {
    // Clean up test directory
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  it('should start production server successfully', async () => {
    const cwd = process.cwd()
    process.chdir(testDir)

    try {
      log('Starting production server...')
      serverProcess = spawn('pnpm', ['start'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true,
      })

      if (!serverProcess.stdout || !serverProcess.stderr) {
        throw new Error('Failed to create server process streams')
      }

      let serverStarted = false
      const maxRetries = 3
      let retryCount = 0

      // Safe stream handling with type guards
      const stdout = serverProcess.stdout
      const stderr = serverProcess.stderr

      stdout.on('data', (data: Buffer) => {
        const output = data.toString()
        log('Server output:', output.trim())
        if (output.includes('ready started server')) {
          log('Server startup message detected')
          serverStarted = true
        }
      })

      stderr.on('data', (data: Buffer) => {
        log('Server error:', data.toString().trim())
      })

      serverProcess.on('error', (error) => {
        log('Server process error:', error)
      })

      // Wait for server to start with verification
      log('Waiting for server to start...')
      while (!serverStarted && retryCount < maxRetries) {
        await setTimeout(10000) // 10 second delay between checks
        try {
          log(`Attempt ${retryCount + 1}/${maxRetries} to connect to server...`)
          const response = await fetch(`http://localhost:${port}`)
          if (response.ok) {
            log('Server is responding to requests')
            const html = await response.text()
            expect(html).toContain('Production Server Test')
            expect(html).toContain('This page tests the production server functionality')
            serverStarted = true
            break
          }
        } catch (error) {
          log(`Attempt ${retryCount + 1}/${maxRetries} failed:`, error)
          retryCount++
          if (retryCount === maxRetries) {
            throw new Error(`Server failed to start after ${maxRetries} attempts`)
          }
        }
      }
    } finally {
      // Cleanup with proper stream handling
      log('Cleaning up server process...')
      try {
        if (serverProcess) {
          // Clean up streams
          if (serverProcess.stdout) serverProcess.stdout.destroy()
          if (serverProcess.stderr) serverProcess.stderr.destroy()

          if (serverProcess.pid) {
            process.kill(-serverProcess.pid, 'SIGTERM')
            await setTimeout(2000) // Wait for process to terminate
            if (serverProcess.killed) {
              log('Server process terminated successfully')
            } else {
              log('Server process did not terminate with SIGTERM, using SIGKILL')
              process.kill(-serverProcess.pid, 'SIGKILL')
            }
          }
        }
      } catch (e) {
        log('Error cleaning up server process:', e)
      } finally {
        process.chdir(cwd)
      }
    }
  }, 60000) // Increased timeout to 60 seconds
})
