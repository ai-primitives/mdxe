import { execSync, spawn, ChildProcess } from 'child_process'
import { expect, describe, it, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import { setTimeout } from 'node:timers/promises'
import { debug } from '../../test/setup.js'

describe('Production Server', () => {
  const testDir = path.join(process.cwd(), 'test-next-server')
  const port = 3456
  let serverProcess: ChildProcess

  beforeAll(async () => {
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

    // Create package.json with all necessary configuration
    const packageJson = {
      name: 'test-next-server',
      version: '1.0.0',
      private: true,
      scripts: {
        build: 'next build',
        start: `next start -p ${port}`,
      },
      dependencies: {
        next: '14.0.0',
        react: '18.2.0',
        'react-dom': '18.2.0'
      }
    }
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2))

    // Install dependencies and build
    const cwd = process.cwd()
    process.chdir(testDir)
    
    debug('Installing dependencies...')
    execSync('pnpm install', { stdio: 'inherit' })

    debug('Running build...')
    try {
      execSync('pnpm exec next build', { stdio: ['pipe', 'pipe', 'pipe'] })
    } catch (error) {
      if (error instanceof Error && 'stdout' in error && 'stderr' in error) {
        const execError = error as { stdout: Buffer | null; stderr: Buffer | null }
        debug('Build error details:', execError.stdout?.toString(), execError.stderr?.toString())
      }
      throw error
    }

    // Add a small delay after build to ensure everything is ready
    await new Promise(resolve => setTimeout(resolve, 2000))
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
      // Start production server
      serverProcess = spawn('pnpm', ['start'], {
        stdio: 'pipe',
        detached: true,
      })

      // Wait for server to start and retry connection
      let response = null
      const maxRetries = 3
      const retryDelay = 2000
      
      for (let i = 0; i < maxRetries; i++) {
        await setTimeout(retryDelay)
        try {
          response = await fetch(`http://localhost:${port}`)
          if (response.ok) break
        } catch (error) {
          debug(`Attempt ${i + 1}/${maxRetries} failed:`, error instanceof Error ? error.message : String(error))
          if (i === maxRetries - 1) throw error
        }
      }
      
      if (!response) {
        throw new Error('Failed to connect to server after multiple retries')
      }
      
      expect(response.ok).toBe(true)

      const html = await response.text()
      expect(html).toContain('Production Server Test')
      expect(html).toContain('This page tests the production server functionality')
    } finally {
      // Cleanup
      try {
        if (serverProcess && serverProcess.pid) {
          process.kill(-serverProcess.pid, 'SIGTERM')
        }
      } catch (e) {
        console.error('Error cleaning up server process:', e)
      }
      process.chdir(cwd)
    }
  })
})
