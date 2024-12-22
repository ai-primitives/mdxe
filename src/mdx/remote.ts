import { resolveComponent, resolveLayout } from 'next-mdxld'
import type { ComponentResolutionOptions, LayoutResolutionOptions } from 'next-mdxld'

export interface RemoteImportOptions {
  url: string
  version?: string
  context?: string
}

export interface RemoteImportResult {
  components?: Record<string, any>
  componentStrings?: Record<string, string>
  layout?: any
  layoutString?: string
}

export async function resolveRemoteImport({ url, version, context }: RemoteImportOptions): Promise<RemoteImportResult | null> {
  try {
    const resolvedUrl = url.startsWith('http') ? url : `https://esm.sh/${url}${version ? `@${version}` : ''}`

    // Try resolving as component first
    const component = await resolveComponent({ type: resolvedUrl, context })
    if (component) {
      return {
        components: { [resolvedUrl]: component },
        componentStrings: { [resolvedUrl]: `import('${resolvedUrl}').then(m => m.default)` }
      }
    }

    // Try resolving as layout
    const layout = await resolveLayout({ type: resolvedUrl, context })
    if (layout) {
      return {
        layout,
        layoutString: `import('${resolvedUrl}').then(m => m.default)`
      }
    }

    return null
  } catch (error) {
    console.error('Failed to resolve remote import:', error)
    return null
  }
}
