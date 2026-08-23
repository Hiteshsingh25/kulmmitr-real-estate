import React from 'react';
import { MessageSquare, HelpCircle, Send, Play, BarChart2 } from 'lucide-react';
import type { WorkspaceSummary } from '../api';

interface SidebarProps {
  summary: WorkspaceSummary | null;
  onSave: () => void;
  onClearCanvas: () => void;
  activeWorkflowName: string;
  setActiveWorkflowName: (name: string) => void;
  status: 'ACTIVE' | 'DRAFT' | 'INACTIVE';
  setStatus: (status: 'ACTIVE' | 'DRAFT' | 'INACTIVE') => void;
  isSaving: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  summary,
  onSave,
  onClearCanvas,
  activeWorkflowName,
  setActiveWorkflowName,
  status,
  setStatus,
  isSaving
}) => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="sidebar">
      {/* KULMITRA Branding Header in Sidebar */}
      <div className="sidebar-title">
        <Play size={18} className="text-primary" />
        <span>KULMITRA Editor</span>
      </div>

      {/* Live Workspace Statistics Dashboard Widget */}
      {summary && (
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px',
          marginBottom: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <h4 style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
            <BarChart2 size={13} style={{ color: 'var(--color-primary)' }} />
            <span>Workspace Statistics</span>
          </h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ background: 'white', border: '1px solid #f1f5f9', borderRadius: '8px', padding: '10px 6px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{summary.leadsCount}</div>
              <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 650, marginTop: '2px' }}>Total Leads</div>
            </div>
            <div style={{ background: 'white', border: '1px solid #f1f5f9', borderRadius: '8px', padding: '10px 6px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{summary.workflowsCount}</div>
              <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 650, marginTop: '2px' }}>Workflows</div>
            </div>
          </div>
          
          <div style={{ background: 'white', border: '1px solid #f1f5f9', borderRadius: '8px', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyBetween: 'space-between', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
            <div>
              <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 650 }}>Automation Rate</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '2px' }}>
                {summary.successRate}%
              </div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 500 }}>Runs: {summary.executionsCount}</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--color-success)', fontWeight: 700 }}>Passed: {summary.successfulExecutionsCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Properties configuration */}
      <div className="node-input-group" style={{ marginBottom: '16px' }}>
        <label>Workflow Name</label>
        <input
          type="text"
          value={activeWorkflowName}
          onChange={(e) => setActiveWorkflowName(e.target.value)}
          placeholder="e.g. Lead Auto-responder"
          style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '8px 12px', fontSize: '0.85rem' }}
        />
      </div>

      <div className="node-input-group" style={{ marginBottom: '24px' }}>
        <label>Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '8px 12px', fontSize: '0.85rem' }}
        >
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active (Live)</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      <div className="sidebar-title" style={{ marginTop: '10px', fontSize: '0.9rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        <span>Drag & Drop Nodes</span>
      </div>
      
      <div className="draggable-nodes">
        <div
          className="dndnode trigger"
          onDragStart={(event) => onDragStart(event, 'incomingMessage')}
          draggable
        >
          <div className="node-icon-wrapper">
            <MessageSquare size={16} />
          </div>
          <div className="node-desc">
            <span>Incoming Message</span>
            <span>Trigger node</span>
          </div>
        </div>

        <div
          className="dndnode condition"
          onDragStart={(event) => onDragStart(event, 'condition')}
          draggable
        >
          <div className="node-icon-wrapper">
            <HelpCircle size={16} />
          </div>
          <div className="node-desc">
            <span>Condition (If/Else)</span>
            <span>Split path based on text</span>
          </div>
        </div>

        <div
          className="dndnode action"
          onDragStart={(event) => onDragStart(event, 'sendWhatsapp')}
          draggable
        >
          <div className="node-icon-wrapper">
            <Send size={16} />
          </div>
          <div className="node-desc">
            <span>Send WhatsApp</span>
            <span>Message sending action</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
        <button className="btn btn-primary" onClick={onSave} disabled={isSaving} style={{ width: '100%', justifyContent: 'center' }}>
          {isSaving ? 'Saving...' : 'Save Workflow'}
        </button>
        <button className="btn btn-danger" onClick={onClearCanvas} style={{ width: '100%', justifyContent: 'center' }}>
          Clear Canvas
        </button>
      </div>
    </aside>
  );
};
