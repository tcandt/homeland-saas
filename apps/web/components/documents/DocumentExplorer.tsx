"use client";

import React, { useEffect, useState } from "react";
import { FileText, Download, RefreshCcw, Eye } from "lucide-react";
import toast from "react-hot-toast";
import DocumentPreviewDrawer from "./DocumentPreviewDrawer";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { Table } from "../ui/Table";
import { Badge } from "../ui/Badge";

export default function DocumentExplorer() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const authStore = localStorage.getItem("auth-storage");
      let token = "demo-token";
      if (authStore) {
        try {
          token = JSON.parse(authStore).state?.accessToken || "demo-token";
        } catch {
          // ignore malformed local storage state
        }
      }

      const res = await fetch("/api/v1/documents", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      const docs = json.data || json;
      setDocuments(Array.isArray(docs) ? docs : []);
    } catch {
      toast.error("Lỗi tải danh sách tài liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const columns = [
    {
      accessor: "title",
      header: "Tên tài liệu",
      render: (doc: any) => <span data-testid="document-card" className="font-bold text-text">{doc.title}</span>,
    },
    {
      accessor: "type",
      header: "Loại",
      render: (doc: any) => <Badge variant="neutral">{doc.type}</Badge>,
    },
    {
      accessor: "status",
      header: "Trạng thái",
      render: (doc: any) => {
        const variant = doc.status === "SIGNED" ? "success" : doc.status === "PENDING_SIGNATURE" ? "warning" : "neutral";
        return <Badge variant={variant as any}>{doc.status}</Badge>;
      },
    },
    {
      accessor: "createdAt",
      header: "Ngày tạo",
      render: (doc: any) => <span className="text-muted font-medium">{new Date(doc.createdAt).toLocaleString()}</span>,
    },
    {
      accessor: "actions",
      header: "Hành động",
      align: "right" as const,
      render: (doc: any) => (
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button data-testid="document-view-button" variant="ghost" size="icon" onClick={() => setPreviewId(doc.id)} title="Xem chi tiết">
            <Eye size={18} className="text-[#6366f1]" />
          </Button>
          <Button data-testid="document-download-button" variant="ghost" size="icon" onClick={() => window.open(`/api/v1/documents/${doc.id}/download`, "_blank")} title="Tải xuống">
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
        <Button variant="primary" onClick={loadDocuments} className="gap-1.5">
          <RefreshCcw size={16} strokeWidth={2.5} /> Tải lại
        </Button>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-auto bg-background">
        {documents.length === 0 && !loading ? (
          <div data-testid="empty-documents-state" className="flex flex-col items-center justify-center p-8 text-muted">
            Chưa có tài liệu nào
          </div>
        ) : null}
        <div data-testid="document-list">
          <Table
            columns={columns}
            data={documents}
            isLoading={loading}
            emptyMessage="Chưa có tài liệu nào"
            onRowClick={(doc) => setPreviewId(doc.id)}
          />
        </div>
      </CardContent>

      <DocumentPreviewDrawer
        open={!!previewId}
        documentId={previewId}
        onClose={() => setPreviewId(null)}
        onSigned={loadDocuments}
      />
    </Card>
  );
}
