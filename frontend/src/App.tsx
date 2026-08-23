import React, { useState, useEffect, useCallback } from 'react';
import { 
  ReactFlowProvider, 
  useNodesState, 
  useEdgesState, 
  addEdge
} from 'reactflow';
import type { Connection, Node } from 'reactflow';
import { Canvas } from './components/Canvas';
import { Sidebar } from './components/Sidebar';
import { LogViewer } from './components/LogViewer';
import { LockScreen } from './components/LockScreen';
import { LeadsManager } from './components/LeadsManager';
import { 
  register,
  login,
  logout,
  getCurrentUser,
  fetchOrganizations,
  fetchWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  manageWorkspacePassword,
  fetchWorkspaceSummary,
  fetchMembers,
  inviteMember,
  removeMember,
  fetchBilling,
  upgradePlan,
  fetchWorkflows,
  saveWorkflow,
  deleteWorkflow,
  fetchExecutions,
  simulateWebhook,
  fetchWhatsAppHistory,
  clearWhatsAppHistory,
  getToken,
  setToken,
  fetchAdminDashboard,
  fetchAdminOrganizations,
  updateAdminOrgStatus,
  deleteAdminOrg,
  fetchAdminPlans,
  updateAdminPlan,
  fetchAdminAuditLogs
} from './api';
import type { 
  User,
  Organization,
  Workspace,
  OrganizationMember,
  Workflow,
  WorkflowExecution,
  WhatsAppMessageLog,
  WorkspaceSummary,
  BillingDetails,
  AdminDashboard,
  AdminOrgDetails,
  Plan,
  AuditLog
} from './api';
import { 
  Shield, Sparkles, Send, Settings, Users, Layers, 
  BarChart2, LayoutDashboard, Database, LogOut, 
  User as UserIcon, Plus, Mail, ChevronRight, 
  CreditCard, Activity, Trash2, AlertTriangle
} from 'lucide-react';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

type TabType = 
  | 'dashboard'
  | 'leads'
  | 'automations'
  | 'editor'
  | 'reports'
  | 'logs'
  | 'team'
  | 'billing'
  | 'settings'
  | 'admin_dashboard'
  | 'admin_orgs'
  | 'admin_plans'
  | 'admin_logs';

