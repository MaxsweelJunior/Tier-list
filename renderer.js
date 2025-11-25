/* ------------------------------------------------------------------
   tierlist-app - renderer.js
   Arquivo reorganizado com seções comentadas
   ------------------------------------------------------------------ */

/* ------------------------ CONFIG / STATE ------------------------ */


/* ------------------------ DOM REFS ------------------------ */
const items = document.querySelectorAll('.item');
const dropzones = document.querySelectorAll('.dropzone');

/* ------------------------ DRAG SOURCE SETUP ------------------------ */
items.forEach(item => {
  item.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', item.textContent);
    e.dataTransfer.effectAllowed = 'copy';
    item.classList.add('dragging');
  });
  item.addEventListener('dragend', () => item.classList.remove('dragging'));
});

/* ------------------------ UTIL: GRADE -> VALUE / COLOR ------------------------ */
function gradeToValue(text) {
  const t = (text || '').trim().toUpperCase();
  switch (t) {
    case 'D': return 0;
    case 'C': return 1;
    case 'B': return 2;
    case 'A': return 3;
    case 'S': return 4;
    case 'SS': return 5;
    default: return null;
  }
}

function valueToColor(norm) {
  // norm em 0..1
  const g = { r: 34,  g: 139, b: 34  }; // verde escuro
  const y = { r: 255, g: 223, b: 0   }; // amarelo
  const r = { r: 255, g: 0,   b: 0   }; // vermelho
  const t = Math.max(0, Math.min(1, norm));
  if (t <= 0.5) {
    const k = t * 2;
    const R = Math.round(g.r + (y.r - g.r) * k);
    const G = Math.round(g.g + (y.g - g.g) * k);
    const B = Math.round(g.b + (y.b - g.b) * k);
    return `rgb(${R}, ${G}, ${B})`;
  } else {
    const k = (t - 0.5) * 2;
    const R = Math.round(y.r + (r.r - y.r) * k);
    const G = Math.round(y.g + (r.g - y.g) * k);
    const B = Math.round(y.b + (r.b - y.b) * k);
    return `rgb(${R}, ${G}, ${B})`;
  }
}

/* ------------------------ VISUAL: UPDATE ROW COLOR ------------------------ */
function updateRowColor(row) {
  if (!row) return;
  const dzs = row.querySelectorAll('.dropzone');
  let sum = 0, count = 0;
  dzs.forEach(dz => {
    const it = dz.querySelector('.item');
    if (it) {
      const v = gradeToValue(it.textContent);
      if (v !== null) { sum += v; count++; }
    }
  });
  const title = row.querySelector('.slot-title');
  if (!title) return;
  if (count === 0) {
    row.style.backgroundImage = '';
    return;
  }
  const avg = sum / count; // 0..5
  const norm = Math.max(0, Math.min(1, avg / 5));
  const accent = valueToColor(norm);
  const BAND_WIDTH = 19; // largura fina minimalista
  row.style.backgroundImage = `linear-gradient(90deg, ${accent} 0 ${BAND_WIDTH}px, rgba(0,0,0,0) ${BAND_WIDTH}px 100%)`;
  row.style.backgroundRepeat = 'no-repeat';
  row.style.backgroundPosition = '0 0';
}

/* ------------------------ DROPZONE BEHAVIOR ------------------------ */
function addDropzoneEvents(zone) {
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => { zone.classList.remove('over'); });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('over');
    if (zone.querySelector('.item')) return;
    const itemText = e.dataTransfer.getData('text/plain');
    if (!itemText) return;

    const newItem = document.createElement('div');
    newItem.className = 'item dropped';
    newItem.textContent = itemText;
    newItem.setAttribute('draggable', 'true');

    newItem.addEventListener('dragstart', (ev) => {
      ev.dataTransfer.setData('text/plain', newItem.textContent);
      ev.dataTransfer.effectAllowed = 'copy';
    });

    newItem.addEventListener('dblclick', () => {
      newItem.remove();
      const row = zone.closest('.tier-row');
      updateRowColor(row);
      sortRowsByScore();
      saveState();
    });

    zone.querySelectorAll('.wave-effect').forEach(w => w.remove());
    const wave = document.createElement('div');
    wave.className = 'wave-effect';
    zone.appendChild(wave);

    zone.classList.add('wave-active');
    setTimeout(() => { zone.classList.remove('wave-active'); wave.remove(); }, 1200);

    zone.appendChild(newItem);
    setTimeout(() => newItem.classList.remove('dropped'), 600);

    const row = zone.closest('.tier-row');
    updateRowColor(row);
    sortRowsByScore();
    saveState();
  });
}

