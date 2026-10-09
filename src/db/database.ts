import Dexie, { type Table } from 'dexie';
import type {
  Customer,
  CustomerKYC,
  Transaction,
  TransactionItem,
  Prescription,
  InventoryItem,
  InventoryMovement,
  Payment,
  DueLedgerRecord,
  CashEvent,
  CashDrawer,
  SyncQueueItem,
  SyncLog,
  ConflictLog,
  AuditLog,
  AppSetting,
} from '../types';

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getDeviceId(): string {
  const STORAGE_KEY = 'SAMAD_AGRO_DEVICE_ID';
  let deviceId = localStorage.getItem(STORAGE_KEY);
  if (!deviceId) {
    deviceId = `DEV-${generateUUID().substring(0, 8).toUpperCase()}`;
    localStorage.setItem(STORAGE_KEY, deviceId);
  }
  return deviceId;
}

export class AgroDatabase extends Dexie {
  // 15 Standard Tables
  customers!: Table<Customer, string>;
  customer_kyc!: Table<CustomerKYC, string>;
  transactions!: Table<Transaction, string>;
  transaction_items!: Table<TransactionItem, string>;
  prescriptions!: Table<Prescription, string>;
  inventory!: Table<InventoryItem, string>;
  inventory_movements!: Table<InventoryMovement, string>;
  cash_events!: Table<CashEvent, string>;
  cash_drawer!: Table<CashDrawer, string>;
  payments!: Table<Payment, string>;
  due_ledger!: Table<DueLedgerRecord, string>;
  products!: Table<InventoryItem, string>;
  sync_queue!: Table<SyncQueueItem, string>;
  sync_log!: Table<SyncLog, string>;
  app_settings!: Table<AppSetting, string>;

  // Backwards compatibility aliases
  kyc!: Table<CustomerKYC, string>;
  transactionItems!: Table<TransactionItem, string>;
  inventoryMovements!: Table<InventoryMovement, string>;
  dueLedger!: Table<DueLedgerRecord, string>;
  cashEvents!: Table<CashEvent, string>;
  cashDrawer!: Table<CashDrawer, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  settings!: Table<AppSetting, string>;
  conflictLogs!: Table<ConflictLog, string>;
  auditLogs!: Table<AuditLog, string>;

  constructor() {
    super('SamadAgroPOS_DB');

    this.version(1).stores({
      customers: 'id, mobile, nid, name, village, totalDue, syncStatus, updatedAt, createdAt',
      kyc: 'id, customerId, verifiedStatus, syncStatus, updatedAt',
      transactions: 'id, invoiceNo, idempotencyKey, customerId, paymentMethod, status, syncStatus, createdAt, updatedAt',
      transactionItems: 'id, transactionId, productId, syncStatus, createdAt',
      prescriptions: 'id, prescriptionNo, customerId, cropName, syncStatus, createdAt',
      inventory: 'id, code, name, category, stockQuantity, syncStatus, updatedAt',
      inventoryMovements: 'id, productId, type, referenceId, createdAt',
      payments: 'id, transactionId, customerId, paymentMethod, createdAt',
      dueLedger: 'id, customerId, transactionId, type, createdAt',
      cashEvents: 'id, eventType, paymentMethod, referenceId, createdAt',
      cashDrawer: 'id, sessionDate, status, createdAt',
      syncQueue: 'id, tableName, recordId, status, createdAt, attempts',
      auditLogs: 'id, action, entity, entityId, createdAt',
      conflictLogs: 'id, tableName, recordId, resolved, createdAt',
      settings: 'id, key, updatedAt',
    });

    this.version(2).stores({
      customers: 'id, mobile, nid, name, village, totalDue, syncStatus, updatedAt, createdAt',
    });

    // Version 3: Full 15 tables schema mapping
    this.version(3).stores({
      customers: 'id, mobile, nid, name, village, totalDue, syncStatus, updatedAt, createdAt',
      customer_kyc: 'id, customerId, verifiedStatus, syncStatus, updatedAt',
      transactions: 'id, invoiceNo, idempotencyKey, customerId, paymentMethod, status, syncStatus, createdAt, updatedAt',
      transaction_items: 'id, transactionId, productId, syncStatus, createdAt',
      prescriptions: 'id, prescriptionNo, customerId, cropName, syncStatus, createdAt',
      inventory: 'id, code, name, category, stockQuantity, syncStatus, updatedAt',
      inventory_movements: 'id, productId, type, referenceId, createdAt',
      cash_events: 'id, eventType, paymentMethod, referenceId, createdAt',
      cash_drawer: 'id, sessionDate, status, createdAt',
      payments: 'id, transactionId, customerId, paymentMethod, createdAt',
      due_ledger: 'id, customerId, transactionId, type, createdAt',
      products: 'id, code, name, category, stockQuantity, updatedAt',
      sync_queue: 'id, tableName, recordId, status, createdAt, attempts',
      sync_log: 'id, timestamp, destination, status',
      app_settings: 'id, key, updatedAt',
      conflictLogs: 'id, tableName, recordId, resolved, createdAt',
      auditLogs: 'id, action, entity, entityId, createdAt',
    });

    // Version 4: Guarantee totalDue is indexed on customers across any previously migrated DB
    this.version(4).stores({
      customers: 'id, mobile, nid, name, village, totalDue, syncStatus, updatedAt, createdAt',
    });

    // Assign compatibility aliases
    this.kyc = this.customer_kyc;
    this.transactionItems = this.transaction_items;
    this.inventoryMovements = this.inventory_movements;
    this.dueLedger = this.due_ledger;
    this.cashEvents = this.cash_events;
    this.cashDrawer = this.cash_drawer;
    this.syncQueue = this.sync_queue;
    this.settings = this.app_settings;
  }
}

