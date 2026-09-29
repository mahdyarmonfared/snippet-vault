/**
 * Zero-dependency HTTP server for SnippetVault Web Studio.
 * Runs on localhost:3011 with REST API and static asset serving.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const {
  loadVault,
  addSnippet,
  getSnippet,
  updateSnippet,
  deleteSnippet,
  incrementUsage,
  searchSnippets,
  getStats,
  copyToClipboard,
  exportToMarkdown,
  exportToJson
} = require('../core');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function isPathSafe(baseDir, targetPath) {
  const resolved = path.resolve(baseDir, targetPath);
  return resolved === baseDir || resolved.startsWith(baseDir + path.sep);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) reject(new Error('Payload too large'));
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

function createServer(options = {}) {
  const uiDir = path.resolve(__dirname, '../ui');

  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // --- REST API ---

    if (pathname === '/api/snippets' && method === 'GET') {
      try {
        const q = parsedUrl.searchParams.get('q') || '';
        const tag = parsedUrl.searchParams.get('tag') || null;
        const lang = parsedUrl.searchParams.get('lang') || null;
        const fav = parsedUrl.searchParams.get('fav') === 'true';

        const snippets = searchSnippets(q, { tag, language: lang, favorite: fav });
        return sendJson(res, 200, { snippets });
      } catch (err) {
        return sendError(res, 500, err.message);
      }
    }

    if (pathname.startsWith('/api/snippets/') && method === 'GET') {
      try {
        const id = pathname.replace('/api/snippets/', '');
        const snippet = getSnippet(id);
        if (!snippet) return sendError(res, 404, 'Snippet not found');
        return sendJson(res, 200, snippet);
      } catch (err) {
        return sendError(res, 500, err.message);
      }
    }

    if (pathname === '/api/snippets' && method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const created = addSnippet(body);
        return sendJson(res, 201, { success: true, snippet: created });
      } catch (err) {
        return sendError(res, 400, err.message);
      }
    }

    if (pathname.startsWith('/api/snippets/') && method === 'PUT') {
      try {
        const id = pathname.replace('/api/snippets/', '');
        const body = await parseJsonBody(req);
        const updated = updateSnippet(id, body);
        return sendJson(res, 200, { success: true, snippet: updated });
      } catch (err) {
        return sendError(res, 400, err.message);
      }
    }

    if (pathname.startsWith('/api/snippets/') && pathname.endsWith('/copy') && method === 'POST') {
      try {
        const id = pathname.split('/')[3];
        const snippet = getSnippet(id);
        if (!snippet) return sendError(res, 404, 'Snippet not found');

        incrementUsage(id);
        const result = copyToClipboard(snippet.code);
        return sendJson(res, 200, { success: true, clipboard: result, snippet });
      } catch (err) {
        return sendError(res, 500, err.message);
      }
    }

    if (pathname.startsWith('/api/snippets/') && method === 'DELETE') {
      try {
        const id = pathname.replace('/api/snippets/', '');
        const deleted = deleteSnippet(id);
        return sendJson(res, 200, { success: true, deleted });
      } catch (err) {
        return sendError(res, 400, err.message);
      }
    }

    if (pathname === '/api/stats' && method === 'GET') {
      try {
        const stats = getStats();
        return sendJson(res, 200, stats);
      } catch (err) {
        return sendError(res, 500, err.message);
      }
    }

    if (pathname === '/api/export' && method === 'GET') {
      try {
        const format = parsedUrl.searchParams.get('format') || 'md';
        const snippets = loadVault();

        if (format === 'json') {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Content-Disposition': 'attachment; filename="snippet-vault-export.json"'
          });
          res.end(exportToJson(snippets));
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'text/markdown; charset=UTF-8',
          'Content-Disposition': 'attachment; filename="snippet-vault-cheatsheet.md"'
        });
        res.end(exportToMarkdown(snippets));
        return;
      } catch (err) {
        return sendError(res, 500, err.message);
      }
    }

    // --- STATIC ASSET SERVING ---

    if (method === 'GET') {
      let relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
      const filePath = path.resolve(uiDir, relativePath);

      if (!isPathSafe(uiDir, filePath)) {
        return sendError(res, 403, 'Forbidden');
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    sendError(res, 405, 'Method Not Allowed');
  });

  return server;
}

function startServer(port = 3011) {
  const server = createServer();
  server.listen(port, () => {
    const ansi = require('../cli/ansi');
    console.log(`\n📦 ${ansi.chalk.bold('SnippetVault Web Studio')} is live at:`);
    console.log(`   ${ansi.chalk.cyan(`http://localhost:${port}`)}\n`);
    console.log(`   Press Ctrl+C to stop the server.\n`);
  });
  return server;
}

module.exports = {
  createServer,
  startServer
};
