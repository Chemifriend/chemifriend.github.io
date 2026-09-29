"""
data/*.json → docs/ 정적 HTML 생성기.

사용법:
    python build.py            빌드 (데이터 검사 → 오류 있으면 중단)
    python build.py --check    검사만

데이터 파일 (관리자 페이지 /admin/ 에서 수정 — admin/admin.js):
    data/company.json          회사정보 (키-값)
    data/history.json          연혁 [{연월, 내용}]
    data/org.json              부서 departments + 직원 people
    data/brands.json           제조사(브랜드) 목록 — 표시 순서 = 파일 순서
    data/products/<브랜드id>.json  제품군 → 소그룹 → 제품

URL 규칙 (id는 한 번 정하면 바꾸지 않는다 — 바꾸면 기존 링크·검색 색인이 깨짐):
    product/<브랜드id>/index.html
    product/<브랜드id>/<제품군id>/index.html
    product/<브랜드id>/<제품군id>/<제품id>.html

배포: main 브랜치에 push → GitHub Actions(.github/workflows/deploy.yml)가 이 파일을 실행해 Pages에 배포.
검사에서 오류가 나면 빌드가 실패하고, 사이트는 직전 정상 버전이 그대로 유지된다.
"""
import json
import os
import re
import shutil
import stat
import sys
import time
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

ROOT = Path(__file__).parent
DATA = ROOT / "data"
TEMPLATES_DIR = ROOT / "templates"
STATIC_DIR = ROOT / "static"
DOCS_DIR = ROOT / "docs"
SITE_URL = "https://chemifriend.com"
ID_RE = re.compile(r"^[a-z0-9가-힣]+(?:-[a-z0-9가-힣]+)*$")
EMAIL_RE = re.compile(r"^[^@\s,]+@[^@\s,]+\.[a-z]{2,}$", re.I)
COMPANY_REQUIRED = ["회사명", "영문명", "대표자", "주소", "전화"]


# ---------------------------------------------------------------- 공용 유틸
def slugify(text: str) -> str:
    """새 id를 만들 때 쓰는 규칙 (관리자 페이지도 같은 규칙 사용)."""
    text = re.sub(r"[^a-zA-Z0-9가-힣]+", "-", text).strip("-")
    return text.lower() or "item"


def _force_remove_readonly(func, path, exc_info):
    try:
        os.chmod(path, stat.S_IWRITE)
        func(path)
    except Exception:
        pass


def safe_rmtree(path: Path, retries: int = 5, delay: float = 0.5):
    """윈도우/동기화 폴더 잠금으로 삭제가 막힐 때 재시도."""
    for _ in range(retries):
        if not path.exists():
            return
        shutil.rmtree(path, onerror=_force_remove_readonly)
        if not path.exists():
            return
        time.sleep(delay)


def image_size(path: Path):
    """PNG/JPEG 가로·세로 (외부 라이브러리 없이). 모르면 None."""
    try:
        data = path.read_bytes()
    except OSError:
        return None
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")
    if data[:2] == b"\xff\xd8":
        i = 2
        while i < len(data) - 9:
            if data[i] != 0xFF:
                i += 1
                continue
            marker, seg = data[i + 1], int.from_bytes(data[i + 2:i + 4], "big")
            if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                return int.from_bytes(data[i + 7:i + 9], "big"), int.from_bytes(data[i + 5:i + 7], "big")
            i += 2 + seg
    return None


LOGO_AREA, LOGO_MAX_W = 8000, 250  # 로고 면적을 비슷하게 맞춰 가로로 긴 로고/짧은 로고의 무게감을 통일


def logo_height(filename: str) -> int:
    """로고 표시 높이(px, 기준 크기). 템플릿에서 --lh 변수로 쓰고 위치별로 배율을 곱한다."""
    size = image_size(STATIC_DIR / "logos" / filename) if filename else None
    if not size or not size[1]:
        return 48
    aspect = size[0] / size[1]
    h = (LOGO_AREA / aspect) ** 0.5
    if h * aspect > LOGO_MAX_W:
        h = LOGO_MAX_W / aspect
    return round(h)


def read_json(rel):
    return json.loads((DATA / rel).read_text(encoding="utf-8"))


# ---------------------------------------------------------------- 로드
def load_data():
    brands = read_json("brands.json")
    for b in brands:
        f = DATA / "products" / f"{b['id']}.json"
        b["제품군"] = json.loads(f.read_text(encoding="utf-8"))["제품군"] if f.exists() else []
    return {
        "company": read_json("company.json"),
        "history": read_json("history.json"),
        "org": read_json("org.json"),
        "brands": brands,
    }


