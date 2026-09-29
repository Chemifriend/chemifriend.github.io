# CLAUDE.md — 케미프렌드 홈페이지 프로젝트 인수인계

이 파일은 Claude Code가 이 폴더를 열 때 자동으로 읽는 맥락 문서입니다.
사람용 사용 설명서는 `README.md`를 보세요.

## 프로젝트 개요

- 회사: (주)케미프렌드 (Chemifriend Corp.) — 2002년 설립, 스페셜티 케미칼 유통사.
  Cabot / Synthomer / Arkema / Syensqo 등의 한국 대리점
- 목표: 기존 chemifriend.com(그누보드 기반, 유료 호스팅 연 20~30만원)을
  **GitHub Pages 무료 정적 사이트**로 교체
- 사용자: 승헌 (영업1팀 과장). 비개발자 담당자들도 쉽게 수정할 수 있어야 하고,
  후임자가 이해하기 쉬운 구조여야 함

## 현재 상태 (2026-09 기준)

완료:
- 기존 사이트 콘텐츠 전체 이식 (회사정보, CEO 인사말, 연혁, 조직도, 사업영역)
- 기존 Product 게시판 스크래핑 → 제품 572개 (`scrape_products.py`, 결과는 content.xlsx "제품상세" 시트)
- 4단 구조 정적 사이트 생성: 메인 / Product 허브 / 브랜드 / 제품군 스펙표 / 개별 제품(SKU) — 총 598페이지
- 디자인: 로고 초록 `#6aac00` 포인트 + 다크 네이비. 헤더 메가메뉴(브랜드 → 제품군)
- SEO: 페이지별 title/description, canonical, sitemap.xml, robots.txt 자동 생성

**아직 안 한 것 (= 다음 작업):**
1. GitHub Pages 배포 — 저장소·워크플로우 준비 완료, 사용자 push 대기 (아래 "배포 구조")
2. 데이터 저장 방식 변경 + 관리자 페이지 제작 (아래 "확정된 다음 방향" 참고)
3. 도메인 DNS 전환 → 확인 후 기존 호스팅 해지
4. Google Search Console 등록 + sitemap 제출

## 폴더 구조

```
content/content.xlsx   현재 데이터 원본 (다음 단계에서 JSON으로 이전 예정)
templates/             Jinja2 템플릿 (base, index, product_hub, brand, product_family, product_sku, contact, _brand_tiles)
static/style.css       전체 스타일
static/logos/          로고 (파트너사 로고는 내부 여백을 트리밍한 버전. cf-icon.jpg = 케미프렌드 아이콘 마크)
build.py               xlsx → docs/ 정적 HTML 생성
scrape_products.py     기존 사이트 Product 게시판 스크래퍼 (기존 사이트가 살아있는 동안만 동작)
deploy.bat             git add/commit/push (Python 있으면 로컬 빌드 검사 먼저). 관리자 페이지 생기면 폐기
.github/workflows/     deploy.yml — push 시 Actions가 build.py 실행 → Pages 배포
docs/                  로컬 빌드 결과물 (.gitignore — 저장소에 안 올라감)
```

## content.xlsx 시트 구조

- 회사정보: 항목/내용 (키-값). CEO_인사말_본문은 빈 줄 두 개로 문단 구분
- 연혁: 연월/내용
- 부서: 부서/설명 — 조직원: 부서/이름/담당분야 (담당분야 빈 사람 있음)
- 사업영역: 회사명/슬러그/로고파일 — 슬러그는 URL과 제품상세 카테고리 매칭 키. **대소문자까지 정확히 일치해야 함** (예: `SYNTHOMER-eastman`)
- 브랜드소개: 슬러그/영문슬로건/한국어소개/국가/설립연도/제품요약(카드에 표시되는 한글 요약)
- 제품상세: 카테고리/페이지명(제품군)/소그룹/품명/용도/제품형태/기타스펙
  - 기타스펙은 `키: 값; 키: 값` 문자열 → build.py가 파싱해서 제품군별 동적 컬럼으로 표시

## 반드시 지킬 사실관계 / 규칙

