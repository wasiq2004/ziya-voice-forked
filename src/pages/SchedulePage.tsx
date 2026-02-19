import React, { useState } from 'react';
import AppLayout from '../components/AppLayout';
import {
    CalendarIcon,
    ClockIcon,
    UserIcon,
    PhoneIcon,
    CheckCircleIcon,
    XCircleIcon,
    ArrowPathIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
    PlusIcon,
    UsersIcon,
    PencilSquareIcon,
    ChevronDownIcon
} from '@heroicons/react/24/outline';
import Modal from '../components/Modal';

// --- Types ---

interface CallLog {
    id: string;
    leadName: string;
    phoneNumber: string;
    agentId: string;
    agentName: string;
    scheduledTime: string; // ISO string
    status: 'Scheduled' | 'Completed' | 'Missed' | 'Rescheduled' | 'Cancelled';
    outcome?: string; // e.g., "Interested", "Not Interested", "Voicemail"
    feedback?: string;
    campaignName?: string;
}

interface UserRole {
    id: string;
    name: string;
    email: string;
    role: 'Admin' | 'Manager' | 'Agent' | 'Scheduler';
    avatar?: string;
}

// --- Mock Data ---

const MOCK_AGENTS = [
    { id: 'agent-1', name: 'Sarah Wilson' },
    { id: 'agent-2', name: 'Mike Johnson' },
    { id: 'agent-3', name: 'Emily Davis' },
];

const INITIAL_CALLS: CallLog[] = [
    {
        id: 'call-1',
        leadName: 'John Smith',
        phoneNumber: '+1 (555) 123-4567',
        agentId: 'agent-1',
        agentName: 'Sarah Wilson',
        scheduledTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        status: 'Scheduled',
        campaignName: 'Q3 Outreach',
    },
    {
        id: 'call-2',
        leadName: 'Alice Brown',
        phoneNumber: '+1 (555) 987-6543',
        agentId: 'agent-2',
        agentName: 'Mike Johnson',
        scheduledTime: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        status: 'Missed',
        campaignName: 'Renewal Drive',
    },
    {
        id: 'call-3',
        leadName: 'David Lee',
        phoneNumber: '+1 (555) 456-7890',
        agentId: 'agent-1',
        agentName: 'Sarah Wilson',
        scheduledTime: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        status: 'Completed',
        outcome: 'Interested',
        feedback: 'Client wants a demo next week.',
        campaignName: 'Q3 Outreach',
    },
];

const INITIAL_USERS: UserRole[] = [
    { id: 'u1', name: 'Admin User', email: 'admin@ziyavoice.com', role: 'Admin' },
    { id: 'u2', name: 'Sarah Wilson', email: 'sarah@ziyavoice.com', role: 'Agent' },
    { id: 'u3', name: 'Mike Johnson', email: 'mike@ziyavoice.com', role: 'Agent' },
    { id: 'u4', name: 'Jessica Pearson', email: 'jessica@ziyavoice.com', role: 'Manager' },
];

// --- Components ---

