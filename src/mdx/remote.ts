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
  if (url.startsWith('https://esm.sh/')) {
    return url
  }

  const baseUrl = 'https://esm.sh'
  const packageName = url.startsWith('@') ? url : url.split('/')[0]
  const versionSuffix = version ? `@${version}` : ''

  return `${baseUrl}/${packageName}${versionSuffix}`
}

export async function fetchRemoteComponent(url: string, baseDir?: string): Promise<string> {
  if (baseDir && (url.startsWith('./') || url.startsWith('../'))) {
    for (const ext of FILE_EXTENSIONS) {
      const filePath = path.join(baseDir, url + ext)
      try {
        const stats = await fs.stat(filePath)
        if (stats.isFile()) {
          return await fs.readFile(filePath, 'utf-8')
        }
      } catch {
        continue
      }
    }
    throw new Error(`Local component not found: ${url} in ${baseDir}`)
  }

  await fs.mkdir(CACHE_DIR, { recursive: true })

  const cacheKey = createHash('sha256').update(url).digest('hex')
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.js`)

  try {
    const stats = await fs.stat(cachePath)
    const cacheAge = Date.now() - stats.mtimeMs

    if (cacheAge < 24 * 60 * 60 * 1000) {
      return await fs.readFile(cachePath, 'utf-8')
    }
  } catch {}

  try {
    const response = await globalThis.fetch(url)
    if (!response?.ok) {
      throw new Error(`Failed to fetch remote component: ${url} (${response?.status || 'unknown status'})`)
    }

    const content = await response.text()

    await fs.writeFile(cachePath, content, 'utf-8')

    return content
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to fetch remote component: ${url} (${errorMessage})`)
  }
}
