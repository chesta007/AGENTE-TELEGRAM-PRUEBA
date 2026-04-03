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

console.log(`🔐 Key detectada: ${OPENROUTER_API_KEY.substring(0, 5)}... (Verificado)`);

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
      headers: { 
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errText = await response.text();
      console.error(`❌ Error en Proxy OpenRouter (${response.status}):`, errText);
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    console.log('✅ Datos de OpenRouter recibidos con éxito (Proxy OK)');
    res.json(data);
  } catch (error) {
    console.error('❌ Error fatal en Proxy /api/balance:', error.message);
    res.status(500).json({ error: error.message });
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
    // 2. Gestión de Contacto con Memoria de Identidad (Check / Update)
    let { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('phone', telegramId)
      .single();

    const telegramName = msg.from?.first_name 
      ? `${msg.from.first_name} ${msg.from.last_name || ''}`.trim() 
      : 'Usuario Desconocido';

    if (contactError && contactError.code === 'PGRST116') {
      // Crear contacto por primera vez
      const { data: newContact, error: insertError } = await supabase
        .from('contacts')
        .insert([{ 
          full_name: telegramName, 
          phone: telegramId, 
          status: 'Nuevo' 
        }])
        .select()
        .single();
        
      if (insertError) throw new Error(`Error creando contacto: ${insertError.message}`);
      contact = newContact;
      console.log(`👤 Nuevo contacto registrado: ${telegramName}`);
    } else if (contactError) {
      throw contactError;
    }

    // 3. Persistir mensaje entrante del usuario
    await supabase.from('messages').insert([{
      contact_id: contact.id,
      content: text,
      sender: 'user'
    }]);

    // 4. Preparar Contexto Personalizado para Iris
    const hasName = contact.full_name && !contact.full_name.includes('Usuario Desconocido');
    const hasCity = !!contact.city;
    const hasPhone = !!contact.phone; // Siempre true en este caso pero se mantiene por lógica
    
    let identityContext = `CONTEXTO DEL USUARIO ACTUAL:
    - ID Telegram: ${telegramId}
    - Nombre registrado: ${contact.full_name || 'Desconocido'}
    - Ciudad: ${contact.city || 'Desconocida'}
    - Estado en CRM: ${contact.status}
    
    INSTRUCCIONES DE FLUJO:
    1. Si ya conoces el nombre (${contact.full_name}), salúdalo personalmente: "¡Hola ${contact.full_name}! Qué bueno verte de nuevo...".
    2. Si falta la ciudad (${hasCity ? 'YA LA TIENES' : 'FALTA'}), pídela de forma natural.
    3. Si ya tienes Nombre y Ciudad, NO los vuelvas a preguntar. Salta directamente a resolver la duda técnica usando los documentos de Alcance.
    4. Si ya tienes TODOS los datos básicos, confirma que pasarás su consulta a un asesor experto.`;

    // 5. Recuperar Historial y Contexto del Agente
    const { data: historyData } = await supabase
      .from('messages')
      .select('content, sender')
      .eq('contact_id', contact.id)
      .order('created_at', { ascending: false })
      .limit(10);

    const history = (historyData || []).reverse().map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.content
    }));

    let systemPromptBase = `Eres Iris, IA experta en ventas de Alcance. Obligatorio:
    1. Cualifica necesidad antes de dar precio.
    2. Maneja objeciones con empatía y muestra retorno de inversión.
    3. Cierra siempre con doble alternativa (ej. llamada mañana o WhatsApp).
    Tono: Profesional, seguro y experto.`;

    const { data: contextData } = await supabase.from('agent_context').select('system_prompt').limit(1).single();
    if (contextData?.system_prompt) systemPromptBase = contextData.system_prompt;

    const fullSystemPrompt = `${systemPromptBase}\n\n${identityContext}`;

    // 6. RAG: Recuperar conocimiento de documentos indexados (Fragmentado)
    let knowledgeBase = "";
    try {
      const { data: docs } = await supabase
        .from('documents')
        .select('name, storage_path')
        .eq('status', 'Indexado');

      if (docs && docs.length > 0) {
        console.log(`📚 Consultando base de conocimientos (${docs.length} documentos)...`);
        
        let allChunks = [];
        const userWords = text.toLowerCase().split(/\s+/).filter(w => w.length > 3);

        for (const doc of docs) {
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('knowledge')
            .download(doc.storage_path);
          
          if (!downloadError && fileData) {
            const content = await fileData.text();
            // Dividir por párrafos gruesos
            const chunks = content.split(/\n\s*\n/).filter(c => c.trim().length > 50);
            
            chunks.forEach(chunk => {
              let score = 0;
              const chunkLower = chunk.toLowerCase();
              // Puntuación simple por coincidencia de palabras del usuario
              userWords.forEach(word => {
                if (chunkLower.includes(word)) score++;
              });
              allChunks.push({ name: doc.name, text: chunk.trim(), score });
            });
          }
        }

        // Ordenar por score y tomar los 3 fragmentos más relevantes
        allChunks.sort((a, b) => b.score - a.score);
        const topChunks = allChunks.slice(0, 3);
        
        topChunks.forEach(chunk => {
          knowledgeBase += `\n--- Fragmento de ${chunk.name} ---\n${chunk.text}\n`;
        });
      }
    } catch (ragErr) {
      console.error('Error en RAG:', ragErr);
    }

    // 7. Construir Array de Mensajes para la IA (Orden Estricto con RAG)
    const knowledgePrompt = knowledgeBase 
      ? `BASE DE CONOCIMIENTO PRIORITARIA:\n${knowledgeBase}\n\nInstrucción: Responde utilizando PRIMERO la información de la base de conocimiento arriba. Si no encuentras la respuesta ahí, usa tu conocimiento general.`
      : "";

    let messagesForAI = [
      { role: 'system', content: `${fullSystemPrompt}\n\n${knowledgePrompt}` },
      ...history,
      { role: 'user', content: text }
    ];

    // Limpieza de Tokens (estimación 1 token ≈ 4 caracteres). Límite 100k tokens = 400k caracteres.
    let totalChars = JSON.stringify(messagesForAI).length;
    while (totalChars > 400000 && messagesForAI.length > 2) {
      // Eliminar el mensaje más antiguo (índice 1, después del system prompt que es índice 0)
      messagesForAI.splice(1, 1);
      totalChars = JSON.stringify(messagesForAI).length;
    }

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
    console.log(`🔥 [PRUEBA DE FUEGO] Tokens en esta respuesta: ${tokensUsed}`);
    
    await supabase.from('messages').insert([{
      contact_id: contact.id,
      content: aiResponse,
      sender: 'agent',
      tokens: tokensUsed
    }]);

    console.log(`📊 Registro guardado en DB con ${tokensUsed} tokens.`);

    await supabase.from('contacts').update({ 
      last_interaction: new Date().toISOString() 
    }).eq('id', contact.id);

  } catch (error) {
    console.error('🔴 Error Crítico en bot.js:', error.message, error.stack);
    bot.sendMessage(telegramId, `💠 Iris está procesando información... (Error: ${error.message})`);
  }
});
