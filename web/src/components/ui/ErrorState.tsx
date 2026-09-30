import React from 'react';
import { Button } from './Button';

export const ErrorState = ({ title, description, onRetry }: { title: string, description: string, onRetry?: () => void }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-white border border-seal-break-red rounded shadow-sm">
      <h3 className="text-lg font-heading font-bold text-seal-break-red mb-2">{title}</h3>
      <p className="text-ink text-sm mb-4">{description}</p>
      {onRetry && <Button variant="outline" onClick={onRetry}>Try Again</Button>}
    </div>
  );
};
