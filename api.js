// api.js — Google Apps Script API layer & Data Manager
// Hand-Drawn Mess Inventory & Price Tracker

// ─── CONFIGURATION ────────────────────────────────────────────────────────────

// Default Apps Script Web App URL (can be set here or configured in the UI)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxa6kjkiVcRqnaXzWoNgKYdMR4goNXNAXOK8j5NKwAbu2m_qsY1PGrUoXLk0g9iA2Kd/exec';

const CONFIG = {
  CATEGORIES: [
    'Vegetables',
    'Fruits',
    'Rice & Grains',
    'Pulses & Dal',
    'Dairy Products',
    'Meat & Fish',
    'Cooking Essentials',
    'Cleaning Supplies',
    'Other',
  ],
  UNITS: ['kg', 'g', 'litre', 'ml', 'packet', 'piece', 'Sack', 'box', 'dozen', 'other'],
  LOW_STOCK_COLOR: '#D4A843',
  OUT_STOCK_COLOR: '#B85C5C',
  IN_STOCK_COLOR: '#5C7A5C',
};

// ─── ENDPOINT HELPERS ─────────────────────────────────────────────────────────

function getEffectiveScriptUrl() {
  try {
    const custom = localStorage.getItem('MESS_SCRIPT_URL');
    if (custom && custom.trim().startsWith('http')) {
      return custom.trim();
    }
  } catch { }
  if (SCRIPT_URL && SCRIPT_URL !== 'YOUR_APPS_SCRIPT_URL_HERE' && SCRIPT_URL.startsWith('http')) {
    return SCRIPT_URL;
  }
  return null;
}

function setScriptUrl(url) {
  if (url && typeof url === 'string' && url.trim().startsWith('http')) {
    localStorage.setItem('MESS_SCRIPT_URL', url.trim());
    return true;
  }
  localStorage.removeItem('MESS_SCRIPT_URL');
  return false;
}

function clearScriptUrl() {
  localStorage.removeItem('MESS_SCRIPT_URL');
}

function isConfigured() {
  return !!getEffectiveScriptUrl();
}

// ─── TIMESTAMP HELPER (IST: DD/MM/YY HH:MM) ──────────────────────────────────

