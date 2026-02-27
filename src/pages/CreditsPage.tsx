import React, { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../contexts/AuthContext';
import { getApiBaseUrl } from '../utils/api';
import {
  BanknotesIcon,
  CreditCardIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ArrowPathIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  balanceAfter: number;
  service: string | null;
  description: string | null;
  createdAt: string;
  metadata?: any;
}

interface UsageStat {
  service: string;
  totalUnits: number;
  totalCost: number;
  usageCount: number;
}

interface Pricing {
  service_type: string;
  cost_per_unit: number;
  unit_type: string;
  description: string;
}

interface WalletData {
  balance: number;
  transactions: Transaction[];
}

const CreditsPage: React.FC = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStat[]>([]);
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpLoading, setTopUpLoading] = useState(false);


  useEffect(() => {
    if (user?.id) {
      fetchWalletData();
    }
  }, [user]);

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      const apiUrl = getApiBaseUrl();

      // Fetch balance
      const balanceRes = await fetch(`${apiUrl}/api/wallet/balance/${user.id}`);
      const balanceData = await balanceRes.json();
      if (balanceData.success) {
        setBalance(balanceData.balance);
      }

      // Fetch transactions
      const txRes = await fetch(`${apiUrl}/api/wallet/transactions/${user.id}?limit=50`);
      const txData = await txRes.json();
      if (txData.success) {
        setTransactions(txData.transactions);
      }

      // Fetch usage stats
      const statsRes = await fetch(`${apiUrl}/api/wallet/usage-stats/${user.id}`);
      const statsData = await statsRes.json();
      if (statsData.success) {
        setUsageStats(statsData.stats);
      }

      // Fetch pricing
      const pricingRes = await fetch(`${apiUrl}/api/wallet/pricing`);
      const pricingData = await pricingRes.json();
      if (pricingData.success) {
        setPricing(pricingData.pricing);
      }

      setError('');
    } catch (err: any) {
      console.error('Error fetching wallet data:', err);
      setError(err.message || 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getServiceLabel = (service: string) => {
    const s = service.toLowerCase();
    if (s.includes('elevenlabs') || s.includes('sarvam')) return 'TTS';
    if (s.includes('deepgram')) return 'STT';
    if (s.includes('gemini')) return 'LLM';
    if (s.includes('twilio')) return 'Telephony';
    return service.toUpperCase();
  };

  const getServiceColor = (service: string) => {
    const label = getServiceLabel(service);
    switch (label) {
      case 'TTS':
        return 'from-blue-500 to-blue-600';
      case 'STT':
        return 'from-orange-500 to-orange-600';
      case 'LLM':
        return 'from-purple-500 to-purple-600';
      case 'Telephony':
        return 'from-red-500 to-red-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  if (loading) {
    return (
      <AppLayout
        breadcrumbs={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Wallet & Usage' }]}
        pageTitle="Wallet & Usage"
      >
        <div className="flex flex-col justify-center items-center h-[60vh]">
          <div className="relative">
            <div className="flex items-center justify-center p-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary"></div>
            </div>
          </div>
          <p className="mt-4 text-slate-500 font-medium animate-pulse">Loading wallet data...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Wallet & Usage' }
      ]}
      pageTitle="Wallet & Usage"
      pageDescription="Track your API credit usage, balance history, and service costs."
      primaryAction={
        <div className="flex items-center gap-3">
          <button
            onClick={fetchWalletData}
            className="flex items-center px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Refresh Data
          </button>
          <button
            onClick={() => setShowTopUpModal(true)}
            className="flex items-center px-5 py-2.5 rounded-xl bg-primary text-white font-black text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            <BanknotesIcon className="h-4 w-4 mr-2" />
            Add Fund
          </button>
        </div>
      }
    >
      <div className="space-y-8 animate-in fade-in duration-500">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg text-red-600 dark:text-red-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-sm font-bold text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Compact KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Balance Card - Clean and Simple */}
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 shadow-lg shadow-emerald-500/20 text-white relative overflow-hidden group">
            <div className="absolute -top-2 -right-2 opacity-10 group-hover:opacity-20 transition-all duration-500 transform group-hover:scale-110">
              <BanknotesIcon className="h-20 w-20" />
            </div>
            <div className="relative z-10">
              <p className="text-emerald-100 font-bold text-[10px] uppercase tracking-widest mb-1">Available Balance</p>
              <h2 className="text-4xl font-black tracking-tight">{formatCurrency(balance)}</h2>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex items-center">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-500">
                <ArrowTrendingUpIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Total Spent</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                  {formatCurrency(usageStats.reduce((acc, curr) => acc + curr.totalCost, 0))}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex items-center">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-2xl text-purple-500">
                <ChartBarIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Transactions Count</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{transactions.length}</p>
              </div>
            </div>
          </div>
        </div>



        <div className="grid grid-cols-1 gap-8">
          {/* Transaction History - Full Width */}
          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <ClockIcon className="h-4 w-4 text-slate-400" />
                  Recharge & Funding History
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">Showing successful credit additions and balance top-ups.</p>
              </div>
              <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Download Statements</button>
            </div>
            <div className="overflow-x-auto">
              {transactions.filter(tx => tx.type === 'credit').length > 0 ? (
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 dark:bg-slate-900/50">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transaction Details</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Payment Method</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Credit Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {transactions.filter(tx => tx.type === 'credit').map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30">
                              +
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900 dark:text-white mb-0.5">{tx.description || 'Deposit to Wallet'}</p>
                              <p className="text-[10px] text-slate-500">{formatDate(tx.createdAt)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                            <CreditCardIcon className="h-4 w-4" />
                            Card Ending •••• 4242
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            SUCCESSFUL
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-sm font-black text-emerald-600">
                            +{formatCurrency(tx.amount)}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-12 text-center text-slate-500 font-medium text-sm italic">No recent recharge data found</div>
              )}
            </div>
            <div className="p-6 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 text-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">End of History</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CreditsPage;
