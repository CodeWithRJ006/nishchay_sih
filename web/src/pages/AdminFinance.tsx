import { useState, useEffect } from 'react';
import { get } from '../lib/api';
import { formatInr } from '../lib/formatters';

export function AdminGateBlocks() {
  const [gateBlocks, setGateBlocks] = useState(0);

  useEffect(() => {
    get<{ count: number }>('/api/admin/gate-blocks')
      .then(d => setGateBlocks(d.count));
  }, []);

  return (
    <div className="bg-red-50 text-red-900 p-6 rounded shadow mb-6 border border-red-200">
      <h2 className="text-lg font-bold mb-2">Gate blocks</h2>
      <p className="text-3xl font-mono">{gateBlocks}</p>
      <p className="text-sm mt-2 opacity-80">The fee-gate removes the officer's control over the official fee transaction. It does not stop payments made outside the system.</p>
    </div>
  );
}

export function AdminPayments() {
  const [payments, setPayments] = useState<{id: string, application_id: string, amount: number, status: string}[]>([]);

  useEffect(() => {
    get<{id: string, application_id: string, amount: number, status: string}[]>('/api/admin/payments').then(setPayments);
  }, []);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Payments</h2>
      <table className="w-full text-left">
        <thead>
          <tr>
            <th>ID</th>
            <th>App ID</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {payments.map(p => (
            <tr key={p.id} className="border-t">
              <td className="py-2">{p.id}</td>
              <td className="py-2">{p.application_id}</td>
              <td className="py-2">{formatInr(p.amount)}</td>
              <td className="py-2">{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminReceipts() {
  const [receipts, setReceipts] = useState<{id: string, application_id: string, amount: number}[]>([]);

  useEffect(() => {
    get<{id: string, application_id: string, amount: number}[]>('/api/admin/receipts').then(setReceipts);
  }, []);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4 mt-8">Receipts</h2>
      <table className="w-full text-left">
        <thead>
          <tr>
            <th>ID</th>
            <th>App ID</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {receipts.map(p => (
            <tr key={p.id} className="border-t">
              <td className="py-2 font-mono text-sm">{p.id}</td>
              <td className="py-2">{p.application_id}</td>
              <td className="py-2">{formatInr(p.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminFinance() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading text-ink">Official Payments & Financial Telemetry</h1>
        <p className="text-sm text-slate-600 mt-1">Review official e-receipt transactions and financial gate protection telemetry.</p>
      </div>
      <AdminGateBlocks />
      <div className="bg-white p-6 shadow-sm border border-slate-200 rounded-lg">
        <AdminPayments />
        <AdminReceipts />
      </div>
    </div>
  );
}

export const AdminDashboard = AdminFinance;
