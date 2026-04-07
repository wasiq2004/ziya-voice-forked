import React, { useEffect, useMemo, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

type SupportRole = 'user' | 'org_admin' | 'super_admin';
type SupportStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';
type SupportPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

interface SupportCenterProps {
  mode?: 'auto' | 'user' | 'admin';
}

interface CurrentUser {
  id: string;
  role: SupportRole;
  organization_id?: number | null;
  username?: string;
  email?: string;
}

interface Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  category: string;
  priority: SupportPriority;
  status: SupportStatus;
  message: string;
  created_by?: string;
  created_by_name?: string;
  created_by_role?: SupportRole;
  escalated_to_super_admin?: boolean;
  escalated_at?: string | null;
  escalated_by?: string | null;
  assigned_to?: string | null;
  unread_messages?: number;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  sender_id: string;
  sender_role: SupportRole;
  sender_name?: string;
  message: string;
  created_at: string;
  message_type?: string;
}

interface Attachment {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  uploaded_by: string;
}

interface SupportStats {
  total: number;
  open_count: number;
  in_progress_count: number;
  resolved_count: number;
  closed_count: number;
}

const STATUS_OPTIONS: SupportStatus[] = ['Open', 'In Progress', 'Resolved', 'Closed'];
const PRIORITY_OPTIONS: SupportPriority[] = ['Low', 'Medium', 'High', 'Urgent'];
const CATEGORY_OPTIONS = ['Technical', 'Billing', 'General', 'Feature Request'];
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const normalizeSupportRole = (role?: string): SupportRole => {
  if (role === 'super_admin') return 'super_admin';
  if (role === 'org_admin' || role === 'admin' || role === 'billing') return 'org_admin';
  return 'user';
};

const getStoredUser = (): CurrentUser | null => {
  try {
    const stored = localStorage.getItem('ziya-user');
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        id: parsed.id,
        role: normalizeSupportRole(parsed.role),
        organization_id: parsed.organization_id ?? null,
        username: parsed.username,
        email: parsed.email
      };
    }
  } catch (error) {
    console.error('Failed to parse stored user', error);
  }

  const legacyUserId = localStorage.getItem('userId');
  const legacyRole = localStorage.getItem('userRole') as SupportRole | null;
  const legacyOrganizationId = localStorage.getItem('organizationId');

  if (!legacyUserId || !legacyRole) {
    return null;
  }

  return {
    id: legacyUserId,
    role: normalizeSupportRole(legacyRole),
    organization_id: legacyOrganizationId ? Number(legacyOrganizationId) : null
  };
};

const badgeStyles = {
  Open: 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/50',
  'In Progress': 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/50',
  Resolved: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/50',
  Closed: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
} as const;

const priorityStyles = {
  Low: 'bg-emerald-500',
  Medium: 'bg-amber-500',
  High: 'bg-orange-500',
  Urgent: 'bg-red-500'
} as const;

const statStyles = [
  'from-primary to-blue-600 shadow-primary/20',
  'from-red-500 to-rose-500 shadow-red-500/20',
  'from-amber-500 to-yellow-500 shadow-amber-500/20',
  'from-emerald-500 to-green-500 shadow-emerald-500/20',
  'from-slate-500 to-slate-700 shadow-slate-500/20'
];

const formatDate = (value?: string) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
};

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  return new Date(value).toLocaleString();
};

const formatFileSize = (bytes: number) => {
  if (!bytes) return '0 KB';
  const units = ['Bytes', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, index);
  return `${size.toFixed(size >= 100 || index === 0 ? 0 : 1)} ${units[index]}`;
};

const roleLabel = (role?: string) => {
  if (role === 'super_admin') return 'Super Admin';
  if (role === 'org_admin') return 'Org Admin';
  return 'User';
};

