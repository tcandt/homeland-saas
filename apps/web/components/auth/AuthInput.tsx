import React from "react";

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export default function AuthInput({ label, error, ...props }: Props) {
  return (
    <div className="flex flex-col gap-[8px]">
      <label className="text-[14px] font-bold text-text">{label}</label>
      <input 
        className={`h-[48px] md:h-[52px] px-[16px] rounded-[14px] bg-background border text-[15px] transition-all focus:outline-none focus:ring-4
          ${error 
            ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20" 
            : "border-border focus:border-[#6366f1] focus:ring-[#6366f1]/20"}`}
        {...props}
      />
      {error && <span className="text-[13px] font-medium text-rose-500">{error}</span>}
    </div>
  );
}
