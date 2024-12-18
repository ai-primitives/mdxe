# AI Generation

Zero-config AI-powered generation of MDX content using mdxai integration.

## Components

Generate ShadCN/Tailwind components:

```typescript
import { generateMDX } from 'mdxe/ai'

// Generate a button component
const stream = await generateMDX({
  type: 'https://mdx.org.ai/Component',
  component: 'Button',
  props: {
    variant: 'primary',
    size: 'lg'
  }
})

// Generate a card component
const stream = await generateMDX({
  type: 'https://mdx.org.ai/Component',
  component: 'Card',
  content: 'Product showcase with image, title, and description'
})
```

All components are automatically imported from @mdxui/shadcn.

## Pages

Generate complete pages:

```typescript
const stream = await generateMDX({
  type: 'https://mdx.org.ai/Page',
  content: 'Landing page for SaaS product',
  components: ['Hero', 'Features', 'Pricing', 'CTA']
})
```

## Sites

Generate complete sites:

```typescript
const stream = await generateMDX({
  type: 'https://mdx.org.ai/Site',
  content: 'E-commerce site for handmade jewelry',
  pages: ['Home', 'Products', 'About', 'Contact']
})
```

## Documentation

Generate documentation:

```typescript
const stream = await generateMDX({
  type: 'https://mdx.org.ai/Documentation',
  content: './src/**/*.ts', // Source files to document
  components: ['CodeBlock', 'ApiReference', 'Examples']
})
```

## Blogs

Generate blog infrastructure:

```typescript
const stream = await generateMDX({
  type: 'https://mdx.org.ai/Blog',
  content: 'Technical blog about web development',
  components: ['BlogPost', 'AuthorBio', 'TableOfContents']
})
```

## Blog Posts

Generate individual blog posts:

```typescript
const stream = await generateMDX({
  type: 'https://schema.org/BlogPosting',
  content: 'How to use React Server Components',
  components: ['CodeBlock', 'InlineCode', 'Callout']
})
```
