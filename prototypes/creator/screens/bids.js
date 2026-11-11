/* My Bids (#bids): bid slips grouped into a status board, each with its own progress rail.
   Statuses: submitted, viewed, accepted, rejected, withdrawn (shows who), completed (feedback). Owner: Builder B. */
(() => {
  const L = window.LLD, esc = L.esc;
  const GROUPS = [
    { key: 'open', title: 'Waiting on brands', statuses: ['submitted', 'viewed'] },
    { key: 'won', title: 'Won', statuses: ['accepted', 'completed'] },
    { key: 'closed', title: 'Closed', statuses: ['rejected', 'withdrawn'] }
  ];
  const ORDER = ['submitted', 'viewed', 'accepted', 'rejected', 'withdrawn', 'completed'];
  const WHO = { you: 'you', brand: 'the brand', linkloom: 'Linkloom, under the cancellation rule' };

  /* rail: Sent → Viewed → Accepted → Completed, with a branch end for rejected and withdrawn */
  function rail(b) {
    const steps = ['Sent', 'Viewed', 'Accepted', 'Completed'];
    const at = { submitted: 0, viewed: 1, accepted: 2, completed: 3 }[b.status];
    if (at !== undefined) {
      return `<ol class="bids-rail" aria-label="Progress">${steps.map((t, i) => `<li class="${i < at ? 'is-done' : i === at ? 'is-now' : 'is-next'}"${i === at ? ' aria-current="step"' : ''}><span>${t}</span></li>`).join('')}</ol>`;
    }
    const by = b.by || 'you';
    const end = b.status === 'rejected' ? 'Not selected' : (by === 'you' ? 'Withdrawn by you' : `Cancelled by ${WHO[by] || by}`);
    const reached = b.status === 'rejected' ? ['Sent', 'Viewed'] : ['Sent'];
    return `<ol class="bids-rail is-${b.status}" aria-label="Progress">${reached.map(t => `<li class="is-done"><span>${t}</span></li>`).join('')}<li class="is-end" aria-current="step"><span>${esc(end)}</span></li></ol>`;
  }

  L.register('bids', {
    title: 'My bids', nav: 'bids',
    render(el) {
      const K = L.jobkit, s = K.ensure();
      s.bidsUI = s.bidsUI || { status: '' };
      const ui = s.bidsUI;

      const info = b => {
        const j = K.job(b.job);
        return {
          brand: j ? j.brand : b.brand || 'Brand', bi: j ? j.bi : L.initials(b.brand || 'B'),
          title: j ? j.title : b.title || 'Job', platform: j ? j.platform : b.platform || 'instagram', format: j ? j.format : b.format || '', job: j
        };
      };

      function slip(b) {
        const m = info(b), act = s.active.find(a => a.job === b.job);
        const thread = act && s.threads.find(t => t.id === act.thread);
        const by = b.by || 'you';
        let note = b.note || '';
        if (b.status === 'withdrawn') note = by === 'you' ? `You withdrew this bid${b.at ? ' on ' + L.fmtDate(b.at) : ''}.` : `Cancelled by ${WHO[by] || by}${b.at ? ' on ' + L.fmtDate(b.at) : ''}.`;
        const actions = [];
        if (b.status === 'submitted' || b.status === 'viewed') {
          actions.push(`<button class="lq lq-s lq-sm" type="button" data-withdraw="${esc(b.id)}">Withdraw bid</button>`);
          if (m.job) actions.push(`<a class="btn-q" href="#job-${esc(m.job.id)}">View brief</a>`);
        } else if (b.status === 'accepted') {
          actions.push(`<a class="lq lq-p lq-sm" href="${act ? '#work-' + esc(act.id) : '#active'}">Open active job</a>`);
          if (thread) actions.push(`<a class="btn-q" href="#chat-${esc(thread.id)}">${L.icon('chat')}Message ${esc(m.brand)}</a>`);
        } else if (b.status === 'completed') {
          if (b.feedback) actions.push(`<p class="bids-fb">${L.icon('check')}You rated ${esc(m.brand)} ${b.feedback.rating}/5</p>`);
          else actions.push(`<button class="lq lq-p lq-sm" type="button" data-feedback="${esc(b.id)}">Leave feedback</button>`);
          actions.push(`<a class="btn-q" href="#earnings">See payout</a>`);
        } else if (b.status === 'rejected') {
          actions.push(`<button class="btn-q" type="button" data-similar="${esc(m.job ? m.job.category : '')}">Find similar jobs${L.icon('arrow')}</button>`);
        } else if (b.status === 'withdrawn' && m.job) {
          actions.push(`<a class="btn-q" href="#job-${esc(m.job.id)}">Open brief to bid again</a>`);
        }
        return `<article class="bids-slip is-${b.status}" data-id="${esc(b.id)}" data-status="${b.status}" aria-labelledby="bt-${esc(b.id)}">
          <div class="bids-stub">
            <p class="bids-stub-l">Your bid</p>
            <p class="bids-price t-money">${L.inr(b.price)}</p>
            <p class="bids-stub-d">Sent ${esc(L.fmtDate(b.sent))}</p>
          </div>
          <div class="bids-body">
            <div class="bids-top">
              <span class="jobs-brand"><span class="jobs-bi" aria-hidden="true">${esc(m.bi)}</span><span class="jobs-bn">${esc(m.brand)}</span></span>
              ${K.pill(b.status, b.status === 'withdrawn' ? (by === 'you' ? 'Withdrawn by you' : 'Cancelled') : '')}
            </div>
            <h3 class="bids-t" id="bt-${esc(b.id)}">${esc(m.title)}</h3>
            <p class="bids-sub">${K.glyph(m.platform)}<span>${esc(K.platName(m.platform))} ${esc(m.format)}${b.postDate ? ` · post date ${esc(L.fmtDate(b.postDate))}` : ''}</span></p>
            ${rail(b)}
            <p class="bids-note">${esc(note)}</p>
            <div class="bids-acts">${actions.join('')}</div>
          </div>
        </article>`;
      }

      const counts = () => ORDER.reduce((o, k) => (o[k] = s.bids.filter(b => b.status === k).length, o), {});

      function summary() {
        const c = counts();
        const open = c.submitted + c.viewed, won = c.accepted + c.completed, closed = c.rejected + c.withdrawn;
        return `${open} waiting on brands, ${won} won, ${closed} closed.`;
      }

      function board() {
        const list = ui.status ? s.bids.filter(b => b.status === ui.status) : s.bids;
        if (!s.bids.length) {
          return `<div class="empty bids-empty"><img src="assets/step-02-plane.svg" width="72" height="72" alt="">
            <p class="t-h2">No bids yet.</p><p class="muted">Find a brief that fits and send your first bid. It takes about a minute.</p>
            <a class="lq lq-p" href="#jobs">Find jobs</a></div>`;
        }
        if (!list.length) {
          return `<div class="empty bids-empty"><p class="t-h2">No ${esc(K.STATUS[ui.status].label.toLowerCase())} bids.</p><button class="lq lq-s" type="button" data-status="">Show all bids</button></div>`;
        }
        const sortT = (a, b) => L.D(b.sent) - L.D(a.sent);
        return GROUPS.map(g => {
          const rows = list.filter(b => g.statuses.includes(b.status)).sort(sortT);
          if (!rows.length) return '';
          return `<section class="bids-group" aria-labelledby="bg-${g.key}">
            <h2 class="bids-gh" id="bg-${g.key}"><span class="t-h2">${g.title}</span><span class="bids-gn num">${rows.length}</span></h2>
            <div class="bids-list">${rows.map(slip).join('')}</div>
          </section>`;
        }).join('');
      }

      function filters() {
        const c = counts();
        return `<button class="chip" type="button" data-status="" aria-pressed="${!ui.status}">All <span class="bids-cn">${s.bids.length}</span></button>` +
          ORDER.map(k => `<button class="chip" type="button" data-status="${k}" aria-pressed="${ui.status === k}" ${c[k] ? '' : 'disabled'}>${esc(K.STATUS[k].label)} <span class="bids-cn">${c[k]}</span></button>`).join('');
      }

      el.innerHTML = `<div class="view-in bids">
        <header class="bids-head">
          <div class="bids-head-t"><h1 class="t-h1">My bids</h1><p class="muted" id="bidsSum">${esc(summary())} <span class="sample">Sample data</span></p></div>
          <a class="lq lq-s" href="#jobs">${L.icon('search')}Find more jobs</a>
        </header>
        <div class="chips bids-filter" role="group" aria-label="Filter by status">${filters()}</div>
        <p class="sr-only" id="bidsLive" aria-live="polite"></p>
        <div class="bids-board" id="bidsBoard">${board()}</div>
      </div>`;
      L.liquid(el);

      const $ = q => el.querySelector(q);
      const refresh = (animate = true, msg) => {
        const nodes = () => L.$$('.bids-slip', el);   // live list: slips are re-rendered, matched by data-id
        const mutate = () => { $('#bidsBoard').innerHTML = board(); $('.bids-filter').innerHTML = filters(); $('#bidsSum').innerHTML = `${esc(summary())} <span class="sample">Sample data</span>`; L.liquid($('#bidsBoard')); };
        animate ? K.flip(mutate, nodes) : mutate();
        if (msg) $('#bidsLive').textContent = msg;
      };

      el.firstElementChild.addEventListener('click', e => {   // on this render's root, not the shared #view outlet
        const t = e.target.closest('button'); if (!t || !el.contains(t)) return;
        if (t.dataset.status !== undefined) {
          ui.status = t.dataset.status; refresh(true, ui.status ? `Showing ${K.STATUS[ui.status].label.toLowerCase()} bids` : 'Showing all bids');
          const same = el.querySelector(`.bids-filter [data-status="${ui.status}"]`); if (same) { same.focus(); K.settle && K.settle(same); }
        } else if (t.dataset.withdraw) withdraw(t.dataset.withdraw);
        else if (t.dataset.feedback) feedback(t.dataset.feedback);
        else if (t.dataset.similar !== undefined) {
          Object.assign(s.jobsUI, { q: '', city: '', platform: '', minBudget: 0, savedOnly: false, category: t.dataset.similar });
          K.persistUI(); L.go('#jobs');
        }
      });

      function withdraw(bid) {
        const b = s.bids.find(x => x.id === bid); if (!b) return;
        const m = info(b);
        L.openSheet({
          title: 'Withdraw this bid?',
          body: `<div class="stack bids-sheet">
            <div class="bids-mini"><span class="jobs-brand"><span class="jobs-bi" aria-hidden="true">${esc(m.bi)}</span><span class="jobs-bn">${esc(m.brand)}</span></span><p class="t-money bids-mini-p">${L.inr(b.price)}</p><p class="t-small muted">${esc(m.title)}</p></div>
            <ul class="bids-conseq">
              <li>${esc(m.brand)} sees it as withdrawn by you.</li>
              <li>You can bid again while the brief is open.</li>
              <li>Nothing is charged. No money has moved yet.</li>
            </ul>
            <div class="row wrap"><button class="lq lq-p" type="button" data-yes>Withdraw bid</button><button class="lq lq-s" type="button" data-no>Keep my bid</button></div>
          </div>`,
          onMount(body, close) {
            body.querySelector('[data-no]').addEventListener('click', () => close());
            body.querySelector('[data-yes]').addEventListener('click', () => {
              L.store.set(st => {
                const x = st.bids.find(y => y.id === bid);
                x.status = 'withdrawn'; x.by = 'you'; x.at = L.today().toISOString(); x.note = 'You withdrew this bid.';
                const jj = st.jobs.find(y => y.id === x.job); if (jj && jj.bids > 0) jj.bids -= 1;   // live count leaves out withdrawn bids
              }, 'bid-withdrawn');
              close();
              refresh(true, `Bid to ${m.brand} withdrawn`);
              L.toast('Bid withdrawn', 'check');
            });
          }
        });
      }

      function feedback(bid) {
        const b = s.bids.find(x => x.id === bid); if (!b) return;
        const m = info(b);
        const labels = ['Poor', 'Fair', 'Good', 'Very good', 'Great'];
        L.openSheet({
          title: 'Feedback for ' + m.brand,
          body: `<form class="stack bids-fbform" novalidate>
            <p class="muted">${esc(m.title)} is approved and closed. Tell other creators what working with ${esc(m.brand)} was like.</p>
            <fieldset class="bids-rate"><legend class="t-label">How was working with them?</legend>
              <div class="bids-stars">${labels.map((t, i) => `<label class="bids-star"><input type="radio" name="rate" value="${i + 1}"><span class="t-money">${i + 1}</span><small>${t}</small></label>`).join('')}</div>
            </fieldset>
            <div class="field"><label for="bidsFbTx">What went well, or what could be better? (optional)</label>
              <textarea class="textarea" id="bidsFbTx" maxlength="300" placeholder="Clear brief, quick approvals, paid on time…"></textarea>
              <p class="help num" id="bidsFbN">0 / 300</p></div>
            <p class="err" id="bidsFbErr" aria-live="polite"></p>
            <div class="row wrap"><button class="lq lq-p" type="submit">Send feedback</button><button class="lq lq-s" type="button" data-no>Later</button></div>
          </form>`,
          onMount(body, close) {
            const f = body.querySelector('form'), tx = body.querySelector('#bidsFbTx');
            tx.addEventListener('input', () => { body.querySelector('#bidsFbN').textContent = `${tx.value.length} / 300`; });
            body.querySelector('[data-no]').addEventListener('click', () => close());
            f.addEventListener('submit', e => {
              e.preventDefault();
              const r = f.querySelector('input[name=rate]:checked');
              if (!r) { body.querySelector('#bidsFbErr').textContent = 'Pick a rating from 1 to 5.'; f.querySelector('input[name=rate]').focus(); return; }
              L.store.set(st => { st.bids.find(y => y.id === bid).feedback = { rating: +r.value, text: tx.value.trim(), at: L.today().toISOString() }; }, 'bid-feedback');
              close();
              refresh(false, `Feedback sent to ${m.brand}`);
              L.toast('Feedback sent', 'check');
            });
          }
        });
      }

      K.mo('stagger', L.$$('.bids-slip', el));
      // a bid that was just sent: bring it into view and mark the moment once
      if (s.justSent) {
        const id = s.justSent; s.justSent = null;
        const n = el.querySelector(`.bids-slip[data-id="${id}"]`);
        if (n) {
          n.classList.add('is-new');
          const b = s.bids.find(x => x.id === id), m = b && info(b);
          $('#bidsLive').textContent = m ? `Bid sent to ${m.brand}` : 'Bid sent';
          L.toast(m ? `Bid sent to ${m.brand}` : 'Bid sent', 'send');
          requestAnimationFrame(() => { n.scrollIntoView({ block: 'center', behavior: L.RM ? 'auto' : 'smooth' }); K.mo('celebrate', n); });
        }
      }
    }
  });
})();
