import React from "react";

export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = "", ...props }) => {
  return (
    <div className={`animate-pulse bg-muted/20 rounded-xl ${className}`} {...props} />
  );
};
