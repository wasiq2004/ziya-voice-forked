import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import Skeleton from '../components/Skeleton';
import {
    ArrowPathIcon,
    CircleStackIcon,
    CloudIcon,
    CpuChipIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    SparklesIcon,
    SpeakerWaveIcon,
} from '@heroicons/react/24/outline';
import { getSuperAdminIntegrationBalances } from '../utils/superAdminApi';
import { SuperAdminIntegrationBalance } from '../types';

const statusStyles: Record<string, { badge: string; dot: string; accent: string }> = {
    active: {
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
        dot: 'bg-emerald-500',
        accent: 'from-emerald-500 to-teal-500',
    },
    missing: {
        badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
        dot: 'bg-amber-500',
        accent: 'from-amber-500 to-orange-500',
    },
    warning: {
        badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
        dot: 'bg-amber-500',
        accent: 'from-amber-500 to-orange-500',
    },
    unavailable: {
        badge: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800',
        dot: 'bg-slate-400',
        accent: 'from-slate-500 to-slate-700',
    },
    error: {
        badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
        dot: 'bg-red-500',
        accent: 'from-red-500 to-rose-500',
    },
};

const iconMap: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
    elevenlabs: SpeakerWaveIcon,
    gemini: SparklesIcon,
    deepgram: CloudIcon,
    sarvam: CpuChipIcon,
    openai: CircleStackIcon,
};

const formatValue = (balance: number | null, unit?: string | null) => {
    if (balance === null || balance === undefined) return 'Balance unavailable';
    const value = new Intl.NumberFormat('en-US').format(balance);
    return unit ? `${value} ${unit}` : value;
};

const SuperAdminIntegrationsPage: React.FC = () => {
    const navigate = useNavigate();
    const [integrations, setIntegrations] = useState<SuperAdminIntegrationBalance[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [refreshedAt, setRefreshedAt] = useState('');

    useEffect(() => {
        const userStr = localStorage.getItem('ziya-user');
        if (!userStr || JSON.parse(userStr).role !== 'super_admin') {
            navigate('/login');
            return;
        }

        fetchIntegrations();
        const interval = window.setInterval(fetchIntegrations, 60000);
        return () => window.clearInterval(interval);
    }, [navigate]);

    const fetchIntegrations = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await getSuperAdminIntegrationBalances();
            setIntegrations(data.integrations || []);
            setRefreshedAt(data.refreshedAt || new Date().toISOString());
        } catch (err: any) {
            setError(err.message || 'Failed to load integration balances');
        } finally {
            setLoading(false);
        }
    };

    const summary = useMemo(() => {
        const live = integrations.filter((item) => typeof item.balance === 'number');
        const configured = integrations.filter((item) => item.status === 'active').length;
        const missing = integrations.filter((item) => item.status === 'missing').length;
        const totalBalance = live.reduce((sum, item) => sum + (item.balance || 0), 0);

        return {
            liveCount: live.length,
            configured,
            missing,
            totalBalance,
        };
    }, [integrations]);

    return (
        <AppLayout
            breadcrumbs={[
                { label: 'Super Admin', path: '/superadmin/dashboard' },
                { label: '3rd Party Integrations' },
            ]}
            pageTitle="3rd Party Integrations"
            pageDescription="Live provider balances and integration status for the services powering the platform."
            primaryAction={
                <button
                    onClick={fetchIntegrations}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Live balances</p>
                        <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{summary.liveCount}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">Providers exposing a real balance</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Configured</p>
                        <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{summary.configured}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">Providers connected in env or dashboard</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Missing</p>
                        <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{summary.missing}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">Providers waiting on API keys</p>
                    </div>
                    <div className="bg-gradient-to-br from-slate-900 to-slate-700 rounded-3xl border border-slate-800 p-5 shadow-lg shadow-slate-900/20">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Total live balance</p>
                        <p className="mt-2 text-3xl font-black text-white">{new Intl.NumberFormat('en-US').format(summary.totalBalance)}</p>
                        <p className="mt-1 text-xs font-bold text-slate-300">Across integrations that expose a balance API</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800/50 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl">
                                <SparklesIcon className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">3rd Party Integrations</h2>
                                <p className="text-xs text-slate-500 font-medium mt-1">
                                    Last synced {refreshedAt ? new Date(refreshedAt).toLocaleString() : 'just now'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                            Live data only
                        </div>
                    </div>

                    <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {loading
                            ? [...Array(4)].map((_, index) => (
                                <Skeleton key={index} height={180} className="rounded-[1.5rem]" />
                            ))
                            : integrations.map((integration) => {
                                const style = statusStyles[integration.status] || statusStyles.unavailable;
                                const Icon = iconMap[integration.key] || CircleStackIcon;
                                const hasProjects = Array.isArray(integration.projects) && integration.projects.length > 0;

                                return (
                                    <div
                                        key={integration.key}
                                        className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40 p-5"
                                    >
                                        <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${style.accent}`} />
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${style.accent} flex items-center justify-center text-white shadow-lg`}>
                                                    <Icon className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className="text-base font-black text-slate-900 dark:text-white">{integration.name}</h3>
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{integration.key}</p>
                                                </div>
                                            </div>

                                            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${style.badge}`}>
                                                <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                                                {integration.status}
                                            </span>
                                        </div>

                                        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="rounded-2xl bg-white/80 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 p-4">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{integration.balanceLabel}</p>
                                                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                                                    {formatValue(integration.balance, integration.unit)}
                                                </p>
                                                <p className="mt-1 text-xs font-medium text-slate-500">{integration.note}</p>
                                            </div>

                                            <div className="rounded-2xl bg-white/80 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800 p-4">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Source</p>
                                                <p className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-300 break-words">
                                                    {integration.source || 'Platform configuration'}
                                                </p>
                                                <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Last checked</p>
                                                <p className="mt-1 text-xs font-bold text-slate-500">
                                                    {integration.lastChecked ? new Date(integration.lastChecked).toLocaleString() : 'just now'}
                                                </p>
                                            </div>
                                        </div>

                                        {hasProjects && (
                                            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-950/40 p-4">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Project balances</p>
                                                <div className="space-y-2">
                                                    {integration.projects!.map((project) => (
                                                        <div key={project.project_id} className="flex items-center justify-between gap-3">
                                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{project.project_name}</span>
                                                            <span className="text-sm font-black text-slate-900 dark:text-white">
                                                                {new Intl.NumberFormat('en-US').format(project.balance)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                    </div>

                    {!loading && integrations.length === 0 && (
                        <div className="p-10 text-center">
                            <ExclamationTriangleIcon className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
                            <p className="mt-4 text-sm font-bold text-slate-500">No integration data found.</p>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
};

export default SuperAdminIntegrationsPage;
