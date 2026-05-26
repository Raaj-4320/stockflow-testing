const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

const app = express();
const PORT = process.env.PORT || 3100;
const startedAt = Date.now();
const metricsFile = path.join(__dirname, 'data', 'whatsapp-state.json');

app.use(express.json({ limit: '2mb' }));

const allowedOrigins = String(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked'));
  }
}));

const clients = new Map();
const statuses = new Map();
const qrCodes = new Map();
let metrics = loadMetrics();

function requireApiKey(req, res, next) {
  const expected = process.env.WHATSAPP_API_KEY;
  if (!expected) return next();
  const got = req.header('x-api-key');
  if (got !== expected) return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
  next();
}

function loadMetrics() {
  try {
    if (!fs.existsSync(metricsFile)) return {};
    return JSON.parse(fs.readFileSync(metricsFile, 'utf8')) || {};
  } catch {
    return {};
  }
}

function saveMetrics() {
  try {
    fs.mkdirSync(path.dirname(metricsFile), { recursive: true });
    fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 2));
  } catch (e) {
    console.error('[metrics] save failed', e?.message || e);
  }
}

function getMetric(userId) {
  if (!metrics[userId]) {
    metrics[userId] = {
      userId,
      connectedNumber: null,
      totalInvoicesSent: 0,
      totalLedgersSent: 0,
      lastInvoiceSentAt: null,
      lastLedgerSentAt: null,
      lastError: null,
      sessionStartedAt: null,
      sessionReadyAt: null,
      lastDisconnectedAt: null,
      lastQrGeneratedAt: null,
      totalSendFailures: 0,
    };
  }
  return metrics[userId];
}

function updateMetric(userId, patch) {
  const row = getMetric(userId);
  Object.assign(row, patch || {});
  saveMetrics();
  return row;
}

function normalizeIndianPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('91') && digits.length >= 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function getClientOrThrow(userId) {
  const client = clients.get(userId);
  if (!client) throw new Error(`No active client for userId=${userId}`);
  return client;
}

async function downloadMediaFromUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Media download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = String(res.headers.get('content-type') || '').split(';')[0] || 'application/octet-stream';
  const ext = mime.extension(contentType) || (contentType.includes('pdf') ? 'pdf' : 'bin');
  const filename = `attachment.${ext}`;
  return {
    media: new MessageMedia(contentType, buf.toString('base64'), filename),
    contentType,
    filename,
  };
}

async function sendMediaMessage({ userId, phone, text, mediaUrl }) {
  const client = getClientOrThrow(userId);
  const normalized = normalizeIndianPhone(phone);
  if (!normalized) throw new Error('Invalid phone');
  const chatId = `${normalized}@c.us`;
  const { media } = await downloadMediaFromUrl(mediaUrl);
  return client.sendMessage(chatId, media, { caption: text || '' });
}

app.get('/', (_req, res) => res.json({ success: true, service: 'whatsapp-server' }));
app.get('/healthz', (_req, res) => res.json({ success: true, uptime: process.uptime(), memory: process.memoryUsage() }));

app.post('/create-session', requireApiKey, async (req, res) => {
  const userId = String(req.body?.userId || '').trim();
  if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
  if (clients.has(userId)) return res.json({ success: true, userId, status: statuses.get(userId) || 'initializing' });

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: userId }),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] },
  });

  statuses.set(userId, 'initializing');
  updateMetric(userId, { sessionStartedAt: new Date().toISOString(), lastError: null });

  client.on('qr', (qr) => {
    statuses.set(userId, 'qr_ready');
    qrCodes.set(userId, qr);
    updateMetric(userId, { lastError: null, lastQrGeneratedAt: new Date().toISOString(), connected: false });
    client.__lastQr = qr;
  });

  client.on('ready', () => {
    statuses.set(userId, 'connected');
    const connectedNumber = client.info?.wid?.user ? String(client.info.wid.user) : null;
    updateMetric(userId, { sessionReadyAt: new Date().toISOString(), connectedNumber, lastError: null, connected: true });
  });

  client.on('auth_failure', (msg) => {
    statuses.set(userId, 'auth_failure');
    updateMetric(userId, { lastError: String(msg || 'auth_failure') });
  });

  client.on('disconnected', (reason) => {
    statuses.set(userId, 'disconnected');
    updateMetric(userId, { lastError: String(reason || 'disconnected'), connected: false, lastDisconnectedAt: new Date().toISOString() });
  });

  client.initialize().catch((e) => {
    statuses.set(userId, 'error');
    updateMetric(userId, { lastError: e?.message || String(e) });
  });

  clients.set(userId, client);
  return res.json({ success: true, userId, status: 'initializing' });
});

app.get('/qr/:userId', requireApiKey, (req, res) => {
  const userId = String(req.params.userId || '');
  const client = clients.get(userId);
  if (!client) return res.status(404).json({ success: false, error: 'session not found' });
  const qr = client.__lastQr || null;
  const hasQr = Boolean(qr);
  res.json({ success: true, userId, qr, hasQr, status: statuses.get(userId) || 'initializing' });
});

