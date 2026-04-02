# Dashboard de Administración para Agente IA en Telegram

Este proyecto es un dashboard de administración moderno, oscuro y responsive, construido con **Vite + React + TypeScript + Tailwind CSS + shadcn/ui** y conectado a **Supabase** para autenticación, base de datos y almacenamiento.

## Funcionalidades
- **Dashboard:** Resumen de métricas clave.
- **Documentos:** Gestión de Knowledge Base (subida, listado, indexación).
- **Chats:** Historial de conversaciones de Telegram.
- **CRM:** Gestión de contactos.
- **Contexto:** Editor de System Prompt.

## Instalación y Ejecución Local

1. **Clonar el repositorio.**
2. **Instalar dependencias:**
   ```bash
   npm install
   ```
3. **Configurar variables de entorno:**
   Crea un archivo `.env` basado en `.env.example` y rellena las credenciales de Supabase:
   ```env
   VITE_SUPABASE_URL=tu_url_de_supabase
   VITE_SUPABASE_ANON_KEY=tu_clave_anon_de_supabase
   ```
4. **Ejecutar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```

## Despliegue en Vercel
1. Conecta tu repositorio de GitHub a Vercel.
2. Añade las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en la configuración del proyecto en Vercel.
3. Haz clic en "Deploy".

## Estructura de Ramas Git
- `main`: Producción.
- `develop`: Integración.
- `feature/*`: Nuevas funcionalidades.

## Base de Datos
Ejecuta el script SQL en `supabase_schema.sql` en el editor SQL de tu proyecto Supabase.
