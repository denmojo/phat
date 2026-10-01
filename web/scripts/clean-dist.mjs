// Removes the previous Vite build's hashed scripts and styles from dist/
// before a new build, so old hashes don't pile up in the embedded tree. The
// old webpack files (app.js, config.js, style.css and the rest) carry no
// hash and are left alone until the swap.
import { readdirSync, rmSync } from 'node:fs';

const hashed = /-[A-Za-z0-9_-]{8}\.(js|css)$/;
// Names the Vite build used before it hashed its entry files.
const legacy = ['js/mailbox.js', 'js/settings.js', 'js/templatehost.js', 'css/mailbox.css'];

for (const dir of ['js', 'css']) {
  let names = [];
  try {
    names = readdirSync(`dist/${dir}`);
  } catch {
    continue;
  }
  for (const n of names) if (hashed.test(n)) rmSync(`dist/${dir}/${n}`);
}
for (const f of legacy) rmSync(`dist/${f}`, { force: true });
