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
            fontWeight: 'bold'
        }}>
            <Handle type="target" position={Position.Top} />
            <div style={{ fontSize: '10px', color: '#888' }}>Folder</div>
            <div>📁 {data.label}</div>
            <Handle type="source" position={Position.Bottom} />
        </div>
    );
});
