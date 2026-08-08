#!/usr/bin/env python3
"""Oxelia51 桌面应用图标生成器（UI Polish v1 §4）。

品牌伴星几何（取自 web/public/icon-glyph-64.png 实测）：
  完整圆环：中心居中，外径 0.359S / 内径 0.266S（线宽 0.093S）
  伴星点：右下 45°，圆心距主环中心 0.563S，半径 0.070S
小尺寸语义版（≤32px）：线宽 +35%、星点 +40% 且更贴近主环。

产物（直接写入 src-tauri/icons/ 与 app-icon.png）：
  icon.ico  多层 16/24/32/48/64/128/256（≤48 用语义版，≥64 用标准版）
  icon.icns macOS 全套（方形源图，圆角交给系统蒙版）
  icon.png / 32x32 / 64x64 / 128x128 / 128x128@2x / Square* / StoreLogo
  app-icon.png（1024 主图）
"""
import io
import math
import struct
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # desktop/
ICONS = os.path.join(ROOT, "src-tauri", "icons")

BG = (10, 10, 10, 255)            # #0A0A0A
RING = (250, 250, 250, 255)       # #FAFAFA
DOT = (229, 72, 77, 255)          # #E5484D
RADIUS_FRAC = 0.175               # 圆角半径占画布比（仅 Windows/Linux 烘焙；macOS 方形源）

# 品牌几何（相对画布 S 的比例）
# UI Polish v1 修订：主环加粗 0.093→0.115、星点 0.070→0.078，小尺寸辨识度更佳
R_OUT = 0.359
R_IN_STD = 0.359 - 0.115                     # 环厚 0.115
R_IN_SEM = 0.359 - 0.115 * 1.35              # 小尺寸语义版：线宽 +35%
DOT_R_STD = 0.078
DOT_R_SEM = 0.078 * 1.40                     # 星点 +40%
DOT_D_STD = 0.563
DOT_D_SEM = 0.359 + 0.078 * 1.40 + 0.045     # 贴近主环，留 0.045S 间隙


def render(size, semantic=False, rounded=True):
    """渲染单个尺寸，4~8x 超采样 + LANCZOS 降采样保证抗锯齿。"""
    SS = 8 if size <= 128 else 4
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 底：圆角方块（macOS 方形源时圆角置 0，由系统蒙版接管）
    r = int(RADIUS_FRAC * S) if rounded else 0
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=r, fill=BG)

    cx = cy = S / 2.0
    # 主环
    rout = R_OUT * S
    rin = (R_IN_SEM if semantic else R_IN_STD) * S
    d.ellipse([cx - rout, cy - rout, cx + rout, cy + rout], fill=RING)
    d.ellipse([cx - rin, cy - rin, cx + rin, cy + rin], fill=BG)

    # 伴星点（右下 45°）
    dr = DOT_R_SEM if semantic else DOT_R_STD
    dd = DOT_D_SEM if semantic else DOT_D_STD
    d_r = dr * S
    ox = cx + dd * S / math.sqrt(2)
    oy = cy + dd * S / math.sqrt(2)
    d.ellipse([ox - d_r, oy - d_r, ox + d_r, oy + d_r], fill=DOT)

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
    """多层 ICO：≤48 语义版，≥64 标准版。"""
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
    # (chunk_type, size, semantic)
    entries = [
        ("icp4", 16, True),
        ("icp5", 32, True),
        ("ic11", 32, True),   # 16@2x
        ("icp6", 64, False),  # 32@2x
        ("ic07", 128, False),
        ("ic08", 256, False),
        ("ic13", 256, False), # 128@2x
        ("ic09", 512, False),
        ("ic14", 512, False), # 256@2x
        ("ic10", 1024, False),# 512@2x
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


GLYPH_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="19.5" fill="none" stroke="{ring}" stroke-width="7"/>
  <circle cx="57" cy="57" r="5" fill="#E5484D"/>
</svg>"""


def gen_glyphs():
    """品牌伴星 glyph（透明底），顶栏/标题栏用。深浅双主题，SVG + 128px PNG。
    几何与图标同版：环外径 23/64、厚 7/64，星点 r5 于右下 45°。"""
    out_dir = os.path.join(ROOT, "ui", "src", "assets")
    os.makedirs(out_dir, exist_ok=True)
    for theme, ring_hex in (("light", "#111111"), ("dark", "#F0F0F0")):
        svg = GLYPH_SVG.format(ring=ring_hex)
        with open(os.path.join(out_dir, f"brand-glyph-{theme}.svg"), "w", encoding="utf-8") as f:
            f.write(svg)
        # PNG 128px：透明底渲染环 + 点（超采样渲染再降采样）
        S = 128
        SS = 8
        img = Image.new("RGBA", (S * SS, S * SS), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        cx = cy = (S * SS) / 2.0
        ring = (17, 17, 17, 255) if theme == "light" else (240, 240, 240, 255)
        rout = 23 * SS
        rin = (23 - 7) * SS
        d.ellipse([cx - rout, cy - rout, cx + rout, cy + rout], fill=ring)
        d.ellipse([cx - rin, cy - rin, cx + rin, cy + rin], fill=(0, 0, 0, 0))
        d.ellipse([cx + 25.5 * SS - 5 * SS, cy + 25.5 * SS - 5 * SS,
                   cx + 25.5 * SS + 5 * SS, cy + 25.5 * SS + 5 * SS], fill=DOT)
        img = img.resize((S, S), Image.LANCZOS)
        img.save(os.path.join(out_dir, f"brand-glyph-{theme}.png"), format="PNG")
        print(f"  ui/src/assets/brand-glyph-{theme}.svg/.png")


def main():
    os.makedirs(ICONS, exist_ok=True)
    print("生成图标全套 →", ICONS)

    build_ico(os.path.join(ICONS, "icon.ico"))
    build_icns(os.path.join(ICONS, "icon.icns"))

    # PNG 全套
    save_png(render_std(512), os.path.join(ICONS, "icon.png"))
    save_png(render_sem(32), os.path.join(ICONS, "32x32.png"))
    save_png(render_std(64), os.path.join(ICONS, "64x64.png"))
    save_png(render_std(128), os.path.join(ICONS, "128x128.png"))
    save_png(render_std(256), os.path.join(ICONS, "128x128@2x.png"))

    # Square* / StoreLogo（Windows 磁贴；≤48 用语义版，其余标准版）
    for size, name in [
        (30, "Square30x30Logo.png"), (44, "Square44x44Logo.png"),
        (50, "StoreLogo.png"), (71, "Square71x71Logo.png"),
        (89, "Square89x89Logo.png"), (107, "Square107x107Logo.png"),
        (142, "Square142x142Logo.png"), (150, "Square150x150Logo.png"),
        (284, "Square284x284Logo.png"), (310, "Square310x310Logo.png"),
    ]:
        img = render_sem(size) if size <= 48 else render_std(size)
        save_png(img, os.path.join(ICONS, name))

    # 1024 主图（设计稿 / 后续 tauri icon 源）
    save_png(render_std(1024), os.path.join(ROOT, "app-icon.png"))

    gen_glyphs()

    print("完成。")


if __name__ == "__main__":
    main()
