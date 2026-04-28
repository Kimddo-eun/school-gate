const overlay = document.getElementById('overlay');
const mImg    = document.getElementById('m-img');
const mName   = document.getElementById('m-name');
const mLoc    = document.getElementById('m-loc');
const mGrid   = document.getElementById('m-grid');

function openModal(row) {
  const clean = idx => (row[idx] || '').replace(/^"|"$/g, '').trim();

  const school      = clean(1);
  const location    = clean(2);
  const date        = clean(3);
  const size        = clean(4);
  const symbol      = clean(5);
  const gate        = clean(6);
  const vehicle     = clean(7);
  const beam        = clean(8);
  const constHist   = clean(9);
  const studentHist = clean(10);
  const imgUrl      = toImgUrl(clean(0));

  if (imgUrl) {
    mImg.src = imgUrl;
    mImg.style.display = 'block';
  } else {
    mImg.style.display = 'none';
    mImg.src = '';
  }

  mName.textContent = school;
  mLoc.textContent  = location;

  const fields = [
    ['설치일',    date],
    ['크기',      size],
    ['개폐 여부', gate],
    ['차량 출입', vehicle],
    ['들보 유무', beam],
    ['상징성',    symbol],
    ['공사 역사', constHist],
    ['학생 역사', studentHist],
  ].filter(([, v]) => v);

  mGrid.innerHTML = fields.map(([l, v]) =>
    `<div class="m-field"><label>${l}</label><p>${v}</p></div>`
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