const AppContent: React.FC = () => {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  
  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  // Tenant/Workspace Switcher States
  const [orgId, setOrgId] = useState<string>('');
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [orgsList, setOrgsList] = useState<Organization[]>([]);
  const [workspacesList, setWorkspacesList] = useState<Workspace[]>([]);
  const [activeOrgName, setActiveOrgName] = useState('');
  const [activeWorkspaceName, setActiveWorkspaceName] = useState('');

  // Security Passcode Lock State
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [workspacePassword, setWorkspacePassword] = useState<string>('');
  const [lockError, setLockError] = useState<string | null>(null);

  // Workspace summary, workflows and logs states
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('new');
  const [workflowName, setWorkflowName] = useState<string>('New Automation Workflow');
  const [status, setStatus] = useState<'ACTIVE' | 'DRAFT' | 'INACTIVE'>('DRAFT');
  
  // Canvas Node/Edge States
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Logging & Simulation State
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [whatsappLogs, setWhatsappLogs] = useState<WhatsAppMessageLog[]>([]);
  const [simContactId, setSimContactId] = useState<string>('+15550001111');
  const [simMessageText, setSimMessageText] = useState<string>('hello');

  // Team list state
  const [membersList, setMembersList] = useState<OrganizationMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');

  // Billing state
  const [billingDetails, setBillingDetails] = useState<BillingDetails | null>(null);

  // Super Admin state
  const [adminStats, setAdminStats] = useState<AdminDashboard | null>(null);
  const [adminOrgs, setAdminOrgs] = useState<AdminOrgDetails[]>([]);
  const [adminPlans, setAdminPlans] = useState<Plan[]>([]);
  const [adminLogs, setAdminLogs] = useState<AuditLog[]>([]);
  
  // Workspace security configs form
  const [wsSecType, setWsSecType] = useState<'PRIVATE' | 'MEMBERS' | 'PUBLIC'>('PRIVATE');
  const [wsPasscode, setWsPasscode] = useState('');

  // Workspace creation form
  const [showWsCreateModal, setShowWsCreateModal] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsDesc, setNewWsDesc] = useState('');
  const [newWsSec, setNewWsSec] = useState<'PRIVATE' | 'MEMBERS' | 'PUBLIC'>('PRIVATE');
  const [newWsPass, setNewWsPass] = useState('');

  // UI Dialog States
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isRefreshing] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Toast notification helper
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  // Update node data in canvas state
  const handleNodeUpdate = useCallback((id: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...newData,
              onUpdate: handleNodeUpdate
            }
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  // Load User Identity profile
  const loadUserIdentity = async () => {
    if (!getToken()) return;
    try {
      const profile = await getCurrentUser();
      setCurrentUser(profile);
      
      // Load organizations
      const orgs = await fetchOrganizations();
      setOrgsList(orgs);
      
      if (orgs.length > 0) {
        // Resolve default organization
        const defaultOrg = localStorage.getItem('kulmitra_default_org') || orgs[0].id;
        setOrgId(defaultOrg);
      }
    } catch (err: any) {
      console.error('Failed to load profile details:', err);
      handleSignOut();
    }
  };

  // Sign out helper
  const handleSignOut = async () => {
    try {
      await logout();
    } catch {}
    setToken('');
    setCurrentUser(null);
    setOrgsList([]);
    setWorkspacesList([]);
    setOrgId('');
    setWorkspaceId('');
    setActiveTab('dashboard');
    showToast('Logged out successfully.', 'info');
  };

  // Load workspaces under org
  const loadWorkspaces = async (targetOrgId: string) => {
    try {
      const list = await fetchWorkspaces(targetOrgId);
      setWorkspacesList(list);
      
      if (list.length > 0) {
        const defaultWs = localStorage.getItem(`kulmitra_default_ws_${targetOrgId}`) || list[0].id;
        setWorkspaceId(defaultWs);
      } else {
        setWorkspaceId('');
      }
    } catch (err: any) {
      if (err.isLocked) {
        setIsLocked(true);
      } else {
        showToast(`Failed to load workspaces: ${err.message}`, 'error');
      }
    }
  };

  // Load workspace details summary statistics
  const loadWorkspaceStatsSummary = async () => {
    if (!orgId || !workspaceId) return;
    try {
      const stats = await fetchWorkspaceSummary(orgId, workspaceId, workspacePassword);
      setSummary(stats);
      setIsLocked(false);
      setLockError(null);
    } catch (err: any) {
      if (err.isLocked) {
        setIsLocked(true);
      }
    }
  };

  // Load workflows list scoped to workspace
  const loadWorkflowsList = async () => {
    if (!orgId || !workspaceId) return;
    try {
      const data = await fetchWorkflows(orgId, workspaceId, workspacePassword);
      setWorkflows(data);
      setIsLocked(false);
    } catch (err: any) {
      if (err.isLocked) {
        setIsLocked(true);
      }
    }
  };

  // Load logs and WhatsApp histories
  const loadExecutionLogs = async () => {
    if (!orgId || !workspaceId) return;
    try {
      const execs = await fetchExecutions(orgId, workspaceId, workspacePassword);
      setExecutions(execs);
      
      const logs = await fetchWhatsAppHistory(orgId, workspaceId, workspacePassword);
      setWhatsappLogs(logs);
      setIsLocked(false);
    } catch (err: any) {
      if (err.isLocked) {
        setIsLocked(true);
      }
    }
  };

  // Load team membership logs
  const loadTeamMembers = async () => {
    if (!orgId) return;
    try {
      const list = await fetchMembers(orgId);
      setMembersList(list);
    } catch {}
  };

  // Load billing quotas details
  const loadBillingDetails = async () => {
    if (!orgId) return;
    try {
      const billing = await fetchBilling(orgId);
      setBillingDetails(billing);
    } catch {}
  };

  // Load super admin panels data
  const loadAdminPanels = async () => {
    if (currentUser?.role !== 'SUPER_ADMIN') return;
    try {
      if (activeTab === 'admin_dashboard') {
        const stats = await fetchAdminDashboard();
        setAdminStats(stats);
      } else if (activeTab === 'admin_orgs') {
        const orgs = await fetchAdminOrganizations();
        setAdminOrgs(orgs);
      } else if (activeTab === 'admin_plans') {
        const plans = await fetchAdminPlans();
        setAdminPlans(plans);
      } else if (activeTab === 'admin_logs') {
        const logs = await fetchAdminAuditLogs();
        setAdminLogs(logs);
      }
    } catch {}
  };

  // Populate canvas with selected workflow definition
  const loadWorkflowIntoCanvas = (wf: Workflow) => {
    setWorkflowName(wf.name);
    setStatus(wf.status);
    
    const nodesWithCallbacks = (wf.definition.nodes || []).map((node: Node) => ({
      ...node,
      data: {
        ...node.data,
        onUpdate: handleNodeUpdate
      }
    }));
    
    setNodes(nodesWithCallbacks);
    setEdges(wf.definition.edges || []);
  };

  const handleCreateNewWorkflowCanvas = () => {
    setSelectedWorkflowId('new');
    setWorkflowName('Welcome Responder Workflow');
    setStatus('DRAFT');
    
    const starterNode: Node = {
      id: `incomingMessage_${Date.now()}`,
      type: 'incomingMessage',
      position: { x: 150, y: 150 },
      data: {
        keyword: 'hello',
        onUpdate: handleNodeUpdate
      }
    };
    
    setNodes([starterNode]);
    setEdges([]);
    setActiveTab('editor');
  };

  // Connect edges on canvas
  const onConnect = useCallback(
    (params: Connection) => {
      const edgeWithStyle = {
        ...params,
        style: { strokeWidth: 2, stroke: '#6366f1' }, // Indigo-500 line
        animated: true
      };
      setEdges((eds) => addEdge(edgeWithStyle, eds));
    },
    [setEdges]
  );

  // Clear Canvas
  const handleClearCanvas = () => {
    setNodes([]);
    setEdges([]);
    showToast('Canvas cleared', 'info');
  };

  // Save workflow (POST)
  const handleSaveWorkflow = async () => {
    if (!workflowName.trim()) {
      showToast('Workflow name cannot be empty', 'error');
      return;
    }

    if (nodes.length === 0) {
      showToast('Cannot save an empty workflow. Add at least one node.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const sanitizedNodes = nodes.map(({ data, ...rest }) => {
        const { onUpdate, ...serializableData } = data;
        return {
          ...rest,
          data: serializableData
        };
      });

      const payload: Workflow = {
        workspaceId,
        name: workflowName,
        status,
        definition: {
          nodes: sanitizedNodes,
          edges
        }
      };

      if (selectedWorkflowId !== 'new') {
        payload.id = selectedWorkflowId;
      }

      const saved = await saveWorkflow(orgId, workspaceId, payload, workspacePassword);
      showToast(`Workflow "${saved.name}" saved successfully!`, 'success');
      
      // Reload list and details summary
      loadWorkflowsList();
      loadWorkspaceStatsSummary();
      setActiveTab('automations');
    } catch (err: any) {
      if (!err.isLocked) {
        showToast(`Save failed: ${err.message || err}`, 'error');
      } else {
        setIsLocked(true);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Delete workflow
  const handleDeleteWorkflow = async (wfId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete workflow "${name}"?`)) return;
    try {
      await deleteWorkflow(orgId, workspaceId, wfId, workspacePassword);
      showToast('Workflow deleted.', 'success');
      loadWorkflowsList();
      loadWorkspaceStatsSummary();
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  // Simulate Webhook
  const handleSimulateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simContactId.trim() || !simMessageText.trim()) return;

    setIsSimulating(true);
    try {
      await simulateWebhook(workspaceId, simContactId, simMessageText);
      showToast(`Simulated webhook: "${simMessageText}" in workspace.`, 'info');
      
      setTimeout(() => {
        loadExecutionLogs();
        loadWorkspaceStatsSummary();
      }, 700);
    } catch (err: any) {
      showToast(`Simulation failed: ${err.message}`, 'error');
    } finally {
      setIsSimulating(false);
    }
  };

  // Create Workspace (POST)
  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;

    try {
      const created = await createWorkspace(orgId, {
        name: newWsName,
        description: newWsDesc,
        securityType: newWsSec,
        password: newWsPass
      });
      showToast(`Workspace "${created.name}" created!`, 'success');
      setShowWsCreateModal(false);
      setNewWsName('');
      setNewWsDesc('');
      setNewWsSec('PRIVATE');
      setNewWsPass('');
      
      // Reload workspaces
      loadWorkspaces(orgId);
    } catch (err: any) {
      showToast(`Creation failed: ${err.message}`, 'error');
    }
  };

  // Save workspace security passcode configs
  const handleWorkspaceSecurityConfig = async (action: 'ENABLE' | 'DISABLE' | 'UPDATE') => {
    try {
      let payload: any = { action };
      if (action === 'ENABLE') {
        if (!wsPasscode.trim()) {
          showToast('Security passcode cannot be empty.', 'error');
          return;
        }
        payload.password = wsPasscode;
      } else if (action === 'DISABLE') {
        if (!wsPasscode.trim()) {
          showToast('Verification password required to disable passcode.', 'error');
          return;
        }
        payload.currentPassword = wsPasscode;
      }

      await manageWorkspacePassword(orgId, workspaceId, payload);
      showToast('Workspace security passcode updated successfully!', 'success');
      setWsPasscode('');
      
      // Reload workspace
      loadWorkspaces(orgId);
    } catch (err: any) {
      showToast(`Security update failed: ${err.message}`, 'error');
    }
  };

  // Invite Team member
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      await inviteMember(orgId, inviteEmail, inviteRole);
      showToast(`Invitation sent to ${inviteEmail}!`, 'success');
      setInviteEmail('');
      loadTeamMembers();
    } catch (err: any) {
      showToast(`Invitation failed: ${err.message}`, 'error');
    }
  };

  // Remove Team member
  const handleRemoveMember = async (memberId: string, email: string) => {
    if (!confirm(`Are you sure you want to remove ${email} from the team?`)) return;
    try {
      await removeMember(orgId, memberId);
      showToast('Team member removed.', 'success');
      loadTeamMembers();
    } catch (err: any) {
      showToast(`Failed to remove: ${err.message}`, 'error');
    }
  };

  // Upgrade Pricing Plan
  const handleUpgradePlan = async (planName: string) => {
    if (!confirm(`Do you want to change organization subscription to ${planName}?`)) return;
    try {
      await upgradePlan(orgId, planName as any);
      showToast(`Subscription plan upgraded to ${planName}!`, 'success');
      loadBillingDetails();
    } catch (err: any) {
      showToast(`Upgrade failed: ${err.message}`, 'error');
    }
  };

  // Authenticate Workspace Passcode Overrides
  const handleUnlockWorkspace = async (inputPass: string) => {
    setLockError(null);
    try {
      await fetchWorkflows(orgId, workspaceId, inputPass);
      setWorkspacePassword(inputPass);
      setIsLocked(false);
      showToast('Workspace unlocked successfully!', 'success');
    } catch (err: any) {
      setLockError('Incorrect security passcode.');
      setWorkspacePassword('');
    }
  };

  // Auth: Log In / Sign Up handler
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword.trim()) return;

    try {
      if (authTab === 'signin') {
        const data = await login(authEmail, authPassword);
        showToast(`Welcome back, ${data.user.name}!`, 'success');
        setAuthEmail('');
        setAuthPassword('');
        loadUserIdentity();
      } else {
        if (!authName.trim()) return;
        await register(authEmail, authName, authPassword);
        showToast(`Account created successfully, ${authName}!`, 'success');
        setAuthEmail('');
        setAuthName('');
        setAuthPassword('');
        loadUserIdentity();
      }
    } catch (err: any) {
      showToast(`Authentication failed: ${err.message}`, 'error');
    }
  };

  // Load everything on token change
  useEffect(() => {
    loadUserIdentity();
  }, []);

  // Reload workspaces on organization swap
  useEffect(() => {
    if (orgId) {
      localStorage.setItem('kulmitra_default_org', orgId);
      const activeOrg = orgsList.find(o => o.id === orgId);
      if (activeOrg) {
        setActiveOrgName(activeOrg.name);
      }
      setWorkspacePassword('');
      setIsLocked(false);
      loadWorkspaces(orgId);
      loadTeamMembers();
      loadBillingDetails();
    }
  }, [orgId, orgsList]);

  // Reload details on workspace swap
  useEffect(() => {
    if (orgId && workspaceId) {
      localStorage.setItem(`kulmitra_default_ws_${orgId}`, workspaceId);
      const activeWs = workspacesList.find(w => w.id === workspaceId);
      if (activeWs) {
        setActiveWorkspaceName(activeWs.name);
        setWsSecType(activeWs.securityType);
      }
      setWorkspacePassword('');
      setIsLocked(false);
      
      // Load workspace components
      loadWorkspaceStatsSummary();
      loadWorkflowsList();
      loadExecutionLogs();
    }
  }, [workspaceId, workspacesList]);

  // Reload Super Admin panels
  useEffect(() => {
    loadAdminPanels();
  }, [activeTab, currentUser]);

  // Unauthenticated view
  if (!currentUser) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Outfit, sans-serif'
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 20px 40px -15px rgba(0,0,0,0.1)',
          width: '400px',
          padding: '40px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <div className="logo-icon" style={{ marginBottom: '16px' }}>KM</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>KULMITRA</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '28px', textAlign: 'center' }}>
            Multi-Tenant WhatsApp Automation SaaS Platform
          </p>

          {/* Auth Tab Switcher */}
          <div style={{ display: 'flex', width: '100%', background: '#f1f5f9', borderRadius: '8px', padding: '4px', marginBottom: '24px' }}>
            <button 
              onClick={() => setAuthTab('signin')}
              style={{
                flex: 1,
                border: 'none',
                background: authTab === 'signin' ? '#ffffff' : 'transparent',
                color: authTab === 'signin' ? '#0f172a' : '#64748b',
                padding: '8px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              Sign In
            </button>
            <button 
              onClick={() => setAuthTab('signup')}
              style={{
                flex: 1,
                border: 'none',
                background: authTab === 'signup' ? '#ffffff' : 'transparent',
                color: authTab === 'signup' ? '#0f172a' : '#64748b',
                padding: '8px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              Create Account
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleAuthSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {authTab === 'signup' && (
              <div className="node-input-group">
                <label>Company / Full Name</label>
                <input 
                  type="text" 
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  required
                />
              </div>
            )}
            
            <div className="node-input-group">
              <label>Email Address</label>
              <input 
                type="email" 
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="e.g. name@company.com"
                required
              />
            </div>

            <div className="node-input-group">
              <label>Password</label>
              <input 
                type="password" 
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px', marginTop: '10px' }}>
              <span>{authTab === 'signin' ? 'Sign In' : 'Create Account'}</span>
            </button>
          </form>

          {/* Demo Credentials */}
          <div style={{ marginTop: '24px', borderTop: '1px solid #f1f5f9', paddingTop: '16px', width: '100%', fontSize: '0.75rem', color: '#64748b', textAlign: 'left' }}>
            <strong>Demo Super Admin:</strong><br />
            Email: <code style={{ color: 'var(--color-primary)' }}>superadmin@kulmitra.com</code> / Pass: <code style={{ color: 'var(--color-primary)' }}>SuperPassword123</code><br />
            <strong>Demo Owner:</strong><br />
            Email: <code style={{ color: 'var(--color-primary)' }}>owner@kulmitra.com</code> / Pass: <code style={{ color: 'var(--color-primary)' }}>OwnerPassword123</code>
          </div>
        </div>

        {/* Toasts */}
        <div className="flow-notifications">
          {toasts.map(toast => (
            <div key={toast.id} className={`toast ${toast.type}`}>
              <span>{toast.message}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Authenticated View
  return (
    <div className="app-container" style={{ fontFamily: 'Outfit, sans-serif' }}>
      {/* Passcode Lockscreen Overlay */}
      {isLocked && (
        <LockScreen
          orgName={activeWorkspaceName || workspaceId}
          errorMsg={lockError}
          onSubmit={handleUnlockWorkspace}
        />
      )}

      {/* Workspace Creation Modal */}
      {showWsCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(5, 6, 11, 0.4)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 990
        }}>
          <div style={{
            background: 'var(--bg-node)',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-main)',
            borderRadius: '12px',
            padding: '24px',
            width: '100%',
            maxWidth: '450px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>Create New Workspace</h3>
            </div>
            
            <form onSubmit={handleCreateWorkspace} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="node-input-group">
                <label>Workspace Name</label>
                <input 
                  type="text" 
                  value={newWsName} 
                  onChange={(e) => setNewWsName(e.target.value)} 
                  placeholder="e.g. Sales Workspace" 
                  required 
                />
              </div>

              <div className="node-input-group">
                <label>Description</label>
                <textarea 
                  value={newWsDesc} 
                  onChange={(e) => setNewWsDesc(e.target.value)} 
                  placeholder="Workspace details..." 
                />
              </div>

              <div className="node-input-group">
                <label>Security Level</label>
                <select value={newWsSec} onChange={(e: any) => setNewWsSec(e.target.value)}>
                  <option value="PRIVATE">Private (Owners/Admins only)</option>
                  <option value="MEMBERS">Organization Members</option>
                  <option value="PUBLIC">Public Gate</option>
                </select>
              </div>

              {newWsSec === 'PUBLIC' && (
                <div className="node-input-group">
                  <label>Public Passcode Guard (Optional)</label>
                  <input 
                    type="password" 
                    value={newWsPass} 
                    onChange={(e) => setNewWsPass(e.target.value)} 
                    placeholder="Set 4+ digit passcode" 
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" className="btn" onClick={() => setShowWsCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main SaaS App Header */}
      <header className="app-header">
        {/* Left Branding */}
        <div className="brand-section">
          <div className="logo-icon">KM</div>
          <span className="brand-title">KULMITRA</span>
          <span className="brand-codename">WhatsApp Automation SaaS</span>
        </div>

        {/* Tenant Organization Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '24px' }}>
          <div className="tenant-selector">
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, marginRight: '4px' }}>ORG:</span>
            <select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              {orgsList.map(o => (
                <option key={o.id} value={o.id}>
                  {o.name} {o.status === 'SUSPENDED' ? '(⚠️ Suspended)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Workspace Switcher */}
          {workspacesList.length > 0 && (
            <div className="tenant-selector">
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, marginRight: '4px' }}>WORKSPACE:</span>
              <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
                {workspacesList.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.securityType === 'PUBLIC' ? '🌐' : '🔒'}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <button 
            className="btn" 
            onClick={() => setShowWsCreateModal(true)}
            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
            title="Create new workspace"
          >
            <Plus size={14} />
            <span>Workspace</span>
          </button>
        </div>

        {/* Breadcrumbs showing routing context */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#64748b', marginLeft: 'auto', marginRight: '24px' }}>
          <span>{activeOrgName || 'Acme Corp'}</span>
          <ChevronRight size={12} />
          <span>{activeWorkspaceName || 'Sales Workspace'}</span>
          <ChevronRight size={12} />
          <span style={{ color: 'var(--color-primary)', fontWeight: 600, textTransform: 'uppercase' }}>
            {activeTab.replace('_', ' ')}
          </span>
        </div>

        {/* Right controls: user identity & signout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f1f5f9', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <UserIcon size={14} style={{ color: 'var(--color-primary)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>{currentUser.name}</span>
              <span style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>{currentUser.role.replace('_', ' ')}</span>
            </div>
          </div>

          <button className="btn" onClick={handleSignOut} style={{ padding: '8px', color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.15)' }} title="Sign Out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main SaaS Dashboard Layout */}
      <div style={{ display: 'flex', flex: 1, height: 'calc(100vh - 70px)', overflow: 'hidden' }}>
        
        {/* Navigation Sidebar Panel */}
        <nav style={{
          width: '240px',
          background: '#ffffff',
          borderRight: '1px solid var(--border-light)',
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          overflowY: 'auto'
        }}>
          {/* Workspace level items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <h4 style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', paddingLeft: '8px', marginBottom: '8px' }}>
              Workspace Scope
            </h4>
            
            <button 
              onClick={() => setActiveTab('dashboard')}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', borderRadius: '8px',
                background: activeTab === 'dashboard' ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                border: 'none', color: activeTab === 'dashboard' ? 'var(--color-primary)' : '#475569',
                textAlign: 'left', cursor: 'pointer', fontWeight: activeTab === 'dashboard' ? 700 : 500, fontSize: '0.85rem'
              }}
            >
              <LayoutDashboard size={16} />
              <span>Dashboard</span>
            </button>

            <button 
              onClick={() => setActiveTab('leads')}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', borderRadius: '8px',
                background: activeTab === 'leads' ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                border: 'none', color: activeTab === 'leads' ? 'var(--color-primary)' : '#475569',
                textAlign: 'left', cursor: 'pointer', fontWeight: activeTab === 'leads' ? 700 : 500, fontSize: '0.85rem'
              }}
            >
              <Users size={16} />
              <span>Leads Directory</span>
            </button>

            <button 
              onClick={() => setActiveTab('automations')}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', borderRadius: '8px',
                background: activeTab === 'automations' || activeTab === 'editor' ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                border: 'none', color: activeTab === 'automations' || activeTab === 'editor' ? 'var(--color-primary)' : '#475569',
                textAlign: 'left', cursor: 'pointer', fontWeight: activeTab === 'automations' || activeTab === 'editor' ? 700 : 500, fontSize: '0.85rem'
              }}
            >
              <Layers size={16} />
              <span>Automations</span>
            </button>

            <button 
              onClick={() => setActiveTab('reports')}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', borderRadius: '8px',
                background: activeTab === 'reports' ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                border: 'none', color: activeTab === 'reports' ? 'var(--color-primary)' : '#475569',
                textAlign: 'left', cursor: 'pointer', fontWeight: activeTab === 'reports' ? 700 : 500, fontSize: '0.85rem'
              }}
            >
              <BarChart2 size={16} />
              <span>Reports</span>
            </button>

            <button 
              onClick={() => setActiveTab('logs')}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', borderRadius: '8px',
                background: activeTab === 'logs' ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                border: 'none', color: activeTab === 'logs' ? 'var(--color-primary)' : '#475569',
                textAlign: 'left', cursor: 'pointer', fontWeight: activeTab === 'logs' ? 700 : 500, fontSize: '0.85rem'
              }}
            >
              <Activity size={16} />
              <span>Execution Logs</span>
            </button>
          </div>

          {/* Org level items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <h4 style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', paddingLeft: '8px', marginBottom: '8px' }}>
              Organization settings
            </h4>

            <button 
              onClick={() => setActiveTab('team')}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', borderRadius: '8px',
                background: activeTab === 'team' ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                border: 'none', color: activeTab === 'team' ? 'var(--color-primary)' : '#475569',
                textAlign: 'left', cursor: 'pointer', fontWeight: activeTab === 'team' ? 700 : 500, fontSize: '0.85rem'
              }}
            >
              <Users size={16} />
              <span>Team Settings</span>
            </button>

            <button 
              onClick={() => setActiveTab('billing')}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', borderRadius: '8px',
                background: activeTab === 'billing' ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                border: 'none', color: activeTab === 'billing' ? 'var(--color-primary)' : '#475569',
                textAlign: 'left', cursor: 'pointer', fontWeight: activeTab === 'billing' ? 700 : 500, fontSize: '0.85rem'
              }}
            >
              <CreditCard size={16} />
              <span>Billing Subscription</span>
            </button>

            <button 
              onClick={() => setActiveTab('settings')}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', borderRadius: '8px',
                background: activeTab === 'settings' ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                border: 'none', color: activeTab === 'settings' ? 'var(--color-primary)' : '#475569',
                textAlign: 'left', cursor: 'pointer', fontWeight: activeTab === 'settings' ? 700 : 500, fontSize: '0.85rem'
              }}
            >
              <Settings size={16} />
              <span>Workspace Access</span>
            </button>
          </div>

          {/* Super Admin level items (only visible if SUPER_ADMIN) */}
          {currentUser.role === 'SUPER_ADMIN' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'auto', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
              <h4 style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', paddingLeft: '8px', marginBottom: '8px' }}>
                ADMIN PLATFORM
              </h4>

              <button 
                onClick={() => setActiveTab('admin_dashboard')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', borderRadius: '8px',
                  background: activeTab === 'admin_dashboard' ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                  border: 'none', color: activeTab === 'admin_dashboard' ? 'var(--color-primary)' : '#475569',
                  textAlign: 'left', cursor: 'pointer', fontWeight: activeTab === 'admin_dashboard' ? 700 : 500, fontSize: '0.85rem'
                }}
              >
                <LayoutDashboard size={16} />
                <span>Admin Dashboard</span>
              </button>

              <button 
                onClick={() => setActiveTab('admin_orgs')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', borderRadius: '8px',
                  background: activeTab === 'admin_orgs' ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                  border: 'none', color: activeTab === 'admin_orgs' ? 'var(--color-primary)' : '#475569',
                  textAlign: 'left', cursor: 'pointer', fontWeight: activeTab === 'admin_orgs' ? 700 : 500, fontSize: '0.85rem'
                }}
              >
                <Shield size={16} />
                <span>Organizations</span>
              </button>

              <button 
                onClick={() => setActiveTab('admin_plans')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', borderRadius: '8px',
                  background: activeTab === 'admin_plans' ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                  border: 'none', color: activeTab === 'admin_plans' ? 'var(--color-primary)' : '#475569',
                  textAlign: 'left', cursor: 'pointer', fontWeight: activeTab === 'admin_plans' ? 700 : 500, fontSize: '0.85rem'
                }}
              >
                <Settings size={16} />
                <span>SaaS Plans admin</span>
              </button>

              <button 
                onClick={() => setActiveTab('admin_logs')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 12px', borderRadius: '8px',
                  background: activeTab === 'admin_logs' ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
                  border: 'none', color: activeTab === 'admin_logs' ? 'var(--color-primary)' : '#475569',
                  textAlign: 'left', cursor: 'pointer', fontWeight: activeTab === 'admin_logs' ? 700 : 500, fontSize: '0.85rem'
                }}
              >
                <Database size={16} />
                <span>Audit Logs</span>
              </button>
            </div>
          )}
        </nav>

        {/* Content Display Window */}
        <main style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', padding: '30px' }}>
          
          {/* TAB 1: WORKSPACE DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>Workspace Dashboard</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Operations oversight, quotas tracking, and recent activities metrics.</p>
              </div>

              {/* Counts Widgets */}
              {summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                  <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Total Leads</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a' }}>{summary.leadsCount}</div>
                  </div>
                  <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Workflows</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a' }}>{summary.workflowsCount}</div>
                  </div>
                  <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Automation Runs</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a' }}>{summary.executionsCount}</div>
                  </div>
                  <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Success rate</div>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-success)' }}>{summary.successRate}%</div>
                  </div>
                </div>
              )}

              {/* Subscriptions quota meters */}
              {billingDetails && (
                <div style={{
                  background: '#ffffff',
                  border: '1px solid var(--border-light)',
                  borderRadius: '12px',
                  padding: '24px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CreditCard size={16} style={{ color: 'var(--color-primary)' }} />
                    <span>Plan Limits & Subscription Quotas ({billingDetails.currentPlan})</span>
                  </h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                    {/* Leads limit progress */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 650, color: '#475569', marginBottom: '6px' }}>
                        <span>CRM Leads Scoped</span>
                        <span style={{ marginLeft: 'auto' }}>{billingDetails.usage.leads} / {billingDetails.limits.maxLeads}</span>
                      </div>
                      <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'var(--color-primary)', width: `${Math.min(100, (billingDetails.usage.leads / billingDetails.limits.maxLeads) * 100)}%` }} />
                      </div>
                    </div>

                    {/* Workspaces limit progress */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 650, color: '#475569', marginBottom: '6px' }}>
                        <span>Segregated Workspaces</span>
                        <span style={{ marginLeft: 'auto' }}>{billingDetails.usage.workspaces} / {billingDetails.limits.maxWorkspaces}</span>
                      </div>
                      <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'var(--color-secondary)', width: `${Math.min(100, (billingDetails.usage.workspaces / billingDetails.limits.maxWorkspaces) * 100)}%` }} />
                      </div>
                    </div>

                    {/* Executions limit progress */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 650, color: '#475569', marginBottom: '6px' }}>
                        <span>Automation Run Executions</span>
                        <span style={{ marginLeft: 'auto' }}>{billingDetails.usage.executions} / {billingDetails.limits.maxExecutions}</span>
                      </div>
                      <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'var(--color-success)', width: `${Math.min(100, (billingDetails.usage.executions / billingDetails.limits.maxExecutions) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Grid: Recent Leads & Recent Activity log */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* Recent Leads list */}
                <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '12px' }}>
                    Recent Scoped Leads
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {executions.slice(0, 5).map((ex, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', borderBottom: '1px solid #f8fafc', paddingBottom: '8px' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>Lead ID: {ex.contactId}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Workflow: {ex.workflow?.name}</div>
                        </div>
                        <span className={`status-badge ${ex.status.toLowerCase()}`} style={{ marginLeft: 'auto', padding: '1px 6px', fontSize: '0.65rem' }}>
                          {ex.status}
                        </span>
                      </div>
                    ))}
                    {executions.length === 0 && (
                      <div style={{ padding: '20px 0', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                        No lead activities recorded.
                      </div>
                    )}
                  </div>
                </div>

                {/* SVG Graphics representation of leads activity */}
                <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '12px' }}>
                    CRM Prospects Intake Over Time
                  </h4>
                  <p style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '12px' }}>Intake analytics tracking prospects captured via Whatsapp automation.</p>
                  
                  {/* Clean SVG Charts */}
                  <div style={{ width: '100%' }}>
                    <svg viewBox="0 0 100 25" style={{ width: '100%', height: '90px', display: 'block' }}>
                      <rect x="0" y="5" width="8" height="20" fill="var(--color-primary)" rx="2" />
                      <rect x="12" y="10" width="8" height="15" fill="var(--color-primary)" rx="2" />
                      <rect x="24" y="8" width="8" height="17" fill="var(--color-primary)" rx="2" />
                      <rect x="36" y="14" width="8" height="11" fill="var(--color-primary)" rx="2" />
                      <rect x="48" y="4" width="8" height="21" fill="var(--color-secondary)" rx="2" />
                      <rect x="60" y="9" width="8" height="16" fill="var(--color-primary)" rx="2" />
                      <rect x="72" y="7" width="8" height="18" fill="var(--color-primary)" rx="2" />
                      <rect x="84" y="2" width="8" height="23" fill="var(--color-secondary)" rx="2" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LEADS DIRECTORY */}
          {activeTab === 'leads' && (
            <LeadsManager 
              orgId={orgId} 
              workspaceId={workspaceId} 
              password={workspacePassword} 
              showToast={showToast} 
            />
          )}

          {/* TAB 3: AUTOMATIONS LIST */}
          {activeTab === 'automations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>Automations</h2>
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Configure message triggers, validation flows, and WhatsApp outbox responders.</p>
                </div>
                <button className="btn btn-primary" onClick={handleCreateNewWorkflowCanvas} style={{ marginLeft: 'auto' }}>
                  <Plus size={16} />
                  <span>Create Automation</span>
                </button>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <table className="log-table">
                  <thead>
                    <tr>
                      <th>Automation Name</th>
                      <th>Status</th>
                      <th>Definition</th>
                      <th>Last Updated</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workflows.map((wf) => (
                      <tr key={wf.id}>
                        <td style={{ fontWeight: 650, color: '#0f172a' }}>{wf.name}</td>
                        <td>
                          <span className={`status-badge ${wf.status.toLowerCase()}`}>
                            {wf.status}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          Nodes: {wf.definition.nodes?.length || 0} | Edges: {wf.definition.edges?.length || 0}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {wf.updatedAt ? new Date(wf.updatedAt).toLocaleDateString() : 'N/A'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button 
                              className="btn" 
                              onClick={() => {
                                setSelectedWorkflowId(wf.id!);
                                loadWorkflowIntoCanvas(wf);
                                setActiveTab('editor');
                              }}
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            >
                              <span>Edit Canvas</span>
                            </button>
                            <button 
                              className="btn" 
                              onClick={() => handleDeleteWorkflow(wf.id!, wf.name)}
                              style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.15)' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {workflows.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                          No automation workflows created in this workspace yet. Click "Create Automation" to start.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: WORKFLOW EDITOR CANVAS */}
          {activeTab === 'editor' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 'calc(100vh - 130px)', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button className="btn" onClick={() => setActiveTab('automations')}>
                  <span>← Back to Workflows</span>
                </button>
                <h3 style={{ fontWeight: 700, color: '#0f172a' }}>Editing: {workflowName}</h3>
              </div>

              <div style={{ display: 'flex', flex: 1, background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', overflow: 'hidden' }}>
                <Sidebar 
                  summary={summary}
                  onSave={handleSaveWorkflow}
                  onClearCanvas={handleClearCanvas}
                  activeWorkflowName={workflowName}
                  setActiveWorkflowName={setWorkflowName}
                  status={status}
                  setStatus={setStatus}
                  isSaving={isSaving}
                />

                <div className="split-pane">
                  <div style={{ flex: 1, position: 'relative' }}>
                    <Canvas
                      nodes={nodes}
                      edges={edges}
                      onNodesChange={onNodesChange}
                      onEdgesChange={onEdgesChange}
                      onConnect={onConnect}
                      setNodes={setNodes}
                      onNodeUpdate={handleNodeUpdate}
                    />

                    {/* Webhook simulator */}
                    <div className="canvas-actions" style={{ position: 'absolute', top: '16px', left: '16px', right: 'auto', background: 'var(--bg-node)', border: '1px solid var(--border-light)', padding: '12px', borderRadius: '12px', boxShadow: 'var(--shadow-main)' }}>
                      <form onSubmit={handleSimulateWebhook} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: 'var(--color-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Sparkles size={12} />
                          SIMULATE WEBHOOK:
                        </span>
                        
                        <input 
                          type="text" 
                          value={simContactId} 
                          onChange={(e) => setSimContactId(e.target.value)} 
                          placeholder="Sender Phone"
                          style={{ width: '130px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '0.75rem', padding: '4px 8px', borderRadius: '4px' }}
                        />
                        
                        <input 
                          type="text" 
                          value={simMessageText} 
                          onChange={(e) => setSimMessageText(e.target.value)} 
                          placeholder="Message Text"
                          style={{ width: '180px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '0.75rem', padding: '4px 8px', borderRadius: '4px' }}
                        />
                        
                        <button type="submit" className="btn btn-primary" disabled={isSimulating} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                          <Send size={12} />
                          <span>{isSimulating ? 'Sending...' : 'Send Message'}</span>
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Audit Logs */}
                  <LogViewer
                    executions={executions}
                    historyLogs={whatsappLogs}
                    onRefresh={loadExecutionLogs}
                    onClearHistory={async () => {
                      await clearWhatsAppHistory(orgId, workspaceId, workspacePassword);
                      loadExecutionLogs();
                    }}
                    isRefreshing={isRefreshing}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: REPORTS & ANALYTICS */}
          {activeTab === 'reports' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>Reports & Analytics</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>SaaS workspace automation execution metrics and lead conversion trends.</p>
              </div>

              {summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                  <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Total execution runs</div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#0f172a' }}>{summary.executionsCount}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-success)', fontWeight: 'bold', marginTop: '4px' }}>
                      Passed: {summary.successfulExecutionsCount} ({summary.successRate}%)
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Failed Runs</div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--color-danger)' }}>
                      {summary.executionsCount - summary.successfulExecutionsCount}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                      Fail Rate: {100 - summary.successRate}%
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Messages Dispatched</div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--color-secondary)' }}>
                      {whatsappLogs.length}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                      Dispatched this month
                    </div>
                  </div>
                </div>
              )}

              {/* Conversion chart */}
              <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', marginBottom: '16px' }}>
                  Automation Run Success Trends
                </h4>
                
                {/* SVG representing runs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#475569' }}>
                    <span>Success Rate Rate</span>
                    <span style={{ marginLeft: 'auto', fontWeight: 'bold' }}>{summary?.successRate || 100}%</span>
                  </div>
                  <div style={{ height: '24px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ background: 'var(--color-success)', width: `${summary?.successRate || 100}%`, height: '100%' }} />
                    <div style={{ background: 'var(--color-danger)', width: `${100 - (summary?.successRate || 0)}%`, height: '100%' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)' }} />
                      Successful runs ({summary?.successfulExecutionsCount})
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-danger)' }} />
                      Failed runs ({(summary?.executionsCount || 0) - (summary?.successfulExecutionsCount || 0)})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: EXECUTION LOGS LIST */}
          {activeTab === 'logs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>Execution Logs</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Audit trail of all executed WhatsApp autoresponder workflows.</p>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <table className="log-table">
                  <thead>
                    <tr>
                      <th>Workflow</th>
                      <th>Contact ID</th>
                      <th>Status</th>
                      <th>Steps Executed</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {executions.map((ex) => (
                      <tr key={ex.id}>
                        <td style={{ fontWeight: 650, color: '#0f172a' }}>{ex.workflow?.name || 'Workflow Run'}</td>
                        <td style={{ fontFamily: 'monospace' }}>{ex.contactId}</td>
                        <td>
                          <span className={`status-badge ${ex.status.toLowerCase()}`}>
                            {ex.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {ex.stepResults.map((s, idx) => (
                              <span key={idx} className={`step-type-badge ${s.nodeType}`} title={s.details}>
                                {s.nodeType === 'incomingMessage' ? 'Trig' : s.nodeType === 'condition' ? 'If' : 'Send'}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {new Date(ex.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {executions.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                          No workflow runs recorded inside this workspace yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: TEAM MEMBERS LIST */}
          {activeTab === 'team' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>Team Management</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Invite coworkers and manage workspace access roles.</p>
              </div>

              {/* Invite member form */}
              <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={16} style={{ color: 'var(--color-primary)' }} />
                  <span>Invite New Workspace Member</span>
                </h4>
                
                <form onSubmit={handleInviteMember} style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="email" 
                    value={inviteEmail} 
                    onChange={(e) => setInviteEmail(e.target.value)} 
                    placeholder="Enter email address" 
                    style={{ flex: 1, background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '0.85rem', padding: '8px 12px', borderRadius: '6px' }}
                    required 
                  />
                  
                  <select 
                    value={inviteRole} 
                    onChange={(e) => setInviteRole(e.target.value)}
                    style={{ width: '150px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '0.85rem', padding: '8px 12px', borderRadius: '6px' }}
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="MEMBER">Member</option>
                    <option value="VIEWER">Viewer</option>
                  </select>

                  <button type="submit" className="btn btn-primary">
                    <span>Send Invite</span>
                  </button>
                </form>
              </div>

              {/* Members table */}
              <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <table className="log-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Invitation Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {membersList.map((m) => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 650, color: '#0f172a' }}>{m.name}</td>
                        <td style={{ fontFamily: 'monospace' }}>{m.email}</td>
                        <td>
                          <span style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                            {m.role}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge ${m.status.toLowerCase()}`}>
                            {m.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            className="btn" 
                            onClick={() => handleRemoveMember(m.id, m.email)}
                            disabled={m.role === 'OWNER'}
                            style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.15)' }}
                          >
                            <span>Remove</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 8: BILLING & SUBSCRIPTIONS */}
          {activeTab === 'billing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>SaaS Subscription Billing</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Change subscription tiers and upgrade platform caps.</p>
              </div>

              {/* Current Billing Details card */}
              {billingDetails && (
                <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>Current Subscription</h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Active Plan</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '4px' }}>{billingDetails.currentPlan}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Price</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>${billingDetails.price} / month</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Billing Cycle</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>Auto-Renewing</div>
                    </div>
                  </div>

                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '10px' }}>Active Usage Quotas</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                      Leads Scoped: <strong>{billingDetails.usage.leads}</strong> of {billingDetails.limits.maxLeads} leads limit.
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                      Workspaces created: <strong>{billingDetails.usage.workspaces}</strong> of {billingDetails.limits.maxWorkspaces} workspaces capacity limit.
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                      Automation runs executed: <strong>{billingDetails.usage.executions}</strong> of {billingDetails.limits.maxExecutions} runs limit.
                    </div>
                  </div>
                </div>
              )}

              {/* Plans cards */}
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>Select Subscription Tier</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                  
                  {/* Free Plan */}
                  <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Free Plan</h4>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>$0 <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'normal' }}>/ mo</span></div>
                    </div>
                    <ul style={{ fontSize: '0.82rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '16px' }}>
                      <li>1 Workspace channel</li>
                      <li>100 Leads CRM capacity</li>
                      <li>500 Workflow runs / mo</li>
                    </ul>
                    <button className="btn" onClick={() => handleUpgradePlan('Free Plan')} style={{ marginTop: 'auto', justifyContent: 'center' }}>
                      Select Free Tier
                    </button>
                  </div>

                  {/* Pro Plan */}
                  <div style={{ background: '#ffffff', border: '2px solid var(--color-primary)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.05)', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '-12px', right: '20px', background: 'var(--color-primary)', color: 'white', fontSize: '0.65rem', fontWeight: 'bold', padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>Popular</div>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Pro Plan</h4>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>$49 <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'normal' }}>/ mo</span></div>
                    </div>
                    <ul style={{ fontSize: '0.82rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '16px' }}>
                      <li>5 Workspace channels</li>
                      <li>5,000 Leads CRM capacity</li>
                      <li>20,000 Workflow runs / mo</li>
                    </ul>
                    <button className="btn btn-primary" onClick={() => handleUpgradePlan('Pro Plan')} style={{ marginTop: 'auto', justifyContent: 'center' }}>
                      Upgrade to Pro
                    </button>
                  </div>

                  {/* Business Plan */}
                  <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Business Plan</h4>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>$199 <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'normal' }}>/ mo</span></div>
                    </div>
                    <ul style={{ fontSize: '0.82rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '16px' }}>
                      <li>20 Workspace channels</li>
                      <li>50,000 Leads CRM capacity</li>
                      <li>100,000 Workflow runs / mo</li>
                    </ul>
                    <button className="btn" onClick={() => handleUpgradePlan('Business Plan')} style={{ marginTop: 'auto', justifyContent: 'center' }}>
                      Upgrade to Business
                    </button>
                  </div>

                </div>
              </div>
            </div>
          )}

          {/* TAB 9: WORKSPACE ACCESS SETTINGS */}
          {activeTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>Workspace Access Settings</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Configure workspace visibility levels and optional public passcodes.</p>
              </div>

              {/* Security configuration card */}
              <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '16px' }}>Security Configuration</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div className="node-input-group">
                    <label>Workspace Visibility</label>
                    <select 
                      value={wsSecType} 
                      onChange={async (e) => {
                        const val = e.target.value as any;
                        setWsSecType(val);
                        // Save immediately
                        try {
                          await updateWorkspace(orgId, workspaceId, { securityType: val });
                          showToast('Workspace visibility updated!', 'success');
                          loadWorkspaces(orgId);
                        } catch (err: any) {
                          showToast(`Failed to update visibility: ${err.message}`, 'error');
                        }
                      }}
                      style={{ maxWidth: '300px' }}
                    >
                      <option value="PRIVATE">Private (Workspace Owner & Admin only)</option>
                      <option value="MEMBERS">Organization Members (All company users)</option>
                      <option value="PUBLIC">Public link Gate (Accessible with passcode)</option>
                    </select>
                  </div>

                  {wsSecType === 'PUBLIC' && (
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>Public Passcode Protection</h4>
                      <p style={{ fontSize: '0.78rem', color: '#64748b' }}>Require users entering from external links to input a passcode.</p>
                      
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input 
                          type="password" 
                          placeholder="Choose passcode passcode" 
                          value={wsPasscode} 
                          onChange={(e) => setWsPasscode(e.target.value)} 
                          style={{ width: '240px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '0.85rem', padding: '8px 12px', borderRadius: '6px' }}
                        />
                        <button type="button" className="btn btn-primary" onClick={() => handleWorkspaceSecurityConfig('ENABLE')}>
                          Enable Passcode
                        </button>
                        <button type="button" className="btn btn-danger" onClick={() => handleWorkspaceSecurityConfig('DISABLE')}>
                          Remove Passcode
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* Delete workspace dangerous zone */}
              <div style={{
                border: '1px solid rgba(239, 68, 68, 0.2)',
                background: 'rgba(239, 68, 68, 0.02)',
                padding: '24px',
                borderRadius: '12px',
                marginTop: '12px'
              }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-danger)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={18} />
                  <span>Danger Zone: Delete Workspace</span>
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '16px' }}>
                  Permanently delete this workspace and all workflows, CRM leads, and webhook logs. **This action cannot be undone.**
                </p>
                <button 
                  type="button" 
                  className="btn btn-danger"
                  onClick={async () => {
                    if (confirm('Are you sure you want to permanently delete this workspace? All workflows and leads will be lost.')) {
                      try {
                        await deleteWorkspace(orgId, workspaceId);
                        showToast('Workspace deleted.', 'success');
                        // Reload workspaces list
                        const list = await fetchWorkspaces(orgId);
                        setWorkspacesList(list);
                        if (list.length > 0) {
                          setWorkspaceId(list[0].id);
                        }
                      } catch (err: any) {
                        showToast(`Deletion failed: ${err.message}`, 'error');
                      }
                    }
                  }}
                  style={{ alignSelf: 'flex-start' }}
                >
                  Delete Workspace
                </button>
              </div>
            </div>
          )}

          {/* TAB 10: SUPER ADMIN PLATFORM DASHBOARD */}
          {activeTab === 'admin_dashboard' && adminStats && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>Super Admin KPI Dashboard</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>KULMITRA platform-wide customer metrics and revenue overview.</p>
              </div>

              {/* Statistics grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Total Organizations</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a' }}>{adminStats.totalOrganizations}</div>
                </div>
                <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Registered Users</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a' }}>{adminStats.totalUsers}</div>
                </div>
                <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Total Workspaces</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a' }}>{adminStats.totalWorkspaces}</div>
                </div>
                <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Total Leads CRM</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a' }}>{adminStats.totalLeads}</div>
                </div>
                <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Automation runs</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-primary)' }}>{adminStats.totalExecutions}</div>
                </div>
                <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Monthly Revenue</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-success)' }}>${adminStats.monthlyRevenue}</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 11: PLATFORM ORGANIZATIONS */}
          {activeTab === 'admin_orgs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>Platform Organizations</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Activate, suspend, or delete customer corporate accounts.</p>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <table className="log-table">
                  <thead>
                    <tr>
                      <th>Organization Name</th>
                      <th>Owner Email</th>
                      <th>Subscription Plan</th>
                      <th>Workspaces</th>
                      <th>Account Status</th>
                      <th>Created Date</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminOrgs.map((org) => (
                      <tr key={org.id}>
                        <td style={{ fontWeight: 650, color: '#0f172a' }}>{org.name}</td>
                        <td style={{ fontFamily: 'monospace' }}>{org.ownerEmail}</td>
                        <td>
                          <span style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                            {org.planName}
                          </span>
                        </td>
                        <td>{org.workspacesCount} workspaces</td>
                        <td>
                          <span className={`status-badge ${org.status.toLowerCase()}`}>
                            {org.status}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{new Date(org.createdAt).toLocaleDateString()}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button 
                              className="btn" 
                              onClick={async () => {
                                const newStatus = org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
                                if (confirm(`Toggle organization status to ${newStatus}?`)) {
                                  try {
                                    await updateAdminOrgStatus(org.id, newStatus);
                                    showToast('Status updated successfully.', 'success');
                                    // reload
                                    const list = await fetchAdminOrganizations();
                                    setAdminOrgs(list);
                                  } catch (err: any) {
                                    showToast(err.message, 'error');
                                  }
                                }
                              }}
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            >
                              <span>{org.status === 'ACTIVE' ? 'Suspend' : 'Activate'}</span>
                            </button>
                            <button 
                              className="btn" 
                              onClick={async () => {
                                if (confirm('Are you sure you want to permanently delete this organization? All user data will be lost.')) {
                                  try {
                                    await deleteAdminOrg(org.id);
                                    showToast('Organization deleted.', 'success');
                                    const list = await fetchAdminOrganizations();
                                    setAdminOrgs(list);
                                  } catch (err: any) {
                                    showToast(err.message, 'error');
                                  }
                                }
                              }}
                              style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--color-danger)', borderColor: 'rgba(239, 68, 68, 0.15)' }}
                            >
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 12: SaaS PRICING PLANS ADMIN */}
          {activeTab === 'admin_plans' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>SaaS Pricing Plans</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Configure pricing limits, monthly costs, and quota capacities.</p>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <table className="log-table">
                  <thead>
                    <tr>
                      <th>Plan Name</th>
                      <th>Monthly Price</th>
                      <th>Max Workspaces</th>
                      <th>Max Leads CRM</th>
                      <th>Max Runs / mo</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminPlans.map((plan) => (
                      <tr key={plan.id}>
                        <td style={{ fontWeight: 650, color: '#0f172a' }}>{plan.name}</td>
                        <td style={{ fontWeight: 'bold' }}>${plan.price} / mo</td>
                        <td>{plan.maxWorkspaces} workspaces</td>
                        <td>{plan.maxLeads} leads</td>
                        <td>{plan.maxExecutions} runs</td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            className="btn" 
                            onClick={async () => {
                              const newPrice = prompt('Enter new monthly cost ($):', String(plan.price));
                              if (newPrice !== null) {
                                try {
                                  await updateAdminPlan(plan.id, { price: Number(newPrice) });
                                  showToast('Plan price updated.', 'success');
                                  const list = await fetchAdminPlans();
                                  setAdminPlans(list);
                                } catch (err: any) {
                                  showToast(err.message, 'error');
                                }
                              }
                            }}
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          >
                            <span>Edit Price</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 13: COMPLIANCE AUDIT LOGS */}
          {activeTab === 'admin_logs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>Compliance Audit Trail Logs</h2>
                <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Platform activity tracking and security compliance logs.</p>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <table className="log-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>User</th>
                      <th>Action Triggered</th>
                      <th>Details</th>
                      <th>Scope Org ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminLogs.map((log) => (
                      <tr key={log.id}>
                        <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td style={{ fontWeight: 650, color: '#0f172a' }}>{log.userEmail || 'System'}</td>
                        <td>
                          <span style={{ fontSize: '0.7rem', background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: '#475569' }}>{log.details || 'No details provided'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{log.orgId}</td>
                      </tr>
                    ))}
                    {adminLogs.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                          No platform compliance logs recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Notification Toasts */}
      <div className="flow-notifications">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ReactFlowProvider>
      <AppContent />
    </ReactFlowProvider>
  );
}
