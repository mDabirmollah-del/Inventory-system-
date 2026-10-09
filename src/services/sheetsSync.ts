/**
 * M/S Abdus Samad Mollah - Smart Offline Agro-POS
 * Google Sheets 11-Tabs Sync & Google Drive Dedicated GZIP Backup Engine
 * BCIC & BADC Dealer, Gobindapur Bazar, Bhuapur, Tangail
 */

import { db, generateUUID, getDeviceId } from '../db/database';
import { getAccessToken, googleSignIn } from './authService';
import type { SyncQueueItem, DailySummary, DriveBackupFile } from '../types';
import { generateBackupPayload } from './backupService';

export const SHEET_TABS = [
  'CUSTOMERS',
  'CUSTOMER_KYC',
  'TRANSACTIONS',
  'ITEMS',
  'PRESCRIPTIONS',
  'INVENTORY',
  'INVENTORY_MOVEMENTS',
  'CASH_EVENTS',
  'CASH_DRAWER',
  'PAYMENTS',
  'DUE_LEDGER',
  'DAILY_SUMMARY',
] as const;

export type SheetTabName = (typeof SHEET_TABS)[number];

export const SHEET_HEADERS: Record<SheetTabName, string[]> = {
  CUSTOMERS: [
    'ID (UUID)',
    'Name',
    'Bangla Name',
    'Mobile',
    'NID',
    'Village',
    'Union',
    'Upazila',
    'District',
    'Credit Limit (BDT)',
    'Total Due (BDT)',
    'Notes',
    'Created At',
    'Updated At',
    'Device ID',
    'Version',
  ],
  CUSTOMER_KYC: [
    'ID (UUID)',
    'Customer ID',
    'Guarantor Name',
    'Guarantor Mobile',
    'Land Size (Decimals)',
    'Land Size (Bigha)',
    'Primary Crops',
    'Status',
    'Updated At',
  ],
  TRANSACTIONS: [
    'ID (UUID)',
    'Invoice No',
    'Idempotency Key',
    'Customer ID',
    'Customer Name',
    'Mobile',
    'Village',
    'Subtotal',
    'Discount',
    'Tax',
    'Grand Total',
    'Paid Amount',
    'Due Amount',
    'Payment Method',
    'Status',
    'Item Count',
    'Prescription ID',
    'Notes',
    'Created At',
    'Updated At',
    'Device ID',
  ],
  ITEMS: [
    'ID (UUID)',
    'Transaction ID',
    'Product ID',
    'Product Code',
    'Product Name',
    'Bangla Name',
    'Category',
    'Pack Size',
    'Unit',
    'Quantity',
    'Unit Price',
    'Cost Price',
    'Discount',
    'Total',
    'Batch No',
    'Created At',
    'Device ID',
  ],
  PRESCRIPTIONS: [
    'ID (UUID)',
    'Prescription No',
    'Customer ID',
    'Customer Name',
    'Mobile',
    'Crop Name',
    'Crop Bangla',
    'Land Area',
    'Land Unit',
    'Land Area (Decimals)',
    'Dose Multiplier',
    'Symptoms',
    'Diagnosed Issue',
    'Prescribed Items (JSON)',
    'Advice Notes',
    'Created At',
    'Device ID',
  ],
  INVENTORY: [
    'ID (UUID)',
    'Product Code',
    'Name',
    'Bangla Name',
    'Category',
    'Pack Size',
    'Unit',
    'Cost Price',
    'Selling Price',
    'Stock Quantity',
    'Min Stock Alert',
    'Batch No',
    'Expire Date',
    'Manufacturer',
    'Rack Location',
    'Updated At',
    'Device ID',
    'Version',
  ],
  INVENTORY_MOVEMENTS: [
    'ID (UUID)',
    'Product ID',
    'Type',
    'Quantity',
    'Reference ID',
    'Balance After',
    'Notes',
    'Created At',
    'Device ID',
  ],
  CASH_EVENTS: [
    'ID (UUID)',
    'Event Type',
    'Amount',
    'Payment Method',
    'Reference ID',
    'Description',
    'Performed By',
    'Balance After',
    'Created At',
    'Device ID',
  ],
  CASH_DRAWER: [
    'ID (UUID)',
    'Session Date',
    'Opening Balance',
    'Current Cash',
    'Total Sales Cash',
    'Total Due Collected',
    'Total Cash In',
    'Total Cash Out',
    'Status',
    'Updated At',
  ],
  PAYMENTS: [
    'ID (UUID)',
    'Transaction ID',
    'Customer ID',
    'Amount',
    'Payment Method',
    'Reference No',
    'Received By',
    'Created At',
    'Device ID',
  ],
  DUE_LEDGER: [
    'ID (UUID)',
    'Customer ID',
    'Customer Name',
    'Transaction ID',
    'Type',
    'Amount',
    'Balance After',
    'Notes',
    'Created At',
    'Device ID',
  ],
  DAILY_SUMMARY: [
    'Date',
    'Total Sales (BDT)',
    'Sales Count',
    'Cash Collected (BDT)',
    'Due Generated (BDT)',
    'Due Collected (BDT)',
    'Customers Served',
    'Prescriptions Count',
    'Updated At',
  ],
};

