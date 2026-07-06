/*
  REACH SVHC Pigment Checker — App Logic
  Poli International | 2026
  Depends on: svhc-data.js (must load first)
*/

// ─── DOM refs ────────────────────────────────────────────────────
const tabBtns       = document.querySelectorAll('.tab-btn');
const tabPanels     = document.querySelectorAll('.tab-panel');

const searchInput   = document.getElementById('search-input');
const searchBtn     = document.getElementById('search-btn');
const searchResults = document.getElementById('search-results');

const bulkInput     = document.getElementById('bulk-input');
const bulkScanBtn   = document.getElementById('bulk-scan-btn');
const bulkClearBtn  = document.getElementById('bulk-clear-btn');
const bulkResults   = document.getElementById('bulk-results');

// ─── Tab switching ───────────────────────────────────────────────
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === target));
    tabPanels.forEach(p => p.classList.toggle('active', p.id === `panel-${target}`));
  });
});

// ─── Single search ───────────────────────────────────────────────
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') runSearch();
});
searchBtn.addEventListener('click', runSearch);

function runSearch() {
  const q = searchInput.value.trim();
  if (!q) {
    searchResults.innerHTML = '';
    return;
  }
  const match = findByQuery(q);
  searchResults.innerHTML = '';

  if (match) {
    searchResults.appendChild(buildFlaggedCard(match, q, 'name'));
  } else {
    // Try CAS pattern on the raw query
    const casMatches = q.match(CAS_PATTERN);
    if (casMatches) {
      const casMatch = SVHC_DATA.find(s => s.cas.some(c => casMatches.includes(c)));
      if (casMatch) {
        searchResults.appendChild(buildFlaggedCard(casMatch, q, 'cas'));
        return;
      }
    }
    searchResults.appendChild(buildNotFoundCard(q));
  }
}

// ─── Bulk scan ───────────────────────────────────────────────────
bulkScanBtn.addEventListener('click', runBulkScan);
bulkClearBtn.addEventListener('click', () => {
  bulkInput.value = '';
  bulkResults.innerHTML = renderIdle('Paste an ingredient list above and click Scan.');
});

function runBulkScan() {
  const text = bulkInput.value.trim();
  if (!text) {
    bulkResults.innerHTML = renderIdle('Please paste an ingredient or SDS section first.');
    return;
  }

  const hits = parseIngredientBlock(text);

  // Deduplicate by substance id (CAS match wins over name match)
  const seen = new Map();
  hits.forEach(h => {
    if (!h.substance) return;
    const key = h.substance.id;
    if (!seen.has(key)) {
      seen.set(key, h);
    } else if (h.type === 'cas') {
      seen.set(key, h); // prefer CAS match
    }
  });

  const flagged  = [...seen.values()];
  const unknown  = hits.filter(h => !h.substance);
  const total    = hits.length;

  bulkResults.innerHTML = '';

  if (total === 0) {
    bulkResults.innerHTML = renderIdle('No CAS numbers or ingredient names detected. Ensure the text contains CAS numbers (e.g. 7440-02-0) or ingredient names.');
    return;
  }

  // Stats bar
  if (flagged.length > 0) {
    const statsEl = document.createElement('div');
    statsEl.className = 'scan-stats';
    statsEl.innerHTML = `
      <div class="stat-item">
        <span class="stat-dot stat-dot--danger"></span>
        <span class="stat-count">${flagged.length}</span>
        <span class="stat-label">SVHC flagged</span>
      </div>
      <div class="stat-item">
        <span class="stat-dot stat-dot--safe"></span>
        <span class="stat-count">${unknown.length}</span>
        <span class="stat-label">not in SVHC list</span>
      </div>
      <div class="stat-item" style="color:var(--text-muted);font-size:0.78rem;margin-left:auto">
        ${total} ingredient${total !== 1 ? 's' : ''} parsed
      </div>
    `;
    bulkResults.appendChild(statsEl);

    const alertEl = document.createElement('div');
    alertEl.className = 'alert-banner alert-banner--danger';
    alertEl.textContent = `⚠ ${flagged.length} SVHC substance${flagged.length !== 1 ? 's' : ''} detected. Review the flagged items below and consult your supplier for SDS documentation.`;
    bulkResults.appendChild(alertEl);
  } else {
    const statsEl = document.createElement('div');
    statsEl.className = 'scan-stats';
    statsEl.innerHTML = `
      <div class="stat-item">
        <span class="stat-dot stat-dot--safe"></span>
        <span class="stat-count">0</span>
        <span class="stat-label">SVHC flagged</span>
      </div>
      <div class="stat-item" style="color:var(--text-muted);font-size:0.78rem;margin-left:auto">
        ${total} ingredient${total !== 1 ? 's' : ''} parsed — none matched SVHC list
      </div>
    `;
    bulkResults.appendChild(statsEl);

    const infoEl = document.createElement('div');
    infoEl.className = 'alert-banner alert-banner--info';
    infoEl.textContent = 'No SVHCs detected in the scanned ingredients. Always verify against the official ECHA Candidate List for legally binding compliance.';
    bulkResults.appendChild(infoEl);
  }

  // Results list header
  if (flagged.length > 0) {
    const hdr = document.createElement('div');
    hdr.className = 'results-header';
    hdr.innerHTML = `<span class="results-title">Flagged substances (${flagged.length})</span>`;
    bulkResults.appendChild(hdr);

    const section = document.createElement('div');
    section.className = 'results-section';
    flagged.forEach(h => section.appendChild(buildFlaggedCard(h.substance, h.query, h.type)));
    bulkResults.appendChild(section);
  }

  // Not-found list
  if (unknown.length > 0) {
    const hdr2 = document.createElement('div');
    hdr2.className = 'results-header';
    hdr2.style.marginTop = '1rem';
    hdr2.innerHTML = `<span class="results-title">Not in SVHC list (${unknown.length})</span>`;
    bulkResults.appendChild(hdr2);

    const section2 = document.createElement('div');
    section2.className = 'results-section';
    unknown.forEach(h => section2.appendChild(buildNotFoundCard(h.query)));
    bulkResults.appendChild(section2);
  }
}

