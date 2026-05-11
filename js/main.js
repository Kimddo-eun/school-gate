const CONFIG = {
  sheetId: '1myKTpXM_E1d8GBGaxShIsX3UqYJwP1aS407ODT7iawE',
  gid:     '1648520092',
};
const SHEET_URL =
  `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/gviz/tq?tqx=out:json&gid=${CONFIG.gid}`;

// ── 좌표계: 남한 영역을 픽셀로 변환 ───────────────────────────────
const GEO = { minLat: 33.0, maxLat: 38.7, minLng: 124.5, maxLng: 131.0 };
const KM_LNG = 111 * Math.cos(36 * Math.PI / 180);
const KM_LAT = 111;
const STAGE_W = 2000;
const PX_PER_KM = STAGE_W / ((GEO.maxLng - GEO.minLng) * KM_LNG);
const STAGE_H = Math.round((GEO.maxLat - GEO.minLat) * KM_LAT * PX_PER_KM);

const CARD_W = 90, CARD_H = 120;

function latLngToXY(lat, lng) {
  return {
    x: (lng - GEO.minLng) * KM_LNG * PX_PER_KM,
    y: (GEO.maxLat - lat) * KM_LAT * PX_PER_KM,
  };
}

// ── 남한 영토 윤곽선 (위도, 경도 좌표) ────────────────────────────
const KOREA_BOUNDARY = [
  // 북쪽 경계 (서→동)
  [37.80, 126.40], [38.00, 126.52], [38.20, 126.90],
  [38.38, 127.38], [38.54, 127.85], [38.62, 128.37],
  // 강원 동해안 (북→남)
  [38.17, 128.62], [37.95, 128.75], [37.52, 129.10],
  // 경북 동해안
  [37.25, 129.28], [36.82, 129.44], [36.42, 129.45],
  // 경남 동해안 및 부산
  [36.05, 129.42], [35.73, 129.38], [35.48, 129.36],
  [35.22, 129.20], [35.10, 129.00],
  // 부산·남해안
  [35.05, 128.98], [34.90, 128.72], [34.75, 128.58],
  // 경남 남해안
  [34.70, 128.25], [34.60, 127.92], [34.68, 127.68],
  [34.50, 127.50], [34.40, 127.32], [34.28, 127.15],
  // 전남 남해안
  [34.27, 126.78], [34.23, 126.55],
  // 서남해
  [34.48, 126.25], [34.73, 126.10],
  // 서해안 (남→북)
  [35.08, 126.33], [35.47, 126.36], [35.83, 126.49],
  [36.10, 126.43], [36.45, 126.45], [36.82, 126.18],
  [37.05, 126.38], [37.30, 126.43], [37.50, 126.48],
  [37.70, 126.36], [37.80, 126.40],
];

const JEJU_BOUNDARY = [
  [33.56, 126.15], [33.58, 126.42], [33.53, 126.70],
  [33.44, 126.94], [33.24, 126.93], [33.22, 126.68],
  [33.25, 126.35], [33.36, 126.12], [33.56, 126.15],
];

// 픽셀 좌표계로 사전 변환 (경계 판정용)
const KOREA_PX = KOREA_BOUNDARY.map(([lat, lng]) => latLngToXY(lat, lng));
const JEJU_PX  = JEJU_BOUNDARY.map(([lat, lng]) => latLngToXY(lat, lng));

