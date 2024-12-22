# Styling Guide

mdxe provides a comprehensive styling system that combines Tailwind Typography with customizable CSS variables and Next.js integration.

## Default Styling

By default, mdxe applies Tailwind Typography's prose classes to your MDX content:

```mdx
# My Document

This content will automatically receive Tailwind Typography styling.

- Lists are properly styled
- With consistent spacing
- And appropriate markers
```

## Next.js Integration

For Next.js integration, please use [next-mdxld](https://github.com/ai-primitives/next-mdxld).

### Style Configuration

Create your styles (`app/styles/mdx.css`):

```css
:root {
  /* Colors */
  --mdxe-primary-color: #3b82f6;
  --mdxe-text-color: #1f2937;
  --mdxe-heading-color: #111827;
  --mdxe-link-color: #2563eb;
  --mdxe-code-bg: #f3f4f6;

  /* Typography */
  --mdxe-heading-font: system-ui, -apple-system, sans-serif;
  --mdxe-body-font: system-ui, -apple-system, sans-serif;
  --mdxe-code-font: 'Fira Code', monospace;

  /* Spacing */
  --mdxe-content-width: 65ch;
  --mdxe-spacing-y: 1.5rem;
}

.mdxe-content {
  width: 100%;
  max-width: var(--mdxe-content-width);
  margin: 0 auto;
  padding: 2rem;
  color: var(--mdxe-text-color);
  font-family: var(--mdxe-body-font);
}

.mdxe-content h1,
.mdxe-content h2,
.mdxe-content h3 {
  font-family: var(--mdxe-heading-font);
  color: var(--mdxe-heading-color);
  margin-bottom: var(--mdxe-spacing-y);
}

.mdxe-content code {
  background-color: var(--mdxe-code-bg);
  font-family: var(--mdxe-code-font);
  padding: 0.2em 0.4em;
  border-radius: 0.25rem;
}
```

Import styles in your app (`app/layout.tsx`):

```tsx
import './styles/mdx.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

## Real-World Examples

### Basic MDX Page

```mdx
// app/page.mdx
---
title: Welcome
---

# Welcome to My Site

This is a basic MDX page with custom styling.

## Features

- Automatic Tailwind Typography
- Custom CSS Variables
- Component Integration
```

### Custom Component Integration

```tsx
// components/Button.tsx
export default function Button({ children }) {
  return (
    <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
      {children}
    </button>
  )
}
```

```mdx
// app/about/page.mdx
import Button from '../components/Button'

# About Us

Click below to learn more:

<Button>Learn More</Button>
```

## Configuration Options

### Style Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| styleOverrides | boolean | false | Enable CSS variable customization |
| contentWidth | string | '65ch' | Maximum content width |
| customComponents | object | {} | Component mapping configuration |

### CSS Variables

| Variable | Default | Description |
|----------|---------|-------------|
| --mdxe-primary-color | #3b82f6 | Primary theme color |
| --mdxe-text-color | #1f2937 | Main text color |
| --mdxe-heading-color | #111827 | Heading color |
| --mdxe-link-color | #2563eb | Link color |
| --mdxe-code-bg | #f3f4f6 | Code block background |
| --mdxe-heading-font | system-ui | Heading font family |
| --mdxe-body-font | system-ui | Body text font family |
| --mdxe-code-font | 'Fira Code' | Code font family |
| --mdxe-content-width | 65ch | Content max width |
| --mdxe-spacing-y | 1.5rem | Vertical spacing |

## Dark Mode

Enable dark mode support:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --mdxe-primary-color: #60a5fa;
    --mdxe-text-color: #e5e7eb;
    --mdxe-heading-color: #f3f4f6;
    --mdxe-link-color: #93c5fd;
    --mdxe-code-bg: #1f2937;
  }
}
```

## Troubleshooting

### Common Issues

1. **Custom Components Not Loading**
   - Verify component paths in mdxe config
   - Check component export/import syntax
   - Ensure components are in correct directory

3. **CSS Variables Not Working**
   - Check CSS import order
   - Verify variable names match documentation
   - Inspect CSS specificity

4. **Build Errors**
   - Update to latest mdxe version
   - Check Next.js compatibility
   - Verify all dependencies installed

For more examples and advanced configurations, check the [examples directory](../examples/styling/).
