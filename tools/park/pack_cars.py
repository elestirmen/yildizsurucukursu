"""Kenney Car Kit (CC0) GLB modellerini park simülatörü için tek, sıkıştırılmış ikili dosyaya çevirir.
Kullanım: python3 -I pack_cars.py <GLB dizini> <çıktı.bin>
Biçim: 'YPK1' + uint32 JSON uzunluğu + JSON (4'e tamamlanmış) + veri.
Her geometri: konum int16×3 (ölçek JSON'da), normal int8×4, uv uint16×2, indis uint16."""
import json, struct, sys, math
SRC, OUT = sys.argv[1], sys.argv[2]
MODELS = ['sedan', 'sedan-sports', 'hatchback-sports', 'suv', 'suv-luxury', 'taxi', 'van']

def glb(fn):
    b = open(fn, 'rb').read(); ln = struct.unpack('<I', b[8:12])[0]; off = 12; ch = []
    while off < ln:
        cl, ct = struct.unpack('<II', b[off:off + 8]); ch.append(b[off + 8:off + 8 + cl]); off += 8 + cl
    return json.loads(ch[0]), ch[1]

def acc(J, B, i):
    a = J['accessors'][i]; bv = J['bufferViews'][a['bufferView']]
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    fmt = {5126: 'f', 5123: 'H', 5125: 'I', 5121: 'B'}[a['componentType']]
    sz = struct.calcsize(fmt); st = bv.get('byteStride', sz * n); base = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    return [struct.unpack_from('<' + fmt * n, B, base + k * st) for k in range(a['count'])]

def prim(J, B, node):
    pr = J['meshes'][node['mesh']]['primitives'][0]
    t = node.get('translation', [0, 0, 0])
    assert 'rotation' not in node and 'scale' not in node
    P = [(p[0] + t[0], p[1] + t[1], p[2] + t[2]) for p in acc(J, B, pr['attributes']['POSITION'])]
    N = acc(J, B, pr['attributes']['NORMAL'])
    UV = acc(J, B, pr['attributes']['TEXCOORD_0'])
    I = [x[0] for x in acc(J, B, pr['indices'])]
    return P, N, UV, I

def merge(parts):
    P, N, UV, I = [], [], [], []
    for p, n, uv, idx in parts:
        o = len(P); P += p; N += n; UV += uv; I += [x + o for x in idx]
    return P, N, UV, I

blob = bytearray()
def put(arr):
    global blob
    while len(blob) % 4: blob.append(0)
    o = len(blob); blob += arr; return o

def geom(P, N, UV, I, rel=None):
    m = max(max(abs(c) for c in p) for p in P)
    k = 32767 / m
    pos = b''.join(struct.pack('<3h', *(round(c * k) for c in p)) for p in P)
    nor = b''.join(struct.pack('<4b', *(max(-127, min(127, round(c * 127))) for c in n), 0) for n in N)
    uv = b''.join(struct.pack('<2H', *(max(0, min(65535, round(c * 65535))) for c in t)) for t in UV)
    assert len(P) < 65536
    idx = b''.join(struct.pack('<H', i) for i in I)
    return {'n': len(P), 'ni': len(I), 's': 1 / k, 'p': put(pos), 'nr': put(nor), 'uv': put(uv), 'i': put(idx)}

def paint_cell(P, UV, I):
    area = {}
    for t in range(0, len(I), 3):
        a, b, c = I[t:t + 3]
        ux = (UV[a][0] + UV[b][0] + UV[c][0]) / 3; vy = (UV[a][1] + UV[b][1] + UV[c][1]) / 3
        cell = (int(vy * 4), int(ux * 8))
        p, q, r = P[a], P[b], P[c]
        u = [q[i] - p[i] for i in range(3)]; v = [r[i] - p[i] for i in range(3)]
        cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
        area[cell] = area.get(cell, 0) + math.sqrt(sum(x * x for x in cr)) / 2
    # kaporta: 2. sıradaki (indis 1) en geniş alanlı renk hücresi
    return max((v, k) for k, v in area.items() if k[0] == 1)[1]

out = {'models': {}, 'wheel': None}
J0, B0 = glb(f'{SRC}/sedan.glb')
wl = next(n for n in J0['nodes'] if n['name'] == 'wheel-front-left')
P, N, UV, I = prim(J0, B0, dict(wl, translation=[0, 0, 0]))
out['wheel'] = geom(P, N, UV, I)            # sol teker (dış yüz +x); sağ teker x'te aynalanır
for m in MODELS:
    J, B = glb(f'{SRC}/{m}.glb')
    body = [prim(J, B, n) for n in J['nodes'] if not n['name'].startswith('wheel')]
    P, N, UV, I = merge(body)
    wheels = [[n['translation'][0], n['translation'][1], n['translation'][2]] for n in J['nodes'] if n['name'].startswith('wheel-') and n['name'] != 'wheel-back']
    xs = [p[0] for p in P]; ys = [p[1] for p in P]; zs = [p[2] for p in P]
    out['models'][m] = {'g': geom(P, N, UV, I), 'paint': list(paint_cell(P, UV, I)), 'wheels': wheels,
                        'box': [min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)]}
js = json.dumps(out, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
open(OUT, 'wb').write(b'YPK1' + struct.pack('<I', len(js)) + js + bytes(blob))
print('ok', len(js), len(blob), {m: out['models'][m]['paint'] for m in MODELS})
