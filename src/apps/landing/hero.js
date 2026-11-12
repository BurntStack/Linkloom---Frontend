// @ts-nocheck
/* part: hero */
/* hero (hx-): funkhaus P2 stripe shader + P1 headline with the P10 ring pill. One screen, one signature move. */
(() => {
  const LL = window.LL;
  if (!LL) return;
  const { G, hasG, RM, fine, $, $$ } = LL;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ───── shared stripe renderer (raw WebGL, after the funkhaus hero shader). cta.js reuses it via window.hxStripes ─────
     mode 0: diagonal stripes (hero). mode 1: rings rippling out from ctr (cta). Colours are the exact coral/violet/ink tokens. */
  const FS = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v; uniform float t,hover,intro,roll,amp,mode,sheen,zoom,off; uniform vec2 res,ctr;
float m289(float x){return x-floor(x*(1./289.))*289.;} vec4 m289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 perm(vec4 x){return m289(((x*34.)+1.)*x);}
float noise(vec3 p){vec3 a=floor(p),d=p-a;d=d*d*(3.-2.*d);vec4 b=a.xxyy+vec4(0.,1.,0.,1.);vec4 k1=perm(b.xyxy);
 vec4 k2=perm(k1.xyxy+b.zzww);vec4 c=k2+a.zzzz;vec4 k3=perm(c),k4=perm(c+1.);vec4 o1=fract(k3*(1./41.)),o2=fract(k4*(1./41.));
 vec4 o3=o2*d.z+o1*(1.-d.z);vec2 o4=o3.yw*d.x+o3.xz*(1.-d.x);return o4.y*d.y+o4.x*(1.-d.y);}
float lines(vec2 uv,float o,float s){return smoothstep(0.,.5+o*.5,abs(.5*(sin(uv.x*2.4*s)+o*2.)));}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float rnd(vec2 c){return fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  vec2 q=(v-.5)*vec2(res.x/res.y,1.)*zoom;
  vec3 pos=vec3(rot(roll)*q,0.);
  float n=noise(pos*(.6-hover*.5)+t*.07), sh=noise(pos*.15+t*.27+100.);
  vec3 bg=vec3(.0392,.0392,.0706), coral=vec3(.922,.384,.451), violet=vec3(.537,.506,.933);
  vec2 uv; float a, cut=0.;
  if(mode<.5){
    uv=rot(n*.2*(1.+3.5*hover)+1.6+hover*.3)*vec2(pos.x,pos.y*1.2);
    vec2 m=rot(-1.4)*(vec2(uv.x-5.5*intro,uv.y-1.2)*(1.-intro*.2)+3.2*hover);
    a=clamp(m.y+.2-off,0.,1.); cut=clamp(.2-m.y+off,0.,1.);
  } else {
    float r=length((q-ctr)*vec2(1.,1.12));
    uv=vec2(r*1.05-t*.05+n*1.2,0.);
    float R=(1.-intro)*12.;
    a=smoothstep(R,R-3.,r)*smoothstep(1.6,4.6,r);
  }
  float p1=lines(uv,.5,1.1), p2=mix(lines(uv,.1,1.1),1.,cut);
  vec3 col=mix(mix(violet,coral,p1),bg,p2);
  col*=1.+smoothstep(.1,.8,sh)*sheen;
  float g=rnd(gl_FragCoord.xy+fract(t*.37)*91.);
  col+=.2*(col*clamp(.1+g,0.,1.)+col*sin(gl_FragCoord.y*1.7)*.15);
  gl_FragColor=vec4(col,a*amp);
}`;
  const VS = "attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}";

  function stripes(cv, opts = {}) {
    let gl = null;
    try {
      gl = cv.getContext("webgl", {
        antialias: false,
        premultipliedAlpha: false,
        alpha: true,
        depth: false,
        stencil: false,
        powerPreference: "low-power",
      });
    } catch (e) {
      gl = null;
    }
    if (!gl) return null;
    const mk = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = mk(gl.VERTEX_SHADER, VS),
      fs = mk(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return null;
    const pr = gl.createProgram();
    gl.attachShader(pr, vs);
    gl.attachShader(pr, fs);
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {};
    ["t", "hover", "intro", "roll", "amp", "mode", "sheen", "zoom", "off", "res", "ctr"].forEach(
      n => (U[n] = gl.getUniformLocation(pr, n)),
    );
    /* hold: true freezes the last frame (no time step, no redraw) */
    const u = Object.assign(
      {
        t: 0,
        hover: 0,
        intro: 1,
        roll: -0.8,
        amp: 1,
        mode: 0,
        sheen: 0.6,
        zoom: 8,
        off: 0,
        cx: 0,
        cy: 0,
        hold: false,
      },
      opts.u || {},
    );
    const scale = () => {
      const d = devicePixelRatio || 1;
      return fine ? clamp(d / 2, 0.5, 1) : clamp(d / 2, 0.5, 0.75);
    };
    let w = 0,
      h = 0,
      lost = false;
    const size = () => {
      const s = scale(),
        nw = Math.max(2, Math.round(Math.min(cv.clientWidth * s, 1800))),
        nh = Math.max(2, Math.round(Math.min(cv.clientHeight * s, 1800)));
      if (nw === w && nh === h) return false;
      w = cv.width = nw;
      h = cv.height = nh;
      gl.viewport(0, 0, w, h);
      return true;
    };
    const draw = () => {
      if (lost) return;
      size();
      gl.uniform2f(U.res, w, h);
      gl.uniform2f(U.ctr, u.cx, u.cy);
      gl.uniform1f(U.t, u.t);
      gl.uniform1f(U.hover, u.hover);
      gl.uniform1f(U.intro, u.intro);
      gl.uniform1f(U.roll, u.roll);
      gl.uniform1f(U.amp, u.amp);
      gl.uniform1f(U.mode, u.mode);
      gl.uniform1f(U.sheen, u.sheen);
      gl.uniform1f(U.zoom, u.zoom);
      gl.uniform1f(U.off, u.off);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    cv.addEventListener("webglcontextlost", e => {
      e.preventDefault();
      lost = true;
      opts.onLost && opts.onLost();
    });
    /* animate only while on screen and the tab is visible; touch devices draw at about 30 fps */
    let vis = false,
      running = false,
      skip = 0;
    const step = opts.step || 0.05;
    const tick = (time, dt) => {
      if (!vis || document.hidden || u.hold) return;
      if (!fine && (skip ^= 1)) return;
      u.t += step * (fine ? 1 : 2) * clamp((dt || 16.7) / 16.7, 0.5, 3);
      draw();
    };
    const start = () => {
      if (running || RM) return;
      running = true;
      if (hasG) G.ticker.add(tick);
      else {
        let last = performance.now();
        const raf = now => {
          tick(now, now - last);
          last = now;
          requestAnimationFrame(raf);
        };
        requestAnimationFrame(raf);
      }
    };
    new IntersectionObserver(
      ([e]) => {
        vis = e.isIntersecting;
        if (vis) start();
      },
      { rootMargin: "80px 0px" },
    ).observe(opts.watch || cv);
    if (window.ResizeObserver)
      new ResizeObserver(() => {
        if (size() || RM) draw();
      }).observe(cv);
    draw();
    return { u, draw };
  }
  window.hxStripes = stripes;

  /* ───── hero ───── */
  const root = $("#hero");
  if (!root) return;
  const cv = $(".hx-bg", root),
    h1 = $("#hxH"),
    pill = $(".hx-pill", root),
    knot = $(".hx-knot", root),
    foot = $("[data-hx-in]", root);
  const anim = hasG && !RM;

  const sh =
    cv &&
    stripes(cv, {
      watch: root,
      u: { roll: -0.8, off: 1.4, zoom: 7, sheen: 0.55 },
      onLost: () => root.classList.add("hx-nogl"),
    });
  if (!sh) root.classList.add("hx-nogl");
  else {
    root.classList.add("hx-gl");
    if (!anim) {
      sh.u.intro = 0;
      sh.draw();
    }
  }

  /* hide what the intro reveals before the first frame (this runs before LL.boot) */
  if (anim) {
    G.set(foot, { opacity: 0, y: 24 });
    G.set(pill, { width: 0, opacity: 0 });
    G.set($$(".hx-r", knot), { opacity: 0 });
  }

  /* the one hover response: the pill's rings unhook and hook back together */
  if (anim && fine && pill) {
    let busy = false;
    pill.addEventListener("pointerenter", () => {
      if (busy) return;
      busy = true;
      const fs = parseFloat(getComputedStyle(h1).fontSize);
      G.timeline({
        onComplete: () => {
          busy = false;
        },
      })
        .to($$(".hx-rc", knot), { x: -fs * 0.1, duration: 0.35, ease: "power3.out" }, 0)
        .to($(".hx-rv", knot), { x: fs * 0.1, duration: 0.35, ease: "power3.out" }, 0)
        .to($$(".hx-r", knot), { x: 0, duration: 1, ease: "elastic.out(1,.4)" }, 0.4);
    });
  }

  LL.ready.push(() => {
    if (!anim) return;
    const fs = () => parseFloat(getComputedStyle(h1).fontSize);
    /* load: the stripes sweep in diagonally (1.9 s power4.inOut) while the headline blur-rises (core) */
    if (sh) G.to(sh.u, { intro: 0, duration: 1.9, ease: "power4.inOut", delay: 0.05 });
    /* the pill opens between "brands" and "weave" and its two rings link; then the sub copy and buttons arrive */
    G.timeline({ delay: +(h1.dataset.revealDelay || 0) })
      .fromTo(
        pill,
        { width: 0, opacity: 0 },
        { width: () => fs() * 1.52, opacity: 1, duration: 1.1, ease: "power4.inOut", clearProps: "width" },
        0.12,
      )
      .fromTo(
        $$(".hx-rc", knot),
        { x: () => -fs() * 0.32, opacity: 0 },
        { x: 0, opacity: 1, duration: 1.2, ease: "expo.out" },
        0.7,
      )
      .fromTo(
        $(".hx-rv", knot),
        { x: () => fs() * 0.32, opacity: 0 },
        { x: 0, opacity: 1, duration: 1.2, ease: "expo.out" },
        0.7,
      )
      .to(foot, { opacity: 1, y: 0, duration: 1.1, ease: "expo.out" }, 0.6);
    /* scroll: a small turn of the stripes over the first screen (capped well below the v4 warm-up) */
    if (sh)
      G.to(sh.u, {
        hover: 0.4,
        ease: "none",
        scrollTrigger: { trigger: root, start: "top top", end: "bottom top", scrub: 0.6 },
      });
  });
})();
