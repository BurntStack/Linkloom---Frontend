/* Brand dashboard interactions against prototype-brand/. Sign-in uses the sample account from the design. */
const brand = { page: "brand" };
const signedOut = `(()=>{window.LLD_DATA.session.signedIn=false;})()`;

export default [
  {
    ...brand,
    name: "tour",
    start: "home",
    steps: [
      { click: '.nav a[href="#creators"]' },
      { click: '.nav a[href="#jobs"]' },
      { click: '.nav a[href="#campaigns"]' },
      { click: '.nav a[href="#payments"]' },
      { click: '.nav a[href="#reports"]' },
      { click: '.nav a[href="#messages"]' },
      { click: "#cartBtn" },
      { click: ".sbox.me" },
    ],
  },
  {
    ...brand,
    name: "tabbar",
    viewport: "phone",
    start: "home",
    steps: [
      { click: '.tabbar a[href="#creators"]' },
      { click: '.tabbar a[href="#jobs"]' },
      { click: '.tabbar a[href="#campaigns"]' },
      { click: '.tabbar a[href="#payments"]' },
    ],
  },
  {
    ...brand,
    name: "notifications",
    start: "home",
    steps: [{ click: "#bell" }, { press: "Escape" }, { click: "#bell" }, { click: "[data-close]" }],
  },
  {
    ...brand,
    name: "sign-in-errors-and-success",
    start: "login",
    preset: signedOut,
    steps: [
      { click: "[data-submit]" },
      { wait: 900 },
      { fill: ["#au-email", "nobody@example.com"] },
      { click: "[data-submit]" },
      { wait: 900 },
      { goto: "#signup" },
      { goto: "#forgot" },
      { goto: "#login" },
    ],
  },
  {
    ...brand,
    name: "first-run-setup-steps",
    start: "setup",
    preset: `(()=>{window.LLD_DATA.session.firstRun=true;})()`,
    steps: [
      { click: "[data-next]" },
      { click: "[data-fill]" },
      { click: "[data-next]" },
      { wait: 400 },
      { click: "[data-fill]" },
    ],
  },
  {
    ...brand,
    name: "post-job-validation",
    start: "post",
    steps: [{ scroll: 400 }, { scroll: 0 }],
  },
];
