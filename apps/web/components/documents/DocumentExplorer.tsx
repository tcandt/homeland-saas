"use client";

import React, { useRef, useState, type ChangeEvent } from "react";
import { Camera, FilePlus2, FileText, Download, RefreshCcw, Eye, Upload } from "lucide-react";
import toast from "react-hot-toast";
import DocumentPreviewDrawer from "./DocumentPreviewDrawer";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { Table, type Column } from "../ui/Table";
import { Badge } from "../ui/Badge";
import { Modal } from "../ui/Modal";
import { downloadDocument } from "../../lib/documents/download-document";
import type { DocumentRecord } from "../../lib/api/documents.api";
import {
  useDocumentTemplatesQuery,
  useDocumentsQuery,
  useGenerateDocumentMutation,
  useUploadDocumentMutation,
} from "../../lib/queries/documents.queries";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function getUploadValidationError(file: File) {
  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  if (!isImage && !isPdf) {
    return "Chỉ hỗ trợ ảnh hoặc tệp PDF.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "Tệp tải lên không được vượt quá 20 MB.";
  }
  return null;
}

export default function DocumentExplorer() {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [selectedTemplateCode, setSelectedTemplateCode] = useState("");
  const [title, setTitle] = useState("");
  const [payloadText, setPayloadText] = useState("{}");
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const documentsQuery = useDocumentsQuery();
  const templatesQuery = useDocumentTemplatesQuery(isGenerateModalOpen);
  const generateDocument = useGenerateDocumentMutation();
  const uploadDocument = useUploadDocumentMutation();
  const documents = documentsQuery.data || [];
  const templates = templatesQuery.data || [];
  const isUploading = uploadDocument.isPending;

  const resetGenerationForm = () => {
    setSelectedTemplateCode("");
    setTitle("");
    setPayloadText("{}");
    setGenerationError(null);
  };

  const closeGenerationModal = () => {
    if (generateDocument.isPending) return;
    setIsGenerateModalOpen(false);
    resetGenerationForm();
  };

  const openGenerationModal = () => {
    resetGenerationForm();
    setIsGenerateModalOpen(true);
  };

  const handleGenerate = async () => {
    const templateCode = selectedTemplateCode.trim();
    if (!templateCode) {
      setGenerationError("Chọn mẫu tài liệu trước khi tạo.");
      return;
    }

    let payload: Record<string, unknown>;
    try {
      const parsedPayload = JSON.parse(payloadText || "{}");
      if (!parsedPayload || Array.isArray(parsedPayload) || typeof parsedPayload !== "object") {
        throw new Error();
      }
      payload = parsedPayload as Record<string, unknown>;
    } catch {
      setGenerationError("Dữ liệu tài liệu phải là JSON object hợp lệ.");
      return;
    }

    setGenerationError(null);
    try {
      await generateDocument.mutateAsync({
        templateCode,
        title: title.trim() || undefined,
        payload,
      });
      toast.success("Đã tạo tài liệu.");
      setIsGenerateModalOpen(false);
      resetGenerationForm();
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "Không thể tạo tài liệu. Vui lòng thử lại.");
    }
  };

  const handleDownload = async (document: DocumentRecord) => {
    try {
      await downloadDocument(`/api/v1/documents/${document.id}/download`, document.title);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Khong the tai tai lieu");
    }
  };

  const handleUpload = async (file?: File) => {
    if (!file || isUploading) return;

    const validationError = getUploadValidationError(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setUploadError(null);
    try {
      await uploadDocument.mutateAsync(file);
      toast.success("Đã tải tài liệu lên.");
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Không thể tải tài liệu lên. Vui lòng thử lại.";
      setUploadError(message);
    }
  };

  const handleUploadInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    void handleUpload(file);
  };

  const columns: Column<DocumentRecord>[] = [
    {
      accessor: "title",
      header: "Tên tài liệu",
      render: (doc) => <span data-testid="document-card" className="font-bold text-text">{doc.title}</span>,
    },
    {
      accessor: "type",
      header: "Loại",
      render: (doc) => <Badge variant="neutral">{doc.type}</Badge>,
    },
    {
      accessor: "status",
      header: "Trạng thái",
      render: (doc) => {
        const variant = doc.status === "SIGNED" ? "success" : doc.status === "PENDING_SIGNATURE" ? "warning" : "neutral";
        return <Badge variant={variant as any}>{doc.status}</Badge>;
      },
    },
    {
      accessor: "createdAt",
      header: "Ngày tạo",
      render: (doc) => <span className="text-muted font-medium">{new Date(doc.createdAt).toLocaleString()}</span>,
    },
    {
      accessor: () => null,
      header: "Hành động",
      className: "text-right",
      render: (doc) => (
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button data-testid="document-view-button" variant="ghost" size="icon" onClick={() => setPreviewId(doc.id)} title="Xem chi tiết">
            <Eye size={18} className="text-[#6366f1]" />
          </Button>
          <Button data-testid="document-download-button" variant="ghost" size="icon" onClick={() => void handleDownload(doc)} title="Tải xuống">
            <Download size={18} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card data-testid="document-explorer" className="flex flex-col h-full overflow-hidden border-0 shadow-none">
      <CardHeader className="flex flex-row justify-between items-center bg-card border-b border-border p-4">
        <CardTitle className="flex items-center gap-2 m-0 text-lg">
          <FileText size={18} className="text-primary" /> Tài liệu gần đây
        </CardTitle>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            data-testid="document-upload-file"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="gap-1.5"
            title="Tải ảnh hoặc PDF vào thư mục uploads"
          >
            <Upload size={16} /> {isUploading ? "Đang tải..." : "Tải tệp"}
          </Button>
          <Button
            data-testid="document-upload-camera"
            variant="outline"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isUploading}
            className="gap-1.5"
            title="Chụp ảnh để tải vào thư mục uploads"
          >
            <Camera size={16} /> Chụp ảnh
          </Button>
          <Button data-testid="document-generate-open" variant="primary" onClick={openGenerationModal} className="gap-1.5">
            <FilePlus2 size={16} strokeWidth={2.5} /> Tạo tài liệu
          </Button>
          <Button variant="outline" onClick={() => void documentsQuery.refetch()} isLoading={documentsQuery.isFetching} className="gap-1.5">
            <RefreshCcw size={16} strokeWidth={2.5} /> Tải lại
          </Button>
        </div>
      </CardHeader>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,application/pdf,.pdf"
        disabled={isUploading}
        onChange={handleUploadInput}
      />
      <input
        ref={cameraInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        capture="environment"
        disabled={isUploading}
        onChange={handleUploadInput}
      />

      <CardContent className="flex-1 p-0 overflow-auto bg-background">
        {uploadError ? (
          <p data-testid="document-upload-error" role="alert" className="mx-5 mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {uploadError}
          </p>
        ) : null}
        {documents.length === 0 && !documentsQuery.isLoading ? (
          <div data-testid="empty-documents-state" className="flex flex-col items-center justify-center p-8 text-muted">
            Chưa có tài liệu nào
          </div>
        ) : null}
        <div data-testid="document-list">
          <Table
            columns={columns}
            data={documents}
            isLoading={documentsQuery.isLoading}
            isError={documentsQuery.isError}
            onRetry={() => void documentsQuery.refetch()}
            emptyMessage="Chưa có tài liệu nào"
            onRowClick={(doc) => setPreviewId(doc.id)}
          />
        </div>
      </CardContent>

      <DocumentPreviewDrawer
        open={!!previewId}
        documentId={previewId}
        onClose={() => setPreviewId(null)}
        onSigned={() => void documentsQuery.refetch()}
      />

      <Modal
        isOpen={isGenerateModalOpen}
        onClose={closeGenerationModal}
        title="Tạo tài liệu từ mẫu"
        maxWidth="max-w-lg"
        testId="document-generate-modal"
        footer={(
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeGenerationModal} disabled={generateDocument.isPending}>Hủy</Button>
            <Button
              data-testid="document-generate-submit"
              variant="primary"
              onClick={() => void handleGenerate()}
              isLoading={generateDocument.isPending}
              disabled={templatesQuery.isLoading || templates.length === 0}
              className="gap-1.5"
            >
              <FilePlus2 size={16} /> Tạo tài liệu
            </Button>
          </div>
        )}
      >
        <div className="space-y-4">
          {templatesQuery.isLoading ? <p className="text-sm text-muted">Đang tải mẫu tài liệu...</p> : null}
          {templatesQuery.isError ? (
            <p role="alert" className="text-sm text-danger">Không thể tải danh sách mẫu tài liệu.</p>
          ) : null}
          {!templatesQuery.isLoading && !templatesQuery.isError && templates.length === 0 ? (
            <p className="text-sm text-muted">Chưa có mẫu tài liệu nào cho đơn vị này.</p>
          ) : null}

          <label className="block text-sm font-semibold text-text" htmlFor="document-template-select">
            Mẫu tài liệu
            <select
              id="document-template-select"
              data-testid="document-template-select"
              value={selectedTemplateCode}
              onChange={(event) => {
                setSelectedTemplateCode(event.target.value);
                setGenerationError(null);
              }}
              disabled={templatesQuery.isLoading || templates.length === 0 || generateDocument.isPending}
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text"
            >
              <option value="">Chọn mẫu tài liệu</option>
              {templates.map((template) => (
                <option key={template.id} value={template.code}>
                  {template.name} ({template.type})
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-text" htmlFor="document-title-input">
            Tiêu đề <span className="font-normal text-muted">(không bắt buộc)</span>
            <input
              id="document-title-input"
              data-testid="document-title-input"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setGenerationError(null);
              }}
              disabled={generateDocument.isPending}
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text"
            />
          </label>

          <label className="block text-sm font-semibold text-text" htmlFor="document-payload-input">
            Dữ liệu tài liệu (JSON)
            <textarea
              id="document-payload-input"
              data-testid="document-payload-input"
              value={payloadText}
              onChange={(event) => {
                setPayloadText(event.target.value);
                setGenerationError(null);
              }}
              disabled={generateDocument.isPending}
              rows={7}
              spellCheck={false}
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-text"
            />
          </label>

          {generationError ? <p data-testid="document-generation-error" role="alert" className="text-sm text-danger">{generationError}</p> : null}
        </div>
      </Modal>
    </Card>
  );
}
