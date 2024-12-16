# Layouts Guide

mdxe supports flexible layout system for consistent page structure.

## Using Layouts

### Basic Layout

Create a layout component:

```tsx
// layouts/default.tsx
export default function DefaultLayout({ children }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <nav className="mb-8">
        {/* Navigation content */}
      </nav>

      <main>
        {children}
      </main>

      <footer className="mt-8">
        {/* Footer content */}
      </footer>
    </div>
  )
}
```

Use in MDX:

```mdx
export const layout = 'layouts/default'

# My Page

Content will be wrapped in the default layout.
```

## Layout Configuration

### Via Configuration File

Configure layouts in `mdxe.config.js`:

```javascript
module.exports = {
  // Default layout for all MDX files
  layout: 'layouts/default',

  // Layout mappings
  layouts: {
    default: './layouts/default',
    blog: './layouts/blog',
    docs: './layouts/docs'
  }
}
```

### Via Package.json

```json
{
  "mdxe": {
    "layout": "layouts/default",
    "layouts": {
      "blog": "./layouts/blog",
      "docs": "./layouts/docs"
    }
  }
}
```

## Layout Features

### Layout Props

Layouts receive useful props:

```tsx
interface LayoutProps {
  children: React.ReactNode
  frontmatter: {
    title?: string
    description?: string
    [key: string]: any
  }
  metadata?: {
    title?: string
    description?: string
    [key: string]: any
  }
}

export default function BlogLayout({ children, frontmatter, metadata }: LayoutProps) {
  return (
    <div>
      <head>
        <title>{metadata.title || frontmatter.title}</title>
      </head>
      <main>{children}</main>
    </div>
  )
}
```

### Dynamic Layouts

Choose layouts based on frontmatter:

```mdx
---
layout: blog
title: My Blog Post
---

# Blog Content
```

```typescript
// layouts/index.ts
import DefaultLayout from './default'
import BlogLayout from './blog'
import DocsLayout from './docs'

export const layouts = {
  default: DefaultLayout,
  blog: BlogLayout,
  docs: DocsLayout
}

export function getLayout(name: string) {
  return layouts[name] || layouts.default
}
```

### Nested Layouts

Support for nested layouts:

```tsx
// layouts/blog.tsx
export default function BlogLayout({ children }) {
  return (
    <DefaultLayout>
      <div className="blog-container">
        {children}
      </div>
    </DefaultLayout>
  )
}
```

## Error Handling

### Common Issues

1. **Layout Not Found**
   ```
   Error: Layout 'blog' not found
   Solution: Check layout path and configuration
   ```

2. **Invalid Layout Export**
   ```
   Error: Layout must be a string
   Solution: Use correct layout export syntax
   ```

3. **Props Type Error**
   ```
   Error: Property 'metadata' is missing
   Solution: Check layout prop types
   ```

### Troubleshooting

1. **Layout Import Issues**
   - Verify layout path is correct
   - Check file extensions
   - Update layout configuration

2. **Layout Rendering Issues**
   - Check component hierarchy
   - Verify prop passing
   - Test with simpler layout

3. **Type Issues**
   - Update TypeScript definitions
   - Check prop interfaces
   - Verify layout exports
