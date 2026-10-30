import { useState, useEffect, useCallback } from 'react';
import {
  Order,
  Case,
  ActionLog,
  SellerConfig,
  ChatMessage,
  ReturnRecord,
  RefundRecord,
  StoreMetrics,
  ExecutionStep,
} from '../types';
import {
  INITIAL_ORDERS,
  INITIAL_SELLER_CONFIG,
  extractOrderId,
  detectIntent,
  evaluateRefundPolicy,
  evaluateReturnPolicy,
} from './policy';

const STORAGE_KEY_PREFIX = 'retailai_hack4hack_';

export function useStore() {
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [cases, setCases] = useState<Case[]>([]);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  const [config, setConfigState] = useState<SellerConfig>(INITIAL_SELLER_CONFIG);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(true);
  const [engineMode, setEngineMode] = useState<'demo' | 'gemini'>('demo');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'msg-init',
      sender: 'assistant',
      text: 'Hello! I am your AI store support assistant. I can look up your order status, track shipments, or help with return and refund requests. How can I help you today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  // Fetch fresh store data from Python/SQLite backend
  const fetchStoreData = useCallback(async () => {
    try {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.orders) {
        setOrders(data.orders);
        setCases(data.cases || []);
        setReturns(data.returns || []);
        setRefunds(data.refunds || []);
        setActionLogs(data.action_logs || []);
        if (data.config) {
          setConfigState(data.config);
        }
        setIsBackendConnected(true);
      }
    } catch (e) {
      console.warn('Backend /api/data not available, using client store mirror:', e);
      setIsBackendConnected(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchStoreData();
  }, [fetchStoreData]);

  // Calculated Metrics from Actual Database State (Requirement 6)
  const metrics: StoreMetrics = {
    total_customer_conversations: Math.max(
      chatMessages.filter((m) => m.sender === 'customer').length,
      actionLogs.filter((l) => ['LOOKUP', 'POLICY_CHECK', 'CREATE_RETURN'].includes(l.action_type)).length
    ),
    successful_order_lookups: actionLogs.filter((l) => l.action_type === 'LOOKUP' && l.status === 'SUCCESS').length,
    auto_processed_refunds: refunds.filter((r) => r.authorized_by === 'AUTO_POLICY_SYSTEM').length,
    auto_processed_refunds_amount: refunds
      .filter((r) => r.authorized_by === 'AUTO_POLICY_SYSTEM')
      .reduce((sum, r) => sum + r.amount, 0),
    return_requests_created: returns.length,
    cases_awaiting_review: cases.filter((c) => c.status === 'Awaiting Review').length,
    cases_info_requested: cases.filter((c) => c.status === 'Info Requested').length,
    supervisor_approved_cases: cases.filter((c) => c.status === 'Approved').length,
    completed_customer_resolutions: actionLogs.filter((l) => l.action_type === 'RESOLVED_QUERY').length,
    blocked_actions: actionLogs.filter((l) => l.status === 'BLOCKED').length,
    total_refunds_count: refunds.length || orders.filter((o) => o.refund_status === 'Refunded').length,
    total_refunds_amount: refunds.length
      ? refunds.reduce((sum, r) => sum + r.amount, 0)
      : orders.filter((o) => o.refund_status === 'Refunded').reduce((sum, o) => sum + o.amount, 0),
  };

  // Helper to add local log if offline
  const addLocalLog = (
    action_type: ActionLog['action_type'],
    order_id: string | null,
    details: string,
    result: string,
    status: ActionLog['status'],
    tool_name?: string
  ) => {
    const newLog: ActionLog = {
      log_id: Date.now() + Math.floor(Math.random() * 1000),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      action_type,
      order_id,
      details,
      result,
      status,
      tool_name,
    };
    setActionLogs((prev) => [newLog, ...prev]);
  };

  // Send Customer Message
  const handleSendMessage = async (text: string) => {
    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'customer',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Send to server-side API backed by Python agent
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, engineMode }),
      });

      if (res.ok) {
        const payload = await res.json();
        const agent = payload.agentResponse;

        if (payload.storeData) {
          setOrders(payload.storeData.orders || []);
          setCases(payload.storeData.cases || []);
          setReturns(payload.storeData.returns || []);
          setRefunds(payload.storeData.refunds || []);
          setActionLogs(payload.storeData.action_logs || []);
        }

        const assistantMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: agent.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          extractedOrderId: agent.extracted_order_id,
          intent: agent.intent,
          toolCalled: agent.tool_called,
          toolResult: agent.tool_result,
          timeline: agent.timeline,
          requiresFollowup: agent.requires_followup,
          resolvedPrompt: agent.resolved_prompt,
        };

        setChatMessages((prev) => [...prev, assistantMsg]);
        setIsLoading(false);
        return;
      }
    } catch (err) {
      console.warn('API error, executing client-side policy fallback:', err);
    }

    // -------------------------------------------------------------
    // Client-side fallback if server API is momentarily unavailable
    // -------------------------------------------------------------
    const orderId = extractOrderId(text);
    const intent = detectIntent(text);
    const timeline: ExecutionStep[] = [
      { step: 1, title: 'Customer request received', details: `Received: "${text}"`, status: 'success' },
      { step: 2, title: 'Intent identified', details: `Intent: ${intent.replace(/_/g, ' ')} | Order: ${orderId || 'None'}`, status: 'success' },
    ];

    if (!orderId && intent !== 'greeting') {
      timeline.push(
        { step: 3, title: 'Order information retrieved', details: 'Order ID missing', status: 'blocked' },
        { step: 4, title: 'Relevant policy checked', policy_rule: 'RULE_ORDER_REQUIRED', details: 'Order ID required to proceed', status: 'blocked' },
        { step: 5, title: 'Approved Python tool executed', tool_name: 'None', details: 'Execution paused awaiting order ID', status: 'info' },
        { step: 6, title: 'Result verified', details: 'Follow-up requirement confirmed', status: 'success' },
        { step: 7, title: 'Customer response generated', details: 'Prompted customer for Order ID', status: 'success' }
      );
      setChatMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: `I'd be glad to help with your ${intent.replace(/_/g, ' ')}! Could you please provide your Order ID (for example, ORD-1001)?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          extractedOrderId: null,
          intent,
          timeline,
          requiresFollowup: true,
        },
      ]);
      setIsLoading(false);
      return;
    }

    if (intent === 'greeting' && !orderId) {
      timeline.push(
        { step: 3, title: 'Order information retrieved', details: 'Awaiting customer order ID', status: 'info' },
        { step: 4, title: 'Relevant policy checked', details: 'General customer inquiry assistance', status: 'info' },
        { step: 5, title: 'Approved Python tool executed', tool_name: 'None', details: 'No transactional tool needed', status: 'info' },
        { step: 6, title: 'Result verified', details: 'Ready for customer inquiry', status: 'success' },
        { step: 7, title: 'Customer response generated', details: 'Greeted customer', status: 'success' }
      );
      setChatMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: 'Hello! Please provide your Order ID (such as ORD-1001 or ORD-1002) and let me know if you need tracking, order status, or help with a return or refund.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          intent: 'greeting',
          timeline,
          requiresFollowup: true,
        },
      ]);
      setIsLoading(false);
      return;
    }

    if (!orderId) {
      setIsLoading(false);
      return;
    }

    const matchedOrder = orders.find((o) => o.order_id === orderId);

    if (!matchedOrder) {
      timeline.push(
        { step: 3, title: 'Order information retrieved', tool_name: 'lookup_order', details: `Queried database for '${orderId}' -> Not found`, status: 'not_found' },
        { step: 4, title: 'Relevant policy checked', policy_rule: 'RULE_ORDER_EXISTS', details: 'Order existence check failed', status: 'blocked' },
        { step: 5, title: 'Approved Python tool executed', tool_name: 'lookup_order', result: 'Order not found in database', status: 'not_found' },
        { step: 6, title: 'Result verified', details: 'Handled missing order gracefully', status: 'success' },
        { step: 7, title: 'Customer response generated', details: 'Politely requested customer double check ID', status: 'success' }
      );
      addLocalLog('LOOKUP', orderId, `Unknown order inquiry for ${orderId}`, 'Order not found', 'NOT_FOUND', 'lookup_order');
      setChatMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: `I searched our store database for Order **${orderId}**, but no matching records were found. Could you please double-check your confirmation email or order slip?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          extractedOrderId: orderId,
          intent,
          toolCalled: 'lookup_order',
          toolResult: { found: false, order_id: orderId },
          timeline,
          requiresFollowup: true,
        },
      ]);
      setIsLoading(false);
      return;
    }

    // Order found
    timeline.push({
      step: 3,
      title: 'Order information retrieved',
      tool_name: 'lookup_order',
      details: `Found ${orderId}: ${matchedOrder.item_name} (₹${matchedOrder.amount.toFixed(2)}, ${matchedOrder.shipping_status})`,
      status: 'success',
    });

    if (intent === 'order_status' || intent === 'general_inquiry') {
      timeline.push(
        { step: 4, title: 'Relevant policy checked', policy_rule: 'RULE_SHIPPING_VERIFICATION', details: `Carrier ${matchedOrder.carrier} tracking checked`, status: 'success' },
        { step: 5, title: 'Approved Python tool executed', tool_name: 'lookup_order', result: `Status: ${matchedOrder.shipping_status}, Tracking: ${matchedOrder.tracking_number}`, status: 'success' },
        { step: 6, title: 'Result verified', details: `Status verified as ${matchedOrder.shipping_status}`, status: 'success' },
        { step: 7, title: 'Customer response generated', details: 'Delivered verified tracking details', status: 'success' }
      );
      addLocalLog('LOOKUP', orderId, `Tracking inquiry for ${matchedOrder.item_name}`, `Status: ${matchedOrder.shipping_status}`, 'SUCCESS', 'lookup_order');

      let statusMsg = '';
      if (matchedOrder.shipping_status === 'Delivered') {
        statusMsg = `Great news! Order **${orderId}** for *${matchedOrder.item_name}* was **Delivered** on ${matchedOrder.delivery_date} via **${matchedOrder.carrier}** (Tracking: \`${matchedOrder.tracking_number}\`).\n\nDid this resolve your query?`;
      } else if (matchedOrder.shipping_status === 'In Transit') {
        statusMsg = `Order **${orderId}** for *${matchedOrder.item_name}* is currently **In Transit** via **${matchedOrder.carrier}** (Tracking: \`${matchedOrder.tracking_number}\`) and is out for delivery.`;
      } else {
        statusMsg = `Order **${orderId}** (${matchedOrder.item_name}) is currently **${matchedOrder.shipping_status}** with carrier ${matchedOrder.carrier}.`;
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: statusMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          extractedOrderId: orderId,
          intent,
          toolCalled: 'lookup_order',
          toolResult: { found: true, order: matchedOrder },
          timeline,
          requiresFollowup: false,
          resolvedPrompt: true,
        },
      ]);
      setIsLoading(false);
      return;
    }

    if (intent === 'return_request') {
      const returnCheck = evaluateReturnPolicy(matchedOrder, text, config);
      timeline.push({
        step: 4,
        title: 'Relevant policy checked',
        tool_name: 'check_return_eligibility',
        policy_rule: returnCheck.policy_rule,
        details: returnCheck.reason,
        status: returnCheck.status === 'blocked' ? 'blocked' : returnCheck.status === 'escalated' ? 'escalated' : 'success',
      });

      if (returnCheck.status === 'blocked') {
        timeline.push(
          { step: 5, title: 'Approved Python tool executed', tool_name: 'check_return_eligibility', result: returnCheck.message, status: 'blocked' },
          { step: 6, title: 'Result verified', details: 'Return blocked by policy', status: 'blocked' },
          { step: 7, title: 'Customer response generated', details: 'Informed customer of return block', status: 'success' }
        );
        addLocalLog('POLICY_CHECK', orderId, `Return blocked: ${returnCheck.reason}`, returnCheck.message, 'BLOCKED', 'check_return_eligibility');
        setChatMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            sender: 'assistant',
            text: returnCheck.message,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            extractedOrderId: orderId,
            intent,
            toolCalled: 'check_return_eligibility',
            toolResult: returnCheck,
            timeline,
            requiresFollowup: false,
          },
        ]);
        setIsLoading(false);
        return;
      }

      if (returnCheck.status === 'escalated') {
        const newCaseId = cases.length > 0 ? Math.max(...cases.map((c) => c.case_id)) + 1 : 101;
        const newCase: Case = {
          case_id: newCaseId,
          order_id: orderId,
          customer_name: matchedOrder.customer_name,
          issue_type: returnCheck.issueType || 'unclear_case',
          summary: returnCheck.caseSummary || 'Return claim escalated',
          customer_message: text,
          status: 'Awaiting Review',
          policy_rule: returnCheck.policy_rule,
          recommended_action: returnCheck.recommendedAction || 'Supervisor review',
          previous_actions: JSON.stringify([{ step: 'check_return_eligibility', result: returnCheck.reason }]),
          created_at: new Date().toLocaleString(),
          updated_at: new Date().toLocaleString(),
        };
        setCases((prev) => [newCase, ...prev]);
        timeline.push(
          { step: 5, title: 'Approved Python tool executed', tool_name: 'escalate_to_supervisor', result: `Case #${newCaseId} created`, status: 'escalated' },
          { step: 6, title: 'Result verified', details: 'Added to supervisor review queue', status: 'escalated' },
          { step: 7, title: 'Customer response generated', details: 'Escalation notified to customer', status: 'success' }
        );
        addLocalLog('ESCALATION', orderId, `Escalated return (Case #${newCaseId}): ${returnCheck.reason}`, 'Pending Review', 'ESCALATED', 'escalate_to_supervisor');
        setChatMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            sender: 'assistant',
            text: `${returnCheck.message}\n\n**Case Tracking #:** \`CASE-${newCaseId}\``,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            extractedOrderId: orderId,
            intent,
            toolCalled: 'escalate_to_supervisor',
            toolResult: { case_id: newCaseId, reason: returnCheck.reason },
            timeline,
            requiresFollowup: false,
          },
        ]);
        setIsLoading(false);
        return;
      }

      // Return eligible -> Create mock return (NOT a refund!)
      const retId = `RET-${Math.floor(100000 + Math.random() * 900000)}`;
      const trk = `RET-TRK-${orderId.slice(-4)}`;
      const newReturn: ReturnRecord = {
        return_id: retId,
        order_id: orderId,
        customer_name: matchedOrder.customer_name,
        item_name: matchedOrder.item_name,
        reason: text,
        status: 'Return Created',
        tracking_number: trk,
        created_at: new Date().toLocaleString(),
      };
      setReturns((prev) => [newReturn, ...prev]);
      setOrders((prev) =>
        prev.map((o) => (o.order_id === orderId ? { ...o, return_status: 'Return Requested' } : o))
      );
      timeline.push(
        { step: 5, title: 'Approved Python tool executed', tool_name: 'create_mock_return', result: `Return ${retId} created with tracking ${trk}`, status: 'success' },
        { step: 6, title: 'Result verified', details: 'Return request recorded; no premature refund issued', status: 'success' },
        { step: 7, title: 'Customer response generated', details: 'Issued prepaid return label instructions', status: 'success' }
      );
      addLocalLog('CREATE_RETURN', orderId, `Return request created for ${matchedOrder.item_name}`, `Return ID: ${retId}`, 'SUCCESS', 'create_mock_return');
      setChatMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: `Your return request for Order **${orderId}** (${matchedOrder.item_name}) has been created!\n\n• **Return ID:** \`${retId}\`\n• **Prepaid Return Label:** \`${trk}\`\n\nPlease ship the item back within 14 days. Once received and inspected, your refund will be processed.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          extractedOrderId: orderId,
          intent,
          toolCalled: 'create_mock_return',
          toolResult: newReturn,
          timeline,
          requiresFollowup: false,
        },
      ]);
      setIsLoading(false);
      return;
    }

    // Refund request / damaged / wrong item
    const refundCheck = evaluateRefundPolicy(matchedOrder, text, config);
    timeline.push({
      step: 4,
      title: 'Relevant policy checked',
      tool_name: 'check_refund_eligibility',
      policy_rule: refundCheck.policy_rule,
      details: refundCheck.reason,
      status: refundCheck.status === 'blocked' ? 'blocked' : refundCheck.status === 'escalated' ? 'escalated' : 'success',
    });

    if (refundCheck.status === 'blocked') {
      timeline.push(
        { step: 5, title: 'Approved Python tool executed', tool_name: 'check_refund_eligibility', result: refundCheck.message, status: 'blocked' },
        { step: 6, title: 'Result verified', details: 'Refund blocked by policy', status: 'blocked' },
        { step: 7, title: 'Customer response generated', details: 'Informed customer of policy block', status: 'success' }
      );
      addLocalLog('POLICY_CHECK', orderId, `Refund blocked: ${refundCheck.reason}`, refundCheck.message, 'BLOCKED', 'check_refund_eligibility');
      setChatMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: refundCheck.message,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          extractedOrderId: orderId,
          intent,
          toolCalled: 'check_refund_eligibility',
          toolResult: refundCheck,
          timeline,
          requiresFollowup: false,
        },
      ]);
      setIsLoading(false);
      return;
    }

    if (refundCheck.status === 'escalated') {
      const newCaseId = cases.length > 0 ? Math.max(...cases.map((c) => c.case_id)) + 1 : 101;
      const newCase: Case = {
        case_id: newCaseId,
        order_id: orderId,
        customer_name: matchedOrder.customer_name,
        issue_type: refundCheck.issueType || 'unclear_case',
        summary: refundCheck.caseSummary || 'Inquiry escalated',
        customer_message: text,
        status: 'Awaiting Review',
        policy_rule: refundCheck.policy_rule,
        recommended_action: refundCheck.recommendedAction || 'Supervisor review',
        previous_actions: JSON.stringify([{ step: 'check_refund_eligibility', result: refundCheck.reason }]),
        created_at: new Date().toLocaleString(),
        updated_at: new Date().toLocaleString(),
      };
      setCases((prev) => [newCase, ...prev]);
      timeline.push(
        { step: 5, title: 'Approved Python tool executed', tool_name: 'escalate_to_supervisor', result: `Case #${newCaseId} created`, status: 'escalated' },
        { step: 6, title: 'Result verified', details: 'Registered in supervisor cases table', status: 'escalated' },
        { step: 7, title: 'Customer response generated', details: 'Supervisor escalation notified', status: 'success' }
      );
      addLocalLog('ESCALATION', orderId, `Escalated refund (Case #${newCaseId}): ${refundCheck.reason}`, 'Pending Review', 'ESCALATED', 'escalate_to_supervisor');
      setChatMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: `${refundCheck.message}\n\n**Case Tracking #:** \`CASE-${newCaseId}\`\nA human supervisor will review your case shortly in the Retailer Dashboard.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          extractedOrderId: orderId,
          intent,
          toolCalled: 'escalate_to_supervisor',
          toolResult: { case_id: newCaseId, reason: refundCheck.reason },
          timeline,
          requiresFollowup: false,
        },
      ]);
      setIsLoading(false);
      return;
    }

    // Auto-refund approved
    const refundId = `REF-${Math.floor(100000 + Math.random() * 900000)}`;
    const newRefund: RefundRecord = {
      refund_id: refundId,
      order_id: orderId,
      amount: matchedOrder.amount,
      currency: 'INR',
      reason: text,
      authorized_by: 'AUTO_POLICY_SYSTEM',
      status: 'Processed',
      created_at: new Date().toLocaleString(),
    };
    setRefunds((prev) => [newRefund, ...prev]);
    setOrders((prev) =>
      prev.map((o) => (o.order_id === orderId ? { ...o, refund_status: 'Refunded' } : o))
    );
    timeline.push(
      { step: 5, title: 'Approved Python tool executed', tool_name: 'process_mock_refund', result: `Refund ${refundId} of ₹${matchedOrder.amount.toFixed(2)} processed`, status: 'success' },
      { step: 6, title: 'Result verified', details: 'Orders table updated to Refunded; refund record inserted', status: 'success' },
      { step: 7, title: 'Customer response generated', details: 'Provided refund reference ID', status: 'success' }
    );
    addLocalLog('AUTO_REFUND', orderId, `Auto-refund approved for ${matchedOrder.item_name} (₹${matchedOrder.amount.toFixed(2)})`, `Refund ID: ${refundId}`, 'SUCCESS', 'process_mock_refund');
    setChatMessages((prev) => [
      ...prev,
      {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: `Your refund request for Order **${orderId}** (₹${matchedOrder.amount.toFixed(2)} for *${matchedOrder.item_name}*) has been approved and processed automatically under store policy!\n\n• **Mock Refund ID:** \`${refundId}\`\n• **Amount:** \`₹${matchedOrder.amount.toFixed(2)} INR\`\n\nYour credit will reflect in 2-3 business days. Did this resolve your issue?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        extractedOrderId: orderId,
        intent,
        toolCalled: 'process_mock_refund',
        toolResult: newRefund,
        timeline,
        requiresFollowup: false,
        resolvedPrompt: true,
      },
    ]);
    setIsLoading(false);
  };

  // Supervisor Decision (Approve, Decline, Request Info)
  const handleSupervisorDecision = async (
    caseId: number,
    decision: 'Approve' | 'Decline' | 'Info Requested',
    note: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch('/api/supervisor/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, decision, notes: note }),
      });
      if (res.ok) {
        const payload = await res.json();
        if (payload.storeData) {
          setOrders(payload.storeData.orders || []);
          setCases(payload.storeData.cases || []);
          setReturns(payload.storeData.returns || []);
          setRefunds(payload.storeData.refunds || []);
          setActionLogs(payload.storeData.action_logs || []);
        }
        return payload.result || { success: true, message: 'Decision executed' };
      }
    } catch (err) {
      console.warn('Backend decision endpoint failed, executing local update:', err);
    }

    // Client-side execution fallback
    const targetCase = cases.find((c) => c.case_id === caseId);
    if (!targetCase) return { success: false, message: 'Case not found' };

    // Duplicate prevention check
    if (['Approved', 'Declined', 'Completed'].includes(targetCase.status)) {
      return { success: false, message: `Case #${caseId} is already ${targetCase.status}. Duplicate actions blocked.` };
    }

    const matchedOrder = orders.find((o) => o.order_id === targetCase.order_id);
    const amount = matchedOrder ? matchedOrder.amount : 0;

    if (decision === 'Approve') {
      if (matchedOrder?.refund_status === 'Refunded') {
        return { success: false, message: `Order ${targetCase.order_id} is already refunded. Duplicate blocked.` };
      }
      const refId = `REF-${Math.floor(100000 + Math.random() * 900000)}`;
      setRefunds((prev) => [
        {
          refund_id: refId,
          order_id: targetCase.order_id,
          amount,
          currency: 'INR',
          reason: note,
          authorized_by: 'SUPERVISOR',
          status: 'Processed',
          created_at: new Date().toLocaleString(),
        },
        ...prev,
      ]);
      setOrders((prev) =>
        prev.map((o) => (o.order_id === targetCase.order_id ? { ...o, refund_status: 'Refunded' } : o))
      );
      setCases((prev) =>
        prev.map((c) => (c.case_id === caseId ? { ...c, status: 'Approved', supervisor_notes: note, updated_at: new Date().toLocaleString() } : c))
      );
      addLocalLog('SUPERVISOR_ACTION', targetCase.order_id, `Supervisor approved Case #${caseId}: ${note}`, `Refund ${refId} (₹${amount.toFixed(2)}) granted`, 'SUCCESS', 'supervisor_handle_case');
      return { success: true, message: `Case #${caseId} approved. Mock refund ${refId} for ₹${amount.toFixed(2)} granted.` };
    } else if (decision === 'Decline') {
      setOrders((prev) =>
        prev.map((o) => (o.order_id === targetCase.order_id ? { ...o, refund_status: 'Declined' } : o))
      );
      setCases((prev) =>
        prev.map((c) => (c.case_id === caseId ? { ...c, status: 'Declined', supervisor_notes: note, updated_at: new Date().toLocaleString() } : c))
      );
      addLocalLog('SUPERVISOR_ACTION', targetCase.order_id, `Supervisor declined Case #${caseId}: ${note}`, 'Claim Declined', 'BLOCKED', 'supervisor_handle_case');
      return { success: true, message: `Case #${caseId} declined.` };
    } else {
      // Info Requested (stays in store!)
      setCases((prev) =>
        prev.map((c) => (c.case_id === caseId ? { ...c, status: 'Info Requested', supervisor_notes: note, updated_at: new Date().toLocaleString() } : c))
      );
      addLocalLog('SUPERVISOR_ACTION', targetCase.order_id, `Supervisor requested info for Case #${caseId}: ${note}`, 'Awaiting Customer Info', 'PENDING_REVIEW', 'supervisor_handle_case');
      return { success: true, message: `Requested info for Case #${caseId}. Case moved to Information Requested.` };
    }
  };

  // Reopen or update an 'Info Requested' case
  const handleReopenCase = async (caseId: number, newStatus: string = 'Awaiting Review', notes: string = '') => {
    try {
      const res = await fetch('/api/supervisor/reopen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, new_status: newStatus, notes }),
      });
      if (res.ok) {
        const payload = await res.json();
        if (payload.storeData) {
          setOrders(payload.storeData.orders || []);
          setCases(payload.storeData.cases || []);
          setReturns(payload.storeData.returns || []);
          setRefunds(payload.storeData.refunds || []);
          setActionLogs(payload.storeData.action_logs || []);
        }
        return payload.result;
      }
    } catch (err) {
      console.warn('Reopen API failed, updating locally:', err);
    }

    setCases((prev) =>
      prev.map((c) =>
        c.case_id === caseId
          ? {
              ...c,
              status: newStatus as any,
              supervisor_notes: (c.supervisor_notes ? c.supervisor_notes + '\n' : '') + `[Updated]: ${notes}`,
              updated_at: new Date().toLocaleString(),
            }
          : c
      )
    );
    addLocalLog('SUPERVISOR_ACTION', null, `Case #${caseId} updated to ${newStatus}`, notes, 'SUCCESS', 'reopen_or_update_case');
  };

  // Update Config
  const setConfig = async (newConfig: SellerConfig) => {
    setConfigState(newConfig);
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'max_auto_refund_limit', value: newConfig.max_auto_refund_limit.toString() }),
      });
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'return_window_days', value: newConfig.return_window_days.toString() }),
      });
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'escalate_damaged_items', value: newConfig.escalate_damaged_items ? '1' : '0' }),
      });
      fetchStoreData();
    } catch (err) {
      console.warn('Config API sync failed, updated locally:', err);
    }
  };

  // Confirm Resolved Query
  const handleConfirmResolved = async (messageId: string, resolved: boolean) => {
    if (resolved) {
      try {
        await fetch('/api/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message_id: messageId }),
        });
        fetchStoreData();
      } catch (err) {
        addLocalLog('RESOLVED_QUERY', null, 'Customer confirmed resolution', 'Query Closed', 'SUCCESS', 'confirm_resolved');
      }

      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, resolvedPrompt: false, text: msg.text + '\n\n*(Customer confirmed: Issue resolved. Thank you!)*' }
            : msg
        )
      );
    } else {
      setChatMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, resolvedPrompt: false } : msg))
      );
      setChatMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: 'Understood. Please let me know what else you need assistance with, and I will be happy to look into it or escalate to our supervisor.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  // Reset Data
  const resetAllData = async () => {
    try {
      await fetch('/api/reset', { method: 'POST' });
      fetchStoreData();
    } catch (err) {
      setOrders(INITIAL_ORDERS);
      setCases([]);
      setReturns([]);
      setRefunds([]);
      setActionLogs([
        {
          log_id: 1,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          action_type: 'POLICY_CHECK',
          order_id: 'SYSTEM',
          tool_name: 'reset_data',
          details: 'Store policy reset to defaults (₹4,150.00 auto-refund threshold, 30-day window)',
          result: 'Active',
          status: 'SUCCESS',
        },
      ]);
      setConfigState(INITIAL_SELLER_CONFIG);
    }

    setChatMessages([
      {
        id: 'msg-init-reset',
        sender: 'assistant',
        text: 'Hello! I am your AI store support assistant. I can look up your order status, track shipments, or help with return and refund requests. How can I help you today?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return {
    orders,
    cases,
    returns,
    refunds,
    actionLogs,
    config,
    setConfig,
    metrics,
    chatMessages,
    isLoading,
    isBackendConnected,
    engineMode,
    setEngineMode,
    handleSendMessage,
    handleConfirmResolved,
    handleSupervisorDecision,
    handleReopenCase,
    resetAllData,
    refreshData: fetchStoreData,
  };
}
