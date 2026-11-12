/* Linkloom consent management — Google Consent Mode v2 + cookie banner.
   Must load BEFORE the GTM snippet so consent defaults are set before GTM fires. */
(function () {
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  if (!window.gtag) window.gtag = gtag;

  var stored = '';
  try { stored = localStorage.getItem('ll_consent') || ''; } catch (e) {}

  if (stored === 'all') {
    gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'granted',
      functionality_storage: 'granted',
      personalization_storage: 'granted',
      security_storage: 'granted'
    });
  } else {
    gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      functionality_storage: 'denied',
      personalization_storage: 'denied',
      security_storage: 'granted',
      wait_for_update: 500
    });
  }

  if (stored) return;

  function showBanner() {
    var s = document.createElement('style');
    s.textContent = [
      '#ll-cb{position:fixed;bottom:0;left:0;right:0;z-index:9999;',
      'background:#111;color:#fff;padding:14px 20px;',
      'display:flex;align-items:center;gap:10px;flex-wrap:wrap;',
      'font:13px/1.5 system-ui,-apple-system,sans-serif;',
      'border-top:1px solid #333}',
      '#ll-cb p{margin:0;flex:1;min-width:200px;color:#bbb}',
      '#ll-cb p a{color:#eb6273;text-underline-offset:2px}',
      '#ll-cb .ll-cba{background:#eb6273;color:#fff;border:none;',
      'padding:8px 18px;border-radius:6px;cursor:pointer;',
      'font:600 12px system-ui,sans-serif;white-space:nowrap}',
      '#ll-cb .ll-cbn{background:transparent;color:#aaa;',
      'border:1px solid #444;padding:7px 14px;border-radius:6px;',
      'cursor:pointer;font:12px system-ui,sans-serif;white-space:nowrap}',
      '#ll-cb .ll-cba:focus-visible,#ll-cb .ll-cbn:focus-visible{outline:2px solid #eb6273;outline-offset:2px}'
    ].join('');
    document.head.appendChild(s);

    var b = document.createElement('div');
    b.id = 'll-cb';
    b.setAttribute('role', 'region');
    b.setAttribute('aria-label', 'Cookie consent');
    b.innerHTML = '<p>We use analytics cookies to understand how the site is used. <a href="/cookies.html">Cookie policy</a></p>'
      + '<button class="ll-cbn" id="ll-cn">Necessary only</button>'
      + '<button class="ll-cba" id="ll-ca">Accept analytics</button>';
    document.body.appendChild(b);

    document.getElementById('ll-ca').addEventListener('click', function () {
      try { localStorage.setItem('ll_consent', 'all'); } catch (e) {}
      gtag('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'granted',
        functionality_storage: 'granted',
        personalization_storage: 'granted'
      });
      b.remove();
    });

    document.getElementById('ll-cn').addEventListener('click', function () {
      try { localStorage.setItem('ll_consent', 'necessary'); } catch (e) {}
      b.remove();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showBanner);
  } else {
    showBanner();
  }

  /* Allow users to reset their choice (called from Cookie settings link) */
  window.LLD_COOKIE_SETTINGS = function () {
    try { localStorage.removeItem('ll_consent'); } catch (e) {}
    location.reload();
  };
})();
