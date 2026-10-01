// Vite writes each page's HTML under dist/src/pages/<name>/. Move them to
// the names web.go serves.
import { renameSync, rmSync, existsSync } from 'node:fs';
const map = { mailbox: 'index.html', settings: 'config.html', template: 'template.html' };
for (const [page, out] of Object.entries(map)) {
  const from = `dist/src/pages/${page}/index.html`;
  if (existsSync(from)) renameSync(from, `dist/${out}`);
}
rmSync('dist/src', { recursive: true, force: true });
