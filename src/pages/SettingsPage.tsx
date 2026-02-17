import React, { useState } from 'react';
import AppLayout from '../components/AppLayout';
import { AppSettings } from '../types';
import {
    Cog6ToothIcon,
    UserIcon,
    LanguageIcon,
    SpeakerWaveIcon,
    MoonIcon,
    SunIcon,
    CheckIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface SettingsPageProps { }

// Helper to safely get saved settings from localStorage
const getSavedSettings = () => {
    try {
        const saved = localStorage.getItem('ziyaAgentSettings');
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (error) {
        console.error("Failed to parse settings from localStorage", error);
    }
    return null;
};


const SettingsPage: React.FC<SettingsPageProps> = () => {
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [settings, setSettings] = useState<AppSettings>(() => {
        const savedSettings = getSavedSettings();
        return {
            agentName: savedSettings?.agentName || 'Ziya',
            language: savedSettings?.language || 'English (US)',
            voiceType: savedSettings?.voiceType || 'Male',
        };
    });

    const [saveStatus, setSaveStatus] = useState('');

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleRadioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSettings(prev => ({ ...prev, voiceType: e.target.value }));
    }

    const handleSaveSettings = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        try {
            localStorage.setItem('ziyaAgentSettings', JSON.stringify(settings));
            setSaveStatus('✅ Settings saved successfully!');
            setTimeout(() => setSaveStatus(''), 3000); // Hide message after 3 seconds
        } catch (error) {
            console.error("Failed to save settings to localStorage", error);
            setSaveStatus('❌ Failed to save settings.');
            setTimeout(() => setSaveStatus(''), 3000);
        }
    };

    return (
        <AppLayout
            breadcrumbs={[
                { label: 'Dashboard', path: '/dashboard' },
                { label: 'Settings' }
            ]}
            pageTitle="Settings"
            pageDescription="Manage your workspace preferences and application settings."
            primaryAction={
                <button
                    form="settings-form"
                    type="submit"
                    className="flex items-center px-6 py-2.5 rounded-xl bg-primary text-white font-black text-sm shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all group"
                >
                    <CheckIcon className="h-4 w-4 mr-2" />
                    Save Preferences
                </button>
            }
        >
            <div className="max-w-4xl space-y-8 animate-in fade-in duration-500">
                {saveStatus && (
                    <div className={`p-4 rounded-2xl flex items-center justify-between shadow-sm border animate-in slide-in-from-top-2 ${saveStatus.includes('✅')
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-400'
                        }`}>
                        <div className="flex items-center">
                            <span className="mr-3 font-bold">{saveStatus.split(' ')[0]}</span>
                            <span className="text-sm font-bold">{saveStatus.split(' ').slice(1).join(' ')}</span>
                        </div>
                        <button onClick={() => setSaveStatus('')} className="p-1 hover:bg-black/5 rounded-lg transition-colors">
                            <CheckIcon className="h-4 w-4" />
                        </button>
                    </div>
                )}

                <form id="settings-form" onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Navigation Sidebar */}
                    <div className="space-y-4">
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-3xl p-3 shadow-sm">
                            {[
                                { id: 'general', label: 'General Preferences', icon: Cog6ToothIcon, active: true },
                                { id: 'account', label: 'Account Details', icon: UserIcon, active: false },
                                { id: 'security', label: 'Security & Access', icon: ArrowPathIcon, active: false }
                            ].map(item => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${item.active
                                        ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                        : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    <item.icon className="h-5 w-5" />
                                    {item.label}
                                </button>
                            ))}
                        </div>

                        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800/50">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Workspace Insight</h4>
                            <p className="text-xs text-slate-500 leading-relaxed italic">
                                Customize your agent behavior and platform aesthetics to match your brand identity.
                            </p>
                        </div>
                    </div>

                    {/* Main Content Areas */}
                    <div className="md:col-span-2 space-y-6">
                        {/* Profile Section */}
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden transition-all hover:shadow-md">
                            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Global Identity</h3>
                                <UserIcon className="h-5 w-5 text-slate-300" />
                            </div>
                            <div className="p-8 space-y-6">
                                <div>
                                    <label htmlFor="agentName" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Preferred Agent Name</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                                            <UserIcon className="h-5 w-5" />
                                        </div>
                                        <input
                                            type="text"
                                            name="agentName"
                                            id="agentName"
                                            value={settings.agentName}
                                            onChange={handleInputChange}
                                            className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all font-bold text-slate-900 dark:text-white"
                                            placeholder="System Agent Name"
                                        />
                                    </div>
                                    <p className="mt-2 text-[10px] text-slate-500 italic">This name will be used as the default fallback for new agents.</p>
                                </div>
                            </div>
                        </div>

                        {/* Language & Voice Section */}
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden transition-all hover:shadow-md">
                            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Linguistic Controls</h3>
                                <LanguageIcon className="h-5 w-5 text-slate-300" />
                            </div>
                            <div className="p-8 space-y-8">
                                <div>
                                    <label htmlFor="language" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Primary Interface Language</label>
                                    <div className="relative">
                                        <select
                                            id="language"
                                            name="language"
                                            value={settings.language}
                                            onChange={handleInputChange}
                                            className="w-full py-4 px-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl font-bold appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all text-slate-900 dark:text-white"
                                        >
                                            <option>English (US)</option>
                                            <option>English (UK)</option>
                                            <option>Spanish</option>
                                            <option>French</option>
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            <ArrowPathIcon className="h-5 w-5 rotate-45" />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Default Voice Archetype</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {['Male', 'Female', 'Neutral'].map((type) => (
                                            <label
                                                key={type}
                                                className={`cursor-pointer p-4 rounded-2xl border-2 flex items-center gap-3 transition-all ${settings.voiceType === type
                                                    ? 'border-primary bg-primary/5 text-primary shadow-sm'
                                                    : 'border-slate-100 dark:border-slate-800 bg-transparent text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                                    }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="voiceType"
                                                    value={type}
                                                    checked={settings.voiceType === type}
                                                    onChange={handleRadioChange}
                                                    className="sr-only"
                                                />
                                                <div className={`p-2 rounded-xl ${settings.voiceType === type ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                                    <SpeakerWaveIcon className="h-4 w-4" />
                                                </div>
                                                <span className="font-black text-sm">{type}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Theme Section */}
                        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden transition-all hover:shadow-md">
                            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Interface Aesthetics</h3>
                                {theme === 'dark' ? <MoonIcon className="h-5 w-5 text-slate-300" /> : <SunIcon className="h-5 w-5 text-amber-500" />}
                            </div>
                            <div className="p-8">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-black text-slate-900 dark:text-white mb-1">Visual Mode</h4>
                                        <p className="text-xs text-slate-500 font-medium italic">Toggle between light and dark system experiences.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={toggleTheme}
                                        className="relative group p-1 w-16 h-9 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 transition-colors duration-500 focus:outline-none"
                                    >
                                        <div className={`absolute top-1 left-1 w-7 h-7 rounded-full shadow-lg transform transition-transform duration-500 flex items-center justify-center ${theme === 'dark' ? 'translate-x-7 bg-primary' : 'translate-x-0 bg-white'
                                            }`}>
                                            {theme === 'dark' ? <MoonIcon className="h-4 w-4 text-white" /> : <SunIcon className="h-4 w-4 text-amber-500" />}
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
};

export default SettingsPage;