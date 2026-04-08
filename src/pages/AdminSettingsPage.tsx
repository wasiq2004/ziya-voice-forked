import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import {
    BuildingOffice2Icon,
    PhotoIcon,
    CloudArrowUpIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { getApiBaseUrl, getApiPath } from '../utils/api';

const MAX_LOGO_FILE_SIZE = 10 * 1024 * 1024;

const AdminSettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingOrg, setSavingOrg] = useState(false);
    const [savingBranding, setSavingBranding] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const [organization, setOrganization] = useState({
        name: '',
    });

    const [branding, setBranding] = useState({
        logoUrl: '',
    });

    const getAdminUser = () => {
        const raw = localStorage.getItem('ziya-user');
        return raw ? JSON.parse(raw) : null;
    };

    const syncAdminUser = (updates: { organization_name?: string; organization_logo_url?: string }) => {
        const admin = getAdminUser();
        if (!admin) return;

        const updatedUser = {
            ...admin,
            ...updates,
        };

        localStorage.setItem('ziya-user', JSON.stringify(updatedUser));
        window.dispatchEvent(new CustomEvent('ziya-user-updated', { detail: updatedUser }));
    };

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

        const loadOrganizationSettings = async () => {
            setLoading(true);
            try {
                const API = getApiBaseUrl();
                const response = await fetch(`${API}${getApiPath()}/admin/organization/settings?adminId=${encodeURIComponent(parsed.id)}`);
                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(data.message || 'Failed to load organization settings');
                }

                setOrganization({
                    name: data.organization?.name || parsed.organization_name || '',
                });
                setBranding({
                    logoUrl: data.organization?.logoUrl || parsed.organization_logo_url || '',
                });

                syncAdminUser({
                    organization_name: data.organization?.name || parsed.organization_name || '',
                    organization_logo_url: data.organization?.logoUrl || parsed.organization_logo_url || '',
                });
            } catch (err: any) {
                setOrganization({ name: parsed.organization_name || '' });
                setBranding({ logoUrl: parsed.organization_logo_url || '' });
                showError(err.message || 'Failed to load organization settings');
            } finally {
                setLoading(false);
            }
        };

        loadOrganizationSettings();
    }, [navigate]);

    const showSuccess = (msg: string) => {
        setSuccessMessage(msg);
        setErrorMessage('');
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    const showError = (msg: string) => {
        setErrorMessage(msg);
        setTimeout(() => setErrorMessage(''), 4000);
    };

    const handleSaveOrganization = async (e: React.FormEvent) => {
        e.preventDefault();
        const admin = getAdminUser();
        if (!admin) return;

        setSavingOrg(true);
        try {
            const API = getApiBaseUrl();
            const response = await fetch(`${API}${getApiPath()}/admin/organization/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    adminId: admin.id,
                    organizationName: organization.name,
                }),
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Failed to update organization');
            }

            const nextName = data.organization?.name || organization.name;
            setOrganization({ name: nextName });
            syncAdminUser({ organization_name: nextName });
            showSuccess('Organization name updated successfully!');
        } catch (err: any) {
            showError(err.message || 'Failed to update organization');
        } finally {
            setSavingOrg(false);
        }
    };

    const handleLogoSelect = () => {
        fileInputRef.current?.click();
    };

    const handleLogoUpload = async (file: File) => {
        const admin = getAdminUser();
        if (!admin) return;

        if (file.size > MAX_LOGO_FILE_SIZE) {
            showError('Logo size must be 10MB or less');
            return;
        }

        setSavingBranding(true);
        try {
            const API = getApiBaseUrl();
            const formData = new FormData();
            formData.append('adminId', admin.id);
            formData.append('logo', file);

            const response = await fetch(`${API}${getApiPath()}/admin/branding/logo-upload`, {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Failed to upload logo');
            }

            const nextLogo = data.organization?.logoUrl || data.logoUrl || '';
            setBranding({ logoUrl: nextLogo });
            syncAdminUser({ organization_logo_url: nextLogo });
            showSuccess('Organization logo updated successfully!');
        } catch (err: any) {
            showError(err.message || 'Failed to upload logo');
        } finally {
            setSavingBranding(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    return (
        <AppLayout
            breadcrumbs={[
                { label: 'Admin', path: '/admin/dashboard' },
                { label: 'Settings' }
            ]}
            pageTitle="Organization Settings"
            pageDescription="Manage your organization identity and branding."
        >
            <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {successMessage && (
                    <div className="flex items-center p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-2xl text-emerald-700 dark:text-emerald-400 text-sm font-bold">
                        <CheckCircleIcon className="w-5 h-5 mr-3" />
                        {successMessage}
                    </div>
                )}
                {errorMessage && (
                    <div className="flex items-center p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl text-red-700 dark:text-red-400 text-sm font-bold">
                        {errorMessage}
                    </div>
                )}

                <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <BuildingOffice2Icon className="w-5 h-5 text-primary" />
                        </div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Panel Settings</h3>
                    </div>
                    <form onSubmit={handleSaveOrganization} className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Organization Name</label>
                            <input
                                type="text"
                                value={organization.name}
                                onChange={(e) => setOrganization({ name: e.target.value })}
                                placeholder="Enter organization name"
                                disabled={loading}
                                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-primary/20 transition-all outline-none disabled:opacity-60"
                            />
                        </div>
                        <div className="pt-2 flex justify-end">
                            <button
                                type="submit"
                                disabled={savingOrg || loading}
                                className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                            >
                                {savingOrg ? 'Saving...' : 'Save Organization'}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 rounded-xl">
                            <PhotoIcon className="w-5 h-5 text-purple-500" />
                        </div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Branding & Whitelabel</h3>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Brand Logo</label>
                            <div className="flex flex-col md:flex-row md:items-center gap-6 p-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30">
                                <div className="w-24 h-24 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                    {branding.logoUrl ? (
                                        <img src={branding.logoUrl} alt="Logo Preview" className="max-w-full max-h-full object-contain" />
                                    ) : (
                                        <PhotoIcon className="w-8 h-8 text-slate-300" />
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Upload your organization logo</p>
                                    <p className="text-[10px] text-slate-400 font-medium">Accepted: PNG, JPG, JPEG, SVG, WEBP. Max size: 10MB.</p>
                                    <button
                                        type="button"
                                        onClick={handleLogoSelect}
                                        disabled={savingBranding || loading}
                                        className="inline-flex items-center space-x-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
                                    >
                                        <CloudArrowUpIcon className="w-4 h-4" />
                                        <span>{savingBranding ? 'Uploading...' : 'Select Image'}</span>
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".png,.jpg,.jpeg,.svg,.webp,image/png,image/jpeg,image/svg+xml,image/webp"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                handleLogoUpload(file);
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};

export default AdminSettingsPage;
