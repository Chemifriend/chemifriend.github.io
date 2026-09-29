/* 홈페이지 문의 폼 (한국어 Contact, 영문 견적 요청 공용)
   - 전송: Web3Forms (https://web3forms.com) — 키는 data/company.json "문의폼_키" (관리자 > 회사정보)
   - 키가 비어 있거나 전송이 실패하면 작성 내용이 채워진 메일 창을 열어 문의가 사라지지 않게 한다
   - 스팸: 숨은 함정 칸(botcheck) + 3초 안에 제출하면 차단 */
(function () {
  document.querySelectorAll('form.inquiry').forEach(function (f) {
    var t0 = Date.now(), msg = f.querySelector('.form-msg'), btn = f.querySelector('button[type=submit]'), d = f.dataset;
    function show(cls, text) { msg.className = 'form-msg ' + cls; msg.textContent = text; }
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (f.botcheck && f.botcheck.checked) return;
      if (Date.now() - t0 < 3000) return show('err', d.tooFast);
      var data = new FormData(f), lines = [], body = {};
      data.forEach(function (v, k) {
        if (k === 'botcheck' || k === '_agree') return;
        v = String(v).trim(); if (!v) return;
        lines.push(k + ': ' + v); body[k] = v;
      });
      var subject = d.subject + ' — ' + (body[d.nameField] || body.email || '');
      var mailto = 'mailto:' + d.fallback + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n'));
      if (!d.key) { location.href = mailto; return show('ok', d.mailApp); }
      btn.disabled = true; show('', d.sending);
      body.access_key = d.key; body.subject = subject; body.from_name = d.fromName; body.botcheck = false;
      fetch('https://api.web3forms.com/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body)
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.success) throw new Error(j.message || 'fail');
        f.reset(); show('ok', d.ok);
      }).catch(function () {
        show('err', d.fail + ' ');
        var a = document.createElement('a'); a.href = mailto; a.textContent = d.failLink; msg.appendChild(a);
      }).then(function () { btn.disabled = false; });
    });
  });
})();
