import { processMDX } from '../mdx/processor.js'
import { watch } from 'chokidar'
import { resolve, extname, dirname } from 'path'
import { existsSync, statSync, readFileSync } from 'fs'
import { cosmiconfig } from 'cosmiconfig'
import { spawn, type ChildProcess } from 'child_process'
import { fileURLToPath } from 'url'
import type { MDXEConfig } from './config.js'

// Use console.debug for logging
function createLogger(prefix: string) {
  return (msg: string, ...args: any[]) => console.debug(`[${prefix}] ${msg}`, ...args)
}

const log = {
  watcher: createLogger('WATCHER'),
  fs: createLogger('FS'),
  cli: createLogger('CLI')
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const pkgPath = resolve(__dirname, '../../package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))

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

// Export all CLI functions at the top
export { parseArgs, showHelp, showVersion, cli };

// Remove individual export statements and declare functions
function parseArgs(args: string[]): { options: CliOptions; remainingArgs: string[] } {
  const options: CliOptions = {
    version: false,
    help: false
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

function showHelp(): void {
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

function showVersion(): void {
  console.log(`v${pkg.version}`)
}

async function cli(args: string[] = process.argv.slice(2)): Promise<void> {
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
    const patterns = isDirectory ? 
      [`${watchTarget}/**/*.mdx`, `${watchTarget}/**/*.md`] : 
      [watchTarget]
    
    // Resolve absolute paths and validate
    const absolutePatterns = patterns.map((p) => {
      const resolved = resolve(process.cwd(), p)
      log.watcher(`Resolved pattern ${p} to ${resolved}`)
      return resolved
    })

    // Validate paths before watching
    absolutePatterns.forEach(pattern => {
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
      ignoreInitial: false,    // Process files on startup
      cwd: process.cwd(),
      usePolling: true,        // Enable polling for more reliable detection
      awaitWriteFinish: {
        stabilityThreshold: 2000,  // Wait longer for writes to finish
        pollInterval: 250          // Less frequent polling to reduce system load
      },
      interval: 1000,            // Less aggressive polling
      binaryInterval: 2000,      // Less aggressive binary polling
      alwaysStat: true,         // Get detailed file stats
      atomic: true,             // Enable atomic writes detection
      ignorePermissionErrors: true,
      followSymlinks: true,     // Follow symlinks
      depth: undefined,         // Watch all subdirectories
      disableGlobbing: false    // Enable globbing for pattern matching
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

    // Set up all event handlers with enhanced logging and error handling
    watcher
      .on('add', async (path) => {
        debugEvent('add', path)
        const absolutePath = resolve(process.cwd(), path)
        try {
          log.watcher(`Processing file: ${absolutePath}`)
          process.stdout.write(`Processing file: ${absolutePath}\n`)
          await processMDXFile(absolutePath, config)
          log.watcher(`Successfully processed ${absolutePath}`)
          process.stdout.write(`Successfully processed ${absolutePath}\n`)
        } catch (error) {
          const errorMsg = formatError(error)
          log.watcher(`Error processing file ${absolutePath}:`, errorMsg)
          process.stdout.write(`Error processing file: ${absolutePath} - ${errorMsg}\n`)
        }
      })
      .on('change', async (path) => {
        debugEvent('change', path)
        const absolutePath = resolve(process.cwd(), path)
        try {
          log.watcher(`File changed: ${absolutePath}`)
          process.stdout.write(`File changed: ${absolutePath}\n`)
          await processMDXFile(absolutePath, config)
          log.watcher(`Successfully processed ${absolutePath}`)
          process.stdout.write(`Successfully processed ${absolutePath}\n`)
        } catch (error) {
          const errorMsg = formatError(error)
          log.watcher(`Error processing file ${absolutePath}:`, errorMsg)
          process.stdout.write(`Error processing file: ${absolutePath} - ${errorMsg}\n`)
        }
      })
      .on('unlink', path => {
        debugEvent('unlink', path)
        log.watcher(`File removed: ${path}`)
      })
      .on('addDir', path => {
        debugEvent('addDir', path)
        log.watcher(`Directory added: ${path}`)
      })
      .on('unlinkDir', path => {
        debugEvent('unlinkDir', path)
        log.watcher(`Directory removed: ${path}`)
      })
      .on('error', (error) => {
        const errorMsg = formatError(error)
        debugEvent('error')
        log.watcher('Watcher error:', errorMsg)
        process.stdout.write(`Watcher error: ${errorMsg}\n`)
      })
      .on('raw', (event, path, details) => {
        debugEvent('raw', `${path} - ${event} - ${JSON.stringify(details)}`)
        log.watcher('Raw event details:', { event, path, details })
      })

    // Set up ready handler with enhanced logging and specific success indicators
    const readyPromise = new Promise<void>((resolve) => {
      watcher.once('ready', () => {
        debugEvent('ready')
        // Output specific success indicators that tests are looking for
        process.stdout.write('Initial scan complete\n')
        process.stdout.write('Watching for changes\n')
        // Additional debug information
        log.watcher('Initial scan complete')
        log.watcher('Watched paths:', JSON.stringify(watcher.getWatched()))
        log.watcher(`Watch base path: ${process.cwd()}`)
        log.watcher(`Watch patterns: ${JSON.stringify(absolutePatterns)}`)
        // Ensure all output is flushed
        process.stdout.write('\n')
        resolve()
      })
    })

    // Wait for watcher to be ready
    await readyPromise
    log.watcher('Watcher is now active and processing events')

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
          gid: stats.gid
        })
      } catch (error) {
        log.fs(`Error getting stats for ${filePath}:`, error)
      }
    })

    // Event handlers are now consolidated above

    // Handle cleanup
    process.on('SIGINT', () => {
      watcher.close()
      if (nextProcess) {
        nextProcess.kill()
      }
      process.exit(0)
    })
  } else {
    await processMDXFile(target, config)
    if (nextProcess) {
      nextProcess.kill()
    }
  }
}
