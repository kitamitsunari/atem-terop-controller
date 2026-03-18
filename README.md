# ATEM Mini pro テロップ送出システム

インタビュー映像などにリアルタイムでトピックテロップを重ねるためのツールです。

## ファイル構成

```
terop_app/
├── terop_server.py   # Webアプリ本体（Flask）
├── terop.html        # 操作UI（ブラウザで表示）
├── terop_watcher.py  # ATEM自動送信スクリプト
├── requirements.txt  # 必要ライブラリ一覧
└── terop_output/     # 自動生成される出力フォルダ
    └── terop_current.png  # テロップ画像（自動更新）
```

## セットアップ

```bash
pip install -r requirements.txt
```

## 起動手順

### ① Web操作UIを起動

```bash
python terop_server.py
```

ブラウザで `http://localhost:5050` を開く

### ② ATEM送信ウォッチャーを起動（別ターミナル）

```bash
python terop_watcher.py --atem 192.168.x.x
```

※ ATEMのIPアドレスは環境に合わせて変更してください。

## 使い方

1. ブラウザの操作UIで
   - テキストを入力（最大20文字 × 2行）
   - 画面配置を選択（上左/上右/下左/下右）
   - アイキャッチを選択（話題/速報/情報/注目）
2. 「送出！」ボタンを押す
3. `terop_output/terop_current.png` が自動生成・更新される
4. ウォッチャーがATEMのメディアプールに自動転送
5. ATEM Software Control のアップストリームキーヤーで表示ON

## ATEMのキーヤー設定

- キー種類: **ルーマキー** または **リニアキー**
- Fill Source: terop_current.pngが入っているINPUT（またはMedia Player 1）
- Key Source: 同上
- αチャネル付きPNGを使用するため、背景は自動的に透過されます

## カスタマイズ

`terop_server.py` の設定セクションで変更可能：

```python
WATCH_FOLDER = "./terop_output"  # 出力フォルダ
PORT         = 5050              # Webサーバーのポート番号
W, H         = 1920, 1080        # 出力画像サイズ
```

アイキャッチの文言・色も `ICONS` 辞書で自由に変更できます。

## 依存ライブラリ
- Flask（BSD）
- Pillow（HPND）
- watchdog（Apache 2.0）
- atem-connection（MIT）

- ## 自分でビルドする場合

# サーバー
python -m PyInstaller --onefile bin/terop_server.py

# ウォッチャー
pkg bin/terop_watcher.js --targets node18-win-x64 --output terop_watcher.exe
- pngjs（MIT）

## 免責事項
本ソフトウェアはBlackmagic Design社の公式製品ではありません。
ATEM は Blackmagic Design社の登録商標です。

## 自分でビルドする場合

# サーバー
python -m PyInstaller --onefile bin/terop_server.py

# ウォッチャー
pkg bin/terop_watcher.js --targets node18-win-x64 --output terop_watcher.exe