/* Aplica handlers às dropzones já existentes */
dropzones.forEach(addDropzoneEvents);

/* ------------------------ IMAGE UPLOAD ------------------------ */
function activateImageUpload(row) {
  const input = row.querySelector('.img-input');
  const preview = row.querySelector('.img-preview');
  if (!input || !preview) return;
  preview.onclick = () => input.click();
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      preview.src = ev.target.result;
      updateRowColor(row);
      sortRowsByScore();
      saveState();
    };
    reader.readAsDataURL(file);
  };
}

/* ------------------------ PERSISTÊNCIA (SAVE / LOAD) ------------------------ */
function saveState() {
  try {
    const container = document.getElementById('tiers-container');
    const rows = Array.from(container.querySelectorAll('.tier-row')).map(row => {
      const title = row.querySelector('.slot-title')?.value || '';
      const img = row.querySelector('.img-preview')?.src || '';
      const cells = Array.from(row.querySelectorAll('.type-cell')).map(cell => {
        const it = cell.querySelector('.dropzone .item');
        return it ? it.textContent : null;
      });
      return { title, img, cells };
    });
    const typeLabels = Array.from(document.querySelectorAll('.type-label-row .type-cell-label'))
      .map(l => l.textContent || '');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows, typeLabels }));
  } catch (err) { console.error('saveState error', err); }
}

function createTypeLabel(text) {
  const newLabel = document.createElement('div');
  newLabel.className = 'type-cell-label';
  newLabel.textContent = text || 'Novo';
  const startEdit = () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = newLabel.textContent;
    input.className = 'type-label-input';
    input.addEventListener('blur', () => {
      newLabel.textContent = input.value || 'Novo';
      newLabel.style.display = 'inline-block';
      input.remove();
      saveState();
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    newLabel.style.display = 'none';
    newLabel.parentNode.insertBefore(input, newLabel);
    input.focus();
  };
  newLabel.addEventListener('dblclick', startEdit);
  newLabel.addEventListener('click', startEdit);
  return newLabel;
}

function createRowFromState(state, templateRow) {
  const newRow = templateRow.cloneNode(true);
  const titleInput = newRow.querySelector('.slot-title');
  if (titleInput) {
    titleInput.value = state.title || '';
    titleInput.addEventListener('change', () => { updateRowColor(newRow); sortRowsByScore(); saveState(); });
    titleInput.addEventListener('blur', () => { updateRowColor(newRow); sortRowsByScore(); saveState(); });
  }
  const preview = newRow.querySelector('.img-preview');
  if (preview) preview.src = state.img || 'placeholder.png';

  const typeTable = newRow.querySelector('.type-table');
  const desired = state.cells ? state.cells.length : 0;
  typeTable.innerHTML = '';
  for (let i = 0; i < desired; i++) {
    const newCell = document.createElement('div');
    newCell.className = 'type-cell';
    const span = document.createElement('span');
    const dropzone = document.createElement('div');
    dropzone.className = 'dropzone';
    newCell.appendChild(span);
    newCell.appendChild(dropzone);
    typeTable.appendChild(newCell);

    const val = state.cells[i];
    if (val) {
      const item = document.createElement('div');
      item.className = 'item';
      item.textContent = val;
      item.setAttribute('draggable', 'true');
      item.addEventListener('dragstart', (ev) => {
        ev.dataTransfer.setData('text/plain', item.textContent);
        ev.dataTransfer.effectAllowed = 'copy';
      });
      dropzone.appendChild(item);
    }
    addDropzoneEvents(dropzone);
  }

  activateImageUpload(newRow);
  return newRow;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed) return false;
    const container = document.getElementById('tiers-container');
    const template = container.querySelector('.tier-row');
    if (!template) return false;
    container.innerHTML = '';
    parsed.rows.forEach(stateRow => {
      const newRow = createRowFromState(stateRow, template);
      container.appendChild(newRow);
    });
    const typeTableLabel = document.querySelector('.type-label-row .type-table');
    if (typeTableLabel) {
      typeTableLabel.innerHTML = '';
      (parsed.typeLabels || []).forEach(lbl => {
        const lab = createTypeLabel(lbl);
        typeTableLabel.appendChild(lab);
      });
    }
    document.querySelectorAll('.tier-row').forEach(row => {
      row.querySelectorAll('.dropzone').forEach(addDropzoneEvents);
      activateImageUpload(row);
      updateRowColor(row);
    });
    sortRowsByScore();
    return true;
  } catch (err) { console.error('loadState error', err); return false; }
}

