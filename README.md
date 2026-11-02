# 🎓 Tutor IA — Assistente Inteligente de Estudos

Tutor IA é uma aplicação web mobile-first para estudantes que querem aprender com explicações didáticas, reforço prático e questionários guiados. O produto foi pensado para funcionar como um tutor pessoal: o estudante escolhe um tema, recebe uma explicação estruturada, pode ouvir ou visualizar o conteúdo e praticar com exercícios.

O projeto já está em um estágio funcional, com suporte a IA em tempo real quando a chave do provedor está configurada, e também com fallback local para garantir que a experiência continue útil mesmo sem provedor externo.

---

## ✅ Estado atual

### O que já funciona

- fluxo completo de estudo: curso, disciplina, assunto e dúvida
- explicações didáticas em formato texto, áudio e vídeo
- questionários interativos com feedback por alternativa
- histórico de estudo e progresso
- persistência básica do usuário com autenticação no backend
- integração com Google Gemini/OpenAI via Node.js
- fallback local em casos de falha da IA ou ausência de chave
- status de saúde da aplicação via endpoint de diagnóstico
- compatibilidade com deploy em Render e outras plataformas Node

### Maturidade atual

O app está em um estágio de MVP funcional com foco em produto útil para entrega prática. A IA é um complemento forte e opcional, mas o sistema não depende dela para continuar funcionando.

---

## 🏗️ Arquitetura geral

O projeto tem uma arquitetura simples e direta:

- Frontend em HTML/CSS/JS estático, servido pelo Node
- Backend em `server.js`
- Cliente de IA em `src/ai.js`
- Camada de persistência em `src/storage/`
- Autenticação e sessões por arquivo JSON, com proteção e rate limiting
- Fallback planejado para manter a experiência educacional mesmo sem provedor externo

---

## 📁 Estrutura do projeto

```text
C:\dev\App_Estudo_pronto_para_nuvem
├── .env.example
├── .env                      # local apenas; não versionado
├── README.md
├── package.json
├── package-lock.json
├── server.js
├── public/
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js
│   ├── css/
│   │   ├── responsive.css
│   │   ├── style.css
│   │   └── variables.css
│   └── js/
│       ├── app.js
│       ├── data/
│       │   └── demoData.js
│       └── services/
│           ├── auth.js
│           ├── speech.js
│           ├── storage.js
│           └── tutor.js
├── src/
│   ├── ai.js
│   ├── prompts.js
│   ├── rateLimit.js
│   └── storage/
│       ├── index.js
│       ├── jsonStorage.js
│       └── README.md
├── tests/
│   └── app.test.js
├── data/                    # gerado em runtime; não versionado em produção
└── .gitignore
```

---

## ▶️ Como executar localmente

Pré-requisitos:

- Node.js 18 ou superior
- npm

Instale dependências:

```powershell
npm install
```

Inicie a aplicação:

```powershell
npm start
```

A aplicação normalmente abre em:

- `http://localhost:3000`
- ou outra porta disponível, caso 3000 esteja ocupada

Se quiser rodar diretamente com Node:

```powershell
node server.js
```

### Sobre a rede local e o celular

Para abrir a aplicação em um celular conectado à mesma rede Wi-Fi:

- certifique-se de que o PC e o celular estão na mesma rede
- use o IP da máquina no formato `http://192.168.x.x:3000`
- mantenha `HOST=0.0.0.0` para aceitar conexões locais

Em Windows, se a página não abrir, pode ser necessário permitir o Node pela rede privada do Firewall:

```powershell
New-NetFirewallRule -DisplayName "Tutor IA (portas 3000-3010)" -Direction Inbound -Protocol TCP -LocalPort 3000-3010 -Action Allow -Profile Private -RemoteAddress LocalSubnet
```

---

## 🔐 Configuração de ambiente

Crie um arquivo `.env` na raiz do projeto com base no template `.env.example`.

Exemplo mínimo:

```env
HOST=0.0.0.0
PORT=3000
TRUST_PROXY=true
DATA_DIR=/tmp/data
STORAGE_DRIVER=json
AI_BACKOFF_MS=1000
AI_RETRY_ATTEMPTS=3
AI_TIMEOUT_MS=30000
```

Para ativar a IA real do Google Gemini:

```env
GEMINI_API_KEY=sua_chave_aqui
GEMINI_MODEL=gemini-3.5-flash-lite
```

Também é possível usar OpenAI:

```env
OPENAI_API_KEY=sua_chave_aqui
OPENAI_MODEL=gpt-4o-mini
```

Se a chave não estiver configurada, o app entra em modo de demonstração com conteúdo didático local.

---

## 🤖 Como a IA funciona

O backend usa um cliente centralizado em `src/ai.js` para:

- verificar se a chave do provedor existe
- escolher o provedor e o modelo ativos
- enviar a requisição com timeout e retry
- interpretar respostas JSON
- classificar falhas em códigos internos
- registrar a causa real da falha
- ativar fallback local quando necessário

Os códigos de falha incluem valores como:

