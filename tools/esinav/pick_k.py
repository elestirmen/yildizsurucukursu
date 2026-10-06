import sys, os, re, glob
import pymupdf
root = sys.argv[1]
args = []
dirs = sorted(glob.glob(os.path.join(root, 'x', '*'))) + sorted(glob.glob(os.path.join(root, 'rar', '2016_02_*')))
for d in dirs:
    if not os.path.isdir(d): continue
    pdfs = sorted(glob.glob(os.path.join(d, '**', '*.pdf'), recursive=True))
    bk = [p for p in pdfs if os.path.basename(p) == 'B_K.pdf']
    if bk:
        pdfs = bk
    pick = None
    for p in pdfs:
        doc = pymupdf.open(p)
        last = ''.join(doc[i].get_text() for i in range(max(0, len(doc) - 2), len(doc)))
        if re.search(r'\bK\s+KİTAPÇIĞI', last) or os.path.basename(p) == 'B_K.pdf':
            pick = p; break
    if not pick:
        print('NOK', d, file=sys.stderr); continue
    doc = pymupdf.open(pick)
    m = re.search(r'(\d{2})[/.](\d{2})[/.](\d{4})', doc[0].get_text())
    date = f'{m.group(3)}-{m.group(2)}-{m.group(1)}'
    base = os.path.basename(d)
    if base.startswith('2016_02_'):
        typ = 'G' + base[-1]
    elif base.endswith('_YM'):
        typ = 'YM'
    else:
        typ = 'B'
    args.append(f'{date}_{typ}={pick}')
print('\n'.join(args))
