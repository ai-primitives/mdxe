import * as esbuildNs from 'esbuild'
import { mdxePlugin } from './plugin.js'
import type { BuildOptions, BuildResult } from './types.js'

export async function build(options: BuildOptions): Promise<BuildResult> {
  console.log('Building with options:', options)
  console.log('esbuild module:', esbuildNs)

  try {
    const result = await esbuildNs.build({
      ...options,
      plugins: [
        mdxePlugin(),
        ...(options.plugins || [])
      ],
      write: false // Ensure we always get outputFiles
    })
    console.log('Build result:', result)
    return result
  } catch (error) {
    console.error('Build error:', error)
    throw error
  }
}

export { mdxePlugin } from './plugin.js'
export type { BuildOptions, BuildResult, Plugin } from './types.js'
