"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Camera, FileText, Loader2, Upload, X } from "lucide-react";
import { apiClient } from "../../lib/api/client";
import { Button } from "../ui/Button";
import { useToast } from "../ui/ToastContext";

const MAX_FILES = 10;
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function displayName(url: string, index: number) {
  const lastSegment = url.split("/").pop();
  return lastSegment ? decodeURIComponent(lastSegment) : `Chứng từ ${index + 1}`;
}

function isAcceptedProof(file: File) {
  return file.type.startsWith("image/")
    || file.type === "application/pdf"
    || file.name.toLowerCase().endsWith(".pdf");
}

export function RefundProofUploader({
  value,
  onChange,
  disabled = false,
  required = false,
  folder = "deposit-refunds",
  onUploadingChange,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
  required?: boolean;
  folder?: string;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const setUploading = (nextValue: boolean) => {
    setIsUploading(nextValue);
    onUploadingChange?.(nextValue);
  };

  const uploadProof = async (file?: File) => {
    if (!file || disabled) return;
    if (!isAcceptedProof(file)) {
      showToast("Chỉ hỗ trợ ảnh hoặc tệp PDF cho chứng từ hoàn tiền", "error");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast("Chứng từ hoàn tiền không được vượt quá 20 MB", "error");
      return;
    }
    if (value.length >= MAX_FILES) {
      showToast(`Tối đa ${MAX_FILES} chứng từ cho một lần hoàn tiền`, "error");
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);
      const uploaded = await apiClient.postForm<{ url: string }>(
        "/documents/upload",
        formData,
      );
      onChange([...new Set([...value, uploaded.url])]);
      showToast("Đã tải chứng từ hoàn tiền", "success");
    } catch (error) {
      console.error(error);
      showToast("Không thể tải chứng từ hoàn tiền", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    void uploadProof(file);
  };

  return (
    <div className="rounded-xl border border-border/70 bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Chứng từ hoàn tiền {required ? "(bắt buộc khi đã hoàn)" : "(nếu có)"}
          </div>
          <div className="mt-1 text-xs text-muted">
            Ảnh giao dịch, ảnh chụp camera hoặc tệp PDF, tối đa 20 MB/tệp.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isUploading}
            title="Tải ảnh hoặc PDF"
          >
            {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            <span className="ml-1.5">Tải tệp</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => cameraInputRef.current?.click()}
            disabled={disabled || isUploading}
            title="Chụp ảnh chứng từ"
          >
            <Camera size={14} />
            <span className="ml-1.5">Chụp ảnh</span>
          </Button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,application/pdf,.pdf"
        onChange={handleFile}
      />
      <input
        ref={cameraInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
      />
      {value.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {value.map((url, index) => (
            <li
              key={url}
              className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border/60 bg-card px-2 py-1.5 text-xs"
            >
              <span className="flex min-w-0 items-center gap-2 text-text">
                <FileText size={14} className="shrink-0 text-primary" />
                <span className="truncate" title={url}>{displayName(url, index)}</span>
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => onChange(value.filter((item) => item !== url))}
                disabled={disabled || isUploading}
                aria-label={`Xóa chứng từ ${index + 1}`}
                title="Xóa chứng từ"
              >
                <X size={14} />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
