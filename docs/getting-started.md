# Getting Started with mdxe

mdxe is a Zero-Config Executable MDX CLI built on NextJS, providing seamless MDX processing with built-in support for layouts, components, and Tailwind Typography.

## Installation

```bash
npm install -g mdxe
# or
pnpm add -g mdxe
# or
yarn global add mdxe
```

## Quick Start

1. Create an MDX file:

```mdx
---
title: My First MDX Page
description: Getting started with mdxe
---

# Hello MDX!

This is my first MDX page using mdxe.
```

2. Process the file:

```bash
mdxe myfile.mdx
```

## Watch Mode

Enable watch mode to automatically process files when they change:

```bash
mdxe --watch myfile.mdx
# or for a directory
mdxe --watch content/
```

## NextJS Integration

mdxe works seamlessly with NextJS:

```bash
# Start development server
mdxe --next .

# Build for production
mdxe --next . --build

# Start production server
mdxe --next . --start
```

## Features

- Zero configuration required
- Built-in Tailwind Typography styling
- Support for layouts and components
- Remote component imports from esm.sh
- NextJS App Router metadata support
- File watching and hot reload
- Directory processing

## Error Handling

Common errors and solutions:

1. **Missing Layout**: If a layout is specified but not found:
   ```
   Error: Layout not found: layouts/default
   Solution: Create the layout file or update the layout path
   ```

2. **Invalid MDX**: When MDX syntax is incorrect:
   ```
   Error: Invalid MDX content
   Solution: Check your MDX syntax and fix any formatting issues
   ```

3. **Component Import Failed**: When remote component import fails:
   ```
   Error: Failed to fetch component from esm.sh
   Solution: Check your internet connection and component URL
   ```

## Next Steps

- Read the [Configuration Guide](./configuration.md) for customization options
- Learn about [Styling](./styling.md) with Tailwind Typography
- Explore [Components](./components.md) and [Layouts](./layouts.md)
