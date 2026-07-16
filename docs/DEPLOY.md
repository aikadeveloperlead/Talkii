# Guía de despliegue de Talkii a un VPS / dominio propio

Guía paso a paso para poner Talkii en producción sobre un VPS Linux (Ubuntu 22.04+)
con dominio propio y HTTPS. Stack: **Next.js 16 + Supabase**. No usa Vercel.

> Convención: sustituye `talkii.tudominio.com`, `TU_VPS_IP` y `<...>` por tus valores.
> Todos los comandos del VPS asumen usuario con `sudo`.

---

## 0. Requisitos previos

- Un VPS con Ubuntu (Hetzner, DigitalOcean, Contabo, AWS Lightsail, etc.), mínimo
  **1 vCPU / 2 GB RAM** (recomendado 2 vCPU / 4 GB para el runtime + build).
- Un **dominio** con acceso a su DNS.
- Proyecto **Supabase** ya creado (aquí: ref `xzdmhhprhjhwazofiioe`, región `us-east-2`).
- Acceso SSH al VPS: `ssh root@TU_VPS_IP`.

---

## 1. Preparar la base de datos (Supabase)

### 1.1 Aplicar la migración del esquema
El esquema vive en `supabase/migrations/0001_init.sql` (7 tablas + RLS multi-tenant).

**Opción A — SQL Editor (más simple):**
1. Entra a [app.supabase.com](https://app.supabase.com) → proyecto **TALKII** → **SQL Editor**.
2. Pega el contenido completo de `supabase/migrations/0001_init.sql` y ejecútalo.
3. Verifica en **Table Editor** que existen: `tenants, agents, funnels, conversations,
   sessions, events, decisions`, todas con el candado de RLS activo.

**Opción B — Supabase CLI (desde tu máquina):**
```bash
npm i -g supabase
supabase link --project-ref xzdmhhprhjhwazofiioe
supabase db push          # aplica migrations/*.sql
```

### 1.2 Configurar el claim `tenant_id` en Auth
El aislamiento RLS lee `app_metadata.tenant_id` del JWT del usuario. Al crear/registrar
un usuario, asígnale su tenant (ej. vía Admin API o un trigger). Ejemplo con service-role:
```sql
-- Ejecutar como admin: vincula un usuario a su tenant.
update auth.users
set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('tenant_id', '<UUID_TENANT>')
where id = '<UUID_USUARIO>';
```
Sin este claim, RLS devolverá 0 filas (comportamiento seguro por defecto).

### 1.3 Copiar las claves
En **Project Settings → API** anota:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (secreta, solo servidor)

---

## 2. Provisionar el VPS

```bash
ssh root@TU_VPS_IP

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Gestor de procesos y proxy
sudo npm i -g pm2
sudo apt-get install -y nginx

node -v && npm -v      # verifica Node 20.x
```

Crea un usuario de despliegue (recomendado, no usar root):
```bash
sudo adduser --disabled-password --gecos "" talkii
sudo usermod -aG sudo talkii
sudo su - talkii
```

---

## 3. Traer el código y configurar el entorno

```bash
cd ~
git clone https://github.com/aikadeveloperlead/Talkii.git
cd Talkii

# Variables de entorno de producción (NUNCA se commitean)
cp .env.example .env.local
nano .env.local        # rellena URL + anon key + service_role key
```

`.env.local` mínimo para runtime:
```
NEXT_PUBLIC_SUPABASE_URL=https://xzdmhhprhjhwazofiioe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
SUPABASE_SERVICE_ROLE_KEY=<service_role>
```

---

## 4. Instalar, verificar y compilar

```bash
npm ci                 # instala dependencias exactas del package-lock
npm run test           # 22/22 verde (dominio + use-cases + mappers)
npm run build          # build de producción de Next.js
```

Si `npm run build` termina en `✓ Compiled successfully`, el artefacto está listo.

---

## 5. Arrancar con PM2

```bash
pm2 start "npm run start" --name talkii    # sirve en http://127.0.0.1:3000
pm2 save                                    # persiste la lista de procesos
pm2 startup                                 # genera el servicio de arranque (ejecuta la línea que imprime)
```

Comandos útiles: `pm2 logs talkii`, `pm2 restart talkii`, `pm2 status`.

---

## 6. Reverse proxy con Nginx + HTTPS

### 6.1 DNS
En tu proveedor de dominio crea un registro **A**:
```
talkii.tudominio.com  →  TU_VPS_IP
```
Espera a que propague (`ping talkii.tudominio.com` debe resolver a tu IP).

### 6.2 Configurar Nginx
```bash
sudo nano /etc/nginx/sites-available/talkii
```
```nginx
server {
    server_name talkii.tudominio.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/talkii /etc/nginx/sites-enabled/talkii
sudo nginx -t && sudo systemctl reload nginx
```

### 6.3 Certificado TLS (Let's Encrypt)
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d talkii.tudominio.com
```
Certbot edita el `server` para servir en HTTPS y renueva solo. Verifica:
`https://talkii.tudominio.com` debe cargar la home de Talkii.

### 6.4 Firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 7. Webhook de WhatsApp (cuando exista el endpoint)

WhatsApp Cloud API exige HTTPS público. Una vez implementado el endpoint
(`app/api/whatsapp/webhook`), configúralo en Meta:
- **Callback URL:** `https://talkii.tudominio.com/api/whatsapp/webhook`
- **Verify token:** el valor que definas en `.env.local`.

El `SUPABASE_SERVICE_ROLE_KEY` (que salta RLS) solo debe usarse en estos handlers
de sistema del servidor, nunca en código que llegue al navegador.

---

## 8. Actualizar una versión (redeploy)

```bash
cd ~/Talkii
git pull
npm ci
npm run build
pm2 restart talkii
```

Para cambios de esquema: crea `supabase/migrations/000X_*.sql` y aplícalo (paso 1.1)
**antes** de reiniciar la app.

---

## 9. Checklist de verificación

- [ ] `npm run test` → 22/22 verde.
- [ ] `npm run build` → compila sin errores.
- [ ] `pm2 status` → `talkii` en `online`.
- [ ] `https://talkii.tudominio.com` responde con TLS válido.
- [ ] Las 7 tablas existen en Supabase con RLS activo.
- [ ] `.env.local` está en el VPS y **no** en git.
- [ ] Un usuario sin `tenant_id` en su JWT no ve datos de otros tenants.

---

## Notas de arquitectura

- El cliente Supabase de `infrastructure/supabase/client.ts` es **agnóstico de
  Next.js**: recibe el `accessToken` del usuario para que RLS aísle por tenant. El
  wiring con la request (cookies/sesión) se hará en la capa `app`.
- La regla de errores de los repos es **explícita**: un fallo de infraestructura
  lanza `Error`; "no existe" devuelve `null`. Nada se traga en silencio.
- Alternativa gestionada: este mismo repo puede desplegarse en Vercel conectando el
  GitHub y definiendo las mismas variables de entorno; esta guía cubre el VPS propio.
