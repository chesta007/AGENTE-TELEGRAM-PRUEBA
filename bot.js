import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import fs from 'fs';

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
  console.error('❌ Error: Faltan variables de entorno críticas en .env');
  process.exit(1);
}

// --- CLIENTES ---
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);
const bot = new TelegramBot(TELEGRAM_TOKEN, { 
  polling: true,
  request: { agentOptions: { keepAlive: true, family: 4 } }
});

/**
 * 🧪 INSTRUCCIONES DE PRUEBA DE PRODUCCIÓN (TESTING):
 * -------------------------------------------------------------------------
 * CASO 1 (Sincronización): 
 * "Hola, me llamo Pablo Chesta y vivo en Justiniano Posse. Estoy interesado en comprar un auto."
 * -> [ESPERADO]: Logs de create_or_update_contact_rpc con ID de organización detectado.
 * 
 * CASO 2 (Priorización):
 * "Marca mi interés como muy alto y actualiza mi ciudad a Córdoba."
 * -> [ESPERADO]: Logs de mark_hot_lead_rpc y update_contact_status_rpc en paralelo.
 * 
 * CASO 3 (Auditoría):
 * "¿Qué información tienes sobre mí en el CRM?"
 * -> [ESPERADO]: Log de get_contact_details_rpc y respuesta natural resumiendo datos.
 * -------------------------------------------------------------------------
 */

console.log('🦁 Lemovil Bot\'s Engine v2026 Prime | Multi-Tenant | Tool-Use | Mode: PRODUCTION');

// --- SERVIDOR DASHBOARD & PROXY ---
const app = express();
const PORT = process.env.PORT || 3000;
const distPath = path.join(__dirname, 'dist');

app.get('/api/balance', async (req, res) => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' }
    });
    res.json(await response.json());
  } catch (error) { res.status(500).json({ error: error.message }); }
});

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
} else {
  app.get('/', (req, res) => res.send('🦁 Lemovil Bot\'s Engine Online.'));
}
app.listen(PORT, () => console.log(`📡 Dashboard escuchando en puerto ${PORT}`));

// --- MULTI-TENANCY, BILLING & PERSONALITY ---
async function getOrganizationFromTelegramId(telegramId) {
  console.log(`🔍 [DEBUG] Buscando organización para TelegramID: ${telegramId}...`);
  const { data: contact } = await supabase.from('contacts').select('organization_id').eq('phone', telegramId).limit(1).single();
  
  if (contact?.organization_id) {
    console.log(`🏢 [DEBUG] Contacto existente encontrado. OrgID: ${contact.organization_id}`);
    const { data: org } = await supabase.from('organizations').select('*').eq('id', contact.organization_id).single();
    if (org) return org;
  }
  
  console.log(`⚠️ [DEBUG] No hay contacto previo. Asignando Organización por Defecto...`);
  let { data: defaultOrg } = await supabase.from('organizations').select('*').eq('slug', 'default').limit(1).single();
  if (!defaultOrg) {
    console.log(`🏗 [DEBUG] Creando nueva organización Default "default"...`);
    const { data: nOrg, error } = await supabase.from('organizations').insert([{ name: 'Lemovil Bot Default', slug: 'default', credit_balance: 100.00, status: 'active' }]).select().single();
    if (error) { console.error(`❌ [DEBUG ERROR] No se pudo crear org default:`, error.message); return null; }
    defaultOrg = nOrg;
  }
  return defaultOrg;
}

async function checkCreditAndOrg(telegramId) {
  const org = await getOrganizationFromTelegramId(telegramId);
  if (!org) return { allowed: false, reason: 'Error de configuración.' };
  
  console.log(`💳 [DEBUG] Saldo Org "${org.name}": $${org.credit_balance}`);
  if (Number(org.credit_balance) <= 0) {
    console.log(`⛔ [DEBUG] Acceso denegado: Sin créditos.`);
    return { allowed: false, reason: 'Servicio pausado por falta de crédito. Contacta a tu proveedor.', org };
  }
  return { allowed: true, org };
}

async function getAgentPersonality(organization_id) {
  console.log(`🧠 [DEBUG] Cargando personalidad para OrgID: ${organization_id}...`);
  const { data, error } = await supabase.from('agent_personality').select('*').eq('organization_id', organization_id).single();
  if (error || !data) {
    console.log(`💡 [DEBUG] Usando personalidad estandar (no definida aún).`);
    return { warmth: 7, closing_aggressiveness: 5, humor: 3, response_length: 'medium', use_emojis: true, sales_method: 'direct', custom_instructions: '' };
  }
  return data;
}

