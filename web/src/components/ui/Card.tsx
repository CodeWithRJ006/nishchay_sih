import React from 'react';

export const Card = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => {
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${className}`}>
      {children}
    </div>
  );
};
