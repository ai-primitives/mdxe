import { resolveRemoteImport, fetchRemoteComponent } from './remote.js'
import type { RemoteImportOptions, RemoteImportResult } from '../types/remote.d.ts'
import remarkMdxld from 'remark-mdxld'
import remarkGfm from 'remark-gfm'
import { compile } from '@mdx-js/mdx'

export interface MDXProcessorOptions {
  filepath: string;
  content?: string;
  components?: Record<string, string>;
  layout?: string;
  compileOptions?: Record<string, unknown>;
  watch?: {
    enabled?: boolean;
    ignore?: string[];
  };
  // MDX-LD specific options
  context?: string;
  type?: string;
}

export interface ProcessedMDX {
  code: string;
  frontmatter: Record<string, unknown>;
  metadata: Record<string, unknown>;
  yamlld?: {
    $type?: string;
    $id?: string;
    $context?: string | Record<string, unknown>;
    [key: string]: unknown;
  };
}

export async function processMDX(options: MDXProcessorOptions): Promise<ProcessedMDX> {
  const { content = '', context, type } = options;
  let processedCode = content;
  let componentExports = '';
  let yamlld = {};
  let frontmatter: Record<string, unknown> = {};
  let mdxComponents: Record<string, string> = {};
  let mdxLayout: string | undefined;

  // Process remote components and generate ESM-compatible exports
  if (options.components) {
    for (const [name, url] of Object.entries(options.components)) {
      if (typeof url === 'string' && url.startsWith('http')) {
        const code = await fetchRemoteComponent(url);
        componentExports += `export { default as ${name} } from '${url}';\n`;
      } else if (typeof url === 'string') {
        const resolvedUrl = await resolveRemoteImport({ url, context });
        componentExports += `export { default as ${name} } from '${resolvedUrl}';\n`;
      }
    }
  }

  // Process remote layout with ESM export
  if (options.layout && typeof options.layout === 'string') {
    const resolvedUrl = await resolveRemoteImport({ url: options.layout, context });
    componentExports += `export { default as layout } from '${resolvedUrl}';\n`;
  }

  // Auto-resolve layout based on type if not explicitly provided
  if (!options.layout && type && typeof type === 'string') {
    const resolvedUrl = await resolveRemoteImport({ url: type, context });
    if (resolvedUrl) {
      componentExports += `export { default as layout } from '${resolvedUrl}';\n`;
    }
  }

  // Process MDX content with remark-mdxld and remark-gfm plugins
  const result = await compile(content, {
    remarkPlugins: [
      remarkGfm,
      [remarkMdxld, { 
        context: options.context,
        type: options.type
      }]
    ],
    jsx: true,
    jsxImportSource: '@mdx-js/react',
    development: process.env.NODE_ENV === 'development'
  });

  // Extract frontmatter and YAML-LD from remarkMdxld plugin
  const mdxldData = (result as { data?: { mdxld?: { frontmatter?: Record<string, unknown>; yamlld?: Record<string, unknown> } } }).data?.mdxld || {};
  frontmatter = mdxldData.frontmatter || {};
  yamlld = mdxldData.yamlld || {};

  // Process remote components and layouts from frontmatter
  const remoteOptions: RemoteImportOptions = {
    url: (frontmatter.url as string) || '',
    context: (frontmatter.context as string) || undefined
  };
  
  const remoteImports = await resolveRemoteImport(remoteOptions);
  const typedImports = remoteImports as RemoteImportResult;
  
  if (typedImports.layout) {
    mdxLayout = typedImports.layout;
    processedCode = `export const layout = ${JSON.stringify(mdxLayout)}\n${processedCode}`;
  }
  if (typedImports.components) {
    mdxComponents = typedImports.components;
    processedCode = `export const components = ${JSON.stringify(mdxComponents)}\n${processedCode}`;
  }

  // Combine exports with content
  processedCode = `${componentExports}\n${processedCode}`;

  return {
    code: processedCode,
    frontmatter,
    metadata: {},
    yamlld
  };
}
