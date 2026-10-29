// ==========================================================
// TUTOR IA - SELETOR DE STORAGE
// Escolhe o driver pela variável STORAGE_DRIVER (padrão: "json").
//
// Interface que todo driver deve implementar (todos os métodos são assíncronos):
//   init()                              prepara o driver (conexão, criação de tabelas/arquivos)
//   findUserByEmail(email)              -> User | null
//   findUserById(id)                    -> User | null
//   createUser(user)                    -> User   (lança erro com code "EMAIL_EXISTS" se duplicado)
//   updateUser(id, patch)               -> User | null
//   createSession({ token, userId, createdAt, expiresAt })   (guarde só o HASH do token)
//   findSession(token)                  -> { userId, createdAt, expiresAt } | null (já ignora expiradas)
//   deleteSession(token)
//   deleteExpiredSessions()             -> número removido
//   close()                             finaliza gravações pendentes
//
// User: { id, name, email, passwordHash, createdAt }
// ==========================================================
import path from 'node:path';

/**
 * @param {{ driver?: string, dataDir?: string, logger?: Pick<Console,'log'|'warn'|'error'> }} [options]
 */
export async function createStorage(options = {}) {
  const driver = String(options.driver || process.env.STORAGE_DRIVER || 'json').trim().toLowerCase();

  switch (driver) {
    case 'json': {
      const { createJsonStorage } = await import('./jsonStorage.js');
      const dataDir = path.resolve(options.dataDir || process.env.DATA_DIR || './data');
      const storage = createJsonStorage({ dataDir, logger: options.logger || console });
      await storage.init();
      storage.dataDir = dataDir;
      return storage;
    }
    default:
      throw new Error(`STORAGE_DRIVER desconhecido: "${driver}". Drivers disponíveis: json.`);
  }
}
