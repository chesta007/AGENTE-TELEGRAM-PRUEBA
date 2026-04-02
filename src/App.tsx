/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './components/dashboard/Dashboard';
import { Documents } from './components/documents/Documents';
import { Chats } from './components/chats/Chats';
import { CRM } from './components/crm/CRM';
import { AgentContext } from './components/agent/AgentContext';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'documents': return <Documents />;
      case 'chats': return <Chats />;
      case 'crm': return <CRM />;
      case 'context': return <AgentContext />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-zinc-50">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 overflow-y-auto p-8">
        {renderContent()}
      </main>
    </div>
  );
}
