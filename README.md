# 케미프렌드 홈페이지

기존 chemifriend.com(그누보드 기반) 내용을 그대로 옮겨 만든 새 홈페이지입니다.
호스팅비 없이 **GitHub Pages**에서 무료로 서비스되고, **엑셀 파일 하나**로 내용을 수정합니다.

---

## 1. 구조

```
chemifriend-site/
├─ content/
│  └─ content.xlsx      ← 이 파일만 고치면 됩니다
├─ templates/            ← 디자인/레이아웃 (건드릴 필요 거의 없음)
├─ static/
│  ├─ style.css          ← 색상, 폰트 등 디자인
│  └─ logos/             ← 브랜드 로고 이미지
├─ build.py              ← content.xlsx → HTML로 변환하는 프로그램
├─ scrape_products.py    ← (최초 1회) 기존 chemifriend.com의 Product 게시판을 통째로 읽어와 content.xlsx에 채워넣는 스크립트
├─ deploy.bat            ← 더블클릭 한 번으로 빌드 + 홈페이지 반영
└─ docs/                 ← 실제로 서비스되는 최종 결과물 (자동 생성됨, 직접 수정 금지)
```

Product 페이지는 3단 구조입니다: `product.html`(브랜드 목록) → `product/<브랜드>/index.html`
(브랜드 소개 + 제품군 목록) → `product/<브랜드>/<제품군>.html`(실제 스펙표). 상단 메뉴의
"Product"에 마우스를 올리면 브랜드별 제품군까지 바로 이동할 수 있는 드롭다운이 뜹니다.

## 0. (최초 1회) 기존 사이트의 제품 데이터 가져오기

기존 chemifriend.com Product 게시판에는 18개 게시글 안에 카테고리별 스펙표가 들어있습니다.
아래 명령을 실행하면 **기존 사이트가 살아있는 동안** 자동으로 전부 읽어와서 `content.xlsx`의
"제품상세" 시트에 채워줍니다.

```
py scrape_products.py
```

- 실행 후 반드시 `content/content.xlsx`의 "제품상세" 시트를 열어서 내용이 잘 들어왔는지 확인하세요.
- 표 구조가 특이한 페이지는 완벽히 옮겨지지 않을 수 있습니다. 이상한 부분만 수동으로 고치면 됩니다.
- 기존 사이트를 내리기 전에 반드시 이 작업부터 끝내주세요. (사이트가 내려가면 다시 못 가져옵니다)

## 2. 내용 수정하는 법 (담당자용)

1. `content/content.xlsx` 파일을 엑셀로 엽니다.
2. 시트 7개 중 필요한 곳을 고칩니다. (제품 스펙은 "제품상세" 시트 — 11번 참고)
   - **회사정보**: 인사말, 주소, 전화번호 등 (한 줄에 항목 하나)
   - **연혁**: 연월 + 내용 두 칸만
   - **조직도**: "부서" 시트(부서명/설명 5줄) + "조직원" 시트(부서/이름/담당분야) — 두 시트로 나뉘어 있습니다.
     사람을 추가하려면 "조직원" 시트에 부서명을 정확히 맞춰 한 줄 추가하면 됩니다.
   - **사업영역**: 회사명 / 슬러그(건드리지 마세요) / 로고파일(static/logos/ 안의 파일명, 로고 여러 개면 쉼표로 구분)
   - **브랜드소개**: 슬러그 / 영문슬로건 / 한국어소개 — 브랜드 페이지 상단에 표시되는 소개 문구
3. 저장합니다.
4. `deploy.bat` 파일을 더블클릭합니다. (GitHub에 올리기만 하고, 빌드는 GitHub가 클라우드에서 합니다)
5. 검은 창에 "완료!"가 뜨면 끝. 1~2분 뒤 사이트에 반영됩니다.
   진행상황·오류는 저장소의 **Actions** 탭에서 확인 (초록 체크 = 성공, 빨간 X = 실패 → 사이트는 직전 버전 유지)

> 엑셀 구조(시트 이름, 첫 줄 헤더)는 바꾸지 마세요. 내용(값)만 수정하면 됩니다.

## 3. 처음 컴퓨터에 설치할 때 (개발 담당자용)

- 저장소: https://github.com/Chemifriend/chemifriend.github.io (회사 계정)
- **필수**: Git 설치 → `git clone https://github.com/Chemifriend/chemifriend.github.io chemifriend-site`
  (첫 `git push` 때 브라우저 로그인 창이 뜸)
- **선택**: 로컬 미리보기가 필요하면 Python 3.x 설치 후 `py -m pip install -r requirements.txt`
  (Python이 없어도 배포는 됩니다 — 빌드는 GitHub Actions가 함)
- OneDrive·구글드라이브 같은 동기화 폴더 안에 두지 마세요 (빌드 시 파일 잠금 오류)

## 4. 미리보기만 하고 싶을 때 (반영 전 확인)

```
py build.py
```
그 다음 `docs/index.html` 파일을 더블클릭해서 브라우저로 열면 결과를 미리 볼 수 있습니다.
(이 경우는 GitHub에 올라가지 않으니 안심하고 확인해도 됩니다.)

## 5. GitHub Pages / 도메인 연결 설정 (최초 1회만)

