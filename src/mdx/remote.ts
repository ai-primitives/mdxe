import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

interface RemoteImportOptions {
  url: string
  version?: string
}

const CACHE_DIR = path.join(os.tmpdir(), 'mdxe-remote-cache')
const FILE_EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js']

export async function resolveRemoteImport({ url, version }: RemoteImportOptions): Promise<string> {
  // Handle esm.sh URLs
  if (url.startsWith('https://esm.sh/')) {
    return url // Already in correct format
  }

  // Convert package name to esm.sh URL
  const baseUrl = 'https://esm.sh'
  const packageName = url.startsWith('@') ? url : url.split('/')[0]
  const versionSuffix = version ? `@${version}` : ''

  return `${baseUrl}/${packageName}${versionSuffix}`
}

export async function fetchRemoteComponent(url: string, baseDir?: string): Promise<string> {
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

  // Handle remote components
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

  // Fetch remote component
  const response = await globalThis.fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch remote component: ${url}`)
  }

  const content = await response.text()

  // Cache the content
  await fs.writeFile(cachePath, content, 'utf-8')

  return content
}
