import React from 'react';

export const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="bg-white rounded shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="px-4 py-3 border-b flex justify-between items-center">
          <h2 id="modal-title" className="text-lg font-heading font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-ink text-xl font-bold">&times;</button>
        </div>
        <div className="p-4 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};
