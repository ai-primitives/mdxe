import { resolveRemoteImport, fetchRemoteComponent } from './remote.js'
import type { RemoteImportOptions, RemoteImportResult } from '../types/remote.d.ts'
import remarkMdxld from 'remark-mdxld'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import { compile } from '@mdx-js/mdx'
import type { ComponentType } from 'react'
import type { Root, YAML } from 'mdast'
import type { VFile } from 'vfile'

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
  let yamlld: ProcessedMDX['yamlld'] = {
    $type: undefined,
    $context: undefined
  };
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
      // Enable frontmatter parsing
      [remarkFrontmatter, ['yaml']],
      // Enable GitHub Flavored Markdown features
      [remarkGfm, {
        tables: true,
        taskLists: true,
        strikethrough: true,
        autolink: true
      }],
      // Debug plugin to log YAML content before mdxld
      () => (tree: Root, file: VFile) => {
        const yamlNode = tree.children.find((node): node is YAML => node.type === 'yaml')
        console.log('Debug: YAML content before mdxld:', yamlNode?.value)
        console.log('Debug: YAML node type before mdxld:', yamlNode?.type)
        console.log('Debug: File data before mdxld:', JSON.stringify(file.data, null, 2))
        return tree
      },
      // Use default remark-mdxld configuration to match next-mdxld
      remarkMdxld,
      // Debug plugin to log YAML content after mdxld
      () => (tree: Root, file: VFile) => {
        const yamlNode = tree.children.find((node): node is YAML => node.type === 'yaml')
        console.log('Debug: YAML content after mdxld:', yamlNode?.value)
        console.log('Debug: YAML node type after mdxld:', yamlNode?.type)
        console.log('Debug: File data after mdxld:', JSON.stringify(file.data, null, 2))
        return tree
      }
    ],
    jsx: true,
    jsxImportSource: '@mdx-js/react',
    development: process.env.NODE_ENV === 'development'
  });

  interface MDXLDResult {
    data?: {
      mdxld?: {
        frontmatter?: Record<string, unknown>;
        yamlld?: ProcessedMDX['yamlld'];
        components?: Record<string, string>;
        layout?: string;
        structured?: ProcessedMDX['yamlld'];
        executable?: Record<string, string>;
      }
    }
  }

  // Extract and process structured data from remarkMdxld plugin
  const mdxldData = (result as MDXLDResult).data?.mdxld || {};

  // Extract metadata and structured data
  frontmatter = mdxldData.frontmatter || {};
  const rawYamlld = mdxldData.yamlld || {};

  // Filter yamlld to only include $type and $context
  if (rawYamlld.$type) yamlld.$type = rawYamlld.$type;
  if (rawYamlld.$context) yamlld.$context = rawYamlld.$context;

  // Process structured data and executable code blocks
  if (mdxldData.structured) {
    const structuredData = mdxldData.structured as ProcessedMDX['yamlld'];
    // Only include $type and $context from structured data if they exist
    if (structuredData?.$type) {
      yamlld.$type = structuredData.$type;
    }
    if (structuredData?.$context) {
      yamlld.$context = structuredData.$context;
    }
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
  
  // Handle layout resolution with proper null checks
  if (typedImports?.layout) {
    mdxLayout = typedImports.layout;
    const layoutStr = typedImports.layoutString || 'undefined';
    processedCode = `export const layout = ${layoutStr}\n${processedCode}`;
  } else if (options.layout) {
    // Fallback to options.layout if remote import failed
    console.warn('Layout import failed, using fallback layout');
    processedCode = `export const layout = undefined\n${processedCode}`;
  }
  // Handle component resolution with proper null checks
  if (typedImports?.components) {
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
