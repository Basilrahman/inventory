/**
 * ============================================================
 * Hand-Drawn Mess Inventory & Price Tracker — Google Apps Script Backend
 * ============================================================
 *
 * HOW TO DEPLOY AS A WEB APP:
 * 1. Open Google Apps Script: https://script.google.com
 * 2. Create a new project (or open an existing one bound to your Sheet).
 * 3. Paste this entire file as Code.gs.
 * 4. Click "Deploy" → "New deployment".
 * 5. Select type: "Web app".
 * 6. Set "Execute as": Me (your Google account).
 * 7. Set "Who has access": Anyone (no sign-in required for the frontend).
 * 8. Click "Deploy" and copy the Web App URL.
 * 9. Paste the Web App URL into your frontend's API_URL constant.
 *
 * HOW TO SET SPREADSHEET_ID IN SCRIPT PROPERTIES:
 * 1. In the Apps Script editor, go to Project Settings (gear icon).
 * 2. Scroll to "Script Properties" and click "Add script property".
 * 3. Key: SPREADSHEET_ID
 * 4. Value: The ID of your Google Sheet (from its URL:
 *    https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit)
 * 5. Save. If not set, the script falls back to the active spreadsheet.
 *
 * REQUIRED PERMISSIONS:
 * - Google Sheets (read & write) — to store inventory data.
 * - Script Properties (read) — to retrieve SPREADSHEET_ID.
 * - No external URL fetch or Drive access required.
 * ============================================================
 */

// ─── Constants ────────────────────────────────────────────────────────────────

var SHEET_INVENTORY      = 'Inventory';
var SHEET_PRICE_HISTORY  = 'PriceHistory';
var SHEET_TRANSACTIONS   = 'StockTransactions';
var SHEET_ACTIVITY_LOG   = 'ActivityLog';

var HEADERS = {
  Inventory: [
    'ItemID', 'ItemName', 'Category', 'Quantity', 'Unit',
    'PurchasePrice', 'MinStock', 'Supplier', 'Notes',
    'CreatedAt', 'UpdatedAt', 'Status'
  ],
  PriceHistory: [
    'EntryID', 'ItemID', 'ItemName', 'Price', 'PriceUnit',
    'Supplier', 'Timestamp', 'Notes'
  ],
  StockTransactions: [
    'TransactionID', 'ItemID', 'ItemName', 'TransactionType',
    'QuantityChanged', 'PreviousQty', 'UpdatedQty', 'Price',
    'Timestamp', 'Notes'
  ],
  ActivityLog: [
    'LogID', 'Action', 'ItemID', 'ItemName', 'Description', 'Timestamp'
  ]
};

// ─── Spreadsheet Access ───────────────────────────────────────────────────────

function getSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPREADSHEET_ID');
  if (id) {
    return SpreadsheetApp.openById(id);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

// ─── Helper: Get/Create Sheet ────────────────────────────────────────────────

function getSheet(name) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    var headers = HEADERS[name];
    if (headers) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

// ─── Sheet Initialization ─────────────────────────────────────────────────────

function initSheets() {
  var ss = getSpreadsheet();
  var sheetNames = [SHEET_INVENTORY, SHEET_PRICE_HISTORY, SHEET_TRANSACTIONS, SHEET_ACTIVITY_LOG];
  sheetNames.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      var headers = HEADERS[name];
      if (headers) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.setFrozenRows(1);
      }
    }
  });
}

// ─── Helper: Timestamp (IST, DD/MM/YY HH:MM) ────────────────────────────────

function getTimestamp() {
  var now = new Date();
  var ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  var dd   = String(ist.getDate()).padStart(2, '0');
  var mm   = String(ist.getMonth() + 1).padStart(2, '0');
  var yy   = String(ist.getFullYear()).slice(-2);
  var hh   = String(ist.getHours()).padStart(2, '0');
  var min  = String(ist.getMinutes()).padStart(2, '0');
  return dd + '/' + mm + '/' + yy + ' ' + hh + ':' + min;
}

// ─── Helper: Generate ID ─────────────────────────────────────────────────────

