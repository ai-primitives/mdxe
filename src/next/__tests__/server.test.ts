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
  let serverProcess: ChildProcess | null = null

  beforeAll(async () => {
    log('Setting up test environment...')
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
    const mdxPath = path.join(testDir, 'pages', 'index.mdx')
    log(`Creating test MDX file at ${mdxPath}`)
    fs.writeFileSync(mdxPath, mdxContent)

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
    const configPath = path.join(testDir, 'next.config.js')
    log(`Creating next.config.js at ${configPath}`)
    fs.writeFileSync(configPath, nextConfig)

    // Create package.json with explicit dependencies
    const packageJson = {
      name: 'test-next-server',
      version: '1.0.0',
      private: true,
      dependencies: {
        next: '^14.0.0',
        react: '^18.2.0',
        'react-dom': '^18.2.0'
      },
      scripts: {
        build: 'next build',
        start: `next start -p ${port}`,
      },
    }
    const packagePath = path.join(testDir, 'package.json')
    log(`Creating package.json at ${packagePath}`)
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2))

    // Install dependencies and build
    const cwd = process.cwd()
    process.chdir(testDir)
    try {
      log('Installing dependencies...')
      execSync('pnpm install', { stdio: 'inherit' })

      log('Building Next.js application...')
      execSync('pnpm build', { stdio: 'inherit' })

      // Verify build output exists
      const buildDir = path.join(testDir, '.next')
      if (!fs.existsSync(buildDir)) {
        throw new Error('Build directory .next not found')
      }
      log('Build completed successfully')
    } catch (error) {
      log('Error during setup:', error)
      throw error
    } finally {
      process.chdir(cwd)
    }
    log('Test environment setup completed')
  }, 180000) // 3 minutes for setup

  afterAll(async () => {
    log('Cleaning up test environment...')
    try {
      if (serverProcess) {
        const pid = serverProcess.pid
        if (pid) {
          log(`Killing server process ${pid}`)
          process.kill(-pid, 'SIGTERM')
          await setTimeout(2000)
          try {
            process.kill(-pid, 0) // Check if process is still running
            log(`Process ${pid} still running, sending SIGKILL`)
            process.kill(-pid, 'SIGKILL')
          } catch (e) {
            log(`Process ${pid} already terminated`)
          }
        }
      }
    } catch (e) {
      log('Error cleaning up server process:', e)
    }
    fs.rmSync(testDir, { recursive: true, force: true })
    log('Test environment cleanup completed')
  })

  it('should start production server successfully', async () => {
    const cwd = process.cwd()
    process.chdir(testDir)

    try {
      log('Starting production server...')
      serverProcess = spawn('pnpm', ['start'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true,
        env: { ...process.env, PORT: port.toString(), NODE_ENV: 'production' }
      })

      if (!serverProcess.stdout || !serverProcess.stderr) {
        throw new Error('Failed to create server process streams')
      }

      let serverStarted = false
      let serverError: string | null = null
      const maxRetries = 5
      let retryCount = 0

      // Capture server output
      serverProcess.stdout.setEncoding('utf8')
      serverProcess.stderr.setEncoding('utf8')

      serverProcess.stdout.on('data', (data: string) => {
        const output = data.toString().trim()
        log('Server stdout:', output)
        if (output.includes('ready started server')) {
          log('Server startup message detected')
          serverStarted = true
        }
      })

      serverProcess.stderr.on('data', (data: string) => {
        const error = data.toString().trim()
        log('Server stderr:', error)
        serverError = error
      })

      serverProcess.on('error', (error: Error) => {
        log('Server process error:', error)
        serverError = error.message
      })

      serverProcess.on('exit', (code: number | null) => {
        if (code !== null && code !== 0) {
          log(`Server process exited with code ${code}`)
          serverError = `Server process exited with code ${code}`
        }
      })

      // Initial startup delay
      log('Waiting for initial server startup...')
      await setTimeout(15000) // Increased initial delay to 15 seconds

      // Verify server process is running
      if (!serverProcess.pid || serverProcess.killed) {
        throw new Error('Server process failed to start or was killed')
      }

      // Wait for server to start with verification
      while (!serverStarted && retryCount < maxRetries) {
        try {
          log(`Attempt ${retryCount + 1}/${maxRetries} to connect to server...`)
          const response = await fetch(`http://localhost:${port}`)

          if (response.ok) {
            const html = await response.text()
            log('Server responded successfully')
            expect(html).toContain('Production Server Test')
            expect(html).toContain('This page tests the production server functionality')
            serverStarted = true
            break
          }
        } catch (error) {
          log(`Connection attempt ${retryCount + 1} failed:`, error)
          if (serverError) {
            throw new Error(`Server failed to start: ${serverError}`)
          }
          retryCount++
          if (retryCount === maxRetries) {
            throw new Error(`Server failed to start after ${maxRetries} attempts`)
          }
          await setTimeout(5000)
        }
      }

      if (!serverStarted) {
        throw new Error('Server failed to start properly')
      }
    } finally {
      process.chdir(cwd)
    }
  }, 120000)
})