- **Synthomer/Eastman**: 2022년 Eastman 접착수지 사업부(Hydrocarbon Resin, APAO, Rosin)가 Synthomer로 매각됨.
  취급 품목 전부 Synthomer 소속. Eastman으로 분리하지 말 것. 제품명의 Eastoflex/Aerafin/EastmanG는 브랜드명일 뿐.
  사이트에 이 매각 설명 문구는 표시하지 않기로 함 (사용자 요청)
- **Syensqo**: 2023년 Solvay에서 분사. 표시명은 "Syensqo" (슬러그는 기존 `SOLVAY` 유지)
- 스펙표: "품명"과 "Application" 두 열은 모든 제품군에서 **고정 폭**, 내용이 길면 줄바꿈. 나머지 스펙은 제품군별 실제 컬럼
- 표기는 "기본 용도"가 아니라 **"Application"**
- 인사 정보를 지어내지 말 것 (담당분야 없는 직원에게 직함 임의 부여 금지)
- 수치를 지어내지 말 것 (히어로 통계는 전부 실제 데이터에서 계산)
- 라이선스 불명확한 스톡 사진 사용 금지
- 로고에 이미 회사명이 있는 브랜드는 카드에 이름 텍스트를 중복 표시하지 않음 (로고 없는 Others만 텍스트)
- 섹션 제목은 담백하게. "함께하는 글로벌 브랜드", "전문 조직 구성" 같은 문구는 사용자가 싫어함

## 배포 구조 (2026-09-29)

- 저장소: https://github.com/Chemifriend/chemifriend.github.io (Public — 무료 Pages 조건. 이 파일도 공개됨에 유의)
  - 2026-02 Bootstrap 프로토타입은 `Chemifriend/chemifriend-prototype-2026`으로 이름 변경해 분리 보관. 이 저장소는 새 이력으로 시작
- main push → GitHub Actions(`deploy.yml`)가 build.py 실행 → Pages 배포. docs/는 커밋 안 함
- Pages Source는 저장소 설정에서 **GitHub Actions**로 지정해야 함 (Actions 배포 시 docs/CNAME 파일은 무시됨 → 커스텀 도메인은 설정 화면에서 입력)
- DNS 전환 전까지는 https://chemifriend.github.io 로 확인. chemifriend.com은 아직 기존 호스팅(112.175.184.61)
- 계정 리스크: GitHub 계정 이메일이 shbaek@chemifriend.com (개인 업무메일) → 공용 메일로 변경 + 2FA 복구코드 회사 보관 필요
- 줄바꿈: .gitattributes로 LF 고정, .bat만 CRLF

## 확정된 다음 방향: GitHub만 쓰는 관리자 페이지

사용자 결정 사항:
- 구글 시트·구글 드라이브·Supabase 등 **외부 서비스 없이 GitHub만** 사용
- `chemifriend.com/admin` 관리자 페이지에서 수정
- 대량 데이터는 **xlsx 양식 내려받기 / 불러오기**, 세부 수정은 **화면 UI**로
- 제조사도 추가·수정·삭제 가능해야 함

설계안 (사용자와 합의한 내용):
- 데이터 원본을 xlsx에서 저장소 안 JSON 파일(`data/`)로 이전. build.py는 JSON을 읽도록 수정
- 관리자 페이지는 GitHub API로 JSON/로고 파일을 커밋 → GitHub Actions가 build.py 실행 후 Pages 배포
- 인증: 이 저장소 하나만 쓰기 가능한 fine-grained 토큰을 최초 1회 입력 (브라우저 저장). 담당자 바뀌면 재발급
- 제조사 관리: 카드 목록, 추가/수정, 로고 드래그앤드롭(브라우저에서 여백 자동 트리밍), 순서 변경, 노출 Y/N(숨김 = 소프트 삭제)
- 제조사에 숨겨진 고정 ID를 두어, 표시 이름을 바꿔도 URL·제품 연결이 유지되게
- 제품 관리: 제조사 → 제품군 선택 → 엑셀처럼 셀 인라인 편집, 행 추가/삭제
- xlsx 양식은 **제품군 단위**로: 해당 제품군의 실제 스펙 항목이 엑셀 열 제목으로 나오게 (문자열 `키: 값;` 방식 탈피)
- xlsx 불러오기 시 즉시 반영하지 말고 **미리보기**: 추가 N / 변경 N / 변경없음 N / 엑셀에 없는 기존 제품 N + 오류 행 표시.
  엑셀에 없는 기존 제품은 기본 유지, 체크해야만 삭제
