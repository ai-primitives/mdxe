import * as esbuildNs from 'esbuild'
import mdxEsbuild from '@mdx-js/esbuild'
import { mdxePlugin } from './plugin.js'
import type { BuildOptions, BuildResult } from 'esbuild'

let wasmInitialized = false

async function initializeWasm() {
  if (!wasmInitialized) {
    await esbuildNs.initialize({
      worker: false,
      wasmURL: 'https://unpkg.com/esbuild-wasm@0.24.0/esbuild.wasm'
    })
    wasmInitialized = true
  }
}

export async function build(options: BuildOptions): Promise<BuildResult> {
  await initializeWasm()

  // Configure MDX plugin with proper options
  const mdxPlugin = await mdxEsbuild({
    jsxImportSource: 'react',
    development: process.env.NODE_ENV === 'development',
    providerImportSource: undefined
  })

  const result = await esbuildNs.build({
    ...options,
    plugins: [
      mdxPlugin,
      mdxePlugin(),
      ...(options.plugins || [])
    ],
    jsx: 'automatic',
    format: options.format || 'esm',
    platform: options.platform || 'neutral',
    external: [
      'react',
      'react/jsx-runtime',
      ...(options.external || [])
    ],
    write: false // Ensure we always get outputFiles
  })
  return result
}

export async function stop() {
  if (wasmInitialized) {
    await esbuildNs.stop()
    wasmInitialized = false
  }
}

export { mdxePlugin } from './plugin.js'
export type { Plugin } from './types.js'