# ---------------------------------------------------------------- 검사
def validate(d):
    """(errors, warnings) 반환. errors가 하나라도 있으면 빌드하지 않는다."""
    E, W = [], []
    c = d["company"]
    for k in COMPANY_REQUIRED:
        if not str(c.get(k, "")).strip():
            E.append(f"회사정보: '{k}' 비어 있음")

    for i, h in enumerate(d["history"], 1):
        if not re.match(r"^\d{4}\.\d{2}$", str(h.get("연월", ""))):
            E.append(f"연혁 {i}번째: 연월 '{h.get('연월')}' — YYYY.MM 형식이어야 함")
        if not str(h.get("내용", "")).strip():
            E.append(f"연혁 {i}번째: 내용 비어 있음")

    dept_ids = [x["id"] for x in d["org"]["departments"]]
    person_ids = []
    for x in d["org"]["departments"]:
        if not ID_RE.match(x["id"]):
            E.append(f"부서 id '{x['id']}' — 영문 소문자·숫자·하이픈만")
        if not x.get("이름(한글)") and not x.get("이름(영문)"):
            E.append(f"부서 '{x['id']}': 이름 비어 있음")
    for p in d["org"]["people"]:
        who = p.get("이름(한글)") or p.get("id")
        person_ids.append(p.get("id"))
        if p.get("부서") not in dept_ids:
            E.append(f"직원 {who}: 부서 '{p.get('부서')}'가 부서 목록에 없음")
        if not p.get("이름(한글)"):
            E.append(f"직원 {p.get('id')}: 한글 이름 비어 있음")
        email = p.get("이메일(공개)", "")
        if email and not EMAIL_RE.match(email):
            E.append(f"직원 {who}: 이메일 형식 오류 '{email}'")
        if re.search(r"01[0-9][-\s]?\d{3,4}[-\s]?\d{4}", json.dumps(p, ensure_ascii=False)):
            E.append(f"직원 {who}: 휴대전화 번호로 보이는 값이 있음 — 공개 저장소이므로 입력 금지")
    for dup in {x for x in dept_ids if dept_ids.count(x) > 1}:
        E.append(f"부서 id 중복: {dup}")
    for dup in {x for x in person_ids if person_ids.count(x) > 1}:
        E.append(f"직원 id 중복: {dup}")

    brand_ids = [b["id"] for b in d["brands"]]
    for dup in {x for x in brand_ids if brand_ids.count(x) > 1}:
        E.append(f"제조사 id 중복: {dup}")
    for b in d["brands"]:
        name = b.get("회사명") or b["id"]
        if not ID_RE.match(b["id"]):
            E.append(f"제조사 '{name}': id '{b['id']}' — 영문 소문자·숫자·하이픈만")
        if not b.get("회사명"):
            E.append(f"제조사 id '{b['id']}': 회사명 비어 있음")
        if b.get("로고") and not (STATIC_DIR / "logos" / b["로고"]).exists():
            E.append(f"제조사 {name}: 로고 파일 static/logos/{b['로고']} 없음")
        for c_ in b.get("문의담당", []):
            if c_.get("사람") not in person_ids:
                E.append(f"제조사 {name}: 문의담당 '{c_.get('사람')}'가 직원 목록에 없음")
        if b.get("노출") and not b.get("문의담당") and not b.get("문의_영업팀전체"):
            W.append(f"제조사 {name}: 문의 담당자 없음")
        fam_ids = [f["id"] for f in b["제품군"]]
        for dup in {x for x in fam_ids if fam_ids.count(x) > 1}:
            E.append(f"{name}: 제품군 id 중복 '{dup}'")
        for f in b["제품군"]:
            where = f"{name} > {f.get('이름') or f['id']}"
            if not ID_RE.match(f["id"]):
                E.append(f"{where}: 제품군 id '{f['id']}' 형식 오류")
            if not f.get("이름"):
                E.append(f"{where}: 제품군 이름 비어 있음")
            item_ids = []
            for g in f["소그룹"]:
                cols = g.get("스펙항목", [])
                for dup in {x for x in cols if cols.count(x) > 1}:
                    E.append(f"{where}: 스펙항목 중복 '{dup}'")
                for it in g["제품"]:
                    item_ids.append(it.get("id"))
                    if not str(it.get("품명", "")).strip():
                        E.append(f"{where}: 품명 비어 있는 제품 (id {it.get('id')})")
                    if not ID_RE.match(str(it.get("id", ""))):
                        E.append(f"{where} > {it.get('품명')}: 제품 id '{it.get('id')}' 형식 오류")
                    extra = [k for k in it.get("스펙", {}) if k not in cols]
                    if extra:
                        E.append(f"{where} > {it.get('품명')}: 스펙항목에 없는 값 {extra}")
            for dup in {x for x in item_ids if item_ids.count(x) > 1}:
                E.append(f"{where}: 제품 id 중복 '{dup}' (URL 충돌)")
    return E, W


