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
    fs.mkdirSync(path.join(testDir, 'app'), { recursive: true })

    // Create root layout
    const rootLayout = `
      import React from 'react'
      
      export default function RootLayout({
        children,
      }: {
        children: React.ReactNode
      }) {
        return (
          <html lang="en">
            <body>{children}</body>
          </html>
        )
      }
    `
    fs.writeFileSync(path.join(testDir, 'app', 'layout.tsx'), rootLayout)

    // Create components directory and TestPage component
    fs.mkdirSync(path.join(testDir, 'components'), { recursive: true })
    const testComponent = `
export function TestPage() {
  return (
    <div>
      <h1>Test Page</h1>
      <p>Test content</p>
    </div>
  )
}
`
    fs.writeFileSync(path.join(testDir, 'components', 'TestPage.tsx'), testComponent)

    // Create test MDX file
    const mdxContent = `import { TestPage } from '../components/TestPage'

<TestPage />`
    fs.writeFileSync(path.join(testDir, 'app', 'page.mdx'), mdxContent)

    // Create next.config.js
    const nextConfig = `
      const createMDXPlugin = require('@next/mdx')
      
      
      /** @type {import('next').NextConfig} */
      const nextConfig = {
        pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
        experimental: {
          mdxRs: true
        }
      }

      const withMDX = createMDXPlugin({
        extension: /\\.mdx?$/,
        options: {
          remarkPlugins: [],
          rehypePlugins: [],
          providerImportSource: "@mdx-js/react"
        }
      })

      module.exports = withMDX(nextConfig)
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
        next: '14.0.4',
        react: '18.2.0',
        'react-dom': '18.2.0',
        '@next/mdx': '14.0.4',
        '@mdx-js/react': '3.0.0',
        '@mdx-js/loader': '3.0.0',
        '@types/mdx': '2.0.10',
        '@types/react': '18.2.0',
        '@types/react-dom': '18.2.0',
        'typescript': '5.3.3'
      }
    }
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2))

    // Create tsconfig.json
    const tsConfig = {
      compilerOptions: {
        target: "es5",
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: true,
        plugins: [
          {
            name: "next"
          }
        ]
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
      exclude: ["node_modules"]
    }
    fs.writeFileSync(path.join(testDir, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2))

    // Install dependencies and build
    const cwd = process.cwd()
    process.chdir(testDir)
    
    debug('Installing dependencies...')
    try {
      debug('Running pnpm install...')
      execSync('pnpm install --no-frozen-lockfile', { 
        stdio: 'inherit',
        timeout: 60000, // 60 second timeout
        env: {
          ...process.env,
          NEXT_TELEMETRY_DISABLED: '1',
          NODE_ENV: 'development'
        }
      })
      debug('Dependencies installed successfully')
    } catch (error) {
      debug('Error installing dependencies:', error)
      throw error
    }

    debug('Running build...')
    try {
      debug('Starting next build...')
      // Create next-env.d.ts first
      execSync('pnpm exec next env', { 
        stdio: 'inherit',
        env: {
          ...process.env,
          NEXT_TELEMETRY_DISABLED: '1',
          NODE_ENV: 'production'
        }
      })
      
      execSync('pnpm exec next build', { 
        stdio: 'inherit',
        timeout: 120000, // 120 second timeout
        env: {
          ...process.env,
          NEXT_TELEMETRY_DISABLED: '1',
          NODE_ENV: 'production'
        }
      })
      debug('Build completed successfully')
    } catch (error) {
      debug('Error during build:', error)
      throw error
    }

    // Add a small delay after build to ensure everything is ready
    await setTimeout(2000)
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
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: true,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          PORT: port.toString(),
          NEXT_TELEMETRY_DISABLED: '1'
        }
      })

      // Handle server process output for debugging
      if (serverProcess.stdout) {
        serverProcess.stdout.on('data', (data) => {
          debug('Server stdout:', data.toString())
        })
      }
      if (serverProcess.stderr) {
        serverProcess.stderr.on('data', (data) => {
          debug('Server stderr:', data.toString())
        })
      }
      serverProcess.on('error', (error) => {
        debug('Server process error:', error)
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
      expect(html).toContain('Test Page')
      expect(html).toContain('Test content')
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
