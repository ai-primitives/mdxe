export interface MDXProcessorOptions {
  filepath: string;
  content?: string;
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
  // Temporary implementation that returns dummy data
  return {
    code: options.content || '',
    frontmatter: {},
    metadata: {}
  };
}
