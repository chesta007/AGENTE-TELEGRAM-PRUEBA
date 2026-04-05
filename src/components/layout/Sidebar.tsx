import { LayoutDashboard, FileText, MessageSquare, Users, Settings } from 'lucide-react';

export function Sidebar({ activeTab, setActiveTab, darkMode }: { activeTab: string, setActiveTab: (tab: string) => void, darkMode: boolean }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'documents', label: 'Documentos', icon: FileText },
    { id: 'chats', label: 'Chats', icon: MessageSquare },
    { id: 'crm', label: 'CRM', icon: Users },
    { id: 'context', label: 'Contexto', icon: Settings },
    { id: 'billing', label: 'Mi Consumo', icon: MessageSquare },
  ];

  return (
    <aside className={`w-72 p-6 flex flex-col transition-all duration-300 ${darkMode ? 'bg-[#0F172A] border-r border-white/10' : 'bg-[#0047FF] text-white shadow-2xl shadow-blue-500/20'}`}>
      <div className="mb-10 px-2">
        <h1 className="text-2xl font-black tracking-tight mb-1 flex items-center gap-2">
           <span className={`${darkMode ? 'text-[#0047FF]' : 'text-white'}`}>Lemovil Bot</span>
           {!darkMode && <span className="p-1 px-2 bg-white text-[#0047FF] text-[10px] rounded-md font-bold uppercase">Pro</span>}
        </h1>
        <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-blue-100'}`}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Lemovil Bot Online
        </div>
      </div>
      
      <nav className="space-y-1.5 flex-1">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex items-center w-full gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all duration-200 ${
              activeTab === item.id 
                ? (darkMode ? 'bg-[#0047FF] text-white shadow-lg' : 'bg-white text-[#0047FF] shadow-lg') 
                : (darkMode ? 'text-slate-400 hover:bg-white/5 hover:text-white' : 'text-blue-100 hover:bg-white/10 hover:text-white')
            }`}
          >
            <item.icon size={20} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className={`mt-auto pt-6 border-t text-[10px] text-center uppercase tracking-widest font-black ${darkMode ? 'border-white/5 text-slate-600' : 'border-white/10 text-blue-200'}`}>
        Command Center v1.0
      </div>
    </aside>
  );
}
