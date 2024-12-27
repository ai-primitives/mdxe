import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import fetch from 'node-fetch'
// Import only the types we need
import type { RemoteImportOptions, RemoteImportResult } from '../types/remote.js'

const CACHE_DIR = path.join(os.tmpdir(), 'mdxe-remote-cache')
const FILE_EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js']
const ALLOWED_DOMAINS = ['esm.sh', 'cdn.skypack.dev', 'unpkg.com']

export async function resolveRemoteImport({ url, version, context }: RemoteImportOptions): Promise<RemoteImportResult | null> {
  try {
    if (!url) {
      return null
    }

    // Validate URL domain if it's a full URL
    if (url.startsWith('http')) {
      const urlObj = new URL(url)
      if (!ALLOWED_DOMAINS.some((domain) => urlObj.hostname === domain)) {
        throw new Error(`Domain ${urlObj.hostname} not allowed for remote imports`)
      }
    }

    // Convert package name to esm.sh URL if needed
    const resolvedUrl = url.startsWith('http') ? url : `https://esm.sh/${url}${version ? `@${version}` : ''}`

    // Try to fetch and analyze the content
    const response = await fetch(resolvedUrl)
    if (!response.ok) {
      console.warn(`Failed to resolve remote import: ${resolvedUrl}`)
      return null
    }

    const content = await response.text()
    
    // Check if it's a component or layout
    if (content.includes('export default')) {
      const importStr = `import('${resolvedUrl}').then(m => m.default)`
      if (context?.includes('layouts')) {
        return {
          layout: () => null,
          layoutString: importStr,
          url: resolvedUrl
        }
      } else {
        const name = path.basename(url).replace(/\.[^/.]+$/, '')
        return {
          components: { [name]: () => null },
          componentStrings: { [name]: importStr },
          url: resolvedUrl
        }
      }
    }

    return { url: resolvedUrl }
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
      if (!ALLOWED_DOMAINS.some((domain) => urlObj.hostname === domain)) {
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

      // Cache is valid for 24 hours and must have content
      if (cacheAge < 24 * 60 * 60 * 1000 && stats.size > 0) {
        const content = await fs.readFile(cachePath, 'utf-8')
        // If cache is stale but still valid, trigger a background refresh
        if (cacheAge > 23 * 60 * 60 * 1000) {
          void fetch(url).then(async response => {
            if (response.ok) {
              const content = await response.text()
              await fs.writeFile(cachePath, content, 'utf-8')
            }
          }).catch(() => {/* ignore background fetch errors */})
        }
        return content
      }
    } catch {
      // Cache miss or error, proceed with fetch
    }

    // Convert package name to esm.sh URL if needed
    const resolvedUrl = url.startsWith('http') ? url : `https://esm.sh/${url}`

    try {
      // Resolve the URL through our resolver
      const result = await resolveRemoteImport({ url: resolvedUrl })
      if (result?.url) {
        const response = await fetch(result.url)
        if (!response.ok) {
          throw new Error(`Failed to fetch component from ${result.url}`)
        }
        const content = await response.text()
        await fs.writeFile(cachePath, content, 'utf-8')
        return content
      }

      // Fallback to direct fetch if not resolved
      const response = await fetch(resolvedUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch component from ${resolvedUrl}`)
      }

      const content = await response.text()

      // Cache the content
      await fs.writeFile(cachePath, content, 'utf-8')

      return content
    } catch (error) {
      console.error('Failed to fetch remote component:', error)
      if (error instanceof Error) {
        throw error
      }
      throw new Error(`Failed to fetch component from ${resolvedUrl}`)
    }
}
