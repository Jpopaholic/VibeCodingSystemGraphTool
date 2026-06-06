import React, { useMemo, useCallback } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useWorkspace } from '../context/WorkspaceContext';

// Custom Node wrapper to style and display states
const CustomNode = ({ data }) => {
  const { name, produce, status, isNudge, t } = data;
  return (
    <div className={`vibegraph-node ${status} ${isNudge ? 'nudge' : ''}`}>
      <div className="node-title-container">
        <span className="node-name">{name}</span>
        <span className={`node-badge ${status}`}>{status}</span>
      </div>
      <div className="node-produce" title={produce}>
        {produce || (t ? t('nodeProducePrompt') : 'What does this produce?')}
      </div>
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode
};

export default function GraphCanvas({ 
  selectedNodeId,
  onSelectNode
}) {
  const { 
    nodes: graphNodes, 
    addNode, 
    deleteNode, 
    updateDependencies,
    language,
    t
  } = useWorkspace();

  // 1. Calculate Progression Nudge (💡 推薦開發的底層節點)
  const nudgeNodeIds = useMemo(() => {
    const completedIds = new Set(
      graphNodes
        .filter(n => n.synthesis?.status === 'completed')
        .map(n => n.id)
    );

    return graphNodes
      .filter(node => {
        const status = node.synthesis?.status || 'todo';
        if (status === 'completed') return false;
        
        const deps = node.dependencies || [];
        if (deps.length === 0) return true;
        
        return deps.every(depId => completedIds.has(depId));
      })
      .map(n => n.id);
  }, [graphNodes]);

  // 2. Custom Hierarchical Layout Engine
  const { layoutNodes, layoutEdges } = useMemo(() => {
    if (!graphNodes || graphNodes.length === 0) {
      return { layoutNodes: [], layoutEdges: [] };
    }

    const levels = {};
    const adjList = {};
    
    graphNodes.forEach(n => {
      adjList[n.id] = [];
    });
    
    graphNodes.forEach(n => {
      const deps = n.dependencies || [];
      deps.forEach(depId => {
        if (adjList[depId]) {
          adjList[depId].push(n.id);
        }
      });
    });

    const visited = {};
    const computeLevel = (nodeId) => {
      if (nodeId in levels) return levels[nodeId];
      if (visited[nodeId]) return 0;
      
      visited[nodeId] = true;
      const node = graphNodes.find(n => n.id === nodeId);
      const deps = node ? (node.dependencies || []) : [];
      
      if (deps.length === 0) {
        levels[nodeId] = 0;
      } else {
        let maxDepLevel = -1;
        deps.forEach(depId => {
          maxDepLevel = Math.max(maxDepLevel, computeLevel(depId));
        });
        levels[nodeId] = maxDepLevel + 1;
      }
      
      visited[nodeId] = false;
      return levels[nodeId];
    };

    graphNodes.forEach(n => {
      computeLevel(n.id);
    });

    const levelGroups = {};
    Object.entries(levels).forEach(([nodeId, lvl]) => {
      if (!levelGroups[lvl]) levelGroups[lvl] = [];
      levelGroups[lvl].push(nodeId);
    });

    const computedNodes = graphNodes.map(node => {
      const lvl = levels[node.id] || 0;
      const group = levelGroups[lvl] || [node.id];
      const index = group.indexOf(node.id);
      const count = group.length;

      const x = 350 + (index - (count - 1) / 2) * 240;
      const y = 60 + lvl * 180;

      const status = node.synthesis?.status || 'todo';
      const isNudge = nudgeNodeIds.includes(node.id);

      return {
        id: node.id,
        type: 'custom',
        position: { x, y },
        data: { 
          name: node.name, 
          produce: node.produce, 
          status: status,
          isNudge: isNudge,
          t: t
        },
        selected: node.id === selectedNodeId
      };
    });

    const computedEdges = [];
    graphNodes.forEach(node => {
      const deps = node.dependencies || [];
      deps.forEach(depId => {
        if (graphNodes.some(n => n.id === depId)) {
          const isCompleted = graphNodes.find(n => n.id === depId)?.synthesis?.status === 'completed';
          computedEdges.push({
            id: `e-${depId}-${node.id}`,
            source: depId,
            target: node.id,
            animated: isCompleted,
            style: { 
              stroke: isCompleted ? '#10b981' : '#3b82f6', 
              strokeWidth: 2 
            }
          });
        }
      });
    });

    return { layoutNodes: computedNodes, layoutEdges: computedEdges };
  }, [graphNodes, selectedNodeId, nudgeNodeIds]);

  const onNodeClick = useCallback((event, node) => {
    onSelectNode(node.id);
  }, [onSelectNode]);

  const onConnectEdges = useCallback((connection) => {
    const { source, target } = connection;
    if (source === target) return;

    const targetNode = graphNodes.find(n => n.id === target);
    if (!targetNode) return;

    const existingDeps = targetNode.dependencies || [];
    if (existingDeps.includes(source)) return;

    updateDependencies(target, [...existingDeps, source]);
  }, [graphNodes, updateDependencies]);

  const handleAddNewNode = () => {
    const namePlaceholder = language === 'en' ? 'e.g. API Service' : '例如: API Service';
    const name = prompt(t('nodeNamePrompt'), namePlaceholder);
    if (!name) return;
    const produce = prompt(t('nodeProducePrompt'), 'stores notes locally');
    if (!produce) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `node-${Date.now()}`;
    addNode({ id, name, produce });
  };

  const handleClearSelection = () => {
    onSelectNode(null);
  };

  return (
    <div className="canvas-wrapper">
      <ReactFlow
        nodes={layoutNodes}
        edges={layoutEdges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onConnect={onConnectEdges}
        onPaneClick={handleClearSelection}
        fitView
      >
        <Background color="#2a2a35" gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>

      {/* Control Buttons */}
      <div className="graph-controls">
        <button className="control-btn" onClick={handleAddNewNode}>
          <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>+</span> {t('addNodeBtn')}
        </button>
        {selectedNodeId && (
          <button 
            className="control-btn" 
            style={{ color: '#ef4444' }} 
            onClick={() => {
              if (confirm(t('deleteNodeConfirm'))) {
                deleteNode(selectedNodeId);
              }
            }}
          >
            🗑 {t('deleteNodeBtn')}
          </button>
        )}
      </div>
    </div>
  );
}
