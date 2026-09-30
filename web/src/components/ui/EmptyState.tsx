import React from 'react';

export const EmptyState = ({ title, description, action }: { title: string, description: string, action?: React.ReactNode }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded border border-gray-200 shadow-sm min-h-[200px]">
      <h3 className="text-lg font-heading font-bold text-ink mb-2">{title}</h3>
      <p className="text-gray-500 text-sm mb-4 max-w-md">{description}</p>
      {action}
    </div>
  );
};