export const BACKUP_FOLDER_NAME = 'মেসার্স আব্দুস সামাদ মোল্লাহ্ - POS ব্যাকআপ (AgroPOS Backups)';

export function mapTableToTab(tableName: string): SheetTabName {
  switch (tableName) {
    case 'customers':
      return 'CUSTOMERS';
    case 'customer_kyc':
    case 'kyc':
      return 'CUSTOMER_KYC';
    case 'transactions':
      return 'TRANSACTIONS';
    case 'transaction_items':
    case 'transactionItems':
      return 'ITEMS';
    case 'prescriptions':
      return 'PRESCRIPTIONS';
    case 'inventory':
    case 'products':
      return 'INVENTORY';
    case 'inventory_movements':
    case 'inventoryMovements':
      return 'INVENTORY_MOVEMENTS';
    case 'cash_events':
    case 'cashEvents':
      return 'CASH_EVENTS';
    case 'cash_drawer':
    case 'cashDrawer':
      return 'CASH_DRAWER';
    case 'payments':
      return 'PAYMENTS';
    case 'due_ledger':
    case 'dueLedger':
      return 'DUE_LEDGER';
    default:
      return 'CUSTOMERS';
  }
}

export function recordToRowValues(tab: SheetTabName, record: any): (string | number)[] {
  switch (tab) {
    case 'CUSTOMERS':
      return [
        record.id || '',
        record.name || '',
        record.banglaName || '',
        record.mobile || '',
        record.nid || '',
        record.village || '',
        record.union || '',
        record.upazila || '',
        record.district || '',
        record.creditLimit || 0,
        record.totalDue || 0,
        record.notes || '',
        record.createdAt || '',
        record.updatedAt || '',
        record.deviceId || '',
        record.version || 1,
      ];
    case 'CUSTOMER_KYC':
      return [
        record.id || '',
        record.customerId || '',
        record.guarantorName || '',
        record.guarantorMobile || '',
        record.landSizeDecimals || 0,
        record.landSizeBigha || 0,
        (record.primaryCrops || []).join(', '),
        record.verifiedStatus || 'PENDING',
        record.updatedAt || '',
      ];
    case 'TRANSACTIONS':
      return [
        record.id || '',
        record.invoiceNo || '',
        record.idempotencyKey || '',
        record.customerId || '',
        record.customerName || '',
        record.customerMobile || '',
        record.customerVillage || '',
        record.subtotal || 0,
        record.discount || 0,
        record.tax || 0,
        record.grandTotal || 0,
        record.paidAmount || 0,
        record.dueAmount || 0,
        record.paymentMethod || '',
        record.status || '',
        record.itemCount || 0,
        record.prescriptionId || '',
        record.notes || '',
        record.createdAt || '',
        record.updatedAt || '',
        record.deviceId || '',
      ];
    case 'ITEMS':
      return [
        record.id || '',
        record.transactionId || '',
        record.productId || '',
        record.productCode || '',
        record.productName || '',
        record.banglaName || '',
        record.category || '',
        record.packSize || '',
        record.unit || '',
        record.quantity || 0,
        record.unitPrice || 0,
        record.costPrice || 0,
        record.discount || 0,
        record.total || 0,
        record.batchNo || '',
        record.createdAt || '',
        record.deviceId || '',
      ];
    case 'PRESCRIPTIONS':
      return [
        record.id || '',
        record.prescriptionNo || '',
        record.customerId || '',
        record.customerName || '',
        record.customerMobile || '',
        record.cropName || '',
        record.cropNameBangla || '',
        record.landArea || 0,
        record.landUnit || '',
        record.landAreaInDecimals || 0,
        record.multiplier || 1,
        record.symptoms || '',
        record.diagnosedIssue || '',
        JSON.stringify(record.items || []),
        record.adviceNotes || '',
        record.createdAt || '',
        record.deviceId || '',
      ];
    case 'INVENTORY':
      return [
        record.id || '',
        record.code || '',
        record.name || '',
        record.banglaName || '',
        record.category || '',
        record.packSize || '',
        record.unit || '',
        record.costPrice || 0,
        record.sellingPrice || 0,
        record.stockQuantity || 0,
        record.minStockAlert || 0,
        record.batchNo || '',
        record.expireDate || '',
        record.manufacturer || '',
        record.rackLocation || '',
        record.updatedAt || '',
        record.deviceId || '',
        record.version || 1,
      ];
    case 'INVENTORY_MOVEMENTS':
      return [
        record.id || '',
        record.productId || '',
        record.type || '',
        record.quantity || 0,
        record.referenceId || '',
        record.balanceAfter || 0,
        record.notes || '',
        record.createdAt || '',
        record.deviceId || '',
      ];
    case 'CASH_EVENTS':
      return [
        record.id || '',
        record.eventType || '',
        record.amount || 0,
        record.paymentMethod || '',
        record.referenceId || '',
        record.description || '',
        record.performedBy || '',
        record.balanceAfter || 0,
        record.createdAt || '',
        record.deviceId || '',
      ];
    case 'CASH_DRAWER':
      return [
        record.id || '',
        record.sessionDate || '',
        record.openingBalance || 0,
        record.currentCash || 0,
        record.totalSalesCash || 0,
        record.totalDueCollectedCash || 0,
        record.totalCashIn || 0,
        record.totalCashOut || 0,
        record.status || 'OPEN',
        record.updatedAt || '',
      ];
    case 'PAYMENTS':
      return [
        record.id || '',
        record.transactionId || '',
        record.customerId || '',
        record.amount || 0,
        record.paymentMethod || '',
        record.referenceNo || '',
        record.receivedBy || '',
        record.createdAt || '',
        record.deviceId || '',
      ];
    case 'DUE_LEDGER':
      return [
        record.id || '',
        record.customerId || '',
        record.customerName || '',
        record.transactionId || '',
        record.type || '',
        record.amount || 0,
        record.balanceAfter || 0,
        record.notes || '',
        record.createdAt || '',
        record.deviceId || '',
      ];
    case 'DAILY_SUMMARY':
      return [
        record.date || '',
        record.totalSalesAmount || 0,
        record.totalSalesCount || 0,
        record.totalCashCollected || 0,
        record.totalDueGenerated || 0,
        record.totalDueCollected || 0,
        record.totalCustomersServed || 0,
        record.totalPrescriptionsCount || 0,
        new Date().toISOString(),
      ];
  }
}

