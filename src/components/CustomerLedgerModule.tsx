import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  UserPlus,
  CreditCard,
  History,
  Phone,
  MapPin,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  X,
  MessageSquare,
  FileDown,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db, generateUUID, getDeviceId } from '../db/database';
import type { Customer, DueLedgerRecord, Payment, PaymentMethod, Transaction, ShopSettings } from '../types';
import { collectDuePayment } from '../services/posService';

interface CustomerLedgerModuleProps {
  shopSettings?: ShopSettings;
}

const AUTHORIZED_VILLAGES = [
  "বাসুদেবকোল", "গোবিন্দপুর", "বানিয়াবাড়ী", "বড়র বয়ড়া", 
  "খাস বড়র বয়ড়া", "শুশুয়া", "রামাইল", "বারিয়াবাড়ী"
];

export const CustomerLedgerModule: React.FC<CustomerLedgerModuleProps> = ({ shopSettings }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerTimeline, setCustomerTimeline] = useState<DueLedgerRecord[]>([]);
  const [lastTransactions, setLastTransactions] = useState<Transaction[]>([]);

  // Due Collection Modal
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [collectAmount, setCollectAmount] = useState<string>('');
  const [collectMethod, setCollectMethod] = useState<PaymentMethod>('CASH');
  const [collectNotes, setCollectNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [collectSuccessMsg, setCollectSuccessMsg] = useState<string | null>(null);

  // New Customer Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [nid, setNid] = useState('');
  const [village, setVillage] = useState(AUTHORIZED_VILLAGES[0]);
  const [union, setUnion] = useState('');
  const [creditLimit, setCreditLimit] = useState(25000);
  const [notes, setNotes] = useState('');

  const fetchTopCustomers = async (): Promise<Customer[]> => {
    try {
      const isTotalDueIndexed = db.customers.schema?.indexes?.some((idx) => idx.name === 'totalDue');
      if (isTotalDueIndexed) {
        return await db.customers.orderBy('totalDue').reverse().limit(30).toArray();
      }
    } catch (e) {
      console.warn('Fallback due to unindexed totalDue:', e);
    }
    const all = await db.customers.toArray();
    return all.sort((a, b) => (b.totalDue || 0) - (a.totalDue || 0)).slice(0, 30);
  };

  // Debounced search for 250+ customers/day
  useEffect(() => {
    const timer = setTimeout(async () => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) {
        const topCustomers = await fetchTopCustomers();
        setCustomers(topCustomers);
        return;
      }

      const filtered = await db.customers
        .filter((c) => {
          return Boolean(
            c.name.toLowerCase().includes(q) ||
            c.mobile.includes(q) ||
            (c.village && c.village.toLowerCase().includes(q)) ||
            (c.nid && c.nid.includes(q))
          );
        })
        .limit(50)
        .toArray();

      setCustomers(filtered);
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load customer ledger timeline & last transactions
  useEffect(() => {
    if (selectedCustomer) {
      loadCustomerTimeline(selectedCustomer.id);
      loadLastTransactions(selectedCustomer.id);
    }
  }, [selectedCustomer]);

  const loadCustomerTimeline = async (customerId: string) => {
    const timeline = await db.dueLedger
      .where('customerId')
      .equals(customerId)
      .reverse()
      .sortBy('createdAt');
    setCustomerTimeline(timeline);
  };

  const loadLastTransactions = async (customerId: string) => {
    const txs = await db.transactions
      .where('customerId')
      .equals(customerId)
      .reverse()
      .limit(5)
      .toArray();
    setLastTransactions(txs);
  };

  // Collect Due Payment
  const handleCollectDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const amount = parseFloat(collectAmount);
    if (!amount || amount <= 0) {
      alert('সঠিক টাকার পরিমাণ লিখুন।');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await collectDuePayment({
        customerId: selectedCustomer.id,
        amount,
        paymentMethod: collectMethod,
        notes: collectNotes,
        receivedBy: 'কাউন্টার ম্যানেজার',
      });

      // Update local selected customer
      setSelectedCustomer((prev) => (prev ? { ...prev, totalDue: result.newBalance } : null));

      // Reload list and timeline
      await loadCustomerTimeline(selectedCustomer.id);
      const updatedList = await fetchTopCustomers();
      setCustomers(updatedList);

      setCollectSuccessMsg(`সফলভাবে ৳${amount} আদায় সম্পন্ন হয়েছে! নতুন বকেয়া: ৳${result.newBalance}`);
      setShowCollectModal(false);
      setCollectAmount('');
      setCollectNotes('');
      setTimeout(() => setCollectSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'বকেয়া আদায় ব্যর্থ হয়েছে');
    } finally {
      setIsProcessing(false);
    }
  };

  // Add New Customer
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !mobile.trim()) {
      alert('নাম ও মোবাইল নম্বর আবশ্যক।');
      return;
    }

    const now = new Date().toISOString();
    const newCustomer: Customer = {
      id: generateUUID(),
      name: name.trim(),
      mobile: mobile.trim(),
      nid: nid.trim() || undefined,
      village: village.trim() || 'স্থানীয়',
      union: union.trim() || undefined,
      creditLimit: Number(creditLimit) || 20000,
      totalDue: 0,
      notes: notes.trim() || undefined,
      syncStatus: 'PENDING',
      createdAt: now,
      updatedAt: now,
      deviceId: getDeviceId(),
      version: 1,
    };

    await db.customers.add(newCustomer);
    await db.syncQueue.add({
      id: generateUUID(),
      tableName: 'customers',
      recordId: newCustomer.id,
      operation: 'UPSERT',
      payload: newCustomer,
      status: 'PENDING',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
      deviceId: getDeviceId(),
      version: 1,
      syncStatus: 'PENDING',
    });

    setCustomers((prev) => [newCustomer, ...prev]);
    setSelectedCustomer(newCustomer);
    setShowAddModal(false);
    setName('');
    setMobile('');
    setNid('');
    setVillage(AUTHORIZED_VILLAGES[0]);
  };

  const handleWhatsAppShare = () => {
    if (!selectedCustomer || !selectedCustomer.mobile) {
      alert('গ্রাহকের মোবাইল নম্বর নেই।');
      return;
    }

    const phone = selectedCustomer.mobile.replace(/\D/g, '');
    const formattedPhone = phone.startsWith('88') ? phone : `88${phone}`;
    const storeLink = window.location.origin;

    const message = `সম্মানিত গ্রাহক ${selectedCustomer.name},\nমেসার্স আব্দুস সামাদ মোল্লাহ্-এ আপনার বর্তমান মোট বকেয়া আছে: ৳${selectedCustomer.totalDue}।\n\nঅনুগ্রহ করে দ্রুত বকেয়া পরিশোধ করার জন্য অনুরোধ করা হলো।\nদোকানের লোকেশন: ${storeLink}\n\nআমাদের হোয়াটসঅ্যাপ গ্রুপে যুক্ত হতে এই লিংকে ক্লিক করুন:\nhttps://chat.whatsapp.com/KjmY7svQtdM5elF4lSGV37\n\nধন্যবাদ।`;

    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const generateLedgerPDF = () => {
    if (!selectedCustomer || customerTimeline.length === 0) return;

    const doc = new jsPDF();
    const now = new Date().toLocaleString('bn-BD');

    // Header - Shop Info
    doc.setFontSize(22);
    doc.setTextColor(4, 120, 87); // Emerald-700
    doc.text(shopSettings?.shopName || 'M/S Abdus Samad Mollah', 105, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(shopSettings?.slogan || 'BCIC & BADC Dealer', 105, 21, { align: 'center' });
    doc.text(shopSettings?.address || 'Gobindapur Bazar, Bhuapur, Tangail', 105, 26, { align: 'center' });
    
    doc.setDrawColor(4, 120, 87);
    doc.setLineWidth(0.5);
    doc.line(15, 30, 195, 30);

    // Title
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Customer Ledger Summary Report', 105, 40, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`Generated on: ${now}`, 105, 45, { align: 'center' });

    // Customer Detail Box
    doc.setFillColor(248, 250, 252); // Slate-50
    doc.roundedRect(15, 52, 180, 28, 2, 2, 'F');
    
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.text(`Farmer Name: ${selectedCustomer.name}`, 20, 60);
    doc.text(`Mobile No: ${selectedCustomer.mobile}`, 20, 67);
    doc.text(`Village: ${selectedCustomer.village || 'N/A'}`, 20, 74);
    
    doc.setFontSize(12);
    doc.setTextColor(185, 28, 28); // Red-700
    doc.text('TOTAL OUTSTANDING DUE', 130, 60);
    doc.setFontSize(16);
    doc.text(`BDT ${selectedCustomer.totalDue.toLocaleString()}`, 130, 72);

    // Transaction History Table
    const tableData = customerTimeline.map((item, index) => [
      index + 1,
      new Date(item.createdAt).toLocaleDateString('bn-BD'),
      item.type === 'PAYMENT_COLLECTION' ? 'Payment Received' : 'Purchase / Credit',
      item.notes || (item.type === 'PAYMENT_COLLECTION' ? 'Cash Payment' : 'Sales Transaction'),
      item.amount.toLocaleString(),
      item.balanceAfter.toLocaleString()
    ]);

    autoTable(doc, {
      startY: 85,
      head: [['#', 'Date', 'Type of Entry', 'Details / Notes', 'Amount (TK)', 'Balance (TK)']],
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [4, 120, 87], 
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'center' },
        1: { halign: 'center' },
        4: { halign: 'right', fontStyle: 'bold' },
        5: { halign: 'right', fontStyle: 'bold' }
      },
      styles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: [240, 253, 244] } // Emerald-50
    });

    // Footer
    const finalY = (doc as any).lastAutoTable.finalY || 100;
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Terms: This is a system generated statement of account. Please report any discrepancy within 7 days.', 15, finalY + 15);
    doc.text('M/S Abdus Samad Mollah - Powered by Smart Offline Agro-POS', 105, 285, { align: 'center' });

    doc.save(`${selectedCustomer.name.replace(/\s+/g, '_')}_Ledger_Report.pdf`);
  };

  // Overall shop statistics
  const totalShopDue = customers.reduce((sum, c) => sum + (c.totalDue || 0), 0);

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-4 space-y-4">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase">মোট গ্রাহক সংখ্যা</span>
            <div className="text-xl font-black text-emerald-950 font-mono mt-0.5">
              {customers.length}+
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase">মোট বকেয়া (Shop Due)</span>
            <div className="text-xl font-black text-rose-700 font-mono mt-0.5">
              ৳ {totalShopDue.toLocaleString()}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center text-rose-800">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase">২৪০+ গ্রাহক কর্মক্ষমতা</span>
            <div className="text-xs text-emerald-700 font-medium mt-1">
              IndexedDB অপ্টিমাইজড • দ্রুত লোডিং
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold px-3 py-2 rounded-lg text-xs transition cursor-pointer shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            নতুন কৃষক যোগ
          </button>
        </div>
      </div>

      {collectSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{collectSuccessMsg}</span>
        </div>
      )}

      {/* Main Grid: Customer Directory (5 cols) & Ledger Timeline (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Customer Directory */}
        <div className="lg:col-span-5 bg-white rounded-xl shadow-xs border border-gray-200 p-4 flex flex-col h-[650px]">
          <div className="mb-3">
            <h3 className="font-bold text-xs text-emerald-950 uppercase tracking-wider mb-2">
              কৃষক ও গ্রাহক খাতা (Customer Directory)
            </h3>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="নাম, মোবাইল বা গ্রাম দিয়ে দ্রুত খুঁজুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Customer list with virtual scrolling / pagination */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 pr-1">
            {customers.map((c) => {
              const isSelected = selectedCustomer?.id === c.id;
              const hasDue = c.totalDue > 0;
              const isOverLimit = c.totalDue > c.creditLimit;

              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCustomer(c)}
                  className={`p-3 rounded-lg cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-emerald-100/70 border border-emerald-400'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-xs text-gray-900 flex items-center gap-1.5">
                      <span>{c.name}</span>
                      {isOverLimit && (
                        <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.2 rounded font-semibold">
                          লিমিট পার
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 flex items-center gap-2">
                      <span className="font-mono">{c.mobile}</span>
                      <span>• {c.village || 'গ্রাম নেই'}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 block">বকেয়া:</span>
                    <span
                      className={`font-mono font-black text-xs ${
                        hasDue ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      ৳ {c.totalDue}
                    </span>
                  </div>
                </div>
              );
            })}

            {customers.length === 0 && (
              <div className="text-center py-16 text-gray-400 text-xs">
                কোনো গ্রাহক পাওয়া যায়নি।
              </div>
            )}
          </div>
        </div>

        {/* Selected Customer Due Ledger & Profile */}
        <div className="lg:col-span-7 bg-white rounded-xl shadow-xs border border-gray-200 p-4 flex flex-col h-[650px]">
          {selectedCustomer ? (
            <>
              {/* Profile Card */}
              <div className="border-b pb-3 mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-emerald-950 flex items-center gap-2">
                    {selectedCustomer.name}
                    {selectedCustomer.totalDue > 0 && (
                      <span className="text-xs bg-rose-100 text-rose-800 font-mono font-bold px-2 py-0.5 rounded-full border border-rose-200">
                        বকেয়া ৳{selectedCustomer.totalDue}
                      </span>
                    )}
                  </h3>
                  <div className="text-xs text-gray-600 mt-1 flex flex-wrap gap-3">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-emerald-700" />
                      <strong className="font-mono">{selectedCustomer.mobile}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-emerald-700" />
                      {selectedCustomer.village}, {selectedCustomer.union || ''}
                    </span>
                    {selectedCustomer.nid && (
                      <span>এনআইডি: <strong className="font-mono">{selectedCustomer.nid}</strong></span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setCollectAmount(String(selectedCustomer.totalDue || ''));
                      setShowCollectModal(true);
                    }}
                    disabled={selectedCustomer.totalDue <= 0}
                    className="inline-flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-40 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-xs"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    বাকি টাকা আদায় (Collect Due)
                  </button>

                  <button
                    onClick={handleWhatsAppShare}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-xs"
                    title="হোয়াটসঅ্যাপে বকেয়া মেসেজ পাঠান"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    মেসেজ (WhatsApp)
                  </button>

                  <button
                    onClick={generateLedgerPDF}
                    className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-xs"
                    title="সম্পূর্ণ লেজার রিপোর্ট PDF ডাউনলোড করুন"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    PDF রিপোর্ট
                  </button>
                </div>
              </div>

              {/* Last 5 Invoices Summary Table */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 uppercase tracking-tight">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    সর্বশেষ ৫টি বিক্রয় মেমো (Last 5 Invoices)
                  </span>
                </div>
                <div className="overflow-hidden border border-emerald-100 rounded-lg shadow-sm">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-emerald-50 text-emerald-950 font-bold border-b border-emerald-100">
                        <th className="py-2 px-3">মেমো নং</th>
                        <th className="py-2 px-3">তারিখ</th>
                        <th className="py-2 px-3 text-right">মোট বিল</th>
                        <th className="py-2 px-3 text-right">পরিশোধ</th>
                        <th className="py-2 px-3 text-right">বকেয়া</th>
                        <th className="py-2 px-3 text-center">মাধ্যম</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-50">
                      {lastTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-emerald-50/30 transition-colors">
                          <td className="py-2 px-3 font-mono font-bold text-emerald-800">{tx.invoiceNo}</td>
                          <td className="py-2 px-3 text-gray-500">
                            {new Date(tx.createdAt).toLocaleDateString('bn-BD')}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold">৳{tx.grandTotal}</td>
                          <td className="py-2 px-3 text-right font-mono text-emerald-700">৳{tx.paidAmount}</td>
                          <td className="py-2 px-3 text-right font-mono text-rose-600 font-bold">৳{tx.dueAmount}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[9px] font-bold">
                              {tx.paymentMethod}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {lastTransactions.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-gray-400 italic">
                            কোনো বিক্রয় রেকর্ড পাওয়া যায়নি।
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Due Ledger Timeline */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                  <History className="w-3.5 h-3.5 text-gray-500" />
                  লেনদেন ও বাকি খাতা ইতিহাস ({customerTimeline.length})
                </span>
                <span className="text-[11px] text-gray-400">রানিং ব্যালেন্স ট্র্যাকিং</span>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-gray-100 pr-1">
                {customerTimeline.map((item) => {
                  const isPayment = item.type === 'PAYMENT_COLLECTION';
                  return (
                    <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                              isPayment
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isPayment ? 'টাকা পরিশোধ' : 'পণ্য বাকি'}
                          </span>
                          <span className="text-gray-900">{item.notes || 'লেনদেন'}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                          {new Date(item.createdAt).toLocaleString('bn-BD', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={`font-mono font-bold ${
                            isPayment ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {isPayment ? '-' : '+'} ৳ {item.amount}
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono">
                          অবশিষ্ট বকেয়া: ৳ {item.balanceAfter}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {customerTimeline.length === 0 && (
                  <div className="text-center py-16 text-gray-400 text-xs">
                    এই গ্রাহকের কোনো পূর্ববর্তী বাকি বা আদায়ের ইতিহাস নেই।
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs">
              <Users className="w-12 h-12 mb-2 stroke-1 text-gray-300" />
              <p>বাম পাশের তালিকা থেকে একজন কৃষক নির্বাচন করুন।</p>
            </div>
          )}
        </div>
      </div>

      {/* Collect Due Payment Modal */}
      {showCollectModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full border border-gray-200 overflow-hidden">
            <div className="bg-emerald-950 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm">বকেয়া টাকা জমা গ্রহণ</h3>
              <button
                onClick={() => setShowCollectModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCollectDue} className="p-5 space-y-3 text-xs">
              <div className="bg-gray-50 p-2.5 rounded-lg">
                <span className="text-gray-500 block">বর্তমান বকেয়া:</span>
                <strong className="text-base font-black text-rose-700 font-mono">
                  ৳ {selectedCustomer.totalDue}
                </strong>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  জমা টাকার পরিমাণ (BDT ৳) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedCustomer.totalDue}
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 font-mono font-bold text-sm focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">মাধ্যম (Method):</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['CASH', 'BKASH', 'NAGAD'] as PaymentMethod[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setCollectMethod(m)}
                      className={`py-1 rounded text-center font-bold border transition ${
                        collectMethod === m
                          ? 'bg-emerald-800 text-white border-emerald-900'
                          : 'bg-white text-gray-700 border-gray-300'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">মন্তব্য (নোট):</label>
                <input
                  type="text"
                  placeholder="যেমন: ধান বিক্রির পর কিস্তির টাকা..."
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-1.5"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowCollectModal(false)}
                  className="px-3 py-1.5 border border-gray-300 rounded text-gray-700"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-bold rounded shadow-xs"
                >
                  {isProcessing ? 'জমা হচ্ছে...' : 'নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-gray-200 overflow-hidden">
            <div className="bg-emerald-950 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="font-bold text-sm">নতুন কৃষক / ক্রেতা যোগ</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-800 mb-1">কৃষকের নাম *</label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: মোঃ কামরুল ইসলাম"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-1.5"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">মোবাইল নম্বর *</label>
                <input
                  type="tel"
                  required
                  placeholder="017xxxxxxxx"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-1.5 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">গ্রাম</label>
                  <select
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-1.5 bg-white"
                  >
                    {AUTHORIZED_VILLAGES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-800 mb-1">ইউনিয়ন / উপজেলা</label>
                  <input
                    type="text"
                    placeholder="যেমন: শিবচর"
                    value={union}
                    onChange={(e) => setUnion(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-1.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-gray-800 mb-1">জাতীয় পরিচয়পত্র (NID)</label>
                  <input
                    type="text"
                    placeholder="NID নম্বর"
                    value={nid}
                    onChange={(e) => setNid(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-800 mb-1">ক্রেডিট লিমিট (৳)</label>
                  <input
                    type="number"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(parseInt(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded-lg p-1.5 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">নোট / বিবরণ</label>
                <input
                  type="text"
                  placeholder="যেমন: ৩ বিঘা জমির ধান ও পেঁয়াজ চাষী"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-1.5"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 border border-gray-300 rounded text-gray-700"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded shadow-xs"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
