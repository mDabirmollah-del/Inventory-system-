import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCw,
  X,
  ShieldCheck,
  Clock,
  Sparkles,
  Layers,
} from 'lucide-react';
import { runAllAcceptanceTests, type AcceptanceTestResult } from '../services/acceptanceSuite';

interface AcceptanceSuiteModalProps {
  onClose: () => void;
}

export const AcceptanceSuiteModal: React.FC<AcceptanceSuiteModalProps> = ({ onClose }) => {
  const [tests, setTests] = useState<AcceptanceTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const startTests = async () => {
    setIsRunning(true);
    try {
      await runAllAcceptanceTests((updated) => {
        setTests([...updated]);
      });
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    startTests();
  }, []);

  const passedCount = tests.filter((t) => t.status === 'PASS').length;
  const failedCount = tests.filter((t) => t.status === 'FAIL').length;
  const isAllPassed = tests.length > 0 && passedCount === tests.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-gray-200 overflow-hidden my-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-emerald-950 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-300" />
            <div>
              <h3 className="font-bold text-sm">
                মেসার্স আব্দুস সামাদ মোল্লাহ্ — ১২টি স্বয়ংক্রিয় গ্রহণযোগ্যতা টেস্ট
              </h3>
              <p className="text-[11px] text-emerald-300">
                ১-বিঘা ফর্মুলা, পারমাণবিক লেনদেন, আংশিক ক্যাশ স্প্লিট ও ড্রাইভ ব্যাকআপ টেস্ট স্যুট
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={startTests}
              disabled={isRunning}
              className="inline-flex items-center gap-1.5 bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-emerald-950 font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-xs"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
              {isRunning ? 'টেস্ট চলছে...' : 'পুনরায় টেস্ট চালান'}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Overall Status Bar */}
        <div className="bg-gray-50 px-5 py-3 border-b flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 font-bold">
              <span className="text-gray-500">মোট টেস্ট:</span>
              <span className="font-mono text-gray-900">{tests.length} টি</span>
            </div>
            <div className="flex items-center gap-1.5 font-bold text-emerald-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>উত্তীর্ণ: {passedCount} টি</span>
            </div>
            {failedCount > 0 && (
              <div className="flex items-center gap-1.5 font-bold text-rose-700">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>ব্যর্থ: {failedCount} টি</span>
              </div>
            )}
          </div>

          {isAllPassed && (
            <div className="bg-emerald-100 text-emerald-900 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1.5 border border-emerald-300">
              <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
              ১২/১২ টি টেস্ট সফলভাবে উত্তীর্ণ (100% Verified)
            </div>
          )}
        </div>

        {/* Test Cases List */}
        <div className="p-5 overflow-y-auto divide-y divide-gray-100 space-y-2">
          {tests.map((test) => (
            <div key={test.id} className="pt-2.5 first:pt-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5">
                    {test.status === 'PASS' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                    {test.status === 'FAIL' && <XCircle className="w-4 h-4 text-rose-600" />}
                    {test.status === 'RUNNING' && (
                      <RotateCw className="w-4 h-4 text-amber-500 animate-spin" />
                    )}
                    {test.status === 'IDLE' && (
                      <span className="w-4 h-4 rounded-full border border-gray-300 inline-block" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-gray-900">
                        টেস্ট {test.id}: {test.title}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-gray-100 text-gray-600">
                        {test.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 mt-0.5">{test.assertion}</p>
                    {test.details && (
                      <div className="text-[10px] text-emerald-800 font-medium bg-emerald-50/60 p-1.5 rounded border border-emerald-200 mt-1 inline-block">
                        ফলাফল: {test.details}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`font-mono font-bold text-xs px-2 py-0.5 rounded-full ${
                      test.status === 'PASS'
                        ? 'bg-emerald-100 text-emerald-800'
                        : test.status === 'FAIL'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {test.status}
                  </span>
                  <div className="text-[10px] text-gray-400 font-mono mt-1">
                    {test.executionTimeMs} ms
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-gray-100 px-5 py-3 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-medium text-xs rounded-lg transition cursor-pointer"
          >
            বন্ধ করুন (Close)
          </button>
        </div>
      </div>
    </div>
  );
};
