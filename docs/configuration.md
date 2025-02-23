# Configuration Guide

mdxe can be configured through command-line arguments, package.json, or a dedicated configuration file.

## Configuration File

Create `mdxe.config.js` in your project root:

```javascript
module.exports = {
  // Output directory for processed files
  outDir: 'dist',

  // Default layout for MDX files
  layout: 'layouts/default',

  // Component mappings
  components: {
    Button: './components/Button',
    Card: 'https://esm.sh/@acme/ui/Card'
  },

  // Style customization
  styles: {
    typography: {
      // Tailwind Typography customization
      headings: {
        fontWeight: '600',
        lineHeight: '1.25'
      },
      prose: {
        maxWidth: '65ch',
        fontSize: '1.125rem'
      }
    }
  }
}
```

## Package.json Configuration

Add an "mdxe" section to your package.json:

```json
{
  "mdxe": {
    "watch": true,
    "outDir": "dist",
    "layout": "layouts/default",
    "components": {
      "Button": "./components/Button"
    }
  }
}
```

## Command-Line Arguments

```bash
# Watch mode
mdxe --watch

# Custom output directory
mdxe --out-dir dist

# Specify layout
mdxe --layout layouts/custom

# Configuration Guide

# Help
mdxe --help
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| watch | boolean | false | Enable watch mode |
| outDir | string | 'dist' | Output directory |
| layout | string | undefined | Default layout path |
| components | object | {} | Component mappings |
| styles | object | {} | Style customization |

## Environment Variables

- `MDXE_CONFIG_PATH`: Custom config file path
- `MDXE_CACHE_DIR`: Custom cache directory for remote components
- `MDXE_DISABLE_CACHE`: Disable remote component caching

## Integration with next-mdxld

For Next.js projects, use [next-mdxld](https://github.com/ai-primitives/next-mdxld) which provides full MDX-LD support.

## App Router Metadata

Export metadata from your MDX files:

```mdx
export const metadata = {
  title: 'My Page',
  description: 'Page description',
  keywords: ['mdx', 'nextjs']
}

# Content here
```

## Troubleshooting

1. **Config Not Loading**
   - Ensure config file is in project root
   - Check file permissions
   - Verify syntax is correct

2. **Style Overrides Not Working**
   - Check style configuration syntax
   - Verify CSS variables are properly set
   - Clear browser cache

3. **Component Import Issues**
   - Verify component path is correct
   - Check network connectivity for remote imports
   - Clear component cache: `rm -rf .mdxe-cache`
