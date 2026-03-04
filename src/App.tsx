import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import CampaignsPage from './pages/CampaignsPage';
import CampaignDetailPage from './pages/CampaignDetailPage';
import AgentPage from './pages/AgentPage';
import PhoneNoPage from './pages/PhoneNoPage';
import SettingsPage from './pages/SettingsPage';
import ApiPage from './pages/ApiPage';
import CreditsPage from './pages/CreditsPage';
import DashboardPage from './pages/DashboardPage';
import ReportsPage from './pages/ReportsPage';
import SchedulePage from './pages/SchedulePage';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminUserDetailPage from './pages/AdminUserDetailPage';
import AdminAuditLogsPage from './pages/AdminAuditLogsPage';
import AdminUsersPage from './pages/AdminUsersPage';

// AdminRoute: Redirect to admin login if no admin session found
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const adminData = localStorage.getItem('admin');
    if (!adminData) {
        return <Navigate to="/admin/login" replace />;
    }
    return <>{children}</>;
};

const App: React.FC = () => {
    return (
        <ThemeProvider>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    {/* Admin Routes - all protected by AdminRoute */}
                    <Route path="/admin/login" element={<AdminLoginPage />} />
                    <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
                    <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
                    <Route path="/admin/users/:userId" element={<AdminRoute><AdminUserDetailPage /></AdminRoute>} />
                    <Route path="/admin/logs" element={<AdminRoute><AdminAuditLogsPage /></AdminRoute>} />
                    {/* User Routes - all protected by ProtectedRoute */}
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
