import { resolveComponent, resolveLayout } from 'next-mdxld'
import remarkMdxld from 'remark-mdxld'
import remarkGfm from 'remark-gfm'
import { compile } from '@mdx-js/mdx'

export interface MDXProcessorOptions {
  filepath: string;
  content?: string;
  components?: Record<string, string>;
  layout?: string;
  context?: string;
  type?: string;
}

export interface ProcessedMDX {
  code: string;
  frontmatter: Record<string, unknown>;
  metadata: Record<string, unknown>;
  yamlld?: Record<string, unknown>;
}

export async function processMDX(options: MDXProcessorOptions): Promise<ProcessedMDX> {
  const { content = '', context, type, components = {} } = options;

  // Process MDX content with remark plugins
  const result = await compile(content, {
    remarkPlugins: [
      remarkGfm,
      [remarkMdxld, { context, type }]
    ],
    jsx: true,
    jsxImportSource: '@mdx-js/react'
  });

  // Extract data from remarkMdxld plugin
  const mdxldData = (result as any).data?.mdxld || {};
  const { frontmatter = {}, yamlld = {} } = mdxldData;

  // Resolve components and layout using next-mdxld
  const resolvedComponents = await resolveComponent({ type, context, components });
  const resolvedLayout = await resolveLayout({ type, context });

  // Generate component exports
  const componentExports = resolvedComponents ? 
    `export const components = ${JSON.stringify(resolvedComponents)};\n` : '';
  const layoutExport = resolvedLayout ?
    `export const layout = ${JSON.stringify(resolvedLayout)};\n` : '';

  return {
    code: `${componentExports}${layoutExport}${content}`,
    frontmatter,
    metadata: {},
    yamlld
  };
}
