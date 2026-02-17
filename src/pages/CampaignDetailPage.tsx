import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import KPICard from '../components/KPICard';
import ProgressBar from '../components/ProgressBar';
import LeadsTable from '../components/LeadsTable';
import AddLeadModal from '../components/AddLeadModal';
import ImportLeadsModal from '../components/ImportLeadsModal';
import { fetchCampaign, startCampaign, stopCampaign, deleteRecord, addRecord } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import {
  PlayIcon,
  StopIcon,
  Cog6ToothIcon,
  ChevronLeftIcon
} from '@heroicons/react/24/outline';

const CampaignDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [campaign, setCampaign] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddLeadModalOpen, setIsAddLeadModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!id || !user?.id) return;
      try {
        setLoading(true);
        const response = await fetchCampaign(id, user.id);
        if (response.success && response.data) {
          setCampaign(response.data.campaign);
          const mappedLeads = (response.data.records || []).map((r: any) => ({
            id: r.id,
            name: r.name || 'Unknown',
            phone: r.phone_number,
            email: r.email || 'N/A',
            status: r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : 'Pending',
            attempts: r.attempts || 0
          }));
          setLeads(mappedLeads);
        }
      } catch (error) {
        console.error('Error loading campaign details:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, user?.id]);

  const handleToggleCampaign = async () => {
    if (!id || !user?.id || !campaign) return;
    try {
      setIsProcessing(true);
      const isRunning = campaign.status === 'running';
      const response = isRunning
        ? await stopCampaign(id, user.id)
        : await startCampaign(id, user.id);

      if (response.success) {
        // Refresh data
        const refreshResponse = await fetchCampaign(id, user.id);
        if (refreshResponse.success) {
          setCampaign(refreshResponse.data.campaign);
        }
      }
    } catch (error: any) {
      alert(error.message || 'Operation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddLead = async (data: any) => {
    if (!id || !user?.id) return;
    try {
      const response = await addRecord(id, user.id, data.phone);
      if (response.success) {
        // Refresh data
        const refreshResponse = await fetchCampaign(id, user.id);
        if (refreshResponse.success) {
          setLeads(refreshResponse.data.records || []);
        }
        setIsAddLeadModalOpen(false);
      }
    } catch (error) {
      console.error('Error adding lead:', error);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!id || !user?.id) return;
    if (window.confirm('Delete this lead?')) {
      try {
        const response = await deleteRecord(id, leadId, user.id);
        if (response.success) {
          setLeads(leads.filter(l => l.id !== leadId));
        }
      } catch (error) {
        console.error('Error deleting lead:', error);
      }
    }
  };

  const handleImportLeads = async (file: File) => {
    if (!id || !user?.id) return;
    try {
      console.log('Importing leads from:', file.name);
      // Logic for CSV parsing or direct upload to API would go here
      // For now, we simulate success
      alert(`Simulation: Successfully imported leads from ${file.name}`);
      setIsImportModalOpen(false);

      // Refresh leads list
      const refreshResponse = await fetchCampaign(id, user.id);
      if (refreshResponse.success) {
        setLeads(refreshResponse.data.records || []);
      }
    } catch (error) {
      console.error('Error importing leads:', error);
      alert('Failed to import leads. Please check your CSV format.');
    }
  };

  if (loading) {
    return (
      <AppLayout
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Projects', path: '/campaigns' },
          { label: 'Loading...' }
        ]}
        pageTitle="Loading..."
      >
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  if (!campaign) {
    return (
      <AppLayout
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Projects', path: '/campaigns' },
          { label: 'Not Found' }
        ]}
        pageTitle="Project Not Found"
      >
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold">Campaign not found</h2>
          <button onClick={() => navigate('/campaigns')} className="mt-4 text-primary font-bold">
            Back to Campaigns
          </button>
        </div>
      </AppLayout>
    );
  }

  const campaignStats = {
    total: campaign.total_contacts || 0,
    completed: campaign.completed_calls || 0,
    failed: campaign.failed_calls || 0,
    pending: (campaign.total_contacts || 0) - (campaign.completed_calls || 0) - (campaign.failed_calls || 0),
    successful: campaign.successful_calls || 0,
  };

  const actionButtons = (
    <div className="flex items-center space-x-3">
      <button
        onClick={() => navigate('/campaigns')}
        className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all font-bold group"
      >
        <ChevronLeftIcon className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
      </button>
      <button
        disabled={isProcessing}
        onClick={handleToggleCampaign}
        className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl font-black transition-all shadow-lg uppercase tracking-wider text-xs ${campaign.status === 'running'
          ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/25'
          : 'bg-green-500 hover:bg-green-600 text-white shadow-green-500/25'
          } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {campaign.status === 'running' ? (
          <>
            <StopIcon className="h-4 w-4" />
            <span>Stop Campaign</span>
          </>
        ) : (
          <>
            <PlayIcon className="h-4 w-4" />
            <span>Start Campaign</span>
          </>
        )}
      </button>
    </div>
  );

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Projects', path: '/campaigns' },
        { label: campaign.name }
      ]}
      pageTitle={campaign.name}
      pageDescription="Monitor real-time performance and lead outreach"
      primaryAction={actionButtons}
    >
      <div className="py-6 space-y-8">
        {/* KPI Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 stagger-children">
          <KPICard title="Total Leads" value={campaignStats.total} color="blue" />
          <KPICard title="Pending" value={campaignStats.pending} color="gray" />
          <KPICard title="Successful" value={campaignStats.successful} color="green" />
          <KPICard title="Completed" value={campaignStats.completed} color="green" />
          <KPICard title="Failed" value={campaignStats.failed} color="red" />
        </div>

        {/* Progress Bar Section */}
        <div className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
          <ProgressBar
            completed={campaignStats.completed}
            failed={campaignStats.failed}
            inProgress={0} // Not tracked individually in current schema
            pending={campaignStats.pending}
            total={campaignStats.total}
          />
        </div>

        {/* Leads Table Section */}
        <LeadsTable
          leads={leads}
          onAddLead={() => setIsAddLeadModalOpen(true)}
          onImportLeads={() => setIsImportModalOpen(true)}
          onEditLead={(lead) => console.log('Edit', lead)}
          onDeleteLead={handleDeleteLead}
        />
      </div>

      <AddLeadModal
        isOpen={isAddLeadModalOpen}
        onClose={() => setIsAddLeadModalOpen(false)}
        onSave={handleAddLead}
      />
      <ImportLeadsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportLeads}
      />
    </AppLayout>
  );
};

export default CampaignDetailPage;
