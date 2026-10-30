import React, { useState } from 'react';
import { Database, Package, ShieldAlert, FileText, Sliders, RotateCcw, DollarSign } from 'lucide-react';
import { Order, Case, ActionLog, SellerConfig, ReturnRecord, RefundRecord } from '../types';

interface DatabaseViewProps {
  orders: Order[];
  cases: Case[];
  returns?: ReturnRecord[];
  refunds?: RefundRecord[];
  actionLogs: ActionLog[];
  config: SellerConfig;
}

export const DatabaseView: React.FC<DatabaseViewProps> = ({
  orders,
  cases,
  returns = [],
  refunds = [],
  actionLogs,
  config,
}) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'cases' | 'returns' | 'refunds' | 'logs' | 'config'>('orders');

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Database className="w-6 h-6 text-emerald-400" />
            <span>SQLite Store Database (support_store.db)</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Authoritative relational storage. The AI agent executes strictly whitelisted Python policy functions to query and modify these tables.
          </p>
        </div>
      </div>

      {/* Database Table Tabs */}
      <div className="flex space-x-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
            activeTab === 'orders'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>orders ({orders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cases')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
            activeTab === 'cases'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>cases ({cases.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('returns')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
            activeTab === 'returns'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>returns ({returns.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('refunds')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
            activeTab === 'refunds'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>refunds ({refunds.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
            activeTab === 'logs'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>action_logs ({actionLogs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('config')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
            activeTab === 'config'
              ? 'bg-slate-700 text-white shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>seller_config (3 rules)</span>
        </button>
      </div>

      {/* Orders Table */}
      {activeTab === 'orders' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              TABLE: orders
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              SCHEMA: order_id, customer, item, amount, status, carrier, tracking, return_status, refund_status
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Order ID</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Item Name</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Shipping Status</th>
                  <th className="py-2.5 px-3">Carrier / Tracking</th>
                  <th className="py-2.5 px-3">Return State</th>
                  <th className="py-2.5 px-3">Refund State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                {orders.map((order) => (
                  <tr key={order.order_id} className="hover:bg-slate-800/50 transition">
                    <td className="py-2.5 px-3 text-emerald-400 font-bold">{order.order_id}</td>
                    <td className="py-2.5 px-3">{order.customer_name}</td>
                    <td className="py-2.5 px-3 max-w-xs truncate text-white">{order.item_name}</td>
                    <td className="py-2.5 px-3 text-amber-300 font-bold">
                      ${order.amount.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          order.shipping_status === 'Delivered'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {order.shipping_status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {order.carrier} ({order.tracking_number})
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          order.return_status === 'Return Requested'
                            ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                            : 'text-slate-500'
                        }`}
                      >
                        {order.return_status || 'None'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          order.refund_status === 'Refunded'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : order.refund_status === 'Declined'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'text-slate-500'
                        }`}
                      >
                        {order.refund_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cases Table */}
      {activeTab === 'cases' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              TABLE: cases (Supervisor Review Queue)
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              SCHEMA: case_id, order_id, issue_type, policy_rule, recommended_action, status, notes
            </span>
          </div>

          {cases.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No cases created yet. Trigger an escalation in the customer chat to populate this table.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Case ID</th>
                    <th className="py-2.5 px-3">Order ID</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Policy Rule</th>
                    <th className="py-2.5 px-3">Summary</th>
                    <th className="py-2.5 px-3">Recommended Action</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Supervisor Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300">
                  {cases.map((c) => (
                    <tr key={c.case_id} className="hover:bg-slate-800/50 transition">
                      <td className="py-2.5 px-3 text-amber-300 font-bold">#{c.case_id}</td>
                      <td className="py-2.5 px-3 text-emerald-400">{c.order_id}</td>
                      <td className="py-2.5 px-3">{c.customer_name}</td>
                      <td className="py-2.5 px-3 text-indigo-300">{c.policy_rule}</td>
                      <td className="py-2.5 px-3 max-w-xs truncate text-white" title={c.summary}>
                        {c.summary}
                      </td>
                      <td className="py-2.5 px-3 max-w-xs truncate text-slate-300" title={c.recommended_action}>
                        {c.recommended_action}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.status === 'Approved'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : c.status === 'Declined'
                              ? 'bg-rose-500/20 text-rose-300'
                              : c.status === 'Info Requested'
                              ? 'bg-blue-500/20 text-blue-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 max-w-xs truncate">
                        {c.supervisor_notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Returns Table */}
      {activeTab === 'returns' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              TABLE: returns (Prepaid Return Label Requests)
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              SCHEMA: return_id (PK), order_id, customer, item, tracking_number, status, created_at
            </span>
          </div>

          {returns.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No return requests recorded yet. Return requests create separate return records without premature refunds.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Return ID</th>
                    <th className="py-2.5 px-3">Order ID</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Item Name</th>
                    <th className="py-2.5 px-3">Prepaid Return Label</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300">
                  {returns.map((r) => (
                    <tr key={r.return_id} className="hover:bg-slate-800/50 transition">
                      <td className="py-2.5 px-3 text-teal-400 font-bold">{r.return_id}</td>
                      <td className="py-2.5 px-3 text-amber-300">{r.order_id}</td>
                      <td className="py-2.5 px-3">{r.customer_name}</td>
                      <td className="py-2.5 px-3 text-white">{r.item_name}</td>
                      <td className="py-2.5 px-3 text-slate-300">{r.tracking_number}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">{r.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Refunds Table */}
      {activeTab === 'refunds' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              TABLE: refunds (Completed Mock Refunds)
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              SCHEMA: refund_id (PK), order_id, amount, reason, authorized_by, status, created_at
            </span>
          </div>

          {refunds.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No refunds processed yet.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Refund ID</th>
                    <th className="py-2.5 px-3">Order ID</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Authorized By</th>
                    <th className="py-2.5 px-3">Reason</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300">
                  {refunds.map((ref) => (
                    <tr key={ref.refund_id} className="hover:bg-slate-800/50 transition">
                      <td className="py-2.5 px-3 text-blue-400 font-bold">{ref.refund_id}</td>
                      <td className="py-2.5 px-3 text-amber-300">{ref.order_id}</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-bold">${ref.amount.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-indigo-300 font-semibold">{ref.authorized_by}</td>
                      <td className="py-2.5 px-3 max-w-xs truncate text-slate-300" title={ref.reason}>{ref.reason}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {ref.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">{ref.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Action Logs Table */}
      {activeTab === 'logs' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              TABLE: action_logs (Audit Trail)
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              SCHEMA: log_id, timestamp, action_type, order_id, tool_name, details, result, status
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">ID</th>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Order ID</th>
                  <th className="py-2.5 px-3">Tool</th>
                  <th className="py-2.5 px-3">Details</th>
                  <th className="py-2.5 px-3">Result</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                {actionLogs.map((log) => (
                  <tr key={log.log_id} className="hover:bg-slate-800/50 transition">
                    <td className="py-2.5 px-3 text-slate-500">{log.log_id}</td>
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{log.timestamp}</td>
                    <td className="py-2.5 px-3 text-indigo-300 font-semibold">{log.action_type}</td>
                    <td className="py-2.5 px-3 text-amber-300">{log.order_id || '—'}</td>
                    <td className="py-2.5 px-3 text-slate-400 text-[10px]">{log.tool_name || '—'}</td>
                    <td className="py-2.5 px-3 max-w-xs truncate" title={log.details}>
                      {log.details}
                    </td>
                    <td className="py-2.5 px-3 max-w-sm truncate" title={log.result}>
                      {log.result}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Seller Config Table */}
      {activeTab === 'config' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              TABLE: seller_config
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              SCHEMA: config_key (PK), config_value (TEXT)
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-xl max-w-2xl">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">config_key</th>
                  <th className="py-2.5 px-3">config_value</th>
                  <th className="py-2.5 px-3">Policy Rule Enforcement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                <tr>
                  <td className="py-2.5 px-3 text-emerald-400 font-bold">max_auto_refund_limit</td>
                  <td className="py-2.5 px-3 font-bold text-white">
                    ${config.max_auto_refund_limit.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 font-sans">
                    Refunds above this amount escalate to human review (RULE_OVER_REFUND_LIMIT)
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-emerald-400 font-bold">return_window_days</td>
                  <td className="py-2.5 px-3 font-bold text-white">{config.return_window_days} days</td>
                  <td className="py-2.5 px-3 text-slate-400 font-sans">
                    Customer returns outside this delivery window require review (RULE_OUTSIDE_RETURN_WINDOW)
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-emerald-400 font-bold">escalate_damaged_items</td>
                  <td className="py-2.5 px-3 font-bold text-white">
                    {config.escalate_damaged_items ? '1 (true)' : '0 (false)'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 font-sans">
                    Always route damaged or defective claims to the supervisor (RULE_DAMAGED_OR_WRONG_ITEM)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
