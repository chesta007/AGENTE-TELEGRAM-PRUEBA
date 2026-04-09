import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prioridad al volumen montado en /app/data
const BASE_DIR = process.env.DATA_PATH || path.resolve(__dirname, '../data');

const DATA_PATH = {
  organizations: path.resolve(BASE_DIR, 'organizations.json'),
  contacts: path.resolve(BASE_DIR, 'contacts.json'),
  messages: path.resolve(BASE_DIR, 'messages.json'),
  settings: path.resolve(BASE_DIR, 'bot_settings.json'),
  usage: path.resolve(BASE_DIR, 'usage_logs.json'),
};

async function readJson(key) {
  try {
    const data = await fs.readFile(DATA_PATH[key], 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (key === 'settings') return { default_prompt: "Eres una asistente útil.", ai_model: "anthropic/claude-3.5-sonnet", temperature: 0.7 };
    return [];
  }
}

async function writeAtomic(key, data) {
  const filePath = DATA_PATH[key];
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tempPath, filePath);
}

export const db = {
  getOrganizations: () => readJson('organizations'),
  saveOrganizations: (data) => writeAtomic('organizations', data),
  getContacts: () => readJson('contacts'),
  saveContacts: (data) => writeAtomic('contacts', data),
  getMessages: () => readJson('messages'),
  saveMessages: (data) => writeAtomic('messages', data),
  getSettings: () => readJson('settings'),
  saveSettings: (data) => writeAtomic('settings', data),
  
  // Métodos de conveniencia solicitados por el usuario
  findOrg: async (id) => {
    const orgs = await readJson('organizations');
    return orgs.find(o => o.id === id) || orgs[0];
  },
  
  updateCredits: async (id, amount) => {
    const orgs = await readJson('organizations');
    const idx = orgs.findIndex(o => o.id === id);
    if (idx !== -1) {
      orgs[idx].credits += amount;
      await writeAtomic('organizations', orgs);
      return orgs[idx];
    }
  }
};
