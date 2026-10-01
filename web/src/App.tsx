import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { Design } from './pages/Design';
import { NotFound } from './pages/NotFound';
import { DesktopShell } from './layouts/DesktopShell';
import { MobileFieldShell } from './layouts/MobileFieldShell';
import { AuthProvider, useAuth } from './AuthContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { BusinessProfile } from './pages/BusinessProfile';
import { AdminProvision } from './pages/AdminProvision';
import { OfficerProfile } from './pages/OfficerProfile';

import { Instruments } from './pages/Instruments';
import { InstrumentProfile } from './pages/InstrumentProfile';
import { ApplicationWizard } from './pages/ApplicationWizard';
import { SandboxCheckout } from './pages/SandboxCheckout';
import { ReceiptPage } from './pages/ReceiptPage';
import { AdminDashboard as AdminFinance } from './pages/AdminFinance';
import { ApplicationSchedule } from './pages/ApplicationSchedule';
import { OfficerJobs } from './pages/OfficerJobs';
import { AdminUnassigned } from './pages/AdminUnassigned';
import { JobList } from './pages/field/JobList';
import { JobDetail } from './pages/field/JobDetail';
import { JobInspection } from './pages/field/JobInspection';

const ProtectedRoute = ({ allowedRoles, children }: { allowedRoles: string[], children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

function AppRoutes() {
  const { user, logout } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/design" element={<Design />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />
      
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['BUSINESS', 'LMO', 'GATC', 'ADMIN']}>
            <DesktopShell role={user?.role || 'BUSINESS'} onSignOut={logout} />
          </ProtectedRoute>
        }
      >
        <Route index element={<div>Dashboard content goes here</div>} />
        <Route path="business-profile" element={<BusinessProfile />} />
        <Route path="officer-profile" element={<OfficerProfile />} />
        <Route path="provision" element={<AdminProvision />} />
        <Route path="instruments" element={<Instruments />} />
        <Route path="instruments/:id" element={<InstrumentProfile />} />
        <Route path="apply" element={<ApplicationWizard />} />
        <Route path="payment/:applicationId" element={<SandboxCheckout />} />
        <Route path="receipt/:applicationId" element={<ReceiptPage />} />
        <Route path="finance" element={<AdminFinance />} />
        <Route path="schedule/:applicationId" element={<ApplicationSchedule />} />
        <Route path="my-jobs" element={<OfficerJobs />} />
        <Route path="unassigned-jobs" element={<AdminUnassigned />} />
      </Route>

      <Route 
        path="/field" 
        element={
          <ProtectedRoute allowedRoles={['LMO', 'GATC']}>
            <MobileFieldShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<JobList />} />
        <Route path="job/:id" element={<JobDetail />} />
        <Route path="job/:id/inspection" element={<JobInspection />} />
      </Route>

      <Route path="/unauthorized" element={<div className="p-8 text-center text-red-500 font-bold">Unauthorized Access</div>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
