/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features for URL imports
  experimental: {
    urlImports: true,
    esmExternals: true,
  },
  // Configure allowed URL patterns for remote imports
  urlImports: {
    allowedDomains: [
      'esm.sh',
      'cdn.skypack.dev',
      'unpkg.com'
    ],
    allowedPatterns: [
      // Allow MDX UI components
      'https://esm.sh/@mdxui/**',
      'https://cdn.skypack.dev/@mdxui/**',
      'https://unpkg.com/@mdxui/**',
      // Allow MDX.org.ai types and contexts
      'https://mdx.org.ai/**'
    ]
  },
  // Configure webpack for proper ESM handling
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };
    return config;
  },
}

module.exports = nextConfig
