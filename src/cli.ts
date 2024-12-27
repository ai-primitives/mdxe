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

  console.log('MDXE CLI is running...')
  // We'll add MDX processing later
}
