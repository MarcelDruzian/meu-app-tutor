# Camada de storage

O servidor só conversa com a interface descrita em `index.js`. Nenhuma rota acessa
arquivos diretamente.

## Drivers

| Driver | Variável | Observação |
|---|---|---|
| `json` (padrão) | `STORAGE_DRIVER=json` | Arquivos em `DATA_DIR` (padrão `./data`). Uma instância só. |

Na nuvem, aponte `DATA_DIR` para um **volume persistente** (ex.: `/var/data`). Em disco
efêmero, usuários e sessões são perdidos a cada deploy/reinício.

## Como criar um novo driver (ex.: Postgres/Supabase, SQLite)

1. Crie `src/storage/meuDriver.js` exportando `createMeuDriver(options)` que devolva um objeto
   com todos os métodos listados em `index.js`.
2. Registre no `switch` de `createStorage` em `index.js`:
   ```js
   case 'postgres': {
     const { createPostgresStorage } = await import('./postgresStorage.js');
     const storage = createPostgresStorage({ url: process.env.DATABASE_URL });
     await storage.init();
     return storage;
   }
   ```
3. Defina `STORAGE_DRIVER=postgres` no ambiente.

Regras que todo driver deve respeitar:

- `createUser` precisa ser atômico e lançar erro com `code = "EMAIL_EXISTS"` para e-mail duplicado
  (e-mails são comparados em minúsculas).
- Guarde apenas o **hash SHA-256 do token** de sessão, nunca o token em texto puro.
- `findSession` devolve `null` para sessões expiradas.
- Os métodos devolvem cópias, nunca referências internas mutáveis.