/* ------------------------ SCORING & SORTING ------------------------ */
function computeRowScore(row) {
  const dzs = row.querySelectorAll('.dropzone');
  let sum = 0, count = 0;
  dzs.forEach(dz => {
    const it = dz.querySelector('.item');
    if (it) {
      const v = gradeToValue(it.textContent);
      if (v !== null) { sum += v; count++; }
    }
  });
  return count === 0 ? null : (sum / count);
}

function sortRowsByScore() {
  const container = document.getElementById('tiers-container');
  if (!container) return;
  const rows = Array.from(container.querySelectorAll('.tier-row'));
  const oldPositions = new Map(rows.map(r => [r, r.getBoundingClientRect().top]));
  const mapped = rows.map((r, idx) => ({ r, score: computeRowScore(r), idx }));
  mapped.sort((a, b) => {
    const sa = a.score, sb = b.score;
    if (sa === sb) return a.idx - b.idx;
    if (sa === null) return 1;
    if (sb === null) return -1;
    return sb - sa;
  });
  mapped.forEach(m => container.appendChild(m.r));
  requestAnimationFrame(() => {
    rows.forEach(row => {
      const oldPos = oldPositions.get(row);
      const newPos = row.getBoundingClientRect().top;
      const diff = newPos - oldPos;
      if (Math.abs(diff) > 5) {
        row.classList.add(diff < 0 ? 'moving-up' : 'moving-down');
        setTimeout(() => row.classList.remove('moving-up', 'moving-down'), 500);
      }
    });
  });
}

/* ------------------------ UI: ADD / LABELS ------------------------ */
document.getElementById('add-tier')?.addEventListener('click', () => {
  const container = document.getElementById('tiers-container');
  const firstRow = container.querySelector('.tier-row');
  if (!firstRow) return;
  const newRow = firstRow.cloneNode(true);
  const titleInput = newRow.querySelector('.slot-title');
  if (titleInput) titleInput.value = '';
  newRow.querySelectorAll('.dropzone').forEach(drop => { drop.innerHTML = ''; addDropzoneEvents(drop); });
  const preview = newRow.querySelector('.img-preview');
  if (preview) preview.src = 'placeholder.png';
  activateImageUpload(newRow);
  container.appendChild(newRow);
  updateRowColor(newRow);
  sortRowsByScore();
  saveState();
});

document.getElementById('add-type-label')?.addEventListener('click', () => {
  const typeTableLabel = document.querySelector('.type-label-row .type-table');
  if (!typeTableLabel) return;
  const newLabel = createTypeLabel('Novo');
  typeTableLabel.appendChild(newLabel);
  saveState();
  document.querySelectorAll('.tier-row').forEach(row => {
    const typeTable = row.querySelector('.type-table');
    const newCell = document.createElement('div');
    newCell.className = 'type-cell';
    const span = document.createElement('span');
    const dropzone = document.createElement('div');
    dropzone.className = 'dropzone';
    newCell.appendChild(span);
    newCell.appendChild(dropzone);
    addDropzoneEvents(dropzone);
    typeTable.appendChild(newCell);
  });
  document.querySelectorAll('.tier-row').forEach(r => updateRowColor(r));
  sortRowsByScore();
  saveState();
});

