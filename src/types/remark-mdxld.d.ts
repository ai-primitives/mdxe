declare module 'remark-mdxld' {
  import { Plugin } from 'unified'
  import { Root } from 'mdast'

  interface YAMLLDData {
    $type?: string
    $id?: string
    $context?: string | Record<string, unknown>
    [key: string]: unknown
  }

  interface MDXLDData {
    frontmatter?: Record<string, unknown>
    yamlld?: YAMLLDData
    components?: Record<string, string>
    layout?: string
    structured?: YAMLLDData
    executable?: Record<string, string>
  }

  interface RemarkMdxldOptions {
    context?: string
    type?: string
    yamlld?: boolean
    prefixes?: string[]
    components?: boolean
    layouts?: boolean
    structured?: boolean
    executable?: boolean
  }

  interface RemarkMdxldResult {
    data?: {
      mdxld?: MDXLDData
    }
  }

  const remarkMdxld: Plugin<[RemarkMdxldOptions?], Root, RemarkMdxldResult>
  export default remarkMdxld
}
