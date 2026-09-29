/**
 * CLI runner for SnippetVault.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

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
  exportToJson,
  importFromJson
} = require('../core');

const { chalk, renderTable } = require('./ansi');

function parseArgs(args) {
  const parsed = {
    command: null,
    target: null,
    options: {
      tag: null,
      lang: null,
      desc: null,
      title: null,
      port: 3011,
      json: false,
      markdown: false,
      favorite: false,
      help: false,
      version: false
    }
  };

  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      parsed.options.help = true;
    } else if (arg === '--version' || arg === '-v') {
      parsed.options.version = true;
    } else if (arg === '--json') {
      parsed.options.json = true;
    } else if (arg === '--md' || arg === '--markdown') {
      parsed.options.markdown = true;
    } else if (arg === '--fav' || arg === '--favorite') {
      parsed.options.favorite = true;
    } else if (arg === '--ui') {
      parsed.command = 'ui';
    } else if ((arg === '--tag' || arg === '-t') && args[i + 1]) {
      parsed.options.tag = args[++i];
    } else if ((arg === '--lang' || arg === '-l') && args[i + 1]) {
      parsed.options.lang = args[++i];
    } else if ((arg === '--desc' || arg === '-d') && args[i + 1]) {
      parsed.options.desc = args[++i];
    } else if (arg === '--title' && args[i + 1]) {
      parsed.options.title = args[++i];
    } else if (arg === '--port' && args[i + 1]) {
      parsed.options.port = parseInt(args[++i], 10);
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  if (positional.length > 0) {
    parsed.command = positional[0];
    if (positional.length > 1) {
      parsed.target = positional[1];
    }
    parsed.extraArgs = positional.slice(2);
  }

  return parsed;
}

function printHelp() {
  console.log(`
${chalk.bold(chalk.cyan('📦 SnippetVault'))} ${chalk.dim('v1.0.0')}
${chalk.dim('Zero-dependency CLI code snippet manager, clipboard tool, and web studio.')}

${chalk.bold('USAGE:')}
  ${chalk.green('snip')} ${chalk.yellow('[command]')} ${chalk.cyan('[name|id]')} ${chalk.dim('[options]')}

${chalk.bold('COMMANDS:')}
  ${chalk.yellow('list, ls')}          List all stored snippets
  ${chalk.yellow('search, find')}      Search snippets by keyword, tag, or language
  ${chalk.yellow('add')}              Add a new snippet (supports stdin: ${chalk.dim('cat script.sh | snip add my-script')})
  ${chalk.yellow('copy, cp')}          Copy snippet code directly to system clipboard
  ${chalk.yellow('show, view')}        View full snippet content and metadata
  ${chalk.yellow('run, exec')}         Execute snippet as a bash shell command
  ${chalk.yellow('remove, rm')}       Delete snippet from vault
  ${chalk.yellow('export')}           Export snippets to Markdown cheat sheet or JSON
  ${chalk.yellow('import')}           Import snippets from JSON file
  ${chalk.yellow('ui, studio')}        Launch interactive Web Studio on localhost:3011
  ${chalk.yellow('help')}              Show this help message

${chalk.bold('OPTIONS:')}
  ${chalk.cyan('-t, --tag <tag>')}     Filter or assign tag
  ${chalk.cyan('-l, --lang <lang>')}   Filter or assign programming language
  ${chalk.cyan('-d, --desc <desc>')}   Assign description to snippet
  ${chalk.cyan('--title <title>')}     Assign human title
  ${chalk.cyan('--fav')}              Filter favorites only
  ${chalk.cyan('--json')}             Output machine-readable JSON
  ${chalk.cyan('--port <number>')}    Port for Web Studio (default: 3011)

${chalk.bold('EXAMPLES:')}
  $ snip list
  $ snip find git
  $ snip copy git-undo-commit
  $ snip add my-query "SELECT * FROM users;" -l sql -t db
  $ cat deploy.sh | snip add deploy-prod -t devops
  $ snip run git-undo-commit
  $ snip ui --port 3011
`);
}

function readStdin() {
  if (process.stdin.isTTY) return null;
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return null;
  }
}

function runList(options) {
  const snippets = searchSnippets('', {
    tag: options.tag,
    language: options.lang,
    favorite: options.favorite
  });

  if (options.json) {
    console.log(JSON.stringify(snippets, null, 2));
    return 0;
  }

  console.log(`\n${chalk.bold(chalk.cyan('📦 SnippetVault'))} ${chalk.dim(`(${snippets.length} saved snippet${snippets.length !== 1 ? 's' : ''})`)}\n`);

  if (snippets.length === 0) {
    console.log(chalk.dim('No snippets found. Use "snip add <name> <code>" to create one!\n'));
    return 0;
  }

  const headers = ['Fav', 'Name', 'Lang', 'Tags', 'Usage', 'Description'];
  const rows = snippets.map(s => [
    s.favorite ? chalk.yellow('★') : ' ',
    chalk.bold(s.name),
    chalk.cyan(s.language || 'text'),
    s.tags.map(t => `#${t}`).join(' ') || chalk.dim('none'),
    s.usageCount || 0,
    s.description || chalk.dim('No description')
  ]);

  console.log(renderTable(headers, rows));
  console.log(`\n${chalk.dim('Tip: Run "snip copy <name>" to copy any code block directly to clipboard.')}\n`);
  return 0;
}

function runSearch(query, options) {
  if (!query) {
    return runList(options);
  }

  const results = searchSnippets(query, {
    tag: options.tag,
    language: options.lang,
    favorite: options.favorite
  });

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return 0;
  }

  console.log(`\n${chalk.bold(chalk.cyan('🔍 Search Results for:'))} "${chalk.yellow(query)}"\n`);

  if (results.length === 0) {
    console.log(chalk.yellow(`No matching snippets found for "${query}".\n`));
    return 0;
  }

  const headers = ['Name', 'Lang', 'Tags', 'Description'];
  const rows = results.map(s => [
    chalk.bold(s.name),
    chalk.cyan(s.language || 'text'),
    s.tags.map(t => `#${t}`).join(' '),
    s.description || chalk.dim('No description')
  ]);

  console.log(renderTable(headers, rows));
  console.log(`\nFound ${results.length} result(s).\n`);
  return 0;
}

function runAdd(targetName, extraArgs, options) {
  let name = targetName;
  let code = extraArgs && extraArgs.length > 0 ? extraArgs.join(' ') : null;

  // Check if code was piped via stdin
  const stdinCode = readStdin();
  if (stdinCode) {
    code = stdinCode;
  }

  if (!name) {
    console.error(chalk.red('✖ Error: Snippet name is required. Usage: snip add <name> [code]'));
    return 1;
  }

  if (!code) {
    console.error(chalk.red('✖ Error: Snippet code content is required or must be piped via stdin.'));
    return 1;
  }

  try {
    const created = addSnippet({
      name,
      title: options.title,
      code,
      description: options.desc,
      language: options.lang,
      tags: options.tag ? options.tag.split(',') : [],
      favorite: options.favorite
    });

    console.log(`\n${chalk.green('✔ Snippet created successfully!')}`);
    console.log(`  ${chalk.bold('Name:')} ${created.name}`);
    console.log(`  ${chalk.cyan('Language:')} ${created.language}`);
    console.log(`  ${chalk.dim('Tags:')} ${created.tags.map(t => `#${t}`).join(' ') || 'none'}\n`);
    return 0;
  } catch (err) {
    console.error(chalk.red(`✖ Failed to add snippet: ${err.message}\n`));
    return 1;
  }
}

function runCopy(idOrName) {
  if (!idOrName) {
    console.error(chalk.red('✖ Error: Snippet name or ID required. Usage: snip copy <name>'));
    return 1;
  }

  const snippet = getSnippet(idOrName);
  if (!snippet) {
    console.error(chalk.red(`✖ Snippet "${idOrName}" not found.`));
    return 1;
  }

  incrementUsage(snippet.id);
  const result = copyToClipboard(snippet.code);

  if (result.success) {
    console.log(`\n${chalk.green('✔ Copied to clipboard!')} ${chalk.bold(`[${snippet.name}]`)} ${chalk.dim(`(used ${snippet.usageCount + 1} times)`)}\n`);
  } else {
    console.log(`\n${chalk.yellow('📋 Snippet Content:')} ${chalk.bold(`[${snippet.name}]`)}\n`);
    console.log(snippet.code);
    console.log('');
  }

  return 0;
}

function runShow(idOrName, options) {
  if (!idOrName) {
    console.error(chalk.red('✖ Error: Snippet name or ID required. Usage: snip show <name>'));
    return 1;
  }

  const snippet = getSnippet(idOrName);
  if (!snippet) {
    console.error(chalk.red(`✖ Snippet "${idOrName}" not found.`));
    return 1;
  }

  if (options.json) {
    console.log(JSON.stringify(snippet, null, 2));
    return 0;
  }

  console.log(`\n${chalk.bold(chalk.cyan('📦 ' + (snippet.title || snippet.name)))} ${snippet.favorite ? chalk.yellow('★') : ''}`);
  console.log(`${chalk.dim('ID:')} ${snippet.id}  ${chalk.cyan('Lang:')} ${snippet.language}  ${chalk.dim('Usage:')} ${snippet.usageCount}`);
  if (snippet.description) {
    console.log(`${chalk.dim('Description:')} ${snippet.description}`);
  }
  if (snippet.tags && snippet.tags.length > 0) {
    console.log(`${chalk.dim('Tags:')} ${snippet.tags.map(t => `#${t}`).join(' ')}`);
  }
  console.log(`\n${chalk.bold('--- Code ---')}`);
  console.log(chalk.green(snippet.code));
  console.log(`${chalk.bold('------------')}\n`);

  return 0;
}

function runExec(idOrName) {
  if (!idOrName) {
    console.error(chalk.red('✖ Error: Snippet name or ID required. Usage: snip run <name>'));
    return 1;
  }

  const snippet = getSnippet(idOrName);
  if (!snippet) {
    console.error(chalk.red(`✖ Snippet "${idOrName}" not found.`));
    return 1;
  }

  incrementUsage(snippet.id);
  console.log(`\n${chalk.bold(chalk.yellow('🚀 Executing snippet:'))} ${chalk.bold(snippet.name)}`);
  console.log(`${chalk.dim('$ ' + snippet.code.split('\n')[0])}\n`);

  const proc = spawnSync('bash', ['-c', snippet.code], { stdio: 'inherit' });
  console.log(`\n${chalk.dim(`Process exited with code ${proc.status}`)}\n`);
  return proc.status || 0;
}

function runRemove(idOrName) {
  if (!idOrName) {
    console.error(chalk.red('✖ Error: Snippet name or ID required. Usage: snip rm <name>'));
    return 1;
  }

  try {
    const deleted = deleteSnippet(idOrName);
    console.log(`\n${chalk.green('✔ Deleted snippet:')} ${chalk.bold(deleted.name)}\n`);
    return 0;
  } catch (err) {
    console.error(chalk.red(`✖ ${err.message}\n`));
    return 1;
  }
}

function runExport(targetFile, options) {
  const snippets = loadVault();

  if (options.markdown || (targetFile && targetFile.endsWith('.md'))) {
    const md = exportToMarkdown(snippets);
    if (targetFile) {
      fs.writeFileSync(targetFile, md, 'utf8');
      console.log(chalk.green(`✔ Exported ${snippets.length} snippets to Markdown: ${targetFile}`));
    } else {
      console.log(md);
    }
    return 0;
  }

  const json = exportToJson(snippets);
  if (targetFile) {
    fs.writeFileSync(targetFile, json, 'utf8');
    console.log(chalk.green(`✔ Exported ${snippets.length} snippets to JSON: ${targetFile}`));
  } else {
    console.log(json);
  }
  return 0;
}

function runImport(targetFile) {
  if (!targetFile || !fs.existsSync(targetFile)) {
    console.error(chalk.red(`✖ File not found: ${targetFile}`));
    return 1;
  }

  try {
    const content = fs.readFileSync(targetFile, 'utf8');
    const snippetsToImport = importFromJson(content);
    let count = 0;

    for (const s of snippetsToImport) {
      try {
        addSnippet(s);
        count++;
      } catch {
        // Skip duplicate names
      }
    }

    console.log(chalk.green(`✔ Successfully imported ${count} snippet(s) from ${targetFile}`));
    return 0;
  } catch (err) {
    console.error(chalk.red(`✖ Import error: ${err.message}`));
    return 1;
  }
}

function runUi(options) {
  const { startServer } = require('../server/server');
  startServer(options.port);
}

function execute(args = process.argv.slice(2)) {
  const { command, target, extraArgs, options } = parseArgs(args);

  if (options.version) {
    const pkg = require('../../package.json');
    console.log(`snippet-vault v${pkg.version}`);
    return 0;
  }

  if (options.help || command === 'help') {
    printHelp();
    return 0;
  }

  switch (command) {
    case 'list':
    case 'ls':
    case undefined:
    case null:
      return runList(options);

    case 'search':
    case 'find':
      return runSearch(target, options);

    case 'add':
    case 'create':
    case 'new':
      return runAdd(target, extraArgs, options);

    case 'copy':
    case 'cp':
      return runCopy(target);

    case 'show':
    case 'view':
      return runShow(target, options);

    case 'run':
    case 'exec':
      return runExec(target);

    case 'remove':
    case 'rm':
    case 'del':
      return runRemove(target);

    case 'export':
      return runExport(target, options);

    case 'import':
      return runImport(target);

    case 'ui':
    case 'studio':
      runUi(options);
      return 0;

    default:
      console.error(chalk.red(`✖ Unknown command: ${command}`));
      printHelp();
      return 1;
  }
}

module.exports = {
  execute,
  parseArgs
};
