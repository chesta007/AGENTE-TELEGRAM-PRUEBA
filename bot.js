import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURACIÓN DE VARIABLES DE ENTORNO ---
const {
  TELEGRAM_TOKEN,
  OPENROUTER_API_KEY,
  VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY
} = process.env;

if (!TELEGRAM_TOKEN || !OPENROUTER_API_KEY || !VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
  console.error('❌ Error: Faltan variables de entorno críticas en el archivo .env (Asegúrate de tener OPENROUTER_API_KEY)');
  process.exit(1);
}

// --- CLIENTES ---
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);
const bot = new TelegramBot(TELEGRAM_TOKEN, { 
  polling: true,
  request: { agentOptions: { keepAlive: true, family: 4 } }
});

// Manejo de errores de polling de Telegram
bot.on('polling_error', (error) => {
  if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
    console.warn('⚠️ Conflicto de sesión detectado (409). Reintentando...');
  } else {
    console.error(`🔴 [Telegram Polling Error] ${error.code}: ${error.message}`);
  }
});

console.log('🚀 El León ha aterrizado en la nube (Railway). Listo para rugir.');

// Configuración para servir el Dashboard (Vite)
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`📡 Servidor de Dashboard Pro escuchando en puerto ${PORT}`);
});

// --- LÓGICA PRINCIPAL ---
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = chatId.toString();
  const text = msg.text;

  // 1. Filtrar solo mensajes de texto
  if (!text) return;

  try {
    // 2. Gestión de Contacto (Check / Create)
    let { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('phone', telegramId)
      .single();

    if (contactError && contactError.code === 'PGRST116') {
      const fullName = msg.from?.first_name 
        ? `${msg.from.first_name} ${msg.from.last_name || ''}`.trim() 
        : 'Usuario Desconocido';
      
      const { data: newContact, error: insertError } = await supabase
        .from('contacts')
        .insert([{ 
          full_name: fullName, 
          phone: telegramId, 
          status: 'Nuevo' 
        }])
        .select()
        .single();
        
      if (insertError) throw new Error(`Error creando contacto: ${insertError.message}`);
      contact = newContact;
      console.log(`👤 Nuevo contacto registrado: ${fullName}`);
    } else if (contactError) {
      throw contactError;
    }

    // 3. Persistir mensaje entrante del usuario
    const { error: msgUserError } = await supabase.from('messages').insert([{
      contact_id: contact.id,
      content: text,
      sender: 'user'
    }]);
    if (msgUserError) console.error('Error guardando msj usuario:', msgUserError.message);

    // 4. Recuperar Historial (Últimos 6 mensajes previos)
    const { data: historyData } = await supabase
      .from('messages')
      .select('content, sender')
      .eq('contact_id', contact.id)
      .lt('created_at', new Date().toISOString()) // Solo mensajes anteriores al actual
      .order('created_at', { ascending: false })
      .limit(6);

    // Mapear historial al formato de Grok (assistant roles)
    const history = (historyData || []).reverse().map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.content
    }));

    // 5. Obtener System Prompt Dinámico
    let systemPrompt = 'Eres el Agente Leones, un asistente experto, profesional y resolutivo.';
    const { data: contextData } = await supabase
      .from('agent_context')
      .select('system_prompt')
      .limit(1)
      .single();
      
    if (contextData?.system_prompt) {
      systemPrompt = contextData.system_prompt;
    }

    // 6. Construir Array de Mensajes para Grok (Orden Estricto)
    // Orden: System -> Historial -> Mensaje actual del usuario
    const messagesForGrok = [
      { role: 'system', content: systemPrompt },
      ...history.filter(h => h.content !== text), // Evitar duplicar el actual si ya subió
      { role: 'user', content: text }
    ];

    // 7. Acción de 'typing' y Llamada a OpenRouter
    await bot.sendChatAction(chatId, 'typing');
    
    console.log(`🧠 Consultando a OpenRouter (Llama 3.3) con ${messagesForGrok.length} mensajes de contexto...`);
    
    const response = await fetch(`https://openrouter.ai/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://github.com/AgenteLeones', // Opcional para OpenRouter
        'X-Title': 'Agente Leones'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct',
        messages: messagesForGrok,
        stream: false
      })
    });

    if (!response.ok) {
      const errorDetail = await response.text();
      console.error(`❌ Error OpenRouter API (Status ${response.status}):`, errorDetail);
      throw new Error(`OpenRouter API Error ${response.status}: ${errorDetail}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || 'No pude generar una respuesta.';

    // 8. Responder en Telegram
    await bot.sendMessage(chatId, aiResponse);

    // 9. Persistir respuesta de IA y actualizar contacto
    await supabase.from('messages').insert([{
      contact_id: contact.id,
      content: aiResponse,
      sender: 'agent'
    }]);

    await supabase.from('contacts').update({ 
      last_interaction: new Date().toISOString() 
    }).eq('id', contact.id);

  } catch (error) {
    console.error('🔴 Error Crítico en bot.js:', error.message);
    bot.sendMessage(telegramId, '🦁 El León está procesando información... (Intenta en un momento)');
  }
});
