/**
 * SnippetVault Web Studio Client App
 */

let state = {
  snippets: [],
  stats: null,
  searchQuery: '',
  selectedTag: null,
  selectedLang: '',
  favoritesOnly: false,
  editingId: null
};

// DOM Elements
const statTotalEl = document.getElementById('statTotal');
const statFavoritesEl = document.getElementById('statFavorites');
const statUsageEl = document.getElementById('statUsage');
const statLanguagesEl = document.getElementById('statLanguages');

const searchInput = document.getElementById('searchInput');
const langSelect = document.getElementById('langSelect');
const btnToggleFav = document.getElementById('btnToggleFav');
const favStarIcon = document.getElementById('favStarIcon');

const tagsCloud = document.getElementById('tagsCloud');
const snippetsGrid = document.getElementById('snippetsGrid');

const btnExportMd = document.getElementById('btnExportMd');
const btnOpenNewModal = document.getElementById('btnOpenNewModal');
const snippetModal = document.getElementById('snippetModal');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnCancelModal = document.getElementById('btnCancelModal');
const snippetForm = document.getElementById('snippetForm');
const modalTitle = document.getElementById('modalTitle');

const editSnippetId = document.getElementById('editSnippetId');
const snipName = document.getElementById('snipName');
const snipTitle = document.getElementById('snipTitle');
const snipLang = document.getElementById('snipLang');
const snipDescription = document.getElementById('snipDescription');
const snipTags = document.getElementById('snipTags');
const snipCode = document.getElementById('snipCode');
const snipFavorite = document.getElementById('snipFavorite');

const toastEl = document.getElementById('toast');

// Toast notification helper
function showToast(message, type = 'info') {
  toastEl.textContent = message;
  toastEl.className = `toast show ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`;
  setTimeout(() => {
    toastEl.className = 'toast';
  }, 3000);
}

// Fetch API
async function loadData() {
  try {
    const queryParams = new URLSearchParams();
    if (state.searchQuery) queryParams.set('q', state.searchQuery);
    if (state.selectedTag) queryParams.set('tag', state.selectedTag);
    if (state.selectedLang) queryParams.set('lang', state.selectedLang);
    if (state.favoritesOnly) queryParams.set('fav', 'true');

    const [snippetsRes, statsRes] = await Promise.all([
      fetch(`/api/snippets?${queryParams.toString()}`),
      fetch('/api/stats')
    ]);

    const snippetsData = await snippetsRes.json();
    const statsData = await statsRes.json();

    state.snippets = snippetsData.snippets || [];
    state.stats = statsData;

    renderStats();
    renderTagsCloud();
    renderSnippets();
  } catch (err) {
    showToast(`Failed to load data: ${err.message}`, 'error');
  }
}

function renderStats() {
  if (!state.stats) return;
  statTotalEl.textContent = state.stats.totalSnippets || 0;
  statFavoritesEl.textContent = state.stats.favoriteCount || 0;
  statUsageEl.textContent = state.stats.totalUsage || 0;
  statLanguagesEl.textContent = Object.keys(state.stats.languages || {}).length || 0;
}

function renderTagsCloud() {
  if (!state.stats || !state.stats.tags) return;
  const tagsMap = state.stats.tags;
  const tags = Object.keys(tagsMap);

  if (tags.length === 0) {
    tagsCloud.innerHTML = '';
    return;
  }

  tagsCloud.innerHTML = tags.map(tag => {
    const activeClass = state.selectedTag === tag ? 'active' : '';
    return `<span class="tag-pill ${activeClass}" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)} (${tagsMap[tag]})</span>`;
  }).join('');

  tagsCloud.querySelectorAll('.tag-pill').forEach(el => {
    el.addEventListener('click', () => {
      const tag = el.dataset.tag;
      state.selectedTag = state.selectedTag === tag ? null : tag;
      loadData();
    });
  });
}

