import React from 'react';

type Step = { label: string; active: boolean; completed: boolean };

export const TickScale = ({ steps }: { steps: Step[] }) => {
  return (
    <div className="flex w-full items-center mb-8 mt-2" role="progressbar" aria-label="Progress timeline">
      {steps.map((step, idx) => (
        <React.Fragment key={step.label}>
          <div className="flex flex-col items-center relative">
            <div className={`w-4 h-4 rounded-full border-2 z-10 ${step.completed ? 'bg-calibration-blue border-calibration-blue' : step.active ? 'bg-white border-calibration-blue' : 'bg-white border-gray-300'}`} />
            <span className={`absolute top-6 text-xs text-center w-24 font-semibold ${step.active || step.completed ? 'text-ink' : 'text-gray-600'}`}>
              {step.label}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`flex-1 h-1 ${step.completed ? 'bg-calibration-blue' : 'bg-gray-300'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
