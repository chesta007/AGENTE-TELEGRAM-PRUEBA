import { FileText, MessageSquare, Users, TrendingUp } from 'lucide-react';

export function Dashboard() {
  const cards = [
    { title: 'Total Documentos', value: '12', icon: FileText, trend: '+2' },
    { title: 'Chats hoy', value: '45', icon: MessageSquare, trend: '+12%' },
    { title: 'Contactos CRM', value: '128', icon: Users, trend: '+5' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map(card => (
          <div key={card.title} className="bg-[#111111] p-6 rounded-xl border border-zinc-800 hover:border-indigo-500/50 transition-all">
            <div className="flex justify-between items-start mb-4">
              <card.icon className="text-indigo-500" size={24} />
              <span className="flex items-center text-emerald-500 text-sm font-medium">
                <TrendingUp size={14} className="mr-1" /> {card.trend}
              </span>
            </div>
            <h3 className="text-zinc-400 text-sm">{card.title}</h3>
            <p className="text-4xl font-bold mt-1">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
