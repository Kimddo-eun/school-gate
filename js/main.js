const CONFIG = {
  sheetId: '1myKTpXM_E1d8GBGaxShIsX3UqYJwP1aS407ODT7iawE',
  gid:     '1648520092',
};
const SHEET_URL =
  `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/gviz/tq?tqx=out:json&gid=${CONFIG.gid}`;

// ── 좌표계: 남한 영역을 픽셀로 변환 ───────────────────────────────
const GEO = { minLat: 33.0, maxLat: 38.7, minLng: 124.5, maxLng: 131.0 };
// 36°N 기준 경도 1° ≈ 89.8km, 위도 1° ≈ 111km (Mercator 보정)
const KM_LNG = 111 * Math.cos(36 * Math.PI / 180);
const KM_LAT = 111;
const STAGE_W = 1400;
const PX_PER_KM = STAGE_W / ((GEO.maxLng - GEO.minLng) * KM_LNG);
const STAGE_H = Math.round((GEO.maxLat - GEO.minLat) * KM_LAT * PX_PER_KM);

const CARD_W = 90, CARD_H = 120;

function latLngToXY(lat, lng) {
  return {
    x: (lng - GEO.minLng) * KM_LNG * PX_PER_KM,
    y: (GEO.maxLat - lat) * KM_LAT * PX_PER_KM,
  };
}

// ── 유틸 ──────────────────────────────────────────────────────────
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

// ── 모달 ──────────────────────────────────────────────────────────
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

  const mImg = document.getElementById('m-img');
  const mImgNone = document.getElementById('m-img-none');
  if (imgUrl) {
    mImg.src = imgUrl; mImg.style.display = 'block'; mImgNone.classList.remove('show');
    mImg.onerror = () => { mImg.style.display = 'none'; mImgNone.classList.add('show'); };
  } else {
    mImg.style.display = 'none'; mImg.src = ''; mImgNone.classList.add('show');
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

// ── 줌/팬 ──────────────────────────────────────────────────────────
const stageWrap = document.getElementById('stage-wrap');
const stage     = document.getElementById('stage');
stage.style.width  = STAGE_W + 'px';
stage.style.height = STAGE_H + 'px';

let scale = 1, tx = 0, ty = 0;

function applyTransform() {
  stage.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
}

// 카드 전체 배치 영역에 맞게 초기 뷰 설정
function fitToCards(pts) {
  if (!pts.length) return;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const minX = Math.min(...xs) - CARD_W;
  const maxX = Math.max(...xs) + CARD_W;
  const minY = Math.min(...ys) - CARD_H;
  const maxY = Math.max(...ys) + CARD_H;
  const cw = maxX - minX, ch = maxY - minY;
  const ww = stageWrap.clientWidth, wh = stageWrap.clientHeight;
  scale = Math.min(ww / cw, wh / ch) * 0.88;
  tx = ww / 2 - (minX + cw / 2) * scale;
  ty = wh / 2 - (minY + ch / 2) * scale;
  applyTransform();
}

// 마우스 휠 줌 (커서 위치 기준)
stageWrap.addEventListener('wheel', e => {
  e.preventDefault();
  const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  const r = stageWrap.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  tx = mx - (mx - tx) * f;
  ty = my - (my - ty) * f;
  scale = Math.max(0.15, Math.min(10, scale * f));
  applyTransform();
}, { passive: false });

// 드래그 팬
let drag = null;
stageWrap.addEventListener('mousedown', e => {
  if (e.target.closest('.gate-card')) return;
  drag = { sx: e.clientX - tx, sy: e.clientY - ty };
  stageWrap.classList.add('dragging');
});
window.addEventListener('mousemove', e => {
  if (!drag) return;
  tx = e.clientX - drag.sx; ty = e.clientY - drag.sy;
  applyTransform();
});
window.addEventListener('mouseup', () => { drag = null; stageWrap.classList.remove('dragging'); });

// 터치 팬/핀치줌
let lastTouches = null;
stageWrap.addEventListener('touchstart', e => {
  e.preventDefault();
  lastTouches = [...e.touches].map(t => ({ x: t.clientX, y: t.clientY }));
}, { passive: false });
stageWrap.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!lastTouches) return;
  const cur = [...e.touches];
  if (cur.length === 1 && lastTouches.length >= 1) {
    tx += cur[0].clientX - lastTouches[0].x;
    ty += cur[0].clientY - lastTouches[0].y;
  } else if (cur.length >= 2 && lastTouches.length >= 2) {
    const od = Math.hypot(lastTouches[1].x - lastTouches[0].x, lastTouches[1].y - lastTouches[0].y);
    const nd = Math.hypot(cur[1].clientX - cur[0].clientX, cur[1].clientY - cur[0].clientY);
    const f  = od > 0 ? nd / od : 1;
    const r  = stageWrap.getBoundingClientRect();
    const mx = (cur[0].clientX + cur[1].clientX) / 2 - r.left;
    const my = (cur[0].clientY + cur[1].clientY) / 2 - r.top;
    tx = mx - (mx - tx) * f; ty = my - (my - ty) * f;
    scale = Math.max(0.15, Math.min(10, scale * f));
  }
  lastTouches = cur.map(t => ({ x: t.clientX, y: t.clientY }));
  applyTransform();
}, { passive: false });
stageWrap.addEventListener('touchend', e => {
  lastTouches = [...e.touches].map(t => ({ x: t.clientX, y: t.clientY }));
}, { passive: false });

