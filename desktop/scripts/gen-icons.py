#!/usr/bin/env python3
"""Oxelia51 桌面应用图标生成器（按官方品牌规范 v1.0）。

权威几何（brand-spec.md / final-icon-light.svg，相对画布 S）：
  画布 512；月环圆心 (0.445, 0.445)、半径 0.273、线宽 0.102
  星点圆心 (0.805, 0.805)、半径 0.066（45° 右下，距环心 1.857R）
  「月亮旁边有一颗保持距离的小星」
色彩（三色）：夜 #0A0A0A（环/深图形）· 光 #FAFAFA（底/浅图形）· 心跳 #E5484D（星点）

默认图标 = 白底黑圈（光底版，用户指定为默认）：
  圆角方块底 #FAFAFA + 黑环 #0A0A0A + 红点 #E5484D。

产物（直接写入 src-tauri/icons/ 与 app-icon.png）：
  icon.ico  多层 16/24/32/48/64/128/256（≤48 用语义版：线宽+35%、星点+40%）
  icon.icns macOS 全套（方形源图，圆角交给系统蒙版）
  icon.png / 32x32 / 64x64 / 128x128 / 128x128@2x / Square* / StoreLogo
  app-icon.png（1024 主图）
"""
import io
import struct
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # desktop/
ICONS = os.path.join(ROOT, "src-tauri", "icons")

LIGHT_BG = (250, 250, 250, 255)   # 光 #FAFAFA —— 底
DARK = (10, 10, 10, 255)          # 夜 #0A0A0A —— 环/深图形
DOT = (229, 72, 77, 255)          # 心跳 #E5484D —— 星点

# 官方几何（相对画布 S）
RX = 0.203                         # 圆角半径（Windows/Linux 烘焙；macOS 方形源）
RING_CX = 0.445                    # 月环圆心 x/y
RING_R = 0.273                     # 月环半径
RING_W = 0.102                     # 月环线宽
DOT_CX = 0.805                     # 星点圆心 x/y（45° 右下）
DOT_R = 0.066                      # 星点半径


def render(size, semantic=False, rounded=True):
    """渲染单个尺寸：超采样 + LANCZOS 降采样。默认 = 白底黑圈（光底版）。"""
    SS = 8 if size <= 128 else 4
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 底：白色圆角方块（macOS 方形源时圆角置 0，由系统蒙版接管）
    r = int(RX * S) if rounded else 0
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=r, fill=LIGHT_BG)

    cx = cy = RING_CX * S
    # 月环（黑）
    rw = RING_W * S * (1.35 if semantic else 1.0)
    d.ellipse([cx - RING_R * S, cy - RING_R * S, cx + RING_R * S, cy + RING_R * S],
              fill=None, outline=DARK, width=max(1, round(rw)))
    # 星点（红，45° 右下，保持品牌距离）
    dr = DOT_R * S * (1.4 if semantic else 1.0)
    ox = oy = DOT_CX * S
    d.ellipse([ox - dr, oy - dr, ox + dr, oy + dr], fill=DOT)

    return img.resize((size, size), Image.LANCZOS)


def render_std(size):
    return render(size, semantic=False, rounded=True)


def render_sem(size):
    return render(size, semantic=True, rounded=True)


def render_mac(size):
    return render(size, semantic=(size <= 32), rounded=False)


def save_png(img, path):
    img.save(path, format="PNG")
    print(f"  {os.path.relpath(path, ROOT)}  {img.size[0]}x{img.size[1]}")


def build_ico(path):
    """多层 ICO：≤48 语义版，≥64 标准版。白底黑圈。"""
    largest = render_std(256)
    small_sem = [render_sem(s) for s in (16, 24, 32, 48)]
    small_std = [render_std(s) for s in (64, 128, 256)]
    largest.save(
        path,
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
        append_images=small_sem + small_std,
    )
    print(f"  {os.path.relpath(path, ROOT)}  ICO(16/24/32/48/64/128/256)")


