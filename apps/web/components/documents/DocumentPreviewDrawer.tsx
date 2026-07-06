'use client';

import React, { useState, useEffect } from 'react';
import { Download, PenTool, FileText } from 'lucide-react';
import SignatureCanvas from './SignatureCanvas';
import toast from 'react-hot-toast';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardContent } from '../ui/Card';
import { LoadingState } from '../ui/LoadingState';
import { EmptyState } from '../ui/EmptyState';

interface DocumentPreviewDrawerProps {
  open: boolean;
  documentId: string | null;
  onClose: () => void;
  onSigned: () => void;
}

const DocumentVersionList = ({ versions, documentId }: { versions: any[], documentId: string }) => {
  if (!versions || versions.length === 0) {
    return <EmptyState title="Không có phiên bản" message="Tài liệu này chưa có lịch sử phiên bản nào." icon={<FileText size={48} />} />;
  }
  return (
    <div className="flex flex-col gap-3 mt-4">
      {versions.map((v: any) => (
        <Card key={v.id} className="border border-border bg-card hover:bg-surface transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="font-bold text-sm text-text">Phiên bản {v.versionNumber}</div>
              <div className="text-xs text-muted font-medium mt-1">
                {new Date(v.createdAt).toLocaleString()} bởi <span className="font-bold text-text">{v.createdBy}</span>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-primary gap-1"
              onClick={() => window.open(`/api/v1/documents/${documentId}/versions/${v.id}/download`)}
            >
              <Download size={14}/> Tải
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const DocumentTimeline = ({ signatures, setSigningParty }: { signatures: any[], setSigningParty: (p: any) => void }) => {
  if (!signatures || signatures.length === 0) {
    return <p className="text-sm text-muted font-medium mt-4">Chưa có yêu cầu ký nào.</p>;
  }
  
  return (
    <div className="flex flex-col gap-4 mt-4">
      {signatures.map((req: any) => (
        <Card key={req.id} className="bg-surface border border-border shadow-none">
          <CardContent className="p-4">
            <div className="font-bold text-sm mb-4 flex justify-between items-center">
              <span className="text-text">{req.title}</span>
              <Badge variant={req.status === 'SIGNED' ? 'success' : 'neutral'}>{req.status}</Badge>
            </div>
            <div className="flex flex-col gap-3 relative before:absolute before:left-[15px] before:top-[12px] before:bottom-[12px] before:w-[2px] before:bg-border">
              {req.parties?.map((p: any, idx: number) => (
                <div key={p.id} className="flex items-center justify-between bg-card p-3 rounded-lg border border-border shadow-sm ml-8 relative">
                  <div className={`absolute -left-[39px] top-1/2 -translate-y-1/2 w-[14px] h-[14px] rounded-full border-2 border-card z-10 ${p.status === 'SIGNED' ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <div className="font-bold text-sm text-text">{p.name} <span className="font-bold text-muted text-xs">({p.role})</span></div>
                    <div className="text-xs text-muted mt-1 font-medium">
                      {p.status === 'SIGNED' ? <span className="text-green-600">Đã ký lúc {new Date(p.signedAt).toLocaleString()}</span> : 'Đang chờ ký'}
                    </div>
                  </div>
                  {p.status === 'PENDING' && (
                    <Button 
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-primary border-primary hover:bg-primary/5"
                      onClick={() => setSigningParty(p)}
                    >
                      <PenTool size={14}/> Ký ngay
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default function DocumentPreviewDrawer({ open, documentId, onClose, onSigned }: DocumentPreviewDrawerProps) {
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [signingParty, setSigningParty] = useState<any>(null);

  useEffect(() => {
    if (open && documentId) {
      loadDocument();
    } else {
      setDoc(null);
      setSigningParty(null);
    }
  }, [open, documentId]);

  const getToken = () => {
    try {
      const authData = localStorage.getItem('auth-storage');
      if (authData) {
        const parsed = JSON.parse(authData);
        return parsed?.state?.accessToken || 'demo-token';
      }
    } catch(e) {}
    return 'demo-token';
  };

  const loadDocument = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`/api/v1/documents/${documentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to load document');
      const data = await res.json();
      setDoc(data.data || data);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi tải chi tiết tài liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (documentId) {
      window.open(`/api/v1/documents/${documentId}/download`, '_blank');
    }
  };

  const handleSign = async (signatureData: string) => {
    if (!signingParty) return;
    try {
      const pendingReq = doc.signatures?.find((s: any) => s.status === 'PENDING' && s.parties.some((p: any) => p.id === signingParty.id));
      if (!pendingReq) throw new Error('Không tìm thấy yêu cầu ký');

      const token = getToken();
      const res = await fetch(`/api/v1/signature-requests/${pendingReq.id}/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          partyId: signingParty.id,
          signatureData
        })
      });
      if (!res.ok) throw new Error('Failed to sign');
      
      toast.success('Đã ký thành công');
      setSigningParty(null);
      loadDocument();
      onSigned();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi ký');
    }
  };

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title="Chi tiết tài liệu"
      size="lg"
    >
      <div data-testid="document-preview-drawer" className="flex flex-col gap-8 pb-10">
        {loading || !doc ? (
          <div className="pt-20">
            <LoadingState message="Đang tải dữ liệu..." />
          </div>
        ) : (
          <>
            <div>
              <h3 className="text-xl font-bold text-text mb-4">{doc.title}</h3>
              <div className="flex gap-2 mb-6">
                <Badge variant={doc.status === 'SIGNED' ? 'success' : 'warning'}>{doc.status}</Badge>
                <Badge variant="neutral">{doc.type}</Badge>
              </div>
              <Button data-testid="document-download-button" onClick={handleDownload} variant="primary" className="gap-2">
                <Download size={16}/> Tải PDF
              </Button>
            </div>

            <div className="h-px w-full bg-border" />

            <div data-testid="document-version-list">
              <h4 className="font-bold text-lg text-text flex items-center gap-2">
                <FileText size={20} className="text-primary"/> Lịch sử phiên bản
              </h4>
              <DocumentVersionList versions={doc.versions} documentId={documentId!} />
            </div>

            <div className="h-px w-full bg-border" />

            <div data-testid="document-timeline">
              <h4 className="font-bold text-lg text-text flex items-center gap-2">
                <PenTool size={20} className="text-primary"/> Trạng thái ký duyệt
              </h4>
              <DocumentTimeline signatures={doc.signatures} setSigningParty={setSigningParty} />
            </div>

            {signingParty && (
              <Card className="border-2 border-primary bg-primary/5 mt-4">
                <CardContent className="p-5">
                  <h4 className="font-black text-primary mb-4">Đang ký với tư cách: {signingParty.name}</h4>
                  <SignatureCanvas onSave={handleSign} onCancel={() => setSigningParty(null)} />
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}
