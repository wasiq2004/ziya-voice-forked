import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import Skeleton from '../components/Skeleton';
import { getSuperAdminStats } from '../utils/superAdminApi';
import {
    BuildingOfficeIcon,
    UsersIcon,
    UserGroupIcon,
    CircleStackIcon,
    ArrowPathIcon,
    ChartBarIcon,
    ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';

const SuperAdminDashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        // Verify super admin access
        const userStr = localStorage.getItem('ziya-user');
        if (!userStr) { navigate('/login'); return; }
        const user = JSON.parse(userStr);
        if (user.role !== 'super_admin') { navigate('/login'); return; }
        fetchStats();
    }, [navigate]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const data = await getSuperAdminStats();
            setStats(data.stats || data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const kpiCards = [
        {
            label: 'Total Organizations',
            value: stats?.totalOrganizations ?? 0,
            icon: BuildingOfficeIcon,
            gradient: 'from-violet-500 to-purple-700',
            glow: 'shadow-violet-500/30',
            link: '/superadmin/organizations',
        },
        {
            label: 'Organization Admins',
            value: stats?.totalOrgAdmins ?? 0,
            icon: UserGroupIcon,
            gradient: 'from-blue-500 to-indigo-700',
            glow: 'shadow-blue-500/30',
            link: '/superadmin/org-admins',
        },
        {
            label: 'Total Users',
            value: stats?.totalUsers ?? 0,
            icon: UsersIcon,
            gradient: 'from-emerald-500 to-teal-700',
            glow: 'shadow-emerald-500/30',
            link: '/superadmin/users',
        },
        {
            label: 'Total Credits Used',
            value: stats?.totalCreditsUsed ?? 0,
            icon: CircleStackIcon,
            gradient: 'from-amber-500 to-orange-600',
            glow: 'shadow-amber-500/30',
            link: '/superadmin/analytics',
            suffix: ' CR',
        },
    ];

    const quickActions = [
        { label: 'Create Organization', desc: 'Set up a new tenant organization', path: '/superadmin/organizations', icon: BuildingOfficeIcon, color: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400' },
        { label: 'Add Org Admin', desc: 'Assign an admin to an organization', path: '/superadmin/org-admins', icon: UserGroupIcon, color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400' },
        { label: 'Manage Users', desc: 'View and manage all platform users', path: '/superadmin/users', icon: UsersIcon, color: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400' },
        { label: 'Platform Analytics', desc: 'Usage metrics and credit analytics', path: '/superadmin/analytics', icon: ChartBarIcon, color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400' },
    ];

    const userStr = localStorage.getItem('ziya-user');
    const userData = userStr ? JSON.parse(userStr) : null;

    return (
        <AppLayout
            breadcrumbs={[{ label: 'Super Admin', path: '/superadmin/dashboard' }, { label: 'Dashboard' }]}
            pageTitle="Super Admin Dashboard"
            pageDescription={`Platform-wide control center. Welcome, ${userData?.username || userData?.email || 'Super Admin'}`}
            primaryAction={
                <button
                    onClick={fetchStats}
                    className="flex items-center px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl transition-all font-bold text-sm shadow-sm"
                >
                    <ArrowPathIcon className="w-4 h-4 mr-2" />
                    Refresh
                </button>
            }
        >
            <div className="space-y-8 animate-in fade-in duration-500">
                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl text-red-700 dark:text-red-400 text-sm font-medium">
                        {error}
                    </div>
                )}

                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {kpiCards.map((card) => (
                        <button
                            key={card.label}
                            onClick={() => navigate(card.link)}
                            className={`group bg-gradient-to-br ${card.gradient} rounded-3xl p-6 text-white shadow-xl ${card.glow} relative overflow-hidden hover:scale-[1.02] transition-transform text-left`}
                        >
                            <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-4 opacity-80">
                                    <span className="text-[10px] font-black uppercase tracking-widest">{card.label}</span>
                                    <card.icon className="h-5 w-5" />
                                </div>
                                {loading ? (
                                    <div className="h-8 w-20 bg-white/20 rounded animate-pulse" />
                                ) : (
                                    <p className="text-3xl font-black">
                                        {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
                                        {card.suffix || ''}
                                    </p>
                                )}
                                <p className="text-[10px] opacity-60 font-bold mt-1 uppercase tracking-wider">Click to manage</p>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Hierarchy Visualization */}
                <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                    <div className="flex items-center gap-3 mb-6">
                        <ArrowTrendingUpIcon className="w-5 h-5 text-violet-500" />
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white">Platform Hierarchy</h2>
                    </div>
                    <div className="flex flex-col items-center gap-3">
                        {/* Super Admin */}
                        <div className="bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-2xl px-8 py-3 font-black text-sm shadow-lg shadow-violet-500/30 flex items-center gap-2">
                            <UserGroupIcon className="w-4 h-4" />
                            Super Admin (You)
                        </div>
                        <div className="w-px h-6 bg-slate-300 dark:bg-slate-600" />
                        {/* Organizations */}
                        <div className="flex items-center gap-8">
                            {loading ? (
                                <div className="h-10 w-40 bg-slate-100 dark:bg-slate-700 rounded-2xl animate-pulse" />
                            ) : (
                                stats?.orgBreakdown?.slice(0, 3).map((org: any, i: number) => (
                                    <div key={i} className="flex flex-col items-center gap-2">
                                        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-2xl px-5 py-2 font-bold text-sm flex items-center gap-2">
                                            <BuildingOfficeIcon className="w-4 h-4" />
                                            {org.name}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-semibold">{org.user_count || 0} users</div>
                                    </div>
                                ))
                            )}
                            {!loading && stats?.totalOrganizations > 3 && (
                                <div className="text-slate-400 text-sm font-bold">+{stats.totalOrganizations - 3} more</div>
                            )}
                            {!loading && (!stats?.orgBreakdown || stats.orgBreakdown.length === 0) && (
                                <div className="text-slate-400 text-sm italic">No organizations yet. Create one to get started.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {quickActions.map((action) => (
                            <button
                                key={action.label}
                                onClick={() => navigate(action.path)}
                                className={`flex flex-col items-start p-5 border rounded-2xl transition-all hover:shadow-md group ${action.color}`}
                            >
                                <action.icon className="w-6 h-6 mb-3 group-hover:scale-110 transition-transform" />
                                <p className="font-black text-sm mb-1">{action.label}</p>
                                <p className="text-xs opacity-70 font-medium text-left">{action.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};

export default SuperAdminDashboardPage;
