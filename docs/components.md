# Components Guide

mdxe provides a flexible component system that supports both local and remote components.

## Using Components

### Local Components

Create a local component:

```tsx
// components/Button.tsx
export default function Button({ children }) {
  return (
    <button className="px-4 py-2 bg-blue-500 text-white rounded">
      {children}
    </button>
  )
}
```

Use in MDX:

```mdx
import Button from './components/Button'

# My Page

<Button>Click me!</Button>
```

### Remote Components

Import components from esm.sh:

```mdx
import { Button } from 'https://esm.sh/@acme/ui'

# My Page

<Button variant="primary">Remote Button</Button>
```

## Component Configuration

### Via Configuration File

Configure components in `mdxe.config.js`:

```javascript
module.exports = {
  components: {
    // Local components
    Button: './components/Button',
    Card: './components/Card',

    // Remote components
    Alert: 'https://esm.sh/@acme/ui/Alert',
    Modal: 'https://esm.sh/@acme/ui/Modal'
  }
}
```

### Via Package.json

```json
{
  "mdxe": {
    "components": {
      "Button": "./components/Button",
      "Alert": "https://esm.sh/@acme/ui/Alert"
    }
  }
}
```

## Component Features

### Auto-imports

Components configured in mdxe.config.js are automatically available:

```mdx
# No import needed!

<Button>Click me!</Button>
<Alert type="info">Important message</Alert>
```

### Remote Component Caching

Remote components are cached for 24 hours by default:

```javascript
module.exports = {
  components: {
    // Custom cache duration (in seconds)
    cacheTimeout: 86400,

    // Cache directory
    cacheDir: '.mdxe-cache'
  }
}
```

### TypeScript Support

mdxe fully supports TypeScript components:

```tsx
// components/Button.tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary'
  children: React.ReactNode
}

export default function Button({ variant = 'primary', children }: ButtonProps) {
  return (
    <button className={`btn btn-${variant}`}>
      {children}
    </button>
  )
}
```

## Error Handling

### Common Issues

1. **Component Not Found**
   ```
   Error: Component 'Button' not found
   Solution: Check component path and configuration
   ```

2. **Remote Import Failed**
   ```
   Error: Failed to fetch from esm.sh
   Solution: Check internet connection and URL
   ```

3. **Type Errors**
   ```
   Error: Type 'string' is not assignable to type 'number'
   Solution: Check component prop types
   ```

### Troubleshooting

1. **Component Import Issues**
   - Verify component path is correct
   - Check network connectivity
   - Clear component cache

2. **Type Errors**
   - Check TypeScript configuration
   - Verify prop types match usage
   - Update component definitions

3. **Cache Issues**
   - Clear cache directory
   - Check cache configuration
   - Verify file permissions
