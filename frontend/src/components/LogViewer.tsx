import React, { useState } from 'react';
import type { WorkflowExecution, WhatsAppMessageLog } from '../api';
import { ChevronDown, ChevronRight, Activity, MessageCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface LogViewerProps {
  executions: WorkflowExecution[];
  historyLogs: WhatsAppMessageLog[];
  onRefresh: () => void;
  onClearHistory: () => void;
  isRefreshing: boolean;
}

export const LogViewer: React.FC<LogViewerProps> = ({
  executions,
  historyLogs,
  onRefresh,
  onClearHistory,
  isRefreshing
}) => {
  const [activeTab, setActiveTab] = useState<'executions' | 'whatsapp'>('executions');
  const [expandedExecutions, setExpandedExecutions] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedExecutions(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bottom-drawer">
      <div className="drawer-tabs">
        <div 
          className={`drawer-tab ${activeTab === 'executions' ? 'active' : ''}`}
          onClick={() => setActiveTab('executions')}
        >
          <Activity size={14} />
          <span>Execution Engine Logs ({executions.length})</span>
        </div>
        <div 
          className={`drawer-tab ${activeTab === 'whatsapp' ? 'active' : ''}`}
          onClick={() => setActiveTab('whatsapp')}
        >
          <MessageCircle size={14} />
          <span>Simulated WhatsApp Logs ({historyLogs.length})</span>
        </div>
        
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingRight: '12px', gap: '8px' }}>
          {activeTab === 'whatsapp' && historyLogs.length > 0 && (
            <button className="btn btn-danger" onClick={onClearHistory} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
              Clear Outbox
            </button>
          )}
          <button 
            className="btn" 
            onClick={onRefresh} 
            disabled={isRefreshing}
            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="drawer-content">
        {activeTab === 'executions' ? (
          executions.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', gap: '8px' }}>
              <AlertCircle size={24} />
              <p style={{ fontSize: '0.85rem' }}>No workflow execution logs found for this tenant yet.</p>
              <p style={{ fontSize: '0.75rem' }}>Trigger a simulated incoming webhook in the panel above to begin.</p>
            </div>
          ) : (
            <table className="log-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th>ID</th>
                  <th>Workflow</th>
                  <th>Sender (Contact)</th>
                  <th>Status</th>
                  <th>Execution Time</th>
                </tr>
              </thead>
              <tbody>
                {executions.map((exec) => {
                  const isExpanded = !!expandedExecutions[exec.id];
                  return (
                    <React.Fragment key={exec.id}>
                      <tr 
                        onClick={() => toggleExpand(exec.id)} 
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </td>
                        <td style={{ fontFamily: 'monospace', color: '#64748b' }}>
                          {exec.id.substring(0, 8)}...
                        </td>
                        <td style={{ fontWeight: '500' }}>
                          {exec.workflow?.name || 'Deleted Workflow'}
                        </td>
                        <td>
                          {exec.contactId}
                        </td>
                        <td>
                          <span className={`status-badge ${exec.status.toLowerCase()}`}>
                            {exec.status}
                          </span>
                        </td>
                        <td>
                          {formatDate(exec.createdAt)}
                        </td>
                      </tr>
                      
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} style={{ padding: '4px 12px 12px 42px' }}>
                            <div className="nested-steps">
                              <div style={{ fontWeight: '600', fontSize: '0.75rem', marginBottom: '4px', color: '#94a3b8' }}>
                                Execution Trace:
                              </div>
                              {exec.stepResults && Array.isArray(exec.stepResults) && exec.stepResults.map((step, idx) => (
                                <div key={idx} className="step-row">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className={`step-type-badge ${step.nodeType}`}>
                                      {step.nodeType === 'incomingMessage' ? 'Trigger' : step.nodeType === 'condition' ? 'If/Else' : 'Action'}
                                    </span>
                                    <span className="step-details">{step.details}</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className={`status-badge ${step.status.toLowerCase()}`} style={{ fontSize: '0.65rem' }}>
                                      {step.status}
                                    </span>
                                    <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                                      {formatDate(step.timestamp)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )
        ) : (
          historyLogs.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', gap: '8px' }}>
              <MessageCircle size={24} />
              <p style={{ fontSize: '0.85rem' }}>WhatsApp message outbox is empty.</p>
              <p style={{ fontSize: '0.75rem' }}>When a workflow sends a message, it will be catalogued here.</p>
            </div>
          ) : (
            <div className="history-list">
              {historyLogs.map((log, idx) => (
                <div key={idx} className="history-card">
                  <div className="meta">
                    <span>TO: {log.contactId}</span>
                    <span>{formatDate(log.timestamp)}</span>
                  </div>
                  <div className="msg">
                    {log.message}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};
