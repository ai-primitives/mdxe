import { execSync } from 'child_process'
import { expect, describe, it, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'
import { debug } from '../../test/setup.js'

describe('Next.js Production Build', () => {
  const testDir = path.join(process.cwd(), 'test-next-build')
  // PLACEHOLDER: Rest of the test setup and implementation

  const customComponent = `
import React from 'react'

export default function CustomButton({ children }) {
  return (
    <button className="bg-blue-500 text-white px-4 py-2 rounded">
      {children}
    </button>
  )
}
`

  const customStyles = `
:root {
  --mdxe-primary-color: #3b82f6;
  --mdxe-text-color: #1f2937;
  --mdxe-heading-font: 'Inter', sans-serif;
}

.mdxe-content {
  color: var(--mdxe-text-color);
}

.mdxe-content h1 {
  font-family: var(--mdxe-heading-font);
  color: var(--mdxe-primary-color);
}
`

  const styledMdxContent = `
import CustomButton from '../components/CustomButton'

# Welcome to Styled MDX

This page demonstrates style customization and component imports.

<CustomButton>Click me!</CustomButton>
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

      // Create components directory
      fs.mkdirSync(path.join(testDir, 'components'), { recursive: true })
      fs.writeFileSync(path.join(testDir, 'components', 'CustomButton.tsx'), customComponent)

      // Create styles directory
      fs.mkdirSync(path.join(testDir, 'styles'), { recursive: true })
      fs.writeFileSync(path.join(testDir, 'styles', 'custom.css'), customStyles)

      // Create app directory structure
      fs.mkdirSync(path.join(testDir, 'app'), { recursive: true })
      fs.mkdirSync(path.join(testDir, 'app', 'styled'), { recursive: true })
      fs.mkdirSync(path.join(testDir, 'app', 'components'), { recursive: true })
      
      // Create root layout.tsx
      const rootLayout = `
        import '../styles/custom.css'
        
        export const metadata = {
          title: 'MDX Test App',
          description: 'Testing MDX integration with Next.js'
        }
        
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

      // Create CustomButton component
      const customButton = `
        import React from 'react'

        export default function CustomButton({ children }: { children: React.ReactNode }) {
          return (
            <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
              {children}
            </button>
          )
        }
      `
      
      fs.writeFileSync(path.join(testDir, 'app', 'layout.tsx'), rootLayout)
      fs.writeFileSync(path.join(testDir, 'app', 'components', 'CustomButton.tsx'), customButton)
      fs.writeFileSync(path.join(testDir, 'app', 'styled', 'page.mdx'), styledMdxContent)

      debug('Creating Next.js configuration...')
      const nextConfig = `
        import { withMDXE } from '${process.cwd()}/dist/index.js'

        /** @type {import('next').NextConfig} */
        const nextConfig = {
          pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
          experimental: {
            webpackBuildWorker: true,
            mdxRs: true
          }
        }

        export default withMDXE(nextConfig, {
          mdx: {
            remarkPlugins: [],
            rehypePlugins: []
          }
        })
      `
      fs.writeFileSync(path.join(testDir, 'next.config.js'), nextConfig)

      debug('Creating package.json...')
      const packageJson = {
        name: 'test-next-build',
        version: '1.0.0',
        private: true,
        type: 'module',
        scripts: {
          build: 'next build',
          start: 'next start',
        },
        dependencies: {
          next: '^14.0.0',
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          '@types/react': '^18.2.0',
          '@types/react-dom': '^18.2.0',
          '@mdx-js/loader': '^3.0.0',
          '@mdx-js/react': '^3.0.0',
          '@types/mdx': '^2.0.0',
        },
      }
      fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2))

      const appComponent = `
import '../styles/custom.css'

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}
`
      fs.mkdirSync(path.join(testDir, 'pages'), { recursive: true })
      fs.writeFileSync(path.join(testDir, 'pages', '_app.tsx'), appComponent)

      const tsConfig = {
        compilerOptions: {
          target: 'es2022',
          lib: ['dom', 'dom.iterable', 'esnext'],
          allowJs: true,
          skipLibCheck: true,
          strict: false,
          forceConsistentCasingInFileNames: true,
          noEmit: true,
          incremental: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '**/*.mdx'],
        exclude: ['node_modules'],
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

  it('builds MDX files with style customization', async () => {
    const cwd = process.cwd()
    process.chdir(testDir)

    try {
      // Package.json already created in beforeAll

      debug('Installing dependencies...')
      execSync('pnpm install', { stdio: 'inherit' })

      debug('Running build...')
      try {
        execSync('NODE_ENV=production pnpm exec next build', { 
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'production',
          NEXT_TELEMETRY_DISABLED: '1'
        }
      })
      } catch (error) {
        if (error instanceof Error && 'stdout' in error && 'stderr' in error) {
          const execError = error as { stdout: Buffer | null; stderr: Buffer | null }
          debug('Build error details:', execError.stdout?.toString(), execError.stderr?.toString())
        }
        throw error
      }

      debug('Verifying build output...')
      const buildDir = path.join(testDir, '.next')
      expect(fs.existsSync(buildDir)).toBe(true)

      const serverDir = path.join(buildDir, 'server')
      const cssFiles = fs.readdirSync(serverDir).filter((file) => file.endsWith('.css'))
      expect(cssFiles.length).toBeGreaterThan(0)

      const cssContent = fs.readFileSync(path.join(serverDir, cssFiles[0]), 'utf-8')
      expect(cssContent).toContain('--mdxe-primary-color')
      expect(cssContent).toContain('--mdxe-text-color')
    } catch (error) {
      debug('Build error:', error)
      throw error
    } finally {
      process.chdir(cwd)
    }
  })

  it('handles custom component imports in production', async () => {
    const cwd = process.cwd()
    process.chdir(testDir)

    try {
      debug('Running build...')
      execSync('pnpm exec next build', { stdio: 'inherit' })

      debug('Verifying component imports...')
      const buildDir = path.join(testDir, '.next')
      const appDir = path.join(buildDir, 'server', 'app', 'styled')
      expect(fs.existsSync(appDir)).toBe(true)

      const pageContent = fs.readFileSync(path.join(appDir, 'page.js'), 'utf-8')
      expect(pageContent).toContain('CustomButton')
      expect(pageContent).toContain('import')
      expect(pageContent).toContain('components/CustomButton')

      const componentFile = fs.existsSync(path.join(buildDir, 'server', 'components', 'CustomButton.js'))
      expect(componentFile).toBe(true)
    } catch (error) {
      debug('Build error:', error)
      throw error
    } finally {
      process.chdir(cwd)
    }
  })
})