/* ------------------------ UI: ADD / LABELS ------------------------ */
function createTypeLabel(text) {
  const newLabel = document.createElement('div');
  newLabel.className = 'type-cell-label';
  newLabel.textContent = text || 'Novo';

  const startEdit = () => {
    if (newLabel._editing) return;
    newLabel._editing = true;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'type-label-input';
    input.value = newLabel.textContent || '';

    // copia estilos essenciais para preservar box/layout
    const cs = window.getComputedStyle(newLabel);
    input.style.width = cs.width;
    input.style.height = cs.height;
    input.style.boxSizing = cs.boxSizing;
    input.style.padding = cs.padding;
    input.style.margin = cs.margin;
    input.style.border = cs.border;
    input.style.borderRadius = cs.borderRadius;
    input.style.background = cs.backgroundColor;
    input.style.color = cs.color;
    input.style.font = cs.font;
    input.style.textAlign = cs.textAlign;
    input.style.display = cs.display === 'inline' ? 'inline-block' : cs.display;
    input.style.verticalAlign = cs.verticalAlign;

    const parent = newLabel.parentNode;
    const next = newLabel.nextSibling;

    // substitui o label pelo input no mesmo lugar do DOM (evita deslocamento)
    if (parent) parent.replaceChild(input, newLabel);
    else if (newLabel.parentNode == null && next) next.parentNode.insertBefore(input, next);

    requestAnimationFrame(() => {
      input.focus();
      try { input.setSelectionRange(0, input.value.length); } catch (e) {}
    });

    const finish = (apply) => {
      if (apply) newLabel.textContent = input.value || 'Novo';
      // restaura o label no mesmo local do DOM
      if (parent) parent.replaceChild(newLabel, input);
      else if (next && next.parentNode) next.parentNode.insertBefore(newLabel, next);
      newLabel._editing = false;
      if (apply && typeof saveState === 'function') saveState();
    };

    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      else if (e.key === 'Escape') {
        // cancelar: restaura label sem alterar texto
        if (parent) parent.replaceChild(newLabel, input);
        newLabel._editing = false;
      }
    });
  };

  newLabel.addEventListener('dblclick', startEdit);
  newLabel.addEventListener('click', startEdit);
  return newLabel;
}
// ...existing code...

/* ------------------------ INIT ------------------------ */
if (!loadState()) {
  document.querySelectorAll('.tier-row').forEach(row => {
    row.querySelectorAll('.dropzone').forEach(addDropzoneEvents);
    activateImageUpload(row);
    updateRowColor(row);
  });
  sortRowsByScore();
}


/* ------------------------ EXPORT / SHARE (single button) ------------------------ */

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ensureHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onload = () => resolve(window.html2canvas);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/**
 * Cria wrapper temporário com type-label-row + tiers-container (clonados)
 * copia valores de inputs/contenteditable e src de imagens.
 * Retorna { wrapper, cleanup }.
 */
function createExportWrapper() {
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.left = '-10000px';
  wrapper.style.top = '0';
  wrapper.style.background = '#ffffff';
  wrapper.style.padding = '12px';
  wrapper.style.zIndex = '99999';
  wrapper.style.boxSizing = 'border-box';
  wrapper.style.color = '#000';

  const labelRow = document.querySelector('.type-label-row');
  const tiers = document.getElementById('tiers-container');

  if (labelRow) {
    const cLabel = labelRow.cloneNode(true);
    // copia inputs e contenteditable
    Array.from(labelRow.querySelectorAll('input')).forEach((orig, i) => {
      const clones = cLabel.querySelectorAll('input');
      if (clones[i]) clones[i].value = orig.value || orig.textContent || '';
    });
    Array.from(labelRow.querySelectorAll('[contenteditable]')).forEach((orig, i) => {
      const clones = cLabel.querySelectorAll('[contenteditable]');
      if (clones[i]) clones[i].textContent = orig.textContent || '';
    });
    wrapper.appendChild(cLabel);
  }

  if (tiers) {
    const cTiers = tiers.cloneNode(true);
    const origRows = Array.from(tiers.querySelectorAll('.tier-row'));
    const cloneRows = Array.from(cTiers.querySelectorAll('.tier-row'));

    cloneRows.forEach((cr, i) => {
      const or = origRows[i];
      if (!or) return;
      // slot-title
      const origInput = or.querySelector('.slot-title');
      const cloneInput = cr.querySelector('.slot-title');
      if (origInput && cloneInput) {
        if ('value' in cloneInput) cloneInput.value = origInput.value || '';
        else cloneInput.textContent = origInput.value || origInput.textContent || '';
      }
      // imagens
      const origImg = or.querySelector('.img-preview');
      const cloneImg = cr.querySelector('.img-preview');
      if (origImg && cloneImg) cloneImg.src = origImg.src || origImg.getAttribute('src') || '';
      // itens nas dropzones
      const origCells = Array.from(or.querySelectorAll('.type-cell'));
      const cloneCells = Array.from(cr.querySelectorAll('.type-cell'));
      cloneCells.forEach((cc, ci) => {
        const oi = origCells[ci];
        if (!oi) return;
        const origItem = oi.querySelector('.dropzone .item');
        const cloneItem = cc.querySelector('.dropzone .item');
        if (origItem && !cloneItem) {
          const item = document.createElement('div');
          item.className = 'item';
          item.textContent = origItem.textContent;
          cc.querySelector('.dropzone')?.appendChild(item);
        } else if (origItem && cloneItem) {
          cloneItem.textContent = origItem.textContent;
        }
      });
    });

    wrapper.appendChild(cTiers);
  }

  document.body.appendChild(wrapper);
  return { wrapper, cleanup: () => wrapper.remove() };
}