app.get('/status/:userId', requireApiKey, (req, res) => {
  const userId = String(req.params.userId || '');
  const m = getMetric(userId);
  const status = statuses.get(userId) || 'not_started';
  res.json({ success: true, userId, connected: status === 'connected', status, connectedNumber: m.connectedNumber || null, initializing: status === 'initializing' || status === 'qr_ready', hasQr: Boolean(qrCodes.get(userId)) });
});

app.get('/metrics/:userId', requireApiKey, (req, res) => {
  const userId = String(req.params.userId || '');
  const m = getMetric(userId);
  const status = statuses.get(userId) || 'not_started';
  res.json({
    success: true,
    userId,
    connected: status === 'connected',
    initializing: status === 'initializing' || status === 'qr_ready',
    hasQr: Boolean(qrCodes.get(userId)),
    connectedNumber: m.connectedNumber,
    totalInvoicesSent: m.totalInvoicesSent,
    totalLedgersSent: m.totalLedgersSent,
    lastInvoiceSentAt: m.lastInvoiceSentAt,
    lastLedgerSentAt: m.lastLedgerSentAt,
    lastError: m.lastError,
    sessionStartedAt: m.sessionStartedAt,
    sessionReadyAt: m.sessionReadyAt,
    lastDisconnectedAt: m.lastDisconnectedAt,
    lastQrGeneratedAt: m.lastQrGeneratedAt,
    totalSendFailures: m.totalSendFailures,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

app.post('/send-invoice', requireApiKey, async (req, res) => {
  try {
    const { userId, customerPhone, customerName, invoiceNo, pdfUrl } = req.body || {};
    if (!userId || !customerPhone || !pdfUrl) return res.status(400).json({ success: false, error: 'userId, customerPhone, pdfUrl required' });
    const caption = `Invoice ${invoiceNo || ''} for ${customerName || 'Customer'}`.trim();
    const msg = await sendMediaMessage({ userId, phone: customerPhone, text: caption, mediaUrl: pdfUrl });
    const m = getMetric(String(userId));
    updateMetric(String(userId), {
      totalInvoicesSent: Number(m.totalInvoicesSent || 0) + 1,
      lastInvoiceSentAt: new Date().toISOString(),
      lastError: null,
    });
    return res.json({ success: true, messageId: msg?.id?._serialized || null });
  } catch (e) {
    const userId = String(req.body?.userId || '');
    if (userId) {
      const m = getMetric(userId);
      updateMetric(userId, {
        totalSendFailures: Number(m.totalSendFailures || 0) + 1,
        lastError: e?.message || String(e),
      });
    }
    return res.status(500).json({ success: false, error: e?.message || String(e) });
  }
});

app.post('/send-ledger', requireApiKey, async (req, res) => {
  try {
    const { userId, customerPhone, customerName, ledgerNo, pdfUrl } = req.body || {};
    if (!userId || !customerPhone || !pdfUrl) return res.status(400).json({ success: false, error: 'userId, customerPhone, pdfUrl required' });
    const caption = `Ledger / Account Statement ${ledgerNo || ''} for ${customerName || 'Customer'}`.trim();
    const msg = await sendMediaMessage({ userId, phone: customerPhone, text: caption, mediaUrl: pdfUrl });
    const m = getMetric(String(userId));
    updateMetric(String(userId), {
      totalLedgersSent: Number(m.totalLedgersSent || 0) + 1,
      lastLedgerSentAt: new Date().toISOString(),
      lastError: null,
    });
    return res.json({ success: true, messageId: msg?.id?._serialized || null });
  } catch (e) {
    const userId = String(req.body?.userId || '');
    if (userId) {
      const m = getMetric(userId);
      updateMetric(userId, {
        totalSendFailures: Number(m.totalSendFailures || 0) + 1,
        lastError: e?.message || String(e),
      });
    }
    return res.status(500).json({ success: false, error: e?.message || String(e) });
  }
});

app.post('/restart-session/:userId', requireApiKey, async (req, res) => {
  const userId = String(req.params.userId || '');
  const old = clients.get(userId);
  if (old) {
    try { await old.destroy(); } catch {}
    clients.delete(userId);
  }
  qrCodes.delete(userId);
  statuses.set(userId, 'disconnected');
  updateMetric(userId, { connected: false, lastDisconnectedAt: new Date().toISOString() });
  return res.json({ success: true, userId, status: 'restarting', nextAction: 'call /create-session to generate new QR' });
});

app.post('/logout/:userId', requireApiKey, async (req, res) => {
  const userId = String(req.params.userId || '');
  const client = clients.get(userId);
  if (!client) return res.json({ success: true, userId, status: 'not_found' });
  try {
    await client.destroy();
  } catch (e) {
    updateMetric(userId, { lastError: e?.message || String(e) });
  }
  clients.delete(userId);
  qrCodes.delete(userId);
  statuses.set(userId, 'logged_out');
  updateMetric(userId, { connected: false, lastDisconnectedAt: new Date().toISOString() });
  return res.json({ success: true, userId, status: 'logged_out' });
});

app.listen(PORT, () => {
  console.log(`WhatsApp server listening on :${PORT}`);
});
