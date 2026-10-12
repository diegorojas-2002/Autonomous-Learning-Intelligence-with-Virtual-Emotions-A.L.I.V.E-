import { cp, rm } from 'node:fs/promises';
const source = new URL('../frontend/', import.meta.url);
const output = new URL('../public/', import.meta.url);
await rm(output, { recursive: true, force: true });
await cp(source, output, { recursive: true });
console.log('Frontend preparado en public/');
