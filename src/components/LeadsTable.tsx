import React, { useState } from 'react';
import {
    MagnifyingGlassIcon,
    FunnelIcon,
    ArrowUpTrayIcon,
    ArrowDownTrayIcon,
    PlusIcon,
    PencilSquareIcon,
    TrashIcon
} from '@heroicons/react/24/outline';

interface Lead {
    id: string;
    name: string;
    phone: string;
    email: string;
    status: 'Pending' | 'Completed' | 'Failed';
    attempts: number;
}

interface LeadsTableProps {
    leads: Lead[];
    onAddLead: () => void;
    onImportLeads: () => void;
    onEditLead: (lead: Lead) => void;
    onDeleteLead: (id: string) => void;
}

const LeadsTable: React.FC<LeadsTableProps> = ({ leads, onAddLead, onImportLeads, onEditLead, onDeleteLead }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All Status');

    const statusColors = {
        Pending: 'bg-slate-50 text-slate-500 border-slate-100 dark:bg-slate-900/50 dark:text-slate-400 dark:border-slate-800',
        Completed: 'bg-green-50 text-green-600 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/50',
        Failed: 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/50',
    };

    const filteredLeads = leads.filter(lead => {
        const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lead.phone.includes(searchTerm) ||
            lead.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = statusFilter === 'All Status' || lead.status === statusFilter;
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden mt-8">
            <div className="p-6 border-b border-slate-50 dark:border-slate-700/50 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">
                        Leads ({filteredLeads.length})
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative group">
                            <input
                                type="text"
                                placeholder="Search by name, phone or email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full md:w-64 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 pl-10 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                            />
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="relative">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="appearance-none bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 pr-10 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 outline-none transition-all cursor-pointer"
                                >
                                    <option>All Status</option>
                                    <option>Pending</option>
                                    <option>Completed</option>
                                    <option>Failed</option>
                                </select>
                                <FunnelIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                            <button className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-bold text-xs flex items-center gap-2">
                                <ArrowUpTrayIcon className="w-4 h-4" />
                                <span className="hidden sm:inline">Export</span>
                            </button>
                            <button
                                onClick={onImportLeads}
                                className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-bold text-xs flex items-center gap-2"
                            >
                                <ArrowDownTrayIcon className="w-4 h-4" />
                                <span className="hidden sm:inline">Import</span>
                            </button>
                            <button
                                onClick={onAddLead}
                                className="flex items-center space-x-2 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-primary/20 transform hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <PlusIcon className="h-4 w-4" />
                                <span className="text-sm">Add Lead</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50/50 dark:bg-slate-900/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 dark:border-slate-700/50">
                        <tr>
                            <th className="px-6 py-4">
                                <input type="checkbox" className="rounded-md border-slate-300 dark:border-slate-700 bg-transparent text-primary focus:ring-primary/20" />
                            </th>
                            <th className="px-6 py-4 font-black">Name</th>
                            <th className="px-6 py-4 font-black">Phone</th>
                            <th className="px-6 py-4 font-black">Email</th>
                            <th className="px-6 py-4 font-black">Status</th>
                            <th className="px-6 py-4 font-black">Attempts</th>
                            <th className="px-6 py-4 font-black text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                        {filteredLeads.map((lead) => (
                            <tr key={lead.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-all duration-200 group">
                                <td className="px-6 py-4 w-10">
                                    <input type="checkbox" className="rounded-md border-slate-300 dark:border-slate-700 bg-transparent text-primary focus:ring-primary/20" />
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm font-bold text-slate-800 dark:text-white group-hover:text-primary transition-colors">{lead.name}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm font-bold font-mono text-slate-600 dark:text-slate-400">{lead.phone}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm font-semibold text-slate-500 truncate max-w-[150px] inline-block">{lead.email}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border shadow-sm ${statusColors[lead.status]}`}>
                                        {lead.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-xs font-bold text-slate-500">{lead.attempts}</span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => onEditLead(lead)}
                                            className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                            title="Edit Lead"
                                        >
                                            <PencilSquareIcon className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => onDeleteLead(lead.id)}
                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                            title="Delete Lead"
                                        >
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredLeads.length === 0 && (
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-800">
                            <MagnifyingGlassIcon className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                        </div>
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No leads match your filters.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LeadsTable;
