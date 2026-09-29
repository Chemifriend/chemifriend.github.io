/* =====================================================================
   케미프렌드 홈페이지 관리자 (admin.js)
   ---------------------------------------------------------------------
   흐름: GitHub API로 data/*.json 읽기 → 화면에서 수정(메모리) →
         [변경 확인·반영] → 검사 → 한 번의 커밋으로 저장 →
         GitHub Actions가 build.py 실행 → 사이트 갱신
   - 토큰: 이 저장소 전용 fine-grained 토큰 (Contents 쓰기, Actions 읽기). 이 PC 브라우저에만 저장
   - 검사 규칙은 build.py validate()와 같게 유지할 것 (최종 판정은 build.py)
   - 섹션: 1 설정/유틸  2 GitHub API  3 데이터 로드·상태  4 id·검사·변경요약
           5 화면(홈/회사정보/연혁/조직도/제조사/제품/버전기록)  5-1 엑셀  6 반영·복구·배포상태  7 시작
   ===================================================================== */
'use strict';

/* ---------- 1. 설정 / 유틸 ---------- */
const CFG = { owner: 'Chemifriend', repo: 'chemifriend.github.io', branch: 'main', api: 'https://api.github.com' };
const TOKEN_KEY = 'cf_admin_token';
const P = {  // 데이터 파일 경로
  company: 'data/company.json', history: 'data/history.json', org: 'data/org.json', brands: 'data/brands.json',
  products: id => `data/products/${id}.json`,
};
const TITLE_EN = { '대표이사': 'CEO', '부사장': 'Vice President', '전무': 'Senior Managing Director', '상무': 'Managing Director',
  '이사': 'Director', '부장': 'General Manager', '차장': 'Deputy General Manager', '과장': 'Manager', '대리': 'Assistant Manager', '주임': 'Associate', '사원': 'Staff' };
const COMPANY_FIELDS = [  // 회사정보 입력 화면 정의 — 항목 추가 시 여기에 한 줄 (build.py/템플릿에서도 사용해야 화면에 나옴)
  { key: '회사명', label: '회사명', help: '사이트 상단·하단에 표시', req: true },
  { key: '영문명', label: '영문 회사명', req: true },
  { key: '대표자', label: '대표자', req: true },
  { key: '대표자(영문)', label: '대표자 (영문)', help: '영문 사이트용 (예: Jong Won JUNG)' },
  { key: '사업자등록번호', label: '사업자등록번호' },
  { key: '주소', label: '주소', req: true },
  { key: '영문주소', label: '영문 주소' },
  { key: '전화', label: '대표전화', req: true },
  { key: '팩스', label: '팩스' },
  { key: '슬로건', label: '영문 슬로건', help: '메인 첫 화면 제목 아래 작은 글씨' },
  { key: 'CEO_인사말_제목', label: 'CEO 인사말 제목', help: '메인 첫 화면 큰 제목으로도 쓰임' },
  { key: 'CEO_인사말_본문', label: 'CEO 인사말 본문', type: 'textarea', help: '문단 사이에 빈 줄 한 줄. 첫 문단은 크게 표시됩니다' },
  { key: 'CEO_인사말_제목(영문)', label: 'CEO 인사말 제목 (영문)', help: '영문 사이트 첫 화면 큰 제목. "Chemifriend" 글자는 초록색으로 강조됨' },
  { key: 'CEO_인사말_본문(영문)', label: 'CEO 인사말 본문 (영문)', type: 'textarea', help: '영문 사이트용. 문단 사이에 빈 줄 한 줄' },
  { key: '구글맵_임베드_URL', label: '구글 지도 주소', help: '구글지도 → 공유 → 지도 퍼가기 → src="…" 안의 주소' },
];
const ID_RE = /^[a-z0-9가-힣]+(?:-[a-z0-9가-힣]+)*$/;
const EMAIL_RE = /^[^@\s,]+@[^@\s,]+\.[a-z]{2,}$/i;
const PHONE_RE = /01[0-9][-\s]?\d{3,4}[-\s]?\d{4}/;

const $ = (s, r = document) => r.querySelector(s);
function h(tag, props, ...kids) {  // DOM 생성 도우미: h('div', {class:'x', onclick: fn}, '텍스트', child)
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(9)) if (k != null && k !== false) el.append(k instanceof Node ? k : String(k));
  return el;
}
const ser = o => JSON.stringify(o, null, 2) + '\n';          // build.py/json.dumps(indent=2)와 같은 형식
const clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function slugify(t) { return String(t || '').replace(/[^a-zA-Z0-9가-힣]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'item'; }
function uniqueId(base, taken) { let id = base, n = 2; while (taken.has(id)) id = `${base}-${n++}`; taken.add(id); return id; }
function fmtTime(iso) { const d = new Date(iso); return d.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
function move(arr, i, d) { const j = i + d; if (j < 0 || j >= arr.length) return false; [arr[i], arr[j]] = [arr[j], arr[i]]; return true; }
function toast(t, ms = 2600) { const el = h('div', { class: 'toast' }, t); document.body.append(el); setTimeout(() => el.remove(), ms); }

/* 모달: ask({title, body(노드|문자열), ok, cancel, danger, input:{value, placeholder}}) → Promise(true|false|입력값) */
function ask({ title, body, ok = '확인', cancel = '취소', danger = false, input = null }) {
  return new Promise(res => {
    const inp = input ? h('input', { class: 'inp', value: input.value || '', placeholder: input.placeholder || '' }) : null;
    const close = v => { shade.remove(); res(v); };
    const shade = h('div', { class: 'shade', onclick: e => { if (e.target === shade) close(false); } },
      h('div', { class: 'modal' + (danger ? ' danger' : '') },
        h('h3', {}, title),
        typeof body === 'string' ? h('p', { html: body }) : body,
        inp,
        h('div', { class: 'actions' },
          cancel ? h('button', { class: 'btn', onclick: () => close(false) }, cancel) : null,
          h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => close(inp ? inp.value.trim() : true) }, ok))));
    document.body.append(shade);
    if (inp) { inp.focus(); inp.addEventListener('keydown', e => { if (e.key === 'Enter') close(inp.value.trim()); }); }
  });
}

