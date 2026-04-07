import React from 'react';
import AppLayout from '../components/AppLayout';
import AdminSupportDashboard from '../components/AdminSupportDashboard';

const AdminSupportPage: React.FC = () => {
    return (
        <AppLayout
            breadcrumbs={[
                { label: 'Admin', path: '/admin/dashboard' },
                { label: 'Support' }
            ]}
            pageTitle="Support Management"
            pageDescription="Manage and respond to support tickets from users"
        >
            <AdminSupportDashboard />
        </AppLayout>
    );
};

export default AdminSupportPage;
