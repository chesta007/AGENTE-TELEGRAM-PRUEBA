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

console.log('💠 Iris AI ha aterrizado en la nube (Railway). Lista para rugir.');

import express from 'express';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 3000;
const distPath = path.join(__dirname, 'dist');

// Endpoint Proxy para Saldo de OpenRouter (Seguridad)
app.get('/api/balance', async (req, res) => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}` }
    });
    const data = await response.json();
    console.log('✅ Datos de OpenRouter recibidos con éxito');
    res.json(data);
  } catch (error) {
    console.error('❌ Error consultando saldo en OpenRouter:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // IMPORTANTE: Dejar las rutas de API antes que el catch-all '*'
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.warn('⚠️ Carpeta "dist" no encontrada. El dashboard no estará disponible hasta que se construya el proyecto.');
  app.get('/', (req, res) => res.send('🦁 Iris AI está Viva, pero el Dashboard aún se está cocinando...'));
}

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
      .lt('created_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(6);

    const history = (historyData || []).reverse().map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.content
    }));

    // 5. Obtener System Prompt Dinámico (Identidad: Iris AI)
    let systemPrompt = 'Hola, soy Iris, la inteligencia artificial de Alcance. Soy un asistente experto, profesional y resolutivo que utiliza la base de conocimientos de la empresa para brindar soluciones precisas.';
    const { data: contextData } = await supabase
      .from('agent_context')
      .select('system_prompt')
      .limit(1)
      .single();
      
    if (contextData?.system_prompt) {
      systemPrompt = contextData.system_prompt;
    }

    // 6. RAG: Recuperar conocimiento de documentos indexados
    let knowledgeBase = "";
    try {
      const { data: docs } = await supabase
        .from('documents')
        .select('name, storage_path')
        .eq('status', 'Indexado');

      if (docs && docs.length > 0) {
        console.log(`📚 Consultando base de conocimientos (${docs.length} documentos)...`);
        for (const doc of docs) {
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('knowledge')
            .download(doc.storage_path);
          
          if (!downloadError && fileData) {
            const content = await fileData.text();
            knowledgeBase += `\n--- Información de ${doc.name} ---\n${content}\n`;
          }
        }
      }
    } catch (ragErr) {
      console.error('Error en RAG:', ragErr);
    }

    // 7. Construir Array de Mensajes para la IA (Orden Estricto con RAG)
    const knowledgePrompt = knowledgeBase 
      ? `BASE DE CONOCIMIENTO PRIORITARIA:\n${knowledgeBase}\n\nInstrucción: Responde utilizando PRIMERO la información de la base de conocimiento arriba. Si no encuentras la respuesta ahí, usa tu conocimiento general.`
      : "";

    const messagesForAI = [
      { role: 'system', content: `${systemPrompt}\n\n${knowledgePrompt}` },
      ...history,
      { role: 'user', content: text }
    ];

    // 8. Acción de 'typing' y Llamada a OpenRouter
    await bot.sendChatAction(chatId, 'typing');
    
    console.log(`🧠 Consultando a OpenRouter (Llama 3.3) con memoria + RAG...`);
    
    const response = await fetch(`https://openrouter.ai/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://github.com/AlcanceAI',
        'X-Title': 'Iris AI Command Center'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct',
        messages: messagesForAI,
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

    // 9. Persistir respuesta de IA con contador de tokens y actualizar contacto
    const tokensUsed = data.usage?.total_tokens || 0;
    
    await supabase.from('messages').insert([{
      contact_id: contact.id,
      content: aiResponse,
      sender: 'agent',
      tokens: tokensUsed
    }]);

    console.log(`📊 Consumo de la respuesta: ${tokensUsed} tokens.`);

    await supabase.from('contacts').update({ 
      last_interaction: new Date().toISOString() 
    }).eq('id', contact.id);

  } catch (error) {
    console.error('🔴 Error Crítico en bot.js:', error.message);
    bot.sendMessage(telegramId, '💠 Iris está procesando información... (Intenta en un momento)');
  }
});
