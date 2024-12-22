#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { main } from '../dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
