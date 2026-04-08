import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import Skeleton from '../components/Skeleton';
import {
  MegaphoneIcon,
  CurrencyDollarIcon,
  ArrowPathIcon,
  FireIcon
} from '@heroicons/react/24/outline';
import KPICard from '../components/KPICard';
import { getDashboardStats, getUsers } from '../utils/adminApi';
import { getApiBaseUrl, getApiPath } from '../utils/api';

const LIVE_CAMPAIGN_STATUSES = ['running', 'active', 'in_progress', 'live'];

const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalAgents: 0,
    activeAgents: 0,
    totalCampaigns: 0,
    creditsRemain: 0,
  });
  const [activeCampaigns, setActiveCampaigns] = useState<any[]>([]);

  useEffect(() => {
    const adminData = localStorage.getItem('ziya-user');
    if (!adminData) {
      navigate('/login');
      return;
    }

    const parsed = JSON.parse(adminData);
    if (parsed.role !== 'org_admin' && parsed.role !== 'super_admin') {
      navigate('/login');
      return;
    }

    setAdmin(parsed);
    fetchAll(true);

    const intervalId = window.setInterval(() => {
      fetchAll(false);
    }, 20000);

    return () => window.clearInterval(intervalId);
  }, [navigate]);

  const fetchAll = async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    }

    setError('');
    try {
      const adminData = localStorage.getItem('ziya-user');
      const parsed = adminData ? JSON.parse(adminData) : null;
      const orgId = parsed?.organization_id || null;
      const adminId = parsed?.id || null;
      const API_BASE = `${getApiBaseUrl()}${getApiPath()}`;

      const dashStats = await getDashboardStats();
      const usersResult = await getUsers(1, 1);
      const totalCustomers = usersResult.pagination?.total || dashStats.totalUsers || 0;

      let campaignList: any[] = [];
      try {
        const campRes = await fetch(`${API_BASE}/campaigns/org?orgId=${orgId || ''}&limit=10`);
        if (campRes.ok) {
          const campData = await campRes.json();
          campaignList = campData.campaigns || campData.data || [];
        }
      } catch (_) {
        campaignList = [];
      }

      const liveCampaigns = campaignList
        .filter((campaign: any) => LIVE_CAMPAIGN_STATUSES.includes(String(campaign.status || '').toLowerCase()))
        .slice(0, 5)
        .map((campaign: any) => {
          const totalContacts = Number(campaign.total_contacts || 0);
          const completedCalls = Number(campaign.completed_calls || 0);
          const progress = totalContacts > 0
            ? Math.min(100, Math.round((completedCalls / totalContacts) * 100))
            : 0;

          return {
            id: campaign.id?.slice(0, 8) || 'N/A',
            name: campaign.name || 'Untitled Campaign',
            user: campaign.username || campaign.user_email || '—',
            progress,
            leads: totalContacts,
            connected: completedCalls,
          };
        });

      setActiveCampaigns(liveCampaigns);

      let orgCredits = 0;
      if (adminId) {
        try {
          const walletRes = await fetch(`${API_BASE}/wallet/balance/${adminId}`);
          if (walletRes.ok) {
            const walletData = await walletRes.json();
            orgCredits = walletData.balance || 0;
          }
        } catch (_) {
          orgCredits = 0;
        }
      }

      setStats({
        totalCustomers,
        totalAgents: Number(dashStats.totalAgents || 0),
        activeAgents: Number(dashStats.activeAgents || 0),
        totalCampaigns: campaignList.length,
        creditsRemain: orgCredits,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  const formatNumber = (n: number | string) => {
    if (typeof n === 'string') return n;
    return new Intl.NumberFormat('en-US').format(n);
  };

  if (!admin) return null;

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'Admin', path: '/admin/dashboard' },
        { label: 'Dashboard' }
      ]}
      pageTitle="Admin Dashboard"
      pageDescription={`Welcome back to your comprehensive Organization Dashboard, ${admin.name || admin.email}`}
      primaryAction={
        <button
          onClick={() => fetchAll(true)}
          className="flex items-center px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl transition-all font-bold text-sm shadow-sm"
        >
          <ArrowPathIcon className="w-4 h-4 mr-2" />
          Refresh Data
        </button>
      }
    >
      <div className="space-y-8 animate-in fade-in duration-500">
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-red-700 dark:text-red-400 text-sm font-medium">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <Skeleton width={100} height={12} variant="text" className="mb-4" />
                <Skeleton width={60} height={32} variant="text" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <KPICard title="Total Customers" value={formatNumber(stats.totalCustomers)} color="purple" />
            <KPICard title="Total Agents" value={formatNumber(stats.totalAgents)} color="blue" />
            <KPICard title="Active Live Agents" value={formatNumber(stats.activeAgents)} color="green" />
            <KPICard title="Total Campaigns" value={formatNumber(stats.totalCampaigns)} color="gray" />

            <div className="bg-gradient-to-br from-primary to-blue-600 rounded-[1.5rem] p-5 text-white shadow-lg shadow-primary/20 relative overflow-hidden transition-all hover:scale-[1.02] flex flex-col justify-between">
              <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-white/10 rounded-full blur-xl" />
              <div className="relative z-10 flex items-center justify-between mb-2 opacity-80">
                <span className="text-[10px] font-black uppercase tracking-widest">Org Credits</span>
                <CurrencyDollarIcon className="h-4 w-4" />
              </div>
              <div className="relative z-10">
                <p className="text-3xl font-black tracking-tight">{formatNumber(stats.creditsRemain)}</p>
                <div className="text-[10px] font-bold mt-1 bg-white/20 w-fit px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <FireIcon className="w-3 h-3 text-yellow-300" />
                  Burning ~150/day
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8">
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm h-full flex flex-col">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-xl">
                    <MegaphoneIcon className="w-5 h-5 text-indigo-500" />
                  </div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Live Campaign Pulse</h3>
                </div>
                <span className="text-[10px] font-black text-indigo-500 uppercase bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                  {activeCampaigns.length} Active
                </span>
              </div>
              <div className="p-6 flex-1 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Username</th>
                      <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Campaign Name</th>
                      <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Progress</th>
                      <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 text-right">Leads</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {loading && [...Array(3)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="py-4 px-2"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-20"></div></td>
                        <td className="py-4 px-2"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-28"></div></td>
                        <td className="py-4 px-2"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full"></div></td>
                        <td className="py-4 px-2 flex justify-end"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-12"></div></td>
                      </tr>
                    ))}
                    {!loading && activeCampaigns.map((campaign) => (
                      <tr key={campaign.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
                        <td className="py-4 px-2">
                          <span className="text-xs font-medium text-slate-500">@{campaign.user}</span>
                        </td>
                        <td className="py-4 px-2">
                          <p className="font-bold text-sm text-slate-800 dark:text-white">{campaign.name}</p>
                          <span className="text-[10px] font-black text-slate-400 uppercase font-mono">{campaign.id}</span>
                        </td>
                        <td className="py-4 px-2">
                          <div className="flex items-center gap-3">
                            <div className="w-32 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${campaign.progress > 80 ? 'bg-emerald-500' : 'bg-primary'}`}
                                style={{ width: `${campaign.progress}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{campaign.progress}%</span>
                          </div>
                        </td>
                        <td className="py-4 px-2 text-right">
                          <p className="font-bold text-sm text-slate-800 dark:text-white">
                            {formatNumber(campaign.connected)} <span className="text-xs text-slate-400 font-medium">/ {formatNumber(campaign.leads)}</span>
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!loading && activeCampaigns.length === 0 && (
                  <div className="p-8 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">
                    No live campaigns currently running.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminDashboardPage;