/* ---------- 2. GitHub API ---------- */
const token = () => localStorage.getItem(TOKEN_KEY) || '';
async function gh(path, { method = 'GET', body, raw = false } = {}) {
  const url = path.startsWith('http') ? path : `${CFG.api}${path.replace('{repo}', `/repos/${CFG.owner}/${CFG.repo}`)}`;
  const r = await fetch(url, {
    method, cache: 'no-store',
    headers: { Authorization: `Bearer ${token()}`, Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    let msg = ''; try { msg = (await r.json()).message; } catch (e) { /* 무시 */ }
    const err = new Error(`GitHub ${r.status}: ${msg || r.statusText}`); err.status = r.status; throw err;
  }
  if (r.status === 204) return null;
  return raw ? r.text() : r.json();
}
const R = '{repo}';

/* ---------- 3. 데이터 로드 / 상태 ---------- */
const S = {
  head: null,          // 불러온 시점의 main 커밋
  data: {},            // 경로 → 객체 (수정 중인 값)
  base: {},            // 경로 → 불러온 시점의 직렬화 문자열 (변경 비교용)
  deleted: new Set(),  // 삭제할 파일 경로
  binary: {},          // 경로 → {b64, preview} (새 로고)
  logos: [],           // 저장소의 static/logos 파일명
  locked: { brands: new Set(), people: new Set(), depts: new Set(), families: new Set(), products: new Set() }, // 이미 공개된 id (변경 불가)
  view: 'home', sel: { brand: null, family: null },
  deploy: { state: 'idle', text: '', url: '' },
};
async function loadAll() {
  const ref = await gh(`${R}/git/ref/heads/${CFG.branch}`);
  S.head = ref.object.sha;
  const commit = await gh(`${R}/git/commits/${S.head}`);
  const tree = await gh(`${R}/git/trees/${commit.tree.sha}?recursive=1`);
  const paths = tree.tree.filter(t => t.type === 'blob' && t.path.startsWith('data/') && t.path.endsWith('.json')).map(t => t.path);
  S.logos = tree.tree.filter(t => t.type === 'blob' && t.path.startsWith('static/logos/')).map(t => t.path.slice(13));
  S.data = {}; S.base = {}; S.deleted = new Set(); S.binary = {};
  await Promise.all(paths.map(async p => {
    const obj = JSON.parse(await gh(`${R}/contents/${p}?ref=${S.head}`, { raw: true }));
    S.data[p] = obj; S.base[p] = ser(obj);
  }));
  lockIds();
}
function lockIds() {
  const L = S.locked; Object.values(L).forEach(s => s.clear());
  for (const b of brands()) { L.brands.add(b.id);
    for (const f of fams(b.id)) { L.families.add(`${b.id}/${f.id}`);
      for (const g of f.소그룹) for (const it of g.제품) L.products.add(`${b.id}/${f.id}/${it.id}`); } }
  for (const p of org().people) L.people.add(p.id);
  for (const d of org().departments) L.depts.add(d.id);
}
const company = () => S.data[P.company];
const historyList = () => S.data[P.history];  // (window.history와 이름 충돌 피함)
const org = () => S.data[P.org];
const brands = () => S.data[P.brands];
function prod(id, create = false) {
  const p = P.products(id);
  if (!S.data[p] && create) { S.data[p] = { 제품군: [] }; S.deleted.delete(p); }
  return S.data[p];
}
const fams = id => (prod(id) || { 제품군: [] }).제품군;
const personName = id => { const p = org().people.find(x => x.id === id); return p ? p['이름(한글)'] : id; };

function changedPaths() {
  const out = [];
  for (const [p, o] of Object.entries(S.data)) if (!S.deleted.has(p) && ser(o) !== S.base[p]) out.push(p);
  return out.concat([...S.deleted].filter(p => p in S.base), Object.keys(S.binary));
}
const isDirty = () => changedPaths().length > 0;

/* ---------- 4. id 자동 부여 · 검사 · 변경 요약 ---------- */
function assignIds() {  // 새 항목(빈 id)에만 id 생성. 기존 id는 절대 바꾸지 않음 (= URL 유지)
  const pids = new Set(org().people.map(p => p.id).filter(Boolean));
  for (const p of org().people) if (!p.id) p.id = uniqueId(slugify(p['이름(영문)'] || p['이름(한글)']), pids);
  const dids = new Set(org().departments.map(d => d.id).filter(Boolean));
  for (const d of org().departments) if (!d.id) d.id = uniqueId(slugify(d['이름(영문)'] || d['이름(한글)']), dids);
  for (const b of brands()) for (const f of fams(b.id)) {
    const ids = new Set(f.소그룹.flatMap(g => g.제품.map(it => it.id)).filter(Boolean));
    for (const g of f.소그룹) for (const it of g.제품) if (!it.id && String(it.품명 || '').trim()) it.id = uniqueId(slugify(it.품명), ids);
  }
}
function validate() {  // build.py validate()와 같은 규칙 → {E: 오류, W: 주의}
  const E = [], W = [];
  const c = company();
  for (const f of COMPANY_FIELDS) if (f.req && !String(c[f.key] || '').trim()) E.push(`회사정보: '${f.label}' 비어 있음`);
  historyList().forEach((x, i) => {
    if (!/^\d{4}\.\d{2}$/.test(x.연월 || '')) E.push(`연혁 ${i + 1}번째: 연월 '${x.연월 || ''}' — 2024.05 형식`);
    if (x.내용 && !x['내용(영문)']) W.push(`연혁 ${x.연월 || i + 1}: 영문 내용 없음 (영문 사이트에 한국어로 표시됨)`);
    if (!String(x.내용 || '').trim()) E.push(`연혁 ${i + 1}번째: 내용 비어 있음`);
  });
  const deptIds = org().departments.map(d => d.id);
  for (const d of org().departments) if (!d['이름(한글)'] && !d['이름(영문)']) E.push('부서: 이름 없는 부서가 있음');
  const pIds = [];
  for (const p of org().people) {
    const who = p['이름(한글)'] || '(이름 없음)';
    pIds.push(p.id);
    if (!p['이름(한글)']) E.push(`직원: 한글 이름 비어 있는 행 (부서 ${p.부서})`);
    if (!deptIds.includes(p.부서)) E.push(`직원 ${who}: 부서를 선택하세요`);
    if (p['이메일(공개)'] && !EMAIL_RE.test(p['이메일(공개)'])) E.push(`직원 ${who}: 이메일 형식 오류`);
    if (PHONE_RE.test(JSON.stringify(p))) E.push(`직원 ${who}: 휴대전화 번호는 입력할 수 없습니다 (공개 저장소)`);
    if (!p['이름(영문)']) W.push(`직원 ${who}: 영문 이름 없음`);
  }
  dupes(pIds).forEach(x => E.push(`직원 id 중복: ${x} — 영문 이름이 같은 직원이 있습니다`));
  dupes(brands().map(b => b.id)).forEach(x => E.push(`제조사 id 중복: ${x}`));
  for (const b of brands()) {
    const name = b.회사명 || b.id;
    if (!b.회사명) E.push(`제조사 ${b.id}: 회사명 비어 있음`);
    if (b.로고 && !S.logos.includes(b.로고) && !S.binary[`static/logos/${b.로고}`]) E.push(`제조사 ${name}: 로고 파일 없음 (${b.로고})`);
    if (!b.로고 && !b.기타묶음) W.push(`제조사 ${name}: 로고 없음`);
    if (b.노출 && b.한국어소개 && !b['소개(영문)']) W.push(`제조사 ${name}: 영문 소개 없음`);
    for (const c2 of b.문의담당 || []) if (!pIds.includes(c2.사람)) E.push(`제조사 ${name}: 문의담당 '${c2.사람}'이(가) 직원 목록에 없음`);
    if (b.노출 && !(b.문의담당 || []).length && !b.문의_영업팀전체) W.push(`제조사 ${name}: 문의 담당자 없음`);
    dupes(fams(b.id).map(f => f.id)).forEach(x => E.push(`${name}: 제품군 id 중복 '${x}'`));
    for (const f of fams(b.id)) {
      const where = `${name} > ${f.이름 || f.id}`;
      if (!f.이름) E.push(`${where}: 제품군 이름 비어 있음`);
      const ids = [];
      for (const g of f.소그룹) {
        dupes(g.스펙항목).forEach(x => E.push(`${where}: 스펙 항목 이름 중복 '${x}'`));
        if (g.스펙항목.some(x => !String(x).trim())) W.push(`${where}${g.이름 ? ' > ' + g.이름 : ''}: 이름 없는 스펙 항목`);
        g.제품.forEach((it, i) => {
          if (!String(it.품명 || '').trim()) E.push(`${where}${g.이름 ? ' > ' + g.이름 : ''}: ${i + 1}번째 행 품명 비어 있음`);
          else ids.push(it.id);
          const extra = Object.keys(it.스펙 || {}).filter(k => !g.스펙항목.includes(k));
          if (extra.length) E.push(`${where} > ${it.품명}: 스펙 항목에 없는 값 ${extra.join(', ')}`);
          if (!it.용도) W.push(`${where} > ${it.품명 || '(품명 없음)'}: Application 비어 있음`);
        });
      }
      dupes(ids).forEach(x => E.push(`${where}: 제품 주소 중복 '${x}' — 같은 품명이 두 번 있습니다`));
    }
  }
  return { E, W };
}
function dupes(a) { const s = new Set(), d = new Set(); for (const x of a) (s.has(x) ? d : s).add(x); return [...d]; }

function summary() {  // 변경사항을 사람이 읽을 수 있게 → [{title, lines[]}]
  const out = [], base = p => (S.base[p] ? JSON.parse(S.base[p]) : null);
  const d = (a, b) => `<del>${esc(a) || '(빈칸)'}</del> → <ins>${esc(b) || '(빈칸)'}</ins>`;
  for (const p of changedPaths()) {
    const now = S.deleted.has(p) ? null : S.data[p], old = base(p), L = [];
    if (p === P.company) {
      for (const k of new Set([...Object.keys(old), ...Object.keys(now)])) if ((old[k] || '') !== (now[k] || '')) {
        const lab = (COMPANY_FIELDS.find(f => f.key === k) || { label: k }).label;
        L.push(k === 'CEO_인사말_본문' ? `${lab} 수정` : `${lab}: ${d(old[k], now[k])}`);
      }
      out.push({ title: '회사정보', lines: L });
    } else if (p === P.history) {
      const o = old.map(x => `${x.연월} ${x.내용}`), n = now.map(x => `${x.연월} ${x.내용}`);
      n.filter(x => !o.includes(x)).forEach(x => L.push(`추가·수정: <ins>${esc(x)}</ins>`));
      o.filter(x => !n.includes(x)).forEach(x => L.push(`삭제·수정 전: <del>${esc(x)}</del>`));
      if (!L.length) L.push('순서 변경');
      out.push({ title: '연혁', lines: L });
    } else if (p === P.org) {
      diffList(old.departments, now.departments, x => x['이름(한글)'] || x['이름(영문)'], L, '부서');
      diffList(old.people, now.people, x => x['이름(한글)'], L, '직원');
      if (!L.length) L.push('순서 변경');
      out.push({ title: '조직도', lines: L });
    } else if (p === P.brands) {
      diffList(old, now, x => x.회사명, L, '제조사', (a, b) => {
        const f = Object.keys({ ...a, ...b }).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
        return f.map(k => k === '노출' ? (b.노출 ? '다시 공개' : '숨김') : k).join(', ');
      });
      if (!L.length) L.push('순서 변경');
      out.push({ title: '제조사', lines: L });
    } else if (p.startsWith('data/products/')) {
      const bid = p.slice(14, -5), bn = (brands().find(b => b.id === bid) || { 회사명: bid }).회사명;
      if (!now) { out.push({ title: `제품 — ${bn}`, lines: ['제품 파일 삭제'] }); continue; }
      const flat = o => { const m = new Map(); (o ? o.제품군 : []).forEach(f => f.소그룹.forEach(g => g.제품.forEach((it, i) =>
        m.set(`${f.id}/${it.id || '#' + g.이름 + i}`, { f: f.이름, name: it.품명, s: JSON.stringify([it, g.스펙항목, g.이름]) })))); return m; };
      const A = flat(old), B = flat(now);
      const add = [...B.keys()].filter(k => !A.has(k)), del = [...A.keys()].filter(k => !B.has(k)),
        mod = [...B.keys()].filter(k => A.has(k) && A.get(k).s !== B.get(k).s);
      const ff = o => (o ? o.제품군.map(f => f.이름) : []);
      ff(now).filter(x => !ff(old).includes(x)).forEach(x => L.push(`제품군 추가·이름변경: <ins>${esc(x)}</ins>`));
      ff(old).filter(x => !ff(now).includes(x)).forEach(x => L.push(`제품군 삭제·이름변경 전: <del>${esc(x)}</del>`));
      const names = (ks, M) => ks.slice(0, 8).map(k => esc(M.get(k).name || '(품명 없음)')).join(', ') + (ks.length > 8 ? ` 외 ${ks.length - 8}` : '');
      if (add.length) L.push(`제품 추가 ${add.length}: ${names(add, B)}`);
      if (mod.length) L.push(`제품 수정 ${mod.length}: ${names(mod, B)}`);
      if (del.length) L.push(`제품 삭제 ${del.length}: <del>${names(del, A)}</del>`);
      if (!L.length) L.push('순서·스펙 항목 변경');
      out.push({ title: `제품 — ${bn}`, lines: L });
    } else if (p.startsWith('static/logos/')) {
      out.push({ title: '로고 파일', lines: [`업로드: ${esc(p.slice(13))}`] });
    } else out.push({ title: p, lines: ['변경'] });
  }
  return out;
}
function diffList(a, b, nameOf, L, label, how) {
  const A = new Map(a.map(x => [x.id, x])), B = new Map(b.map(x => [x.id, x]));
  for (const x of b) if (!x.id || !A.has(x.id)) L.push(`${label} 추가: <ins>${esc(nameOf(x) || '(이름 없음)')}</ins>`);
  for (const x of a) if (!B.has(x.id)) L.push(`${label} 삭제: <del>${esc(nameOf(x))}</del>`);
  for (const x of b) if (x.id && A.has(x.id) && JSON.stringify(A.get(x.id)) !== JSON.stringify(x))
    L.push(`${label} 수정: ${esc(nameOf(x))}${how ? ` <span class="muted">(${esc(how(A.get(x.id), x))})</span>` : ''}`);
}

/* ---------- 5. 화면 ---------- */
let topTimer = null;
function touch() { clearTimeout(topTimer); topTimer = setTimeout(refreshChrome, 150); }  // 입력할 때마다 상단 바만 갱신
function render() {
  const main = h('main', { class: 'main', id: 'main' });
  $('#app').replaceChildren(h('div', { id: 'top' }), h('div', { class: 'layout' }, h('nav', { class: 'nav', id: 'nav' }), main));
  main.append(...[].concat(VIEWS[S.view]()).flat(9).filter(Boolean));
  refreshChrome();
}
function go(view) { S.view = view; render(); window.scrollTo(0, 0); }
function refreshChrome() {
  const n = changedPaths().length, dep = S.deploy;
  $('#top').replaceChildren(h('header', { class: 'top' },
    h('div', { class: 'top-title' }, h('span', {}, '■'), '케미프렌드 홈페이지 관리'),
    h('div', { class: 'top-status' }, h('i', { class: 'dot ' + ({ ok: 'ok', run: 'run', fail: 'fail' }[dep.state] || '') }),
      dep.url ? h('a', { href: dep.url, target: '_blank', style: 'color:inherit' }, dep.text) : dep.text),
    h('div', { class: 'top-spacer' }),
    h('a', { class: 'site', href: '../', target: '_blank' }, '사이트 ↗'), h('a', { class: 'site', href: '../en/', target: '_blank' }, 'English ↗'),
    n ? h('div', { class: 'pending' },
      h('button', { class: 'btn', onclick: discardAll }, '변경 취소'),
      h('button', { class: 'btn primary', onclick: openReview }, '변경 확인·반영 ', h('span', { class: 'badge' }, n)))
      : h('span', { class: 'muted', style: 'color:#8b9bb0' }, '변경 없음')));
  const dirty = changedPaths(), has = pre => dirty.some(p => p.startsWith(pre));
  const item = (v, label, d) => h('button', { class: (S.view === v ? 'on' : '') + (d ? ' dirty' : ''), onclick: () => go(v) }, label);
  $('#nav').replaceChildren(
    item('home', '홈'), item('company', '회사정보', has(P.company)), item('history', '연혁', has(P.history)),
    item('org', '조직도', has(P.org)), item('brands', '제조사', has(P.brands) || has('static/logos/')),
    item('products', '제품', has('data/products/')), h('hr'),
    item('versions', '버전 기록 · 복구'),
    h('button', { onclick: () => window.open(`https://github.com/${CFG.owner}/${CFG.repo}/blob/${CFG.branch}/%EC%9A%B4%EC%98%81%EC%84%A4%EB%AA%85%EC%84%9C.md`, '_blank') }, '운영설명서 ↗'),
    h('button', { onclick: logout }, '로그아웃'));
}
function inp(obj, key, { cls = 'inp', ph = '', area = false, base, onchange } = {}) {  // obj[key]를 바로 수정하는 입력칸
  const el = h(area ? 'textarea' : 'input', { class: cls, value: obj[key] ?? '', placeholder: ph });
  const mark = () => { if (base !== undefined) el.classList.toggle('changed', (obj[key] ?? '') !== (base ?? '')); };
  el.addEventListener('input', () => { obj[key] = el.value; mark(); touch(); });
  if (onchange) el.addEventListener('change', onchange);
  mark();
  return el;
}
const act = (...btns) => h('td', { class: 'act' }, ...btns);
const ib = (label, title, fn, cls = '') => h('button', { title, class: cls, onclick: fn }, label);
const countItems = id => fams(id).reduce((t, f) => t + f.소그룹.reduce((u, g) => u + g.제품.length, 0), 0);

const VIEWS = {
  home() {
    const bs = brands(), items = bs.reduce((s, b) => s + countItems(b.id), 0);
    const { E, W } = validate();
    return [
      h('h1', {}, '홈페이지 관리'),
      h('p', { class: 'lead' }, '왼쪽 메뉴에서 고친 뒤, 오른쪽 위 [변경 확인·반영]을 누르면 1~2분 뒤 사이트에 반영됩니다.'),
      h('div', { class: 'panel' }, h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('b', {}, items), h('span', {}, '제품')),
        h('div', { class: 'stat' }, h('b', {}, bs.filter(b => b.노출).length), h('span', {}, `공개 제조사 (전체 ${bs.length})`)),
        h('div', { class: 'stat' }, h('b', {}, org().people.length), h('span', {}, '직원')),
        h('div', { class: 'stat' }, h('b', {}, historyList().length), h('span', {}, '연혁')))),
      h('div', { class: 'panel' }, h('h2', {}, '사이트 점검'),
        E.length ? h('div', { class: 'msg err' }, `반영 전에 고쳐야 할 오류 ${E.length}건`, h('ul', {}, E.slice(0, 15).map(e => h('li', {}, e))))
          : h('div', { class: 'msg ok' }, '오류 없음 — 모든 제조사·제품·담당자 연결 정상'),
        W.length ? h('details', {}, h('summary', { class: 'muted', style: 'cursor:pointer' }, `참고 사항 ${W.length}건 (반영에는 지장 없음)`),
          h('ul', { class: 'muted' }, W.slice(0, 60).map(w => h('li', {}, w)))) : null),
      h('div', { class: 'panel' }, h('h2', {}, '자주 하는 일'),
        h('div', { class: 'row' },
          h('button', { class: 'btn', onclick: () => go('products') }, '제품 추가·수정'),
          h('button', { class: 'btn', onclick: () => go('org') }, '직원 변경'),
          h('button', { class: 'btn', onclick: () => go('company') }, '전화·주소 변경'),
          h('button', { class: 'btn', onclick: () => go('versions') }, '잘못 반영했을 때 되돌리기'),
          h('button', { class: 'btn', onclick: exportBackup }, '⬇ 전체 백업 (엑셀)'))),
    ];
  },

  company() {
    const c = company(), base = JSON.parse(S.base[P.company]);
    const known = COMPANY_FIELDS.map(f => f.key), extra = Object.keys(c).filter(k => !known.includes(k));
    const row = f => h('div', { class: 'field' },
      h('label', {}, f.label, f.req ? ' *' : '', f.help ? h('span', { class: 'help' }, f.help) : null),
      inp(c, f.key, { area: f.type === 'textarea', cls: 'inp' + (f.key.startsWith('CEO_인사말_본문') ? ' tall' : ''), base: base[f.key] }));
    return [h('h1', {}, '회사정보'), h('p', { class: 'lead' }, '사이트 상단·하단, 메인, 문의 페이지에 쓰이는 기본 정보입니다. 노란 칸 = 수정됨'),
      h('div', { class: 'panel' }, COMPANY_FIELDS.map(row), extra.map(k => row({ key: k, label: k, help: '기타 항목' })))];
  },

  history() {
    const list = historyList();
    const redraw = () => { render(); touch(); };
    return [h('h1', {}, '연혁'), h('p', { class: 'lead' }, '메인 페이지 연혁에 위에서부터 순서대로 표시됩니다. 연월은 2024.05 형식.'),
      h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
        h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, '연월'), h('th', {}, '내용'), h('th', {}, '내용 (영문)'), h('th', { class: 'act' }))),
        h('tbody', {}, list.map((x, i) => h('tr', {},
          h('td', { class: 'num' }, i + 1), h('td', { style: 'width:130px' }, inp(x, '연월', { cls: '', ph: '2024.05' })), h('td', {}, inp(x, '내용', { cls: '' })), h('td', {}, inp(x, '내용(영문)', { cls: '', ph: '영문 사이트용' })),
          act(ib('↑', '위로', () => move(list, i, -1) && redraw()), ib('↓', '아래로', () => move(list, i, 1) && redraw()),
            ib('✕', '삭제', () => { list.splice(i, 1); redraw(); }, 'x'))))))),
      h('div', { class: 'row', style: 'margin-top:14px' },
        h('button', { class: 'btn', onclick: () => { list.push({ 연월: '', 내용: '', '내용(영문)': '' }); redraw(); } }, '+ 연혁 추가'),
        h('button', { class: 'btn ghost', onclick: () => { list.sort((a, b) => a.연월.localeCompare(b.연월)); redraw(); } }, '연월순 정렬'))];
  },

  org() {
    const o = org(), redraw = () => { render(); touch(); };
    const deptTable = h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
      h('thead', {}, h('tr', {}, h('th', {}, '부서명 (영문)'), h('th', {}, '부서명 (한글)'), h('th', {}, '설명 — 비우면 담당 브랜드가 자동 표시'), h('th', { class: 'act' }))),
      h('tbody', {}, o.departments.map((d, i) => h('tr', { class: S.locked.depts.has(d.id) ? '' : 'new' },
        h('td', {}, inp(d, '이름(영문)', { cls: '' })), h('td', {}, inp(d, '이름(한글)', { cls: '' })), h('td', {}, inp(d, '설명', { cls: '', ph: '(자동)' })),
        act(ib('↑', '위로', () => move(o.departments, i, -1) && redraw()), ib('↓', '아래로', () => move(o.departments, i, 1) && redraw()),
          ib('✕', '삭제', () => {
            if (o.people.some(p => p.부서 === d.id)) return ask({ title: '삭제할 수 없습니다', body: '이 부서에 직원이 있습니다. 직원을 먼저 다른 부서로 옮기거나 삭제하세요.', cancel: null });
            o.departments.splice(i, 1); redraw();
          }, 'x')))))));
    const titles = h('datalist', { id: 'titles' }, Object.keys(TITLE_EN).map(t => h('option', { value: t })));
    const kinds = h('datalist', { id: 'kinds' }, h('option', { value: 'CS' }));
    const personRow = p => {
      const en = inp(p, '직급(영문)', { cls: '' });
      const ko = inp(p, '직급', { cls: '' }); ko.setAttribute('list', 'titles');
      let prev = p.직급;
      ko.addEventListener('input', () => {  // 직급을 고르면 영문 직급 자동 입력
        const auto = TITLE_EN[p.직급];
        if (auto && (!p['직급(영문)'] || p['직급(영문)'] === TITLE_EN[prev])) { p['직급(영문)'] = auto; en.value = auto; }
        prev = p.직급;
      });
      const kind = inp(p, '구분', { cls: '', ph: '예: CS' }); kind.setAttribute('list', 'kinds');
      const deptSel = h('select', { onchange: e => { p.부서 = e.target.value; redraw(); } },
        o.departments.map(d => h('option', { value: d.id, selected: d.id === p.부서 }, d['이름(한글)'] || d['이름(영문)'])));
      const idx = o.people.indexOf(p), same = x => x.부서 === p.부서;
      const moveIn = dir => { let j = idx + dir; while (j >= 0 && j < o.people.length && !same(o.people[j])) j += dir;
        if (j >= 0 && j < o.people.length) { [o.people[idx], o.people[j]] = [o.people[j], o.people[idx]]; redraw(); } };
      return h('tr', { class: S.locked.people.has(p.id) ? '' : 'new' },
        h('td', {}, inp(p, '이름(한글)', { cls: '' })), h('td', {}, inp(p, '이름(영문)', { cls: '', ph: 'Gil Dong HONG' })),
        h('td', { style: 'width:100px' }, ko), h('td', {}, en), h('td', { style: 'width:80px' }, kind),
        h('td', {}, inp(p, '담당분야', { cls: '', ph: '(브랜드 담당은 제조사 화면에서)' })),
        h('td', {}, inp(p, '이메일(공개)', { cls: '', ph: '공개할 경우만' })), h('td', {}, deptSel),
        act(ib('↑', '위로', () => moveIn(-1)), ib('↓', '아래로', () => moveIn(1)),
          ib('✕', '삭제', async () => {
            const used = brands().filter(b => (b.문의담당 || []).some(c => c.사람 === p.id));
            if (used.length) return ask({ title: '삭제할 수 없습니다', body: `${esc(p['이름(한글)'])}님이 <b>${used.map(b => esc(b.회사명)).join(', ')}</b> 문의 담당입니다. 제조사 화면에서 담당자를 먼저 바꾸세요.`, cancel: null });
            if (await ask({ title: '직원 삭제', body: `${esc(p['이름(한글)'] || '(이름 없음)')}님을 조직도에서 삭제할까요?`, ok: '삭제', danger: true })) { o.people.splice(idx, 1); redraw(); }
          }, 'x')));
    };
    return [h('h1', {}, '조직도'),
      h('div', { class: 'msg warn' }, '이 내용은 누구나 볼 수 있습니다. ', h('b', {}, '휴대전화 번호는 입력하지 마세요.'), ' 이메일은 사이트에 공개할 사람만 입력합니다.'),
      titles, kinds,
      o.departments.map(d => h('div', { class: 'panel' },
        h('h2', {}, `${d['이름(한글)'] || ''} `, h('span', { class: 'muted' }, d['이름(영문)'] || '')),
        h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
          h('thead', {}, h('tr', {}, ['이름', '영문 이름', '직급', '직급 (영문)', '구분', '담당분야', '이메일 (공개)', '부서'].map(t => h('th', {}, t)), h('th', { class: 'act' }))),
          h('tbody', {}, o.people.filter(p => p.부서 === d.id).map(personRow)))),
        h('button', { class: 'btn', style: 'margin-top:12px', onclick: () => {
          o.people.push({ id: '', 부서: d.id, '이름(한글)': '', '이름(영문)': '', 직급: '', '직급(영문)': '', 구분: '', 담당분야: '', '이메일(공개)': '' }); redraw(); } }, '+ 직원 추가'))),
      h('div', { class: 'panel' }, h('h2', {}, '부서 순서·이름'), deptTable,
        h('button', { class: 'btn', style: 'margin-top:12px', onclick: () => { o.departments.push({ id: '', '이름(영문)': '', '이름(한글)': '', 설명: '' }); redraw(); } }, '+ 부서 추가'))];
  },

  brands() {
    const bs = brands(), redraw = () => { render(); touch(); };
    const cards = h('div', { class: 'cards' }, bs.map((b, i) => h('div', { class: 'card' + (S.sel.brand === b.id ? ' sel' : '') + (b.노출 ? '' : ' off'), onclick: () => { S.sel.brand = b.id; render(); } },
      h('div', { class: 'logo' }, b.로고 ? h('img', { src: logoSrc(b.로고), alt: b.회사명 }) : b.회사명),
      h('div', { class: 'meta' }, `${b.회사명} · 제품군 ${fams(b.id).length} · 제품 ${countItems(b.id)}`),
      h('div', { class: 'row' }, b.노출 ? null : h('span', { class: 'tag off' }, '숨김'), b.기타묶음 ? h('span', { class: 'tag' }, '기타 묶음') : null,
        h('span', { class: 'top-spacer' }),
        h('button', { class: 'btn sm ghost', title: '앞으로', onclick: e => { e.stopPropagation(); move(bs, i, -1) && redraw(); } }, '◀'),
        h('button', { class: 'btn sm ghost', title: '뒤로', onclick: e => { e.stopPropagation(); move(bs, i, 1) && redraw(); } }, '▶')))),
      h('div', { class: 'card', style: 'justify-content:center;align-items:center;color:var(--muted);font-weight:700', onclick: addBrand }, '+ 제조사 추가'));
    const b = bs.find(x => x.id === S.sel.brand);
    return [h('h1', {}, '제조사'), h('p', { class: 'lead' }, '사이트에 표시되는 순서대로입니다 (◀ ▶로 변경). 카드를 누르면 아래에서 수정합니다.'), cards,
      b ? brandEditor(b) : h('p', { class: 'muted', style: 'margin-top:24px' }, '수정할 제조사를 선택하세요.')];
  },

  products() {
    const bs = brands();
    if (!bs.some(b => b.id === S.sel.brand)) S.sel.brand = bs[0] && bs[0].id;
    const b = bs.find(x => x.id === S.sel.brand);
    if (!b) return [h('h1', {}, '제품'), h('p', { class: 'muted' }, '제조사를 먼저 추가하세요.')];
    const list = fams(b.id);
    if (!list.some(f => f.id === S.sel.family)) S.sel.family = list[0] && list[0].id;
    const f = list.find(x => x.id === S.sel.family);
    return [h('h1', {}, '제품'),
      h('p', { class: 'lead' }, '엑셀처럼 칸을 눌러 고치면 됩니다. 엑셀에서 여러 칸을 복사해 붙여넣거나, [엑셀로 내려받기]로 받아 고친 뒤 [엑셀 불러오기]로 올려도 됩니다. 초록 행 = 새 제품, 노란 행 = 수정됨'),
      h('div', { class: 'row', style: 'margin-bottom:18px' }, h('b', {}, '제조사'),
        bs.map(x => h('button', { class: 'btn' + (x.id === b.id ? ' primary' : ''), onclick: () => { S.sel.brand = x.id; S.sel.family = null; render(); } }, x.회사명, x.노출 ? '' : ' (숨김)'))),
      h('div', { class: 'tabs' }, list.map(x => h('button', { class: x.id === S.sel.family ? 'on' : '', onclick: () => { S.sel.family = x.id; render(); } }, x.이름 || '(이름 없음)')),
        h('button', { onclick: () => addFamily(b) }, '+ 제품군')),
      f ? familyEditor(b, f) : h('p', { class: 'muted' }, '제품군이 없습니다. [+ 제품군]으로 추가하세요.')];
  },

  versions() {
    const box = h('div', { class: 'hist' }, h('p', { class: 'muted' }, '불러오는 중…'));
    gh(`${R}/commits?sha=${CFG.branch}&path=data&per_page=25`).then(list => {
      box.replaceChildren(...list.map((c, i) => h('div', { class: 'hist-row' },
        h('div', { class: 'when' }, fmtTime(c.commit.author.date)),
        h('div', {}, h('div', { class: 'what' }, c.commit.message.split('\n')[0]), h('div', { class: 'who' }, c.commit.author.name, ' · ', c.sha.slice(0, 7))),
        i === 0 ? h('span', { class: 'tag' }, '현재')
          : h('button', { class: 'btn sm', onclick: () => restore(c.sha, fmtTime(c.commit.author.date)) }, '이 시점으로 되돌리기'))));
    }).catch(e => box.replaceChildren(h('div', { class: 'msg err' }, e.message)));
    return [h('h1', {}, '버전 기록 · 복구'),
      h('p', { class: 'lead' }, '사이트 내용이 바뀐 기록입니다. 잘못 반영했다면 이전 시점으로 되돌릴 수 있습니다. 되돌리기도 기록에 남으므로 다시 원래대로 돌아올 수 있습니다.'),
      h('div', { class: 'panel' }, box),
      h('p', {}, h('button', { class: 'btn', onclick: exportBackup }, '⬇ 현재 내용 전체를 엑셀로 백업')),
      h('p', { class: 'muted' }, '사이트 빌드 기록: ', h('a', { href: `https://github.com/${CFG.owner}/${CFG.repo}/actions`, target: '_blank' }, 'GitHub Actions ↗'))];
  },
};

