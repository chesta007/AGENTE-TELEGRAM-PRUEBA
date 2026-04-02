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
    <div className="flex h-[calc(100vh-100px)] bg-[#111111] rounded-xl border border-zinc-800 overflow-hidden">
      <div className="w-1/3 border-r border-zinc-800 p-4 flex flex-col">
        <div className="relative mb-4 flex-shrink-0">
          <Search className="absolute left-3 top-3 text-zinc-500" size={18} />
          <input className="w-full bg-[#0a0a0a] border border-zinc-800 p-2.5 pl-10 rounded-lg text-sm" placeholder="Buscar chats..." />
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-2">
          {loadingContacts ? (
             <div className="flex justify-center p-4">
               <Loader2 className="animate-spin text-zinc-500" />
             </div>
          ) : contacts.map(c => (
            <div 
              key={c.id} 
              onClick={() => setSelectedContactId(c.id)}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${selectedContactId === c.id ? 'bg-zinc-800' : 'bg-zinc-800/20 hover:bg-zinc-800/50'}`}
            >
              <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-white flex-shrink-0">
                {getInitials(c.name)}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="flex justify-between">
                  <span className="font-semibold text-sm truncate pr-2">{c.name}</span>
                  <span className="text-xs text-zinc-400 whitespace-nowrap">{c.last_interaction ? formatTime(c.last_interaction) : ''}</span>
                </div>
                <p className="text-xs text-zinc-400 truncate">{c.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex-1 flex flex-col bg-[#0a0a0a]">
        {selectedContactId && selectedContact ? (
          <>
            <div className="p-4 border-b border-zinc-800 flex items-center gap-3 flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-white">
                {getInitials(selectedContact.name)}
              </div>
              <div>
                <h3 className="font-semibold">{selectedContact.name}</h3>
                <p className="text-xs text-zinc-400">{selectedContact.phone || selectedContact.city}</p>
              </div>
            </div>
            
            <div ref={scrollRef} className="flex-1 p-6 space-y-4 overflow-y-auto">
              {loadingMessages ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="animate-spin text-zinc-500" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-zinc-500 text-sm mt-10">No hay mensajes. Envía el primero.</div>
              ) : (
                messages.map((m, idx) => {
                  // user -> izquierda (gris/oscuro), agent -> derecha (indigo/violeta)
                  const isAgent = m.sender === 'agent';
                  
                  return (
                    <div key={m.id || idx} className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}>
                      <div 
                        className={`p-3 px-4 rounded-2xl max-w-md break-words ${
                          isAgent 
                            ? 'bg-indigo-600 rounded-br-none text-white' 
                            : 'bg-zinc-800 rounded-bl-none text-zinc-100'
                        }`}
                      >
                        {m.content}
                        <div className={`text-[10px] mt-1 text-right ${isAgent ? 'text-indigo-200' : 'text-zinc-500'}`}>
                          {formatTime(m.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            <form onSubmit={handleSendMessage} className="p-4 border-t border-zinc-800 flex gap-2 flex-shrink-0">
              <input 
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 bg-zinc-800 p-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-zinc-100" 
                placeholder="Escribe un mensaje..." 
              />
              <button 
                type="submit" 
                disabled={!inputText.trim()}
                className="bg-indigo-500 p-3 rounded-lg text-white hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={18} />
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
