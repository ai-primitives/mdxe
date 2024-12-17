import { build } from '../index.js'
import { expect, test, beforeAll, afterAll, vi } from 'vitest'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

vi.mock('@mdx-js/esbuild', () => ({
  default: vi.fn().mockImplementation(() => ({
    name: 'mdx',
    setup: (build: any) => {
      build.onLoad({ filter: /\.mdx$/ }, async () => ({
        contents: `
          import { Fragment } from 'react'
          export const meta = {
            title: 'Test MDX File',
            description: 'A test MDX file for WASM build testing'
          }
          export const TestComponent = () => (
            <div className="test">
              <h1>Test Component</h1>
              <p>This is a test component.</p>
            </div>
          )
        `,
        loader: 'jsx'
      }))
    }
  }))
}))

vi.mock('esbuild', () => {
  console.log('Mocking esbuild module')
  const mockBuild = vi.fn().mockImplementation(async (options) => {
    console.log('Mock esbuild.build called with:', options)
    const isMdx = options.entryPoints[0].toString().endsWith('.mdx')
    const result = {
      errors: [],
      warnings: [],
      outputFiles: [
        {
          path: 'output.js',
          contents: new Uint8Array(Buffer.from(isMdx
            ? `
              import { Fragment } from 'react'
              export const meta = {
                title: 'Test MDX File',
                description: 'A test MDX file for WASM build testing'
              }
              export const TestComponent = () => {}
            `
            : 'export const hello = "world"')),
          text: isMdx
            ? `
              import { Fragment } from 'react'
              export const meta = {
                title: 'Test MDX File',
                description: 'A test MDX file for WASM build testing'
              }
              export const TestComponent = () => {}
            `
            : 'export const hello = "world"'
        }
      ]
    }
    console.log('Mock esbuild.build returning:', result)
    return Promise.resolve(result)
  })

  const mockModule = {
    build: mockBuild,
    buildSync: vi.fn(),
    transform: vi.fn(),
    transformSync: vi.fn(),
    formatMessages: vi.fn(),
    formatMessagesSync: vi.fn(),
    initialize: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    version: '0.24.0'
  }

  const moduleProxy = new Proxy(mockModule, {
    get(target: typeof mockModule, prop: keyof typeof mockModule | '__esModule' | 'default') {
      console.log('Accessing esbuild property:', prop)
      if (prop === '__esModule') return true
      if (prop === 'default') return target
      return target[prop as keyof typeof mockModule]
    }
  })

  console.log('Created mock module proxy:', moduleProxy)
  return moduleProxy
})

beforeAll(() => {
  const mockFetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()

    if (url === 'https://example.com/test.js') {
      return new Response('export const hello = "world"', {
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'content-type': 'application/javascript'
        })
      })
    }
    if (url === 'https://esm.sh/react' || url.startsWith('https://esm.sh/react@')) {
      return new Response('export default { createElement: () => {}, Fragment: Symbol("Fragment") }', {
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'content-type': 'application/javascript'
        })
      })
    }
    if (url === 'https://esm.sh/react/jsx-runtime') {
      return new Response('export const jsx = () => {}, jsxs = () => {}, Fragment = Symbol("Fragment")', {
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'content-type': 'application/javascript'
        })
      })
    }
    throw new Error(`Unmocked URL: ${url}`)
  })

  vi.stubGlobal('fetch', mockFetch)
})

afterAll(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

test('handles HTTP imports', async () => {
  console.log('Starting HTTP imports test')
  const result = await build({
    entryPoints: ['https://example.com/test.js'],
    write: false,
    bundle: true,
    minify: false,
    platform: 'neutral',
    format: 'esm',
    target: ['esnext'],
    conditions: ['import', 'default']
  })
  console.log('Build result:', result)

  expect(result).toBeDefined()
  expect(result.outputFiles).toBeDefined()
  expect(result.outputFiles?.[0]?.text).toContain('hello = "world"')
})
