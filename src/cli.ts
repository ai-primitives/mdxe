import { resolve } from 'path'
import { processFile } from './mdx/processor.js'

export async function main() {
  if (process.argv.includes('--version')) {
    console.log('mdxe version 1.2.0')
    return
  }

  if (process.argv.includes('--help')) {
    console.log(`
Usage: mdxe [options] [file]

Options:
  --version  Show version number
  --help     Show help
`)
    return
  }

  const targetPath = process.argv[process.argv.length - 1]

  if (!targetPath || targetPath.startsWith('--')) {
    console.error('Error: No target file or directory specified')
    process.exit(1)
  }

  const absolutePath = resolve(process.cwd(), targetPath)

  try {
    await processFile(absolutePath)
    console.log('Processing complete')
  } catch (error) {
    console.error('Error processing file:', error)
    process.exit(1)
  }
}
