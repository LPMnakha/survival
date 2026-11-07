# Génère les icônes (web et Android) : une petite forêt d'épicéas au crépuscule,
# dans le style des icônes de Détente. Usage : python3 tools/icons.py
import math, os, random
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
S = 1024

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def scene(safe=1.0):
    im = Image.new('RGB', (S, S))
    d = ImageDraw.Draw(im)
    top, bot = (38, 30, 45), (64, 40, 38)
    for y in range(S):
        d.line([(0, y), (S, y)], fill=lerp(top, bot, min(1, y / (S * 0.78))))
    # lueur chaude à l'horizon
    glow = Image.new('L', (S, S), 0)
    ImageDraw.Draw(glow).ellipse([S * 0.18, S * 0.52, S * 0.82, S * 0.98], fill=150)
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.08))
    im = Image.composite(Image.new('RGB', (S, S), (233, 160, 97)), im, glow)
    d = ImageDraw.Draw(im)
    c = S / 2
    k = safe  # réduit le dessin pour la zone sûre des icônes « maskable »
    P = lambda x, y: (c + (x - c) * k, c + (y - c) * k)
    random.seed(4)
    for x, y, r in [(170, 190, 5), (300, 120, 4), (760, 150, 5), (860, 300, 4), (620, 250, 3), (430, 200, 3), (130, 360, 3)]:
        px, py = P(x, y); r *= k
        d.ellipse([px - r, py - r, px + r, py + r], fill=(246, 230, 196))
    # épicéas low poly (facette claire à gauche, sombre à droite)
    def spruce(x, base, h, w, dark, light, trunk=(78, 56, 40)):
        tw = w * 0.09
        d.polygon([P(x - tw, base), P(x + tw, base), P(x + tw, base - h * 0.2), P(x - tw, base - h * 0.2)], fill=trunk)
        tiers = 4
        for t in range(tiers):
            y0 = base - h * (0.12 + t * 0.2)
            hh = h * 0.38
            ww = w * (1 - t * 0.2) / 2
            d.polygon([P(x - ww, y0), P(x, y0), P(x, y0 - hh)], fill=light)
            d.polygon([P(x, y0), P(x + ww, y0), P(x, y0 - hh)], fill=dark)
    spruce(300, 830, 470, 250, (38, 64, 46), (49, 82, 58))
    spruce(745, 840, 430, 230, (38, 64, 46), (49, 82, 58))
    spruce(512, 870, 640, 330, (44, 74, 51), (58, 98, 68))
    # colline
    pts = [P(x, 820 + 70 * (1 - math.cos((x / S) * math.pi * 2)) * 0.25 - 30 * math.sin(x / S * math.pi)) for x in range(0, S + 1, 16)]
    d.polygon(pts + [P(S, S + 400), P(0, S + 400)], fill=(52, 66, 52))
    return im

def rounded(im, radius):
    m = Image.new('L', (S, S), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, S - 1, S - 1], radius=radius, fill=255)
    out = im.convert('RGBA'); out.putalpha(m); return out

def circle(im):
    m = Image.new('L', (S, S), 0)
    ImageDraw.Draw(m).ellipse([0, 0, S - 1, S - 1], fill=255)
    out = im.convert('RGBA'); out.putalpha(m); return out

full = scene()
safe = scene(0.8)
r = rounded(full, int(S * 0.225))
save = lambda im, path, size: (os.makedirs(os.path.dirname(path), exist_ok=True), im.resize((size, size), Image.LANCZOS).save(path, optimize=True))
icons = os.path.join(ROOT, 'www', 'icons')
save(r, os.path.join(icons, 'icon-512.png'), 512)
save(r, os.path.join(icons, 'icon-192.png'), 192)
save(safe, os.path.join(icons, 'icon-512-maskable.png'), 512)
save(full, os.path.join(icons, 'apple-touch-icon.png'), 180)
for name, size in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
    base = os.path.join(ROOT, 'android-res', 'mipmap-' + name)
    save(r, os.path.join(base, 'ic_launcher.png'), size)
    save(circle(full), os.path.join(base, 'ic_launcher_round.png'), size)
print('ok')
