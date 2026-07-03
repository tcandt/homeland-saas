import React from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "./Button";

interface PermissionDeniedStateProps {
  message?: string;
  onGoBack?: () => void;
}

export const PermissionDeniedState: React.FC<PermissionDeniedStateProps> = ({ 
  message = "Bạn không có quyền truy cập vào nội dung này.", 
  onGoBack 
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="w-16 h-16 bg-danger/10 text-danger rounded-full flex items-center justify-center mb-4">
        <ShieldAlert size={32} />
      </div>
      <h3 className="text-lg font-black text-text mb-2">Từ chối truy cập</h3>
      <p className="text-sm font-medium text-muted mb-6 max-w-[300px]">{message}</p>
      {onGoBack && (
        <Button variant="secondary" onClick={onGoBack}>
          Quay lại
        </Button>
      )}
    </div>
  );
};
