import React, { useState, useEffect, useCallback } from 'react';
import { 
  fetchLeads, 
  createLead, 
  updateLead, 
  deleteLead,
  fetchExecutions
} from '../api';
import type { Lead, WorkflowExecution } from '../api';
import { Search, Plus, Filter, ArrowUpDown, ChevronLeft, ChevronRight, Edit2, Trash2, Mail, Phone, Calendar, AlertCircle } from 'lucide-react';

interface LeadsManagerProps {
  orgId: string;
  workspaceId: string;
  password?: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const LeadsManager: React.FC<LeadsManagerProps> = ({ orgId, workspaceId, password, showToast }) => {
  const [leadsList, setLeadsList] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Lead Details Drawer State
  const [selectedLeadForDetails, setSelectedLeadForDetails] = useState<Lead | null>(null);
  const [leadExecutions, setLeadExecutions] = useState<WorkflowExecution[]>([]);
  const [isLoadingExecs, setIsLoadingExecs] = useState(false);

  // Filter and Query States
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Lead Modal Dialog States
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  
  // Lead Form States
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadStatus, setLeadStatus] = useState<'NEW' | 'CONTACTED' | 'QUALIFIED' | 'LOST'>('NEW');
  const [leadSource, setLeadSource] = useState('MANUAL');

  const loadLeads = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchLeads(orgId, workspaceId, {
        page,
        limit,
        search,
        status: statusFilter,
        source: sourceFilter,
        sortBy,
        sortOrder
      }, password);
      
