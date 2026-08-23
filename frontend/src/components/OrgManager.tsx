import React, { useState, useEffect } from 'react';
import { 
  fetchOrganizations, 
  createOrganization, 
  updateOrganization, 
  deleteOrganization, 
  manageWorkspacePassword
} from '../api';
import type { Organization } from '../api';
import { X, Globe, Shield, Edit3, Trash2, Key, HelpCircle, Eye, EyeOff } from 'lucide-react';

interface OrgManagerProps {
  currentOrgId: string;
  onClose: () => void;
  onOrgCreated: (newOrgId: string) => void;
  onOrgDeleted: () => void;
  onOrgUpdated: () => void;
  password?: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type TabType = 'directory' | 'details' | 'security';

export const OrgManager: React.FC<OrgManagerProps> = ({
  currentOrgId,
  onClose,
  onOrgCreated,
  onOrgDeleted,
  onOrgUpdated,
  password,
  showToast
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('directory');
  const [orgsList, setOrgsList] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  
  // Organization form state
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDesc, setNewOrgDesc] = useState('');
  const [newOrgPass, setNewOrgPass] = useState('');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  
  // Password panel state
  const [securePass, setSecurePass] = useState('');
  const [currentPass, setCurrentPass] = useState('');
  const [updateNewPass, setUpdateNewPass] = useState('');
  const [showPassField, setShowPassField] = useState(false);

  // Deletion double confirmation
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const loadOrgs = async () => {
    try {
      const list = await fetchOrganizations();
      setOrgsList(list);
      const active = list.find(o => o.id === currentOrgId);
      if (active) {
        setCurrentOrg(active);
        setEditName(active.name);
        setEditDesc(active.description || '');
      }
    } catch (err: any) {
      showToast(`Failed to load workspaces list: ${err.message}`, 'error');
    }
  };

  useEffect(() => {
    loadOrgs();
  }, [currentOrgId]);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    try {
      const created = await createOrganization({
        name: newOrgName,
        description: newOrgDesc,
        password: newOrgPass
      });
      showToast(`Workspace "${created.name}" created!`, 'success');
      setNewOrgName('');
      setNewOrgDesc('');
      setNewOrgPass('');
      loadOrgs();
      onOrgCreated(created.id);
    } catch (err: any) {
      showToast(`Creation failed: ${err.message}`, 'error');
    }
  };

