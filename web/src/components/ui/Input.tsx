import React, { useId } from 'react';

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  error?: boolean;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', error, id: propId, name: propName, autoComplete = 'off', ...props }, ref) => {
    const generatedId = useId();
    const id = propId || generatedId;
    const name = propName || id;

    return (
      <input
        ref={ref}
        id={id}
        name={name}
        autoComplete={autoComplete}
        className={`flex min-h-[44px] w-full rounded border bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${error ? 'border-seal-break-red focus:ring-seal-break-red' : 'border-gray-300 focus:ring-calibration-blue'} ${className}`}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
