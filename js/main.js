const CONFIG = {
  sheetId: '1myKTpXM_E1d8GBGaxShIsX3UqYJwP1aS407ODT7iawE',
  gid:     '1648520092',
};

const SHEET_URL =
  `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/gviz/tq?tqx=out:json&gid=${CONFIG.gid}`;

const CARD_W = 75;
const CARD_H = 100;

// ── 유틸 ──────────────────────────────────────────────
function toImgUrl(url) {
  if (!url) return '';
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return `https://drive.google.com/thumbnail?id=${m1[1]}&sz=w800`;
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return `https://drive.google.com/thumbnail?id=${m2[1]}&sz=w800`;
  return url;
}

function setProgress(pct, msg) {
  document.getElementById('ld-fill').style.width = pct + '%';
  if (msg) document.getElementById('ld-msg').textContent = msg;
}

// ── 모달 ──────────────────────────────────────────────
const overlay = document.getElementById('overlay');

function tagClass(gate) {
  if (!gate) return 'default';
  if (gate.includes('개방') || gate.startsWith('개')) return 'open';
  if (gate.includes('폐쇄') || gate.startsWith('폐')) return 'closed';
  return 'partial';
}

function openModal(row) {
  const school      = row[1] || '';
  const location    = row[2] || '';
  const date        = row[3] || '';
  const size        = row[4] || '';
  const symbol      = row[5] || '';
  const gate        = row[6] || '';
  const vehicle     = row[7] || '';
  const beam        = row[8] || '';
  const constHist   = row[9] || '';
  const studentHist = row[10] || '';
  const imgUrl      = toImgUrl(row[0] || '');

  const mImg     = document.getElementById('m-img');
  const mImgNone = document.getElementById('m-img-none');
  if (imgUrl) {
    mImg.src = imgUrl;
    mImg.style.display = 'block';
    mImgNone.classList.remove('show');
    mImg.onerror = () => { mImg.style.display = 'none'; mImgNone.classList.add('show'); };
  } else {
    mImg.style.display = 'none';
    mImg.src = '';
    mImgNone.classList.add('show');
  }

  document.getElementById('m-name').textContent = school;
  document.getElementById('m-loc').textContent  = location;

  const tags = [];
  if (gate)    tags.push(`<span class="m-tag m-tag-${tagClass(gate)}">${gate.split(' ')[0]}</span>`);
  if (vehicle) tags.push(`<span class="m-tag m-tag-vehicle">차량 ${vehicle.split(/[,\s]/)[0]}</span>`);
  if (beam)    tags.push(`<span class="m-tag m-tag-beam">들보 ${beam.split(/[,\s]/)[0]}</span>`);
  document.getElementById('m-tags').innerHTML = tags.join('');

  const fields = [
    ['설치일',    date,        false],
    ['크기',      size,        false],
    ['상징성',    symbol,      true],
    ['공사 역사', constHist,   true],
    ['학생 역사', studentHist, true],
  ].filter(([, v]) => v);

  document.getElementById('m-grid').innerHTML = fields.map(([l, v, full]) =>
    `<div class="m-field${full ? ' full' : ''}"><label>${l}</label><p>${v}</p></div>`
  ).join('');

  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

document.getElementById('m-close').addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── Leaflet 지도 ───────────────────────────────────────
const map = L.map('map', {
  center: [36.5, 127.8],
  zoom: 7,
  minZoom: 5,
  maxZoom: 17,
  zoomControl: true,
});

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> &copy; <a href="https://carto.com">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 20,
}).addTo(map);

// ── 겹침 해소 (zoom 7 픽셀 기준으로 카드 간격 확보) ──
function resolveOverlaps(items) {
  const ZOOM  = 7;
  const MIN_DX = CARD_W + 4;
  const MIN_DY = CARD_H + 4;

  const pts = items.map(({ row, latlng }) => {
    const { x, y } = map.project(latlng, ZOOM);
    return { row, x, y };
  });

  for (let iter = 0; iter < 400; iter++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const ox = MIN_DX - Math.abs(dx);
        const oy = MIN_DY - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          if (ox < oy) {
            const push = ox / 2 + 1;
            const sx   = dx >= 0 ? 1 : -1;
            a.x -= sx * push;
            b.x += sx * push;
          } else {
            const push = oy / 2 + 1;
            const sy   = dy >= 0 ? 1 : -1;
            a.y -= sy * push;
            b.y += sy * push;
          }
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  return pts.map(pt => ({
    row:    pt.row,
    latlng: map.unproject([pt.x, pt.y], ZOOM),
  }));
}

// ── 마커 생성 ──────────────────────────────────────────
function addMarker({ row, latlng }) {
  const school = row[1] || '';
  const imgUrl = toImgUrl(row[0] || '');
  const shortName = school
    .replace(/(캠퍼스|대학교|대학|서울|인문사회과학|글로벌|북악|성심교정|석관동|죽전|용봉|아라|송도|천안|수원|경산|돈암수정)/g, '')
    .trim();

  const imgHtml = imgUrl
    ? `<img class="gate-card-img" src="${imgUrl}" alt=""
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      + `<div class="gate-card-ph" style="display:none">${shortName}</div>`
    : `<div class="gate-card-ph">${shortName}</div>`;

  const icon = L.divIcon({
    html: `<div class="gate-card">${imgHtml}<div class="gate-card-name">${shortName}</div></div>`,
    className: '',
    iconSize:   [CARD_W, CARD_H],
    iconAnchor: [CARD_W / 2, CARD_H / 2],
  });

  L.marker(latlng, { icon })
    .addTo(map)
    .bindTooltip(school, {
      direction: 'top',
      offset: [0, -CARD_H / 2 - 4],
      className: 'gate-tip',
    })
    .on('click', () => openModal(row));
}

// ── 데이터 로드 ────────────────────────────────────────
async function load() {
  setProgress(10, '구글 시트 연결 중…');
  try {
    const res = await fetch(SHEET_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);

    setProgress(50, '데이터 파싱 중…');
    const text = await res.text();
    const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));

    const rawRows = (json.table.rows || [])
      .map(r => (r.c || []).map(cell => (cell && cell.v != null) ? String(cell.v).trim() : ''));
    const data = rawRows.filter(r => r[1] && r[1] !== '학교' && r[1] !== '학교명');

    console.log(`[DEBUG] 전체 행 수: ${rawRows.length}, 필터 후: ${data.length}`);

    setProgress(70, '겹침 계산 중…');

    const items = [];
    const missing = [];
    data.forEach(row => {
      const coords = COORDS[row[1]];
      if (coords) items.push({ row, latlng: L.latLng(coords) });
      else if (row[1]) missing.push(row[1]);
    });
    if (missing.length) console.warn('[DEBUG] COORDS에 없는 학교:', missing.join(', '));

    setProgress(85, '지도에 배치 중…');
    const resolved = resolveOverlaps(items);
    resolved.forEach(item => addMarker(item));

    document.getElementById('count-badge').textContent = `${resolved.length}개 대학`;

    if (items.length > 0) {
      map.fitBounds([[33.0, 124.5], [38.7, 131.0]], { padding: [40, 40] });
    }

    setProgress(100, '완료');
    setTimeout(() => document.getElementById('loader').classList.add('hidden'), 400);

  } catch (e) {
    setProgress(100, '');
    document.getElementById('ld-fill').style.background = '#C0392B';
    document.getElementById('ld-msg').textContent = '로드 실패: ' + e.message;
  }
}

load();
