// 한국 지도 영역 (남한 + 제주도 포함)
const MAP_BOUNDS = {
  minLat: 32.8, maxLat: 38.7,
  minLng: 124.5, maxLng: 130.6,
};

const STAGE_W = 1200;
const STAGE_H = 1400;

const wrap  = document.getElementById('wrap');
const stage = document.getElementById('stage');

function latLngToXY(lat, lng) {
  const x = ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * STAGE_W;
  const y = (1 - (lat - MAP_BOUNDS.minLat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * STAGE_H;
  return [x, y];
}

// ---- zoom / pan 상태 ----
let scale = 1, tx = 0, ty = 0;

function applyTransform() {
  stage.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
  document.getElementById('zlbl').textContent = Math.round(scale * 100) + '%';
}

function clampTranslate() {
  const sw = STAGE_W * scale, sh = STAGE_H * scale;
  const vw = wrap.offsetWidth, vh = wrap.offsetHeight;
  tx = Math.min(vw * 0.5, Math.max(vw - sw - vw * 0.1, tx));
  ty = Math.min(vh * 0.5, Math.max(vh - sh - vh * 0.1, ty));
}

function centerStage() {
  scale = Math.min(
    (wrap.offsetWidth  * 0.9) / STAGE_W,
    (wrap.offsetHeight * 0.9) / STAGE_H
  );
  tx = (wrap.offsetWidth  - STAGE_W * scale) / 2;
  ty = (wrap.offsetHeight - STAGE_H * scale) / 2;
  applyTransform();
}

// 마우스 휠 줌
wrap.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 0.9 : 1.1;
  const newScale = Math.min(5, Math.max(0.2, scale * factor));
  const rect = wrap.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  tx = mx - (mx - tx) * (newScale / scale);
  ty = my - (my - ty) * (newScale / scale);
  scale = newScale;
  clampTranslate();
  applyTransform();
}, { passive: false });

// 드래그 패닝
let dragging = false, dragX = 0, dragY = 0;
wrap.addEventListener('mousedown', e => {
  if (e.target.closest('.gate-card')) return;
  dragging = true;
  dragX = e.clientX - tx;
  dragY = e.clientY - ty;
  wrap.classList.add('grabbing');
});
window.addEventListener('mousemove', e => {
  if (!dragging) return;
  tx = e.clientX - dragX;
  ty = e.clientY - dragY;
  clampTranslate();
  applyTransform();
});
window.addEventListener('mouseup', () => {
  dragging = false;
  wrap.classList.remove('grabbing');
});

// 줌 버튼
document.getElementById('z-in').addEventListener('click', () => {
  scale = Math.min(5, scale * 1.25);
  clampTranslate();
  applyTransform();
});
document.getElementById('z-out').addEventListener('click', () => {
  scale = Math.max(0.2, scale / 1.25);
  clampTranslate();
  applyTransform();
});
document.getElementById('z-reset').addEventListener('click', () => {
  centerStage();
});

window.addEventListener('resize', () => { centerStage(); });

// ---- 카드 생성 ----
function createCard(row, i, onClick) {
  const school  = (row[1] || '').replace(/^"|"$/g, '').trim();
  const location = (row[2] || '').replace(/^"|"$/g, '').trim();
  const imgUrl  = toImgUrl((row[0] || '').replace(/^"|"$/g, '').trim());

  const coords = COORDS[school];
  if (!coords) return;

  const [x, y] = latLngToXY(coords[0], coords[1]);

  const card = document.createElement('div');
  card.className = 'gate-card';
  card.style.left = x + 'px';
  card.style.top  = y + 'px';
  card.style.zIndex = i + 1;
  card.dataset.index = i;

  card.innerHTML = imgUrl
    ? `<img class="gate-thumb" src="${imgUrl}" alt="${school}"
           onerror="this.outerHTML='<div class=gate-placeholder>${school}</div>'">
       <div class="gate-label">${school}</div>`
    : `<div class="gate-placeholder">${school}</div>
       <div class="gate-label">${school}</div>`;

  // 툴팁
  const tip = document.getElementById('tip');
  card.addEventListener('mouseenter', () => {
    document.getElementById('tip-name').textContent = school;
    document.getElementById('tip-loc').textContent  = location;
    tip.classList.add('show');
  });
  card.addEventListener('mousemove', e => {
    tip.style.left = (e.clientX + 14) + 'px';
    tip.style.top  = (e.clientY - 10) + 'px';
  });
  card.addEventListener('mouseleave', () => tip.classList.remove('show'));

  card.addEventListener('click', () => onClick(i));

  stage.appendChild(card);
}
