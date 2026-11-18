// app.js — Hand-Drawn Mess Inventory & Price Tracker
// Main application logic (vanilla JS SPA)

'use strict';

// ─── STATE ────────────────────────────────────────────────────────────────────

let priceChart = null;
let currentPriceHistory = [];
let selectedFilterDays = 7;
let currentInventory = [];
let currentPage = 'dashboard';

// ─── UTILITY: LOADING ─────────────────────────────────────────────────────────

function showLoading() {
  const el = document.getElementById('loadingOverlay');
  if (el) el.classList.remove('hidden');
}

function hideLoading() {
  const el = document.getElementById('loadingOverlay');
  if (el) el.classList.add('hidden');
}

// ─── UTILITY: TOAST ──────────────────────────────────────────────────────────

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Trigger reflow for transition
  void toast.offsetWidth;
  toast.classList.add('toast-visible');

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ─── UTILITY: FORMAT ─────────────────────────────────────────────────────────

function formatCurrency(val) {
  const num = parseFloat(val);
  if (isNaN(num)) return '₹0.00';
  return '₹' + num.toFixed(2);
}

function parseAppDate(str) {
  if (!str) return null;
  if (str instanceof Date && !isNaN(str.getTime())) return str;
  if (typeof str !== 'string') return null;

  const dmyMatch = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    const hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const minutes = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const date = new Date(year, month, day, hours, minutes);
    if (!isNaN(date.getTime())) return date;
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(str) {
  if (!str) return '—';
  const d = parseAppDate(str);
  if (!d) return str;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDateOnly(str) {
  if (!str) return '—';
  const d = parseAppDate(str);
  if (!d) return str;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function localDatetimeValue(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// ─── UTILITY: CONFIRM DIALOG ─────────────────────────────────────────────────

function confirmDialog(title, message) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirmModal');
    if (!modal) { resolve(false); return; }

    const titleEl = document.getElementById('confirmTitle');
    const msgEl   = document.getElementById('confirmMessage');
    const okBtn   = document.getElementById('confirmOkBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');

    if (titleEl) titleEl.textContent = title;
    if (msgEl)   msgEl.textContent   = message;

    showModal('confirmModal');

    function cleanup() {
      hideModal('confirmModal');
      okBtn && okBtn.removeEventListener('click', onOk);
      cancelBtn && cancelBtn.removeEventListener('click', onCancel);
    }

    function onOk()     { cleanup(); resolve(true); }
    function onCancel() { cleanup(); resolve(false); }

    okBtn     && okBtn.addEventListener('click', onOk,     { once: true });
    cancelBtn && cancelBtn.addEventListener('click', onCancel, { once: true });
  });
}

// ─── UTILITY: MODAL ──────────────────────────────────────────────────────────

function showModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('hidden');
    el.setAttribute('aria-hidden', 'false');
  }
}

function hideModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
  }
}

// ─── UTILITY: CATEGORY DROPDOWNS ─────────────────────────────────────────────

function populateCategoryDropdowns() {
  const catFilterIds = ['dashCategoryFilter', 'invCategoryFilter', 'histCategoryFilter'];
  catFilterIds.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">All Categories</option>';
    CONFIG.CATEGORIES.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      if (cat === cur) opt.selected = true;
      sel.appendChild(opt);
    });
  });

  const formCatIds = ['addCategory', 'editCategory'];
  formCatIds.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">Select category…</option>';
    CONFIG.CATEGORIES.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      if (cat === cur) opt.selected = true;
      sel.appendChild(opt);
    });
  });

  const unitIds = ['addUnit', 'editUnit'];
  unitIds.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">Select unit…</option>';
    CONFIG.UNITS.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      if (u === cur) opt.selected = true;
      sel.appendChild(opt);
    });
  });
}

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────

function statusBadge(status) {
  const map = {
    'Available':    'status-available',
    'In Stock':     'status-available',
    'Low Stock':    'status-low',
    'Out of Stock': 'status-out',
  };
  const cls = map[status] || 'status-available';
  const label = status || 'In Stock';
  return `<span class="status-badge ${cls}">${label}</span>`;
}

