const API_BASE = 'http://localhost:5000/api';

// Token Storage helpers
let sessionToken = localStorage.getItem('kulmitra_token') || '';

export function setToken(token: string) {
  sessionToken = token;
  if (token) {
    localStorage.setItem('kulmitra_token', token);
  } else {
    localStorage.removeItem('kulmitra_token');
  }
}

export function getToken(): string {
  return sessionToken;
}

// ----------------------------------------------------
// Interfaces
// ----------------------------------------------------

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'USER';
}

export interface Organization {
  id: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'SUSPENDED';
  planId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Workspace {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  securityType: 'PRIVATE' | 'MEMBERS' | 'PUBLIC';
  isPasswordProtected: boolean;
  createdAt?: string;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  status: 'ACTIVE' | 'INVITED';
  createdAt?: string;
}

export interface Workflow {
  id?: string;
  workspaceId: string;
  name: string;
  status: 'ACTIVE' | 'DRAFT' | 'INACTIVE';
  definition: {
    nodes: any[];
    edges: any[];
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workspaceId: string;
  contactId: string;
  status: 'SUCCESS' | 'FAILED' | 'RUNNING';
  stepResults: {
    nodeId: string;
    nodeType: string;
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
    details: string;
    timestamp: string;
  }[];
  createdAt: string;
  workflow?: {
    name: string;
  };
}

export interface WhatsAppMessageLog {
  orgId: string;
  contactId: string;
  message: string;
  timestamp: string;
}

export interface Lead {
  id?: string;
  workspaceId: string;
  name: string;
  email?: string | null;
  phone: string;
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'LOST';
  source: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeadsResponse {
  leads: Lead[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface WorkspaceSummary {
  workflowsCount: number;
  executionsCount: number;
  successfulExecutionsCount: number;
  leadsCount: number;
  successRate: number;
}

export interface BillingDetails {
  currentPlan: string;
  price: number;
  limits: {
    maxWorkspaces: number;
    maxLeads: number;
    maxExecutions: number;
  };
  usage: {
    leads: number;
    workspaces: number;
    executions: number;
  };
}

export interface AdminDashboard {
  totalOrganizations: number;
  totalUsers: number;
  totalWorkspaces: number;
  totalLeads: number;
  totalExecutions: number;
  monthlyRevenue: number;
}

export interface AdminOrgDetails {
  id: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'SUSPENDED';
  planName: string;
  ownerEmail: string;
  workspacesCount: number;
  createdAt: string;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  maxWorkspaces: number;
  maxLeads: number;
  maxExecutions: number;
  isActive: boolean;
}

export interface AuditLog {
  id: string;
  orgId: string;
  workspaceId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  resource: string;
  details?: string | null;
  timestamp: string;
}

// ----------------------------------------------------
// Request Helpers
// ----------------------------------------------------

function getHeaders(orgId?: string, workspaceId?: string, password?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }
  if (orgId) {
    headers['X-Org-ID'] = orgId;
  }
  if (workspaceId) {
    headers['X-Workspace-ID'] = workspaceId;
  }
  if (password) {
    headers['X-Workspace-Password'] = password;
  }
  
  return headers;
}

async function checkResponse(res: Response) {
  if (!res.ok) {
    let errorText = '';
    let isLocked = false;
    try {
      const data = await res.json();
      errorText = data.error || 'Request failed';
      isLocked = !!data.isLocked;
    } catch {
      errorText = await res.text() || 'Request failed';
      isLocked = res.status === 401;
    }

    const err: any = new Error(errorText);
    err.status = res.status;
    err.isLocked = isLocked;
    throw err;
  }
  return res;
}

// ----------------------------------------------------
// Auth APIs
// ----------------------------------------------------

export async function register(email: string, name: string, password: string): Promise<any> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, password })
  });
  await checkResponse(res);
  const data = await res.json();
  setToken(data.token);
  return data;
}

