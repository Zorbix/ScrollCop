"""Render the social preview artwork. Requires Pillow (authoring only)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SCALE = 2
image = Image.new('RGB', (1200 * SCALE, 630 * SCALE), '#f7f8f2')
draw = ImageDraw.Draw(image)
fonts = Path('/System/Library/Fonts/Supplemental')

def text(x, y, value, size=16, color='#233c32', face='Arial.ttf'):
    font = ImageFont.truetype(str(fonts / face), size * SCALE)
    draw.text((x * SCALE, y * SCALE), value, font=font, fill=color)

def box(bounds, fill, radius=0, outline=None):
    draw.rounded_rectangle(tuple(int(v * SCALE) for v in bounds), radius=radius * SCALE,
                           fill=fill, outline=outline, width=SCALE)

def badge(x, y, size):
    pts = [(24,3),(16,7),(6,10),(6,27),(8,35),(14,43),(24,52),(34,43),(40,35),(42,27),(42,10),(32,7)]
    draw.polygon([(int((x+a*size/56)*SCALE),int((y+b*size/56)*SCALE)) for a,b in pts],fill='#233c32')
    star = [(24,17),(27.25,23.6),(34.53,24.66),(29.26,29.79),(30.51,37.04),(24,33.62),(17.49,37.04),(18.74,29.79),(13.47,24.66),(20.75,23.6)]
    draw.polygon([(int((x+a*size/56)*SCALE),int((y+b*size/56)*SCALE)) for a,b in star],fill='#f3f1df')

badge(58, 44, 44)
text(106, 51, 'ScrollCop', 26, face='Arial Bold.ttf')
text(62, 152, 'YOUR FOCUS HAS BACKUP', 13, '#39735d', 'Arial Bold.ttf')
text(58, 194, 'Put distractions', 61, face='Georgia.ttf')
text(58, 266, 'behind bars.', 61, face='Georgia.ttf')
text(62, 364, 'Less feed. More focus.', 22, '#68786b')
box((62, 439, 307, 494), '#233c32', 10)
text(85, 455, 'Download for Chrome', 17, '#ffffff', 'Arial Bold.ttf')
text(62, 551, 'No account. No tracking. Your rules.', 15, '#68786b')
box((715, 69, 1140, 558), '#e9eddf', 26)
text(744, 91, 'CASE NO. 001  /  EXCESSIVE SCROLLING', 11, '#68786b')
box((747, 126, 1108, 510), '#f7f8f2', 17, '#d7dfcd')
badge(768, 147, 36)
text(807, 152, 'ScrollCop', 21, face='Arial Bold.ttf')
text(772, 207, 'A little less', 36, face='Georgia.ttf')
text(772, 248, 'distraction', 36, face='Georgia.ttf')
box((770, 311, 1085, 387), '#ffffff', 12, '#dce3d5')
text(783, 326, 'Put distractions behind bars', 13, face='Arial Bold.ttf')
text(783, 351, 'ScrollCop is on duty.', 11, '#68786b')
box((1034, 336, 1073, 359), '#39735d', 12)
box((1053, 339, 1070, 356), '#ffffff', 9)
text(775, 406, '15 websites behind bars.', 12, '#39735d')
box((770, 441, 1085, 482), '#f7f8f2', 8, '#dce3d5')
text(783, 454, 'Manage blocked websites', 12)
image.resize((1200, 630), Image.Resampling.LANCZOS).save(ROOT / 'docs/assets/thumbnail.png')
print('Created docs/assets/thumbnail.png (1200 × 630)')
