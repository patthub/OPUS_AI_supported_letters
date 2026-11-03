"""md2docx.py in.md out.docx [anchor-text comment-text ...]
Minimal converter for the subset used in the OPUS prompt files:
# / ## / ### headings, "- " and "  - " bullets, "1. " numbered items, **bold**, plain paragraphs.
Optional pairs: the first paragraph starting with anchor-text gets a Word comment."""
import re, sys
from docx import Document

src, out, *pairs = sys.argv[1:]
comments = dict(zip(pairs[::2], pairs[1::2]))
doc = Document()

def add(par, text):
    runs = []
    for i, part in enumerate(re.split(r"\*\*(.+?)\*\*", text)):
        if part:
            r = par.add_run(part); r.bold = i % 2 == 1; runs.append(r)
    plain = text.replace("**", "")
    for anchor, note in list(comments.items()):
        if plain.startswith(anchor):
            doc.add_comment(runs, text=note, author="Claude (for Szymon)", initials="C")
            del comments[anchor]

for line in open(src, encoding="utf-8").read().splitlines():
    if not line.strip():
        continue
    if m := re.match(r"(#+) (.*)", line):
        level = len(m[1])
        add(doc.add_heading("", level=0 if level == 1 else level - 1), m[2])
    elif m := re.match(r"(\s*)- (.*)", line):
        add(doc.add_paragraph(style="List Bullet 2" if m[1] else "List Bullet"), m[2])
    elif m := re.match(r"\d+\. (.*)", line):
        add(doc.add_paragraph(style="List Number"), m[1])
    else:
        add(doc.add_paragraph(), line)

assert not comments, f"anchors not found: {list(comments)}"
doc.save(out)
