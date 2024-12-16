import { execSync } from 'child_process'
import { expect, describe, it, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Next.js Production Build', () => {
  const testDir = path.join(process.cwd(), 'test-next-build')
  const mdxContent = `
---
title: Test Page
---

# Hello World

This is a test MDX file.
  `

  beforeAll(() => {
    // Create test directory and files
    fs.mkdirSync(testDir, { recursive: true })
    fs.mkdirSync(path.join(testDir, 'pages'), { recursive: true })
    fs.writeFileSync(path.join(testDir, 'pages', 'test.mdx'), mdxContent)

    // Create minimal next.config.js
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
      name: 'test-next-build',
      version: '1.0.0',
      private: true,
      scripts: {
        build: 'next build',
        start: 'next start',
      },
    }
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2))
  })

  afterAll(() => {
    // Clean up test directory
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  it('should build successfully with MDX files', async () => {
    const cwd = process.cwd()
    process.chdir(testDir)

    try {
      // Install dependencies
      execSync('pnpm install next react react-dom', { stdio: 'inherit' })

      // Run build
      const result = execSync('pnpm build', { encoding: 'utf8' })
      expect(result).toBeTruthy()

      // Verify build output exists
      const buildDir = path.join(testDir, '.next')
      expect(fs.existsSync(buildDir)).toBe(true)

      // Verify MDX file was processed
      const buildFiles = fs.readdirSync(path.join(buildDir, 'server', 'app'))
      expect(buildFiles.some((file) => file.includes('test'))).toBe(true)
    } finally {
      process.chdir(cwd)
    }
  })
})
