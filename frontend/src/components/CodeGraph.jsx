import React, { useCallback, useState, useEffect } from 'react';
import ReactFlow, {
    addEdge,
    useNodesState,
    useEdgesState,
    Controls,
    Background
} from 'reactflow';
import { getElkLayoutedElements } from '../utils/elkLayout';
import 'reactflow/dist/style.css';
import { useTheme } from '../contexts/ThemeContext';

import FolderNode from './nodes/FolderNode';
import FileNode from './nodes/FileNode';
import ClassNode from './nodes/ClassNode';
import FunctionNode from './nodes/FunctionNode';
import InteractiveEdge from './edges/InteractiveEdge';

const nodeTypes = {
    folder: FolderNode,
    file: FileNode,
    class: ClassNode,
    function: FunctionNode
};

const edgeTypes = {
    interactive: InteractiveEdge,
};

// Dagre graph setup removed

// Dagre getLayoutedElements removed

const CodeGraph = ({ rootData }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [breadcrumbs, setBreadcrumbs] = useState([]);
    const [rfInstance, setRfInstance] = useState(null);
    const { theme } = useTheme();

    const [autoFit, setAutoFit] = useState(true);
    const [centerNode, setCenterNode] = useState(false);
    const [isLayoutLocked, setIsLayoutLocked] = useState(false);
    const [activeConnectionNodeId, setActiveConnectionNodeId] = useState(null);
    const [zoomLevel, setZoomLevel] = useState(1);

    // Update zoom level state when graph is moved/zoomed by user
    const onMove = useCallback((event, viewport) => {
        setZoomLevel(viewport.zoom);
    }, []);

    const handleZoomChange = (e) => {
        const newZoom = parseFloat(e.target.value);
        setZoomLevel(newZoom);
        if (rfInstance) {
            rfInstance.zoomTo(newZoom, { duration: 300 });
        }
    };

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

    const [tooltip, setTooltip] = useState({ content: '', x: 0, y: 0, visible: false });

    // Tooltip handlers
    const handleShowTooltip = useCallback((content, x, y) => {
        setTooltip({ content, x, y, visible: true });
    }, []);

    const handleHideTooltip = useCallback(() => {
        setTooltip(prev => ({ ...prev, visible: false }));
    }, []);

    const handleToggleConnections = useCallback((nodeId) => {
        setActiveConnectionNodeId(prev => (prev === nodeId ? null : nodeId));
    }, []);

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
                    parentId: null,
                    description: rootData.description,
                    onShowTooltip: handleShowTooltip,
                    onHideTooltip: handleHideTooltip,
                    onToggleConnections: handleToggleConnections,
                    isConnectionsActive: activeConnectionNodeId === rootData.id
                },
                position: { x: 0, y: 0 }
            }];
            setNodes(initialNodes);
            setEdges([]);
            setBreadcrumbs([rootData]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rootData]); // Dependencies adjusted

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

    const generateEdges = useCallback((currentNodes, activeId) => {
        const isVisible = (id) => currentNodes.find(n => n.id === id);

        const getAnchor = (id) => {
            let curr = id;
            while (curr && !isVisible(curr)) {
                curr = parentMap[curr];
            }
            return curr;
        };

        const shouldShowEdge = (sourceId, targetId) => {
            if (!activeId) return false;
            const sAnchor = getAnchor(sourceId);
            const tAnchor = getAnchor(targetId);
            if (activeId === sAnchor || activeId === tAnchor) return true;
            return false;
        };

        let hierarchyEdges = [];
        currentNodes.forEach(n => {
            const pid = parentMap[n.id];
            if (pid && isVisible(pid)) {
                hierarchyEdges.push({
                    id: `${pid}-${n.id}`,
                    source: pid,
                    target: n.id,
                    type: 'smoothstep',
                    pathOptions: { borderRadius: 20 },
                    style: { stroke: '#ccc' }
                });
            }
        });

        // Helper for unique durable colors
        const getEdgeColor = (id) => {
            let hash = 0;
            for (let i = 0; i < id.length; i++) {
                hash = id.charCodeAt(i) + ((hash << 5) - hash);
            }
            // Use HSL for better control over vibrancy/visibility
            const hue = Math.abs(hash % 360);
            return `hsl(${hue}, 70%, 50%)`;
        };

        let flowEdges = [];
        if (rootData.edges) {
            rootData.edges.forEach(edge => {
                const sourceAnchor = getAnchor(edge.source);
                const targetAnchor = getAnchor(edge.target);

                if (sourceAnchor && targetAnchor && sourceAnchor !== targetAnchor) {
                    const edgeId = `flow-${sourceAnchor}-${targetAnchor}`;
                    // Avoid duplicates
                    if (!flowEdges.find(e => e.id === edgeId)) {
                        flowEdges.push({
                            id: edgeId,
                            source: sourceAnchor,
                            target: targetAnchor,
                            type: 'interactive',
                            data: {
                                targetId: targetAnchor,
                                hasHiddenTarget: targetAnchor !== edge.target
                            },
                            animated: true,
                            style: { stroke: getEdgeColor(edgeId), strokeWidth: 2 },
                            label: '', // Label handled by renderer now
                            hidden: !shouldShowEdge(sourceAnchor, targetAnchor)
                        });
                    }
                }
            });
        }
        return [...hierarchyEdges, ...flowEdges];
    }, [parentMap, rootData]);

    // Reactive Edge Update
    useEffect(() => {
        if (nodes.length > 0) {
            const updatedEdges = generateEdges(nodes, activeConnectionNodeId);
            setEdges(updatedEdges);
        }
    }, [activeConnectionNodeId, nodes, generateEdges, setEdges]);

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
                    parentId: node.id,
                    description: child.description,
                    onShowTooltip: handleShowTooltip,
                    onHideTooltip: handleHideTooltip,
                    onToggleConnections: handleToggleConnections,
                    isConnectionsActive: activeConnectionNodeId === child.id
                },
                position: { x: 0, y: 0 }
            }));

            newNodes = [...newNodes, ...addedNodes];

            // Mark as expanded
            newNodes = newNodes.map(n => n.id === node.id ? { ...n, data: { ...n.data, expanded: true } } : n);
        }

        // --- REBUILD EDGES ---
        const finalEdges = generateEdges(newNodes, activeConnectionNodeId);

        // 3. Re-calculate layout
        if (!isLayoutLocked) {
            getElkLayoutedElements(newNodes, finalEdges).then(layouted => {
                setNodes([...layouted.nodes]);
                setEdges([...layouted.edges]);
            });
        } else {
            setNodes(newNodes);
            setEdges(finalEdges);
        }

        // Camera Logic (User Request)
        if (rfInstance) {
            // Need to wait for layout if not locked?
            // Since layout is async, we should ideally wait. 
            // But simple timeout works for now as layout is fast for small graphs.
            // Better: use useEffect but that triggers on all node changes.

            setTimeout(() => {
                // Find node in updated state if possible, or just use passed node id (position might be stale if async layout hasn't finished)
                // Actually if we use async layout, setNodes is called later.
                // We should move camera logic to a useEffect that watches layout changes?
                // For simplicity, we keep it here but with a slightly longer delay or just accept it might lag slightly behind layout.

                if (autoFit) {
                    rfInstance.fitView({ duration: 800, padding: 0.1 });
                } else if (centerNode) {
                    const n = newNodes.find(x => x.id === node.id);
                    if (n) {
                        rfInstance.fitView({
                            nodes: [n],
                            duration: 800,
                            padding: 0.5,
                            minZoom: 0.5,
                            maxZoom: 1.5
                        });
                    }
                }
            }, 300); // Increased delay for async ELK
        }

    }, [nodes, rootData, parentMap, setNodes, setEdges, handleGoToParent, findNodeData, updateBreadcrumbs, rfInstance, autoFit, centerNode, activeConnectionNodeId, handleToggleConnections, generateEdges, isLayoutLocked]);

    const onEdgeClick = useCallback((event, edge) => {
        if (edge.id.startsWith('flow-') && rfInstance && autoFit) {
            const targetNode = nodes.find(n => n.id === edge.target);
            if (targetNode) {
                rfInstance.fitView({ nodes: [targetNode], duration: 1000, padding: 0.5 });
                updateBreadcrumbs(targetNode.id);
            }
        }
    }, [nodes, rfInstance, updateBreadcrumbs, autoFit]);

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
        <div style={{ width: '100%', height: '100%', borderTop: '1px solid var(--header-border)', position: 'relative' }}>
            {/* Navigation Controls Overlay */}
            <div style={{
                position: 'absolute', top: 10, left: 10, zIndex: 1000,
                display: 'flex', flexDirection: 'column', gap: '5px'
            }}>
                {/* Breadcrumbs */}
                <div style={{
                    background: 'var(--header-bg)',
                    color: 'var(--text-color)',
                    padding: '5px 10px',
                    borderRadius: '4px',
                    border: '1px solid var(--header-border)',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <div>
                        {breadcrumbs.length === 0 && <span style={{ opacity: 0.6 }}>Root</span>}
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
                    {breadcrumbs.length > 0 && (
                        <button
                            title="Copy Path"
                            onClick={() => {
                                const pathStr = breadcrumbs.map(b => b.name).join('/');
                                navigator.clipboard.writeText(pathStr);
                                // Simple visual feedback
                                const btn = document.activeElement;
                                const originalText = btn.innerText;
                                btn.innerText = "✅";
                                setTimeout(() => btn.innerText = originalText, 1000);
                            }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '16px',
                                padding: '0 4px',
                                color: 'var(--text-color)'
                            }}
                        >
                            📋
                        </button>
                    )}
                </div>
            </div>

            {/* View Controls: Auto Fit & Zoom */}
            <div style={{
                position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
                display: 'flex', alignItems: 'center', gap: '15px',
                background: 'var(--header-bg)',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--header-border)',
                color: 'var(--text-color)',
                fontSize: '13px'
            }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={autoFit}
                        onChange={e => {
                            setAutoFit(e.target.checked);
                            if (e.target.checked) setCenterNode(false);
                        }}
                    />
                    Auto Fit Canvas
                </label>

                <div style={{ width: '1px', height: '16px', background: 'var(--text-color)', opacity: 0.2 }}></div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={centerNode}
                        onChange={e => {
                            setCenterNode(e.target.checked);
                            if (e.target.checked) setAutoFit(false);
                        }}
                    />
                    Center Node
                </label>

                <div style={{ width: '1px', height: '16px', background: 'var(--text-color)', opacity: 0.2 }}></div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={isLayoutLocked}
                        onChange={e => setIsLayoutLocked(e.target.checked)}
                    />
                    Lock Layout
                </label>

                <div style={{ width: '1px', height: '16px', background: 'var(--text-color)', opacity: 0.2 }}></div>
                <span style={{ opacity: 0.8 }}>Zoom</span>
                <input
                    type="range"
                    min="0.1"
                    max="2"
                    step="0.1"
                    value={zoomLevel}
                    onChange={handleZoomChange}
                    style={{ width: '100px', cursor: 'pointer' }}
                />
                <span style={{ width: '24px', textAlign: 'right', opacity: 0.8 }}>
                    {zoomLevel.toFixed(1)}x
                </span>
            </div>
            {/* Tooltip Overlay */}
            {tooltip.visible && (
                <div style={{
                    position: 'absolute',
                    top: tooltip.y + 10,
                    left: tooltip.x + 10,
                    zIndex: 9999,
                    background: 'var(--tooltip-bg)',
                    color: 'var(--tooltip-text)',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    pointerEvents: 'none',
                    maxWidth: '300px',
                    fontSize: '12px',
                    whiteSpace: 'pre-wrap',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}>
                    {tooltip.content}
                </div>
            )}

            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, display: 'flex', gap: '5px' }}>
                <input
                    type="text"
                    placeholder="Search node..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    style={{
                        padding: '5px',
                        borderRadius: '4px',
                        border: '1px solid var(--header-border)',
                        background: 'var(--header-bg)',
                        color: 'var(--text-color)'
                    }}
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
                onMove={onMove}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
            >
                <Controls />
                <Background color={theme === 'dark' ? '#555' : '#aaa'} gap={16} />
            </ReactFlow>
        </div>
    );
};

export default CodeGraph;
