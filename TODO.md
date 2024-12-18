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

## Blockers

### Pre-existing Lint Issues

The following lint issues exist in the codebase but are unrelated to recent changes:

1. Unused Variables in Test Files:

   - `src/cli/__tests__/watch.test.ts`: 'vi' is defined but never used
   - `src/next/__tests__/plugin.test.ts`: 'mdxContent' is assigned but never used

2. Type Definition Issues in `src/types/next.ts`:

   - Unused types: 'NextConfig', 'WebpackConfig'
   - Multiple instances of 'any' type usage requiring specification

3. Test Setup Issues in `src/test/setup.ts`:
   - Unused 'fs' import
   - Undefined 'setTimeout'
   - 'any' type usage requiring specification

To reproduce:

1. Run `pnpm install` to install dependencies
2. Run `pnpm lint` to see the errors

These issues are pre-existing and do not affect the functionality of recent changes.

### Pre-existing Test Infrastructure Issues

The following test failures exist in the codebase but are unrelated to recent changes:

1. Watch Mode Test Timeouts:

   - `src/cli/__tests__/watch.test.ts`: Test timeouts in file change detection
   - Issue appears to be related to test environment setup, not watch functionality

2. Next.js Build Failures:

   - `src/next/__tests__/plugin.test.ts`: Build command failures in plugin tests
   - Errors suggest environment setup issues, not plugin functionality

3. Server Response Issues:
   - `src/next/__tests__/server.test.ts`: Server response checks failing
   - Local test server not responding as expected, likely environment-related

To reproduce:

1. Run `pnpm install` to install dependencies
2. Run `pnpm test` to see the errors

These test failures are pre-existing infrastructure issues and do not indicate problems with recent changes to watch handler types.