/**
 * Ensures or creates the M/S Abdus Samad Mollah spreadsheet in Google Sheets
 */
export async function getOrCreateSpreadsheet(accessToken: string): Promise<string> {
  const setting = await db.settings.where('key').equals('GOOGLE_SHEETS_SPREADSHEET_ID').first();
  if (setting?.value) {
    try {
      const checkRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${setting.value}?fields=spreadsheetId,sheets.properties.title`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (checkRes.ok) {
        const data = await checkRes.json();
        await ensureAllTabsExist(setting.value, data.sheets, accessToken);
        return setting.value;
      }
    } catch {
      // Fall through to re-create
    }
  }

  const createPayload = {
    properties: {
      title: 'মেসার্স আব্দুস সামাদ মোল্লাহ্ — AgroPOS Real-time Ledger',
    },
    sheets: SHEET_TABS.map((tabTitle) => ({
      properties: {
        title: tabTitle,
        gridProperties: { rowCount: 1000, columnCount: 26 },
      },
    })),
  };

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createPayload),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Google Sheets তৈরি ব্যর্থ: ${createRes.status} ${errText}`);
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;

  const now = new Date().toISOString();
  if (setting) {
    await db.settings.update(setting.id, { value: spreadsheetId, updatedAt: now });
  } else {
    await db.settings.add({
      id: generateUUID(),
      key: 'GOOGLE_SHEETS_SPREADSHEET_ID',
      value: spreadsheetId,
      updatedAt: now,
    });
  }

  const headerData = SHEET_TABS.map((tab) => ({
    range: `${tab}!A1:${String.fromCharCode(65 + SHEET_HEADERS[tab].length - 1)}1`,
    values: [SHEET_HEADERS[tab]],
  }));

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: headerData,
    }),
  });

  return spreadsheetId;
}

