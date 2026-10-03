import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'info' | 'error' | 'success';

export interface ToastProps {
  message: string;
  type?: ToastType;
  onClose?: () => void;
  duration?: number;
}

export const Toast = ({ message, type = 'info', onClose, duration = 6000 }: ToastProps) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!visible) return null;

  const handleClose = () => {
    setVisible(false);
    onClose?.();
  };

  const config = {
    info: {
      bg: 'bg-calibration-blue',
      role: 'status',
      icon: <Info className="w-5 h-5 shrink-0" aria-hidden="true" />,
    },
    error: {
      bg: 'bg-seal-break-red',
      role: 'alert',
      icon: <AlertCircle className="w-5 h-5 shrink-0" aria-hidden="true" />,
    },
    success: {
      bg: 'bg-verified-green',
      role: 'status',
      icon: <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />,
    },
  }[type];

  return (
    <div
      role={config.role}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-3 rounded shadow-lg text-white font-medium text-sm z-50 flex items-center gap-3 min-w-[300px] max-w-md ${config.bg}`}
    >
      {config.icon}
      <div className="flex-1 text-left whitespace-pre-line">{message}</div>
      <button
        type="button"
        onClick={handleClose}
        className="p-1 rounded hover:bg-black/20 text-white/90 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
