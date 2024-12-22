# mdxe - Zero-Config Executable MDX

[![npm version](https://badge.fury.io/js/mdxe.svg)](https://www.npmjs.com/package/mdxe)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Zero-config MDX processor with standalone CLI mode. For Next.js integration, please use [next-mdxld](https://github.com/ai-primitives/next-mdxld). Currently in active development.

## Features

Current and Planned Features:

- 🚀 Zero-config MDX processing (in development)
- 📦 Layout and component exports (in development)
- 🎨 Default Tailwind Typography styling (in development)
- 🔄 File watching and hot reload (in development)
- 🌐 Remote component imports (esm.sh) (in development)
- 🤖 AI-powered content generation (planned)

## Installation

```bash
pnpm add mdxe
```

## Usage

### CLI Mode (In Development)

```bash
# Process single file
mdxe myfile.mdx

# Process directory
mdxe ./content

# Watch mode
mdxe --watch
```

### MDX Exports (In Development)

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

## AI Generation (Planned)

Generate components, pages, and complete sites using AI:

```typescript
import { generateMDX } from 'mdxe/ai'

const stream = await generateMDX({
  type: 'https://mdx.org.ai/Component',
  component: 'Button',
  content: 'Primary action button',
})

// Note: ShadCN and other UI component library integrations are planned for future releases.
```

See [AI Generation](./docs/ai-generation.md) for complete documentation.

## Development

```bash
# Remove everything that could cause issues
rm -rf dist node_modules
pnpm unlink --global

# Fresh install
pnpm install

# Build
pnpm build

# Link globally
pnpm link --global

# Test
mdxe --version
```

## License

MIT © [AI Primitives](https://mdx.org.ai)
