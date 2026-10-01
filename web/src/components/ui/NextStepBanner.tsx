import { ArrowRight } from 'lucide-react';

export const NextStepBanner = ({ text, title, description, actionLabel, onAction }: { text?: string; title?: string; description?: string; actionLabel?: string; onAction?: () => void }) => {
  return (
    <div className="bg-calibration-blue/10 border-l-4 border-calibration-blue p-4 rounded-r mt-6 mb-4 flex items-start gap-3 justify-between">
      <div className="flex gap-3 items-start">
        <ArrowRight className="w-5 h-5 text-calibration-blue shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-calibration-blue uppercase tracking-wider mb-1">{title || 'Next Step'}</p>
          <p className="text-ink text-sm">{text || description}</p>
        </div>
      </div>
      {actionLabel && onAction && (
        <button onClick={onAction} className="bg-calibration-blue text-white px-4 py-2 rounded font-medium text-sm hover:bg-blue-600 transition-colors">
          {actionLabel}
        </button>
      )}
    </div>
  );
};
