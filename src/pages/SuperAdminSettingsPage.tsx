import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import {
    CogIcon,
    ShieldCheckIcon,
    KeyIcon,
    GlobeAltIcon,
    CheckCircleIcon,
    ArrowPathIcon,
    CpuChipIcon,
} from '@heroicons/react/24/outline';
import { getApiBaseUrl, getApiPath } from '../utils/api';

type Tab = 'general' | 'api_keys';

const SuperAdminSettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>('general');
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [settingsLoading, setSettingsLoading] = useState(true);

    const [general, setGeneral] = useState({
        platformName: 'Ziya Voice',
        supportEmail: 'support@ziyavoice.com',
        maintenanceMode: false,
    });

    const [providerKeys, setProviderKeys] = useState({
        elevenLabs: '',
        sarvam: '',
        gemini: '',
    });

    useEffect(() => {
        const userStr = localStorage.getItem('ziya-user');
        if (!userStr || JSON.parse(userStr).role !== 'super_admin') { navigate('/login'); return; }
        fetchSettings();
    }, [navigate]);

    const fetchSettings = async () => {
        setSettingsLoading(true);
        try {
            const API = getApiBaseUrl();
            const res = await fetch(`${API}${getApiPath()}/superadmin/settings`);
            if (!res.ok) throw new Error('Failed to load settings');
            const data = await res.json();
            const s = data.settings || {};
            setGeneral({
                platformName: s.platform_name || 'Ziya Voice',
                supportEmail: s.support_email || 'support@ziyavoice.com',
                maintenanceMode: s.maintenance_mode === '1',
            });
            setProviderKeys({
                elevenLabs: s.elevenlabs_api_key || '',
                sarvam: s.sarvam_api_key || '',
                gemini: s.gemini_api_key || '',
            });
        } catch (err) {
            console.error('Failed to fetch settings:', err);
        } finally {
            setSettingsLoading(false);
        }
    };

    const saveSettings = async (section: string, payload: Record<string, string>) => {
        setSaving(true);
        setError('');
        try {
            const API = getApiBaseUrl();
            const res = await fetch(`${API}${getApiPath()}/superadmin/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: payload }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.message || 'Save failed');
            setSuccess(`${section} settings updated successfully!`);
            setTimeout(() => setSuccess(''), 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to save settings');
            setTimeout(() => setError(''), 4000);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveGeneral = () => saveSettings('General', {
        platform_name: general.platformName,
        support_email: general.supportEmail,
        maintenance_mode: general.maintenanceMode ? '1' : '0',
    });

    const handleSaveApiKeys = () => saveSettings('Provider APIs', {
        elevenlabs_api_key: providerKeys.elevenLabs,
        sarvam_api_key: providerKeys.sarvam,
        gemini_api_key: providerKeys.gemini,
    });

    const tabs = [
        { id: 'general' as const, label: 'Global Platform', icon: GlobeAltIcon, desc: 'Core platform identity' },
        { id: 'api_keys' as const, label: 'Provider APIs', icon: KeyIcon, desc: 'Master API credentials' },
    ];

    return (
        <AppLayout
            breadcrumbs={[
                { label: 'Super Admin', path: '/superadmin/dashboard' },
                { label: 'System Settings' }
            ]}
            pageTitle="System Settings"
            pageDescription="Centralized control panel for system-wide parameters, API integrations, and security."
        >
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Vertical Tabs Sidebar */}
                <div className="w-full md:w-72 space-y-2 shrink-0">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-4 mb-4">Configuration Areas</h3>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as Tab)}
                            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all text-left ${
                                activeTab === tab.id 
                                ? 'bg-indigo-600 shadow-lg shadow-indigo-600/20 text-white' 
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                        >
                            <tab.icon className={`w-6 h-6 ${activeTab === tab.id ? 'text-indigo-200' : 'text-slate-400'}`} />
                            <div>
                                <h4 className={`text-sm font-bold ${activeTab === tab.id ? 'text-white' : 'text-slate-800 dark:text-white'}`}>{tab.label}</h4>
                                <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${activeTab === tab.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                                    {tab.desc}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1">
                    {success && (
                        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-2xl text-emerald-700 dark:text-emerald-400 text-sm font-bold flex items-center gap-2 animate-in slide-in-from-top-2">
                            <CheckCircleIcon className="w-5 h-5" />
                            {success}
                        </div>
                    )}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl text-red-700 dark:text-red-400 text-sm font-bold animate-in slide-in-from-top-2">
                            {error}
                        </div>
                    )}

                    <div className="bg-white dark:bg-slate-800/50 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[500px]">
                        
                        {/* GENERAL SETTINGS */}
                        {activeTab === 'general' && (
                            <div className="animate-in fade-in duration-300">
                                <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                                    <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                                        <GlobeAltIcon className="w-6 h-6 text-indigo-500" />
                                        Global Platform
                                    </h2>
                                    <p className="text-sm text-slate-500 font-medium mt-1">Configure the root identity of the SaaS platform.</p>
                                </div>
                                <div className="p-8 space-y-6">
                                    <div className="grid grid-cols-1 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Master Platform Name</label>
                                            <input 
                                                type="text" 
                                                value={general.platformName}
                                                onChange={e => setGeneral({...general, platformName: e.target.value})}
                                                className="w-full max-w-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-3 text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Global Support Email</label>
                                            <input 
                                                type="email" 
                                                value={general.supportEmail}
                                                onChange={e => setGeneral({...general, supportEmail: e.target.value})}
                                                className="w-full max-w-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-3 text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                            />
                                        </div>
                                        <div className="max-w-lg flex items-center justify-between p-5 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                                            <div>
                                                <p className="text-sm font-black text-amber-600 uppercase tracking-tight flex items-center gap-2">
                                                    <ShieldCheckIcon className="w-4 h-4" />
                                                    Maintenance Mode
                                                </p>
                                                <p className="text-[10px] text-amber-700/60 font-medium mt-1">Suspends all tenant portals. API remains active for queued tasks.</p>
                                            </div>
                                            <button 
                                                onClick={() => setGeneral({...general, maintenanceMode: !general.maintenanceMode})}
                                                className={`w-14 h-7 rounded-full transition-all relative ${general.maintenanceMode ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                                            >
                                                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${general.maintenanceMode ? 'left-8' : 'left-1'}`} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                                        <button 
                                            onClick={handleSaveGeneral}
                                            disabled={saving || settingsLoading}
                                            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {saving ? 'Applying...' : 'Save Global Identity'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* API KEYS */}
                        {activeTab === 'api_keys' && (
                            <div className="animate-in fade-in duration-300">
                                <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                                    <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                                        <KeyIcon className="w-6 h-6 text-violet-500" />
                                        Master API Credentials
                                    </h2>
                                    <p className="text-sm text-slate-500 font-medium mt-1">Configure master API keys for ElevenLabs (TTS), Sarvam (STT), and Gemini (LLM). These override .env values.</p>
                                </div>
                                <div className="p-8 space-y-6">
                                    <div className="space-y-6 max-w-xl">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ElevenLabs API Key (TTS)</label>
                                            <input 
                                                type="password" 
                                                value={providerKeys.elevenLabs}
                                                onChange={e => setProviderKeys({...providerKeys, elevenLabs: e.target.value})}
                                                placeholder="sk-[your-elevenlabs-key]"
                                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-3 text-sm font-mono text-slate-800 dark:text-white focus:ring-2 focus:ring-violet-500/20 outline-none transition-all"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sarvam API Key (STT)</label>
                                            <input 
                                                type="password" 
                                                value={providerKeys.sarvam}
                                                onChange={e => setProviderKeys({...providerKeys, sarvam: e.target.value})}
                                                placeholder="sk_[your-sarvam-key]"
                                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-3 text-sm font-mono text-slate-800 dark:text-white focus:ring-2 focus:ring-violet-500/20 outline-none transition-all"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gemini API Key (LLM)</label>
                                            <input 
                                                type="password" 
                                                value={providerKeys.gemini}
                                                onChange={e => setProviderKeys({...providerKeys, gemini: e.target.value})}
                                                placeholder="AIza[your-gemini-key]"
                                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-3 text-sm font-mono text-slate-800 dark:text-white focus:ring-2 focus:ring-violet-500/20 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="p-5 bg-violet-50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-900/30 rounded-2xl max-w-xl">
                                        <p className="text-xs text-violet-700 dark:text-violet-400 font-bold leading-relaxed flex items-start gap-3">
                                            <CpuChipIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                            These keys will be saved to the system and override environment variables. Changes take effect immediately.
                                        </p>
                                    </div>
                                    <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                                        <button 
                                            onClick={handleSaveApiKeys}
                                            disabled={saving || settingsLoading}
                                            className="px-8 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-violet-600/20 transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {saving ? 'Updating Keys...' : 'Save API Keys'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </AppLayout>
    );
};

export default SuperAdminSettingsPage;
