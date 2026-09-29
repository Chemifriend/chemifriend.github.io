# CLAUDE.md — 케미프렌드 홈페이지 프로젝트 인수인계

이 파일은 Claude Code가 이 폴더를 열 때 자동으로 읽는 맥락 문서입니다.
사람용 사용 설명서는 `README.md`를 보세요.

## 프로젝트 개요

- 회사: (주)케미프렌드 (Chemifriend Corp.) — 2002년 설립, 스페셜티 케미칼 유통사.
  Cabot / Synthomer / Arkema / Syensqo 등의 한국 대리점
- 목표: 기존 chemifriend.com(그누보드 기반, 유료 호스팅 연 20~30만원)을
  **GitHub Pages 무료 정적 사이트**로 교체
- 최초 제작: 백승헌 (영업1팀 과장). 비개발자 담당자들도 쉽게 수정할 수 있어야 하고,
  후임자가 이해하기 쉬운 구조여야 함

## 현재 상태 (2026-09 기준)

완료:
- 기존 사이트 콘텐츠 전체 이식 (회사정보, CEO 인사말, 연혁, 조직도, 사업영역)
- 기존 Product 게시판 스크래핑 → 제품 572개 (현재 data/products/*.json)
- 4단 구조 정적 사이트 생성: 메인 / Product 허브 / 브랜드 / 제품군 스펙표 / 개별 제품(SKU) — 총 598페이지
- 디자인: 로고 초록 `#6aac00` 포인트 + 다크 네이비. 헤더 메가메뉴(브랜드 → 제품군)
- SEO: 페이지별 title/description, canonical, sitemap.xml, robots.txt 자동 생성

**아직 안 한 것 (= 다음 작업):**
1. GitHub Pages 배포 — 저장소·워크플로우 준비 완료, 사용자 push 대기 (아래 "배포 구조")
2. ~~관리자 페이지~~ 완료 (편집·로고 트리밍·변경요약·검사·반영·버전 복구·배포 상태·제품군 엑셀 내려받기/불러오기·전체 백업). 실사용 피드백 반영 단계
3. 도메인 DNS 전환 → 확인 후 기존 호스팅 해지
4. Google Search Console 등록 + sitemap 제출

## 폴더 구조

```
data/                  콘텐츠 원본 (JSON) — 관리자 페이지가 이 파일들을 커밋
  company.json         회사정보 키-값 (CEO_인사말_본문은 빈 줄 두 개로 문단 구분)
  history.json         연혁 [{연월 YYYY.MM, 내용}]
  org.json             departments[{id, 이름(영문), 이름(한글), 설명}] + people[{id, 부서, 이름(한글/영문), 직급(/영문), 구분, 담당분야, 이메일(공개)}]
  brands.json          제조사 [{id, 회사명, 로고, 노출, 기타묶음, 국가, 설립연도, 영문슬로건, 한국어소개, 제품요약, 문의_영업팀전체, 문의담당[{사람, 분야(한글), 분야(영문)}]}]
  products/<브랜드id>.json  {제품군: [{id, 이름, 소그룹: [{이름, 스펙항목[], 제품: [{id, 품명, 용도, 스펙{항목: 값}}]}]}]}
admin/                 관리자 페이지 (vanilla JS, 빌드 도구 없음) → build.py가 docs/admin/으로 복사
  admin.js             GitHub API로 data/*.json·static/logos/ 를 한 커밋으로 저장 (Git Data API: blobs→tree→commit→ref)
                       검사 규칙은 build.py validate()와 맞출 것. 복구 = 과거 커밋의 data/ 트리로 새 커밋
  vendor/xlsx.full.min.js  SheetJS 0.18.5 (Apache-2.0, 저장소에 포함 — CDN 의존 없음). 엑셀 기능 처음 쓸 때만 로드
                       제품군 엑셀: 시트=소그룹, 1행=품명|Application|스펙…|ID(수정금지). 모든 칸 텍스트 형식(날짜 자동변환 방지)
                       불러오기 매칭: ID → 품명 순. 엑셀에 없는 기존 제품은 기본 유지(원래 자리), 체크 시 삭제
templates/             Jinja2 템플릿
static/                style.css, logos/
build.py               검사(validate) → 가공(prepare) → docs/ 생성. `--check`는 검사만
.github/workflows/     deploy.yml — main push 시 Actions가 build.py 실행 → Pages 배포
deploy.bat             로컬 검사 후 git push (관리자 페이지 생기면 폐기)
docs/                  빌드 결과물 (.gitignore)
```

- **id 규칙**: 브랜드·제품군·제품 id = URL. 한 번 정하면 바꾸지 않음 (이름을 바꿔도 id 유지). 형식은 소문자·숫자·한글·하이픈
- 표시 순서 = JSON 배열 순서
- 노출 false 제조사는 페이지 자체를 만들지 않음 (데이터 보존 = 소프트 삭제)
- 기타묶음 true(Others)는 로고 없이 이름 표시, 히어로 "글로벌 파트너십" 수에서 제외
- 스펙항목에 없는 키를 제품 스펙에 넣으면 검사 오류
- **data/는 공개 저장소 → 전화번호·비공개 이메일 금지** (검사에서 휴대폰 번호 패턴 차단). 이메일은 노출 대상(남성 영업직)만
- 직급 영문: 대표이사 CEO / 부사장 Vice President / 이사 Director / 부장 General Manager / 차장 Deputy General Manager / 과장 Manager / 대리 Assistant Manager
- 2026-09-29 content.xlsx → JSON 이전 완료 (xlsx·scrape_products.py는 git 이력에만 남음). 이전 전후 HTML 동일 검증함

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
- DNS 전환 전까지는 https://chemifriend.github.io 로 확인. chemifriend.com은 아직 기존 닷홈 호스팅(112.175.184.61) — 2026-09 기준 닷홈 안내 페이지만 뜸(호스팅 끊김 추정)
- 도메인: 등록기관 닷네임코리아(닷홈), 만료 2027-07-12, 네임서버 ns1~3.dothome.co.kr → DNS 변경은 닷홈 관리 화면에서
- 계정 리스크: GitHub 계정 이메일이 shbaek@chemifriend.com (개인 업무메일) → 공용 메일로 변경 + 2FA 복구코드 회사 보관 필요
- 줄바꿈: .gitattributes로 LF 고정, .bat만 CRLF

## 확정된 다음 방향: GitHub만 쓰는 관리자 페이지

사용자 결정 사항:
- 구글 시트·구글 드라이브·Supabase 등 **외부 서비스 없이 GitHub만** 사용
- `chemifriend.com/admin` 관리자 페이지에서 수정
- 대량 데이터는 **xlsx 양식 내려받기 / 불러오기**, 세부 수정은 **화면 UI**로
- 제조사도 추가·수정·삭제 가능해야 함

설계안 (사용자와 합의한 내용):
- ~~데이터 원본을 JSON(`data/`)으로 이전~~ 완료 (2026-09-29)
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

- 히어로 아래 영문 슬로건 "With futurism, Environmentally, friendly chemical company"는 회사 공식 문구라 유지 중이지만 문법이 어색함. 변경은 사용자 결정
- 문의 폼 없음 (현재 mailto 링크만)
- Others > "Global Trading Partner & Other Supplier" 표: 스크래핑 때 열이 밀림 (이름 없는 열, 첫 행에 섹션명+데이터 섞임). 사용자 확인 후 정리 필요 — 관리자 검사에서는 "주의"로만 표시
- CEO 인사말 본문에 "SYNTHOMER(Eastman)", "SOLVAY" 표기가 남아 있음 (사이트 다른 곳은 Synthomer/Syensqo). 대표 명의 문구라 수정은 사용자 결정

### 해결됨 (2026-09-29)
- 영문 사이트 완성(2026-09-29) — ENG/KOR 토글, 깨진 링크 0개
- 히어로 파트너십 수에서 Others 제외 → 4대
- 메인 "온라인 문의하기" → "문의하기" (폼이 없으므로)
- deploy.bat: `py` 우선, 없으면 `python`으로 빌드
- README 명령어 `py`/`py -m pip`로 통일, 시트 수·섹션 번호 정정, build.py 설명 URL 구조 정정
- Contact 페이지의 임의 주소(info@) 버튼 제거 → 브랜드별 문의 담당 목록으로 대체
- 조직도 개편(2026-09 명단, 한/영 병기, 영업3팀 폐지, CS는 영업팀 소속 표기)
- 메인 히어로 버튼 2개 삭제 (사용자 결정)
- 디자인 리뉴얼(“AI 템플릿 느낌” 제거) — style.css 전면 교체, 콘텐츠 변경 없음. 모바일 헤더 겹침 해결(메뉴 2줄 배치)

## 개발 환경 / 주의사항

- 최초 제작자 PC: Windows, PowerShell, Python 3.14 (`py` 명령 사용. `pip`는 PATH에 없어서 `py -m pip`). claude.ai/code 클라우드에서는 `python` 사용
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
- 로고: 투명 여백 없이 트리밍된 PNG. 표시 크기는 build.py logo_height()가 가로세로비로 계산(면적 통일) → 템플릿 style="--lh:N", CSS에서 위치별 배율. 흰 배경 박힌 로고는 투명 처리 필요(Syensqo 사례)
- 사람 표기: 1줄 한글(이름 + 직급), 2줄 영문(Name · Title). 영문 사이트는 순서 반대

## 영문 사이트 (/en/)

- build.py가 같은 템플릿으로 ko(루트)와 en(/en/)을 모두 생성. 화면 고정 문구는 build.py `UI` 사전(ko/en), 데이터 영문은 "(영문)" 키: company `대표자(영문)`·`CEO_인사말_제목(영문)`·`CEO_인사말_본문(영문)`, history `내용(영문)`, brands `소개(영문)`·`제품요약(영문)`
- 영문 값이 비면 한국어로 대체 + 검사에서 '주의' 표시. `localize()`가 언어별 표시용 `_` 키를 붙임 (템플릿은 `_name`, `_title`, `_n1` 등 사용)
- 템플릿 경로: `base_path`=사이트 최상위(정적 파일), `pb`=같은 언어 페이지 기준, `alt_url`=다른 언어의 같은 페이지. hreflang 태그 자동
- 영문 인사말·연혁·브랜드 소개는 Claude 초벌 번역(2026-09-29) — 사용자 검토 필요
- 규칙 유지: Synthomer 영문 소개에도 Eastman 매각 설명 넣지 않음
- 이전 CSS는 루트의 `style.old.css`에 백업 (확정되면 삭제)

## 작업 원칙 (누가 요청하든)

- 한국어, 짧고 직접적인 답변. 설명보다 바로 적용
- 디자인은 과감하고 큼직하게. 로고·회사명 크게. 밋밋하거나 관공서 같은 느낌 지양 (현재 디자인 원칙 섹션 유지)
- 확인 요청은 여러 개를 모아서 한 번에

## 비개발자 담당자와 작업할 때 (claude.ai/code 등)

최초 제작자(백승헌 과장) 이후 담당자는 GitHub·코딩을 모를 수 있음. 사람용 설명서는 `운영설명서.md`.
- 용어는 쉽게 풀어서 설명 (커밋→저장, PR→변경 요청서, merge→합치기)
- **내용 수정(전화번호·직원·제품·제조사)은 관리자 페이지(/admin/)가 더 빠르고 안전하다고 먼저 안내.** 코드 수정은 디자인·기능·구조 변경일 때만
- 변경 후 반드시 `python build.py`로 빌드·검사 통과 확인. 디자인 변경이면 헤드리스 브라우저로 데스크톱·모바일 캡처 확인
- 작업을 브랜치에 올린 뒤에는 반영 방법을 단계별로 안내: ① Create PR ② GitHub에서 초록 [Merge pull request] → [Confirm merge] ③ Actions 탭 초록 체크 확인 ④ 1~2분 후 사이트 새로고침
- data/ JSON의 id는 URL이므로 절대 변경 금지. 전화번호·비공개 이메일 입력 금지 (공개 저장소)
- 비밀번호·토큰을 달라고 하지 말 것 (필요 없음)
- 기능을 바꾸면 `운영설명서.md`와 이 파일도 함께 갱신. 설명서를 고쳤으면 인쇄용 `운영설명서.pdf`도 `python tools/make_manual_pdf.py 운영설명서.md 운영설명서.pdf`로 다시 생성
