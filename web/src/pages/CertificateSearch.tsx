import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { formatDate } from '../lib/formatters';
import { get } from '../lib/api';

interface CertificateResult {
  id: string;
  public_id: string;
  instrument_id: string;
  instrument_class: string;
  status: string;
  valid_from: string;
  valid_to: string;
  business_name: string;
}

export function CertificateSearch() {
  const [params, setParams] = useState({
    instrumentId: '',
    businessName: '',
    class: '',
    status: '',
    startDate: '',
    endDate: ''
  });
  const [results, setResults] = useState<CertificateResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchResults = useCallback(async (currentParams = params) => {
    setLoading(true);
    setError('');
    try {
      const q = new URLSearchParams();
      Object.entries(currentParams).forEach(([k, v]) => {
        if (v) q.append(k, v);
      });
      const data = await get<{ results: CertificateResult[] }>(`/api/certificates/search?${q.toString()}`);
      setResults(data.results);
    } catch {
      setError('Search failed.');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const handleExport = () => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v) q.append(k, v);
    });
    window.location.href = `/api/certificates/export?${q.toString()}`;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-heading font-bold text-ink">Certificate Search & Reports</h1>
        <button 
          onClick={handleExport}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow transition-colors"
        >
          Export CSV
        </button>
      </div>

      <div className="bg-white p-4 rounded shadow-sm border border-gray-200 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Instrument ID</label>
          <input 
            type="text" 
            className="w-full border-gray-300 rounded focus:border-calibration-blue focus:ring-calibration-blue" 
            value={params.instrumentId} 
            onChange={e => setParams({...params, instrumentId: e.target.value})} 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
          <input 
            type="text" 
            className="w-full border-gray-300 rounded focus:border-calibration-blue focus:ring-calibration-blue" 
            value={params.businessName} 
            onChange={e => setParams({...params, businessName: e.target.value})} 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select 
            className="w-full border-gray-300 rounded focus:border-calibration-blue focus:ring-calibration-blue"
            value={params.status}
            onChange={e => setParams({...params, status: e.target.value})}
          >
            <option value="">All</option>
            <option value="VALID">Valid</option>
            <option value="REVOKED">Revoked</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
          <input 
            type="date" 
            className="w-full border-gray-300 rounded focus:border-calibration-blue focus:ring-calibration-blue" 
            value={params.startDate} 
            onChange={e => setParams({...params, startDate: e.target.value})} 
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
          <input 
            type="date" 
            className="w-full border-gray-300 rounded focus:border-calibration-blue focus:ring-calibration-blue" 
            value={params.endDate} 
            onChange={e => setParams({...params, endDate: e.target.value})} 
          />
        </div>
        <div className="flex items-end">
          <button 
            onClick={() => fetchResults(params)}
            className="w-full bg-calibration-blue hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {error && <div className="text-red-600 mb-4">{error}</div>}
      
      <div className="bg-white rounded shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
              <th className="p-3">Public ID</th>
              <th className="p-3">Business</th>
              <th className="p-3">Instrument</th>
              <th className="p-3">Status</th>
              <th className="p-3">Valid To</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {loading ? (
              <tr><td colSpan={6} className="p-4 text-center text-gray-500">Loading...</td></tr>
            ) : results.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center text-gray-500">No certificates found.</td></tr>
            ) : (
              results.map(r => (
                <tr key={r.public_id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-3 font-mono">{r.public_id}</td>
                  <td className="p-3">{r.business_name}</td>
                  <td className="p-3">{r.instrument_id} ({r.instrument_class})</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${r.status === 'VALID' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="p-3">{formatDate(r.valid_to)}</td>
                  <td className="p-3">
                    <Link to={`/v/${r.public_id}`} className="text-calibration-blue hover:underline">View</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
