import React from 'react';

type Step = { label: string; active: boolean; completed: boolean };

export const TickScale = ({ steps }: { steps: Step[] }) => {
  return (
    <div className="w-full overflow-x-auto pb-8 pt-2">
      <div className="flex min-w-full items-center px-4" role="progressbar" aria-label="Progress timeline">
        {steps.map((step, idx) => (
          <React.Fragment key={step.label}>
            <div className="flex flex-col items-center relative shrink-0">
              <div className={`w-4 h-4 rounded-full border-2 z-10 ${step.completed ? 'bg-calibration-blue border-calibration-blue' : step.active ? 'bg-white border-calibration-blue' : 'bg-white border-gray-300'}`} />
              <span className={`absolute top-6 text-xs text-center max-w-[120px] whitespace-normal break-words leading-tight ${step.active || step.completed ? 'text-ink font-medium' : 'text-gray-600'}`}>
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`flex-1 min-w-[32px] h-1 ${step.completed ? 'bg-calibration-blue' : 'bg-gray-300'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
