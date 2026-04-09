/**
 * bot.js - Alcance AI v3.1 (OpenRouter Edition)
 * Motor IA: OpenRouter + Claude 3.5 Sonnet / Gemini 2.0
 * Canales: Telegram + WhatsApp (Evolution API)
 */

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

// Evolution API
const EVO_URL = process.env.EVOLUTION_URL;
const EVO_KEY = process.env.EVOLUTION_API_KEY;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE || "alcance-bot";

if (!OPENROUTER_API_KEY) {
  console.error("❌ CRITICAL: OPENROUTER_API_KEY is missing");
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// Configuración OpenRouter (compatible con OpenAI SDK)
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://alcance-ai.railway.app",
    "X-Title": "Alcance AI",
  }
});

console.log(`🤖 Usando modelo: ${OPENROUTER_MODEL}`);

// ==================== MOTOR DE IA ====================
async function handleAI(orgId, chatId, text, contactName = "Usuario") {
  try {
    const org = await db.findOrg(orgId) || (await db.getOrganizations())[0];
    const settings = await db.getSettings();

    if (!org || org.credits <= 0) {
      return "⚠️ No tienes créditos suficientes para procesar esta consulta.";
    }

    // Cargar historial reciente
    const allMsgs = await db.getMessages();
    const history = allMsgs
      .filter(m => m.cid === chatId)
      .slice(-12)
      .map(m => ({
        role: m.role,
        content: m.content
      }));

    const systemPrompt = `${settings.default_prompt || "Eres una asistente útil y profesional."}
Personalidad: ${org.personality_prompt || "Responde de forma natural y servicial."}
Nombre del usuario: ${contactName}`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: text }
    ];

    const completion = await openai.chat.completions.create({
      model: OPENROUTER_MODEL,
      messages: messages,
      temperature: settings.temperature || 0.7,
      max_tokens: settings.max_tokens || 1000,
    });

    const replyText = completion.choices[0]?.message?.content?.trim();

    if (!replyText) throw new Error("Respuesta vacía de OpenRouter");

    // Guardar en historial
    const userMsg = {
      role: 'user',
      content: text,
      cid: chatId,
      timestamp: new Date().toISOString()
    };
    const assistantMsg = {
      role: 'assistant',
      content: replyText,
      cid: chatId,
      timestamp: new Date().toISOString()
    };

    allMsgs.push(userMsg, assistantMsg);
    await db.saveMessages(allMsgs);

    // Descontar crédito
    await db.updateCredits(org.id || orgId, -1);

    return replyText;

  } catch (error) {
    console.error("[AI Error]:", error.message || error);
    return "Lo siento, hubo un error al procesar tu mensaje. Inténtalo de nuevo.";
  }
}

// ==================== TELEGRAM ====================
if (TELEGRAM_TOKEN) {
  const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
  console.log(`[Telegram] ✅ Bot iniciado correctamente`);

  bot.on('text', async (msg) => {
    if (msg.text.startsWith('/')) return;

    const chatId = msg.chat.id.toString();
    const name = msg.from?.first_name || "Usuario";

    console.log(`[Telegram] 📩 ${name}: ${msg.text}`);

    const reply = await handleAI('default', chatId, msg.text, name);
    bot.sendMessage(chatId, reply);
  });
}

// ==================== WHATSAPP - EVOLUTION API ====================
app.post('/webhook/evolution', async (req, res) => {
  res.sendStatus(200); // Responder rápido

  try {
    const { event, data } = req.body;
    if (event !== "messages.upsert" || data?.key?.fromMe === true) return;

    const message = data.message;
    const remoteJid = data.key.remoteJid;
    const pushName = data.pushName || "WhatsApp User";
    const text = message?.conversation ||
      message?.extendedTextMessage?.text ||
      message?.imageMessage?.caption ||
      message?.videoMessage?.caption || "";

    if (!text.trim()) return;

    console.log(`[WA] 📩 ${pushName} (${remoteJid}): ${text}`);

    const aiReply = await handleAI('default', remoteJid, text, pushName);

    if (EVO_URL && EVO_KEY) {
      await axios.post(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
        number: remoteJid.replace('@s.whatsapp.net', ''),
        text: aiReply,
        delay: 1200
      }, {
        headers: { apikey: EVO_KEY }
      });
      console.log(`[WA] 📤 Respuesta enviada a ${remoteJid}`);
    }
  } catch (error) {
    console.error("[WA Webhook Error]:", error.message);
  }
});

// ==================== RUTAS ====================
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    model: OPENROUTER_MODEL,
    timestamp: new Date().toISOString()
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ==================== INICIO ====================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Alcance AI v3.1 (OpenRouter) iniciado correctamente`);
  console.log(`🌐 Puerto: ${PORT}`);
  console.log(`🤖 Modelo: ${OPENROUTER_MODEL}`);
  console.log(`📡 Webhook WhatsApp: /webhook/evolution`);
  console.log(`📂 DATA_PATH: ${process.env.DATA_PATH || './data'}\n`);
});