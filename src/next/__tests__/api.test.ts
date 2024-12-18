import { expect, describe, it, beforeAll, afterAll } from 'vitest'
import { execSync, spawn, ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import { setTimeout } from 'node:timers/promises'

describe('API Routes', () => {
  const testDir = path.join(process.cwd(), 'test-next-api')
  const port = 3457
  let serverProcess: ChildProcess

  beforeAll(() => {
    // Create test directory and files
    fs.mkdirSync(testDir, { recursive: true })
    fs.mkdirSync(path.join(testDir, 'app'), { recursive: true })
    fs.mkdirSync(path.join(testDir, 'app', 'api', 'test'), { recursive: true })

    // Create test API route MDX file
    const mdxContent = `---
$type: https://mdx.org.ai/API
title: Test API
description: API test endpoint
---

export const GET = request => Response.json({ hello: 'test' })
`
    fs.writeFileSync(path.join(testDir, 'app', 'api', 'test', 'route.mdx'), mdxContent)

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

    // Create package.json
    const packageJson = {
      name: 'test-next-api',
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

  it('should handle API routes in MDX files', async () => {
    const cwd = process.cwd()
    process.chdir(testDir)

    try {
      // Start production server
      serverProcess = spawn('pnpm', ['start'], {
        stdio: 'pipe',
        detached: true,
      })

      // Wait for server to start
      await setTimeout(5000)

      // Test API response
      const response = await fetch(`http://localhost:${port}/api/test`)
      expect(response.ok).toBe(true)

      const data = await response.json()
      expect(data).toEqual({ hello: 'test' })
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
