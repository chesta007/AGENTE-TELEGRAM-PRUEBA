/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './components/dashboard/Dashboard';
import { Documents } from './components/documents/Documents';
import { Chats } from './components/chats/Chats';
import { CRM } from './components/crm/CRM';
import { AgentContext } from './components/agent/AgentContext';
import { Moon, Sun } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('iris-theme');
    return saved === 'dark';
  });

  useEffect(() => {
    localStorage.setItem('iris-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard darkMode={darkMode} />;
      case 'documents': return <Documents darkMode={darkMode} />;
      case 'chats': return <Chats darkMode={darkMode} />;
      case 'crm': return <CRM darkMode={darkMode} />;
      case 'context': return <AgentContext darkMode={darkMode} />;
      default: return <Dashboard darkMode={darkMode} />;
    }
  };

  return (
    <div className={`flex h-screen font-['Inter',_sans-serif] transition-colors duration-300 ${darkMode ? 'bg-black text-white' : 'bg-[#F8FAFC] text-slate-900'}`}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} darkMode={darkMode} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className={`h-16 flex items-center justify-end px-8 border-b transition-colors duration-300 ${darkMode ? 'bg-black border-white/10' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-4">
            <span className={`text-xs font-bold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Iris AI Command Center
            </span>
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-full transition-all ${darkMode ? 'bg-zinc-800 text-yellow-400' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
