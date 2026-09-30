import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', ...props }, ref) => {
    const baseStyle = 'inline-flex items-center justify-center rounded px-4 py-2 font-semibold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none min-h-[44px]';
    const variants = {
      primary: 'bg-calibration-blue text-white hover:bg-opacity-90 focus:ring-calibration-blue',
      secondary: 'bg-gray-200 text-ink hover:bg-gray-300 focus:ring-gray-400',
      outline: 'border-2 border-calibration-blue text-calibration-blue hover:bg-calibration-blue hover:text-white focus:ring-calibration-blue',
      danger: 'bg-seal-break-red text-white hover:bg-opacity-90 focus:ring-seal-break-red',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyle} ${variants[variant]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
