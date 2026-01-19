import React, { useState } from 'react';
import CodeGraph from './components/CodeGraph';
import { scanPath, reanalyzePath } from './api';

function App() {
  const [path, setPath] = useState('/home/arjun/Documents/presonal/vision-qa');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleScan = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await scanPath(path);
      setData(result);
    } catch (err) {
      setError("Failed to scan path. Check console/backend.");
    } finally {
      setLoading(false);
    }
  };

  const handleReanalyze = async () => {
    if (!confirm("This will clear the cache and rescan. Continue?")) return;
    setLoading(true);
    setError(null);
    try {
      const result = await reanalyzePath(path);
      setData(result);
    } catch (err) {
      setError("Failed to reanalyze. Check console/backend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', margin: 0, padding: 0, fontFamily: 'sans-serif' }}>
      <div style={{ padding: '10px 20px', borderBottom: '1px solid #eee', flexShrink: 0 }}>
        <h1 style={{ margin: '0 0 10px 0', fontSize: '1.5rem' }}>Vibe Chart - Code Visualizer</h1>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            style={{ width: '400px', padding: '8px' }}
            placeholder="Local directory path..."
          />
          <button onClick={handleScan} disabled={loading} style={{ padding: '8px 16px' }}>
            {loading ? 'Scanning...' : 'Scan'}
          </button>
          <button onClick={handleReanalyze} disabled={loading} style={{ padding: '8px 16px' }}>
            Force Reanalyze
          </button>
        </div>

        {error && <div style={{ color: 'red', marginTop: '5px' }}>{error}</div>}
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        {data ? (
          <CodeGraph rootData={data} />
        ) : (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            textAlign: 'center', color: '#888'
          }}>
            Ready to scan. Enter a path above.
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
