import React from 'react';
import AppLayout from '../components/AppLayout';
import SupportCenter from '../components/SupportCenter';

const UserSupportPage: React.FC = () => {
    return (
        <AppLayout
            breadcrumbs={[
                { label: 'Dashboard', path: '/dashboard' },
                { label: 'Support' }
            ]}
            pageTitle="Support Center"
            pageDescription="Get help from our support team or raise technical issues"
        >
            <SupportCenter />
        </AppLayout>
    );
};

export default UserSupportPage;