async function ensureAllTabsExist(
  spreadsheetId: string,
  existingSheets: any[],
  accessToken: string
) {
  const existingTitles = new Set(existingSheets.map((s) => s.properties?.title));
  const missingTabs = SHEET_TABS.filter((tab) => !existingTitles.has(tab));

  if (missingTabs.length > 0) {
    const requests = missingTabs.map((tabTitle) => ({
      addSheet: {
        properties: {
          title: tabTitle,
          gridProperties: { rowCount: 1000, columnCount: 26 },
        },
      },
    }));

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });

    const headerData = missingTabs.map((tab) => ({
      range: `${tab}!A1:${String.fromCharCode(65 + SHEET_HEADERS[tab].length - 1)}1`,
      values: [SHEET_HEADERS[tab]],
    }));

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: headerData,
      }),
    });
  }
}

/**
 * Upsert a single table record into Google Sheets idempotently
 */
export async function upsertRecordToSheet(
  spreadsheetId: string,
  tab: SheetTabName,
  record: any,
  accessToken: string
): Promise<boolean> {
  const recordId = record.id;
  if (!recordId) return false;

  const readColARes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${tab}!A:A`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  let targetRowNumber = -1;
  if (readColARes.ok) {
    const data = await readColARes.json();
    const rows = data.values || [];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i][0] === recordId) {
        targetRowNumber = i + 1;
        break;
      }
    }
  }

  const rowValues = recordToRowValues(tab, record);
  const endColChar = String.fromCharCode(65 + rowValues.length - 1);

  if (targetRowNumber > 1) {
    const updateRange = `${tab}!A${targetRowNumber}:${endColChar}${targetRowNumber}`;
    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${updateRange}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [rowValues] }),
      }
    );
    return updateRes.ok;
  } else {
    const appendRange = `${tab}!A:${endColChar}`;
    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${appendRange}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [rowValues] }),
      }
    );
    return appendRes.ok;
  }
}

/**
 * Process the local sync queue with Google Sheets
 */
export async function processSyncQueue(): Promise<{
  synced: number;
  failed: number;
  total: number;
}> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }

  const spreadsheetId = await getOrCreateSpreadsheet(token);
  const pendingItems = await db.sync_queue
    .where('status')
    .anyOf('PENDING', 'FAILED')
    .limit(50)
    .toArray();

  let synced = 0;
  let failed = 0;

  for (const item of pendingItems) {
    try {
      await db.sync_queue.update(item.id, { status: 'SYNCING' });
      const tab = mapTableToTab(item.tableName);
      const success = await upsertRecordToSheet(spreadsheetId, tab, item.payload, token);

      if (success) {
        await db.sync_queue.update(item.id, {
          status: 'SYNCED',
          syncStatus: 'SYNCED',
          updatedAt: new Date().toISOString(),
        });
        synced++;
      } else {
        throw new Error('Failed to upsert row in Google Sheets');
      }
    } catch (err: any) {
      failed++;
      await db.sync_queue.update(item.id, {
        status: 'FAILED',
        syncStatus: 'FAILED',
        attempts: (item.attempts || 0) + 1,
        lastError: err?.message || String(err),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // Update Daily Summary
  await syncDailySummary(spreadsheetId, token);

  const now = new Date().toISOString();
  const lastSyncSetting = await db.settings.where('key').equals('LAST_SYNC_TIME').first();
  if (lastSyncSetting) {
    await db.settings.update(lastSyncSetting.id, { value: now, updatedAt: now });
  } else {
    await db.settings.add({
      id: generateUUID(),
      key: 'LAST_SYNC_TIME',
      value: now,
      updatedAt: now,
    });
  }

  return { synced, failed, total: pendingItems.length };
}

export async function syncDailySummary(spreadsheetId: string, token: string) {
  const todayStr = new Date().toISOString().split('T')[0];
  const startDay = `${todayStr}T00:00:00.000Z`;
  const endDay = `${todayStr}T23:59:59.999Z`;

  const todayTxs = await db.transactions.where('createdAt').between(startDay, endDay).toArray();
  const totalSalesAmount = todayTxs.reduce((sum, tx) => sum + (tx.grandTotal || 0), 0);
  const totalPaid = todayTxs.reduce((sum, tx) => sum + (tx.paidAmount || 0), 0);
  const totalDueGenerated = todayTxs.reduce((sum, tx) => sum + (tx.dueAmount || 0), 0);

  const todayDueDox = await db.due_ledger
    .where('createdAt')
    .between(startDay, endDay)
    .filter((d) => d.type === 'PAYMENT_COLLECTION')
    .toArray();
  const totalDueCollected = todayDueDox.reduce((sum, d) => sum + (d.amount || 0), 0);

  const uniqueCustomers = new Set(todayTxs.map((t) => t.customerId)).size;
  const prescriptionsCount = await db.prescriptions
    .where('createdAt')
    .between(startDay, endDay)
    .count();

  const summary: DailySummary = {
    date: todayStr,
    totalSalesAmount,
    totalSalesCount: todayTxs.length,
    totalCashCollected: totalPaid + totalDueCollected,
    totalDueGenerated,
    totalDueCollected,
    totalCustomersServed: uniqueCustomers,
    totalPrescriptionsCount: prescriptionsCount,
  };

  const rowValues = recordToRowValues('DAILY_SUMMARY', summary);

  const readRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/DAILY_SUMMARY!A:A`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  let targetRow = -1;
  if (readRes.ok) {
    const data = await readRes.json();
    const rows = data.values || [];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i][0] === todayStr) {
        targetRow = i + 1;
        break;
      }
    }
  }

  if (targetRow > 1) {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/DAILY_SUMMARY!A${targetRow}:I${targetRow}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [rowValues] }),
      }
    );
  } else {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/DAILY_SUMMARY!A:I:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [rowValues] }),
      }
    );
  }
}

