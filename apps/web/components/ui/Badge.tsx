import React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "success" | "warning" | "error" | "neutral" | "primary";
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = "neutral", className = "", ...props }) => {
  const baseStyles = "inline-flex items-center px-2 py-0.5 rounded-xl text-xs font-bold gap-1";
  
  const variants = {
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    error: "bg-danger/10 text-danger",
    primary: "bg-primary/10 text-primary",
    neutral: "bg-muted/10 text-muted",
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
};
