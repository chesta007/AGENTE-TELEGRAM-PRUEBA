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
    <aside className="w-64 bg-[#111111] border-r border-zinc-800 p-4">
      <h1 className="text-xl font-bold mb-8 px-2 text-indigo-500">IA Admin</h1>
      <nav className="space-y-2">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex items-center w-full gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
              activeTab === item.id 
                ? 'bg-indigo-500/10 text-indigo-500' 
                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100'
            }`}
          >
            <item.icon size={20} />
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
