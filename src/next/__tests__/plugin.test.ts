import { execSync } from 'child_process'
import { expect, describe, it, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import { debug } from '../../test/setup'

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
    try {
      debug('Creating test directory structure...')
      // Clean up any existing test directory
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true })
      }

      // Create test directory and files
      fs.mkdirSync(testDir, { recursive: true })

      // Create app directory structure
      fs.mkdirSync(path.join(testDir, 'app'), { recursive: true })
      fs.mkdirSync(path.join(testDir, 'app', 'test'), { recursive: true })
      fs.writeFileSync(path.join(testDir, 'app', 'test', 'page.mdx'), mdxContent)

      // Create pages directory structure (for backwards compatibility)
      fs.mkdirSync(path.join(testDir, 'pages'), { recursive: true })
      fs.writeFileSync(path.join(testDir, 'pages', 'test.mdx'), mdxContent)

      debug('Creating Next.js configuration...')
      // Create minimal next.config.js
      const nextConfig = `
        const withMDXE = async () => {
          const { default: mdxe } = await import('${process.cwd()}/dist/index.js')
          return mdxe.withMDXE
        }

        /** @type {import('next').NextConfig} */
        module.exports = async () => {
          const plugin = await withMDXE()
          return plugin({
            pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
            experimental: {
              appDir: true
            }
          })
        }
      `
      fs.writeFileSync(path.join(testDir, 'next.config.js'), nextConfig)

      debug('Creating package.json...')
      // Create package.json with explicit dependencies
      const packageJson = {
        name: 'test-next-build',
        version: '1.0.0',
        private: true,
        scripts: {
          build: 'next build',
          start: 'next start'
        },
        dependencies: {
          next: '^14.0.0',
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          '@types/react': '^18.2.0',
          '@types/react-dom': '^18.2.0'
        }
      }
      fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      // Create tsconfig.json for TypeScript support
      const tsConfig = {
        compilerOptions: {
          target: 'es5',
          lib: ['dom', 'dom.iterable', 'esnext'],
          allowJs: true,
          skipLibCheck: true,
          strict: false,
          forceConsistentCasingInFileNames: true,
          noEmit: true,
          incremental: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'node',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve'
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '**/*.mdx'],
        exclude: ['node_modules']
      }
      fs.writeFileSync(path.join(testDir, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2))
    } catch (error) {
      debug('Error in beforeAll:', error)
      throw error
    }
  })

  afterAll(() => {
    try {
      debug('Cleaning up test directory...')
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true })
      }
    } catch (error) {
      debug('Error in afterAll cleanup:', error)
    }
  })

  it('should build successfully with MDX files', async () => {
    const cwd = process.cwd()
    process.chdir(testDir)

    try {
      debug('Installing dependencies...')
      execSync('pnpm install', { stdio: 'inherit' })

      debug('Running build...')
      const result = execSync('pnpm build', { encoding: 'utf8', stdio: 'inherit' })
      expect(result).toBeTruthy()

      debug('Verifying build output...')
      const buildDir = path.join(testDir, '.next')
      expect(fs.existsSync(buildDir)).toBe(true)

      // Check both pages and app directory output
      const pagesDir = path.join(buildDir, 'server', 'pages')
      const appDir = path.join(buildDir, 'server', 'app')

      debug('Build directories:')
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