1. GitHub 저장소 → Settings → Pages
2. Build and deployment → Source: **GitHub Actions** 선택 (배포 방식은 `.github/workflows/deploy.yml`)
3. (DNS 전환할 때) Custom domain 칸에 `chemifriend.com` 입력 → 저장 → DNS 확인 후 **Enforce HTTPS** 체크
4. 도메인을 관리하는 곳(가비아, 후이즈 등 기존 도메인 등록기관)의 DNS 설정에서:
   - `A` 레코드 4개를 GitHub Pages IP로 등록:
     `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - (www 서브도메인도 쓰려면) `CNAME` 레코드로 `www` → `chemifriend.github.io`
5. 기존 호스팅사 서비스는 DNS 전환이 확인된 뒤 해지하면 됩니다. (전환 확인 전에 먼저 해지하지 마세요)

## 6. 지금 버전에서 비어있는 부분

- `scrape_products.py`를 아직 실행하지 않았다면 Product 페이지에 상세 스펙표가 비어 있고
  파트너사 이름만 나옵니다. 0번 항목부터 진행해주세요.
- 영문(ENG) 페이지는 아직 없습니다. 다음 단계로 진행 가능합니다.
- 문의 게시판(온라인 문의) 대신 우선 이메일 링크로 연결해두었습니다.

## 7. 로고 파일 관리

`static/logos/` 폴더에 파트너사 로고 이미지가 들어있습니다. 새 파트너를 추가하거나 로고를 바꾸려면:

1. 로고 이미지를 `static/logos/` 폴더에 넣습니다 (파일명은 영문으로, 예: `newpartner.png`)
2. `content.xlsx`의 "사업영역" 시트에 회사명/슬러그/로고파일명을 한 줄 추가합니다
3. `deploy.bat` 실행

현재 슬러그는 기존 사이트의 게시판 카테고리 값(CABOT, SYNTHOMER-eastman, ARKEMA, SOLVAY, Others)과
`제품상세` 시트의 "카테고리" 값이 **정확히 똑같아야** 제품 목록과 로고가 서로 연결됩니다. 대소문자까지 맞춰주세요.

## 8. Eastman / Synthomer 관련 참고사항

2022년 Eastman의 접착수지(Adhesive Resins) 사업부 전체(Hydrocarbon Resin, APAO, Rosin 계열)가
Synthomer로 매각되었습니다. 케미프렌드가 취급하는 이 카테고리 품목은 모두 여기 해당되어,
**Eastman과 Synthomer로 나눌 수 없고 전부 Synthomer 소속**입니다 (제품명에 남아있는 "Eastoflex",
"Aerafin", "EastmanG" 등은 브랜드명일 뿐 소속 회사가 아닙니다). 그래서 "사업영역" 시트에서
"SYNTHOMER-eastman" 슬러그의 회사명을 "Synthomer" 하나로 통합해두었습니다. 만약 나중에
케미프렌드가 별도로 순수 Eastman 제품(이번 매각 대상이 아닌 다른 사업부)을 새로 취급하게 되면,
그때 "사업영역"과 "브랜드소개" 시트에 새 줄을 추가하면 됩니다.

## 9. 구글 검색(SEO) 관련

빌드할 때마다 자동으로 만들어지는 것:
- 페이지마다 고유한 `<title>`/`설명` 메타 태그 (엑셀 내용 기반)
- `sitemap.xml` — 전체 페이지 목록 (598개)
- `robots.txt` — 검색엔진 크롤링 허용 + sitemap 위치 안내
- `canonical` 태그 — 페이지마다 정식 URL 표시

**그래도 실제로 구글에 뜨려면 추가로 필요한 것** (기술적으로 자동화 불가능한 부분):
1. 사이트가 `chemifriend.com`으로 실제 배포되어 있어야 함
2. [Google Search Console](https://search.google.com/search-console)에 도메인 등록 + `sitemap.xml` 제출
3. 등록 후 구글이 크롤링·색인하는 데 보통 며칠~몇 주 소요됨 (즉시 안 됨)
4. 검색 순위는 콘텐츠 품질/외부 링크 등 다른 요인도 작용 — "기술적으로 준비됨"과 "검색 상위 노출"은 별개 문제

## 10. 브랜드 카드의 "제품요약" 문구 수정

홈페이지·Product 허브의 브랜드 카드에 나오는 "취급 제품: ..." 문구는 `content.xlsx`의
"브랜드소개" 시트 **제품요약** 컬럼에서 가져옵니다. 이 칸을 비워두면 제품군 영문명을 자동으로
나열하고, 채워두면 그 텍스트가 그대로 표시됩니다 (한글로 보기 좋게 정리해서 넣어둔 상태).

## 11. 제품상세 시트 구조 (참고용)

`scrape_products.py`가 만드는 "제품상세" 시트는 다음 7개 컬럼입니다. 필요하면 이 시트도
직접 수정 가능합니다 (형식만 유지하면 됩니다).

| 컬럼 | 의미 |
|---|---|
| 카테고리 | CABOT / SYNTHOMER-eastman / ARKEMA / SOLVAY / Others (대소문자까지 "사업영역" 시트의 슬러그와 일치해야 함) |
| 페이지명 | 예: Carbon Black, APAO (Amorphous Polyolefins) — 이 값이 그대로 제품군 페이지 제목과 URL이 됩니다 |
| 소그룹 | 표 위 소제목 (예: "EASTOFLEX / Propylene Homopolymers") |
| 품명 | 제품명 |
| 용도 | Application |
| 제품형태 | Product/Physical Form |
| 기타스펙 | 그 외 모든 스펙값을 "항목: 값" 형태로 이어붙인 것 |
