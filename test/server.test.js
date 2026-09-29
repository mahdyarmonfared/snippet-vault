const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createServer } = require('../src/server/server');
const { getDefaultVaultPath } = require('../src/core/vault');

function makeRequest(server, method, reqPath, body = null) {
  const addr = server.address();
  const port = addr.port;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port,
      path: reqPath,
      method,
      headers: {}
    };

    if (body) {
      options.headers['Content-Type'] = 'application/json';
    }

    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {}
        resolve({ statusCode: res.statusCode, headers: res.headers, raw: data, json });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

test('Server - API endpoints & static file serving', async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, resolve));

  try {
    // 1. GET /api/snippets
    const snippetsRes = await makeRequest(server, 'GET', '/api/snippets');
    assert.strictEqual(snippetsRes.statusCode, 200);
    assert.ok(Array.isArray(snippetsRes.json.snippets));

    // 2. POST /api/snippets
    const createRes = await makeRequest(server, 'POST', '/api/snippets', {
      name: 'api-test-snip-' + Date.now(),
      code: 'echo "hello from api"',
      language: 'bash',
      tags: ['api', 'test']
    });
    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.json.success, true);
    const createdId = createRes.json.snippet.id;

    // 3. PUT /api/snippets/:id
    const updateRes = await makeRequest(server, 'PUT', `/api/snippets/${createdId}`, {
      description: 'Updated via REST API'
    });
    assert.strictEqual(updateRes.statusCode, 200);
    assert.strictEqual(updateRes.json.snippet.description, 'Updated via REST API');

    // 4. POST /api/snippets/:id/copy
    const copyRes = await makeRequest(server, 'POST', `/api/snippets/${createdId}/copy`);
    assert.strictEqual(copyRes.statusCode, 200);
    assert.strictEqual(copyRes.json.success, true);

    // 5. DELETE /api/snippets/:id
    const deleteRes = await makeRequest(server, 'DELETE', `/api/snippets/${createdId}`);
    assert.strictEqual(deleteRes.statusCode, 200);

    // 6. GET /api/stats
    const statsRes = await makeRequest(server, 'GET', '/api/stats');
    assert.strictEqual(statsRes.statusCode, 200);
    assert.ok(typeof statsRes.json.totalSnippets === 'number');

    // 7. Static HTML serving
    const htmlRes = await makeRequest(server, 'GET', '/');
    assert.strictEqual(htmlRes.statusCode, 200);
    assert.ok(htmlRes.raw.includes('SnippetVault'));

    // 8. Static CSS serving
    const cssRes = await makeRequest(server, 'GET', '/style.css');
    assert.strictEqual(cssRes.statusCode, 200);

    // 9. Static JS serving
    const jsRes = await makeRequest(server, 'GET', '/app.js');
    assert.strictEqual(jsRes.statusCode, 200);

  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
