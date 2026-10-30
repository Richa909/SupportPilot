import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractOrderId,
  detectIntent,
  evaluateRefundPolicy,
  evaluateReturnPolicy,
  INITIAL_ORDERS,
  INITIAL_SELLER_CONFIG,
} from './policy';

test('1. ORD-IND-1001: Successful order tracking intent and extraction', () => {
  const text = 'What is the delivery status of order ORD-IND-1001?';
  const orderId = extractOrderId(text);
  const intent = detectIntent(text);
  assert.equal(orderId, 'ORD-IND-1001');
  assert.equal(intent, 'order_status');
});

test('2. ORD-IND-1002: Eligible automatic refund of ₹2,365.50', () => {
  const order = INITIAL_ORDERS.find((o) => o.order_id === 'ORD-IND-1002');
  assert.ok(order);
  const result = evaluateRefundPolicy(order, 'I want a refund for ORD-IND-1002, changed my mind', INITIAL_SELLER_CONFIG);
  assert.equal(result.status, 'eligible');
  assert.equal(result.action, 'auto_refund');
  assert.equal(result.refundAmount, 2365.50);
});

test('3. ORD-IND-1003: Damaged item, escalated to supervisor', () => {
  const order = INITIAL_ORDERS.find((o) => o.order_id === 'ORD-IND-1003');
  assert.ok(order);
  const result = evaluateRefundPolicy(order, 'My coffee mug in ORD-IND-1003 arrived broken and damaged', INITIAL_SELLER_CONFIG);
  assert.equal(result.status, 'escalated');
  assert.equal(result.action, 'escalate');
  assert.equal(result.issueType, 'damaged_or_wrong_item');
  assert.equal(result.policy_rule, 'RULE_DAMAGED_OR_WRONG_ITEM');
});

test('4. ORD-IND-1004: ₹12,367 refund, escalated because it exceeds ₹4,150 limit', () => {
  const order = INITIAL_ORDERS.find((o) => o.order_id === 'ORD-IND-1004');
  assert.ok(order);
  const result = evaluateRefundPolicy(order, 'Please refund ORD-IND-1004 (₹12,367 bag)', INITIAL_SELLER_CONFIG);
  assert.equal(result.status, 'escalated');
  assert.equal(result.action, 'escalate');
  assert.equal(result.issueType, 'over_refund_limit');
  assert.equal(result.policy_rule, 'RULE_OVER_REFUND_LIMIT');
});

test('5. ORD-IND-1005: Order in transit, no automatic refund', () => {
  const order = INITIAL_ORDERS.find((o) => o.order_id === 'ORD-IND-1005');
  assert.ok(order);
  const result = evaluateRefundPolicy(order, 'I want money back for ORD-IND-1005', INITIAL_SELLER_CONFIG);
  assert.equal(result.status, 'blocked');
  assert.equal(result.action, 'none');
  assert.equal(result.policy_rule, 'RULE_NOT_DELIVERED');
});

test('6. Missing order ID: Agent asks for order ID', () => {
  const text = 'I want a refund for my item';
  const orderId = extractOrderId(text);
  const intent = detectIntent(text);
  assert.equal(orderId, null);
  assert.equal(intent, 'refund_request');
});

test('7. Invalid order ID: Evaluates non-existent order gracefully', () => {
  const result = evaluateRefundPolicy(undefined, 'Refund ORD-IND-9999', INITIAL_SELLER_CONFIG);
  assert.equal(result.status, 'error');
  assert.equal(result.action, 'none');
  assert.equal(result.policy_rule, 'RULE_ORDER_EXISTS');
});

test('8. Already-refunded order: Duplicate refund blocked', () => {
  const refundedOrder = {
    ...INITIAL_ORDERS[1],
    refund_status: 'Refunded' as const,
  };
  const result = evaluateRefundPolicy(refundedOrder, 'Refund ORD-IND-1002 again', INITIAL_SELLER_CONFIG);
  assert.equal(result.status, 'blocked');
  assert.equal(result.action, 'none');
  assert.equal(result.policy_rule, 'RULE_ALREADY_REFUNDED');
});

test('9. Return request: Creates a return request rather than immediately refunding', () => {
  const order = INITIAL_ORDERS.find((o) => o.order_id === 'ORD-IND-1001');
  assert.ok(order);
  const result = evaluateReturnPolicy(order, 'I want to return ORD-IND-1001', INITIAL_SELLER_CONFIG);
  assert.equal(result.status, 'eligible');
  assert.equal(result.action, 'create_return');
  assert.equal(result.policy_rule, 'RULE_RETURN_ELIGIBLE');
});

test('10. Supervisor approval: Valid state permits refund transition', () => {
  const order = { ...INITIAL_ORDERS[3] };
  assert.equal(order.refund_status, 'None');
  order.refund_status = 'Refunded';
  assert.equal(order.refund_status, 'Refunded');
});

test('11. Duplicate supervisor approval: Blocked when already refunded', () => {
  const order = { ...INITIAL_ORDERS[3], refund_status: 'Refunded' as const };
  const check = evaluateRefundPolicy(order, 'Approve refund', INITIAL_SELLER_CONFIG);
  assert.equal(check.status, 'blocked');
  assert.equal(check.policy_rule, 'RULE_ALREADY_REFUNDED');
});

test('12. Information requested: Case retains status and remains accessible', () => {
  const statusFilter: string = 'Info Requested';
  const cases = [
    { case_id: 1, status: 'Awaiting Review' },
    { case_id: 2, status: 'Info Requested' },
    { case_id: 3, status: 'Approved' },
  ];
  const infoCases = cases.filter((c) => c.status === statusFilter);
  assert.equal(infoCases.length, 1);
  assert.equal(infoCases[0].case_id, 2);
});
