import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { get } from '../lib/api';
import { formatDate } from '../lib/formatters';
import { AlertCircle, ExternalLink } from 'lucide-react';

interface ComplaintItem {
  id: number;
  public_id: string;
  category: string;
  note: string;
  created_at: string;
  certificate_status?: string | null;
  valid_from?: string | null;
  valid_to?: string | null;
  business_name: string | null;
  business_id: string | null;
  instrument_class?: string | null;
  instrument_serial?: string | null;
}

export function AdminComplaints() {
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('ALL');

  useEffect(() => {
    get<{ list?: ComplaintItem[]; byBusiness?: unknown[] } | ComplaintItem[]>('/api/admin/complaints')
      .then(res => {
        if (Array.isArray(res)) {
          setComplaints(res);
        } else if (res && Array.isArray(res.list)) {
          setComplaints(res.list);
        } else {
          setComplaints([]);
        }
        setLoading(false);
      })
      .catch(() => {
        setComplaints([]);
        setLoading(false);
      });
  }, []);

  const safeComplaints = Array.isArray(complaints) ? complaints : [];
  const categories = ['ALL', ...Array.from(new Set(safeComplaints.map(c => c.category)))];

  const filtered = filterCategory === 'ALL'
    ? safeComplaints
    : safeComplaints.filter(c => c.category === filterCategory);

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <PageHeader
        title="Right to Check Complaints"
        description="Public consumer grievances and suspected tampering reports logged via public verification."
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        <span className="text-xs font-semibold uppercase text-slate-500 mr-2">Filter by Category:</span>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterCategory === cat
                ? 'bg-calibration-blue text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500">Loading complaints...</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-slate-500 bg-white rounded border border-slate-200">
          No complaints found under this category.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filtered.map(c => (
              <div key={c.id} className="p-5 flex flex-col gap-2 hover:bg-slate-50/50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-stamp-amber/10 text-stamp-amber border border-stamp-amber/20">
                      <AlertCircle className="w-3 h-3" />
                      {c.category}
                    </span>
                    <span className="font-bold text-sm text-ink">{c.business_name || 'Unlinked Merchant'}</span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">{formatDate(c.created_at)}</span>
                </div>

                <p className="text-sm text-slate-700 font-medium mt-1 bg-slate-50 p-3 rounded border border-slate-200/60">
                  "{c.note}"
                </p>

                <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 font-mono">
                  <span>Certificate:</span>
                  <Link
                    to={`/v/${c.public_id}`}
                    className="text-calibration-blue hover:underline flex items-center gap-1 font-semibold"
                  >
                    {c.public_id}
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                  {c.instrument_class && (
                    <span>• Instrument: {c.instrument_class} ({c.instrument_serial || 'Standard'})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
