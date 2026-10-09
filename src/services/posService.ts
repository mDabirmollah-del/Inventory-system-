/**
 * M/S Abdus Samad Mollah - Smart Offline Agro-POS
 * Real-Time Atomic Transaction Ledger & POS Service
 */

import { db, generateUUID, getDeviceId } from '../db/database';
import type {
  CartItem,
  Customer,
  Transaction,
  TransactionItem,
  PaymentMethod,
  CashEvent,
  DueLedgerRecord,
  Payment,
  InventoryMovement,
  SyncQueueItem,
} from '../types';

export interface CheckoutParams {
  idempotencyKey: string;
  customer: Customer;
  cartItems: CartItem[];
  subtotal: number;
  discount: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  prescriptionId?: string;
  receivedBy?: string;
}

export interface CheckoutResult {
  transaction: Transaction;
  items: TransactionItem[];
  invoiceNo: string;
}

export async function generateInvoiceNumber(): Promise<string> {
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const countToday = await db.transactions
    .where('createdAt')
    .between(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`, `${new Date().toISOString().slice(0, 10)}T23:59:59.999Z`)
    .count();
  const sequence = String(countToday + 1).padStart(4, '0');
  return `SAMAD-${todayStr}-${sequence}`;
}

/**
 * Normalize NID by converting Bangla digits to English digits and removing spaces/hyphens
 */
export function normalizeNid(nid?: string): string {
  if (!nid) return '';
  const banglaToEngMap: Record<string, string> = {
    '০': '0',
    '১': '1',
    '২': '2',
    '৩': '3',
    '৪': '4',
    '৫': '5',
    '৬': '6',
    '৭': '7',
    '৮': '8',
    '৯': '9',
  };
  return nid
    .trim()
    .replace(/[০-৯]/g, (match) => banglaToEngMap[match] || match)
    .replace(/[\s-]/g, '');
}

/**
 * Check if a farmer (by Voter ID / NID or Customer ID) has already made a purchase today.
 * Rule: সারা দিনে একটি ভোটার আইডি কার্ড দিয়ে একবারই মাল ক্রয় করতে পারবে কৃষক।
 */
export async function checkFarmerDailyLimit(
  nid?: string,
  customerId?: string
): Promise<{
  allowed: boolean;
  existingTransaction?: Transaction;
  reason?: string;
}> {
  const cleanNid = normalizeNid(nid);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

  const allTxs = await db.transactions.toArray();
  const todayCompletedTxs = allTxs.filter((tx) => {
    if (tx.status !== 'COMPLETED') return false;
    const txTime = new Date(tx.createdAt).getTime();
    return txTime >= startOfDay && txTime <= endOfDay;
  });

  if (todayCompletedTxs.length === 0) {
    return { allowed: true };
  }

  // 1. Check by normalized NID across today's transactions and registered customers
  if (cleanNid) {
    const allCustomers = await db.customers.toArray();
    const customerIdsWithSameNid = new Set<string>(
      allCustomers.filter((c) => normalizeNid(c.nid) === cleanNid).map((c) => c.id)
    );

    const matchedByNidTx = todayCompletedTxs.find(
      (tx) =>
        normalizeNid(tx.customerNid) === cleanNid ||
        customerIdsWithSameNid.has(tx.customerId)
    );

    if (matchedByNidTx) {
      const timeStr = new Date(matchedByNidTx.createdAt).toLocaleTimeString('bn-BD', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return {
        allowed: false,
        existingTransaction: matchedByNidTx,
        reason: `এই ভোটার আইডি কার্ড (NID: ${nid?.trim()}) দিয়ে আজ ইতিমধ্যে একবার মাল ক্রয় করা হয়েছে (মেমো নং: ${matchedByNidTx.invoiceNo}, সময়: ${timeStr}, কৃষক: ${matchedByNidTx.customerName})। সরকারি নিয়ম অনুযায়ী সারা দিনে একটি ভোটার আইডি কার্ড দিয়ে একবারই মাল ক্রয় করতে পারবে কৃষক।`,
      };
    }
  }

  // 2. Check by customerId if the same selected customer already bought today
  if (customerId) {
    const matchedByCustomerTx = todayCompletedTxs.find((tx) => tx.customerId === customerId);
    if (matchedByCustomerTx) {
      const timeStr = new Date(matchedByCustomerTx.createdAt).toLocaleTimeString('bn-BD', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return {
        allowed: false,
        existingTransaction: matchedByCustomerTx,
        reason: `এই কৃষক (${matchedByCustomerTx.customerName}) আজ ইতিমধ্যে একবার মাল ক্রয় করেছেন (মেমো নং: ${matchedByCustomerTx.invoiceNo}, সময়: ${timeStr})। সারা দিনে একটি ভোটার আইডি কার্ড দিয়ে একবারই মাল ক্রয় করতে পারবে কৃষক।`,
      };
    }
  }

  return { allowed: true };
}

export async function processSaleCheckout(params: CheckoutParams): Promise<CheckoutResult> {
  const {
    idempotencyKey,
    customer,
    cartItems,
    subtotal,
    discount,
    grandTotal,
    paidAmount,
    dueAmount,
    paymentMethod,
    notes,
    prescriptionId,
    receivedBy = 'কাউন্টার ম্যানেজার',
  } = params;

  if (cartItems.length === 0) {
    throw new Error('কার্ট খালি। অনুগ্রহ করে পণ্য যোগ করুন। (Cart is empty)');
  }

  // Idempotency check: prevent duplicate submissions
  const existingTx = await db.transactions.where('idempotencyKey').equals(idempotencyKey).first();
  if (existingTx) {
    const existingItems = await db.transactionItems.where('transactionId').equals(existingTx.id).toArray();
    return {
      transaction: existingTx,
      items: existingItems,
      invoiceNo: existingTx.invoiceNo,
    };
  }

  // Enforce 1 NID = 1 Purchase Per Day Rule
  if (!normalizeNid(customer.nid)) {
    throw new Error('মাল ক্রয়ের জন্য কৃষকের ভোটার আইডি কার্ড (NID) নম্বর প্রদান করা আবশ্যক।');
  }

  const dailyCheck = await checkFarmerDailyLimit(customer.nid, customer.id);
  if (!dailyCheck.allowed) {
    throw new Error(
      dailyCheck.reason ||
        'সারা দিনে একটি ভোটার আইডি কার্ড দিয়ে একবারই মাল ক্রয় করতে পারবে কৃষক।'
    );
  }

  const now = new Date().toISOString();
  const deviceId = getDeviceId();
  const transactionId = generateUUID();
  const invoiceNo = await generateInvoiceNumber();

  return await db.transaction(
    'rw',
    [
      db.transactions,
      db.transactionItems,
      db.inventory,
      db.inventoryMovements,
      db.payments,
      db.dueLedger,
      db.cashEvents,
      db.cashDrawer,
      db.customers,
      db.syncQueue,
      db.auditLogs,
    ],
    async () => {
      // 1. Validate & deduct inventory for each item
      const createdItems: TransactionItem[] = [];
      const createdMovements: InventoryMovement[] = [];
      const syncItems: SyncQueueItem[] = [];

      for (const item of cartItems) {
        const product = await db.inventory.get(item.product.id);
        if (!product) {
          throw new Error(`পণ্য খুঁজে পাওয়া যায়নি: ${item.product.name}`);
        }

        const newStock = product.stockQuantity - item.quantity;
        const updatedVersion = (product.version || 1) + 1;

        // Update inventory table
        await db.inventory.update(product.id, {
          stockQuantity: newStock,
          updatedAt: now,
          version: updatedVersion,
          syncStatus: 'PENDING',
        });

        // Record sync queue for inventory update
        syncItems.push({
          id: generateUUID(),
          tableName: 'inventory',
          recordId: product.id,
          operation: 'UPSERT',
          payload: { ...product, stockQuantity: newStock, updatedAt: now, version: updatedVersion },
          status: 'PENDING',
          attempts: 0,
          createdAt: now,
          updatedAt: now,
          deviceId,
          version: updatedVersion,
          syncStatus: 'PENDING',
        });

        // Record Inventory Movement
        const movementId = generateUUID();
        const movement: InventoryMovement = {
          id: movementId,
          productId: product.id,
          type: 'SALE',
          quantity: item.quantity,
          referenceId: invoiceNo,
          balanceAfter: newStock,
          notes: `বিক্রয় মেমো: ${invoiceNo}`,
          createdAt: now,
          updatedAt: now,
          deviceId,
          version: 1,
          syncStatus: 'PENDING',
        };
        await db.inventoryMovements.add(movement);
        createdMovements.push(movement);

        // Record Transaction Item
        const txItemId = generateUUID();
        const txItem: TransactionItem = {
          id: txItemId,
          transactionId,
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          banglaName: product.banglaName || product.name,
          category: product.category,
          batchNo: product.batchNo,
          unit: product.unit,
          packSize: product.packSize,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          costPrice: product.costPrice,
          discount: item.discount,
          total: item.total,
          createdAt: now,
          updatedAt: now,
          deviceId,
          version: 1,
          syncStatus: 'PENDING',
        };
        await db.transactionItems.add(txItem);
        createdItems.push(txItem);

        syncItems.push({
          id: generateUUID(),
          tableName: 'transactionItems',
          recordId: txItemId,
          operation: 'UPSERT',
          payload: txItem,
          status: 'PENDING',
          attempts: 0,
          createdAt: now,
          updatedAt: now,
          deviceId,
          version: 1,
          syncStatus: 'PENDING',
        });
      }

      // 2. Create Transaction Record
      const newTransaction: Transaction = {
        id: transactionId,
        invoiceNo,
        idempotencyKey,
        customerId: customer.id,
        customerName: customer.name,
        customerMobile: customer.mobile,
        customerNid: customer.nid,
        customerVillage: customer.village,
        subtotal,
        discount,
        tax: 0,
        grandTotal,
        paidAmount,
        dueAmount,
        paymentMethod,
        status: 'COMPLETED',
        notes,
        prescriptionId,
        itemCount: cartItems.length,
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: 1,
        syncStatus: 'PENDING',
      };
      await db.transactions.add(newTransaction);

      syncItems.push({
        id: generateUUID(),
        tableName: 'transactions',
        recordId: transactionId,
        operation: 'UPSERT',
        payload: newTransaction,
        status: 'PENDING',
        attempts: 0,
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: 1,
        syncStatus: 'PENDING',
      });

      // 3. Payment Record (if paidAmount > 0)
      if (paidAmount > 0) {
        const paymentId = generateUUID();
        const paymentRecord: Payment = {
          id: paymentId,
          transactionId,
          customerId: customer.id,
          amount: paidAmount,
          paymentMethod,
          referenceNo: invoiceNo,
          receivedBy,
          createdAt: now,
          updatedAt: now,
          deviceId,
          version: 1,
          syncStatus: 'PENDING',
        };
        await db.payments.add(paymentRecord);

        syncItems.push({
          id: generateUUID(),
          tableName: 'payments',
          recordId: paymentId,
          operation: 'UPSERT',
          payload: paymentRecord,
          status: 'PENDING',
          attempts: 0,
          createdAt: now,
          updatedAt: now,
          deviceId,
          version: 1,
          syncStatus: 'PENDING',
        });
      }

      // 4. Cash Drawer & Cash Event Record
      // For partial or full payment, only actual cash/digital enters cash events
      const todayStr = now.split('T')[0];
      let drawer = await db.cashDrawer.where('sessionDate').equals(todayStr).first();
      if (!drawer) {
        drawer = {
          id: generateUUID(),
          sessionDate: todayStr,
          openingBalance: 10000,
          currentCash: 10000,
          totalCashIn: 0,
          totalCashOut: 0,
          totalSalesCash: 0,
          totalDueCollectedCash: 0,
          status: 'OPEN',
          createdAt: now,
          updatedAt: now,
          deviceId,
          version: 1,
          syncStatus: 'PENDING',
        };
        await db.cashDrawer.add(drawer);
      }

      if (paidAmount > 0) {
        const cashBalanceAfter = drawer.currentCash + (paymentMethod === 'CASH' ? paidAmount : 0);
        const cashEventId = generateUUID();
        const cashEvent: CashEvent = {
          id: cashEventId,
          eventType: 'SALE',
          amount: paidAmount,
          paymentMethod,
          referenceId: invoiceNo,
          description: `পণ্য বিক্রয় মেমো: ${invoiceNo} (${customer.name})`,
          performedBy: receivedBy,
          balanceAfter: cashBalanceAfter,
          createdAt: now,
          updatedAt: now,
          deviceId,
          version: 1,
          syncStatus: 'PENDING',
        };
        await db.cashEvents.add(cashEvent);

        syncItems.push({
          id: generateUUID(),
          tableName: 'cashEvents',
          recordId: cashEventId,
          operation: 'UPSERT',
          payload: cashEvent,
          status: 'PENDING',
          attempts: 0,
          createdAt: now,
          updatedAt: now,
          deviceId,
          version: 1,
          syncStatus: 'PENDING',
        });

        // Update Cash Drawer totals
        await db.cashDrawer.update(drawer.id, {
          currentCash: cashBalanceAfter,
          totalSalesCash: drawer.totalSalesCash + (paymentMethod === 'CASH' ? paidAmount : 0),
          totalCashIn: drawer.totalCashIn + (paymentMethod === 'CASH' ? paidAmount : 0),
          updatedAt: now,
        });
      }

      // 5. Due Ledger Record & Customer balance update (if dueAmount > 0)
      if (dueAmount > 0) {
        const customerRecord = await db.customers.get(customer.id);
        const currentDue = customerRecord?.totalDue || 0;
        const newCustomerDue = currentDue + dueAmount;

        const dueRecordId = generateUUID();
        const dueRecord: DueLedgerRecord = {
          id: dueRecordId,
          customerId: customer.id,
          customerName: customer.name,
          transactionId,
          type: 'SALE_DUE',
          amount: dueAmount,
          balanceAfter: newCustomerDue,
          notes: `মেমো: ${invoiceNo} এর বকেয়া`,
          createdAt: now,
          updatedAt: now,
          deviceId,
          version: 1,
          syncStatus: 'PENDING',
        };
        await db.dueLedger.add(dueRecord);

        syncItems.push({
          id: generateUUID(),
          tableName: 'dueLedger',
          recordId: dueRecordId,
          operation: 'UPSERT',
          payload: dueRecord,
          status: 'PENDING',
          attempts: 0,
          createdAt: now,
          updatedAt: now,
          deviceId,
          version: 1,
          syncStatus: 'PENDING',
        });

        // Update customer total due
        const custVersion = (customerRecord?.version || 1) + 1;
        await db.customers.update(customer.id, {
          totalDue: newCustomerDue,
          updatedAt: now,
          version: custVersion,
          syncStatus: 'PENDING',
        });

        syncItems.push({
          id: generateUUID(),
          tableName: 'customers',
          recordId: customer.id,
          operation: 'UPSERT',
          payload: { ...customerRecord, totalDue: newCustomerDue, updatedAt: now, version: custVersion },
          status: 'PENDING',
          attempts: 0,
          createdAt: now,
          updatedAt: now,
          deviceId,
          version: custVersion,
          syncStatus: 'PENDING',
        });
      }

      // 6. Bulk add all sync items
      await db.syncQueue.bulkAdd(syncItems);

      // 7. Audit log
      await db.auditLogs.add({
        id: generateUUID(),
        action: 'SALE_COMPLETED',
        entity: 'transactions',
        entityId: transactionId,
        details: `Invoice: ${invoiceNo}, Total: ${grandTotal} BDT, Paid: ${paidAmount} BDT, Due: ${dueAmount} BDT`,
        performedBy: receivedBy,
        createdAt: now,
        deviceId,
      });

      return {
        transaction: newTransaction,
        items: createdItems,
        invoiceNo,
      };
    }
  );
}

export async function collectDuePayment(params: {
  customerId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  receivedBy?: string;
}): Promise<{ payment: Payment; newBalance: number }> {
  const { customerId, amount, paymentMethod, notes, receivedBy = 'কাউন্টার ম্যানেজার' } = params;

  if (amount <= 0) {
    throw new Error('টাকার পরিমাণ ০ এর বেশি হতে হবে।');
  }

  const now = new Date().toISOString();
  const deviceId = getDeviceId();

  return await db.transaction(
    'rw',
    [
      db.customers,
      db.payments,
      db.dueLedger,
      db.cashEvents,
      db.cashDrawer,
      db.syncQueue,
      db.auditLogs,
    ],
    async () => {
      const customer = await db.customers.get(customerId);
      if (!customer) {
        throw new Error('গ্রাহক পাওয়া যায়নি।');
      }

      const currentDue = customer.totalDue || 0;
      const newBalance = Math.max(0, currentDue - amount);
      const custVersion = (customer.version || 1) + 1;

      // Update customer total due
      await db.customers.update(customerId, {
        totalDue: newBalance,
        updatedAt: now,
        version: custVersion,
        syncStatus: 'PENDING',
      });

      // Payment record
      const paymentId = generateUUID();
      const payment: Payment = {
        id: paymentId,
        customerId,
        amount,
        paymentMethod,
        referenceNo: `DUE-COLLECT-${Date.now()}`,
        receivedBy,
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: 1,
        syncStatus: 'PENDING',
      };
      await db.payments.add(payment);

      // Due ledger record
      const dueId = generateUUID();
      const dueRecord: DueLedgerRecord = {
        id: dueId,
        customerId,
        customerName: customer.name,
        type: 'PAYMENT_COLLECTION',
        amount,
        balanceAfter: newBalance,
        notes: notes || 'বকেয়া টাকা পরিশোধ আদায়',
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: 1,
        syncStatus: 'PENDING',
      };
      await db.dueLedger.add(dueRecord);

      // Cash drawer & event
      const todayStr = now.split('T')[0];
      let drawer = await db.cashDrawer.where('sessionDate').equals(todayStr).first();
      if (!drawer) {
        drawer = {
          id: generateUUID(),
          sessionDate: todayStr,
          openingBalance: 10000,
          currentCash: 10000,
          totalCashIn: 0,
          totalCashOut: 0,
          totalSalesCash: 0,
          totalDueCollectedCash: 0,
          status: 'OPEN',
          createdAt: now,
          updatedAt: now,
          deviceId,
          version: 1,
          syncStatus: 'PENDING',
        };
        await db.cashDrawer.add(drawer);
      }

      const isCash = paymentMethod === 'CASH';
      const cashBalanceAfter = drawer.currentCash + (isCash ? amount : 0);

      const cashEventId = generateUUID();
      const cashEvent: CashEvent = {
        id: cashEventId,
        eventType: 'DUE_COLLECTION',
        amount,
        paymentMethod,
        referenceId: payment.referenceNo,
        description: `বকেয়া আদায়: ${customer.name} (${amount} ৳)`,
        performedBy: receivedBy,
        balanceAfter: cashBalanceAfter,
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: 1,
        syncStatus: 'PENDING',
      };
      await db.cashEvents.add(cashEvent);

      await db.cashDrawer.update(drawer.id, {
        currentCash: cashBalanceAfter,
        totalDueCollectedCash: drawer.totalDueCollectedCash + (isCash ? amount : 0),
        totalCashIn: drawer.totalCashIn + (isCash ? amount : 0),
        updatedAt: now,
      });

      // Sync queue items
      const syncItems: SyncQueueItem[] = [
        {
          id: generateUUID(),
          tableName: 'customers',
          recordId: customerId,
          operation: 'UPSERT',
          payload: { ...customer, totalDue: newBalance, updatedAt: now, version: custVersion },
          status: 'PENDING',
          attempts: 0,
          createdAt: now,
          updatedAt: now,
          deviceId,
          version: custVersion,
          syncStatus: 'PENDING',
        },
        {
          id: generateUUID(),
          tableName: 'payments',
          recordId: paymentId,
          operation: 'UPSERT',
          payload: payment,
          status: 'PENDING',
          attempts: 0,
          createdAt: now,
          updatedAt: now,
          deviceId,
          version: 1,
          syncStatus: 'PENDING',
        },
        {
          id: generateUUID(),
          tableName: 'dueLedger',
          recordId: dueId,
          operation: 'UPSERT',
          payload: dueRecord,
          status: 'PENDING',
          attempts: 0,
          createdAt: now,
          updatedAt: now,
          deviceId,
          version: 1,
          syncStatus: 'PENDING',
        },
        {
          id: generateUUID(),
          tableName: 'cashEvents',
          recordId: cashEventId,
          operation: 'UPSERT',
          payload: cashEvent,
          status: 'PENDING',
          attempts: 0,
          createdAt: now,
          updatedAt: now,
          deviceId,
          version: 1,
          syncStatus: 'PENDING',
        },
      ];
      await db.syncQueue.bulkAdd(syncItems);

      await db.auditLogs.add({
        id: generateUUID(),
        action: 'DUE_COLLECTED',
        entity: 'customers',
        entityId: customerId,
        details: `Customer: ${customer.name}, Collected: ${amount} BDT, New Due: ${newBalance} BDT`,
        performedBy: receivedBy,
        createdAt: now,
        deviceId,
      });

      return { payment, newBalance };
    }
  );
}

export async function recordCashAdjustment(params: {
  eventType: 'CASH_IN' | 'CASH_OUT' | 'ADJUSTMENT' | 'EXPENSE';
  amount: number;
  description: string;
  performedBy?: string;
}): Promise<CashEvent> {
  const { eventType, amount, description, performedBy = 'মালিক' } = params;
  if (amount <= 0) throw new Error('টাকার পরিমাণ ০ এর বেশি হতে হবে।');

  const now = new Date().toISOString();
  const deviceId = getDeviceId();
  const todayStr = now.split('T')[0];

  return await db.transaction('rw', [db.cashEvents, db.cashDrawer, db.syncQueue, db.auditLogs], async () => {
    let drawer = await db.cashDrawer.where('sessionDate').equals(todayStr).first();
    if (!drawer) {
      drawer = {
        id: generateUUID(),
        sessionDate: todayStr,
        openingBalance: 10000,
        currentCash: 10000,
        totalCashIn: 0,
        totalCashOut: 0,
        totalSalesCash: 0,
        totalDueCollectedCash: 0,
        status: 'OPEN',
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: 1,
        syncStatus: 'PENDING',
      };
      await db.cashDrawer.add(drawer);
    }

    const isOutflow = ['CASH_OUT', 'EXPENSE'].includes(eventType);
    const delta = isOutflow ? -amount : amount;
    const balanceAfter = drawer.currentCash + delta;

    const eventId = generateUUID();
    const event: CashEvent = {
      id: eventId,
      eventType,
      amount,
      paymentMethod: 'CASH',
      description,
      performedBy,
      balanceAfter,
      createdAt: now,
      updatedAt: now,
      deviceId,
      version: 1,
      syncStatus: 'PENDING',
    };
    await db.cashEvents.add(event);

    await db.cashDrawer.update(drawer.id, {
      currentCash: balanceAfter,
      totalCashIn: eventType === 'CASH_IN' ? drawer.totalCashIn + amount : drawer.totalCashIn,
      totalCashOut: isOutflow ? drawer.totalCashOut + amount : drawer.totalCashOut,
      updatedAt: now,
    });

    await db.syncQueue.add({
      id: generateUUID(),
      tableName: 'cashEvents',
      recordId: eventId,
      operation: 'UPSERT',
      payload: event,
      status: 'PENDING',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
      deviceId,
      version: 1,
      syncStatus: 'PENDING',
    });

    await db.auditLogs.add({
      id: generateUUID(),
      action: `CASH_${eventType}`,
      entity: 'cashDrawer',
      entityId: drawer.id,
      details: `${eventType}: ${amount} BDT - ${description}`,
      performedBy,
      createdAt: now,
      deviceId,
    });

    return event;
  });
}
