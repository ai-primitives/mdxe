import { createMDXPage, generateMetadata as generateMDXMetadata } from 'next-mdxld'
import { join } from 'path'

const contentDir = join(process.cwd(), 'content')
const mdxPage = createMDXPage({
  contentDir,
})

// Configure generateMetadata with contentDir
export const generateMetadata = ({ params }: { params: { mdxPath?: string[] } }) => generateMDXMetadata({ params }, contentDir)

export default mdxPage
