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
  const { content = '', components = {}, layout, context, type } = options;
  let processedCode = content;
  let componentExports = '';
  let yamlld = {};

  // Process remote components and generate ESM-compatible exports
  for (const [name, url] of Object.entries(components)) {
    if (url.startsWith('http')) {
      const code = await fetchRemoteComponent(url);
      componentExports += `export { default as ${name} } from '${url}';\n`;
    } else {
      const resolvedUrl = await resolveRemoteImport({ url, context });
      componentExports += `export { default as ${name} } from '${resolvedUrl}';\n`;
    }
  }

  // Process remote layout with ESM export
  if (layout) {
    const resolvedUrl = await resolveRemoteImport({ url: layout, context });
    componentExports += `export { default as layout } from '${resolvedUrl}';\n`;
  }

  // Auto-resolve layout based on type if not explicitly provided
  if (!layout && type) {
    const resolvedUrl = await resolveRemoteImport({ url: type, context });
    if (resolvedUrl) {
      componentExports += `export { default as layout } from '${resolvedUrl}';\n`;
    }
  }

  // Extract and parse YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  let frontmatter: Record<string, unknown> = {};
  
  if (frontmatterMatch) {
    const [fullMatch, frontmatterContent] = frontmatterMatch;
    processedCode = content.slice(fullMatch.length);

    // Parse frontmatter content line by line
    frontmatter = frontmatterContent.split('\n').reduce((acc, line) => {
      const match = line.match(/^(\$?\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        try {
          // Try to parse as JSON if it looks like an object or array
          if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
            acc[key] = JSON.parse(value);
          } else {
            // Remove quotes if present
            acc[key] = value.replace(/^["'](.*)["']$/, '$1');
          }
        } catch {
          acc[key] = value;
        }
      }
      return acc;
    }, {} as Record<string, unknown>);
  }
  
  // Extract YAML-LD properties ($ prefixed)
  yamlld = Object.entries(frontmatter)
    .filter(([key]) => key.startsWith('$'))
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

  // Combine exports with content
  processedCode = `${componentExports}\n${processedCode}`;

  return {
    code: processedCode,
    frontmatter,
    metadata: {},
    yamlld
  };
}
