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
    BanknotesIcon,
    ArrowRightOnRectangleIcon,
    UserGroupIcon,
    ShieldExclamationIcon,
    UserPlusIcon,
    EllipsisVerticalIcon,
    ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import { listOrganizations, createOrganization, updateOrganization, deleteOrganization, listOrgAdmins, deleteOrgAdmin, createOrgAdmin, updateOrgAdmin } from '../utils/superAdminApi';
import { Organization, OrgAdmin } from '../types';
import { getApiBaseUrl, getApiPath } from '../utils/api';
import { buildOrganizationLoginUrl, normalizeOrganizationSlug } from '../utils/tenant';
import { impersonateUser } from '../utils/superAdminApi';

const API_BASE_URL = `${getApiBaseUrl()}${getApiPath()}`;

const SuperAdminOrganizationsPage: React.FC = () => {
    const navigate = useNavigate();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [orgAdmins, setOrgAdmins] = useState<OrgAdmin[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showCreditModal, setShowCreditModal] = useState<{org: Organization; amount: string} | null>(null);
    const [showDeleteAdminModal, setShowDeleteAdminModal] = useState<{org: Organization; admin: OrgAdmin} | null>(null);
    const [showCreateAdminModal, setShowCreateAdminModal] = useState<Organization | null>(null);
    const [showEditAdminModal, setShowEditAdminModal] = useState<{org: Organization; admin: OrgAdmin} | null>(null);
    const [activeOrgMenu, setActiveOrgMenu] = useState<{
        org: Organization;
        admins: OrgAdmin[];
        x: number;
        y: number;
    } | null>(null);
    const [editOrg, setEditOrg] = useState<Organization | null>(null);
    const [formName, setFormName] = useState('');
    const [formLogoUrl, setFormLogoUrl] = useState('');
    const [adminForm, setAdminForm] = useState({ email: '', username: '', password: '' });
    const [adminEditForm, setAdminEditForm] = useState({ email: '', username: '', password: '' });
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        const userStr = localStorage.getItem('ziya-user');
        if (!userStr) { navigate('/login'); return; }
        const user = JSON.parse(userStr);
        if (user.role !== 'super_admin') { navigate('/login'); return; }
        fetchAll();
    }, [navigate]);

    const fetchAll = async () => {
        setLoading(true);
        setError('');
        try {
            const [orgs, admins] = await Promise.all([
                listOrganizations(),
                listOrgAdmins(),
            ]);
            setOrganizations(orgs);
            setOrgAdmins(admins);
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

    const getOrgAdminsForOrg = (orgId: number): OrgAdmin[] =>
        orgAdmins.filter(a => a.organization_id === orgId);

    const getPrimaryOrgAdmin = (orgId: number): OrgAdmin | undefined =>
        getOrgAdminsForOrg(orgId)[0];

    const getOrgAdmin = getPrimaryOrgAdmin;

    const openOrgMenu = (org: Organization, event: React.MouseEvent<HTMLButtonElement>) => {
        const admins = getOrgAdminsForOrg(org.id);
        const menuWidth = 372;
        const padding = 16;
        const x = Math.max(
            padding,
            Math.min(event.clientX - menuWidth + 24, window.innerWidth - menuWidth - padding)
        );
        const y = Math.max(padding, Math.min(event.clientY + 12, window.innerHeight - 24));

        setActiveOrgMenu({ org, admins, x, y });
    };

    const closeOrgMenu = () => setActiveOrgMenu(null);

    const getOrganizationLoginSlug = (org: Organization) =>
        org.slug || normalizeOrganizationSlug(org.name);

    const openOrgLogin = (org: Organization) => {
        const slug = getOrganizationLoginSlug(org);
        if (!slug) return;
        window.open(buildOrganizationLoginUrl(slug), '_blank', 'noopener,noreferrer');
        closeOrgMenu();
    };

    const handleImpersonateAdmin = async (admin: OrgAdmin) => {
        try {
            const user = await impersonateUser(admin.id);
            const currentUserStr = localStorage.getItem('ziya-user');
            if (currentUserStr) {
                localStorage.setItem('ziya-original-superadmin', currentUserStr);
            }
            localStorage.setItem('ziya-user', JSON.stringify(user));

            if (user.role === 'org_admin') {
                window.location.href = '/admin/dashboard';
            } else {
                window.location.href = '/dashboard';
            }
        } catch (err: any) {
            setFormError(err.message || 'Failed to impersonate admin');
        }
    };

    const handleImpersonate = async (org: Organization) => {
        const orgAdmin = getPrimaryOrgAdmin(org.id);
        if (!orgAdmin) {
            setFormError('No admin assigned to this organization.');
            return;
        }

        await handleImpersonateAdmin(orgAdmin);
    };

    const handleAssignCredit = async () => {
        if (!showCreditModal) return;
        const amount = parseFloat(showCreditModal.amount);
        if (!amount || amount <= 0) { setFormError('Please enter a valid credit amount.'); return; }
        setSaving(true);
        setFormError('');
        try {
            // Get the org admin id for wallet transaction
            const orgAdmin = getOrgAdmin(showCreditModal.org.id);
            const superAdmin = JSON.parse(localStorage.getItem('ziya-user') || '{}');
            const response = await fetch(`${API_BASE_URL}/admin/wallet/add-credits`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: orgAdmin?.id || showCreditModal.org.id,
                    amount,
                    description: `SuperAdmin credit allocation to org: ${showCreditModal.org.name}`,
                    adminId: superAdmin.id || 'superadmin',
                }),
            });
            if (!response.ok) {
                const d = await response.json();
                throw new Error(d.message || 'Failed to assign credits');
            }
            showSuccess(`Credits assigned to ${showCreditModal.org.name} successfully.`);
            setShowCreditModal(null);
            fetchAll();
        } catch (err: any) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAdmin = async () => {
        if (!showDeleteAdminModal) return;
        setSaving(true);
        setFormError('');
        try {
            await deleteOrgAdmin(showDeleteAdminModal.admin.id);
            showSuccess(`Admin "${showDeleteAdminModal.admin.username || showDeleteAdminModal.admin.email}" deleted successfully.`);
            setShowDeleteAdminModal(null);
            fetchAll();
        } catch (err: any) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleEditAdmin = async () => {
        if (!showEditAdminModal) return;
        if (!adminEditForm.email.trim() || !adminEditForm.username.trim()) {
            setFormError('Email and username are required.');
            return;
        }

        setSaving(true);
        setFormError('');
        try {
            await updateOrgAdmin(showEditAdminModal.admin.id, {
                email: adminEditForm.email.trim(),
                username: adminEditForm.username.trim(),
                password: adminEditForm.password.trim() || undefined,
            });
            showSuccess(`Admin "${adminEditForm.username.trim()}" updated successfully.`);
            setShowEditAdminModal(null);
            setAdminEditForm({ email: '', username: '', password: '' });
            fetchAll();
        } catch (err: any) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleCreateAdmin = async () => {
        if (!showCreateAdminModal) return;
        if (!adminForm.email.trim() || !adminForm.username.trim() || !adminForm.password.trim()) {
            setFormError('Email, username, and password are required.');
            return;
        }

        setSaving(true);
        setFormError('');
        try {
            await createOrgAdmin({
                email: adminForm.email.trim(),
                username: adminForm.username.trim(),
                password: adminForm.password,
                organization_id: showCreateAdminModal.id,
            });
            showSuccess(`Admin created for ${showCreateAdminModal.name}.`);
            setAdminForm({ email: '', username: '', password: '' });
            setShowCreateAdminModal(null);
            fetchAll();
        } catch (err: any) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteOrganization = async (org: Organization) => {
        if (org.slug === 'ziya') {
            setFormError('The platform organization cannot be deleted.');
            return;
        }

        const confirmDelete = window.confirm(
            `Delete organization "${org.name}"?\n\nThis will remove all users and admins in this org and cannot be undone.`
        );
        if (!confirmDelete) return;

        setSaving(true);
        setFormError('');
        try {
            await deleteOrganization(org.id);
            showSuccess(`Organization "${org.name}" deleted successfully.`);
            fetchAll();
        } catch (err: any) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleSaveOrg = async () => {
        if (!formName.trim()) { setFormError('Organization name is required'); return; }
        setSaving(true);
        setFormError('');
        try {
            const user = JSON.parse(localStorage.getItem('ziya-user') || '{}');
            if (editOrg) {
                await updateOrganization(editOrg.id, { name: formName, logo_url: formLogoUrl });
                showSuccess('Organization updated successfully.');
            } else {
                await createOrganization(formName, user.id, formLogoUrl);
                showSuccess('Organization created successfully.');
            }
            setShowCreateModal(false);
            fetchAll();
        } catch (err: any) {
            setFormError(err.message);
        } finally {
            setSaving(false);
        }
    };


    const filtered = organizations.filter(o =>
        o.name.toLowerCase().includes(search.toLowerCase())
    );
    const isPlatformOrg = (org: Organization) => org.slug === 'ziya';

    return (
        <AppLayout
            breadcrumbs={[
                { label: 'Super Admin', path: '/superadmin/dashboard' },
                { label: 'Organizations' },
            ]}
            pageTitle="Organization Management"
            pageDescription="Monitor organization health, allocate credits, and perform administrative actions."
            primaryAction={
                <div className="flex gap-3">
                    <button
                        onClick={fetchAll}
                        className="flex items-center px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                    >
                        <ArrowPathIcon className="w-4 h-4 mr-2" />
                        Refresh
                    </button>
                    <button
                        onClick={() => { setFormName(''); setFormLogoUrl(''); setFormError(''); setShowCreateModal(true); }}
                        className="flex items-center px-5 py-2 bg-primary text-white rounded-xl font-black text-sm shadow-lg shadow-primary/20 hover:shadow-xl transition-all"
                    >
                        <PlusIcon className="w-4 h-4 mr-2" />
                        New Org
                    </button>
                </div>
            }
        >
            <div className="space-y-6 animate-in fade-in duration-500">

                {/* Success toast */}
                {successMsg && (
                    <div className="flex items-center gap-3 px-5 py-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl text-sm font-bold animate-in slide-in-from-top-2">
                        <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />
                        {successMsg}
                    </div>
                )}

                {error && (
                    <div className="flex items-center gap-3 px-5 py-3 bg-red-50 border border-red-100 text-red-700 rounded-2xl text-sm font-bold">
                        <XCircleIcon className="w-5 h-5 flex-shrink-0" />
                        {error}
                    </div>
                )}

                {/* Search & Filters */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:max-w-sm">
                        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search organizations..."
                            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none text-sm font-bold text-slate-800 dark:text-white"
                        />
                    </div>
                    <span className="text-xs text-slate-400 font-bold">
                        {filtered.length} organization{filtered.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Table */}
                <div className="bg-white dark:bg-slate-800/50 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                                    <th className="text-left px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Organization</th>
                                    <th className="text-left px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Members & Admins</th>
                                    <th className="text-left px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Admin Account</th>
                                    <th className="text-left px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Credits</th>
                                    <th className="text-left px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                    <th className="text-right px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                {loading ? (
                                    [...Array(3)].map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={6} className="px-8 py-6"><div className="h-10 bg-slate-100 dark:bg-slate-900 rounded-2xl" /></td>
                                        </tr>
                                    ))
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-8 py-12 text-center text-slate-400 font-bold text-sm">
                                            No organizations found.
                                        </td>
                                    </tr>
                                ) : filtered.map((org) => {
                                    const orgAdminsForOrg = getOrgAdminsForOrg(org.id);
                                    const orgAdmin = orgAdminsForOrg[0];
                                    const orgLoginSlug = getOrganizationLoginSlug(org);
                                    return (
                                    <tr key={org.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-all">
                                        {/* Organization Details */}
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/10 to-blue-500/10 border border-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                    {org.logo_url ? (
                                                        <img src={org.logo_url} className="w-full h-full object-cover" alt={org.name} />
                                                    ) : (
                                                        <BuildingOfficeIcon className="w-5 h-5 text-primary" />
                                                    )}
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="font-black text-slate-800 dark:text-white text-sm leading-tight group-hover:text-primary transition-colors">{org.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ID: {org.id}</p>
                                                    {orgLoginSlug && (
                                                        <p className="mt-1 text-[10px] font-black text-cyan-600 dark:text-cyan-300 break-all">
                                                            {buildOrganizationLoginUrl(orgLoginSlug)}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Members & Admins — real-time from API */}
                                        <td className="px-6 py-5">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <UserGroupIcon className="w-3.5 h-3.5 text-slate-400" />
                                                    <span className="text-xs font-black text-slate-700 dark:text-slate-300">{org.user_count ?? 0} Members</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500" />
                                                    <span className="text-xs font-black text-slate-700 dark:text-slate-300">{org.admin_count ?? 0} Admin{(org.admin_count ?? 0) !== 1 ? 's' : ''}</span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Admin Account — real admin data */}
                                        <td className="px-6 py-5">
                                            {orgAdmin ? (
                                                <div>
                                                    <p className="text-xs font-black text-slate-800 dark:text-white leading-tight">{orgAdmin.username || '—'}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold truncate max-w-[140px]">{orgAdmin.email}</p>
                                                    {orgAdminsForOrg.length > 1 && (
                                                        <p className="text-[10px] font-black text-cyan-600 dark:text-cyan-300">
                                                            +{orgAdminsForOrg.length - 1} more admin{orgAdminsForOrg.length - 1 !== 1 ? 's' : ''}
                                                        </p>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 italic font-bold">No admin assigned</span>
                                            )}
                                        </td>

                                        {/* Credits — real credit_balance from API */}
                                        <td className="px-6 py-5 font-mono">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-primary">
                                                    {(org.credit_balance ?? 0).toLocaleString()} <span className="text-[9px]">CR</span>
                                                </span>
                                                <span className="text-[9px] text-slate-400 font-bold uppercase">Balance</span>
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td className="px-6 py-5">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                                org.status === 'active'
                                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                    : 'bg-red-50 text-red-600 border border-red-100'
                                            }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${org.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                {org.status}
                                            </span>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-8 py-5">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (activeOrgMenu?.org.id === org.id) {
                                                            closeOrgMenu();
                                                        } else {
                                                            openOrgMenu(org, e);
                                                        }
                                                    }}
                                                    title="Open organization actions"
                                                    className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
                                                >
                                                    <EllipsisVerticalIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {activeOrgMenu && (
                <div
                    className="fixed inset-0 z-50"
                    onClick={closeOrgMenu}
                >
                    <div
                        className="absolute w-[372px] max-w-[calc(100vw-32px)] rounded-[1.75rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
                        style={{ top: activeOrgMenu.y, left: activeOrgMenu.x }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Organization Actions</p>
                                    <h3 className="mt-1 text-lg font-black text-slate-900 dark:text-white">{activeOrgMenu.org.name}</h3>
                                    <p className="text-[10px] font-bold text-slate-500 mt-1">ID: {activeOrgMenu.org.id}</p>
                                </div>
                                <button
                                    onClick={closeOrgMenu}
                                    className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                                >
                                    <XCircleIcon className="w-5 h-5" />
                                </button>
                            </div>
                            {getOrganizationLoginSlug(activeOrgMenu.org) && (
                                <p className="mt-3 text-[10px] font-black text-cyan-700 dark:text-cyan-300 break-all">
                                    {buildOrganizationLoginUrl(getOrganizationLoginSlug(activeOrgMenu.org))}
                                </p>
                            )}
                            <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                    onClick={() => {
                                        setShowCreditModal({ org: activeOrgMenu.org, amount: '' });
                                        closeOrgMenu();
                                    }}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all"
                                >
                                    <BanknotesIcon className="w-4 h-4" />
                                    Assign Credits
                                </button>
                                {getOrganizationLoginSlug(activeOrgMenu.org) && (
                                    <button
                                        onClick={async () => {
                                            try {
                                                await navigator.clipboard.writeText(buildOrganizationLoginUrl(getOrganizationLoginSlug(activeOrgMenu.org)));
                                                showSuccess(`Copied ${activeOrgMenu.org.name} login URL.`);
                                                closeOrgMenu();
                                            } catch {
                                                setFormError('Unable to copy login URL.');
                                            }
                                        }}
                                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-100 text-[10px] font-black uppercase tracking-widest hover:bg-cyan-100 transition-all"
                                    >
                                        <ClipboardDocumentIcon className="w-4 h-4" />
                                        Copy Login URL
                                    </button>
                                )}
                                <button
                                    onClick={() => openOrgLogin(activeOrgMenu.org)}
                                    disabled={!getOrganizationLoginSlug(activeOrgMenu.org)}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ArrowRightOnRectangleIcon className="w-4 h-4" />
                                    Open Login
                                </button>
                                {!isPlatformOrg(activeOrgMenu.org) && activeOrgMenu.admins.length > 0 && (
                                    <button
                                        onClick={() => {
                                            handleImpersonate(activeOrgMenu.org);
                                            closeOrgMenu();
                                        }}
                                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
                                    >
                                        <ArrowRightOnRectangleIcon className="w-4 h-4" />
                                        Impersonate Admin
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Assigned Admins</p>
                                        <p className="text-xs font-bold text-slate-500 mt-1">{activeOrgMenu.admins.length} admin{activeOrgMenu.admins.length !== 1 ? 's' : ''}</p>
                                    </div>
                                    {!isPlatformOrg(activeOrgMenu.org) && (
                                        <button
                                            onClick={() => {
                                                setShowCreateAdminModal(activeOrgMenu.org);
                                                setAdminForm({ email: '', username: '', password: '' });
                                                setFormError('');
                                                closeOrgMenu();
                                            }}
                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-100 text-[10px] font-black uppercase tracking-widest hover:bg-cyan-100 transition-all"
                                        >
                                            <UserPlusIcon className="w-4 h-4" />
                                            Add Admin
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    {activeOrgMenu.admins.length > 0 ? (
                                        activeOrgMenu.admins.map((admin) => (
                                            <div key={admin.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-black text-slate-900 dark:text-white truncate">{admin.username || '—'}</p>
                                                        <p className="text-[10px] font-bold text-slate-500 truncate">{admin.email}</p>
                                                    </div>
                                                    {!isPlatformOrg(activeOrgMenu.org) && (
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button
                                                                onClick={() => {
                                                                    handleImpersonateAdmin(admin);
                                                                    closeOrgMenu();
                                                                }}
                                                                className="p-2 rounded-xl bg-slate-900 text-white border border-slate-900 hover:opacity-90 transition-all"
                                                                title="Impersonate admin"
                                                            >
                                                                <ArrowRightOnRectangleIcon className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setShowEditAdminModal({ org: activeOrgMenu.org, admin });
                                                                    setAdminEditForm({
                                                                        email: admin.email,
                                                                        username: admin.username,
                                                                        password: '',
                                                                    });
                                                                    setFormError('');
                                                                    closeOrgMenu();
                                                                }}
                                                                className="p-2 rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-100 hover:bg-cyan-100 transition-all"
                                                                title="Edit admin"
                                                            >
                                                                <PencilIcon className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setShowDeleteAdminModal({ org: activeOrgMenu.org, admin });
                                                                    setFormError('');
                                                                    closeOrgMenu();
                                                                }}
                                                                className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-all"
                                                                title="Remove admin"
                                                            >
                                                                <TrashIcon className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-4 text-center">
                                            <p className="text-sm font-bold text-slate-500">No admins assigned yet.</p>
                                            {isPlatformOrg(activeOrgMenu.org) && (
                                                <p className="text-[10px] text-slate-400 font-bold mt-1">The platform organization is read-only.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                                <button
                                    onClick={() => {
                                        setEditOrg(activeOrgMenu.org);
                                        setFormName(activeOrgMenu.org.name);
                                        setFormLogoUrl(activeOrgMenu.org.logo_url || '');
                                        setFormError('');
                                        setShowCreateModal(true);
                                        closeOrgMenu();
                                    }}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                                >
                                    <PencilIcon className="w-4 h-4" />
                                    Edit Org
                                </button>
                                {!isPlatformOrg(activeOrgMenu.org) && (
                                    <button
                                        onClick={() => {
                                            handleDeleteOrganization(activeOrgMenu.org);
                                            closeOrgMenu();
                                        }}
                                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                        Delete Org
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Credit Allocation Modal */}
            {showCreditModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 w-full max-w-md border border-slate-200 dark:border-slate-800">
                        <div className="flex flex-col items-center mb-6">
                            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-500 mb-4">
                                <BanknotesIcon className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">Allocate Credits</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Org: {showCreditModal.org.name}</p>
                            {getOrgAdmin(showCreditModal.org.id) && (
                                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Admin: {getOrgAdmin(showCreditModal.org.id)?.username}</p>
                            )}
                        </div>

                        {formError && (
                            <p className="text-xs text-red-600 font-bold mb-4 text-center bg-red-50 rounded-xl px-3 py-2">{formError}</p>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Credit Amount (CR)</label>
                                <input
                                    type="number"
                                    value={showCreditModal.amount}
                                    onChange={(e) => setShowCreditModal({...showCreditModal, amount: e.target.value})}
                                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none font-black text-lg text-slate-900 dark:text-white"
                                    placeholder="5000"
                                    autoFocus
                                    min="1"
                                />
                                <p className="text-[9px] text-slate-400 font-bold mt-2 px-1 leading-relaxed italic">
                                    * Credits will be credited to {showCreditModal.org.name}'s admin wallet. Transaction will be audited.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4 mt-8">
                            <button
                                onClick={() => { setShowCreditModal(null); setFormError(''); }}
                                className="flex-1 py-4 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-black text-xs text-slate-500 uppercase tracking-widest hover:bg-slate-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAssignCredit}
                                disabled={saving || !showCreditModal.amount}
                                className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-50"
                            >
                                {saving ? <ArrowPathIcon className="w-4 h-4 animate-spin mx-auto" /> : 'Confirm Deposit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Admin Confirmation Modal */}
            {showDeleteAdminModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 w-full max-w-sm border border-slate-200 dark:border-slate-800">
                        <div className="flex flex-col items-center mb-6">
                            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 rounded-2xl flex items-center justify-center text-red-500 mb-4">
                                <ShieldExclamationIcon className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">Delete Admin</h3>
                            <p className="text-sm text-slate-500 font-medium text-center mt-2">
                                Are you sure you want to remove <strong>{showDeleteAdminModal.admin.username || showDeleteAdminModal.admin.email}</strong> as admin of <strong>{showDeleteAdminModal.org.name}</strong>?
                            </p>
                            <p className="text-[10px] text-red-500 font-bold mt-2 text-center">This action cannot be undone.</p>
                        </div>

                        {formError && (
                            <p className="text-xs text-red-600 font-bold mb-4 text-center bg-red-50 rounded-xl px-3 py-2">{formError}</p>
                        )}

                        <div className="flex gap-4 mt-2">
                            <button
                                onClick={() => { setShowDeleteAdminModal(null); setFormError(''); }}
                                className="flex-1 py-3 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-black text-xs text-slate-500 uppercase tracking-widest hover:bg-slate-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAdmin}
                                disabled={saving}
                                className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-600/30 transition-all hover:bg-red-700 disabled:opacity-50"
                            >
                                {saving ? <ArrowPathIcon className="w-4 h-4 animate-spin mx-auto" /> : 'Delete Admin'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create / Edit Organization Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 w-full max-w-md border border-slate-200 dark:border-slate-800">
                        <div className="flex flex-col items-center mb-6">
                            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-4">
                                <BuildingOfficeIcon className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">
                                {editOrg ? 'Edit Organization' : 'New Organization'}
                            </h3>
                        </div>

                        {formError && (
                            <p className="text-xs text-red-600 font-bold mb-4 text-center bg-red-50 rounded-xl px-3 py-2">{formError}</p>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Organization Name</label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none font-black text-sm text-slate-900 dark:text-white"
                                    placeholder="Acme Corp"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Logo URL (Optional)</label>
                                <input
                                    type="text"
                                    value={formLogoUrl}
                                    onChange={(e) => setFormLogoUrl(e.target.value)}
                                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none font-bold text-sm text-slate-900 dark:text-white"
                                    placeholder="https://example.com/logo.png"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 mt-8">
                            <button
                                onClick={() => { setShowCreateModal(false); setFormError(''); }}
                                className="flex-1 py-4 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-black text-xs text-slate-500 uppercase tracking-widest hover:bg-slate-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveOrg}
                                disabled={saving || !formName.trim()}
                                className="flex-1 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/30 transition-all disabled:opacity-50"
                            >
                                {saving ? <ArrowPathIcon className="w-4 h-4 animate-spin mx-auto" /> : (editOrg ? 'Update' : 'Create')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Admin Modal */}
            {showCreateAdminModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 w-full max-w-md border border-slate-200 dark:border-slate-800">
                        <div className="flex flex-col items-center mb-6">
                            <div className="w-16 h-16 bg-cyan-50 dark:bg-cyan-900/30 rounded-2xl flex items-center justify-center text-cyan-500 mb-4">
                                <UserPlusIcon className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">Add Organization Admin</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">{showCreateAdminModal.name}</p>
                        </div>

                        {formError && (
                            <p className="text-xs text-red-600 font-bold mb-4 text-center bg-red-50 rounded-xl px-3 py-2">{formError}</p>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Admin Email</label>
                                <input
                                    type="email"
                                    value={adminForm.email}
                                    onChange={(e) => setAdminForm(f => ({ ...f, email: e.target.value }))}
                                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none font-black text-sm text-slate-900 dark:text-white"
                                    placeholder="admin@company.com"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Admin Username</label>
                                <input
                                    type="text"
                                    value={adminForm.username}
                                    onChange={(e) => setAdminForm(f => ({ ...f, username: e.target.value }))}
                                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none font-black text-sm text-slate-900 dark:text-white"
                                    placeholder="org_admin"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Admin Password</label>
                                <input
                                    type="password"
                                    value={adminForm.password}
                                    onChange={(e) => setAdminForm(f => ({ ...f, password: e.target.value }))}
                                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none font-black text-sm text-slate-900 dark:text-white"
                                    placeholder="Create a secure password"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 mt-8">
                            <button
                                onClick={() => { setShowCreateAdminModal(null); setFormError(''); }}
                                className="flex-1 py-4 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-black text-xs text-slate-500 uppercase tracking-widest hover:bg-slate-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateAdmin}
                                disabled={saving}
                                className="flex-1 py-4 bg-cyan-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-cyan-600/30 transition-all disabled:opacity-50"
                            >
                                {saving ? <ArrowPathIcon className="w-4 h-4 animate-spin mx-auto" /> : 'Create Admin'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Admin Modal */}
            {showEditAdminModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 w-full max-w-md border border-slate-200 dark:border-slate-800">
                        <div className="flex flex-col items-center mb-6">
                            <div className="w-16 h-16 bg-cyan-50 dark:bg-cyan-900/30 rounded-2xl flex items-center justify-center text-cyan-500 mb-4">
                                <PencilIcon className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">Edit Organization Admin</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">{showEditAdminModal.org.name}</p>
                        </div>

                        {formError && (
                            <p className="text-xs text-red-600 font-bold mb-4 text-center bg-red-50 rounded-xl px-3 py-2">{formError}</p>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Admin Email</label>
                                <input
                                    type="email"
                                    value={adminEditForm.email}
                                    onChange={(e) => setAdminEditForm(f => ({ ...f, email: e.target.value }))}
                                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none font-black text-sm text-slate-900 dark:text-white"
                                    placeholder="admin@company.com"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Admin Username</label>
                                <input
                                    type="text"
                                    value={adminEditForm.username}
                                    onChange={(e) => setAdminEditForm(f => ({ ...f, username: e.target.value }))}
                                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none font-black text-sm text-slate-900 dark:text-white"
                                    placeholder="org_admin"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">New Password (Optional)</label>
                                <input
                                    type="password"
                                    value={adminEditForm.password}
                                    onChange={(e) => setAdminEditForm(f => ({ ...f, password: e.target.value }))}
                                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-primary/50 focus:ring-4 focus:ring-primary/5 outline-none font-black text-sm text-slate-900 dark:text-white"
                                    placeholder="Leave blank to keep current password"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4 mt-8">
                            <button
                                onClick={() => { setShowEditAdminModal(null); setFormError(''); }}
                                className="flex-1 py-4 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-black text-xs text-slate-500 uppercase tracking-widest hover:bg-slate-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEditAdmin}
                                disabled={saving}
                                className="flex-1 py-4 bg-cyan-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-cyan-600/30 transition-all disabled:opacity-50"
                            >
                                {saving ? <ArrowPathIcon className="w-4 h-4 animate-spin mx-auto" /> : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
};

export default SuperAdminOrganizationsPage;
