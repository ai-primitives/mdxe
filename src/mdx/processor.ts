import { compile } from '@mdx-js/mdx'
import matter from 'gray-matter'
import { readFileSync } from 'fs'
import type { CompileOptions } from '@mdx-js/mdx'
import { resolveRemoteImport, fetchRemoteComponent } from './remote'

interface MDXProcessorOptions {
  filepath: string
  content?: string
  components?: Record<string, string>
  layout?: string
  compileOptions?: Partial<CompileOptions>
  watch?: {
    enabled?: boolean
    ignore?: string[]
  }
}

export interface ProcessedMDX {
  code: string
  frontmatter: Record<string, unknown>
  metadata: Record<string, unknown>
}

async function resolveComponent(componentPath: string): Promise<string> {
  if (componentPath.startsWith('http://') || componentPath.startsWith('https://')) {
    return await fetchRemoteComponent(componentPath)
  }

  if (componentPath.startsWith('.')) {
    return componentPath
  }

  const remoteUrl = await resolveRemoteImport({ url: componentPath })
  return await fetchRemoteComponent(remoteUrl)
}

export async function processMDX({ filepath, content, components, layout, compileOptions = {}, watch }: MDXProcessorOptions): Promise<ProcessedMDX> {
  try {
    const source = content || readFileSync(filepath, 'utf-8')
    const { data: frontmatter, content: mdxContent } = matter(source)

    // Set up watch mode if enabled
    if (watch?.enabled) {
      const chokidar = await import('chokidar')
      const watcher = chokidar.watch(filepath, {
        ignored: watch.ignore,
        persistent: true,
      })
      watcher.on('change', async () => {
        try {
          await processMDX({ filepath, components, layout, compileOptions })
        } catch (error) {
          console.error(`Watch mode error processing ${filepath}:`, error)
        }
      })
    }

    const metadata = Object.entries(frontmatter).reduce(
      (acc, [key, value]) => {
        if (key.startsWith('$') || key.startsWith('@')) {
          acc[key] = value
          delete frontmatter[key]
        }
        return acc
      },
      {} as Record<string, unknown>,
    )

    const exports: string[] = []
    if (layout) {
      const resolvedLayout = await resolveComponent(layout)
      exports.push(`import Layout from '${resolvedLayout}'`)
      exports.push('export { Layout as layout }')
    }
    if (components) {
      const resolvedComponents: Record<string, string> = {}
      for (const [name, path] of Object.entries(components)) {
        resolvedComponents[name] = await resolveComponent(path)
      }
      Object.entries(resolvedComponents).forEach(([name, path], index) => {
        exports.push(`import Component${index} from '${path}'`)
        exports.push(`export const ${name} = Component${index}`)
      })
      const componentExports = Object.keys(components)
        .map((name) => `  ${name}`)
        .join(',\n')
      exports.push(`export const components = {\n${componentExports}\n}`)
    }

    const fullContent = `${exports.join('\n')}\n\n${mdxContent}`

    const result = await compile(fullContent, {
      jsx: true,
      outputFormat: 'function-body',
      ...compileOptions,
    })

    return {
      code: String(result),
      frontmatter,
      metadata,
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to process MDX file ${filepath}: ${error.message}`)
    }
    throw error
  }
}
