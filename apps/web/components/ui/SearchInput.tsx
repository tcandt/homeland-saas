import React from "react";
import { Search } from "lucide-react";
import { Input } from "./Input";

export const SearchInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => {
    return (
      <div className="relative w-full">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted">
          <Search size={16} />
        </div>
        <Input 
          ref={ref}
          className={`pl-9 ${className}`}
          type="search"
          {...props}
        />
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";