export const SupportCenter: React.FC<SupportCenterProps> = ({ mode = 'auto' }) => {
  const currentUser = useMemo(() => getStoredUser(), []);
  const currentRole = currentUser?.role || 'user';
  const isAdminMode = mode === 'admin' || (mode === 'auto' && currentRole !== 'user');
  const canEditTickets = currentRole === 'org_admin' || currentRole === 'super_admin';
  const canEscalateTickets = currentRole === 'org_admin';
  const organizationId = currentUser?.organization_id ?? undefined;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [stats, setStats] = useState<SupportStats | null>(null);

  const [loadingTickets, setLoadingTickets] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingTicket, setSavingTicket] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'priority'>('recent');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [ticketForm, setTicketForm] = useState({
    subject: '',
    category: 'Technical',
    priority: 'Medium' as SupportPriority,
    message: ''
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const [editForm, setEditForm] = useState({
    subject: '',
    category: 'Technical',
    priority: 'Medium' as SupportPriority,
    status: 'Open' as SupportStatus,
    message: '',
    assigned_to: ''
  });
  const [replyMessage, setReplyMessage] = useState('');

  const showBanner = (message: string, kind: 'success' | 'error') => {
    if (kind === 'success') {
      setSuccessMessage(message);
      setError(null);
    } else {
      setError(message);
      setSuccessMessage(null);
    }
  };

  const fetchStats = async () => {
    if (!isAdminMode) return;

    try {
      const params = new URLSearchParams();
      params.set('viewer_role', currentRole);
      if (currentRole === 'org_admin' && organizationId) {
        params.set('organization_id', String(organizationId));
      }
      const query = `?${params.toString()}`;
      const response = await fetch(`${API_BASE_URL}/api/v2/support/stats${query}`);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to load support stats');
      }
      setStats(data.stats);
    } catch (err: any) {
      console.error('Error fetching support stats:', err);
      showBanner(err.message || 'Failed to load support stats', 'error');
    }
  };

  const fetchTickets = async (preserveSelection = true) => {
    if (!currentUser) {
      showBanner('Unable to determine the logged-in user for support access.', 'error');
      return;
    }

    setLoadingTickets(true);
    try {
      const params = new URLSearchParams({
        created_by: currentUser.id,
        created_by_role: currentUser.role,
        limit: '100'
      });

      if (organizationId) {
        params.set('organization_id', String(organizationId));
      }
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const response = await fetch(`${API_BASE_URL}/api/v2/support/tickets?${params.toString()}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to load tickets');
      }

      let nextTickets = Array.isArray(data.tickets) ? data.tickets : [];
      if (sortBy === 'priority') {
        const priorityOrder: Record<SupportPriority, number> = { Low: 1, Medium: 2, High: 3, Urgent: 4 };
        nextTickets = [...nextTickets].sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);
      }

      setTickets(nextTickets);

      if (preserveSelection && selectedTicket) {
        const refreshedSelected = nextTickets.find((ticket: Ticket) => ticket.id === selectedTicket.id);
        if (refreshedSelected) {
          setSelectedTicket(prev => prev ? { ...prev, ...refreshedSelected } : refreshedSelected);
        }
      }
    } catch (err: any) {
      console.error('Error fetching tickets:', err);
      showBanner(err.message || 'Failed to load tickets', 'error');
    } finally {
      setLoadingTickets(false);
    }
  };

  const fetchTicketDetail = async (ticketId: string, silent = false) => {
    if (!silent) {
      setLoadingDetail(true);
    }

    try {
      const params = new URLSearchParams();
      if (currentUser?.id) params.set('created_by', currentUser.id);
      if (currentUser?.role) params.set('created_by_role', currentUser.role);
      if (organizationId) params.set('organization_id', String(organizationId));

      const response = await fetch(`${API_BASE_URL}/api/v2/support/tickets/${ticketId}?${params.toString()}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to load ticket');
      }

      const nextTicket = data.ticket as Ticket;
      setSelectedTicket(nextTicket);
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setAttachments(Array.isArray(data.attachments) ? data.attachments : []);
      setEditForm({
        subject: nextTicket.subject || '',
        category: nextTicket.category || 'Technical',
        priority: nextTicket.priority || 'Medium',
        status: nextTicket.status || 'Open',
        message: nextTicket.message || '',
        assigned_to: nextTicket.assigned_to || ''
      });
    } catch (err: any) {
      console.error('Error fetching ticket detail:', err);
      showBanner(err.message || 'Failed to open ticket', 'error');
    } finally {
      if (!silent) {
        setLoadingDetail(false);
      }
    }
  };

  const createTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser) return;
    if (!ticketForm.subject.trim() || !ticketForm.message.trim()) {
      showBanner('Subject and message are required.', 'error');
      return;
    }

    setCreatingTicket(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/support/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...ticketForm,
          subject: ticketForm.subject.trim(),
          message: ticketForm.message.trim(),
          created_by: currentUser.id,
          created_by_role: currentUser.role,
          organization_id: organizationId ?? null
        })
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to create ticket');
      }

      const ticketId = data.ticketId as string;

      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const upload = new FormData();
          upload.append('file', file);
          upload.append('uploaded_by', currentUser.id);
          upload.append('uploaded_by_role', currentUser.role);

          const uploadResponse = await fetch(`${API_BASE_URL}/api/v2/support/tickets/${ticketId}/attachments`, {
            method: 'POST',
            body: upload
          });
          const uploadData = await uploadResponse.json();
          if (!uploadResponse.ok || !uploadData.success) {
            throw new Error(uploadData.message || `Failed to upload ${file.name}`);
          }
        }
      }

      setTicketForm({
        subject: '',
        category: 'Technical',
        priority: 'Medium',
        message: ''
      });
      setSelectedFiles([]);
      setShowCreateForm(false);
      showBanner(`Ticket ${data.ticketNumber} created successfully.`, 'success');
      await fetchTickets(false);
      await fetchTicketDetail(ticketId);
      if (isAdminMode) {
        await fetchStats();
      }
    } catch (err: any) {
      console.error('Error creating ticket:', err);
      showBanner(err.message || 'Failed to create ticket', 'error');
    } finally {
      setCreatingTicket(false);
    }
  };

  const saveTicketChanges = async () => {
    if (!selectedTicket || !canEditTickets || !currentUser) return;

    setSavingTicket(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/support/tickets/${selectedTicket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          subject: editForm.subject.trim(),
          category: editForm.category.trim(),
          message: editForm.message.trim(),
          assigned_to: editForm.assigned_to.trim() || null,
          updated_by: currentUser.id,
          updated_by_role: currentUser.role
        })
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to update ticket');
      }

      showBanner('Ticket updated successfully.', 'success');
      await fetchTickets();
      await fetchTicketDetail(selectedTicket.id, true);
      if (isAdminMode) {
        await fetchStats();
      }
    } catch (err: any) {
      console.error('Error updating ticket:', err);
      showBanner(err.message || 'Failed to update ticket', 'error');
    } finally {
      setSavingTicket(false);
    }
  };

  const sendReply = async () => {
    if (!selectedTicket || !currentUser || !replyMessage.trim()) return;

    setSendingReply(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/support/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: currentUser.id,
          sender_role: currentUser.role,
          message: replyMessage.trim()
        })
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to send message');
      }

      setReplyMessage('');
      await fetchTicketDetail(selectedTicket.id, true);
      await fetchTickets();
      if (isAdminMode) {
        await fetchStats();
      }
    } catch (err: any) {
      console.error('Error sending reply:', err);
      showBanner(err.message || 'Failed to send message', 'error');
    } finally {
      setSendingReply(false);
    }
  };

  const uploadAttachment = async (file: File) => {
    if (!selectedTicket || !currentUser) return;

    setUploadingAttachment(true);
    try {
      const upload = new FormData();
      upload.append('file', file);
      upload.append('uploaded_by', currentUser.id);
      upload.append('uploaded_by_role', currentUser.role);

      const response = await fetch(`${API_BASE_URL}/api/v2/support/tickets/${selectedTicket.id}/attachments`, {
        method: 'POST',
        body: upload
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to upload attachment');
      }

      showBanner('Attachment uploaded successfully.', 'success');
      await fetchTicketDetail(selectedTicket.id, true);
      await fetchTickets();
    } catch (err: any) {
      console.error('Error uploading attachment:', err);
      showBanner(err.message || 'Failed to upload attachment', 'error');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const escalateTicket = async () => {
    if (!selectedTicket || !currentUser || !canEscalateTickets || selectedTicket.escalated_to_super_admin) {
      return;
    }

    setSavingTicket(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/support/tickets/${selectedTicket.id}/escalate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          escalated_by: currentUser.id
        })
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to push ticket to super admin');
      }

      showBanner('Ticket pushed to super admin successfully.', 'success');
      await fetchTickets();
      await fetchTicketDetail(selectedTicket.id, true);
      await fetchStats();
    } catch (err: any) {
      console.error('Error escalating ticket:', err);
      showBanner(err.message || 'Failed to push ticket to super admin', 'error');
    } finally {
      setSavingTicket(false);
    }
  };

  useEffect(() => {
    fetchTickets(false);
    if (isAdminMode) {
      fetchStats();
    }
  }, [statusFilter, priorityFilter, sortBy]);

  useEffect(() => {
    if (!selectedTicket) return;

    const interval = window.setInterval(() => {
      fetchTicketDetail(selectedTicket.id, true);
      fetchTickets();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [selectedTicket?.id]);

  const banner = error || successMessage;
  const visibleTickets = tickets;
  const accessQuery = new URLSearchParams();
  if (currentUser?.id) accessQuery.set('created_by', currentUser.id);
  if (currentUser?.role) accessQuery.set('created_by_role', currentUser.role);
  if (organizationId) accessQuery.set('organization_id', String(organizationId));

  return (
    <div className="space-y-6">
      {banner && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
            error
              ? 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/50'
              : 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/50'
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <span>{banner}</span>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setSuccessMessage(null);
              }}
              className="text-xs font-bold uppercase tracking-wide opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {isAdminMode && stats && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: 'Total Tickets', value: stats.total },
            { label: 'Open', value: stats.open_count },
            { label: 'In Progress', value: stats.in_progress_count },
            { label: 'Resolved', value: stats.resolved_count },
            { label: 'Closed', value: stats.closed_count }
          ].map((item, index) => (
            <div
              key={item.label}
              className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${statStyles[index]} p-5 text-white shadow-lg`}
            >
              <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
              <div className="text-xs font-black uppercase tracking-[0.18em] text-white/75">{item.label}</div>
              <div className="mt-4 text-3xl font-black">{item.value ?? 0}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800/50">
            <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    {isAdminMode ? 'Support Workspace' : 'My Tickets'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {isAdminMode
                      ? 'Open, edit, assign, and respond to support tickets.'
                      : 'Create tickets and stay on top of replies from support.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(prev => !prev)}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary-dark"
                >
                  {showCreateForm ? 'Close Form' : 'New Ticket'}
                </button>
              </div>
            </div>

            <div className="space-y-4 p-6">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Search
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={searchTerm}
                      onChange={event => setSearchTerm(event.target.value)}
                      placeholder="Ticket number, subject, or description"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => fetchTickets(false)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      Search
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={event => setStatusFilter(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
                  >
                    <option value="">All Status</option>
                    {STATUS_OPTIONS.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Priority
                  </label>
                  <select
                    value={priorityFilter}
                    onChange={event => setPriorityFilter(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
                  >
                    <option value="">All Priority</option>
                    {PRIORITY_OPTIONS.map(option => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    Sort
                  </label>
                  <select
                    value={sortBy}
                    onChange={event => setSortBy(event.target.value as 'recent' | 'priority')}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
                  >
                    <option value="recent">Most Recent</option>
                    <option value="priority">Priority</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('');
                      setPriorityFilter('');
                      setSortBy('recent');
                      fetchTickets(false);
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
 
              {showCreateForm && (
                <form
                  onSubmit={createTicket}
                  className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-900/50"
                >
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">Create Ticket</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Raise a new issue with details and attachments.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">Subject</label>
                      <input
                        value={ticketForm.subject}
                        onChange={event => setTicketForm(prev => ({ ...prev, subject: event.target.value }))}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        placeholder="Brief summary of the issue"
                        maxLength={255}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">Category</label>
                      <select
                        value={ticketForm.category}
                        onChange={event => setTicketForm(prev => ({ ...prev, category: event.target.value }))}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        {CATEGORY_OPTIONS.map(option => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">Priority</label>
                      <select
                        value={ticketForm.priority}
                        onChange={event => setTicketForm(prev => ({ ...prev, priority: event.target.value as SupportPriority }))}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        {PRIORITY_OPTIONS.map(option => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">Message</label>
                      <textarea
                        value={ticketForm.message}
                        onChange={event => setTicketForm(prev => ({ ...prev, message: event.target.value }))}
                        rows={5}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        placeholder="Explain the issue clearly so support can act on it."
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">Attachments</label>
                      <input
                        type="file"
                        multiple
                        onChange={event => {
                          const incoming = Array.from(event.target.files || []);
                          const valid = incoming.filter(file => {
                            if (file.size > MAX_FILE_SIZE) {
                              showBanner(`${file.name} exceeds the 50MB limit.`, 'error');
                              return false;
                            }
                            return true;
                          });
                          setSelectedFiles(valid);
                        }}
                        className="block w-full rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      />
                      {selectedFiles.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {selectedFiles.map(file => (
                            <div
                              key={`${file.name}-${file.size}`}
                              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                            >
                              <span className="truncate font-medium text-slate-700 dark:text-slate-200">{file.name}</span>
                              <span className="ml-4 shrink-0 text-slate-500 dark:text-slate-400">{formatFileSize(file.size)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="submit"
                      disabled={creatingTicket}
                      className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {creatingTicket ? 'Creating Ticket...' : 'Create Ticket'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false);
                        setSelectedFiles([]);
                      }}
                      className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </section>
 
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800/50">
            <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Tickets ({visibleTickets.length})
                </h3>
                {loadingTickets && <span className="text-sm text-slate-500 dark:text-slate-400">Refreshing...</span>}
              </div>
            </div>

            <div className="max-h-[820px] overflow-y-auto p-4">
              {visibleTickets.length === 0 && !loadingTickets ? (
                <div className="rounded-3xl border-2 border-dashed border-slate-200 px-6 py-12 text-center dark:border-slate-700">
                  <div className="text-lg font-black text-slate-900 dark:text-white">No tickets found</div>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Adjust the filters or create a new support ticket.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleTickets.map(ticket => (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => fetchTicketDetail(ticket.id)}
                      className={`w-full rounded-3xl border p-5 text-left transition-all ${
                        selectedTicket?.id === ticket.id
                          ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
                          : 'border-slate-200 bg-white hover:border-primary/30 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-primary">
                            {ticket.ticket_number}
                          </div>
                          <div className="truncate text-base font-black text-slate-900 dark:text-white">{ticket.subject}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${badgeStyles[ticket.status]}`}>
                              {ticket.status}
                            </span>
                            <span className={`rounded-full px-3 py-1 text-xs font-bold text-white ${priorityStyles[ticket.priority]}`}>
                              {ticket.priority}
                            </span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                              {ticket.category}
                            </span>
                          </div>
                        </div>

                        {ticket.unread_messages ? (
                          <span className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-black text-white">
                            {ticket.unread_messages}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-4 grid gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <div className="flex items-center justify-between gap-4">
                          <span>{ticket.created_by_name || roleLabel(ticket.created_by_role)}</span>
                          <span>{formatDate(ticket.updated_at)}</span>
                        </div>
                        {ticket.escalated_to_super_admin && (
                          <div className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                            Escalated To Super Admin
                          </div>
                        )}
                        {ticket.assigned_to && (
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                            Assigned: {ticket.assigned_to}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
 
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800/50">
          {!selectedTicket ? (
            <div className="flex min-h-[640px] flex-col items-center justify-center px-8 py-16 text-center">
              <div className="rounded-full bg-primary/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-primary">
                Support
              </div>
              <h3 className="mt-5 text-2xl font-black text-slate-900 dark:text-white">Open a ticket to work on it</h3>
              <p className="mt-3 max-w-md text-sm text-slate-500 dark:text-slate-400">
                Select a ticket from the left to view the conversation, attachments, and editable ticket details.
              </p>
            </div>
          ) : loadingDetail ? (
            <div className="flex min-h-[640px] items-center justify-center text-slate-500 dark:text-slate-400">
              Loading ticket...
            </div>
          ) : (
            <div className="flex min-h-[640px] flex-col">
              <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-primary">
                      {selectedTicket.ticket_number}
                    </div>
                    <h3 className="mt-3 text-2xl font-black text-slate-900 dark:text-white">{selectedTicket.subject}</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold ${badgeStyles[selectedTicket.status]}`}>
                        {selectedTicket.status}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold text-white ${priorityStyles[selectedTicket.priority]}`}>
                        {selectedTicket.priority}
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        {selectedTicket.category}
                      </span>
                      {selectedTicket.escalated_to_super_admin && (
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:border-blue-800/50 dark:bg-blue-900/20 dark:text-blue-300">
                          Escalated To Super Admin
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <div>Created: {formatDateTime(selectedTicket.created_at)}</div>
                    <div>Updated: {formatDateTime(selectedTicket.updated_at)}</div>
                    <div>Raised By: {selectedTicket.created_by_name || roleLabel(selectedTicket.created_by_role)}</div>
                  </div>
                </div>
              </div>

              <div className="grid flex-1 gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-6">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-700 dark:bg-slate-900/40">
                    <h4 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Ticket Summary
                    </h4>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">
                      {selectedTicket.message || 'No description provided.'}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/30">
                    <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                      <h4 className="text-base font-black text-slate-900 dark:text-white">Conversation</h4>
                    </div>

                    <div className="max-h-[420px] space-y-4 overflow-y-auto px-5 py-5">
                      {messages.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                          No replies yet.
                        </div>
                      ) : (
                        messages.map(message => {
                          const isCurrentUser = message.sender_id === currentUser?.id;
                          return (
                            <div key={message.id} className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                              <div
                                className={`max-w-[85%] rounded-3xl px-4 py-3 ${
                                  isCurrentUser
                                    ? 'bg-primary text-white shadow-lg shadow-primary/15'
                                    : 'border border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                                }`}
                              >
                                <div className={`text-[11px] font-black uppercase tracking-[0.16em] ${isCurrentUser ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'}`}>
                                  {message.sender_name || roleLabel(message.sender_role)}
                                </div>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.message}</p>
                                <div className={`mt-2 text-xs ${isCurrentUser ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>
                                  {formatDateTime(message.created_at)}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="border-t border-slate-100 px-5 py-5 dark:border-slate-800">
                      <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">Reply</label>
                      <textarea
                        value={replyMessage}
                        onChange={event => setReplyMessage(event.target.value)}
                        rows={4}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        placeholder="Write a reply to this ticket"
                      />
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          onClick={sendReply}
                          disabled={sendingReply || !replyMessage.trim()}
                          className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {sendingReply ? 'Sending...' : 'Send Reply'}
                        </button>

                        <label className="cursor-pointer rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                          {uploadingAttachment ? 'Uploading...' : 'Attach File'}
                          <input
                            type="file"
                            className="hidden"
                            onChange={event => {
                              const file = event.target.files?.[0];
                              if (!file) return;
                              if (file.size > MAX_FILE_SIZE) {
                                showBanner(`${file.name} exceeds the 50MB limit.`, 'error');
                                return;
                              }
                              uploadAttachment(file);
                              event.currentTarget.value = '';
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
 
                <div className="space-y-6">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/30">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-base font-black text-slate-900 dark:text-white">Ticket Details</h4>
                      {canEditTickets && (
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-primary">
                          Editable
                        </span>
                      )}
                    </div>

                    {canEditTickets ? (
                      <div className="mt-5 space-y-4">
                        {canEscalateTickets && (
                          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-900/20">
                            <div className="flex flex-col gap-3">
                              <div>
                                <div className="text-sm font-black text-blue-900 dark:text-blue-200">Super Admin Escalation</div>
                                <div className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                                  Push this ticket to the super admin queue only when it needs platform-level support.
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={escalateTicket}
                                disabled={savingTicket || !!selectedTicket.escalated_to_super_admin}
                                className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {selectedTicket.escalated_to_super_admin ? 'Already Pushed To Super Admin' : 'Push To Super Admin'}
                              </button>
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">Subject</label>
                          <input
                            value={editForm.subject}
                            onChange={event => setEditForm(prev => ({ ...prev, subject: event.target.value }))}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">Description</label>
                          <textarea
                            value={editForm.message}
                            onChange={event => setEditForm(prev => ({ ...prev, message: event.target.value }))}
                            rows={5}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">Category</label>
                            <select
                              value={editForm.category}
                              onChange={event => setEditForm(prev => ({ ...prev, category: event.target.value }))}
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            >
                              {CATEGORY_OPTIONS.map(option => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">Priority</label>
                            <select
                              value={editForm.priority}
                              onChange={event => setEditForm(prev => ({ ...prev, priority: event.target.value as SupportPriority }))}
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            >
                              {PRIORITY_OPTIONS.map(option => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">Status</label>
                            <select
                              value={editForm.status}
                              onChange={event => setEditForm(prev => ({ ...prev, status: event.target.value as SupportStatus }))}
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            >
                              {STATUS_OPTIONS.map(option => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">Assigned To</label>
                            <input
                              value={editForm.assigned_to}
                              onChange={event => setEditForm(prev => ({ ...prev, assigned_to: event.target.value }))}
                              placeholder="User ID or admin ID"
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-3">
                          <button
                            type="button"
                            onClick={saveTicketChanges}
                            disabled={savingTicket}
                            className="rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingTicket ? 'Saving Changes...' : 'Save Ticket Changes'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditForm(prev => ({ ...prev, assigned_to: currentUser?.id || '' }))}
                            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            Assign To Me
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-5 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                        <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800">
                          <span className="font-semibold">Category</span>
                          <span>{selectedTicket.category}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800">
                          <span className="font-semibold">Priority</span>
                          <span>{selectedTicket.priority}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800">
                          <span className="font-semibold">Status</span>
                          <span>{selectedTicket.status}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800">
                          <span className="font-semibold">Assigned To</span>
                          <span>{selectedTicket.assigned_to || 'Not assigned'}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900/30">
                    <h4 className="text-base font-black text-slate-900 dark:text-white">Attachments</h4>
                    <div className="mt-4 space-y-3">
                      {attachments.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                          No attachments uploaded yet.
                        </div>
                      ) : (
                        attachments.map(file => (
                          <a
                            key={file.id}
                            href={`${API_BASE_URL}/api/v2/support/tickets/${selectedTicket.id}/attachments/${file.id}/download?${accessQuery.toString()}`}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition-all hover:border-primary/30 hover:bg-primary/5 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700/60"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{file.file_name}</div>
                              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {formatFileSize(file.file_size)} • {formatDateTime(file.created_at)}
                              </div>
                            </div>
                            <span className="shrink-0 text-xs font-black uppercase tracking-wide text-primary">Download</span>
                          </a>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default SupportCenter;
