/** @type {import('mdxe').MDXEConfig} */
module.exports = {
  // MDX compilation options
  mdxOptions: {
    remarkPlugins: [],
    rehypePlugins: []
  },

  // Watch mode configuration
  watch: {
    enabled: true,
    ignore: ['**/node_modules/**', '**/.git/**']
  },

  // Component import configuration
  imports: {
    baseUrl: 'https://esm.sh/',
    aliases: {
      'react-icons': 'react-icons@4.11.0'
    }
  },

  // Style configuration
  styles: {
    contentWidth: '70ch',
    variables: {
      '--mdxe-heading-color': '#1a202c',
      '--mdxe-link-color': '#3182ce'
    },
    additionalClasses: ['dark:prose-invert']
  }
}
