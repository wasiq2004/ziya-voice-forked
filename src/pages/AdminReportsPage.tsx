import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import KPICard from '../components/KPICard';
import {
    ArrowDownTrayIcon,
    UsersIcon,
    UserGroupIcon,
    ShieldExclamationIcon,
    ChartPieIcon,
    RocketLaunchIcon,
    CurrencyDollarIcon,
} from '@heroicons/react/24/outline';
import { getUsers, UserListItem } from '../utils/adminApi';

const AdminReportsPage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalUsers: 0,
        activeUsers: 0,
        totalAgents: 0,
        activeAgents: 0,
        suspendedUsers: 0,
        avgAgentsPerUser: '0.0',
        totalCampaigns: 0,
        totalCreditsUsed: 0,
    });
    const [userReports, setUserReports] = useState<UserListItem[]>([]);

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
        fetchData();
    }, [navigate]);

    const fetchAllUsers = async () => {
        const pageSize = 100;
        let page = 1;
        let allUsers: UserListItem[] = [];
        let totalPages = 1;

        do {
            const { users, pagination } = await getUsers(page, pageSize);
            allUsers = [...allUsers, ...(users as UserListItem[])];
            totalPages = pagination?.totalPages || 1;
            page += 1;
        } while (page <= totalPages);

        return allUsers;
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const users = await fetchAllUsers();

            const totalUsers = users.length;
            const activeUsers = users.filter((user) => user.status === 'active').length;
            const suspendedUsers = users.filter((user) => user.status === 'locked' || user.status === 'inactive').length;
            const totalAgents = users.reduce((sum, user) => sum + Number(user.agents_count || 0), 0);
            const activeAgents = users.reduce((sum, user) => sum + Number(user.active_agents_count || 0), 0);
            const totalCampaigns = users.reduce((sum, user) => sum + Number(user.campaigns_count || 0), 0);
            const totalCreditsUsed = users.reduce((sum, user) => sum + Number(user.credits_used || 0), 0);

            setStats({
                totalUsers,
                activeUsers,
                totalAgents,
                activeAgents,
                suspendedUsers,
                avgAgentsPerUser: totalUsers > 0 ? (totalAgents / totalUsers).toFixed(1) : '0.0',
                totalCampaigns,
                totalCreditsUsed,
            });

            setUserReports(users);
        } catch (err: any) {
            console.error('Error fetching report data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = () => {
        if (userReports.length === 0) return;
        const headers = ['User ID', 'Username', 'Email', 'Joined Date', 'Total Agents', 'Active Agents', 'Campaigns Run', 'Credits Used', 'Credits Balance', 'Status'];
        const csvRows = [
            headers.join(','),
            ...userReports.map((report) => [
                report.id,
                `"${report.username || ''}"`,
                `"${report.email || ''}"`,
                report.created_at ? new Date(report.created_at).toLocaleDateString() : '',
                Number(report.agents_count || 0),
                Number(report.active_agents_count || 0),
                Number(report.campaigns_count || 0),
                Number(report.credits_used || 0),
                Number(report.credits_balance || 0),
                (report.status || '').toUpperCase()
            ].join(','))
        ];
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'User_Intelligence_Report_Detailed.csv';
        a.click();
    };

    return (
        <AppLayout
            breadcrumbs={[
                { label: 'Admin', path: '/admin/dashboard' },
                { label: 'User Reports Data' }
            ]}
            pageTitle="User Intelligence Reports"
            pageDescription="Live organization reporting for users, agents, campaigns, and credit consumption."
            primaryAction={
                <button
                    onClick={handleExportCSV}
                    className="flex items-center space-x-2 bg-slate-900 dark:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-lg"
                >
                    <ArrowDownTrayIcon className="h-4 w-4 stroke-2" />
                    <span>Export User Data</span>
                </button>
            }
        >
            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                    <KPICard title="Total Users" value={stats.totalUsers} icon={<UsersIcon className="w-5 h-5" />} color="blue" />
                    <KPICard title="Active Users" value={stats.activeUsers} icon={<UsersIcon className="w-5 h-5" />} color="green" />
                    <KPICard title="Total Agents Created" value={stats.totalAgents} icon={<UserGroupIcon className="w-5 h-5" />} color="purple" />
                    <KPICard title="Active Agents" value={stats.activeAgents} icon={<UserGroupIcon className="w-5 h-5" />} color="green" />
                    <KPICard title="Avg Agents/User" value={stats.avgAgentsPerUser} icon={<ChartPieIcon className="w-5 h-5" />} color="gray" />
                    <KPICard title="Campaigns Dispatched" value={stats.totalCampaigns} icon={<RocketLaunchIcon className="w-5 h-5" />} color="blue" />
                    <KPICard title="Credits Used" value={stats.totalCreditsUsed.toLocaleString()} icon={<CurrencyDollarIcon className="w-5 h-5" />} color="red" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-slate-800/50 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-6">Agent Deployment Status</h3>
                        <div className="space-y-5">
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-2">
                                    <span className="text-slate-500">Active Agents</span>
                                    <span className="text-emerald-500">{stats.activeAgents} Agents</span>
                                </div>
                                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-emerald-400 to-green-500 rounded-full transition-all duration-1000"
                                        style={{ width: `${stats.totalAgents > 0 ? (stats.activeAgents / stats.totalAgents) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-2">
                                    <span className="text-slate-500">Idle / Standby</span>
                                    <span className="text-amber-500">{Math.max(stats.totalAgents - stats.activeAgents, 0)} Agents</span>
                                </div>
                                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-1000"
                                        style={{ width: `${stats.totalAgents > 0 ? ((stats.totalAgents - stats.activeAgents) / stats.totalAgents) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-2">
                                    <span className="text-slate-500">Inactive / Suspended Users</span>
                                    <span className="text-red-500">{stats.suspendedUsers} Users</span>
                                </div>
                                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-rose-400 to-red-500 rounded-full transition-all duration-1000"
                                        style={{ width: `${stats.totalUsers > 0 ? (stats.suspendedUsers / stats.totalUsers) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800/50 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6 shadow-sm lg:col-span-2 flex flex-col">
                        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest mb-4">Detailed User Asset Report</h3>
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-700">
                                        <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">System User</th>
                                        <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Agents (Active/Total)</th>
                                        <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Total Campaigns</th>
                                        <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Cr. Used</th>
                                        <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Cr. Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                    {userReports.map((row) => (
                                        <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                                            <td className="py-3">
                                                <p className="text-sm font-bold text-slate-800 dark:text-white">{row.username || '-'}</p>
                                                <p className="text-[10px] text-slate-400 font-bold">{row.email}</p>
                                                <p className="text-[10px] text-slate-400 font-mono">ID: {row.id}</p>
                                            </td>
                                            <td className="py-3 text-center">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                    {Number(row.active_agents_count || 0)} <span className="text-slate-400 font-medium">/ {Number(row.agents_count || 0)}</span>
                                                </span>
                                            </td>
                                            <td className="py-3 text-center text-sm font-bold text-slate-600 dark:text-slate-300">
                                                {Number(row.campaigns_count || 0)}
                                            </td>
                                            <td className="py-3 text-right">
                                                <span className="text-sm font-black text-slate-800 dark:text-white">{Number(row.credits_used || 0).toLocaleString()}</span>
                                                <span className="text-[10px] font-black text-slate-400 ml-1">CR</span>
                                            </td>
                                            <td className="py-3 text-right">
                                                <span className="text-sm font-black text-slate-800 dark:text-white">{Number(row.credits_balance || 0).toLocaleString()}</span>
                                                <span className="text-[10px] font-black text-slate-400 ml-1">CR</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {userReports.length === 0 && !loading && (
                                <div className="text-center py-8 text-xs font-black text-slate-400 uppercase">
                                    No organization users mapped yet.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};

export default AdminReportsPage;
