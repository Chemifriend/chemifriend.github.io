# 케미프렌드 홈페이지

(주)케미프렌드 공식 홈페이지 — https://chemifriend.com
GitHub Pages로 무료 운영하며, 내용은 `data/` 폴더의 JSON 파일에 들어 있습니다.

## 내용 수정 (담당자용)

### 관리자 페이지: https://chemifriend.github.io/admin/
(도메인 연결 후에는 https://chemifriend.com/admin/)

1. 처음 한 번: 접속 키(토큰) 입력 — 발급 방법은 로그인 화면에 나옵니다
2. 왼쪽 메뉴(회사정보·연혁·조직도·제조사·제품)에서 수정
   - 제품 표는 엑셀처럼 칸을 눌러 수정. 엑셀에서 여러 칸을 복사해 붙여넣기 가능
3. 오른쪽 위 **[변경 확인·반영]** → 바뀐 내용 확인 → **[사이트에 반영]**
4. 1~2분 뒤 사이트에 반영 (상단에 진행 상태 표시)

- 입력 오류(필수값 누락, 휴대폰 번호 입력 등)가 있으면 반영 버튼이 잠깁니다
- 잘못 반영했다면 **[버전 기록 · 복구]** 에서 이전 시점으로 되돌리기
- 반영 전이면 **[변경 취소]** 로 전부 되돌리기
- 담당자가 바뀌면: 로그아웃 → GitHub에서 기존 토큰 삭제 → 새 담당자가 새 토큰 발급

### 토큰 발급 (관리 담당자, 1년에 한 번)
GitHub `Chemifriend` 계정 로그인 → https://github.com/settings/personal-access-tokens/new
- Repository access: **Only select repositories** → `chemifriend.github.io`
- Permissions: **Contents: Read and write**, **Actions: Read-only**
- Expiration: 최대 1년 → 만료되면 관리자 페이지가 새 토큰을 요구함

### 관리자 페이지 없이 고칠 때
GitHub 저장소에서 `data/` 파일을 열어 연필 아이콘으로 수정 → Commit changes. 오류가 있으면 빌드가 실패하고 사이트는 직전 버전 유지 (Actions 탭 로그에 원인 표시)

| 파일 | 내용 |
|---|---|
| `data/company.json` | 회사명, 주소, 전화, CEO 인사말 등 |
| `data/history.json` | 연혁 |
| `data/org.json` | 부서와 직원 (전화번호는 절대 넣지 마세요 — 공개 저장소) |
| `data/brands.json` | 제조사(브랜드) 소개, 로고, 문의 담당자 |
| `data/products/<브랜드>.json` | 제품군·제품 스펙표 |

> `id` 값은 페이지 주소(URL)입니다. 이름을 바꾸더라도 `id`는 그대로 두세요.

## 구조 (개발 담당자용)

```
data/          콘텐츠 원본 (JSON)
admin/         관리자 페이지 (index.html + admin.js + admin.css, 프레임워크 없음) → /admin/ 로 배포
templates/     화면 틀 (Jinja2)
static/        style.css, logos/
build.py       데이터 검사 → docs/ 에 HTML 생성
.github/workflows/deploy.yml   main에 push되면 build.py 실행 → Pages 배포
```

로컬 미리보기: `py -m pip install -r requirements.txt` → `py build.py` → `docs/index.html` 열기
검사만: `py build.py --check`

## 최초 1회 설정 (완료됨 — 기록용)

1. 저장소 Settings → Pages → Source: **GitHub Actions**
2. 도메인 연결 시: Settings → Pages → Custom domain `chemifriend.com` → DNS 확인 후 **Enforce HTTPS**
3. 도메인 등록업체 DNS:
   - `A` 레코드 4개: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` 레코드: `www` → `chemifriend.github.io`
4. 전환 확인 후 기존 호스팅 해지

## 참고

- **Synthomer**: 2022년 Eastman 접착수지 사업부(Hydrocarbon Resin, APAO, Rosin)가 Synthomer로 매각됨. 취급 품목 전부 Synthomer 소속 (제품명의 Eastoflex·Aerafin 등은 브랜드명)
- **Syensqo**: 2023년 Solvay에서 분사. 내부 id는 기존 `solvay` 유지
- **검색 노출**: sitemap.xml·robots.txt·canonical은 자동 생성. 실제 노출은 도메인 연결 후 Google Search Console에 사이트 등록 + sitemap 제출 필요
