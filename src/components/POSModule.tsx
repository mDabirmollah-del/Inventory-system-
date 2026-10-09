import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  ShoppingCart,
  UserPlus,
  Trash2,
  Plus,
  Minus,
  CheckCircle,
  FileText,
  AlertCircle,
  ArrowRight,
  Package,
  Layers,
  Sparkles,
  Printer,
  Sliders,
  Zap,
  Camera,
  User,
  Clock,
} from 'lucide-react';
import { db, generateUUID, getDeviceId, ONE_BIGHA_BASE_DOSE } from '../db/database';
import type {
  Customer,
  InventoryItem,
  CartItem,
  PaymentMethod,
  Transaction,
  TransactionItem,
  PrintSettings,
  CustomerKYC,
  ShopSettings,
} from '../types';
import {
  processSaleCheckout,
  checkFarmerDailyLimit,
  normalizeNid,
} from '../services/posService';
import { CashMemoModal } from './CashMemoModal';

const AUTHORIZED_VILLAGES = [
  "বাসুদেবকোল", "গোবিন্দপুর", "বানিয়াবাড়ী", "বড়র বয়ড়া", 
  "খাস বড়র বয়ড়া", "শুশুয়া", "রামাইল", "বারিয়াবাড়ী"
];

const AUTHORIZED_CROPS = [
  "বোরো ধান", "আমন ধান", "ভুট্টা", "সরিষা", "আলু", "শাকসবজি"
];

interface POSModuleProps {
  onGoToPrescriptions?: () => void;
  initialCartItems?: CartItem[];
  initialCustomer?: Customer;
  printSettings?: PrintSettings;
  onUpdatePrintSettings?: (newSettings: Partial<PrintSettings>) => void;
  onOpenPrintSettings?: () => void;
  onOpenPrintHistory?: () => void;
  shopSettings?: ShopSettings;
}

