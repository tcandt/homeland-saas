"use client";

import { useState } from 'react';
import useSWR from 'swr';
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CheckCircle2, Clock, Mail, MailOpen, Bell } from 'lucide-react';
import AppShell from "@/components/layout/AppShell";

const getAuthToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
};

const fetcher = async (url: string) => {
  const token = getAuthToken();
  console.log('[Fetcher] Token present? ' + !!token + ' for ' + url);
  if (token) {
    console.log('[Fetcher] Token prefix: ' + token.substring(0, 10));
  }
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    console.error('[Fetcher] Error status: ' + res.status + ' for ' + url);
    throw new Error('An error occurred while fetching the data.');
  }
  const json = await res.json();
  console.log('[Fetcher] Data fetched for ' + url);
  return json.data || json;
};

export default function InboxCenter() {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedNotification, setSelectedNotification] = useState<any>(null);

  const { data: notifications, error, mutate } = useSWR('/api/v1/notifications', fetcher, { refreshInterval: 0 });

  const markAsRead = async (id: string) => {
    const token = getAuthToken();
    await fetch(`/api/v1/notifications/${id}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }});
    mutate();
  };

  const markAllAsRead = async () => {
    const token = getAuthToken();
    await fetch(`/api/v1/notifications/read-all`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }});
    mutate();
  };

  const filteredNotifications = notifications?.filter((n: any) => {
    if (activeTab === 'unread') return n.status !== 'READ';
    return true;
  }) || [];

  return (
    <AppShell>
      <div data-testid="notifications-root" className="flex h-[calc(100vh-4rem)] max-w-[1600px] mx-auto bg-background text-text">
        {/* Sidebar */}
        <div data-testid="notifications-sidebar" className="w-64 border-r border-border p-4 space-y-2 bg-surface">
          <h2 className="text-xl font-black mb-6 flex justify-between items-center">
            Inbox
            <Badge variant="error" data-testid="notification-unread-count">
              {notifications?.filter((n: any) => n.status !== 'READ').length || 0}
            </Badge>
          </h2>
          <Button 
            variant={activeTab === 'all' ? 'primary' : 'ghost'}
            onClick={() => setActiveTab('all')}
            className="w-full justify-start gap-3"
          >
            <Mail className="w-4 h-4" /> All
          </Button>
          <Button 
            variant={activeTab === 'unread' ? 'primary' : 'ghost'}
            onClick={() => setActiveTab('unread')}
            className="w-full justify-start gap-3"
          >
            <Bell className="w-4 h-4" /> Unread
          </Button>

          <div data-testid="debug-info" className="mt-8 text-xs break-all text-red-500">
            DEBUG TOKEN: {getAuthToken()?.substring(0,20)}...
            <br/>
            DEBUG ERROR: {error ? error.message || 'Error' : 'No Error'}
            <br/>
            DEBUG NOTIFS LENGTH: {notifications ? notifications.length : 'undefined'}
          </div>

          <hr className="border-border my-4" />
          <Button variant="ghost" className="w-full justify-start">
            <Badge variant="primary">Finance</Badge>
          </Button>
        </div>

        {/* List */}
        <div data-testid="notifications-list" className="flex-1 flex flex-col border-r border-border bg-card">
          <div className="p-4 border-b border-border flex justify-between items-center bg-surface">
            <div className="flex gap-2">
              <Button data-testid="notification-mark-read" variant="ghost" size="sm" onClick={markAllAsRead} className="gap-2">
                <CheckCircle2 className="w-4 h-4" /> Mark all read
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredNotifications.map((n: any) => (
              <div 
                key={n.id} 
                data-testid="notification-item"
                onClick={() => { setSelectedNotification(n); if(n.status !== 'READ') markAsRead(n.id); }}
                className={`p-4 border-b border-border cursor-pointer hover:bg-surface transition-colors ${selectedNotification?.id === n.id ? 'bg-surface' : ''} ${n.status !== 'READ' ? 'border-l-4 border-l-primary bg-primary/5' : ''}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h4 className={`text-sm ${n.status !== 'READ' ? 'font-black text-text' : 'font-bold text-muted'}`}>
                    {n.title}
                    {n.status !== 'READ' && <span data-testid="notification-read-badge" className="ml-2 w-2 h-2 rounded-full bg-primary inline-block"></span>}
                  </h4>
                  <span className="text-xs text-muted font-medium">{new Date(n.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-muted line-clamp-1 font-medium">{n.message}</p>
              </div>
            ))}
            {filteredNotifications.length === 0 && (
               <div data-testid="notifications-empty-state">
                 <EmptyState title="Không có thông báo" message="Bạn đã đọc hết tất cả thông báo." icon={<Mail size={48} />} />
               </div>
            )}
          </div>
        </div>

        {/* Detail */}
        <div data-testid="notification-detail" className="w-[400px] bg-surface p-6 overflow-y-auto">
          {selectedNotification ? (
            <div>
               <h2 className="text-xl font-black mb-4 text-text">{selectedNotification.title}</h2>
               <div className="flex items-center gap-2 mb-6 text-xs text-muted font-medium">
                  <Clock className="w-4 h-4" /> {new Date(selectedNotification.createdAt).toLocaleString()}
               </div>
               <div className="bg-card p-4 rounded-xl border border-border mb-6 text-sm text-text whitespace-pre-wrap font-medium shadow-sm">
                  {selectedNotification.message}
               </div>
               <div className="space-y-2">
                  <h4 className="text-xs font-black text-muted uppercase">Metadata</h4>
                  <pre className="text-xs bg-card p-4 rounded-xl border border-border text-muted overflow-x-auto font-mono shadow-sm">
                    {JSON.stringify(selectedNotification.metadata, null, 2)}
                  </pre>
               </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted text-sm font-bold">
              Select a notification to view details
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
