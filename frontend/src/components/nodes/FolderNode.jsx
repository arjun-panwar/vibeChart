import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

export default memo(({ data }) => {
    return (
        <div style={{
            padding: '10px',
            border: '1px solid #777',
            borderRadius: '5px',
            background: '#fffbf0',
            minWidth: '150px',
            textAlign: 'center',
            fontWeight: 'bold',
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
            <div style={{ fontSize: '10px', color: '#888' }}>Folder</div>
            <div>📁 {data.label}</div>
            <Handle type="source" position={Position.Bottom} />
        </div>
    );
});
