import React from 'react';
import {
  MessageSquare,
  LayoutDashboard,
  RotateCcw,
  Compass,
  Sparkles,
  Cpu,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  pendingCasesCount: number;
  engineMode: 'demo' | 'gemini';
  onChangeEngineMode: (mode: 'demo' | 'gemini') => void;
  onResetData: () => void;
  isBackendConnected?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  pendingCasesCount,
  engineMode,
  onChangeEngineMode,
  onResetData,
  isBackendConnected = true,
}) => {
  const tabs = [
    { id: 'chat', label: 'Customer Chat', icon: MessageSquare, badge: null },
    {
      id: 'dashboard',
      label: 'Retailer Dashboard',
      icon: LayoutDashboard,
      badge: pendingCasesCount > 0 ? `${pendingCasesCount} Review` : null,
      badgeColor: 'bg-amber-500/90 text-slate-950 font-bold',
    },
  ];

  return (
    <header className="bg-slate-950/90 backdrop-blur-md border-b border-slate-800/90 text-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand: Support Pilot */}
          <div className="flex items-center space-x-3.5 cursor-pointer" onClick={() => onSelectTab('chat')}>
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 flex items-center justify-center shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-400/30">
                <Compass className="w-6 h-6 text-slate-950 stroke-[2.3] transition-transform duration-300 hover:rotate-45" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-950 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                  Support Pilot
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-emerald-500/15 text-emerald-300 rounded-full border border-emerald-500/30">
                  AI Retail Agent
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:flex items-center space-x-1.5">
                <span>Autonomous Policy Enforcement & Supervisor Review</span>
                <span className="text-slate-600">•</span>
                <span className="text-emerald-400/90 font-medium">Policy Engine Active</span>
              </p>
            </div>
          </div>

          {/* Engine Mode Switcher & Actions */}
          <div className="flex items-center space-x-3">
            {/* Dual Engine Switcher */}
            <div className="flex items-center bg-slate-900 rounded-xl p-1 border border-slate-800 text-xs shadow-inner">
              <button
                type="button"
                onClick={() => onChangeEngineMode('demo')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center space-x-1.5 ${
                  engineMode === 'demo'
                    ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700/80'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Deterministic offline rule evaluation with zero API dependencies"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Demo Mode</span>
                <span className="sm:hidden">Demo</span>
              </button>

              <button
                type="button"
                onClick={() => onChangeEngineMode('gemini')}
                className={`px-3 py-1.5 rounded-lg font-medium flex items-center space-x-1.5 transition-all ${
                  engineMode === 'gemini'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm border border-indigo-500/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Google GenAI SDK (gemini-3.8-flash) function routing"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden sm:inline">Gemini 3.8 Flash</span>
                <span className="sm:hidden">Gemini</span>
              </button>
            </div>

            {/* Reset Data */}
            <button
              type="button"
              onClick={onResetData}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 transition shadow-sm active:scale-95"
              title="Reset mock orders, returns, and cases to default state"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden md:inline">Reset Demo Store</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1.5 overflow-x-auto py-2.5 scrollbar-none border-t border-slate-800/70 text-xs sm:text-sm">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-800/90 text-emerald-400 border border-slate-700/90 shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full ${
                      tab.badgeColor || 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