export async function login(email: string, password: string): Promise<any> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  await checkResponse(res);
  const data = await res.json();
  setToken(data.token);
  return data;
}

export async function logout(): Promise<void> {
  if (!sessionToken) return;
  const res = await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: getHeaders()
  });
  setToken('');
  await checkResponse(res);
}

export async function getCurrentUser(): Promise<User> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: getHeaders()
  });
  await checkResponse(res);
  return res.json();
}

// ----------------------------------------------------
// Organization APIs
// ----------------------------------------------------

export async function fetchOrganizations(): Promise<Organization[]> {
  const res = await fetch(`${API_BASE}/organizations`, {
    headers: getHeaders()
  });
  await checkResponse(res);
  return res.json();
}

export async function fetchOrganizationDetail(orgId: string): Promise<Organization> {
  const res = await fetch(`${API_BASE}/organizations/${orgId}`, {
    headers: getHeaders(orgId)
  });
  await checkResponse(res);
  return res.json();
}

export async function updateOrganization(orgId: string, orgData: { name: string; description?: string }): Promise<Organization> {
  const res = await fetch(`${API_BASE}/organizations/${orgId}`, {
    method: 'PUT',
    headers: {
      ...getHeaders(orgId),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(orgData)
  });
  await checkResponse(res);
  return res.json();
}

export async function deleteOrganization(orgId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/organizations/${orgId}`, {
    method: 'DELETE',
    headers: getHeaders(orgId)
  });
  await checkResponse(res);
}

export async function fetchOrganizationSummary(orgId: string): Promise<WorkspaceSummary> {
  const res = await fetch(`${API_BASE}/organizations/${orgId}/summary`, {
    headers: getHeaders(orgId)
  });
  await checkResponse(res);
  return res.json();
}

// ----------------------------------------------------
// Workspace APIs
// ----------------------------------------------------

export async function fetchWorkspaces(orgId: string): Promise<Workspace[]> {
  const res = await fetch(`${API_BASE}/organizations/${orgId}/workspaces`, {
    headers: getHeaders(orgId)
  });
  await checkResponse(res);
  return res.json();
}

export async function createWorkspace(orgId: string, wsData: Partial<Workspace> & { password?: string }): Promise<Workspace> {
  const res = await fetch(`${API_BASE}/organizations/${orgId}/workspaces`, {
    method: 'POST',
    headers: {
      ...getHeaders(orgId),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(wsData)
  });
  await checkResponse(res);
  return res.json();
}

export async function updateWorkspace(orgId: string, workspaceId: string, wsData: Partial<Workspace>): Promise<Workspace> {
  const res = await fetch(`${API_BASE}/organizations/${orgId}/workspaces/${workspaceId}`, {
    method: 'PUT',
    headers: {
      ...getHeaders(orgId, workspaceId),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(wsData)
  });
  await checkResponse(res);
  return res.json();
}

export async function deleteWorkspace(orgId: string, workspaceId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/organizations/${orgId}/workspaces/${workspaceId}`, {
    method: 'DELETE',
    headers: getHeaders(orgId, workspaceId)
  });
  await checkResponse(res);
}

