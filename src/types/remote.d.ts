interface RemoteImportOptions {
  url: string;
  context?: string;
}

interface RemoteImportResult {
  layout?: string;
  components?: Record<string, string>;
}

export { RemoteImportOptions, RemoteImportResult };