async function generateExportPNGBlob() {
  await ensureHtml2Canvas();
  const { wrapper, cleanup } = createExportWrapper();
  try {
    const imgs = Array.from(wrapper.getElementsByTagName('img'));
    await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })));
    const canvas = await window.html2canvas(wrapper, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png', 1));
    return { blob, cleanup };
  } catch (err) {
    cleanup();
    throw err;
  }
}

document.getElementById('share-export')?.addEventListener('click', async function () {
  const btn = this;
  const original = btn.textContent;
  let cleanup = null;

  try {
    btn.disabled = true;
    btn.textContent = '⏳ Processando...';

    // gera blob + retorna função cleanup
    const result = await generateExportPNGBlob();
    const blob = result.blob;
    cleanup = result.cleanup;

    const file = new File([blob], 'tierlist.png', { type: blob.type });

    // 1) tenta compartilhar (não interrompe o fluxo em caso de sucesso/falha)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Minha Tier List', text: 'Veja minha tier list' })
        .catch(err => console.warn('Share API falhou (continua):', err));
    }

    // 2) tenta copiar para a área de transferência (não interrompe o fluxo)
    if (navigator.clipboard && window.ClipboardItem) {
      navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
        .then(() => console.log('Imagem copiada para clipboard'))
        .catch(err => console.warn('Clipboard falhou (continua):', err));
    }

    // 3) sempre salva um download (garante que há um arquivo salvo)
    downloadBlob(blob, 'tierlist.png');

    // feedback simples
    
  } catch (err) {
    console.error('Export/Share error', err);
    alert('Erro ao gerar/compartilhar/salvar imagem. Veja o console.');
  } finally {
    if (typeof cleanup === 'function') cleanup();
    btn.disabled = false;
    btn.textContent = original;
  }
});

// ...existing code...


/* Botão para salvar tier na biblioteca (pública/privada) */
document.getElementById('save-library')?.addEventListener('click', async () => {
  const name = prompt('Nome da Tier List:');
  if (!name) return;
  
  const isPublic = confirm('Tornar pública? (OK=Pública, Cancelar=Privada)');
  
  try {
    // gerar thumbnail (PNG)
    const result = await generateExportPNGBlob();
    const blob = result.blob;
    result.cleanup();
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const thumbnail = e.target.result; // base64 da imagem
      
      // coletar estado atual
      const container = document.getElementById('tiers-container');
      const rows = Array.from(container.querySelectorAll('.tier-row')).map(row => {
        const title = row.querySelector('.slot-title')?.value || '';
        const img = row.querySelector('.img-preview')?.src || '';
        const cells = Array.from(row.querySelectorAll('.type-cell')).map(cell => {
          const it = cell.querySelector('.dropzone .item');
          return it ? it.textContent : null;
        });
        return { title, img, cells };
      });
      const typeLabels = Array.from(document.querySelectorAll('.type-label-row .type-cell-label'))
        .map(l => l.textContent || '');
      
      // criar objeto tier
      const userId = localStorage.getItem('userId') || 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('userId', userId);
      
      const newTier = {
        id: 'tier_' + Date.now() + Math.random().toString(36).substr(2, 5),
        name,
        author: localStorage.getItem('userName') || 'Anônimo',
        authorId: userId,
        isPublic,
        thumbnail,
        rows,
        typeLabels,
        createdAt: new Date().toISOString()
      };
      
      // salvar em localStorage
      const STORAGE_KEY_TIERS = 'tierlist_all_tiers';
      let allTiers = [];
      try {
        const raw = localStorage.getItem(STORAGE_KEY_TIERS);
        allTiers = raw ? JSON.parse(raw) : [];
      } catch (e) {}
      
      allTiers.push(newTier);
      localStorage.setItem(STORAGE_KEY_TIERS, JSON.stringify(allTiers));
      
      alert(`✓ Tier List "${name}" salva com sucesso!`);
    };
    reader.readAsDataURL(blob);
  } catch (err) {
    console.error('Save library error', err);
    alert('Erro ao salvar na biblioteca');
  }
});

// ...existing code...

