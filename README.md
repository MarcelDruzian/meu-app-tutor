# 🎓 Tutor IA — Assistente Inteligente de Estudos

Este projeto nasceu como um aplicativo mobile-first para apoiar estudantes com explicações didáticas, revisões rápidas e questionários práticos. Ele já funciona localmente, com suporte a IA em tempo real quando há chave configurada, e agora está sendo preparado para a próxima fase: autenticação real e persistência de dados de usuário.

---

## ✅ Estado atual do projeto

### Etapa concluída: protótipo funcional e IA conectada

O app já oferece:

- navegação entre telas e fluxo de estudo completo
- seleção de formato de aprendizado: texto, vídeo e áudio
- coleta de dados do estudo e validação de formulário
- explicação didática com estrutura pedagógica
- questionário interativo com feedback por alternativa
- histórico local e metas diárias
- conta do estudante em modo visitante e autenticação inicial
- integração com Google Gemini/OpenAI via backend em Node
- fallback didático para manter a experiência funcional mesmo sem chave de IA

### Etapa em andamento: autenticação e persistência real

A base para a próxima etapa foi iniciada com:

- endpoints de autenticação em [server.js](server.js)
- token de sessão guardado apenas como hash (SHA-256) em JSON local
- registro e login com e-mail e senha
- estrutura de persistência por arquivo JSON para usuários e registros
- integração inicial no frontend com [public/js/services/auth.js](public/js/services/auth.js)

> Importante: isso ainda é uma base sólida para evoluir para Supabase, mas já deixa a aplicação com autenticação real em nível de API, sem depender somente do localStorage do navegador.

---

## 📁 Estrutura principal do projeto

```text
c:\dev\App_Estudo/
├── package.json
├── server.js
├── .env                  (local, não versionado)
├── .env.example
├── README.md
├── src/
│   ├── ai.js             (cliente Gemini/OpenAI)
│   ├── prompts.js
│   ├── rateLimit.js
│   └── storage/          (camada de dados; veja src/storage/README.md)
├── tests/                (npm test)
├── data/                 (não versionado: users.json e auth.json)
├── public/
│   ├── icons/
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js
│   ├── css/
│   │   ├── variables.css
│   │   ├── style.css
│   │   └── responsive.css
│   └── js/
│       ├── app.js
│       ├── data/
│       │   └── demoData.js
│       └── services/
│           ├── auth.js
│           ├── speech.js
│           ├── storage.js
│           └── tutor.js
└── README.md
```

---

## ▶️ Como executar

No terminal, dentro da pasta do projeto:

```powershell
cd c:\dev\App_Estudo
npm start
```

O app será servido localmente, normalmente em:

- `http://localhost:3000`
- ou `http://localhost:3001` se a porta 3000 estiver ocupada

Em ambiente local, o navegador padrão será aberto automaticamente ao iniciar o servidor. Para desativar esse comportamento, configure `OPEN_BROWSER=false` no arquivo `.env`. Em produção ou CI, a abertura automática fica desativada por padrão.

Para abrir no celular, conecte o celular e o PC à mesma rede Wi-Fi e use o endereço
marcado como `Wi-Fi` no terminal, por exemplo `http://192.168.1.10:3000`. O servidor
usa `HOST=0.0.0.0` por padrão para aceitar conexões da rede local; se definir `HOST`
no `.env`, mantenha esse valor para acesso pelo celular. Não use endereços de
adaptadores virtuais (como VMware). Se o servidor já estiver rodando na
porta configurada, uma nova inicialização detecta a instância existente em vez de
abrir outra porta.

Se a página não abrir, confirme que a rede Wi-Fi do Windows está definida como privada.
O Firewall precisa permitir a porta ativa do servidor. Para autorizar somente conexões
da rede local nas portas padrão e alternativas, execute o comando abaixo em um
PowerShell como administrador:

```powershell
New-NetFirewallRule -DisplayName "Tutor IA (portas 3000-3010)" -Direction Inbound -Protocol TCP -LocalPort 3000-3010 -Action Allow -Profile Private -RemoteAddress LocalSubnet
```

Se quiser rodar direto com Node:

```powershell
node server.js
```

---

## 🤖 Como ativar a IA real

Crie um arquivo `.env` na pasta do projeto com a seguinte estrutura:

