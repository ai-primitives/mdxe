export default {
  logo: <span>MDXE Docs Example</span>,
  project: {
    link: 'https://github.com/ai-primitives/mdxe'
  },
  docsRepositoryBase: 'https://github.com/ai-primitives/mdxe/tree/main/examples/docs',
  useNextSeoProps() {
    return {
      titleTemplate: '%s – MDXE Docs Example'
    }
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="description" content="MDXE Docs Example - Single page documentation site" />
    </>
  ),
  editLink: {
    text: 'Edit this page on GitHub'
  },
  feedback: {
    content: null
  },
  footer: {
    text: 'MIT 2023 © AI Primitives'
  }
}