// --- IMPLEMENTACIÓN DE TOOLS CON LOGS EXTREMOS ---
const toolsFunctions = {
  get_contact_details: async (args, contextOrgId) => {
    console.log(`🛠 [TOOL] get_contact_details | ARGUMENTOS:`, JSON.stringify(args));
    const { data, error } = await supabase.rpc('get_contact_details_rpc', { target_id: args.contact_id, target_org_id: contextOrgId });
    if (error) { console.error(`❌ [RPC ERROR] get_contact_details:`, error.message); throw new Error(error.message); }
    console.log(`✅ [RPC RESULT] get_contact_details: Datos recuperados con éxito.`);
    return data;
  },

  update_contact_status: async (args, contextOrgId) => {
    console.log(`🛠 [TOOL] update_contact_status | ARGUMENTOS:`, JSON.stringify(args));
    const { data, error } = await supabase.rpc('update_contact_status_rpc', { target_id: args.contact_id, target_status: args.new_status, target_notes: args.notes, target_org_id: contextOrgId });
    if (error) { console.error(`❌ [RPC ERROR] update_contact_status:`, error.message); throw new Error(error.message); }
    console.log(`✅ [RPC RESULT] update_contact_status: CRM Sincronizado para ID ${args.contact_id}.`);
    return data;
  },

  mark_hot_lead: async (args, contextOrgId) => {
    console.log(`🛠 [TOOL] mark_hot_lead | ARGUMENTOS:`, JSON.stringify(args));
    const { data, error } = await supabase.rpc('mark_hot_lead_rpc', { target_id: args.contact_id, target_reason: args.reason, target_org_id: contextOrgId });
    if (error) { console.error(`❌ [RPC ERROR] mark_hot_lead:`, error.message); throw new Error(error.message); }
    console.log(`✅ [RPC RESULT] mark_hot_lead: Lead ${args.contact_id} marcado como HOT con éxito.`);
    return data;
  },

  create_or_update_contact: async (args, contextOrgId) => {
    console.log(`🛠 [TOOL] create_or_update_contact | ARGUMENTOS:`, JSON.stringify(args));
    const { data, error } = await supabase.rpc('create_or_update_contact_rpc', { target_full_name: args.full_name, target_phone: args.phone, target_city: args.city, target_interest: args.interest, target_org_id: contextOrgId });
    if (error) { console.error(`❌ [RPC ERROR] create_or_update_contact:`, error.message); throw new Error(error.message); }
    console.log(`✅ [RPC RESULT] create_or_update_contact: Contacto gestionado ID ${data.contact_id}.`);
    return data;
  },

  decrement_organization_balance: async (args, contextOrgId) => {
    console.log(`🛠 [TOOL] decrement_balance | ARGUMENTOS:`, JSON.stringify(args));
    const { data, error } = await supabase.rpc('decrement_balance_with_log_rpc', { target_org_id: contextOrgId, target_amount: Number(args.amount), target_reason: args.reason });
    if (error) { console.error(`❌ [RPC ERROR] decrement_balance:`, error.message); throw new Error(error.message); }
    console.log(`✅ [RPC RESULT] decrement_balance: Cobro aplicado. Balance restante: $${data.remaining_balance}.`);
    return data;
  }
};

const toolsDefinition = [
  { type: "function", function: { name: "get_contact_details", description: "Recupera la ficha técnica del contacto actual del CRM.", parameters: { type: "object", properties: { contact_id: { type: "number" } }, required: ["contact_id"] } } },
  { type: "function", function: { name: "update_contact_status", description: "Actualiza el estado administrativo del lead en el CRM.", parameters: { type: "object", properties: { contact_id: { type: "number" }, new_status: { type: "string", enum: ["Nuevo", "En contacto", "Cliente", "HOT"] }, notes: { type: "string" } }, required: ["contact_id", "new_status"] } } },
  { type: "function", function: { name: "mark_hot_lead", description: "Eleva la prioridad del lead (HOT LEAD) por interés de compra alto.", parameters: { type: "object", properties: { contact_id: { type: "number" }, reason: { type: "string" } }, required: ["contact_id", "reason"] } } },
  { type: "function", function: { name: "create_or_update_contact", description: "Sincroniza datos de contacto: nombre, teléfono, ciudad e interés.", parameters: { type: "object", properties: { full_name: { type: "string" }, phone: { type: "string" }, city: { type: "string" }, interest: { type: "string" } }, required: ["full_name"] } } },
  { type: "function", function: { name: "decrement_organization_balance", description: "Descuenta créditos del saldo de la organización.", parameters: { type: "object", properties: { amount: { type: "number" }, reason: { type: "string" } }, required: ["amount", "reason"] } } }
];

