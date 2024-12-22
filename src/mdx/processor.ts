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
    // Add import statement
    imports.push(`import { ${name} } from '${resolvedUrl}'`);
    // Only add the component code if it's not just an import
    if (!component.trim().startsWith('import ')) {
      exports.push(component);
    }
  }

  // Handle layout import
  if (layout) {
    const resolvedUrl = layout.startsWith('http') ? layout : await resolveRemoteImport({ url: layout });
    const layoutComponent = await fetchRemoteComponent(resolvedUrl);
    // Add import statement
    imports.push(`import Layout from '${resolvedUrl}'`);
    // Only add the layout component code if it's not just an import
    if (!layoutComponent.trim().startsWith('import ')) {
      exports.push(layoutComponent);
    }
  }

  // Process imports and exports
  const processedImports = imports.join('\n');
  const processedExports = exports.join('\n\n');
  
  // Combine everything in the correct order
  // First imports, then content (which may contain frontmatter), then component exports
  code = [
    processedImports,
    code.trim(),
    processedExports
  ].filter(Boolean).join('\n\n');

  return {
    code,
    frontmatter: {},
    metadata: {}
  };
}
