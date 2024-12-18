# mdxe - Zero-Config Executable MDX

[![npm version](https://badge.fury.io/js/mdxe.svg)](https://www.npmjs.com/package/mdxe)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Zero-config MDX processor with NextJS integration, supporting both standalone CLI and plugin modes.

## Features

- 🚀 Zero-config MDX processing
- ⚡️ NextJS integration (plugin & standalone)
- 📦 Layout and component exports
- 🎨 Default Tailwind Typography styling
- 🔄 File watching and hot reload
- 📝 App Router metadata support
- 🌐 Remote component imports (esm.sh)
- 🤖 AI-powered content generation

## Installation

```bash
pnpm add mdxe
```

## Usage

### CLI Mode

```bash
# Process single file
mdxe myfile.mdx

# Process directory
mdxe ./content

# Watch mode with NextJS
mdxe dev
```

### NextJS Plugin

```javascript
// next.config.js
import { withMDXE } from 'mdxe/next'

export default withMDXE({
  // your next.js config
})
```

### MDX Exports

```mdx
export const layout = './layouts/BlogPost'
export const components = {
  Button: './components/Button',
}

# My Content
```

## Configuration

Configure via package.json:

```json
{
  "mdxe": {
    "layouts": "./layouts",
    "components": "./components"
  }
}
```

Or mdxe.config.js:

```javascript
export default {
  layouts: './layouts',
  components: './components',
}
```

## AI Generation

Generate components, pages, and complete sites using AI:

```typescript
import { generateMDX } from 'mdxe/ai'

const stream = await generateMDX({
  type: 'https://mdx.org.ai/Component',
  component: 'Button',
  content: 'Primary action button',
})

// Note: ShadCN component integration is planned for a future release.
```

See [AI Generation](./docs/ai-generation.md) for complete documentation.

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build the package
pnpm build

# Format code
pnpm format
```

## License

MIT © [AI Primitives](https://mdx.org.ai)
