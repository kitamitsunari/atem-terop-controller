/**
 * ATEM Terop Bridge Watcher (HTTP受信・差出人制限版)
 * mkita.com および localhost からの透過PNG POSTのみを受け付け、ATEMメディアプールへ直接転送します。
 *
 * 使い方: node terop_watcher.js --atem 192.168.10.24 [--port 5050] [--slot 0]
 */

const http     = require('http');
const { Atem } = require('atem-connection');
const { PNG }  = require('pngjs');

// ===== 引数・デフォルト設定 =====
const args = process.argv.slice(2);
function getArg(flag, fallback) {
  const idx = args.indexOf(flag);
  return (idx !== -1 && args[idx + 1]) ? args[idx + 1] : fallback;
}

const ATEM_IP    = getArg('--atem', null);
const PORT       = parseInt(getArg('--port', '5050'), 10);
const MEDIA_SLOT = parseInt(getArg('--slot', '0'), 10);

if (!ATEM_IP) {
  console.error('使い方: node terop_watcher.js --atem <ATEMのIPアドレス> [--port 5050] [--slot 0]');
  process.exit(1);
}

// ===== 許可する差出人（Origin）の判定 =====
function isAllowedOrigin(origin) {
  // ブラウザ以外（curlやローカルスクリプト直接実行などOriginヘッダ無し）は許可
  if (!origin) return true;

  // localhost / 127.0.0.1（ポート番号は任意）を許可
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return true;
  }

  // https://mkita.com および https://*.mkita.com（Cloudflare Pages等）を許可
  if (/^https:\/\/([a-z0-9-]+\.)?mkita\.com$/.test(origin)) {
    return true;
  }

  return false;
}

let isAtemReady = false;

console.log('==================================================');
console.log('  ATEM Terop Bridge Watcher (Strict Origin Mode)');
console.log('==================================================');
console.log(`  ATEM IP        : ${ATEM_IP}`);
console.log(`  Media Slot     : ${MEDIA_SLOT}`);
console.log(`  Bridge Port    : http://127.0.0.1:${PORT}`);
console.log('  Allowed Origin : localhost / *.mkita.com');
console.log('  ATEMへ接続中…');

// ===== ATEM接続 =====
const atem = new Atem();

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

// ===== HTTP受信サーバー =====
const server = http.createServer((req, res) => {
  const origin = req.headers.origin;

  // 1. 差出人（Origin）の検問
  if (!isAllowedOrigin(origin)) {
    console.warn(`[BLOCK] 許可されていないOriginからのアクセスを拒否しました: ${origin}`);
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, error: 'Forbidden Origin' }));
    return;
  }

  // 2. 許可されたOriginに対してのみCORS / Private Network Access許可証を発行
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

  // プリフライト（事前確認）リクエスト応答
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 3. 死活・ATEM接続確認エンドポイント
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

  // 4. PNG受信 → ATEMアップロードエンドポイント
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

        console.log(`[INFO] 受信 (${png.width}x${png.height}, ${pngBuffer.length} bytes) [Origin: ${origin || 'local'}] → ATEM転送中…`);

        await atem.uploadStill(
          MEDIA_SLOT,
          rgba,
          'terop_current.png',
          ''
        );

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
  console.log(`  [READY] HTTP受付開始: http://127.0.0.1:${PORT}`);
});