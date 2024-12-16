import { execSync } from 'child_process'
import { expect, describe, it, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import { debug, createTempDir, cleanupTempDir } from '../../test/setup'

describe('Next.js Production Build', () => {
  const testDir = createTempDir('test-next-build')
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

    // Create app directory structure
    fs.mkdirSync(path.join(testDir, 'app'), { recursive: true })
    fs.writeFileSync(path.join(testDir, 'app', 'test', 'page.mdx'), mdxContent)

    // Create minimal next.config.js
    const nextConfig = `
      const withMDXE = async () => {
        const { default: mdxe } = await import('${process.cwd()}/dist/index.js')
        return mdxe.withMDXE
      }

      module.exports = async () => {
        const plugin = await withMDXE()
        return plugin({
          pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx']
        })
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
      dependencies: {
        next: '^14.0.0',
        react: '^18.2.0',
        'react-dom': '^18.2.0',
      },
    }
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2))
  })

  afterAll(() => {
    // Clean up test directory
    cleanupTempDir(testDir)
  })

  it('should build successfully with MDX files', async () => {
    const cwd = process.cwd()
    process.chdir(testDir)

    try {
      debug('Installing dependencies...')
      execSync('pnpm install', { stdio: 'inherit' })

      debug('Running build...')
      const result = execSync('pnpm build', { encoding: 'utf8' })
      expect(result).toBeTruthy()

      // Verify build output exists
      const buildDir = path.join(testDir, '.next')
      expect(fs.existsSync(buildDir)).toBe(true)

      // Check both pages and app directory output
      const pagesDir = path.join(buildDir, 'server', 'pages')
      const appDir = path.join(buildDir, 'server', 'app')

      debug('Checking build output...')
      debug('Pages dir exists:', fs.existsSync(pagesDir))
      debug('App dir exists:', fs.existsSync(appDir))

      const buildFiles = fs.existsSync(pagesDir)
        ? fs.readdirSync(pagesDir)
        : fs.readdirSync(appDir)

      debug('Build files:', buildFiles)
      expect(buildFiles.some(file => file.includes('test'))).toBe(true)
    } catch (error) {
      debug('Build error:', error)
      throw error
    } finally {
      process.chdir(cwd)
    }
  })
})
