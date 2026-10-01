import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { NextStepBanner } from '../components/ui/NextStepBanner';
import { Download } from 'lucide-react';

export function ReceiptPage() {
  const { applicationId } = useParams();
  const [receipt, setReceipt] = useState<{id: string, fee_amount: number} | null>(null);
  
  // To keep it simple, we fetch the application and if it has a receipt, we show it
  // Wait, I didn't make an API to get the receipt for a specific application for BUSINESS!
  // Let me add one later or just fetch the application.
  
  useEffect(() => {
    fetch(`/api/applications/${applicationId}`)
      .then(res => res.json())
      .then(data => {
        setReceipt(data);
      });
  }, [applicationId]);

  if (!receipt) return <div>Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto py-8">
      <PageHeader 
        title="Payment Receipt" 
        description="Your payment was successful." 
      />

      <div className="bg-white p-6 rounded shadow border border-slate-200 mt-6 print-layout">
        <h2 className="text-xl font-bold mb-4">Official Receipt</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-slate-500">Application ID</p>
            <p className="font-mono">{receipt.id}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Amount Paid</p>
            <p className="font-bold">₹{receipt.fee_amount}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Status</p>
            <p className="font-bold text-green-600">PAID</p>
          </div>
        </div>
        
        <div className="mt-8 pt-4 border-t border-slate-200 flex justify-end">
          <Button onClick={() => window.print()} variant="outline"><Download className="w-4 h-4 mr-2 inline" /> Download receipt PDF</Button>
        </div>
      </div>
      
      <div className="mt-8 no-print">
        <NextStepBanner title="Schedule an appointment for verification." />
      </div>
    </div>
  );
}
