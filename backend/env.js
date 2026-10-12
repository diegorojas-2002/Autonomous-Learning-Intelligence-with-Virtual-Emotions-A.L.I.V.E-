import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// Variables del proceso prevalecen; .env.local prevalece sobre .env.
dotenv.config({ path: [
  fileURLToPath(new URL('../.env.local', import.meta.url)),
  fileURLToPath(new URL('../.env', import.meta.url))
], quiet: true });