function logoSrc(name) { const b = S.binary[`static/logos/${name}`]; return b ? b.preview : `../static/logos/${name}`; }

function brandEditor(b) {
  const base = (JSON.parse(S.base[P.brands]).find(x => x.id === b.id)) || {}, redraw = () => { render(); touch(); };
  const F = (label, key, opt = {}) => h('div', { class: 'field' }, h('label', {}, label, opt.help ? h('span', { class: 'help' }, opt.help) : null),
    inp(b, key, { area: opt.area, base: base[key] ?? '' }));
  const people = org().people;
  b.문의담당 = b.문의담당 || [];
  const contacts = h('div', {},
    h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
      h('thead', {}, h('tr', {}, h('th', {}, '담당자'), h('th', {}, '분야 (한글)'), h('th', {}, '분야 (영문)'), h('th', { class: 'act' }))),
      h('tbody', {}, b.문의담당.map((c, i) => h('tr', {},
        h('td', {}, h('select', { onchange: e => { c.사람 = e.target.value; touch(); } },
          h('option', { value: '' }, '— 선택 —'),
          people.map(p => h('option', { value: p.id, selected: p.id === c.사람 }, `${p['이름(한글)']} ${p.직급 || ''}${p['이메일(공개)'] ? '' : ' (이메일 비공개)'}`)))),
        h('td', {}, inp(c, '분야(한글)', { cls: '', ph: '예: 코팅·잉크 (없으면 비움)' })), h('td', {}, inp(c, '분야(영문)', { cls: '', ph: 'Coatings, Inks' })),
        act(ib('↑', '위로', () => move(b.문의담당, i, -1) && redraw()), ib('↓', '아래로', () => move(b.문의담당, i, 1) && redraw()),
          ib('✕', '삭제', () => { b.문의담당.splice(i, 1); redraw(); }, 'x'))))))),
    h('div', { class: 'row', style: 'margin-top:10px' },
      h('button', { class: 'btn sm', onclick: () => { b.문의담당.push({ 사람: '', '분야(한글)': '', '분야(영문)': '' }); redraw(); } }, '+ 담당자'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!b.문의_영업팀전체, onchange: e => { b.문의_영업팀전체 = e.target.checked; touch(); } }),
        '영업팀 전체에게 가는 메일 버튼 표시 (이메일 공개된 직원 전원)')));
  const fileIn = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', style: 'display:none', onchange: e => e.target.files[0] && setLogo(b, e.target.files[0]) });
  const drop = h('div', { class: 'logo-drop', onclick: () => fileIn.click(),
    ondragover: e => { e.preventDefault(); drop.classList.add('over'); }, ondragleave: () => drop.classList.remove('over'),
    ondrop: e => { e.preventDefault(); drop.classList.remove('over'); e.dataTransfer.files[0] && setLogo(b, e.dataTransfer.files[0]); } },
    b.로고 ? h('img', { src: logoSrc(b.로고) }) : null,
    b.로고 ? `현재: ${b.로고} — ` : '', '새 로고 파일을 여기로 끌어놓거나 클릭 (PNG·JPG, 흰 여백은 자동으로 잘라냄)', fileIn);
  return h('div', { class: 'panel', style: 'margin-top:24px' },
    h('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:6px' },
      h('h2', { style: 'margin:0' }, b.회사명 || '(새 제조사)'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => { S.sel.brand = b.id; go('products'); } }, '제품 수정 →'),
        h('button', { class: 'btn danger', onclick: () => deleteBrand(b) }, '삭제'))),
    h('p', { class: 'muted', style: 'margin:0 0 10px' }, `페이지 주소: /product/${b.id}/ ${S.locked.brands.has(b.id) ? '(고정 — 회사명을 바꿔도 주소는 유지됨)' : '(새 제조사 — 반영 시 확정)'}`),
    h('div', { class: 'field' }, h('label', {}, '홈페이지에 표시'),
      h('div', {}, h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!b.노출, onchange: e => { b.노출 = e.target.checked; redraw(); } }), '표시'),
        h('span', { class: 'help' }, '끄면 사이트에서 숨겨지고 제품 데이터는 그대로 보관됩니다 (다시 켜면 복구)'))),
    F('회사명 *', '회사명'), F('국가', '국가', { help: '예: USA' }), F('설립연도', '설립연도'), F('영문 슬로건', '영문슬로건'),
    F('한국어 소개', '한국어소개', { area: true }), F('영문 소개', '소개(영문)', { area: true, help: '영문 사이트용' }),
    F('제품 요약', '제품요약', { help: '카드에 "취급 제품: …"으로 표시. 비우면 제품군 이름이 자동으로 나열됨' }),
    F('제품 요약 (영문)', '제품요약(영문)', { help: '영문 사이트 카드용. 비우면 제품군 이름 자동' }),
    h('div', { class: 'field' }, h('label', {}, '로고'), drop),
    h('div', { class: 'field' }, h('label', {}, '문의 담당', h('span', { class: 'help' }, '브랜드·제품 페이지와 Contact 페이지에 표시')), contacts),
    h('div', { class: 'field' }, h('label', {}, '기타 묶음'),
      h('div', {}, h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!b.기타묶음, onchange: e => { b.기타묶음 = e.target.checked; touch(); } }), 'Others처럼 여러 공급사를 묶은 항목'),
        h('span', { class: 'help' }, '메인 "글로벌 파트너십" 숫자에서 제외됩니다'))));
}

