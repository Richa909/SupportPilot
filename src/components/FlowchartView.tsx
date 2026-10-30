import React, { useState } from 'react';
import { GitFork, CheckCircle, ShieldAlert, ArrowRight, Eye, Layers } from 'lucide-react';

export const FlowchartView: React.FC = () => {
  const [selectedNode, setSelectedNode] = useState<string>('customer_message');

  const nodes = [
    {
      id: 'customer_message',
      title: '1. Customer Sends Message in Web Chat',
      category: 'Customer Chat',
      summary: 'Customer asks about order status, tracking, return, or refund.',
      implementation: 'Managed in src/components/CustomerChatView.tsx and python_app/app.py via st.chat_input.',
    },
    {
      id: 'ai_intent',
      title: '2. AI Identifies Intent & Needed Details',
      category: 'LLM Agent',
      summary: 'LLM extracts the request type and order ID (e.g. ORD-1001). If missing or unclear, requests follow-up.',
      implementation: 'Implemented in python_app/agent.py via extract_order_id() and detect_intent().',
    },
    {
      id: 'approved_tool',
      title: '3. AI Requests an Approved Tool Action',
      category: 'Security Whitelist',
      summary: 'The model has ZERO direct database access. It can ONLY invoke whitelisted Python tools.',
      implementation: 'Restricted to lookup_order() and check_policy_and_process_request() in python_app/tools.py.',
    },
    {
      id: 'policy_check',
      title: '4. Python Validates Request & Checks Seller Rules',
      category: 'Python Policy Engine',
      summary: 'Python—not the LLM—verifies delivery status, 30-day window, and max $50 auto-refund threshold.',
      implementation: 'Pure Python functions in python_app/tools.py and src/utils/policy.ts.',
    },
    {
      id: 'order_status_branch',
      title: '5A. Order Status Branch: Lookup in SQLite',
      category: 'Data Lookup',
      summary: 'Returns verified carrier and tracking code. The model explains status to customer without inventing dates.',
      implementation: 'tools.lookup_order(order_id) querying orders table and logging to action_logs.',
    },
    {
      id: 'auto_refund_branch',
      title: '5B. Auto-Refund Branch (&le; $50 & Delivered)',
      category: 'Automated Action',
      summary: 'Clear cases meeting store criteria are automatically refunded, recorded, and customer notified.',
      implementation: 'tools.process_mock_refund() updates SQLite order status to "Refunded" and logs refund ID.',
    },
    {
      id: 'escalate_branch',
      title: '5C. Escalation Branch (> $50, Damaged, or Outside Window)',
      category: 'Supervisor Review',
      summary: 'Claims requiring human judgment are blocked from automated refund and escalated to the dashboard.',
      implementation: 'tools.escalate_to_supervisor() creates case summary and sets status="Awaiting Review".',
    },
    {
      id: 'supervisor_decision',
      title: '6. Supervisor Reviews & Decides in Dashboard',
      category: 'Retailer Dashboard',
      summary: 'Supervisor reviews AI summary, and clicks Approve, Decline, or Request More Info.',
      implementation: 'Retailer Dashboard in python_app/app.py and src/components/RetailerDashboardView.tsx.',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
          <GitFork className="w-6 h-6 text-emerald-400" />
          <span>System Architecture & Workflow Alignment</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Detailed alignment with the project workflow diagram: AI-powered intent recognition grounded by strict, whitelisted Python policy enforcement and supervisor dashboard escalation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Interactive Node Breakdown */}
        <div className="lg:col-span-6 space-y-3">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>Interactive Workflow Steps:</span>
          </h2>

          <div className="space-y-2">
            {nodes.map((node) => {
              const isSelected = selectedNode === node.id;
              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(node.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-800 border-emerald-500 shadow-sm'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-white">{node.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-950 text-slate-400 border border-slate-800">
                      {node.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{node.summary}</p>
                  {isSelected && (
                    <div className="mt-2.5 pt-2 border-t border-slate-700/60 font-mono text-[11px] text-emerald-300">
                      <span className="text-slate-400 font-sans block text-[10px]">Code Implementation:</span>
                      {node.implementation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Flowchart Diagram Image from Workspace */}
        <div className="lg:col-span-6 space-y-3">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
            <Eye className="w-4 h-4 text-indigo-400" />
            <span>Original Workflow Flowchart:</span>
          </h2>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col items-center">
            <div className="overflow-auto max-h-[640px] rounded-xl border border-slate-800 bg-slate-950 p-2">
              <img
                src="/assets/aistudio/image_7e23894b.png"
                alt="Hack4Hack Customer Support Workflow Diagram"
                className="w-full h-auto object-contain rounded-lg shadow-md"
              />
            </div>
            <p className="text-xs text-slate-400 mt-3 text-center">
              Diagram provided for the Hack4Hack customer-support prototype: Customer chat, Python rules engine, SQLite storage, and Supervisor review.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