/**
 * On-demand Export actions required by prompt
 */
export async function exportTodayToSheets(): Promise<number> {
  const token = await getAccessToken();
  if (!token) throw new Error('গুগল অ্যাকাউন্ট সাইন ইন করুন।');
  const spreadsheetId = await getOrCreateSpreadsheet(token);

  const todayStr = new Date().toISOString().split('T')[0];
  const startDay = `${todayStr}T00:00:00.000Z`;
  const endDay = `${todayStr}T23:59:59.999Z`;

  const txs = await db.transactions.where('createdAt').between(startDay, endDay).toArray();
  for (const tx of txs) {
    await upsertRecordToSheet(spreadsheetId, 'TRANSACTIONS', tx, token);
    const items = await db.transaction_items.where('transactionId').equals(tx.id).toArray();
    for (const item of items) {
      await upsertRecordToSheet(spreadsheetId, 'ITEMS', item, token);
    }
  }
  await syncDailySummary(spreadsheetId, token);
  return txs.length;
}

export async function exportCustomersToSheets(): Promise<number> {
  const token = await getAccessToken();
  if (!token) throw new Error('গুগল অ্যাকাউন্ট সাইন ইন করুন।');
  const spreadsheetId = await getOrCreateSpreadsheet(token);

  const customers = await db.customers.toArray();
  for (const c of customers) {
    await upsertRecordToSheet(spreadsheetId, 'CUSTOMERS', c, token);
  }
  return customers.length;
}

export async function exportTransactionsToSheets(startDate?: string, endDate?: string): Promise<number> {
  const token = await getAccessToken();
  if (!token) throw new Error('গুগল অ্যাকাউন্ট সাইন ইন করুন।');
  const spreadsheetId = await getOrCreateSpreadsheet(token);

  let txs;
  if (startDate && endDate) {
    txs = await db.transactions
      .where('createdAt')
      .between(`${startDate}T00:00:00.000Z`, `${endDate}T23:59:59.999Z`)
      .toArray();
  } else {
    txs = await db.transactions.toArray();
  }

  for (const tx of txs) {
    await upsertRecordToSheet(spreadsheetId, 'TRANSACTIONS', tx, token);
    const items = await db.transaction_items.where('transactionId').equals(tx.id).toArray();
    for (const item of items) {
      await upsertRecordToSheet(spreadsheetId, 'ITEMS', item, token);
    }
  }
  return txs.length;
}

