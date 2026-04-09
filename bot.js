import 'dotenv/config';
import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import { GoogleGenerativeAI } from '@google/generative-ai';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './lib/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_ORG_ID = 'default';

if (!GEMINI_API_KEY) {
  console.error("❌ CRITICAL: GEMINI_API_KEY is missing in .env");
  process.exit(1);
}

// --- INITIALIZATION ---
const app = express();
app.use(express.json());

// Serve static files from dist
app.use(express.static(path.join(__dirname, 'dist')));

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
let bot;

if (TELEGRAM_TOKEN) {
  bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
  console.log("✅ Telegram Bot initialized (Polling)");
} else {
  console.warn("⚠️ TELEGRAM_TOKEN missing. Telegram features will be disabled.");
}

// --- CORE AI LOGIC ---
async function getAIResponse(orgId, chatHistory, lastMessage) {
  try {
    const settings = await db.getSettings();
    const org = await db.findOrganization(orgId);
    
    if (!org || org.credits <= 0) {
      return "⚠️ Lo siento, esta organización no tiene créditos suficientes para procesar tu solicitud.";
    }

    const model = genAI.getGenerativeModel({ model: settings.ai_model || "gemini-1.5-flash" });
    
    // Construct System Prompt
    const systemPrompt = `${settings.default_prompt}\n\nEspecífico para esta cuenta: ${org.personality_prompt || ''}`;
    
    // Prepare conversation
    const chat = model.startChat({
      history: chatHistory.slice(-10).map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })),
      generationConfig: {
        maxOutputTokens: settings.max_tokens || 1000,
        temperature: settings.temperature || 0.7,
      },
    });

    // Credit usage check middleware (atomic decrement)
    await db.updateOrganizationCredits(orgId, -1);

    const result = await chat.sendMessage(lastMessage);
    const response = await result.response;
    const aiText = response.text();

    // Log usage
    const logs = await db.getUsageLogs();
    logs.push({
      org_id: orgId,
      amount: -1,
      type: 'ai_response',
      timestamp: new Date().toISOString()
    });
    await db.saveUsageLogs(logs);

    return aiText;
  } catch (error) {
    console.error("LLM Error:", error);
    return "Ups, tuve un problema procesando tu mensaje. Intenta de nuevo más tarde.";
  }
}

// --- MESSAGE HANDLING ---
async function processMessage(orgId, channel, externalId, text, contactName) {
  console.log(`[${channel}] Message from ${contactName} (${externalId}): ${text}`);
  
  // 1. Get or Create Contact
  const contacts = await db.getContacts();
  let contact = contacts.find(c => c.external_id === externalId && c.org_id === orgId);
  if (!contact) {
    contact = { 
      id: Date.now().toString(), 
      org_id: orgId, 
      external_id: externalId, 
      name: contactName, 
      channel 
    };
    contacts.push(contact);
    await db.saveContacts(contacts);
  }

  // 2. Get history
  const allMessages = await db.getMessages();
  const history = allMessages.filter(m => m.contact_id === contact.id);

  // 3. AI call
  const aiReply = await getAIResponse(orgId, history, text);

  // 4. Save messages
  const userMsg = { role: 'user', content: text, contact_id: contact.id, timestamp: new Date().toISOString() };
  const assistantMsg = { role: 'assistant', content: aiReply, contact_id: contact.id, timestamp: new Date().toISOString() };
  allMessages.push(userMsg, assistantMsg);
  await db.saveMessages(allMessages);

  return aiReply;
}

// --- CHANNELS ---

// 1. Telegram
if (bot) {
  bot.on('message', async (msg) => {
    if (!msg.text) return;
    const reply = await processMessage(DEFAULT_ORG_ID, 'telegram', msg.chat.id.toString(), msg.text, msg.from.first_name || 'User');
    bot.sendMessage(msg.chat.id, reply);
  });
}

// 2. WhatsApp (Evolution API Webhook)
app.post('/webhook/evolution', async (req, res) => {
  const data = req.body;
  
  // Evolution API typically sends event: "messages.upsert"
  if (data.event === "messages.upsert") {
    const messageData = data.data;
    const isFromMe = messageData.key.fromMe;
    const text = messageData.message?.conversation || messageData.message?.extendedTextMessage?.text;
    const remoteJid = messageData.key.remoteJid;
    const pushName = messageData.pushName || 'WhatsApp User';

    if (text && !isFromMe) {
      // For multi-tenant, map 'instance' name to an Org
      // Using 'default' for now as placeholder
      const reply = await processMessage(DEFAULT_ORG_ID, 'whatsapp', remoteJid, text, pushName);
      
      // Evolution API responds to its own message via external API call, 
      // but here we just process then you'd call Evolution's /message/send endpoint
      console.log(`REPLY to ${remoteJid}: ${reply}`);
      // NOTE: Here you would ideally call Evolution API to send the message back.
    }
  }
  
  res.sendStatus(200);
});

// --- API ROUTES (Management) ---
app.get('/api/stats', async (req, res) => {
  const org = await db.findOrganization(DEFAULT_ORG_ID);
  res.json({ credits: org?.credits || 0 });
});

// Health Check
app.get('/health', (res) => res.send('OK'));

// Serve Frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// --- SERVER START ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});