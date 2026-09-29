"""운영설명서.md → A4 인쇄용 PDF (표지 + 목차 + 장마다 새 페이지 + 메모 여백)

사용법 (운영설명서.md를 고친 뒤 PDF도 다시 만들 때):
    pip install markdown playwright && playwright install chromium
    python tools/make_manual_pdf.py 운영설명서.md 운영설명서.pdf
한글 글꼴: Noto Sans CJK KR (없으면 시스템 기본 글꼴로 대체됨)
"""
import re, sys, datetime
from pathlib import Path
import markdown
from playwright.sync_api import sync_playwright

src, out = Path(sys.argv[1]), Path(sys.argv[2])
md = src.read_text(encoding='utf-8')

# mermaid 흐름도 → 인쇄용 상자 그림
flow = '''<div class="flow">
<div class="box">관리자 페이지에서 수정<br><small>또는 Claude가 수정</small></div><div class="arr">→</div>
<div class="box">GitHub 창고<br><small>변경 기록 남음</small></div><div class="arr">→</div>
<div class="box">GitHub Actions<br><small>검사 + 홈페이지 생성</small></div><div class="arr">→</div>
<div class="box em">홈페이지 공개<br><small>1~2분 뒤</small></div>
</div>
<p class="flow-note">방문자가 chemifriend.com 입력 → DNS(안내 데스크)가 GitHub Pages로 안내 → 홈페이지 표시</p>'''
md = re.sub(r"```mermaid.*?```", flow, md, flags=re.S)
# GitHub식 마크다운 → python-markdown 보정: 목록 앞 빈 줄, 들여쓴 하위 목록(3칸→4칸)
lines, fixed, in_code = md.split('\n'), [], False
is_item = lambda l: re.match(r'^\s*([-*]|\d+\.)\s', l)
for l in lines:
    if l.startswith('```'): in_code = not in_code
    if not in_code:
        m = re.match(r'^( {2,3})([-*]|\d+\.)\s', l)
        if m: l = '    ' + l.lstrip(' ')
        if is_item(l) and fixed and fixed[-1].strip() and not is_item(fixed[-1]) and not fixed[-1].startswith('    '):
            fixed.append('')
    fixed.append(l)
md = '\n'.join(fixed)

# 제목(h1)과 첫 안내는 표지로
title = re.search(r'^# (.+)$', md, re.M).group(1)
md = re.sub(r'^# .+\n', '', md, count=1, flags=re.M)
md = md.replace('\n---\n', '\n')  # 구분선은 페이지 나눔으로 대체
body = markdown.markdown(md, extensions=['tables', 'fenced_code', 'sane_lists'])

# 목차
heads = re.findall(r'<h2>(.*?)</h2>', body)
toc = ''.join(f'<li>{h}</li>' for h in heads)
# 첫 h2 이전(요약 안내)은 목차 뒤에 붙이고, 각 h2는 새 페이지
intro, rest = body.split('<h2>', 1)
rest = '<h2>' + rest
rest = rest.replace('<h2>', '<section class="chap"><h2>').replace('<section class="chap"><h2>', '</section><section class="chap"><h2>')
rest = rest.replace('</section>', '', 1) + '</section>'

