import React, { useCallback, useRef } from 'react';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  useReactFlow,
  addEdge
} from 'reactflow';
import type { Node, Edge, Connection } from 'reactflow';
import 'reactflow/dist/style.css';
import { TriggerNode, ConditionNode, ActionNode } from './CustomNodes';

// Register custom nodes
const nodeTypes = {
  incomingMessage: TriggerNode,
  condition: ConditionNode,
  sendWhatsapp: ActionNode
};

interface CanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: any;
  onEdgesChange: any;
  onConnect: (connection: Connection) => void;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  onNodeUpdate: (id: string, newData: any) => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  setNodes,
  onNodeUpdate
}) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const type = event.dataTransfer.getData('application/reactflow');

      // Check if dropped item type is valid
      if (typeof type === 'undefined' || !type) return;

      // Project client screen coordinates to React Flow coordinate grid space
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Default data fields for custom nodes
      let defaultData: any = { onUpdate: onNodeUpdate };
      if (type === 'incomingMessage') {
        defaultData.keyword = 'hello';
      } else if (type === 'condition') {
        defaultData.field = 'messageText';
        defaultData.operator = 'EQUALS';
        defaultData.value = 'yes';
      } else if (type === 'sendWhatsapp') {
        defaultData.message = 'Hello! Welcome to our automated channel.';
      }

      const newNode: Node = {
        id: `${type}_${Date.now()}`,
        type,
        position,
        data: defaultData
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes, onNodeUpdate]
  );

  return (
    <div className="canvas-container" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        fitView
      >
        <Controls style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
        <MiniMap 
          nodeColor={(n) => {
            if (n.type === 'incomingMessage') return '#f97316';
            if (n.type === 'condition') return '#8b5cf6';
            if (n.type === 'sendWhatsapp') return '#10b981';
            return '#334155';
          }}
          maskColor="rgba(15, 23, 42, 0.6)"
          style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.05)' }} 
        />
        <Background color="#1e293b" gap={16} />
      </ReactFlow>
    </div>
  );
};