function renderSnippets() {
  if (state.snippets.length === 0) {
    snippetsGrid.innerHTML = `
      <div class="loading-state">
        <p>No snippets found matching your search.</p>
        <button class="btn btn-secondary btn-sm" style="margin-top: 1rem;" onclick="openModal()">+ Add New Snippet</button>
      </div>
    `;
    return;
  }

  snippetsGrid.innerHTML = state.snippets.map(s => {
    const langClass = (s.language || 'text').toLowerCase();
    const tagsHtml = (s.tags || []).map(t => `<span class="tag-pill">#${escapeHtml(t)}</span>`).join('');
    const starClass = s.favorite ? 'starred' : '';

    return `
      <div class="snippet-card" data-id="${s.id}">
        <div class="snippet-card-header">
          <div class="snippet-title-area">
            <div class="snippet-name">${escapeHtml(s.name)}</div>
            ${s.title ? `<div class="snippet-human-title">${escapeHtml(s.title)}</div>` : ''}
          </div>
          <div class="snippet-meta">
            <span class="lang-badge ${langClass}">${escapeHtml(s.language || 'text')}</span>
            <button class="star-btn ${starClass}" onclick="toggleFavorite('${s.id}', ${!s.favorite})" title="Toggle Favorite">★</button>
          </div>
        </div>

        ${s.description ? `<p class="snippet-human-title">${escapeHtml(s.description)}</p>` : ''}

        <div class="snippet-code-box">
          <button class="copy-icon-btn" onclick="copySnippet('${s.id}')">Copy</button>
          <pre><code>${escapeHtml(s.code)}</code></pre>
        </div>

        <div class="snippet-card-footer">
          <div class="snippet-tags">${tagsHtml}</div>
          <div class="snippet-actions">
            <button class="btn btn-ghost btn-sm" onclick="editSnippet('${s.id}')">Edit</button>
            <button class="btn btn-ghost btn-sm" style="color: var(--color-danger);" onclick="deleteSnippetClick('${s.id}', '${escapeHtml(s.name)}')">Delete</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Copy Snippet
async function copySnippet(id) {
  try {
    const res = await fetch(`/api/snippets/${id}/copy`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast(`Copied snippet [${data.snippet.name}] to clipboard!`, 'success');
    loadData();
  } catch (err) {
    showToast(`Copy error: ${err.message}`, 'error');
  }
}

// Toggle Favorite Star
async function toggleFavorite(id, favorite) {
  try {
    const res = await fetch(`/api/snippets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    loadData();
  } catch (err) {
    showToast(`Error: ${err.message}`, 'error');
  }
}

// Delete Snippet
async function deleteSnippetClick(id, name) {
  if (!confirm(`Are you sure you want to delete snippet "${name}"?`)) return;
  try {
    const res = await fetch(`/api/snippets/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast(`Deleted snippet [${name}]`, 'info');
    loadData();
  } catch (err) {
    showToast(`Delete error: ${err.message}`, 'error');
  }
}

// Modal open/close
function openModal(snippet = null) {
  snippetModal.classList.add('open');
  if (snippet) {
    modalTitle.textContent = 'Edit Snippet';
    editSnippetId.value = snippet.id;
    snipName.value = snippet.name;
    snipTitle.value = snippet.title || '';
    snipLang.value = snippet.language || 'bash';
    snipDescription.value = snippet.description || '';
    snipTags.value = (snippet.tags || []).join(', ');
    snipCode.value = snippet.code || '';
    snipFavorite.checked = Boolean(snippet.favorite);
  } else {
    modalTitle.textContent = 'New Snippet';
    snippetForm.reset();
    editSnippetId.value = '';
    snipLang.value = 'bash';
  }
}

function closeModal() {
  snippetModal.classList.remove('open');
}

function editSnippet(id) {
  const snippet = state.snippets.find(s => s.id === id);
  if (snippet) openModal(snippet);
}

// Form Submit
snippetForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = editSnippetId.value;
  const payload = {
    name: snipName.value.trim(),
    title: snipTitle.value.trim(),
    language: snipLang.value,
    description: snipDescription.value.trim(),
    tags: snipTags.value.split(',').map(t => t.trim()).filter(Boolean),
    code: snipCode.value.trim(),
    favorite: snipFavorite.checked
  };

  try {
    const url = id ? `/api/snippets/${id}` : '/api/snippets';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    closeModal();
    showToast(id ? 'Updated snippet!' : 'Created new snippet!', 'success');
    loadData();
  } catch (err) {
    showToast(`Save error: ${err.message}`, 'error');
  }
});

// Utility
function escapeHtml(str) {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Event Listeners
searchInput.addEventListener('input', (e) => {
  state.searchQuery = e.target.value;
  loadData();
});

langSelect.addEventListener('change', (e) => {
  state.selectedLang = e.target.value;
  loadData();
});

btnToggleFav.addEventListener('click', () => {
  state.favoritesOnly = !state.favoritesOnly;
  favStarIcon.textContent = state.favoritesOnly ? '★' : '☆';
  btnToggleFav.classList.toggle('active', state.favoritesOnly);
  loadData();
});

btnExportMd.addEventListener('click', () => {
  window.open('/api/export?format=md', '_blank');
});

btnOpenNewModal.addEventListener('click', () => openModal());
btnCloseModal.addEventListener('click', closeModal);
btnCancelModal.addEventListener('click', closeModal);

snippetModal.addEventListener('click', (e) => {
  if (e.target === snippetModal) closeModal();
});

// Initial load
loadData();