export const db = new AgroDatabase();

// 1-Bigha Approved Base Dose Standard (১ বিঘা = ৩৩ শতাংশ)
export const ONE_BIGHA_BASE_DOSE = [
  {
    name: 'জিপসাম (Gypsum)',
    banglaName: 'জিপসাম সার',
    code: 'BASE-GYP',
    category: 'সার' as const,
    baseDoseKg: 10, // ১০ কেজি
    unit: 'কেজি' as const,
    packSize: '10 KG',
    costPrice: 200,
    sellingPrice: 250,
    dosageInstructions: 'জমি তৈরির শেষ চাষে প্রতি বিঘায় ১০ কেজি সমানভাবে ছিটিয়ে দিন।',
  },
  {
    name: 'রোটন (Roton)',
    banglaName: 'রোটন বায়ো সার',
    code: 'BASE-ROT',
    category: 'অণুখাদ্য' as const,
    baseDoseKg: 2, // ২ কেজি
    unit: 'কেজি' as const,
    packSize: '2 KG',
    costPrice: 320,
    sellingPrice: 400,
    dosageInstructions: 'মাটির উর্বরতা ও শিকড় বৃদ্ধির জন্য প্রতি বিঘায় ২ কেজি প্রয়োগ করুন।',
  },
  {
    name: 'ম্যাগনেসিয়াম (Magnesium Sulphate)',
    banglaName: 'ম্যাগনেসিয়াম সালফেট',
    code: 'BASE-MAG',
    category: 'অণুখাদ্য' as const,
    baseDoseKg: 3, // ৩ কেজি
    unit: 'কেজি' as const,
    packSize: '1 KG',
    costPrice: 90,
    sellingPrice: 120,
    dosageInstructions: 'গাছের সবুজ কণা গঠন ও সালোকসংশ্লেষণ বৃদ্ধির জন্য প্রতি বিঘায় ৩ কেজি।',
  },
  {
    name: 'দানাদার কীটনাশক (Granular Insecticide)',
    banglaName: 'কারটাপ ৪জি / ভিরতাকো দানাদার',
    code: 'BASE-GRAN',
    category: 'কীটনাশক' as const,
    baseDoseKg: 2, // ২ কেজি
    unit: 'কেজি' as const,
    packSize: '1 KG',
    costPrice: 220,
    sellingPrice: 280,
    dosageInstructions: 'মাজরা ও মাটির ক্ষতিকর পোকা দমনে জমি তৈরির সময় প্রতি বিঘায় ২ কেজি।',
  },
  {
    name: 'বোরন (Boron 20%)',
    banglaName: 'বোরন ২০%',
    code: 'BASE-BOR',
    category: 'অণুখাদ্য' as const,
    baseDoseKg: 1, // ১ কেজি
    unit: 'কেজি' as const,
    packSize: '1 KG',
    costPrice: 350,
    sellingPrice: 420,
    dosageInstructions: 'ফুল ও দানার পুষ্টি নিশ্চিত করতে ও পরাগায়ন বাড়াতে প্রতি বিঘায় ১ কেজি।',
  },
  {
    name: 'সালফার (Sulphur 80% WDG)',
    banglaName: 'সালফার ৮০% থিওভিট',
    code: 'BASE-SULF',
    category: 'সার' as const,
    baseDoseKg: 1, // ১ কেজি
    unit: 'কেজি' as const,
    packSize: '1 KG',
    costPrice: 180,
    sellingPrice: 220,
    dosageInstructions: 'ছত্রাক ও সালফার ঘাটতি প্রতিরোধে প্রতি বিঘায় ১ কেজি প্রয়োগ করুন।',
  },
];

