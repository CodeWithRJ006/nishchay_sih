import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { Design } from './pages/Design';
import { NotFound } from './pages/NotFound';
import { DesktopShell } from './layouts/DesktopShell';
import { MobileFieldShell } from './layouts/MobileFieldShell';

const ProtectedRoute = ({ allowedRoles, role, children }: { allowedRoles: string[], role: string, children: React.ReactNode }) => {
  if (!allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  return <>{children}</>;
};

function App() {
  const currentRole = 'BUSINESS'; 

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/design" element={<Design />} />
        
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute allowedRoles={['BUSINESS', 'LMO', 'GATC', 'ADMIN']} role={currentRole}>
              <DesktopShell role={currentRole} onSignOut={() => console.log('sign out')} />
            </ProtectedRoute>
          }
        >
          <Route index element={<div>Dashboard content goes here</div>} />
        </Route>

        <Route 
          path="/field" 
          element={
            <ProtectedRoute allowedRoles={['LMO', 'GATC']} role={currentRole}>
              <MobileFieldShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<div>Field verification content goes here</div>} />
        </Route>

        <Route path="/unauthorized" element={<div className="p-8 text-center text-red-500 font-bold">Unauthorized Access</div>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
