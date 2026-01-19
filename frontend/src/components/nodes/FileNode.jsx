import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

export default memo(({ data }) => {
    return (
        <div style={{
            padding: '10px',
            border: '1px solid #777',
            borderRadius: '5px',
            background: '#f0f0f0',
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
            <Handle type="target" position={Position.Top} />
            <div style={{ fontSize: '10px', color: '#888' }}>File</div>
            <div>📄 {data.label}</div>
            <Handle type="source" position={Position.Bottom} />
        </div>
    );
});
