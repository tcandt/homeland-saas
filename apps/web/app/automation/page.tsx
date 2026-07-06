"use client";

import { useState } from 'react';
import useSWR from 'swr';
import AppShell from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Play, Settings, Clock, Activity, Bell, ListTodo, RefreshCw, CircleX } from 'lucide-react';

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
  console.log(`[Fetcher] Token present? ${!!token} for url ${url}`);
  if (token) {
    console.log(`[Fetcher] Token prefix: ${token.substring(0, 15)}`);
  }
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    console.error(`[Fetcher] Request failed with status ${res.status} for ${url}`);
    throw new Error('An error occurred while fetching the data.');
  }
  const json = await res.json();
  return json.data || json;
};

export default function AutomationCommandCenter() {
  const [activeTab, setActiveTab] = useState('workflows');
  const [workflowPayloads, setWorkflowPayloads] = useState<Record<string, string>>({
    'deposit.collected.workflow': JSON.stringify({
      tenantId: '',
      customerId: '',
      roomId: '',
      buildingId: '',
      amount: 5000000,
      sourceType: 'DEPOSIT',
      id: ''
    }, null, 2),
    'invoice.paid.workflow': JSON.stringify({
      tenantId: '',
      customerId: '',
      amount: 5000000,
      sourceType: 'INVOICE',
      id: ''
    }, null, 2)
  });

  const [rulePayloads, setRulePayloads] = useState<Record<string, string>>({
    'contract.expiring.30_days': JSON.stringify({
      tenantId: '',
      customerId: '',
      endDate: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString()
    }, null, 2),
    'invoice.overdue.7_days': JSON.stringify({
      tenantId: '',
      customerId: '',
      dueDate: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
      status: 'UNPAID'
    }, null, 2)
  });

  const [statusMessage, setStatusMessage] = useState<string>('');

  const { data: workflows, error: workflowsErr, mutate: mutateWorkflows } = useSWR('/api/v1/automation/workflows', fetcher);
  const { data: rules, error: rulesErr, mutate: mutateRules } = useSWR('/api/v1/automation/rules', fetcher);
  const { data: executions, error: executionsErr, mutate: mutateExecutions } = useSWR('/api/v1/automation/executions', fetcher, { refreshInterval: 2000 });
  const { data: queue, error: queueErr, mutate: mutateQueue } = useSWR('/api/v1/notifications/queue', fetcher, { refreshInterval: 2000 });

  const runWorkflow = async (name: string) => {
    try {
      const token = getAuthToken();
      const payloadStr = workflowPayloads[name] || '{}';
      const payload = JSON.parse(payloadStr);

      const res = await fetch(`/api/v1/automation/workflows/${name}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Failed to execute workflow');
      setStatusMessage(`Workflow ${name} triggered successfully.`);
      mutateExecutions();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    }
  };

  const runRule = async (name: string) => {
    try {
      const token = getAuthToken();
      const payloadStr = rulePayloads[name] || '{}';
      const payload = JSON.parse(payloadStr);

      const res = await fetch(`/api/v1/automation/rules/${name}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Failed to execute rule');
      setStatusMessage(`Rule ${name} triggered successfully.`);
      mutateExecutions();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    }
  };

  const retryQueue = async (id: string) => {
    try {
      const token = getAuthToken();
      await fetch(`/api/v1/notifications/queue/${id}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      mutateQueue();
    } catch (err: any) {
      console.error(err);
    }
  };

  const cancelQueue = async (id: string) => {
    try {
      const token = getAuthToken();
      await fetch(`/api/v1/notifications/queue/${id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      mutateQueue();
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <AppShell>
      <div data-testid="automation-root" className="p-6 space-y-6 max-w-[1600px] mx-auto text-text">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-2">Automation Command Center</h1>
          <p className="text-muted font-medium">Manage business processes, workflows, and automated rules</p>
        </div>

        {statusMessage && (
          <div data-testid="automation-status-message" className="p-4 bg-primary/10 border border-primary/20 rounded-xl text-sm font-bold text-primary">
            {statusMessage}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="workflows" data-testid="tab-workflows">
              <Settings className="w-4 h-4 mr-2" /> Workflows
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <Activity className="w-4 h-4 mr-2" /> Execution History
            </TabsTrigger>
            <TabsTrigger value="rules" data-testid="tab-rules">
              <Clock className="w-4 h-4 mr-2" /> Rules Engine
            </TabsTrigger>
            <TabsTrigger value="jobs" data-testid="tab-jobs">
              <ListTodo className="w-4 h-4 mr-2" /> Queue Jobs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workflows" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Active Workflows</CardTitle>
                <CardDescription>Available system workflows configured for your tenant.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {(workflows || [
                    { name: 'deposit.collected.workflow', triggerEvent: 'deposit.collected', steps: [] }
                  ]).map((w: any, i: number) => (
                    <div key={i} data-testid="workflow-card" className="p-4 border border-border rounded-xl bg-surface shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Settings className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-text" data-testid="workflow-name">{w.name}</h4>
                            <p className="text-xs text-muted font-medium mt-1">Trigger: <span className="font-bold text-text" data-testid="workflow-trigger">{w.triggerEvent}</span></p>
                          </div>
                        </div>
                        <Badge variant="success">ACTIVE</Badge>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted uppercase">Payload context (JSON)</label>
                        <textarea
                          data-testid={`workflow-payload-${w.name}`}
                          className="w-full font-mono text-xs bg-card p-3 rounded-xl border border-border h-32 focus:outline-none focus:ring-2 focus:ring-primary"
                          value={workflowPayloads[w.name] || ''}
                          onChange={(e) => setWorkflowPayloads({ ...workflowPayloads, [w.name]: e.target.value })}
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button
                          data-testid={`run-workflow-${w.name}`}
                          variant="primary"
                          size="sm"
                          className="gap-2"
                          onClick={() => runWorkflow(w.name)}
                        >
                          <Play className="w-3 h-3" /> Run Manual
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Execution History</CardTitle>
                <CardDescription>Audit log of all triggered workflows and their outcomes.</CardDescription>
              </CardHeader>
              <CardContent>
                {executions && executions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse" data-testid="execution-history-table">
                      <thead>
                        <tr className="border-b border-border text-xs font-black uppercase text-muted">
                          <th className="py-3 px-4">Workflow</th>
                          <th className="py-3 px-4">Trigger Event</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Started At</th>
                          <th className="py-3 px-4">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {executions.map((e: any, i: number) => (
                          <tr key={i} data-testid="execution-row" className="border-b border-border text-sm hover:bg-surface/50">
                            <td className="py-3 px-4 font-bold text-text" data-testid="execution-workflow-name">{e.workflowName}</td>
                            <td className="py-3 px-4 text-muted font-medium">{e.eventName}</td>
                            <td className="py-3 px-4">
                              <Badge 
                                data-testid="execution-status-badge"
                                variant={e.status === 'SUCCESS' ? 'success' : e.status === 'FAILED' ? 'error' : 'warning'}
                              >
                                {e.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-muted font-medium">{new Date(e.createdAt || e.startedAt).toLocaleString()}</td>
                            <td className="py-3 px-4 text-xs font-mono text-muted max-w-[200px] truncate" data-testid="execution-error">
                              {e.error || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState title="No Execution History" message="No workflows have been executed yet." icon={<Activity size={48} />} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rules" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Rules Engine</CardTitle>
                <CardDescription>Available automated business rules.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {(rules || [
                    { name: 'contract.expiring.30_days', description: 'Trigger when a contract expires within 30 days' }
                  ]).map((r: any, i: number) => (
                    <div key={i} data-testid="rule-card" className="p-4 border border-border rounded-xl bg-surface shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-text" data-testid="rule-name">{r.name}</h4>
                          <p className="text-xs text-muted font-medium mt-1">Description: {r.description}</p>
                        </div>
                        <Badge variant="success">ACTIVE</Badge>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-muted uppercase">Context (JSON)</label>
                        <textarea
                          data-testid={`rule-payload-${r.name}`}
                          className="w-full font-mono text-xs bg-card p-3 rounded-xl border border-border h-32 focus:outline-none focus:ring-2 focus:ring-primary"
                          value={rulePayloads[r.name] || ''}
                          onChange={(e) => setRulePayloads({ ...rulePayloads, [r.name]: e.target.value })}
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button
                          data-testid={`run-rule-${r.name}`}
                          variant="primary"
                          size="sm"
                          className="gap-2"
                          onClick={() => runRule(r.name)}
                        >
                          <Play className="w-3 h-3" /> Run Manual
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jobs" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Background Jobs Queue</CardTitle>
                <CardDescription>Queue items processed by the system.</CardDescription>
              </CardHeader>
              <CardContent>
                {queue && queue.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse" data-testid="jobs-queue-table">
                      <thead>
                        <tr className="border-b border-border text-xs font-black uppercase text-muted">
                          <th className="py-3 px-4">Channel</th>
                          <th className="py-3 px-4">Payload</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Error</th>
                          <th className="py-3 px-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {queue.map((q: any, i: number) => (
                          <tr key={i} data-testid="queue-row" className="border-b border-border text-sm hover:bg-surface/50">
                            <td className="py-3 px-4 font-bold text-text">{q.channel}</td>
                            <td className="py-3 px-4 text-xs text-muted max-w-[250px] truncate">{JSON.stringify(q.payload)}</td>
                            <td className="py-3 px-4">
                              <Badge 
                                data-testid="queue-status-badge"
                                variant={q.status === 'DELIVERED' || q.status === 'SENT' ? 'success' : q.status === 'FAILED' ? 'error' : 'warning'}
                              >
                                {q.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-xs text-error font-medium max-w-[200px] truncate">{q.error || '-'}</td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                {q.status === 'FAILED' && (
                                  <>
                                    <Button
                                      data-testid="queue-retry-btn"
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      onClick={() => retryQueue(q.id)}
                                    >
                                      <RefreshCw className="w-4 h-4 text-primary" />
                                    </Button>
                                    <Button
                                      data-testid="queue-cancel-btn"
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      onClick={() => cancelQueue(q.id)}
                                    >
                                      <CircleX className="w-4 h-4 text-error" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState title="Queue Empty" message="Background job queue is currently empty." icon={<ListTodo size={48} />} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
