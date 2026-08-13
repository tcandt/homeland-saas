import React from "react";

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = "", ...props }) => {
  return (
    <div className={`bg-card rounded-2xl shadow-card border border-slate-200/80 dark:border-white/[0.06] p-4 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = "", ...props }) => {
  return <div className={`flex flex-col space-y-1.5 pb-4 ${className}`} {...props}>{children}</div>;
}

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ children, className = "", ...props }) => {
  return <h3 className={`font-semibold leading-none tracking-tight ${className}`} {...props}>{children}</h3>;
}

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ children, className = "", ...props }) => {
  return <p className={`text-sm text-muted ${className}`} {...props}>{children}</p>;
}

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = "", ...props }) => {
  return <div className={`${className}`} {...props}>{children}</div>;
}