export async function manageWorkspacePassword(orgId: string, workspaceId: string, payload: any): Promise<any> {
  const res = await fetch(`${API_BASE}/organizations/${orgId}/workspaces/${workspaceId}/password`, {
    method: 'POST',
    headers: {
      ...getHeaders(orgId, workspaceId),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  await checkResponse(res);
  return res.json();
}

export async function fetchWorkspaceSummary(orgId: string, workspaceId: string, password?: string): Promise<WorkspaceSummary> {
  const res = await fetch(`${API_BASE}/organizations/${orgId}/workspaces/${workspaceId}/summary`, {
    headers: getHeaders(orgId, workspaceId, password)
  });
  await checkResponse(res);
  return res.json();
}

// ----------------------------------------------------
// Team Management APIs
// ----------------------------------------------------

export async function fetchMembers(orgId: string): Promise<OrganizationMember[]> {
  const res = await fetch(`${API_BASE}/organizations/${orgId}/members`, {
    headers: getHeaders(orgId)
  });
  await checkResponse(res);
  return res.json();
}

export async function inviteMember(orgId: string, email: string, role: string): Promise<OrganizationMember> {
  const res = await fetch(`${API_BASE}/organizations/${orgId}/members/invite`, {
    method: 'POST',
    headers: {
      ...getHeaders(orgId),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, role })
  });
  await checkResponse(res);
  return res.json();
}

export async function updateMemberRole(orgId: string, memberId: string, role: string): Promise<OrganizationMember> {
  const res = await fetch(`${API_BASE}/organizations/${orgId}/members/${memberId}/role`, {
    method: 'PUT',
    headers: {
      ...getHeaders(orgId),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ role })
  });
  await checkResponse(res);
  return res.json();
}

export async function updateMemberStatus(orgId: string, memberId: string, status: string): Promise<OrganizationMember> {
  const res = await fetch(`${API_BASE}/organizations/${orgId}/members/${memberId}/status`, {
    method: 'PUT',
    headers: {
      ...getHeaders(orgId),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status })
  });
  await checkResponse(res);
  return res.json();
}

export async function removeMember(orgId: string, memberId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/organizations/${orgId}/members/${memberId}`, {
    method: 'DELETE',
    headers: getHeaders(orgId)
  });
  await checkResponse(res);
}

// ----------------------------------------------------
// Billing & Subscriptions APIs
// ----------------------------------------------------

export async function fetchBilling(orgId: string): Promise<BillingDetails> {
  const res = await fetch(`${API_BASE}/organizations/${orgId}/billing`, {
    headers: getHeaders(orgId)
  });
  await checkResponse(res);
  return res.json();
}

export async function upgradePlan(orgId: string, planName: string): Promise<any> {
  const res = await fetch(`${API_BASE}/organizations/${orgId}/billing/upgrade`, {
    method: 'POST',
    headers: {
      ...getHeaders(orgId),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ planName })
  });
  await checkResponse(res);
  return res.json();
}

// ----------------------------------------------------
// Workflows Scoped APIs
// ----------------------------------------------------

export async function fetchWorkflows(orgId: string, workspaceId: string, password?: string): Promise<Workflow[]> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/workflows`, {
    headers: getHeaders(orgId, workspaceId, password)
  });
  await checkResponse(res);
  return res.json();
}

export async function saveWorkflow(orgId: string, workspaceId: string, workflow: Workflow, password?: string): Promise<Workflow> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/workflows`, {
    method: 'POST',
    headers: {
      ...getHeaders(orgId, workspaceId, password),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(workflow)
  });
  await checkResponse(res);
  return res.json();
}

export async function deleteWorkflow(orgId: string, workspaceId: string, id: string, password?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/workflows/${id}`, {
    method: 'DELETE',
    headers: getHeaders(orgId, workspaceId, password)
  });
  await checkResponse(res);
}

// ----------------------------------------------------
// Executions Scoped APIs
// ----------------------------------------------------

export async function fetchExecutions(orgId: string, workspaceId: string, password?: string): Promise<WorkflowExecution[]> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/executions`, {
    headers: getHeaders(orgId, workspaceId, password)
  });
  await checkResponse(res);
  return res.json();
}

export async function simulateWebhook(workspaceId: string, contactId: string, messageText: string): Promise<any> {
  const res = await fetch(`${API_BASE}/webhooks/whatsapp`, {
    method: 'POST',
    headers: {
      ...getHeaders(),
      'X-Workspace-ID': workspaceId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ contactId, messageText })
  });
  await checkResponse(res);
  return res.json();
}

export async function fetchWhatsAppHistory(orgId: string, workspaceId: string, password?: string): Promise<WhatsAppMessageLog[]> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/whatsapp/history`, {
    headers: getHeaders(orgId, workspaceId, password)
  });
  await checkResponse(res);
  return res.json();
}

