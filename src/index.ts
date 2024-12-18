import type { NextConfig } from 'next'
import type { Configuration as WebpackConfig, RuleSetRule } from 'webpack'
import type { WebpackConfigContext } from './types/next.js'

export const withMDXE = (config: NextConfig = {}): NextConfig => ({
  ...config,
  webpack: (webpackConfig: WebpackConfig, options: WebpackConfigContext): WebpackConfig => {
    // Initialize webpack config if needed
    const configuration = webpackConfig as WebpackConfig & {
      module: { rules: RuleSetRule[] }
    }

    if (!configuration.module) {
      configuration.module = { rules: [] }
    }
    if (!configuration.module.rules) {
      configuration.module.rules = []
    }

    // Apply existing webpack config if any
    if (typeof config.webpack === 'function') {
      const result = config.webpack(configuration, options)
      if (result) {
        Object.assign(configuration, result)
      }
    }

    // Add MDX loader
    configuration.module.rules.push({
      test: /\.mdx?$/,
      use: [
        {
          loader: options.defaultLoaders.babel.loader,
          options: options.defaultLoaders.babel.options,
        },
        {
          loader: '@mdx-js/loader',
          options: {
            providerImportSource: '@mdx-js/react',
          },
        },
      ],
    })

    return configuration
  },
})

export default { withMDXE }
