import { WorkflowStatus } from './automation.constants';

export interface WorkflowDefinition {
  name: string;
  description?: string;
  triggerEvent: string;
  steps: WorkflowStepDefinition[];
}

export interface WorkflowStepDefinition {
  name: string;
  type: string; // e.g. CREATE_JOURNAL_ENTRY, INVALIDATE_DASHBOARD_CACHE, etc.
  params?: Record<string, any>;
  order: number;
}

export interface RuleDefinition {
  name: string;
  description?: string;
  condition: (context: any) => Promise<boolean>;
  action: (context: any) => Promise<void>;
}