/**
 * -------------------------------------------------------------
 * GOOGLE DRIVE DEDICATED BACKUP FOLDER & GZIP COMPRESSION
 * -------------------------------------------------------------
 */

/**
 * Finds or creates the dedicated Google Drive folder:
 * "মেসার্স আব্দুস সামাদ মোল্লাহ্ - POS ব্যাকআপ (AgroPOS Backups)"
 */
export async function getOrCreateDriveBackupFolder(token: string): Promise<{ folderId: string; webViewLink: string }> {
  const setting = await db.settings.where('key').equals('GOOGLE_DRIVE_BACKUP_FOLDER_ID').first();
  if (setting?.value) {
    try {
      const checkRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${setting.value}?fields=id,name,webViewLink,trashed`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (checkRes.ok) {
        const data = await checkRes.json();
        if (!data.trashed) {
          return { folderId: data.id, webViewLink: data.webViewLink || `https://drive.google.com/drive/folders/${data.id}` };
        }
      }
    } catch {
      // Re-search / create
    }
  }

  // Search if folder already exists by name
  const query = encodeURIComponent(`name = '${BACKUP_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      const found = searchData.files[0];
      const folderLink = found.webViewLink || `https://drive.google.com/drive/folders/${found.id}`;
      await saveFolderSetting(found.id);
      return { folderId: found.id, webViewLink: folderLink };
    }
  }

  // Create dedicated folder
  const createFolderRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: BACKUP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'মেসার্স আব্দুস সামাদ মোল্লাহ্ Agro-POS GZIP Database Backups',
    }),
  });

  if (!createFolderRes.ok) {
    const err = await createFolderRes.text();
    throw new Error(`Google Drive ফোল্ডার তৈরি ব্যর্থ: ${err}`);
  }

  const newFolder = await createFolderRes.json();
  const folderLink = `https://drive.google.com/drive/folders/${newFolder.id}`;
  await saveFolderSetting(newFolder.id);
  return { folderId: newFolder.id, webViewLink: folderLink };
}

async function saveFolderSetting(folderId: string) {
  const now = new Date().toISOString();
  const setting = await db.settings.where('key').equals('GOOGLE_DRIVE_BACKUP_FOLDER_ID').first();
  if (setting) {
    await db.settings.update(setting.id, { value: folderId, updatedAt: now });
  } else {
    await db.settings.add({
      id: generateUUID(),
      key: 'GOOGLE_DRIVE_BACKUP_FOLDER_ID',
      value: folderId,
      updatedAt: now,
    });
  }
}

/**
 * Compress raw string into GZIP Uint8Array using native browser CompressionStream
 */
export async function compressStringGzip(rawString: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(rawString);

  if (typeof CompressionStream !== 'undefined') {
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(bytes);
    writer.close();

    const response = new Response(cs.readable);
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } else {
    // Fallback if CompressionStream unavailable
    return bytes;
  }
}

/**
 * Upload compressed GZIP database backup directly into the dedicated Google Drive folder
 */
