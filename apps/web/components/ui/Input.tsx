import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error, ...props }, ref) => {
    return (
      <div className="flex flex-col w-full">
        <input
          ref={ref}
          className={`flex h-10 w-full rounded-xl border bg-transparent px-3 py-2 text-sm transition-colors
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
            disabled:cursor-not-allowed disabled:opacity-50
            ${error ? "border-danger focus-visible:ring-danger" : "border-border focus-visible:ring-primary"}
            ${className}`}
          {...props}
        />
        {error && <span className="text-danger text-xs mt-1 font-medium">{error}</span>}
      </div>
    );
  }
);

Input.displayName = "Input";
