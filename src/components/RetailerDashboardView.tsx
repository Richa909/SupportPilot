import React, { useState } from 'react';
import {
  CheckCircle,
  AlertCircle,
  Clock,
  IndianRupee,
  ShieldAlert,
  Sliders,
  Check,
  X,
  MessageCircleQuestion,
  FileText,
  Search,
  Filter,
  ArrowUpRight,
  User,
  Package,
  RotateCcw,
  RefreshCw,
  FolderOpen,
  Info,
  ShieldCheck,
  Lock,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { Order, Case, ActionLog, SellerConfig, ReturnRecord, RefundRecord, StoreMetrics } from '../types';

interface RetailerDashboardViewProps {
  orders: Order[];
  cases: Case[];
  returns?: ReturnRecord[];
  refunds?: RefundRecord[];
  actionLogs: ActionLog[];
  config: SellerConfig;
  onChangeConfig: (newConfig: SellerConfig) => void;
  metrics: StoreMetrics;
  onSupervisorDecision: (caseId: number, decision: 'Approve' | 'Decline' | 'Info Requested', note: string) => Promise<{ success: boolean; message: string }>;
  onReopenCase?: (caseId: number, newStatus: string, notes: string) => void;
  onNavigateToChat: () => void;
  onRefreshData?: () => void;
}

export const RetailerDashboardView: React.FC<RetailerDashboardViewProps> = ({
  orders,
  cases,
  returns = [],
  refunds = [],
  actionLogs,
  config,
  onChangeConfig,
  metrics,
  onSupervisorDecision,
  onReopenCase,
  onNavigateToChat,
  onRefreshData,
}) => {
  // Case filtering state
  const [caseFilter, setCaseFilter] = useState<'Awaiting Review' | 'Info Requested' | 'Approved' | 'Declined' | 'Completed' | 'ALL'>('Awaiting Review');

  // Decision modal state
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [decisionType, setDecisionType] = useState<'Approve' | 'Decline' | 'Info Requested' | 'Reopen' | null>(null);
  const [supervisorNote, setSupervisorNote] = useState('');
  const [decisionFeedback, setDecisionFeedback] = useState<{ message: string; isError: boolean } | null>(null);

  // Audit filter state
  const [logFilter, setLogFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Policy form state
  const [refundLimitInput, setRefundLimitInput] = useState<number>(config.max_auto_refund_limit);
  const [returnWindowInput, setReturnWindowInput] = useState<number>(config.return_window_days);
  const [escalateDamagedInput, setEscalateDamagedInput] = useState<boolean>(config.escalate_damaged_items);
  const [policySavedFeedback, setPolicySavedFeedback] = useState(false);

  // Filtered cases
  const filteredCases = cases.filter((c) => {
    if (caseFilter === 'ALL') return true;
    return c.status === caseFilter;
  });

  const handleOpenDecisionModal = (c: Case, type: 'Approve' | 'Decline' | 'Info Requested' | 'Reopen') => {
    setSelectedCase(c);
    setDecisionType(type);
    setDecisionFeedback(null);
    if (type === 'Approve') {
      setSupervisorNote('Approved per store supervisor exception.');
    } else if (type === 'Decline') {
      setSupervisorNote('Declined: Claim does not meet return policy criteria.');
    } else if (type === 'Info Requested') {
      setSupervisorNote('Please provide clear photos of the shipping packaging and item label.');
    } else {
      setSupervisorNote('Customer provided required documentation. Resuming review.');
    }
  };

  const handleConfirmDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !decisionType) return;

    if (decisionType === 'Reopen') {
      if (onReopenCase) {
        onReopenCase(selectedCase.case_id, 'Awaiting Review', supervisorNote);
      }
      setSelectedCase(null);
      setDecisionType(null);
      return;
    }

    const res = await onSupervisorDecision(selectedCase.case_id, decisionType, supervisorNote);
    if (!res.success) {
      setDecisionFeedback({ message: res.message, isError: true });
    } else {
      setDecisionFeedback({ message: res.message, isError: false });
      setTimeout(() => {
        setSelectedCase(null);
        setDecisionType(null);
      }, 1000);
    }
  };

  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    onChangeConfig({
      max_auto_refund_limit: refundLimitInput,
      return_window_days: returnWindowInput,
      escalate_damaged_items: escalateDamagedInput,
    });
    setPolicySavedFeedback(true);
    setTimeout(() => setPolicySavedFeedback(false), 3000);
  };

  const filteredLogs = actionLogs.filter((log) => {
    const matchesFilter = logFilter === 'ALL' || log.action_type === logFilter;
    const matchesSearch =
      searchQuery === '' ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.result.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.order_id && log.order_id.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Retailer Supervisor Dashboard</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Live Sync Active
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time supervisor control tower for Support Pilot. Authorize escalations, adjust store policy ceilings, and audit whitelisted actions.
          </p>
        </div>
        <div className="flex items-center space-x-2.5">
          {onRefreshData && (
            <button
              type="button"
              onClick={onRefreshData}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 shadow-sm active:scale-95"
              title="Refresh store data from server"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span>Sync Data</span>
            </button>
          )}
          <button
            type="button"
            onClick={onNavigateToChat}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-800 hover:border-slate-700 rounded-xl text-xs font-semibold transition flex items-center space-x-2 shadow-sm active:scale-95"
          >
            <span>Customer Chat</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </button>
        </div>
      </div>

      {/* Metrics Row (Accurate, Real Database Analytics) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Metric 1: Conversations */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Conversations
            </span>
            <User className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-2.5 flex items-baseline space-x-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{metrics.total_customer_conversations}</span>
            <span className="text-[10px] text-slate-400">Total</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Customer chats recorded</p>
        </div>

        {/* Metric 2: Order Lookups */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Order Lookups
            </span>
            <Package className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2.5 flex items-baseline space-x-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{metrics.successful_order_lookups}</span>
            <span className="text-[10px] text-blue-400 font-semibold">Verified</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Database order hits</p>
        </div>

        {/* Metric 3: Auto-Refunds */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
              Auto-Refunds
            </span>
            <IndianRupee className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2.5 flex items-baseline space-x-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-300 tracking-tight">{metrics.auto_processed_refunds}</span>
            <span className="text-[10px] text-emerald-400 font-semibold">(&le;₹{config.max_auto_refund_limit.toLocaleString('en-IN')})</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Policy auto-approved</p>
        </div>

        {/* Metric 4: Returns Created */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-teal-400 uppercase tracking-wider">
              Returns Created
            </span>
            <RotateCcw className="w-4 h-4 text-teal-400" />
          </div>
          <div className="mt-2.5 flex items-baseline space-x-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-teal-300 tracking-tight">{metrics.return_requests_created}</span>
            <span className="text-[10px] text-teal-400 font-semibold">Labels</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Prepaid return labels</p>
        </div>

        {/* Metric 5: Awaiting Review */}
        <div className={`border rounded-2xl p-4 shadow-sm transition ${
          metrics.cases_awaiting_review > 0
            ? 'bg-amber-950/20 border-amber-500/50 shadow-amber-500/10'
            : 'bg-slate-900/90 border-slate-800/90'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
              Awaiting Review
            </span>
            <AlertCircle className={`w-4 h-4 ${metrics.cases_awaiting_review > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
          </div>
          <div className="mt-2.5 flex items-baseline space-x-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">{metrics.cases_awaiting_review}</span>
            <span className="text-[10px] text-amber-400 font-bold">
              {metrics.cases_awaiting_review > 0 ? 'Action Needed' : 'All Clear'}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Escalated by policy</p>
        </div>

        {/* Metric 6: Completed Resolutions */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Resolutions
            </span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2.5 flex items-baseline space-x-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 tracking-tight">{metrics.completed_customer_resolutions}</span>
            <span className="text-[10px] text-emerald-400 font-semibold">Closed</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Blocked: {metrics.blocked_actions}</p>
        </div>
      </div>

      {/* Middle Grid: Case Management Queue & Seller Policy Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Supervisor Cases Queue */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">Supervisor Review Queue</h2>
            </div>

            {/* Separate Dashboard Filters */}
            <div className="flex flex-wrap gap-1 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs">
              {(['Awaiting Review', 'Info Requested', 'Approved', 'Declined', 'ALL'] as const).map((filter) => {
                const count =
                  filter === 'ALL'
                    ? cases.length
                    : cases.filter((c) => c.status === filter).length;

                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setCaseFilter(filter)}
                    className={`px-3 py-1.5 rounded-xl font-medium transition flex items-center space-x-1.5 ${
                      caseFilter === filter
                        ? 'bg-slate-800 text-white shadow-sm border border-slate-700 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>{filter}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full border ${
                      filter === 'Awaiting Review' && count > 0
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {filteredCases.length === 0 ? (
            <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-10 text-center shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3.5 shadow-inner">
                <FolderOpen className="w-7 h-7 text-slate-500" />
              </div>
              <h3 className="text-base font-bold text-white">
                No cases currently in '{caseFilter}'
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 mt-1.5 max-w-md mx-auto leading-relaxed">
                Customer claims exceeding the ₹{config.max_auto_refund_limit.toLocaleString('en-IN')} auto-refund limit or reporting damaged items automatically appear here for supervisor authorization.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCases.map((c) => {
                const matchedOrder = orders.find((o) => o.order_id === c.order_id);
                const isActionable = c.status === 'Awaiting Review' || c.status === 'Info Requested';

                let statusBadge = 'bg-slate-800 text-slate-300 border-slate-700';
                if (c.status === 'Awaiting Review') statusBadge = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
                else if (c.status === 'Info Requested') statusBadge = 'bg-blue-500/15 text-blue-300 border-blue-500/30';
                else if (c.status === 'Approved') statusBadge = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
                else if (c.status === 'Declined') statusBadge = 'bg-rose-500/15 text-rose-300 border-rose-500/30';

                return (
                  <div
                    key={c.case_id}
                    className={`bg-slate-900/95 border rounded-3xl p-5 sm:p-6 shadow-md transition-all ${
                      c.status === 'Awaiting Review'
                        ? 'border-amber-500/30 hover:border-amber-500/50'
                        : c.status === 'Info Requested'
                        ? 'border-blue-500/30 hover:border-blue-500/50'
                        : 'border-slate-800/90'
                    }`}
                  >
                    {/* Header: Case ID, Order ID, Customer, Status, Timestamp */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3.5 border-b border-slate-800/80">
                      <div className="flex items-center space-x-2.5">
                        <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-slate-950 text-white border border-slate-700 shadow-inner">
                          Case #{c.case_id}
                        </span>
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 border border-slate-700">
                          {c.order_id}
                        </span>
                        <span className="text-xs text-slate-300 flex items-center space-x-1.5 font-medium">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          <span>{c.customer_name}</span>
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusBadge}`}>
                          {c.status}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">{c.created_at}</span>
                      </div>
                    </div>

                    {/* Order Details Preview */}
                    {matchedOrder && (
                      <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950/70 p-3 rounded-2xl text-xs border border-slate-800/80">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Purchased Item</span>
                          <span className="text-slate-200 font-medium truncate block mt-0.5">
                            {matchedOrder.item_name}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Order Total</span>
                          <span className="text-emerald-400 font-bold text-sm block mt-0.5">
                            ₹{matchedOrder.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Shipping Status</span>
                          <span className="text-slate-200 block mt-0.5 font-medium">{matchedOrder.shipping_status}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold block">Refund State</span>
                          <span className={`font-semibold block mt-0.5 ${
                            matchedOrder.refund_status === 'Refunded' ? 'text-blue-400' : 'text-slate-400'
                          }`}>
                            {matchedOrder.refund_status}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Policy Rule & Recommended Action Box */}
                    <div className="mt-3.5 space-y-2.5 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800/80">
                          <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
                            Triggering Policy Rule
                          </span>
                          <span className="text-amber-400 font-mono font-semibold block">
                            {c.policy_rule || 'RULE_ESCALATION'}
                          </span>
                        </div>

                        <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800/80">
                          <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
                            Support Pilot Recommendation
                          </span>
                          <span className="text-emerald-400 font-semibold block">
                            {c.recommended_action || 'Review and take supervisor action'}
                          </span>
                        </div>
                      </div>

                      {/* Escalation Summary */}
                      <div className="bg-slate-950/40 p-3 rounded-2xl border border-slate-800/60">
                        <span className="font-bold text-slate-300 block mb-0.5">Escalation Summary:</span>
                        <span className="text-slate-200 leading-relaxed">{c.summary}</span>
                      </div>

                      {/* Customer Inquiry Message */}
                      <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
                        <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
                          Customer Inquiry Message:
                        </span>
                        <span className="text-slate-300 italic font-sans leading-relaxed block">"{c.customer_message}"</span>
                      </div>

                      {/* Supervisor Notes History */}
                      {c.supervisor_notes && (
                        <div className="bg-indigo-950/20 border border-indigo-900/40 p-3 rounded-2xl text-indigo-200">
                          <span className="font-bold block text-[11px] text-indigo-300 mb-1">
                            Supervisor Notes History:
                          </span>
                          <div className="whitespace-pre-wrap font-sans text-xs">{c.supervisor_notes}</div>
                        </div>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5">
                      <div className="text-[11px] text-slate-500 flex items-center space-x-1.5">
                        <Lock className="w-3.5 h-3.5 text-slate-600" />
                        <span>Verified supervisor authentication required</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {isActionable ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenDecisionModal(c, 'Approve')}
                              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 active:scale-95"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenDecisionModal(c, 'Decline')}
                              className="px-3.5 py-2 rounded-xl bg-rose-600/15 hover:bg-rose-600/25 text-rose-300 border border-rose-500/30 text-xs font-semibold transition flex items-center space-x-1.5 active:scale-95"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Decline</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenDecisionModal(c, 'Info Requested')}
                              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition flex items-center space-x-1.5 active:scale-95"
                            >
                              <MessageCircleQuestion className="w-3.5 h-3.5 text-blue-400" />
                              <span>Request Info</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenDecisionModal(c, 'Reopen')}
                            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-semibold transition flex items-center space-x-1.5 active:scale-95"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reopen Case</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 1 Col: Configurable Seller Policy Panel & Summary Cards */}
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Sliders className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">Seller Policy Controls</h2>
            </div>

            <form
              onSubmit={handleSavePolicy}
              className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-5 space-y-4 text-xs shadow-lg"
            >
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Enforced in store policy logic. Changing these thresholds dynamically re-evaluates auto-refund eligibility for all customer chat queries.
              </p>

              {/* Threshold 1: Max Auto-Refund Limit */}
              <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-slate-200">Max Auto-Refund Limit</label>
                  <span className="font-mono text-emerald-400 font-extrabold text-sm bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    ₹{refundLimitInput.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <input
                  type="range"
                  min="1000"
                  max="20000"
                  step="250"
                  value={refundLimitInput}
                  onChange={(e) => setRefundLimitInput(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <span className="text-[10.5px] text-slate-400 block">
                  Refunds above this threshold automatically escalate to supervisor review.
                </span>
              </div>

              {/* Threshold 2: Return Window Days */}
              <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-slate-200">Return Window</label>
                  <span className="font-mono text-slate-200 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {returnWindowInput} days
                  </span>
                </div>
                <input
                  type="number"
                  min="7"
                  max="90"
                  value={returnWindowInput}
                  onChange={(e) => setReturnWindowInput(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10.5px] text-slate-400 block">
                  Requests past this delivery duration require supervisor approval.
                </span>
              </div>

              {/* Threshold 3: Escalate Damaged Claims */}
              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <label className="font-bold text-slate-200 block">Escalate Damaged Claims</label>
                  <span className="text-[10.5px] text-slate-400 block mt-0.5">
                    Always require human review for damaged items
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={escalateDamagedInput}
                  onChange={(e) => setEscalateDamagedInput(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl transition shadow-md shadow-emerald-600/20 text-xs active:scale-95"
                >
                  Save Policy Settings
                </button>
                {policySavedFeedback && (
                  <div className="mt-2 text-center text-emerald-400 font-semibold text-xs flex items-center justify-center space-x-1.5 animate-fadeIn">
                    <Check className="w-3.5 h-3.5" />
                    <span>Policy settings updated successfully!</span>
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* Separate Returns vs Refunds Summary Cards */}
          <div className="space-y-3.5">
            {/* Returns Created */}
            <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-5 text-xs space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200 flex items-center space-x-2">
                  <RotateCcw className="w-4 h-4 text-teal-400" />
                  <span>Return Requests ({returns.length})</span>
                </span>
                <span className="text-[10px] text-teal-400 font-semibold bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                  Prepaid Labels
                </span>
              </div>
              {returns.length === 0 ? (
                <span className="text-slate-500 italic block py-2">No return requests submitted yet.</span>
              ) : (
                <ul className="space-y-2 max-h-36 overflow-y-auto">
                  {returns.map((r) => (
                    <li
                      key={r.return_id}
                      className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px]"
                    >
                      <div>
                        <span className="font-mono text-teal-400 font-bold block">{r.return_id}</span>
                        <span className="text-slate-400">{r.order_id}</span>
                      </div>
                      <span className="text-slate-300 font-mono text-[10px] bg-slate-900 px-2 py-1 rounded border border-slate-800">{r.tracking_number}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Refunds Processed */}
            <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-5 text-xs space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200 flex items-center space-x-2">
                  <IndianRupee className="w-4 h-4 text-emerald-400" />
                  <span>Refunds Processed ({refunds.length})</span>
                </span>
                <span className="text-[11px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  ₹{refunds.reduce((s, r) => s + r.amount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {refunds.length === 0 ? (
                <span className="text-slate-500 italic block py-2">No refunds processed yet.</span>
              ) : (
                <ul className="space-y-2 max-h-36 overflow-y-auto">
                  {refunds.map((ref) => (
                    <li
                      key={ref.refund_id}
                      className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px]"
                    >
                      <div>
                        <span className="font-mono text-emerald-400 font-bold block">{ref.refund_id}</span>
                        <span className="text-slate-400">{ref.order_id}</span>
                        <span className="text-[10px] text-slate-500 block">{ref.authorized_by}</span>
                      </div>
                      <span className="font-bold text-white text-xs">₹{ref.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action & Audit Trail Log Section */}
      <div className="bg-slate-900/95 border border-slate-800/90 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              <span>Action & Decision Audit Trail</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Every order lookup, policy check, automated mock refund, return label, and supervisor resolution is logged with timestamps.
            </p>
          </div>

          {/* Filter & Search */}
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search audit trail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-950 border border-slate-700/80 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-44 sm:w-56"
              />
            </div>
            <select
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Actions</option>
              <option value="LOOKUP">LOOKUP</option>
              <option value="POLICY_CHECK">POLICY_CHECK</option>
              <option value="AUTO_REFUND">AUTO_REFUND</option>
              <option value="CREATE_RETURN">CREATE_RETURN</option>
              <option value="ESCALATION">ESCALATION</option>
              <option value="SUPERVISOR_ACTION">SUPERVISOR_ACTION</option>
            </select>
          </div>
        </div>

        {/* Audit Trail Table */}
        <div className="overflow-x-auto border border-slate-800/90 rounded-2xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800 text-[11px]">
              <tr>
                <th className="py-3 px-3.5">Timestamp</th>
                <th className="py-3 px-3.5">Action Type</th>
                <th className="py-3 px-3.5">Order ID</th>
                <th className="py-3 px-3.5">Tool Name</th>
                <th className="py-3 px-3.5">Action Details</th>
                <th className="py-3 px-3.5">Result Payload</th>
                <th className="py-3 px-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredLogs.map((log) => {
                let badgeClass = 'bg-slate-800 text-slate-300 border-slate-700';
                if (log.status === 'SUCCESS') badgeClass = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
                else if (log.status === 'ESCALATED') badgeClass = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
                else if (log.status === 'BLOCKED') badgeClass = 'bg-rose-500/15 text-rose-300 border-rose-500/30';
                else if (log.status === 'PENDING_REVIEW') badgeClass = 'bg-blue-500/15 text-blue-300 border-blue-500/30';

                return (
                  <tr key={log.log_id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3.5 text-slate-400 whitespace-nowrap">{log.timestamp}</td>
                    <td className="py-2.5 px-3.5 text-indigo-300 font-semibold">{log.action_type}</td>
                    <td className="py-2.5 px-3.5 text-amber-300">{log.order_id || '—'}</td>
                    <td className="py-2.5 px-3.5 text-slate-300 text-[11px]">{log.tool_name || '—'}</td>
                    <td className="py-2.5 px-3.5 text-slate-200 font-sans max-w-xs truncate" title={log.details}>
                      {log.details}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-300 font-sans max-w-sm truncate" title={log.result}>
                      {log.result}
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supervisor Decision Modal */}
      {selectedCase && decisionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Supervisor Action: {decisionType}</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedCase(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-2 bg-slate-950 p-3.5 rounded-2xl border border-slate-800 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Case ID:</span>
                <span className="text-white font-bold">#{selectedCase.case_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Order ID:</span>
                <span className="text-amber-300 font-bold">{selectedCase.order_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Policy Rule:</span>
                <span className="text-amber-400">{selectedCase.policy_rule}</span>
              </div>
              <div className="pt-1 border-t border-slate-900">
                <span className="text-slate-500 font-sans block mb-0.5">Issue Summary:</span>
                <span className="text-slate-300 font-sans">{selectedCase.summary}</span>
              </div>
            </div>

            {decisionFeedback && (
              <div className={`p-3 rounded-2xl text-xs font-semibold ${
                decisionFeedback.isError
                  ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                  : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
              }`}>
                {decisionFeedback.message}
              </div>
            )}

            <form onSubmit={handleConfirmDecision} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Supervisor Notes & Customer Notification:
                </label>
                <textarea
                  rows={3}
                  value={supervisorNote}
                  onChange={(e) => setSupervisorNote(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCase(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition shadow-sm active:scale-95 ${
                    decisionType === 'Approve'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/25'
                      : decisionType === 'Decline'
                      ? 'bg-rose-600 hover:bg-rose-500'
                      : decisionType === 'Reopen'
                      ? 'bg-amber-600 hover:bg-amber-500'
                      : 'bg-indigo-600 hover:bg-indigo-500'
                  }`}
                >
                  Confirm {decisionType}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
