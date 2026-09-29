const test = require('node:test');
const assert = require('node:assert');
const { exportToMarkdown, exportToJson, importFromJson } = require('../src/core/exporter');

test('Exporter - exportToMarkdown generates clean markdown cheat sheet', () => {
  const snippets = [
    {
      name: 'git-undo',
      title: 'Undo last commit',
      code: 'git reset --soft HEAD~1',
      language: 'bash',
      description: 'Uncommits latest change',
      tags: ['git', 'undo']
    }
  ];

  const md = exportToMarkdown(snippets);
  assert.ok(md.includes('# 📦 SnippetVault Cheat Sheet'));
  assert.ok(md.includes('### <a id="git-undo"></a>Undo last commit'));
  assert.ok(md.includes('```bash\ngit reset --soft HEAD~1\n```'));
});

test('Exporter - JSON roundtrip import & export', () => {
  const snippets = [{ id: 's1', name: 'test', code: 'echo 1', language: 'bash', tags: [] }];
  const json = exportToJson(snippets);
  const imported = importFromJson(json);

  assert.strictEqual(imported.length, 1);
  assert.strictEqual(imported[0].name, 'test');
});