      setLeadsList(data.leads);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      showToast(`Failed to load leads list: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [orgId, workspaceId, page, limit, search, statusFilter, sourceFilter, sortBy, sortOrder, password, showToast]);

  const handleOpenDetails = async (lead: Lead) => {
    setSelectedLeadForDetails(lead);
    setIsLoadingExecs(true);
    try {
      const data = await fetchExecutions(orgId, workspaceId, password);
      // Filter executions that ran for this contact's phone
      const filtered = data.filter(e => e.contactId === lead.phone);
      setLeadExecutions(filtered);
    } catch (err: any) {
      showToast(`Failed to load activity logs: ${err.message}`, 'error');
    } finally {
      setIsLoadingExecs(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // Debounced search logic or simple trigger on change/submit
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1); // Reset page on query change
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSourceFilter(e.target.value);
    setPage(1);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc'); // Default to descending
    }
    setPage(1);
  };

  // Lead CRUD Operations
  const handleOpenAdd = () => {
    setEditingLead(null);
    setLeadName('');
    setLeadEmail('');
    setLeadPhone('');
    setLeadStatus('NEW');
    setLeadSource('MANUAL');
    setShowModal(true);
  };

  const handleOpenEdit = (lead: Lead) => {
    setEditingLead(lead);
    setLeadName(lead.name);
    setLeadEmail(lead.email || '');
    setLeadPhone(lead.phone);
    setLeadStatus(lead.status);
    setLeadSource(lead.source);
    setShowModal(true);
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadName.trim() || !leadPhone.trim()) return;

    try {
      const payload: Omit<Lead, 'workspaceId'> = {
        name: leadName,
        phone: leadPhone,
        email: leadEmail.trim() ? leadEmail : null,
        status: leadStatus,
        source: leadSource
      };

      if (editingLead && editingLead.id) {
        await updateLead(orgId, workspaceId, editingLead.id, payload, password);
        showToast('Lead updated successfully!', 'success');
      } else {
        await createLead(orgId, workspaceId, payload, password);
        showToast('New lead added successfully!', 'success');
      }

      setShowModal(false);
      loadLeads();
    } catch (err: any) {
      showToast(`Lead operation failed: ${err.message}`, 'error');
    }
  };

  const handleDeleteLead = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete lead "${name}"?`)) return;

    try {
      await deleteLead(orgId, workspaceId, id, password);
      showToast('Lead deleted.', 'success');
      loadLeads();
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      height: '100%',
      background: '#0a0b10',
      padding: '24px',
      overflow: 'hidden'
    }}>
      {/* Directory Title Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px'
      }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Leads Directory
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Manage incoming prospects and manual support contact leads ({total} total leads).
          </p>
        </div>

        <button className="btn btn-primary" onClick={handleOpenAdd}>
          <Plus size={16} />
          <span>Add Lead</span>
        </button>
      </div>

      {/* Query Filters Dashboard */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px',
        background: 'rgba(20, 22, 34, 0.4)',
        border: '1px solid var(--border-light)',
        padding: '12px 16px',
        borderRadius: '10px'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search leads by name, phone, or email..."
            value={search}
            onChange={handleSearchChange}
            style={{
              width: '100%',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-light)',
              borderRadius: '6px',
              padding: '6px 10px 6px 32px',
              color: 'white',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>Status:</span>
          <select 
            value={statusFilter} 
            onChange={handleStatusChange}
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-light)', color: 'white', fontSize: '0.8rem', padding: '6px 10px', borderRadius: '6px', outline: 'none' }}
          >
            <option value="">All Statuses</option>
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="LOST">Lost</option>
          </select>
        </div>

        {/* Source Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>Source:</span>
          <select 
            value={sourceFilter} 
            onChange={handleSourceChange}
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-light)', color: 'white', fontSize: '0.8rem', padding: '6px 10px', borderRadius: '6px', outline: 'none' }}
          >
            <option value="">All Sources</option>
            <option value="WEBHOOK">Webhook</option>
            <option value="MANUAL">Manual</option>
            <option value="FACEBOOK">Facebook</option>
          </select>
        </div>
      </div>

      {/* Grid Directory Table */}
      <div style={{
        flex: 1,
        border: '1px solid var(--border-light)',
        borderRadius: '10px',
        background: 'rgba(15, 23, 42, 0.45)',
        overflowY: 'auto',
        position: 'relative'
      }}>
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#94a3b8' }}>
            <span>Loading leads...</span>
          </div>
        ) : leadsList.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#64748b', gap: '10px' }}>
            <AlertCircle size={28} />
            <span style={{ fontSize: '0.85rem' }}>No leads found matching your criteria.</span>
          </div>
        ) : (
          <table className="log-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>
                  Name <ArrowUpDown size={10} style={{ marginLeft: '4px' }} />
                </th>
                <th>Contact details</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('status')}>
                  Status <ArrowUpDown size={10} style={{ marginLeft: '4px' }} />
                </th>
                <th>Source</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('createdAt')}>
                  Added Date <ArrowUpDown size={10} style={{ marginLeft: '4px' }} />
                </th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leadsList.map((lead) => (
                <tr key={lead.id}>
                  <td 
                    style={{ fontWeight: 650, color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => handleOpenDetails(lead)}
                  >
                    {lead.name}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
                        <Phone size={11} className="text-secondary" />
                        {lead.phone}
                      </span>
                      {lead.email && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.75rem' }}>
                          <Mail size={11} />
                          {lead.email}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${lead.status.toLowerCase()}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td>
                    <span style={{ background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>
                      {lead.source}
                    </span>
                  </td>
                  <td style={{ color: '#cbd5e1' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={11} style={{ color: '#64748b' }} />
                      {formatDate(lead.createdAt)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => handleOpenEdit(lead)}
                        style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', display: 'flex', padding: '4px' }}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button 
                        onClick={() => lead.id && handleDeleteLead(lead.id, lead.name)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', display: 'flex', padding: '4px' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '16px',
        padding: '0 8px'
      }}>
        {/* Limit Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#94a3b8' }}>
          <span>Show:</span>
          <select 
            value={limit} 
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-light)', color: 'white', padding: '4px 8px', borderRadius: '6px', outline: 'none' }}
          >
            <option value={5}>5 leads</option>
            <option value={10}>10 leads</option>
            <option value={25}>25 leads</option>
          </select>
        </div>

        {/* Page navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            disabled={page <= 1}
            onClick={() => setPage(prev => Math.max(1, prev - 1))}
            className="btn"
            style={{ padding: '6px' }}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: '0.8rem', color: '#fff', fontWeight: 500 }}>
            Page {page} of {totalPages}
          </span>
          <button 
            disabled={page >= totalPages}
            onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
            className="btn"
            style={{ padding: '6px' }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Manual Add / Edit Lead Dialog Modal */}
      {showModal && (
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
          zIndex: 950
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
            <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'white' }}>
                {editingLead ? 'Edit Lead Details' : 'Add New Prospect Lead'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveLead} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="node-input-group">
                <label>Contact Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  required
                />
              </div>

              <div className="node-input-group">
                <label>WhatsApp / Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +919876543210"
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  required
                />
              </div>

              <div className="node-input-group">
                <label>Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="e.g. john@example.com"
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="node-input-group">
                  <label>Status</label>
                  <select 
                    value={leadStatus}
                    onChange={(e) => setLeadStatus(e.target.value as any)}
                  >
                    <option value="NEW">New</option>
                    <option value="CONTACTED">Contacted</option>
                    <option value="QUALIFIED">Qualified</option>
                    <option value="LOST">Lost</option>
                  </select>
                </div>
                
                <div className="node-input-group">
                  <label>Source</label>
                  <select 
                    value={leadSource}
                    onChange={(e) => setLeadSource(e.target.value)}
                  >
                    <option value="MANUAL">Manual</option>
                    <option value="WEBHOOK">Webhook</option>
                    <option value="FACEBOOK">Facebook</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button type="button" className="btn" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingLead ? 'Save Changes' : 'Create Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Lead Details & Activity Timeline Drawer */}
      {selectedLeadForDetails && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '450px',
          height: '100vh',
          background: 'var(--bg-node)',
          borderLeft: '1px solid var(--border-light)',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
          padding: '24px',
          zIndex: 960,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>Lead Details</h3>
            <button 
              onClick={() => setSelectedLeadForDetails(null)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Details Body */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,0,0,0.15)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>{selectedLeadForDetails.name}</div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#cbd5e1', marginTop: '4px' }}>
                <Phone size={13} style={{ color: 'var(--color-primary)' }} />
                <span>{selectedLeadForDetails.phone}</span>
              </div>
              
              {selectedLeadForDetails.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: '#cbd5e1' }}>
                  <Mail size={13} style={{ color: 'var(--color-primary)' }} />
                  <span>{selectedLeadForDetails.email}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <span className={`status-badge ${selectedLeadForDetails.status.toLowerCase()}`}>
                  {selectedLeadForDetails.status}
                </span>
                <span style={{ background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 'bold' }}>
                  Source: {selectedLeadForDetails.source}
                </span>
              </div>
            </div>

            {/* Timeline Header */}
            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px', marginBottom: '12px' }}>
                Activity Timeline
              </h4>

              {isLoadingExecs ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  Loading activity timeline...
                </div>
              ) : leadExecutions.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                  No automation activity recorded for this lead.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingLeft: '8px', borderLeft: '2px solid var(--border-light)', marginTop: '12px' }}>
                  {leadExecutions.map((exec) => (
                    <div key={exec.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {/* Timeline dot */}
                      <div style={{ position: 'absolute', left: '-13px', top: '4px', width: '8px', height: '8px', borderRadius: '50%', background: exec.status === 'SUCCESS' ? 'var(--color-success)' : 'var(--color-danger)' }} />
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, color: 'white' }}>
                        <span>Automation: {exec.workflow?.name || 'Workflow Run'}</span>
                        <span className={`status-badge ${exec.status.toLowerCase()}`} style={{ marginLeft: 'auto', padding: '1px 5px', fontSize: '0.6rem' }}>
                          {exec.status}
                        </span>
                      </div>
                      
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        Executed: {formatDate(exec.createdAt)} at {new Date(exec.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>

                      {/* Step Results timeline logs */}
                      <div style={{ background: 'rgba(0,0,0,0.1)', padding: '10px', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '4px', border: '1px solid rgba(255,255,255,0.02)' }}>
                        {exec.stepResults.map((step, idx) => (
                          <div key={idx} style={{ color: '#cbd5e1' }}>
                            <span style={{ fontWeight: 'bold', color: step.status === 'SUCCESS' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                              ●
                            </span>{' '}
                            <strong>{step.nodeType === 'incomingMessage' ? 'Trigger' : step.nodeType === 'condition' ? 'If/Else' : 'Action'}:</strong> {step.details}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Simple helper because the close button icon wasn't imported
const X = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);
