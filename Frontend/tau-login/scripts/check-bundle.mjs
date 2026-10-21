import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const manifest = JSON.parse(readFileSync(new URL('../dist/.vite/manifest.json', import.meta.url), 'utf8'));
const staticChunks = new Set();
function visit(key) {
  if (staticChunks.has(key)) return;
  staticChunks.add(key);
  for (const dependency of manifest[key].imports || []) visit(dependency);
}
visit('index.html');
assert.ok(![...staticChunks].some(key => /ReaderPage|PageEditorPage|tinymce|pdfjs/i.test(key)), 'PDF and rich-text editing must remain outside the initial dependency graph');
const cssFiles = new Set();
let javascript = 0;
let compressed = 0;
for (const key of staticChunks) {
  const chunk = manifest[key];
  const bytes = readFileSync(new URL('../dist/' + chunk.file, import.meta.url));
  javascript += bytes.length;
  compressed += gzipSync(bytes).length;
  for (const css of chunk.css || []) cssFiles.add(css);
}
const css = [...cssFiles].reduce((total, file) => total + readFileSync(new URL('../dist/' + file, import.meta.url)).length, 0);
assert.ok(javascript < 650_000, `Initial JavaScript budget exceeded: ${javascript} bytes`);
assert.ok(css < 130_000, `Initial CSS budget exceeded: ${css} bytes`);
assert.ok(Object.keys(manifest).some(key => key.endsWith('/ReaderPage.tsx')), 'PDF reader must have its own route chunk');
assert.ok(Object.keys(manifest).some(key => key.endsWith('/PageEditorPage.tsx')), 'CMS editor must have its own route chunk');
console.log(`Bundle checks passed: initial JavaScript ${javascript} bytes (${compressed} gzip), CSS ${css} bytes; PDF and CMS editor load separately.`);
