from pathlib import Path
import sys

from fontTools import subset
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.ttLib import TTFont

fonts = Path(__file__).resolve().parents[2] / 'src' / 'fonts'
source = Path(sys.argv[1]).read_text(encoding='utf-8')
output = Path(sys.argv[2])
characters = set(source) | set('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-×⁻¹²³⁴⁵⁶⁷⁸⁹ΛΩεσχγ·—→←%°′″')
font = TTFont(fonts / 'terminal-source.woff2')
font.recalcTimestamp = False
cmap = font.getBestCmap()

def add_glyph(code, pen, horizontal_metrics, vertical_reference):
    name = f'u{code:04X}'
    top = font['CFF '].cff.topDictIndex[0]
    glyph = pen.getCharString(private=top.Private, globalSubrs=font['CFF '].cff.GlobalSubrs)
    top.CharStrings.charStrings[name] = len(top.CharStrings.charStringsIndex)
    top.CharStrings.charStringsIndex.append(glyph)
    top.charset.append(name)
    font.setGlyphOrder(top.charset)
    font['hmtx'].metrics[name] = horizontal_metrics
    if 'vmtx' in font:
        font['vmtx'].metrics[name] = font['vmtx'].metrics[vertical_reference]
    for table in font['cmap'].tables:
        if table.isUnicode():
            table.cmap[code] = name

def draw_square(pen, x, y):
    pen.moveTo((x, y))
    pen.lineTo((x, y + 100))
    pen.lineTo((x + 100, y + 100))
    pen.lineTo((x + 100, y))
    pen.closePath()

if 0x8F6B not in cmap:
    from fontTools.pens.recordingPen import RecordingPen
    def contours(code):
        recording = RecordingPen()
        font.getGlyphSet()[cmap[code]].draw(recording)
        result, points = [], []
        for operation, values in recording.value:
            if operation == 'moveTo': points = [values[0]]
            elif operation == 'lineTo': points.append(values[0])
            elif operation == 'closePath': result.append(points)
        return result
    def inside(x, y, paths):
        winding = 0
        for points in paths:
            for a, b in zip(points, points[1:] + points[:1]):
                cross = (b[0]-a[0])*(y-a[1])-(x-a[0])*(b[1]-a[1])
                if a[1] <= y < b[1] and cross > 0: winding += 1
                elif b[1] <= y < a[1] and cross < 0: winding -= 1
        return winding != 0
    left, right = contours(0x8F68), contours(0x7EAB)
    pen = T2CharStringPen(1200, None)
    for y in range(-200, 900, 100):
        for x in range(0, 1100, 100):
            if inside(x+50, y+50, left if x < 500 else right):
                draw_square(pen, x, y)
    add_glyph(0x8F6B, pen, (1200, 0), cmap[0x8F68])
    cmap = font.getBestCmap()

if '≠' in characters and ord('≠') not in cmap:
    # 沿用等号的宽度和横画，斜线也按字库的像素格绘制。
    equals = cmap[ord('=')]
    metrics = font['hmtx'].metrics[equals]
    pen = T2CharStringPen(metrics[0], None)
    font.getGlyphSet()[equals].draw(pen)
    for x, y in zip((100, 100, 200, 300, 300), range(100, 600, 100)):
        draw_square(pen, x, y)
    add_glyph(ord('≠'), pen, metrics, equals)
    cmap = font.getBestCmap()
missing = sorted(c for c in characters if ord(c) >= 32 and ord(c) not in cmap)
if missing:
    print('Missing glyphs:', ''.join(missing).encode('unicode_escape').decode())
options = subset.Options()
options.flavor = 'woff2'
options.name_IDs = ['*']
options.name_legacy = True
options.name_languages = ['*']
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=[ord(c) for c in characters if ord(c) in cmap])
subsetter.subset(font)
for record in font['name'].names:
    if record.nameID in (1, 4, 6, 16):
        record.string = ('PaperclipTerminal' if record.nameID == 6 else 'Paperclip Terminal').encode(record.getEncoding())
font.flavor = 'woff2'
font.save(output)
print(f'Paperclip Terminal: {output.stat().st_size:,} bytes')
