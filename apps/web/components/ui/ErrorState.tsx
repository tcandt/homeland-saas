import React from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "./Button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ 
  title = "Đã xảy ra lỗi", 
  message = "Không thể tải dữ liệu. Vui lòng thử lại sau.", 
  onRetry 
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="w-16 h-16 bg-danger/10 text-danger rounded-full flex items-center justify-center mb-4">
        <AlertCircle size={32} />
      </div>
      <h3 className="text-lg font-black text-text mb-2">{title}</h3>
      <p className="text-sm font-medium text-muted mb-6 max-w-[300px]">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Thử lại
        </Button>
      )}
    </div>
  );
};
