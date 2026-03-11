import { getApiBaseUrl } from './api';
import { Organization, OrgAdmin } from '../types';

const API_BASE_URL = `${getApiBaseUrl()}/api`;

// ==================== Super Admin API ====================

/** Get super admin dashboard stats */
export const getSuperAdminStats = async () => {
    const response = await fetch(`${API_BASE_URL}/superadmin/stats`);
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) throw new Error('Non-JSON response');
    if (!response.ok) {
        const e = await response.json();
        throw new Error(e.message || 'Failed to fetch super admin stats');
    }
    return response.json();
};

/** List all organizations */
export const listOrganizations = async (): Promise<Organization[]> => {
    const response = await fetch(`${API_BASE_URL}/superadmin/organizations`);
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) throw new Error('Non-JSON response');
    if (!response.ok) {
        const e = await response.json();
        throw new Error(e.message || 'Failed to fetch organizations');
    }
    const data = await response.json();
    return data.organizations;
};

/** Create an organization */
export const createOrganization = async (
    name: string,
    createdBy: string
): Promise<Organization> => {
    const response = await fetch(`${API_BASE_URL}/superadmin/organizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, createdBy }),
    });
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) throw new Error('Non-JSON response');
    if (!response.ok) {
        const e = await response.json();
        throw new Error(e.message || 'Failed to create organization');
    }
    const data = await response.json();
    return data.organization;
};

/** Update an organization */
export const updateOrganization = async (
    orgId: number,
    payload: { name?: string; status?: string }
): Promise<Organization> => {
    const response = await fetch(`${API_BASE_URL}/superadmin/organizations/${orgId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) throw new Error('Non-JSON response');
    if (!response.ok) {
        const e = await response.json();
        throw new Error(e.message || 'Failed to update organization');
    }
    const data = await response.json();
    return data.organization;
};

/** Disable (deactivate) an organization */
export const disableOrganization = async (orgId: number): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/superadmin/organizations/${orgId}/disable`, {
        method: 'PATCH',
    });
    if (!response.ok) {
        const e = await response.json();
        throw new Error(e.message || 'Failed to disable organization');
    }
};

/** List all org admins */
export const listOrgAdmins = async (): Promise<OrgAdmin[]> => {
    const response = await fetch(`${API_BASE_URL}/superadmin/org-admins`);
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) throw new Error('Non-JSON response');
    if (!response.ok) {
        const e = await response.json();
        throw new Error(e.message || 'Failed to fetch org admins');
    }
    const data = await response.json();
    return data.orgAdmins;
};

/** Create an org admin */
export const createOrgAdmin = async (payload: {
    email: string;
    username: string;
    password: string;
    organization_id: number;
}): Promise<OrgAdmin> => {
    const response = await fetch(`${API_BASE_URL}/superadmin/org-admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) throw new Error('Non-JSON response');
    if (!response.ok) {
        const e = await response.json();
        throw new Error(e.message || 'Failed to create org admin');
    }
    const data = await response.json();
    return data.orgAdmin;
};

/** List all users (super admin view) */
export const listAllUsers = async (
    page = 1,
    limit = 50,
    search = '',
    orgId?: number
): Promise<{ users: any[]; pagination: any }> => {
    const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search,
    });
    if (orgId) params.set('orgId', orgId.toString());
    const response = await fetch(`${API_BASE_URL}/superadmin/users?${params}`);
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) throw new Error('Non-JSON response');
    if (!response.ok) {
        const e = await response.json();
        throw new Error(e.message || 'Failed to fetch users');
    }
    const data = await response.json();
    return { users: data.users, pagination: data.pagination };
};

/** Block/unblock a user (super admin) */
export const blockUser = async (userId: string, status: 'active' | 'locked'): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/superadmin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
    });
    if (!response.ok) {
        const e = await response.json();
        throw new Error(e.message || 'Failed to update user status');
    }
};

/** Assign plan to user (super admin) */
export const superAdminAssignPlan = async (userId: string, planId: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/superadmin/users/${userId}/assign-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
    });
    if (!response.ok) {
        const e = await response.json();
        throw new Error(e.message || 'Failed to assign plan');
    }
};
