import { processMDX } from '../mdx/processor.js'
import { watch } from 'chokidar'
import { resolve, extname, dirname } from 'path'
import { existsSync, statSync, readFileSync } from 'fs'
import { cosmiconfig } from 'cosmiconfig'
import { spawn, type ChildProcess } from 'child_process'
import type { MDXEConfig } from './config.js'

// Import package.json with type assertion for ESM compatibility
const pkg = {
  default: {
    version: process.env.npm_package_version || '0.0.0'
  }
}

const explorer = cosmiconfig('mdxe')

interface CliOptions extends MDXEConfig {
  version?: boolean
  help?: boolean
}

// Utility function for consistent error handling
function formatError(error: unknown): string {
  return String(error instanceof Error ? error.message : error)
}

async function loadConfig(): Promise<MDXEConfig> {
  try {
    const result = await explorer.search()
    return result?.config || {}
  } catch (error) {
    const errorMessage = formatError(error)
    console.warn('Failed to load config:', errorMessage)
    return {}
  }
}

async function resolveImports(content: string, config: MDXEConfig): Promise<string> {
  const { imports } = config
  if (!imports?.baseUrl) return content

  return content.replace(/import\s+(?:{\s*([^}]+)\s*}|\s*([^'"]+)\s+)from\s+['"]([^'"]+)['"]/g, (match, namedImports, defaultImport, path) => {
    if (path.startsWith('.') || path.startsWith('/')) {
      return match // Keep local imports unchanged
    }
    const baseUrl = imports.baseUrl?.replace(/\/$/, '') ?? 'https://esm.sh'
    const resolvedPath = `${baseUrl}/${path}`
    return `import ${namedImports ? `{ ${namedImports} }` : defaultImport} from '${resolvedPath}'`
  })
}

async function processMDXFile(filepath: string, config: MDXEConfig) {
  const ext = extname(filepath)
  if (ext !== '.mdx' && ext !== '.md') {
    console.error('File must be .mdx or .md')
    process.exit(1)
  }

  try {
    // Process imports first
    const processedContent = await resolveImports(readFileSync(filepath, 'utf-8'), config)

    const result = await processMDX({
      filepath,
      content: processedContent,
      compileOptions: {
        ...config.mdxOptions,
        jsx: true, // Ensure JSX is enabled for component imports
      },
    })
    console.log('Processed:', filepath)
    return result
  } catch (error) {
    const errorMessage = formatError(error)
    console.error('Error processing file:', errorMessage)
    process.exit(1)
  }
}

function startNextDev(config: MDXEConfig) {
  const dir = config.next?.dir || '.'
  const nextProcess = spawn('next', ['dev', dir], {
    stdio: 'inherit',
    shell: true,
  })

  nextProcess.on('error', (error) => {
    const errorMessage = formatError(error)
    console.error('Failed to start Next.js dev server:', errorMessage)
    process.exit(1)
  })

  return nextProcess
}

export function parseArgs(args: string[]): { options: CliOptions; remainingArgs: string[] } {
  const options: CliOptions = {}
  const remainingArgs: string[] = []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '-v' || arg === '--version') {
      options.version = true
    } else if (arg === '-h' || arg === '--help') {
      options.help = true
    } else if (arg === '--watch') {
      options.watch = { enabled: true }
    } else {
      remainingArgs.push(arg)
    }
  }

  return { options, remainingArgs }
}

export function showHelp(): void {
  console.log(`
Usage: mdxe [options] <file|directory>

Options:
  -v, --version  Show version number
  -h, --help     Show help

Configuration:
  Configure via package.json or mdxe.config.js
  See documentation for configuration options
`)
}

export function showVersion(): void {
  console.log(`v${pkg.default.version}`)
}