- `GEMINI_AUTH_ERROR`
- `GEMINI_MODEL_NOT_FOUND`
- `GEMINI_RATE_LIMIT`
- `GEMINI_TIMEOUT`
- `GEMINI_NETWORK_ERROR`
- `GEMINI_INVALID_RESPONSE`

A aplicação expõe um endpoint de diagnóstico em `/api/status` e `/api/ai/diagnostic` para verificar o estado real da integração.

---

## 🔒 Segurança e limites

O projeto já implementa algumas medidas importantes:

- senhas armazenadas com `scrypt`
- migração automática de senhas antigas em SHA-256
- rate limiting em autenticação e tutor
- validação de payloads e limite de tamanho em JSON
- proteção contra entradas anômalas e uso de tokens em cabeçalho
- hash de sessão e não armazenamento do token em texto puro

Variáveis relevantes:

```env
AUTH_RATE_LIMIT_MAX_REQUESTS=10
AUTH_RATE_LIMIT_WINDOW_MS=900000
TUTOR_RATE_LIMIT_MAX_REQUESTS=30
TUTOR_RATE_LIMIT_WINDOW_MS=3600000
TRUST_PROXY=false
```

Em ambiente cloud, `TRUST_PROXY` é habilitado automaticamente quando detecta proxy/provedor compatível.

---

## 🧪 Testes automatizados

Para rodar a suíte:

```powershell
npm test
```

Os testes validam:

- servidor básico
- autenticação
- rate limiting
- integração com IA simulada
- ciclo de vida do processo
- persistência de usuários e progresso

> Os testes usam um servidor real em porta livre e simulam a API do Gemini, sem usar chave real.

---

## ☁️ Deploy em produção

Este app é um processo Node único, então funciona bem em Render, Railway, Fly.io e plataformas similares.

Configuração típica no Render:

- Build command: `npm install`
- Start command: `npm start`
- Node: 18+
- Health check: `GET /api/status`

Variáveis de ambiente recomendadas no painel da plataforma:

```env
HOST=0.0.0.0
PORT=10000
TRUST_PROXY=true
DATA_DIR=/tmp/data
STORAGE_DRIVER=json
GEMINI_API_KEY=sua_chave_real
GEMINI_MODEL=gemini-3.5-flash-lite
AI_BACKOFF_MS=1000
AI_RETRY_ATTEMPTS=3
AI_TIMEOUT_MS=30000
```

### Persistência em nuvem

O armazenamento atual usa JSON em disco. Isso funciona em ambiente simples, mas em plataformas efêmeras ou com reinicialização frequente, dados podem ser apagados. Para produção mais robusta, o ideal é migrar para:

- banco relacional ou NoSQL
- armazenamento persistente do provedor
- filesystem volume do host ou serviço especializado

---

## 🗺️ Roadmap

### Etapa 1 — Prototipação e fluxo de estudo
- concluída

### Etapa 2 — IA conectada e fallback funcional
- concluída

### Etapa 3 — Autenticação e persistência real
- em evolução

### Etapa 4 — Dashboard e progresso do aluno
- em planejamento

### Etapa 5 — Sincronização e deploy de produção
- em planejamento

### Etapa 6 — Expansão para materiais avançados
- futuro

---

## 🧭 Observações importantes

- a plataforma pode funcionar sem IA externa
- o fallback local mantém a experiência útil e educativa
- a autenticação real foi instalada no backend para preparação de produção
- o objetivo é manter o produto útil mesmo quando o provedor externo falha
- a IA é complementar, não bloqueante

---

## 📌 Dica final

O estado atual do projeto já é uma base sólida para entrega funcional em curto prazo. O foco agora é deixar a experiência mais estável, melhorar o dashboard do aluno e consolidar a implantação em Render com monitoramento real do status da IA.

Se você quiser evoluir o projeto de forma prática, os próximos passos mais estratégicos são:

1. validar a IA real em produção
2. estabilizar o dashboard do aluno
3. reforçar a persistência de progresso e histórico por usuário
4. preparar a checklist final de deploy e operação no Render
ectada
- concluída
- backend com integrações reais e fallbacks

### Etapa 3 — Autenticação e persistência real
- em desenvolvimento
- login e registro com backend e token
- armazenamento real do usuário e registros por arquivo JSON
- base pronta para migrar para Supabase ou outra API persistente

### Etapa 4 — Sincronização em nuvem
- sincronizar histórico, progresso e usuários entre dispositivos

### Etapa 5 — Materiais avançados
- upload de PDFs, anotações e análise pedagógica

### Etapa 6 — Publicação e produção
- deploy em plataforma com domínio e ambiente seguro (guia na seção Deploy)

---

## 🧭 Observações importantes

- O histórico local continua funcionando no navegador.
- A autenticação real foi iniciada no backend para preparar a próxima etapa de produção.
- O app mantém compatibilidade com o modo visitante e com fallback didático.
- O projeto foi pensado para evolução gradual, sem quebrar o que já funciona.
