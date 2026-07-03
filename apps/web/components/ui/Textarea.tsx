import React from "react";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", error, ...props }, ref) => {
    return (
      <div className="flex flex-col w-full">
        <textarea
          ref={ref}
          className={`flex min-h-[80px] w-full rounded-xl border bg-transparent px-3 py-2 text-sm transition-colors
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

Textarea.displayName = "Textarea";
