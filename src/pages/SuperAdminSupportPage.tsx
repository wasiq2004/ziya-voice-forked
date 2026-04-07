import React from 'react';
import AppLayout from '../components/AppLayout';
import AdminSupportDashboard from '../components/AdminSupportDashboard';

const SuperAdminSupportPage: React.FC = () => {
    return (
        <AppLayout
            breadcrumbs={[
                { label: 'Super Admin', path: '/superadmin/dashboard' },
                { label: 'Support' }
            ]}
            pageTitle="Support Management"
            pageDescription="Manage all support tickets across all organizations"
        >
            <AdminSupportDashboard />
        </AppLayout>
    );
};

export default SuperAdminSupportPage;
