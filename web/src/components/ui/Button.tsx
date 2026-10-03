import React from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', ...props }, ref) => {
    const baseStyle = 'inline-flex items-center justify-center rounded font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
    const variants = {
      primary: 'bg-calibration-blue text-white hover:bg-opacity-90 focus:ring-calibration-blue',
      secondary: 'bg-gray-200 text-ink hover:bg-gray-300 focus:ring-gray-400',
      outline: 'border-2 border-calibration-blue text-calibration-blue hover:bg-calibration-blue hover:text-white focus:ring-calibration-blue',
      danger: 'bg-seal-break-red text-white hover:bg-opacity-90 focus:ring-seal-break-red',
    };
    const sizes = {
      sm: 'px-3 py-1.5 text-xs min-h-[36px]',
      md: 'px-4 py-2 text-sm min-h-[44px]',
      lg: 'px-6 py-3 text-base min-h-[48px]',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyle} ${sizes[size]} ${variants[variant]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