def build_icns(path):
    """ICNS 容器（PNG 分块）。小尺寸用语义版，大尺寸用标准版，方形源图。"""
    entries = [
        ("icp4", 16, True), ("icp5", 32, True), ("ic11", 32, True),
        ("icp6", 64, False), ("ic07", 128, False), ("ic08", 256, False),
        ("ic13", 256, False), ("ic09", 512, False), ("ic14", 512, False),
        ("ic10", 1024, False),
    ]
    chunks = b""
    for typ, size, sem in entries:
        img = render(size, semantic=sem, rounded=False)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        data = buf.getvalue()
        chunks += typ.encode() + struct.pack(">I", len(data) + 8) + data
    total = 8 + len(chunks)
    with open(path, "wb") as f:
        f.write(b"icns" + struct.pack(">I", total) + chunks)
    print(f"  {os.path.relpath(path, ROOT)}  ICNS(16/32/64/128/256/512/1024)")


GLYPH_SVG_LIGHT = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <circle cx="228" cy="228" r="140" fill="none" stroke="#0A0A0A" stroke-width="52"/>
  <circle cx="412" cy="412" r="34" fill="#E5484D"/>
</svg>"""

GLYPH_SVG_DARK = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <circle cx="228" cy="228" r="140" fill="none" stroke="#FAFAFA" stroke-width="52"/>
  <circle cx="412" cy="412" r="34" fill="#E5484D"/>
</svg>"""


def gen_glyphs():
    """品牌伴星 glyph（透明底），顶栏用。官方几何。
    浅色面用黑环（light）、深色面用白环（dark）；星点恒红。"""
    out_dir = os.path.join(ROOT, "ui", "src", "assets")
    os.makedirs(out_dir, exist_ok=True)
    for theme, svg in (("light", GLYPH_SVG_LIGHT), ("dark", GLYPH_SVG_DARK)):
        with open(os.path.join(out_dir, f"brand-glyph-{theme}.svg"), "w", encoding="utf-8") as f:
            f.write(svg)
        # PNG 128px：超采样渲染再降采样
        S = 128
        SS = 8
        img = Image.new("RGBA", (S * SS, S * SS), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        ring = DARK if theme == "light" else (250, 250, 250, 255)
        cx = cy = RING_CX * (S * SS)
        rw = RING_W * (S * SS)
        d.ellipse([cx - RING_R * (S * SS), cy - RING_R * (S * SS),
                   cx + RING_R * (S * SS), cy + RING_R * (S * SS)],
                  fill=None, outline=ring, width=max(1, round(rw)))
        ox = oy = DOT_CX * (S * SS)
        dr = DOT_R * (S * SS)
        d.ellipse([ox - dr, oy - dr, ox + dr, oy + dr], fill=DOT)
        img = img.resize((S, S), Image.LANCZOS)
        img.save(os.path.join(out_dir, f"brand-glyph-{theme}.png"), format="PNG")
        print(f"  ui/src/assets/brand-glyph-{theme}.svg/.png")


def main():
    os.makedirs(ICONS, exist_ok=True)
    print("生成图标全套（白底黑圈·光底版）→", ICONS)

    build_ico(os.path.join(ICONS, "icon.ico"))
    build_icns(os.path.join(ICONS, "icon.icns"))

    save_png(render_std(512), os.path.join(ICONS, "icon.png"))
    save_png(render_sem(32), os.path.join(ICONS, "32x32.png"))
    save_png(render_std(64), os.path.join(ICONS, "64x64.png"))
    save_png(render_std(128), os.path.join(ICONS, "128x128.png"))
    save_png(render_std(256), os.path.join(ICONS, "128x128@2x.png"))

    for size, name in [
        (30, "Square30x30Logo.png"), (44, "Square44x44Logo.png"),
        (50, "StoreLogo.png"), (71, "Square71x71Logo.png"),
        (89, "Square89x89Logo.png"), (107, "Square107x107Logo.png"),
        (142, "Square142x142Logo.png"), (150, "Square150x150Logo.png"),
        (284, "Square284x284Logo.png"), (310, "Square310x310Logo.png"),
    ]:
        img = render_sem(size) if size <= 48 else render_std(size)
        save_png(img, os.path.join(ICONS, name))

    save_png(render_std(1024), os.path.join(ROOT, "app-icon.png"))

    gen_glyphs()
    print("完成。")


if __name__ == "__main__":
    main()