// Ray casting 알고리즘으로 점이 다각형 안에 있는지 판정
function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if (((yi > py) !== (yj > py)) &&
        (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// 외곽선 밖으로 나간 카드를 중심 방향으로 끌어당김 (초기 배치 전처리)
function clampToKorea(items) {
  const cx = KOREA_PX.reduce((s, p) => s + p.x, 0) / KOREA_PX.length;
  const cy = KOREA_PX.reduce((s, p) => s + p.y, 0) / KOREA_PX.length;
  return items.map(item => {
    if (pointInPoly(item.x, item.y, KOREA_PX) ||
        pointInPoly(item.x, item.y, JEJU_PX)) return item;
    for (let t = 0.04; t <= 1.01; t += 0.02) {
      const nx = item.x + (cx - item.x) * t;
      const ny = item.y + (cy - item.y) * t;
      if (pointInPoly(nx, ny, KOREA_PX)) return { ...item, x: nx, y: ny };
    }
    return { ...item, x: cx, y: cy };
  });
}

function isInsideKorea(x, y) {
  return pointInPoly(x, y, KOREA_PX) || pointInPoly(x, y, JEJU_PX);
}

function drawKoreaOutline() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', STAGE_W);
  svg.setAttribute('height', STAGE_H);
  svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';

  function makePoly(boundary) {
    const pts = boundary.map(([lat, lng]) => {
      const { x, y } = latLngToXY(lat, lng);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', pts.join(' '));
    poly.setAttribute('fill', 'rgba(43,76,140,0.06)');
    poly.setAttribute('stroke', 'rgba(43,76,140,0.20)');
    poly.setAttribute('stroke-width', '4');
    poly.setAttribute('stroke-linejoin', 'round');
    return poly;
  }

  svg.appendChild(makePoly(KOREA_BOUNDARY));
  svg.appendChild(makePoly(JEJU_BOUNDARY));
  stage.appendChild(svg);
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

// ── 줌 → 모달 ─────────────────────────────────────────────────────
const ZOOM_HINT  = 2.5;  // 이 배율부터 카드 강조
const ZOOM_MODAL = 4.2;  // 이 배율에서 자동 모달 열기
const cardData   = [];   // { el, cx, cy } 스테이지 좌표계 기준 카드 중심

let zoomFocusCard = null;
let zoomModalDone = false;

function updateZoomFocus(canOpen) {
  const vx = stageWrap.clientWidth  / 2;
  const vy = stageWrap.clientHeight / 2;

  if (scale < ZOOM_HINT) {
    if (zoomFocusCard) { zoomFocusCard.classList.remove('zoom-focus'); zoomFocusCard = null; }
    if (scale < ZOOM_MODAL) zoomModalDone = false;
    return;
  }

  // 뷰포트 중심에 가장 가까운 카드 찾기 (스테이지 좌표 → 화면 좌표 변환)
  let closest = null, minDist = Infinity;
  cardData.forEach(({ el, cx, cy }) => {
    const sx = cx * scale + tx;
    const sy = cy * scale + ty;
    const d  = Math.hypot(sx - vx, sy - vy);
    if (d < minDist) { minDist = d; closest = el; }
  });

  if (closest !== zoomFocusCard) {
    if (zoomFocusCard) zoomFocusCard.classList.remove('zoom-focus');
    zoomFocusCard = closest;
    zoomModalDone = false;
    if (closest) closest.classList.add('zoom-focus');
  }

  if (scale < ZOOM_MODAL) zoomModalDone = false;

  if (canOpen && scale >= ZOOM_MODAL && !zoomModalDone && closest) {
    zoomModalDone = true;
    const target = closest;
    setTimeout(() => { if (zoomFocusCard === target) target.click(); }, 150);
  }
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

  // M열(index 12) = 공사역사 링크 URL, N열(index 13) = 학생역사 링크 URL
  function safeUrl(v) { return (v && /^https?:\/\//.test(v)) ? v : ''; }
  function linkedText(v, url) {
    return url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${v}</a>` : v;
  }

  // M(12)=공사역사링크, N(13)=학생역사링크, O(14)=설치일링크, P(15)=상징성링크
  const constHistUrl   = safeUrl(row[12] || '');
  const studentHistUrl = safeUrl(row[13] || '');
  const dateUrl        = safeUrl(row[14] || '');
  const symbolUrl      = safeUrl(row[15] || '');

  const fields = [
    ['설치일',    date,        dateUrl,        false],
    ['크기',      size,        '',             false],
    ['상징성',    symbol,      symbolUrl,      true],
    ['공사 역사', constHist,   constHistUrl,   true],
    ['학생 역사', studentHist, studentHistUrl, true],
  ].filter(([, v]) => v);
  document.getElementById('m-grid').innerHTML = fields.map(([l, v, url, full]) =>
    `<div class="m-field${full ? ' full' : ''}"><label>${l}</label><p>${linkedText(v, url)}</p></div>`
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
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeBlockedModal(); } });

// ── 시간 제한 ──────────────────────────────────────────────────────
// startH 이상 endH 미만(시 단위)에만 접근 허용
const ACCESS_RULES = {
  '덕성여자대학교': { startMin: 9*60,    endMin: 21*60,    label: '09:00 – 21:00' },
  '이화여자대학교': { startMin: 5*60,    endMin: 23*60+59, label: '05:00 – 23:59' },
  '숙명여자대학교': { startMin: 5*60,    endMin: 22*60,    label: '05:00 – 22:00' },
};
let testTime = null; // null이면 실제 시간 사용

function isAccessible(school) {
  const rule = ACCESS_RULES[school];
  if (!rule) return true;
  const now = testTime || new Date();
  const min = now.getHours() * 60 + now.getMinutes();
  return min >= rule.startMin && min < rule.endMin;
}

function openBlockedModal(school) {
  const rule = ACCESS_RULES[school] || {};
  document.getElementById('bl-name').textContent  = school;
  document.getElementById('bl-hours').textContent = rule.label ? `개방 시간 ${rule.label}` : '';
  document.getElementById('blocked-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeBlockedModal() {
  document.getElementById('blocked-overlay').classList.remove('active');
  document.body.style.overflow = '';
}
document.getElementById('blocked-close').addEventListener('click', closeBlockedModal);
document.getElementById('blocked-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('blocked-overlay')) closeBlockedModal();
});

function updateLockedCards() {
  cardData.forEach(({ el, school }) => {
    if (ACCESS_RULES[school]) el.classList.toggle('time-locked', !isAccessible(school));
  });
}

function updateTimeDisplay() {
  const now   = testTime || new Date();
  const hh    = String(now.getHours()).padStart(2, '0');
  const mm    = String(now.getMinutes()).padStart(2, '0');
  const open  = isAccessible('덕성여자대학교');
  const pfx   = testTime ? '⚙ ' : '';
  document.getElementById('tc-status').textContent =
    `${pfx}${hh}:${mm} · 덕성여대 ${open ? '🟢 개방' : '🔴 폐쇄'}`;
}

function initTimeControl() {
  const tcSlider = document.getElementById('tc-slider');
  const tcLabel  = document.getElementById('tc-label');
  const tcReset  = document.getElementById('tc-reset');

  function minToStr(m) {
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }
  function snapToNow() {
    const n = new Date();
    return Math.round((n.getHours() * 60 + n.getMinutes()) / 30) * 30;
  }

  tcSlider.value = snapToNow();

  tcSlider.addEventListener('input', () => {
    const m = parseInt(tcSlider.value);
    testTime = new Date();
    testTime.setHours(Math.floor(m / 60), m % 60, 0, 0);
    tcLabel.textContent = minToStr(m);
    updateLockedCards();
    updateTimeDisplay();
  });

  tcReset.addEventListener('click', () => {
    testTime = null;
    tcSlider.value = snapToNow();
    tcLabel.textContent = '실제 시간';
    updateLockedCards();
    updateTimeDisplay();
  });

  updateTimeDisplay();
  setInterval(() => { if (!testTime) { updateLockedCards(); updateTimeDisplay(); } }, 30000);
}

// ── 줌/팬 ──────────────────────────────────────────────────────────
const stageWrap = document.getElementById('stage-wrap');
const stage     = document.getElementById('stage');
stage.style.width  = STAGE_W + 'px';
stage.style.height = STAGE_H + 'px';

let scale = 1, tx = 0, ty = 0;

function applyTransform() {
  stage.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
}

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
  updateZoomFocus(true);
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
  updateZoomFocus(false);
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
    applyTransform();
    updateZoomFocus(false);
  } else if (cur.length >= 2 && lastTouches.length >= 2) {
    const od = Math.hypot(lastTouches[1].x - lastTouches[0].x, lastTouches[1].y - lastTouches[0].y);
    const nd = Math.hypot(cur[1].clientX - cur[0].clientX, cur[1].clientY - cur[0].clientY);
    const f  = od > 0 ? nd / od : 1;
    const r  = stageWrap.getBoundingClientRect();
    const mx = (cur[0].clientX + cur[1].clientX) / 2 - r.left;
    const my = (cur[0].clientY + cur[1].clientY) / 2 - r.top;
    tx = mx - (mx - tx) * f; ty = my - (my - ty) * f;
    scale = Math.max(0.15, Math.min(10, scale * f));
    applyTransform();
    updateZoomFocus(true);
  }
  lastTouches = cur.map(t => ({ x: t.clientX, y: t.clientY }));
}, { passive: false });
stageWrap.addEventListener('touchend', e => {
  lastTouches = [...e.touches].map(t => ({ x: t.clientX, y: t.clientY }));
}, { passive: false });

// ── 겹침 해소 ─────────────────────────────────────────────────────
// 정밀 다각형 대신 바운딩 박스로 경계 체크 → 카드가 더 자유롭게 퍼짐
function resolveOverlaps(items) {
  const GAP = 8;
  const MIN_DX = CARD_W + GAP, MIN_DY = CARD_H + GAP;
  const pts = items.map(d => ({ ...d }));

  // 한국 윤곽선의 바운딩 박스 + 여백
  const pxs = KOREA_PX.map(p => p.x), pys = KOREA_PX.map(p => p.y);
  const bx0 = Math.min(...pxs) - CARD_W * 3, bx1 = Math.max(...pxs) + CARD_W * 3;
  const by0 = Math.min(...pys) - CARD_H * 3, by1 = Math.max(...pys) + CARD_H * 3;
  function ok(x, y) { return x >= bx0 && x <= bx1 && y >= by0 && y <= by1; }

  function tryAxis(a, b, useX, overlap, diff) {
    const s = diff >= 0 ? 1 : -1;
    const half = overlap / 2 + 1, full = overlap + 2;
    const nAx = useX ? a.x - s * half : a.x, nAy = useX ? a.y : a.y - s * half;
    const nBx = useX ? b.x + s * half : b.x, nBy = useX ? b.y : b.y + s * half;
    const fAx = useX ? a.x - s * full : a.x, fAy = useX ? a.y : a.y - s * full;
    const fBx = useX ? b.x + s * full : b.x, fBy = useX ? b.y : b.y + s * full;
    const okA = ok(nAx, nAy), okB = ok(nBx, nBy);
    if (okA && okB) {
      if (useX) { a.x = nAx; b.x = nBx; } else { a.y = nAy; b.y = nBy; }
      return true;
    }
    if (!okA && okB) {
      if (useX) b.x = ok(fBx, b.y) ? fBx : nBx; else b.y = ok(b.x, fBy) ? fBy : nBy;
      return true;
    }
    if (okA && !okB) {
      if (useX) a.x = ok(fAx, a.y) ? fAx : nAx; else a.y = ok(a.x, fAy) ? fAy : nAy;
      return true;
    }
    return false;
  }

  for (let iter = 0; iter < 1500; iter++) {
    let hasMoved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const ox = MIN_DX - Math.abs(dx), oy = MIN_DY - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        const pushed = ox <= oy
          ? (tryAxis(a, b, true,  ox, dx) || tryAxis(a, b, false, oy, dy))
          : (tryAxis(a, b, false, oy, dy) || tryAxis(a, b, true,  ox, dx));
        if (pushed) hasMoved = true;
      }
    }
    if (!hasMoved) break;
  }
  return pts;
}

// ── 카드 DOM 생성 ─────────────────────────────────────────────────
function placeCard({ row, x, y }) {
  const school = row[1] || '';
  const imgUrl = toImgUrl(row[0] || '');
  const shortName = school;

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

  if (ACCESS_RULES[school]) {
    const lock = document.createElement('div');
    lock.className = 'gate-card-lock';
    lock.textContent = '🔒';
    card.appendChild(lock);
  }

  card.addEventListener('click', () => {
    if (!isAccessible(school)) { openBlockedModal(school); return; }
    openModal(row);
  });
  stage.appendChild(card);
  cardData.push({ el: card, cx: x, cy: y, school });
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

    // gviz API는 셀 하이퍼링크를 전달하지 않으므로 텍스트 값만 추출
    // 링크 URL은 별도 열(M=공사역사링크, N=학생역사링크)로 관리
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
    const preclamped = clampToKorea(items);   // 먼저 외곽선 안으로 초기화
    const resolved   = resolveOverlaps(preclamped); // 경계 인식 겹침 해소
    resolved.forEach(item => placeCard(item));
    updateLockedCards();

    document.getElementById('count-badge').textContent = `${resolved.length}개 대학`;
    fitToCards(resolved);

    setProgress(100, '완료');
    setTimeout(() => document.getElementById('loader').classList.add('hidden'), 600);

  } catch (e) {
    setProgress(100, '');
    document.getElementById('ld-fill').style.background = '#C0392B';
    document.getElementById('ld-msg').textContent = '로드 실패: ' + e.message;
  }
}

drawKoreaOutline();
load();
initTimeControl();
