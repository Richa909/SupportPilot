/**
 * policy.ts - Business rules, policy evaluation, and client-side mirror
 * Synchronized with authoritative Python tools.py logic.
 */

import { Order, Case, SellerConfig, ReturnRecord, RefundRecord, ExecutionStep } from '../types';

export const INITIAL_SELLER_CONFIG: SellerConfig = {
  max_auto_refund_limit: 4150.0,
  return_window_days: 30,
  escalate_damaged_items: true,
};

export const INITIAL_ORDERS: Order[] = [
  {
    order_id: 'ORD-IND-1001',
    customer_name: 'John Doe',
    customer_email: 'john.doe@example.com',
    item_name: 'Wireless Noise-Canceling Headphones',
    amount: 7469.00,
    currency: 'INR',
    shipping_status: 'Delivered',
    carrier: 'FastPost',
    tracking_number: 'TRK-98234-IND',
    order_date: '2026-10-18',
    delivery_date: '2026-10-20',
    is_return_eligible: true,
    return_status: 'None',
    refund_status: 'None',
  },
  {
    order_id: 'ORD-IND-1002',
    customer_name: 'Sarah Connor',
    customer_email: 'sarah.c@example.com',
    item_name: 'Organic Cotton T-Shirt',
    amount: 2365.50,
    currency: 'INR',
    shipping_status: 'Delivered',
    carrier: 'EcoShip',
    tracking_number: 'TRK-88123-IND',
    order_date: '2026-10-14',
    delivery_date: '2026-10-17',
    is_return_eligible: true,
    return_status: 'None',
    refund_status: 'None',
  },
  {
    order_id: 'ORD-IND-1003',
    customer_name: 'Alex Smith',
    customer_email: 'alex.s@example.com',
    item_name: 'Ceramic Coffee Mug Set',
    amount: 2822.00,
    currency: 'INR',
    shipping_status: 'Delivered',
    carrier: 'SwiftLog',
    tracking_number: 'TRK-77112-IND',
    order_date: '2026-10-19',
    delivery_date: '2026-10-21',
    is_return_eligible: true,
    return_status: 'None',
    refund_status: 'None',
  },
  {
    order_id: 'ORD-IND-1004',
    customer_name: 'Emily Davis',
    customer_email: 'emily.d@example.com',
    item_name: 'Leather Weekend Duffel Bag',
    amount: 12367.00,
    currency: 'INR',
    shipping_status: 'Delivered',
    carrier: 'LuxExpress',
    tracking_number: 'TRK-66442-IND',
    order_date: '2026-10-10',
    delivery_date: '2026-10-13',
    is_return_eligible: true,
    return_status: 'None',
    refund_status: 'None',
  },
  {
    order_id: 'ORD-IND-1005',
    customer_name: 'Marcus Vance',
    customer_email: 'marcus.v@example.com',
    item_name: 'Ergonomic Mechanical Keyboard',
    amount: 9877.00,
    currency: 'INR',
    shipping_status: 'In Transit',
    carrier: 'FastPost',
    tracking_number: 'TRK-55331-IND',
    order_date: '2026-10-20',
    delivery_date: null,
    is_return_eligible: false,
    return_status: 'None',
    refund_status: 'None',
  },
  {
    order_id: 'ORD-IND-1006',
    customer_name: 'Maya Lin',
    customer_email: 'maya.l@example.com',
    item_name: 'Smart LED Desk Lamp',
    amount: 3735.00,
    currency: 'INR',
    shipping_status: 'Delivered',
    carrier: 'SwiftLog',
    tracking_number: 'TRK-44221-IND',
    order_date: '2026-09-02',
    delivery_date: '2026-09-06',
    is_return_eligible: false,
    return_status: 'None',
    refund_status: 'None',
  },
];

