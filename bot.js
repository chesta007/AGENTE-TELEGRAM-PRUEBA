import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import TelegramBot from 'node-telegram-bot-api';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './lib/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet";
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

const EVO_URL = process.env.EVOLUTION_URL;
const EVO_KEY = process.env.EVOLUTION_API_KEY;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE || "alcance-bot";

if (!OPENROUTER_API_KEY) {
  console.error("❌ Error: OPENROUTER_API_KEY no configurado");
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://alcance-ai.railway.app",
    "X-Title": "Alcance AI",
  }
});

async function handleAI(orgId, chatId, text, contactName = "Usuario") {
  try {
    const org = await db.findOrg(orgId) || (await db.getOrganizations())[0];
    const settings = await db.getSettings();

    if (!org || org.credits <= 0) return "⚠️ Sin créditos.";

    const allMsgs = await db.getMessages();
    const history = allMsgs
      .filter(m => m.cid === chatId)
      .slice(-12)
      .map(m => ({ role: m.role, content: m.content }));

    const messages = [
      { role: "system", content: `${settings.default_prompt}\nPersonalidad: ${org.personality_prompt}\nUsuario: ${contactName}` },
      ...history,
      { role: "user", content: text }
    ];

    const completion = await openai.chat.completions.create({
      model: OPENROUTER_MODEL,
      messages,
      temperature: settings.temperature || 0.7,
      max_tokens: settings.max_tokens || 1000,
    });

    const replyText = completion.choices[0]?.message?.content?.trim();
    if (!replyText) throw new Error("Sin respuesta de IA");

    allMsgs.push(
      { role: 'user', content: text, cid: chatId, timestamp: new Date().toISOString() },
      { role: 'assistant', content: replyText, cid: chatId, timestamp: new Date().toISOString() }
    );
    await db.saveMessages(allMsgs);
    await db.updateCredits(org.id || orgId, -1);

    return replyText;
  } catch (error) {
    console.error("[AI Error]:", error.message);
    return "Error al procesar mensaje.";
  }
}

// ==================== TELEGRAM (DESACTIVADO) ====================
// Comentar o eliminar esta sección completa para evitar el error 409

// if (TELEGRAM_TOKEN) {
//   const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
//   console.log(`[Telegram] ✅ Conectado`);
//   bot.on('text', async (msg) => {
//     if (msg.text.startsWith('/')) return;
//     const aiReply = await handleAI('default', msg.chat.id.toString(), msg.text, msg.from?.first_name);
//     bot.sendMessage(msg.chat.id, aiReply);
//   });
// }


async function checkWAConnection() {
  if (!EVO_URL || !EVO_KEY) return;
  try {
    const { data } = await axios.get(`${EVO_URL}/instance/connectionStatus/${EVO_INSTANCE}`, { headers: { apikey: EVO_KEY } });
    console.log(`[WA] ${data.instance.state === 'open' ? '✅ Conectado' : '⚠️ Desconectado'}`);
  } catch (error) {
    if (error.response?.status === 404) {
      try {
        await axios.post(`${EVO_URL}/instance/create`, { instanceName: EVO_INSTANCE, token: EVO_KEY, qrcode: true }, { headers: { apikey: EVO_KEY } });
        console.log(`[WA] ✨ Instancia creada`);
      } catch (e) { console.error(`[WA] ❌ Error de creación: ${e.message}`); }
    }
  }
}

app.get('/wa/connect', async (req, res) => {
  if (!EVO_URL || !EVO_KEY) return res.status(500).send("Falta configuración");
  try {
    const { data } = await axios.get(`${EVO_URL}/instance/connect/${EVO_INSTANCE}`, { headers: { apikey: EVO_KEY } });
    if (data.base64) {
      res.send(`<html><body style="background:#0f172a;color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;"><div style="background:#1e293b;padding:2rem;border-radius:1rem;text-align:center;"><h1>Conectar WhatsApp</h1><img src="${data.base64}" style="width:256px;height:256px;background:white;padding:10px;border-radius:10px;"/><p style="margin-top:1rem;">Instancia: ${EVO_INSTANCE}</p><button onclick="location.reload()" style="margin-top:1rem;padding:10px 20px;background:#0ea5e9;border:none;border-radius:5px;color:white;cursor:pointer;">Refrescar</button></div></body></html>`);
    } else {
      res.send("<h1>✅ Conectado</h1>");
    }
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ==================== WHATSAPP - EVOLUTION API ====================
app.post('/webhook/evolution', async (req, res) => {
  res.sendStatus(200);

  try {
    const { event, data } = req.body;
    if (event !== "messages.upsert" || data?.key?.fromMe === true) return;

    const remoteJid = data.key.remoteJid;
    const pushName = data.pushName || "Usuario";
    const text = data.message?.conversation || 
                 data.message?.extendedTextMessage?.text || "";

    if (!text.trim()) return;

    console.log(`[WA] 📩 ${pushName}: ${text}`);

    const aiReply = await handleAI('default', remoteJid, text, pushName);

    if (EVO_URL && EVO_KEY) {
      await axios.post(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
        number: remoteJid.split('@')[0],
        text: aiReply
      }, { 
        headers: { apikey: EVO_KEY } 
      });
      console.log(`[WA] 📤 Respuesta enviada`);
    }
  } catch (error) {
    console.error("[WA Error]:", error.message);
  }
});


app.get('/health', (req, res) => res.json({ status: 'OK', model: OPENROUTER_MODEL }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Servidor en puerto ${PORT}`);
  await checkWAConnection();
});