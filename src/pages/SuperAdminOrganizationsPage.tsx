import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import {
    BuildingOfficeIcon,
    PlusIcon,
    PencilIcon,
    XCircleIcon,
    CheckCircleIcon,
    ArrowPathIcon,
    MagnifyingGlassIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import { listOrganizations, createOrganization, updateOrganization, disableOrganization, deleteOrganization } from '../utils/superAdminApi';
import { Organization } from '../types';

const SuperAdminOrganizationsPage: React.FC = () => {
    const navigate = useNavigate();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editOrg, setEditOrg] = useState<Organization | null>(null);
    const [formName, setFormName] = useState('');
    const [formLogoUrl, setFormLogoUrl] = useState('');
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    useEffect(() => {
        const userStr = localStorage.getItem('ziya-user');
        if (!userStr) { navigate('/login'); return; }
        const user = JSON.parse(userStr);
        if (user.role !== 'super_admin') { navigate('/login'); return; }
        fetchOrgs();
    }, [navigate]);

    const fetchOrgs = async () => {
        setLoading(true);
        setError('');
        try {
            const orgs = await listOrganizations();
            setOrganizations(orgs);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!formName.trim()) { setFormError('Organization name is required'); return; }
        setSaving(true);
        setFormError('');
        try {
            const userStr = localStorage.getItem('ziya-user');
            const user = userStr ? JSON.parse(userStr) : {};
            await createOrganization(formName.trim(), user.id, formLogoUrl.trim());
            setFormName('');
            setFormLogoUrl('');
            setShowCreateModal(false);
            fetchOrgs();
        } catch (err: any) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = async () => {
        if (!editOrg || !formName.trim()) { setFormError('Organization name is required'); return; }
        setSaving(true);
        setFormError('');
        try {
            await updateOrganization(editOrg.id, { name: formName.trim(), logo_url: formLogoUrl.trim() });
            setEditOrg(null);
            setFormName('');
            setFormLogoUrl('');
            fetchOrgs();
        } catch (err: any) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDisable = async (org: Organization) => {
        if (!window.confirm(`Disable organization "${org.name}"? This will restrict all org members.`)) return;
        try {
            await disableOrganization(org.id);
            fetchOrgs();
        } catch (err: any) {
            alert('Failed: ' + err.message);
        }
    };

    const handleDelete = async (org: Organization) => {
        if (!window.confirm(`Are you absolutely sure you want to PERMANENTLY delete organization "${org.name}"?\n\nThis will permanently delete ALL users, org admins, wallets, and settings associated with it. This action CANNOT be undone.`)) return;
        try {
            await deleteOrganization(org.id);
            fetchOrgs();
        } catch (err: any) {
            alert('Failed: ' + err.message);
        }
    };

    const filtered = organizations.filter(o =>
        o.name.toLowerCase().includes(search.toLowerCase())
    );

    const Modal: React.FC<{ title: string; onClose: () => void; onSubmit: () => void }> = ({ title, onClose, onSubmit }) => (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 w-full max-w-md mx-4 border border-slate-200 dark:border-slate-700">
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6">{title}</h3>
                {formError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm font-medium">
                        {formError}
                    </div>
                )}
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Organization Name</label>
                        <input
                            type="text"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none font-medium text-slate-900 dark:text-white"
                            placeholder="e.g., Acme Corporation"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Logo URL (Optional)</label>
                        <input
                            type="text"
                            value={formLogoUrl}
                            onChange={(e) => setFormLogoUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none font-medium text-slate-900 dark:text-white"
                            placeholder="https://example.com/logo.png"
                        />
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSubmit}
                        disabled={saving}
                        className="flex-1 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-black shadow-lg shadow-violet-500/30 hover:shadow-xl transition-all disabled:opacity-60"
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <AppLayout
            breadcrumbs={[
                { label: 'Super Admin', path: '/superadmin/dashboard' },
                { label: 'Organizations' },
            ]}
            pageTitle="Organizations"
            pageDescription="Create and manage all tenant organizations on the platform."
            primaryAction={
                <div className="flex gap-3">
                    <button
                        onClick={fetchOrgs}
                        className="flex items-center px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                    >
                        <ArrowPathIcon className="w-4 h-4 mr-2" />
                        Refresh
                    </button>
                    <button
                        onClick={() => { setFormName(''); setFormLogoUrl(''); setFormError(''); setShowCreateModal(true); }}
                        className="flex items-center px-5 py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-black text-sm shadow-lg shadow-violet-500/20 hover:shadow-xl transition-all"
                    >
                        <PlusIcon className="w-4 h-4 mr-2" />
                        New Organization
                    </button>
                </div>
            }
        >
            <div className="space-y-6 animate-in fade-in duration-500">
                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl text-red-700 dark:text-red-400 text-sm font-medium">
                        {error}
                    </div>
                )}

                {/* Search */}
                <div className="relative max-w-sm">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search organizations..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none text-sm font-medium text-slate-900 dark:text-white"
                    />
                </div>

                {/* Table */}
                <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-8 space-y-4">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-10 bg-slate-100 dark:bg-slate-700/50 rounded-xl animate-pulse" />
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <BuildingOfficeIcon className="w-12 h-12 mb-4 opacity-40" />
                            <p className="font-bold text-slate-500 dark:text-slate-400">
                                {search ? 'No organizations match your search' : 'No organizations yet'}
                            </p>
                            {!search && (
                                <button
                                    onClick={() => { setFormName(''); setFormLogoUrl(''); setFormError(''); setShowCreateModal(true); }}
                                    className="mt-4 px-5 py-2 bg-violet-500 text-white rounded-xl font-bold text-sm hover:bg-violet-600 transition-all"
                                >
                                    Create First Organization
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-100 dark:border-slate-800">
                                        <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Organization</th>
                                        <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Admins</th>
                                        <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Users</th>
                                        <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                        <th className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Created</th>
                                        <th className="text-right px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filtered.map((org) => (
                                        <tr key={org.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    {org.logo_url ? (
                                                        <img src={org.logo_url} alt={org.name} className="w-9 h-9 rounded-xl object-contain bg-slate-50 dark:bg-slate-800 flex-shrink-0 border border-slate-200 dark:border-slate-700" />
                                                    ) : (
                                                        <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 dark:text-violet-400 font-black text-sm flex-shrink-0">
                                                            {org.name.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-bold text-slate-900 dark:text-white text-sm">{org.name}</p>
                                                        <p className="text-xs text-slate-400">ID: {org.id}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">{org.admin_count ?? 0}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">{org.user_count ?? 0}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${org.status === 'active'
                                                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                    }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${org.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                    {org.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm text-slate-500 dark:text-slate-400">
                                                    {new Date(org.created_at).toLocaleDateString()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => { setEditOrg(org); setFormName(org.name); setFormLogoUrl(org.logo_url || ''); setFormError(''); }}
                                                        className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all"
                                                        title="Edit"
                                                    >
                                                        <PencilIcon className="w-4 h-4" />
                                                    </button>
                                                    {org.status === 'active' ? (
                                                        <button
                                                            onClick={() => handleDisable(org)}
                                                            className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                                            title="Disable"
                                                        >
                                                            <XCircleIcon className="w-4 h-4" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => updateOrganization(org.id, { status: 'active' }).then(fetchOrgs)}
                                                            className="p-2 rounded-xl text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all"
                                                            title="Enable"
                                                        >
                                                            <CheckCircleIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDelete(org)}
                                                        className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                                        title="Delete"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {showCreateModal && (
                <Modal
                    title="Create New Organization"
                    onClose={() => setShowCreateModal(false)}
                    onSubmit={handleCreate}
                />
            )}
            {editOrg && (
                <Modal
                    title={`Edit: ${editOrg.name}`}
                    onClose={() => setEditOrg(null)}
                    onSubmit={handleEdit}
                />
            )}
        </AppLayout>
    );
};

export default SuperAdminOrganizationsPage;