export async function cli(args: string[] = process.argv.slice(2)): Promise<void> {
  const { options, remainingArgs } = parseArgs(args)
  const config = await loadConfig()

  if (options.version) {
    showVersion()
    return
  }

  if (options.help) {
    showHelp()
    return
  }

  // Get the target path from remaining args
  const target = remainingArgs[0]
  if (!target) {
    showHelp() // Show help instead of error
    return
  }

  // Handle file extension assumption
  const filepath = resolve(process.cwd(), target.includes('.') ? target : `${target}.mdx`)
  console.log('[DEBUG] Resolved filepath:', filepath)

  if (!existsSync(filepath) && !existsSync(dirname(filepath))) {
    console.error('File or directory not found:', filepath)
    process.exit(1)
  }

  const isDirectory = existsSync(filepath) && statSync(filepath).isDirectory()

  // Start Next.js dev server if configured
  let nextProcess: ChildProcess | undefined
  if (config.next?.dev) {
    nextProcess = startNextDev(config)
  }

  if (isDirectory || config.watch?.enabled) {
    const patterns = isDirectory ? [`${filepath}/**/*.mdx`, `${filepath}/**/*.md`] : [filepath]
    const absolutePatterns = patterns.map((p) => resolve(process.cwd(), p))

    // Use process.stdout.write for immediate flushing
    process.stdout.write(`[DEBUG] Starting watcher with patterns: ${JSON.stringify(absolutePatterns)}\n`)
    console.log('[DEBUG] Current working directory:', process.cwd())
    console.log('[DEBUG] Absolute patterns resolved:', absolutePatterns.map(p => resolve(process.cwd(), p)))
    
    const watchOptions = {
      ignored: config.watch?.ignore,
      persistent: true,
      ignoreInitial: false,
      cwd: process.cwd(),
      usePolling: true,
      awaitWriteFinish: {
        stabilityThreshold: 1000, // Increased for more stability
        pollInterval: 100 // Reduced polling frequency for stability
      },
      interval: 100, // Reduced polling frequency
      binaryInterval: 300, // Increased to reduce system load
      alwaysStat: true,
      atomic: true,
      followSymlinks: true,
      depth: undefined
    }
    
    process.stdout.write(`[DEBUG] Watch options: ${JSON.stringify(watchOptions, null, 2)}\n`)
    const watcher = watch(absolutePatterns, watchOptions)

    console.log('[DEBUG] Watching for changes...')
    watcher.on('ready', () => {
      // Force flush all outputs
      process.stdout.write('[DEBUG] Initial scan complete\n')
      process.stdout.write(`[DEBUG] Watched paths: ${JSON.stringify(watcher.getWatched())}\n`)
      process.stdout.write(`[DEBUG] Watch base path: ${process.cwd()}\n`)
      process.stdout.write(`[DEBUG] Watch patterns: ${JSON.stringify(absolutePatterns)}\n`)
      // Ensure all output is written immediately
      process.stdout.write('\n')
    })
    // Log all watcher events for debugging
    watcher.on('all', (event, filePath) => {
      console.log(`[DEBUG] Watcher event: ${event} on file: ${filePath}`)
      try {
        const stats = statSync(filePath)
        console.log(`[DEBUG] File stats for ${event}:`, {
          exists: existsSync(filePath),
          inode: stats.ino,
          size: stats.size,
          mtime: stats.mtime,
          ctime: stats.ctime
        })
      } catch (error) {
        console.log(`[DEBUG] Error getting stats for ${filePath}:`, error)
      }
    })

    watcher.on('add', async (filePath: string | Error) => {
      if (filePath instanceof Error) {
        console.error('[DEBUG] Error in add handler:', filePath.message)
        return
      }
      const absolutePath = resolve(process.cwd(), filePath)
      console.log(`[DEBUG] File ${absolutePath} has been added`)
      console.log('[DEBUG] File exists:', existsSync(absolutePath))
      console.log('[DEBUG] File content:', readFileSync(absolutePath, 'utf-8'))
      try {
        await processMDXFile(absolutePath, config)
        console.log('[DEBUG] Successfully processed added file')
      } catch (error: unknown) {
        const errorMsg = formatError(error)
        console.error(`[DEBUG] Error processing added file: ${errorMsg}`)
      }
    })

    watcher.on('change', async (filePath: string | Error) => {
      if (filePath instanceof Error) {
        console.error('[DEBUG] Error in change handler:', filePath.message)
        return
      }
      const absolutePath = resolve(process.cwd(), filePath)
      console.log(`[DEBUG] File ${absolutePath} has been changed`)
      
      // Ensure we have the latest content
      const fileContent = readFileSync(absolutePath, 'utf-8')
      console.log('[DEBUG] Current file content:', fileContent)
      
      try {
        process.stdout.write(`[DEBUG] Processing changed file: ${absolutePath}\n`)
        await processMDXFile(absolutePath, config)
        // Use process.stdout.write for immediate flushing
        process.stdout.write(`[DEBUG] Successfully processed file: ${absolutePath}\n`)
        process.stdout.write('Successfully processed\n')
      } catch (error: unknown) {
        const errorMsg = formatError(error)
        process.stdout.write(`[DEBUG] Error processing changed file: ${errorMsg}\n`)
      }
    })
    watcher.on('error', (error: unknown) => {
      const errorMsg = formatError(error)
      console.error('Watcher error:', errorMsg)
    })

    // Handle cleanup
    process.on('SIGINT', () => {
      watcher.close()
      if (nextProcess) {
        nextProcess.kill()
      }
      process.exit(0)
    })
  } else {
    await processMDXFile(filepath, config)
    if (nextProcess) {
      nextProcess.kill()
    }
  }
}
