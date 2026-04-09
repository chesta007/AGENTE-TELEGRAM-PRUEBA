import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_PATH = {
  organizations: path.resolve(__dirname, '../data/organizations.json'),
  contacts: path.resolve(__dirname, '../data/contacts.json'),
  messages: path.resolve(__dirname, '../data/messages.json'),
  settings: path.resolve(__dirname, '../data/bot_settings.json'),
  usage: path.resolve(__dirname, '../data/usage_logs.json'),
};

async function readJson(key) {
  try {
    const data = await fs.readFile(DATA_PATH[key], 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${key}:`, error);
    return key === 'settings' ? {} : [];
  }
}

async function writeJson(key, data) {
  try {
    await fs.writeFile(DATA_PATH[key], JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error writing ${key}:`, error);
  }
}

export const db = {
  getOrganizations: () => readJson('organizations'),
  saveOrganizations: (data) => writeJson('organizations', data),
  
  getContacts: () => readJson('contacts'),
  saveContacts: (data) => writeJson('contacts', data),
  
  getMessages: () => readJson('messages'),
  saveMessages: (data) => writeJson('messages', data),
  
  getSettings: () => readJson('settings'),
  saveSettings: (data) => writeJson('settings', data),
  
  getUsageLogs: () => readJson('usage'),
  saveUsageLogs: (data) => writeJson('usage', data),

  findOrganization: async (id) => {
    const orgs = await readJson('organizations');
    return orgs.find(o => o.id === id);
  },
  
  updateOrganizationCredits: async (id, amount) => {
    const orgs = await readJson('organizations');
    const idx = orgs.findIndex(o => o.id === id);
    if (idx !== -1) {
      orgs[idx].credits += amount;
      await writeJson('organizations', orgs);
      return orgs[idx];
    }
    return null;
  }
};
