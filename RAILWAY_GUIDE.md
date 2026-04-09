# 🚀 Arquitectura "Express-JSON" para Railway

Esta solución elimina la dependencia de Supabase usando persistencia local en archivos JSON, permitiendo un despliegue inmediato y flexible en Railway.

## 📁 Estructura del Sistema
- `bot.js`: Servidor Express unificado (Frontend + Webhooks + Bot).
- `lib/db.js`: Capa de persistencia asíncrona usando `fs/promises`.
- `data/`: Carpeta que contiene los archivos JSON (Base de Datos local).
- `dist/`: Carpeta del frontend compilado (necesaria para servir la UI).

## 🛠️ Configuración en Railway

### 1. Variables de Env
Configura estas variables en Railway (Settings > Variables):
- `PORT`: `3000`
- `GEMINI_API_KEY`: Tu clave de Google AI.
- `TELEGRAM_TOKEN`: El token de tu bot.

### 2. Persistencia (IMPORTANTE)
Para que los datos no se pierdan al reiniciar:
- Crea un `Volume` en Railway.
- Móntalo en `/data`.

### 3. Comandos
- Inicio: `npm start` (Ejecuta `node bot.js`).
- Build: `npm run build` (Si necesitas regenerar el frontend).

## 💳 Créditos
- Se descuenta 1 crédito por respuesta exitosa.
- Saldo inicial: 1000 créditos (Configurable en `data/organizations.json`).