async function addBrand() {
  const name = await ask({ title: '제조사 추가', body: '회사명을 입력하세요. (영문 권장 — 페이지 주소가 이 이름으로 만들어집니다)', input: { placeholder: '예: BASF' }, ok: '추가' });
  if (!name) return;
  const id = uniqueId(slugify(name), new Set(brands().map(b => b.id)));
  brands().push({ id, 회사명: name, 로고: '', 노출: true, 기타묶음: false, 국가: '', 설립연도: '', 영문슬로건: '', 한국어소개: '', '소개(영문)': '', 제품요약: '', '제품요약(영문)': '', 문의_영업팀전체: false, 문의담당: [] });
  S.sel.brand = id; render(); touch();
}
async function deleteBrand(b) {
  const n = countItems(b.id);
  if (n) return ask({ title: '삭제할 수 없습니다', body: `${esc(b.회사명)}에 제품 ${n}개가 있습니다. 사이트에서 빼려면 <b>홈페이지에 표시</b>를 끄세요 (데이터는 보관됨). 완전히 지우려면 제품 화면에서 제품군을 먼저 삭제하세요.`, cancel: null });
  if (!await ask({ title: '제조사 삭제', body: `${esc(b.회사명)}을(를) 삭제할까요?`, ok: '삭제', danger: true })) return;
  brands().splice(brands().indexOf(b), 1);
  const p = P.products(b.id);
  if (p in S.base) S.deleted.add(p); else delete S.data[p];
  S.sel.brand = null; render(); touch();
}
function setLogo(b, file) {  // 흰 여백·투명 여백 자동 트리밍 → PNG (가로 최대 800px)
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const { data, width: W, height: H } = x.getImageData(0, 0, c.width, c.height);
    let t = H, l = W, r = -1, bo = -1;
    for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
      const k = (yy * W + xx) * 4;
      if (data[k + 3] > 16 && !(data[k] > 243 && data[k + 1] > 243 && data[k + 2] > 243)) {
        if (yy < t) t = yy; if (yy > bo) bo = yy; if (xx < l) l = xx; if (xx > r) r = xx;
      }
    }
    if (r < 0) { t = 0; l = 0; r = W - 1; bo = H - 1; }
    const pad = 2; l = Math.max(0, l - pad); t = Math.max(0, t - pad); r = Math.min(W - 1, r + pad); bo = Math.min(H - 1, bo + pad);
    const w = r - l + 1, hh = bo - t + 1, scale = Math.min(1, 800 / w);
    const o = document.createElement('canvas'); o.width = Math.round(w * scale); o.height = Math.round(hh * scale);
    o.getContext('2d').drawImage(c, l, t, w, hh, 0, 0, o.width, o.height);
    const dataUrl = o.toDataURL('image/png'), name = `${b.id}.png`;
    S.binary[`static/logos/${name}`] = { b64: dataUrl.split(',')[1], preview: dataUrl };
    b.로고 = name; URL.revokeObjectURL(url); render(); touch();
    toast(`로고 여백 정리됨 (${W}×${H} → ${o.width}×${o.height})`);
  };
  img.onerror = () => toast('이미지를 읽을 수 없습니다');
  img.src = url;
}

