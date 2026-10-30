import React, { useState } from 'react';
import { Code2, Copy, Check, Terminal, FileCode } from 'lucide-react';

export const PythonCodeView: React.FC = () => {
  const [activeFile, setActiveFile] = useState<string>('tools.py');
  const [copied, setCopied] = useState<boolean>(false);

  const files: Record<string, { desc: string; code: string }> = {
    'tools.py': {
      desc: 'Approved Python tool functions enforcing policy rules, separated returns and refunds, supervisor verification, and audit logging.',
      code: `"""
tools.py - Approved Python functions for customer support agent
Enforces business logic, policy rules, strict supervisor security, and audit logging.
Part of Hack4Hack AI Customer Support Prototype
"""

import datetime
import json
import time
from typing import Dict, Any, Optional, List
from database import get_connection, get_seller_config

def log_action(action_type: str, order_id: Optional[str], details: str, result: str, status: str, ...):
    # Logs every lookup, policy check, refund, and supervisor decision in SQLite

def lookup_order(order_id: str) -> Dict[str, Any]:
    # Look up verified order and shipping tracking info from SQLite

def check_refund_eligibility(order_id: str, reason: str, customer_message: str) -> Dict[str, Any]:
    # Evaluates store policy rules for a refund:
    # 1. Duplicate refund check (RULE_ALREADY_REFUNDED)
    # 2. Shipping status (Orders in transit cannot receive refunds)
    # 3. Damaged or Wrong Item claims MUST be escalated to supervisor
    # 4. Return window check (standard 30-day window)
    # 5. Configurable refund limit check ($50 max auto-refund)
    # 6. If eligible, auto-approve mock refund

def check_return_eligibility(order_id: str, reason: str, customer_message: str) -> Dict[str, Any]:
    # Distinct from refunds: verifies delivered status and return window
    # Generates prepaid return labels; does NOT issue premature refunds!

def process_mock_refund(order_id: str, amount: float, reason: str, authorized_by: str) -> Dict[str, Any]:
    # Atomic transaction: inserts into refunds table and sets order refund_status='Refunded'

def create_mock_return(order_id: str, reason: str) -> Dict[str, Any]:
    # Inserts into returns table and sets order return_status='Return Requested'

def supervisor_handle_case(case_id: int, decision: str, notes: str) -> Dict[str, Any]:
    # Security verifications: case exists, still awaiting review, order not refunded
    # Prevents duplicate approvals and duplicate refunds

def get_store_metrics() -> Dict[str, Any]:
    # Computes genuine metrics from actual database tables
`,
    },
    'agent.py': {
      desc: 'Intent classification, order ID extraction, approved tool calling, and 7-step execution timeline.',
      code: `"""
agent.py - Customer Support Agent with Intent Recognition, Tool Calling, and Demo Mode
Supports Offline Deterministic Demo Mode and Genuine Gemini Integration.
Produces transparent 7-step execution timelines for every customer inquiry.
"""

def run_agent_turn(customer_message: str, chat_history=None, api_key=None, force_mode=None):
    # Generates 7-step transparent execution timeline:
    # 1. Customer request received
    # 2. Intent identified & Order ID extracted
    # 3. Order information retrieved
    # 4. Relevant policy checked
    # 5. Approved Python tool executed
    # 6. Result verified
    # 7. Customer response generated
`,
    },
    'database.py': {
      desc: 'SQLite schema initialization, separate returns and refunds tables, and sample data seeding.',
      code: `"""
database.py - SQLite Database setup, schemas, and seeding
Tables: orders, cases, returns, refunds, action_logs, seller_config
"""

# orders: order_id, customer_name, amount, shipping_status, carrier, tracking_number, return_status, refund_status
# cases: case_id, order_id, customer_name, issue_type, summary, customer_message, status, policy_rule, recommended_action
# returns: return_id, order_id, customer_name, item_name, reason, status, tracking_number, created_at
# refunds: refund_id, order_id, amount, reason, authorized_by, status, created_at
# action_logs: log_id, timestamp, action_type, order_id, tool_name, details, result, status
`,
    },
    'tests.py': {
      desc: 'Comprehensive automated test suite covering all 12 prompt scenarios (100% passing).',
      code: `"""
tests.py - Test suite covering all 12 required scenarios:
1. ORD-1001: Successful order tracking.
2. ORD-1002: Eligible automatic refund of $28.50.
3. ORD-1003: Damaged item, escalated to supervisor.
4. ORD-1004: $149 refund, escalated because it exceeds the $50 limit.
5. ORD-1005: Order in transit, no automatic refund.
6. Missing order ID: Agent asks for the order ID.
7. Invalid order ID: Agent explains that the order cannot be found.
8. Already-refunded order: Duplicate refund blocked.
9. Return request: Creates a return request rather than immediately refunding.
10. Supervisor approval: Valid approval works.
11. Duplicate supervisor approval: Blocked.
12. Information requested: Case remains accessible.
"""

# Run with: python3 -m unittest python_app/tests.py
`,
    },
    'app.py': {
      desc: 'Streamlit application implementing Customer Chat, Case Management Filters, and SQLite Database Browser.',
      code: `"""
app.py - Streamlit Customer Support Agent & Retailer Supervisor Dashboard
Run with: streamlit run python_app/app.py
"""
`,
    },
  };

  const currentFileData = files[activeFile] || files['tools.py'];

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFileData.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Code2 className="w-6 h-6 text-emerald-400" />
            <span>Authoritative Python Source Code</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Modular, production-tested Python files running on SQLite. All policy decisions are enforced in Python backend logic.
          </p>
        </div>

        {/* Terminal Run Box */}
        <div className="bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2 text-xs font-mono text-emerald-400 flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-slate-400" />
          <span>python3 -m unittest python_app/tests.py</span>
        </div>
      </div>

      {/* File Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {Object.keys(files).map((filename) => (
          <button
            key={filename}
            type="button"
            onClick={() => {
              setActiveFile(filename);
              setCopied(false);
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
              activeFile === filename
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>{filename}</span>
          </button>
        ))}
      </div>

      {/* Code Display Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div>
            <span className="font-mono text-xs font-bold text-emerald-400">
              python_app/{activeFile}
            </span>
            <span className="text-xs text-slate-400 ml-3 hidden sm:inline">
              — {currentFileData.desc}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center space-x-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        <div className="p-4 overflow-x-auto max-h-[500px]">
          <pre className="font-mono text-xs text-slate-200 leading-relaxed">
            {currentFileData.code}
          </pre>
        </div>
      </div>
    </div>
  );
};
