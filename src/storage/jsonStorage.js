// ==========================================================
// TUTOR IA - STORAGE EM ARQUIVOS JSON (driver "json")
// ----------------------------------------------------------
// - Usuários em <DATA_DIR>/users.json e sessões em <DATA_DIR>/auth.json.
// - Os dados ficam em memória (Maps) e são gravados no disco a cada alteração.
// - Escrita atômica (arquivo temporário + rename) e fila de escrita única,
//   para que requisições concorrentes nunca corrompam os arquivos.
// - O token de sessão NUNCA é guardado em texto puro: apenas o SHA-256 dele.
// - Pensado para UMA instância do servidor. Para várias instâncias, crie um
//   novo driver (veja src/storage/README.md).
// ==========================================================
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

/** @typedef {{ id: string, name: string, email: string, passwordHash: string, createdAt: string }} User */
/** @typedef {{ token: string, userId: string, createdAt: string, expiresAt: string }} Session */

const normalizeEmail = value => String(value || '').trim().toLowerCase();
const hashToken = token => crypto.createHash('sha256').update(String(token)).digest('hex');
const clone = value => (value === null || value === undefined ? null : structuredClone(value));

/**
 * @param {{ dataDir: string, logger?: Pick<Console, 'log'|'warn'|'error'> }} options
 */