async function addFamily(b) {
  const name = await ask({ title: '제품군 추가', body: `${esc(b.회사명)}에 새 제품군을 추가합니다. (예: Carbon Black)`, input: { placeholder: '제품군 이름' }, ok: '추가' });
  if (!name) return;
  const pr = prod(b.id, true), id = uniqueId(slugify(name), new Set(pr.제품군.map(f => f.id)));
  pr.제품군.push({ id, 이름: name, 소그룹: [{ 이름: '', 스펙항목: ['형태'], 제품: [] }] });
  S.sel.family = id; render(); touch();
}

function familyEditor(b, f) {
  const list = fams(b.id), fi = list.indexOf(f), redraw = () => { render(); touch(); };
  const xin = h('input', { type: 'file', accept: '.xlsx,.xls', style: 'display:none', onchange: e => { const fl = e.target.files[0]; e.target.value = ''; if (fl) importFamily(b, f, fl); } });
  const baseFile = S.base[P.products(b.id)] ? JSON.parse(S.base[P.products(b.id)]) : { 제품군: [] };
  const baseItems = new Map();
  for (const bf of baseFile.제품군) for (const g of bf.소그룹) for (const it of g.제품) baseItems.set(`${bf.id}/${it.id}`, JSON.stringify(it));
  const head = h('div', { class: 'panel' },
    h('div', { class: 'field' }, h('label', {}, '제품군 이름', h('span', { class: 'help' }, `주소 /product/${b.id}/${f.id}/ ${S.locked.families.has(`${b.id}/${f.id}`) ? '(고정)' : '(새 제품군)'}`)),
      inp(f, '이름', { onchange: () => { render(); touch(); } })),
    h('div', { class: 'row' },
      h('button', { class: 'btn sm', onclick: () => move(list, fi, -1) && redraw() }, '◀ 순서 앞으로'),
      h('button', { class: 'btn sm', onclick: () => move(list, fi, 1) && redraw() }, '순서 뒤로 ▶'),
      h('span', { class: 'top-spacer' }),
      h('button', { class: 'btn sm', onclick: () => exportFamily(b, f) }, '⬇ 엑셀로 내려받기'),
      h('button', { class: 'btn sm', onclick: () => xin.click() }, '⬆ 엑셀 불러오기'), xin,
      h('button', { class: 'btn sm danger', onclick: async () => {
        const n = f.소그룹.reduce((t, g) => t + g.제품.length, 0);
        if (await ask({ title: '제품군 삭제', body: `<b>${esc(f.이름)}</b>과(와) 제품 ${n}개를 삭제할까요? 반영 후에도 [버전 기록]에서 되돌릴 수 있습니다.`, ok: '삭제', danger: true })) {
          list.splice(fi, 1); S.sel.family = null; redraw();
        } } }, '제품군 삭제')));
  return [head, f.소그룹.map((g, gi) => groupEditor(f, g, gi, baseItems)),
    h('button', { class: 'btn', onclick: () => { f.소그룹.push({ 이름: '', 스펙항목: [...(f.소그룹.length ? f.소그룹[f.소그룹.length - 1].스펙항목 : ['형태'])], 제품: [] }); redraw(); } }, '+ 소그룹 추가 (표 하나 더)')];
}

