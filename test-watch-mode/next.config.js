const { withMDXE } = require('../../dist')

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    mdxRs: true
  },
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx']
}

module.exports = withMDXE({
  ...nextConfig,
  mdx: {
    remarkPlugins: [],
    rehypePlugins: [],
    providerImportSource: '@mdx-js/react'
  }
})
    
    
    
    
    
    
    
    
    
    
    
    
    
    