export function extractOrderId(text: string): string | null {
  if (!text) return null;
  const matchInd = text.match(/\b(ORD[-_]?IND[-_]?[0-9]{4})\b/i);
  if (matchInd) {
    return `ORD-IND-${matchInd[1].slice(-4)}`;
  }
  const match = text.match(/\b(ORD[-_]?[0-9]{4})\b/i);
  if (match) {
    return `ORD-IND-${match[1].slice(-4)}`;
  }
  const matchNum = text.match(/#?([1-9][0-9]{3})\b/);
  if (matchNum) {
    return `ORD-IND-${matchNum[1]}`;
  }
  return null;
}

export function detectIntent(text: string): string {
  const lower = text.toLowerCase();
  if (/damage|broken|crack|defective|shatter|faulty/.test(lower)) {
    return 'damaged_item';
  }
  if (/wrong item|missing item|incorrect item|different item/.test(lower)) {
    return 'wrong_item';
  }
  if (/refund|money back|reimburse|charge back|credit back/.test(lower)) {
    return 'refund_request';
  }
  if (/return|send back|exchange|ship back/.test(lower)) {
    return 'return_request';
  }
  if (/status|where is|track|delivery|shipped|arrive|when will|package/.test(lower)) {
    return 'order_status';
  }
  if (/hello|hi|hey|good morning|good afternoon|help/.test(lower)) {
    return 'greeting';
  }
  return 'general_inquiry';
}

export interface PolicyEvaluationResult {
  status: 'eligible' | 'approved' | 'escalated' | 'blocked' | 'error';
  action: 'auto_refund' | 'create_return' | 'escalate' | 'none';
  policy_rule: string;
  reason: string;
  message: string;
  issueType?: 'refund_request' | 'damaged_or_wrong_item' | 'outside_return_window' | 'over_refund_limit' | 'unclear_case';
  caseSummary?: string;
  recommendedAction?: string;
  refundAmount?: number;
}

export function evaluateRefundPolicy(
  order: Order | undefined,
  customerMessage: string,
  config: SellerConfig
): PolicyEvaluationResult {
  if (!order) {
    return {
      status: 'error',
      action: 'none',
      policy_rule: 'RULE_ORDER_EXISTS',
      reason: 'Order not found in store database',
      message: 'The requested order could not be located in our records. Please verify your order number.',
    };
  }

  // Rule 1: Check if already refunded
  if (order.refund_status === 'Refunded') {
    return {
      status: 'blocked',
      action: 'none',
      policy_rule: 'RULE_ALREADY_REFUNDED',
      reason: 'Order already refunded',
      message: `Order ${order.order_id} has already been refunded in full. Duplicate refunds are prohibited.`,
    };
  }

  // Rule 2: Order must be delivered
  if (order.shipping_status !== 'Delivered') {
    return {
      status: 'blocked',
      action: 'none',
      policy_rule: 'RULE_NOT_DELIVERED',
      reason: `Shipping status is '${order.shipping_status}', not delivered`,
      message: `Order ${order.order_id} cannot be refunded because it is currently ${order.shipping_status}. Items must be delivered before initiating a refund.`,
    };
  }

  // Rule 3: Damaged or wrong item requires supervisor review
  const lowerMsg = customerMessage.toLowerCase();
  const isDamaged = /damage|broken|crack|defective|wrong item|missing item|shatter/.test(lowerMsg);
  if (isDamaged && config.escalate_damaged_items) {
    return {
      status: 'escalated',
      action: 'escalate',
      policy_rule: 'RULE_DAMAGED_OR_WRONG_ITEM',
      issueType: 'damaged_or_wrong_item',
      reason: 'Customer reported damaged or incorrect goods',
      caseSummary: `Damaged/Wrong item claim for ${order.item_name} (₹${order.amount.toFixed(2)}).`,
      recommendedAction: 'Supervisor inspect claim photos and issue replacement or refund',
      message: `I have escalated your claim for Order ${order.order_id} to our store supervisor. Because this involves a damaged/wrong item claim, a supervisor will review it shortly.`,
    };
  }

  // Rule 4: Return window check
  if (order.delivery_date) {
    const delivery = new Date(order.delivery_date);
    const now = new Date('2026-10-30');
    const diffDays = Math.floor((now.getTime() - delivery.getTime()) / (1000 * 3600 * 24));
    if (diffDays > config.return_window_days) {
      return {
        status: 'escalated',
        action: 'escalate',
        policy_rule: 'RULE_OUTSIDE_RETURN_WINDOW',
        issueType: 'outside_return_window',
        reason: `Delivered ${diffDays} days ago (exceeds ${config.return_window_days}-day limit)`,
        caseSummary: `Order delivered ${diffDays} days ago, outside standard ${config.return_window_days}-day return window.`,
        recommendedAction: 'Supervisor review for late return exception or credit',
        message: `Order ${order.order_id} was delivered ${diffDays} days ago, which is outside our automated ${config.return_window_days}-day return window. I have forwarded your request to our supervisor for manual review.`,
      };
    }
  }

  // Rule 5: Configurable refund threshold (₹4,150 default)
  if (order.amount > config.max_auto_refund_limit) {
    return {
      status: 'escalated',
      action: 'escalate',
      policy_rule: 'RULE_OVER_REFUND_LIMIT',
      issueType: 'over_refund_limit',
      reason: `Order total ₹${order.amount.toFixed(2)} exceeds auto-refund threshold (₹${config.max_auto_refund_limit.toFixed(2)})`,
      caseSummary: `High-value refund request (₹${order.amount.toFixed(2)} > ₹${config.max_auto_refund_limit.toFixed(2)} limit) for ${order.item_name}.`,
      recommendedAction: `Supervisor manual approval required for refund of ₹${order.amount.toFixed(2)}`,
      message: `Because your order total of ₹${order.amount.toFixed(2)} exceeds our automated refund limit of ₹${config.max_auto_refund_limit.toFixed(2)}, I have forwarded your request to our store supervisor for approval.`,
    };
  }

  // Rule 6: All criteria met -> Automated mock refund approval!
  return {
    status: 'eligible',
    action: 'auto_refund',
    policy_rule: 'RULE_AUTO_REFUND_ELIGIBLE',
    reason: `Delivered within return window and amount ₹${order.amount.toFixed(2)} <= limit ₹${config.max_auto_refund_limit.toFixed(2)}`,
    refundAmount: order.amount,
    message: `Your refund request for Order ${order.order_id} (₹${order.amount.toFixed(2)} for ${order.item_name}) has been approved and processed automatically under store policy!`,
  };
}

export function evaluateReturnPolicy(
  order: Order | undefined,
  customerMessage: string,
  config: SellerConfig
): PolicyEvaluationResult {
  if (!order) {
    return {
      status: 'error',
      action: 'none',
      policy_rule: 'RULE_ORDER_EXISTS',
      reason: 'Order not found',
      message: 'The requested order could not be located in our records.',
    };
  }

  // Item must be delivered
  if (order.shipping_status !== 'Delivered') {
    return {
      status: 'blocked',
      action: 'none',
      policy_rule: 'RULE_NOT_DELIVERED',
      reason: `Order is ${order.shipping_status}, not delivered`,
      message: `Order ${order.order_id} cannot be returned because it has not yet been delivered (Status: ${order.shipping_status}). Please wait for package arrival.`,
    };
  }

  // Damaged goods claim in return
  const isDamaged = /damage|broken|crack|defective|wrong item|missing item/.test(customerMessage.toLowerCase());
  if (isDamaged && config.escalate_damaged_items) {
    return {
      status: 'escalated',
      action: 'escalate',
      policy_rule: 'RULE_DAMAGED_OR_WRONG_ITEM',
      issueType: 'damaged_or_wrong_item',
      reason: 'Damaged item return claim requires supervisor review',
      caseSummary: `Damaged item return request for ${order.item_name}.`,
      recommendedAction: 'Supervisor review damage and issue return label or replacement',
      message: `Because your return for Order ${order.order_id} involves a damaged item, I have escalated your case to our supervisor to arrange an exchange or return.`,
    };
  }

  // Window check
  if (order.delivery_date) {
    const delivery = new Date(order.delivery_date);
    const now = new Date('2026-10-30');
    const diffDays = Math.floor((now.getTime() - delivery.getTime()) / (1000 * 3600 * 24));
    if (diffDays > config.return_window_days) {
      return {
        status: 'escalated',
        action: 'escalate',
        policy_rule: 'RULE_OUTSIDE_RETURN_WINDOW',
        issueType: 'outside_return_window',
        reason: `Delivered ${diffDays} days ago (exceeds ${config.return_window_days}-day limit)`,
        caseSummary: `Late return request delivered ${diffDays} days ago.`,
        recommendedAction: 'Supervisor review for return exception',
        message: `Order ${order.order_id} was delivered ${diffDays} days ago, exceeding our standard ${config.return_window_days}-day return window. I have forwarded this to our supervisor for review.`,
      };
    }
  }

  return {
    status: 'eligible',
    action: 'create_return',
    policy_rule: 'RULE_RETURN_ELIGIBLE',
    reason: 'Delivered and within standard return window',
    message: `Return request created for Order ${order.order_id}.`,
  };
}