function normalizeSpec(g) {  // 스펙 값의 순서를 열 순서에 맞추고 빈 값 제거
  for (const it of g.제품) { const s = {}; for (const c of g.스펙항목) if (it.스펙 && it.스펙[c]) s[c] = it.스펙[c]; it.스펙 = s; }
}
function groupEditor(f, g, gi, baseItems) {
  const redraw = () => { render(); touch(); };
  const cols = () => ['품명', '용도', ...g.스펙항목];
  const newItem = () => ({ id: '', 품명: '', 용도: '', 스펙: {} });
  let tbody;
  const cell = (it, ri, ci) => {
    const key = cols()[ci];
    const el = h('input', { value: (ci < 2 ? it[key] : (it.스펙 || {})[key]) || '', 'data-r': ri, 'data-c': ci });
    el.addEventListener('input', () => {
      if (ci < 2) it[key] = el.value;
      else { it.스펙 = it.스펙 || {}; if (el.value) it.스펙[key] = el.value; else delete it.스펙[key]; }
      touch();
    });
    el.addEventListener('keydown', e => {  // Enter/↓/↑ 로 같은 열 위아래 이동
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const nx = tbody.querySelector(`input[data-r="${ri + (e.key === 'ArrowUp' ? -1 : 1)}"][data-c="${ci}"]`);
        if (nx) { e.preventDefault(); nx.focus(); nx.select(); }
      }
    });
    el.addEventListener('paste', e => {  // 엑셀에서 여러 칸 붙여넣기
      const txt = (e.clipboardData || window.clipboardData).getData('text');
      if (!/[\t\n]/.test(txt.replace(/\r?\n$/, ''))) return;
      e.preventDefault();
      const rows = txt.replace(/\r/g, '').replace(/\n$/, '').split('\n').map(r => r.split('\t'));
      const c = cols();
      rows.forEach((vals, dr) => {
        const r = ri + dr;
        while (g.제품.length <= r) g.제품.push(newItem());
        const t = g.제품[r];
        vals.forEach((v, dc) => {
          const k = c[ci + dc]; if (!k) return; v = v.trim();
          if (ci + dc < 2) t[k] = v; else { t.스펙 = t.스펙 || {}; if (v) t.스펙[k] = v; else delete t.스펙[k]; }
        });
      });
      const over = Math.max(...rows.map(r => r.length)) - (c.length - ci);
      redraw();
      toast(`${rows.length}행 붙여넣음${over > 0 ? ` — 열이 ${over}개 모자라 잘린 값이 있습니다 ([+ 스펙 항목]으로 열 추가)` : ''}`, 4000);
    });
    return el;
  };
  const colHead = (name, i) => {
    const el = h('input', { value: name });
    el.addEventListener('change', () => {  // 열 이름 변경 → 모든 제품의 값도 함께 이동
      const v = el.value.trim();
      if (!v || (v !== name && g.스펙항목.includes(v))) { el.value = name; return toast(v ? '같은 이름의 항목이 이미 있습니다' : '항목 이름은 비울 수 없습니다'); }
      for (const it of g.제품) if (it.스펙 && name in it.스펙) { it.스펙[v] = it.스펙[name]; delete it.스펙[name]; }
      g.스펙항목[i] = v; normalizeSpec(g); redraw();
    });
    return h('th', { class: 'colhead' }, h('div', { class: 'colbar' },
      h('button', { class: 'cb', title: '왼쪽으로', onclick: () => { if (move(g.스펙항목, i, -1)) { normalizeSpec(g); redraw(); } } }, '◀'), el,
      h('button', { class: 'cb', title: '오른쪽으로', onclick: () => { if (move(g.스펙항목, i, 1)) { normalizeSpec(g); redraw(); } } }, '▶'),
      h('button', { class: 'cb', title: '항목 삭제', onclick: async () => {
        const n = g.제품.filter(it => it.스펙 && it.스펙[name]).length;
        if (n && !await ask({ title: '스펙 항목 삭제', body: `'${esc(name)}' 항목과 제품 ${n}개의 값이 함께 삭제됩니다.`, ok: '삭제', danger: true })) return;
        g.스펙항목.splice(i, 1); normalizeSpec(g); redraw();
      } }, '✕')));
  };
  tbody = h('tbody', {}, g.제품.map((it, ri) => {
    const bk = baseItems.get(`${f.id}/${it.id}`);
    const cls = !it.id || !bk ? 'new' : (bk !== JSON.stringify(it) ? 'mod' : '');
    return h('tr', { class: cls },
      h('td', { class: 'num' }, ri + 1),
      h('td', { class: 'w-name' }, cell(it, ri, 0)), h('td', { class: 'w-app' }, cell(it, ri, 1)),
      g.스펙항목.map((_, ci) => h('td', {}, cell(it, ri, ci + 2))),
      act(ib('↑', '위로', () => move(g.제품, ri, -1) && redraw()), ib('↓', '아래로', () => move(g.제품, ri, 1) && redraw()),
        ib('✕', '행 삭제', () => { g.제품.splice(ri, 1); redraw(); toast(`'${it.품명 || '빈 행'}' 삭제됨 — 반영 전이면 [변경 취소]로 되돌릴 수 있습니다`); }, 'x')));
  }));
  return h('div', { class: 'group' },
    h('div', { class: 'group-head' },
      inp(g, '이름', { cls: '', ph: '소그룹 이름 (표 위 소제목 — 없으면 비움)' }),
      h('button', { class: 'btn sm', onclick: () => { g.제품.push(newItem()); redraw(); } }, '+ 행'),
      h('button', { class: 'btn sm', onclick: async () => {
        const n = await ask({ title: '스펙 항목(열) 추가', body: '표에 새 열을 추가합니다. (예: 점도, BET, pH)', input: { placeholder: '항목 이름' }, ok: '추가' });
        if (!n) return;
        if (g.스펙항목.includes(n)) return toast('같은 이름의 항목이 이미 있습니다');
        g.스펙항목.push(n); redraw();
      } }, '+ 스펙 항목'),
      h('span', { class: 'muted' }, `${g.제품.length}개`),
      h('span', { class: 'top-spacer' }),
      h('button', { class: 'btn sm ghost', title: '표 위로', onclick: () => move(f.소그룹, gi, -1) && redraw() }, '↑'),
      h('button', { class: 'btn sm ghost', title: '표 아래로', onclick: () => move(f.소그룹, gi, 1) && redraw() }, '↓'),
      h('button', { class: 'btn sm danger', onclick: async () => {
        if (g.제품.length && !await ask({ title: '표 삭제', body: `이 표와 제품 ${g.제품.length}개를 삭제할까요?`, ok: '삭제', danger: true })) return;
        f.소그룹.splice(gi, 1); redraw();
      } }, '표 삭제')),
    h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
      h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, '품명'), h('th', {}, 'Application'), g.스펙항목.map(colHead), h('th', { class: 'act' }))),
      tbody)));
}

/* ---------- 5-1. 엑셀 내려받기 / 불러오기 / 전체 백업 ----------
   SheetJS(admin/vendor/xlsx.full.min.js, Apache-2.0)를 처음 쓸 때만 불러온다.
   제품군 파일 규칙: 시트 1개 = 사이트의 표(소그룹) 1개, 1행 = 품명 | Application | 스펙 항목… | ID(수정금지)
   불러오기는 바로 적용하지 않고 미리보기(추가/변경/그대로/엑셀에 없음/오류) 후 적용 → [변경 확인·반영]으로 사이트 반영 */
let xlsxLoading = null;
function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  xlsxLoading = xlsxLoading || new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = 'vendor/xlsx.full.min.js';
    s.onload = () => ok(window.XLSX);
    s.onerror = () => { xlsxLoading = null; no(new Error('엑셀 모듈을 불러오지 못했습니다')); };
    document.head.append(s);
  });
  return xlsxLoading;
}
const ID_COL = 'ID(수정금지)';
const stamp = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');
const safeFile = s => s.replace(/[\\/:*?"<>|]/g, ' ');
function sheetName(name, used) {  // 엑셀 시트 이름 규칙(31자, 특수문자 금지)에 맞추고 중복 방지
  const n = String(name || '표').replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || '표';
  let k = n, i = 2;
  while (used.has(k)) k = `${n.slice(0, 27)}_${i++}`;
  used.add(k); return k;
}
function textSheet(X, aoa, widths) {  // 모든 칸을 '텍스트' 형식으로 → 엑셀이 "1-2"를 날짜로 바꾸는 것 방지
  const ws = X.utils.aoa_to_sheet(aoa);
  for (const k of Object.keys(ws)) if (k[0] !== '!') { ws[k].t = 's'; ws[k].v = String(ws[k].v ?? ''); ws[k].z = '@'; }
  ws['!cols'] = widths.map(w => ({ wch: w }));
  return ws;
}
const groupSheetNames = f => { const used = new Set(['안내']); return f.소그룹.map((g, i) => sheetName(g.이름 || `표${i + 1}`, used)); };

async function exportFamily(b, f) {
  let X; try { X = await loadXLSX(); } catch (e) { return toast(e.message); }
  const wb = X.utils.book_new(), names = groupSheetNames(f);
  const guide = [
    [`케미프렌드 홈페이지 — ${b.회사명} > ${f.이름} 스펙표 (${new Date().toLocaleDateString('ko-KR')} 내려받음)`], [''],
    ['· 시트 하나 = 사이트의 표 하나 (시트 이름 = 표 위 소제목). 시트를 새로 만들면 표가 추가됩니다'],
    ['· 1행은 열 제목: "품명", "Application"은 고정. 나머지는 스펙 항목 — 열 추가·이름 변경 가능'],
    ['· 행 추가 = 제품 추가, 칸 수정 = 수정. 품명이 같은 제품이 두 번 있으면 안 됩니다'],
    ['· 맨 오른쪽 "ID(수정금지)" 열은 그대로 두세요 (새 제품은 비워두기). 품명을 바꿔도 이 ID로 같은 제품임을 알아봅니다'],
    ['· 행을 지워도 바로 삭제되지 않습니다 — 불러올 때 삭제할지 고를 수 있습니다'],
    ['· 다 고쳤으면 저장 → 관리자 페이지 [엑셀 불러오기] → 미리보기 확인 → 적용 → 오른쪽 위 [변경 확인·반영]'],
    ['· 이 "안내" 시트는 불러올 때 무시됩니다'],
  ];
  X.utils.book_append_sheet(wb, textSheet(X, guide, [110]), '안내');
  f.소그룹.forEach((g, i) => {
    const head = ['품명', 'Application', ...g.스펙항목, ID_COL];
    const rows = g.제품.map(it => [it.품명, it.용도 || '', ...g.스펙항목.map(c => (it.스펙 || {})[c] || ''), it.id]);
    for (let k = 0; k < 50; k++) rows.push(head.map(() => ''));  // 빈 행도 텍스트 형식으로 미리 준비
    X.utils.book_append_sheet(wb, textSheet(X, [head, ...rows], [28, 38, ...g.스펙항목.map(() => 16), 22]), names[i]);
  });
  X.writeFile(wb, safeFile(`${b.회사명}_${f.이름}_${stamp()}.xlsx`));
}

const canon = it => JSON.stringify([String(it.품명 || ''), String(it.용도 || ''), Object.entries(it.스펙 || {}).filter(([, v]) => v).sort()]);
async function importFamily(b, f, file) {
  let X; try { X = await loadXLSX(); } catch (e) { return toast(e.message); }
  let wb; try { wb = X.read(await file.arrayBuffer(), { type: 'array' }); } catch (e) { return toast('엑셀 파일을 읽을 수 없습니다'); }
  const errs = [], warns = [], groups = [], seenName = new Map(), link = new Map();
  const oldItems = []; f.소그룹.forEach(g => g.제품.forEach(it => oldItems.push({ it, g })));
  const byId = new Map(oldItems.map(o => [o.it.id, o]));
  const byName = new Map(oldItems.map(o => [String(o.it.품명).trim().toLowerCase(), o]));
  const nameOfSheet = new Map(groupSheetNames(f).map((n, i) => [n, f.소그룹[i].이름]));
  const colLetter = i => (i >= 26 ? String.fromCharCode(64 + Math.floor(i / 26)) : '') + String.fromCharCode(65 + (i % 26));
  for (const sn of wb.SheetNames) {
    if (sn === '안내') continue;
    const rows = X.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '', raw: false, blankrows: false });
    if (!rows.length) continue;
    const head = rows[0].map(x => String(x ?? '').trim());
    if (head[0] !== '품명' || !['Application', '용도'].includes(head[1])) { errs.push(`[${sn}] 1행이 "품명", "Application"으로 시작해야 합니다`); continue; }
    const idc = head.indexOf(ID_COL), specIdx = [], cols = [];
    head.forEach((name, i) => {
      if (i < 2 || i === idc) return;
      if (!name) { if (rows.slice(1).some(r => String(r[i] ?? '').trim())) errs.push(`[${sn}] ${colLetter(i)}열: 제목 없는 열에 값이 있습니다`); return; }
      if (cols.includes(name)) return errs.push(`[${sn}] 열 제목 중복: ${name}`);
      cols.push(name); specIdx.push(i);
    });
    const g = { 이름: nameOfSheet.has(sn) ? nameOfSheet.get(sn) : sn, 스펙항목: cols, 제품: [] };
    rows.slice(1).forEach((r, ri) => {
      const c = head.map((_, i) => String(r[i] ?? '').trim());
      if (!r.some(x => String(x ?? '').trim())) return;
      const line = `[${sn}] ${ri + 2}행`, name = c[0];
      if (!name) return errs.push(`${line}: 품명이 비어 있습니다`);
      const key = name.toLowerCase();
      if (seenName.has(key)) return errs.push(`${line}: 품명 '${name}'이(가) ${seenName.get(key)}와 중복`);
      seenName.set(key, line);
      if (PHONE_RE.test(c.join(' '))) warns.push(`${line}: 전화번호 같은 값이 있습니다 — 확인하세요`);
      const idv = idc >= 0 ? c[idc] : '';
      const old = (idv && byId.get(idv)) || byName.get(key);
      if (idv && !byId.has(idv)) warns.push(`${line}: ID '${idv}'가 이 제품군에 없어 새 제품으로 처리합니다`);
      const spec = {}; specIdx.forEach(i => { if (c[i]) spec[head[i]] = c[i]; });
      const it = { id: old ? old.it.id : '', 품명: name, 용도: c[1], 스펙: spec };
      g.제품.push(it); link.set(it, old);
    });
    groups.push(g);
  }
  if (!groups.length && !errs.length) errs.push('읽을 수 있는 시트가 없습니다 (내려받은 양식을 사용하세요)');

  const add = [], mod = [], matched = new Set(); let same = 0;
  for (const g of groups) for (const it of g.제품) {
    const o = link.get(it);
    if (!o) { add.push(it.품명); continue; }
    if (matched.has(o.it)) { errs.push(`'${it.품명}': 같은 기존 제품에 두 행이 연결됨 (ID 열 확인)`); continue; }
    matched.add(o.it);
    (canon(o.it) === canon(it) && o.g.이름 === g.이름) ? same++ : mod.push(it.품명);
  }
  const missing = oldItems.filter(o => !matched.has(o.it));
  if (oldItems.length && !matched.size) warns.push('기존 제품과 하나도 일치하지 않습니다 — 다른 제품군의 파일이 아닌지 확인하세요');
  const colsChanged = JSON.stringify(f.소그룹.map(g => [g.이름, g.스펙항목])) !== JSON.stringify(groups.map(g => [g.이름, g.스펙항목]));

  const list = (arr, cls) => arr.length ? h('div', { class: 'muted', style: 'margin:4px 0 10px' }, cls ? h(cls, {}, arr.slice(0, 40).join(', ')) : arr.slice(0, 40).join(', '), arr.length > 40 ? ` 외 ${arr.length - 40}` : '') : null;
  const delBox = h('input', { type: 'checkbox' });
  const body = h('div', {},
    h('p', { class: 'muted' }, `${file.name} → ${b.회사명} > ${f.이름}`),
    errs.length ? h('div', { class: 'msg err' }, h('b', {}, `오류 ${errs.length}건 — 엑셀을 고친 뒤 다시 불러오세요`), h('ul', {}, errs.slice(0, 30).map(e => h('li', {}, e)))) : null,
    warns.length ? h('div', { class: 'msg warn' }, h('ul', {}, warns.slice(0, 20).map(e => h('li', {}, e)))) : null,
    h('div', { class: 'stats', style: 'margin-bottom:14px' },
      h('div', { class: 'stat' }, h('b', {}, add.length), h('span', {}, '추가')),
      h('div', { class: 'stat' }, h('b', {}, mod.length), h('span', {}, '변경')),
      h('div', { class: 'stat' }, h('b', {}, same), h('span', {}, '그대로')),
      h('div', { class: 'stat' }, h('b', {}, missing.length), h('span', {}, '엑셀에 없는 기존 제품'))),
    add.length ? h('div', {}, h('b', {}, '추가'), list(add, 'ins')) : null,
    mod.length ? h('div', {}, h('b', {}, '변경'), list(mod)) : null,
    colsChanged ? h('p', { class: 'muted' }, '표 구성(시트·열 제목)도 바뀝니다.') : null,
    missing.length ? h('div', { class: 'msg warn' },
      h('div', {}, h('b', {}, `엑셀에 없는 기존 제품 ${missing.length}개`), ' — 기본은 그대로 유지합니다.'),
      list(missing.map(o => o.it.품명)),
      h('label', { class: 'check' }, delBox, '이 제품들을 삭제')) : null);
  const shade = h('div', { class: 'shade' });
  const apply = h('button', { class: 'btn primary', disabled: errs.length > 0, onclick: () => {
    if (!delBox.checked) for (const o of missing) {  // 유지: 원래 표로 돌려놓기
      let g = groups.find(x => x.이름 === o.g.이름);
      if (!g) { g = { 이름: o.g.이름, 스펙항목: [...o.g.스펙항목], 제품: [] }; groups.push(g); }
      for (const k of Object.keys(o.it.스펙 || {})) if (!g.스펙항목.includes(k)) g.스펙항목.push(k);
      g.제품.splice(Math.min(o.g.제품.indexOf(o.it), g.제품.length), 0, o.it);  // 원래 자리에 유지
    }
    f.소그룹 = groups; shade.remove(); render(); touch();
    toast(`엑셀 내용을 적용했습니다 (추가 ${add.length} · 변경 ${mod.length}${delBox.checked ? ` · 삭제 ${missing.length}` : ''}). 오른쪽 위 [변경 확인·반영]을 눌러야 사이트에 반영됩니다.`, 6000);
  } }, '적용');
  shade.append(h('div', { class: 'modal' }, h('h3', {}, '엑셀 불러오기 미리보기'), body,
    h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => shade.remove() }, '취소'), apply)));
  document.body.append(shade);
}

