import { tree, hierarchy } from 'd3-hierarchy';

const nodeWidth = 250;
const nodeHeight = 80;

export const getLayoutedElements = (rootFileNode, expandedIds) => {
    if (!rootFileNode) return { nodes: [], edges: [] };

    // 1. Create D3 hierarchy
    const d3Hierarchy = hierarchy(rootFileNode);

    // 2. Prune hierarchy based on expansion state
    // If a node is not in expandedIds, hide its children
    if (expandedIds) {
        const prune = (node) => {
            if (!expandedIds.has(node.data.id)) {
                node.children = undefined;
            } else if (node.children) {
                node.children.forEach(prune);
            }
        };
        prune(d3Hierarchy);
    }

    // 3. Setup D3 Tree Layout
    const layout = tree().nodeSize([nodeWidth, nodeHeight * 2]);
    const d3Root = layout(d3Hierarchy);

    const nodes = [];
    const edges = [];

    // Track visible nodes for edge filtering
    const visibleNodeIds = new Set();

    // 4. Convert D3 nodes to React Flow nodes and Structural Edges
    d3Root.descendants().forEach((d) => {
        visibleNodeIds.add(d.data.id);

        nodes.push({
            id: d.data.id,
            position: { x: d.x, y: d.y },
            data: {
                label: d.data.name,
                type: d.data.type,
                // Helper data for styling
                depth: d.depth,
                isExpanded: expandedIds ? expandedIds.has(d.data.id) : true,
                hasChildren: !!(d.data.children && d.data.children.length > 0),
                ...d.data
            },
            type: 'default', // Using default for now, can be custom
            sourcePosition: 'bottom',
            targetPosition: 'top',
            style: {
                cursor: 'pointer',
                // Visual feedback for folders that can be expanded
                border: (d.data.children && d.data.children.length > 0) ? '1px solid #777' : '1px solid #333',
            }
        });

        if (d.parent) {
            edges.push({
                id: `e-${d.parent.data.id}-${d.data.id}`,
                source: d.parent.data.id,
                target: d.data.id,
                type: 'smoothstep',
                style: { stroke: '#555' },
            });
        }
    });

    // 5. Add Data Flow Edges (Call Graph)
    // Only add edges if BOTH source and target are visible
    if (rootFileNode.edges) {
        rootFileNode.edges.forEach((edge) => {
            if (visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)) {
                edges.push({
                    id: edge.id,
                    source: edge.source,
                    target: edge.target,
                    animated: true,
                    style: { stroke: '#ff0072', strokeWidth: 2 },
                    label: 'calls',
                    type: 'smoothstep',
                });
            }
        });
    }

    return { nodes, edges };
};
