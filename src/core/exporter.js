/**
 * Export and Import helper for Markdown & JSON formats.
 */

function exportToMarkdown(snippets) {
  let md = `# 📦 SnippetVault Cheat Sheet\n\n`;
  md += `*Exported on ${new Date().toISOString().split('T')[0]} &bull; Total Snippets: ${snippets.length}*\n\n`;

  md += `## Table of Contents\n\n`;
  for (const s of snippets) {
    md += `- [${s.title || s.name}](#${s.name.toLowerCase().replace(/[^a-z0-9-]/g, '')}) \`${s.language}\`\n`;
  }
  md += `\n---\n\n`;

  for (const s of snippets) {
    const anchor = s.name.toLowerCase().replace(/[^a-z0-9-]/g, '');
    md += `### <a id="${anchor}"></a>${s.title || s.name}\n\n`;
    if (s.description) {
      md += `${s.description}\n\n`;
    }
    if (s.tags && s.tags.length > 0) {
      md += `**Tags:** ${s.tags.map(t => `\`#${t}\``).join(' ')}\n\n`;
    }
    md += `\`\`\`${s.language || 'text'}\n${s.code}\n\`\`\`\n\n`;
    md += `---\n\n`;
  }

  return md;
}

function exportToJson(snippets) {
  return JSON.stringify(snippets, null, 2);
}

function importFromJson(jsonStr) {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      throw new Error('Import JSON must be an array of snippets');
    }
    return parsed;
  } catch (err) {
    throw new Error(`Invalid JSON format: ${err.message}`);
  }
}

module.exports = {
  exportToMarkdown,
  exportToJson,
  importFromJson
};