# ---------------------------------------------------------------- 화면용 가공
def prepare(d):
    people = {p["id"]: dict(p, 담당브랜드=[]) for p in d["org"]["people"]}
    public_emails = [p["이메일(공개)"] for p in people.values() if p.get("이메일(공개)")]

    brands = [b for b in d["brands"] if b.get("노출", True)]
    for b in brands:
        contacts = []
        for c in b.get("문의담당", []):
            person = people[c["사람"]]
            contacts.append(dict(person, **{"분야(한글)": c.get("분야(한글)", ""), "분야(영문)": c.get("분야(영문)", "")}))
            person["담당브랜드"].append(b["회사명"] + (f" · {c['분야(영문)']}" if c.get("분야(영문)") else ""))
        if b.get("문의_영업팀전체"):
            contacts.append({"전체": True, "이메일목록": ",".join(public_emails)})
        b["contacts"] = contacts
        b["요약"] = b.get("제품요약") or ", ".join(f["이름"] for f in b["제품군"])
        b["로고h"] = logo_height(b.get("로고", ""))

    departments = []
    for dept in d["org"]["departments"]:
        members = [p for p in people.values() if p["부서"] == dept["id"]]
        desc = dept.get("설명", "")
        if not desc:
            seen = []
            for m in members:
                for label in m["담당브랜드"]:
                    n = label.split(" · ")[0]
                    if n not in seen:
                        seen.append(n)
            desc = " · ".join(seen)
        departments.append(dict(dept, 설명=desc, 인원=members))

    history = d["history"]
    founded_year = history[0]["연월"][:4] if history else ""
    iso_label = "ISO 9001" if any("ISO 9001" in h["내용"] for h in history) else ""
    stats = {
        "founded_year": founded_year,
        "partner_count": sum(1 for b in brands if not b.get("기타묶음")),
        "spec_count": sum(len(g["제품"]) for b in brands for f in b["제품군"] for g in f["소그룹"]),
        "iso_label": iso_label,
    }
    return {"company": d["company"], "history": history, "departments": departments, "brands": brands, "stats": stats}


# ---------------------------------------------------------------- 렌더링
def build():
    d = load_data()
    errors, warnings = validate(d)
    for w in warnings:
        print(f"[주의] {w}")
    if errors:
        print(f"\n[오류] {len(errors)}건 — 빌드를 중단합니다. (사이트는 직전 버전 유지)")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)
    if "--check" in sys.argv:
        print("검사 통과")
        return

    v = prepare(d)
    safe_rmtree(DOCS_DIR)
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copytree(STATIC_DIR, DOCS_DIR / "static", dirs_exist_ok=True)
    shutil.copytree(ROOT / "admin", DOCS_DIR / "admin", dirs_exist_ok=True)  # 관리자 페이지 /admin/ (noindex, sitemap 제외)

    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))
    common = dict(
        company=v["company"], brands=v["brands"], stats=v["stats"],
        meta_keywords="케미프렌드,Chemifriend,Cabot,Carbon black,Synthomer,Arkema,Syensqo,화학원료 유통",
    )
    sitemap_urls = []

    def render(template_name, rel_path, base_path, active, title, description, **extra):
        html = env.get_template(template_name).render(
            base_path=base_path, active=active, page_title=title, meta_description=description,
            canonical_url=f"{SITE_URL}/{rel_path}", **common, **extra,
        )
        out = DOCS_DIR / rel_path
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(html, encoding="utf-8")
        sitemap_urls.append(rel_path)

    c = v["company"]
    render("index.html", "index.html", "", "main", "Main",
           f"{c.get('회사명', '')} 공식 홈페이지. {c.get('슬로건', '')}",
           history=v["history"], departments=v["departments"])
    render("product_hub.html", "product.html", "", "product", "Product", "케미프렌드 취급 브랜드 안내")

    for b in v["brands"]:
        render("brand.html", f"product/{b['id']}/index.html", "../../", "product",
               b["회사명"], f"{b['회사명']} 취급 제품군 안내", brand=b)
        for f in b["제품군"]:
            render("product_family.html", f"product/{b['id']}/{f['id']}/index.html", "../../../", "product",
                   f"{f['이름']} — {b['회사명']}", f"{b['회사명']} {f['이름']} 제품 스펙", brand=b, family=f)
            for g in f["소그룹"]:
                for it in g["제품"]:
                    render("product_sku.html", f"product/{b['id']}/{f['id']}/{it['id']}.html", "../../../", "product",
                           f"{it['품명']} — {b['회사명']} {f['이름']}", f"{it['품명']} 스펙 — {b['회사명']} {f['이름']}",
                           brand=b, family=f, group=g, item=it)

    render("contact.html", "contact.html", "", "contact", "Contact", "케미프렌드 오시는 길 및 문의처 안내")

    (DOCS_DIR / "CNAME").write_text("chemifriend.com\n", encoding="utf-8")
    entries = "\n".join(f"  <url><loc>{SITE_URL}/{u}</loc></url>" for u in sitemap_urls)
    (DOCS_DIR / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{entries}\n</urlset>\n", encoding="utf-8")
    (DOCS_DIR / "robots.txt").write_text(
        f"User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: {SITE_URL}/sitemap.xml\n", encoding="utf-8")
    print(f"빌드 완료 → {DOCS_DIR} (페이지 {len(sitemap_urls)}개, sitemap.xml 포함)")


if __name__ == "__main__":
    build()
