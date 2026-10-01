import fs from 'node:fs';
import path from 'node:path';

const files = fs.readdirSync('.', { recursive: true })
  .filter(f => typeof f === 'string' && !f.includes('node_modules') && !f.includes('dist') && !f.includes('storage') && !f.includes('.git'))
  .filter(f => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.md') || f.endsWith('.sql') || f.endsWith('.json'));

let failed = false;

for (const file of files) {
  const buf = fs.readFileSync(file);
  
  // Check BOM
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    console.error('BOM found in', file);
    failed = true;
  }
  
  // Check UTF-16 LE BOM
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    console.error('UTF-16 LE BOM found in', file);
    failed = true;
  }
  
  const text = buf.toString('utf8');
  if (text.includes('\uFFFD') || text.includes('â') || text.includes('Ã') || text.includes('Â')) {
    console.error('Mojibake / Replacement character found in', file);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('Encoding check passed.');
