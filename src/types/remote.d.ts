import type { ReactElement } from 'react'

export interface RemoteImportOptions {
  url: string
  version?: string
  context?: string
  components?: {
    path?: string
    props?: Record<string, unknown>
  }
  layout?: {
    path?: string
    props?: Record<string, unknown>
  }
}

export interface RemoteImportResult {
  url?: string
  components?: Record<string, () => ReactElement>
  componentStrings?: Record<string, string>
  layout?: () => ReactElement
  layoutString?: string
}
