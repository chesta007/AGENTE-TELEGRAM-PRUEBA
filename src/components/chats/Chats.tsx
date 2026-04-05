import React, { useState, useEffect, useRef } from 'react';
import { Send, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function Chats() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const selectedContact = contacts.find(c => c.id === selectedContactId);
  
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  const [inputText, setInputText] = useState('');
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll al final automáticamente
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Obtener contactos al inicio
  useEffect(() => {
    const fetchContacts = async () => {
      setLoadingContacts(true);
      try {
        const { data, error } = await supabase
          .from('contacts')
          .select('*')
          .order('last_interaction', { ascending: false });
          
        if (error) throw error;
        setContacts(data || []);
      } catch (err) {
        console.error('Error fetching contacts:', err);
      } finally {
        setLoadingContacts(false);
      }
    };
    
    fetchContacts();
  }, []);

  // Obtener mensajes y escuchar en tiempo real cuando se selecciona un contacto
  useEffect(() => {
    if (!selectedContactId) return;

    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('contact_id', selectedContactId)
          .order('created_at', { ascending: true });
          
        if (error) throw error;
        setMessages(data || []);
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        setLoadingMessages(false);
        setTimeout(scrollToBottom, 100);
      }
    };

    fetchMessages();

    // Suscripción a Realtime para nuevos mensajes
    const channel = supabase
      .channel(`messages-${selectedContactId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `contact_id=eq.${selectedContactId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedContactId]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !selectedContactId) return;

    const msgText = inputText.trim();
    setInputText('');

    try {
      const { error } = await supabase
        .from('messages')
        .insert([{
          contact_id: selectedContactId,
          content: msgText,
          sender: 'agent'
        }]);
        
      if (error) throw error;
      
      // La actualización en UI suele llegar en gran parte por realtime.
      // Pero podemos hacer un append optimista también si no confiamos solo en el realtime.
      // (Aquí lo dejamos que el realtime lo sume para evitar duplicados, 
      // o bien hacemos append optimista y verificamos ID).
      // Para mayor simplicidad y rapidez, insertamos locamente. Si entra por realtime se puede filtrar por id.
      
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  };

  return (
    <div className="flex h-[calc(100vh-100px)] bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden font-['Inter',_sans-serif]">
      <div className="w-80 border-r border-slate-100 p-4 flex flex-col bg-slate-50/50">
        <div className="relative mb-4 flex-shrink-0">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input className="w-full bg-white border border-slate-200 p-2.5 pl-10 rounded-xl text-sm transition-all focus:ring-2 focus:ring-[#0047FF] focus:border-transparent" placeholder="Buscar chats..." />
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-2">
          {loadingContacts ? (
             <div className="flex justify-center p-4">
               <Loader2 className="animate-spin text-slate-400" />
             </div>
          ) : contacts.map(c => (
            <div 
              key={c.id} 
              onClick={() => setSelectedContactId(c.id)}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${selectedContactId === c.id ? 'bg-[#0047FF] text-white shadow-lg shadow-blue-200' : 'hover:bg-white hover:shadow-sm text-slate-600'}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${selectedContactId === c.id ? 'bg-white/20' : 'bg-slate-200 text-slate-500'}`}>
                {getInitials(c.full_name)}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="flex justify-between">
                  <span className={`font-semibold text-sm truncate pr-2 ${selectedContactId === c.id ? 'text-white' : 'text-slate-900'}`}>{c.full_name}</span>
                  <span className={`text-[10px] whitespace-nowrap ${selectedContactId === c.id ? 'text-blue-100' : 'text-slate-400'}`}>{c.last_interaction ? formatTime(c.last_interaction) : ''}</span>
                </div>
                <p className={`text-xs truncate ${selectedContactId === c.id ? 'text-blue-50' : 'text-slate-400'}`}>{c.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex-1 flex flex-col bg-white">
        {selectedContactId && selectedContact ? (
          <>
            <div className="p-5 border-b border-slate-100 flex items-center gap-3 flex-shrink-0 bg-white/80 backdrop-blur-md">
              <div className="w-10 h-10 rounded-full bg-[#0047FF] flex items-center justify-center font-bold text-white">
                {getInitials(selectedContact.full_name)}
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{selectedContact.full_name}</h3>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Telegram Client</p>
                </div>
              </div>
            </div>
            
            <div ref={scrollRef} className="flex-1 p-6 space-y-4 overflow-y-auto bg-slate-50/30">
              {loadingMessages ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="animate-spin text-[#0047FF]" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-slate-400 text-sm mt-10">No hay mensajes. Lemovil Bot está listo para responder.</div>
              ) : (
                messages.map((m, idx) => {
                  const isAgent = m.sender === 'agent';
                  
                  return (
                    <div key={m.id || idx} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                      <div 
                        className={`p-3.5 px-5 rounded-[20px] max-w-md shadow-sm border ${
                          isAgent 
                            ? 'bg-[#0047FF] border-transparent rounded-tr-none text-white' 
                            : 'bg-white border-slate-100 rounded-tl-none text-slate-700'
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{m.content}</p>
                        <div className={`text-[9px] mt-1.5 font-bold uppercase tracking-tight ${isAgent ? 'text-blue-200' : 'text-slate-300'}`}>
                          {formatTime(m.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            <form onSubmit={handleSendMessage} className="p-5 bg-white border-t border-slate-100 flex gap-3 flex-shrink-0">
              <input 
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 p-3.5 px-5 rounded-full text-sm outline-none focus:ring-2 focus:ring-[#0047FF] focus:bg-white transition-all text-slate-900" 
                placeholder="Escribe un mensaje a través de Lemovil Bot..." 
              />
              <button 
                type="submit" 
                disabled={!inputText.trim()}
                className="bg-[#0047FF] w-12 h-12 flex items-center justify-center rounded-full text-white hover:bg-blue-700 shadow-lg shadow-blue-200 disabled:opacity-30 disabled:shadow-none transition-all"
              >
                <Send size={20} />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500 flex-col gap-4">
            <div className="w-20 h-20 rounded-full bg-zinc-800/50 flex items-center justify-center">
              <Send size={32} className="text-zinc-600" />
            </div>
            <p>Selecciona un contacto para comenzar a chatear.</p>
          </div>
        )}
      </div>
    </div>
  );
}
