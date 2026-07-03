import React from "react";

interface Props {
  children: React.ReactNode;
}

export default function AuthCard({ children }: Props) {
  return (
    <div className="bg-card rounded-[24px] p-[24px] sm:p-[32px] md:p-[40px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-border/60">
      {children}
    </div>
  );
}