- 제품이 남아있는 제조사를 삭제하려 하면 차단 + 안내
- 전체 백업 xlsx 내보내기
- 동시 수정 충돌은 저장 시 파일 SHA로 감지해서 경고
- admin 페이지는 noindex
- SheetJS는 CDN 대신 저장소에 파일로 포함하는 것을 우선 검토 (장기 유지보수)

## 알려진 이슈 / 확인 필요

- `templates/contact.html`의 `mailto:info@chemifriend.com`은 **임의로 넣은 주소**. 실제 회사 이메일로 확인 후 교체 필요
- 히어로 아래 영문 슬로건 "With futurism, Environmentally, friendly chemical company"는 회사 공식 문구라 유지 중이지만 문법이 어색함. 변경은 사용자 결정
- 문의 폼 없음 (현재 mailto 링크만)
- CEO 인사말 본문에 "SYNTHOMER(Eastman)", "SOLVAY" 표기가 남아 있음 (사이트 다른 곳은 Synthomer/Syensqo). 대표 명의 문구라 수정은 사용자 결정

### 해결됨 (2026-09-29)
- ENG 링크 숨김 (`base.html`에 Jinja 주석으로 보존 — 영문 페이지 만들면 해제). 깨진 링크 0개
- 히어로 파트너십 수에서 Others 제외 → 4대
- 메인 "온라인 문의하기" → "문의하기" (폼이 없으므로)
- deploy.bat: `py` 우선, 없으면 `python`으로 빌드
- README 명령어 `py`/`py -m pip`로 통일, 시트 수·섹션 번호 정정, build.py 설명 URL 구조 정정
- 디자인 리뉴얼(“AI 템플릿 느낌” 제거) — style.css 전면 교체, 콘텐츠 변경 없음. 모바일 헤더 겹침 해결(메뉴 2줄 배치)

## 개발 환경 / 주의사항

- 사용자 PC: Windows, PowerShell, Python 3.14 (`py` 명령 사용. `pip`는 PATH에 없어서 `py -m pip`)
- **클라우드 동기화 폴더(OneDrive, Google Drive)에서 작업 금지** — 빌드 시 docs/ 삭제가 동기화 잠금과 충돌해 PermissionError 발생했었음. build.py에 재시도 로직은 있음
- Jinja2에서 dict 키 이름으로 `items` 쓰지 말 것 (dict.items 메서드와 충돌 → 이미 `rows`로 바꿈)
- 디자인 변경 후에는 헤드리스 브라우저로 실제 렌더링을 캡처해서 확인할 것.
  이전에 grid stretch로 인한 빈 공간, 메가메뉴 화면 밖 넘침, 섹션 패딩 중복 같은 문제를 스크린샷으로 발견함

## 디자인 원칙 (2026-09-29 리뉴얼)

- 카드 박스(테두리+둥근모서리+그림자) 반복 금지. 구분은 1px 선 + 여백 + 굵은 상단선(2px ink)
- border-radius 0, 그라디언트·glow·글래스 효과·장식 아이콘 없음
- 색은 네이비 + 로고 초록만. 흰 배경 위 작은 초록 글자는 `--green-text`(#4c8200) 사용 (대비)
- 섹션마다 표현 방식 다르게: 히어로(네이비 단색, 큰 타이포, 지표는 선 띠) / 파트너(2+3 에디토리얼 그리드) /
  CEO(2단, 첫 문단 크게) / 조직도(부서별 행 리스트) / 연혁(날짜|내용 2열) / Contact(네이비 면 + 흑백 지도)
- 폰트: Pretendard Variable (jsDelivr, 버전 고정 v1.3.9) — base.html
- 이전 CSS는 루트의 `style.old.css`에 백업 (확정되면 삭제)

## 사용자 선호

- 한국어, 짧고 직접적인 답변. 설명보다 바로 적용
- 디자인은 과감하고 큼직하게. 로고·회사명 크게. 밋밋하거나 관공서 같은 느낌 싫어함
- 회사 업무 중 멀티태스킹하며 작업함 → 확인 요청은 모아서
