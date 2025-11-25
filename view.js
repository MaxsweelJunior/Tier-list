/* ------------------------ VIEW: render read-only tier from library ------------------------ */
const STORAGE_KEY_TIERS = 'tierlist_all_tiers';

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

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
    s.onerror = () => reject(new Error('Failed to load html2canvas'));
    document.head.appendChild(s);
  });
}

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
  const g = { r: 34,  g: 139, b: 34  };
  const y = { r: 255, g: 223, b: 0   };
  const r = { r: 255, g: 0,   b: 0   };
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
  if (count === 0) { row.style.backgroundImage = ''; return; }
  const avg = sum / count;
  const norm = Math.max(0, Math.min(1, avg / 5));
  const accent = valueToColor(norm);
  const BAND_WIDTH = 19;
  row.style.backgroundImage = `linear-gradient(90deg, ${accent} 0 ${BAND_WIDTH}px, rgba(0,0,0,0) ${BAND_WIDTH}px 100%)`;
  row.style.backgroundRepeat = 'no-repeat';
}

let currentTier = null;

function loadAndDisplayTier() {
  const id = getQueryParam('id');
  if (!id) return;
  
  const raw = localStorage.getItem(STORAGE_KEY_TIERS);
  const all = raw ? JSON.parse(raw) : [];
  const tier = all.find(t => t.id === id);
  if (!tier) return;
  
  currentTier = tier;

  // título
  const titleEl = document.querySelector('.tier-list-title');
  if (titleEl) {
    titleEl.textContent = tier.name || 'Tier List';
    titleEl.setAttribute('contenteditable', 'false');
  }

  // labels
  const labelTable = document.querySelector('.type-label-row .type-table');
  if (labelTable) {
    // remove botão de adicionar label
    labelTable.innerHTML = '';
    (tier.typeLabels || []).forEach(lbl => {
      const lab = document.createElement('div');
      lab.className = 'type-cell-label';
      lab.textContent = lbl || '';
      labelTable.appendChild(lab);
    });
  }

       // rows
  const container = document.getElementById('tiers-container');
  container.innerHTML = '';
  (tier.rows || []).forEach(rowData => {
    const row = document.createElement('div');
    row.className = 'tier-row';

    // imagem
    const imgBox = document.createElement('div'); imgBox.className = 'img-box';
    const img = document.createElement('img'); img.className = 'img-preview';
    img.src = rowData.img || 'placeholder.png';
    imgBox.appendChild(img);

    // título (desabilitado)
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'slot-title';
    titleInput.value = rowData.title || '';
    titleInput.disabled = true;
    titleInput.style.pointerEvents = 'none';

    // type-table: cria células, PULANDO vazias no INÍCIO
    const typeTable = document.createElement('div'); typeTable.className = 'type-table';
    const cells = Array.isArray(rowData.cells) ? rowData.cells : [];
    
    // encontra índice do primeiro item preenchido
    let startIdx = 0;
    while (startIdx < cells.length && (cells[startIdx] === null || cells[startIdx] === undefined || String(cells[startIdx]).trim() === '')) {
      startIdx++;
    }
    
    // cria células a partir do primeiro preenchido (inclui vazias do meio e final)
    for (let i = startIdx; i < cells.length; i++) {
      const cellVal = cells[i];
      const cell = document.createElement('div'); cell.className = 'type-cell';
      const span = document.createElement('span');
      const dz = document.createElement('div'); dz.className = 'dropzone';
      if (cellVal) {
        const item = document.createElement('div'); item.className = 'item';
        item.textContent = cellVal;
        dz.appendChild(item);
      }
      // se vazia, dz fica vazio (mas existe)
      cell.appendChild(span);
      cell.appendChild(dz);
      typeTable.appendChild(cell);
    }

    row.appendChild(imgBox);
    row.appendChild(titleInput);
    row.appendChild(typeTable);
    container.appendChild(row);

    updateRowColor(row);
  });

  // habilita botão de download se existir
  const dl = document.getElementById('download-tier');
  if (dl) dl.disabled = false;
}

/* download PNG com crédito */
document.getElementById('download-tier')?.addEventListener('click', async function () {
  if (!currentTier) return;
  const btn = this;
  const orig = btn.textContent;
  try {
    btn.disabled = true; btn.textContent = '⏳ Gerando...';
    await ensureHtml2Canvas();
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.left = '-200000px';
    wrapper.style.top = '0';
    wrapper.style.background = '#ffffff';
    wrapper.style.padding = '12px';
    wrapper.style.zIndex = '99999';
    wrapper.style.boxSizing = 'border-box';
    wrapper.style.color = '#000';
    wrapper.style.pointerEvents = 'none';

    const labelRow = document.querySelector('.type-label-row');
    if (labelRow) wrapper.appendChild(labelRow.cloneNode(true));
    wrapper.appendChild(document.getElementById('tiers-container').cloneNode(true));

    const credit = document.createElement('div');
    credit.style.position = 'absolute';
    credit.style.bottom = '8px';
    credit.style.left = '8px';
    credit.style.fontSize = '10px';
    credit.style.color = '#666';
    credit.style.fontFamily = 'Arial, sans-serif';
    credit.textContent = `Criado por: ${currentTier.author || 'Anônimo'}`;
    wrapper.appendChild(credit);

    document.body.appendChild(wrapper);
    const imgs = Array.from(wrapper.getElementsByTagName('img'));
    await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })));
    const canvas = await window.html2canvas(wrapper, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
    wrapper.remove();
    canvas.toBlob(blob => { if (blob) downloadBlob(blob, `${currentTier.name || 'tierlist'}.png`); }, 'image/png', 1);
  } catch (err) {
    console.error('download error', err);
  } finally {
    btn.disabled = false; btn.textContent = orig;
  }
});

loadAndDisplayTier();

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

document.getElementById('export-json')?.addEventListener('click', () => {
  const title = document.querySelector('.tier-list-title')?.textContent || 'Tier List';

  const typeLabels = Array.from(document.querySelectorAll('.type-label-row .type-cell-label'))
    .map(el => el.textContent || '');

  const rows = Array.from(document.querySelectorAll('.tier-row')).map(row => {
    const title = row.querySelector('.slot-title')?.value || '';
    const img = row.querySelector('.img-preview')?.src || '';
    const cells = Array.from(row.querySelectorAll('.type-cell')).map(cell => {
      const item = cell.querySelector('.dropzone .item');
      return item ? item.textContent : null;
    });
    return { title, img, cells };
  });

  const data = { name: title, typeLabels, rows };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/\s+/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
});
