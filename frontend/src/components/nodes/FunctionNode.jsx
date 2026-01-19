import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

export default memo(({ data }) => {
    return (
        <div style={{
            padding: '10px',
            border: '1px solid #005a00',
            borderRadius: '5px',
            background: '#d4ffd4',
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
            <div style={{ fontSize: '10px', color: '#005a00' }}>Function</div>
            <div style={{ fontStyle: 'italic' }}>fx {data.label}</div>
            <Handle type="source" position={Position.Bottom} />
        </div>
    );
});