function generateId(prefix) {
  var now = new Date();
  var ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  var ts = String(ist.getFullYear()).slice(-2)
         + String(ist.getMonth() + 1).padStart(2, '0')
         + String(ist.getDate()).padStart(2, '0')
         + String(ist.getHours()).padStart(2, '0')
         + String(ist.getMinutes()).padStart(2, '0')
         + String(ist.getSeconds()).padStart(2, '0');
  var rand = String(Math.floor(Math.random() * 900) + 100); // 100–999
  return prefix + ts + rand;
}

// ─── Helper: Row → Object ────────────────────────────────────────────────────

function rowToObject(headers, row) {
  var obj = {};
  headers.forEach(function(header, i) {
    obj[header] = row[i] !== undefined ? row[i] : '';
  });
  return obj;
}

// ─── Helper: Find Row By ID ───────────────────────────────────────────────────
// Returns 1-based row index (including header), or -1 if not found.

function findRowById(sheet, idColumn, id) {
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return -1;
  var headers = data[0];
  var colIdx = headers.indexOf(idColumn);
  if (colIdx === -1) return -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colIdx]) === String(id)) {
      return i + 1; // 1-based
    }
  }
  return -1;
}

// ─── Helper: Compute Status ────────────────────────────────────────────────────

function computeStatus(quantity, minStock) {
  var qty = Number(quantity) || 0;
  var min = Number(minStock) || 0;
  if (qty <= 0)   return 'Out of Stock';
  if (qty <= min) return 'Low Stock';
  return 'In Stock';
}

// ─── Helper: JSON Response ─────────────────────────────────────────────────────

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Helper: All Sheet Data As Objects ────────────────────────────────────────

function sheetToObjects(sheetName) {
  var sheet = getSheet(sheetName);
  var data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  return data.slice(1).map(function(row) {
    return rowToObject(headers, row);
  });
}

// ─── Log To ActivityLog ───────────────────────────────────────────────────────

function logActivity(action, itemId, itemName, description) {
  var sheet = getSheet(SHEET_ACTIVITY_LOG);
  var logId = generateId('LOG');
  sheet.appendRow([logId, action, itemId, itemName, description, getTimestamp()]);
}

// ─── Add Price History Entry ──────────────────────────────────────────────────

function appendPriceHistory(itemId, itemName, price, priceUnit, supplier, notes) {
  var sheet   = getSheet(SHEET_PRICE_HISTORY);
  var entryId = generateId('PRC');
  sheet.appendRow([
    entryId, itemId, itemName,
    Number(price), priceUnit, supplier,
    getTimestamp(), notes || ''
  ]);
  return entryId;
}

// ─── Add Stock Transaction ────────────────────────────────────────────────────

function appendTransaction(itemId, itemName, transactionType, quantityChanged, previousQty, updatedQty, price, notes) {
  var sheet = getSheet(SHEET_TRANSACTIONS);
  var txnId = generateId('TXN');
  sheet.appendRow([
    txnId, itemId, itemName, transactionType,
    Number(quantityChanged), Number(previousQty), Number(updatedQty),
    Number(price) || 0, getTimestamp(), notes || ''
  ]);
  return txnId;
}

// ─── doGet ─────────────────────────────────────────────────────────────────────

