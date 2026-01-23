import React, { useCallback, useEffect } from 'react';
import ReactFlow, {
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    addEdge,
    ConnectionLineType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getLayoutedElements } from '../utils/layout';

const CodeGraph = ({ data }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [expandedNodeIds, setExpandedNodeIds] = React.useState(new Set());

    // Initialize/Reset expansion when data loads
    useEffect(() => {
        if (data) {
            // Start with only the root expanded
            setExpandedNodeIds(new Set([data.id]));
        }
    }, [data]);

    useEffect(() => {
        if (data) {
            // Re-calculate layout whenever data or expansion state changes
            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(data, expandedNodeIds);
            setNodes(layoutedNodes);
            setEdges(layoutedEdges);
        }
    }, [data, expandedNodeIds, setNodes, setEdges]);

    const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

    const onNodeClick = useCallback((event, node) => {
        // Toggle expansion
        if (node.data.children && node.data.children.length > 0) {
            const newExpanded = new Set(expandedNodeIds);
            if (newExpanded.has(node.id)) {
                newExpanded.delete(node.id);
            } else {
                newExpanded.add(node.id);
            }
            setExpandedNodeIds(newExpanded);
        }
    }, [expandedNodeIds]);

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                connectionLineType={ConnectionLineType.SmoothStep}
                fitView
            >
                <Background gap={16} color="#444" />
                <Controls />
            </ReactFlow>
        </div>
    );
};

export default CodeGraph;