  const handleUpdateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    try {
      const updated = await updateOrganization(currentOrgId, {
        name: editName,
        description: editDesc
      }, password);
      
      showToast('Workspace details updated successfully!', 'success');
      loadOrgs();
      onOrgUpdated();
    } catch (err: any) {
      showToast(`Update failed: ${err.message}`, 'error');
    }
  };

  const handleDeleteOrg = async () => {
    if (confirmDeleteText !== currentOrg?.name) {
      showToast('Delete failed: Workspace name confirmation does not match.', 'error');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteOrganization(currentOrgId, password);
      showToast('Workspace deleted permanently.', 'success');
      onClose();
      onOrgDeleted();
    } catch (err: any) {
      showToast(`Deletion failed: ${err.message}`, 'error');
    } finally {
      setIsDeleting(false);
      setConfirmDeleteText('');
    }
  };

  const handlePasswordConfig = async (action: 'ENABLE' | 'DISABLE' | 'UPDATE') => {
    try {
      let payload: any = { action };
      if (action === 'ENABLE') {
        if (!securePass.trim()) {
          showToast('Security password cannot be empty.', 'error');
          return;
        }
        payload.password = securePass;
      } else if (action === 'DISABLE') {
        if (!currentPass.trim()) {
          showToast('Current password is required to disable security.', 'error');
          return;
        }
        payload.currentPassword = currentPass;
      } else if (action === 'UPDATE') {
        if (!currentPass.trim() || !updateNewPass.trim()) {
          showToast('Both current and new passwords are required.', 'error');
          return;
        }
        payload.currentPassword = currentPass;
        payload.newPassword = updateNewPass;
      }

      await manageWorkspacePassword(currentOrgId, payload, password);
      showToast('Security settings updated successfully!', 'success');
      
      // Reset forms
      setSecurePass('');
      setCurrentPass('');
      setUpdateNewPass('');
      loadOrgs();
      onOrgUpdated(); // Triggers reload on parent
    } catch (err: any) {
      showToast(`Security update failed: ${err.message}`, 'error');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(5, 6, 11, 0.7)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 900,
      animation: 'fadeIn 0.2s'
    }}>
      <div style={{
        background: 'var(--bg-node)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-main)',
        borderRadius: '14px',
        width: '100%',
        maxWidth: '750px',
        height: '520px',
        display: 'flex',
        overflow: 'hidden',
        position: 'relative'
      }}>
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            zIndex: 10
          }}
        >
          <X size={18} />
        </button>

        {/* Modal Left Navigation Bar */}
        <div style={{
          width: '220px',
          background: 'rgba(0, 0, 0, 0.2)',
          borderRight: '1px solid var(--border-light)',
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', paddingLeft: '8px', marginBottom: '12px' }}>
            Settings Control
          </h3>
          
          <button 
            onClick={() => setActiveTab('directory')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              background: activeTab === 'directory' ? 'var(--color-primary)' : 'transparent',
              border: 'none',
              color: 'white',
              textAlign: 'left',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '0.85rem'
            }}
          >
            <Globe size={16} />
            <span>Workspaces Directory</span>
          </button>

          <button 
            onClick={() => setActiveTab('details')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              background: activeTab === 'details' ? 'var(--color-primary)' : 'transparent',
              border: 'none',
              color: 'white',
              textAlign: 'left',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '0.85rem'
            }}
          >
            <Edit3 size={16} />
            <span>Workspace Details</span>
          </button>

          <button 
            onClick={() => setActiveTab('security')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              background: activeTab === 'security' ? 'var(--color-primary)' : 'transparent',
              border: 'none',
              color: 'white',
              textAlign: 'left',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '0.85rem'
            }}
          >
            <Shield size={16} />
            <span>Security Settings</span>
          </button>
        </div>

        {/* Modal Main Content Container */}
        <div style={{ flex: 1, padding: '30px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          
          {/* TAB 1: WORKSPACES DIRECTORY */}
          {activeTab === 'directory' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'white', marginBottom: '4px' }}>Workspaces Directory</h2>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Create new isolation tenants or view registered ones.</p>
              </div>

              {/* Scrollable list of workspaces */}
              <div style={{
                maxHeight: '160px',
                overflowY: 'auto',
                border: '1px solid var(--border-light)',
                borderRadius: '8px',
                background: 'rgba(0,0,0,0.1)'
              }}>
                {orgsList.map(org => (
                  <div key={org.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border-light)',
                    fontSize: '0.85rem'
                  }}>
                    <div>
                      <span style={{ fontWeight: 600, color: org.id === currentOrgId ? 'var(--color-secondary)' : 'white' }}>
                        {org.name}
                      </span>
                      {org.id === currentOrgId && <span style={{ marginLeft: '6px', fontSize: '0.65rem', background: 'rgba(6, 182, 212, 0.15)', color: 'var(--color-secondary)', padding: '1px 5px', borderRadius: '3px' }}>active</span>}
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{org.description || 'No description provided'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {org.isPasswordProtected && <Shield size={12} className="text-secondary" style={{ marginRight: '4px' }} />}
                      <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>{org.id}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Create new organization form */}
              <form onSubmit={handleCreateOrg} style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'white', fontWeight: 600 }}>Create New Isolation Workspace</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Workspace Name"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    required
                    style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '6px 10px', color: 'white', fontSize: '0.8rem' }}
                  />
                  <input
                    type="password"
                    placeholder="Set Password (Optional)"
                    value={newOrgPass}
                    onChange={(e) => setNewOrgPass(e.target.value)}
                    style={{ width: '180px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '6px 10px', color: 'white', fontSize: '0.8rem' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Short Description"
                    value={newOrgDesc}
                    onChange={(e) => setNewOrgDesc(e.target.value)}
                    style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '6px 10px', color: 'white', fontSize: '0.8rem' }}
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                    Create
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: WORKSPACE DETAILS */}
          {activeTab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'white', marginBottom: '4px' }}>Workspace Details</h2>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Rename or delete your current active tenant.</p>
              </div>

              {/* Edit workspace name and description */}
              <form onSubmit={handleUpdateOrg} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="node-input-group">
                  <label>Workspace ID (System-assigned)</label>
                  <input
                    type="text"
                    value={currentOrgId}
                    disabled
                    style={{ background: 'rgba(255,255,255,0.02)', color: '#64748b', cursor: 'not-allowed' }}
                  />
                </div>
                <div className="node-input-group">
                  <label>Workspace Display Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>
                <div className="node-input-group">
                  <label>Workspace Description</label>
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    style={{ minHeight: '60px' }}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', padding: '8px 16px', fontSize: '0.85rem' }}>
                  Save Changes
                </button>
              </form>

              {/* Dangerous Area - Delete workspace */}
              <div style={{
                marginTop: 'auto',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '8px',
                padding: '16px',
                background: 'rgba(239, 68, 68, 0.05)'
              }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--color-danger)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Trash2 size={16} />
                  <span>Danger Zone: Delete Workspace</span>
                </h4>
                <p style={{ fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '12px' }}>
                  This will permanently delete this organization, all its leads, all canvas workflows, and all executions traces. **This cannot be undone.**
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder={`Type "${currentOrg?.name}" to confirm`}
                    value={confirmDeleteText}
                    onChange={(e) => setConfirmDeleteText(e.target.value)}
                    style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', padding: '6px 10px', color: 'white', fontSize: '0.8rem' }}
                  />
                  <button 
                    type="button" 
                    onClick={handleDeleteOrg}
                    disabled={isDeleting || confirmDeleteText !== currentOrg?.name}
                    className="btn btn-danger"
                    style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                  >
                    Delete Workspace
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WORKSPACE SECURITY */}
          {activeTab === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px', height: '100%' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'white', marginBottom: '4px' }}>Security Settings</h2>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Restrict access to this workspace's editor, leads, and executions using a password.</p>
              </div>

              {/* Status Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '8px',
                background: currentOrg?.isPasswordProtected ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                border: currentOrg?.isPasswordProtected ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(245,158,11,0.15)',
                fontSize: '0.85rem'
              }}>
                <Shield size={18} style={{ color: currentOrg?.isPasswordProtected ? 'var(--color-success)' : 'var(--color-warning)' }} />
                <div>
                  <span style={{ fontWeight: 600, color: 'white' }}>
                    Status: {currentOrg?.isPasswordProtected ? 'Password Protected' : 'Open Workspace (Public)'}
                  </span>
                  <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '2px' }}>
                    {currentOrg?.isPasswordProtected 
                      ? 'Users require password authorization to load workspace components or query APIs.' 
                      : 'Anyone with access to the platform link can view, modify, and query workspace data.'}
                  </div>
                </div>
              </div>

              {/* Render actions depending on protection status */}
              {!currentOrg?.isPasswordProtected ? (
                // ENABLE PASSWORD PANEL
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'white', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Key size={14} />
                    Enable Password Protection
                  </h4>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type={showPassField ? 'text' : 'password'}
                        placeholder="Choose a security password"
                        value={securePass}
                        onChange={(e) => setSecurePass(e.target.value)}
                        style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '8px 40px 8px 10px', color: 'white', fontSize: '0.8rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassField(!showPassField)}
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex' }}
                      >
                        {showPassField ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => handlePasswordConfig('ENABLE')}
                      className="btn btn-primary"
                      style={{ padding: '8px 16px', fontSize: '0.8rem' }}
                    >
                      Enable Security
                    </button>
                  </div>
                </div>
              ) : (
                // DISABLE & UPDATE PASSWORD PANELS
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Change/Update Password Form */}
                  <div style={{ border: '1px solid var(--border-light)', borderRadius: '8px', padding: '16px', background: 'rgba(0,0,0,0.15)' }}>
                    <h4 style={{ fontSize: '0.85rem', color: 'white', fontWeight: 600, marginBottom: '12px' }}>
                      Change Security Password
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <input
                        type="password"
                        placeholder="Current Password"
                        value={currentPass}
                        onChange={(e) => setCurrentPass(e.target.value)}
                        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '6px 10px', color: 'white', fontSize: '0.8rem' }}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="password"
                          placeholder="New Password"
                          value={updateNewPass}
                          onChange={(e) => setUpdateNewPass(e.target.value)}
                          style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '6px 10px', color: 'white', fontSize: '0.8rem' }}
                        />
                        <button 
                          type="button" 
                          onClick={() => handlePasswordConfig('UPDATE')}
                          className="btn btn-primary"
                          style={{ padding: '6px 16px', fontSize: '0.8rem' }}
                        >
                          Update Password
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Disable Password Form */}
                  <div style={{ border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px', padding: '16px', background: 'rgba(245,158,11,0.02)' }}>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--color-warning)', fontWeight: 600, marginBottom: '6px' }}>
                      Disable Password Security
                    </h4>
                    <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '10px' }}>
                      This will remove password restrictions. The workspace directory, canvas, and leads list will become public.
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="password"
                        placeholder="Current Password"
                        value={currentPass}
                        onChange={(e) => setCurrentPass(e.target.value)}
                        style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '6px 10px', color: 'white', fontSize: '0.8rem' }}
                      />
                      <button 
                        type="button" 
                        onClick={() => handlePasswordConfig('DISABLE')}
                        className="btn btn-danger"
                        style={{ padding: '6px 16px', fontSize: '0.8rem', background: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.3)', color: 'var(--color-warning)' }}
                      >
                        Remove Security
                      </button>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
