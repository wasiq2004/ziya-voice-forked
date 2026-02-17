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

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'elevenlabs':
        return '🔊';
      case 'deepgram':
        return '🎤';
      case 'gemini':
        return '🤖';
      case 'sarvam':
        return '🗣️';
      case 'twilio':
        return '📞';
      default:
        return '💰';
    }
  };

  const getServiceColor = (service: string) => {
    switch (service) {
      case 'elevenlabs':
        return 'from-blue-500 to-blue-600';
      case 'deepgram':
        return 'from-orange-500 to-orange-600';
      case 'gemini':
        return 'from-purple-500 to-purple-600';
      case 'sarvam':
        return 'from-green-500 to-green-600';
      case 'twilio':
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
        <button className="flex items-center px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
          <ArrowPathIcon className="h-4 w-4 mr-2" />
          Refresh Data
        </button>
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

        {/* Balance Card & Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Balance Card */}
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-8 shadow-lg shadow-emerald-500/20 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity duration-500 transform group-hover:scale-110">
              <BanknotesIcon className="h-32 w-32" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl">
                  <CreditCardIcon className="h-6 w-6 text-white" />
                </div>
                <span className="px-3 py-1 rounded-lg bg-emerald-400/30 border border-emerald-400/30 text-xs font-bold uppercase tracking-wider backdrop-blur-sm">Active</span>
              </div>
              <div>
                <p className="text-emerald-100 font-bold text-xs uppercase tracking-widest mb-2">Available Balance</p>
                <h2 className="text-5xl font-black mb-2 tracking-tight">{formatCurrency(balance)}</h2>
                <p className="text-emerald-100/80 text-sm font-medium">Auto-reload disabled</p>
              </div>
            </div>
          </div>

          {/* Secondary stats or empty space filler if needed, for now just usage Summary */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-500">
                  <ArrowTrendingUpIcon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Spent</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">
                    {formatCurrency(usageStats.reduce((acc, curr) => acc + curr.totalCost, 0))}
                  </p>
                </div>
              </div>
              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full w-3/4"></div>
              </div>
              <p className="mt-4 text-xs text-slate-500 font-medium">Spending across all services for the current billing period.</p>
            </div>

            <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-2xl text-purple-500">
                  <ChartBarIcon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Transactions</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">{transactions.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
                <p className="text-xs text-slate-500 font-medium">Last active today</p>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Stats Section */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <ChartBarIcon className="h-5 w-5 text-primary" />
            Service Usage Breakdown
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {usageStats.length > 0 ? (
              usageStats.map((stat) => (
                <div
                  key={stat.service}
                  className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:border-primary/30 transition-all group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getServiceColor(stat.service)} flex items-center justify-center text-lg shadow-sm group-hover:scale-110 transition-transform`}>
                      {getServiceIcon(stat.service)}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.service}</span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-baseline">
                      <span className="text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(stat.totalCost)}</span>
                    </div>
                    <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500 font-medium">Calls/Requests</span>
                        <span className="font-bold text-slate-800 dark:text-white">{stat.usageCount}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500 font-medium">Units Used</span>
                        <span className="font-bold text-slate-800 dark:text-white">{stat.totalUnits.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full p-12 text-center bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
                <p className="text-slate-500 font-medium">No usage data available for this period.</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Transaction History */}
          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <ClockIcon className="h-4 w-4 text-slate-400" />
                Latest Transactions
              </h3>
            </div>
            <div className="overflow-x-auto">
              {transactions.length > 0 ? (
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 dark:bg-slate-900/50">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Details</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {transactions.slice(0, 6).map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${tx.type === 'credit'
                                ? 'bg-green-100 text-green-600 dark:bg-green-900/30'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                              }`}>
                              {tx.type === 'credit' ? '+' : '-'}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900 dark:text-white mb-0.5">{tx.description || 'System Transaction'}</p>
                              <p className="text-[10px] text-slate-500">{formatDate(tx.createdAt)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className={`text-sm font-bold ${tx.type === 'credit' ? 'text-green-600' : 'text-slate-900 dark:text-white'
                            }`}>
                            {tx.type === 'credit' ? '+' : ''}{formatCurrency(tx.amount)}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-12 text-center text-slate-500 font-medium text-sm italic">No transactions found</div>
              )}
            </div>
          </div>

          {/* Pricing Table */}
          <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <CurrencyDollarIcon className="h-4 w-4 text-slate-400" />
                Rate Card
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 dark:bg-slate-900/50">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Service</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pricing.map((p) => (
                    <tr key={p.service_type} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{getServiceIcon(p.service_type)}</span>
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white capitalize mb-0.5">{p.service_type}</p>
                            <p className="text-[10px] text-slate-500 max-w-[200px] truncate">{p.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(p.cost_per_unit)}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">per {p.unit_type}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CreditsPage;
