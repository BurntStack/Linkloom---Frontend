/* login screen (Builder A): Continue with Google, or mobile number + 6-digit OTP.
   OTP rules: 30 s resend cooldown, 3 resends per number, 3 wrong codes locks the number for 10 min.
   Signing in sets session.signedIn; a first login goes to #setup, a returning creator to #home.
   #login-expired shows the expired-session notice. */
(() => {
  const { esc, icon, store } = LLD;
  const CODE = '246810';                     // sample code; a real build verifies on the server
  const COOLDOWN = 30, MAX_RESENDS = 3, MAX_TRIES = 3, LOCK = 600;
  const GOOGLE = { name: 'Ananya Iyer', email: 'ananya.iyer@example.com' };   // sample Google account

  // state survives re-renders inside one visit (e.g. going back to change the number)
  const S = { step: 'phone', phone: '', tries: 0, resends: 0, cooldownEnd: 0, lockEnd: 0, busy: false, account: 'new' };
  const now = () => Date.now();
  const mmss = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const fmtPhone = d => d.slice(0, 5) + ' ' + d.slice(5);
  const maskPhone = d => '+91 ' + d.slice(0, 2) + '•••••' + d.slice(7);
  const setLabel = (btn, txt) => btn.querySelectorAll('.t,.t2').forEach(s => { s.textContent = txt; });
  const press = el => { try { LLD.motion.press(el); } catch (e) {} };

  const G = `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M20.5 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h4.8a4.3 4.3 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.6-3.9 2.6-6.6z"/><path d="M12 21c2.4 0 4.5-.8 5.9-2.2L15 16.6c-.8.6-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H4v2.3A9 9 0 0 0 12 21z"/><path d="M7 13.8a5.4 5.4 0 0 1 0-3.6V7.9H4a9 9 0 0 0 0 8.2z"/><path d="M12 6.5c1.3 0 2.5.5 3.4 1.3L18 5.3A9 9 0 0 0 4 7.9l3 2.3c.7-2.1 2.7-3.7 5-3.7z"/></svg>`;

  function render(el, param) {
    const sess = store.s.session;
    const expired = param === 'expired' || sess.expired;
    if (S.step === 'otp' && !S.phone) S.step = 'phone';

    el.innerHTML = `
    <div class="focus login">
      <section class="focus-art dark login-art" aria-label="Linkloom">
        <p class="login-brand"><img src="assets/logo-mark.svg" width="28" height="28" alt=""><span>linkloom</span></p>
        <h2 class="t-display login-line">Brand deals, paid&nbsp;on&nbsp;time.</h2>
        <img class="login-rings" src="assets/hero-rings.svg" width="610" height="660" alt="">
        <p class="login-art-foot">For Instagram and YouTube creators across India</p>
      </section>

      <section class="focus-form light login-form">
        <div class="login-in">
          <div class="login-head">
            <h1 class="t-h1" tabindex="-1" data-login-h>Sign in</h1>
            <p class="muted">Find brand briefs, bid in a minute, and get paid from escrow once the work is approved.</p>
          </div>

          <div class="login-note login-note-info" data-expired ${expired ? '' : 'hidden'} role="status">
            ${icon('clock')}<p>Your session expired, so we signed you out to keep your account safe. Sign in again to pick up where you left off.</p>
          </div>
          <div class="login-note login-note-err" data-offline ${navigator.onLine ? 'hidden' : ''} role="status">
            ${icon('alert')}<p>You're offline. Check your connection, then try again.</p>
          </div>

          <div data-pane></div>

          <div class="login-sample" role="group" aria-labelledby="login-acc-l">
            <span id="login-acc-l" class="sample">Sample account</span>
            <div class="login-acc">
              <button type="button" data-acc="new" aria-pressed="${S.account === 'new'}">New creator</button>
              <button type="button" data-acc="returning" aria-pressed="${S.account === 'returning'}">Returning creator</button>
            </div>
          </div>
          <p class="login-legal">By continuing you agree to Linkloom's Terms and Privacy Policy.</p>
          <p class="sr-only" aria-live="polite" data-live></p>
        </div>
      </section>
    </div>`;

    const pane = el.querySelector('[data-pane]');
    const live = el.querySelector('[data-live]');
    const offlineNote = el.querySelector('[data-offline]');
    let timer = 0, alive = true;

    const onNet = () => { offlineNote.hidden = navigator.onLine; };
    addEventListener('online', onNet); addEventListener('offline', onNet);

    try { LLD.motion.press([...el.querySelectorAll('[data-acc]')]); } catch (e) {}
    el.querySelectorAll('[data-acc]').forEach(b => b.addEventListener('click', () => {
      S.account = b.dataset.acc;
      el.querySelectorAll('[data-acc]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    }));

    function signIn(method) {
      const isNew = S.account === 'new';
      store.set(s => {
        s.session.signedIn = true; s.session.method = method; s.session.expired = false; s.session.firstLogin = isNew;
        if (method === 'google') { s.session.email = GOOGLE.email; s.session.googleName = GOOGLE.name; }
        else { s.session.mobile = maskPhone(S.phone); }
      }, 'signed-in');
      S.step = 'phone'; S.phone = ''; S.tries = 0; S.resends = 0; S.cooldownEnd = 0;
      LLD.toast(isNew ? 'Signed in. Let\'s set up your profile.' : 'Signed in', 'check');
      LLD.go(isNew ? '#setup' : '#home');
    }

    /* ---------- step 1: Google or phone number ---------- */
    function paintPhone() {
      clearInterval(timer);
      pane.innerHTML = `
        <div class="login-pane">
          <button class="lq lq-s login-google" type="button" data-google>${G}Continue with Google</button>
          <p class="err" data-gerr hidden></p>
          <p class="login-or"><span>or use your mobile number</span></p>
          <form class="login-phone" novalidate data-phone-form>
            <div class="field" data-f>
              <label for="login-tel">Mobile number</label>
              <div class="login-tel">
                <span class="login-cc" aria-hidden="true">+91</span>
                <input class="input" id="login-tel" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="11"
                  placeholder="98765 43210" value="${esc(S.phone ? fmtPhone(S.phone) : '')}" aria-describedby="login-tel-h login-tel-e">
              </div>
              <p class="help" id="login-tel-h">We'll text a 6-digit code. Standard SMS rates may apply.</p>
              <p class="err" id="login-tel-e" aria-live="polite"></p>
            </div>
            <button class="lq lq-p login-go" type="submit">Send code ${icon('arrow', 'ic')}</button>
          </form>
        </div>`;
      LLD.liquid(pane);
      const f = pane.querySelector('[data-phone-form]'), inp = f.querySelector('input'), e = f.querySelector('.err'), fld = f.querySelector('[data-f]');
      const gBtn = pane.querySelector('[data-google]'), gErr = pane.querySelector('[data-gerr]');

      inp.addEventListener('input', () => {
        const d = inp.value.replace(/\D/g, '').slice(0, 10);
        inp.value = d.length > 5 ? fmtPhone(d) : d;
        if (fld.classList.contains('is-err')) { fld.classList.remove('is-err'); e.textContent = ''; inp.removeAttribute('aria-invalid'); }
      });

      gBtn.addEventListener('click', () => {
        if (S.busy) return;
        press(gBtn);
        gErr.hidden = true;
        if (!navigator.onLine) { gErr.textContent = 'Google sign-in needs a connection. Check your internet and try again.'; gErr.hidden = false; onNet(); return; }
        S.busy = true; gBtn.setAttribute('aria-busy', 'true'); setLabel(gBtn, 'Opening Google…');
        live.textContent = 'Opening Google sign-in';
        setTimeout(() => { S.busy = false; if (alive) signIn('google'); }, 900);
      });

      f.addEventListener('submit', ev => {
        ev.preventDefault();
        const d = inp.value.replace(/\D/g, '');
        let msg = '';
        if (!d) msg = 'Enter your mobile number.';
        else if (d.length !== 10) msg = 'Enter all 10 digits of your mobile number.';
        else if (!/^[6-9]/.test(d)) msg = 'Indian mobile numbers start with 6, 7, 8 or 9.';
        else if (!navigator.onLine) { msg = 'You\'re offline, so we couldn\'t send a code. Try again when you\'re connected.'; onNet(); }
        if (msg) { fld.classList.add('is-err'); e.textContent = msg; inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
        const btn = f.querySelector('.login-go');
        press(btn);
        if (S.phone !== d) { S.phone = d; S.tries = 0; S.resends = 0; S.lockEnd = 0; }
        S.busy = true; btn.setAttribute('aria-busy', 'true'); setLabel(btn, 'Sending…');
        setTimeout(() => {
          S.busy = false; if (!alive) return; S.step = 'otp';
          if (S.cooldownEnd < now()) S.cooldownEnd = now() + COOLDOWN * 1000;
          paintOtp(true);
        }, 600);
      });
    }

    /* ---------- step 2: six OTP boxes ---------- */
    function paintOtp(fresh) {
      clearInterval(timer);
      pane.innerHTML = `
        <div class="login-pane">
          <div class="login-otp-h">
            <p class="t-h3">Enter the 6-digit code</p>
            <p class="muted">Sent to <b class="num">+91 ${esc(fmtPhone(S.phone))}</b> · <button type="button" class="btn-q" data-change>Change number</button></p>
          </div>
          <form class="login-otp" novalidate data-otp-form>
            <div class="login-boxes" role="group" aria-label="6-digit code">
              ${[0, 1, 2, 3, 4, 5].map(i => `<input class="login-box" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder=" "
                autocomplete="${i === 0 ? 'one-time-code' : 'off'}" aria-label="Digit ${i + 1} of 6" data-i="${i}">`).join('')}
            </div>
            <p class="err login-otp-err" aria-live="assertive" data-oerr></p>
            <div class="login-lock" data-lock hidden role="status"></div>
            <button class="lq lq-p login-go" type="submit" data-verify disabled>Verify and continue</button>
          </form>
          <div class="login-resend">
            <p data-resend-row></p>
            <p class="login-hint"><span class="sample">Sample</span> code: <b class="num">${CODE.slice(0, 3)} ${CODE.slice(3)}</b></p>
          </div>
        </div>`;
      LLD.liquid(pane);

      const boxes = [...pane.querySelectorAll('.login-box')];
      const form = pane.querySelector('[data-otp-form]'), err = pane.querySelector('[data-oerr]');
      const verify = pane.querySelector('[data-verify]'), lockEl = pane.querySelector('[data-lock]');
      const resendRow = pane.querySelector('[data-resend-row]');
      const code = () => boxes.map(b => b.value).join('');
      const sync = () => { verify.disabled = code().length !== 6 || S.lockEnd > now() || S.busy; };
      const clearErr = () => { err.textContent = ''; boxes.forEach(b => b.removeAttribute('aria-invalid')); form.classList.remove('is-err'); };

      pane.querySelector('[data-change]').addEventListener('click', () => { S.step = 'phone'; paintPhone(); pane.querySelector('#login-tel').focus(); });

      boxes.forEach((b, i) => {
        b.addEventListener('input', () => {
          const d = b.value.replace(/\D/g, '');
          if (d.length > 1) { fill(d, i); return; }          // some keyboards drop the whole code in one box
          b.value = d; clearErr();
          if (d && i < 5) boxes[i + 1].focus();
          sync(); if (code().length === 6) verify.focus();
        });
        b.addEventListener('keydown', e => {
          if (e.key === 'Backspace' && !b.value && i > 0) { boxes[i - 1].value = ''; boxes[i - 1].focus(); e.preventDefault(); sync(); }
          else if (e.key === 'ArrowLeft' && i > 0) { boxes[i - 1].focus(); e.preventDefault(); }
          else if (e.key === 'ArrowRight' && i < 5) { boxes[i + 1].focus(); e.preventDefault(); }
        });
        b.addEventListener('focus', () => b.select());
        b.addEventListener('paste', e => { e.preventDefault(); fill((e.clipboardData || window.clipboardData).getData('text'), 0); });
      });
      function fill(str, from) {
        const d = String(str).replace(/\D/g, '').slice(0, 6 - from).split('');
        d.forEach((c, k) => { boxes[from + k].value = c; });
        clearErr(); sync();
        const next = boxes.find(x => !x.value); (next || verify).focus();
      }

      function paintResend() {
        const left = Math.ceil((S.cooldownEnd - now()) / 1000);
        if (S.resends >= MAX_RESENDS) resendRow.innerHTML = `<span class="muted">You've used all ${MAX_RESENDS} resends for this number. Try again in 30 min, or continue with Google.</span>`;
        else if (left > 0) resendRow.innerHTML = `<span class="muted">Didn't get it? You can resend in <b class="num">${mmss(left)}</b></span>`;
        else if (!resendRow.querySelector('[data-resend]')) {
          resendRow.innerHTML = `<span class="muted">Didn't get it?</span> <button type="button" class="btn-q" data-resend>Resend code</button>`;
          resendRow.querySelector('[data-resend]').addEventListener('click', () => {
            if (!navigator.onLine) { err.textContent = 'You\'re offline, so we couldn\'t resend the code.'; onNet(); return; }
            S.resends++; S.tries = 0; S.cooldownEnd = now() + COOLDOWN * 1000;
            boxes.forEach(x => { x.value = ''; }); clearErr(); sync(); boxes[0].focus();
            live.textContent = `New code sent. ${MAX_RESENDS - S.resends} resends left.`;
            LLD.toast('New code sent to +91 ' + fmtPhone(S.phone), 'send');
            paintResend();
          });
        }
      }
      function paintLock() {
        const left = Math.ceil((S.lockEnd - now()) / 1000);
        const locked = left > 0;
        lockEl.hidden = !locked; resendRow.hidden = locked;
        boxes.forEach(b => { b.disabled = locked; if (locked) b.value = ''; });
        if (locked) {
          lockEl.innerHTML = `${icon('lock')}<div><p class="t-label">Too many wrong codes</p><p>For your safety this number is paused for <b class="num">${mmss(left)}</b>. You can continue with Google meanwhile.</p></div>`;
          err.textContent = '';
        } else if (S.lockEnd) { S.lockEnd = 0; S.tries = 0; boxes.forEach(b => { b.value = ''; }); }
        sync();
      }
      const tick = () => { paintResend(); paintLock(); };
      tick(); timer = setInterval(tick, 1000);

      form.addEventListener('submit', e => {
        e.preventDefault();
        if (verify.disabled) return;
        if (!navigator.onLine) { err.textContent = 'You\'re offline. We couldn\'t check the code; try again when you\'re connected.'; onNet(); return; }
        press(verify);
        S.busy = true; sync(); setLabel(verify, 'Checking…'); verify.setAttribute('aria-busy', 'true');
        setTimeout(() => {
          S.busy = false; if (!alive) return; verify.removeAttribute('aria-busy'); setLabel(verify, 'Verify and continue');
          if (code() === CODE) { live.textContent = 'Code verified'; signIn('mobile'); return; }
          S.tries++;
          const left = MAX_TRIES - S.tries;
          boxes.forEach(b => b.setAttribute('aria-invalid', 'true')); form.classList.add('is-err');
          if (left <= 0) { S.lockEnd = now() + LOCK * 1000; paintLock(); live.textContent = 'Too many wrong codes. This number is paused for 10 minutes.'; }
          else {
            err.textContent = `That code doesn't match. ${left} ${left === 1 ? 'try' : 'tries'} left.`;
            boxes.forEach(b => { b.value = ''; }); boxes[0].focus(); sync();
          }
        }, 700);
      });

      if (fresh) {
        live.textContent = 'Code sent to +91 ' + fmtPhone(S.phone);
        try { LLD.motion.stagger(boxes); } catch (e) {}
      }
      if (S.lockEnd <= now()) boxes[0].focus();
    }

    if (S.step === 'otp') paintOtp(false); else paintPhone();
    if (expired) el.querySelector('[data-login-h]').focus({ preventScroll: true });

    return () => { alive = false; clearInterval(timer); removeEventListener('online', onNet); removeEventListener('offline', onNet); };
  }

  LLD.register('login', { title: 'Sign in', shell: 'focus', auth: false, render });
})();
