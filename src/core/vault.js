/**
 * Storage manager and Core Engine for SnippetVault.
 * Zero-dependency JSON storage with atomic writes and search.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

function getDefaultVaultPath() {
  const configDir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configDir, 'snippet-vault', 'snippets.json');
}

function detectLanguage(name = '', code = '', tags = []) {
  const combined = (name + ' ' + code + ' ' + tags.join(' ')).toLowerCase();

  if (combined.includes('sql') || /\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|ALTER TABLE|JOIN)\b/i.test(code)) return 'sql';
  if (combined.includes('docker') || code.startsWith('FROM ') || /\b(FROM\s+[a-z0-9_.-]+(:[a-z0-9_.-]+)?|RUN\s+|WORKDIR\s+)\b/i.test(code)) return 'docker';
  if (combined.includes('python') || combined.includes('py') || /\b(def |import os|print\(|if __name__ ==)\b/.test(code)) return 'python';
  if (combined.includes('react') || combined.includes('jsx') || combined.includes('tsx')) return 'javascript';
  if (combined.includes('json') || (code.trim().startsWith('{') && code.trim().endsWith('}'))) return 'json';
  if (combined.includes('html') || code.includes('<html') || code.includes('</div>')) return 'html';
  if (combined.includes('css') || code.includes('{ margin:') || code.includes(': hover')) return 'css';
  if (combined.includes('yaml') || combined.includes('yml') || /^\s*[\w-]+:\s*.+$/m.test(code)) return 'yaml';
  if (
    combined.includes('bash') ||
    combined.includes('sh') ||
    combined.includes('git') ||
    code.startsWith('#!') ||
    /^(git|npm|npx|docker|kubectl|systemctl|curl|grep|find|tar|chmod|chown|echo|cat|mkdir|rm|cd|ls|export|source|alias|ssh)\b/m.test(code.trim())
  ) return 'bash';

  if (/\b(const|let|var|function|async|await|require\(|import .+ from)\b/.test(code)) return 'javascript';

  return 'text';
}

function loadVault(customPath) {
  const filePath = customPath || getDefaultVaultPath();

  if (!fs.existsSync(filePath)) {
    return getSeedSnippets();
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return getSeedSnippets();
  }
}

function saveVault(snippets, customPath) {
  const filePath = customPath || getDefaultVaultPath();
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const json = JSON.stringify(snippets, null, 2);
  const tempPath = `${filePath}.tmp.${Date.now()}`;

  fs.writeFileSync(tempPath, json, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function generateId() {
  const rand = crypto.randomBytes(3).toString('hex');
  return `snip-${Date.now().toString(36)}-${rand}`;
}

function addSnippet(data, customPath) {
  if (!data.name || !data.name.trim()) {
    throw new Error('Snippet name is required');
  }
  if (!data.code || !data.code.trim()) {
    throw new Error('Snippet code content is required');
  }

  const snippets = loadVault(customPath);
  const nameClean = data.name.trim().toLowerCase().replace(/\s+/g, '-');

  // Check name uniqueness
  const exists = snippets.find(s => s.name.toLowerCase() === nameClean);
  if (exists) {
    throw new Error(`Snippet with name "${data.name}" already exists`);
  }

  const tagsArr = Array.isArray(data.tags)
    ? data.tags
    : typeof data.tags === 'string'
      ? data.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];

  const lang = data.language || detectLanguage(nameClean, data.code, tagsArr);

  const newSnippet = {
    id: generateId(),
    name: nameClean,
    title: data.title || data.name.trim(),
    code: data.code.trim(),
    description: (data.description || '').trim(),
    language: lang,
    tags: tagsArr,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: 0,
    favorite: Boolean(data.favorite)
  };

  snippets.unshift(newSnippet);
  saveVault(snippets, customPath);
  return newSnippet;
}

function getSnippet(idOrName, customPath) {
  if (!idOrName) return null;
  const snippets = loadVault(customPath);
  const query = idOrName.trim().toLowerCase();

  return snippets.find(s =>
    s.id.toLowerCase() === query ||
    s.name.toLowerCase() === query
  ) || null;
}

function updateSnippet(idOrName, updates, customPath) {
  const snippets = loadVault(customPath);
  const target = getSnippet(idOrName, customPath);

  if (!target) {
    throw new Error(`Snippet "${idOrName}" not found`);
  }

  const index = snippets.findIndex(s => s.id === target.id);

  if (updates.name && updates.name.trim().toLowerCase() !== target.name) {
    const newNameClean = updates.name.trim().toLowerCase().replace(/\s+/g, '-');
    const duplicate = snippets.find(s => s.name === newNameClean && s.id !== target.id);
    if (duplicate) {
      throw new Error(`Snippet name "${updates.name}" is already in use`);
    }
    target.name = newNameClean;
  }

  if (updates.code !== undefined) target.code = updates.code.trim();
  if (updates.title !== undefined) target.title = updates.title.trim();
  if (updates.description !== undefined) target.description = updates.description.trim();
  if (updates.language !== undefined) target.language = updates.language.trim();
  if (updates.favorite !== undefined) target.favorite = Boolean(updates.favorite);

  if (updates.tags !== undefined) {
    target.tags = Array.isArray(updates.tags)
      ? updates.tags
      : String(updates.tags).split(',').map(t => t.trim()).filter(Boolean);
  }

  target.updatedAt = new Date().toISOString();
  snippets[index] = target;

  saveVault(snippets, customPath);
  return target;
}

function deleteSnippet(idOrName, customPath) {
  const snippets = loadVault(customPath);
  const target = getSnippet(idOrName, customPath);

  if (!target) {
    throw new Error(`Snippet "${idOrName}" not found`);
  }

  const filtered = snippets.filter(s => s.id !== target.id);
  saveVault(filtered, customPath);
  return target;
}

function incrementUsage(idOrName, customPath) {
  const target = getSnippet(idOrName, customPath);
  if (!target) return null;

  return updateSnippet(target.id, { usageCount: (target.usageCount || 0) + 1 }, customPath);
}

function searchSnippets(query = '', options = {}, customPath) {
  const snippets = loadVault(customPath);
  const q = query.trim().toLowerCase();
  const tagFilter = options.tag ? options.tag.toLowerCase() : null;
  const langFilter = options.language ? options.language.toLowerCase() : null;
  const favFilter = options.favorite ? true : null;

  return snippets.filter(s => {
    if (favFilter && !s.favorite) return false;
    if (langFilter && s.language.toLowerCase() !== langFilter) return false;
    if (tagFilter && !s.tags.some(t => t.toLowerCase() === tagFilter)) return false;

    if (!q) return true;

    const nameMatch = s.name.toLowerCase().includes(q);
    const titleMatch = s.title && s.title.toLowerCase().includes(q);
    const codeMatch = s.code.toLowerCase().includes(q);
    const descMatch = s.description && s.description.toLowerCase().includes(q);
    const tagMatch = s.tags.some(t => t.toLowerCase().includes(q));

    return nameMatch || titleMatch || codeMatch || descMatch || tagMatch;
  });
}

function getStats(customPath) {
  const snippets = loadVault(customPath);
  const languages = {};
  const tagsMap = {};
  let totalUsage = 0;
  let favoriteCount = 0;

  for (const s of snippets) {
    languages[s.language] = (languages[s.language] || 0) + 1;
    totalUsage += (s.usageCount || 0);
    if (s.favorite) favoriteCount++;

    for (const t of (s.tags || [])) {
      tagsMap[t] = (tagsMap[t] || 0) + 1;
    }
  }

  return {
    totalSnippets: snippets.length,
    favoriteCount,
    totalUsage,
    languages,
    tags: tagsMap
  };
}

function getSeedSnippets() {
  return [
    {
      id: 'snip-seed-git-undo',
      name: 'git-undo-commit',
      title: 'Undo last git commit (keep changes)',
      code: 'git reset --soft HEAD~1',
      description: 'Uncommits the most recent commit while preserving all uncommitted changes in staged state.',
      language: 'bash',
      tags: ['git', 'cli', 'undo'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 12,
      favorite: true
    },
    {
      id: 'snip-seed-docker-cleanup',
      name: 'docker-clean-all',
      title: 'Deep clean unused Docker assets',
      code: 'docker system prune -a --volumes -f',
      description: 'Removes all stopped containers, unused networks, dangling images, and volumes to free up disk space.',
      language: 'bash',
      tags: ['docker', 'devops', 'cleanup'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 8,
      favorite: true
    },
    {
      id: 'snip-seed-sql-upsert',
      name: 'postgres-upsert',
      title: 'PostgreSQL ON CONFLICT Upsert',
      code: 'INSERT INTO users (id, email, updated_at)\nVALUES (1, \'user@example.com\', NOW())\nON CONFLICT (id)\nDO UPDATE SET email = EXCLUDED.email, updated_at = NOW();',
      description: 'Atomically inserts a user row or updates email if primary key conflict occurs.',
      language: 'sql',
      tags: ['postgres', 'sql', 'database'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 5,
      favorite: false
    },
    {
      id: 'snip-seed-js-sleep',
      name: 'async-sleep',
      title: 'Zero-dependency Async Sleep in JS',
      code: 'const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));\nawait sleep(1000);',
      description: 'Helper function to pause execution in an async function.',
      language: 'javascript',
      tags: ['javascript', 'async', 'promise'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 19,
      favorite: true
    }
  ];
}

module.exports = {
  getDefaultVaultPath,
  detectLanguage,
  loadVault,
  saveVault,
  addSnippet,
  getSnippet,
  updateSnippet,
  deleteSnippet,
  incrementUsage,
  searchSnippets,
  getStats
};
