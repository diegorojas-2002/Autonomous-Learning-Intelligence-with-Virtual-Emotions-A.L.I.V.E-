import { cp, rm, mkdir } from 'node:fs/promises';
const source = new URL('../frontend/', import.meta.url);
const output = new URL('../public/', import.meta.url);
// Keep the locally served tokenizer in sync with the lockfile. No CDN at runtime.
await mkdir(new URL('vendor/', source), { recursive: true });
await cp(new URL('../node_modules/marked/lib/marked.umd.js', import.meta.url), new URL('vendor/marked.umd.js', source));
await cp(new URL('../node_modules/marked/LICENSE', import.meta.url), new URL('vendor/marked.LICENSE', source));
await rm(output, { recursive: true, force: true });
await cp(source, output, { recursive: true });
console.log('Frontend preparado en public/');
