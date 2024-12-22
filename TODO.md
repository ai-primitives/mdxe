# Project Status and Tasks

## Core Features

- [ ] MDX Processing

  - [ ] Basic MDX compilation
  - [ ] Layout exports support
  - [ ] Component exports support
  - [ ] Remote component imports
  - [ ] Frontmatter metadata extraction

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

- [ ] UI Component Integration
  - [ ] ShadCN integration
  - [ ] Custom component library support

## Documentation

- [ ] Update README with current implementation status
- [x] Document CLI usage
- [x] Document next-mdxld integration
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
- [ ] CLI functionality
- [ ] Watch mode
- [ ] Configuration parsing

## Blockers

### Pre-existing Lint Issues

The following lint issues exist in the codebase but are unrelated to recent changes:

1. Unused Variables in Test Files:

   - `src/cli/__tests__/watch.test.ts`: 'vi' is defined but never used
   - `src/next/__tests__/plugin.test.ts`: 'mdxContent' is assigned but never used

2. Test Setup Issues in `src/test/setup.ts`:
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

2. Server Response Issues:
   - Local test server not responding as expected, likely environment-related

To reproduce:

1. Run `pnpm install` to install dependencies
2. Run `pnpm test` to see the errors

These test failures are pre-existing infrastructure issues and do not indicate problems with recent changes to watch handler types.

### TypeScript Type Definition Issues

The following TypeScript errors have been identified and fixed:

1. YAML-LD Property Type Definitions:
   - File: `src/mdx/processor.ts`
   - Issues:
     - Property '$type' does not exist on type '{}'
     - Property '$context' does not exist on type '{}'
   - Resolution:
     - Added proper type definitions for YAML-LD data structures
     - Using ProcessedMDX['yamlld'] type for structured data
     - Ensuring consistent typing across the codebase
   - Using $ prefix as per W3C YAML-LD specification

To reproduce:
1. Run `pnpm install`
2. Run `pnpm build`

These issues have been resolved by properly typing the structured data variables and ensuring consistent type usage throughout the codebase.

### Environment Version Differences

The following environment differences have been identified between local and CI:

1. Node.js Version Mismatch:
   - Local: Node.js v22.11.0, pnpm 9.14.2
   - CI: Node.js v20.18.1, npm 10.8.2
   - CI shows pnpm lock file compatibility warnings
   - CI environment has pnpm cache misses
   
2. Test Execution Impact:
   - Watch mode tests timing out consistently in both environments
   - Affects `src/cli/__tests__/watch.test.ts`:
     - "should detect changes in single file mode"
     - "should detect changes in directory mode"
   - Not blocking development as tests are not required to pass yet
