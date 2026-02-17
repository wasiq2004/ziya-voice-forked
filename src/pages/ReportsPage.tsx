import React, { useState, useMemo } from 'react';
import AppLayout from '../components/AppLayout';
import {
    ArrowDownTrayIcon,
    MagnifyingGlassIcon,
    ChevronUpIcon,
    ChevronDownIcon,
    CalendarDaysIcon,
    TagIcon,
    UserIcon,
    PhoneIcon,
    ArrowPathRoundedSquareIcon,
    CheckCircleIcon,
    XCircleIcon,
    EllipsisHorizontalIcon,
    TrashIcon,
    ArrowDownOnSquareIcon
} from '@heroicons/react/24/outline';

// Custom FunnelIcon component
const FunnelIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
    </svg>
);

interface ReportData {
    id: string;
    sNo: number;
    date: string;
    day: string;
    campaignId: string;
    agentName: string;
    calledNumber: string;
    type: 'Incoming' | 'Outbound';
    status: string;
    result: string;
    firstCallTime: string;
    followUpTime: string;
}

const ReportsPage: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'All' | 'Incoming' | 'Outbound'>('All');
    const [sortConfig, setSortConfig] = useState<{ key: keyof ReportData, direction: 'asc' | 'desc' } | null>({ key: 'sNo', direction: 'asc' });

    // Dropdown filters
    const [selectedCampaign, setSelectedCampaign] = useState('All Campaigns');
    const [selectedAgent, setSelectedAgent] = useState('All Agents');
    const [selectedStatus, setSelectedStatus] = useState('All Statuses');
    const [selectedResult, setSelectedResult] = useState('All Results');

    // Dummy Data
    const [reports, setReports] = useState<ReportData[]>([
        { id: '1', sNo: 1, date: '2026-02-13', day: 'Friday', campaignId: 'CAMP-001', agentName: 'Ziya AI', calledNumber: '+1 234 567 8901', type: 'Outbound', status: 'Completed', result: 'Interested', firstCallTime: '10:30 AM', followUpTime: '2:00 PM' },
        { id: '2', sNo: 2, date: '2026-02-13', day: 'Friday', campaignId: 'CAMP-002', agentName: 'ALPS AI', calledNumber: '+1 987 654 3210', type: 'Incoming', status: 'In-Progress', result: 'Pending', firstCallTime: '11:15 AM', followUpTime: 'Pending' },
        { id: '3', sNo: 3, date: '2026-02-12', day: 'Thursday', campaignId: 'CAMP-001', agentName: 'Ziya AI', calledNumber: '+44 20 7946 0958', type: 'Outbound', status: 'Failed', result: 'Busy', firstCallTime: '09:00 AM', followUpTime: 'N/A' },
        { id: '4', sNo: 4, date: '2026-02-12', day: 'Thursday', campaignId: 'CAMP-003', agentName: 'ALPS AI', calledNumber: '+91 98765 43210', type: 'Incoming', status: 'Completed', result: 'Not Interested', firstCallTime: '04:45 PM', followUpTime: 'None' },
        { id: '5', sNo: 5, date: '2026-02-11', day: 'Wednesday', campaignId: 'CAMP-002', agentName: 'Ziya AI', calledNumber: '+1 555 012 3456', type: 'Outbound', status: 'Completed', result: 'Scheduled', firstCallTime: '01:20 PM', followUpTime: 'Next Monday' },
    ]);

    const [openActionId, setOpenActionId] = useState<string | null>(null);

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this report?')) {
            setReports(prev => prev.filter(r => r.id !== id));
            setOpenActionId(null);
        }
    };

    const handleSort = (key: keyof ReportData) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const filteredAndSortedData = useMemo(() => {
        let data = [...reports];

        // Search Filter
        if (searchQuery) {
            data = data.filter(item =>
                item.agentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.campaignId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.calledNumber.includes(searchQuery)
            );
        }

        // Tab Filter
        if (activeTab !== 'All') {
            data = data.filter(item => item.type === activeTab);
        }

        // Dropdown Filters
        if (selectedCampaign !== 'All Campaigns') data = data.filter(item => item.campaignId === selectedCampaign);
        if (selectedAgent !== 'All Agents') data = data.filter(item => item.agentName === selectedAgent);
        if (selectedStatus !== 'All Statuses') data = data.filter(item => item.status === selectedStatus);
        if (selectedResult !== 'All Results') data = data.filter(item => item.result === selectedResult);

        // Sorting
        if (sortConfig !== null) {
            data.sort((a: any, b: any) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }

        return data;
    }, [reports, searchQuery, activeTab, selectedCampaign, selectedAgent, selectedStatus, selectedResult, sortConfig]);

    const sortIcon = (key: keyof ReportData) => {
        if (!sortConfig || sortConfig.key !== key) return <div className="w-3 h-3 ml-1 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />;
        return sortConfig.direction === 'asc' ?
            <ChevronUpIcon className="w-3 h-3 ml-1 text-primary" /> :
            <ChevronDownIcon className="w-3 h-3 ml-1 text-primary" />;
    };

    const exportBtn = (
        <button className="flex items-center space-x-2 bg-slate-900 dark:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-lg shadow-slate-900/10">
            <ArrowDownTrayIcon className="h-4 w-4" />
            <span>Export to Excel</span>
        </button>
    );

    return (
        <AppLayout
            breadcrumbs={[
                { label: 'Dashboard', path: '/dashboard' },
                { label: 'Reports' }
            ]}
            pageTitle="Reports"
            pageDescription="Comprehensive analysis of your voice interactions and campaign results."
            primaryAction={exportBtn}
        >
            <div className="space-y-6">
                {/* Statistics Summary */}
                <div className="flex items-center space-x-2 text-sm text-slate-500 font-medium">
                    <span className="font-bold text-slate-900 dark:text-white">Project:</span>
                    <span>Default Project</span>
                    <span className="mx-2">•</span>
                    <span className="font-bold text-slate-900 dark:text-white">{filteredAndSortedData.length}</span>
                    <span>total calls.</span>
                </div>

                {/* Filters Row 1: Tabs and Search */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 w-fit">
                        {['All', 'Incoming', 'Outbound'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`px-5 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${activeTab === tab
                                    ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="relative group min-w-[300px]">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by agent, campaign or number..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm font-medium w-full transition-all"
                        />
                    </div>
                </div>

                {/* Filters Row 2: Dropdowns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'All Campaigns', value: selectedCampaign, setter: setSelectedCampaign, options: ['All Campaigns', 'CAMP-001', 'CAMP-002', 'CAMP-003'] },
                        { label: 'All Agents', value: selectedAgent, setter: setSelectedAgent, options: ['All Agents', 'Ziya AI', 'ALPS AI'] },
                        { label: 'All Statuses', value: selectedStatus, setter: setSelectedStatus, options: ['All Statuses', 'Completed', 'In-Progress', 'Failed'] },
                        { label: 'All Results', value: selectedResult, setter: setSelectedResult, options: ['All Results', 'Interested', 'Scheduled', 'Not Interested', 'Busy', 'Pending'] },
                    ].map((filter, i) => (
                        <div key={i} className="relative">
                            <select
                                value={filter.value}
                                onChange={(e) => filter.setter(e.target.value)}
                                className="w-full pl-4 pr-10 py-2.5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 appearance-none focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all cursor-pointer"
                            >
                                {filter.options.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    ))}
                </div>

                {/* Data Table */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                                    <th onClick={() => handleSort('sNo')} className="px-6 py-4 cursor-pointer group hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors text-center w-20">
                                        <div className="flex items-center justify-center text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                                            S.No {sortIcon('sNo')}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('date')} className="px-6 py-4 cursor-pointer group hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors">
                                        <div className="flex items-center text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                                            Date / Day {sortIcon('date')}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('campaignId')} className="px-6 py-4 cursor-pointer group hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors">
                                        <div className="flex items-center text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                                            Campaign ID {sortIcon('campaignId')}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('agentName')} className="px-6 py-4 cursor-pointer group hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors">
                                        <div className="flex items-center text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                                            Agent {sortIcon('agentName')}
                                        </div>
                                    </th>
                                    <th className="px-6 py-4">
                                        <div className="flex items-center text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                                            Phone / Type
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('status')} className="px-6 py-4 cursor-pointer group hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors">
                                        <div className="flex items-center text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                                            Status {sortIcon('status')}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('result')} className="px-6 py-4 cursor-pointer group hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors">
                                        <div className="flex items-center text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                                            Result {sortIcon('result')}
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 text-right pr-6">
                                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                                            Actions
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {filteredAndSortedData.map((row) => (
                                    <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all group">
                                        <td className="px-6 py-4 text-sm font-bold text-slate-400 group-hover:text-primary transition-colors text-center">
                                            {row.sNo.toString().padStart(2, '0')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{row.date}</span>
                                                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-tight">{row.day}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                {row.campaignId}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                                    <UserIcon className="w-4 h-4" />
                                                </div>
                                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{row.agentName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{row.calledNumber}</span>
                                                <span className={`text-[10px] font-bold uppercase tracking-widest ${row.type === 'Incoming' ? 'text-blue-500' : 'text-purple-500'}`}>
                                                    {row.type}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center space-x-1.5">
                                                <div className={`w-1.5 h-1.5 rounded-full ${row.status === 'Completed' ? 'bg-green-500' :
                                                    row.status === 'In-Progress' ? 'bg-blue-500 animate-pulse' : 'bg-red-500'
                                                    }`} />
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{row.status}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${row.result === 'Interested' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                                row.result === 'Pending' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                                                    row.result === 'Scheduled' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                                                        'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                                }`}>
                                                {row.result}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right pr-6">
                                            <div className="relative">
                                                <button
                                                    onClick={() => setOpenActionId(openActionId === row.id ? null : row.id)}
                                                    className={`p-2 rounded-xl transition-all ${openActionId === row.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-primary hover:bg-primary/5'}`}
                                                >
                                                    <EllipsisHorizontalIcon className="w-5 h-5" />
                                                </button>

                                                {/* Action Dropdown */}
                                                {openActionId === row.id && (
                                                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                                        <button
                                                            onClick={() => {
                                                                console.log('Downloading call:', row.id);
                                                                setOpenActionId(null);
                                                            }}
                                                            className="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center space-x-3 transition-colors"
                                                        >
                                                            <ArrowDownOnSquareIcon className="w-4 h-4 text-primary" />
                                                            <span>Download Call</span>
                                                        </button>
                                                        <div className="my-1 border-t border-slate-100 dark:border-slate-700/50"></div>
                                                        <button
                                                            onClick={() => handleDelete(row.id)}
                                                            className="w-full px-4 py-2.5 text-left text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-3 transition-colors"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                            <span>Delete</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {filteredAndSortedData.length === 0 && (
                        <div className="py-20 text-center">
                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-800">
                                <ArrowPathRoundedSquareIcon className="w-8 h-8 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">No matching reports</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Try adjusting your filters or search query.</p>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
};

export default ReportsPage;
