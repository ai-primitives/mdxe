# TODO

## Recently Added
- esbuild plugin support
  - Node.js support via `mdxe/esbuild`
  - Browser/Edge support via `mdxe/esbuild/wasm`
  - HTTP import support

# Project Status and Tasks

## Core Features

- [ ] MDX Processing

  - [ ] Basic MDX compilation
  - [ ] Layout exports support
  - [ ] Component exports support
  - [ ] Remote component imports
  - [ ] Frontmatter metadata extraction

- [ ] NextJS Integration

  - [ ] Plugin mode implementation
  - [ ] Standalone CLI mode
  - [ ] App Router metadata support
  - [ ] Development server (next dev)
  - [ ] Production build (next build)
  - [ ] Production server (next start)

- [ ] CLI Implementation

  - [ ] File processing
  - [ ] Directory processing
  - [ ] Watch mode
  - [ ] Configuration support
    - [ ] package.json config
    - [ ] mdxe.config.js support

- [ ] Styling
  - [ ] Tailwind Typography integration
  - [ ] Default styles
  - [ ] Custom style overrides

## Documentation

- [x] Update README with new features
- [x] Document CLI usage
- [x] Document NextJS integration
- [ ] Add examples
  - [ ] Basic MDX processing
  - [ ] Layout usage
  - [ ] Component exports
  - [ ] Remote imports
  - [ ] Configuration

## Testing

- [ ] Core MDX processing
  - [ ] Test environment setup
    - [ ] TypeScript configuration
    - [ ] Vitest mock types
    - [ ] Global declarations
  - [ ] Remote component fetching
  - [ ] Cache implementation
- [ ] NextJS integration
- [ ] CLI functionality
- [ ] Watch mode
- [ ] Configuration parsing