async function exportBackup() {  // 현재 화면 기준 전체 내용을 엑셀 한 파일로 (보관용)
  let X; try { X = await loadXLSX(); } catch (e) { return toast(e.message); }
  const wb = X.utils.book_new(), used = new Set();
  const add = (name, aoa, w) => X.utils.book_append_sheet(wb, textSheet(X, aoa, w), sheetName(name, used));
  add('회사정보', [['항목', '내용'], ...Object.entries(company())], [22, 90]);
  add('연혁', [['연월', '내용', '내용(영문)'], ...historyList().map(x => [x.연월, x.내용, x['내용(영문)'] || ''])], [12, 60, 60]);
  const dn = Object.fromEntries(org().departments.map(d => [d.id, d['이름(한글)'] || d['이름(영문)']]));
  add('조직도', [['부서', '이름', '영문 이름', '직급', '직급(영문)', '구분', '담당분야', '이메일(공개)'],
    ...org().people.map(p => [dn[p.부서] || p.부서, p['이름(한글)'], p['이름(영문)'], p.직급, p['직급(영문)'], p.구분, p.담당분야, p['이메일(공개)']])],
    [14, 10, 18, 8, 22, 6, 30, 28]);
  add('제조사', [['id', '회사명', '표시', '국가', '설립연도', '영문 슬로건', '한국어 소개', '영문 소개', '제품 요약', '제품 요약(영문)', '로고', '문의 담당'],
    ...brands().map(b => [b.id, b.회사명, b.노출 ? '표시' : '숨김', b.국가, b.설립연도, b.영문슬로건, b.한국어소개, b['소개(영문)'] || '', b.제품요약, b['제품요약(영문)'] || '', b.로고,
      (b.문의담당 || []).map(c => personName(c.사람) + (c['분야(한글)'] ? `(${c['분야(한글)']})` : '')).join(', ') + (b.문의_영업팀전체 ? ' + 영업팀 전체' : '')])],
    [18, 14, 6, 10, 8, 30, 60, 60, 40, 40, 16, 40]);
  for (const b of brands()) {
    const keys = [];
    fams(b.id).forEach(f => f.소그룹.forEach(g => g.스펙항목.forEach(k => { if (!keys.includes(k)) keys.push(k); })));
    const rows = [];
    fams(b.id).forEach(f => f.소그룹.forEach(g => g.제품.forEach(it => rows.push([f.이름, g.이름, it.품명, it.용도 || '', ...keys.map(k => (it.스펙 || {})[k] || '')]))));
    add(`제품-${b.회사명}`, [['제품군', '소그룹', '품명', 'Application', ...keys], ...rows], [24, 26, 26, 34, ...keys.map(() => 14)]);
  }
  X.writeFile(wb, `케미프렌드_홈페이지_백업_${stamp()}.xlsx`);
  toast('전체 백업 파일을 내려받았습니다');
}

/* ---------- 6. 반영 · 복구 · 배포 상태 ---------- */
async function openReview() {
  assignIds();
  const { E, W } = validate(), sm = summary();
  const auto = '관리자: ' + [...new Set(sm.map(s => s.title.split(' — ')[0]))].join(', ') + ' 수정';
  const msgIn = h('input', { class: 'inp', value: auto });
  const body = h('div', {},
    E.length ? h('div', { class: 'msg err' }, h('b', {}, `오류 ${E.length}건 — 고친 뒤에 반영할 수 있습니다`), h('ul', {}, E.map(e => h('li', {}, e)))) : null,
    h('div', { class: 'diff' }, sm.map(s => h('div', { class: 'diff-sec' }, h('b', {}, s.title), h('ul', {}, s.lines.map(l => h('li', { html: l })))))),
    W.length ? h('details', { style: 'margin-top:12px' }, h('summary', { class: 'muted', style: 'cursor:pointer' }, `참고 ${W.length}건 (반영 가능)`),
      h('ul', { class: 'muted' }, W.slice(0, 40).map(w => h('li', {}, w)))) : null,
    h('div', { style: 'margin-top:16px' }, h('label', { class: 'muted' }, '기록에 남길 메모'), msgIn));
  const shade = h('div', { class: 'shade' });
  const pub = h('button', { class: 'btn primary', disabled: E.length > 0, onclick: async () => { const m = msgIn.value.trim() || auto; shade.remove(); await publish(m); } }, '사이트에 반영');
  shade.append(h('div', { class: 'modal' }, h('h3', {}, `변경사항 확인 (${sm.length}곳)`), body,
    h('div', { class: 'actions' }, h('button', { class: 'btn', onclick: () => shade.remove() }, '계속 수정'), pub)));
  shade.addEventListener('click', e => { if (e.target === shade) shade.remove(); });
  document.body.append(shade);
}

