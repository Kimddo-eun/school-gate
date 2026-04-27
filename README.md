# 대학 정문 아카이브

대한민국 대학교 정문 사진을 실제 지리적 위치에 맞게 배치한 인터랙티브 지도 웹사이트입니다.

## 미리보기

- 한반도 지도 위에 각 대학 정문 사진 카드 배치
- 마우스 휠 줌 인/아웃 · 드래그로 지도 이동
- 카드 클릭 시 상세 정보 모달 표시

## 파일 구조

```
university-gates/
├── index.html          # 메인 HTML
├── css/
│   └── style.css       # 전체 스타일
└── js/
    ├── coords.js       # 대학별 위도/경도 좌표 테이블
    ├── map.js          # 지도 캔버스, 줌/패닝, 카드 생성
    ├── modal.js        # 상세 정보 모달
    └── main.js         # 앱 진입점 (데이터 fetch & 초기화)
```

## 데이터 소스

구글 스프레드시트에서 CSV로 자동 불러옵니다.  
`js/main.js`의 `CONFIG` 객체에서 시트 ID와 GID를 설정하세요.

```js
const CONFIG = {
  sheetId: '여기에_스프레드시트_ID',
  gid:     '여기에_시트_GID',
};
```

### 스프레드시트 컬럼 구조

| 열 | 내용 |
|----|------|
| A  | 이미지 URL |
| B  | 학교 이름 |
| C  | 위치 (주소) |
| D  | 설치일 |
| E  | 크기 |
| F  | 상징성 |
| G  | 개폐 여부 |
| H  | 차량 출입 가능 |
| I  | 돌보 유무 |
| J  | 공사 역사 |
| K  | 학생 역사 |
| L  | 조감도 / 지도 |

> 스프레드시트는 **공개(링크 공유)** 상태여야 합니다.

## 새 대학 좌표 추가

`js/coords.js`의 `COORDS` 객체에 추가합니다.

```js
'OO대학교': [위도, 경도],
```

## GitHub Pages 배포

1. 이 저장소를 GitHub에 올립니다.
2. Settings → Pages → Source: `main` 브랜치 / `/ (root)` 선택
3. 저장 후 `https://<username>.github.io/<repository>/` 에서 확인

## 로컬 실행

별도 빌드 없이 `index.html`을 브라우저에서 열면 됩니다.  
단, CORS 문제로 구글 시트 데이터가 로드되지 않을 수 있습니다.  
로컬 테스트는 간단한 HTTP 서버를 사용하세요.

```bash
# Python 3
python -m http.server 8080
# 이후 http://localhost:8080 접속
```
