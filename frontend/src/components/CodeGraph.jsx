import React, { useCallback, useState, useEffect } from 'react';
import ReactFlow, {
    addEdge,
    useNodesState,
    useEdgesState,
    Controls,
    Background
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';

import FolderNode from './nodes/FolderNode';
import FileNode from './nodes/FileNode';
import ClassNode from './nodes/ClassNode';
import FunctionNode from './nodes/FunctionNode';

const nodeTypes = {
    folder: FolderNode,
    file: FileNode,
    class: ClassNode,
    function: FunctionNode
};

// Dagre graph setup
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 172;
const nodeHeight = 80; // approximate

const getLayoutedElements = (nodes, edges) => {
    dagreGraph.setGraph({ rankdir: 'TB' });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        // adjust for center anchor
        node.targetPosition = 'top';
        node.sourcePosition = 'bottom';

        // We are shifting the dagre node position (which is top left) to React Flow (top left)
        // Actually dagre node position is center. React Flow is top left.
        // Wait, dagre node() returns x, y which is center.
        node.position = {
            x: nodeWithPosition.x - nodeWidth / 2,
            y: nodeWithPosition.y - nodeHeight / 2,
        };

        return node;
    });

    return { nodes: layoutedNodes, edges };
};

const CodeGraph = ({ rootData }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // Helper to find a node by ID in the raw tree data
    const findNodeData = (id, currentNode) => {
        if (currentNode.id === id) return currentNode;
        if (currentNode.children) {
            for (const child of currentNode.children) {
                const found = findNodeData(id, child);
                if (found) return found;
            }
        }
        return null;
    };

    useEffect(() => {
        if (rootData) {
            // Initial Node
            const initialNodes = [{
                id: rootData.id,
                type: rootData.type,
                data: { label: rootData.name, expanded: false },
                position: { x: 0, y: 0 }
            }];
            setNodes(initialNodes);
            setEdges([]);
            // No layout needed for single node really, but standardizing
        }
    }, [rootData, setNodes, setEdges]);

    const onNodeClick = useCallback((event, node) => {
        // 1. Find the raw data for this node to get children
        const rawNode = findNodeData(node.id, rootData);
        if (!rawNode || !rawNode.children || rawNode.children.length === 0) return;

        // 2. toggle expand/collapse logic
        // For simplicity, we implement EXPAND ONLY or toggle?
        // Let's check if children are already present in 'nodes'
        const childrenIds = rawNode.children.map(c => c.id);
        const childrenExist = childrenIds.every(id => nodes.find(n => n.id === id));

        let newNodes = [...nodes];
        let newEdges = [...edges];

        if (childrenExist) {
            // COLLAPSE: Remove descendants
            // Recursive removal
            const getDescendants = (parentId) => {
                const directChildren = edges.filter(e => e.source === parentId).map(e => e.target);
                let descendants = [...directChildren];
                directChildren.forEach(childId => {
                    descendants = [...descendants, ...getDescendants(childId)];
                });
                return descendants;
            };
            const nodesToRemove = getDescendants(node.id);
            newNodes = newNodes.filter(n => !nodesToRemove.includes(n.id));
            newEdges = newEdges.filter(e => !nodesToRemove.includes(e.target) && e.source !== node.id);

            // Mark as collpased
            newNodes = newNodes.map(n => n.id === node.id ? { ...n, data: { ...n.data, expanded: false } } : n);

        } else {
            // EXPAND: Add direct children
            const addedNodes = rawNode.children.map(child => ({
                id: child.id,
                type: child.type, // "folder", "file", "class", "function"
                data: { label: child.name, expanded: false },
                position: { x: 0, y: 0 } // Layouter will fix this
            }));

            const addedEdges = rawNode.children.map(child => ({
                id: `${node.id}-${child.id}`,
                source: node.id,
                target: child.id,
                type: 'smoothstep'
            }));

            newNodes = [...newNodes, ...addedNodes];
            newEdges = [...newEdges, ...addedEdges];

            // Mark as expanded
            newNodes = newNodes.map(n => n.id === node.id ? { ...n, data: { ...n.data, expanded: true } } : n);
        }

        // 3. Re-calculate layout
        const layouted = getLayoutedElements(newNodes, newEdges);
        setNodes([...layouted.nodes]);
        setEdges([...layouted.edges]);

    }, [nodes, edges, rootData, setNodes, setEdges]);

    return (
        <div style={{ width: '100vw', height: '100%', borderTop: '1px solid #ccc' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                fitView
            >
                <Controls />
                <Background color="#aaa" gap={16} />
            </ReactFlow>
        </div>
    );
};

export default CodeGraph;