export async function uploadGzipBackupToGoogleDrive(): Promise<{
  fileId: string;
  fileName: string;
  folderUrl: string;
  timestamp: string;
  sizeBytes: number;
}> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }

  // 1. Get or create dedicated folder
  const { folderId, webViewLink } = await getOrCreateDriveBackupFolder(token);

  // 2. Generate JSON backup payload
  const backupPayload = await generateBackupPayload();
  const jsonString = JSON.stringify(backupPayload, null, 2);

  // 3. Compress to GZIP
  const gzipBytes = await compressStringGzip(jsonString);

  // 4. Filename format: KRISHIPOS_BACKUP_YYYYMMDD_HHMMSS.json.gz
  const now = new Date();
  const dateStr = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const fileName = `KRISHIPOS_BACKUP_${dateStr}.json.gz`;

  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: 'application/gzip',
    description: `মেসার্স আব্দুস সামাদ মোল্লাহ্ সম্পূর্ণ GZIP ডাটাবেজ ব্যাকআপ (${now.toLocaleString('bn-BD')})`,
  };

  const boundary = '-------KrishiPOSBackupBoundary314159';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  // Construct multipart body with binary GZIP payload
  const metadataPart =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/gzip\r\n' +
    'Content-Transfer-Encoding: binary\r\n\r\n';

  const metaBytes = new TextEncoder().encode(metadataPart);
  const closeBytes = new TextEncoder().encode(closeDelimiter);

  const fullBody = new Uint8Array(metaBytes.length + gzipBytes.length + closeBytes.length);
  fullBody.set(metaBytes, 0);
  fullBody.set(gzipBytes, metaBytes.length);
  fullBody.set(closeBytes, metaBytes.length + gzipBytes.length);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: fullBody,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Google Drive GZIP আপলোড ব্যর্থ: ${errText}`);
  }

  const uploadedFile = await uploadRes.json();
  const timestampIso = now.toISOString();

  // Save LAST_BACKUP_TIME
  const setting = await db.settings.where('key').equals('LAST_BACKUP_TIME').first();
  if (setting) {
    await db.settings.update(setting.id, { value: timestampIso, updatedAt: timestampIso });
  } else {
    await db.settings.add({
      id: generateUUID(),
      key: 'LAST_BACKUP_TIME',
      value: timestampIso,
      updatedAt: timestampIso,
    });
  }

  // Record Sync Log
  await db.sync_log.add({
    id: generateUUID(),
    timestamp: timestampIso,
    destination: 'GOOGLE_DRIVE',
    status: 'SUCCESS',
    recordsSynced: backupPayload.data.transactions.length,
    fileId: uploadedFile.id,
    fileName,
    details: `Compressed GZIP Backup: ${Math.round(gzipBytes.length / 1024)} KB into ${BACKUP_FOLDER_NAME}`,
  });

  return {
    fileId: uploadedFile.id,
    fileName,
    folderUrl: webViewLink,
    timestamp: timestampIso,
    sizeBytes: gzipBytes.length,
  };
}

export const uploadBackupToGoogleDrive = uploadGzipBackupToGoogleDrive;

/**
 * Fetch list of recent backups inside the dedicated Google Drive folder
 */
export async function listDriveBackupFiles(): Promise<DriveBackupFile[]> {
  const token = await getAccessToken();
  if (!token) return [];

  try {
    const { folderId } = await getOrCreateDriveBackupFolder(token);
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=createdTime desc&pageSize=10&fields=files(id,name,createdTime,size,webViewLink)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (res.ok) {
      const data = await res.json();
      return (data.files || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        createdTime: f.createdTime,
        size: parseInt(f.size || '0'),
        webViewLink: f.webViewLink,
      }));
    }
  } catch (err) {
    console.warn('Failed to list drive backup files:', err);
  }
  return [];
}

/**
 * -------------------------------------------------------------
 * UTF-8 BOM CSV EXPORT (MICROSOFT EXCEL BENGALI SAFE)
 * -------------------------------------------------------------
 */

export function exportToUtf8BomCsv(rows: (string | number)[][], filename: string): void {
  // \uFEFF ensures Microsoft Excel detects UTF-8 and renders Bengali without breaking!
  const csvContent =
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((val) => {
            const str = String(val ?? '').replace(/"/g, '""');
            return `"${str}"`;
          })
          .join(',')
      )
      .join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function downloadExcelCsvExport(tab: SheetTabName): Promise<void> {
  let records: any[] = [];
  switch (tab) {
    case 'CUSTOMERS':
      records = await db.customers.toArray();
      break;
    case 'TRANSACTIONS':
      records = await db.transactions.toArray();
      break;
    case 'ITEMS':
      records = await db.transaction_items.toArray();
      break;
    case 'INVENTORY':
      records = await db.inventory.toArray();
      break;
    case 'DUE_LEDGER':
      records = await db.due_ledger.toArray();
      break;
    case 'CASH_EVENTS':
      records = await db.cash_events.toArray();
      break;
    default:
      records = await db.customers.toArray();
  }

  const headers = SHEET_HEADERS[tab];
  const rows = [headers, ...records.map((r) => recordToRowValues(tab, r))];
  const dateStr = new Date().toISOString().slice(0, 10);
  exportToUtf8BomCsv(rows, `SamadAgro_${tab}_${dateStr}.csv`);
}