const SchedulePage: React.FC = () => {
    // State
    const [activeTab, setActiveTab] = useState<'schedule' | 'roles'>('schedule');
    const [calls, setCalls] = useState<CallLog[]>(INITIAL_CALLS);
    const [users, setUsers] = useState<UserRole[]>(INITIAL_USERS);
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [filterCampaign, setFilterCampaign] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCampaigns, setExpandedCampaigns] = useState<Record<string, boolean>>({ 'Q3 Outreach': true, 'Renewal Drive': true, 'Unassigned': true });

    // Modals
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
    const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

    // Selected Item State
    const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
    const [selectedUser, setSelectedUser] = useState<UserRole | null>(null);

    // Form inputs
    const [assignForm, setAssignForm] = useState({ leadName: '', phone: '', agentId: '', time: '', campaignName: '' });
    const [feedbackForm, setFeedbackForm] = useState({ outcome: '', feedback: '' });
    const [rescheduleForm, setRescheduleForm] = useState({ time: '' });
    const [roleForm, setRoleForm] = useState({ role: '' });

    // --- Actions ---

    const handleAssignCall = () => {
        const agent = MOCK_AGENTS.find(a => a.id === assignForm.agentId);
        const newCall: CallLog = {
            id: `call-${Date.now()}`,
            leadName: assignForm.leadName,
            phoneNumber: assignForm.phone,
            agentId: assignForm.agentId,
            agentName: agent ? agent.name : 'Unknown',
            scheduledTime: new Date(assignForm.time).toISOString(),
            status: 'Scheduled',
            campaignName: assignForm.campaignName || 'Unassigned',
        };
        setCalls([newCall, ...calls]);
        setIsAssignModalOpen(false);
        setAssignForm({ leadName: '', phone: '', agentId: '', time: '', campaignName: '' });
    };

    const handleSubmitFeedback = () => {
        if (!selectedCall) return;
        const updatedCalls = calls.map(c =>
            c.id === selectedCall.id
                ? { ...c, status: 'Completed' as const, outcome: feedbackForm.outcome, feedback: feedbackForm.feedback }
                : c
        );
        setCalls(updatedCalls);
        setIsFeedbackModalOpen(false);
        setSelectedCall(null);
    };

    const handleReschedule = () => {
        if (!selectedCall) return;
        const updatedCalls = calls.map(c =>
            c.id === selectedCall.id
                ? { ...c, status: 'Rescheduled' as const, scheduledTime: new Date(rescheduleForm.time).toISOString() }
                : c
        );
        setCalls(updatedCalls);
        setIsRescheduleModalOpen(false);
        setSelectedCall(null);
    };

    const handleUpdateRole = () => {
        if (!selectedUser) return;
        const updatedUsers = users.map(u =>
            u.id === selectedUser.id ? { ...u, role: roleForm.role as any } : u
        );
        setUsers(updatedUsers);
        setIsRoleModalOpen(false);
        setSelectedUser(null);
    };

    // --- Helpers ---

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Scheduled': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
            case 'Completed': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
            case 'Missed': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
            case 'Rescheduled': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
            case 'Cancelled': return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    const filteredCalls = calls.filter(call => {
        const matchesSearch = call.leadName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            call.agentName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = filterStatus === 'All' || call.status === filterStatus;
        const matchesCampaign = filterCampaign === 'All' || (call.campaignName || 'Unassigned') === filterCampaign;
        return matchesSearch && matchesStatus && matchesCampaign;
    });

    const uniqueCampaigns = Array.from(new Set(calls.map(c => c.campaignName || 'Unassigned')));

    // --- Grouping ---
    const groupedCalls: Record<string, CallLog[]> = filteredCalls.reduce<Record<string, CallLog[]>>((acc, call) => {
        const campaign = call.campaignName || 'Unassigned';
        if (!acc[campaign]) acc[campaign] = [];
        acc[campaign].push(call);
        return acc;
    }, {});

    const toggleCampaign = (campaign: string) => {
        setExpandedCampaigns(prev => ({ ...prev, [campaign]: !prev[campaign] }));
    };

    // --- Render ---

    return (
        <AppLayout
            breadcrumbs={[
                { label: 'Dashboard', path: '/dashboard' },
                { label: 'Schedule', path: '/schedule' },
            ]}
            pageTitle="Schedule & Assign"
            pageDescription="Manage call schedules, assignments, and team roles."
            primaryAction={
                <div className="flex space-x-3">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('schedule')}
                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'schedule' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                        >
                            Schedule
                        </button>
                        <button
                            onClick={() => setActiveTab('roles')}
                            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'roles' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                        >
                            Roles
                        </button>
                    </div>
                    {activeTab === 'schedule' && (
                        // Assign Call button removed
                        null
                    )}
                </div>
            }
        >
            {/* --- Schedule Tab --- */}
            {activeTab === 'schedule' && (
                <div className="space-y-6">
                    {/* Filters */}
                    {/* Filters Row 1: Dropdowns and Search */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative min-w-[200px]">
                                <select
                                    value={filterCampaign}
                                    onChange={(e) => setFilterCampaign(e.target.value)}
                                    className="w-full pl-4 pr-10 py-2.5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 appearance-none focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all cursor-pointer shadow-sm"
                                >
                                    <option value="All">All Projects</option>
                                    {uniqueCampaigns.map(campaign => (
                                        <option key={campaign} value={campaign}>{campaign}</option>
                                    ))}
                                </select>
                                <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>

                            <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                                {['All', 'Scheduled', 'Completed', 'Missed', 'Rescheduled'].map(status => (
                                    <button
                                        key={status}
                                        onClick={() => setFilterStatus(status)}
                                        className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all duration-200 ${filterStatus === status
                                            ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                            }`}
                                    >
                                        {status}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="relative group min-w-[300px]">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Search by lead or agent..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm font-medium w-full transition-all"
                            />
                        </div>
                    </div>

                    {/* Table */}
                    {/* Accordion Grouped Tables */}
                    <div className="space-y-6">
                        {Object.entries(groupedCalls).map(([campaign, campaignCalls]) => (
                            <div key={campaign} className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm transition-all duration-300">
                                {/* Accordion Header */}
                                <button
                                    onClick={() => toggleCampaign(campaign)}
                                    className="w-full flex items-center justify-between p-6 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className={`p-2 rounded-lg ${campaign === 'Unassigned' ? 'bg-slate-200 dark:bg-slate-700 text-slate-500' : 'bg-primary/10 text-primary'
                                            }`}>
                                            <CalendarIcon className="h-5 w-5" />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{campaign}</h3>
                                        <span className="px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">
                                            {campaignCalls.length}
                                        </span>
                                    </div>
                                    <ChevronDownIcon
                                        className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${expandedCampaigns[campaign] ? 'rotate-180' : ''}`}
                                    />
                                </button>

                                {/* Accordion Body */}
                                {expandedCampaigns[campaign] && (
                                    <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-200">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50/30 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800/50">
                                                <tr>
                                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Lead Details</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Campaign</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Scheduled For</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned Agent</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Result/Feedback</th>
                                                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                                                {campaignCalls.map((call) => (
                                                    <tr key={call.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <p className="font-bold text-slate-900 dark:text-white">{call.leadName}</p>
                                                            <div className="flex items-center text-xs text-slate-500 mt-1">
                                                                <PhoneIcon className="h-3 w-3 mr-1" />
                                                                {call.phoneNumber}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="text-xs font-black text-primary px-2 py-1 bg-primary/5 rounded-lg border border-primary/10">
                                                                {call.campaignName || 'Unassigned'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center text-sm text-slate-700 dark:text-slate-300">
                                                                <CalendarIcon className="h-4 w-4 mr-2 text-primary" />
                                                                {new Date(call.scheduledTime).toLocaleDateString()}
                                                            </div>
                                                            <div className="flex items-center text-xs text-slate-500 mt-1 ml-6">
                                                                <ClockIcon className="h-3 w-3 mr-1" />
                                                                {new Date(call.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center space-x-2">
                                                                <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center text-violet-600 dark:text-violet-300 font-bold text-xs">
                                                                    {call.agentName.charAt(0)}
                                                                </div>
                                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{call.agentName}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(call.status)}`}>
                                                                {call.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {call.outcome ? (
                                                                <div>
                                                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{call.outcome}</p>
                                                                    <p className="text-xs text-slate-500 truncate max-w-[150px]">{call.feedback}</p>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs text-slate-400 italic">No feedback yet</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex justify-end space-x-2">
                                                                {call.status !== 'Completed' && (
                                                                    <button
                                                                        onClick={() => { setSelectedCall(call); setIsFeedbackModalOpen(true); setFeedbackForm({ outcome: '', feedback: '' }); }}
                                                                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors tooltip"
                                                                        title="Complete & Log"
                                                                    >
                                                                        <CheckCircleIcon className="h-5 w-5" />
                                                                    </button>
                                                                )}
                                                                {(call.status === 'Missed' || call.status === 'Scheduled') && (
                                                                    <button
                                                                        onClick={() => { setSelectedCall(call); setIsRescheduleModalOpen(true); }}
                                                                        className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                                                                        title="Reschedule"
                                                                    >
                                                                        <ArrowPathIcon className="h-5 w-5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ))}
                        {Object.keys(groupedCalls).length === 0 && (
                            <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center text-slate-500">
                                No calls found match your criteria.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- Roles Tab --- */}
            {activeTab === 'roles' && (
                <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">User Role Management</h2>
                        <p className="text-sm text-slate-500">Manage permissions for your team members.</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Role</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                {users.map((u) => (
                                    <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                                        <td className="px-6 py-4 flex items-center space-x-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                                                <UserIcon className="h-5 w-5 text-slate-500" />
                                            </div>
                                            <span className="font-bold text-slate-900 dark:text-white">{u.name}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{u.email}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${u.role === 'Admin' ? 'bg-red-100 text-red-700' :
                                                u.role === 'Manager' ? 'bg-purple-100 text-purple-700' :
                                                    'bg-blue-100 text-blue-700'
                                                }`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => { setSelectedUser(u); setRoleForm({ role: u.role }); setIsRoleModalOpen(true); }}
                                                className="text-primary hover:text-primary-dark font-bold text-sm flex items-center justify-end space-x-1"
                                            >
                                                <PencilSquareIcon className="h-4 w-4" />
                                                <span>Edit Role</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- Modals --- */}

            {/* Assign Call Modal */}
            <Modal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} title="Assign New Call">
                <div className="space-y-4 p-2">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Lead Name</label>
                        <input
                            type="text"
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2"
                            value={assignForm.leadName}
                            onChange={e => setAssignForm({ ...assignForm, leadName: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                        <input
                            type="text"
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2"
                            value={assignForm.phone}
                            onChange={e => setAssignForm({ ...assignForm, phone: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Assign Agent</label>
                        <select
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2"
                            value={assignForm.agentId}
                            onChange={e => setAssignForm({ ...assignForm, agentId: e.target.value })}
                        >
                            <option value="">Select Agent...</option>
                            {MOCK_AGENTS.map(agent => (
                                <option key={agent.id} value={agent.id}>{agent.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Campaign</label>
                        <select
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2"
                            value={assignForm.campaignName}
                            onChange={e => setAssignForm({ ...assignForm, campaignName: e.target.value })}
                        >
                            <option value="">Select Campaign...</option>
                            {uniqueCampaigns.map(campaign => (
                                <option key={campaign} value={campaign}>{campaign}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Schedule Time</label>
                        <input
                            type="datetime-local"
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2"
                            value={assignForm.time}
                            onChange={e => setAssignForm({ ...assignForm, time: e.target.value })}
                        />
                    </div>
                    <div className="flex justify-end pt-4">
                        <button onClick={handleAssignCall} className="bg-primary text-white font-bold px-6 py-2 rounded-xl">Assign</button>
                    </div>
                </div>
            </Modal>

            {/* Feedback Modal */}
            <Modal isOpen={isFeedbackModalOpen} onClose={() => setIsFeedbackModalOpen(false)} title="Log Call Outcome">
                <div className="space-y-4 p-2">
                    <p className="text-sm text-slate-500">Provide details for the call with <span className="font-bold">{selectedCall?.leadName}</span>.</p>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Outcome</label>
                        <select
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2"
                            value={feedbackForm.outcome}
                            onChange={e => setFeedbackForm({ ...feedbackForm, outcome: e.target.value })}
                        >
                            <option value="">Select Outcome...</option>
                            <option value="Interested">Interested</option>
                            <option value="Not Interested">Not Interested</option>
                            <option value="Voicemail">Voicemail</option>
                            <option value="Follow-up Required">Follow-up Required</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Feedback / Notes</label>
                        <textarea
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 h-24"
                            value={feedbackForm.feedback}
                            onChange={e => setFeedbackForm({ ...feedbackForm, feedback: e.target.value })}
                            placeholder="Enter call notes..."
                        />
                    </div>
                    <div className="flex justify-end pt-4">
                        <button onClick={handleSubmitFeedback} className="bg-green-600 text-white font-bold px-6 py-2 rounded-xl">Complete & Log</button>
                    </div>
                </div>
            </Modal>

            {/* Reschedule Modal */}
            <Modal isOpen={isRescheduleModalOpen} onClose={() => setIsRescheduleModalOpen(false)} title="Reschedule Appointment">
                <div className="space-y-4 p-2">
                    <p className="text-sm text-slate-500">Rescheduling call for <span className="font-bold">{selectedCall?.leadName}</span>.</p>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">New Date & Time</label>
                        <input
                            type="datetime-local"
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2"
                            value={rescheduleForm.time}
                            onChange={e => setRescheduleForm({ ...rescheduleForm, time: e.target.value })}
                        />
                    </div>
                    <div className="flex justify-end pt-4">
                        <button onClick={handleReschedule} className="bg-orange-500 text-white font-bold px-6 py-2 rounded-xl">Confirm Reschedule</button>
                    </div>
                </div>
            </Modal>

            {/* Role Modal */}
            <Modal isOpen={isRoleModalOpen} onClose={() => setIsRoleModalOpen(false)} title="Update User Role">
                <div className="space-y-4 p-2">
                    <p className="text-sm text-slate-500">Updating role for <span className="font-bold">{selectedUser?.name}</span>.</p>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Role</label>
                        <select
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2"
                            value={roleForm.role}
                            onChange={e => setRoleForm({ ...roleForm, role: e.target.value })}
                        >
                            <option value="Admin">Admin</option>
                            <option value="Manager">Manager</option>
                            <option value="Agent">Agent</option>
                            <option value="Scheduler">Scheduler</option>
                        </select>
                    </div>
                    <div className="flex justify-end pt-4">
                        <button onClick={handleUpdateRole} className="bg-primary text-white font-bold px-6 py-2 rounded-xl">Update Role</button>
                    </div>
                </div>
            </Modal>
        </AppLayout>
    );
};

export default SchedulePage;
