import { processMDX } from '../mdx/processor.js'
import { watch } from 'chokidar'
import { resolve, extname, dirname } from 'path'
import { existsSync, statSync, readFileSync } from 'fs'
import { cosmiconfig } from 'cosmiconfig'
// Core imports
import type { MDXEConfig } from './config.js'

// Use console.debug for logging
function createLogger(prefix: string) {
  return (msg: string, ...args: unknown[]) => console.debug(`[${prefix}] ${msg}`, ...args)
}

const log = {
  watcher: createLogger('WATCHER'),
  fs: createLogger('FS'),
  cli: createLogger('CLI'),
}

// Import package.json with type assertion for ESM compatibility
const pkg = {
  default: {
    version: process.env.npm_package_version || '0.0.0',
  },
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

// Process MDX files

export function parseArgs(args: string[]): { options: CliOptions; remainingArgs: string[] } {
  const options: CliOptions = {
    version: false,
    help: false,
  }
  const remainingArgs: string[] = []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const nextArg = args[i + 1]

    if (arg.startsWith('-')) {
      switch (arg) {
        case '-v':
        case '--version':
          options.version = true
          break
        case '-h':
        case '--help':
          options.help = true
          break
        case '-w':
        case '--watch':
          // If next arg exists and isn't a flag, it's the watch path
          if (nextArg && !nextArg.startsWith('-')) {
            options.watch = nextArg
            i++ // Skip next arg since we used it
          } else {
            options.watch = true
          }
          break
        default:
          console.warn(`Unknown option: ${arg}`)
      }
    } else {
      remainingArgs.push(arg)
    }
  }

  log.cli('Parsed options:', JSON.stringify(options, null, 2))
  log.cli('Remaining args:', remainingArgs)

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
  if (isDirectory) {
    log.cli('Processing directory:', filepath)
  } else {
    log.cli('Processing file:', filepath)
  }

  // Handle watch mode
  if (options.watch) {
    const watchPath = typeof options.watch === 'string' ? options.watch : remainingArgs[0]
    if (!watchPath) {
      console.error('Watch path is required')
      process.exit(1)
    }

    const watchTarget = resolve(process.cwd(), watchPath)
    log.cli('Watch target:', watchTarget)

    if (!existsSync(watchTarget)) {
      console.error('Watch target not found:', watchTarget)
      process.exit(1)
    }

    const isDirectory = statSync(watchTarget).isDirectory()
    const patterns = isDirectory ? [`${watchTarget}/**/*.mdx`, `${watchTarget}/**/*.md`] : [watchTarget]

    // Resolve absolute paths and validate
    const absolutePatterns = patterns.map((p) => {
      const resolved = resolve(process.cwd(), p)
      log.watcher(`Resolved pattern ${p} to ${resolved}`)
      return resolved
    })

    // Validate paths before watching
    absolutePatterns.forEach((pattern) => {
      const baseDir = pattern.includes('*') ? dirname(pattern) : pattern
      if (!existsSync(baseDir)) {
        log.watcher(`Warning: Base directory ${baseDir} does not exist`)
      }
    })

    log.watcher(`Starting watcher with patterns: ${JSON.stringify(absolutePatterns)}`)
    log.watcher(`Current working directory: ${process.cwd()}`)

    const watchOptions = {
      ignored: typeof config.watch === 'object' ? config.watch.ignore : undefined,
      persistent: true,
      ignoreInitial: true,
      cwd: process.cwd(),
      usePolling: false,
      awaitWriteFinish: {
        stabilityThreshold: 300, // Wait for writes to finish
        pollInterval: 100, // Check every 100ms
      },
      interval: 100, // Standard polling interval
      binaryInterval: 300, // Standard binary polling
      alwaysStat: true, // Get detailed file stats
      atomic: true, // Enable atomic writes detection
      ignorePermissionErrors: true,
      followSymlinks: true, // Follow symlinks
      depth: undefined, // Watch all subdirectories
      disableGlobbing: false, // Enable globbing for pattern matching
    }

    log.watcher('Initializing watcher with options:', watchOptions)

    log.watcher(`Watch options: ${JSON.stringify(watchOptions, null, 2)}`)
    const watcher = watch(absolutePatterns, watchOptions)

    // Set up debug logging for all watcher events
    const debugEvent = (event: string, path?: string) => {
      const msg = `[DEBUG] Watcher event: ${event}${path ? ` - ${path}` : ''}`
      log.watcher(msg)
      process.stdout.write(msg + '\n')
    }

    // Set up all event handlers immediately with debug logging
    watcher
      .on('add', (path) => debugEvent('add', path))
      .on('change', async (path) => {
        debugEvent('change', path)
        try {
          await processMDXFile(path, config)
          log.watcher(`Successfully processed: ${path}`)
          process.stdout.write(`Successfully processed file: ${path}\n`)
        } catch (error) {
          log.watcher(`Error processing ${path}:`, error)
          process.stdout.write(`Error processing file: ${path} - ${error}\n`)
        }
      })
      .on('unlink', (path) => debugEvent('unlink', path))
      .on('addDir', (path) => debugEvent('addDir', path))
      .on('unlinkDir', (path) => debugEvent('unlinkDir', path))
      .on('error', (error) => {
        debugEvent('error')
        log.watcher('Watcher error:', error)
        process.stdout.write(`Watcher error: ${error}\n`)
      })
      .on('raw', (event, path, details) => {
        debugEvent('raw', `${path} - ${event} - ${JSON.stringify(details)}`)
      })

    // Set up ready handler with enhanced logging
    const readyPromise = new Promise<void>((resolve) => {
      watcher.once('ready', () => {
        debugEvent('ready')
        log.watcher('Initial scan complete')
        log.watcher('Watched paths:', JSON.stringify(watcher.getWatched()))
        process.stdout.write('Initial scan complete\n')
        process.stdout.write(`[DEBUG] Watch base path: ${process.cwd()}\n`)
        process.stdout.write(`[DEBUG] Watch patterns: ${JSON.stringify(absolutePatterns)}\n\n`)
        // Ensure all output is written immediately
        process.stdout.write('\n')
        resolve()
      })
    })

    // Wait for watcher to be ready
    await readyPromise
    console.log('[DEBUG] Watching for changes...')

    // Log all watcher events for debugging
    watcher.on('all', (event: string, filePath: string) => {
      log.watcher(`Event: ${event} on file: ${filePath}`)
      try {
        const stats = statSync(filePath)
        log.fs(`File stats for ${event}:`, {
          exists: existsSync(filePath),
          inode: stats.ino,
          size: stats.size,
          mtime: stats.mtime,
          ctime: stats.ctime,
          mode: stats.mode,
          uid: stats.uid,
          gid: stats.gid,
        })
      } catch (error) {
        log.fs(`Error getting stats for ${filePath}:`, error)
      }
    })

    watcher.on('add', async (filePath: string | Error) => {
      if (filePath instanceof Error) {
        console.error('Error in add handler:', filePath.message)
        return
      }
      const absolutePath = resolve(process.cwd(), filePath)
      try {
        await processMDXFile(absolutePath, config)
        console.log('Successfully processed file:', absolutePath)
      } catch (error: unknown) {
        const errorMsg = formatError(error)
        console.error('Error processing file:', errorMsg)
      }
    })

    watcher.on('change', async (filePath: string | Error) => {
      if (filePath instanceof Error) {
        process.stdout.write(`Error in change handler: ${filePath.message}\n`)
        return
      }
      const absolutePath = resolve(process.cwd(), filePath)
      process.stdout.write(`File ${absolutePath} has been changed\n`)
      try {
        await processMDXFile(absolutePath, config)
        process.stdout.write(`Successfully processed file: ${absolutePath}\n`)
      } catch (error: unknown) {
        const errorMsg = formatError(error)
        process.stdout.write(`Error processing file: ${errorMsg}\n`)
      }
    })

    watcher.on('error', (error: unknown) => {
      const errorMsg = formatError(error)
      console.error('Watcher error:', errorMsg)
    })

    // Handle cleanup
    process.on('SIGINT', () => {
      watcher.close()
      process.exit(0)
    })
  } else {
    await processMDXFile(target, config)
  }
}
