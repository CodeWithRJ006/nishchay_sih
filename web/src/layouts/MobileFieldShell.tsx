import { Outlet } from 'react-router-dom';

export const MobileFieldShell = () => {
  return (
    <div className="min-h-screen bg-gauge-steel flex flex-col max-w-md mx-auto shadow-xl relative pb-20">
      <header className="bg-calibration-blue text-white p-4 shrink-0 shadow-md z-10 sticky top-0">
        <h1 className="text-lg font-heading font-bold">Field Verification</h1>
      </header>
      
      <main className="flex-1 overflow-y-auto p-4">
        <Outlet />
      </main>
      
      {/* Pages using this shell should place their primary action in a fixed bottom bar */}
    </div>
  );
};
