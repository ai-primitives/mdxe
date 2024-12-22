#!/usr/bin/env node

import { cli } from '../dist/index.js';

cli().catch((error) => {
  console.error(error);
  process.exit(1);
});
