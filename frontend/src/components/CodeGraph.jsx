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
    const [searchTerm, setSearchTerm] = useState("");
    const [breadcrumbs, setBreadcrumbs] = useState([]);
    const [rfInstance, setRfInstance] = useState(null);

    // Helper to find a node by ID in the raw tree data
    const findNodeData = useCallback((id, currentNode) => {
        if (currentNode.id === id) return currentNode;
        if (currentNode.children) {
            for (const child of currentNode.children) {
                const found = findNodeData(id, child);
                if (found) return found;
            }
        }
        return null;
    }, []);

    // Helper: Build a map of ID -> ParentID from rootData
    // We need this for Go to Parent and Rebuilding edges
    const [parentMap, setParentMap] = useState({});

    useEffect(() => {
        if (rootData) {
            const map = {};
            const buildParentMap = (n, pid = null) => {
                if (pid) map[n.id] = pid;
                if (n.children) n.children.forEach(c => buildParentMap(c, n.id));
            };
            buildParentMap(rootData);
            setParentMap(map);
        }
    }, [rootData]);

    const handleGoToParent = useCallback((parentId) => {
        if (parentId && rfInstance) {
            // Check if parent is visible?
            // Ideally parent should be visible if child is.
            const parentNode = nodes.find(n => n.id === parentId);
            if (parentNode) {
                rfInstance.fitView({ nodes: [parentNode], duration: 800 });
                // Update breadcrumb to parent
                // find path to parent?
                // Just let user click parent node to update breadcrumb fully, 
                // or we can simulate it.
                // Simpler: Just focus camera.
            } else {
                // Parent might be collapsed? 
                // If we are clicking button on child, child is visible, so parent must be visible (or root).
            }
        }
    }, [rfInstance, nodes]);

    // Initial Setup
    useEffect(() => {
        if (rootData) {
            // Initial Node
            const initialNodes = [{
                id: rootData.id,
                type: rootData.type,
                data: {
                    label: rootData.name,
                    expanded: false,
                    onGoToParent: handleGoToParent,
                    parentId: null
                },
                position: { x: 0, y: 0 }
            }];
            setNodes(initialNodes);
            setEdges([]);
            setBreadcrumbs([rootData]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rootData]);

    const updateBreadcrumbs = useCallback((nodeId) => {
        // Trace back from nodeId to root using parentMap
        // But parentMap is ID->ID. We need objects for labels.
        // We can reconstruct path.
        let path = [];
        let curr = nodeId;
        while (curr) {
            const data = findNodeData(curr, rootData);
            if (data) path.unshift(data);
            curr = parentMap[curr];
        }
        setBreadcrumbs(path);
    }, [parentMap, rootData, findNodeData]);

    const onNodeClick = useCallback((event, node) => {
        updateBreadcrumbs(node.id);

        // 1. Find the raw data for this node
        const rawNode = findNodeData(node.id, rootData);
        if (!rawNode || !rawNode.children || rawNode.children.length === 0) return;

        // 2. toggle expand/collapse logic
        const childrenIds = rawNode.children.map(c => c.id);
        const childrenExist = childrenIds.every(id => nodes.find(n => n.id === id));

        let newNodes = [...nodes];

        // Helper to remove descendants
        const getDescendants = (parentId, currentEdges) => {
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
                data: {
                    label: child.name,
                    expanded: false,
                    onGoToParent: handleGoToParent,
                    parentId: node.id
                },
                position: { x: 0, y: 0 }
            }));

            newNodes = [...newNodes, ...addedNodes];

            // Mark as expanded
            newNodes = newNodes.map(n => n.id === node.id ? { ...n, data: { ...n.data, expanded: true } } : n);
        }

        // --- REBUILD EDGES ---
        const isVisible = (id) => newNodes.find(n => n.id === id);

        const getAnchor = (id) => {
            let curr = id;
            while (curr && !isVisible(curr)) {
                curr = parentMap[curr];
            }
            return curr;
        };

        // 1. Hierarchy Edges
        let hierarchyEdges = [];
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

                if (sourceAnchor && targetAnchor && sourceAnchor !== targetAnchor) {
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

    }, [nodes, rootData, parentMap, setNodes, setEdges, handleGoToParent, findNodeData, updateBreadcrumbs]);

    const onEdgeClick = useCallback((event, edge) => {
        if (edge.id.startsWith('flow-') && rfInstance) {
            const targetNode = nodes.find(n => n.id === edge.target);
            if (targetNode) {
                rfInstance.fitView({ nodes: [targetNode], duration: 1000, padding: 0.5 });
                updateBreadcrumbs(targetNode.id);
            }
        }
    }, [nodes, rfInstance, updateBreadcrumbs]);

    const handleSearch = () => {
        if (!searchTerm || !rfInstance) return;

        // Naive search: find first node containing term in label
        // Only searches VISIBLE nodes.
        const target = nodes.find(n => n.data.label.toLowerCase().includes(searchTerm.toLowerCase()));

        if (target) {
            rfInstance.fitView({ nodes: [target], duration: 1000, padding: 0.5 });
            updateBreadcrumbs(target.id);
        } else {
            alert("Node not found (it might be collapsed).");
        }
    };

    return (
        <div style={{ width: '100vw', height: '100%', borderTop: '1px solid #ccc', position: 'relative' }}>
            {/* Navigation Controls Overlay */}
            <div style={{
                position: 'absolute', top: 10, left: 10, zIndex: 1000,
                display: 'flex', flexDirection: 'column', gap: '5px'
            }}>
                {/* Breadcrumbs */}
                <div style={{ background: 'rgba(255,255,255,0.9)', padding: '5px 10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px' }}>
                    {breadcrumbs.length === 0 && <span style={{ color: '#888' }}>Root</span>}
                    {breadcrumbs.map((b, i) => (
                        <span key={b.id}>
                            {i > 0 && " > "}
                            <span style={{ fontWeight: i === breadcrumbs.length - 1 ? 'bold' : 'normal', cursor: 'pointer' }}
                                onClick={() => {
                                    // Focus on this node
                                    const n = nodes.find(x => x.id === b.id);
                                    if (n && rfInstance) {
                                        rfInstance.fitView({ nodes: [n], duration: 500 });
                                        // truncate breadcrumbs
                                        setBreadcrumbs(breadcrumbs.slice(0, i + 1));
                                    }
                                }}>
                                {b.name}
                            </span>
                        </span>
                    ))}
                </div>
            </div>

            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, display: 'flex', gap: '5px' }}>
                <input
                    type="text"
                    placeholder="Search node..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
                <button onClick={handleSearch} style={{ padding: '5px 10px', cursor: 'pointer' }}>Go</button>
            </div>

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
