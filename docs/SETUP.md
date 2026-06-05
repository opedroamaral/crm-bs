# Guia de Configuração — CRM WhatsApp

## O que você precisa (antes de começar)
- Conta no GitHub (gratuito) — github.com
- Conta no Railway — railway.app → plano Hobby (~US$5/mês)
- 3 números de WhatsApp (um por atendente)

---

## Passo 1 — Subir o repositório no GitHub

1. Acesse github.com e crie um **novo repositório privado** chamado `crm-bs`.
2. No terminal do seu computador, dentro da pasta `crm-bs`, rode:

```bash
git init
git add .
git commit -m "feat: setup inicial CRM"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/crm-bs.git
git push -u origin main
```

---

## Passo 2 — Criar o projeto no Railway

1. Acesse railway.app e faça login.
2. Clique em **New Project → Deploy from GitHub repo**.
3. Autorize o Railway a acessar sua conta GitHub e selecione o repositório `crm-bs`.

---

## Passo 3 — Adicionar PostgreSQL e Redis

No projeto Railway:
1. Clique em **+ New Service → Database → PostgreSQL**. Aguarde criar.
2. Clique em **+ New Service → Database → Redis**. Aguarde criar.

Copie as connection strings (você vai precisar delas):
- PostgreSQL: clique no serviço → **Connect** → copie `DATABASE_URL`
- Redis: clique no serviço → **Connect** → copie `REDIS_URL`

---

## Passo 4 — Subir o Chatwoot

1. No Railway, clique em **+ New Service → Docker Image**.
2. Imagem: `chatwoot/chatwoot:latest`
3. Clique em **Variables** e adicione:

```
SECRET_KEY_BASE=<gere com: openssl rand -hex 64>
DATABASE_URL=<cole o DATABASE_URL do PostgreSQL>
REDIS_URL=<cole o REDIS_URL do Redis>
FRONTEND_URL=https://<dominio-gerado-pelo-railway>.up.railway.app
DEFAULT_LOCALE=pt_BR
RAILS_ENV=production
NODE_ENV=production
```

4. Em **Settings → Networking**, gere um domínio público.
5. Anote a URL gerada (ex: `https://crm-chatwoot.up.railway.app`).

**Criar banco Chatwoot:**
No serviço Chatwoot → **Shell** → rode:
```bash
bundle exec rails db:chatwoot_prepare
```

6. Repita o serviço, mas com Command: `bundle exec sidekiq -C config/sidekiq.yml` — este é o worker. Mesmas variáveis de ambiente.

---

## Passo 5 — Subir a Evolution API

1. **+ New Service → Docker Image**: `atendai/evolution-api:latest`
2. Variables:

```
SERVER_URL=https://<dominio-evolution>.up.railway.app
AUTHENTICATION_API_KEY=<crie uma senha forte>
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=<DATABASE_URL>
REDIS_URI=<REDIS_URL>
CHATWOOT_ENABLED=true
```

3. Gere domínio público. Anote a URL e a API Key.

---

## Passo 6 — Subir o Módulo de Vendas

1. **+ New Service → GitHub Repo** → selecione `crm-bs`.
2. Em **Settings → Root Directory**, coloque: `sales-module`
3. Variables:

```
DATABASE_URL=<mesmo DATABASE_URL do PostgreSQL>
CHATWOOT_URL=https://<url-do-chatwoot>
JWT_SECRET=<gere com: openssl rand -hex 32>
PORT=3000
NODE_ENV=production
```

4. Gere domínio público. Anote a URL (ex: `https://crm-vendas.up.railway.app`).

---

## Passo 7 — Configurar o Chatwoot

### Criar conta admin
1. Acesse a URL do Chatwoot → **Create a new account**.
2. Nome: "Bruno Simplício", e-mail, senha forte.

### Criar as 3 atendentes
1. **Settings → Agents → Invite Agent** (repita 3x).
2. Cada atendente recebe um e-mail de convite com link para definir senha.

### Criar as 3 Inboxes (uma por número)
1. **Settings → Inboxes → Add Inbox → API**.
2. Nome: "Atendente 1 — [Nome]", escolha o agente responsável.
3. Repita para cada atendente.
4. Guarde o **Inbox ID** e o **Access Token** de cada inbox (você vai precisar na próxima etapa).

---

