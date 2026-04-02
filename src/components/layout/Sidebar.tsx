import { LayoutDashboard, FileText, MessageSquare, Users, Settings } from 'lucide-react';

export function Sidebar({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'documents', label: 'Documentos', icon: FileText },
    { id: 'chats', label: 'Chats', icon: MessageSquare },
    { id: 'crm', label: 'CRM', icon: Users },
    { id: 'context', label: 'Contexto', icon: Settings },
  ];

  return (
    <aside className="w-72 bg-[#001D4D] text-white p-6 flex flex-col">
      <div className="mb-10 px-2">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Iris <span className="text-[#0047FF]">AI</span></h1>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Iris Online
        </div>
      </div>
      
      <nav className="space-y-1 flex-1">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex items-center w-full gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
              activeTab === item.id 
                ? 'bg-[#0047FF] text-white shadow-lg shadow-blue-900/50' 
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <item.icon size={20} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mt-auto pt-6 border-t border-white/10 text-[10px] text-slate-500 text-center uppercase tracking-widest font-bold">
        Command Center v1.0
      </div>
    </aside>
  );
}
