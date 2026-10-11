# Poly Haven (CC0) indirici: python3 -I polyhaven.py <hedef> tex <id> [1k] | hdri <id> [2k] | model <id> [1k]
import json, os, sys, urllib.request
dst, kind, aid = sys.argv[1], sys.argv[2], sys.argv[3]
res = sys.argv[4] if len(sys.argv) > 4 else '1k'
UA = {'User-Agent': 'Mozilla/5.0 yildiz-video'}
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=120).read()
f = json.loads(get('https://api.polyhaven.com/files/' + aid))
out = []
if kind == 'tex':
    os.makedirs(os.path.join(dst, aid), exist_ok=True)
    for m, key in (('diff', 'Diffuse'), ('nor', 'nor_gl'), ('rough', 'Rough'), ('ao', 'AO')):
        if key in f and res in f[key]:
            node = f[key][res].get('jpg') or f[key][res].get('png')
            p = os.path.join(dst, aid, m + '.' + node['url'].rsplit('.', 1)[1]); open(p, 'wb').write(get(node['url'])); out.append(p)
elif kind == 'hdri':
    node = f['hdri'][res]['hdr']; p = os.path.join(dst, aid + '_' + res + '.hdr'); open(p, 'wb').write(get(node['url'])); out.append(p)
elif kind == 'model':
    node = f['gltf'][res]['gltf']; d = os.path.join(dst, aid); os.makedirs(d, exist_ok=True)
    open(os.path.join(d, aid + '.gltf'), 'wb').write(get(node['url']))
    for rel, inc in node.get('include', {}).items():
        p = os.path.join(d, rel); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'wb').write(get(inc['url'])); out.append(p)
print(aid, len(out), 'dosya', sum(os.path.getsize(p) for p in out) // 1024, 'KB')
