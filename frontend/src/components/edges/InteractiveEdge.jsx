import React, { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow } from 'reactflow';

const InteractiveEdge = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data,
}) => {
    const { fitView, getNode } = useReactFlow();
    const [isHovered, setIsHovered] = useState(false);

    let edgePath = '';
    let labelX = 0;
    let labelY = 0;

    if (data?.elkPath) {
        edgePath = data.elkPath;

        // Simple label positioning: finding the middle of the polyline
        // Parsing "M x y L x y L x y ..."
        const commands = data.elkPath.split(' ');
        const points = [];
        for (let i = 1; i < commands.length; i += 3) {
            const x = parseFloat(commands[i]);
            const y = parseFloat(commands[i + 1]);
            if (!isNaN(x) && !isNaN(y)) points.push({ x, y });
        }

        if (points.length >= 2) {
            // Find total length
            let totalLen = 0;
            const segments = [];
            for (let i = 0; i < points.length - 1; i++) {
                const dx = points[i + 1].x - points[i].x;
                const dy = points[i + 1].y - points[i].y;
                const len = Math.sqrt(dx * dx + dy * dy);
                segments.push({ len, start: points[i], end: points[i + 1] });
                totalLen += len;
            }

            // Find midpoint
            let targetLen = totalLen / 2;
            let currentLen = 0;
            for (const seg of segments) {
                if (currentLen + seg.len >= targetLen) {
                    const remaining = targetLen - currentLen;
                    const ratio = remaining / seg.len;
                    labelX = seg.start.x + (seg.end.x - seg.start.x) * ratio;
                    labelY = seg.start.y + (seg.end.y - seg.start.y) * ratio;
                    break;
                }
                currentLen += seg.len;
            }
        } else if (points.length === 1) {
            labelX = points[0].x;
            labelY = points[0].y;
        }

    } else {
        [edgePath, labelX, labelY] = getSmoothStepPath({
            sourceX,
            sourceY,
            sourcePosition,
            targetX,
            targetY,
            targetPosition,
            borderRadius: 20,
        });
    }

    const onEdgeClick = (evt) => {
        evt.stopPropagation();
        // Prevent graph click
    };

    const handleNavigation = () => {
        const targetNode = getNode(data.targetId);
        if (targetNode) {
            fitView({ nodes: [targetNode], duration: 800, padding: 0.5 });
        }
    };

    const activeStyle = {
        ...style,
        strokeWidth: isHovered ? 4 : (style.strokeWidth || 2),
        stroke: isHovered ? (style.stroke || '#555') : (style.stroke || '#b1b1b7'),
        filter: isHovered ? 'drop-shadow(0 0 4px var(--text-color))' : 'none',
        transition: 'all 0.3s ease',
        cursor: 'pointer'
    };

    return (
        <>
            {/* Invisible wider path for easier hovering */}
            <path
                d={edgePath}
                fill="none"
                strokeOpacity={0}
                strokeWidth={20}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                style={{ cursor: 'pointer' }}
            />

            <BaseEdge path={edgePath} markerEnd={markerEnd} style={activeStyle} />

            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        fontSize: 12,
                        pointerEvents: 'all',
                        opacity: isHovered ? 1 : 0.6, // Fade out when not hovering to reduce clutter
                        transition: 'opacity 0.3s',
                        zIndex: 100
                    }}
                    className="nodrag nopan"
                >
                    {!data?.isHierarchy && (
                        <button
                            className="edge-button"
                            onClick={handleNavigation}
                            title="Go to Target"
                            style={{
                                borderRadius: '50%',
                                width: '24px',
                                height: '24px',
                                border: '1px solid var(--node-border)',
                                background: 'var(--bg-color)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                        >
                            ➤
                        </button>
                    )}
                    {data?.hasHiddenTarget && (
                        <div style={{
                            position: 'absolute',
                            top: '-15px',
                            right: '-15px',
                            background: '#ffc107',
                            color: 'black',
                            borderRadius: '50%',
                            width: '18px',
                            height: '18px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid #fff'
                        }}>
                            +
                        </div>
                    )}
                </div>
            </EdgeLabelRenderer>
        </>
    );
};

export default InteractiveEdge;
