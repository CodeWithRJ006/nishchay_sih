import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export const Home = () => {
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (code) {
      navigate(`/v/${code}`);
    }
  };

  return (
    <div className="min-h-screen bg-gauge-steel flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded shadow-sm border border-gray-200 p-8 text-center">
          <h1 className="text-3xl font-heading font-bold text-ink mb-4">NISHCHAY</h1>
          <p className="text-gray-600 mb-6 text-sm text-left">
            Legal Metrology ensures that weighing and measuring instruments used in trade are accurate. This protects consumers from short-weight delivery and ensures fair competition for businesses. Enter a certificate code below to verify its authenticity.
          </p>
          
          <form onSubmit={handleVerify} className="flex flex-col gap-4 mb-8">
            <Input 
              placeholder="Enter Certificate Code" 
              value={code} 
              onChange={e => setCode(e.target.value)}
              className="text-center text-lg font-mono tracking-wider"
              aria-label="Certificate code"
            />
            <Button type="submit" variant="primary" className="w-full">
              Verify Certificate
            </Button>
          </form>

          <div className="pt-6 border-t border-gray-200 text-sm">
            <p className="text-ink font-semibold mb-3">Official Access</p>
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={() => navigate('/login')}>Business</Button>
              <Button variant="outline" onClick={() => navigate('/login')}>Officer</Button>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-gray-500 border-t border-gray-200 mt-auto">
        Prototype built for SIH26036. Not an official government system.
      </footer>
    </div>
  );
};
