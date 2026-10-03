import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Input } from '../components/ui/Input';
import { Field } from '../components/ui/Field';
import { Button } from '../components/ui/Button';
import { post } from '../lib/api';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { refresh } = useAuth();
  
  // Hardcoded for prototype as requested
  const isDemo = true; 

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await post('/api/auth/login', { email, password });
      await refresh();
      navigate('/dashboard');
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message || 'Login failed');
    }
  };

  const loginAs = async (role: string) => {
    await post(`/api/demo/login-as/${role}`, {});
    await refresh();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gauge-steel flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold mb-6 text-center">Portal Login</h1>
        
        {error && <div className="mb-4 text-red-600 text-sm font-semibold text-center">{error}</div>}
        
        <form onSubmit={handleLogin} className="flex flex-col gap-4 mb-8">
          <Field label="Email">
            <Input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
            />
          </Field>
          <Field label="Password">
            <Input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
          </Field>
          <Button type="submit" className="w-full">Sign In</Button>
        </form>

        <div className="text-center text-sm mb-4">
          <a href="/register" className="text-calibration-blue hover:underline">Don't have an account? Register</a>
        </div>

        {isDemo && (
          <div className="pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-4 text-center">DEMO MODE: Try as</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => loginAs('ADMIN')}>Admin</Button>
              <Button variant="outline" onClick={() => loginAs('LMO')}>LMO</Button>
              <Button variant="outline" onClick={() => loginAs('GATC')}>GATC</Button>
              <Button variant="outline" onClick={() => loginAs('BUSINESS')}>Business</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
