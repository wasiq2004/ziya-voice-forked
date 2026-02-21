import React, { useState, useEffect } from 'react';
import AppLayout from '../components/AppLayout';
import {
    CalendarIcon,
    ClockIcon,
    PhoneIcon,
    MagnifyingGlassIcon,
    ChevronDownIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import { fetchScheduledCalls, fetchCampaigns } from '../utils/api';

// --- Types ---

interface CallLog {
    id: string;
    leadName: string;
    phoneNumber: string;
    agentId: string;
    agentName: string;
    scheduledTime: string; // ISO string
    status: string;
    outcome?: string; // e.g., "Interested", "Not Interested", "Voicemail"
    feedback?: string;
    campaignName?: string;
    meetLink?: string;
}

// --- Components ---

const SchedulePage: React.FC = () => {
    const { user } = useAuth();

    // State
    const [calls, setCalls] = useState<CallLog[]>([]);
    const [filterStatus, setFilterStatus] = useState<string>('All');
    const [filterCampaign, setFilterCampaign] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCampaigns, setExpandedCampaigns] = useState<Record<string, boolean>>({});

    const [allCampaigns, setAllCampaigns] = useState<string[]>([]);

    useEffect(() => {
        const loadData = async () => {
            if (!user?.id) return;
            try {
                const [callsRes, campsRes] = await Promise.all([
                    fetchScheduledCalls(user.id),
                    fetchCampaigns(user.id)
                ]);

                if (campsRes.success && campsRes.data) {
                    const campNames = campsRes.data.map((c: any) => c.name);
                    setAllCampaigns(Array.from(new Set(campNames)) as string[]);
                }

                if (callsRes.success && callsRes.data) {
                    const intentLabels: Record<string, string> = {
                        'interested': 'Interested',
                        'not_interested': 'Not Interested',
                        'needs_demo': 'Needs Demo',
                        'scheduled_meeting': 'Scheduled Meeting',
                        '1_on_1_session_requested': '1-on-1 Requested'
                    };

                    const fetchedCalls: CallLog[] = callsRes.data.map((r: any) => ({
                        id: r.id,
                        leadName: r.name || 'Unknown',
                        phoneNumber: r.phone_number,
                        agentId: r.agentId || 'unknown',
                        agentName: r.agentName || 'Unknown Agent',
                        scheduledTime: r.schedule_time,
                        status: r.status === 'completed' ? 'Completed' : 'Scheduled',
                        outcome: intentLabels[r.intent] || r.intent,
                        campaignName: r.campaignName || 'Unassigned',
                        meetLink: r.meet_link,
                    }));
                    setCalls(fetchedCalls);
                    // Open all campaigns by default
                    const uniqueCamps = Array.from(new Set(fetchedCalls.map(c => c.campaignName || 'Unassigned')));
                    const initialExpanded: Record<string, boolean> = {};
                    uniqueCamps.forEach(c => initialExpanded[c] = true);
                    setExpandedCampaigns(initialExpanded);
                }
            } catch (err) {
                console.error('Failed to load schedule data', err);
            }
        };
        loadData();
    }, [user?.id]);

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

    const displayCampaigns = Array.from(new Set([...allCampaigns, 'Unassigned']));

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
            pageDescription="Manage call schedules and view scheduled AI meetings."
        >
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
                                {displayCampaigns.map(campaign => (
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
                                                        <div className="flex flex-col space-y-2">
                                                            {call.outcome ? (
                                                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{call.outcome}</span>
                                                            ) : (
                                                                <span className="text-xs text-slate-400 italic">No feedback yet</span>
                                                            )}
                                                            {call.meetLink && (
                                                                <a
                                                                    href={call.meetLink}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-0.5"
                                                                >
                                                                    Join Google Meet
                                                                </a>
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
        </AppLayout>
    );
};

export default SchedulePage;
