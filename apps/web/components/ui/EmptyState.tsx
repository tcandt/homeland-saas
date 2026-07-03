import React from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "./Button";

interface EmptyStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  title = "Chưa có dữ liệu", 
  message = "Hiện tại không có thông tin nào để hiển thị.", 
  actionLabel, 
  onAction,
  icon
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="w-16 h-16 bg-muted/10 text-muted rounded-full flex items-center justify-center mb-4">
        {icon || <FolderOpen size={32} />}
      </div>
      <h3 className="text-lg font-black text-text mb-2">{title}</h3>
      <p className="text-sm font-medium text-muted mb-6 max-w-[300px]">{message}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
