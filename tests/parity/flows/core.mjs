/* Shell-level interactions. Each agent owns one flows/<group>.mjs file. */
export default [
  {
    name: "tour",
    start: "home",
    steps: [
      { click: '.nav a[href="#jobs"]' },
      { click: '.nav a[href="#bids"]' },
      { click: '.nav a[href="#active"]' },
      { click: '.nav a[href="#earnings"]' },
      { click: '.nav a[href="#messages"]' },
      { click: ".sbox.me" }
    ]
  },
  {
    name: "tabbar",
    viewport: "phone",
    start: "home",
    steps: [{ click: '.tabbar a[href="#jobs"]' }, { click: '.tabbar a[href="#earnings"]' }]
  },
  {
    name: "notifications",
    start: "home",
    steps: [{ click: "#bell" }, { press: "Escape" }, { click: "#bell" }, { click: "[data-allread]" }, { click: "[data-close]" }]
  },
  {
    name: "motion-api",
    start: "home",
    pixels: false,
    steps: [
      {
        eval: `(()=>{const k=document.createElement('p');k.id='mo-keys';k.hidden=true;k.textContent=Object.keys(window.LLD.motion).sort().join(',');document.body.append(k)})()`
      }
    ]
  }
];
