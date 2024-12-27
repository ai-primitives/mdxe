import { processMDX } from '../mdx/processor.js'
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
    console.log('Watch mode is now handled by Next.js dev server. Please use `next dev` instead.')
    process.exit(0)
  } else {
    await processMDXFile(target, config)
  }
}
