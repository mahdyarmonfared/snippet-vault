# 📦 SnippetVault

> **Zero-dependency CLI code snippet manager, cross-platform clipboard tool, and visual web studio.**

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Dependencies](https://img.shields.io/badge/Dependencies-0%20(Pure%20Core)-blue)](package.json)
[![Tests](https://img.shields.io/badge/Tests-7%2F7%20Passing-brightgreen)](test/)
[![Port](https://img.shields.io/badge/Web%20Studio-Port%203011-79c0ff)](http://localhost:3011)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 💡 Why SnippetVault?

Developers repeatedly search for complex shell aliases, regex patterns, SQL queries, Docker cleanup scripts, and boilerplate functions across old terminal tabs, Slack threads, and scratchpads.

**SnippetVault (`snip`)** provides an instant, structured local vault to store, tag, search, copy, and execute code snippets directly from your command line or browser:
- ⚡ **Zero External Dependencies**: Fast, lightweight Node.js standard library core.
- 📋 **Cross-Platform OS Clipboard Integration**: Direct 1-second copy via `wl-copy`, `xclip`, `pbcopy`, or `clip`.
- 🔍 **Instant Fuzzy Search**: Search across snippet names, commands, descriptions, tags, and language metadata.
- 🚀 **Direct Execution (`snip run`)**: Instantly execute shell snippets safely from the CLI.
- 🌊 **Piping Support**: Pipe output directly into your vault (`cat script.sh | snip add deploy-prod`).
- 🌐 **Visual Web Studio**: Beautiful dark-mode dashboard running locally on **port 3011**.
- 📄 **Cheat Sheet Generator**: Export your entire snippet collection to clean Markdown cheat sheets or JSON backups.

---

## ⚡ Quick Start

Run instantly with `npx`:

```bash
# List all stored snippets
npx snippet-vault list

# Search for a snippet
npx snippet-vault find git

# Copy code directly to your clipboard
npx snippet-vault copy git-undo-commit

# Launch Visual Web Studio on localhost:3011
npx snippet-vault ui
```

Or install globally:

```bash
npm install -g snippet-vault
snip --help
```

---

## 🖥️ Visual Web Studio (Port 3011)

Launch the visual dashboard locally with:

```bash
snip ui
# Or with custom port:
snip ui --port 3011
```

Open your browser to `http://localhost:3011` to access:
- **Snippet Card Grid**: Filter by language badges (`bash`, `sql`, `javascript`, `python`, `docker`), star favorites (★), and copy code blocks with one click.
- **Interactive Creator & Editor**: Easily create, edit, or tag code snippets with syntax-aware previews.
- **Tag Cloud Filter**: Filter snippets instantly by tag chips (`#git`, `#docker`, `#sql`, `#devops`).
- **One-Click Export**: Download your entire vault as a formatted Markdown cheat sheet.

---

## 🛠️ CLI Reference

### 1. `snip list` / `snip ls`
Lists stored snippets in an ASCII table.

```bash
snip list
snip list -l bash          # Filter by language
snip list -t git           # Filter by tag
snip list --fav            # Favorites only
```

### 2. `snip find <query>` / `snip search <query>`
Searches snippets by keyword in name, description, tags, or code content.

```bash
snip find docker
snip find postgres
```

### 3. `snip add <name> [code]`
Adds a new snippet to your vault.

```bash
# Add via command line flags
snip add my-query "SELECT * FROM users;" -l sql -t db --desc "Fetch all users"

# Add via stdin piping
cat deploy.sh | snip add deploy-script -t devops -l bash
```

### 4. `snip copy <name>` / `snip cp <name>`
Copies snippet code directly to your OS clipboard.

```bash
snip copy git-undo-commit
```

### 5. `snip run <name>` / `snip exec <name>`
Executes bash snippet code directly from the terminal.

```bash
snip run docker-clean-all
```

### 6. `snip export [file]` / `snip import <file>`
Export or import snippets.

```bash
# Export Markdown cheat sheet
snip export cheatsheet.md --md

# Export JSON backup
snip export backup.json

# Import JSON backup
snip import backup.json
```

---

## 🔬 Architecture

```text
snippet-vault/
├── bin/
│   └── snippet-vault.js      # Executable CLI entry binary (snip / snippet-vault)
├── src/
│   ├── core/
│   │   ├── vault.js           # JSON storage engine & search logic
│   │   ├── clipboard.js       # Cross-platform clipboard helper (xclip/pbcopy/clip)
│   │   ├── exporter.js        # Markdown & JSON exporter/importer
│   │   └── index.js           # Unified core barrel module
│   ├── cli/
│   │   ├── ansi.js            # Zero-dependency ANSI formatting & ASCII table printer
│   │   └── runner.js          # CLI argument parser & command handler
│   ├── server/
│   │   └── server.js          # HTTP server & REST API on port 3011
│   └── ui/
│       ├── index.html         # Web Studio dark-mode interface
│       ├── style.css          # Devtools aesthetic styling
│       └── app.js             # Client JS application
└── test/
    ├── vault.test.js          # Vault storage test suite
    ├── clipboard.test.js      # Clipboard helper test suite
    ├── exporter.test.js       # Exporter test suite
    └── server.test.js         # REST API test suite
```

---

## 📄 License

MIT © [Mahdyar Monfared](https://github.com/mahdyarmonfared)
