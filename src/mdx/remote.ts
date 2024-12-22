import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

import { resolveComponent, resolveLayout } from 'next-mdxld'
import type { ComponentResolutionOptions, LayoutResolutionOptions, RemoteImportOptions, RemoteImportResult } from '../types/remote.js'

const CACHE_DIR = path.join(os.tmpdir(), 'mdxe-remote-cache')
const FILE_EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js']
const ALLOWED_DOMAINS = ['esm.sh', 'cdn.skypack.dev', 'unpkg.com']

export async function resolveRemoteImport({ url, version, context }: RemoteImportOptions): Promise<RemoteImportResult | null> {
  try {
    // Validate URL domain if it's a full URL
    if (url.startsWith('http')) {
      const urlObj = new URL(url)
      if (!ALLOWED_DOMAINS.some(domain => urlObj.hostname === domain)) {
        throw new Error(`Domain ${urlObj.hostname} not allowed for remote imports`)
      }
    }

    // Convert package name to esm.sh URL if needed
    const resolvedUrl = url.startsWith('http') ? url : `https://esm.sh/${url}${version ? `@${version}` : ''}`

    // Attempt to resolve as component first
    const componentOptions: ComponentResolutionOptions = {
      type: resolvedUrl,
      context,
      components: {}
    }
    const component = await resolveComponent(componentOptions)
    if (component) {
      return {
        components: { [resolvedUrl]: component },
        componentStrings: { [resolvedUrl]: `import('${resolvedUrl}').then(m => m.default)` }
      }
    }

    // Try resolving as layout
    const layoutOptions: LayoutResolutionOptions = {
      type: resolvedUrl,
      context,
      layouts: {}
    }
    const layout = await resolveLayout(layoutOptions)
    if (layout) {
      return {
        layout,
        layoutString: `import('${resolvedUrl}').then(m => m.default)`
      }
    }

    return null
  } catch (error) {
    console.error('Failed to resolve remote import:', error)
    return null
  }
}

export async function fetchRemoteComponent(url: string, baseDir?: string): Promise<string> {
  try {
    // Handle local file imports
    if (baseDir && (url.startsWith('./') || url.startsWith('../'))) {
      // Try each extension until we find a matching file
      for (const ext of FILE_EXTENSIONS) {
        const filePath = path.join(baseDir, url + ext)
        try {
          const stats = await fs.stat(filePath)
          if (stats.isFile()) {
            return await fs.readFile(filePath, 'utf-8')
          }
        } catch {
          continue // File doesn't exist with this extension, try next
        }
      }
      throw new Error(`Local component not found: ${url} in ${baseDir}`)
    }

    // Validate URL domain for remote components
    if (url.startsWith('http')) {
      const urlObj = new URL(url)
      if (!ALLOWED_DOMAINS.some(domain => urlObj.hostname === domain)) {
        throw new Error(`Domain ${urlObj.hostname} not allowed for remote imports`)
      }
    }

    // Handle remote components with caching
    await fs.mkdir(CACHE_DIR, { recursive: true })

    // Generate cache key from URL
    const cacheKey = createHash('sha256').update(url).digest('hex')
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.js`)

    try {
      // Check cache first
      const stats = await fs.stat(cachePath)
      const cacheAge = Date.now() - stats.mtimeMs

      // Cache is valid for 24 hours
      if (cacheAge < 24 * 60 * 60 * 1000) {
        return await fs.readFile(cachePath, 'utf-8')
      }
    } catch {
      // Cache miss or error, proceed with fetch
    }

    // Convert package name to esm.sh URL if needed
    const resolvedUrl = url.startsWith('http') ? url : `https://esm.sh/${url}`

    // Try resolving through next-mdxld first
    const result = await resolveRemoteImport({ url: resolvedUrl })
    if (result?.components || result?.layout) {
      // Component or layout found through next-mdxld
      return JSON.stringify(result)
    }

    // Fallback to direct fetch if not found through next-mdxld
    const response = await fetch(resolvedUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch component from ${resolvedUrl}: ${response.statusText}`)
    }

    const content = await response.text()


    // Cache the content
    await fs.writeFile(cachePath, content, 'utf-8')

    return content
  } catch (error) {
    console.error('Failed to fetch remote component:', error)
    throw error
  }
}
