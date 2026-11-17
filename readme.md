# atem-terop-controller

Blackmagic Design **ATEM Mini / ATEM Mini Pro** 等のメディアプールへ、ブラウザからリアルタイムで透過テロップ（1920×1080 PNG）を生成・直接転送できる軽量ライブテロップ送出システムです。

Node.js や `node_modules`、Python などのランタイム環境を一切必要としない単体実行ファイル（`terop_pusher.exe` / 約22MB）と、単一HTMLのテロップ作成UI（`terop_maker.html`）の **最大2ファイル構成** で動作します。

---

## 主な特徴

- **ゼロ依存・超軽量単体実行 (`terop_pusher.exe` / 約22MB)**
  Node.js SEA（Single Executable Application）技術と UPX 圧縮により、通信エンジンと依存モジュールを約22MBの単一 `.exe` に集約。別の Windows PC やクラウドドライブ（Google ドライブ等）へコピーしてダブルクリックするだけで即座に起動します。
- **ローカル／クラウドの自動フォールバック起動**
  - **ローカルモード**: `terop_pusher.exe` と同じフォルダに `terop_maker.html` が存在する場合、内蔵HTTPサーバー（`http://localhost:5050/`）でローカルUIを自動起動します（インターネット接続のない配信現場でも完全動作）。
  - **クラウドモード**: 同じフォルダに `terop_maker.html` がない場合、自動的に Cloudflare Pages 上のホスティング版（`https://aterop.mkita.com`）を開き、ローカルの `terop_pusher.exe` 経由で ATEM へ直接転送します。
- **ATEM IPアドレスの自動記憶**
  初回起動時に入力した ATEM の IP アドレスを `atem_config.json` に自動保存。2回目以降は `Enter` キーを押すだけで即座に接続します。
- **メモリ直結・高速転送**
  ブラウザの HTML5 Canvas で生成した 1920×1080 透過 PNG バイナリをローカル HTTP ブリッジ経由でメモリ上へ直接受け渡し、ATEM のメディアプール（デフォルト: スロット 0 / Still 1）へ書き換えます。
- **柔軟なテロップ作成UI (`terop_maker.html`)**
  - 最大 20文字 × 2行のリアルタイムプレビュー（原寸 1920×1080 透過 Canvas 縮小表示）
  - 画面4隅（上・左／上・右／下・左／下・右）のワンクリック配置切り替え
  - カスタマイズ可能な4つのアイキャッチラベル（ラベル文字・背景色を現場で編集・ブラウザに自動保存）
  - 単体利用時のローカル PNG 保存機能

---

## 配布ファイル構成（Releases 配布物）

```text
atem-terop-controller/
├── terop_pusher.exe    # 起動・Web配信・ATEM転送を担う単体実行ファイル（必須・約22MB）
└── terop_maker.html    # テロップ作成UI（任意：同梱時はローカル完結、省略時は [https://aterop.mkita.com](https://aterop.mkita.com) を使用）
