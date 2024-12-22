import { resolveRemoteImport, fetchRemoteComponent } from './remote.js'

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
}

export interface ProcessedMDX {
  code: string;
  frontmatter: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export async function processMDX(options: MDXProcessorOptions): Promise<ProcessedMDX> {
  const { content = '', components = {}, layout } = options;
  let processedCode = content;
  let componentExports = '';

  // Process remote components
  for (const [name, url] of Object.entries(components)) {
    if (url.startsWith('http')) {
      const code = await fetchRemoteComponent(url);
      componentExports += `\n${code}\n`;
    } else {
      const resolvedUrl = await resolveRemoteImport({ url });
      const code = await fetchRemoteComponent(resolvedUrl);
      componentExports += `\n${code}\n`;
    }
  }

  // Process remote layout
  if (layout) {
    const resolvedUrl = await resolveRemoteImport({ url: layout });
    const layoutCode = await fetchRemoteComponent(resolvedUrl);
    componentExports += `\n${layoutCode}\n`;
  }

  // Combine content with component exports
  processedCode = `${componentExports}\n${processedCode}`;

  return {
    code: processedCode,
    frontmatter: {},
    metadata: {}
  };
}