/* ------------------------ SAVE TO LIBRARY ------------------------ */
document.getElementById('save-library')?.addEventListener('click', async () => {
  const name = prompt('Nome da Tier List:');
  if (!name) return;
  const isPublic = confirm('Tornar pública? (OK=Pública, Cancelar=Privada)');

  try {
    // coletar estado atual (sem depender de html2canvas)
    const container = document.getElementById('tiers-container');
    const rows = Array.from(container.querySelectorAll('.tier-row')).map(row => {
      const titleEl = row.querySelector('.slot-title');
      const title = titleEl ? (titleEl.value ?? titleEl.textContent ?? '') : '';
      const img = row.querySelector('.img-preview')?.src || '';
      const cells = Array.from(row.querySelectorAll('.type-cell')).map(cell => {
        const it = cell.querySelector('.dropzone .item');
        return it ? it.textContent : null;
      });
      return { title, img, cells };
    });
    const typeLabels = Array.from(document.querySelectorAll('.type-label-row .type-cell-label'))
      .map(l => l.textContent || '');

    const userId = localStorage.getItem('userId') || 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('userId', userId);

    const newTier = {
      id: 'tier_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      name,
      author: localStorage.getItem('userName') || 'Anônimo',
      authorId: userId,
      isPublic,
      thumbnail: '', // será preenchido se gerar thumbnail com sucesso
      rows,
      typeLabels,
      createdAt: new Date().toISOString()
    };

    // grava imediatamente (garante que não "não salva nada")
    const STORAGE_KEY_TIERS = 'tierlist_all_tiers';
    let allTiers = [];
    try { allTiers = JSON.parse(localStorage.getItem(STORAGE_KEY_TIERS) || '[]'); } catch (e) { allTiers = []; }
    allTiers.push(newTier);
    localStorage.setItem(STORAGE_KEY_TIERS, JSON.stringify(allTiers));

    // tenta gerar thumbnail em background e atualizar entry (não bloqueante)
    try {
      const { blob, cleanup } = await generateExportPNGBlob();
      if (blob) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const listRaw = localStorage.getItem(STORAGE_KEY_TIERS);
            const list = listRaw ? JSON.parse(listRaw) : [];
            const t = list.find(x => x.id === newTier.id);
            if (t) { t.thumbnail = e.target.result; localStorage.setItem(STORAGE_KEY_TIERS, JSON.stringify(list)); }
          } catch (er) { console.warn('update thumbnail failed', er); }
        };
        reader.readAsDataURL(blob);
      }
      cleanup && cleanup();
    } catch (thumbErr) {
      console.warn('thumbnail generation failed (saved without thumbnail)', thumbErr);
    }

    // feedback simples
    // alert removido se preferir silencioso; use console log
    console.log(`Tier "${name}" salva na biblioteca.`);
  } catch (err) {
    console.error('Save library error', err);
    alert('Erro ao salvar na biblioteca');
  }
});

// ...existing code...

document.getElementById('load-json')?.addEventListener('click', () => {
  document.getElementById('import-json').click();
});

document.getElementById('import-json')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      applyImportedTier(data);
    } catch (err) {
      alert('Erro ao ler o arquivo JSON.');
      console.error(err);
    }
  };
  reader.readAsText(file);
});

function applyImportedTier(data) {
  const container = document.getElementById('tiers-container');
  const template = container.querySelector('.tier-row');
  container.innerHTML = '';

  const labelRow = document.querySelector('.type-label-row .type-table');
  if (labelRow) {
    const existingLabels = labelRow.querySelectorAll('.type-cell-label');
    existingLabels.forEach(el => el.remove());

    const addButton = document.getElementById('add-type-label');
    data.typeLabels.forEach(lbl => {
      const lab = createTypeLabel(lbl);
      labelRow.insertBefore(lab, addButton);
    });
  }

  data.rows.forEach(stateRow => {
  // Clona a linha, mas zera as avaliações
  const emptyRow = { ...stateRow, cells: stateRow.cells.map(() => null) };
  const newRow = createRowFromState(emptyRow, template);
  container.appendChild(newRow);
});

  document.querySelector('.tier-list-title').textContent = data.name || 'Tier List';

  document.querySelectorAll('.tier-row').forEach(row => {
    row.querySelectorAll('.dropzone').forEach(addDropzoneEvents);
    activateImageUpload(row);
    updateRowColor(row);
  });

  sortRowsByScore();
  saveState();

const addTierBtn = document.getElementById('add-tier');
if (addTierBtn) addTierBtn.style.display = 'none';

const addLabelBtn = document.getElementById('add-type-label');
if (addLabelBtn) addLabelBtn.style.display = 'none';


  alert(`✓ Tier "${data.name}" importada com sucesso.`);
}


