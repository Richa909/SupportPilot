/**
 * App.tsx - Support Pilot: AI Customer Support Agent & Retailer Supervisor Dashboard
 * Hack4Hack Prototype for Small Online Retailer
 */

import React, { useState } from 'react';
import { useStore } from './utils/useStore';
import { Navbar } from './components/Navbar';
import { CustomerChatView } from './components/CustomerChatView';
import { RetailerDashboardView } from './components/RetailerDashboardView';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('chat');

  const {
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
    refreshData,
  } = useStore();

  const pendingCasesCount = cases.filter((c) => c.status === 'Awaiting Review').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Navigation Bar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        pendingCasesCount={pendingCasesCount}
        engineMode={engineMode}
        onChangeEngineMode={setEngineMode}
        onResetData={resetAllData}
      />

      {/* Main View Router */}
      <main className="flex-1 pb-12">
        {currentTab === 'chat' && (
          <CustomerChatView
            messages={chatMessages}
            onSendMessage={handleSendMessage}
            onConfirmResolved={handleConfirmResolved}
            sampleOrders={orders}
            config={config}
            onNavigateToDashboard={() => setCurrentTab('dashboard')}
            isLoading={isLoading}
          />
        )}

        {currentTab === 'dashboard' && (
          <RetailerDashboardView
            orders={orders}
            cases={cases}
            returns={returns}
            refunds={refunds}
            actionLogs={actionLogs}
            config={config}
            onChangeConfig={setConfig}
            metrics={metrics}
            onSupervisorDecision={handleSupervisorDecision}
            onReopenCase={handleReopenCase}
            onNavigateToChat={() => setCurrentTab('chat')}
            onRefreshData={refreshData}
          />
        )}
      </main>

      {/* Persistent Status Bar */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-3.5 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center space-x-2">
            <span className={`w-2 h-2 rounded-full ${isBackendConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
            <span>
              System: <strong className="text-slate-200">{isBackendConnected ? 'Online & Synchronized' : 'Offline Mirror Active'}</strong>
            </span>
            <span>•</span>
            <span>
              Engine: <strong className="text-slate-200">{engineMode === 'demo' ? 'Deterministic Rule Engine' : 'Gemini 3.8 Flash'}</strong>
            </span>
          </div>
          <div className="flex items-center space-x-4 text-[11px] text-slate-400">
            <span>Policy: &le;₹{config.max_auto_refund_limit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} auto-refund threshold</span>
            <span>•</span>
            <span>{config.return_window_days}-day return window</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
