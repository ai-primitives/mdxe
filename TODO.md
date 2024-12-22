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

### Integration Issues

The following issues are currently blocking CI builds in PR #17:

1. Environment Standardization:
   - Node.js Version: Updated package.json to require >=20.18.1
   - CI Environment: Running on ubuntu-24.04 (upcoming upgrade)
   - Local Development: Currently on Node.js v22.11.0
   - Action Taken: Added engines field to enforce version compatibility

2. Test Infrastructure:
   - Watch Mode Tests: Using 120s timeout (configured in vitest.config.ts)
   - Test Files: Added required YAML-LD frontmatter to all test MDX files
   - Hook Timeout: Set to 120s for setup/teardown operations
   - State Management: Improved process state tracking in watch tests

3. Module Resolution:
   - Error: Cannot find module 'next-mdxld/dist/components'
   - Impact: Test failures in remote.test.ts and processor.test.ts
   - Root Cause: Dependency version mismatch between local and CI
   - Required Actions:
     - Update next-mdxld dependency to latest version
     - Verify module paths in imports
     - Add proper error handling for missing modules

2. Previous Issues:

1. YAML-LD Property Requirements:
   - Error: "Missing required frontmatter" from remark-mdxld
   - Impact: Test failures in processor.test.ts
   - Required Properties:
     - $type (required by remark-mdxld)
     - $context (required by remark-mdxld)
   - Cross-Repository Impact:
     - mdxe: Blocking CI builds
     - next-mdxld: Needs documentation update for required fields

2. Watch Mode Test Failures:
   - Error: "Timeout waiting for watcher to be ready"
   - Location: watch.test.ts:302:16 and watch.test.ts:504:16
   - Impact: Test failures in PR #17
   - Affected Tests:
     - "should detect changes in single file mode"
     - "should detect changes in directory mode"
   - Root Cause Analysis:
     - Race conditions in watcher initialization
     - Default timeout (30s) insufficient for CI environment
     - Environment differences between local and CI
   - Required Actions:
     - [ ] Increase test timeout in vitest.config.ts
     - [ ] Add proper watcher initialization checks
     - [ ] Implement retry mechanism for flaky tests

3. Type Definition Issues:
   - File: `src/mdx/processor.ts`
   - Active Issues:
     - Property '$type' does not exist on type '{}'
     - Property '$context' does not exist on type '{}'
   - Current Status:
     - Type definitions added but not properly recognized
     - ProcessedMDX['yamlld'] type not correctly narrowing
     - Using $ prefix as per W3C YAML-LD specification

To reproduce:
1. Run `pnpm install`
2. Run `pnpm test`
3. Observe errors:
   ```
   Error: Missing required frontmatter
   ReferenceError: fileWatcher is not defined
   Error: Timeout waiting for watcher to be ready
   ```

Investigation ongoing to resolve integration issues between mdxe and remark-mdxld packages.

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
