import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardStats, Admin, DashboardStats } from '../utils/adminApi';
import AppLayout from '../components/AppLayout';
import Skeleton from '../components/Skeleton';
import {
  UsersIcon,
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import { getApiBaseUrl } from '../utils/api';

// Simple bar chart component
const BarChart: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({ data }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-3 h-36">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 text-center">{d.value.toLocaleString()}</span>
          <div
            className={`w-full rounded-t-xl transition-all duration-700 ${d.color}`}
            style={{ height: `${Math.max((d.value / max) * 100, 4)}%`, minHeight: '4px' }}
          />
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider text-center leading-tight">{d.label}</span>
        </div>
      ))}
    </div>
  );
};

// Line chart placeholder
const ProfitTrendChart: React.FC = () => {
  // Placeholder data - real data integration can be done later
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const values = [12000, 18500, 14200, 24000, 21500, 31000]; // placeholder values
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const width = 600;
  const height = 160;
  const padding = { left: 40, right: 20, top: 20, bottom: 30 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = values.map((v, i) => ({
    x: padding.left + (i / (values.length - 1)) * chartWidth,
    y: padding.top + chartHeight - ((v - min) / range) * chartHeight,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = [
    ...points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`),
    `L ${points[points.length - 1].x} ${padding.top + chartHeight}`,
    `L ${padding.left} ${padding.top + chartHeight}`,
    'Z'
  ].join(' ');

  return (
    <div className="w-full overflow-x-auto">
      <div className="relative" style={{ minWidth: 320 }}>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: '160px' }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
            <line
              key={i}
              x1={padding.left}
              y1={padding.top + chartHeight * (1 - t)}
              x2={width - padding.right}
              y2={padding.top + chartHeight * (1 - t)}
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeWidth={1}
            />
          ))}

          {/* Area fill */}
          <path d={areaD} fill="url(#profitGradient)" />

          {/* Line */}
          <path d={pathD} fill="none" stroke="#1a73e8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

          {/* Data points */}
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={4} fill="#1a73e8" stroke="white" strokeWidth={2} />
          ))}

          {/* X-axis labels */}
          {months.map((m, i) => (
            <text
              key={i}
              x={padding.left + (i / (values.length - 1)) * chartWidth}
              y={height - 5}
              textAnchor="middle"
              fill="currentColor"
              fontSize={10}
              fontWeight="bold"
              opacity={0.5}
            >
              {m}
            </text>
          ))}

          {/* Y-axis labels */}
          {[min, (min + max) / 2, max].map((v, i) => (
            <text
              key={i}
              x={padding.left - 5}
              y={padding.top + chartHeight - (i === 0 ? 0 : i === 1 ? chartHeight / 2 : chartHeight) + 4}
              textAnchor="end"
              fill="currentColor"
              fontSize={9}
              fontWeight="bold"
              opacity={0.4}
            >
              {(v / 1000).toFixed(0)}k
            </text>
          ))}

          <defs>
            <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1a73e8" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#1a73e8" stopOpacity={0} />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
};

const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [totalCompanies, setTotalCompanies] = useState<number>(0);
  const [totalCreditsUsed, setTotalCreditsUsed] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    fetchAll();
  }, [navigate]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [statsData] = await Promise.all([getDashboardStats()]);
      setStats(statsData);

      // Fetch total companies count
      try {
        const apiUrl = getApiBaseUrl();
        const companiesRes = await fetch(`${apiUrl}/api/admin/stats/companies`);
        if (companiesRes.ok) {
          const data = await companiesRes.json();
          if (data.success) setTotalCompanies(data.totalCompanies || 0);
        }
      } catch { /* fallback to 0 */ }

      // Fetch total credits used across all users
      try {
        const apiUrl = getApiBaseUrl();
        const creditsRes = await fetch(`${apiUrl}/api/admin/stats/credits`);
        if (creditsRes.ok) {
          const data = await creditsRes.json();
          if (data.success) setTotalCreditsUsed(data.totalCreditsUsed || 0);
        }
      } catch { /* fallback to 0 */ }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (n: number) => new Intl.NumberFormat('en-US').format(n);
  const formatCredits = (n: number) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n) + ' CR';

  if (!admin) return null;

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'Admin', path: '/admin/dashboard' },
        { label: 'Dashboard' }
      ]}
      pageTitle="Admin Dashboard"
      pageDescription={`Platform-wide analytics and overview. Welcome back, ${admin.name || admin.email}`}
      primaryAction={
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/admin/logs')}
            className="flex items-center px-4 py-2 bg-slate-800 dark:bg-slate-100 hover:bg-slate-900 dark:hover:bg-white text-white dark:text-slate-900 rounded-xl transition-all font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-900/20"
          >
            <DocumentTextIcon className="w-4 h-4 mr-2" />
            System Logs
          </button>
          <button
            onClick={fetchAll}
            className="flex items-center px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl transition-all font-bold text-sm shadow-sm"
          >
            <ArrowPathIcon className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      }
    >
      <div className="space-y-8 animate-in fade-in duration-500">
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-red-700 dark:text-red-400 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Platform KPI Cards */}
        {loading && !stats ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <Skeleton width={100} height={12} variant="text" className="mb-4" />
                <Skeleton width={60} height={32} variant="text" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Credits Used */}
            <div className="bg-gradient-to-br from-primary to-blue-600 rounded-3xl p-6 text-white shadow-xl shadow-primary/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4 opacity-80">
                  <span className="text-[10px] font-black uppercase tracking-widest">Total Credits Used</span>
                  <CurrencyDollarIcon className="h-5 w-5" />
                </div>
                <p className="text-3xl font-black">{formatCredits(totalCreditsUsed || (stats?.monthlyRevenue || 0))}</p>
                <p className="text-[10px] opacity-60 font-bold mt-1 uppercase tracking-wider">All time platform usage</p>
              </div>
            </div>

            {/* Total Users */}
            <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Users</span>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <UsersIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white">
                {loading ? '—' : formatNumber(stats?.totalUsers || 0)}
              </p>
              <p className="text-xs text-slate-400 font-bold mt-1">Registered accounts</p>
            </div>

            {/* Total Companies */}
            <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Companies</span>
                <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <BuildingOfficeIcon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white">
                {loading ? '—' : formatNumber(totalCompanies)}
              </p>
              <p className="text-xs text-slate-400 font-bold mt-1">Created organisations</p>
            </div>

            {/* Active This Month */}
            <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active This Month</span>
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <ArrowTrendingUpIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white">
                {loading ? '—' : formatNumber(stats?.activeUsers || 0)}
              </p>
              <p className="text-xs text-slate-400 font-bold mt-1">Users with activity</p>
            </div>
          </div>
        )}

        {/* Service Usage Breakdown */}
        {stats && stats.serviceUsage && stats.serviceUsage.length > 0 && (
          <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <ChartBarIcon className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Service Usage This Month</h2>
            </div>
            <div className="p-6">
              <BarChart
                data={stats.serviceUsage.map(s => ({
                  label: s.service_name,
                  value: s.total_usage,
                  color: s.service_name === 'elevenlabs'
                    ? 'bg-primary'
                    : s.service_name === 'gemini'
                      ? 'bg-violet-500'
                      : 'bg-emerald-500',
                }))}
              />
            </div>
          </div>
        )}

        {/* Profit Trend Graph (Placeholder) */}
        <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ArrowTrendingUpIcon className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Platform Profit Trend</h2>
              </div>
              <span className="text-[10px] font-black text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full uppercase tracking-widest">
                Placeholder Data
              </span>
            </div>
          </div>
          <div className="p-6">
            <ProfitTrendChart />
            <p className="text-xs text-slate-400 font-bold mt-4 text-center">
              * Revenue data integration coming soon. Connect to your billing service to populate real data.
            </p>
          </div>
        </div>

        {/* Service Details Cards */}
        {stats && stats.serviceUsage && stats.serviceUsage.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.serviceUsage.map((service) => (
              <div key={service.service_name} className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-all">
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">
                  {service.service_name}
                </h3>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{formatNumber(service.total_usage)}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">Total Usage</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">{formatNumber(service.user_count)}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Active Users</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/admin/users')}
            className="flex items-center justify-between p-6 bg-primary/5 dark:bg-primary/10 hover:bg-primary/10 dark:hover:bg-primary/15 border border-primary/20 rounded-3xl transition-all group"
          >
            <div className="text-left">
              <p className="text-sm font-black text-slate-900 dark:text-white">Manage Users</p>
              <p className="text-xs text-slate-500 font-medium mt-0.5">View, block, credit, impersonate users</p>
            </div>
            <UsersIcon className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
          </button>
          <button
            onClick={() => navigate('/admin/logs')}
            className="flex items-center justify-between p-6 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl transition-all group"
          >
            <div className="text-left">
              <p className="text-sm font-black text-slate-900 dark:text-white">System Audit Logs</p>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Track all administrative actions</p>
            </div>
            <DocumentTextIcon className="h-8 w-8 text-slate-400 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminDashboardPage;
