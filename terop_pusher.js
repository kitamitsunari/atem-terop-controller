/**
 * Atem-Live-Terop-Writer : terop_pusher.exe (SEA完全対応版)
 */
// SEA単一バンドル用: FakeWorkerが動的ロードするソケット子モジュールを事前に静的バンドルへ組み込む
global.__atemSocketChild = require('atem-connection/dist/lib/atemSocketChild');
const http     = require('http');
const fs       = require('fs');
const path     = require('path');
const readline = require('readline');
const { exec } = require('child_process');
const { Atem } = require('atem-connection');
const { PNG }  = require('pngjs');
process.on('uncaughtException', (err) => {
  console.error('\n[FATAL ERROR]', err);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('\nEnterキーを押すと終了します...', () => process.exit(1));
});
const isExe       = path.basename(process.execPath).toLowerCase() !== 'node.exe';
const APP_DIR     = isExe ? path.dirname(process.execPath) : __dirname;
const CONFIG_PATH = path.join(APP_DIR, 'atem_config.json');
const LOCAL_HTML  = path.join(APP_DIR, 'terop_maker.html');
const CLOUD_URL   = 'https://aterop.mkita.com';
const rawArgs = isExe ? process.argv.slice(1) : process.argv.slice(2);
function getArg(flag, fallback) {
  const idx = rawArgs.indexOf(flag);
  return (idx !== -1 && rawArgs[idx + 1]) ? rawArgs[idx + 1] : fallback;
}
const PORT       = parseInt(getArg('--port', '5050'), 10);
const MEDIA_SLOT = parseInt(getArg('--slot', '0'), 10);
const CLI_IP     = getArg('--atem', null);
function loadSavedIp() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      return data.atemIp || '';
    }
  } catch (e) {}
  return '';
}
function saveIp(ip) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ atemIp: ip }, null, 2), 'utf8');
  } catch (e) {}
}
function askAtemIp() {
  return new Promise((resolve) => {
    if (CLI_IP) return resolve(CLI_IP);
    const savedIp = loadSavedIp();
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const promptText = savedIp
      ? `  ATEM IP Address [${savedIp}]: `
      : '  ATEM IP Address: ';
    rl.question(promptText, (answer) => {
      rl.close();
      const ip = answer.trim() || savedIp;
      if (!ip) {
        console.error('\n  [ERROR] IPアドレスが入力されていません。終了します。');
        setTimeout(() => process.exit(1), 2000);
        return;
      }
      saveIp(ip);
      resolve(ip);
    });
  });
}
function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  if (/^https:\/\/([a-z0-9-]+\.)?mkita\.com$/.test(origin)) return true;
  return false;
}
(async () => {
  console.log('==================================================');
  console.log('  Atem-Live-Terop-Writer (terop_pusher)');
  console.log('==================================================\n');
  const ATEM_IP = await askAtemIp();
  let isAtemReady = false;
  const hasLocalHtml = fs.existsSync(LOCAL_HTML);
  const targetUrl    = hasLocalHtml ? `http://localhost:${PORT}/` : CLOUD_URL;
  const uiModeLabel  = hasLocalHtml
    ? 'LOCAL MODE (terop_maker.html)'
    : `CLOUD MODE (${CLOUD_URL})`;
  console.log(`\n  ATEM IP    : ${ATEM_IP}`);
  console.log(`  Media Slot : ${MEDIA_SLOT}`);
  console.log(`  Bridge Port: http://127.0.0.1:${PORT}`);
  console.log(`  UI Mode    : ${uiModeLabel}`);
  console.log('  ATEMへ接続中…');
  const atem = new Atem({ disableMultithreaded: true });
  atem.on('connected', () => {
    console.log('  [OK] ATEM 接続完了！送出待機中…');
    console.log('==================================================');
    isAtemReady = true;
  });
  atem.on('disconnected', () => {
    console.log('[WARN] ATEMが切断されました。再接続を待機しています…');
    isAtemReady = false;
  });
  atem.on('error', (err) => {
    console.error('[ERROR] ATEM通信エラー:', err.message || err);
  });
  atem.connect(ATEM_IP);
  const server = http.createServer((req, res) => {
    const origin = req.headers.origin;
    if (!isAllowedOrigin(origin)) {
      console.warn(`[BLOCK] 許可されていないOriginからのアクセスを拒否: ${origin}`);
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: 'Forbidden Origin' }));
      return;
    }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === 'GET' && (req.url === '/' || req.url === '/terop_maker.html')) {
      if (!fs.existsSync(LOCAL_HTML)) {
        res.writeHead(302, { Location: CLOUD_URL });
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(LOCAL_HTML).pipe(res);
      return;
    }
    if (req.method === 'GET' && req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        ok: true,
        atemConnected: isAtemReady,
        atemIp: ATEM_IP,
        slot: MEDIA_SLOT,
      }));
      return;
    }
    if (req.method === 'POST' && req.url === '/upload') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', async () => {
        try {
          if (!isAtemReady) {
            res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, error: 'ATEMが未接続です' }));
            return;
          }
          const pngBuffer = Buffer.concat(chunks);
          if (pngBuffer.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, error: '空のデータを受信しました' }));
            return;
          }
          const png  = PNG.sync.read(pngBuffer);
          const rgba = Buffer.from(png.data);
          console.log(`[INFO] 受信 (${png.width}x${png.height}) [Origin: ${origin || 'local'}] → ATEM転送中…`);
          await atem.uploadStill(MEDIA_SLOT, rgba, 'terop_current.png', '');
          console.log(`[OK]   スロット${MEDIA_SLOT}へ転送完了`);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, slot: MEDIA_SLOT }));
        } catch (err) {
          console.error('[ERROR] 転送失敗:', err.message || err);
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: err.message || '転送エラー' }));
        }
      });
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`  [READY] ブラウザを開きます: ${targetUrl}`);
    exec(`start "" "${targetUrl}"`);
  });
})();
