import { ArrowRight } from 'lucide-react';

export const NextStepBanner = ({ text }: { text: string }) => {
  return (
    <div className="bg-calibration-blue/10 border-l-4 border-calibration-blue p-4 rounded-r mt-6 mb-4 flex items-start gap-3">
      <ArrowRight className="w-5 h-5 text-calibration-blue shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-bold text-calibration-blue uppercase tracking-wider mb-1">Next Step</p>
        <p className="text-ink text-sm">{text}</p>
      </div>
    </div>
  );
};
