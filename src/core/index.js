/**
 * SnippetVault Core API Entry Point
 */

const vault = require('./vault');
const clipboard = require('./clipboard');
const exporter = require('./exporter');

module.exports = {
  ...vault,
  ...clipboard,
  ...exporter
};
