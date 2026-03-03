export const getAuthHeaders = (extraHeaders = {}) => {
  const headers = { ...extraHeaders };
  const selectedCompany = localStorage.getItem('x-company-id');
  if (selectedCompany) {
    headers['x-company-id'] = selectedCompany;
  }
  return headers;
};

export const getAuthParams = () => {
  try {
    const userStr = localStorage.getItem('ziya-user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.role) return `&role=${user.role}`;
    }
  } catch (e) { }
  return '';
};

export const getApiBaseUrl = () => {
  return "http://localhost:5000";
};

export const fetchCampaigns = async (userId: string) => {
  const response = await fetch(`${getApiBaseUrl()}/api/campaigns?userId=${userId}${getAuthParams()}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  // Validate content type before parsing JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Received non-JSON response from server');
  }
  return response.json();
};

export const fetchScheduledCalls = async (userId: string) => {
  const response = await fetch(`${getApiBaseUrl()}/api/scheduled-calls?userId=${userId}${getAuthParams()}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Received non-JSON response from server');
  }
  return response.json();
};

export const rescheduleCall = async (contactId: string, newTime: string) => {
  const response = await fetch(`${getApiBaseUrl()}/api/scheduled-calls/reschedule`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ contactId, newTime })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to reschedule lead');
  }
  return response.json();
};

export const deleteScheduledCall = async (contactId: string) => {
  const response = await fetch(`${getApiBaseUrl()}/api/scheduled-calls/${contactId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to delete scheduled call');
  }
  return response.json();
};

export const createCampaign = async (userId: string, name: string, agentId?: string, concurrentCalls?: number, retryAttempts?: number) => {
  const response = await fetch(`${getApiBaseUrl()}/api/campaigns`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userId, name, agentId, concurrentCalls, retryAttempts })
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  // Validate content type before parsing JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Received non-JSON response from server');
  }
  return response.json();
};

export const fetchCampaign = async (id: string, userId: string) => {
  const response = await fetch(`${getApiBaseUrl()}/api/campaigns/${id}?userId=${userId}${getAuthParams()}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  // Validate content type before parsing JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Received non-JSON response from server');
  }
  return response.json();
};

export const updateCampaign = async (id: string, userId: string, data: any) => {
  const response = await fetch(`${getApiBaseUrl()}/api/campaigns/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userId, ...data })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to update campaign');
  }
  return response.json();
};

export const setCallerPhone = async (id: string, userId: string, callerPhone: string, agentId?: string) => {
  const response = await fetch(`${getApiBaseUrl()}/api/campaigns/${id}/set-caller-phone`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userId, callerPhone, agentId })
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  // Validate content type before parsing JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Received non-JSON response from server');
  }
  return response.json();
};

// Import CSV content (raw string)
export const importCSV = async (id: string, userId: string, csvContent: string) => {
  const response = await fetch(`${getApiBaseUrl()}/api/campaigns/${id}/import-csv`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userId, csvContent }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to import CSV');
  }
  return response.json();
};

export const importRecords = async (id: string, userId: string, csvData: any[]) => {
  const response = await fetch(`${getApiBaseUrl()}/api/campaigns/${id}/import`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userId, csvData })
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  // Validate content type before parsing JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Received non-JSON response from server');
  }
  return response.json();
};

export const addRecord = async (id: string, userId: string, phone: string, name?: string, email?: string) => {
  const response = await fetch(`${getApiBaseUrl()}/api/campaigns/${id}/records`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userId, phone, name, email })
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  // Validate content type before parsing JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Received non-JSON response from server');
  }
  return response.json();
};

export const deleteRecord = async (campaignId: string, recordId: string, userId: string) => {
  const response = await fetch(`${getApiBaseUrl()}/api/campaigns/${campaignId}/records/${recordId}`, {
    method: 'DELETE',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userId })
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  // Validate content type before parsing JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Received non-JSON response from server');
  }
  return response.json();
};

export const startCampaign = async (id: string, userId: string) => {
  const response = await fetch(`${getApiBaseUrl()}/api/campaigns/${id}/start`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userId })
  });
  if (!response.ok) {
    let errorMessage = `HTTP error! status: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData && errorData.message) {
        errorMessage = errorData.message;
      }
    } catch (e) {
      // fallback to status text if not json
    }
    throw new Error(errorMessage);
  }
  // Validate content type before parsing JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Received non-JSON response from server');
  }
  return response.json();
};

export const stopCampaign = async (id: string, userId: string) => {
  const response = await fetch(`${getApiBaseUrl()}/api/campaigns/${id}/stop`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userId })
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  // Validate content type before parsing JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Received non-JSON response from server');
  }
  return response.json();
};

export const fetchRecords = async (id: string, page: number = 1, limit: number = 20) => {
  const response = await fetch(`${getApiBaseUrl()}/api/campaigns/${id}/records?page=${page}&limit=${limit}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  // Validate content type before parsing JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Received non-JSON response from server');
  }
  return response.json();
};

export const deleteCampaign = async (id: string, userId: string) => {
  const response = await fetch(`${getApiBaseUrl()}/api/campaigns/${id}?userId=${userId}${getAuthParams()}`, {
    method: 'DELETE',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' })
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  // Validate content type before parsing JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Received non-JSON response from server');
  }
  return response.json();
};

export const updateConcurrentCalls = async (id: string, userId: string, concurrentCalls: number) => {
  const response = await fetch(`${getApiBaseUrl()}/api/campaigns/${id}/concurrent-calls`, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ userId, concurrentCalls })
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  // Validate content type before parsing JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Received non-JSON response from server');
  }
  return response.json();
};

export const updateConcurrentCalls = async (id: string, userId: string, concurrentCalls: number) => {
  const response = await fetch(`${getApiBaseUrl()}/api/campaigns/${id}/concurrent-calls`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, concurrentCalls })
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  // Validate content type before parsing JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Received non-JSON response from server');
  }
  return response.json();
};