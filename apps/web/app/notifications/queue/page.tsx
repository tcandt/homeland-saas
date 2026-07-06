"use client";

import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table } from "@/components/ui/Table";
import { RotateCw, XCircle } from 'lucide-react';

const getAuthToken = () => {
  if (typeof window !== 'undefined') {
    try {
      const authStore = localStorage.getItem('auth-storage');
      if (authStore) {
        const parsed = JSON.parse(authStore);
        return parsed?.state?.accessToken || '';
      }
    } catch (e) {}
  }
  return null;
};

const fetcher = async (url: string) => {
  const token = getAuthToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('An error occurred while fetching the data.');
  const json = await res.json();
  console.log('QUEUE API RESPONSE DATA:', JSON.stringify(json.data));
  return json.data;
};

export default function QueueAdmin() {
  const { data: queue, mutate, isLoading } = useSWR('/api/v1/notifications/queue', fetcher);

  const retry = async (id: string) => {
    const token = getAuthToken();
    await fetch(`/api/v1/notifications/queue/${id}/retry`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }});
    mutate();
  };

  const cancel = async (id: string) => {
    const token = getAuthToken();
    await fetch(`/api/v1/notifications/queue/${id}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }});
    mutate();
  };

  const columns = [
    {
      accessor: 'id',
      header: 'ID / Date',
      render: (q: any) => (
        <div>
          <div className="font-mono text-xs font-bold text-text">{q.id.slice(-8)}</div>
          <div className="text-muted font-medium text-xs">{new Date(q.createdAt).toLocaleString()}</div>
        </div>
      )
    },
    {
      accessor: 'channel',
      header: 'Channel',
      render: (q: any) => (
        <Badge variant="neutral">{q.channel}</Badge>
      )
    },
    {
      accessor: 'payload',
      header: 'Payload (Title)',
      render: (q: any) => (
        <span className="font-bold text-text">{q.payload?.title || 'Unknown Template'}</span>
      )
    },
    {
      accessor: 'status',
      header: 'Status',
      render: (q: any) => {
        let variant: "success" | "error" | "warning" | "neutral" = "neutral";
        if (q.status === 'DELIVERED') variant = "success";
        else if (q.status === 'FAILED') variant = "error";
        else if (q.status === 'RETRYING') variant = "warning";
        else if (q.status === 'QUEUED') variant = "neutral";

        return (
          <div data-testid="notification-queue-status-badge">
            <Badge variant={variant}>{q.status}</Badge>
            {q.error && <div className="text-xs text-error mt-1 line-clamp-1 font-medium">{q.error}</div>}
          </div>
        );
      }
    },
    {
      accessor: 'retries',
      header: 'Retries',
      render: (q: any) => <span className="font-medium text-text">{q.retryCount}</span>
    },
    {
      accessor: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (q: any) => (
        <div className="flex items-center justify-end gap-1">
          <Button 
            data-testid="notification-queue-retry-button"
            variant="ghost" 
            size="icon" 
            onClick={() => retry(q.id)} 
            disabled={q.status === 'DELIVERED'}
            title="Retry"
          >
            <RotateCw className="w-4 h-4 text-blue-500" />
          </Button>
          <Button 
            data-testid="notification-queue-cancel-button"
            variant="ghost" 
            size="icon" 
            onClick={() => cancel(q.id)} 
            disabled={q.status === 'DELIVERED'}
            title="Cancel"
          >
            <XCircle className="w-4 h-4 text-error" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div data-testid="notification-queue-root" className="p-6 max-w-[1600px] mx-auto text-text">
      <h1 className="text-3xl font-black mb-6">Notification Queue</h1>
      
      <Card>
        <CardContent className="p-0 overflow-hidden">
          <Table 
            data-testid="notification-queue-table"
            rowTestId="notification-queue-row"
            columns={columns}
            data={queue || []}
            isLoading={isLoading}
            emptyMessage="Queue is empty"
          />
        </CardContent>
      </Card>
    </div>
  );
}
