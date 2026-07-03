import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = "Đang tải dữ liệu..." }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-muted">
      <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
      <span className="text-sm font-bold">{message}</span>
    </div>
  );
};