async function publish(message) {
  const wait = h('div', { class: 'shade' }, h('div', { class: 'modal' }, h('h3', {}, '반영 중…'), h('p', { class: 'muted', id: 'pubstep' }, '준비')));
  document.body.append(wait);
  const step = t => { const el = $('#pubstep'); if (el) el.textContent = t; };
  try {
    const paths = changedPaths();
    step('최신 상태 확인');
    const head = (await gh(`${R}/git/ref/heads/${CFG.branch}`)).object.sha;
    if (head !== S.head) {  // 그 사이 다른 사람이 반영했는지
      const cmp = await gh(`${R}/compare/${S.head}...${head}`);
      const clash = (cmp.files || []).map(f => f.filename).filter(f => paths.includes(f));
      if (clash.length) {
        wait.remove();
        return ask({ title: '다른 곳에서 먼저 수정했습니다', cancel: null, ok: '확인',
          body: `불러온 뒤에 같은 내용(${clash.map(esc).join(', ')})이 다른 곳에서 바뀌었습니다. 덮어쓰지 않도록 반영을 멈췄습니다.<br>지금 고친 내용을 메모해 두고, 페이지를 새로고침한 뒤 다시 수정해 주세요.` });
      }
    }
    const baseTree = (await gh(`${R}/git/commits/${head}`)).tree.sha;
    const entries = [];
    for (const p of paths) {
      step(`파일 올리는 중: ${p}`);
      if (S.deleted.has(p)) { entries.push({ path: p, mode: '100644', type: 'blob', sha: null }); continue; }
      const blob = S.binary[p]
        ? await gh(`${R}/git/blobs`, { method: 'POST', body: { content: S.binary[p].b64, encoding: 'base64' } })
        : await gh(`${R}/git/blobs`, { method: 'POST', body: { content: ser(S.data[p]), encoding: 'utf-8' } });
      entries.push({ path: p, mode: '100644', type: 'blob', sha: blob.sha });
    }
    step('저장(커밋)');
    const tree = await gh(`${R}/git/trees`, { method: 'POST', body: { base_tree: baseTree, tree: entries } });
    const commit = await gh(`${R}/git/commits`, { method: 'POST', body: { message, tree: tree.sha, parents: [head] } });
    await gh(`${R}/git/refs/heads/${CFG.branch}`, { method: 'PATCH', body: { sha: commit.sha } });
    // 성공 → 현재 상태를 새 기준으로
    S.head = commit.sha;
    for (const p of paths) {
      if (S.deleted.has(p)) { delete S.data[p]; delete S.base[p]; }
      else if (S.binary[p]) { const n = p.slice(13); if (!S.logos.includes(n)) S.logos.push(n); }
      else S.base[p] = ser(S.data[p]);
    }
    S.deleted.clear(); S.binary = {}; lockIds();
    wait.remove(); render();
    toast('저장했습니다. 사이트에 반영되는 중입니다 (1~2분).', 4000);
    watchDeploy(commit.sha);
  } catch (e) {
    wait.remove();
    ask({ title: '반영하지 못했습니다', cancel: null, danger: true,
      body: `${esc(e.message)}<br><br>수정한 내용은 아직 이 화면에 남아 있습니다. ${e.status === 401 ? '토큰이 만료되었을 수 있습니다 (로그아웃 후 새 토큰 입력).' : e.status === 403 || e.status === 404 ? '토큰에 이 저장소 쓰기 권한(Contents: Read and write)이 있는지 확인하세요.' : '잠시 후 다시 시도하세요.'}` });
  }
}

async function discardAll() {
  if (!await ask({ title: '변경 취소', body: '반영하지 않은 수정 내용을 모두 버리고 마지막 반영 상태로 되돌립니다.', ok: '모두 취소', danger: true })) return;
  for (const p of Object.keys(S.data)) { if (p in S.base) S.data[p] = JSON.parse(S.base[p]); else delete S.data[p]; }
  S.deleted.clear(); S.binary = {}; render();
}

async function restore(sha, label) {
  if (isDirty()) return ask({ title: '먼저 정리해 주세요', cancel: null, body: '반영하지 않은 수정 내용이 있습니다. [변경 확인·반영] 또는 [변경 취소]를 먼저 해 주세요.' });
  if (!await ask({ title: `${label} 시점으로 되돌리기`, danger: true, ok: '되돌리기',
    body: '회사정보·연혁·조직도·제조사·제품 내용을 이 시점으로 되돌립니다. (로고 이미지 파일은 그대로)<br>되돌리기도 기록에 남아서, 필요하면 다시 지금 상태로 돌아올 수 있습니다.' })) return;
  try {
    const old = await gh(`${R}/git/commits/${sha}`);
    const dataTree = (await gh(`${R}/git/trees/${old.tree.sha}`)).tree.find(e => e.path === 'data');
    const head = (await gh(`${R}/git/ref/heads/${CFG.branch}`)).object.sha;
    const baseTree = (await gh(`${R}/git/commits/${head}`)).tree.sha;
    const tree = await gh(`${R}/git/trees`, { method: 'POST', body: { base_tree: baseTree, tree: [{ path: 'data', mode: '040000', type: 'tree', sha: dataTree.sha }] } });
    const commit = await gh(`${R}/git/commits`, { method: 'POST', body: { message: `관리자: ${label} 버전으로 복구`, tree: tree.sha, parents: [head] } });
    await gh(`${R}/git/refs/heads/${CFG.branch}`, { method: 'PATCH', body: { sha: commit.sha } });
    await loadAll(); render();
    toast('되돌렸습니다. 사이트에 반영되는 중입니다 (1~2분).', 4000);
    watchDeploy(commit.sha);
  } catch (e) { ask({ title: '되돌리지 못했습니다', cancel: null, danger: true, body: esc(e.message) }); }
}

let watchTimer = null;
function setDeploy(state, text, url = '') { S.deploy = { state, text, url }; refreshChrome(); }
async function watchDeploy(sha, tries = 0) {  // 반영 후 GitHub Actions 빌드 결과 지켜보기
  clearTimeout(watchTimer);
  setDeploy('run', '사이트에 반영 중…');
  try {
    const runs = (await gh(`${R}/actions/runs?head_sha=${sha}&per_page=5`)).workflow_runs;
    const run = runs && runs[0];
    if (run && run.status === 'completed') {
      if (run.conclusion === 'success') { setDeploy('ok', `반영 완료 · ${fmtTime(run.updated_at)}`); toast('사이트에 반영되었습니다 ✓', 4000); }
      else {
        setDeploy('fail', '반영 실패 — 사이트는 이전 상태 유지 (눌러서 원인 보기)', run.html_url);
        ask({ title: '사이트 반영 실패', cancel: null, danger: true,
          body: `저장은 되었지만 사이트를 만드는 중에 오류가 났습니다. <b>사이트는 이전 상태 그대로</b>입니다.<br><br><a href="${run.html_url}" target="_blank">오류 내용 보기 ↗</a> — [build] 단계를 펼치면 어느 항목이 문제인지 나옵니다. 고친 뒤 다시 반영하거나, [버전 기록]에서 이전으로 되돌리세요.` });
      }
      return;
    }
    if (tries > 60) return setDeploy('run', '반영이 오래 걸리고 있습니다 (GitHub Actions 확인)', `https://github.com/${CFG.owner}/${CFG.repo}/actions`);
  } catch (e) {
    if (e.status === 403) return setDeploy('', '배포 상태 확인 불가 (토큰에 Actions 읽기 권한 필요)');
  }
  watchTimer = setTimeout(() => watchDeploy(sha, tries + 1), 6000);
}
async function initDeployStatus() {
  try {
    const run = (await gh(`${R}/actions/runs?branch=${CFG.branch}&per_page=1`)).workflow_runs[0];
    if (!run) return setDeploy('', '');
    if (run.status !== 'completed') return watchDeploy(run.head_sha);
    if (run.conclusion === 'success') setDeploy('ok', `사이트 정상 · 마지막 반영 ${fmtTime(run.updated_at)}`);
    else setDeploy('fail', '마지막 반영 실패 — 사이트는 그 이전 상태 (눌러서 원인 보기)', run.html_url);
  } catch (e) { setDeploy('', e.status === 403 ? '배포 상태 확인 불가 (토큰에 Actions 읽기 권한 필요)' : ''); }
}

/* ---------- 7. 로그인 · 시작 ---------- */
function logout() {
  if (isDirty() && !confirm('반영하지 않은 수정 내용이 사라집니다. 로그아웃할까요?')) return;
  localStorage.removeItem(TOKEN_KEY); location.reload();
}
function loginView(err) {
  const t = h('input', { class: 'inp', type: 'password', placeholder: 'github_pat_… 로 시작하는 토큰', autocomplete: 'off' });
  const go_ = async () => {
    const v = t.value.trim(); if (!v) return;
    localStorage.setItem(TOKEN_KEY, v);
    try {
      const repo = await gh(R);
      if (repo.permissions && !repo.permissions.push) throw Object.assign(new Error('이 토큰에는 쓰기 권한이 없습니다'), { status: 403 });
      boot();
    } catch (e) {
      localStorage.removeItem(TOKEN_KEY);
      loginView(e.status === 401 ? '토큰이 올바르지 않거나 만료되었습니다.' : e.status === 404 ? `토큰이 ${CFG.repo} 저장소에 접근할 수 없습니다 (Repository access 확인).` : e.message);
    }
  };
  t.addEventListener('keydown', e => { if (e.key === 'Enter') go_(); });
  $('#app').replaceChildren(h('div', { class: 'login' },
    h('h1', {}, '홈페이지 관리'), h('p', { class: 'muted' }, '케미프렌드 홈페이지 내용을 수정하는 곳입니다. 이 컴퓨터에서 처음 한 번만 접속 키(토큰)를 입력하면 됩니다.'),
    err ? h('div', { class: 'msg err' }, err) : null,
    h('div', { class: 'row', style: 'margin:22px 0' }, h('div', { style: 'flex:1' }, t), h('button', { class: 'btn primary', onclick: go_ }, '접속')),
    h('details', { open: !err ? null : true }, h('summary', { style: 'cursor:pointer;font-weight:700' }, '토큰 발급 방법 (관리 담당자가 1년에 한 번)'),
      h('ol', {},
        h('li', {}, 'GitHub에 ', h('b', {}, `${CFG.owner}`), ' 계정으로 로그인'),
        h('li', {}, h('a', { href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank' }, '새 토큰 만들기 페이지 ↗'), ' 열기 (Settings → Developer settings → Fine-grained tokens)'),
        h('li', {}, 'Token name: ', h('code', {}, '홈페이지관리-이름'), ' / Expiration: 최대 1년'),
        h('li', {}, 'Repository access: ', h('b', {}, 'Only select repositories'), ' → ', h('code', {}, CFG.repo)),
        h('li', {}, 'Permissions → Repository permissions: ', h('b', {}, 'Contents: Read and write'), ', ', h('b', {}, 'Actions: Read-only')),
        h('li', {}, 'Generate token → 나온 값을 복사해서 위 칸에 붙여넣기')),
      h('p', { class: 'muted' }, '토큰은 이 브라우저에만 저장됩니다. 담당자가 바뀌거나 PC를 반납할 때는 [로그아웃]하고, GitHub에서 해당 토큰을 삭제하세요.'))));
  t.focus();
}
async function boot() {
  if (!token()) return loginView();
  $('#app').replaceChildren(h('div', { class: 'login' }, h('h1', {}, '불러오는 중…'), h('p', { class: 'muted' }, '홈페이지 데이터를 가져오고 있습니다.')));
  try { await loadAll(); }
  catch (e) {
    if (e.status === 401) { localStorage.removeItem(TOKEN_KEY); return loginView('토큰이 만료되었거나 올바르지 않습니다. 새 토큰을 입력하세요.'); }
    return $('#app').replaceChildren(h('div', { class: 'login' }, h('h1', {}, '불러오지 못했습니다'), h('div', { class: 'msg err' }, e.message),
      h('button', { class: 'btn', onclick: () => location.reload() }, '다시 시도'), ' ', h('button', { class: 'btn ghost', onclick: logout }, '로그아웃')));
  }
  render(); initDeployStatus();
}
window.addEventListener('beforeunload', e => { if (S.head && isDirty()) { e.preventDefault(); e.returnValue = ''; } });
boot();