## Passo 8 — Conectar WhatsApp via Evolution API

Para cada número de WhatsApp (repita 3x):

### Criar instância

```bash
curl -X POST https://<URL-EVOLUTION>/instance/create \
  -H "apikey: <SUA_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "atendente1",
    "integration": "WHATSAPP-BAILEYS",
    "chatwoot_account_id": "1",
    "chatwoot_token": "<ACCESS_TOKEN_DA_INBOX>",
    "chatwoot_url": "https://<URL-CHATWOOT>",
    "chatwoot_sign_msg": false,
    "chatwoot_reopen_conversation": true,
    "chatwoot_conversation_pending": false
  }'
```

### Conectar via QR Code

```bash
curl https://<URL-EVOLUTION>/instance/connect/atendente1 \
  -H "apikey: <SUA_API_KEY>"
```

A resposta traz um QR code em base64. Para visualizar:
1. Cole o base64 em: base64.guru/converter/decode/image
2. Escaneie o QR code com o WhatsApp da atendente (igual conectar WhatsApp Web).

Repita para `atendente2` e `atendente3`.

---

## Passo 9 — Configurar painel de vendas no Chatwoot

1. No Chatwoot: **Settings → Integrations → Custom Integration**.
2. Clique em **New Integration**.
3. Preencha:
   - **Name**: Registro de Vendas
   - **Description**: Registrar e ver vendas desta conversa
   - **URL**: `https://<URL-MODULO-VENDAS>/panel.html`
4. Salve. Agora toda conversa terá um painel lateral com o botão "Registrar Venda".

---

## Passo 10 — Configurar tags e respostas rápidas

### Tags sugeridas (Settings → Labels)
- `lead-novo`
- `qualificado`
- `proposta-enviada`
- `objecao-preco`
- `interessada-bussola`
- `interessada-eden`
- `fechou`
- `perdido`

### Respostas rápidas (Settings → Canned Responses)
Crie respostas prontas para:
- Abertura padrão
- Envio do link de pagamento
- Quebra de objeção de preço
- Confirmação de venda

---

## Como usar no dia a dia

### Atendentes
1. Acesse `https://<URL-MODULO-VENDAS>` → login com e-mail/senha do Chatwoot.
2. Responda conversas normalmente no Chatwoot.
3. Ao fechar uma venda, clique em **"Registro de Vendas"** no painel lateral da conversa → **"Registrar Venda"** → preencha produto e valor.
4. Veja suas próprias vendas e metas em **"Minhas Vendas"**.

### Admin (Bruno)
1. Acesse `https://<URL-MODULO-VENDAS>/dashboard.html` → login como administrador.
2. Filtre por período para ver ranking, totais e vendas por produto.
3. Defina metas mensais na seção **"Metas"** do dashboard.
4. No Chatwoot: veja todas as conversas de todas as atendentes no painel unificado.

---

## Adicionar ou remover atendente

**Adicionar:**
1. Chatwoot → Settings → Agents → Invite Agent.
2. Evolution API: criar nova instância e conectar QR code.

**Remover:**
1. Chatwoot → Settings → Agents → desativar conta.
2. Evolution API: `DELETE /instance/delete/<nome-instancia>`.

---

## Custos estimados (Railway)

| Serviço          | RAM estimada | Custo/mês |
|------------------|-------------|-----------|
| PostgreSQL       | 512 MB      | ~$3       |
| Redis            | 256 MB      | ~$1       |
| Chatwoot Web     | 512 MB      | ~$3       |
| Chatwoot Worker  | 256 MB      | ~$2       |
| Evolution API    | 256 MB      | ~$2       |
| Módulo de Vendas | 128 MB      | ~$1       |
| **Total**        |             | **~$12**  |

---

## Problemas comuns

**Chatwoot não inicia:** verifique se rodou `bundle exec rails db:chatwoot_prepare` no shell do serviço.

**QR code expirou:** rode o endpoint `/instance/connect/<nome>` novamente e escaneie rápido (validade ~60s).

**Mensagens não chegam no Chatwoot:** verifique se o `chatwoot_token` usado na instância Evolution é o Access Token correto da inbox correspondente.

**Login no módulo de vendas dá erro:** confirme que `CHATWOOT_URL` está apontando para a URL correta do Chatwoot (sem barra no final).
