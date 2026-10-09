/**
 * M/S Abdus Samad Mollah - Smart Offline Agro-POS
 * Conflict-Safe Backup, Recovery & Conflict Log Service
 */

import { db, generateUUID, getDeviceId } from '../db/database';
import type { ConflictLog } from '../types';

export interface DatabaseBackupPayload {
  version: number;
  app: string;
  exportedAt: string;
  deviceId: string;
  data: {
    customers: any[];
    kyc: any[];
    transactions: any[];
    transactionItems: any[];
    prescriptions: any[];
    inventory: any[];
    inventoryMovements: any[];
    payments: any[];
    dueLedger: any[];
    cashEvents: any[];
    cashDrawer: any[];
    settings: any[];
  };
}

/**
 * Generate full JSON backup payload from Dexie
 */
export async function generateBackupPayload(): Promise<DatabaseBackupPayload> {
  const [
    customers,
    kyc,
    transactions,
    transactionItems,
    prescriptions,
    inventory,
    inventoryMovements,
    payments,
    dueLedger,
    cashEvents,
    cashDrawer,
    settings,
  ] = await Promise.all([
    db.customers.toArray(),
    db.kyc.toArray(),
    db.transactions.toArray(),
    db.transactionItems.toArray(),
    db.prescriptions.toArray(),
    db.inventory.toArray(),
    db.inventoryMovements.toArray(),
    db.payments.toArray(),
    db.dueLedger.toArray(),
    db.cashEvents.toArray(),
    db.cashDrawer.toArray(),
    db.settings.toArray(),
  ]);

  const backup: DatabaseBackupPayload = {
    version: 1,
    app: 'M/S Abdus Samad Mollah - Smart Offline Agro-POS',
    exportedAt: new Date().toISOString(),
    deviceId: getDeviceId(),
    data: {
      customers,
      kyc,
      transactions,
      transactionItems,
      prescriptions,
      inventory,
      inventoryMovements,
      payments,
      dueLedger,
      cashEvents,
      cashDrawer,
      settings,
    },
  };

  // Record last backup timestamp
  const now = new Date().toISOString();
  const setting = await db.settings.where('key').equals('LAST_BACKUP_TIME').first();
  if (setting) {
    await db.settings.update(setting.id, { value: now, updatedAt: now });
  } else {
    await db.settings.add({
      id: generateUUID(),
      key: 'LAST_BACKUP_TIME',
      value: now,
      updatedAt: now,
    });
  }

  return backup;
}

/**
 * Download manual backup JSON file
 */
