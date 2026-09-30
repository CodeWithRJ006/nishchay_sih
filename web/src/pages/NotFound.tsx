import React from 'react';
import { Link } from 'react-router-dom';
import { ErrorState } from '../components/ui/ErrorState';

export const NotFound = () => (
  <div className="min-h-screen flex items-center justify-center p-4 bg-gauge-steel">
    <div className="max-w-md w-full">
      <ErrorState 
        title="404 - Page Not Found" 
        description="The page you are looking for does not exist or has been moved."
      />
      <div className="mt-4 text-center">
        <Link to="/" className="text-calibration-blue hover:underline text-sm font-semibold">
          Return to Home
        </Link>
      </div>
    </div>
  </div>
);
