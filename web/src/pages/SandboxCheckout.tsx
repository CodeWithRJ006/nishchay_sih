import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, CreditCard, Landmark, Smartphone } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { NextStepBanner } from '../components/ui/NextStepBanner';

export function SandboxCheckout() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const [appData, setAppData] = useState<{fee_amount: number} | null>(null);
  const [tab, setTab] = useState<'UPI' | 'CARD' | 'NET_BANKING'>('UPI');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetch(`/api/applications/${applicationId}`)
      .then(res => res.json())
      .then(data => {
        setAppData(data);
        setLoading(false);
      });
  }, [applicationId]);

  const handleOutcome = async (status: 'SUCCESS' | 'FAILURE' | 'PENDING') => {
    setProcessing(true);
    try {
      const initRes = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': 'dummy' },
        body: JSON.stringify({ applicationId, amount: appData?.fee_amount || 0 })
      });
      const initData = await initRes.json();

      // In real life this would happen on the provider's server. We simulate the webhook callback.
      const payload = {
        paymentId: initData.paymentId,
        status,
        amount: appData?.fee_amount || 0,
        timestamp: Date.now(),
        applicationId: applicationId as string
      };

      // Since we don't have the HMAC secret in the browser, we must call a demo helper, OR we can just let the backend sign it if we had an endpoint.
      // Wait, the test says: "Callback endpoint... authenticates by signature".
      // But the browser cannot sign it. The Sandbox Provider needs to sign it.
      // So I need a fake Sandbox Provider endpoint to trigger the callback!
      
      const res = await fetch('/api/demo/trigger-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        if (status === 'SUCCESS') navigate(`/dashboard/receipt/${applicationId}`);
        else if (status === 'FAILURE') alert('Payment failed');
        else alert('Payment pending');
      }
    } catch (e) {
      console.error(e);
    }
    setProcessing(false);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="bg-amber-100 text-amber-900 px-4 py-3 rounded mb-6 flex items-center gap-2 font-bold">
        <AlertTriangle className="w-5 h-5" />
        Sandbox payment, no real money
      </div>

      <PageHeader 
        title="Complete Payment" 
        description="Select a payment method to pay your official fees." 
      />

      <div className="bg-white p-6 rounded shadow border border-slate-200 mt-6">
        <div className="flex justify-between items-center mb-6">
          <span className="text-lg">Amount to pay:</span>
          <span className="text-2xl font-bold text-slate-900">₹{appData?.fee_amount}</span>
        </div>

        <div className="flex border-b border-slate-200 mb-6">
          <button className={`px-4 py-2 ${tab === 'UPI' ? 'border-b-2 border-primary-600 text-primary-600 font-bold' : ''}`} onClick={() => setTab('UPI')}><Smartphone className="w-4 h-4 inline mr-2"/> UPI</button>
          <button className={`px-4 py-2 ${tab === 'CARD' ? 'border-b-2 border-primary-600 text-primary-600 font-bold' : ''}`} onClick={() => setTab('CARD')}><CreditCard className="w-4 h-4 inline mr-2"/> Card</button>
          <button className={`px-4 py-2 ${tab === 'NET_BANKING' ? 'border-b-2 border-primary-600 text-primary-600 font-bold' : ''}`} onClick={() => setTab('NET_BANKING')}><Landmark className="w-4 h-4 inline mr-2"/> Net Banking</button>
        </div>

        <div className="space-y-4">
          <p className="text-slate-600">Simulate a payment outcome below.</p>
          <div className="flex gap-4">
            <Button onClick={() => handleOutcome('SUCCESS')} disabled={processing} variant="primary">Simulate Success</Button>
            <Button onClick={() => handleOutcome('FAILURE')} disabled={processing} variant="outline">Simulate Failure</Button>
            <Button onClick={() => handleOutcome('PENDING')} disabled={processing} variant="secondary">Simulate Pending</Button>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <NextStepBanner title="Your receipt will be generated and you can schedule an appointment." />
      </div>
    </div>
  );
}
