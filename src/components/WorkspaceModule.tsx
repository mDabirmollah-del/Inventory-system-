import React, { useState, useEffect } from 'react';
import {
  FileText,
  ClipboardList,
  Plus,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Calendar,
} from 'lucide-react';
import {
  createGoogleDoc,
  listGoogleDocs,
  createGoogleForm,
  listGoogleForms,
} from '../services/workspaceService';

export const WorkspaceModule: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'docs' | 'forms'>('docs');
  const [docs, setDocs] = useState<any[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (activeSubTab === 'docs') {
        const data = await listGoogleDocs();
        setDocs(data);
      } else {
        const data = await listGoogleForms();
        setForms(data);
      }
    } catch (err: any) {
      setError(err.message || 'ডাটা লোড করতে সমস্যা হয়েছে।');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeSubTab]);

  const handleCreateNew = async () => {
    const title = window.prompt(
      activeSubTab === 'docs' ? 'নতুন ডকুমেন্টের নাম দিন:' : 'নতুন ফর্মের নাম দিন:'
    );
    if (!title) return;

    setIsCreating(true);
    setError(null);
    try {
      if (activeSubTab === 'docs') {
        await createGoogleDoc(title);
      } else {
        await createGoogleForm(title);
      }
      loadData();
    } catch (err: any) {
      setError(err.message || 'তৈরি করতে সমস্যা হয়েছে।');
    } finally {
      setIsCreating(false);
    }
  };

  const filteredItems = (activeSubTab === 'docs' ? docs : forms).filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      {/* Header section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
              {activeSubTab === 'docs' ? (
                <FileText className="w-7 h-7 text-blue-600" />
              ) : (
                <ClipboardList className="w-7 h-7 text-purple-600" />
              )}
              গুগল ওয়ার্কস্পেস ইন্টিগ্রেশন
            </h1>
            <p className="text-slate-500 text-sm font-medium mt-1">
              সরাসরি গুগল ডক এবং গুগল ফর্ম ব্যবস্থাপনা করুন
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveSubTab('docs')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeSubTab === 'docs'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Google Docs
            </button>
            <button
              onClick={() => setActiveSubTab('forms')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeSubTab === 'forms'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Google Forms
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-4">
        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={`${activeSubTab === 'docs' ? 'ডকুমেন্ট' : 'ফর্ম'} খুঁজুন...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-200 outline-none transition-all text-sm font-medium"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
              title="রিফ্রেশ করুন"
            >
              <RefreshCw className={`w-5 h-5 text-slate-600 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleCreateNew}
              disabled={isCreating}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 ${
                activeSubTab === 'docs'
                  ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                  : 'bg-purple-600 hover:bg-purple-700 shadow-purple-200'
              }`}
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {activeSubTab === 'docs' ? 'নতুন ডকুমেন্ট' : 'নতুন ফর্ম'}
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-700 px-4 py-3 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {/* Grid List */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 text-slate-300 animate-spin" />
            <p className="text-slate-400 font-bold">লোড হচ্ছে...</p>
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="group bg-white rounded-2xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-xl transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div
                    className={`p-2.5 rounded-xl ${
                      activeSubTab === 'docs' ? 'bg-blue-50' : 'bg-purple-50'
                    }`}
                  >
                    {activeSubTab === 'docs' ? (
                      <FileText className="w-6 h-6 text-blue-600" />
                    ) : (
                      <ClipboardList className="w-6 h-6 text-purple-600" />
                    )}
                  </div>
                  <a
                    href={item.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                    title="ওপেন করুন"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                <h3 className="font-bold text-slate-800 line-clamp-2 min-h-[2.5rem] mb-2 group-hover:text-slate-900 transition-colors">
                  {item.name}
                </h3>

                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <Calendar className="w-3 h-3" />
                  পরিবর্তিত: {new Date(item.modifiedTime).toLocaleDateString('bn-BD')}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-50 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={item.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-black transition-all ${
                      activeSubTab === 'docs'
                        ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                        : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                    }`}
                  >
                    সম্পাদনা করুন
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              {activeSubTab === 'docs' ? (
                <FileText className="w-8 h-8 text-slate-300" />
              ) : (
                <ClipboardList className="w-8 h-8 text-slate-300" />
              )}
            </div>
            <h3 className="text-slate-900 font-black tracking-tight">কোনো ডাটা পাওয়া যায়নি</h3>
            <p className="text-slate-500 text-sm mt-1">
              আপনার গুগল ড্রাইভ থেকে {activeSubTab === 'docs' ? 'ডকুমেন্ট' : 'ফর্ম'} খুঁজে পাওয়া
              যায়নি।
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
