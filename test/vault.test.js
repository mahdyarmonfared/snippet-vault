const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  loadVault,
  saveVault,
  addSnippet,
  getSnippet,
  updateSnippet,
  deleteSnippet,
  searchSnippets,
  detectLanguage,
  getStats
} = require('../src/core/vault');

function getTmpVaultFile() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snip-test-'));
  return path.join(tmpDir, 'snippets.json');
}

test('Vault - detectLanguage identifies language signatures', () => {
  assert.strictEqual(detectLanguage('git-undo', 'git reset --soft HEAD~1', ['git']), 'bash');
  assert.strictEqual(detectLanguage('select-users', 'SELECT * FROM users JOIN orders ON users.id = orders.user_id;'), 'sql');
  assert.strictEqual(detectLanguage('async-fn', 'const foo = async () => await bar();'), 'javascript');
  assert.strictEqual(detectLanguage('py-script', 'def hello():\n    print("world")'), 'python');
  assert.strictEqual(detectLanguage('docker-build', 'FROM node:18\nRUN npm install'), 'docker');
});

test('Vault - CRUD operations work as expected', () => {
  const vaultPath = getTmpVaultFile();

  // 1. Add
  const created = addSnippet({
    name: 'test-snippet',
    code: 'echo "hello"',
    description: 'A test command',
    tags: ['test', 'demo']
  }, vaultPath);

  assert.ok(created.id.startsWith('snip-'));
  assert.strictEqual(created.name, 'test-snippet');
  assert.strictEqual(created.language, 'bash');

  // 2. Get
  const fetched = getSnippet('test-snippet', vaultPath);
  assert.strictEqual(fetched.id, created.id);
  assert.strictEqual(fetched.code, 'echo "hello"');

  // 3. Update
  const updated = updateSnippet('test-snippet', {
    description: 'Updated description',
    favorite: true
  }, vaultPath);
  assert.strictEqual(updated.description, 'Updated description');
  assert.strictEqual(updated.favorite, true);

  // 4. Search
  const searchResults = searchSnippets('demo', {}, vaultPath);
  assert.strictEqual(searchResults.length, 1);
  assert.strictEqual(searchResults[0].name, 'test-snippet');

  // 5. Duplicate name error
  assert.throws(() => {
    addSnippet({ name: 'test-snippet', code: 'echo 1' }, vaultPath);
  }, /already exists/);

  // 6. Delete
  const deleted = deleteSnippet('test-snippet', vaultPath);
  assert.strictEqual(deleted.id, created.id);
  assert.strictEqual(getSnippet('test-snippet', vaultPath), null);

  fs.rmSync(path.dirname(vaultPath), { recursive: true, force: true });
});

test('Vault - getStats computes correct aggregated metrics', () => {
  const vaultPath = getTmpVaultFile();
  saveVault([], vaultPath);

  addSnippet({ name: 'snip1', code: 'git pull', tags: ['git', 'cli'] }, vaultPath);
  addSnippet({ name: 'snip2', code: 'SELECT 1;', tags: ['sql', 'cli'], favorite: true }, vaultPath);

  const stats = getStats(vaultPath);
  assert.strictEqual(stats.totalSnippets, 2);
  assert.strictEqual(stats.favoriteCount, 1);
  assert.strictEqual(stats.languages.bash, 1);
  assert.strictEqual(stats.languages.sql, 1);
  assert.strictEqual(stats.tags.cli, 2);

  fs.rmSync(path.dirname(vaultPath), { recursive: true, force: true });
});
