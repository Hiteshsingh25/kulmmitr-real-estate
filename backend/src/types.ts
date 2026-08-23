export type NodeType = 'incomingMessage' | 'condition' | 'sendWhatsapp';

export interface BaseNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
}

export interface TriggerNodeData {
  keyword: string; // The text phrase that matches, or '*' for any message
}

export interface ConditionNodeData {
  field: 'messageText' | 'contactId';
  operator: 'EQUALS' | 'CONTAINS' | 'STARTS_WITH';
  value: string;
}

export interface ActionNodeData {
  message: string;
}

export interface WorkflowNode extends BaseNode {
  data: TriggerNodeData | ConditionNodeData | ActionNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: 'true' | 'false' | null; // Used by conditions to branch
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface StepResult {
  nodeId: string;
  nodeType: NodeType;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  details: string;
  timestamp: string;
}
