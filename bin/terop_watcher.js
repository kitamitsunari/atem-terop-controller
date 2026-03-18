/**
 * ATEM Terop Watcher (Node.js版)
 * terop_watcher.py の代替スクリプト
 *
 * 使い方: node terop_watcher.js --atem 192.168.10.24
 */

const { Atem }  = require('atem-connection');
const chokidar  = require('chokidar');
const { PNG }   = require('pngjs');
const fs        = require('fs');
const path      = require('path');

// ===== 設定 =====
const WATCH_FOLDER = './terop_output';
const WATCH_FILE   = 'terop_current.png';
const MEDIA_SLOT   = 0;       // ATEMメディアプールのスロット番号（0〜9）
const DEBOUNCE_MS  = 500;     // ファイル書き込み完了待ち（ms）
// =================

// コマンドライン引数からATEM IPを取得
const args    = process.argv.slice(2);
const atemIdx = args.indexOf('--atem');
if (atemIdx === -1 || !args[atemIdx + 1]) {
  console.error('使い方: node terop_watcher.js --atem <ATEMのIPアドレス>');
  process.exit(1);
}
const ATEM_IP = args[atemIdx + 1];

const watchPath = path.join(WATCH_FOLDER, WATCH_FILE);
let   isReady   = false;
let   debounceTimer = null;

console.log('==================================================');
console.log('  📺  ATEM Terop Watcher (Node.js)');
console.log('==================================================');
console.log(`  🎯  ATEM IP    : ${ATEM_IP}`);
console.log(`  📁  監視フォルダ: ${path.resolve(WATCH_FOLDER)}`);
console.log(`  📄  監視ファイル: ${WATCH_FILE}`);
console.log(`  🔲  メディアスロット: ${MEDIA_SLOT}`);
console.log('  接続中…');

// ===== ATEM接続 =====
const atem = new Atem();

atem.on('connected', () => {
  console.log('  ✅ ATEM 接続完了！');
  console.log('==================================================');
  isReady = true;
  startWatcher();
});

atem.on('disconnected', () => {
  console.log('[WARN] ATEM切断されました。再接続を待っています…');
  isReady = false;
});

atem.on('error', (err) => {
  console.error('[ERROR] ATEM接続エラー:', err);
});

atem.connect(ATEM_IP);

// ===== ファイル監視 =====
function startWatcher() {
  console.log(`  👁  ファイル監視中 (Ctrl+C で停止)\n`);

  chokidar.watch(watchPath, {
    persistent:        true,
    ignoreInitial:     true,
    awaitWriteFinish: {
      stabilityThreshold: DEBOUNCE_MS,
      pollInterval:       100,
    },
  }).on('add',    filePath => uploadFile(filePath))
    .on('change', filePath => uploadFile(filePath));
}

// ===== アップロード処理 =====
async function uploadFile(filePath) {
  if (!isReady) {
    console.log('[SKIP] ATEM未接続のためスキップ');
    return;
  }

  try {
    const raw    = fs.readFileSync(filePath);
    const png    = PNG.sync.read(raw);
    const data   = Buffer.from(png.data);
    const name   = String(path.basename(filePath));
    const desc   = '';   // ← description（空文字でOK）

    console.log(`[INFO] 転送開始: ${name} (${png.width}x${png.height})`);

    await atem.uploadStill(
      MEDIA_SLOT,   // index
      data,         // data
      name,         // name
      desc,         // description ← これが抜けていた
    );

    console.log(`[OK]  ATEMスロット${MEDIA_SLOT}へ転送完了`);

  } catch (err) {
    console.error('[ERROR] 転送失敗:', err.message || err);
    console.error('[DEBUG]', err.stack);
  }
}