import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

const VISUAL_NODE_WIDTH = 220;
const VISUAL_NODE_HEIGHT = 80;

export const getElkLayoutedElements = async (nodes, edges) => {
    const elkOptions = {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN', // Key for compound layout

        // Vertical Spacing
        'elk.layered.spacing.nodeNodeBetweenLayers': '150',

        // Strategy
        'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
        'elk.layered.crossingMinimization.forceNodeModelOrder': 'true',

        // Horizontal Spacing
        'elk.spacing.nodeNode': '80', // Minimum gap betwen siblings

        // Edges
        // 'elk.edgeRouting': 'ORTHOGONAL', // DISABLED to verify if it causes crash
        // 'elk.layered.mergeEdges': 'true', // DISABLED: Suspected cause of crash with hierarchy
        // 'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',

        // Padding inside the "Compound" node (reserved space)
        // We need enough top padding to place the visual folder node (80px) plus some gap
        // 'elk.padding': '[top=100,left=30,bottom=30,right=30]', 

        'elk.spacing.edgeNode': '30',
        'elk.spacing.edgeEdge': '25',
    };

    // 1. Build Hierarchy
    // 1. Flat Layout (Baseline)
    const elkGraph = {
        id: 'root',
        layoutOptions: elkOptions,
        children: nodes.map(n => ({
            id: n.id,
            width: VISUAL_NODE_WIDTH,
            height: VISUAL_NODE_HEIGHT
        })),
        edges: edges.map(e => ({
            id: e.id,
            sources: [e.source],
            targets: [e.target]
        }))
    };

    // Debug Logging
    console.log('ELK Graph Input:', JSON.stringify(elkGraph, (key, value) => {
        if (key === 'children' && value.length > 5) return `[${value.length} nodes]`;
        return value;
    }, 2));

    try {
        const layoutedGraph = await elk.layout(elkGraph);

        // 2. Map back to React Flow
        const layoutedNodes = nodes.map(node => {
            const elkNode = layoutedGraph.children.find(n => n.id === node.id);
            if (elkNode) {
                return {
                    ...node,
                    position: { x: elkNode.x, y: elkNode.y },
                    sourcePosition: 'bottom',
                    targetPosition: 'top',
                    data: { ...node.data }
                };
            }
            return node;
        });

        return { nodes: layoutedNodes, edges: edges };
    } catch (error) {
        console.error('ELK Layout Error Details:', error);
        return { nodes, edges };
    }
};
