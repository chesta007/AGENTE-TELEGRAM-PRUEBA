import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { createClient } from '@supabase/supabase-js';
import express from 'express';

const {
  TELEGRAM_TOKEN,
  OPENROUTER_API_KEY,
  VITE_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  VITE_SUPABASE_ANON_KEY,
  EVOLUTION_URL,
  EVOLUTION_API_KEY,
  PORT = 3000
} = process.env;

const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || VITE_SUPABASE_ANON_KEY);

const logger = {
  info: (msg, meta = {}) => console.log(JSON.stringify({ level: 'INFO', msg, ...meta, ts: new Date().toISOString() })),
  warn: (msg, meta = {}) => console.warn(JSON.stringify({ level: 'WARN', msg, ...meta, ts: new Date().toISOString() })),
  error: (msg, meta = {}) => console.error(JSON.stringify({ level: 'ERROR', msg, ...meta, ts: new Date().toISOString() })),
};

const ACTIVE_MODEL = 'meta-llama/llama-3.1-8b-instruct';

// ============================================================
// MIDDLEWARE DE CRÉDITO Y ORGANIZACIÓN
// ============================================================
async function checkOrganizationAndCredit(orgSlug = 'default') {
  const { data: org, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', orgSlug)
    .single();

  if (error || !org) {
    logger.error('Organización no encontrada', { orgSlug });
    return null;
  }

  if (org.status !== 'active') {
    logger.warn('Organización inactiva', { slug: org.slug });
    return { ...org, blocked: true, reason: 'Servicio pausado por el administrador' };
  }

  if (Number(org.credit_balance) <= 0) {
    logger.warn('Sin crédito disponible', { slug: org.slug });
    return { ...org, blocked: true, reason: 'Sin créditos disponibles' };
  }

  return org;
}

// ============================================================
// MOTOR CENTRAL: PROCESAR MENSAJE (Telegram + WhatsApp)
// ============================================================
async function processIncomingMessage({ text, channel, orgSlug = 'default', externalId, firstName = 'Usuario', replyFn }) {
  logger.info('Mensaje recibido', { channel, externalId, orgSlug });

  const org = await checkOrganizationAndCredit(orgSlug);
  if (!org) return replyFn('⚠️ Error interno. Inténtalo más tarde.');
  if (org.blocked) return replyFn(`⚠️ ${org.reason}. Contacta a soporte.`);

  try {
    // Buscar o crear contacto
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
        source: channel,
        lead_stage: 'new'
      }]).select().single();
      contact = newContact;
    }

    // Guardar mensaje del usuario
    await supabase.from('messages').insert([{
      contact_id: contact.id,
      organization_id: org.id,
      content: text,
      sender: 'user',
      channel: channel,
      lead_stage: contact.lead_stage
    }]);

    // Historial para contexto
    const { data: historyData } = await supabase
      .from('messages')
      .select('content, sender')
      .eq('contact_id', contact.id)
      .order('created_at', { ascending: false })
      .limit(8);

    const messagesForAI = (historyData || []).reverse().map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.content
    }));

    const systemPrompt = `Eres un asesor comercial experto de Alcance AI.
Sigue estrictamente este embudo de 5 etapas:
1. Saludo contextual (no repitas "hola" si ya hablaste antes)
2. Captura de datos (nombre, ciudad, interés)
3. Presentación de valor y planes
4. Manejo de objeciones con empatía
5. Cierre + detección de intención fuerte

Si detectas alta intención de compra, incluye el tag ###HOT_LEAD### al final de tu respuesta.

Datos del cliente: Nombre="${contact.full_name || 'Usuario'}", Etapa actual="${contact.lead_stage}".`;

    const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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

    const aiData = await aiResponse.json();
    let llmText = aiData.choices?.[0]?.message?.content || "Lo siento, tuve un problema técnico.";

    const isHotLead = llmText.includes('###HOT_LEAD###');
    const finalText = llmText.replace('###HOT_LEAD###', '').trim();

    if (isHotLead) {
      logger.info('🔥 HOT LEAD DETECTADO', { contactId: contact.id });
      await supabase.from('contacts').update({ lead_stage: 'hot' }).eq('id', contact.id);
    }

    // Responder al usuario
    await replyFn(finalText);

    // Guardar respuesta del agente
    await supabase.from('messages').insert([{
      contact_id: contact.id,
      organization_id: org.id,
      content: finalText,
      sender: 'agent',
      channel: channel,
      lead_stage: isHotLead ? 'hot' : contact.lead_stage
    }]);

    // Actualizar crédito
    const usage = aiData.usage || { prompt_tokens: 0, completion_tokens: 0 };
    const cost = ((usage.prompt_tokens || 0) + (usage.completion_tokens || 0)) * 0.000000055;
    const newBalance = Number(org.credit_balance) - cost;

    await supabase.from('organizations').update({ credit_balance: newBalance }).eq('id', org.id);

    logger.info('Mensaje procesado correctamente', { orgSlug, channel, cost: cost.toFixed(6) });

  } catch (err) {
    logger.error('Error en processIncomingMessage', { error: err.message });
    await replyFn('Lo siento, tuve un problema técnico. ¿Puedes repetirlo?');
  }
}

// ============================================================
// TELEGRAM
// ============================================================
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

bot.on('message', async (msg) => {
  if (!msg.text) return;

  await processIncomingMessage({
    text: msg.text,
    channel: 'telegram',
    orgSlug: 'default',
    externalId: msg.chat.id.toString(),
    firstName: msg.from?.first_name || 'Usuario',
    replyFn: (text) => bot.sendMessage(msg.chat.id, text)
  });
});

// ============================================================
// WHATSAPP - EVOLUTION API WEBHOOK
// ============================================================
const app = express();
app.use(express.json());

app.post('/webhook/evolution', async (req, res) => {
  res.sendStatus(200); // Responder rápido

  try {
    const payload = req.body;
    const data = payload.data || payload;

    if (payload.event !== 'messages.upsert' || data?.key?.fromMe) return;

    const phone = (data.key.remoteJid || '').replace('@s.whatsapp.net', '').replace('@c.us', '');
    const text = data.message?.conversation || data.message?.extendedTextMessage?.text || '';
    if (!text) return;

    const instanceId = payload.instance;

    // Buscar organización por instanceId de WhatsApp
    const { data: org } = await supabase
      .from('organizations')
      .select('slug')
      .eq('whatsapp_instance_id', instanceId)
      .maybeSingle();

    await processIncomingMessage({
      text: text,
      channel: 'whatsapp',
      orgSlug: org?.slug || 'default',
      externalId: phone,
      firstName: data.pushName || 'Usuario WhatsApp',
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

app.listen(PORT, () => {
  logger.info(`🚀 Alcance AI V6.5 iniciado - Escuchando en puerto ${PORT}`);
});