// ─── Card builders ───────────────────────────────────────────────

function buildFlaggedCard(sub, query, matchType) {
  const card = document.createElement('div');
  card.className = 'result-card result-card--flagged';

  const relevanceBadge = sub.body_art_relevance === 'high'
    ? `<span class="badge badge--danger">High risk</span>`
    : sub.body_art_relevance === 'medium'
    ? `<span class="badge badge--warning">Med risk</span>`
    : `<span class="badge badge--neutral">Low risk</span>`;

  const reasonBadge = `<span class="badge badge--danger">${escHtml(sub.reason_short)}</span>`;

  const casDisplay = sub.cas.join(', ');
  const matchNote  = matchType === 'cas'
    ? `Matched by CAS: <code>${escHtml(query)}</code>`
    : `Matched by name`;

  const foundInTags = sub.found_in.map(f =>
    `<span class="detail-tag">${escHtml(f)}</span>`
  ).join('');

  const alsoKnownAs = sub.also_known_as && sub.also_known_as.length > 0
    ? sub.also_known_as.map(a => `<span class="detail-tag">${escHtml(a)}</span>`).join('')
    : '<span class="detail-tag" style="color:var(--text-muted)">—</span>';

  card.innerHTML = `
    <div class="card-header" onclick="toggleCard(this)">
      <span class="card-status-icon">⚠️</span>
      <div class="card-title-block">
        <div class="card-name">${escHtml(sub.name)}</div>
        <div class="card-name-sub">CAS ${escHtml(casDisplay)}</div>
      </div>
      <div class="card-badges">
        ${reasonBadge}
        ${relevanceBadge}
      </div>
      <span class="card-chevron">▼</span>
    </div>
    <div class="card-body">
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Hazard classification</span>
          <span class="detail-value">${escHtml(sub.reason)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">EC number</span>
          <span class="detail-value"><code>${escHtml(sub.ec || '—')}</code></span>
        </div>
        <div class="detail-item">
          <span class="detail-label">CAS number(s)</span>
          <span class="detail-value"><code>${escHtml(casDisplay)}</code></span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Match method</span>
          <span class="detail-value" style="font-size:0.78rem;color:var(--text-muted)">${matchNote}</span>
        </div>
      </div>
      <div style="margin-top:0.75rem">
        <span class="detail-label">Found in body art products</span>
        <div class="detail-tags" style="margin-top:0.35rem">${foundInTags}</div>
      </div>
      <div style="margin-top:0.75rem">
        <span class="detail-label">Also known as</span>
        <div class="detail-tags" style="margin-top:0.35rem">${alsoKnownAs}</div>
      </div>
      <div class="card-action-row">
        <a href="${sub.echa_url}" target="_blank" rel="noopener noreferrer">
          🔗 View on ECHA
        </a>
        <a href="https://echa.europa.eu/candidate-list-table" target="_blank" rel="noopener noreferrer">
          📋 Full SVHC List
        </a>
      </div>
    </div>
  `;
  return card;
}

function buildNotFoundCard(query) {
  const div = document.createElement('div');
  div.className = 'not-found-card';
  div.innerHTML = `
    <span class="nf-icon">✅</span>
    <div class="nf-text">
      <div class="nf-name">${escHtml(query)}</div>
      <div class="nf-sub">Not found in SVHC body-art list — verify against the <a href="https://echa.europa.eu/candidate-list-table" target="_blank" rel="noopener noreferrer">official ECHA list</a></div>
    </div>
  `;
  return div;
}

// ─── Helpers ─────────────────────────────────────────────────────

function toggleCard(headerEl) {
  headerEl.closest('.result-card').classList.toggle('expanded');
}

function renderIdle(msg) {
  return `<div class="idle-state">
    <div class="idle-state__icon">🔬</div>
    <div class="idle-state__text">${escHtml(msg)}</div>
  </div>`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  searchResults.innerHTML = renderIdle('Enter an ingredient name or CAS number above.');
  bulkResults.innerHTML   = renderIdle('Paste an ingredient list or SDS section above and click Scan.');

  // Auto-expand first flagged card when only one result
  const observer = new MutationObserver(() => {
    const cards = searchResults.querySelectorAll('.result-card--flagged');
    if (cards.length === 1) cards[0].classList.add('expanded');
  });
  observer.observe(searchResults, { childList: true });
});
