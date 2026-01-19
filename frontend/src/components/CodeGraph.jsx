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

        // Helper to remove descendants
        const getDescendants = (parentId, currentEdges) => {
            // We only care about hierarchy edges for removal (source -> target where type is smoothstep/default)
            // But actually we can just trace edges.
            // Issue: Data flow edges might form cycles or cross hierarchy.
            // Better: Use the raw tree structure to find descendants to remove.
            // We already recursive find rawNode.

            // Simpler: Just remove anything that is in the children list of this node (recursive)
            // But 'nodes' state doesn't have hierarchy info except edges.
            // Let's us edges?
            // Hierarchy edges created by us have checkable IDs?
            // Hierarchy edges: `${node.id}-${child.id}`

            const directChildEdges = currentEdges.filter(e => e.source === parentId && e.id.startsWith(parentId));
            let descendants = [];
            directChildEdges.forEach(e => {
                descendants.push(e.target);
                descendants = [...descendants, ...getDescendants(e.target, currentEdges)];
            });
            return descendants;
        };

        if (childrenExist) {
            // COLLAPSE
            // Removing hierarchy descendants
            // We need to pass 'edges' to find descendants.
            // But wait, if we use the backend tree, we know exactly what IDs are in the subtree.
            const collectSubtreeIds = (n) => {
                let ids = [];
                if (n.children) {
                    n.children.forEach(c => {
                        ids.push(c.id);
                        ids = [...ids, ...collectSubtreeIds(c)];
                    });
                }
                return ids;
            };
            const nodesToRemove = collectSubtreeIds(rawNode);
            newNodes = newNodes.filter(n => !nodesToRemove.includes(n.id));

            // Mark as collapsed
            newNodes = newNodes.map(n => n.id === node.id ? { ...n, data: { ...n.data, expanded: false } } : n);

        } else {
            // EXPAND
            const addedNodes = rawNode.children.map(child => ({
                id: child.id,
                type: child.type,
                data: { label: child.name, expanded: false },
                position: { x: 0, y: 0 }
            }));

            newNodes = [...newNodes, ...addedNodes];

            // Mark as expanded
            newNodes = newNodes.map(n => n.id === node.id ? { ...n, data: { ...n.data, expanded: true } } : n);
        }

        // --- REBUILD EDGES ---
        // 1. Hierarchy Edges
        let hierarchyEdges = [];
        // We need to rebuild hierarchy edges for all current nodes.
        // Actually, simpler to just add/remove, but let's rebuild to be safe or just maintain.
        // Let's regenerate hierarchy edges based on newNodes content?
        // No, that's hard.
        // Let's just add/remove hierarchy edges.

        // Actually, let's rebuild ALL edges (hierarchy + data flow) from scratch based on `newNodes`.
        // This ensures Dynamic Anchoring works.

        // Helper: Is node visible?
        const isVisible = (id) => newNodes.find(n => n.id === id);

        // Helper: Get Nearest Visible Ancestor (Dynamic Anchoring)
        const getVisibleAncestor = (id, currentNode = rootData) => {
            // This is tricky. We need parent pointers.
            // Or we map ID -> ParentID beforehand.
            return id; // Placeholder if not implemented map.
        };

        // Better: Build a map of ID -> ParentID from rootData
        const parentMap = {};
        const buildParentMap = (n, pid = null) => {
            if (pid) parentMap[n.id] = pid;
            if (n.children) n.children.forEach(c => buildParentMap(c, n.id));
        };
        buildParentMap(rootData);

        const getAnchor = (id) => {
            let curr = id;
            while (curr && !isVisible(curr)) {
                curr = parentMap[curr];
            }
            return curr; // Returns ID of visible ancestor or null (if root hidden?)
        };

        // 1. Hierarchy Edges (only for visible nodes)
        // We can just traverse newNodes. For each node, if it has a visible parent, draw edge.
        hierarchyEdges = [];
        newNodes.forEach(n => {
            const pid = parentMap[n.id];
            if (pid && isVisible(pid)) {
                hierarchyEdges.push({
                    id: `${pid}-${n.id}`,
                    source: pid,
                    target: n.id,
                    type: 'smoothstep',
                    style: { stroke: '#ccc' }
                });
            }
        });

        // 2. Data Flow Edges
        let flowEdges = [];
        if (rootData.edges) {
            rootData.edges.forEach(edge => {
                const sourceAnchor = getAnchor(edge.source);
                const targetAnchor = getAnchor(edge.target);

                // Only draw if both ends have a visible anchor
                // And avoid self-loops (unless meaningful)
                if (sourceAnchor && targetAnchor && sourceAnchor !== targetAnchor) {
                    // Check if edge already exists (deduplication)
                    const edgeId = `flow-${sourceAnchor}-${targetAnchor}`;
                    if (!flowEdges.find(e => e.id === edgeId)) {
                        flowEdges.push({
                            id: edgeId,
                            source: sourceAnchor,
                            target: targetAnchor,
                            animated: true,
                            style: { stroke: '#ff0072', strokeWidth: 2 },
                            label: 'calls'
                        });
                    }
                }
            });
        }

        const finalEdges = [...hierarchyEdges, ...flowEdges];

        // 3. Re-calculate layout
        const layouted = getLayoutedElements(newNodes, finalEdges);
        setNodes([...layouted.nodes]);
        setEdges([...layouted.edges]);

    }, [nodes, edges, rootData, setNodes, setEdges]);

    // Focus feature
    // Oh, CodeGraph is inside ReactFlowProvider? No.
    // We need to use `onEdgeClick` prop on ReactFlow, but `fitView` comes from hook inside provider.
    // Or we can use the instance passed to `onInit`.
    const [rfInstance, setRfInstance] = useState(null);

    const onEdgeClick = useCallback((event, edge) => {
        if (edge.id.startsWith('flow-') && rfInstance) {
            // Find target node
            const targetNode = nodes.find(n => n.id === edge.target);
            if (targetNode) {
                rfInstance.fitView({ nodes: [targetNode], duration: 1000, padding: 0.5 });
            }
        }
    }, [nodes, rfInstance]);

    return (
        <div style={{ width: '100vw', height: '100%', borderTop: '1px solid #ccc' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                onInit={setRfInstance}
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
