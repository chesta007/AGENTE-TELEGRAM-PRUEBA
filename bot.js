import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { createClient } from '@supabase/supabase-js';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
  TELEGRAM_TOKEN,
  OPENROUTER_API_KEY,
  VITE_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  VITE_SUPABASE_ANON_KEY,
  PORT = 3000,
  EVOLUTION_URL,
  EVOLUTION_API_KEY
} = process.env;

const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || VITE_SUPABASE_ANON_KEY);

const logger = {
  info: (msg, meta = {}) => console.log(JSON.stringify({ level: 'INFO', msg, ...meta, ts: new Date().toISOString() })),
  error: (msg, meta = {}) => console.error(JSON.stringify({ level: 'ERROR', msg, ...meta, ts: new Date().toISOString() })),
};

const ACTIVE_MODEL = 'meta-llama/llama-3.1-8b-instruct';

// ============================================================
// MOTOR NEUTRO - Carga prompt desde la base de datos
// ============================================================
async function getSystemPrompt(orgId) {
  const { data } = await supabase
    .from('bot_settings')
    .select('current_prompt')
    .eq('organization_id', orgId)
    .maybeSingle();

  const basePrompt = "Eres un asistente profesional, inteligente y útil. Mantén memoria de la conversación y responde de forma natural y coherente.";

  return data?.current_prompt ? `${basePrompt}\n\n${data.current_prompt}` : basePrompt;
}

async function processIncomingMessage({ text, channel, orgSlug = 'default', externalId, firstName = 'Usuario', replyFn }) {
  logger.info('Mensaje recibido', { channel, orgSlug, externalId });

  // 1. Obtener organización
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', orgSlug)
    .single();

  if (orgError || !org) {
    logger.error('Organización no encontrada', { orgSlug });
    return replyFn('⚠️ Error de configuración. Contacta soporte.');
  }

  if (Number(org.credit_balance) <= 0) {
    return replyFn('⚠️ No tienes créditos disponibles. Recarga tu saldo.');
  }

  try {
    // 2. Obtener o crear contacto
    let { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('phone', externalId)
      .eq('organization_id', org.id)
      .maybeSingle();

    if (!contact) {
      const { data: newContact } = await supabase.from('contacts').insert([{
        full_name: firstName,
        phone: externalId,
        organization_id: org.id,
        source: channel
      }]).select().single();
      contact = newContact;
    }

    // 3. Guardar mensaje del usuario
    await supabase.from('messages').insert([{
      organization_id: org.id,
      contact_id: contact.id,
      content: text,
      sender: 'user',
      channel: channel
    }]);

    // 4. Cargar prompt dinámico + historial
    const systemPrompt = await getSystemPrompt(org.id);

    const { data: history } = await supabase
      .from('messages')
      .select('content, sender')
      .eq('contact_id', contact.id)
      .order('created_at', { ascending: false })
      .limit(8);

    const messagesForAI = (history || []).reverse().map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.content
    }));

    // 5. Llamada al LLM
    const aiResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`
      },
      body: JSON.stringify({
        model: ACTIVE_MODEL,
        messages: [{ role: 'system', content: systemPrompt }, ...messagesForAI, { role: 'user', content: text }]
      })
    });

    const aiData = await aiResp.json();
    const responseText = aiData.choices?.[0]?.message?.content || "Lo siento, no pude procesar tu mensaje.";

    // 6. Responder al usuario
    await replyFn(responseText);

    // 7. Guardar respuesta del agente
    await supabase.from('messages').insert([{
      organization_id: org.id,
      contact_id: contact.id,
      content: responseText,
      sender: 'agent',
      channel: channel
    }]);

    // 8. Actualizar crédito
    const usage = aiData.usage || { prompt_tokens: 0, completion_tokens: 0 };
    const cost = (usage.prompt_tokens + usage.completion_tokens) * 0.000000055;

    await supabase.from('organizations').update({
      credit_balance: Number(org.credit_balance) - cost
    }).eq('id', org.id);

    logger.info('Mensaje procesado correctamente', { cost: cost.toFixed(6) });

  } catch (err) {
    logger.error('Error en processIncomingMessage', { error: err.message });
    replyFn('Lo siento, ocurrió un error técnico. Inténtalo de nuevo.');
  }
}

// ====================== TELEGRAM ======================
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

bot.on('message', async (msg) => {
  if (!msg.text) return;

  processIncomingMessage({
    text: msg.text,
    channel: 'telegram',
    orgSlug: 'default',
    externalId: msg.chat.id.toString(),
    firstName: msg.from?.first_name || 'Usuario',
    replyFn: (text) => bot.sendMessage(msg.chat.id, text)
  });
});

// ====================== WHATSAPP - EVOLUTION API ======================
const app = express();
app.use(express.json());

// Servir el frontend estático (importante para que el Dashboard se vea)
app.use(express.static(path.join(__dirname, 'dist')));

// Webhook Evolution
app.post('/webhook/evolution', async (req, res) => {
  res.sendStatus(200);

  try {
    const payload = req.body;
    const data = payload.data || payload;

    if (payload.event !== 'messages.upsert' || data?.key?.fromMe) return;

    const phone = (data.key.remoteJid || '').replace('@s.whatsapp.net', '').replace('@c.us', '');
    const text = data.message?.conversation || data.message?.extendedTextMessage?.text || '';
    if (!text) return;

    const instanceId = payload.instance;

    const { data: org } = await supabase
      .from('organizations')
      .select('slug')
      .eq('whatsapp_instance_id', instanceId)
      .maybeSingle();

    processIncomingMessage({
      text,
      channel: 'whatsapp',
      orgSlug: org?.slug || 'default',
      externalId: phone,
      firstName: data.pushName || 'Usuario WA',
      replyFn: async (msgText) => {
        if (!EVOLUTION_URL || !EVOLUTION_API_KEY) return;
        await fetch(`${EVOLUTION_URL}/message/sendText/${instanceId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
          body: JSON.stringify({ number: phone, text: msgText })
        });
      }
    });
  } catch (err) {
    logger.error('Error en webhook Evolution', { error: err.message });
  }
});

// Ruta por defecto para el frontend (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  logger.info(`🚀 Alcance AI Motor Neutro V6.8 iniciado - Puerto ${PORT}`);
});