function doGet(e) {
  try {
    initSheets();
    var params = e.parameter || {};
    var action = params.action || '';

    switch (action) {

      // ── getInventory ────────────────────────────────────────────────────────
      case 'getInventory': {
        var showDeleted = params.showDeleted === 'true';
        var items = sheetToObjects(SHEET_INVENTORY);

        var filtered = items.filter(function(item) {
          return showDeleted ? true : item.Status !== 'Deleted';
        });

        // Convert numeric fields
        filtered = filtered.map(normalizeInventoryItem);

        // Recently updated: last 5 by UpdatedAt (sorted descending)
        var sorted = filtered.slice().sort(function(a, b) {
          return compareDateStr(b.UpdatedAt, a.UpdatedAt);
        });
        var recentlyUpdated = sorted.slice(0, 5);

        return jsonResponse({ success: true, data: filtered, recentlyUpdated: recentlyUpdated });
      }

      // ── getItem ─────────────────────────────────────────────────────────────
      case 'getItem': {
        var itemId = params.itemId;
        if (!itemId) return jsonResponse({ success: false, error: 'itemId is required' });
        var items = sheetToObjects(SHEET_INVENTORY);
        var item  = items.find(function(r) { return r.ItemID === itemId; });
        if (!item) return jsonResponse({ success: false, error: 'Item not found' });
        return jsonResponse({ success: true, data: normalizeInventoryItem(item) });
      }

      // ── getPriceHistory ─────────────────────────────────────────────────────
      case 'getPriceHistory': {
        var itemId = params.itemId;
        if (!itemId) return jsonResponse({ success: false, error: 'itemId is required' });
        var entries = sheetToObjects(SHEET_PRICE_HISTORY);
        // Filter before normalization (still PascalCase)
        var filtered = entries.filter(function(r) { return r.ItemID === itemId; });
        // Sort ascending before normalization
        filtered.sort(function(a, b) { return compareDateStr(a.Timestamp, b.Timestamp); });
        filtered = filtered.map(normalizePriceEntry);
        return jsonResponse({ success: true, data: filtered });
      }

      // ── getAllPriceHistory ──────────────────────────────────────────────────
      case 'getAllPriceHistory': {
        var entries = sheetToObjects(SHEET_PRICE_HISTORY);
        entries.sort(function(a, b) { return compareDateStr(a.Timestamp, b.Timestamp); });
        entries = entries.map(normalizePriceEntry);
        return jsonResponse({ success: true, data: entries });
      }

      // ── getTransactions ─────────────────────────────────────────────────────
      case 'getTransactions': {
        var txns = sheetToObjects(SHEET_TRANSACTIONS);
        // Apply filters BEFORE normalization (data is still PascalCase from sheet)
        if (params.itemId)   txns = txns.filter(function(r) { return r.ItemID === params.itemId; });
        if (params.type)     txns = txns.filter(function(r) { return r.TransactionType === params.type; });
        if (params.category) {
          // Category filter: requires cross-reference with Inventory
          var invItems = sheetToObjects(SHEET_INVENTORY);
          var catItemIds = invItems
            .filter(function(r) { return r.Category === params.category; })
            .map(function(r) { return r.ItemID; });
          txns = txns.filter(function(r) { return catItemIds.indexOf(r.ItemID) !== -1; });
        }
        if (params.startDate) {
          txns = txns.filter(function(r) { return toSortable(r.Timestamp) >= toSortable(params.startDate, false); });
        }
        if (params.endDate) {
          txns = txns.filter(function(r) { return toSortable(r.Timestamp) <= toSortable(params.endDate, true); });
        }
        // Also attach category to each transaction from inventory
        var invLookup = {};
        sheetToObjects(SHEET_INVENTORY).forEach(function(r) { invLookup[r.ItemID] = r.Category; });
        txns.forEach(function(r) { r.Category = invLookup[r.ItemID] || ''; });

        // Sort descending (newest first)
        txns.sort(function(a, b) { return compareDateStr(b.Timestamp, a.Timestamp); });

        // Normalize to camelCase for frontend
        txns = txns.map(normalizeTransaction);

        return jsonResponse({ success: true, data: txns });
      }

      // ── getActivityLog ──────────────────────────────────────────────────────
      case 'getActivityLog': {
        var logs = sheetToObjects(SHEET_ACTIVITY_LOG);
        return jsonResponse({ success: true, data: logs });
      }

      // ── getStats ────────────────────────────────────────────────────────────
      case 'getStats': {
        var items = sheetToObjects(SHEET_INVENTORY);
        var totalItems   = 0;
        var totalInStock = 0;
        var lowStock     = 0;
        var outOfStock   = 0;
        items.forEach(function(item) {
          if (item.Status === 'Deleted') return;
          totalItems++;
          if (item.Status === 'In Stock')      totalInStock++;
          else if (item.Status === 'Low Stock') lowStock++;
          else if (item.Status === 'Out of Stock') outOfStock++;
        });
        return jsonResponse({ success: true, data: { totalItems: totalItems, totalInStock: totalInStock, lowStock: lowStock, outOfStock: outOfStock } });
      }

      default:
        return jsonResponse({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// ─── doPost ─────────────────────────────────────────────────────────────────────

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    initSheets();
    var body = JSON.parse(e.postData.contents);
    var action = body.action || '';

    var acquired = lock.tryLock(10000);
    if (!acquired) {
      return jsonResponse({ success: false, error: 'Could not acquire lock. Please retry.' });
    }

    switch (action) {

      // ── addItem ─────────────────────────────────────────────────────────────
      case 'addItem': {
        var sheet  = getSheet(SHEET_INVENTORY);
        var itemId = generateId('ITM');
        var now    = getTimestamp();
        var qty    = Number(body.quantity) || 0;
        var minQty = Number(body.minStock)  || 0;
        var price  = Number(body.purchasePrice) || 0;
        var status = computeStatus(qty, minQty);

        sheet.appendRow([
          itemId,
          body.itemName      || '',
          body.category      || '',
          qty,
          body.unit          || '',
          price,
          minQty,
          body.supplier      || '',
          body.notes         || '',
          now,   // CreatedAt
          now,   // UpdatedAt
          status
        ]);

        // Initial price history entry
        if (price > 0) {
          appendPriceHistory(itemId, body.itemName || '', price, body.unit || '', body.supplier || '', 'Initial price on item creation');
        }

        // Initial stock transaction
        appendTransaction(
          itemId, body.itemName || '', 'Stock Added',
          qty, 0, qty, price,
          'Initial stock on item creation'
        );

        logActivity('Add Item', itemId, body.itemName || '', 'Item "' + (body.itemName || '') + '" added with qty ' + qty);

        return jsonResponse({ success: true, data: { itemId: itemId, status: status } });
      }

      // ── editItem ─────────────────────────────────────────────────────────────
      case 'editItem': {
        var sheet   = getSheet(SHEET_INVENTORY);
        var itemId  = body.itemId;
        if (!itemId) return jsonResponse({ success: false, error: 'itemId is required' });

        var rowIdx = findRowById(sheet, 'ItemID', itemId);
        if (rowIdx === -1) return jsonResponse({ success: false, error: 'Item not found: ' + itemId });

        var headers    = HEADERS.Inventory;
        var rowData    = sheet.getRange(rowIdx, 1, 1, headers.length).getValues()[0];
        var existing   = rowToObject(headers, rowData);

        var newName     = body.itemName      !== undefined ? body.itemName      : existing.ItemName;
        var newCat      = body.category      !== undefined ? body.category      : existing.Category;
        var newQty      = body.quantity      !== undefined ? Number(body.quantity)      : Number(existing.Quantity);
        var newUnit     = body.unit          !== undefined ? body.unit          : existing.Unit;
        var newPrice    = body.purchasePrice !== undefined ? Number(body.purchasePrice) : Number(existing.PurchasePrice);
        var newMinStock = body.minStock      !== undefined ? Number(body.minStock)      : Number(existing.MinStock);
        var newSupplier = body.supplier      !== undefined ? body.supplier      : existing.Supplier;
        var newNotes    = body.notes         !== undefined ? body.notes         : existing.Notes;

        var newStatus   = computeStatus(newQty, newMinStock);
        var now         = getTimestamp();

        var updatedRow = [
          existing.ItemID,
          newName, newCat, newQty, newUnit, newPrice,
          newMinStock, newSupplier, newNotes,
          existing.CreatedAt, now, newStatus
        ];
        sheet.getRange(rowIdx, 1, 1, headers.length).setValues([updatedRow]);

        // If price changed, add PriceHistory entry
        if (newPrice !== Number(existing.PurchasePrice)) {
          appendPriceHistory(itemId, newName, newPrice, newUnit, newSupplier, 'Price updated via edit');
        }

        // If quantity changed, add StockTransaction
        var oldQty = Number(existing.Quantity);
        if (newQty !== oldQty) {
          var diff = newQty - oldQty;
          var txnType = diff > 0 ? 'Stock Added' : 'Stock Removed';
          appendTransaction(
            itemId, newName, txnType,
            Math.abs(diff), oldQty, newQty,
            newPrice, 'Quantity updated via edit'
          );
        }

        logActivity('Edit Item', itemId, newName, 'Item "' + newName + '" updated');

        return jsonResponse({ success: true, data: { itemId: itemId, status: newStatus } });
      }

      // ── deleteItem ────────────────────────────────────────────────────────────
      case 'deleteItem': {
        var sheet  = getSheet(SHEET_INVENTORY);
        var itemId = body.itemId;
        if (!itemId) return jsonResponse({ success: false, error: 'itemId is required' });

        var rowIdx = findRowById(sheet, 'ItemID', itemId);
        if (rowIdx === -1) return jsonResponse({ success: false, error: 'Item not found: ' + itemId });

        var headers  = HEADERS.Inventory;
        var rowData  = sheet.getRange(rowIdx, 1, 1, headers.length).getValues()[0];
        var existing = rowToObject(headers, rowData);

        // Soft delete: set Status = "Deleted", update UpdatedAt
        var statusCol  = headers.indexOf('Status')    + 1;
        var updatedCol = headers.indexOf('UpdatedAt') + 1;
        sheet.getRange(rowIdx, statusCol).setValue('Deleted');
        sheet.getRange(rowIdx, updatedCol).setValue(getTimestamp());

        logActivity('Delete Item', itemId, existing.ItemName || '', 'Item "' + (existing.ItemName || '') + '" soft-deleted');

        return jsonResponse({ success: true, data: { itemId: itemId } });
      }

      // ── updateQuantity ─────────────────────────────────────────────────────────
      case 'updateQuantity': {
        var sheet  = getSheet(SHEET_INVENTORY);
        var itemId = body.itemId;
        if (!itemId) return jsonResponse({ success: false, error: 'itemId is required' });

        var rowIdx = findRowById(sheet, 'ItemID', itemId);
        if (rowIdx === -1) return jsonResponse({ success: false, error: 'Item not found: ' + itemId });

        var headers  = HEADERS.Inventory;
        var rowData  = sheet.getRange(rowIdx, 1, 1, headers.length).getValues()[0];
        var existing = rowToObject(headers, rowData);

        var oldQty  = Number(existing.Quantity);
        var newQty  = Number(body.newQuantity !== undefined ? body.newQuantity : body.quantity);
        var minQty  = Number(existing.MinStock);
        var txnType = body.transactionType || (newQty > oldQty ? 'Stock Added' : newQty < oldQty ? 'Stock Removed' : 'Stock Correction');
        var diff    = Math.abs(newQty - oldQty);
        var notes   = body.notes || '';

        var newStatus  = computeStatus(newQty, minQty);
        var now        = getTimestamp();

        var qtyCol     = headers.indexOf('Quantity')  + 1;
        var statusCol  = headers.indexOf('Status')    + 1;
        var updatedCol = headers.indexOf('UpdatedAt') + 1;

        sheet.getRange(rowIdx, qtyCol).setValue(newQty);
        sheet.getRange(rowIdx, statusCol).setValue(newStatus);
        sheet.getRange(rowIdx, updatedCol).setValue(now);

        appendTransaction(
          itemId, existing.ItemName || '', txnType,
          diff, oldQty, newQty,
          Number(existing.PurchasePrice) || 0, notes
        );

        logActivity('Update Quantity', itemId, existing.ItemName || '',
          'Qty changed from ' + oldQty + ' to ' + newQty + ' (' + txnType + ')');

        return jsonResponse({ success: true, data: { itemId: itemId, newQty: newQty, status: newStatus } });
      }

      // ── addPriceEntry ──────────────────────────────────────────────────────────
      case 'addPriceEntry': {
        var sheet  = getSheet(SHEET_INVENTORY);
        var itemId = body.itemId;
        if (!itemId) return jsonResponse({ success: false, error: 'itemId is required' });

        var newPrice = Number(body.price);
        if (isNaN(newPrice)) return jsonResponse({ success: false, error: 'price must be a number' });

        // Append to PriceHistory (never overwrites)
        var entryId = appendPriceHistory(
          itemId,
          body.itemName || '',
          newPrice,
          body.priceUnit  || '',
          body.supplier   || '',
          body.notes      || ''
        );

        // Update current PurchasePrice on Inventory item
        var rowIdx = findRowById(sheet, 'ItemID', itemId);
        if (rowIdx !== -1) {
          var headers    = HEADERS.Inventory;
          var priceCol   = headers.indexOf('PurchasePrice') + 1;
          var updatedCol = headers.indexOf('UpdatedAt')     + 1;
          sheet.getRange(rowIdx, priceCol).setValue(newPrice);
          sheet.getRange(rowIdx, updatedCol).setValue(getTimestamp());

          var rowData  = sheet.getRange(rowIdx, 1, 1, headers.length).getValues()[0];
          var existing = rowToObject(headers, rowData);
          logActivity('Add Price Entry', itemId, existing.ItemName || '',
            'New price ' + newPrice + ' recorded for "' + (existing.ItemName || '') + '"');
        } else {
          logActivity('Add Price Entry', itemId, body.itemName || '',
            'New price ' + newPrice + ' recorded (item row not found in Inventory)');
        }

        return jsonResponse({ success: true, data: { entryId: entryId } });
      }

      // ── addTransaction ─────────────────────────────────────────────────────────
      case 'addTransaction': {
        var txnId = appendTransaction(
          body.itemId            || '',
          body.itemName          || '',
          body.transactionType   || 'Manual',
          Number(body.quantityChanged)  || 0,
          Number(body.previousQty)      || 0,
          Number(body.updatedQty)       || 0,
          Number(body.price)            || 0,
          body.notes             || ''
        );

        logActivity('Add Transaction', body.itemId || '', body.itemName || '',
          'Manual transaction (' + (body.transactionType || 'Manual') + ') added');

        return jsonResponse({ success: true, data: { transactionId: txnId } });
      }

      default:
        return jsonResponse({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

// ─── Normalize Helpers ─────────────────────────────────────────────────────────

function normalizeInventoryItem(item) {
  item.Quantity      = Number(item.Quantity)      || 0;
  item.PurchasePrice = Number(item.PurchasePrice) || 0;
  item.MinStock      = Number(item.MinStock)      || 0;
  return item;
}

function normalizePriceEntry(entry) {
  entry.Price = Number(entry.Price) || 0;
  return entry;
}

function normalizeTransaction(txn) {
  txn.QuantityChanged = Number(txn.QuantityChanged) || 0;
  txn.PreviousQty     = Number(txn.PreviousQty)     || 0;
  txn.UpdatedQty      = Number(txn.UpdatedQty)      || 0;
  txn.Price           = Number(txn.Price)           || 0;
  return txn;
}

// ─── Date Comparison Helper ────────────────────────────────────────────────────

function toSortable(str, isEndOfDay) {
  if (!str || typeof str !== 'string') return '';
  str = str.trim();
  var isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (isoMatch) {
    var hh = isoMatch[4] || (isEndOfDay ? '23' : '00');
    var mm = isoMatch[5] || (isEndOfDay ? '59' : '00');
    return isoMatch[1] + isoMatch[2] + isoMatch[3] + hh + mm;
  }
  var dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (dmyMatch) {
    var dd = String(dmyMatch[1]).padStart(2, '0');
    var mm = String(dmyMatch[2]).padStart(2, '0');
    var yy = dmyMatch[3].length === 2 ? ('20' + dmyMatch[3]) : dmyMatch[3];
    var hh = dmyMatch[4] ? String(dmyMatch[4]).padStart(2, '0') : (isEndOfDay ? '23' : '00');
    var min = dmyMatch[5] ? String(dmyMatch[5]).padStart(2, '0') : (isEndOfDay ? '59' : '00');
    return yy + mm + dd + hh + min;
  }
  return str;
}

function compareDateStr(a, b) {
  var sa = toSortable(a);
  var sb = toSortable(b);
  if (sa < sb) return -1;
  if (sa > sb) return  1;
  return 0;
}
