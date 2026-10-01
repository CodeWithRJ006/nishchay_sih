import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../components/ui/Input';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';

export const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) setStep(2);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: 'New Business', gstin: 'DEMOGSTIN' })
    });
    if (res.ok) {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gauge-steel flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold mb-2">Business Registration</h1>
        <p className="text-sm text-gray-600 mb-6">Create an account to register your instruments and apply for verifications.</p>
        
        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
            <Field label="Business Email">
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </Field>
            <Field label="Password">
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </Field>
            <Button type="submit" className="w-full">Send OTP</Button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <div className="p-3 bg-stamp-amber/20 text-stamp-amber-text text-sm rounded mb-2 border border-stamp-amber/40">
              <span className="font-bold">Sandbox OTP, simulated:</span> 123456
            </div>
            <Field label="Enter OTP">
              <Input type="text" value={otp} onChange={e => setOtp(e.target.value)} required />
            </Field>
            <Button type="submit" className="w-full">Verify and Create Account</Button>
          </form>
        )}
      </div>
    </div>
  );
};
