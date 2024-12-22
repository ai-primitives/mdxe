import { resolveRemoteImport, fetchRemoteComponent } from './remote.js'
import type { RemoteImportOptions, RemoteImportResult } from '../types/remote.d.ts'
import remarkMdxld from 'remark-mdxld'
import remarkGfm from 'remark-gfm'
import { compile } from '@mdx-js/mdx'
import type { ComponentType } from 'react'

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
  let mdxComponents: Record<string, ComponentType> = {};
  let mdxLayout: ComponentType | undefined;

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

  // Process MDX content with enhanced remark plugins for full MDX-LD support
  const result = await compile(content, {
    remarkPlugins: [
      // Enable GitHub Flavored Markdown features
      [remarkGfm, {
        tables: true,
        taskLists: true,
        strikethrough: true,
        autolink: true
      }],
      // Configure remark-mdxld with full YAML-LD and component support
      [remarkMdxld, {
        // MDX-LD specific options
        context: options.context,
        type: options.type,
        // Enable YAML-LD frontmatter processing
        yamlld: true,
        // Support both @ and $ prefixes in frontmatter
        prefixes: ['@', '$'],
        // Enable URI-based component imports
        components: true,
        // Enable remote layout resolution
        layouts: true,
        // Enable structured data processing
        structured: true,
        // Enable executable code blocks
        executable: true
      }]
    ],
    jsx: true,
    jsxImportSource: '@mdx-js/react',
    development: process.env.NODE_ENV === 'development'
  });

  // Extract and process structured data from remarkMdxld plugin
  const mdxldData = (result as {
    data?: {
      mdxld?: {
        frontmatter?: Record<string, unknown>;
        yamlld?: Record<string, unknown>;
        components?: Record<string, string>;
        layout?: string;
        structured?: Record<string, unknown>;
        executable?: Record<string, string>;
      }
    }
  }).data?.mdxld || {};

  // Extract metadata and structured data
  frontmatter = mdxldData.frontmatter || {};
  yamlld = mdxldData.yamlld || {};

  // Process structured data and executable code blocks
  if (mdxldData.structured) {
    yamlld = { ...yamlld, ...mdxldData.structured };
  }
  if (mdxldData.executable) {
    componentExports += Object.entries(mdxldData.executable)
      .map(([name, code]) => `export const ${name} = ${code};`)
      .join('\n') + '\n';
  }

  // Process remote components and layouts from frontmatter
  const remoteOptions: RemoteImportOptions = {
    url: (frontmatter.url as string) || '',
    context: (frontmatter.context as string) || undefined
  };
  
  const remoteImports = await resolveRemoteImport(remoteOptions);
  const typedImports = remoteImports as RemoteImportResult;
  
  if (typedImports.layout) {
    mdxLayout = typedImports.layout;
    const layoutStr = typedImports.layoutString || 'undefined';
    processedCode = `export const layout = ${layoutStr}\n${processedCode}`;
  }
  if (typedImports.components) {
    mdxComponents = typedImports.components;
    const componentStrs = typedImports.componentStrings || {};
    processedCode = `export const components = {\n${Object.entries(componentStrs)
      .map(([name, str]) => `  ${name}: ${str}`)
      .join(',\n')}\n}\n${processedCode}`;
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
