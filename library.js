/* ------------------------ LIBRARY: PUBLIC / PRIVATE TIERS ------------------------ */

const STORAGE_KEY_TIERS = 'tierlist_all_tiers';
let allTiers = [];

// ler tiers do localStorage
function loadAllTiers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TIERS);
    allTiers = raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('loadAllTiers error', err);
    allTiers = [];
  }
}

// salvar tiers no localStorage
function saveAllTiers() {
  try {
    localStorage.setItem(STORAGE_KEY_TIERS, JSON.stringify(allTiers));
  } catch (err) {
    console.error('saveAllTiers error', err);
  }
}

// criar card HTML para tier
function createTierCard(tier) {
  const div = document.createElement('div');
  div.className = 'tier-card';
  div.innerHTML = `
    <img src="${tier.thumbnail || 'placeholder.png'}" alt="${tier.name}">
    <div class="tier-card-info">
      <div class="tier-card-title">${tier.name || 'Sem nome'}</div>
      <div class="tier-card-author">por ${tier.author || 'Anônimo'}</div>
      <div class="tier-card-actions">
        <button class="btn-view">👁️ Ver</button>
        <button class="btn-delete">🗑️ Deletar</button>
      </div>
    </div>
  `;

  const viewBtn = div.querySelector('.btn-view');
  const deleteBtn = div.querySelector('.btn-delete');

  // ver tier (abre em nova aba)
  viewBtn.addEventListener('click', () => {
    const url = `view.html?id=${tier.id}`;
    window.open(url, '_blank');
  });

  // delete ao clique (duplo para confirmar)
  let clickCount = 0;
  let clickTimer = null;
  deleteBtn.addEventListener('click', () => {
    clickCount++;
    if (clickCount === 1) {
      deleteBtn.textContent = '✓ Confirmar?';
      clickTimer = setTimeout(() => {
        clickCount = 0;
        deleteBtn.textContent = '🗑️ Deletar';
      }, 2000);
    } else if (clickCount === 2) {
      clearTimeout(clickTimer);
      allTiers = allTiers.filter(t => t.id !== tier.id);
      saveAllTiers();
      div.style.animation = 'fadeOut 0.3s';
      setTimeout(() => div.remove(), 300);
      clickCount = 0;
    }
  });

  return div;
}

// renderizar grid de tiers
function renderGrid(tabId) {
  const grid = document.getElementById(`${tabId}-grid`);
  const empty = document.getElementById(`${tabId}-empty`);
  
  if (!grid) return;

  grid.innerHTML = '';
  const userId = localStorage.getItem('userId') || 'user_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('userId', userId);

  const filtered = allTiers.filter(t => {
    if (tabId === 'public') return t.isPublic;
    if (tabId === 'private') return !t.isPublic && t.authorId === userId;
    return false;
  });

  if (filtered.length === 0) {
    empty.style.display = 'block';
    grid.style.display = 'none';
  } else {
    empty.style.display = 'none';
    grid.style.display = 'grid';
    filtered.forEach(tier => {
      grid.appendChild(createTierCard(tier));
    });
  }
}

// tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const tabId = btn.getAttribute('data-tab');
    document.getElementById(tabId).classList.add('active');
    renderGrid(tabId);
  });
});

// init
loadAllTiers();
renderGrid('public');