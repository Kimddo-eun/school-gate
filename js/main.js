const CONFIG = {
  sheetId: '1myKTpXM_E1d8GBGaxShIsX3UqYJwP1aS407ODT7iawE',
  gid:     '1648520092',
};

const SHEET_URL =
  `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/gviz/tq?tqx=out:json&gid=${CONFIG.gid}`;

// ── 유틸 ──────────────────────────────────────────────
function toImgUrl(url) {
  if (!url) return '';
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return `https://drive.google.com/uc?export=view&id=${m1[1]}`;
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return `https://drive.google.com/uc?export=view&id=${m2[1]}`;
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

  // 이미지
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

  // 태그
  const tags = [];
  if (gate)    tags.push(`<span class="m-tag m-tag-${tagClass(gate)}">${gate.split(' ')[0]}</span>`);
  if (vehicle) tags.push(`<span class="m-tag m-tag-vehicle">차량 ${vehicle.split(/[,\s]/)[0]}</span>`);
  if (beam)    tags.push(`<span class="m-tag m-tag-beam">들보 ${beam.split(/[,\s]/)[0]}</span>`);
  document.getElementById('m-tags').innerHTML = tags.join('');

  // 상세 필드
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

// CartoDB Positron — 깔끔한 흰 배경 지도
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> &copy; <a href="https://carto.com">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 20,
}).addTo(map);

// 마커 생성
function addMarker(row) {
  const school = row[1] || '';
  const coords = COORDS[school];
  if (!coords) return false;

  const imgUrl = toImgUrl(row[0] || '');
  const shortName = school.replace(/(캠퍼스|대학교|대학|서울|인문사회과학|글로벌|북악|성심교정|석관동|죽전|용봉|아라|송도|천안|수원|경산|돈암수정)/g, '').trim();

  const inner = imgUrl
    ? `<img src="${imgUrl}" alt="${school}"
            onerror="this.outerHTML='<div class=gate-marker-placeholder>${shortName}</div>'">`
    : `<div class="gate-marker-placeholder">${shortName}</div>`;

  const icon = L.divIcon({
    html: `<div class="gate-marker-wrap">${inner}</div>`,
    className: '',
    iconSize:   [64, 64],
    iconAnchor: [32, 32],
  });

  L.marker(coords, { icon })
    .addTo(map)
    .bindTooltip(school, {
      direction: 'top',
      offset: [0, -38],
      className: 'gate-tip',
    })
    .on('click', () => openModal(row));

  return true;
}

// ── 데이터 로드 ────────────────────────────────────────
async function load() {
  setProgress(10, '구글 시트 연결 중…');
  try {
    const res = await fetch(SHEET_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);

    setProgress(50, '데이터 파싱 중…');
    const text = await res.text();
    const start = text.indexOf('{');
    const end   = text.lastIndexOf('}');
    const json  = JSON.parse(text.slice(start, end + 1));

    const rawRows = (json.table.rows || [])
      .map(r => (r.c || []).map(cell => (cell && cell.v != null) ? String(cell.v).trim() : ''));

    // 헤더 행 제거 (B열이 '학교'인 행)
    const data = rawRows.filter(r => r[1] && r[1] !== '학교' && r[1] !== '학교명');

    console.log(`[DEBUG] 전체 행 수: ${rawRows.length}, 필터 후: ${data.length}`);
    if (data.length > 0) {
      console.log('[DEBUG] 첫 3개 학교명:', data.slice(0, 3).map(r => `"${r[1]}"`).join(', '));
    }

    setProgress(75, '지도에 배치 중…');

    let placed = 0;
    let missing = [];
    data.forEach(row => {
      if (addMarker(row)) {
        placed++;
      } else if (row[1]) {
        missing.push(row[1]);
      }
    });

    if (missing.length > 0) {
      console.warn('[DEBUG] COORDS에 없는 학교:', missing.join(', '));
    }

    document.getElementById('count-badge').textContent = `${placed}개 대학`;

    // 마커 전체가 보이도록 뷰 맞춤
    if (placed > 0) {
      map.fitBounds([
        [33.0, 124.5],
        [38.7, 131.0],
      ], { padding: [40, 40] });
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
