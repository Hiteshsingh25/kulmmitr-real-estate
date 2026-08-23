import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { MessageSquare, HelpCircle, Send } from 'lucide-react';

// Custom Trigger Node Component
export const TriggerNode = memo(({ id, data }: any) => {
  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (data.onUpdate) {
      data.onUpdate(id, { ...data, keyword: e.target.value });
    }
  };

  return (
    <div className="custom-node trigger">
      <div className="node-header">
        <MessageSquare size={14} />
        <span>Incoming Msg (Trigger)</span>
      </div>
      <div className="node-body">
        <div className="node-input-group">
          <label>Trigger Phrase / Keyword</label>
          <input
            type="text"
            value={data.keyword || ''}
            onChange={handleKeywordChange}
            placeholder="e.g. hello (use * for all)"
            className="nodrag"
          />
        </div>
      </div>
      {/* Trigger node only has a source handle */}
      <Handle type="source" position={Position.Right} id="main" />
    </div>
  );
});

// Custom Condition Node Component
export const ConditionNode = memo(({ id, data }: any) => {
  const handleUpdate = (fieldKey: string, value: string) => {
    if (data.onUpdate) {
      data.onUpdate(id, { ...data, [fieldKey]: value });
    }
  };

  return (
    <div className="custom-node condition">
      <div className="node-header">
        <HelpCircle size={14} />
        <span>If / Else (Condition)</span>
      </div>
      <div className="node-body">
        <div className="node-input-group">
          <label>Check Field</label>
          <select
            value={data.field || 'messageText'}
            onChange={(e) => handleUpdate('field', e.target.value)}
            className="nodrag"
          >
            <option value="messageText">Message Text</option>
            <option value="contactId">Sender Number (ID)</option>
          </select>
        </div>

        <div className="node-input-group">
          <label>Operator</label>
          <select
            value={data.operator || 'EQUALS'}
            onChange={(e) => handleUpdate('operator', e.target.value)}
            className="nodrag"
          >
            <option value="EQUALS">Equals</option>
            <option value="CONTAINS">Contains</option>
            <option value="STARTS_WITH">Starts With</option>
          </select>
        </div>

        <div className="node-input-group">
          <label>Compare Value</label>
          <input
            type="text"
            value={data.value || ''}
            onChange={(e) => handleUpdate('value', e.target.value)}
            placeholder="e.g. price"
            className="nodrag"
          />
        </div>
      </div>

      {/* Target handle for incoming execution path */}
      <Handle type="target" position={Position.Left} id="input" />

      {/* Two branching source handles */}
      <div className="condition-handle-label false" style={{ top: 'calc(35% - 8px)' }}>False (Else)</div>
      <Handle 
        type="source" 
        position={Position.Right} 
        id="false" 
        style={{ top: '35%', background: '#ef4444' }} 
      />

      <div className="condition-handle-label true" style={{ top: 'calc(65% - 8px)' }}>True (If)</div>
      <Handle 
        type="source" 
        position={Position.Right} 
        id="true" 
        style={{ top: '65%', background: '#10b981' }} 
      />
    </div>
  );
});

// Custom Action Node Component
export const ActionNode = memo(({ id, data }: any) => {
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (data.onUpdate) {
      data.onUpdate(id, { ...data, message: e.target.value });
    }
  };

  return (
    <div className="custom-node action">
      <div className="node-header">
        <Send size={14} />
        <span>Send WhatsApp (Action)</span>
      </div>
      <div className="node-body">
        <div className="node-input-group">
          <label>Message Content</label>
          <textarea
            value={data.message || ''}
            onChange={handleMessageChange}
            placeholder="Hello! How can we help you today?"
            className="nodrag"
          />
        </div>
      </div>

      {/* Action node has both target and source handles */}
      <Handle type="target" position={Position.Left} id="input" />
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  );
});
