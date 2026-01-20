import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

const nodeWidth = 172;
const nodeHeight = 80;

export const getElkLayoutedElements = async (nodes, edges) => {
    const elkOptions = {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.layered.spacing.nodeNodeBetweenLayers': '150',
        'elk.spacing.nodeNode': '100',
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
        'elk.spacing.edgeNode': '30',
        'elk.spacing.edgeEdge': '20',
        'elk.layered.spacing.edgeNodeBetweenLayers': '50',
    };

    const graph = {
        id: 'root',
        layoutOptions: elkOptions,
        children: nodes.map((node) => ({
            id: node.id,
            width: nodeWidth,
            height: nodeHeight,
        })),
        edges: edges.map((edge) => ({
            id: edge.id,
            sources: [edge.source],
            targets: [edge.target],
        })),
    };

    try {
        const layoutedGraph = await elk.layout(graph);

        const layoutedNodes = nodes.map((node) => {
            const elkNode = layoutedGraph.children.find((n) => n.id === node.id);

            if (elkNode) {
                return {
                    ...node,
                    position: {
                        x: elkNode.x,
                        y: elkNode.y,
                    },
                    sourcePosition: 'bottom',
                    targetPosition: 'top',
                };
            }
            return node;
        });

        const layoutedEdges = edges.map((edge) => {
            const elkEdge = layoutedGraph.edges?.find((e) => e.id === edge.id);

            if (elkEdge && elkEdge.sections && elkEdge.sections.length > 0) {
                const section = elkEdge.sections[0];
                let d = `M ${section.startPoint.x} ${section.startPoint.y}`;

                if (section.bendPoints) {
                    section.bendPoints.forEach(bp => {
                        d += ` L ${bp.x} ${bp.y}`;
                    });
                }

                d += ` L ${section.endPoint.x} ${section.endPoint.y}`;

                return {
                    ...edge,
                    data: {
                        ...edge.data,
                        elkPath: d
                    }
                };
            }
            return edge;
        });

        return { nodes: layoutedNodes, edges: layoutedEdges };
    } catch (error) {
        console.error('ELK Layout Error:', error);
        return { nodes, edges };
    }
};
