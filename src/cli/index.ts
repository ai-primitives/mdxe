import { version } from '../../package.json'
import { processMDX } from '../mdx/processor'
import { watch } from 'chokidar'
import { resolve, extname, dirname } from 'path'
import { existsSync, statSync } from 'fs'
import { cosmiconfig } from 'cosmiconfig'
import { spawn, type ChildProcess } from 'child_process'
import type { MDXEConfig } from './config'

const explorer = cosmiconfig('mdxe')

interface CliOptions extends MDXEConfig {
  version?: boolean
  help?: boolean
}

async function loadConfig(): Promise<MDXEConfig> {
  try {
    const result = await explorer.search()
    return result?.config || {}
  } catch (error) {
    console.warn('Failed to load config:', error)
    return {}
  }
}

async function resolveImports(content: string, config: MDXEConfig): Promise<string> {
  const { imports } = config
  if (!imports?.baseUrl) return content

  return content.replace(
    /import\s+(?:{\s*([^}]+)\s*}|\s*([^'"]+)\s+)from\s+['"]([^'"]+)['"]/g,
    (match, namedImports, defaultImport, path) => {
      if (path.startsWith('.') || path.startsWith('/')) {
        return match // Keep local imports unchanged
      }
      const baseUrl = imports.baseUrl?.replace(/\/$/, '') ?? 'https://esm.sh'
      const resolvedPath = `${baseUrl}/${path}`
      return `import ${namedImports ? `{ ${namedImports} }` : defaultImport} from '${resolvedPath}'`
    }
  )
}

async function processMDXFile(filepath: string, config: MDXEConfig) {
  const ext = extname(filepath)
  if (ext !== '.mdx' && ext !== '.md') {
    console.error('File must be .mdx or .md')
    process.exit(1)
  }

  try {
    const result = await processMDX({
      filepath,
      compileOptions: config.mdxOptions
    })
    console.log('Processed:', filepath)
    return result
  } catch (error) {
    console.error('Error processing file:', error)
    process.exit(1)
  }
}

function startNextDev(config: MDXEConfig) {
  const dir = config.next?.dir || '.'
  const nextProcess = spawn('next', ['dev', dir], {
    stdio: 'inherit',
    shell: true
  })

  nextProcess.on('error', (error) => {
    console.error('Failed to start Next.js dev server:', error)
    process.exit(1)
  })

  return nextProcess
}

export function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {}

  for (const arg of args) {
    if (arg === '-v' || arg === '--version') {
      options.version = true
    } else if (arg === '-h' || arg === '--help') {
      options.help = true
    }
  }

  return options
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
  console.log(`v${version}`)
}

export async function cli(args: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(args)
  const config = await loadConfig()

  if (options.version) {
    showVersion()
    return
  }

  if (options.help) {
    showHelp()
    return
  }

  const target = args[0]
  if (!target) {
    console.error('Please provide a file or directory')
    process.exit(1)
  }

  // Handle file extension assumption
  const filepath = resolve(process.cwd(), target.includes('.') ? target : `${target}.mdx`)

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
    const patterns = isDirectory
      ? [`${filepath}/**/*.mdx`, `${filepath}/**/*.md`]
      : [filepath]

    const watcher = watch(patterns, {
      ignored: config.watch?.ignore,
      persistent: true
    })

    console.log('Watching for changes...')
    watcher.on('add', file => processMDXFile(file, config))
    watcher.on('change', file => processMDXFile(file, config))

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
