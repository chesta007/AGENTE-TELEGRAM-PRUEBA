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
import { Moon, Sun, LayoutDashboard, Users, FileText, MessageSquare } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('iris-theme');
    return saved === 'dark';
  });

  useEffect(() => {
    localStorage.setItem('iris-theme', darkMode ? 'dark' : 'light');
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
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

  const navItems = [
    { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
    { id: 'crm', label: 'CRM', icon: Users },
    { id: 'chats', label: 'Chats', icon: MessageSquare },
    { id: 'documents', label: 'Docs', icon: FileText },
  ];

  return (
    <div className={`flex h-screen font-['Inter',_sans-serif] transition-colors duration-300 ${darkMode ? 'bg-black text-white' : 'bg-[#F8FAFC] text-slate-900'}`}>
      {/* Sidebar para Escritorio */}
      <div className="hidden md:flex">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} darkMode={darkMode} />
      </div>
      
      <div className="flex-1 flex flex-col overflow-hidden pb-16 md:pb-0">
        <header className={`h-16 flex items-center justify-between md:justify-end px-6 md:px-8 border-b transition-colors duration-300 z-10 ${darkMode ? 'bg-black/80 border-white/10 backdrop-blur-md' : 'bg-white/80 border-slate-100 backdrop-blur-md'}`}>
          <div className="md:hidden">
             <h1 className="text-xl font-black tracking-tight"><span className="text-[#0047FF]">Iris</span> AI</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <span className={`hidden sm:inline text-[10px] font-black uppercase tracking-[0.2em] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Command Center
            </span>
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className={`p-3 rounded-2xl transition-all ${darkMode ? 'bg-zinc-800 text-yellow-400' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              aria-label="Toggle Theme"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {renderContent()}
        </main>
      </div>

      {/* Navegación Inferior para Móviles */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 h-16 border-t px-4 flex items-center justify-around z-50 transition-colors duration-300 ${darkMode ? 'bg-black/90 border-white/10 backdrop-blur-lg' : 'bg-white/90 border-slate-200 backdrop-blur-lg'}`}>
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1 transition-all duration-200 ${
              activeTab === item.id 
                ? 'text-[#0047FF]' 
                : (darkMode ? 'text-slate-500' : 'text-slate-400')
            }`}
          >
            <item.icon size={22} strokeWidth={activeTab === item.id ? 2.5 : 2} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
