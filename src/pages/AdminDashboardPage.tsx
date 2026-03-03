import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardStats, getUsers, getUserBalance, DashboardStats, UserListItem, Admin } from '../utils/adminApi';
import CreditManagementModal from '../components/CreditManagementModal';
import AppLayout from '../components/AppLayout';
import KPICard from '../components/KPICard';
import Skeleton from '../components/Skeleton';
import {
  UsersIcon,
  ArrowUpIcon,
  CurrencyDollarIcon,
  ClockIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ArrowRightIcon,
  LockClosedIcon,
  LockOpenIcon,
  NoSymbolIcon,
  CheckCircleIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { updateUserStatus } from '../utils/adminApi';

const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userBalances, setUserBalances] = useState<Record<string, number>>({});
  const [selectedUser, setSelectedUser] = useState<{ id: string; email: string; balance: number } | null>(null);

  useEffect(() => {
    const adminData = localStorage.getItem('admin');
    if (!adminData) {
      navigate('/admin/login');
      return;
    }

    setAdmin(JSON.parse(adminData));
    fetchDashboardData();
  }, [navigate]);

  useEffect(() => {
    if (admin) {
      fetchUsers();
    }
  }, [pagination.page, search, admin]);

  const fetchDashboardData = async () => {
    try {
      const statsData = await getDashboardStats();
      setStats(statsData);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { users: usersData, pagination: paginationData } = await getUsers(
        pagination.page,
        pagination.limit,
        search
      );
      setUsers(usersData);
      setPagination(prev => ({ ...prev, ...paginationData }));

      const balances: Record<string, number> = {};
      for (const user of usersData) {
        try {
          const balance = await getUserBalance(user.id);
          balances[user.id] = balance;
        } catch (err) {
          balances[user.id] = 0;
        }
      }
      setUserBalances(balances);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCredits = (user: UserListItem) => {
    setSelectedUser({
      id: user.id,
      email: user.email,
      balance: userBalances[user.id] || 0
    });
  };

  const handleCreditSuccess = () => {
    fetchUsers();
  };

  const handleLogout = () => {
    localStorage.removeItem('admin');
    navigate('/admin/login');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleToggleStatus = async (user: UserListItem) => {
    const newStatus = user.status === 'active' ? 'locked' : 'active';
    const confirmMsg = `Are you sure you want to ${newStatus === 'locked' ? 'LOCK' : 'UNLOCK'} access for ${user.email}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setLoading(true);
      await updateUserStatus(user.id, newStatus, admin?.id || '');
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const formatCredits = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount) + ' CR';
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!admin) {
    return null;
  }

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'Admin', path: '/admin/dashboard' },
        { label: 'Dashboard' }
      ]}
      pageTitle="Admin Dashboard"
      pageDescription={`System overview and user management. Welcome back, ${admin.name || admin.email}`}
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
            onClick={fetchDashboardData}
            className="flex items-center px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl transition-all font-bold text-sm shadow-sm"
          >
            <ArrowPathIcon className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      }
    >
      <div className="space-y-8 animate-in fade-in duration-500">
        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-red-700 dark:text-red-400 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Stats Grid */}
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
          stats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <KPICard title="Total Users" value={formatNumber(stats.totalUsers)} color="blue" />
              <KPICard title="Active This Month" value={formatNumber(stats.activeUsers)} color="green" />
              <KPICard title="Monthly Revenue" value={formatCredits(stats.monthlyRevenue)} color="purple" />
              <KPICard title="Pending Billing" value={formatCredits(stats.pendingBilling)} color="red" />
            </div>
          )
        )}

        {/* Service Usage */}
        {stats && stats.serviceUsage.length > 0 && (
          <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Service Usage (This Month)</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.serviceUsage.map((service) => (
                  <div key={service.service_name} className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">{service.service_name}</h3>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-2xl font-bold text-slate-800 dark:text-white">{formatNumber(service.user_count)}</p>
                        <p className="text-[10px] text-slate-500 font-medium">Active Users</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">{formatNumber(service.total_usage)}</p>
                        <p className="text-[10px] text-slate-500 font-medium">Total Tokens/Calls</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Users Table Section */}
        <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">User Management</h2>
            <form onSubmit={handleSearch} className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                <MagnifyingGlassIcon className="h-4 w-4" />
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users..."
                className="pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all font-bold text-sm text-slate-900 dark:text-white w-full md:w-64"
              />
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-900/50">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">User Details</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Balance</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Usage (11L/Gem/DG)</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Joined</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading && users.length === 0 ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4"><Skeleton width={150} height={16} /></td>
                      <td className="px-6 py-4 text-center"><Skeleton width={80} height={16} className="mx-auto" /></td>
                      <td className="px-6 py-4 text-center"><Skeleton width={120} height={16} className="mx-auto" /></td>
                      <td className="px-6 py-4"><Skeleton width={100} height={16} /></td>
                      <td className="px-6 py-4 text-right"><Skeleton width={80} height={32} className="ml-auto" /></td>
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold">No users found</td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm mr-3">
                            {user.username?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{user.email}</div>
                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{user.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {user.status === 'active' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 uppercase tracking-widest border border-emerald-100 dark:border-emerald-800/50">
                            <CheckCircleIcon className="w-3 h-3 mr-1" />
                            Active
                          </span>
                        ) : user.status === 'locked' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 uppercase tracking-widest border border-red-100 dark:border-red-800/50">
                            <LockClosedIcon className="w-3 h-3 mr-1" />
                            Locked
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-widest border border-slate-200 dark:border-slate-700/50">
                            <NoSymbolIcon className="w-3 h-3 mr-1" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                          {formatCredits(userBalances[user.id] || 0)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center space-x-2 text-[11px] font-bold text-slate-500">
                          <span title="ElevenLabs">{formatNumber(user.elevenlabs_usage)}</span>
                          <span className="text-slate-300">/</span>
                          <span title="Gemini">{formatNumber(user.gemini_usage)}</span>
                          <span className="text-slate-300">/</span>
                          <span title="Deepgram">{formatNumber(user.deepgram_usage)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center">
                          <ClockIcon className="h-3 w-3 mr-1 opacity-50" />
                          {formatDate(user.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end space-x-3">
                          <button
                            onClick={() => handleToggleStatus(user)}
                            className={`p-2 rounded-lg transition-colors ${user.status === 'active'
                              ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100'
                              : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100'}`}
                            title={user.status === 'active' ? 'Lock User Access' : 'Restore User Access'}
                          >
                            {user.status === 'active' ? <LockClosedIcon className="h-4 w-4" /> : <LockOpenIcon className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => handleAddCredits(user)}
                            className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 transition-colors"
                            title="Add Credits"
                          >
                            <PlusIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => navigate(`/admin/users/${user.id}`)}
                            className="flex items-center text-[11px] font-black text-primary hover:underline uppercase tracking-widest"
                          >
                            Details
                            <ArrowRightIcon className="h-3 w-3 ml-1" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Page {pagination.page} of {pagination.totalPages}</p>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 disabled:opacity-50 hover:bg-slate-100 transition-all border border-slate-100 dark:border-slate-800"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 disabled:opacity-50 hover:bg-slate-100 transition-all border border-slate-100 dark:border-slate-800"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedUser && (
        <CreditManagementModal
          userId={selectedUser.id}
          userEmail={selectedUser.email}
          currentBalance={selectedUser.balance}
          onClose={() => setSelectedUser(null)}
          onSuccess={handleCreditSuccess}
        />
      )}
    </AppLayout>
  );
};

export default AdminDashboardPage;
