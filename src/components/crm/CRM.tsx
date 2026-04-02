import React, { useState, useEffect } from 'react';
import { Search, Plus, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';

export function CRM() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', city: '', status: 'Nuevo' });

  const fetchContacts = async () => {
    setLoading(true);
    try {
      let query = supabase.from('contacts').select('*');
      
      if (filter !== 'Todos') {
        query = query.eq('status', filter);
      }
      
      if (searchQuery) {
        query = query.ilike('name', `%${searchQuery}%`);
      }
      
      const { data, error } = await query.order('id', { ascending: false });
      
      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [filter, searchQuery]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from('contacts')
        .insert([newContact])
        .select()
        .single();
        
      if (error) throw error;
      
      setContacts([data, ...contacts]);
      setIsAddOpen(false);
      setNewContact({ name: '', phone: '', city: '', status: 'Nuevo' });
    } catch (error) {
      console.error('Error adding contact:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">CRM</h2>
        <button 
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 bg-indigo-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-600 transition-all"
        >
          <Plus size={20} /> Agregar contacto
        </button>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {['Todos', 'Nuevo', 'En contacto', 'Cliente'].map(f => (
            <button 
              key={f} 
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm transition-colors ${filter === f ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
            >
              {f}
            </button>
          ))}
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nombre..." 
            value={searchQuery}
            onChange={handleSearch}
            className="bg-zinc-800 border-none rounded-lg pl-10 pr-4 py-2 w-64 focus:ring-2 focus:ring-indigo-500 outline-none text-zinc-100 placeholder:text-zinc-500"
          />
        </div>
      </div>

      <div className="bg-[#111111] rounded-xl border border-zinc-800 overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center text-zinc-500">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-zinc-800/50 text-zinc-400 text-sm">
              <tr>
                <th className="p-4">Nombre</th>
                <th className="p-4">Teléfono</th>
                <th className="p-4">Ciudad</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Última interacción</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500">No hay contactos encontrados</td>
                </tr>
              ) : (
                contacts.map(c => (
                  <tr key={c.id} onClick={() => setSelectedContact(c)} className="border-t border-zinc-800 hover:bg-zinc-800/50 cursor-pointer transition-all">
                    <td className="p-4 font-semibold">{c.name}</td>
                    <td className="p-4">{c.phone}</td>
                    <td className="p-4">{c.city}</td>
                    <td className="p-4"><span className="bg-zinc-800 px-2 py-1 rounded text-xs text-indigo-400">{c.status}</span></td>
                    <td className="p-4 text-zinc-400">{c.last_interaction ? new Date(c.last_interaction).toLocaleDateString() : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedContact} onOpenChange={() => setSelectedContact(null)}>
        <DialogContent className="bg-[#111111] border-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle>{selectedContact?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Teléfono: {selectedContact?.phone}</p>
            <p>Ciudad: {selectedContact?.city}</p>
            <div className="h-40 bg-zinc-900 rounded-lg p-4 text-sm text-zinc-400">Historial de chat...</div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-[#111111] border-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle>Agregar nuevo contacto</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddContact} className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Nombre</label>
              <input required type="text" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-2 outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Teléfono</label>
              <input required type="text" value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-2 outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Ciudad</label>
              <input type="text" value={newContact.city} onChange={e => setNewContact({...newContact, city: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-2 outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Estado</label>
              <select value={newContact.status} onChange={e => setNewContact({...newContact, status: e.target.value})} className="w-full bg-zinc-900 border border-zinc-800 rounded-md p-2 outline-none focus:border-indigo-500">
                <option value="Nuevo">Nuevo</option>
                <option value="En contacto">En contacto</option>
                <option value="Cliente">Cliente</option>
              </select>
            </div>
            <div className="flex justify-end pt-4">
              <button type="submit" className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-md font-medium transition-colors">
                Guardar contacto
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
