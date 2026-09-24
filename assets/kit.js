/* Ürgüp Yıldız Sürücü Kursu — ortak çizim kiti
   Trafik Akademisi ve e-Sınav aynı levha, gösterge ışığı, araç ve sahne çizimlerini kullanır. */
(() => {
  'use strict';

  const F = 'font-family="Archivo, Arial, sans-serif"';
  const RED = '#d71920', BLUE = '#1e5aa8', YEL = '#f7c600', INK = '#111';
  const f1 = (n) => Number(n.toFixed(1));
  const wrap = (inner, vb = '0 0 100 100') => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" focusable="false">${inner}</svg>`;

  /* ---------- Levha çerçeveleri ---------- */
  const TRI = (inner) => wrap(`<path d="M50 9 93 85H7z" fill="#fff" stroke="${RED}" stroke-width="9" stroke-linejoin="round"/>${inner}`);
  const PRO = (inner) => wrap(`<circle cx="50" cy="50" r="47" fill="#fff"/><circle cx="50" cy="50" r="41.5" fill="none" stroke="${RED}" stroke-width="9"/>${inner}`);
  const PRO_BLUE = (inner) => wrap(`<circle cx="50" cy="50" r="47" fill="#fff"/><circle cx="50" cy="50" r="40" fill="${BLUE}"/><circle cx="50" cy="50" r="41.5" fill="none" stroke="${RED}" stroke-width="9"/>${inner}`);
  const MAN = (inner) => wrap(`<circle cx="50" cy="50" r="47" fill="#fff"/><circle cx="50" cy="50" r="44" fill="${BLUE}"/>${inner}`);
  const INF = (inner) => wrap(`<rect x="6" y="6" width="88" height="88" rx="9" fill="#fff"/><rect x="10" y="10" width="80" height="80" rx="7" fill="${BLUE}"/>${inner}`);
  const END = (inner) => wrap(`<circle cx="50" cy="50" r="47" fill="#fff" stroke="#9aa0a8" stroke-width="1.5"/>${inner}${Array.from({ length: 5 }, (_, i) => {
    const d = (i - 2) * 4.2;
    return `<path d="M${f1(20 + d)} ${f1(80 + d)}L${f1(80 + d)} ${f1(20 + d)}" stroke="#16171b" stroke-width="1.8"/>`;
  }).join('')}`);
  const NUM = (n, fill, size = 36) => `<text x="50" y="52" text-anchor="middle" dominant-baseline="central" ${F} font-weight="800" font-size="${size}" fill="${fill}">${n}</text>`;
  const slash = (w = 8) => `<path d="M22 22 78 78" stroke="${RED}" stroke-width="${w}"/>`;
  const octagon = (R) => Array.from({ length: 8 }, (_, i) => {
    const a = ((22.5 + i * 45) * Math.PI) / 180;
    return `${f1(50 + R * Math.cos(a))},${f1(50 - R * Math.sin(a))}`;
  }).join(' ');
  const walker = (c) => `<g fill="${c}"><circle cx="52" cy="30" r="5"/><path d="M50 37l-7 15 6 4-3 15h5l3-13 5 5 1 10h5l-2-13-6-7 2-7 6 5h7v-4h-5l-9-10z"/></g>`;
  // Saat yönünün tersine dönen üç ok (ada etrafında dönünüz)
  function ringArrows(r, color, w) {
    let s = '';
    const P = (deg) => { const a = (deg * Math.PI) / 180; return [50 + r * Math.cos(a), 50 - r * Math.sin(a)]; };
    [100, 220, 340].forEach((a0) => {
      const a1 = a0 + 78, [x0, y0] = P(a0), [x1, y1] = P(a1);
      const t = (a1 * Math.PI) / 180, dx = -Math.sin(t), dy = -Math.cos(t), nx = Math.cos(t), ny = -Math.sin(t);
      s += `<path d="M${f1(x0)} ${f1(y0)}A${r} ${r} 0 0 0 ${f1(x1)} ${f1(y1)}" stroke="${color}" stroke-width="${w}" fill="none"/>`;
      s += `<path d="M${f1(x1 + dx * 9)} ${f1(y1 + dy * 9)}L${f1(x1 + nx * 7.5)} ${f1(y1 + ny * 7.5)}L${f1(x1 - nx * 7.5)} ${f1(y1 - ny * 7.5)}z" fill="${color}"/>`;
    });
    return s;
  }

  /* ---------- Levha kütüphanesi ----------
     cat: uyari | yasak | mecburi | bilgi | ozel  (Levhaların dili dersi bu gruplamayı kullanır) */
  const SIGNS = {
    // Tehlike uyarı işaretleri
    okul: { cat: 'uyari', name: 'Okul geçidi', svg: () => TRI(`<g fill="${INK}"><circle cx="41" cy="45" r="4.5"/><path d="M38 51h7l3 12-3 1-2-6-1 13h-3l-1-9-2 9h-3l2-13-3 5-2-2z"/><circle cx="58" cy="40" r="5"/><path d="M54 47h8l4 13-3 1-2-7-1 15h-3l-1-10-2 10h-3l1-15-3 6-2-2z"/></g>`) },
    kaygan: { cat: 'uyari', name: 'Kaygan yol', svg: () => TRI(`<g fill="${INK}"><rect x="38" y="38" width="24" height="15" rx="4"/><rect x="36" y="50" width="6" height="7" rx="2"/><rect x="58" y="50" width="6" height="7" rx="2"/></g><path d="M36 74c4-6 8-6 12 0M52 74c4-6 8-6 12 0" stroke="${INK}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`) },
    virajsag: { cat: 'uyari', name: 'Sağa tehlikeli viraj', svg: () => TRI(`<path d="M42 79V66c0-8 5-13 13-13h2" stroke="${INK}" stroke-width="6.5" fill="none"/><path d="M55 44.5 66 53l-11 8.5z" fill="${INK}"/>`) },
    virajsol: { cat: 'uyari', name: 'Sola tehlikeli viraj', svg: () => TRI(`<path d="M58 79V66c0-8-5-13-13-13h-2" stroke="${INK}" stroke-width="6.5" fill="none"/><path d="M45 44.5 34 53l11 8.5z" fill="${INK}"/>`) },
    yayauyari: { cat: 'uyari', name: 'Yaya geçidi', svg: () => TRI(`<g transform="translate(0 6) scale(.9) translate(5 4)">${walker(INK)}</g><path d="M34 76h32" stroke="${INK}" stroke-width="4" stroke-dasharray="5 3"/>`) },
    dikkat: { cat: 'uyari', name: 'Dikkat', svg: () => TRI(`<rect x="45.5" y="36" width="9" height="28" rx="3" fill="${INK}"/><circle cx="50" cy="72" r="5" fill="${INK}"/>`) },
    kasis: { cat: 'uyari', name: 'Kasisli yol', svg: () => TRI(`<path d="M28 72c5-14 13-14 18 0M46 72c5-14 13-14 18 0" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M26 74h48" stroke="${INK}" stroke-width="3"/>`) },
    daralan: { cat: 'uyari', name: 'Her iki taraftan daralan kaplama', svg: () => TRI(`<path d="M33 80c0-12 9-15 9-25V38M67 80c0-12-9-15-9-25V38" stroke="${INK}" stroke-width="5" fill="none"/>`) },
    ikiyon: { cat: 'uyari', name: 'İki yönlü trafik', svg: () => TRI(`<path d="M58 79V50" stroke="${INK}" stroke-width="5"/><path d="M50.5 53 58 40l7.5 13z" fill="${INK}"/><path d="M42 42v29" stroke="${INK}" stroke-width="5"/><path d="M34.5 68 42 81l7.5-13z" fill="${INK}"/>`) },
    isikli: { cat: 'uyari', name: 'Işıklı işaret cihazı', svg: () => TRI(`<circle cx="50" cy="44" r="6.2" fill="${RED}"/><circle cx="50" cy="58.5" r="6.2" fill="${YEL}"/><circle cx="50" cy="73" r="6.2" fill="#1a9e4b"/>`) },
    kavsak: { cat: 'uyari', name: 'Ana yol – tali yol kavşağı', svg: () => TRI(`<path d="M50 80V38" stroke="${INK}" stroke-width="9"/><path d="M32 60H68" stroke="${INK}" stroke-width="4.5"/>`) },
    yolcalisma: { cat: 'uyari', name: 'Yol çalışması', svg: () => TRI(`<g fill="${INK}"><circle cx="41" cy="41" r="4.6"/><path d="M58 80c2-9 8-13 18-10l2 10z"/></g><g stroke="${INK}" stroke-width="4.6" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M43 47l5 15-7 14M48 62l8 13M44 51l12 6"/><path d="M52 50l10 20" stroke-width="3"/></g><path d="M59 67l7 4-3 5-6-3z" fill="${INK}"/>`) },
    // Yasaklama / kısıtlama işaretleri
    hiz50: { cat: 'yasak', name: 'Azami hız sınırlaması (50 km/s)', svg: () => PRO(NUM(50, INK)) },
    hiz30: { cat: 'yasak', name: 'Azami hız sınırlaması (30 km/s)', svg: () => PRO(NUM(30, INK)) },
    sollamayasak: { cat: 'yasak', name: 'Öndeki taşıtı geçmek yasaktır', svg: () => PRO(`<g transform="translate(38 50)"><rect x="-8" y="-15" width="16" height="30" rx="5" fill="${RED}"/><rect x="-6" y="-9" width="12" height="7" rx="2" fill="#fff" opacity=".6"/></g><g transform="translate(62 50)"><rect x="-8" y="-15" width="16" height="30" rx="5" fill="${INK}"/><rect x="-6" y="-9" width="12" height="7" rx="2" fill="#fff" opacity=".45"/></g>`) },
    kapali: { cat: 'yasak', name: 'Taşıt trafiğine kapalı yol', svg: () => PRO('') },
    girisyok: { cat: 'yasak', name: 'Girişi olmayan yol', svg: () => wrap(`<circle cx="50" cy="50" r="47" fill="#fff"/><circle cx="50" cy="50" r="44" fill="${RED}"/><rect x="18" y="42" width="64" height="16" rx="1.5" fill="#fff"/>`) },
    sagadonulmez: { cat: 'yasak', name: 'Sağa dönülmez', svg: () => PRO(`<path d="M40 72V52c0-8 5-12 12-12h6" stroke="${INK}" stroke-width="7" fill="none"/><path d="M56 31l12 9-12 9z" fill="${INK}"/>${slash()}`) },
    soladonulmez: { cat: 'yasak', name: 'Sola dönülmez', svg: () => PRO(`<path d="M60 72V52c0-8-5-12-12-12h-6" stroke="${INK}" stroke-width="7" fill="none"/><path d="M44 31 32 40l12 9z" fill="${INK}"/>${slash()}`) },
    udonusu: { cat: 'yasak', name: 'U dönüşü yapmak yasaktır', svg: () => PRO(`<path d="M60 74V45a10 10 0 0 0-20 0v14" stroke="${INK}" stroke-width="7" fill="none"/><path d="M31 56l9 15 9-15z" fill="${INK}"/>${slash()}`) },
    parkyasak: { cat: 'yasak', name: 'Park etmek yasaktır', svg: () => PRO_BLUE(`<path d="M21 21 79 79" stroke="${RED}" stroke-width="8"/>`) },
    durakparkyasak: { cat: 'yasak', name: 'Duraklamak ve park etmek yasaktır', svg: () => PRO_BLUE(`<path d="M21 21 79 79M79 21 21 79" stroke="${RED}" stroke-width="8"/>`) },
    hizsonu: { cat: 'yasak', name: 'Azami hız sınırlaması sonu', svg: () => END(NUM(50, '#8d939c')) },
    yasaksonu: { cat: 'yasak', name: 'Bütün yasaklama ve kısıtlamaların sonu', svg: () => END('') },
    // Mecburiyet işaretleri
    ileri: { cat: 'mecburi', name: 'İleri mecburi yön', svg: () => MAN(`<path d="M50 78V34" stroke="#fff" stroke-width="10"/><path d="M33 42 50 22l17 20z" fill="#fff"/>`) },
    saga: { cat: 'mecburi', name: 'Sağa mecburi yön', svg: () => MAN(`<path d="M22 50H62" stroke="#fff" stroke-width="10"/><path d="M58 32l20 18-20 18z" fill="#fff"/>`) },
    sola: { cat: 'mecburi', name: 'Sola mecburi yön', svg: () => MAN(`<path d="M78 50H38" stroke="#fff" stroke-width="10"/><path d="M42 32 22 50l20 18z" fill="#fff"/>`) },
    sagdan: { cat: 'mecburi', name: 'Sağdan gidiniz', svg: () => MAN(`<path d="M32 32 60 60" stroke="#fff" stroke-width="10"/><path d="M69 45v24H45z" fill="#fff"/>`) },
    soldan: { cat: 'mecburi', name: 'Soldan gidiniz', svg: () => MAN(`<path d="M68 32 40 60" stroke="#fff" stroke-width="10"/><path d="M31 45v24h24z" fill="#fff"/>`) },
    ada: { cat: 'mecburi', name: 'Ada etrafında dönünüz', svg: () => MAN(ringArrows(22, '#fff', 7)) },
    asgari30: { cat: 'mecburi', name: 'Asgari hız sınırlaması (30 km/s)', svg: () => MAN(NUM(30, '#fff')) },
    bisiklet: { cat: 'mecburi', name: 'Bisiklet yolu', svg: () => MAN(`<g stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="34" cy="60" r="11"/><circle cx="66" cy="60" r="11"/><path d="M34 60l10-18h14l8 18M44 42l6 18h8M54 36h8"/></g>`) },
    // Bilgi işaretleri
    hastane: { cat: 'bilgi', name: 'Hastane', svg: () => INF(`<rect x="28" y="28" width="44" height="44" rx="6" fill="#fff"/><path d="M40 36v28M60 36v28M40 50h20" stroke="${BLUE}" stroke-width="7"/>`) },
    yayagecidi: { cat: 'bilgi', name: 'Yaya geçidi', svg: () => INF(`<path d="M50 18 84 80H16z" fill="#fff"/><g transform="translate(2 12) scale(.8) translate(10 6)">${walker(INK)}</g><path d="M30 76h40" stroke="${INK}" stroke-width="4" stroke-dasharray="6 4"/>`) },
    cikmaz: { cat: 'bilgi', name: 'Çıkmaz yol', svg: () => INF(`<rect x="43" y="36" width="14" height="44" fill="#fff"/><rect x="28" y="22" width="44" height="14" fill="${RED}"/>`) },
    park: { cat: 'bilgi', name: 'Park yeri', svg: () => INF(`<text x="50" y="53" text-anchor="middle" dominant-baseline="central" ${F} font-weight="900" font-size="58" fill="#fff">P</text>`) },
    tekyon: { cat: 'bilgi', name: 'Tek yönlü yol', svg: () => INF(`<path d="M50 80V38" stroke="#fff" stroke-width="12"/><path d="M29 46 50 20l21 26z" fill="#fff"/>`) },
    // Kendine özgü şekilli işaretler
    dur: { cat: 'ozel', name: 'DUR', svg: () => wrap(`<polygon points="${octagon(49)}" fill="#fff"/><polygon points="${octagon(45)}" fill="${RED}"/><polygon points="${octagon(41.5)}" fill="none" stroke="#fff" stroke-width="1.8"/><text x="50" y="51" ${F} font-weight="900" font-size="27" fill="#fff" text-anchor="middle" dominant-baseline="central">DUR</text>`) },
    yolver: { cat: 'ozel', name: 'Yol ver', svg: () => wrap(`<polygon points="6,12 94,12 50,90" fill="${RED}" stroke="#fff" stroke-width="4" stroke-linejoin="round"/><polygon points="21.4,21 78.6,21 50,71.7" fill="#fff"/>`) },
    anayol: { cat: 'ozel', name: 'Ana yol', svg: () => wrap(`<rect x="18" y="18" width="64" height="64" rx="3" transform="rotate(45 50 50)" fill="#fff" stroke="#333" stroke-width="1.2"/><rect x="29" y="29" width="42" height="42" transform="rotate(45 50 50)" fill="${YEL}"/>`) },
    anayolsonu: { cat: 'ozel', name: 'Ana yol sonu', svg: () => wrap(`<rect x="18" y="18" width="64" height="64" rx="3" transform="rotate(45 50 50)" fill="#fff" stroke="#333" stroke-width="1.2"/><rect x="29" y="29" width="42" height="42" transform="rotate(45 50 50)" fill="${YEL}"/>${[-7, -3.5, 0, 3.5, 7].map((d) => `<path d="M${f1(35.15 + d)} ${f1(64.85 + d)}L${f1(64.85 + d)} ${f1(35.15 + d)}" stroke="#16171b" stroke-width="1.6"/>`).join('')}`) },
    yerlesim: { cat: 'bilgi', name: 'Yerleşim yeri', svg: () => wrap(`<rect x="4" y="22" width="92" height="56" rx="7" fill="#fff" stroke="${INK}" stroke-width="3"/><rect x="10" y="28" width="80" height="44" rx="4" fill="none" stroke="${INK}" stroke-width="1.5"/><text x="50" y="51" ${F} font-weight="900" font-size="19" fill="${INK}" text-anchor="middle" dominant-baseline="central">ÜRGÜP</text>`) }
  };
  const sign = (id) => (SIGNS[id] ? SIGNS[id].svg() : '');

  /* ---------- Gösterge paneli uyarı ışıkları ---------- */
  const LC = { red: '#ff3b30', amber: '#ffae1f', green: '#34c759', blue: '#3b8cff' };
  const LAMP_BG = '#131519';
  const LAMPS = {
    yag: { color: 'red', name: 'Motor yağ basıncı', draw: (c) => `<g fill="none" stroke="${c}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"><path d="M30 50h26l12 12v6H30z" fill="${c}"/><path d="M40 50v-6h10v6"/><path d="M30 54H19v7h11"/><path d="M66 58l16-9" stroke-width="5"/></g><path d="M83 57c-3.5 5-3.5 8.5 0 9.5 3.5-1 3.5-4.5 0-9.5z" fill="${c}"/>` },
    aku: { color: 'red', name: 'Akü şarj', draw: (c) => `<g stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="22" y="38" width="56" height="34" rx="4"/><path d="M32 38v-6h10v6M58 38v-6h10v6"/><path d="M31 55h12M58 55h12M64 49v12"/></g>` },
    hararet: { color: 'red', name: 'Motor hararet (soğutma suyu sıcaklığı)', draw: (c) => `<g stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"><path d="M50 20v32"/><path d="M50 28h9M50 36h9M50 44h9"/><path d="M24 76c4-3.5 8-3.5 13 0s8 3.5 13 0 8-3.5 13 0 8 3.5 13 0"/></g><circle cx="50" cy="59" r="7.5" fill="${c}"/>` },
    fren: { color: 'red', name: 'Fren sistemi / el freni', draw: (c) => `<g stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"><circle cx="50" cy="50" r="20"/><path d="M50 39v13" stroke-width="6"/><path d="M22 30a30 30 0 0 0 0 40M78 30a30 30 0 0 1 0 40"/></g><circle cx="50" cy="61" r="3.6" fill="${c}"/>` },
    kemer: { color: 'red', name: 'Emniyet kemeri', draw: (c) => `<circle cx="54" cy="24" r="7" fill="${c}"/><g stroke="${c}" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M52 36l-4 26" stroke-width="11"/><path d="M48 62h16l4 18" stroke-width="8"/><path d="M36 30l2 44" stroke-width="4"/></g><path d="M62 38 42 60" stroke="${LAMP_BG}" stroke-width="8"/><path d="M62 38 42 60" stroke="${c}" stroke-width="3.2"/><circle cx="41" cy="62" r="4" fill="${c}"/>` },
    abs: { color: 'amber', name: 'ABS', draw: (c) => `<circle cx="50" cy="50" r="23" fill="none" stroke="${c}" stroke-width="5"/><path d="M20 30a36 36 0 0 0 0 40M80 30a36 36 0 0 1 0 40" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"/><text x="50" y="51" ${F} font-weight="900" font-size="15" fill="${c}" text-anchor="middle" dominant-baseline="central">ABS</text>` },
    motor: { color: 'amber', name: 'Motor arıza', draw: (c) => `<g stroke="${c}" stroke-width="4.5" fill="none" stroke-linejoin="round" stroke-linecap="round"><path d="M32 42h36v26H38l-6-6z"/><path d="M42 42v-6h16v6M46 36v-4h8"/><path d="M32 48h-9v12h9"/><path d="M68 48h6l5-5v22l-5-5h-6"/></g>` },
    lastik: { color: 'amber', name: 'Lastik basıncı', draw: (c) => `<g stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"><path d="M31 30c-8 12-8 30 0 42h38c8-12 8-30 0-42"/><path d="M31 79v4M41 79v4M50 79v4M59 79v4M69 79v4" stroke-width="4"/><path d="M50 38v16" stroke-width="6"/></g><circle cx="50" cy="63" r="3.6" fill="${c}"/>` },
    yakit: { color: 'amber', name: 'Yakıt seviyesi az', draw: (c) => `<g stroke="${c}" stroke-width="4.5" fill="none" stroke-linejoin="round" stroke-linecap="round"><rect x="28" y="26" width="28" height="50" rx="3"/><path d="M56 42h5a4 4 0 0 1 4 4v18a4 4 0 0 0 8 0V38l-7-7"/><path d="M24 76h36"/></g><rect x="33" y="31" width="18" height="12" rx="1.5" fill="${c}"/>` },
    kizdirma: { color: 'amber', name: 'Kızdırma bujisi (dizel ön ısıtma)', draw: (c) => `<g stroke="${c}" stroke-width="4.5" fill="none" stroke-linecap="round"><path d="M22 36v28M78 36v28"/><path d="M22 50h6c0-10 8-10 8 0s-8 10-8 0M36 50c0-10 8-10 8 0s-8 10-8 0M44 50c0-10 8-10 8 0s-8 10-8 0M52 50c0-10 8-10 8 0s-8 10-8 0M60 50c0-10 8-10 8 0s-8 10-8 0M68 50h10"/></g>` },
    uzun: { color: 'blue', name: 'Uzun hüzmeli far (uzağı gösteren)', draw: (c) => `<path d="M52 30c14 0 22 9 22 20s-8 20-22 20z" fill="${c}"/><g stroke="${c}" stroke-width="4.5" stroke-linecap="round"><path d="M22 34h22M22 42h22M22 50h22M22 58h22M22 66h22"/></g>` },
    kisa: { color: 'green', name: 'Kısa hüzmeli far (yakını gösteren)', draw: (c) => `<path d="M52 30c14 0 22 9 22 20s-8 20-22 20z" fill="${c}"/><g stroke="${c}" stroke-width="4.5" stroke-linecap="round"><path d="M22 40l22-6M22 48l22-6M22 56l22-6M22 64l22-6M22 72l22-6"/></g>` },
    sison: { color: 'green', name: 'Ön sis farı', draw: (c) => `<path d="M54 30c14 0 22 9 22 20s-8 20-22 20z" fill="${c}"/><g stroke="${c}" stroke-width="4" stroke-linecap="round" fill="none"><path d="M20 40l20-5M20 50l20-5M20 60l20-5M20 70l20-5"/><path d="M31 28c-5 6 5 10 0 16s5 10 0 16 5 10 0 16"/></g>` },
    sisarka: { color: 'amber', name: 'Arka sis lambası', draw: (c) => `<path d="M46 30c-14 0-22 9-22 20s8 20 22 20z" fill="${c}"/><g stroke="${c}" stroke-width="4" stroke-linecap="round" fill="none"><path d="M58 38h22M58 50h22M58 62h22"/><path d="M69 28c-5 6 5 10 0 16s5 10 0 16 5 10 0 16"/></g>` },
    sinyal: { color: 'green', name: 'Sinyal (dönüş göstergesi)', draw: (c) => `<path d="M12 50l18-15v9h14v12H30v9z" fill="${c}"/><path d="M88 50 70 35v9H56v12h14v9z" fill="${c}"/>` }
  };
  function lamp(id, on = true) {
    const L = LAMPS[id];
    if (!L) return '';
    const c = on ? LC[L.color] : '#3a3e47';
    return wrap(`<rect x="2" y="2" width="96" height="96" rx="22" fill="${LAMP_BG}"/>${on ? `<circle cx="50" cy="50" r="40" fill="${c}" opacity=".1"/>` : ''}${L.draw(c)}`);
  }

  /* ---------- İlk yardım piktogramları ---------- */
  const V_COL = '#4a4f5c', H_COL = '#de2f29', FA_BG = '#f3ede3';
  const limb = (d, c, w = 7) => `<path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  const head = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
  const FA = {
    cpr: () => `${limb('M8 86H92', '#d8cdbb', 3)}${head(15, 74, 6.5, V_COL)}${limb('M23 76H62L90 78', V_COL, 8)}
      ${head(42, 22, 7, H_COL)}${limb('M43 31 52 56', H_COL, 9)}${limb('M44 35 40 70', H_COL, 6.5)}${limb('M52 56 62 83H84', H_COL, 7.5)}
      <path d="M28 44v14" stroke="${H_COL}" stroke-width="3" stroke-linecap="round"/><path d="M23.5 54 28 61l4.5-7z" fill="${H_COL}"/>
      <text x="74" y="30" text-anchor="middle" ${F} font-weight="900" font-size="15" fill="${H_COL}">30:2</text>`,
    koma: () => `${limb('M8 86H92', '#d8cdbb', 3)}${head(17, 68, 6.5, V_COL)}${limb('M26 72H58L92 78', V_COL, 8)}${limb('M30 72 24 82 16 76', V_COL, 5.5)}${limb('M58 73 70 84H86', V_COL, 7)}${limb('M34 72 44 84', V_COL, 5.5)}
      <path d="M64 30a18 18 0 1 1-30 10" stroke="${H_COL}" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M28 38l6 9 5-9z" fill="${H_COL}"/>`,
    sok: () => `${limb('M8 86H92', '#d8cdbb', 3)}<rect x="66" y="58" width="24" height="28" rx="3" fill="#d8cdbb"/>${head(14, 78, 6.5, V_COL)}${limb('M22 80H52L88 54', V_COL, 8)}
      <path d="M58 52V82" stroke="${H_COL}" stroke-width="2.5"/><path d="M54 57l4-7 4 7zM54 77l4 7 4-7z" fill="${H_COL}"/><text x="46" y="40" text-anchor="middle" ${F} font-weight="900" font-size="13" fill="${H_COL}">30 cm</text>`,
    basgeri: () => `${limb('M8 86H92', '#d8cdbb', 3)}<circle cx="38" cy="62" r="16" fill="${V_COL}"/>${limb('M52 70H92', V_COL, 12)}<path d="M24 58c-2-8 0-14 4-18" stroke="${V_COL}" stroke-width="5" fill="none" stroke-linecap="round"/>
      ${limb('M20 30H52', H_COL, 7)}${limb('M52 30 64 18', H_COL, 7)}${limb('M40 82 50 94', H_COL, 6)}
      <path d="M72 44a22 22 0 0 0-30-26" stroke="${H_COL}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M40 12l-2 10 9-2z" fill="${H_COL}"/>`,
    heimlich: () => `${limb('M8 94H92', '#d8cdbb', 3)}${head(38, 20, 7, V_COL)}${limb('M38 29 36 62', V_COL, 10)}${limb('M36 62 30 92M36 62 42 92', V_COL, 7)}${limb('M38 34 28 50', V_COL, 5.5)}
      ${head(62, 16, 7, H_COL)}${limb('M62 25 64 62', H_COL, 10)}${limb('M64 62 60 92M64 62 70 92', H_COL, 7)}${limb('M60 32 44 46', H_COL, 6)}<circle cx="41" cy="48" r="5" fill="${H_COL}"/>
      <path d="M22 60V40" stroke="${H_COL}" stroke-width="3" stroke-linecap="round"/><path d="M17.5 44 22 37l4.5 7z" fill="${H_COL}"/>`,
    burun: () => `<rect x="14" y="62" width="44" height="8" rx="3" fill="#d8cdbb"/>${limb('M8 92H92', '#d8cdbb', 3)}${head(48, 26, 8.5, V_COL)}${limb('M44 38 40 64', V_COL, 10)}${limb('M40 64H62L64 90', V_COL, 7.5)}${limb('M43 44 58 50 56 30', V_COL, 5.5)}
      <path d="M58 35c-2 3-2 5 0 6 2-1 2-3 0-6z" fill="${H_COL}"/><path d="M66 18c6 4 8 10 6 16" stroke="${H_COL}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M68 32l4 6 3-7z" fill="${H_COL}"/>`,
    yanik: () => `<rect x="30" y="10" width="34" height="10" rx="4" fill="#9aa2ad"/><rect x="54" y="18" width="10" height="12" rx="2" fill="#9aa2ad"/>
      <g stroke="#3b8cff" stroke-width="3" stroke-linecap="round"><path d="M55 34v18M59 34v22M63 34v18"/></g>${limb('M10 66H74', V_COL, 13)}<circle cx="80" cy="66" r="8" fill="${V_COL}"/><rect x="48" y="60" width="18" height="12" rx="3" fill="${H_COL}" opacity=".85"/>
      <text x="30" y="92" text-anchor="middle" ${F} font-weight="900" font-size="13" fill="${H_COL}">20 dk</text>`,
    tel112: () => `<rect x="30" y="12" width="40" height="76" rx="8" fill="${V_COL}"/><rect x="35" y="22" width="30" height="50" rx="3" fill="#fff"/><text x="50" y="48" text-anchor="middle" ${F} font-weight="900" font-size="15" fill="${H_COL}">112</text><circle cx="50" cy="80" r="3.5" fill="#fff"/>`
  };
  const fa = (id) => (FA[id] ? wrap(`<rect x="0" y="0" width="100" height="100" rx="18" fill="${FA_BG}"/>${FA[id]()}`) : '');

  /* ---------- Araçlar (üstten görünüm, yukarı bakar, merkez 0,0) ---------- */
  const PAL = { me: '#de2f29', blue: '#1f5fd1', amber: '#f2a900', green: '#2e7d4f', purple: '#7b3fa0', grey: '#8a919c' };
  function car(color, opt = {}) {
    const brake = opt.brakeClass ? ` class="${opt.brakeClass}"` : '';
    return `<g>
      <rect x="-15.5" y="-9" width="3.5" height="5" rx="1.6" fill="${color}"/><rect x="12" y="-9" width="3.5" height="5" rx="1.6" fill="${color}"/>
      <rect x="-13" y="-23" width="26" height="46" rx="8" fill="${color}"/>
      <rect x="-13" y="-23" width="9" height="46" rx="6" fill="#fff" opacity=".14"/>
      <rect x="5" y="-23" width="8" height="46" rx="6" fill="#000" opacity=".1"/>
      <path d="M-9.5-12h19l-2.2 8h-14.6z" fill="#1d2433"/>
      <path d="M-8.5 13h17l-2-6.5h-13z" fill="#1d2433"/>
      <rect x="-7.5" y="-2.5" width="15" height="8" rx="2" fill="#fff" opacity=".16"/>
      <rect x="-11" y="-23" width="6" height="3" rx="1.5" fill="#fff4bf"/><rect x="5" y="-23" width="6" height="3" rx="1.5" fill="#fff4bf"/>
      <g${brake}><rect x="-11.5" y="20.5" width="6.5" height="2.8" rx="1.2" fill="#c62020"/><rect x="5" y="20.5" width="6.5" height="2.8" rx="1.2" fill="#c62020"/></g>
    </g>`;
  }
  function ambulance() {
    return `<g>
      <rect x="-14" y="-26" width="28" height="52" rx="6" fill="#ffffff" stroke="#c9ced6" stroke-width="1"/>
      <rect x="-14" y="2" width="28" height="6" fill="#de2f29"/>
      <path d="M-10-16h20l-2 6h-16z" fill="#1d2433"/>
      <rect class="blink-a" x="-9" y="-6" width="8" height="5" rx="1.5" fill="#ff3b30"/>
      <rect class="blink-b" x="1" y="-6" width="8" height="5" rx="1.5" fill="#2f7bff"/>
      <path d="M-3 14h6M0 11v6" stroke="#de2f29" stroke-width="2.4" stroke-linecap="round"/>
    </g>`;
  }
  const sirens = () => `<g opacity=".7" stroke="#2f7bff" stroke-width="2" fill="none"><path class="blink-a" d="M-20-30a26 26 0 0 1 40 0"/><path class="blink-b" d="M-26-38a34 34 0 0 1 52 0"/></g>`;
  function tractor() {
    return `<g><rect x="-15" y="4" width="8" height="20" rx="3" fill="#1b1c20"/><rect x="7" y="4" width="8" height="20" rx="3" fill="#1b1c20"/>
      <rect x="-13" y="-22" width="6" height="10" rx="2" fill="#1b1c20"/><rect x="7" y="-22" width="6" height="10" rx="2" fill="#1b1c20"/>
      <rect x="-9" y="-24" width="18" height="44" rx="5" fill="#2e8b3e"/><rect x="-8" y="4" width="16" height="14" rx="3" fill="#cfe8d5"/></g>`;
  }
  function moto(color) {
    return `<g><rect x="-5" y="-17" width="10" height="34" rx="5" fill="#2b2f36"/><rect x="-7" y="-4" width="14" height="10" rx="4" fill="${color}"/><circle cy="-2" r="5" fill="#f1c9a5"/><rect x="-9" y="-12" width="18" height="3" rx="1.5" fill="#2b2f36"/></g>`;
  }
  function bus() {
    return `<g><rect x="-15" y="-44" width="30" height="88" rx="6" fill="#f2a900"/><rect x="-11" y="-40" width="22" height="9" rx="2" fill="#1d2433"/>
      ${Array.from({ length: 5 }, (_, i) => `<rect x="-11" y="${-26 + i * 13}" width="22" height="8" rx="2" fill="#fff" opacity=".35"/>`).join('')}</g>`;
  }
  const ped = (shirt = '#ff8a3d') => `<g><ellipse rx="7" ry="4.5" fill="${shirt}"/><circle r="3.6" fill="#f1c9a5"/></g>`;
  const badge = (label, rot = 0) => `<g transform="rotate(${-rot})"><circle r="12" fill="#16171b" stroke="#fff" stroke-width="2.5"/><text y="4.5" text-anchor="middle" fill="#fff" ${F} font-weight="900" font-size="13">${label}</text></g>`;

  /* ---------- Sahne HUD etiketi (tüm derslerde aynı görünüm) ---------- */
  function hud(x, y, w, label, cls = '', h = 52, anchor = 'left') {
    return `<g class="hud ${cls}" data-x="${x}" data-y="${y}" data-w="${w}" data-anchor="${anchor}" transform="translate(${x} ${y})"><rect width="${w}" height="${h}" rx="14" fill="#16171b" opacity=".9"/>
      <text x="16" y="21" fill="#9aa0ad" font-family="JetBrains Mono, monospace" font-size="11" font-weight="700" letter-spacing=".06em">${label}</text>
      <text class="hud-v" x="16" y="41" fill="#fff" ${F} font-size="15" font-weight="800"></text></g>`;
  }

  /* ---------- e-Sınav soru sahneleri (üstten görünüm, temaya uyumlu) ---------- */
  const S = 0.62; // sahne araç ölçeği
  const place = (x, y, rot, body, label) => `<g transform="translate(${x} ${y}) rotate(${rot})"><g transform="scale(${S})">${body}</g>${label ? `<g transform="scale(.8)">${badge(label, rot)}</g>` : ''}</g>`;
  const arrow = (d, head) => `<path d="${d}" stroke="#fff" stroke-width="3.2" fill="none" stroke-linecap="round" opacity=".9"/><path d="${head}" fill="#fff" opacity=".9"/>`;
  function crossroad() {
    return `<rect class="s-ground" width="260" height="180"/><rect class="s-side" x="92" y="0" width="76" height="180"/><rect class="s-side" x="0" y="52" width="260" height="76"/>
      <rect class="s-road" x="100" y="0" width="60" height="180"/><rect class="s-road" x="0" y="60" width="260" height="60"/>
      <path class="s-dash" d="M130 0V58M130 122V180M0 90H98M162 90H260" stroke-width="2" stroke-dasharray="9 8"/>`;
  }
  function straightRoad(line) {
    const y = 90, solid = (yy) => `<path d="M0 ${yy}H260" stroke="#fff" stroke-width="2.6"/>`, dash = (yy) => `<path d="M0 ${yy}H260" stroke="#fff" stroke-width="2.6" stroke-dasharray="14 11"/>`;
    const mid = { duz: solid(y), kesik: dash(y), cift: solid(y - 3.5) + solid(y + 3.5), kesikduz: solid(y - 3.5) + dash(y + 3.5), duzkesik: dash(y - 3.5) + solid(y + 3.5) }[line];
    return `<rect class="s-ground" width="260" height="180"/><rect class="s-side" x="0" y="42" width="260" height="96"/><rect class="s-road" x="0" y="50" width="260" height="80"/>
      <path d="M0 52.5H260M0 127.5H260" stroke="#fff" stroke-width="2.4"/>${mid}
      ${place(70, 110, 90, car(PAL.me), '')}${place(150, 110, 90, tractor(), '')}
      ${place(236, 70, -90, car(PAL.blue), '')}`;
  }
  const SCENES = {
    'kavsak-sag': () => crossroad() + place(145, 148, 0, car(PAL.me), 'A') + place(214, 75, -90, car(PAL.blue), 'B') +
      arrow('M145 128V104', 'M140.5 106 145 98l4.5 8z') + arrow('M194 75H170', 'M172 70.5 164 75l8 4.5z'),
    'sola-donus': () => crossroad() + place(145, 148, 0, car(PAL.me), 'A') + place(115, 32, 180, car(PAL.blue), 'B') +
      arrow('M145 128C145 104 136 96 116 96', 'M118 91.5 110 96l8 4.5z') + arrow('M115 52V76', 'M110.5 74 115 82l4.5-8z'),
    'donel': () => `<rect class="s-ground" width="260" height="180"/><rect class="s-side" x="96" y="0" width="68" height="180"/><rect class="s-side" x="0" y="56" width="260" height="68"/>
      <rect class="s-road" x="102" y="0" width="56" height="180"/><rect class="s-road" x="0" y="62" width="260" height="56"/>
      <circle class="s-side" cx="130" cy="90" r="64"/><circle class="s-road" cx="130" cy="90" r="58"/><circle class="s-grass" cx="130" cy="90" r="26"/><circle cx="130" cy="90" r="26" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="5 4"/>` +
      place(86, 96, 180, car(PAL.amber), 'A') + place(144, 166, 0, car(PAL.me), 'B') +
      `<path d="M84 118a50 50 0 0 0 44 30" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"/>`,
    'anayol-tali': () => crossroad().replace('M130 122V180', 'M130 180V180') + place(40, 105, 90, car(PAL.blue), 'A') + place(145, 150, 0, car(PAL.me), 'B') +
      `<g transform="translate(176 162) scale(.34)">${sign('yolver').replace(/<\/?svg[^>]*>/g, '')}</g><g transform="translate(18 132) scale(.3)">${sign('anayol').replace(/<\/?svg[^>]*>/g, '')}</g>`,
    'cizgi-duz': () => straightRoad('duz'),
    'cizgi-cift': () => straightRoad('cift'),
    'cizgi-kesikduz': () => straightRoad('kesikduz'),
    'cizgi-duzkesik': () => straightRoad('duzkesik'),
    'yaya-gecidi': () => `<rect class="s-ground" width="260" height="180"/><rect class="s-side" x="0" y="42" width="260" height="96"/><rect class="s-road" x="0" y="50" width="260" height="80"/>
      <path class="s-dash" d="M0 90H150M196 90H260" stroke-width="2" stroke-dasharray="12 10"/>
      <g class="s-white">${Array.from({ length: 6 }, (_, i) => `<rect x="156" y="${54 + i * 13}" width="34" height="8" rx="1"/>`).join('')}</g>
      <g transform="translate(173 104)">${ped('#2f7bff')}</g>${place(80, 110, 90, car(PAL.me), '')}`,
    'ambulans': () => `<rect class="s-ground" width="260" height="180"/><rect class="s-side" x="0" y="42" width="260" height="96"/><rect class="s-road" x="0" y="50" width="260" height="80"/>
      <path d="M0 52.5H260M0 127.5H260" stroke="#fff" stroke-width="2.4"/><path class="s-dash" d="M0 90H260" stroke-width="2" stroke-dasharray="14 11"/>
      ${place(170, 110, 90, car(PAL.me), '')}<g transform="translate(70 110) rotate(90)"><g transform="scale(${S})">${sirens()}${ambulance()}</g></g>`
  };
  const scene = (id) => (SCENES[id] ? wrap(SCENES[id](), '0 0 260 180') : '');

  // Görsel anahtarı çöz: "sign:dur", "lamp:yag", "fa:cpr", "scene:donel"
  function visual(key) {
    if (!key) return '';
    const [type, id] = key.split(':');
    if (type === 'sign') return sign(id);
    if (type === 'lamp') return lamp(id);
    if (type === 'fa') return fa(id);
    if (type === 'scene') return scene(id);
    return '';
  }

  // Ortak SVG animasyon stilleri (siren, fren, uyarı yanıp sönmesi)
  const st = document.createElement('style');
  st.textContent = `.blink-a{animation:kitBlink .5s steps(1) infinite}.blink-b{animation:kitBlink .5s steps(1) -.25s infinite}
    @keyframes kitBlink{50%{opacity:.15}}.brake-on rect{fill:#ff3b30}`;
  document.head.appendChild(st);

  window.YildizKit = { SIGNS, sign, LAMPS, LC, lamp, fa, scene, visual, car, ambulance, sirens, tractor, moto, bus, ped, badge, hud, PAL };
})();
