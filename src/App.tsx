import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import CampaignsPage from './pages/CampaignsPage';
import CampaignDetailPage from './pages/CampaignDetailPage';
import AgentPage from './pages/AgentPage';
import PhoneNoPage from './pages/PhoneNoPage';
import SettingsPage from './pages/SettingsPage';
import TwilioSettingsPage from './pages/TwilioSettingsPage';
import ApiPage from './pages/ApiPage';
import CreditsPage from './pages/CreditsPage';
import DashboardPage from './pages/DashboardPage';
import ReportsPage from './pages/ReportsPage';
import SchedulePage from './pages/SchedulePage';
import { Page } from './types';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminUserDetailPage from './pages/AdminUserDetailPage';

const App: React.FC = () => {
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [theme, setTheme] = useState(() => {
        const savedTheme = localStorage.getItem('ziya-theme');
        if (savedTheme) return savedTheme;
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';``
    });

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('ziya-theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    return (
        <ThemeProvider>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    {/* Admin Routes */}
                    <Route path="/admin/login" element={<AdminLoginPage />} />
                    <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
                    <Route path="/admin/users/:userId" element={<AdminUserDetailPage />} />
                    {/* User Routes */}
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                    <Route path="/campaigns" element={<ProtectedRoute><CampaignsPage /></ProtectedRoute>} />
                    <Route path="/campaigns/:id" element={<ProtectedRoute><CampaignDetailPage /></ProtectedRoute>} />
                    <Route path="/agents" element={<ProtectedRoute><AgentPage /></ProtectedRoute>} />
                    <Route path="/phone-numbers" element={<ProtectedRoute><PhoneNoPage /></ProtectedRoute>} />
                    <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
                    <Route path="/schedule" element={<ProtectedRoute><SchedulePage /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                    <Route path="/api" element={<ProtectedRoute><ApiPage /></ProtectedRoute>} />
                    <Route path="/credits" element={<ProtectedRoute><CreditsPage /></ProtectedRoute>} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
            </AuthProvider>
        </ThemeProvider>
    );
};

export default App;