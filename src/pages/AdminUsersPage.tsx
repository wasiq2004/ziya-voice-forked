import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUsers, getUserBalance, Admin, updateUserStatus, impersonateUser, updateUserPlan } from '../utils/adminApi';
import { addCredits, listPlans, assignPlanToUser, Plan } from '../utils/adminApi';
import AppLayout from '../components/AppLayout';
import Skeleton from '../components/Skeleton';
import {
    MagnifyingGlassIcon,
    ArrowRightIcon,
    LockClosedIcon,
    LockOpenIcon,
    NoSymbolIcon,
    CheckCircleIcon,
    PlusCircleIcon,
    EyeIcon,
    ArrowPathIcon,
    UserGroupIcon,
    CurrencyDollarIcon,
    ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';
import { getApiBaseUrl } from '../utils/api';

interface UserRow {
    id: string;
    email: string;
    username: string;
    role: string;
    status: 'active' | 'inactive' | 'locked';
    created_at: string;
    elevenlabs_usage: number;
    gemini_usage: number;
    deepgram_usage: number;
    total_companies?: number;
    credits_balance?: number;
    credits_used?: number;
    plan_type?: 'trial' | 'paid' | 'enterprise' | null;
    plan_valid_until?: string | null;
}

const AdminUsersPage: React.FC = () => {
    const navigate = useNavigate();
    const [admin, setAdmin] = useState<Admin | null>(null);
    const [users, setUsers] = useState<UserRow[]>([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Add Credits modal state
    const [creditModal, setCreditModal] = useState<{ userId: string; email: string } | null>(null);
    const [creditAmount, setCreditAmount] = useState('');
    const [creditDesc, setCreditDesc] = useState('');
    const [creditLoading, setCreditLoading] = useState(false);
    const [planModal, setPlanModal] = useState<{ userId: string; email: string; planType: string; extendDays: string } | null>(null);
    const [planLoading, setPlanLoading] = useState(false);

    // Assign Plan modal
    const [assignModal, setAssignModal] = useState<{ userId: string; email: string } | null>(null);
    const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
    const [selectedPlanId, setSelectedPlanId] = useState('');
    const [assignLoading, setAssignLoading] = useState(false);
    const [plansLoading, setPlansLoading] = useState(false);

    useEffect(() => {
        const adminData = localStorage.getItem('admin');
        if (!adminData) {
            navigate('/admin/login');
            return;
        }
        setAdmin(JSON.parse(adminData));
    }, [navigate]);

    useEffect(() => {
        if (admin) fetchUsers();
    }, [pagination.page, search, admin]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const { users: rawUsers, pagination: paginationData } = await getUsers(pagination.page, pagination.limit, search);
            setPagination(prev => ({ ...prev, ...paginationData }));

            // Enrich with wallet + companies data
            const enriched: UserRow[] = await Promise.all(
                rawUsers.map(async (u: any) => {
                    let credits_balance = 0;
                    let credits_used = 0;
                    let total_companies = 0;

                    try {
                        credits_balance = await getUserBalance(u.id);
                    } catch { /* ignore */ }

                    try {
                        const apiUrl = getApiBaseUrl();
                        const res = await fetch(`${apiUrl}/api/wallet/usage-stats/${u.id}`);
                        const data = await res.json();
                        if (data.success && data.stats) {
                            credits_used = data.stats.reduce((acc: number, s: any) => acc + (Number(s.total_cost) || 0), 0);
                        }
                    } catch { /* ignore */ }

                    try {
                        const apiUrl = getApiBaseUrl();
                        const res = await fetch(`${apiUrl}/api/companies/${u.id}`);
                        const data = await res.json();
                        if (data.success) total_companies = (data.companies || []).length;
                    } catch { /* ignore */ }

                    return { ...u, credits_balance, credits_used, total_companies };
                })
            );
            setUsers(enriched);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const showSuccess = (msg: string) => {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(''), 3500);
    };

    const handleToggleStatus = async (user: UserRow) => {
        const newStatus = user.status === 'active' ? 'locked' : 'active';
        const confirmMsg = `Are you sure you want to ${newStatus === 'locked' ? 'BLOCK' : 'UNBLOCK'} ${user.email}?`;
        if (!window.confirm(confirmMsg)) return;

        try {
            setLoading(true);
            await updateUserStatus(user.id, newStatus, admin?.id || '');
            showSuccess(`User ${user.email} is now ${newStatus}.`);
            fetchUsers();
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    const handleUpdatePlan = async () => {
        if (!planModal || !planModal.planType) return;
        setPlanLoading(true);
        try {
            await updateUserPlan(planModal.userId, {
                plan_type: planModal.planType as any,
                extend_days: planModal.extendDays ? parseInt(planModal.extendDays) : undefined
            }, admin?.id || '');
            showSuccess(`Plan updated for ${planModal.email}`);
            setPlanModal(null);
            fetchUsers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setPlanLoading(false);
        }
    };

    const openAssignPlan = async (user: UserRow) => {
        setAssignModal({ userId: user.id, email: user.email });
        setSelectedPlanId('');
        setPlansLoading(true);
        try {
            const plans = await listPlans();
            setAvailablePlans(plans);
        } catch (err: any) {
            setError('Failed to load plans: ' + err.message);
        } finally {
            setPlansLoading(false);
        }
    };

    const handleAssignPlan = async () => {
        if (!assignModal || !selectedPlanId) return;
        setAssignLoading(true);
        try {
            const result = await assignPlanToUser(assignModal.userId, selectedPlanId, admin?.id || '');
            showSuccess(result.message || `Plan assigned to ${assignModal.email}`);
            setAssignModal(null);
            fetchUsers();
        } catch (err: any) {
            setError(err.message || 'Failed to assign plan');
        } finally {
            setAssignLoading(false);
        }
    };

    const handleAddCredits = async () => {
        if (!creditModal || !creditAmount || parseFloat(creditAmount) <= 0) return;

        setCreditLoading(true);
        try {
            await addCredits(creditModal.userId, parseFloat(creditAmount), creditDesc || 'Admin credit top-up', admin?.id || '');
            showSuccess(`Successfully added ${creditAmount} credits to ${creditModal.email}`);
            setCreditModal(null);
            setCreditAmount('');
            setCreditDesc('');
            fetchUsers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setCreditLoading(false);
        }
    };

    const handleImpersonate = async (user: UserRow) => {
        if (!window.confirm(`Log in as ${user.email}? This will open a new session as this user.`)) return;
        try {
            const result = await impersonateUser(user.id, admin?.id || '');
            if (result.success) {
                // Store impersonation data so we can return to admin
                const impersonatedUser = result.user;
                localStorage.setItem('ziya-impersonation-admin', JSON.stringify(admin));
                localStorage.setItem('ziya-user', JSON.stringify(impersonatedUser));
                showSuccess(`Logged in as ${impersonatedUser.email}. Redirecting...`);
                setTimeout(() => navigate('/agents'), 1200);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to impersonate user');
        }
    };

    const formatCredits = (n: number) =>
        new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n) + ' CR';

    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    if (!admin) return null;

    return (
        <AppLayout
            breadcrumbs={[
                { label: 'Admin', path: '/admin/dashboard' },
                { label: 'Users' }
            ]}
            pageTitle="Users"
            pageDescription="Manage all registered platform users — block, add credits, view details, or log in as any user."
            primaryAction={
                <div className="flex items-center space-x-3">
                    <button
                        onClick={fetchUsers}
                        className="flex items-center px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl transition-all font-bold text-sm shadow-sm"
                    >
                        <ArrowPathIcon className="w-4 h-4 mr-2" />
                        Refresh
                    </button>
                </div>
            }
        >
            <div className="space-y-6 animate-in fade-in duration-500">
                {/* Status Messages */}
                {successMsg && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 rounded-2xl text-green-700 dark:text-green-400 text-sm font-medium">
                        {successMsg}
                    </div>
                )}
                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-red-700 dark:text-red-400 text-sm font-medium">
                        {error}
                    </div>
                )}

                {/* Users Table */}
                <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <UserGroupIcon className="w-6 h-6 text-primary" />
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white">All Users</h2>
                            <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                {pagination.total} total
                            </span>
                        </div>
                        <form onSubmit={handleSearch} className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                                <MagnifyingGlassIcon className="h-4 w-4" />
                            </div>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by email or username..."
                                className="pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all font-bold text-sm text-slate-900 dark:text-white w-full md:w-72"
                            />
                        </form>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-900/50">
                                    <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">User ID</th>
                                    <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Name / Email</th>
                                    <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Companies</th>
                                    <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Credits Left</th>
                                    <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Credits Used</th>
                                    <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Plan</th>
                                    <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                    <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Created</th>
                                    <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {loading && users.length === 0 ? (
                                    [...Array(6)].map((_, i) => (
                                        <tr key={i}>
                                            <td className="px-5 py-4"><Skeleton width={80} height={14} /></td>
                                            <td className="px-5 py-4"><Skeleton width={160} height={14} /></td>
                                            <td className="px-5 py-4 text-center"><Skeleton width={50} height={14} className="mx-auto" /></td>
                                            <td className="px-5 py-4 text-center"><Skeleton width={80} height={14} className="mx-auto" /></td>
                                            <td className="px-5 py-4 text-center"><Skeleton width={80} height={14} className="mx-auto" /></td>
                                            <td className="px-5 py-4 text-center"><Skeleton width={60} height={14} className="mx-auto" /></td>
                                            <td className="px-5 py-4 text-center"><Skeleton width={70} height={20} className="mx-auto" /></td>
                                            <td className="px-5 py-4"><Skeleton width={90} height={14} /></td>
                                            <td className="px-5 py-4 text-right"><Skeleton width={120} height={32} className="ml-auto" /></td>
                                        </tr>
                                    ))
                                ) : users.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-16 text-center text-slate-400 font-bold">
                                            No users found
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((user) => (
                                        <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors group">
                                            {/* User ID */}
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <span className="text-[10px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded-lg">
                                                    {user.id.substring(0, 8)}…
                                                </span>
                                            </td>

                                            {/* Name / Email */}
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm flex-shrink-0">
                                                        {(user.username || user.email).charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                                                            {user.username || '—'}
                                                        </div>
                                                        <div className="text-[11px] text-slate-400 font-medium">{user.email}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Total Companies */}
                                            <td className="px-5 py-4 whitespace-nowrap text-center">
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                    {user.total_companies ?? '—'}
                                                </span>
                                            </td>

                                            {/* Credits Remaining */}
                                            <td className="px-5 py-4 whitespace-nowrap text-center">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400">
                                                    {formatCredits(user.credits_balance || 0)}
                                                </span>
                                            </td>

                                            {/* Credits Used */}
                                            <td className="px-5 py-4 whitespace-nowrap text-center">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                    {formatCredits(user.credits_used || 0)}
                                                </span>
                                            </td>

                                            {/* Plan Details */}
                                            <td className="px-5 py-4 whitespace-nowrap text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
                                                        {user.plan_type || 'None'}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 mt-1 font-medium">
                                                        {user.plan_valid_until ? new Date(user.plan_valid_until).toLocaleDateString() : 'N/A'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Status */}
                                            <td className="px-5 py-4 whitespace-nowrap text-center">
                                                {user.status === 'active' ? (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 uppercase tracking-widest border border-emerald-100 dark:border-emerald-800/50">
                                                        <CheckCircleIcon className="w-3 h-3 mr-1" /> Active
                                                    </span>
                                                ) : user.status === 'locked' ? (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 uppercase tracking-widest border border-red-100 dark:border-red-800/50">
                                                        <LockClosedIcon className="w-3 h-3 mr-1" /> Blocked
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-widest border border-slate-200 dark:border-slate-700/50">
                                                        <NoSymbolIcon className="w-3 h-3 mr-1" /> Inactive
                                                    </span>
                                                )}
                                            </td>

                                            {/* Created Date */}
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                                    {formatDate(user.created_at)}
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-5 py-4 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {/* Block / Unblock */}
                                                    <button
                                                        onClick={() => handleToggleStatus(user)}
                                                        title={user.status === 'active' ? 'Block User' : 'Unblock User'}
                                                        className={`p-2 rounded-lg transition-colors ${user.status === 'active'
                                                            ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100'
                                                            : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100'
                                                            }`}
                                                    >
                                                        {user.status === 'active'
                                                            ? <LockClosedIcon className="h-4 w-4" />
                                                            : <LockOpenIcon className="h-4 w-4" />
                                                        }
                                                    </button>

                                                    {/* Manage Plan */}
                                                    <button
                                                        onClick={() => setPlanModal({ userId: user.id, email: user.email, planType: user.plan_type || 'trial', extendDays: '' })}
                                                        title="Manage Plan"
                                                        className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-100 transition-colors"
                                                    >
                                                        <CurrencyDollarIcon className="h-4 w-4" />
                                                    </button>

                                                    {/* Assign Plan */}
                                                    <button
                                                        onClick={() => openAssignPlan(user)}
                                                        title="Assign Plan"
                                                        className="p-2 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 rounded-lg hover:bg-teal-100 transition-colors"
                                                    >
                                                        <ClipboardDocumentCheckIcon className="h-4 w-4" />
                                                    </button>

                                                    {/* Add Credits */}
                                                    <button
                                                        onClick={() => setCreditModal({ userId: user.id, email: user.email })}
                                                        title="Add Credits"
                                                        className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 transition-colors"
                                                    >
                                                        <PlusCircleIcon className="h-4 w-4" />
                                                    </button>

                                                    {/* Login as User */}
                                                    <button
                                                        onClick={() => handleImpersonate(user)}
                                                        title="Login as this user"
                                                        className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-100 transition-colors"
                                                    >
                                                        <EyeIcon className="h-4 w-4" />
                                                    </button>

                                                    {/* View Details */}
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
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Page {pagination.page} of {pagination.totalPages}
                            </p>
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

            {/* Manage Plan Modal */}
            {planModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">Manage Plan</h3>
                        <p className="text-sm text-slate-500 mb-6">User: <strong>{planModal.email}</strong></p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">
                                    Plan Type
                                </label>
                                <select
                                    value={planModal.planType}
                                    onChange={(e) => setPlanModal({ ...planModal, planType: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-bold text-sm outline-none focus:ring-2 focus:ring-primary/40"
                                >
                                    <option value="trial">Trial</option>
                                    <option value="paid">Paid</option>
                                    <option value="enterprise">Enterprise</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">
                                    Extend Validity (Days)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={planModal.extendDays}
                                    onChange={(e) => setPlanModal({ ...planModal, extendDays: e.target.value })}
                                    placeholder="Leave blank to not extend"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-bold text-sm outline-none focus:ring-2 focus:ring-primary/40"
                                />
                                <p className="text-[10px] text-slate-500 mt-1">If blank, only plan type is updated.</p>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={handleUpdatePlan}
                                disabled={planLoading}
                                className="flex-1 py-3 bg-purple-600 text-white rounded-2xl font-black text-sm hover:bg-purple-700 disabled:opacity-50 transition-all shadow-lg shadow-purple-600/20"
                            >
                                {planLoading ? 'Updating...' : 'Confirm Update'}
                            </button>
                            <button
                                onClick={() => setPlanModal(null)}
                                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl font-black text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Credits Modal */}
            {creditModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">Add Credits</h3>
                        <p className="text-sm text-slate-500 mb-6">User: <strong>{creditModal.email}</strong></p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">
                                    Amount (INR → Credits)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={creditAmount}
                                    onChange={(e) => setCreditAmount(e.target.value)}
                                    placeholder="e.g. 500"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-primary/40 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">
                                    Description (optional)
                                </label>
                                <input
                                    type="text"
                                    value={creditDesc}
                                    onChange={(e) => setCreditDesc(e.target.value)}
                                    placeholder="Reason / notes..."
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-bold text-sm focus:ring-2 focus:ring-primary/40 outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={handleAddCredits}
                                disabled={creditLoading || !creditAmount || parseFloat(creditAmount) <= 0}
                                className="flex-1 py-3 bg-primary text-white rounded-2xl font-black text-sm hover:bg-primary/90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
                            >
                                {creditLoading ? 'Adding...' : 'Confirm & Add'}
                            </button>
                            <button
                                onClick={() => { setCreditModal(null); setCreditAmount(''); setCreditDesc(''); }}
                                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl font-black text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Assign Plan Modal */}
            {assignModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">Assign Plan</h3>
                        <p className="text-sm text-slate-500 mb-6">
                            User: <strong className="text-slate-800 dark:text-white">{assignModal.email}</strong>
                        </p>

                        {plansLoading ? (
                            <div className="py-8 text-center text-slate-400 text-sm font-bold">Loading plans...</div>
                        ) : availablePlans.length === 0 ? (
                            <div className="py-8 text-center">
                                <p className="text-slate-400 text-sm font-bold mb-3">No plans found</p>
                                <p className="text-xs text-slate-500">Create plans in the Plans section first.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">
                                        Select Plan
                                    </label>
                                    <select
                                        id="assign-plan-select"
                                        value={selectedPlanId}
                                        onChange={(e) => setSelectedPlanId(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-bold text-sm outline-none focus:ring-2 focus:ring-teal-400/40 transition-all"
                                    >
                                        <option value="">— Choose a plan —</option>
                                        {availablePlans.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.plan_name} — {p.credit_limit.toLocaleString()} CR / {p.validity_days} days
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Show selected plan details */}
                                {selectedPlanId && (() => {
                                    const selected = availablePlans.find(p => p.id === selectedPlanId);
                                    if (!selected) return null;
                                    return (
                                        <div className="p-4 bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800/30 rounded-2xl">
                                            <p className="text-xs font-black text-teal-700 dark:text-teal-400 uppercase tracking-widest mb-2">Plan Summary</p>
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-600 dark:text-slate-400">Credits Added</span>
                                                    <span className="font-black text-emerald-600 dark:text-emerald-400">{selected.credit_limit.toLocaleString()} CR</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-slate-600 dark:text-slate-400">Valid For</span>
                                                    <span className="font-black text-blue-600 dark:text-blue-400">{selected.validity_days} days</span>
                                                </div>
                                                {selected.plan_type && (
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-slate-600 dark:text-slate-400">Type</span>
                                                        <span className="font-black text-purple-600 dark:text-purple-400 capitalize">{selected.plan_type}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        <div className="flex gap-3 mt-8">
                            <button
                                id="confirm-assign-plan-btn"
                                onClick={handleAssignPlan}
                                disabled={assignLoading || !selectedPlanId || plansLoading}
                                className="flex-1 py-3 bg-teal-600 text-white rounded-2xl font-black text-sm hover:bg-teal-700 disabled:opacity-50 transition-all shadow-lg shadow-teal-600/20"
                            >
                                {assignLoading ? 'Applying...' : 'Apply Plan'}
                            </button>
                            <button
                                onClick={() => setAssignModal(null)}
                                disabled={assignLoading}
                                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl font-black text-sm hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
};

export default AdminUsersPage;
