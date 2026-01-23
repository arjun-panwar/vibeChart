import { tree, hierarchy } from 'd3-hierarchy';

const nodeWidth = 250;
const nodeHeight = 80;

export const getLayoutedElements = (rootFileNode) => {
    if (!rootFileNode) return { nodes: [], edges: [] };

    // 1. Create D3 hierarchy
    const d3Hierarchy = hierarchy(rootFileNode);

    // 2. Setup D3 Tree Layout
    // nodeSize allows us to define spacing [width, height] usually, 
    // but for d3.tree content size. 
    // Actually, d3.tree().nodeSize([height, width]) creates a layout where 
    // x and y are computed based on these dimensions.
    // Let's use a dynamic size or just nodeSize.
    // For a horizontal tree, we usually swap x and y.
    // Let's stick to a standard vertical tree for now, or maybe horizontal if it's deep.
    // Codebases are usually deep. Horizontal might be better?
    // Let's try Vertical first (Standard).

    const layout = tree().nodeSize([nodeWidth, nodeHeight * 2]);

    const d3Root = layout(d3Hierarchy);

    const nodes = [];
    const edges = [];

    // 3. Convert D3 nodes to React Flow nodes and Structural Edges
    d3Root.descendants().forEach((d) => {
        nodes.push({
            id: d.data.id,
            position: { x: d.x, y: d.y },
            data: {
                label: d.data.name,
                type: d.data.type,
                // Helper data for styling
                depth: d.depth,
                ...d.data
            },
            type: 'default', // Using default for now, can be custom
            // We can create custom node types later (FolderNode, FileNode etc)
            sourcePosition: 'bottom',
            targetPosition: 'top',
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

    // 4. Add Data Flow Edges (Call Graph)
    // The root node from backend contains "edges" which are the data flow calls.
    if (rootFileNode.edges) {
        rootFileNode.edges.forEach((edge) => {
            edges.push({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                animated: true,
                style: { stroke: '#ff0072', strokeWidth: 2 },
                label: 'calls',
                type: 'smoothstep', // or 'default'
            });
        });
    }

    return { nodes, edges };
};