```env
GEMINI_API_KEY=sua_chave_aqui
PORT=3000
```

Ou, se preferir usar OpenAI:

```env
OPENAI_API_KEY=sua_chave_aqui
PORT=3000
```

Sem a chave, o app continua em modo de demonstração com explicações e questionários locais.

## 🔐 Segurança e limites de requisições

As senhas são armazenadas com `scrypt` e salt individual. Senhas SHA-256 existentes são atualizadas automaticamente após o primeiro login bem-sucedido. O cadastro exige e-mail válido e senha com pelo menos 8 caracteres.

O backend limita o corpo JSON a 100 KB e aplica limites em memória por IP nos endpoints de autenticação (10 requisições por 15 minutos) e por usuário autenticado, ou IP quando não autenticado, nos endpoints do tutor (30 requisições por hora). Os limites podem ser ajustados por estas variáveis de ambiente:

As chamadas do frontend ao tutor incluem o token de sessão quando há login, para aplicar a cota por usuário; visitantes continuam limitados por IP.

```env
AUTH_RATE_LIMIT_MAX_REQUESTS=10
AUTH_RATE_LIMIT_WINDOW_MS=900000
TUTOR_RATE_LIMIT_MAX_REQUESTS=30
TUTOR_RATE_LIMIT_WINDOW_MS=3600000
TRUST_PROXY=false
```

Atrás de proxy, `TRUST_PROXY` é ligado automaticamente nas plataformas de nuvem conhecidas; use `TRUST_PROXY_HOPS=1` (ou o número de proxies) para considerar apenas o IP acrescentado pelo proxy, que o cliente não consegue forjar. Fora de nuvem, defina `TRUST_PROXY=true` somente com um proxy confiável que envie `X-Forwarded-For`. Como o limitador é mantido em memória, seus contadores são reiniciados quando o processo reinicia e não são compartilhados entre instâncias.

---

## 🧪 Testes

```powershell
npm test
```

Sobe o servidor de verdade em portas livres, com dados temporários e uma IA simulada (nenhuma chave é usada). Os testes de encerramento por SIGTERM/SIGINT são pulados no Windows (o Node não entrega esses sinais lá como em Linux); eles rodam no CI em Linux.

---

## ☁️ Deploy (URL pública, sem depender de IP/host)

O app é um único processo Node sem dependências: em Render, Railway, Fly.io etc. basta apontar o repositório.

| Item | Valor |
|---|---|
| Build command | vazio (ou `npm install`) |
| Start command | `npm start` |
| Node | 18 ou superior |
| Health check | `GET /api/status` |

**Variáveis de ambiente** (veja `.env.example`): `GEMINI_API_KEY` (ou `OPENAI_API_KEY`), `DATA_DIR`, e opcionalmente `GEMINI_MODEL`, `AI_TIMEOUT_MS`, `AI_RETRY_ATTEMPTS`, `AI_BACKOFF_MS`, `TRUST_PROXY_HOPS`. `PORT` a plataforma define sozinha; `TRUST_PROXY` liga sozinho em nuvem.

> ⚠️ **Persistência:** usuários e sessões ficam em arquivos JSON dentro de `DATA_DIR`. Em disco efêmero (padrão da maioria dos planos), esses arquivos são **apagados a cada deploy/reinício**. Anexe um volume persistente à plataforma, aponte `DATA_DIR` para o ponto de montagem (ex.: `/var/data`) e use uma única instância. Para várias instâncias, migre para um banco (veja `src/storage/README.md`).

**Diagnóstico da IA:** `GET /api/status` mostra provedor, modelo, se há chave (nunca a chave), `fallback` (a última chamada de IA falhou?) e `lastAiCall.error`. Os motivos detalhados de cada falha aparecem nos logs da plataforma. Modelo padrão do Gemini: `gemini-3.8-flash`; troque por `GEMINI_MODEL` quando o Google atualizar.

**Atualizações do PWA:** o Service Worker usa "rede primeiro", então novos deploys chegam sozinhos. Se alterar arquivos estáticos, aumente `CACHE_VERSION` em `public/sw.js`.

---

## 🗺️ Plano de evolução

### Etapa 1 — Protótipo funcional
- concluída
- fluxo completo de estudo, histórico e questionários

### Etapa 2 — IA conectada
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
