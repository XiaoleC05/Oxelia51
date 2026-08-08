#!/usr/bin/env python3
"""从官方品牌素材生成全套图标（白底黑圈版）。

源（C:\\Users\\71408\\Desktop\\oxelia51-logo\\，已由 render-svg.mjs 栅格化）：
  final-icon-light.png       1024 —— 应用图标主图（白底 #FAFAFA + 黑环 + 红点）
  brand-glyph-on-light.png   256  —— 顶栏 glyph（浅色面，黑环，透明底）
  brand-glyph-on-dark.png    256  —— 顶栏 glyph（深色面，白环，透明底）

产物：src-tauri/icons/ 全套 + app-icon.png + ui/src/assets/brand-glyph-*.png
"""
import io
import os
import struct
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # desktop/
ICONS = os.path.join(ROOT, "src-tauri", "icons")
SRC_DIR = r"C:\Users\71408\AppData\Local\Temp\ox-shots"

MASTER = os.path.join(SRC_DIR, "official-icon-1024.png")
GLYPH_LIGHT = os.path.join(SRC_DIR, "glyph-light-256.png")
GLYPH_DARK = os.path.join(SRC_DIR, "glyph-dark-256.png")


def master_img():
    im = Image.open(MASTER).convert("RGBA")
    assert im.size == (1024, 1024), f"master not 1024: {im.size}"
    return im


def scale(im, size):
    return im.resize((size, size), Image.LANCZOS)


def save_png(img, path):
    img.save(path, format="PNG")
    print(f"  {os.path.relpath(path, ROOT)}  {img.size[0]}x{img.size[1]}")


def build_ico(path, master):
    """多层 ICO：16/24/32/48/64/128/256，全部由官方主图降采样。"""
    sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    master.save(
        path,
        format="ICO",
        sizes=sizes,
        append_images=[scale(master, s[0]) for s in sizes],
    )
    print(f"  {os.path.relpath(path, ROOT)}  ICO(16/24/32/48/64/128/256)")


def build_icns(path, master):
    entries = [
        ("icp4", 16), ("icp5", 32), ("ic11", 32), ("icp6", 64),
        ("ic07", 128), ("ic08", 256), ("ic13", 256), ("ic09", 512),
        ("ic14", 512), ("ic10", 1024),
    ]
    chunks = b""
    for typ, size in entries:
        img = scale(master, size)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        data = buf.getvalue()
        chunks += typ.encode() + struct.pack(">I", len(data) + 8) + data
    with open(path, "wb") as f:
        f.write(b"icns" + struct.pack(">I", 8 + len(chunks)) + chunks)
    print(f"  {os.path.relpath(path, ROOT)}  ICNS(16/32/64/128/256/512/1024)")


def main():
    os.makedirs(ICONS, exist_ok=True)
    master = master_img()
    print("从官方素材生成图标 →", ICONS)

    build_ico(os.path.join(ICONS, "icon.ico"), master)
    build_icns(os.path.join(ICONS, "icon.icns"), master)

    save_png(scale(master, 512), os.path.join(ICONS, "icon.png"))
    save_png(scale(master, 32), os.path.join(ICONS, "32x32.png"))
    save_png(scale(master, 64), os.path.join(ICONS, "64x64.png"))
    save_png(scale(master, 128), os.path.join(ICONS, "128x128.png"))
    save_png(scale(master, 256), os.path.join(ICONS, "128x128@2x.png"))

    for size, name in [
        (30, "Square30x30Logo.png"), (44, "Square44x44Logo.png"),
        (50, "StoreLogo.png"), (71, "Square71x71Logo.png"),
        (89, "Square89x89Logo.png"), (107, "Square107x107Logo.png"),
        (142, "Square142x142Logo.png"), (150, "Square150x150Logo.png"),
        (284, "Square284x284Logo.png"), (310, "Square310x310Logo.png"),
    ]:
        save_png(scale(master, size), os.path.join(ICONS, name))

    save_png(master.copy(), os.path.join(ROOT, "app-icon.png"))

    # 顶栏 glyph：官方透明底版本（浅=黑环 / 深=白环）
    assets = os.path.join(ROOT, "ui", "src", "assets")
    os.makedirs(assets, exist_ok=True)
    for src, name in ((GLYPH_LIGHT, "brand-glyph-light.png"), (GLYPH_DARK, "brand-glyph-dark.png")):
        g = Image.open(src).convert("RGBA")
        g = g.resize((128, 128), Image.LANCZOS)
        save_png(g, os.path.join(assets, name))

    print("完成。")


if __name__ == "__main__":
    main()
