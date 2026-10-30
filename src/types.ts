/**
 * types.ts - Core types for Support Pilot Customer Support Prototype
 */

export interface Order {
  order_id: string;
  customer_name: string;
  customer_email: string;
  item_name: string;
  amount: number;
  currency: string;
  shipping_status: 'Delivered' | 'In Transit' | 'Processing';
  carrier: string;
  tracking_number: string;
  order_date: string;
  delivery_date: string | null;
  is_return_eligible: boolean | number;
  return_status?: 'None' | 'Return Requested' | 'Return Received';
  refund_status: 'None' | 'Pending Review' | 'Refunded' | 'Declined';
}

export interface ReturnRecord {
  return_id: string;
  order_id: string;
  customer_name: string;
  item_name: string;
  reason: string;
  status: 'Return Created' | 'Label Generated' | 'Item Received' | 'Completed';
  tracking_number: string;
  created_at: string;
}

export interface RefundRecord {
  refund_id: string;
  order_id: string;
  amount: number;
  currency: string;
  reason: string;
  authorized_by: 'AUTO_POLICY_SYSTEM' | 'SUPERVISOR';
  status: string;
  created_at: string;
}

export interface Case {
  case_id: number;
  order_id: string;
  customer_name: string;
  issue_type: 'refund_request' | 'damaged_or_wrong_item' | 'outside_return_window' | 'over_refund_limit' | 'return_issue' | 'unclear_case';
  summary: string;
  customer_message: string;
  status: 'Awaiting Review' | 'Info Requested' | 'Approved' | 'Declined' | 'Completed';
  policy_rule: string;
  recommended_action: string;
  previous_actions: string;
  supervisor_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ActionLog {
  log_id: number;
  timestamp: string;
  action_type: 'LOOKUP' | 'POLICY_CHECK' | 'AUTO_REFUND' | 'CREATE_RETURN' | 'ESCALATION' | 'SUPERVISOR_ACTION' | 'RESOLVED_QUERY';
  case_id?: number | null;
  order_id: string | null;
  tool_name?: string;
  input_params?: string;
  details: string;
  result: string;
  decision?: string;
  status: 'SUCCESS' | 'BLOCKED' | 'ESCALATED' | 'PENDING_REVIEW' | 'NOT_FOUND' | 'FAILED';
}

export interface SellerConfig {
  max_auto_refund_limit: number;
  return_window_days: number;
  escalate_damaged_items: boolean;
}

export interface StoreMetrics {
  total_customer_conversations: number;
  successful_order_lookups: number;
  auto_processed_refunds: number;
  auto_processed_refunds_amount: number;
  return_requests_created: number;
  cases_awaiting_review: number;
  cases_info_requested: number;
  supervisor_approved_cases: number;
  completed_customer_resolutions: number;
  blocked_actions: number;
  total_refunds_count: number;
  total_refunds_amount: number;
}

export interface ExecutionStep {
  step: number;
  title: string;
  tool_name?: string;
  policy_rule?: string;
  result?: string;
  details?: string;
  status: 'success' | 'blocked' | 'escalated' | 'not_found' | 'info';
}

export interface ChatMessage {
  id: string;
  sender: 'customer' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  extractedOrderId?: string | null;
  intent?: string;
  toolCalled?: string | null;
  toolResult?: any;
  timeline?: ExecutionStep[];
  requiresFollowup?: boolean;
  resolvedPrompt?: boolean;
}
