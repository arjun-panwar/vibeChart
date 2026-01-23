import React, { useState } from 'react';
import { scanPath } from './api/scan';
import CodeGraph from './components/CodeGraph';
import { FolderSearch, Loader2, AlertCircle } from 'lucide-react';
import './App.css';

function App() {
  const [path, setPath] = useState('');
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleScan = async (e) => {
    e.preventDefault();
    if (!path) return;

    setLoading(true);
    setError(null);
    setGraphData(null);

    try {
      const data = await scanPath(path);
      setGraphData(data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || err.message || "Failed to scan directory");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <FolderSearch className="logo-icon" />
          <h1>Vibe Chart</h1>
        </div>
        <form onSubmit={handleScan} className="search-bar">
          <input
            type="text"
            placeholder="/path/to/project"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : 'Scan'}
          </button>
        </form>
      </header>

      <main className="main-content">
        {error && (
          <div className="error-message">
            <AlertCircle />
            <span>{error}</span>
          </div>
        )}

        {graphData ? (
          <div className="graph-wrapper">
            <CodeGraph data={graphData} />
          </div>
        ) : (
          <div className="empty-state">
            {!loading && <p>Enter a directory path to visualize the codebase.</p>}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
