import type { LoaderContext } from 'webpack'
import matter from 'gray-matter'

export default function mdxMetadataLoader(this: LoaderContext<{ [key: string]: unknown }>, source: string): string {
  const { data: frontmatter } = matter(source)
  const metadata = {
    ...(frontmatter.title ? { title: frontmatter.title } : {}),
    ...(frontmatter.description ? { description: frontmatter.description } : {}),
    ...(frontmatter.keywords ? { keywords: Array.isArray(frontmatter.keywords) ? frontmatter.keywords : [frontmatter.keywords] } : {}),
    ...Object.fromEntries(Object.entries(frontmatter).filter(([key]) => key.startsWith('$') || key.startsWith('@'))),
  }
  return `${source}\nexport const metadata = ${JSON.stringify(metadata, null, 2)}`
}