export const POSModule: React.FC<POSModuleProps> = ({
  onGoToPrescriptions,
  initialCartItems = [],
  initialCustomer,
  printSettings,
  onUpdatePrintSettings,
  onOpenPrintSettings,
  onOpenPrintHistory,
  shopSettings,
}) => {
  // Customer selection states
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(initialCustomer || null);

  // New Customer Form State
  const [newCustName, setNewCustName] = useState('');
  const [newCustMobile, setNewCustMobile] = useState('');
  const [newCustNid, setNewCustNid] = useState('');
  const [newCustVillage, setNewCustVillage] = useState<string>(AUTHORIZED_VILLAGES[0]);
  const [newCustUnion, setNewCustUnion] = useState('');
  const [newCustLandSize, setNewCustLandSize] = useState<number>(1);
  const [newCustCrop, setNewCustCrop] = useState<string>(AUTHORIZED_CROPS[0]);
  const [newCustCropAge, setNewCustCropAge] = useState<number>(0);
  const [newCustPhoto, setNewCustPhoto] = useState<string | null>(null);
  const [newCustCreditLimit, setNewCustCreditLimit] = useState(20000);

  // Product catalog & search states
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('সব');
  const [products, setProducts] = useState<InventoryItem[]>([]);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>(initialCartItems);
  const [overallDiscount, setOverallDiscount] = useState<number>(0);

  // Checkout modal states
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paidInput, setPaidInput] = useState<string>('');
  const [saleNotes, setSaleNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [showPreviewMode, setShowPreviewMode] = useState(false);

  // Completed memo state
  const [completedTransaction, setCompletedTransaction] = useState<Transaction | null>(null);
  const [completedItems, setCompletedItems] = useState<TransactionItem[]>([]);
  const [completedPrevDue, setCompletedPrevDue] = useState<number>(0);
  const [shouldAutoPrintCurrentSale, setShouldAutoPrintCurrentSale] = useState<boolean>(false);
  const [isFarmerMode, setIsFarmerMode] = useState(true); // Toggle between regular sale and farmer registration sale
  const [nextInvoiceNo, setNextInvoiceNo] = useState<string>('');

  // Daily 1-NID Purchase Limit State
  const [dailyNidCheck, setDailyNidCheck] = useState<{
    allowed: boolean;
    reason?: string;
    existingTransaction?: Transaction;
  }>({ allowed: true });
  const [todayPurchasedCustomerIds, setTodayPurchasedCustomerIds] = useState<Set<string>>(new Set());
  const [todayPurchasedNids, setTodayPurchasedNids] = useState<Set<string>>(new Set());
  const [posValidationAlert, setPosValidationAlert] = useState<string | null>(null);

  const landAreaInDecimals = useMemo(() => {
    return (Number(newCustLandSize) || 0) * 33; // Defaulting to Bigha logic (1 Bigha = 33 Decimals)
  }, [newCustLandSize]);

  const multiplier = useMemo(() => {
    return landAreaInDecimals / 33;
  }, [landAreaInDecimals]);

  // Debounced search for 250+ customers/day performance
  useEffect(() => {
    const timer = setTimeout(async () => {
      const q = customerSearch.trim().toLowerCase();
      if (!q) {
        // Load first 10 recent customers
        const recent = await db.customers.orderBy('createdAt').reverse().limit(10).toArray();
        setCustomerResults(recent);
        return;
      }

      // Indexed search without full memory load
      const results = await db.customers
        .filter((c) => {
          return Boolean(
            c.name.toLowerCase().includes(q) ||
            c.mobile.includes(q) ||
            (c.village && c.village.toLowerCase().includes(q)) ||
            (c.nid && c.nid.includes(q))
          );
        })
        .limit(20)
        .toArray();

      setCustomerResults(results);
    }, 200);

    return () => clearTimeout(timer);
  }, [customerSearch]);

  // Load products (paged/filtered)
  const loadProducts = async () => {
    let collection = db.inventory.toCollection();
    const all = await collection.toArray();
    setProducts(all);
  };

  // Load products & Next Invoice No & Today's NID purchases
  const refreshTodayPurchasedSet = useCallback(async () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    const allTxs = await db.transactions.toArray();
    const todayTxs = allTxs.filter((tx) => {
      if (tx.status !== 'COMPLETED') return false;
      const t = new Date(tx.createdAt).getTime();
      return t >= startOfDay && t <= endOfDay;
    });

    const custIds = new Set<string>();
    const nids = new Set<string>();

    for (const tx of todayTxs) {
      if (tx.customerId) custIds.add(tx.customerId);
      const cleanTxNid = normalizeNid(tx.customerNid);
      if (cleanTxNid) nids.add(cleanTxNid);
    }

    if (custIds.size > 0) {
      const custs = await db.customers.bulkGet(Array.from(custIds));
      custs.forEach((c) => {
        const cleanNid = normalizeNid(c?.nid);
        if (cleanNid) nids.add(cleanNid);
      });
    }

    setTodayPurchasedCustomerIds(custIds);
    setTodayPurchasedNids(nids);
  }, []);

  useEffect(() => {
    loadProducts();
    refreshNextInvoiceNo();
    refreshTodayPurchasedSet();
  }, [refreshTodayPurchasedSet]);

  // Real-time check whenever selected customer or typed NID changes
  useEffect(() => {
    let active = true;
    const activeNid = selectedCustomer?.nid || newCustNid;
    const activeCustomerId = selectedCustomer?.id;

    setPosValidationAlert(null);

    if (!activeNid.trim() && !activeCustomerId) {
      setDailyNidCheck({ allowed: true });
      return;
    }

    checkFarmerDailyLimit(activeNid, activeCustomerId).then((res) => {
      if (active) {
        setDailyNidCheck(res);
      }
    });

    return () => {
      active = false;
    };
  }, [selectedCustomer, newCustNid, completedTransaction]);

  const refreshNextInvoiceNo = async () => {
    const { generateInvoiceNumber } = await import('../services/posService');
    const no = await generateInvoiceNumber();
    setNextInvoiceNo(no);
  };

  // Filtered products list
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCat = selectedCategory === 'সব' || p.category === selectedCategory;
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.banglaName && p.banglaName.toLowerCase().includes(q)) ||
        (p.genericName && p.genericName.toLowerCase().includes(q));
      return matchesCat && matchesQuery;
    });
  }, [products, productSearch, selectedCategory]);

  // Add product to cart
  const addToCart = (product: InventoryItem) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const newQty = existing.quantity + 1;
        return prev.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: newQty,
                total: newQty * item.unitPrice - item.discount,
              }
            : item
        );
      } else {
        const newItem: CartItem = {
          id: generateUUID(),
          product,
          quantity: 1,
          unitPrice: product.sellingPrice,
          discount: 0,
          total: product.sellingPrice,
        };
        return [...prev, newItem];
      }
    });
  };

  // Update cart item quantity
  const updateQuantity = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity: newQty,
              total: newQty * item.unitPrice - item.discount,
            }
          : item
      )
    );
  };

  // Update item unit price
  const updateUnitPrice = (itemId: string, newPrice: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              unitPrice: Math.max(0, newPrice),
              total: item.quantity * Math.max(0, newPrice) - item.discount,
            }
          : item
      )
    );
  };

  // Remove from cart
  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== itemId));
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
    setOverallDiscount(0);
    setPaidInput('');
    setSaleNotes('');
    setCheckoutError(null);
  };

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.total, 0);
  }, [cart]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - (overallDiscount || 0));
  }, [subtotal, overallDiscount]);

  const paidAmount = parseFloat(paidInput) || 0;
  const dueAmount = Math.max(0, grandTotal - paidAmount);

  // Open checkout modal
  const handleOpenCheckout = useCallback(async () => {
    setPosValidationAlert(null);
    if (!selectedCustomer && !newCustName.trim()) {
      setPosValidationAlert('অনুগ্রহ করে একজন কৃষক নির্বাচন করুন অথবা নতুন কৃষকের নাম প্রদান করুন।');
      return;
    }
    const activeNid = (selectedCustomer?.nid || newCustNid).trim();
    if (!normalizeNid(activeNid)) {
      setPosValidationAlert(
        'মাল ক্রয়ের জন্য কৃষকের ভোটার আইডি কার্ড (NID) নম্বর প্রদান করা আবশ্যক। (সারা দিনে ১টি ভোটার আইডি কার্ড দিয়ে একবারই মাল ক্রয় করতে পারবে কৃষক)'
      );
      return;
    }
    if (cart.length === 0) {
      setPosValidationAlert('কার্ট খালি। অনুগ্রহ করে পণ্য যোগ করুন।');
      return;
    }

    const limitCheck = await checkFarmerDailyLimit(activeNid, selectedCustomer?.id);
    setDailyNidCheck(limitCheck);
    if (!limitCheck.allowed) {
      setPosValidationAlert(
        limitCheck.reason ||
          'সারা দিনে একটি ভোটার আইডি কার্ড দিয়ে একবারই মাল ক্রয় করতে পারবে কৃষক।'
      );
      return;
    }

    setPaidInput(String(grandTotal)); // default to full payment
    setCheckoutError(null);
    setShowCheckoutModal(true);
  }, [selectedCustomer, newCustName, newCustNid, cart, grandTotal]);

  // Handle local shortcuts in POS
  useEffect(() => {
    const handleLocalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        handleOpenCheckout();
      }
    };
    window.addEventListener('keydown', handleLocalKeyDown);
    return () => window.removeEventListener('keydown', handleLocalKeyDown);
  }, [handleOpenCheckout]);

  // Submit Sale Checkout
  const handleProcessCheckout = async () => {
    let farmer = selectedCustomer;
    const effectiveNid = (selectedCustomer?.nid || newCustNid).trim();

    if (!normalizeNid(effectiveNid)) {
      setCheckoutError('মাল ক্রয়ের জন্য কৃষকের ভোটার আইডি কার্ড (NID) নম্বর প্রদান করা আবশ্যক।');
      return;
    }

    // Check daily 1-NID purchase limit before creating or updating customer
    const limitCheck = await checkFarmerDailyLimit(effectiveNid, farmer?.id);
    if (!limitCheck.allowed) {
      setDailyNidCheck(limitCheck);
      setCheckoutError(
        limitCheck.reason ||
          'সারা দিনে একটি ভোটার আইডি কার্ড দিয়ে একবারই মাল ক্রয় করতে পারবে কৃষক।'
      );
      return;
    }

    // If existing customer had no NID saved previously, save the newly provided NID to their profile
    if (farmer && !farmer.nid && effectiveNid) {
      const now = new Date().toISOString();
      const updatedVersion = (farmer.version || 1) + 1;
      farmer = {
        ...farmer,
        nid: effectiveNid,
        updatedAt: now,
        version: updatedVersion,
        syncStatus: 'PENDING',
      };
      await db.customers.update(farmer.id, {
        nid: effectiveNid,
        updatedAt: now,
        version: updatedVersion,
        syncStatus: 'PENDING',
      });
    }

    // Auto-create farmer if new
    if (!farmer) {
      if (!newCustName.trim() || !newCustMobile.trim()) {
        setCheckoutError('অনুগ্রহ করে কৃষকের নাম, মোবাইল নম্বর ও ভোটার আইডি (NID) প্রদান করুন।');
        return;
      }
      
      const now = new Date().toISOString();
      const newId = generateUUID();
      farmer = {
        id: newId,
        name: newCustName.trim(),
        mobile: newCustMobile.trim(),
        nid: newCustNid.trim(),
        village: newCustVillage.trim() || 'স্থানীয়',
        creditLimit: 20000,
        totalDue: 0,
        syncStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
        deviceId: getDeviceId(),
        version: 1
      };
      
      await db.customers.add(farmer);
      
      // Create KYC record for land size
      const kyc: CustomerKYC = {
        id: generateUUID(),
        customerId: newId,
        landSizeBigha: newCustLandSize,
        landSizeDecimals: landAreaInDecimals,
        primaryCrops: [newCustCrop],
        cropAgeDays: newCustCropAge,
        verifiedStatus: 'PENDING',
        syncStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
        deviceId: getDeviceId(),
        version: 1
      };
      await db.customer_kyc.add(kyc);
      
      await db.syncQueue.bulkAdd([
        {
          id: generateUUID(),
          tableName: 'customers',
          recordId: newId,
          operation: 'UPSERT',
          payload: farmer,
          status: 'PENDING',
          attempts: 0,
          createdAt: now,
          updatedAt: now,
          deviceId: getDeviceId(),
          version: 1,
          syncStatus: 'PENDING'
        },
        {
          id: generateUUID(),
          tableName: 'customer_kyc',
          recordId: kyc.id,
          operation: 'UPSERT',
          payload: kyc,
          status: 'PENDING',
          attempts: 0,
          createdAt: now,
          updatedAt: now,
          deviceId: getDeviceId(),
          version: 1,
          syncStatus: 'PENDING'
        }
      ]);
      
      setSelectedCustomer(farmer);
    }

    if (cart.length === 0) return;

    setIsProcessing(true);
    setCheckoutError(null);

    const paid = parseFloat(paidInput) || 0;
    const due = Math.max(0, grandTotal - paid);

    try {
      const idempotencyKey = `SALE-${farmer.id}-${Date.now()}-${generateUUID().slice(0, 6)}`;
      const result = await processSaleCheckout({
        idempotencyKey,
        customer: farmer,
        cartItems: cart,
        subtotal,
        discount: overallDiscount || 0,
        grandTotal,
        paidAmount: paid,
        dueAmount: due,
        paymentMethod,
        notes: saleNotes,
        receivedBy: 'কাউন্টার ম্যানেজার',
      });

      // Reload products to update stock quantities
      await loadProducts();

      // Trigger thermal auto-print if configured in App Print Settings
      const isAutoPrintActive = Boolean(printSettings?.autoPrintOnSale);
      setShouldAutoPrintCurrentSale(isAutoPrintActive);

      // Show memo
      setCompletedPrevDue(farmer.totalDue || 0);
      setCompletedTransaction(result.transaction);
      setCompletedItems(result.items);

      // Reset form and prepare for next sale
      setShowCheckoutModal(false);
      clearCart();
      setSelectedCustomer(null);
      setNewCustName('');
      setNewCustMobile('');
      setNewCustVillage(AUTHORIZED_VILLAGES[0]);
      setNewCustNid('');
      setCustomerSearch('');
      setNewCustLandSize(1);
      setNewCustCrop(AUTHORIZED_CROPS[0]);
      setNewCustCropAge(0);
      await refreshNextInvoiceNo();
      await refreshTodayPurchasedSet();
    } catch (err: any) {
      setCheckoutError(err.message || 'বিক্রয় সম্পন্ন করতে সমস্যা হয়েছে।');
    } finally {
      setIsProcessing(false);
    }
  };

  const categories = ['সব', 'সার', 'কীটনাশক', 'ছত্রাকনাশক', 'আগাছানাশক', 'অণুখাদ্য', 'বীজ'];

  // Quick Suggestion for 1-Bigha Prescription Model
  const applyPrescriptionBaseDose = async () => {
    if (products.length === 0) return;
    
    const suggested: CartItem[] = [];
    ONE_BIGHA_BASE_DOSE.forEach(base => {
      const match = products.find(p => 
        p.code === base.code || 
        p.name.toLowerCase().includes(base.name.toLowerCase().split(' ')[0])
      );
      
      if (match) {
        const qty = Math.round(base.baseDoseKg * multiplier * 100) / 100;
        if (qty > 0) {
          suggested.push({
            id: generateUUID(),
            product: match,
            quantity: qty,
            unitPrice: match.sellingPrice,
            discount: 0,
            total: Math.round(qty * match.sellingPrice)
          });
        }
      }
    });
    
    setCart(prev => {
      // Merge or replace? Let's append but avoid duplicates
      const newCart = [...prev];
      suggested.forEach(s => {
        const existingIdx = newCart.findIndex(item => item.product.id === s.product.id);
        if (existingIdx >= 0) {
          newCart[existingIdx].quantity += s.quantity;
          newCart[existingIdx].total = Math.round(newCart[existingIdx].quantity * newCart[existingIdx].unitPrice);
        } else {
          newCart.push(s);
        }
      });
      return newCart;
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-4 space-y-4">
      {/* 1-Bigha Model Farmer Engine Header */}
      <div className="bg-emerald-950 rounded-xl shadow-xl border border-emerald-800 p-5 text-white">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Farmer Profile Info */}
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-800 rounded-lg">
                <UserPlus className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="font-black text-lg tracking-tight uppercase">কৃষক প্রোফাইল ও জমি নির্বাচন (Farmer & Land Profile)</h2>
                  <div className="bg-amber-400 text-emerald-950 px-3 py-1 rounded-full font-black text-xs shadow-sm border border-amber-500 animate-pulse">
                    পরবর্তী মেমো নং: {nextInvoiceNo}
                  </div>
                </div>
                <p className="text-xs text-emerald-300 font-medium">১-বিঘা প্রেসক্রিপশন ইঞ্জিন মডেল অনুযায়ী সরাসরি কৃষক নিবন্ধন ও বিক্রি</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-emerald-400 uppercase">কৃষকের নাম (Farmer Name)</label>
                {selectedCustomer ? (
                  <div className="bg-emerald-900/50 border border-emerald-700 rounded-lg px-3 py-2 flex items-center justify-between shadow-inner h-[38px]">
                    <span className="text-sm font-bold text-white truncate mr-2">{selectedCustomer.name}</span>
                    <button 
                      onClick={() => {
                        setSelectedCustomer(null);
                        setNewCustName('');
                        setCustomerSearch('');
                      }} 
                      className="text-[10px] bg-rose-900/30 text-rose-300 px-2 py-0.5 rounded border border-rose-800/50 hover:bg-rose-900/50 transition-colors shrink-0"
                    >
                      পরিবর্তন
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="কৃষকের নাম, মোবাইল বা NID লিখুন..."
                      value={newCustName}
                      onChange={(e) => {
                        setNewCustName(e.target.value);
                        setCustomerSearch(e.target.value);
                      }}
                      className="w-full px-3 py-2 bg-emerald-900/40 border border-emerald-700 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden placeholder:text-emerald-700/60 text-white font-bold"
                    />

                    {/* Search Results Dropdown */}
                    {customerSearch.trim() && customerResults.length > 0 && !selectedCustomer && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-emerald-900 border border-emerald-700 rounded-lg shadow-2xl max-h-60 overflow-y-auto no-scrollbar">
                        {customerResults.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setSelectedCustomer(c);
                              setCustomerSearch('');
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-emerald-800 border-b border-emerald-800/50 last:border-0 transition-colors"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="text-sm font-bold text-white">{c.name}</div>
                                <div className="text-[10px] text-emerald-400 font-mono">{c.mobile}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-[10px] text-emerald-300">{c.village}</div>
                                {c.nid && (
                                  <div className="text-[9px] text-amber-400 font-mono">NID: {c.nid}</div>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-emerald-400 uppercase">মোবাইল নম্বর (Mobile)</label>
                <input
                  type="text"
                  disabled={!!selectedCustomer}
                  value={selectedCustomer?.mobile || newCustMobile}
                  onChange={(e) => setNewCustMobile(e.target.value)}
                  placeholder="017xxxxxxxx"
                  className="w-full px-3 py-2 bg-emerald-900/40 border border-emerald-700 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden disabled:bg-emerald-900/20 disabled:text-emerald-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-emerald-400 uppercase">গ্রাম (Village)</label>
                <select
                  disabled={!!selectedCustomer}
                  value={selectedCustomer?.village || newCustVillage}
                  onChange={(e) => setNewCustVillage(e.target.value)}
                  className="w-full px-3 py-2 bg-emerald-900/40 border border-emerald-700 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden disabled:bg-emerald-900/20 disabled:text-emerald-500 text-white font-bold cursor-pointer"
                >
                  {AUTHORIZED_VILLAGES.map(v => (
                    <option key={v} value={v} className="bg-emerald-900">{v}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-emerald-400 uppercase">এনআইডি নম্বর (NID Number)</label>
                <input
                  type="text"
                  disabled={!!selectedCustomer}
                  value={selectedCustomer?.nid || newCustNid}
                  onChange={(e) => setNewCustNid(e.target.value)}
                  placeholder="১০ বা ১৭ ডিজিটের এনআইডি"
                  className="w-full px-3 py-2 bg-emerald-900/40 border border-emerald-700 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden disabled:bg-emerald-900/20 disabled:text-emerald-500 font-mono text-white"
                />
              </div>
            </div>
          </div>

          {/* Land & Multiplier Logic Section */}
          <div className="lg:w-80 bg-emerald-900/40 border border-emerald-700 rounded-xl p-4 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-xs uppercase tracking-wider">জমির পরিমাণ ও ফসল</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-3 mb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-emerald-400">জমির পরিমাণ (বিঘা)</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={newCustLandSize}
                    onChange={(e) => setNewCustLandSize(parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 bg-emerald-800 border border-emerald-600 rounded text-sm font-bold text-white text-center shadow-inner"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-emerald-400">ফসল নির্বাচন</label>
                  <select 
                    value={newCustCrop}
                    onChange={(e) => setNewCustCrop(e.target.value)}
                    className="w-full px-1 py-1.5 bg-emerald-800 border border-emerald-600 rounded text-[10px] font-bold text-white cursor-pointer"
                  >
                    {AUTHORIZED_CROPS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">ফসলের বয়স (দিন)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="ফসলের বয়স দিন হিসেবে লিখুন"
                  value={newCustCropAge}
                  onChange={(e) => setNewCustCropAge(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-emerald-800 border border-emerald-600 rounded-lg text-sm font-bold text-white shadow-inner focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            <button
              onClick={applyPrescriptionBaseDose}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-black py-2 rounded-lg text-[11px] flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg group"
            >
              <Zap className="w-3.5 h-3.5 group-hover:scale-125 transition-transform" />
              অটো-ডোজ সাজেস্ট করুন (Suggest Dose)
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Products Catalog (60%), Right Editable Cart (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Products Catalog */}
        <div className="lg:col-span-7 bg-white rounded-xl shadow-xs border border-gray-200 p-4 flex flex-col h-[700px]">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 mb-3">
            <h2 className="font-bold text-sm text-emerald-950 flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-700" />
              পণ্য তালিকা (Agro Inventory)
            </h2>
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="পণ্য বা ব্র্যান্ড খুঁজুন..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-emerald-800 text-white font-semibold shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {filteredProducts.map((p) => {
              const isLowStock = p.stockQuantity <= p.minStockAlert;
              const isOutOfStock = p.stockQuantity <= 0;

              return (
                <div
                  key={p.id}
                  onClick={() => !isOutOfStock && addToCart(p)}
                  className={`border rounded-lg p-3 transition flex flex-col justify-between ${
                    isOutOfStock
                      ? 'bg-gray-100/80 border-gray-300 opacity-60 cursor-not-allowed'
                      : 'bg-white border-gray-200 hover:border-emerald-500 hover:shadow-md cursor-pointer'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {p.category}
                      </span>
                      <span className="text-[10px] font-mono text-gray-500">{p.code}</span>
                    </div>

                    <h4 className="font-bold text-gray-900 text-xs line-clamp-1">
                      {p.banglaName || p.name}
                    </h4>
                    <p className="text-[11px] text-gray-500 line-clamp-1">{p.genericName || p.name}</p>

                    <div className="text-[10px] text-gray-600 mt-1 flex items-center gap-2">
                      <span>প্যাক: <strong>{p.packSize}</strong></span>
                      <span>র‍্যাক: <strong>{p.rackLocation}</strong></span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-gray-500 block">বিক্রয় মূল্য:</span>
                      <span className="font-mono font-bold text-emerald-900 text-sm">
                        ৳ {p.sellingPrice}
                      </span>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-[10px] font-medium block ${
                          isOutOfStock
                            ? 'text-red-600 font-bold'
                            : isLowStock
                            ? 'text-amber-600 font-bold'
                            : 'text-gray-500'
                        }`}
                      >
                        মজুত: {p.stockQuantity} {p.unit}
                      </span>
                      <button
                        disabled={isOutOfStock}
                        className="mt-1 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-[11px] font-bold px-2 py-0.5 rounded transition shadow-xs"
                      >
                        + যোগ করুন
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredProducts.length === 0 && (
              <div className="col-span-2 py-12 text-center text-gray-400 text-xs">
                কোনো পণ্য খুঁজে পাওয়া যায়নি।
              </div>
            )}
          </div>
        </div>

        {/* Right Editable Cart & Checkout Panel */}
        <div className="lg:col-span-5 bg-white rounded-xl shadow-xs border border-gray-200 p-4 flex flex-col h-[700px]">
          <div className="flex items-center justify-between border-b pb-2 mb-2">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-emerald-800" />
              <h2 className="font-bold text-sm text-emerald-950">
                বিক্রয় কার্ট (Cart) • <span className="font-mono text-emerald-700">{cart.length}</span> আইটেম
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {onOpenPrintHistory && (
                <button
                  type="button"
                  onClick={onOpenPrintHistory}
                  title="সর্বশেষ প্রিন্টকৃত ৫টি রশিদের ইতিহাস দেখুন (Print History)"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition cursor-pointer"
                >
                  <Clock className="w-3 h-3 text-amber-700" />
                  <span>প্রিন্ট হিস্ট্রি</span>
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  onUpdatePrintSettings?.({
                    autoPrintOnSale: !printSettings?.autoPrintOnSale,
                  })
                }
                title="ক্লিক করে অটো থার্মাল প্রিন্ট চালু বা বন্ধ করুন"
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                  printSettings?.autoPrintOnSale
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-gray-100 text-gray-500 border border-gray-200'
                }`}
              >
                <Printer className="w-3 h-3" />
                <span>অটো-প্রিন্ট: {printSettings?.autoPrintOnSale ? 'চালু' : 'বন্ধ'}</span>
              </button>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> খালি করুন
                </button>
              )}
            </div>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 pr-1">
            {cart.map((item) => (
              <div key={item.id} className="py-2.5 space-y-1.5">
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <h5 className="font-bold text-xs text-gray-900">
                      {item.product.banglaName || item.product.name}
                    </h5>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {item.product.packSize} • {item.product.code}
                    </span>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-gray-400 hover:text-rose-600 transition p-1"
                    title="বাতিল করুন"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  {/* Quantity Stepper */}
                  <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.id, Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-12 text-center text-xs font-mono font-bold border-x border-gray-300 py-0.5 focus:outline-hidden"
                    />
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Unit price input */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-500">দর ৳</span>
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => updateUnitPrice(item.id, parseFloat(e.target.value) || 0)}
                      className="w-16 text-right font-mono text-xs border border-gray-300 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>

                  {/* Line Item Total */}
                  <div className="text-right font-mono font-bold text-gray-900 text-xs">
                    ৳ {item.total}
                  </div>
                </div>
              </div>
            ))}

            {cart.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs py-16">
                <ShoppingCart className="w-10 h-10 mb-2 stroke-1 text-gray-300" />
                <p>কার্ট খালি। বাম পাশের তালিকা থেকে পণ্য যোগ করুন।</p>
              </div>
            )}
          </div>

          {/* Cart Footer Calculations & Checkout Button */}
          <div className="border-t border-gray-200 pt-3 mt-2 space-y-2">
            <div className="flex justify-between text-xs text-gray-700">
              <span>উপমোট (Subtotal):</span>
              <span className="font-mono font-bold">৳ {subtotal}</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-700">বিশেষ ছাড় (Discount):</span>
              <div className="flex items-center gap-1">
                <span>৳</span>
                <input
                  type="number"
                  min="0"
                  value={overallDiscount || ''}
                  placeholder="0"
                  onChange={(e) => setOverallDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-20 text-right font-mono text-xs border border-gray-300 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-between text-sm font-black text-emerald-950 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
              <span>সর্বমোট দেয় (Grand Total):</span>
              <span className="font-mono text-base text-emerald-900">৳ {grandTotal}</span>
            </div>

            {posValidationAlert && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{posValidationAlert}</span>
              </div>
            )}
            <button
              onClick={handleOpenCheckout}
              disabled={cart.length === 0}
              className="w-full bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-white font-black py-3 rounded-xl text-sm transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2 group"
            >
              <CheckCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
              বিক্রয় ও পেমেন্ট সম্পন্ন করুন (F2 Checkout)
            </button>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckoutModal && (selectedCustomer || newCustName.trim()) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-gray-200 overflow-hidden">
            <div className="bg-emerald-950 text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">বিক্রয় চূড়ান্তকরণ (Finalize Sale)</h3>
                <p className="text-xs text-emerald-300">গ্রাহক: {selectedCustomer?.name || newCustName || 'নতুন কৃষক'}</p>
              </div>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="text-gray-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              {checkoutError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {/* Total & Due Breakdown */}
              <div className="bg-gray-50 p-3 rounded-lg space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-700">
                  <span>মোট বিল (Grand Total):</span>
                  <span className="font-mono font-bold text-sm">৳ {grandTotal}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>পূর্বের বকেয়া (Existing Due):</span>
                  <span className="font-mono">৳ {selectedCustomer?.totalDue || 0}</span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1.5">
                  পেমেন্ট মাধ্যম (Payment Method):
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['CASH', 'BKASH', 'NAGAD', 'BANK'] as PaymentMethod[]).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer border text-center ${
                        paymentMethod === method
                          ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Paid Input */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  পরিশোধকৃত টাকা (Paid Amount):
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 font-mono text-gray-500 font-bold">৳</span>
                  <input
                    type="number"
                    min="0"
                    max={grandTotal}
                    value={paidInput}
                    onChange={(e) => setPaidInput(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
                {/* Quick button to set full payment */}
                <div className="flex gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setPaidInput(String(grandTotal))}
                    className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 hover:bg-emerald-100"
                  >
                    সম্পূর্ণ নগদ (Full ৳{grandTotal})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaidInput('0')}
                    className="text-[11px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 hover:bg-rose-100"
                  >
                    পুরো বকেয়া (Full Due)
                  </button>
                </div>
              </div>

              {/* Calculated Due Warning */}
              {grandTotal - (parseFloat(paidInput) || 0) > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs space-y-1">
                  <div className="flex justify-between font-bold text-amber-900">
                    <span>নতুন বকেয়া যুক্ত হবে:</span>
                    <span className="font-mono">
                      ৳ {grandTotal - (parseFloat(paidInput) || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>বিক্রয় পরবর্তী মোট বকেয়া:</span>
                    <span className="font-mono font-bold text-rose-800">
                      ৳ {(selectedCustomer?.totalDue || 0) + (grandTotal - (parseFloat(paidInput) || 0))}
                    </span>
                  </div>
                </div>
              )}

              {/* Optional Note */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  মন্তব্য / নোট (Optional):
                </label>
                <input
                  type="text"
                  placeholder="যেমন: খরিফ ১ মৌসুম, কিস্তি আগামী মাসে..."
                  value={saleNotes}
                  onChange={(e) => setSaleNotes(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Thermal Auto-Print Setting Toggle */}
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-800 text-white rounded-md">
                    <Printer className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-emerald-950 block">
                      অটো থার্মাল প্রিন্ট (Auto-Print)
                    </span>
                    <span className="text-[10px] text-emerald-800/80">
                      {printSettings?.autoPrintOnSale
                        ? `বিক্রয় সম্পন্ন হলে স্বয়ংক্রিয় প্রিন্ট হবে (${printSettings?.paperSize || '80mm'}${printSettings?.compactView ? ' • কমপ্যাক্ট' : ''})`
                        : 'নিষ্ক্রিয় (ম্যানুয়ালি প্রিন্ট বোতামে চাপতে হবে)'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={printSettings?.autoPrintOnSale}
                    onClick={() =>
                      onUpdatePrintSettings?.({
                        autoPrintOnSale: !printSettings?.autoPrintOnSale,
                      })
                    }
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      printSettings?.autoPrintOnSale ? 'bg-emerald-800' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                        printSettings?.autoPrintOnSale ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>

                  {onOpenPrintSettings && (
                    <button
                      type="button"
                      onClick={onOpenPrintSettings}
                      title="প্রিন্ট সেটিংস কনফিগার করুন"
                      className="p-1 text-gray-500 hover:text-emerald-800 rounded transition cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 font-medium text-xs rounded-lg hover:bg-gray-50 transition"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreviewMode(true)}
                  className="px-4 py-2 border-2 border-emerald-500 bg-white text-emerald-700 font-black text-xs rounded-lg hover:bg-emerald-50 transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <FileText className="w-4 h-4" />
                  প্রিন্ট প্রিভিউ (Preview)
                </button>
                <button
                  type="button"
                  onClick={handleProcessCheckout}
                  disabled={isProcessing}
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  {isProcessing ? 'প্রসেসিং হচ্ছে...' : 'নিশ্চিত করুন ও মেমো প্রিন্ট'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cash Memo Modal when sale is completed OR Preview Mode */}
      {(completedTransaction || (showPreviewMode && selectedCustomer)) && (
        <CashMemoModal
          transaction={
            completedTransaction ||
            ({
              id: 'preview',
              idempotencyKey: 'preview',
              invoiceNo: 'DRAFT-MEMO',
              customerId: selectedCustomer?.id || '',
              customerName: selectedCustomer?.name || '',
              customerMobile: selectedCustomer?.mobile || '',
              customerVillage: selectedCustomer?.village || '',
              subtotal,
              discount: overallDiscount,
              tax: 0,
              grandTotal,
              paidAmount,
              dueAmount,
              paymentMethod,
              status: 'COMPLETED',
              itemCount: cart.length,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              deviceId: getDeviceId(),
              version: 1,
              syncStatus: 'PENDING',
            } as Transaction)
          }
          items={
            completedItems.length > 0
              ? completedItems
              : cart.map(
                  (item, idx) =>
                    ({
                      id: `preview-${idx}`,
                      transactionId: 'preview',
                      productId: item.product.id,
                      productCode: item.product.code,
                      productName: item.product.name,
                      banglaName: item.product.banglaName,
                      category: item.product.category,
                      unit: item.product.unit,
                      packSize: item.product.packSize,
                      quantity: item.quantity,
                      unitPrice: item.unitPrice,
                      costPrice: item.product.costPrice,
                      total: item.total,
                      createdAt: new Date().toISOString(),
                    } as TransactionItem)
                )
          }
          previousDue={selectedCustomer?.totalDue || 0}
          autoPrint={completedTransaction ? shouldAutoPrintCurrentSale : false}
          isPreview={!!showPreviewMode}
          defaultPaperSize={printSettings?.paperSize || '80mm'}
          printCopies={printSettings?.printCopies || 1}
          compactView={Boolean(printSettings?.compactView)}
          onToggleAutoPrint={(enabled) => {
            setShouldAutoPrintCurrentSale(enabled);
            onUpdatePrintSettings?.({ autoPrintOnSale: enabled });
          }}
          onToggleCompactView={(enabled) => {
            onUpdatePrintSettings?.({ compactView: enabled });
          }}
          onClose={() => {
            if (showPreviewMode) {
              setShowPreviewMode(false);
            } else {
              setCompletedTransaction(null);
              setShouldAutoPrintCurrentSale(false);
            }
          }}
          shopSettings={shopSettings}
        />
      )}
    </div>
  );
};