function getIstTimestamp(date = new Date()) {
  const d = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} ${hh}:${min}`;
}

// ─── DATA NORMALIZERS ─────────────────────────────────────────────────────────
// Converts backend PascalCase fields to frontend camelCase

function normalizeItem(item) {
  if (!item) return item;
  return {
    itemId: item.ItemID || item.itemId || '',
    itemName: item.ItemName || item.itemName || '',
    category: item.Category || item.category || '',
    quantity: parseFloat(item.Quantity ?? item.quantity) || 0,
    unit: item.Unit || item.unit || '',
    purchasePrice: parseFloat(item.PurchasePrice ?? item.purchasePrice) || 0,
    minStock: parseFloat(item.MinStock ?? item.minStock) || 0,
    supplier: item.Supplier || item.supplier || '',
    notes: item.Notes || item.notes || '',
    createdAt: item.CreatedAt || item.createdAt || '',
    updatedAt: item.UpdatedAt || item.updatedAt || item.lastUpdated || '',
    lastUpdated: item.UpdatedAt || item.updatedAt || item.lastUpdated || '',
    status: item.Status || item.status || 'In Stock',
  };
}

function normalizePriceEntry(entry) {
  if (!entry) return entry;
  return {
    entryId: entry.EntryID || entry.entryId || '',
    itemId: entry.ItemID || entry.itemId || '',
    itemName: entry.ItemName || entry.itemName || '',
    price: parseFloat(entry.Price ?? entry.price) || 0,
    priceUnit: entry.PriceUnit || entry.priceUnit || '',
    supplier: entry.Supplier || entry.supplier || '',
    timestamp: entry.Timestamp || entry.timestamp || entry.date || '',
    notes: entry.Notes || entry.notes || '',
  };
}

function normalizeTransaction(txn) {
  if (!txn) return txn;
  return {
    transactionId: txn.TransactionID || txn.transactionId || '',
    itemId: txn.ItemID || txn.itemId || '',
    itemName: txn.ItemName || txn.itemName || '',
    category: txn.Category || txn.category || '',
    transactionType: txn.TransactionType || txn.transactionType || txn.type || '',
    quantityChange: parseFloat(txn.QuantityChanged ?? txn.quantityChange ?? txn.quantity) || 0,
    previousQty: parseFloat(txn.PreviousQty ?? txn.previousQty) || 0,
    newQuantity: parseFloat(txn.UpdatedQty ?? txn.newQuantity) || 0,
    price: parseFloat(txn.Price ?? txn.price) || 0,
    timestamp: txn.Timestamp || txn.timestamp || txn.date || '',
    notes: txn.Notes || txn.notes || '',
  };
}

// ─── IN-MEMORY DEMO DATABASE ──────────────────────────────────────────────────
// Provides instant, realistic sample data when not yet connected to Google Sheets.

const DEMO_STORE = {
  initialized: false,

  inventory: [
    { itemId: 'ITM101', itemName: 'Basmati Rice (Royal)', category: 'Rice & Grains', quantity: 50, unit: 'kg', purchasePrice: 85, minStock: 20, supplier: 'Anand Agro Traders', notes: 'Grade A long grain for daily mess dinner', createdAt: '01/09/26 10:30', updatedAt: '15/11/26 14:20', status: 'In Stock' },
    { itemId: 'ITM102', itemName: 'Toor Dal (Unpolished)', category: 'Pulses & Dal', quantity: 28, unit: 'kg', purchasePrice: 148, minStock: 15, supplier: 'Kisan Mandi Direct', notes: 'Desi variety, zero polish', createdAt: '05/09/26 11:00', updatedAt: '16/11/26 09:15', status: 'In Stock' },
    { itemId: 'ITM103', itemName: 'Refined Sunflower Oil', category: 'Cooking Essentials', quantity: 22, unit: 'litre', purchasePrice: 132, minStock: 12, supplier: 'Deepak Oil Mills', notes: '15L tins converted to litres', createdAt: '10/09/26 16:40', updatedAt: '14/11/26 18:00', status: 'In Stock' },
    { itemId: 'ITM104', itemName: 'Pahadi Potatoes', category: 'Vegetables', quantity: 45, unit: 'kg', purchasePrice: 26, minStock: 25, supplier: 'APMC Sabzi Mandi', notes: 'Fresh dry lot', createdAt: '15/09/26 08:30', updatedAt: '16/11/26 07:45', status: 'In Stock' },
    { itemId: 'ITM105', itemName: 'Red Nasik Onions', category: 'Vegetables', quantity: 8, unit: 'kg', purchasePrice: 39, minStock: 18, supplier: 'APMC Sabzi Mandi', notes: 'Price spiked this month, need re-stock', createdAt: '15/09/26 08:30', updatedAt: '16/11/26 11:30', status: 'Low Stock' },
    { itemId: 'ITM106', itemName: 'Hybrid Fresh Tomatoes', category: 'Vegetables', quantity: 0, unit: 'kg', purchasePrice: 44, minStock: 10, supplier: 'APMC Sabzi Mandi', notes: 'Finished today morning during breakfast prep', createdAt: '20/09/26 09:00', updatedAt: '17/11/26 08:00', status: 'Out of Stock' },
    { itemId: 'ITM107', itemName: 'Full Cream Milk (Pouch)', category: 'Dairy Products', quantity: 18, unit: 'litre', purchasePrice: 64, minStock: 12, supplier: 'Amul Dairy Depot', notes: 'Delivered fresh daily morning 6 AM', createdAt: '01/09/26 06:00', updatedAt: '17/11/26 06:15', status: 'In Stock' },
    { itemId: 'ITM108', itemName: 'Fresh Dairy Paneer', category: 'Dairy Products', quantity: 4, unit: 'kg', purchasePrice: 385, minStock: 6, supplier: 'Amul Dairy Depot', notes: 'Required for special Wednesday dinner', createdAt: '01/10/26 12:00', updatedAt: '15/11/26 16:45', status: 'Low Stock' },
    { itemId: 'ITM109', itemName: 'Heavy Dishwash Liquid', category: 'Cleaning Supplies', quantity: 12, unit: 'litre', purchasePrice: 115, minStock: 5, supplier: 'CleanCare Enterprise', notes: 'Commercial concentrate 5L cans', createdAt: '01/09/26 14:00', updatedAt: '10/11/26 15:30', status: 'In Stock' },
  ],

  priceHistory: [
    // Basmati Rice history (gradual slight rise)
    { entryId: 'PRC101', itemId: 'ITM101', itemName: 'Basmati Rice (Royal)', price: 78, priceUnit: 'per kg', supplier: 'Anand Agro Traders', timestamp: '01/06/26 10:00', notes: 'Summer bulk rate' },
    { entryId: 'PRC102', itemId: 'ITM101', itemName: 'Basmati Rice (Royal)', price: 80, priceUnit: 'per kg', supplier: 'Anand Agro Traders', timestamp: '20/07/26 11:30', notes: 'Market revision' },
    { entryId: 'PRC103', itemId: 'ITM101', itemName: 'Basmati Rice (Royal)', price: 82, priceUnit: 'per kg', supplier: 'Anand Agro Traders', timestamp: '05/09/26 14:00', notes: 'New crop initial batch' },
    { entryId: 'PRC104', itemId: 'ITM101', itemName: 'Basmati Rice (Royal)', price: 84, priceUnit: 'per kg', supplier: 'Anand Agro Traders', timestamp: '22/10/26 12:15', notes: 'Festive season delivery' },
    { entryId: 'PRC105', itemId: 'ITM101', itemName: 'Basmati Rice (Royal)', price: 85, priceUnit: 'per kg', supplier: 'Anand Agro Traders', timestamp: '15/11/26 14:20', notes: 'Latest bulk bag purchase' },

    // Toor Dal history (fluctuating)
    { entryId: 'PRC201', itemId: 'ITM102', itemName: 'Toor Dal (Unpolished)', price: 135, priceUnit: 'per kg', supplier: 'Kisan Mandi Direct', timestamp: '10/06/26 10:00', notes: 'Old stock rate' },
    { entryId: 'PRC202', itemId: 'ITM102', itemName: 'Toor Dal (Unpolished)', price: 142, priceUnit: 'per kg', supplier: 'Kisan Mandi Direct', timestamp: '15/08/26 11:00', notes: 'Monsoon supply crunch' },
    { entryId: 'PRC203', itemId: 'ITM102', itemName: 'Toor Dal (Unpolished)', price: 152, priceUnit: 'per kg', supplier: 'Kisan Mandi Direct', timestamp: '01/10/26 16:00', notes: 'Peak festive wholesale' },
    { entryId: 'PRC204', itemId: 'ITM102', itemName: 'Toor Dal (Unpolished)', price: 148, priceUnit: 'per kg', supplier: 'Kisan Mandi Direct', timestamp: '16/11/26 09:15', notes: 'Slight cooling in mandi' },

    // Red Nasik Onions (volatile market tracker demo)
    { entryId: 'PRC301', itemId: 'ITM105', itemName: 'Red Nasik Onions', price: 24, priceUnit: 'per kg', supplier: 'APMC Sabzi Mandi', timestamp: '01/06/26 08:00', notes: 'Regular season harvest' },
    { entryId: 'PRC302', itemId: 'ITM105', itemName: 'Red Nasik Onions', price: 28, priceUnit: 'per kg', supplier: 'APMC Sabzi Mandi', timestamp: '15/07/26 08:30', notes: 'Monsoon transport extra' },
    { entryId: 'PRC303', itemId: 'ITM105', itemName: 'Red Nasik Onions', price: 32, priceUnit: 'per kg', supplier: 'APMC Sabzi Mandi', timestamp: '20/08/26 09:15', notes: 'Mandi arrival dipped' },
    { entryId: 'PRC304', itemId: 'ITM105', itemName: 'Red Nasik Onions', price: 44, priceUnit: 'per kg', supplier: 'APMC Sabzi Mandi', timestamp: '15/10/26 08:45', notes: 'Heavy rains in Nasik' },
    { entryId: 'PRC305', itemId: 'ITM105', itemName: 'Red Nasik Onions', price: 39, priceUnit: 'per kg', supplier: 'APMC Sabzi Mandi', timestamp: '16/11/26 11:30', notes: 'New crop arrivals starting' },

    // Full Cream Milk
    { entryId: 'PRC401', itemId: 'ITM107', itemName: 'Full Cream Milk (Pouch)', price: 60, priceUnit: 'per litre', supplier: 'Amul Dairy Depot', timestamp: '01/06/26 06:00', notes: 'Standard contract rate' },
    { entryId: 'PRC402', itemId: 'ITM107', itemName: 'Full Cream Milk (Pouch)', price: 62, priceUnit: 'per litre', supplier: 'Amul Dairy Depot', timestamp: '01/09/26 06:00', notes: 'Official Amul ₹2 hike' },
    { entryId: 'PRC403', itemId: 'ITM107', itemName: 'Full Cream Milk (Pouch)', price: 64, priceUnit: 'per litre', supplier: 'Amul Dairy Depot', timestamp: '01/11/26 06:00', notes: 'Winter procurement revision' },
  ],

  transactions: [
    { transactionId: 'TXN101', itemId: 'ITM106', itemName: 'Hybrid Fresh Tomatoes', category: 'Vegetables', transactionType: 'Stock Removed', quantityChange: 6, previousQty: 6, newQuantity: 0, price: 44, timestamp: '17/11/26 08:00', notes: 'Breakfast & lunch curry prep' },
    { transactionId: 'TXN102', itemId: 'ITM107', itemName: 'Full Cream Milk (Pouch)', category: 'Dairy Products', transactionType: 'Stock Added', quantityChange: 20, previousQty: 3, newQuantity: 18, price: 64, timestamp: '17/11/26 06:15', notes: 'Daily morning crate intake' },
    { transactionId: 'TXN103', itemId: 'ITM102', itemName: 'Toor Dal (Unpolished)', category: 'Pulses & Dal', transactionType: 'Stock Added', quantityChange: 30, previousQty: 4, newQuantity: 28, price: 148, timestamp: '16/11/26 09:15', notes: 'Brought 30kg sack from Mandi' },
    { transactionId: 'TXN104', itemId: 'ITM105', itemName: 'Red Nasik Onions', category: 'Vegetables', transactionType: 'Stock Removed', quantityChange: 12, previousQty: 20, newQuantity: 8, price: 39, timestamp: '16/11/26 11:30', notes: 'Used for lunch biryani gravy' },
    { transactionId: 'TXN105', itemId: 'ITM101', itemName: 'Basmati Rice (Royal)', category: 'Rice & Grains', transactionType: 'Stock Added', quantityChange: 50, previousQty: 8, newQuantity: 50, price: 85, timestamp: '15/11/26 14:20', notes: 'Received 50kg bag from Anand Traders' },
    { transactionId: 'TXN106', itemId: 'ITM108', itemName: 'Fresh Dairy Paneer', category: 'Dairy Products', transactionType: 'Stock Correction', quantityChange: 1, previousQty: 5, newQuantity: 4, price: 385, timestamp: '15/11/26 16:45', notes: 'Weight adjustment on weighing scale' },
  ],

  activityLog: [
    { logId: 'LOG001', action: 'Stock Removed', itemId: 'ITM106', itemName: 'Hybrid Fresh Tomatoes', description: 'Stock reduced to 0 (Out of stock)', timestamp: '17/11/26 08:00' },
    { logId: 'LOG002', action: 'Stock Added', itemId: 'ITM107', itemName: 'Full Cream Milk (Pouch)', description: 'Added 20L fresh milk', timestamp: '17/11/26 06:15' },
    { logId: 'LOG003', action: 'Price Update', itemId: 'ITM105', itemName: 'Red Nasik Onions', description: 'Recorded new price ₹39/kg', timestamp: '16/11/26 11:30' },
  ],

  computeStatus(qty, min) {
    if (qty <= 0) return 'Out of Stock';
    if (qty <= min) return 'Low Stock';
    return 'In Stock';
  },

  getStats() {
    let totalItems = 0;
    let totalInStock = 0;
    let lowStock = 0;
    let outOfStock = 0;

    this.inventory.forEach(item => {
      if (item.status === 'Deleted') return;
      totalItems++;
      const st = this.computeStatus(item.quantity, item.minStock);
      if (st === 'In Stock') totalInStock++;
      else if (st === 'Low Stock') lowStock++;
      else if (st === 'Out of Stock') outOfStock++;
    });

    return { totalItems, totalInStock, lowStock, outOfStock };
  },

  addItem(data) {
    const ts = getIstTimestamp();
    const itemId = 'ITM' + Date.now().toString().slice(-6);
    const qty = parseFloat(data.quantity) || 0;
    const min = parseFloat(data.minStock) || 0;
    const price = parseFloat(data.purchasePrice) || 0;
    const status = this.computeStatus(qty, min);

    const newItem = {
      itemId,
      itemName: data.itemName || '',
      category: data.category || 'Other',
      quantity: qty,
      unit: data.unit || 'kg',
      purchasePrice: price,
      minStock: min,
      supplier: data.supplier || '',
      notes: data.notes || '',
      createdAt: ts,
      updatedAt: ts,
      lastUpdated: ts,
      status,
    };

    this.inventory.unshift(newItem);

    // Initial price entry
    if (price > 0) {
      this.priceHistory.push({
        entryId: 'PRC' + Date.now().toString().slice(-6),
        itemId,
        itemName: newItem.itemName,
        price,
        priceUnit: 'per ' + newItem.unit,
        supplier: newItem.supplier,
        timestamp: ts,
        notes: 'Initial price on registration',
      });
    }

    // Initial stock transaction
    this.transactions.unshift({
      transactionId: 'TXN' + Date.now().toString().slice(-6),
      itemId,
      itemName: newItem.itemName,
      category: newItem.category,
      transactionType: 'Stock Added',
      quantityChange: qty,
      previousQty: 0,
      newQuantity: qty,
      price,
      timestamp: ts,
      notes: 'Initial item stock entry',
    });

    return { itemId, status };
  },

  editItem(data) {
    const item = this.inventory.find(i => i.itemId === data.itemId);
    if (!item) throw new Error('Item not found in register');

    const prevPrice = item.purchasePrice;
    const prevQty = item.quantity;
    const ts = getIstTimestamp();

    if (data.itemName !== undefined) item.itemName = data.itemName;
    if (data.category !== undefined) item.category = data.category;
    if (data.quantity !== undefined) item.quantity = parseFloat(data.quantity) || 0;
    if (data.unit !== undefined) item.unit = data.unit;
    if (data.purchasePrice !== undefined) item.purchasePrice = parseFloat(data.purchasePrice) || 0;
    if (data.minStock !== undefined) item.minStock = parseFloat(data.minStock) || 0;
    if (data.supplier !== undefined) item.supplier = data.supplier;
    if (data.notes !== undefined) item.notes = data.notes;

    item.updatedAt = ts;
    item.lastUpdated = ts;
    item.status = this.computeStatus(item.quantity, item.minStock);

    // If price changed, record to price history
    if (item.purchasePrice !== prevPrice && item.purchasePrice > 0) {
      this.priceHistory.push({
        entryId: 'PRC' + Date.now().toString().slice(-6),
        itemId: item.itemId,
        itemName: item.itemName,
        price: item.purchasePrice,
        priceUnit: 'per ' + item.unit,
        supplier: item.supplier,
        timestamp: ts,
        notes: 'Price updated during edit',
      });
    }

    // If qty changed, record to transactions
    if (item.quantity !== prevQty) {
      const diff = Math.abs(item.quantity - prevQty);
      const type = item.quantity > prevQty ? 'Stock Added' : 'Stock Removed';
      this.transactions.unshift({
        transactionId: 'TXN' + Date.now().toString().slice(-6),
        itemId: item.itemId,
        itemName: item.itemName,
        category: item.category,
        transactionType: type,
        quantityChange: diff,
        previousQty: prevQty,
        newQuantity: item.quantity,
        price: item.purchasePrice,
        timestamp: ts,
        notes: 'Quantity adjusted during edit',
      });
    }

    return item;
  },

  updateQuantity({ itemId, newQuantity, transactionType, notes }) {
    const item = this.inventory.find(i => i.itemId === itemId);
    if (!item) throw new Error('Item not found');

    const prevQty = item.quantity;
    const nextQty = parseFloat(newQuantity) || 0;
    const diff = Math.abs(nextQty - prevQty);
    const ts = getIstTimestamp();

    item.quantity = nextQty;
    item.updatedAt = ts;
    item.lastUpdated = ts;
    item.status = this.computeStatus(nextQty, item.minStock);

    this.transactions.unshift({
      transactionId: 'TXN' + Date.now().toString().slice(-6),
      itemId,
      itemName: item.itemName,
      category: item.category,
      transactionType: transactionType || (nextQty >= prevQty ? 'Stock Added' : 'Stock Removed'),
      quantityChange: diff,
      previousQty: prevQty,
      newQuantity: nextQty,
      price: item.purchasePrice,
      timestamp: ts,
      notes: notes || '',
    });

    return { itemId, newQty: nextQty, status: item.status };
  },

  deleteItem(itemId) {
    const idx = this.inventory.findIndex(i => i.itemId === itemId);
    if (idx !== -1) {
      const item = this.inventory[idx];
      this.inventory.splice(idx, 1);
      this.transactions.unshift({
        transactionId: 'TXN' + Date.now().toString().slice(-6),
        itemId,
        itemName: item.itemName,
        category: item.category,
        transactionType: 'Item Deleted',
        quantityChange: item.quantity,
        previousQty: item.quantity,
        newQuantity: 0,
        price: item.purchasePrice,
        timestamp: getIstTimestamp(),
        notes: 'Item removed from register',
      });
    }
    return { success: true };
  },

  addPriceEntry(data) {
    const item = this.inventory.find(i => i.itemId === data.itemId);
    const ts = data.timestamp ? getIstTimestamp(new Date(data.timestamp)) : getIstTimestamp();
    const price = parseFloat(data.price) || 0;

    const entry = {
      entryId: 'PRC' + Date.now().toString().slice(-6),
      itemId: data.itemId,
      itemName: (item && item.itemName) || data.itemName || '',
      price,
      priceUnit: data.priceUnit || (item ? 'per ' + item.unit : ''),
      supplier: data.supplier || (item ? item.supplier : ''),
      timestamp: ts,
      notes: data.notes || '',
    };

    this.priceHistory.push(entry);

    if (item && price > 0) {
      item.purchasePrice = price;
      item.updatedAt = ts;
      item.lastUpdated = ts;
    }

    return entry;
  },
};

// ─── API LAYER ─────────────────────────────────────────────────────────────────

const API = {

  /** Check if the live Google Sheets backend is configured */
  isConfigured,
  getEffectiveScriptUrl,
  setScriptUrl,
  clearScriptUrl,

  /**
   * Generic GET helper.
   * Dispatches to live Google Apps Script endpoint or Demo store.
   */
  async get(params) {
    const urlStr = getEffectiveScriptUrl();

    if (!urlStr) {
      // Offline / Demo mode
      return API.handleDemoGet(params);
    }

    const url = new URL(urlStr);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v));
      }
    });

    let response;
    try {
      response = await fetch(url.toString(), { method: 'GET', mode: 'cors' });
    } catch (err) {
      console.warn('Live API request failed, falling back to local demo:', err.message);
      return API.handleDemoGet(params);
    }

    if (!response.ok) {
      throw new Error(`Google Apps Script error: ${response.status} ${response.statusText}`);
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('Invalid JSON received from Google Apps Script Web App.');
    }

    if (!data.success) {
      throw new Error(data.error || 'Server reported an error');
    }

    return data.data;
  },

  /**
   * Generic POST helper.
   */
  async post(payload) {
    const urlStr = getEffectiveScriptUrl();

    if (!urlStr) {
      return API.handleDemoPost(payload);
    }

    let response;
    try {
      response = await fetch(urlStr, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // Avoids CORS pre-flight block in Apps Script
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn('Live API write failed, falling back to local demo:', err.message);
      return API.handleDemoPost(payload);
    }

    if (!response.ok) {
      throw new Error(`Google Apps Script error: ${response.status} ${response.statusText}`);
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('Invalid JSON received from Google Apps Script Web App.');
    }

    if (!data.success) {
      throw new Error(data.error || 'Server error on save');
    }

    return data.data;
  },

  // ── DEMO DISPATCHERS ─────────────────────────────────────────────────────────

  handleDemoGet(params) {
    const action = params.action;
    switch (action) {
      case 'getInventory':
        return DEMO_STORE.inventory.filter(i => i.status !== 'Deleted');
      case 'getStats':
        return DEMO_STORE.getStats();
      case 'getItem':
        return DEMO_STORE.inventory.find(i => i.itemId === params.itemId) || null;
      case 'getPriceHistory':
        return DEMO_STORE.priceHistory
          .filter(p => p.itemId === params.itemId)
          .slice()
          .sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));
      case 'getAllPriceHistory':
        return DEMO_STORE.priceHistory.slice();
      case 'getTransactions': {
        let list = DEMO_STORE.transactions.slice();
        if (params.type) list = list.filter(t => t.transactionType === params.type);
        if (params.itemId) list = list.filter(t => t.itemId === params.itemId);
        if (params.category) list = list.filter(t => t.category === params.category);
        return list;
      }
      case 'getActivityLog':
        return DEMO_STORE.activityLog.slice();
      default:
        return [];
    }
  },

  handleDemoPost(payload) {
    const action = payload.action;
    switch (action) {
      case 'addItem':
        return DEMO_STORE.addItem(payload);
      case 'editItem':
        return DEMO_STORE.editItem(payload);
      case 'updateQuantity':
        return DEMO_STORE.updateQuantity(payload);
      case 'deleteItem':
        return DEMO_STORE.deleteItem(payload.itemId);
      case 'addPriceEntry':
        return DEMO_STORE.addPriceEntry(payload);
      default:
        throw new Error('Unknown demo action: ' + action);
    }
  },

  // ── READ OPERATIONS ──────────────────────────────────────────────────────────

  /** Fetch the full inventory list (normalized to camelCase). */
  async getInventory() {
    const raw = await API.get({ action: 'getInventory' });
    return Array.isArray(raw) ? raw.map(normalizeItem) : [];
  },

  /** Fetch dashboard statistics. */
  async getStats() {
    return API.get({ action: 'getStats' });
  },

  /** Fetch a single item by ID (normalized). */
  async getItem(itemId) {
    const raw = await API.get({ action: 'getItem', itemId });
    return raw ? normalizeItem(raw) : null;
  },

  /** Fetch price history for a specific item (normalized). */
  async getPriceHistory(itemId) {
    const raw = await API.get({ action: 'getPriceHistory', itemId });
    return Array.isArray(raw) ? raw.map(normalizePriceEntry) : [];
  },

  /** Fetch price history for all items. */
  async getAllPriceHistory() {
    const raw = await API.get({ action: 'getAllPriceHistory' });
    return Array.isArray(raw) ? raw.map(normalizePriceEntry) : [];
  },

  /** Fetch transaction log with optional filters. */
  async getTransactions(filters = {}) {
    const raw = await API.get({ action: 'getTransactions', ...filters });
    return Array.isArray(raw) ? raw.map(normalizeTransaction) : [];
  },

  /** Fetch recent activity log. */
  async getActivityLog() {
    return API.get({ action: 'getActivityLog' });
  },

  // ── WRITE OPERATIONS ─────────────────────────────────────────────────────────

  /** Add a new inventory item. */
  addItem: (data) => API.post({ action: 'addItem', ...data }),

  /** Edit an existing item by itemId. */
  editItem: (data) => API.post({ action: 'editItem', ...data }),

  /** Soft-delete an item by itemId. */
  deleteItem: (itemId) => API.post({ action: 'deleteItem', itemId }),

  /** Update quantity and log a transaction. */
  updateQuantity: (data) => API.post({ action: 'updateQuantity', ...data }),

  /** Add a new price history entry (never overwrites old entries). */
  addPriceEntry: (data) => API.post({ action: 'addPriceEntry', ...data }),
};