today = datetime.date.today().strftime('%Y. %m. %d.')
html = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
@page {{ size: A4; margin: 18mm 30mm 20mm 20mm; }}
* {{ box-sizing: border-box; }}
body {{ font-family: "Noto Sans CJK KR", sans-serif; font-size: 10.3pt; line-height: 1.85; color: #1c2533; word-break: keep-all; margin: 0; }}
.cover {{ height: 245mm; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; border-left: 4mm solid #6aac00; padding: 8mm 0 0 12mm; }}
.cover .top {{ font-size: 10pt; letter-spacing: .2em; color: #4c8200; font-weight: 700; }}
.cover h1 {{ font-size: 30pt; line-height: 1.3; margin: 0 0 6mm; color: #0f1c2e; letter-spacing: -0.02em; }}
.cover .sub {{ font-size: 12pt; color: #4a5667; }}
.cover .meta {{ font-size: 10pt; color: #667385; line-height: 2; }}
.cover .meta b {{ color: #0f1c2e; display: inline-block; width: 26mm; }}
.toc {{ page-break-after: always; }}
.toc h2, .chap h2 {{ font-size: 17pt; color: #0f1c2e; border-bottom: 1.2pt solid #0f1c2e; padding-bottom: 2mm; margin: 0 0 6mm; }}
.toc ol {{ list-style: none; padding: 0; font-size: 12pt; line-height: 2.4; }}
.toc li {{ border-bottom: .5pt dotted #b8c2cf; }}
.intro {{ margin-top: 8mm; padding: 4mm 5mm; background: #f5f7f9; border-left: 1.2mm solid #6aac00; font-size: 9.8pt; }}
.intro ul {{ margin: 0; padding-left: 5mm; }}
.chap {{ page-break-before: always; }}
h3 {{ font-size: 12.5pt; color: #0f1c2e; margin: 7mm 0 2mm; padding-left: 2.5mm; border-left: 1mm solid #6aac00; page-break-after: avoid; }}
p {{ margin: 0 0 2.5mm; }}
ul, ol {{ margin: 0 0 3mm; padding-left: 6mm; }}
li {{ margin: .6mm 0; }}
strong {{ color: #0f1c2e; }}
code {{ font-family: "Noto Sans Mono CJK KR", monospace; font-size: 9pt; background: #eef2f6; padding: .2mm 1.2mm; }}
pre {{ background: #f5f7f9; border: .5pt solid #d6dde5; padding: 3mm 4mm; white-space: pre-wrap; font-size: 9pt; line-height: 1.7; page-break-inside: avoid; }}
pre code {{ background: none; padding: 0; }}
blockquote {{ margin: 3mm 0; padding: 2.5mm 4mm; background: #fff8e8; border-left: 1mm solid #d49a00; font-size: 9.6pt; page-break-inside: avoid; }}
blockquote p {{ margin: 0; }}
table {{ width: 100%; border-collapse: collapse; margin: 2mm 0 4.5mm; font-size: 9.3pt; line-height: 1.6; }}
thead {{ display: table-header-group; }}
tr {{ page-break-inside: avoid; }}
th {{ background: #eef2f6; text-align: left; font-weight: 700; color: #0f1c2e; }}
th, td {{ border: .5pt solid #c9d2dc; padding: 1.6mm 2.4mm; vertical-align: top; }}
a {{ color: #1c2533; text-decoration: none; }}
.flow {{ display: flex; align-items: center; gap: 2mm; margin: 4mm 0 2mm; page-break-inside: avoid; }}
.flow .box {{ flex: 1; border: .8pt solid #0f2b48; padding: 3mm 2mm; text-align: center; font-weight: 700; font-size: 9.5pt; line-height: 1.5; }}
.flow .box small {{ font-weight: 400; color: #667385; font-size: 8.3pt; }}
.flow .box.em {{ background: #0f2b48; color: #fff; }}
.flow .box.em small {{ color: #c3cedb; }}
.flow .arr {{ font-size: 14pt; color: #6aac00; font-weight: 700; }}
.flow-note {{ font-size: 9pt; color: #667385; }}
.memo {{ margin-top: 6mm; page-break-inside: avoid; }}
.memo div {{ height: 9mm; border-bottom: .5pt solid #c9d2dc; }}
.memo span {{ font-size: 8.5pt; color: #8a95a3; letter-spacing: .1em; }}
</style></head><body>
<div class="cover">
  <div>
    <div class="top">CHEMIFRIEND CORP.</div>
    <h1 style="margin-top:40mm">{title}</h1>
    <div class="sub">홈페이지를 처음 맡은 분을 위한 안내서<br>개념 · 관리자 페이지 · Claude(AI)로 수정 · 문제 해결 · 연간 할 일</div>
  </div>
  <div class="meta">
    <div><b>홈페이지</b>https://chemifriend.com</div>
    <div><b>관리자 페이지</b>https://chemifriend.com/admin/</div>
    <div><b>최신 설명서</b>github.com/Chemifriend/chemifriend.github.io → 운영설명서.md</div>
    <div><b>인쇄일</b>{today}</div>
  </div>
</div>
<div class="toc"><h2>목차</h2><ol>{toc}</ol><div class="intro">{intro}</div></div>
{rest}
</body></html>'''

# 각 장 끝에 메모 줄
memo = '<div class="memo"><span>메모</span>' + '<div></div>' * 6 + '</div>'
html = html.replace('</section>', memo + '</section>')

tmp = out.with_suffix('.html'); tmp.write_text(html, encoding='utf-8')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.goto(f'file://{tmp}'); pg.wait_for_timeout(300)
    pg.pdf(path=str(out), format='A4', print_background=True, prefer_css_page_size=True,
           display_header_footer=True, header_template='<div></div>',
           footer_template='<div style="width:100%;font-size:7.5pt;color:#8a95a3;font-family:Noto Sans CJK KR;padding:0 20mm;display:flex;justify-content:space-between">'
                           '<span>케미프렌드 홈페이지 운영설명서</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>')
    b.close()
print('ok', out)
