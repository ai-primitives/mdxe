import { execSync, spawn } from 'child_process'
import { expect, describe, it, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'

describe('Production Server', () => {
  const testDir = path.join(process.cwd(), 'test-next-server')
  const port = 3456
  let serverProcess: any

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
        start: `next start -p ${port}`
      }
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
      // Start production server
      serverProcess = spawn('pnpm', ['start'], {
        stdio: 'pipe',
        detached: true
      })

      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 5000))

      // Test server response
      const response = await fetch(`http://localhost:${port}`)
      expect(response.ok).toBe(true)

      const html = await response.text()
      expect(html).toContain('Production Server Test')
      expect(html).toContain('This page tests the production server functionality')
    } finally {
      // Cleanup
      if (serverProcess) {
        process.kill(-serverProcess.pid)
      }
      process.chdir(cwd)
    }
  })
})
