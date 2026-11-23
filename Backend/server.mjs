import http from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'Backend', 'data');
const CONTENT_FILE = path.join(DATA_DIR, 'site-content.json');
const AUTH_FILE = path.join(DATA_DIR, 'admin-auth.json');
const UPLOAD_DIR = path.join(ROOT, 'images', 'uploads');
const PORT = Number(process.env.PORT || 4173);
const MAX_UPLOAD = 15 * 1024 * 1024;
const sessions = new Map();
const attempts = new Map();

const types = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'], ['.gif', 'image/gif'], ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'], ['.pdf', 'application/pdf']
]);

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(body);
}
function json(res, status, data, headers = {}) {
  send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8', ...headers });
}
async function readJson(req, max = 2 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) throw Object.assign(new Error('資料太大'), { status: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function getContent() { return JSON.parse(await readFile(CONTENT_FILE, 'utf8')); }
async function saveContent(content) {
  await mkdir(DATA_DIR, { recursive: true });
  const temp = `${CONTENT_FILE}.${randomBytes(5).toString('hex')}.tmp`;
  await writeFile(temp, `${JSON.stringify(content, null, 2)}\n`, { mode: 0o600 });
  const { rename } = await import('node:fs/promises');
  await rename(temp, CONTENT_FILE);
}
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map((part) => part.trim().split('=').map(decodeURIComponent)).filter(([key, value]) => key && value));
}
function authenticated(req) {
  const token = cookies(req).sunny_admin;
  const expiry = token && sessions.get(token);
  if (!expiry || expiry < Date.now()) { if (token) sessions.delete(token); return false; }
  return true;
}
function requireAuth(req, res) {
  if (authenticated(req)) return true;
  json(res, 401, { error: '請先登入後台。' });
  return false;
}
async function passwordRecord(password, salt = randomBytes(16).toString('hex')) {
  const hash = await scrypt(password, salt, 64);
  return { salt, hash: hash.toString('hex') };
}
async function checkPassword(password, record) {
  const supplied = await passwordRecord(password, record.salt);
  return timingSafeEqual(Buffer.from(supplied.hash, 'hex'), Buffer.from(record.hash, 'hex'));
}
function safeContent(input) {
  if (!input || typeof input !== 'object') throw new Error('資料格式錯誤');
  const cleanText = (value, max = 20000) => String(value ?? '').slice(0, max);
  const list = (value, max = 100) => Array.isArray(value) ? value.slice(0, max) : [];
  const safeImages = (value) => list(value, 12).map((v) => cleanText(v, 500)).filter((v) => /^(images\/|https:\/\/)/.test(v));
  const id = (value) => cleanText(value, 80).replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || randomBytes(6).toString('hex');
  const category = (value) => ['video', 'photo', 'design', 'painting'].includes(value) ? value : 'photo';
  return {
    about: {
      name: cleanText(input.about?.name, 120), labels: list(input.about?.labels, 12).map((v) => cleanText(v, 50)),
      hashtags: list(input.about?.hashtags, 12).map((v) => cleanText(v, 180)), bio: cleanText(input.about?.bio, 5000), announcement: cleanText(input.about?.announcement, 500)
    },
    gallery: list(input.gallery, 200).map((item) => ({ id: id(item.id), type: category(item.type), title: cleanText(item.title, 200), englishTitle: cleanText(item.englishTitle, 200), medium: cleanText(item.medium, 300), description: cleanText(item.description, 5000), images: safeImages(item.images), videoUrl: cleanText(item.videoUrl, 500) })),
    projects: list(input.projects, 100).map((item) => ({ id: id(item.id), title: cleanText(item.title, 200), englishTitle: cleanText(item.englishTitle, 200), tags: list(item.tags, 20).map((v) => cleanText(v, 80)), year: cleanText(item.year, 30), description: cleanText(item.description, 5000), images: safeImages(item.images), visible: item.visible !== false })),
    articles: list(input.articles, 200).map((item) => ({
      id: id(item.id), title: cleanText(item.title, 250), subtitle: cleanText(item.subtitle, 500), date: cleanText(item.date, 30),
      category: cleanText(item.category, 100), summary: cleanText(item.summary, 500),
      sections: list(item.sections, 100).map((section) => ({ heading: cleanText(section.heading, 250), body: cleanText(section.body, 20000) })),
      images: safeImages(item.images?.length ? item.images : [item.image])
    }))
  };
}
function parseUpload(req, body) {
  const type = req.headers['content-type'] || '';
  const boundary = type.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.slice(1).find(Boolean);
  if (!boundary) throw Object.assign(new Error('上傳格式錯誤'), { status: 400 });
  const buffer = body;
  const delimiter = Buffer.from(`--${boundary}`);
  let cursor = 0;
  const files = [];
  while (true) {
    const start = buffer.indexOf(delimiter, cursor);
    if (start < 0) break;
    const headerStart = start + delimiter.length + 2;
    if (buffer.subarray(start + delimiter.length, start + delimiter.length + 2).toString() === '--') break;
    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), headerStart);
    if (headerEnd < 0) break;
    const next = buffer.indexOf(delimiter, headerEnd + 4);
    if (next < 0) break;
    const headers = buffer.subarray(headerStart, headerEnd).toString('utf8');
    const filename = headers.match(/filename="([^"]*)"/i)?.[1];
    if (filename) {
      const mime = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim().toLowerCase() || '';
      const ext = ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' })[mime];
      if (!ext) throw Object.assign(new Error('只支援 JPG、PNG、WEBP、GIF 圖片。'), { status: 415 });
      const dataEnd = next - 2;
      const data = buffer.subarray(headerEnd + 4, dataEnd);
      if (!data.length) continue;
      files.push({ ext, data });
    }
    cursor = next;
  }
  return files;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/api/content') return json(res, 200, await getContent());
    if (req.method === 'GET' && url.pathname === '/api/session') {
      let configured = false;
      try { await stat(AUTH_FILE); configured = true; } catch {}
      return json(res, 200, { configured, authenticated: authenticated(req) });
    }
    if (req.method === 'POST' && url.pathname === '/api/setup') {
      try { await stat(AUTH_FILE); return json(res, 409, { error: '管理帳號已設定，請登入。' }); } catch {}
      const { username, password } = await readJson(req, 20_000);
      if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(username || '') || (password || '').length < 12) return json(res, 400, { error: '帳號需為 3–40 個英數字元；密碼至少 12 個字元。' });
      const record = { username, ...(await passwordRecord(password)) };
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(AUTH_FILE, JSON.stringify(record, null, 2), { mode: 0o600, flag: 'wx' });
      const token = randomBytes(32).toString('base64url');
      sessions.set(token, Date.now() + 8 * 60 * 60 * 1000);
      return json(res, 200, { ok: true }, { 'Set-Cookie': `sunny_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800` });
    }
    if (req.method === 'POST' && url.pathname === '/api/login') {
      const ip = req.socket.remoteAddress || 'local';
      const state = attempts.get(ip) || { count: 0, until: 0 };
      if (state.until > Date.now()) return json(res, 429, { error: '登入嘗試過多，請稍後再試。' });
      const { username, password } = await readJson(req, 20_000);
      let record;
      try { record = JSON.parse(await readFile(AUTH_FILE, 'utf8')); } catch { return json(res, 400, { error: '尚未設定管理帳號。' }); }
      if (username !== record.username || !(await checkPassword(String(password || ''), record))) {
        state.count += 1;
        if (state.count >= 8) { state.count = 0; state.until = Date.now() + 10 * 60 * 1000; }
        attempts.set(ip, state);
        return json(res, 401, { error: '帳號或密碼錯誤。' });
      }
      attempts.delete(ip);
      const token = randomBytes(32).toString('base64url');
      sessions.set(token, Date.now() + 8 * 60 * 60 * 1000);
      return json(res, 200, { ok: true }, { 'Set-Cookie': `sunny_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800` });
    }
    if (req.method === 'POST' && url.pathname === '/api/logout') {
      const token = cookies(req).sunny_admin;
      if (token) sessions.delete(token);
      return json(res, 200, { ok: true }, { 'Set-Cookie': 'sunny_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
    }
    if (req.method === 'POST' && url.pathname === '/api/upload') {
      if (!requireAuth(req, res)) return;
      const chunks = [];
      let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > MAX_UPLOAD * 12) return json(res, 413, { error: '單次上傳總量不可超過 180MB。' }); chunks.push(chunk); }
      const files = parseUpload(req, Buffer.concat(chunks));
      if (!files.length || files.length > 12) return json(res, 400, { error: '請選擇 1 至 12 張圖片。' });
      await mkdir(UPLOAD_DIR, { recursive: true });
      const saved = [];
      for (const file of files) {
        if (file.data.length > MAX_UPLOAD) return json(res, 413, { error: '單張圖片上限為 15MB。' });
        const filename = `${Date.now()}-${randomBytes(8).toString('hex')}${file.ext}`;
        await writeFile(path.join(UPLOAD_DIR, filename), file.data, { flag: 'wx' });
        saved.push(`images/uploads/${filename}`);
      }
      return json(res, 201, { files: saved });
    }
    if (req.method === 'PUT' && url.pathname === '/api/content') {
      if (!requireAuth(req, res)) return;
      const cleaned = safeContent(await readJson(req));
      await saveContent(cleaned);
      return json(res, 200, { ok: true });
    }
    if (url.pathname.startsWith('/api/')) return json(res, 404, { error: '找不到 API 路徑。' });

    let requested = decodeURIComponent(url.pathname);
    if (requested.startsWith('/Backend/data/')) return send(res, 403, 'Forbidden');
    if (requested === '/') requested = '/index.html';
    const filePath = path.resolve(ROOT, `.${requested}`);
    if (!filePath.startsWith(`${ROOT}${path.sep}`)) return send(res, 403, 'Forbidden');
    let info;
    try { info = await stat(filePath); } catch { return send(res, 404, 'Not found'); }
    if (!info.isFile()) return send(res, 404, 'Not found');
    res.writeHead(200, { 'Content-Type': types.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    createReadStream(filePath).pipe(res);
  } catch (error) {
    if (!res.headersSent) json(res, error.status || 500, { error: error.status ? error.message : '伺服器發生錯誤。' });
    else res.destroy();
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`Portfolio 後台已啟動：http://127.0.0.1:${PORT}/Backend/`));