function getItemStatus(item) {
  const qty = parseFloat(item.quantity) || 0;
  const min = parseFloat(item.minStock) || 0;
  if (qty <= 0)       return 'Out of Stock';
  if (qty <= min)     return 'Low Stock';
  return 'In Stock';
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────

function navigateTo(pageId) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => {
    p.classList.add('hidden');
    p.classList.remove('active');
  });

  // Show target page
  const target = document.getElementById('page-' + pageId);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
  }

  // Update nav active state
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === pageId);
  });

  currentPage = pageId;

  // Load page data
  switch (pageId) {
    case 'dashboard':        loadDashboard();        break;
    case 'inventory':        loadInventory();        break;
    case 'add-item':         initAddItemPage();      break;
    case 'price-comparison': loadPriceComparison();  break;
    case 'history':          loadHistory();          break;
  }

  // Close mobile nav if open
  const mobileNav = document.getElementById('navLinks');
  if (mobileNav) mobileNav.classList.remove('open');
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

async function loadDashboard() {
  // Set current date
  const dateEl = document.getElementById('currentDate');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-IN', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    });
  }

  showLoading();
  try {
    const [stats, items] = await Promise.all([
      API.getStats(),
      API.getInventory(),
    ]);

    currentInventory = Array.isArray(items) ? items : [];

    // Update stat cards
    const statTotal   = document.getElementById('stat-total');
    const statInstock = document.getElementById('stat-instock');
    const statLow     = document.getElementById('stat-low');
    const statOut     = document.getElementById('stat-out');

    if (statTotal)   statTotal.textContent   = stats.totalItems   ?? currentInventory.length;
    if (statInstock) statInstock.textContent = stats.totalInStock ?? currentInventory.filter(i => getItemStatus(i) === 'In Stock').length;
    if (statLow)     statLow.textContent     = stats.lowStock     ?? currentInventory.filter(i => getItemStatus(i) === 'Low Stock').length;
    if (statOut)     statOut.textContent     = stats.outOfStock   ?? currentInventory.filter(i => getItemStatus(i) === 'Out of Stock').length;

    // Render dashboard table
    renderDashTable(currentInventory);

    // Recently updated — top 5
    renderRecentUpdates(currentInventory.slice(0, 5));

  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

function renderDashTable(items) {
  const tbody = document.getElementById('dashTableBody');
  if (!tbody) return;

  if (!items || items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">No items found.</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(item => {
    const status = item.status || getItemStatus(item);
    return `<tr>
      <td>${escHtml(item.itemName || '—')}</td>
      <td>${escHtml(item.category || '—')}</td>
      <td>${escHtml(String(item.quantity ?? '—'))} ${escHtml(item.unit || '')}</td>
      <td>${formatCurrency(item.purchasePrice)}</td>
      <td>${statusBadge(status)}</td>
      <td>${formatDate(item.lastUpdated || item.entryDate)}</td>
    </tr>`;
  }).join('');
}

function renderRecentUpdates(items) {
  const container = document.getElementById('recentUpdates');
  if (!container) return;

  if (!items || items.length === 0) {
    container.innerHTML = '<p class="empty-msg">No recent updates.</p>';
    return;
  }

  container.innerHTML = items.map(item => {
    const status = item.status || getItemStatus(item);
    return `<div class="recent-card">
      <div class="recent-card-name">${escHtml(item.itemName || '—')}</div>
      <div class="recent-card-meta">
        ${escHtml(item.category || '')} &middot; 
        ${escHtml(String(item.quantity ?? ''))} ${escHtml(item.unit || '')}
      </div>
      <div class="recent-card-status">${statusBadge(status)}</div>
      <div class="recent-card-date">${formatDate(item.lastUpdated || item.entryDate)}</div>
    </div>`;
  }).join('');
}

function applyDashFilters() {
  const search   = (document.getElementById('dashSearchInput')?.value || '').toLowerCase();
  const category = document.getElementById('dashCategoryFilter')?.value || '';

  const filtered = currentInventory.filter(item => {
    const matchSearch   = !search   || (item.itemName || '').toLowerCase().includes(search)
                                     || (item.category || '').toLowerCase().includes(search);
    const matchCategory = !category || item.category === category;
    return matchSearch && matchCategory;
  });

  renderDashTable(filtered);
}

// ─── INVENTORY ────────────────────────────────────────────────────────────────

