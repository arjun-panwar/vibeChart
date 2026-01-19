import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

export default memo(({ data, id }) => {
    return (
        <div style={{
            padding: '10px',
            border: '1px solid var(--node-border)',
            borderRadius: '5px',
            background: 'var(--node-bg-file, #29b6f6)',
            color: '#000000',
            minWidth: '150px',
            textAlign: 'center',
            position: 'relative'
        }}>
            {data.parentId && (
                <div
                    style={{ position: 'absolute', top: 2, right: 5, cursor: 'pointer', fontSize: '10px', color: '#555' }}
                    onClick={(e) => { e.stopPropagation(); data.onGoToParent(data.parentId); }}
                    title="Go to Parent"
                >
                    ⬆
                </div>
            )}

            {/* Tooltip trigger */}
            <div
                style={{ position: 'absolute', top: 2, right: data.parentId ? 20 : 5, cursor: 'help', fontSize: '10px', color: '#007bff' }}
                onMouseEnter={(e) => {
                    e.stopPropagation();
                    if (data.onShowTooltip) {
                        data.onShowTooltip(data.description || "No description", e.clientX, e.clientY);
                    }
                }}
                onMouseLeave={(e) => {
                    e.stopPropagation();
                    if (data.onHideTooltip) {
                        data.onHideTooltip();
                    }
                }}
            >
                ℹ️
            </div>
            <Handle type="target" position={Position.Top} />
            <div style={{ fontSize: '10px', color: '#888' }}>File</div>
            <div>📄 {data.label}</div>

            {/* Footer with Toggle Button */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '5px', gap: '5px' }}>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (data.onToggleConnections) data.onToggleConnections(id);
                    }}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: data.isConnectionsActive ? '#007bff' : '#888',
                        fontSize: '12px'
                    }}
                    title="Toggle Connections"
                >
                    🔗
                </button>
            </div>
            <Handle type="source" position={Position.Bottom} />
        </div>
    );
});
