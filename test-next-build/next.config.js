
        import createMDXPlugin from '@next/mdx'
        import { withMDXE } from '/home/ubuntu/repos/mdxe/dist/index.js'

        /** @type {import('next').NextConfig} */
        const baseConfig = {
          pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
          experimental: {
            webpackBuildWorker: true
          }
        }

        const withMDX = createMDXPlugin({
          options: {
            remarkPlugins: [],
            rehypePlugins: []
          }
        })

        const nextConfig = withMDX(baseConfig)

        export default nextConfig
      