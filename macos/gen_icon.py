"""生成「薪水铸币厂」应用图标：钞纸底 + 金币铸字。"""
from PIL import Image, ImageDraw, ImageFont
import os, subprocess, shutil

SIZE = 1024
PAPER = (241, 234, 219, 255)
PAPER_EDGE = (222, 210, 184, 255)
GOLD = (168, 124, 42, 255)
GOLD_HI = (224, 190, 110, 255)
INK = (44, 91, 69, 255)
IVORY = (251, 248, 240, 255)

img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# 券面底：圆角方形 + 细边
d.rounded_rectangle([64, 64, SIZE - 64, SIZE - 64], radius=196, fill=PAPER, outline=PAPER_EDGE, width=8)
d.rounded_rectangle([104, 104, SIZE - 104, SIZE - 104], radius=160, outline=(168, 124, 42, 90), width=4)

# 金币
cx = cy = SIZE // 2
r_out, r_in = 300, 268
d.ellipse([cx - r_out, cy - r_out, cx + r_out, cy + r_out], fill=GOLD)
d.ellipse([cx - r_out + 10, cy - r_out + 10, cx + r_out - 10, cy + r_out - 10], outline=GOLD_HI, width=6)
d.ellipse([cx - r_in, cy - r_in, cx + r_in, cy + r_in], outline=IVORY, width=5)
d.ellipse([cx - r_in + 26, cy - r_in + 26, cx + r_in - 26, cy + r_in - 26], outline=(251, 248, 240, 120), width=3)

# 齿边刻度
for i in range(72):
    import math
    a = i * (2 * math.pi / 72)
    x1 = cx + (r_out - 34) * math.cos(a)
    y1 = cy + (r_out - 34) * math.sin(a)
    x2 = cx + (r_out - 12) * math.cos(a)
    y2 = cy + (r_out - 12) * math.sin(a)
    d.line([x1, y1, x2, y2], fill=(224, 190, 110, 110), width=3)

font_path = "/System/Library/Fonts/Supplemental/Songti.ttc"
font = ImageFont.truetype(font_path, 320, index=1)
text = "铸"
bbox = d.textbbox((0, 0), text, font=font)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
d.text((cx - tw / 2 - bbox[0], cy - th / 2 - bbox[1] + 6), text, font=font, fill=IVORY)

out_dir = os.path.join(os.path.dirname(__file__), "assets")
os.makedirs(out_dir, exist_ok=True)
master = os.path.join(out_dir, "icon-1024.png")
img.save(master)

iconset = os.path.join(out_dir, "AppIcon.iconset")
shutil.rmtree(iconset, ignore_errors=True)
os.makedirs(iconset)

pairs = [(16, "icon_16x16.png"), (32, "icon_16x16@2x.png"), (32, "icon_32x32.png"),
         (64, "icon_32x32@2x.png"), (128, "icon_128x128.png"), (256, "icon_128x128@2x.png"),
         (256, "icon_256x256.png"), (512, "icon_256x256@2x.png"), (512, "icon_512x512.png"),
         (1024, "icon_512x512@2x.png")]
for px, name in pairs:
    img.resize((px, px), Image.LANCZOS).save(os.path.join(iconset, name))

subprocess.run(["iconutil", "-c", "icns", iconset, "-o", os.path.join(out_dir, "AppIcon.icns")], check=True)
print("icon ok:", os.path.join(out_dir, "AppIcon.icns"))
