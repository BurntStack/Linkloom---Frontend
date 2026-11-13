// @ts-nocheck
/* Messages (#messages inbox) and one chat (#chat-<id>). Owned by Builder C.
   Chat exists only with brands that accepted a bid: a thread shows only while it is tied to an accepted, funded job (t.job -> active[]).
   Two panes on desktop; on phones the inbox and the chat are separate stacked views. Nothing is sent anywhere: delivery is simulated. */
(() => {
  const L = window.LLD,
    esc = L.esc,
    ic = L.icon;
  const C = (window.LLD_C = window.LLD_C || {});
  /* In the real app a chat can also open over a bid or an offer, before any order exists: it then stands on its own. */
  const loose = t => ({
    id: "",
    job: "",
    brand: t.brand,
    title: "Conversation",
    platform: "instagram",
    format: "",
    price: 0,
    stage: "kickoff",
    pay: "escrow",
    due: "",
    uploads: [],
    deliverables: [],
    thread: t.id,
    log: [],
    loose: true,
  });
  const jobOf = t => L.store.s.active.find(a => a.id === t.job) || (L.live ? loose(t) : undefined);
  const lastAt = t => (t.msgs[t.msgs.length - 1] || {}).at || "";
  const lastText = t => {
    const m = t.msgs.filter(x => x.from !== "sys").slice(-1)[0] || t.msgs.slice(-1)[0];
    return m ? (m.from === "me" ? "You: " : "") + m.text : "No messages yet";
  };
  const threads = () => L.store.s.threads.filter(jobOf).sort((a, b) => L.D(lastAt(b)) - L.D(lastAt(a)));
  const first = n => n.split(" ")[0];

  /* KYC and payout details never go in chat: numbers that look like them block sending; ID words get a gentle reminder */
  const BLOCK = [
    [/\b[A-Z]{5}\d{4}[A-Z]\b/i, "a PAN number"],
    [/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, "an Aadhaar number"],
    [/\b[A-Z]{4}0[A-Z0-9]{6}\b/i, "an IFSC code"],
    [/\b[\w.-]{2,}@[a-z]{2,}\b(?!\.)/i, "a UPI ID"],
    [/\b\d{9,18}\b/, "an account or phone number"],
  ];
  const SOFT = /\b(pan card|aadhaa?r|passport|voter id|driving licen[cs]e|selfie)\b/i;
  const check = v => {
    for (const [re, what] of BLOCK) if (re.test(v)) return { block: true, what };
    return SOFT.test(v) ? { block: false } : null;
  };

  const stageLine = a =>
    a.stage === "approved" ? C.STAGES[C.ix(a)].long : `${C.STAGES[C.ix(a)].long} · ${C.due(a)}`;

  function threadRow(t, cur) {
    const a = jobOf(t),
      who = C.who(a);
    return `<li data-t="${esc(t.id)}"><a class="messages-th" href="#chat-${esc(t.id)}"${t.id === cur ? ' aria-current="true"' : ""} aria-label="${esc(`${t.brand}, ${a.title}${t.unread ? `, ${t.unread} unread` : ""}`)}">
      <span class="avatar v" aria-hidden="true">${esc(t.bi || C.bi(t.brand))}</span>
      <span class="messages-th-t">
        <span class="messages-th-r"><b>${esc(t.brand)}</b><time datetime="${esc(lastAt(t))}">${esc(C.when(lastAt(t)))}</time></span>
        <span class="messages-th-job" data-who="${who}"><i aria-hidden="true"></i>${esc(a.title)}</span>
        <span class="messages-th-last">${esc(lastText(t))}</span>
      </span>
      ${t.unread ? `<span class="messages-th-n" aria-hidden="true">${t.unread}</span>` : ""}
    </a></li>`;
  }

  function render(el, param) {
    const s = L.store.s,
      list = threads();
    if (!list.length) {
      el.innerHTML = `<div class="view-in messages-none-v"><h1 class="t-h1">Messages</h1>
        <div class="empty"><img src="assets/step-01-envelope.svg" width="220" height="160" alt=""><p class="t-h2">No chats yet</p>
        <p class="muted">A chat opens when a brand accepts your bid and pays into escrow. Until then, brands can’t message you.</p>
        <div class="row wrap" style="justify-content:center"><a class="lq lq-p" href="#bids">See my bids</a><a class="lq lq-s" href="#jobs">Find jobs</a></div></div></div>`;
      return;
    }
    const t = param ? s.threads.find(x => x.id === param) : null;
    const ok = t && jobOf(t);
    const offs = [];
    el.innerHTML = `<div class="view-in messages" data-mode="${param ? "thread" : "list"}">
      <div class="messages-wrap">
        <aside class="messages-list" aria-labelledby="msgH">
          <header class="messages-list-h">
            <h1 class="t-h2" id="msgH">Messages</h1>
            <p class="help">Only brands that accepted your bid can message you. <span class="sample">Sample</span></p>
          </header>
          <ul class="messages-threads">${list.map(x => threadRow(x, param)).join("")}</ul>
        </aside>
        <section class="chat-pane" aria-label="${ok ? esc("Chat with " + t.brand) : "Chat"}">${ok ? "" : param ? missing() : placeholder()}</section>
      </div>
    </div>`;
    const ul = L.$(".messages-threads", el);
    L.motion.stagger(L.$$("li", ul));
    if (ok) offs.push(openChat(L.$(".chat-pane", el), t, ul));
    return () => offs.forEach(f => f && f());
  }

  const placeholder = () => `<div class="chat-empty">
    <img src="assets/step-01-envelope.svg" width="200" height="146" alt="">
    <p class="t-h2">Pick a chat</p>
    <ul class="chat-rules">
      <li>${ic("check")}<span>Chats open only after a brand accepts your bid.</span></li>
      <li>${ic("lock")}<span>Keep the deal here. The money stays in escrow until approval.</span></li>
      <li>${ic("shield")}<span>Never send PAN, Aadhaar, bank details or ID photos in chat.</span></li>
    </ul></div>`;
  const missing = () => `<div class="chat-empty">
    <img src="assets/step-03-lock.svg" width="200" height="146" alt="" class="chat-empty-ink">
    <p class="t-h2">This chat isn’t open</p>
    <p class="muted">Chat unlocks only with a brand that accepted your bid. If a job was cancelled, the chat closes too.</p>
    <a class="lq lq-s" href="#messages">All chats</a></div>`;

  function openChat(pane, t, ul) {
    if (L.live && !t.loaded) {
      pane.innerHTML = `<div class="chat-empty" role="status"><p class="t-h2">Loading messages…</p></div>`;
      let gone = false;
      L.live.loadThread(t.id).then(
        () => !gone && L.current()?.param === t.id && L.route(),
        () => {
          if (gone) return;
          pane.innerHTML = `<div class="chat-empty" role="alert"><p class="t-h2">We couldn't load this chat</p><p class="muted">Check your connection and try again.</p><a class="lq lq-s" href="#messages">All chats</a></div>`;
        },
      );
      return () => (gone = true);
    }
    const a = jobOf(t),
      s = L.store.s,
      fresh = t.unread;
    if (L.live) L.live.markRead(t.id).catch(() => undefined);
    if (t.unread)
      L.store.set(() => {
        t.unread = 0;
      }, "chat-read");
    const row = ul && L.$(`[data-t="${t.id}"] .messages-th-n`, ul);
    row && row.remove();
    const els = new Map();

    const meta = m => {
      if (m.from !== "me") return `<time datetime="${esc(m.at)}">${esc(C.time(m.at))}</time>`;
      const st = m.status || "delivered";
      const label = {
        sending: [ic("clock"), "Sending…"],
        sent: [ic("check"), "Sent"],
        delivered: [ic("check"), "Delivered"],
        queued: [ic("alert"), "Not sent · waiting for network"],
      }[st] || ["", ""];
      return `<time datetime="${esc(m.at)}">${esc(C.time(m.at))}</time><span class="chat-st" data-st="${st}">${label[0]}${esc(label[1])}</span>${st === "queued" ? '<button class="btn-q chat-retry" type="button">Retry</button>' : ""}`;
    };
    const item = m => {
      if (m.from === "sys") {
        const e = /escrow/i.test(m.text);
        return `<li class="chat-sys${e ? " is-escrow" : ""}"><span${e ? ' class="active-lockin"' : ""}>${e ? C.lock() : ic("info")}${esc(m.text)}</span><time datetime="${esc(m.at)}">${esc(C.time(m.at))}</time></li>`;
      }
      return `<li class="chat-msg ${m.from === "me" ? "is-me" : "is-brand"}"><p class="chat-b">${esc(m.text)}</p><p class="chat-meta">${meta(m)}</p></li>`;
    };
    const opening = a.funded || a.accepted;
    const all = () => {
      const rows = [],
        msgs = [...t.msgs];
      if (opening)
        msgs.unshift({
          from: "sys",
          at: opening,
          text: `${t.brand} accepted your bid. ${L.inr(a.price)} is in escrow.`,
          _syn: true,
        });
      msgs.sort((x, y) => L.D(x.at) - L.D(y.at));
      let day = "";
      // the "new" divider sits above the last `fresh` messages from the brand
      let newFrom = -1;
      for (let i = msgs.length - 1, left = fresh; i >= 0 && left > 0; i--)
        if (msgs[i].from === "brand") {
          newFrom = i;
          left--;
        }
      msgs.forEach((m, i) => {
        const k = C.key(L.D(m.at));
        if (k !== day) {
          day = k;
          rows.push(`<li class="chat-day"><span>${esc(C.day(m.at))}</span></li>`);
        }
        if (i === newFrom) rows.push(`<li class="chat-new"><span>${fresh} new</span></li>`);
        rows.push(item(m));
      });
      if (t.reported)
        rows.push(
          `<li class="chat-sys is-flag"><span>${ic("flag")}You reported this chat on ${esc(L.fmtDate(t.reported.at))}. Linkloom’s trust team reviews it within 24 hours.</span></li>`,
        );
      return rows.join("");
    };

    pane.innerHTML = `<div class="chat">
      <header class="chat-h">
        <a class="ibtn chat-back" href="#messages" aria-label="All chats">${ic("back")}</a>
        <span class="avatar v" aria-hidden="true">${esc(t.bi || C.bi(t.brand))}</span>
        <div class="chat-h-t"><h2 class="chat-name">${esc(t.brand)}</h2><p class="help">${a.loose ? "Linkloom chat" : `Bid accepted${a.accepted ? " " + esc(L.fmtDate(a.accepted)) : ""}`}</p></div>
        <div class="chat-more">
          <button class="chat-opt" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="chatMenu">Options${ic("down")}</button>
          <ul class="chat-menu" id="chatMenu" role="menu" aria-label="Chat options" hidden>
            ${a.loose ? "" : `<li role="none"><a role="menuitem" tabindex="-1" href="#work-${esc(a.id)}">${ic("rail")}Open the job</a></li>`}
            <li role="none"><button role="menuitem" tabindex="-1" type="button" data-report>${ic("flag")}Report this chat</button></li>
            <li role="none"><button role="menuitem" tabindex="-1" type="button" data-block>${ic("close")}<span data-block-l>${t.blocked ? "Unblock" : "Block"} ${esc(t.brand)}</span></button></li>
          </ul>
        </div>
      </header>
      <a class="chat-job" href="${a.loose ? "#bids" : "#work-" + esc(a.id)}" data-who="${C.who(a)}"${a.loose ? " hidden" : ""}>
        <span class="chat-job-t"><span class="chat-job-k">Job</span><b>${esc(a.title)}</b><span class="chat-job-s"><i aria-hidden="true"></i>${esc(stageLine(a))}</span></span>
        <span class="chat-job-m"><b class="t-money">${L.inr(a.price)}</b>${C.payPill(a)}</span>
        ${ic("chevron")}
      </a>
      <ol class="chat-log" role="log" aria-live="polite" aria-label="Messages with ${esc(t.brand)}" tabindex="0">
        <li class="chat-safe">${ic("lock")}<span>Never send PAN, Aadhaar, bank or UPI details, or ID photos, in chat. Linkloom never asks for KYC documents here.</span></li>
        ${all()}
      </ol>
      <div class="chat-foot"></div>
    </div>`;
    const log = L.$(".chat-log", pane),
      foot = L.$(".chat-foot", pane);
    const detachNet = C.net(
      L.$(".chat", pane),
      "chat-net",
      "You are offline. New messages wait and send when you are back.",
    );
    pane.querySelector(".chat-net") && L.$(".chat-h", pane).after(pane.querySelector(".chat-net"));
    const bottom = () => {
      log.scrollTop = log.scrollHeight;
    };
    requestAnimationFrame(bottom);
    const newMark = L.$(".chat-new", log);
    newMark &&
      requestAnimationFrame(() => {
        log.scrollTop = Math.max(0, newMark.offsetTop - 80);
      });

    /* composer or blocked notice */
    const drawFoot = () => {
      if (t.blocked) {
        foot.innerHTML = `<div class="chat-blocked"><p><b>You blocked ${esc(t.brand)}.</b> They can’t message you. The job and the ${L.inr(a.price)} in escrow are unchanged; Linkloom support steps in if anything is urgent.</p><button class="lq lq-s lq-sm" type="button" data-unblock>Unblock</button></div>`;
        L.liquid(foot);
        L.$("[data-unblock]", foot).addEventListener("click", () => setBlocked(false));
        return;
      }
      foot.innerHTML = `<form class="chat-compose" novalidate>
        <p class="chat-warn" id="chatWarn" role="alert" hidden></p>
        <div class="chat-compose-r">
          <label class="sr-only" for="chatIn">Message ${esc(t.brand)}</label>
          <textarea class="chat-in" id="chatIn" rows="1" maxlength="1000" placeholder="Write to ${esc(first(t.brand))}" aria-describedby="chatWarn chatHint"></textarea>
          <button class="chat-send" type="submit" aria-label="Send" data-press>${ic("send")}</button>
        </div>
        <p class="chat-hint" id="chatHint"><span class="chat-hint-k">${ic("lock")}Never send PAN, Aadhaar, bank or UPI details here.</span><span class="chat-hint-e">Enter to send, Shift + Enter for a new line</span></p>
      </form>`;
      const form = L.$("form", foot),
        inp = L.$("#chatIn", foot),
        warn = L.$("#chatWarn", foot),
        btn = L.$(".chat-send", foot);
      L.motion.press(btn);
      const grow = () => {
        inp.style.height = "auto";
        inp.style.height = Math.min(inp.scrollHeight, 160) + "px";
      };
      const lint = () => {
        const r = check(inp.value);
        warn.hidden = !r;
        warn.classList.toggle("is-soft", !!r && !r.block);
        if (r)
          warn.innerHTML = `${ic(r.block ? "alert" : "shield")}<span>${r.block ? `This looks like ${esc(r.what)}. Remove it to send; KYC and payout details never go in chat.` : "Reminder: never send ID documents or photos here. Linkloom collects them only in verification."}</span>`;
        btn.disabled = !inp.value.trim() || !!(r && r.block);
        return r;
      };
      inp.addEventListener("input", () => {
        grow();
        lint();
      });
      inp.addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          form.requestSubmit();
        }
      });
      form.addEventListener("submit", e => {
        e.preventDefault();
        const v = inp.value.trim(),
          r = lint();
        if (!v || (r && r.block)) {
          if (r && r.block && L.motion.shake) L.motion.shake(warn);
          inp.focus();
          return;
        }
        send(v);
        inp.value = "";
        grow();
        lint();
        inp.focus();
      });
      lint();
    };

    const paintMsg = m => {
      const li = els.get(m);
      if (li) li.querySelector(".chat-meta").innerHTML = meta(m);
    };
    const deliver = m => {
      if (L.live) {
        if (!navigator.onLine) {
          m.status = "queued";
          return paintMsg(m);
        }
        L.live.sendMessage(t.id, m.text).then(
          saved => {
            m.status = "delivered";
            m.id = saved.id;
            m.at = saved.at || m.at;
            paintMsg(m);
          },
          er => {
            m.status = "queued";
            paintMsg(m);
            L.toast(L.live.errorText(er), "alert");
          },
        );
        return;
      }
      setTimeout(() => {
        if (!navigator.onLine) {
          m.status = "queued";
          return paintMsg(m);
        }
        m.status = "sent";
        paintMsg(m);
        setTimeout(() => {
          if (m.status === "sent") {
            m.status = "delivered";
            paintMsg(m);
          }
        }, 900);
      }, 550);
    };
    const send = text => {
      const m = { from: "me", at: C.iso(), text, status: navigator.onLine ? "sending" : "queued" };
      L.store.set(() => {
        t.msgs.push(m);
      }, "chat-send");
      if (typeof shown === "number") shown = t.msgs.length;
      const lastDay = L.$$(".chat-day", log).pop();
      if (!lastDay || lastDay.textContent !== C.day(m.at))
        log.insertAdjacentHTML("beforeend", `<li class="chat-day"><span>${esc(C.day(m.at))}</span></li>`);
      log.insertAdjacentHTML("beforeend", item(m));
      const li = log.lastElementChild;
      els.set(m, li);
      li.classList.add("is-new");
      li.addEventListener("animationend", () => li.classList.remove("is-new"), { once: true }); // bubble settles with a slight overshoot (CSS)
      bottom();
      if (m.status === "sending") deliver(m);
      reorder();
    };
    const retryAll = () =>
      t.msgs
        .filter(m => m.status === "queued")
        .forEach(m => {
          m.status = "sending";
          paintMsg(m);
          deliver(m);
        });
    log.addEventListener("click", e => {
      if (e.target.closest(".chat-retry")) {
        if (navigator.onLine) retryAll();
        else L.toast("Still offline. It sends when you reconnect.", "alert");
      }
    });
    addEventListener("online", retryAll);

    /* keep the inbox in step: preview text, time, and order (FLIP when a thread jumps to the top) */
    const reorder = () => {
      if (!ul) return;
      const li = L.$(`[data-t="${t.id}"]`, ul);
      if (li) {
        L.$(".messages-th-last", li).textContent = lastText(t);
        const tm = L.$("time", li);
        tm.textContent = C.when(lastAt(t));
        tm.setAttribute("datetime", lastAt(t));
      }
      const items = L.$$("li", ul),
        order = threads()
          .map(x => L.$(`[data-t="${x.id}"]`, ul))
          .filter(Boolean);
      if (order.some((n, i) => n !== items[i])) L.motion.flip(() => order.forEach(n => ul.append(n)), items);
    };

    /* options menu: report, block, open job */
    const opt = L.$(".chat-opt", pane),
      menu = L.$(".chat-menu", pane),
      mi = () => L.$$("[role=menuitem]", menu);
    const closeMenu = focus => {
      menu.hidden = true;
      opt.setAttribute("aria-expanded", "false");
      if (focus) opt.focus();
    };
    const openMenu = () => {
      menu.hidden = false;
      opt.setAttribute("aria-expanded", "true");
      mi()[0].focus();
    };
    opt.addEventListener("click", () => (menu.hidden ? openMenu() : closeMenu()));
    opt.addEventListener("keydown", e => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        openMenu();
      }
    });
    menu.addEventListener("keydown", e => {
      const items = mi(),
        i = items.indexOf(document.activeElement);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        items[(i + 1) % items.length].focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        items[(i - 1 + items.length) % items.length].focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        items[0].focus();
      } else if (e.key === "End") {
        e.preventDefault();
        items[items.length - 1].focus();
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeMenu(true);
      } else if (e.key === "Tab") closeMenu();
    });
    const outside = e => {
      if (!menu.hidden && !e.target.closest(".chat-more")) closeMenu();
    };
    document.addEventListener("click", outside);
    L.$("[data-report]", menu).addEventListener("click", () => {
      closeMenu();
      report();
    });
    L.$("[data-block]", menu).addEventListener("click", () => {
      closeMenu();
      t.blocked ? setBlocked(false) : confirmBlock();
    });

    const report = () => {
      const reasons = [
        "Asked for KYC, bank or UPI details",
        "Wants to pay or talk outside Linkloom",
        "Spam or scam",
        "Rude or abusive",
        "Something else",
      ];
      L.openSheet({
        title: "Report this chat",
        body: `<form class="chat-sheet" novalidate>
          <p class="muted">Linkloom’s trust team reads the chat and replies within 24 hours. ${esc(t.brand)} is not told who reported it.</p>
          <fieldset class="chat-reasons"><legend>What happened?</legend>
            ${reasons.map((r, i) => `<label class="check"><input type="radio" name="rr" value="${esc(r)}"${i === 0 ? " checked" : ""}><span>${esc(r)}</span></label>`).join("")}
          </fieldset>
          <div class="field"><label for="rrNote">Anything else? <span class="muted">(optional)</span></label><textarea class="textarea" id="rrNote" maxlength="500" placeholder="What should the team look at?"></textarea></div>
          <p class="help chat-sheet-note">${ic("lock")}<span>Don’t paste ID or bank details here either.</span></p>
          <div class="row wrap"><button class="lq lq-p" type="submit">Send report</button><button class="lq lq-s" type="button" data-cancel>Cancel</button></div>
        </form>`,
        onMount(b, close) {
          L.$("[data-cancel]", b).addEventListener("click", () => close());
          L.$("form", b).addEventListener("submit", e => {
            e.preventDefault();
            const reason = (L.$("input[name=rr]:checked", b) || {}).value;
            if (L.live) {
              const body = `Chat with: ${t.brand} (conversation ${t.id})\nReason: ${reason}\n\n${L.$("#rrNote", b).value.trim()}`;
              window.open(`mailto:support@linkloom.in?subject=${encodeURIComponent("Report a chat: " + t.brand)}&body=${encodeURIComponent(body)}`, "_blank");
            }
            L.store.set(() => {
              t.reported = { at: C.iso(), reason, note: L.$("#rrNote", b).value.trim() };
            }, "chat-report");
            close();
            L.toast("Report sent. The trust team replies within 24 hours.", "flag");
            L.$$(".chat-sys.is-flag", log).forEach(n => n.remove());
            log.insertAdjacentHTML(
              "beforeend",
              `<li class="chat-sys is-flag"><span>${ic("flag")}You reported this chat on ${esc(L.fmtDate(t.reported.at))}. Linkloom’s trust team reviews it within 24 hours.</span></li>`,
            );
            bottom();
          });
        },
      });
    };
    const confirmBlock = () =>
      L.openSheet({
        title: `Block ${t.brand}?`,
        body: `<div class="chat-sheet">
        <ul class="chat-rules">
          <li>${ic("close")}<span>They can’t send you messages.</span></li>
          <li>${ic("lock")}<span>The job and the ${L.inr(a.price)} in escrow stay as they are.</span></li>
          <li>${ic("shield")}<span>Linkloom support handles anything urgent about the job.</span></li>
        </ul>
        <div class="row wrap"><button class="lq lq-p" type="button" data-yes>Block ${esc(first(t.brand))}</button><button class="lq lq-s" type="button" data-no>Keep chatting</button></div>
      </div>`,
        onMount(b, close) {
          L.$("[data-no]", b).addEventListener("click", () => close());
          L.$("[data-yes]", b).addEventListener("click", () => {
            close();
            setBlocked(true);
          });
        },
      });
    const setBlocked = on => {
      L.store.set(
        () => {
          t.blocked = on;
        },
        on ? "chat-block" : "chat-unblock",
      );
      L.$("[data-block-l]", menu).textContent = `${on ? "Unblock" : "Block"} ${t.brand}`;
      drawFoot();
      L.toast(on ? `${t.brand} is blocked` : `${t.brand} is unblocked`, on ? "close" : "check");
      if (!on) {
        const i = L.$("#chatIn", foot);
        i && i.focus();
      }
    };

    drawFoot();
    // map existing message objects to their nodes so delivery states can update in place
    const nodes = L.$$(".chat-msg", log),
      mine = [...t.msgs].sort((x, y) => L.D(x.at) - L.D(y.at)).filter(m => m.from !== "sys");
    nodes.forEach((n, i) => mine[i] && els.set(mine[i], n));
    L.liquid(pane);
    let shown = t.msgs.length;
    const offLive = L.store.on(why => {
      if (why !== "chat-live" || t.msgs.length <= shown) return;
      const fresh = t.msgs.slice(shown);
      shown = t.msgs.length;
      fresh.forEach(m => {
        const lastDay = L.$$(".chat-day", log).pop();
        if (!lastDay || lastDay.textContent !== C.day(m.at))
          log.insertAdjacentHTML("beforeend", `<li class="chat-day"><span>${esc(C.day(m.at))}</span></li>`);
        log.insertAdjacentHTML("beforeend", item(m));
        els.set(m, log.lastElementChild);
      });
      if (t.unread) {
        L.store.set(() => (t.unread = 0), "chat-read");
        L.live && L.live.markRead(t.id).catch(() => undefined);
      }
      bottom();
      reorder();
    });
    return () => {
      offLive();
      detachNet();
      removeEventListener("online", retryAll);
      document.removeEventListener("click", outside);
    };
  }

  L.register("messages", { title: "Messages", nav: "messages", render: el => render(el, null) });
  L.register("chat", {
    title: p => {
      const t = L.store.s.threads.find(x => x.id === p);
      return t ? "Chat with " + t.brand : "Chat";
    },
    crumb: p => {
      const t = L.store.s.threads.find(x => x.id === p);
      return '<a href="#messages">Messages</a>' + (t ? " / " + esc(t.brand) : "");
    },
    nav: "messages",
    render,
  });
})();
