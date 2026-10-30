import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Package,
  DollarSign,
  ShieldCheck,
  RotateCcw,
  Check,
  ListOrdered,
  FileQuestion,
  CornerDownLeft,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { ChatMessage, Order, SellerConfig, ExecutionStep } from '../types';

interface CustomerChatViewProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onConfirmResolved: (messageId: string, resolved: boolean) => void;
  sampleOrders: Order[];
  config: SellerConfig;
  onNavigateToDashboard: () => void;
  isLoading?: boolean;
}

export const CustomerChatView: React.FC<CustomerChatViewProps> = ({
  messages,
  onSendMessage,
  onConfirmResolved,
  sampleOrders,
  config,
  onNavigateToDashboard,
  isLoading = false,
}) => {
  const [inputText, setInputText] = useState('');
  const [expandedTimelineIds, setExpandedTimelineIds] = useState<Record<string, boolean>>({});
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    if (messages.length > 1) {
      scrollToBottom();
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleScenarioClick = (prompt: string) => {
    if (isLoading) return;
    onSendMessage(prompt);
  };

  const toggleTimeline = (id: string) => {
    setExpandedTimelineIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Top Banner & Quick Testing Scenarios */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 relative z-10">
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
              <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center space-x-2">
                <span>Support Pilot Assistant</span>
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 font-medium">
                Auto-Refund Limit: <strong className="text-emerald-400">₹{config.max_auto_refund_limit.toFixed(2)}</strong>
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 font-medium hidden sm:inline-block">
                Return Window: <strong className="text-slate-200">{config.return_window_days} Days</strong>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Real-time customer conversational assistant grounded by strictly whitelisted Python policy tools. Every policy check, return label, and mock refund is executed with zero LLM hallucinations.
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateToDashboard}
            className="self-start md:self-auto text-xs font-semibold px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition flex items-center space-x-2 shadow-lg shadow-emerald-600/20 active:scale-95"
          >
            <span>Supervisor Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5 text-emerald-200" />
          </button>
        </div>

        {/* Categorized Test Scenarios */}
        <div className="space-y-2 relative z-10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>1-Click Policy Test Scenarios:</span>
            </span>
            <span className="text-[10px] text-slate-500">Click any pill to simulate customer inquiry</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
            {/* Group 1: Tracking */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-2.5 space-y-1.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                🚚 Order Tracking
              </span>
              <button
                type="button"
                onClick={() => handleScenarioClick('What is the delivery status of order ORD-IND-1001?')}
                className="w-full text-left bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 rounded-xl px-2.5 py-1.5 transition flex items-center justify-between group"
              >
                <div className="flex items-center space-x-1.5 truncate">
                  <Package className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="truncate">ORD-IND-1001 (Delivered)</span>
                </div>
                <span className="text-[10px] text-emerald-400 group-hover:translate-x-0.5 transition-transform">→</span>
              </button>

              <button
                type="button"
                onClick={() => handleScenarioClick('Where is my package for order ORD-IND-1005?')}
                className="w-full text-left bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 rounded-xl px-2.5 py-1.5 transition flex items-center justify-between group"
              >
                <div className="flex items-center space-x-1.5 truncate">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">ORD-IND-1005 (In Transit)</span>
                </div>
                <span className="text-[10px] text-amber-400 group-hover:translate-x-0.5 transition-transform">→</span>
              </button>
            </div>

            {/* Group 2: Refunds */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-2.5 space-y-1.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                💳 Refund Workflows
              </span>
              <button
                type="button"
                onClick={() => handleScenarioClick('I want a refund for ORD-IND-1002, changed my mind')}
                className="w-full text-left bg-emerald-950/40 hover:bg-emerald-950/70 text-emerald-300 border border-emerald-800/40 hover:border-emerald-700/60 rounded-xl px-2.5 py-1.5 transition flex items-center justify-between group"
              >
                <div className="flex items-center space-x-1.5 truncate">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">ORD-IND-1002 (≤₹4,150 Auto)</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold">₹2,365.50</span>
              </button>

              <button
                type="button"
                onClick={() => handleScenarioClick('Please refund my order ORD-IND-1004 (₹12,367 bag)')}
                className="w-full text-left bg-purple-950/40 hover:bg-purple-950/70 text-purple-300 border border-purple-800/40 hover:border-purple-700/60 rounded-xl px-2.5 py-1.5 transition flex items-center justify-between group"
              >
                <div className="flex items-center space-x-1.5 truncate">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="truncate">ORD-IND-1004 (&gt;₹4,150 Review)</span>
                </div>
                <span className="text-[10px] text-purple-400 font-bold">₹12,367</span>
              </button>
            </div>

            {/* Group 3: Returns & Claims */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-2.5 space-y-1.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                📦 Returns & Claims
              </span>
              <button
                type="button"
                onClick={() => handleScenarioClick('I want to return ORD-IND-1001, shirt too small')}
                className="w-full text-left bg-teal-950/40 hover:bg-teal-950/70 text-teal-300 border border-teal-800/40 hover:border-teal-700/60 rounded-xl px-2.5 py-1.5 transition flex items-center justify-between group"
              >
                <div className="flex items-center space-x-1.5 truncate">
                  <RotateCcw className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span className="truncate">ORD-IND-1001 (Return Label)</span>
                </div>
                <span className="text-[10px] text-teal-400">Prepaid</span>
              </button>

              <button
                type="button"
                onClick={() => handleScenarioClick('The mug in order ORD-IND-1003 arrived broken and damaged')}
                className="w-full text-left bg-amber-950/40 hover:bg-amber-950/70 text-amber-300 border border-amber-800/40 hover:border-amber-700/60 rounded-xl px-2.5 py-1.5 transition flex items-center justify-between group"
              >
                <div className="flex items-center space-x-1.5 truncate">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">ORD-IND-1003 (Damaged Item)</span>
                </div>
                <span className="text-[10px] text-amber-400">Escalate</span>
              </button>
            </div>

            {/* Group 4: Edge Cases */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-2.5 space-y-1.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                🔍 Edge Cases
              </span>
              <button
                type="button"
                onClick={() => handleScenarioClick('I need a refund for my item')}
                className="w-full text-left bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-xl px-2.5 py-1.5 transition flex items-center justify-between group"
              >
                <div className="flex items-center space-x-1.5 truncate">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">Missing Order ID</span>
                </div>
                <span className="text-[10px] text-slate-500">Prompt</span>
              </button>

              <button
                type="button"
                onClick={() => handleScenarioClick('Where is order ORD-IND-9999?')}
                className="w-full text-left bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-xl px-2.5 py-1.5 transition flex items-center justify-between group"
              >
                <div className="flex items-center space-x-1.5 truncate">
                  <FileQuestion className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="truncate">Non-Existent (ORD-IND-9999)</span>
                </div>
                <span className="text-[10px] text-rose-400">404</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Conversation Container */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-3xl flex flex-col shadow-2xl overflow-hidden min-h-[540px] max-h-[700px]">
        {/* Chat Thread */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {messages.map((msg) => {
            const isUser = msg.sender === 'customer';
            const isTimelineExpanded = expandedTimelineIds[msg.id] !== false; // Default expanded

            return (
              <div
                key={msg.id}
                className={`flex items-start space-x-3.5 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
              >
                {/* Avatar */}
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                    isUser
                      ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white'
                      : 'bg-slate-800/90 border border-slate-700/80 text-emerald-400 shadow-inner'
                  }`}
                >
                  {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>

                {/* Message Bubble Content */}
                <div className="max-w-[88%] sm:max-w-[80%] space-y-2.5">
                  <div
                    className={`rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm ${
                      isUser
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-none'
                        : 'bg-slate-800/95 text-slate-100 border border-slate-700/80 rounded-tl-none'
                    }`}
                  >
                    {/* Header Tags for Assistant */}
                    {!isUser && (
                      <div className="flex flex-wrap items-center gap-2 mb-2 pb-2 border-b border-slate-700/60 text-xs">
                        <span className="font-bold text-emerald-400 flex items-center space-x-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Support Pilot Agent</span>
                        </span>
                        {msg.extractedOrderId && (
                          <span className="bg-slate-950/80 text-amber-300 px-2 py-0.5 rounded-md font-mono text-[11px] border border-slate-800">
                            {msg.extractedOrderId}
                          </span>
                        )}
                        {msg.intent && (
                          <span className="bg-slate-950/80 text-slate-300 px-2 py-0.5 rounded-md text-[11px] capitalize border border-slate-800">
                            {msg.intent.replace(/_/g, ' ')}
                          </span>
                        )}
                        {msg.toolCalled && (
                          <span className="bg-indigo-950/90 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded-md text-[11px] font-mono flex items-center space-x-1">
                            <Wrench className="w-3 h-3" />
                            <span>{msg.toolCalled}()</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Message Body */}
                    <div className="whitespace-pre-wrap font-sans text-sm sm:text-[14.5px]">{msg.text}</div>

                    <div className="text-[10px] text-right mt-2 text-slate-400/80 font-mono">
                      {msg.timestamp}
                    </div>
                  </div>

                  {/* 7-Step Agent Execution Timeline */}
                  {!isUser && msg.timeline && msg.timeline.length > 0 && (
                    <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl overflow-hidden text-xs shadow-inner">
                      <button
                        type="button"
                        onClick={() => toggleTimeline(msg.id)}
                        className="w-full px-4 py-2.5 flex items-center justify-between text-slate-300 hover:text-white transition bg-slate-900/70 border-b border-slate-800/80"
                      >
                        <div className="flex items-center space-x-2">
                          <ListOrdered className="w-4 h-4 text-emerald-400" />
                          <span className="font-semibold text-slate-200">
                            7-Step Execution Timeline
                          </span>
                          <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
                            {msg.timeline.length} Steps Logged
                          </span>
                        </div>
                        {isTimelineExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </button>

                      {isTimelineExpanded && (
                        <div className="p-4 space-y-3 font-mono text-[11px]">
                          {msg.timeline.map((step, idx) => {
                            let badgeClass = 'bg-slate-800 text-slate-300 border-slate-700';
                            let dotClass = 'bg-slate-500';

                            if (step.status === 'success') {
                              badgeClass = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30';
                              dotClass = 'bg-emerald-400 shadow-sm shadow-emerald-400/50';
                            } else if (step.status === 'blocked') {
                              badgeClass = 'bg-rose-500/10 text-rose-300 border-rose-500/30';
                              dotClass = 'bg-rose-400 shadow-sm shadow-rose-400/50';
                            } else if (step.status === 'escalated') {
                              badgeClass = 'bg-amber-500/10 text-amber-300 border-amber-500/30';
                              dotClass = 'bg-amber-400 shadow-sm shadow-amber-400/50';
                            } else if (step.status === 'not_found') {
                              badgeClass = 'bg-rose-500/10 text-rose-300 border-rose-500/30';
                              dotClass = 'bg-rose-400 shadow-sm shadow-rose-400/50';
                            }

                            return (
                              <div
                                key={step.step}
                                className="relative flex items-start space-x-3 pb-2.5 border-b border-slate-900 last:border-0 last:pb-0"
                              >
                                {/* Step number pill */}
                                <div className="flex flex-col items-center shrink-0">
                                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] border ${badgeClass}`}>
                                    {step.step}
                                  </span>
                                  {idx < msg.timeline!.length - 1 && (
                                    <span className="w-px h-full bg-slate-800/80 my-1 block" />
                                  )}
                                </div>

                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center justify-between flex-wrap gap-1">
                                    <span className="font-semibold text-slate-200">
                                      {step.title}
                                    </span>
                                    {step.tool_name && (
                                      <span className="px-2 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 text-[10px] font-mono">
                                        {step.tool_name}()
                                      </span>
                                    )}
                                  </div>

                                  {step.policy_rule && (
                                    <div className="text-[10px] text-amber-400 font-semibold">
                                      Policy Rule: {step.policy_rule}
                                    </div>
                                  )}

                                  <div className="text-slate-400 text-[11px] font-sans leading-normal">
                                    {step.details || step.result}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          <div className="text-[10px] text-slate-500 italic pt-2 border-t border-slate-900 flex items-center justify-between">
                            <span>✓ Whitelisted execution strictly audited with policy compliance. Zero hallucinations permitted.</span>
                            <span className="font-mono text-emerald-400/90">Verified</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Flowchart Step: "Did this resolve your query?" */}
                  {!isUser && msg.resolvedPrompt && (
                    <div className="bg-slate-800/90 border border-emerald-500/30 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-md">
                      <div className="text-slate-200 flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Did this answer completely resolve your customer inquiry?</span>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onConfirmResolved(msg.id, true)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition shadow-sm active:scale-95 flex items-center space-x-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Yes, Resolved</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onConfirmResolved(msg.id, false)}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-300 font-semibold transition active:scale-95"
                        >
                          No, Need Help
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center space-x-3 text-xs text-slate-400 p-3 bg-slate-950/50 rounded-2xl border border-slate-800 w-fit">
              <div className="w-7 h-7 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 flex items-center justify-center animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Support Pilot is analyzing inquiry and executing Python policy tools...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSubmit} className="p-4 bg-slate-950 border-t border-slate-800/90 flex items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isLoading}
              placeholder="Ask Support Pilot (e.g. 'Track ORD-IND-1001', 'Refund ORD-IND-1002', 'Return ORD-IND-1001', 'ORD-IND-1003 is broken')..."
              className="w-full bg-slate-900 text-slate-100 placeholder-slate-500 text-sm rounded-2xl px-4 py-3.5 border border-slate-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition shadow-inner"
            />
            <span className="hidden sm:inline-block absolute right-3.5 top-3.5 text-[10px] font-mono text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
              Press ↵
            </span>
          </div>
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white p-3.5 rounded-2xl transition flex items-center justify-center shrink-0 shadow-lg shadow-emerald-600/25 active:scale-95"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Helper Footer Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-400">
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 flex items-start space-x-2.5">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-bold">
            ✓
          </div>
          <div>
            <strong className="text-slate-200 block mb-0.5">Whitelisted Python Execution</strong>
            Carrier tracking and database lookups run through audited Python tools with zero hallucinated data.
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 flex items-start space-x-2.5">
          <div className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
            📦
          </div>
          <div>
            <strong className="text-slate-200 block mb-0.5">Returns Separated From Refunds</strong>
            Return requests issue return labels without premature refunds. Claims &gt;₹{config.max_auto_refund_limit.toFixed(2)} escalate to supervisor.
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 flex items-start space-x-2.5">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            🛡️
          </div>
          <div>
            <strong className="text-slate-200 block mb-0.5">Supervisor Guardrails</strong>
            Human review queue with 1-click approvals, duplicate prevention, and full transaction safety.
          </div>
        </div>
      </div>
    </div>
  );
};