// Initial database seeding for মেসার্স আব্দুস সামাদ মোল্লাহ্ (BCIC ও BADC ডিলার)
export async function seedInitialDataIfNeeded() {
  const inventoryCount = await db.inventory.count();
  const now = new Date().toISOString();
  const deviceId = getDeviceId();

  if (inventoryCount === 0) {
    const initialItems: InventoryItem[] = [
      // 1-Bigha Base Agronomic Products
      ...ONE_BIGHA_BASE_DOSE.map((item) => ({
        id: generateUUID(),
        code: item.code,
        name: item.name,
        banglaName: item.banglaName,
        category: item.category,
        packSize: item.packSize,
        unit: item.unit,
        costPrice: item.costPrice,
        sellingPrice: item.sellingPrice,
        stockQuantity: 150,
        minStockAlert: 20,
        batchNo: `B-${item.code}-26`,
        expireDate: '2028-12-31',
        manufacturer: 'BADC / BCIC Approved',
        rackLocation: 'Godown Bay 1',
        genericName: item.name,
        syncStatus: 'PENDING' as const,
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: 1,
      })),
      // Regular Major Fertilizers (BADC & BCIC)
      {
        id: generateUUID(),
        code: 'FERT-UREA',
        name: 'Urea (ইউরিয়া সার)',
        banglaName: 'ইউরিয়া',
        category: 'সার',
        packSize: '50 KG',
        unit: 'বস্তা',
        costPrice: 1200,
        sellingPrice: 1350,
        stockQuantity: 120,
        minStockAlert: 20,
        batchNo: 'B-UREA-26',
        expireDate: '2028-12-31',
        manufacturer: 'BCIC Bangladesh',
        rackLocation: 'Godown Bay A',
        genericName: '46% Nitrogen',
        syncStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: 1,
      },
      {
        id: generateUUID(),
        code: 'FERT-DAP-BADC',
        name: 'DAP (BADC)',
        banglaName: 'DAP (BADC)',
        category: 'সার',
        packSize: '50 KG',
        unit: 'বস্তা',
        costPrice: 1450,
        sellingPrice: 1600,
        stockQuantity: 85,
        minStockAlert: 15,
        batchNo: 'B-DAP-26',
        expireDate: '2028-12-31',
        manufacturer: 'BADC Bangladesh',
        rackLocation: 'Godown Bay A',
        genericName: 'Di-Ammonium Phosphate (18-46-0)',
        syncStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: 1,
      },
      {
        id: generateUUID(),
        code: 'FERT-TSP-BADC',
        name: 'TSP (BADC)',
        banglaName: 'TSP (BADC)',
        category: 'সার',
        packSize: '50 KG',
        unit: 'বস্তা',
        costPrice: 1100,
        sellingPrice: 1250,
        stockQuantity: 70,
        minStockAlert: 10,
        batchNo: 'B-TSP-26',
        expireDate: '2028-12-31',
        manufacturer: 'BADC Bangladesh',
        rackLocation: 'Godown Bay A',
        genericName: 'Triple Super Phosphate',
        syncStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: 1,
      },
      {
        id: generateUUID(),
        code: 'FERT-MOP-BADC',
        name: 'MOP (BADC)',
        banglaName: 'MOP (BADC)',
        category: 'সার',
        packSize: '50 KG',
        unit: 'বস্তা',
        costPrice: 900,
        sellingPrice: 1050,
        stockQuantity: 95,
        minStockAlert: 15,
        batchNo: 'B-MOP-26',
        expireDate: '2028-12-31',
        manufacturer: 'BADC',
        rackLocation: 'Godown Bay A',
        genericName: 'Muriate of Potash (60% K2O)',
        syncStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: 1,
      },
      {
        id: generateUUID(),
        code: 'FERT-DAP-IMP',
        name: 'DAP (Imported)',
        banglaName: 'DAP (আমদানি)',
        category: 'সার',
        packSize: '50 KG',
        unit: 'বস্তা',
        costPrice: 1550,
        sellingPrice: 1700,
        stockQuantity: 60,
        minStockAlert: 15,
        batchNo: 'B-DAP-IMP-26',
        expireDate: '2028-12-31',
        manufacturer: 'Imported',
        rackLocation: 'Godown Bay B',
        genericName: 'Di-Ammonium Phosphate',
        syncStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: 1,
      },
      {
        id: generateUUID(),
        code: 'FERT-TSP-IMP',
        name: 'TSP (Imported)',
        banglaName: 'TSP (আমদানি)',
        category: 'সার',
        packSize: '50 KG',
        unit: 'বস্তা',
        costPrice: 1250,
        sellingPrice: 1400,
        stockQuantity: 50,
        minStockAlert: 10,
        batchNo: 'B-TSP-IMP-26',
        expireDate: '2028-12-31',
        manufacturer: 'Imported',
        rackLocation: 'Godown Bay B',
        genericName: 'Triple Super Phosphate',
        syncStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: 1,
      },
      {
        id: generateUUID(),
        code: 'FERT-MOP-IMP',
        name: 'MOP (Imported)',
        banglaName: 'MOP (আমদানি)',
        category: 'সার',
        packSize: '50 KG',
        unit: 'বস্তা',
        costPrice: 950,
        sellingPrice: 1100,
        stockQuantity: 55,
        minStockAlert: 10,
        batchNo: 'B-MOP-IMP-26',
        expireDate: '2028-12-31',
        manufacturer: 'Imported',
        rackLocation: 'Godown Bay B',
        genericName: 'Muriate of Potash',
        syncStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: 1,
      },
      {
        id: generateUUID(),
        code: 'FERT-DAP-BCIC',
        name: 'DAP (BCIC)',
        banglaName: 'DAP (BCIC)',
        category: 'সার',
        packSize: '50 KG',
        unit: 'বস্তা',
        costPrice: 1500,
        sellingPrice: 1650,
        stockQuantity: 45,
        minStockAlert: 10,
        batchNo: 'B-DAP-BCIC-26',
        expireDate: '2028-12-31',
        manufacturer: 'BCIC',
        rackLocation: 'Godown Bay C',
        genericName: 'Di-Ammonium Phosphate',
        syncStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: 1,
      },
      {
        id: generateUUID(),
        code: 'FERT-TSP-BCIC',
        name: 'TSP (BCIC)',
        banglaName: 'TSP (BCIC)',
        category: 'সার',
        packSize: '50 KG',
        unit: 'বস্তা',
        costPrice: 1200,
        sellingPrice: 1350,
        stockQuantity: 40,
        minStockAlert: 10,
        batchNo: 'B-TSP-BCIC-26',
        expireDate: '2028-12-31',
        manufacturer: 'BCIC',
        rackLocation: 'Godown Bay C',
        genericName: 'Triple Super Phosphate',
        syncStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: 1,
      },
      {
        id: generateUUID(),
        code: 'FUNG-001',
        name: 'Amistar Top (অ্যামিস্টার টপ)',
        banglaName: 'অ্যামিস্টার টপ ৩২৫ এসসি',
        category: 'ছত্রাকনাশক',
        packSize: '100 ml',
        unit: 'পিস',
        costPrice: 420,
        sellingPrice: 500,
        stockQuantity: 65,
        minStockAlert: 10,
        batchNo: 'AST-2605',
        expireDate: '2028-03-15',
        manufacturer: 'Syngenta Bangladesh',
        rackLocation: 'Rack C1',
        genericName: 'Azoxystrobin 20% + Difenoconazole 12.5%',
        syncStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: 1,
      },
      {
        id: generateUUID(),
        code: 'FUNG-002',
        name: 'Natizo 75 WG (নাটিভো)',
        banglaName: 'নাটিভো ৭৫ ডব্লিউজি',
        category: 'ছত্রাকনাশক',
        packSize: '50 gm',
        unit: 'প্যাকেট',
        costPrice: 310,
        sellingPrice: 380,
        stockQuantity: 90,
        minStockAlert: 15,
        batchNo: 'NAT-26B',
        expireDate: '2028-04-10',
        manufacturer: 'Bayer CropScience',
        rackLocation: 'Rack C2',
        genericName: 'Tebuconazole 50% + Trifloxystrobin 25%',
        syncStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: 1,
      },
      {
        id: generateUUID(),
        code: 'SEED-001',
        name: 'Hybrid Dhan Shonali 1',
        banglaName: 'হাইব্রিড সোনালী ১ ধান বীজ',
        category: 'বীজ',
        packSize: '2 KG',
        unit: 'প্যাকেট',
        costPrice: 580,
        sellingPrice: 680,
        stockQuantity: 80,
        minStockAlert: 15,
        batchNo: 'SD-2026-HY',
        expireDate: '2027-10-31',
        manufacturer: 'BADC Approved',
        rackLocation: 'Rack E1',
        genericName: 'High Yielding Hybrid Paddy Seed',
        syncStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: 1,
      },
    ];

    await db.inventory.bulkAdd(initialItems);
    await db.products.bulkAdd(initialItems);
  }

  const customerCount = await db.customers.count();
  if (customerCount === 0) {
    const sampleCustomers: Customer[] = [
      {
        id: generateUUID(),
        name: 'Md. Rafiqul Islam (রফিক মিয়া)',
        banglaName: 'রফিক মিয়া',
        mobile: '01712345678',
        nid: '19842612345678901',
        village: 'গোবিন্দপুর (Gobindapur)',
        union: 'গোবিন্দপুর',
        upazila: 'ভূঞাপুর',
        district: 'টাঙ্গাইল',
        creditLimit: 30000,
        totalDue: 4500,
        notes: 'নিয়মিত কৃষক, বোরো ধান ও আলুর চাষী',
        syncStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: 1,
      },
      {
        id: generateUUID(),
        name: 'Jamal Hossain Molla (জামাল হোসেন)',
        banglaName: 'জামাল হোসেন',
        mobile: '01898765432',
        nid: '19902698765432101',
        village: 'নিকরাইল (Nikrail)',
        union: 'নিকরাইল',
        upazila: 'ভূঞাপুর',
        district: 'টাঙ্গাইল',
        creditLimit: 35000,
        totalDue: 1200,
        notes: 'ধান ও সরিষার ফলন করেন। বিশ্বস্ত গ্রাহক।',
        syncStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: 1,
      },
      {
        id: generateUUID(),
        name: 'Mosharraf Talukdar (মোশাররফ তালুকদার)',
        banglaName: 'মোশাররফ তালুকদার',
        mobile: '01911223344',
        nid: '19782611223344556',
        village: 'ফলদা (Falda)',
        union: 'ফলদা',
        upazila: 'ভূঞাপুর',
        district: 'টাঙ্গাইল',
        creditLimit: 25000,
        totalDue: 0,
        notes: 'নগদ ক্রেতা, পেঁয়াজ ও গম চাষী।',
        syncStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
        deviceId,
        version: 1,
      },
    ];

    await db.customers.bulkAdd(sampleCustomers);
  }

  // Ensure cash drawer session exists for today
  const todayStr = new Date().toISOString().split('T')[0];
  const activeDrawer = await db.cash_drawer.where('sessionDate').equals(todayStr).first();
  if (!activeDrawer) {
    await db.cash_drawer.add({
      id: generateUUID(),
      sessionDate: todayStr,
      openingBalance: 15000, // 15,000 BDT opening cash
      currentCash: 15000,
      totalCashIn: 0,
      totalCashOut: 0,
      totalSalesCash: 0,
      totalDueCollectedCash: 0,
      status: 'OPEN',
      syncStatus: 'PENDING',
      createdAt: now,
      updatedAt: now,
      deviceId,
      version: 1,
    });
  }
}
