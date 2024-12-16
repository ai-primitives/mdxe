import { compile } from '@mdx-js/mdx'
import matter from 'gray-matter'
import { readFileSync } from 'fs'
import type { CompileOptions } from '@mdx-js/mdx'

interface MDXProcessorOptions {
  filepath: string
  components?: Record<string, string>
  layout?: string
  compileOptions?: Partial<CompileOptions>
}

interface ProcessedMDX {
  code: string
  frontmatter: Record<string, unknown>
  metadata: Record<string, unknown>
}

export async function processMDX({
  filepath,
  components,
  layout,
  compileOptions = {}
}: MDXProcessorOptions): Promise<ProcessedMDX> {
  try {
    const source = readFileSync(filepath, 'utf-8')
    const { data: frontmatter, content } = matter(source)

    const metadata = Object.entries(frontmatter).reduce((acc, [key, value]) => {
      if (key.startsWith('$') || key.startsWith('@')) {
        acc[key] = value
        delete frontmatter[key]
      }
      return acc
    }, {} as Record<string, unknown>)

    const exports: string[] = []
    if (layout) {
      exports.push(`export const layout = '${layout}'`)
    }
    if (components) {
      try {
        const componentsExport = `export const components = ${JSON.stringify(components)}`
        exports.push(componentsExport)
      } catch (error) {
        throw new Error(`Failed to stringify components: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    const result = await compile(`${exports.join('\n')}\n${content}`, {
      jsx: true,
      outputFormat: 'function-body',
      ...compileOptions
    })

    return {
      code: String(result),
      frontmatter,
      metadata
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to process MDX file ${filepath}: ${error.message}`)
    }
    throw error
  }
}
