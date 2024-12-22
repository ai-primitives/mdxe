import { resolveRemoteImport, fetchRemoteComponent } from './remote.js'

export interface MDXProcessorOptions {
  filepath: string;
  content?: string;
  compileOptions?: Record<string, unknown>;
  components?: Record<string, string>;
  layout?: string;
  watch?: {
    enabled?: boolean;
    ignore?: string[];
  };
}

export interface ProcessedMDX {
  code: string;
  frontmatter: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export async function processMDX(options: MDXProcessorOptions): Promise<ProcessedMDX> {
  const { content = '', components = {}, layout } = options;
  let code = content;
  const imports: string[] = [];
  const exports: string[] = [];

  // Handle component imports
  for (const [name, url] of Object.entries(components)) {
    const resolvedUrl = url.startsWith('http') ? url : await resolveRemoteImport({ url });
    const component = await fetchRemoteComponent(resolvedUrl);
    imports.push(`import { ${name} } from '${resolvedUrl}'`);
    exports.push(component);
  }

  // Handle layout import
  if (layout) {
    const resolvedUrl = layout.startsWith('http') ? layout : await resolveRemoteImport({ url: layout });
    const layoutComponent = await fetchRemoteComponent(resolvedUrl);
    imports.push(`import Layout from '${resolvedUrl}'`);
    exports.push(layoutComponent);
  }

  // Combine everything
  code = [...imports, ...exports, code].join('\n\n');

  return {
    code,
    frontmatter: {},
    metadata: {}
  };
}
