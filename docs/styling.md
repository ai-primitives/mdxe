# Styling Guide

mdxe comes with built-in support for Tailwind Typography, providing beautiful typographic defaults out of the box.

## Default Styling

By default, mdxe applies Tailwind Typography's prose classes to your MDX content:

```mdx
# My Document

This content will automatically receive Tailwind Typography styling.

- Lists are properly styled
- With consistent spacing
- And appropriate markers
```

## Customizing Typography

### Via Configuration File

Create or update `mdxe.config.js`:

```javascript
module.exports = {
  styles: {
    typography: {
      // Customize default styles
      headings: {
        fontWeight: '600',
        color: '#111827',
        lineHeight: '1.25'
      },
      // Customize prose settings
      prose: {
        maxWidth: '65ch',
        fontSize: '1.125rem',
        lineHeight: '1.75'
      },
      // Custom colors
      colors: {
        primary: '#3B82F6',
        secondary: '#10B981'
      }
    }
  }
}
```

### Via CSS Variables

Create a custom CSS file:

```css
:root {
  --mdxe-heading-font-weight: 600;
  --mdxe-heading-color: #111827;
  --mdxe-prose-max-width: 65ch;
  --mdxe-prose-font-size: 1.125rem;
  --mdxe-primary-color: #3B82F6;
  --mdxe-secondary-color: #10B981;
}
```

## Style Customization Options

### Typography Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| fontWeight | string | '400' | Base font weight |
| fontSize | string | '1rem' | Base font size |
| lineHeight | string | '1.5' | Base line height |
| maxWidth | string | '65ch' | Content max width |

### Color Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| primary | string | '#3B82F6' | Primary theme color |
| secondary | string | '#10B981' | Secondary theme color |
| text | string | '#111827' | Main text color |
| background | string | '#FFFFFF' | Background color |

### Element-Specific Options

```javascript
module.exports = {
  styles: {
    typography: {
      elements: {
        h1: {
          fontSize: '2.5rem',
          marginBottom: '1rem'
        },
        p: {
          marginBottom: '1.5rem',
          lineHeight: '1.75'
        },
        blockquote: {
          borderLeftColor: 'var(--mdxe-primary-color)',
          fontStyle: 'italic'
        }
      }
    }
  }
}
```

## Dark Mode Support

mdxe automatically supports dark mode when using Tailwind's dark mode feature:

```javascript
module.exports = {
  styles: {
    typography: {
      dark: {
        prose: {
          color: '#E5E7EB',
          headings: {
            color: '#F3F4F6'
          }
        }
      }
    }
  }
}
```

## Troubleshooting

1. **Styles Not Applying**
   - Verify Tailwind Typography is properly installed
   - Check CSS import order
   - Clear browser cache

2. **Custom Styles Not Working**
   - Verify configuration syntax
   - Check CSS variable names
   - Ensure styles are more specific than defaults

3. **Dark Mode Issues**
   - Verify dark mode configuration
   - Check media query support
   - Test with browser dev tools
