const { withMDXE } = require('../../dist')

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    mdxRs: true,
    webpackBuildWorker: true
  }
}

module.exports = withMDXE(nextConfig, {
  mdx: {
    remarkPlugins: [],
    rehypePlugins: []
  }
})
