#!/usr/bin/env node
// Petit serveur statique local pour prévisualiser les rapports (aucune dépendance).
// Usage : node scripts/serve.mjs [dossier] [--port 4173]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const portIdx = args.indexOf('--port');
const port = portIdx >= 0 ? Number(args[portIdx + 1]) : 4173;
const root = path.resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--port') || '.');
const types = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' };

http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(root, rel);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    const list = fs.readdirSync(file).filter((f) => f.endsWith('.html'));
    res.writeHead(200, { 'content-type': types['.html'] });
    res.end(`<meta charset="utf-8"><title>Rapports</title><ul>${list.map((f) => `<li><a href="${encodeURIComponent(f)}">${f}</a></li>`).join('')}</ul>`);
    return;
  }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('Introuvable'); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(port, '127.0.0.1', () => console.log(`Rapports servis sur http://localhost:${port}/ (dossier ${root})`));