// ── 겹침 해소 (카드 간격 확보) ──────────────────────────────────────
function resolveOverlaps(items) {
  const GAP = 8;
  const MIN_DX = CARD_W + GAP, MIN_DY = CARD_H + GAP;
  const pts = items.map(d => ({ ...d }));

  for (let iter = 0; iter < 500; iter++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const ox = MIN_DX - Math.abs(dx), oy = MIN_DY - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          if (ox < oy) {
            const push = ox / 2 + 1, sx = dx >= 0 ? 1 : -1;
            a.x -= sx * push; b.x += sx * push;
          } else {
            const push = oy / 2 + 1, sy = dy >= 0 ? 1 : -1;
            a.y -= sy * push; b.y += sy * push;
          }
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  return pts;
}

// ── 카드 DOM 생성 ─────────────────────────────────────────────────
function placeCard({ row, x, y }) {
  const school = row[1] || '';
  const imgUrl = toImgUrl(row[0] || '');
  const shortName = school
    .replace(/(캠퍼스|대학교|대학|서울|인문사회과학|글로벌|북악|성심교정|석관동|죽전|용봉|아라|송도|천안|수원|경산|돈암수정)/g, '')
    .trim();

  const card = document.createElement('div');
  card.className = 'gate-card';
  card.style.left = (x - CARD_W / 2) + 'px';
  card.style.top  = (y - CARD_H / 2) + 'px';
  card.title = school;

  if (imgUrl) {
    const img = document.createElement('img');
    img.className = 'gate-card-img'; img.src = imgUrl; img.alt = '';
    const ph = document.createElement('div');
    ph.className = 'gate-card-ph'; ph.textContent = shortName; ph.style.display = 'none';
    img.onerror = () => { img.style.display = 'none'; ph.style.display = 'flex'; };
    card.appendChild(img); card.appendChild(ph);
  } else {
    const ph = document.createElement('div');
    ph.className = 'gate-card-ph'; ph.textContent = shortName;
    card.appendChild(ph);
  }

  const nameDiv = document.createElement('div');
  nameDiv.className = 'gate-card-name'; nameDiv.textContent = shortName;
  card.appendChild(nameDiv);

  card.addEventListener('click', () => openModal(row));
  stage.appendChild(card);
}

// ── 데이터 로드 ───────────────────────────────────────────────────
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

    setProgress(70, '겹침 계산 중…');

    const items = [];
    data.forEach(row => {
      const coords = COORDS[row[1]];
      if (coords) {
        const { x, y } = latLngToXY(coords[0], coords[1]);
        items.push({ row, x, y });
      } else if (row[1]) {
        console.warn('[DEBUG] 좌표 없음:', row[1]);
      }
    });
    console.log(`[DEBUG] 배치 대상: ${items.length}개`);

    setProgress(85, '배치 중…');
    const resolved = resolveOverlaps(items);
    resolved.forEach(item => placeCard(item));

    document.getElementById('count-badge').textContent = `${resolved.length}개 대학`;
    fitToCards(resolved);

    setProgress(100, '완료');
    setTimeout(() => document.getElementById('loader').classList.add('hidden'), 400);

  } catch (e) {
    setProgress(100, '');
    document.getElementById('ld-fill').style.background = '#C0392B';
    document.getElementById('ld-msg').textContent = '로드 실패: ' + e.message;
  }
}

load();
