import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { agentService } from '../services/agentService';
import { phoneNumberService } from '../services/phoneNumberService';
import { useAuth } from '../contexts/AuthContext';
import AppLayout from '../components/AppLayout';
import {
    UserGroupIcon,
    PhoneIcon,
    SignalIcon,
    BanknotesIcon,
    PlusIcon,
    ChartBarIcon,
    Cog6ToothIcon,
    ArrowPathIcon,
    ClockIcon
} from '@heroicons/react/24/outline';

const DashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const [agentCount, setAgentCount] = useState(0);
    const [phoneNumberCount, setPhoneNumberCount] = useState(0);
    const [activeCalls, setActiveCalls] = useState(0);
    const [credits, setCredits] = useState<number | string>('--');
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const { user } = useAuth();

    useEffect(() => {
        // Check if user is admin
        const adminData = localStorage.getItem('admin');
        setIsAdmin(!!adminData);

        if (user) {
            loadData();
        }
    }, [user]);

    const loadData = async () => {
        try {
            setLoading(true);

            // Fetch agents
            const agents = await agentService.getAgents(user!.id);
            setAgentCount(agents.length);

            // Fetch phone numbers
            const phoneNumbers = await phoneNumberService.getPhoneNumbers(user!.id);
            setPhoneNumberCount(phoneNumbers.length);

            // TODO: Fetch active calls from API when endpoint is available
            // For now, we'll use a placeholder value
            setActiveCalls(0);


        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <AppLayout
                breadcrumbs={[{ label: 'Dashboard' }]}
                pageTitle="Dashboard"
                pageDescription="Welcome back, let's see what's happening today."
            >
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout
            breadcrumbs={[{ label: 'Dashboard' }]}
            pageTitle="Dashboard"
            pageDescription="Complete overview of your voice AI agents and campaign performance."
        >

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 stagger-children">
                <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6 card-animate hover:shadow-md transition-all duration-300">
                    <div className="flex items-center">
                        <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3">
                            <UserGroupIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="ml-4">
                            <h3 className="text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Agents</h3>
                            <p className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white mt-1">{agentCount}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6 card-animate hover:shadow-md transition-all duration-300">
                    <div className="flex items-center">
                        <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-3">
                            <PhoneIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="ml-4">
                            <h3 className="text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Calls</h3>
                            <p className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white mt-1">{activeCalls}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6 card-animate hover:shadow-md transition-all duration-300">
                    <div className="flex items-center">
                        <div className="rounded-xl bg-yellow-50 dark:bg-yellow-900/20 p-3">
                            <SignalIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div className="ml-4">
                            <h3 className="text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Phone Numbers</h3>
                            <p className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white mt-1">{phoneNumberCount}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6 card-animate hover:shadow-md transition-all duration-300">
                    <div className="flex items-center">
                        <div className="rounded-xl bg-purple-50 dark:bg-purple-900/20 p-3">
                            <BanknotesIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="ml-4">
                            <h3 className="text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Credits</h3>
                            <p className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white mt-1">{credits}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 stagger-children">
                <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6">
                    <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white mb-6">Recent Activity</h2>
                    <div className="space-y-4">
                        <div className="flex items-start">
                            <div className="flex-shrink-0">
                                <div className="h-2.5 w-2.5 rounded-full bg-green-500 mt-2"></div>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-bold text-slate-800 dark:text-white">Dashboard synchronized</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Just now</p>
                            </div>
                        </div>
                        <div className="flex items-start">
                            <div className="flex-shrink-0">
                                <div className="h-2.5 w-2.5 rounded-full bg-blue-500 mt-2"></div>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-bold text-slate-800 dark:text-white">Agent performance data updated</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">2 minutes ago</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6">
                    <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white mb-6">Quick Actions</h2>
                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                        <button
                            onClick={() => navigate('/agents')}
                            className="group flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 transform hover:scale-[1.02]">
                            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                <PlusIcon className="h-6 w-6" />
                            </div>
                            <span className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-300 tracking-tight">Create Agent</span>
                        </button>
                        <button
                            onClick={() => navigate('/phone-numbers')}
                            className="group flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 transform hover:scale-[1.02]">
                            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                <PhoneIcon className="h-6 w-6" />
                            </div>
                            <span className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-300 tracking-tight">Import Number</span>
                        </button>
                        <button
                            onClick={() => navigate('/campaigns')}
                            className="group flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 transform hover:scale-[1.02]">
                            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                <ChartBarIcon className="h-6 w-6" />
                            </div>
                            <span className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-300 tracking-tight">View Reports</span>
                        </button>
                        <button
                            onClick={() => navigate('/settings')}
                            className="group flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 transform hover:scale-[1.02]">
                            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                <Cog6ToothIcon className="h-6 w-6" />
                            </div>
                            <span className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-300 tracking-tight">Settings</span>
                        </button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};

export default DashboardPage;