export function createJsonStorage({ dataDir, logger = console }) {
  const usersFile = path.join(dataDir, 'users.json');
  const sessionsFile = path.join(dataDir, 'auth.json');

  /** @type {Map<string, User>} */
  const usersById = new Map();
  /** @type {Map<string, string>} email normalizado -> id */
  const userIdByEmail = new Map();
  /** @type {Map<string, { tokenHash: string, userId: string, createdAt: string, expiresAt: string }>} */
  const sessionsByHash = new Map();

  // Fila única de escrita: cada gravação só começa quando a anterior terminou.
  let writeChain = Promise.resolve();
  function enqueue(task) {
    const run = writeChain.then(task);
    writeChain = run.catch(() => {});
    return run;
  }

  async function writeAtomic(filePath, content) {
    const tmpPath = `${filePath}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    try {
      await fsp.writeFile(tmpPath, content, 'utf8');
      await fsp.rename(tmpPath, filePath);
    } catch (error) {
      await fsp.rm(tmpPath, { force: true }).catch(() => {});
      throw error;
    }
  }

  const persistUsers = () => enqueue(() => writeAtomic(usersFile, JSON.stringify([...usersById.values()], null, 2)));
  const persistSessions = () => enqueue(() => writeAtomic(sessionsFile, JSON.stringify([...sessionsByHash.values()], null, 2)));

  // Lê um arquivo JSON (array). Se estiver corrompido, guarda uma cópia
  // ".corrupt-<data>" para não perder nada e segue com lista vazia, sem derrubar o servidor.
  function loadArray(filePath) {
    if (!fs.existsSync(filePath)) {
      return { items: [], created: true };
    }

    let raw = '';
    try {
      raw = fs.readFileSync(filePath, 'utf8');
      const parsed = raw.trim() ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) {
        throw new Error('o conteúdo não é uma lista (array) JSON');
      }
      return { items: parsed, created: false };
    } catch (error) {
      const backupPath = `${filePath}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}`;
      try {
        fs.copyFileSync(filePath, backupPath);
        logger.error(`❌ Arquivo de dados inválido (${path.basename(filePath)}): ${error.message}. Cópia salva em ${path.basename(backupPath)}; iniciando com dados vazios para este arquivo.`);
      } catch (copyError) {
        logger.error(`❌ Arquivo de dados inválido (${path.basename(filePath)}): ${error.message}. Não foi possível salvar uma cópia: ${copyError.message}`);
      }
      return { items: [], created: false };
    }
  }

  function indexUser(user) {
    usersById.set(user.id, user);
    userIdByEmail.set(normalizeEmail(user.email), user.id);
  }

  return {
    driver: 'json',

    /** Carrega os arquivos (criando diretório/arquivos se não existirem) e migra dados antigos. */
    async init() {
      fs.mkdirSync(dataDir, { recursive: true });

      const users = loadArray(usersFile);
      for (const user of users.items) {
        if (user && typeof user.id === 'string' && typeof user.email === 'string') {
          indexUser(user);
        }
      }

      const sessions = loadArray(sessionsFile);
      let migratedLegacy = 0;
      for (const item of sessions.items) {
        if (!item || typeof item.userId !== 'string' || !item.expiresAt) continue;
        // Formato antigo guardava o token em texto puro: converte para hash e descarta o texto.
        const tokenHash = item.tokenHash || (typeof item.token === 'string' ? hashToken(item.token) : null);
        if (!tokenHash) continue;
        if (!item.tokenHash) migratedLegacy += 1;
        sessionsByHash.set(tokenHash, {
          tokenHash,
          userId: item.userId,
          createdAt: item.createdAt,
          expiresAt: item.expiresAt
        });
      }

      // Garante que os arquivos existam (e regrava sessões migradas sem o token em texto puro).
      if (users.created) await persistUsers();
      if (sessions.created || migratedLegacy > 0) await persistSessions();
      if (migratedLegacy > 0) {
        logger.log(`🔐 ${migratedLegacy} sessão(ões) antiga(s) convertida(s) para armazenamento com hash.`);
      }
      await this.deleteExpiredSessions();
    },

    /** @returns {Promise<User|null>} */
    async findUserByEmail(email) {
      const id = userIdByEmail.get(normalizeEmail(email));
      return id ? clone(usersById.get(id)) : null;
    },

    /** @returns {Promise<User|null>} */
    async findUserById(id) {
      return clone(usersById.get(id));
    },

    /**
     * Cria um usuário. Lança erro com code "EMAIL_EXISTS" se o e-mail já estiver cadastrado
     * (a verificação e a inserção acontecem no mesmo passo, sem corrida entre requisições).
     * @param {User} user
     * @returns {Promise<User>}
     */
    async createUser(user) {
      const email = normalizeEmail(user.email);
      if (userIdByEmail.has(email)) {
        const error = new Error('E-mail já cadastrado.');
        error.code = 'EMAIL_EXISTS';
        throw error;
      }
      const stored = { ...user, email };
      indexUser(stored);
      await persistUsers();
      return clone(stored);
    },

    /**
     * @param {string} id
     * @param {Partial<User>} patch
     * @returns {Promise<User|null>}
     */
    async updateUser(id, patch) {
      const current = usersById.get(id);
      if (!current) return null;
      const { id: _ignoredId, email: _ignoredEmail, ...safePatch } = patch || {};
      Object.assign(current, safePatch);
      await persistUsers();
      return clone(current);
    },

    /** Guarda a sessão usando apenas o hash do token. @param {Session} session */
    async createSession(session) {
      sessionsByHash.set(hashToken(session.token), {
        tokenHash: hashToken(session.token),
        userId: session.userId,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt
      });
      await persistSessions();
    },

    /** Retorna a sessão válida (não expirada) para o token, ou null. */
    async findSession(token) {
      if (!token) return null;
      const session = sessionsByHash.get(hashToken(token));
      if (!session || !(new Date(session.expiresAt) > new Date())) return null;
      return { userId: session.userId, createdAt: session.createdAt, expiresAt: session.expiresAt };
    },

    async deleteSession(token) {
      if (sessionsByHash.delete(hashToken(token))) {
        await persistSessions();
      }
    },

    /** @returns {Promise<number>} quantidade removida */
    async deleteExpiredSessions() {
      const now = new Date();
      let removed = 0;
      for (const [hash, session] of sessionsByHash) {
        if (!(new Date(session.expiresAt) > now)) {
          sessionsByHash.delete(hash);
          removed += 1;
        }
      }
      if (removed > 0) await persistSessions();
      return removed;
    },

    /** Aguarda as gravações pendentes (usado no encerramento do servidor). */
    async close() {
      await writeChain;
    }
  };
}
