// Testa a lógica do Service Worker em um ambiente simulado (sem navegador).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const swSource = fs.readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8');

function loadServiceWorker({ network = () => new Response('rede', { status: 200 }), existingCaches = {} } = {}) {
  const listeners = {};
  const stores = new Map(Object.entries(existingCaches).map(([name, entries]) => [name, new Map(Object.entries(entries))]));
  const fetched = [];
  const cacheApi = {
    open: async name => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        add: async url => { const response = await fakeFetch(new Request(new URL(url, 'https://app.test').href)); if (!response.ok) throw new Error('falhou'); store.set(new URL(url, 'https://app.test').href, response); },
        put: async (request, response) => { store.set(request.url, response); }
      };
    },
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
    match: async request => {
      const url = typeof request === 'string' ? new URL(request, 'https://app.test').href : request.url;
      for (const store of stores.values()) if (store.has(url)) return store.get(url).clone();
      return undefined;
    }
  };
  async function fakeFetch(request) { fetched.push(request.url); return network(request); }
  const self = {
    location: { origin: 'https://app.test' },
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: () => {},
    clients: { claim: async () => {} }
  };
  vm.runInNewContext(swSource, { self, caches: cacheApi, fetch: fakeFetch, URL, Request, Response, Promise, console: { warn() {}, log() {} } });
  const dispatch = async (type, extra = {}) => {
    let promise;
    await listeners[type]({ waitUntil: p => { promise = p; }, respondWith: p => { promise = p; }, ...extra });
    return promise === undefined ? undefined : promise;
  };
  return { stores, fetched, dispatch, listeners };
}

test('a versão do cache é "v2" ou superior e nomes antigos são apagados ao ativar', async () => {
  assert.match(swSource, /const CACHE_VERSION = 'v(\d+)'/);
  assert.ok(Number(swSource.match(/const CACHE_VERSION = 'v(\d+)'/)[1]) >= 2);
  const sw = loadServiceWorker({ existingCaches: { 'tutor-ia-v1': { 'https://app.test/': new Response('velho') }, 'outro-app-cache': {} } });
  await sw.dispatch('activate');
  assert.deepEqual([...sw.stores.keys()].sort(), ['outro-app-cache'], 'apaga só os caches antigos do Tutor IA');
});

test('install guarda os arquivos e tolera falha em um deles', async () => {
  const sw = loadServiceWorker({ network: request => new Response('x', { status: request.url.endsWith('/js/app.js') ? 404 : 200 }) });
  await sw.dispatch('install');
  const store = sw.stores.get('tutor-ia-v2');
  assert.ok(store.has('https://app.test/index.html'));
  assert.ok(store.has('https://app.test/js/services/auth.js'), 'auth.js precisa estar disponível offline');
  assert.ok(!store.has('https://app.test/js/app.js'));
});

test('não intercepta /api/, métodos que não são GET nem outros domínios', async () => {
  const sw = loadServiceWorker();
  for (const request of [
    new Request('https://app.test/api/status'),
    new Request('https://app.test/api/tutor/explain', { method: 'POST', body: '{}' }),
    new Request('https://cdn.exemplo.com/lib.js')
  ]) {
    let intercepted = false;
    await sw.listeners.fetch({ request, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false, `não deveria interceptar ${request.method} ${request.url}`);
  }
});

test('rede primeiro: com internet entrega a versão nova e atualiza o cache', async () => {
  let version = 'antiga';
  const sw = loadServiceWorker({ network: () => new Response(`versão ${version}`) });
  const request = new Request('https://app.test/js/app.js');
  assert.equal(await (await sw.dispatch('fetch', { request })).text(), 'versão antiga');
  version = 'nova';
  assert.equal(await (await sw.dispatch('fetch', { request })).text(), 'versão nova', 'deploy novo não pode ficar preso ao cache');
});

test('sem internet: usa o cache; navegação offline cai na página inicial; sem cache dá erro de rede', async () => {
  let online = true;
  const sw = loadServiceWorker({ network: request => { if (!online) throw new TypeError('offline'); return new Response(`conteúdo de ${new URL(request.url).pathname}`); } });
  await sw.dispatch('fetch', { request: new Request('https://app.test/js/app.js') });
  await sw.dispatch('fetch', { request: new Request('https://app.test/index.html') });
  online = false;
  assert.equal(await (await sw.dispatch('fetch', { request: new Request('https://app.test/js/app.js') })).text(), 'conteúdo de /js/app.js');
  const navigation = new Request('https://app.test/qualquer-rota');
  Object.defineProperty(navigation, 'mode', { value: 'navigate' });
  assert.equal(await (await sw.dispatch('fetch', { request: navigation })).text(), 'conteúdo de /index.html');
  assert.equal((await sw.dispatch('fetch', { request: new Request('https://app.test/nunca-visto.css') })).type, 'error');
});

test('todo arquivo citado no Service Worker, no manifest e no index.html existe em /public', () => {
  const publicFile = url => path.join(ROOT, 'public', url.replace(/^\//, ''));
  const assets = [...swSource.matchAll(/^\s+'(\/[^']*)',?$/gm)].map(match => match[1]).filter(url => url !== '/');
  assert.ok(assets.length >= 10);
  for (const url of assets) assert.ok(fs.existsSync(publicFile(url)), `SW cita ${url}, que não existe`);

  const manifest = JSON.parse(fs.readFileSync(publicFile('/manifest.json'), 'utf8'));
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192' && icon.type === 'image/png'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512' && icon.type === 'image/png'));
  for (const icon of manifest.icons) assert.ok(fs.existsSync(publicFile(icon.src)), `manifest cita ${icon.src}, que não existe`);

  const html = fs.readFileSync(publicFile('/index.html'), 'utf8');
  for (const [, url] of html.matchAll(/(?:href|src)="(\/[^"]+)"/g)) {
    assert.ok(fs.existsSync(publicFile(url)), `index.html cita ${url}, que não existe`);
  }
});

test('o frontend não usa endereços dependentes de host (localhost, IPs, portas fixas)', () => {
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
  const files = walk(path.join(ROOT, 'public')).filter(file => /\.(js|html|json|css)$/.test(file));
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(!/localhost|127\.0\.0\.1|192\.168\.|:\d{4}\b(?!\w)/.test(text.replace(/https?:\/\/www\.w3\.org\/\d+\/svg/g, '')),
      `${path.relative(ROOT, file)} contém endereço dependente de host`);
  }
});
