const test = require('node:test');
const assert = require('node:assert');
const { copyToClipboard } = require('../src/core/clipboard');

test('Clipboard - copyToClipboard safely handles strings', () => {
  const result = copyToClipboard('git reset --soft HEAD~1');
  assert.strictEqual(typeof result.success, 'boolean');

  const invalidResult = copyToClipboard(null);
  assert.strictEqual(invalidResult.success, false);
});