// --- MOTOR DE RESPUESTAS ---
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = chatId.toString();
  const text = msg.text;
  if (!text) return;

  try {
    const { allowed, reason, org } = await checkCreditAndOrg(telegramId);
    if (!allowed) {
      if (reason.includes('falta de crédito')) await bot.sendMessage(chatId, reason);
      return;
    }
    const contextOrgId = org.id;

    // Obtener contacto o crear uno inicial
    let { data: contact } = await supabase.from('contacts').select('*').eq('phone', telegramId).eq('organization_id', contextOrgId).single();
    if (!contact) {
      const tgName = msg.from?.first_name ? `${msg.from.first_name} ${msg.from.last_name || ''}`.trim() : 'Usuario Desconocido';
      const { data: nC } = await supabase.from('contacts').insert([{ full_name: tgName, phone: telegramId, status: 'Nuevo', organization_id: contextOrgId }]).select().single();
      contact = nC;
      console.log(`👤 [DEBUG] Nuevo contacto creado automáticamente: ${contact.id}`);
    }
    await supabase.from('messages').insert([{ contact_id: contact.id, content: text, sender: 'user', organization_id: contextOrgId }]);

    // Cargar Personalidad e Historial
    const p = await getAgentPersonality(contextOrgId);
    const { data: hData } = await supabase.from('messages').select('content, sender').eq('contact_id', contact.id).order('created_at', { ascending: false }).limit(8);
    const history = (hData || []).reverse().map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.content }));

    const systemPrompt = `Eres Lemovil Bot. ADN PERSONAL: Calidez ${p.warmth}/10, Humilidad/Humor ${p.humor}/10, Agresividad Comercial ${p.closing_aggressiveness}/10. 
    ESTILO: ${p.sales_method}. EXTENSIÓN: ${p.response_length}. EMOJIS: ${p.use_emojis ? 'SÍ' : 'NO'}.
    IMPORTANTE: Interactúas con el CRM de Lemovil Bot's mediante herramientas RPC. OrgID Context: "${contextOrgId}".
    LEAD LÍNEA: ID ${contact.id}, Nombre ${contact.full_name}, Status "${contact.status}".
    REGLA: Si ejecutas una herramienta, debes INFORMAR al usuario de lo que hiciste (ej: sincronizar sus datos o marcar su prioridad) de forma natural y alineada a tu personalidad actual.`;

    let conversation = [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: text }];
    await bot.sendChatAction(chatId, 'typing');

    // --- LLAMADA AL LLM (REAZONAMIENTO) ---
    const resp1 = await fetch(`https://openrouter.ai/api/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'X-Title': 'Lemovil Bot Engine Consolidated' },
      body: JSON.stringify({ model: 'meta-llama/llama-3.1-8b-instruct', messages: conversation, tools: toolsDefinition, tool_choice: 'auto' })
    });
    
    let data = await resp1.json();
    let message = data.choices[0].message;

    // Ejecución de Tools
    if (message.tool_calls) {
      console.log(`🤖 [LLM DECISION] Invocando ${message.tool_calls.length} herramientas...`);
      conversation.push(message);

      const toolResults = await Promise.all(message.tool_calls.map(async (tCall) => {
        const fnName = tCall.function.name;
        const args = JSON.parse(tCall.function.arguments);
        try {
          const result = await toolsFunctions[fnName](args, contextOrgId);
          // Registrar log dashboard
          await supabase.from('agent_tool_logs').insert([{ organization_id: contextOrgId, tool_name: fnName, arguments: args, result }]);
          return { role: 'tool', tool_call_id: tCall.id, name: fnName, content: JSON.stringify(result) };
        } catch (err) {
          return { role: 'tool', tool_call_id: tCall.id, name: fnName, content: JSON.stringify({ error: err.message }) };
        }
      }));

      conversation.push(...toolResults);
      console.log(`✅ [LLM SINC] Tools procesadas. Solicitando respuesta conversacional final...`);
      
      const resp2 = await fetch(`https://openrouter.ai/api/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENROUTER_API_KEY}` },
        body: JSON.stringify({ model: 'meta-llama/llama-3.1-8b-instruct', messages: conversation })
      });
      data = await resp2.json();
      message = data.choices[0].message;
    }

    const finalMsg = message.content || 'Tarea procesada correctamente.';
    await bot.sendMessage(chatId, finalMsg);

    // Auditoría de Créditos y Cierre
    const totalTokens = data.usage?.total_tokens || 0;
    const costUsd = totalTokens * 0.00005;
    await supabase.rpc('decrement_balance_with_log_rpc', { target_org_id: contextOrgId, target_amount: costUsd, target_reason: 'Respuesta IA Automática' });
    const { data: sMsg } = await supabase.from('messages').insert([{ contact_id: contact.id, content: finalMsg, sender: 'agent', tokens: totalTokens, organization_id: contextOrgId }]).select().single();
    await supabase.from('usage_logs').insert([{ organization_id: contextOrgId, tokens_used: totalTokens, cost_usd: costUsd, model_used: data.model, message_id: sMsg?.id }]);
    await supabase.from('contacts').update({ last_interaction: new Date().toISOString() }).eq('id', contact.id);

  } catch (error) {
    console.error('🔴 [CRITICAL ERROR]:', error.message);
  }
});
