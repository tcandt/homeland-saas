import React from "react";

interface Option {
  label: string;
  value: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Option[];
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", options, error, ...props }, ref) => {
    return (
      <div className="flex flex-col w-full">
        <select
          ref={ref}
          className={`flex h-10 w-full rounded-xl border bg-card px-3 py-2 text-sm transition-colors
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
            disabled:cursor-not-allowed disabled:opacity-50 appearance-none
            ${error ? "border-danger focus-visible:ring-danger" : "border-border focus-visible:ring-primary"}
            ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <span className="text-danger text-xs mt-1 font-medium">{error}</span>}
      </div>
    );
  }
);

Select.displayName = "Select";
