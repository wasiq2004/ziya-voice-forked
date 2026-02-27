import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SIDEBAR_ITEMS, APP_VERSION } from '../constants';
import { Page } from '../types';
import { CreditCardIcon, ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import { getApiBaseUrl } from '../utils/api';
import CompanySwitcher from './CompanySwitcher';


interface SidebarProps {
    isCollapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, setCollapsed }) => {
    const { signOut, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [credits, setCredits] = useState<number | string>(0);
    const [loadingCredits, setLoadingCredits] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    // Check if user is admin
    useEffect(() => {
        const adminData = localStorage.getItem('admin');
        setIsAdmin(!!adminData);
    }, []);

    // Fetch user credits
    useEffect(() => {
        const fetchCredits = async () => {
            if (!user?.id) return;

            setLoadingCredits(true);
            try {
                const apiUrl = getApiBaseUrl();
                const response = await fetch(`${apiUrl}/api/wallet/balance/${user.id}`);
                const data = await response.json();

                if (data.success) {
                    setCredits(data.balance || 0); // Show exact balance, no rounding
                } else {
                    setCredits(0);
                }
            } catch (error) {
                console.error('Error fetching credits:', error);
                setCredits(0);
            } finally {
                setLoadingCredits(false);
            }
        };

        fetchCredits();
        // Credits refresh is now event-driven (see wallet_updated listener below)
    }, [user?.id]);

    // Listen for wallet_updated events (dispatched when a call ends or credits are added)
    useEffect(() => {
        if (!user?.id) return;

        const handleWalletUpdate = async () => {
            try {
                const apiUrl = getApiBaseUrl();
                const response = await fetch(`${apiUrl}/api/wallet/balance/${user.id}`);
                const data = await response.json();
                if (data.success) {
                    setCredits(data.balance || 0);
                }
            } catch (error) {
                console.error('Error refreshing credits:', error);
            }
        };

        window.addEventListener('wallet_updated', handleWalletUpdate);
        return () => window.removeEventListener('wallet_updated', handleWalletUpdate);
    }, [user?.id]);

    const handleLogout = async () => {
        try {
            await signOut();
            // Redirect to login page
            navigate('/login');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const getPagePath = (page: Page): string => {
        switch (page) {
            case Page.Dashboard:
                return '/dashboard';
            case Page.Campaigns:
                return '/campaigns';
            case Page.Agent:
                return '/agents';
            case Page.PhoneNo:
                return '/phone-numbers';
            case Page.Settings:
                return '/settings';
            case Page.API:
                return '/api';
            case Page.Credits:
                return '/credits';
            case Page.Reports:
                return '/reports';
            case Page.Schedule:
                return '/schedule';
            default:
                return '/dashboard';
        }
    };

    const getCurrentPage = (): Page => {
        const path = location.pathname;
        if (path === '/dashboard' || path === '/') return Page.Dashboard;
        if (path.startsWith('/campaigns')) return Page.Campaigns;
        if (path.startsWith('/agents')) return Page.Agent;
        if (path.startsWith('/phone-numbers')) return Page.PhoneNo;
        if (path.startsWith('/settings')) return Page.Settings;
        if (path.startsWith('/api')) return Page.API;
        if (path.startsWith('/credits')) return Page.Credits;
        if (path.startsWith('/reports')) return Page.Reports;
        if (path.startsWith('/schedule')) return Page.Schedule;

        return Page.Dashboard;
    };

    const activePage = getCurrentPage();

    return (
        <aside className={`fixed top-0 left-0 h-full bg-white dark:bg-darkbg-surface border-r border-slate-200 dark:border-slate-800/50 flex flex-col transition-all duration-300 ease-in-out z-20 font-sidebar ${isCollapsed ? 'w-20' : 'w-64'}`}>
            <div className={`flex flex-col border-b border-slate-200 dark:border-slate-800/50 px-4 py-3 mb-2 transition-all duration-300 ${isCollapsed ? 'items-center' : ''}`}>
                <div className="flex items-center space-x-2 mb-3">
                    <img src="/assets/ziya-logo.png" alt="Ziya Logo" className="w-8 h-8 flex-shrink-0" />
                    {!isCollapsed && <h1 className="text-xl font-bold text-slate-800 dark:text-white truncate">Ziya Voice</h1>}
                </div>
                <CompanySwitcher isCollapsed={isCollapsed} />
            </div>

            <nav className="flex-1 px-3 py-4 overflow-y-auto custom-scrollbar">
                <ul className="space-y-1">
                    {SIDEBAR_ITEMS.map((item, index) => (
                        <React.Fragment key={item.id}>
                            {/* Section Divider - Add after Dashboard and before Settings */}
                            {(index === 1 || index === 5) && (
                                <li className="my-3">
                                    <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>
                                </li>
                            )}

                            <li>
                                <a
                                    href="#"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        navigate(getPagePath(item.id));
                                    }}
                                    className={`
                                        relative flex items-center py-2.5 px-3 rounded-xl transition-all duration-300 group
                                        ${activePage === item.id
                                            ? 'bg-primary/15 text-primary font-bold shadow-sm shadow-primary/10'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-darkbg-light/50 hover:text-slate-900 dark:hover:text-white'
                                        }
                                    `}
                                >
                                    {/* Left Border Indicator for Active Item */}
                                    {activePage === item.id && (
                                        <div className="absolute left-1 top-2 bottom-2 w-1.5 bg-primary rounded-full shadow-[0_0_12px_rgba(26,115,232,0.6)]"></div>
                                    )}

                                    {/* Icon */}
                                    <div className={`
                                        flex-shrink-0 transition-transform duration-200
                                        ${activePage === item.id ? 'text-primary scale-110' : 'text-slate-500 dark:text-slate-400 group-hover:scale-105'}
                                    `}>
                                        <item.icon className="h-5 w-5" />
                                    </div>

                                    {/* Label */}
                                    <span className={`
                                        ml-3 text-sm transition-all duration-300 
                                        ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}
                                    `}>
                                        {item.id}
                                    </span>

                                    {/* Active Glow Indicator (subtle) */}
                                    {activePage === item.id && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent rounded-lg pointer-events-none"></div>
                                    )}
                                </a>
                            </li>
                        </React.Fragment>
                    ))}
                </ul>
            </nav>
            <div className="p-3 border-t border-gray-200 dark:border-gray-800">
                <a
                    href="#"
                    onClick={(e) => {
                        e.preventDefault();
                        navigate('/credits');
                    }}
                    className={`flex items-center p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-darkbg-light mb-1 ${isCollapsed ? 'justify-center' : ''}`}
                    aria-label="View credits and usage"
                >
                    <CreditCardIcon className="h-5 w-5 flex-shrink-0" />
                    <div className={`ml-4 overflow-hidden whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>
                        <span className="font-semibold block text-sm">{typeof credits === 'number' ? credits.toLocaleString() : credits}</span>
                        <span className="text-xs text-slate-500">Credits Remaining</span>
                    </div>
                </a>
                <button
                    onClick={handleLogout}
                    className={`flex items-center p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-darkbg-light w-full ${isCollapsed ? 'justify-center' : ''}`}
                    aria-label="Logout"
                >
                    <ArrowLeftOnRectangleIcon className="h-5 w-5 flex-shrink-0" />
                    <span className={`ml-4 text-sm font-medium transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>Logout</span>
                </button>
                <button
                    onClick={() => setCollapsed(!isCollapsed)}
                    className="w-full flex items-center justify-center p-2.5 rounded-xl text-slate-500 hover:bg-gray-100 dark:hover:bg-darkbg-light/50 transition-all mt-1 border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                    aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                </button>
                <div className={`mt-2 text-center text-xs text-slate-400 dark:text-slate-600 transition-opacity duration-300 ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>
                    v{APP_VERSION}
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;