export async function clearWhatsAppHistory(orgId: string, workspaceId: string, password?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/whatsapp/clear`, {
    method: 'POST',
    headers: getHeaders(orgId, workspaceId, password)
  });
  await checkResponse(res);
}

// ----------------------------------------------------
// Leads Scoped APIs
// ----------------------------------------------------

export async function fetchLeads(
  orgId: string,
  workspaceId: string,
  params: { page: number; limit: number; search?: string; status?: string; source?: string; sortBy?: string; sortOrder?: string },
  password?: string
): Promise<LeadsResponse> {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
    search: params.search || '',
    status: params.status || '',
    source: params.source || '',
    sortBy: params.sortBy || 'createdAt',
    sortOrder: params.sortOrder || 'desc'
  }).toString();

  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/leads?${query}`, {
    headers: getHeaders(orgId, workspaceId, password)
  });
  await checkResponse(res);
  return res.json();
}

export async function createLead(orgId: string, workspaceId: string, leadData: Omit<Lead, 'workspaceId'>, password?: string): Promise<Lead> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/leads`, {
    method: 'POST',
    headers: {
      ...getHeaders(orgId, workspaceId, password),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(leadData)
  });
  await checkResponse(res);
  return res.json();
}

export async function updateLead(orgId: string, workspaceId: string, leadId: string, leadData: Omit<Lead, 'workspaceId' | 'id'>, password?: string): Promise<Lead> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/leads/${leadId}`, {
    method: 'PUT',
    headers: {
      ...getHeaders(orgId, workspaceId, password),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(leadData)
  });
  await checkResponse(res);
  return res.json();
}

export async function deleteLead(orgId: string, workspaceId: string, leadId: string, password?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/leads/${leadId}`, {
    method: 'DELETE',
    headers: getHeaders(orgId, workspaceId, password)
  });
  await checkResponse(res);
}

// ----------------------------------------------------
// Super Admin Platform APIs
// ----------------------------------------------------

export async function fetchAdminDashboard(): Promise<AdminDashboard> {
  const res = await fetch(`${API_BASE}/admin/dashboard`, {
    headers: getHeaders()
  });
  await checkResponse(res);
  return res.json();
}

export async function fetchAdminOrganizations(): Promise<AdminOrgDetails[]> {
  const res = await fetch(`${API_BASE}/admin/organizations`, {
    headers: getHeaders()
  });
  await checkResponse(res);
  return res.json();
}

export async function updateAdminOrgStatus(orgId: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/organizations/${orgId}/status`, {
    method: 'PUT',
    headers: {
      ...getHeaders(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status })
  });
  await checkResponse(res);
  return res.json();
}

export async function deleteAdminOrg(orgId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/organizations/${orgId}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  await checkResponse(res);
}

export async function fetchAdminPlans(): Promise<Plan[]> {
  const res = await fetch(`${API_BASE}/admin/plans`, {
    headers: getHeaders()
  });
  await checkResponse(res);
  return res.json();
}

export async function createAdminPlan(planData: Omit<Plan, 'id'>): Promise<Plan> {
  const res = await fetch(`${API_BASE}/admin/plans`, {
    method: 'POST',
    headers: {
      ...getHeaders(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(planData)
  });
  await checkResponse(res);
  return res.json();
}

export async function updateAdminPlan(planId: string, planData: Partial<Plan>): Promise<Plan> {
  const res = await fetch(`${API_BASE}/admin/plans/${planId}`, {
    method: 'PUT',
    headers: {
      ...getHeaders(),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(planData)
  });
  await checkResponse(res);
  return res.json();
}

export async function fetchAdminAuditLogs(): Promise<AuditLog[]> {
  const res = await fetch(`${API_BASE}/admin/audit-logs`, {
    headers: getHeaders()
  });
  await checkResponse(res);
  return res.json();
}