export async function downloadBackupFile(): Promise<void> {
  const backup = await generateBackupPayload();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  link.download = `Samad_AgroPOS_Backup_${dateStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Validate and restore database from backup payload with conflict preservation
 */
export async function restoreDatabase(
  backup: DatabaseBackupPayload,
  conflictStrategy: 'OVERWRITE_OLDER' | 'KEEP_LOCAL' = 'OVERWRITE_OLDER'
): Promise<{ restoredCount: number; conflictCount: number }> {
  if (!backup || !backup.data || !backup.app) {
    throw new Error('অবৈধ ব্যাকআপ ফাইল। (Invalid backup file structure)');
  }

  let restoredCount = 0;
  let conflictCount = 0;
  const now = new Date().toISOString();

  await db.transaction(
    'rw',
    [
      db.customers,
      db.kyc,
      db.transactions,
      db.transactionItems,
      db.prescriptions,
      db.inventory,
      db.inventoryMovements,
      db.payments,
      db.dueLedger,
      db.cashEvents,
      db.cashDrawer,
      db.conflictLogs,
    ],
    async () => {
      // Helper function to upsert table with version/timestamp conflict check
      async function restoreTable(tableName: string, incomingItems: any[], tableRef: any) {
        for (const item of incomingItems) {
          if (!item.id) continue;
          const localItem = await tableRef.get(item.id);

          if (!localItem) {
            await tableRef.put(item);
            restoredCount++;
          } else {
            const localVersion = localItem.version || 1;
            const remoteVersion = item.version || 1;
            const localTime = new Date(localItem.updatedAt || 0).getTime();
            const remoteTime = new Date(item.updatedAt || 0).getTime();

            // Conflict detected: local is modified after remote or has higher version
            if (localVersion > remoteVersion || (localVersion === remoteVersion && localTime > remoteTime)) {
              conflictCount++;
              const conflict: ConflictLog = {
                id: generateUUID(),
                tableName,
                recordId: item.id,
                localVersion,
                remoteVersion,
                localData: localItem,
                remoteData: item,
                resolved: conflictStrategy === 'OVERWRITE_OLDER' ? false : true,
                createdAt: now,
              };
              await db.conflictLogs.add(conflict);

              if (conflictStrategy === 'OVERWRITE_OLDER') {
                // Keep local because local is newer
                continue;
              }
            } else {
              // Incoming is newer or equal, safe to update
              await tableRef.put(item);
              restoredCount++;
            }
          }
        }
      }

      await restoreTable('customers', backup.data.customers || [], db.customers);
      await restoreTable('kyc', backup.data.kyc || [], db.kyc);
      await restoreTable('transactions', backup.data.transactions || [], db.transactions);
      await restoreTable('transactionItems', backup.data.transactionItems || [], db.transactionItems);
      await restoreTable('prescriptions', backup.data.prescriptions || [], db.prescriptions);
      await restoreTable('inventory', backup.data.inventory || [], db.inventory);
      await restoreTable('inventoryMovements', backup.data.inventoryMovements || [], db.inventoryMovements);
      await restoreTable('payments', backup.data.payments || [], db.payments);
      await restoreTable('dueLedger', backup.data.dueLedger || [], db.dueLedger);
      await restoreTable('cashEvents', backup.data.cashEvents || [], db.cashEvents);
      await restoreTable('cashDrawer', backup.data.cashDrawer || [], db.cashDrawer);
    }
  );

  return { restoredCount, conflictCount };
}

/**
 * Check if automated daily backup was taken today, if not perform checkpoint
 */
export async function checkAndRunDailyBackup(): Promise<void> {
  const setting = await db.settings.where('key').equals('LAST_BACKUP_TIME').first();
  const todayStr = new Date().toISOString().split('T')[0];

  if (!setting?.value || !setting.value.startsWith(todayStr)) {
    // Generate backup and save checkpoint in settings
    const backup = await generateBackupPayload();
    const checkpointKey = `DAILY_CHECKPOINT_${todayStr}`;
    const existing = await db.settings.where('key').equals(checkpointKey).first();
    const now = new Date().toISOString();
    if (!existing) {
      await db.settings.add({
        id: generateUUID(),
        key: checkpointKey,
        value: JSON.stringify({ count: backup.data.transactions.length, time: now }),
        updatedAt: now,
      });
    }
  }
}

/**
 * Helper to escape CSV values safely and trigger UTF-8 BOM download for Excel Bengali support
 */
function escapeCsvCell(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function triggerCsvDownload(rows: any[][], filename: string): void {
  const csvContent =
    '\uFEFF' + rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
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

/**
 * Export all current transactions and transaction items as a CSV file
 */
export async function exportTransactionsToCSV(): Promise<number> {
  const [transactions, items] = await Promise.all([
    db.transactions.orderBy('createdAt').reverse().toArray(),
    db.transactionItems.toArray(),
  ]);

  const itemsByTx = new Map<string, string>();
  items.forEach((item) => {
    const prev = itemsByTx.get(item.transactionId);
    const summary = `${item.banglaName || item.productName} (${item.quantity} ${item.unit})`;
    itemsByTx.set(item.transactionId, prev ? `${prev}; ${summary}` : summary);
  });

  const rows: any[][] = [
    [
      'Invoice No',
      'Date & Time',
      'Customer Name',
      'Mobile',
      'Village',
      'Items Purchased',
      'Item Count',
      'Subtotal (BDT)',
      'Discount (BDT)',
      'Grand Total (BDT)',
      'Paid Amount (BDT)',
      'Due Amount (BDT)',
      'Payment Method',
      'Status',
      'Sync Status',
      'Notes',
    ],
    ...transactions.map((tx) => [
      tx.invoiceNo,
      new Date(tx.createdAt).toLocaleString('bn-BD'),
      tx.customerName,
      tx.customerMobile,
      tx.customerVillage || '',
      itemsByTx.get(tx.id) || '',
      tx.itemCount,
      tx.subtotal,
      tx.discount,
      tx.grandTotal,
      tx.paidAmount,
      tx.dueAmount,
      tx.paymentMethod,
      tx.status,
      tx.syncStatus,
      tx.notes || '',
    ]),
  ];

  const dateStr = new Date().toISOString().slice(0, 10);
  triggerCsvDownload(rows, `Samad_AgroPOS_Transactions_${dateStr}.csv`);
  return transactions.length;
}

/**
 * Export all current inventory items as a CSV file
 */
export async function exportInventoryToCSV(): Promise<number> {
  const inventory = await db.inventory.toArray();

  const rows: any[][] = [
    [
      'Product Code',
      'Product Name (English)',
      'Product Name (Bangla)',
      'Category',
      'Pack Size',
      'Unit',
      'Cost Price (BDT)',
      'Selling Price (BDT)',
      'Current Stock',
      'Min Stock Alert',
      'Stock Valuation (Cost BDT)',
      'Batch No',
      'Expire Date',
      'Manufacturer',
      'Rack Location',
      'Updated At',
    ],
    ...inventory.map((item) => [
      item.code,
      item.name,
      item.banglaName,
      item.category,
      item.packSize,
      item.unit,
      item.costPrice,
      item.sellingPrice,
      item.stockQuantity,
      item.minStockAlert,
      item.stockQuantity * item.costPrice,
      item.batchNo,
      item.expireDate,
      item.manufacturer,
      item.rackLocation,
      new Date(item.updatedAt).toLocaleString('bn-BD'),
    ]),
  ];

  const dateStr = new Date().toISOString().slice(0, 10);
  triggerCsvDownload(rows, `Samad_AgroPOS_Inventory_${dateStr}.csv`);
  return inventory.length;
}

/**
 * Export combined Transactions and Inventory data in a single comprehensive CSV file for external analysis
 */
export async function exportTransactionsAndInventoryCSV(): Promise<{
  txCount: number;
  invCount: number;
}> {
  const [transactions, items, inventory] = await Promise.all([
    db.transactions.orderBy('createdAt').reverse().toArray(),
    db.transactionItems.toArray(),
    db.inventory.toArray(),
  ]);

  const itemsByTx = new Map<string, string>();
  items.forEach((item) => {
    const prev = itemsByTx.get(item.transactionId);
    const summary = `${item.banglaName || item.productName} (${item.quantity} ${item.unit})`;
    itemsByTx.set(item.transactionId, prev ? `${prev}; ${summary}` : summary);
  });

  const dateStr = new Date().toISOString().slice(0, 10);

  const rows: any[][] = [
    ['M/S Abdus Samad Mollah - Transactions & Inventory Analysis Export', `Export Date: ${dateStr}`],
    [],
    ['=== SECTION 1: TRANSACTIONS DATA ==='],
    [
      'Invoice No',
      'Date & Time',
      'Customer Name',
      'Mobile',
      'Village',
      'Items Purchased',
      'Item Count',
      'Subtotal (BDT)',
      'Discount (BDT)',
      'Grand Total (BDT)',
      'Paid Amount (BDT)',
      'Due Amount (BDT)',
      'Payment Method',
      'Status',
      'Notes',
    ],
    ...transactions.map((tx) => [
      tx.invoiceNo,
      new Date(tx.createdAt).toLocaleString('bn-BD'),
      tx.customerName,
      tx.customerMobile,
      tx.customerVillage || '',
      itemsByTx.get(tx.id) || '',
      tx.itemCount,
      tx.subtotal,
      tx.discount,
      tx.grandTotal,
      tx.paidAmount,
      tx.dueAmount,
      tx.paymentMethod,
      tx.status,
      tx.notes || '',
    ]),
    [],
    ['=== SECTION 2: INVENTORY & STOCK DATA ==='],
    [
      'Product Code',
      'Product Name (English)',
      'Product Name (Bangla)',
      'Category',
      'Pack Size',
      'Unit',
      'Cost Price (BDT)',
      'Selling Price (BDT)',
      'Current Stock',
      'Min Stock Alert',
      'Stock Valuation (Cost BDT)',
      'Batch No',
      'Expire Date',
      'Manufacturer',
      'Rack Location',
    ],
    ...inventory.map((item) => [
      item.code,
      item.name,
      item.banglaName,
      item.category,
      item.packSize,
      item.unit,
      item.costPrice,
      item.sellingPrice,
      item.stockQuantity,
      item.minStockAlert,
      item.stockQuantity * item.costPrice,
      item.batchNo,
      item.expireDate,
      item.manufacturer,
      item.rackLocation,
    ]),
  ];

  triggerCsvDownload(rows, `Samad_AgroPOS_Transactions_And_Inventory_${dateStr}.csv`);
  return { txCount: transactions.length, invCount: inventory.length };
}

