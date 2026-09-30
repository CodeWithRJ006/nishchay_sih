import { useEffect, useState } from 'react';

function App() {
  const [health, setHealth] = useState<string>('loading...');

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setHealth(data.status))
      .catch(_err => setHealth('error'));
  }, []);

  return (
    <div className="min-h-screen bg-gauge-steel text-ink flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-4">NISHCHAY Prototype</h1>
      <p className="mb-2">This is the verification platform prototype for Legal Metrology.</p>
      <div className="p-4 bg-white rounded shadow text-center">
        <p className="text-sm text-gray-500 uppercase tracking-wide">API Status</p>
        <p className="text-xl font-bold text-calibration-blue">{health}</p>
      </div>
    </div>
  );
}

export default App;
