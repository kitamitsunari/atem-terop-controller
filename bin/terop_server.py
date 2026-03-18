#!/usr/bin/env python3
"""
テロップ送出サーバー
使い方: python terop_server.py
ブラウザで http://localhost:5050 を開く
"""

from flask import Flask, request, jsonify, send_from_directory
from PIL import Image, ImageDraw, ImageFont
import os, sys

app = Flask(__name__)

# ===== 設定（必要に応じて変更） =====
WATCH_FOLDER   = "./terop_output"   # 監視フォルダ（watcherと合わせること）
OUTPUT_FILE    = "terop_current.png"
W, H           = 1920, 1080
PORT           = 5050
# =====================================

os.makedirs(WATCH_FOLDER, exist_ok=True)

# --- フォント検索 ---
FONT_CANDIDATES = [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc",   # Linux (Noto)
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
    "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc",         # macOS
    "/Library/Fonts/Arial Unicode.ttf",
    "C:/Windows/Fonts/meiryo.ttc",                             # Windows
    "C:/Windows/Fonts/YuGothB.ttc",
]

def find_font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()

# --- 配置定義 ---
POSITIONS = {
    "top-left":     {"x": 80,      "y": 70,       "anchor": "left"},
    "top-right":    {"x": W - 80,  "y": 70,       "anchor": "right"},
    "bottom-left":  {"x": 80,      "y": H - 220,  "anchor": "left"},
    "bottom-right": {"x": W - 80,  "y": H - 220,  "anchor": "right"},
}

# --- アイキャッチ定義 ---
ICONS = {
    "topic": {"ja": "話題",  "en": "TOPIC", "color": (30, 120, 220)},
    "news":  {"ja": "速報",  "en": "NEWS",  "color": (200, 40, 40)},
    "info":  {"ja": "情報",  "en": "INFO",  "color": (30, 160, 90)},
    "point": {"ja": "注目",  "en": "POINT", "color": (210, 100, 0)},
}

MAX_CHARS = 20
MAX_LINES = 2

# --- ルーティング ---

@app.route("/")
def index():
    return send_from_directory(os.path.dirname(__file__), "terop.html")

@app.route("/generate", methods=["POST"])
def generate():
    data = request.json or {}
    text     = data.get("text", "").strip()
    position = data.get("position", "bottom-left")
    icon_key = data.get("icon", "topic")

    if not text:
        return jsonify({"error": "テキストが空です"}), 400

    img = build_image(text, position, icon_key)
    img.save(os.path.join(WATCH_FOLDER, OUTPUT_FILE), "PNG")
    return jsonify({"success": True})

@app.route("/clear", methods=["POST"])
def clear():
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    img.save(os.path.join(WATCH_FOLDER, OUTPUT_FILE), "PNG")
    return jsonify({"success": True})

@app.route("/config")
def config():
    return jsonify({
        "watch_folder": os.path.abspath(WATCH_FOLDER),
        "output_file":  OUTPUT_FILE,
        "max_chars":    MAX_CHARS,
        "max_lines":    MAX_LINES,
    })

# --- 画像生成 ---

def build_image(text, position_key, icon_key):
    img  = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    font_body = find_font(58)
    font_icon = find_font(30)

    lines = [l[:MAX_CHARS] for l in text.split("\n")[:MAX_LINES]]
    icon  = ICONS.get(icon_key, ICONS["topic"])
    pos   = POSITIONS.get(position_key, POSITIONS["bottom-left"])

    # レイアウト定数
    PAD    = 22
    ICON_W = 96
    ICON_H_PAD = 16
    LINE_H = 74
    BOX_H  = len(lines) * LINE_H + PAD * 2
    max_text_w = max(int(font_body.getlength(l)) for l in lines)
    BOX_W      = max(ICON_W + PAD * 3 + max_text_w + PAD, 420)

    bx = pos["x"]
    by = pos["y"]
    if pos["anchor"] == "right":
        bx = bx - BOX_W

    # 背景ボックス（半透明ダーク）
    draw.rounded_rectangle(
        [bx, by, bx + BOX_W, by + BOX_H],
        radius=16,
        fill=(8, 12, 24, 210),
    )

    # 左端にカラーライン
    r, g, b = icon["color"]
    draw.rounded_rectangle(
        [bx, by, bx + 6, by + BOX_H],
        radius=3,
        fill=(r, g, b, 255),
    )

    # アイキャッチバッジ
    ibx  = bx + PAD
    iby  = by + ICON_H_PAD
    ibh  = BOX_H - ICON_H_PAD * 2

    draw.rounded_rectangle(
        [ibx, iby, ibx + ICON_W, iby + ibh],
        radius=10,
        fill=(r, g, b, 255),
    )
    # バッジ内2行テキスト（日本語 + 英語）
    draw.text(
        (ibx + ICON_W // 2, iby + ibh // 2 - 16),
        icon["ja"],
        font=font_icon,
        fill=(255, 255, 255, 255),
        anchor="mm",
    )
    draw.text(
        (ibx + ICON_W // 2, iby + ibh // 2 + 16),
        icon["en"],
        font=find_font(22),
        fill=(255, 255, 255, 200),
        anchor="mm",
    )

    # テキスト本体（袋文字：輪郭線を周囲8方向に描いてから白文字を重ねる）
    OUTLINE   = 4                    # 輪郭線の太さ(px)。大きくすると縁が太くなる
    OUTLINE_C = (60, 60,30, 220)       # 輪郭色（・半透明）
    TEXT_C    = (255, 255, 255, 255) # 本文色（白・不透明）

    tx = bx + PAD + ICON_W + PAD
    ty = by + PAD + (LINE_H - 58) // 2
    for line in lines:
        # 輪郭線：8方向にオフセットして描画
        for ox in range(-OUTLINE, OUTLINE + 1):
            for oy in range(-OUTLINE, OUTLINE + 1):
                if ox == 0 and oy == 0:
                    continue
                draw.text((tx + ox, ty + oy), line,
                          font=font_body, fill=OUTLINE_C)
        # 本文（白）を最前面に描画
        draw.text((tx, ty), line, font=font_body, fill=TEXT_C)
        ty += LINE_H

    return img


if __name__ == "__main__":
    abs_folder = os.path.abspath(WATCH_FOLDER)
    print("=" * 50)
    print("  📺  テロップ送出サーバー")
    print("=" * 50)
    print(f"  📁  出力フォルダ : {abs_folder}")
    print(f"  🌐  ブラウザURL  : http://localhost:{PORT}")
    print("  (Ctrl+C で停止)")
    print("=" * 50)
    app.run(host="0.0.0.0", port=PORT, debug=False)
