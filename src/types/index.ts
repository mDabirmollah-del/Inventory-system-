/**
 * M/S Abdus Samad Mollah - Smart Offline Agro-POS & Sheets Export Engine
 * BCIC & BADC Dealer, Gobindapur Bazar, Bhuapur, Tangail
 * Complete Data Models and Type Definitions
 */

export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

export interface BaseRecord {
  id: string; // UUID
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  deviceId: string;
  version: number;
  syncStatus: SyncStatus;
}

export interface Customer extends BaseRecord {
  name: string;
  banglaName?: string;
  mobile: string;
  nid?: string;
  village: string;
  union?: string;
  upazila?: string;
  district?: string;
  creditLimit: number;
  totalDue: number;
  notes?: string;
}

export interface CustomerKYC extends BaseRecord {
  customerId: string;
  nidFrontUrl?: string;
  nidBackUrl?: string;
  guarantorName?: string;
  guarantorMobile?: string;
  landSizeDecimals?: number;
  landSizeBigha?: number;
  primaryCrops?: string[];
  cropAgeDays?: number;
  verifiedStatus: 'VERIFIED' | 'PENDING' | 'UNVERIFIED';
}

export type PaymentMethod = 'CASH' | 'BKASH' | 'NAGAD' | 'BANK' | 'DUE' | 'MIXED';

export type TransactionStatus = 'COMPLETED' | 'REFUNDED' | 'VOID';

export interface TransactionItem extends BaseRecord {
  transactionId: string;
  productId: string;
  productCode: string;
  productName: string;
  banglaName: string;
  category: string;
  batchNo?: string;
  unit: string;
  packSize: string;
  quantity: number;
  unitPrice: number;
  costPrice: number; // For dealer ledger only; NEVER revealed on farmer cash memo!
  discount: number;
  total: number;
}

export interface Transaction extends BaseRecord {
  invoiceNo: string;
  idempotencyKey: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  customerNid?: string;
  customerVillage?: string;
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  notes?: string;
  prescriptionId?: string;
  itemCount: number;
}

export interface PrescribedProductItem {
  productId?: string;
  productCode?: string;
  productName: string;
  banglaName: string;
  category?: string;
  baseDosePerBigha: number; // Base dose in kg or liters per 1 Bigha (33 decimals)
  calculatedDose: number; // Multiplied dose according to land area
  basketQuantity: number; // Currently edited basket quantity
  unit: string;
  packSize?: string;
  unitPrice: number;
  total: number;
  dosageInstructions?: string;
  frequency?: string;
  stage?: string;
}

export interface Prescription extends BaseRecord {
  prescriptionNo: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  cropName: string;
  cropNameBangla: string;
  landArea: number;
  landUnit: 'বিঘা' | 'শতাংশ' | 'কাঠা' | 'একর';
  landAreaInDecimals: number; // Standardized into Decimals (শতাংশ) for calculation
  multiplier: number; // Multiplier relative to 1 Bigha (33 Decimals)
  symptoms: string;
  diagnosedIssue: string;
  adviceNotes: string;
  followUpDate?: string;
  items: PrescribedProductItem[];
}

export type ProductCategory =
  | 'সার'
  | 'কীটনাশক'
  | 'ছত্রাকনাশক'
  | 'আগাছানাশক'
  | 'অণুখাদ্য'
  | 'বীজ'
  | 'অন্যান্য';

export interface InventoryItem extends BaseRecord {
  code: string;
  name: string;
  banglaName: string;
  category: ProductCategory;
  packSize: string;
  unit: 'কেজি' | 'গ্রাম' | 'লিটার' | 'মিলি' | 'প্যাকেট' | 'বস্তা' | 'পিস';
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  minStockAlert: number;
  batchNo: string;
  expireDate: string;
  manufacturer: string;
  rackLocation: string;
  genericName?: string;
}

export type InventoryMovementType = 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'RETURN';

export interface InventoryMovement extends BaseRecord {
  productId: string;
  type: InventoryMovementType;
  quantity: number;
  referenceId: string;
  balanceAfter: number;
  notes?: string;
}

export interface Payment extends BaseRecord {
  transactionId?: string;
  customerId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNo?: string;
  receivedBy: string;
}

export type DueLedgerType = 'SALE_DUE' | 'PAYMENT_COLLECTION' | 'ADJUSTMENT';

export interface DueLedgerRecord extends BaseRecord {
  customerId: string;
  customerName?: string;
  transactionId?: string;
  type: DueLedgerType;
  amount: number;
  balanceAfter: number;
  notes?: string;
}

export type CashEventType =
  | 'SALE'
  | 'DUE_COLLECTION'
  | 'CASH_IN'
  | 'CASH_OUT'
  | 'EXPENSE'
  | 'REFUND'
  | 'ADJUSTMENT';

export interface CashEvent extends BaseRecord {
  eventType: CashEventType;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceId?: string;
  description: string;
  performedBy: string;
  balanceAfter: number;
}

export interface CashDrawer extends BaseRecord {
  sessionDate: string; // YYYY-MM-DD
  openingBalance: number;
  currentCash: number;
  totalCashIn: number;
  totalCashOut: number;
  totalSalesCash: number;
  totalDueCollectedCash: number;
  status: 'OPEN' | 'CLOSED';
}

export interface SyncQueueItem extends BaseRecord {
  tableName:
    | 'customers'
    | 'customer_kyc'
    | 'transactions'
    | 'transaction_items'
    | 'prescriptions'
    | 'inventory'
    | 'inventory_movements'
    | 'cash_events'
    | 'cash_drawer'
    | 'payments'
    | 'due_ledger'
    | 'products'
    | 'transactionItems'
    | 'cashEvents'
    | 'dueLedger'
    | 'inventoryMovements'
    | 'kyc';
  recordId: string;
  operation: 'UPSERT' | 'DELETE';
  payload: any;
  status: SyncStatus;
  attempts: number;
  lastError?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  details?: string;
  performedBy?: string;
  deviceId?: string;
  createdAt: string;
}

export interface SyncLog {
  id: string;
  timestamp: string;
  destination: 'GOOGLE_SHEETS' | 'GOOGLE_DRIVE';
  status: 'SUCCESS' | 'FAILED';
  recordsSynced: number;
  fileId?: string;
  fileName?: string;
  details?: string;
}

export interface ConflictLog {
  id: string;
  tableName: string;
  recordId: string;
  localVersion: number;
  remoteVersion: number;
  localData: any;
  remoteData: any;
  resolved: boolean;
  createdAt: string;
}

export interface AppSetting {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
}

export interface CartItem {
  id: string;
  product: InventoryItem;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export interface DailySummary {
  date: string;
  totalSalesAmount: number;
  totalSalesCount: number;
  totalCashCollected: number;
  totalDueGenerated: number;
  totalDueCollected: number;
  totalCustomersServed: number;
  totalPrescriptionsCount: number;
}

export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
  size?: number;
  webViewLink?: string;
}

export type PaperSize = '58mm' | '80mm' | 'A4';

export interface PrintSettings {
  autoPrintOnSale: boolean;
  paperSize: PaperSize;
  printCopies: number;
  compactView?: boolean;
}

export interface ShopSettings {
  shopName: string;
  shopNameShort: string;
  ownerName: string;
  managerName: string;
  slogan: string;
  address: string;
}