async function loadInventory() {
  showLoading();
  try {
    const items = await API.getInventory();
    currentInventory = Array.isArray(items) ? items : [];
    renderInventoryTable(currentInventory);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

function renderInventoryTable(items) {
  const tbody  = document.getElementById('inventoryTableBody');
  const empty  = document.getElementById('inventoryEmpty');
  if (!tbody) return;

  if (!items || items.length === 0) {
    tbody.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }

  if (empty) empty.classList.add('hidden');

  tbody.innerHTML = items.map(item => {
    const status = item.status || getItemStatus(item);
    return `<tr data-id="${escHtml(item.itemId || '')}">
      <td>${escHtml(item.itemName || '—')}</td>
      <td>${escHtml(item.category || '—')}</td>
      <td>${escHtml(String(item.quantity ?? '—'))} ${escHtml(item.unit || '')}</td>
      <td>${formatCurrency(item.purchasePrice)}</td>
      <td>${escHtml(String(item.minStock ?? '—'))}</td>
      <td>${escHtml(item.supplier || '—')}</td>
      <td>${statusBadge(status)}</td>
      <td>${formatDate(item.updatedAt || item.lastUpdated || item.entryDate)}</td>
      <td class="action-cell">
        <button class="btn btn-secondary btn-sm" onclick="openEditModal('${escHtml(item.itemId)}')">Edit</button>
        <button class="btn btn-primary btn-sm" onclick="openUpdateQtyModal('${escHtml(item.itemId)}')">Qty</button>
        <button class="btn btn-danger btn-sm" onclick="handleDeleteItem('${escHtml(item.itemId)}')">Delete</button>
      </td>
    </tr>`;
  }).join('');
}

function applyInventoryFilters() {
  const search   = (document.getElementById('invSearchInput')?.value || '').toLowerCase();
  const category = document.getElementById('invCategoryFilter')?.value || '';
  const status   = document.getElementById('invStatusFilter')?.value || '';

  const filtered = currentInventory.filter(item => {
    const itemStatus    = item.status || getItemStatus(item);
    const matchSearch   = !search   || (item.itemName || '').toLowerCase().includes(search)
                                     || (item.category || '').toLowerCase().includes(search)
                                     || (item.supplier || '').toLowerCase().includes(search);
    const matchCategory = !category || item.category === category;
    const matchStatus   = !status   || itemStatus === status;
    return matchSearch && matchCategory && matchStatus;
  });

  renderInventoryTable(filtered);
}

async function handleDeleteItem(itemId) {
  const item = currentInventory.find(i => i.itemId === itemId);
  const name = item ? item.itemName : 'this item';
  const confirmed = await confirmDialog(
    'Delete Item',
    `Are you sure you want to delete "${name}"? This cannot be undone.`
  );
  if (!confirmed) return;

  showLoading();
  try {
    await API.deleteItem(itemId);
    showToast(`"${name}" deleted from register.`, 'success');
    await loadInventory();
    if (currentPage === 'dashboard') await loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

// ─── ADD ITEM PAGE ────────────────────────────────────────────────────────────

function initAddItemPage() {
  // Set default datetime to now
  const dateInput = document.getElementById('addEntryDate');
  if (dateInput) dateInput.value = localDatetimeValue();
}

async function handleAddItem(e) {
  e.preventDefault();

  const form = e.target;

  const data = {
    itemName:      form.querySelector('#addItemName')?.value.trim(),
    category:      form.querySelector('#addCategory')?.value,
    quantity:      parseFloat(form.querySelector('#addQuantity')?.value) || 0,
    unit:          form.querySelector('#addUnit')?.value,
    purchasePrice: parseFloat(form.querySelector('#addPurchasePrice')?.value) || 0,
    minStock:      parseFloat(form.querySelector('#addMinStock')?.value) || 0,
    supplier:      form.querySelector('#addSupplier')?.value.trim() || '',
    notes:         form.querySelector('#addNotes')?.value.trim() || '',
    entryDate:     form.querySelector('#addEntryDate')?.value || new Date().toISOString(),
  };

  // Validation
  if (!data.itemName) { showToast('Item name is required.', 'error'); return; }
  if (!data.category) { showToast('Category is required.', 'error'); return; }
  if (!data.unit)     { showToast('Unit is required.', 'error'); return; }

  showLoading();
  try {
    await API.addItem(data);
    showToast(`"${data.itemName}" added to inventory!`, 'success');
    form.reset();
    initAddItemPage(); // reset date
    navigateTo('inventory');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

// ─── EDIT ITEM MODAL ──────────────────────────────────────────────────────────

function openEditModal(itemOrId) {
  let item = null;
  if (typeof itemOrId === 'object' && itemOrId !== null) {
    item = itemOrId;
  } else if (typeof itemOrId === 'string') {
    item = currentInventory.find(i => i.itemId === itemOrId);
    if (!item) {
      try { item = JSON.parse(itemOrId); } catch {}
    }
  }
  if (!item) return;

  const modal = document.getElementById('editModal');
  if (!modal) return;

  // Populate fields
  setVal('editItemId',       item.itemId       || '');
  setVal('editItemName',     item.itemName     || '');
  setVal('editCategory',     item.category     || '');
  setVal('editQuantity',     item.quantity     ?? '');
  setVal('editUnit',         item.unit         || '');
  setVal('editPurchasePrice',item.purchasePrice ?? '');
  setVal('editMinStock',     item.minStock     ?? '');
  setVal('editSupplier',     item.supplier     || '');
  setVal('editNotes',        item.notes        || '');

  showModal('editModal');
}

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

async function handleEditSave() {
  const data = {
    itemId:        getVal('editItemId'),
    itemName:      getVal('editItemName').trim(),
    category:      getVal('editCategory'),
    quantity:      parseFloat(getVal('editQuantity')) || 0,
    unit:          getVal('editUnit'),
    purchasePrice: parseFloat(getVal('editPurchasePrice')) || 0,
    minStock:      parseFloat(getVal('editMinStock')) || 0,
    supplier:      getVal('editSupplier').trim(),
    notes:         getVal('editNotes').trim(),
  };

  if (!data.itemId)   { showToast('Invalid item.', 'error'); return; }
  if (!data.itemName) { showToast('Item name is required.', 'error'); return; }
  if (!data.category) { showToast('Category is required.', 'error'); return; }

  showLoading();
  try {
    await API.editItem(data);
    hideModal('editModal');
    showToast(`"${data.itemName}" updated.`, 'success');
    await loadInventory();
    if (currentPage === 'dashboard') await loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

// ─── UPDATE QUANTITY MODAL ────────────────────────────────────────────────────

function openUpdateQtyModal(itemId) {
  const item = currentInventory.find(i => i.itemId === itemId);
  if (!item) return;

  setVal('uqItemId',      item.itemId);
  setVal('uqItemName',    item.itemName);
  setVal('uqNewQuantity', item.quantity || 0);
  setVal('uqType',        'Stock Added');
  setVal('uqNotes',       '');

  const nameDisplay = document.getElementById('uqItemNameDisplay');
  if (nameDisplay) nameDisplay.textContent = `${item.itemName} (Current Stock: ${item.quantity} ${item.unit})`;

  showModal('updateQtyModal');
}

async function handleUpdateQty() {
  const itemId        = getVal('uqItemId');
  const newQuantity   = parseFloat(getVal('uqNewQuantity'));
  const transactionType = getVal('uqType') || 'Stock Added';
  const notes         = getVal('uqNotes').trim();

  if (!itemId) { showToast('Invalid item.', 'error'); return; }
  if (isNaN(newQuantity) || newQuantity < 0) {
    showToast('Please enter a valid quantity.', 'error'); return;
  }

  showLoading();
  try {
    await API.updateQuantity({ itemId, newQuantity, transactionType, notes });
    hideModal('updateQtyModal');
    showToast('Quantity updated.', 'success');
    if (currentPage === 'inventory') await loadInventory();
    else if (currentPage === 'dashboard') await loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

// ─── PRICE COMPARISON PAGE ────────────────────────────────────────────────────

async function loadPriceComparison() {
  showLoading();
  try {
    const items = await API.getInventory();
    const select = document.getElementById('priceItemSelect');
    if (!select) return;

    const prevVal = select.value;
    select.innerHTML = '<option value="">— Select an item —</option>';

    (Array.isArray(items) ? items : []).forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.itemId;
      opt.textContent = item.itemName + ' (' + (item.unit || '') + ')';
      select.appendChild(opt);
    });

    // Restore previous selection or auto-select first item
    if (prevVal && select.querySelector(`option[value="${prevVal}"]`)) {
      select.value = prevVal;
      await loadItemPriceHistory(prevVal);
    } else if (items && items.length > 0) {
      select.value = items[0].itemId;
      await loadItemPriceHistory(items[0].itemId);
    } else {
      const statsSection = document.getElementById('priceStatsSection');
      const emptyState   = document.getElementById('priceEmptyState');
      if (statsSection) statsSection.classList.add('hidden');
      if (emptyState)   emptyState.classList.remove('hidden');
    }
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

async function loadItemPriceHistory(itemId) {
  if (!itemId) return;

  showLoading();
  try {
    const history = await API.getPriceHistory(itemId);
    currentPriceHistory = Array.isArray(history) ? history : [];

    // Show stats section, hide empty state
    const statsSection = document.getElementById('priceStatsSection');
    const emptyState   = document.getElementById('priceEmptyState');
    if (statsSection) statsSection.classList.remove('hidden');
    if (emptyState)   emptyState.classList.add('hidden');

    // Update price stats cards
    updatePriceStats(currentPriceHistory);

    // Render chart with current filter
    const filtered = filterByDays(currentPriceHistory, selectedFilterDays);
    renderPriceChart(filtered);

    // Render price history table
    renderPriceHistoryTable(currentPriceHistory);

  } catch (err) {
    showToast(err.message, 'error');
    currentPriceHistory = [];
    const statsSection = document.getElementById('priceStatsSection');
    const emptyState   = document.getElementById('priceEmptyState');
    if (statsSection) statsSection.classList.add('hidden');
    if (emptyState)   emptyState.classList.remove('hidden');
  } finally {
    hideLoading();
  }
}

function updatePriceStats(history) {
  if (!history || history.length === 0) {
    setTextContent('statCurrentPrice', '—');
    setTextContent('statLowestPrice',  '—');
    setTextContent('statHighestPrice', '—');
    setTextContent('statPriceChange',  '—');
    return;
  }

  const prices = history.map(h => parseFloat(h.price)).filter(p => !isNaN(p));
  if (prices.length === 0) return;

  const current  = prices[prices.length - 1];
  const lowest   = Math.min(...prices);
  const highest  = Math.max(...prices);
  const first    = prices[0];
  const change   = first !== 0 ? ((current - first) / first * 100) : 0;

  setTextContent('statCurrentPrice', formatCurrency(current));
  setTextContent('statLowestPrice',  formatCurrency(lowest));
  setTextContent('statHighestPrice', formatCurrency(highest));

  const changeEl = document.getElementById('statPriceChange');
  if (changeEl) {
    const sign = change >= 0 ? '+' : '';
    changeEl.textContent = `${sign}${change.toFixed(1)}%`;
    changeEl.className   = change >= 0 ? 'stat-value price-up' : 'stat-value price-down';
  }
}

function setTextContent(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function filterByDays(history, days) {
  if (!days || days === 0) return history;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return history.filter(h => {
    const d = parseAppDate(h.timestamp || h.date || h.entryDate);
    return d && d >= cutoff;
  });
}

function filterPriceData(days) {
  selectedFilterDays = days;

  // Update active button state
  document.querySelectorAll('.chart-filter-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.days) === days);
  });

  const filtered = filterByDays(currentPriceHistory, days);
  renderPriceChart(filtered);
  updatePriceStats(filtered.length ? filtered : currentPriceHistory);
}

function renderPriceChart(data) {
  const canvas = document.getElementById('priceChart');
  if (!canvas) return;

  // Destroy existing chart
  if (priceChart) {
    priceChart.destroy();
    priceChart = null;
  }

  if (!data || data.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const labels = data.map(h => {
    const d = parseAppDate(h.timestamp || h.date || h.entryDate);
    return d ? formatDateOnly(d) : (h.timestamp || h.date || '');
  });

  const prices = data.map(h => parseFloat(h.price) || 0);

  priceChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Price (₹)',
        data: prices,
        borderColor:          '#4A6B8A',
        backgroundColor:      'rgba(74,107,138,0.08)',
        pointBackgroundColor: '#4A6B8A',
        pointBorderColor:     '#4A6B8A',
        tension:              0.3,
        borderWidth:          2,
        pointRadius:          4,
        pointHoverRadius:     6,
        fill:                 true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `₹${parseFloat(ctx.parsed.y).toFixed(2)}`,
            title: items => items[0].label,
          },
        },
      },
      scales: {
        x: {
          grid: {
            color:     '#D4C9B0',
            borderDash: [4, 4],
          },
          ticks: {
            font: { family: 'Nunito', size: 11 },
            color: '#6B6457',
            maxRotation: 45,
          },
        },
        y: {
          grid: {
            color:     '#D4C9B0',
            borderDash: [4, 4],
          },
          ticks: {
            font:     { family: 'Nunito', size: 11 },
            color:    '#6B6457',
            callback: val => '₹' + parseFloat(val).toFixed(2),
          },
        },
      },
    },
  });
}

function renderPriceHistoryTable(history) {
  const tbody = document.getElementById('priceHistoryBody');
  if (!tbody) return;

  if (!history || history.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No price history available.</td></tr>';
    return;
  }

  // Show newest first
  const sorted = [...history].reverse();
  tbody.innerHTML = sorted.map(h => `<tr>
    <td>${formatDate(h.timestamp || h.date || h.entryDate)}</td>
    <td>${formatCurrency(h.price)}</td>
    <td>${escHtml(h.priceUnit || '—')}</td>
    <td>${escHtml(h.supplier || '—')}</td>
    <td>${escHtml(h.notes || '—')}</td>
  </tr>`).join('');
}

// ─── ADD PRICE ENTRY MODAL ────────────────────────────────────────────────────

function openAddPriceModal(itemId, itemName) {
  setVal('addPriceItemId',   itemId   || '');
  setVal('addPriceItemName', itemName || '');
  setVal('addPriceValue',    '');
  setVal('addPriceUnit',     'per kg');
  setVal('addPriceSupplier', '');
  setVal('addPriceNotes',    '');
  setVal('addPriceDate',     localDatetimeValue());

  showModal('addPriceModal');
}

async function handleSavePrice() {
  const itemId    = getVal('addPriceItemId');
  const price     = parseFloat(getVal('addPriceValue'));
  const priceUnit = getVal('addPriceUnit').trim();
  const supplier  = getVal('addPriceSupplier').trim();
  const notes     = getVal('addPriceNotes').trim();
  const timestamp = getVal('addPriceDate') || new Date().toISOString();

  if (!itemId)         { showToast('No item selected.', 'error'); return; }
  if (isNaN(price) || price <= 0) { showToast('Enter a valid price.', 'error'); return; }

  showLoading();
  try {
    await API.addPriceEntry({ itemId, price, priceUnit, supplier, notes, timestamp });
    hideModal('addPriceModal');
    showToast('Price entry added.', 'success');

    // Reload history for selected item
    const selectedId = document.getElementById('priceItemSelect')?.value;
    if (selectedId) await loadItemPriceHistory(selectedId);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

// ─── HISTORY PAGE ─────────────────────────────────────────────────────────────

async function loadHistory(filters = {}) {
  showLoading();
  try {
    const transactions = await API.getTransactions(filters);
    renderHistoryTable(Array.isArray(transactions) ? transactions : []);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

function renderHistoryTable(transactions) {
  const tbody = document.getElementById('historyTableBody');
  const empty = document.getElementById('historyEmpty');
  if (!tbody) return;

  // Apply local text search
  const search = (document.getElementById('histSearchInput')?.value || '').toLowerCase();
  const display = search
    ? transactions.filter(t =>
        (t.itemName || '').toLowerCase().includes(search) ||
        (t.transactionType || '').toLowerCase().includes(search) ||
        (t.notes || '').toLowerCase().includes(search))
    : transactions;

  if (!display || display.length === 0) {
    tbody.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }

  if (empty) empty.classList.add('hidden');

  const typeColors = {
    'Stock Added':       'txn-added',
    'Stock Removed':     'txn-removed',
    'Stock Correction':  'txn-correction',
    'Price Update':      'txn-price',
  };

  tbody.innerHTML = display.map(txn => {
    const type    = txn.transactionType || txn.type || '—';
    const typeCls = typeColors[type] || '';
    return `<tr>
      <td>${formatDate(txn.timestamp || txn.date)}</td>
      <td>${escHtml(txn.itemName || '—')}</td>
      <td>${escHtml(txn.category || '—')}</td>
      <td><span class="txn-type ${typeCls}">${escHtml(type)}</span></td>
      <td>${escHtml(String(txn.quantityChange ?? txn.quantity ?? '—'))}</td>
      <td>${escHtml(String(txn.newQuantity ?? '—'))}</td>
      <td>${escHtml(txn.notes || '—')}</td>
    </tr>`;
  }).join('');
}

function collectHistoryFilters() {
  return {
    type:      document.getElementById('histTypeFilter')?.value  || '',
    startDate: document.getElementById('histStartDate')?.value   || '',
    endDate:   document.getElementById('histEndDate')?.value     || '',
    category:  document.getElementById('histCategoryFilter')?.value || '',
  };
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── INITIALIZATION ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // ── Populate dropdowns ──────────────────────────────────────────────────────
  populateCategoryDropdowns();

  // ── Set date/time defaults ──────────────────────────────────────────────────
  const addEntryDate = document.getElementById('addEntryDate');
  if (addEntryDate) addEntryDate.value = localDatetimeValue();

  // ── Nav link clicks ─────────────────────────────────────────────────────────
  document.querySelectorAll('.nav-link[data-page]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(link.dataset.page);
    });
  });

  // ── Mobile nav toggle ───────────────────────────────────────────────────────
  const mobileToggle = document.getElementById('mobileNavToggle');
  const mobileNav    = document.getElementById('navLinks');
  if (mobileToggle && mobileNav) {
    mobileToggle.addEventListener('click', () => {
      mobileNav.classList.toggle('open');
    });
  }

  // ── Dashboard filters ───────────────────────────────────────────────────────
  document.getElementById('dashSearchInput')?.addEventListener('input', applyDashFilters);
  document.getElementById('dashCategoryFilter')?.addEventListener('change', applyDashFilters);

  // ── Inventory filters ───────────────────────────────────────────────────────
  document.getElementById('invSearchInput')?.addEventListener('input', applyInventoryFilters);
  document.getElementById('invCategoryFilter')?.addEventListener('change', applyInventoryFilters);
  document.getElementById('invStatusFilter')?.addEventListener('change', applyInventoryFilters);

  // ── Add Item form ───────────────────────────────────────────────────────────
  document.getElementById('addItemForm')?.addEventListener('submit', handleAddItem);

  // ── Edit modal buttons ──────────────────────────────────────────────────────
  document.getElementById('saveEditBtn')?.addEventListener('click', handleEditSave);
  document.getElementById('cancelEditBtn')?.addEventListener('click', () => hideModal('editModal'));

  // ── Update Qty modal buttons ────────────────────────────────────────────────
  document.getElementById('saveUqBtn')?.addEventListener('click', handleUpdateQty);
  document.getElementById('cancelUqBtn')?.addEventListener('click', () => hideModal('updateQtyModal'));

  // ── Price comparison ────────────────────────────────────────────────────────
  document.getElementById('priceItemSelect')?.addEventListener('change', e => {
    if (e.target.value) loadItemPriceHistory(e.target.value);
    else {
      const statsSection = document.getElementById('priceStatsSection');
      const emptyState   = document.getElementById('priceEmptyState');
      if (statsSection) statsSection.classList.add('hidden');
      if (emptyState)   emptyState.classList.remove('hidden');
    }
  });

  document.querySelectorAll('.chart-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => filterPriceData(parseInt(btn.dataset.days) || 0));
  });

  document.getElementById('addPriceEntryBtn')?.addEventListener('click', () => {
    const sel = document.getElementById('priceItemSelect');
    const itemId   = sel?.value;
    const itemName = sel?.options[sel.selectedIndex]?.text || '';
    if (!itemId) { showToast('Please select an item first.', 'error'); return; }
    openAddPriceModal(itemId, itemName);
  });

  // ── Add Price modal buttons ─────────────────────────────────────────────────
  document.getElementById('savePriceBtn')?.addEventListener('click', handleSavePrice);
  document.getElementById('cancelPriceBtn')?.addEventListener('click', () => hideModal('addPriceModal'));

  // ── History filters ─────────────────────────────────────────────────────────
  document.getElementById('histFilterBtn')?.addEventListener('click', () => {
    loadHistory(collectHistoryFilters());
  });

  document.getElementById('histSearchInput')?.addEventListener('input', () => {
    loadHistory(collectHistoryFilters());
  });

  document.getElementById('histClearBtn')?.addEventListener('click', () => {
    ['histTypeFilter', 'histStartDate', 'histEndDate', 'histCategoryFilter', 'histSearchInput'].forEach(id => setVal(id, ''));
    loadHistory();
  });

  // ── Connection modal buttons ───────────────────────────────────────────────
  function updateConnBadge() {
    const isConn = API.isConfigured();
    const textEl = document.getElementById('connStatusText');
    const dotEl  = document.getElementById('connIndicatorDot');
    const descEl = document.getElementById('connStatusDesc');
    const inputEl = document.getElementById('cfgScriptUrl');

    if (textEl) textEl.textContent = isConn ? 'Sheets: Connected' : 'Sheets Setup';
    if (dotEl)  dotEl.style.backgroundColor = isConn ? 'var(--color-green)' : 'var(--color-yellow)';
    if (descEl) {
      const url = API.getEffectiveScriptUrl();
      descEl.textContent = isConn
        ? '🟢 Connected to Google Sheets: ' + (url.length > 40 ? url.slice(0, 40) + '…' : url)
        : '🟡 Using Sample / Demo Data (Offline)';
      descEl.style.color = isConn ? 'var(--color-green-dark)' : 'var(--color-yellow-dark)';
    }
    if (inputEl && isConn) {
      inputEl.value = API.getEffectiveScriptUrl();
    }
  }

  document.getElementById('openConnBtn')?.addEventListener('click', () => {
    updateConnBadge();
    showModal('connModal');
  });

  document.getElementById('cancelConnBtn')?.addEventListener('click', () => hideModal('connModal'));

  document.getElementById('saveConnBtn')?.addEventListener('click', async () => {
    const url = (document.getElementById('cfgScriptUrl')?.value || '').trim();
    if (!url || !url.startsWith('http')) {
      showToast('Please enter a valid https:// script URL', 'error');
      return;
    }
    API.setScriptUrl(url);
    updateConnBadge();
    hideModal('connModal');
    showToast('Saved! Connecting to Google Sheets…', 'success');
    await loadDashboard();
  });

  document.getElementById('resetDemoBtn')?.addEventListener('click', async () => {
    API.clearScriptUrl();
    const inputEl = document.getElementById('cfgScriptUrl');
    if (inputEl) inputEl.value = '';
    updateConnBadge();
    hideModal('connModal');
    showToast('Switched to Sample Demo Data', 'info');
    await loadDashboard();
  });

  // ── Confirm modal cancel on overlay ────────────────────────────────────────
  document.getElementById('confirmModal')?.addEventListener('click', e => {
    if (e.target.id === 'confirmModal') {
      hideModal('confirmModal');
    }
  });

  // ── Generic modal overlay close ─────────────────────────────────────────────
  ['editModal', 'updateQtyModal', 'addPriceModal', 'connModal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', e => {
      if (e.target.id === id) hideModal(id);
    });
  });

  // ── Keyboard: Escape closes any open modal ──────────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      ['editModal', 'updateQtyModal', 'addPriceModal', 'confirmModal', 'connModal'].forEach(hideModal);
    }
  });

  updateConnBadge();

  // ── Load initial page ───────────────────────────────────────────────────────
  navigateTo('dashboard');

  // ── Pre-load price item list ────────────────────────────────────────────────
  // (runs in background; errors are silently suppressed here since dashboard is primary)
  API.getInventory().then(items => {
    currentInventory = Array.isArray(items) ? items : [];
    const select = document.getElementById('priceItemSelect');
    if (select && select.options.length <= 1) {
      currentInventory.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.itemId;
        opt.textContent = item.itemName + ' (' + (item.unit || '') + ')';
        select.appendChild(opt);
      });
    }
  }).catch(() => {});
});
