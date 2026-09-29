# 케미프렌드 홈페이지

(주)케미프렌드 공식 홈페이지 — https://chemifriend.com
GitHub Pages로 무료 운영하며, 내용은 `data/` 폴더의 JSON 파일에 들어 있습니다.

## 내용 수정 (담당자용)

**관리자 페이지 `/admin`** 에서 수정하는 것이 기본입니다. (제작 중 — 완성되면 이 항목에 사용법 추가)

관리자 페이지 준비 전까지는:
- GitHub 저장소에서 `data/` 안의 파일을 열고 연필 아이콘으로 수정 → **Commit changes**
- 1~2분 뒤 자동 반영. 진행상황은 저장소 **Actions** 탭 (초록 체크 = 성공)
- 입력 오류가 있으면 빌드가 실패하고 **사이트는 직전 정상 버전 그대로** 유지됩니다. Actions 로그에 어느 파일 몇 번째 항목이 문제인지 나옵니다.

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
