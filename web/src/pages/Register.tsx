import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../components/ui/Input';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { post } from '../lib/api';
import { DEMO_MODE, nextSeq } from '../lib/demo';

export const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  const fillDemo = () => {
    const n = nextSeq();
    const uniqueEmail = `business_${n}_${Date.now().toString().slice(-4)}@example.com`;
    const uniquePhone = `98${String(10000000 + (n * 739) % 90000000)}`;
    setName(`Demo Business ${n}`);
    setEmail(uniqueEmail);
    setPhone(uniquePhone);
    setPassword('DemoPass123!');
  };

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) setStep(2);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await post('/api/auth/register', { 
        email, 
        password, 
        name: name || 'New Business', 
        gstin: 'DEMOGSTIN',
        phone 
      });
      navigate('/login');
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message || 'Registration failed. Please verify your details.');
    }
  };

  return (
    <div className="min-h-screen bg-gauge-steel flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold mb-2">Business Registration</h1>
        <p className="text-sm text-gray-600 mb-6">Create an account to register your instruments and apply for verifications.</p>
        
        {error && <div className="mb-4 text-red-600 text-sm font-semibold text-center">{error}</div>}

        {DEMO_MODE && step === 1 && (
          <div className="mb-4 flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={fillDemo}>
              Fill demo details
            </Button>
          </div>
        )}
        
        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
            <Field label="Contact Person Name" htmlFor="register-name">
              <Input 
                id="register-name"
                name="name" 
                type="text" 
                autoComplete="name"
                value={name} 
                onChange={e => setName(e.target.value)} 
                required 
              />
            </Field>
            <Field label="Business Email" htmlFor="register-email">
              <Input 
                id="register-email"
                name="email" 
                type="email" 
                autoComplete="email"
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
              />
            </Field>
            <Field label="Mobile Phone" htmlFor="register-phone">
              <Input 
                id="register-phone"
                name="phone" 
                type="tel" 
                autoComplete="tel"
                value={phone} 
                onChange={e => setPhone(e.target.value)} 
                required 
              />
            </Field>
            <Field label="Password" htmlFor="register-password">
              <Input 
                id="register-password"
                name="password" 
                type="password" 
                autoComplete="new-password"
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
            </Field>
            <Button type="submit" className="w-full">Send OTP</Button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <div className="p-3 bg-stamp-amber/20 text-stamp-amber-text text-sm rounded mb-2 border border-stamp-amber/40">
              <span className="font-bold">Sandbox OTP, simulated:</span> 123456
            </div>
            <Field label="Enter OTP" htmlFor="register-otp">
              <Input 
                id="register-otp"
                name="otp" 
                type="text" 
                autoComplete="one-time-code"
                value={otp} 
                onChange={e => setOtp(e.target.value)} 
                required 
              />
            </Field>
            <Button type="submit" className="w-full">Verify and Create Account</Button>
          </form>
        )}
      </div>
    </div>
  );
};
