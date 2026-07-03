import React, { forwardRef } from 'react';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <input
        type="checkbox"
        ref={ref}
        className={`w-[18px] h-[18px] rounded-[4px] border-border bg-background accent-primary text-primary focus:ring-2 focus:ring-primary/20 transition-colors ${className}`}
        {...props}
      />
    );
  }
);

Checkbox.displayName = 'Checkbox';
