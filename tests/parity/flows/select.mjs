/* The custom select (src/ui/select.ts): mouse, keyboard, typeahead, dismissal, ARIA wiring, and the native fallback.
   #jobsSort options: 0 Best match, 1 Highest budget, 2 Deadline soonest, 3 Newest, 4 Fewest bids.
   Typeahead keeps a 600 ms buffer, so anything that depends on it dispatches its keys in one step, or waits it out. */
const SORT = "#jobsSort-ui";
const CITY = "#jobsCity-ui";
const focus = sel => ({ eval: `document.querySelector(${JSON.stringify(sel)}).focus()` });
const keys = (sel, ...ks) => ({
  eval: `(()=>{const b=document.querySelector(${JSON.stringify(sel)});for(const key of ${JSON.stringify(ks)})b.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}))})()`,
});
const OUT_BUFFER = { wait: 700 };

/* The gate's full-page screenshot resizes the window, and a resize closes an open listbox. Without this, every pixel
   comparison in a reduced-motion run would shut the list between steps, so the steps after it would test the wrong state.
   A capturing listener on window runs first and stops the event. "dismiss" covers a real resize and leaves this out. */
const KEEP_OPEN_THROUGH_SCREENSHOTS = {
  eval: "addEventListener('resize',e=>e.stopImmediatePropagation(),true)",
};

/* A select with everything the real screens do not have: groups, disabled options, a blank option, a <label for>. */
const ADD_TEST_SELECT = `(()=>{
  const v=document.querySelector('#view');
  const l=document.createElement('label');l.htmlFor='tsel';l.textContent='Pick one';
  const s=document.createElement('select');s.className='select';s.id='tsel';
  s.innerHTML='<optgroup label="A &amp; B"><option value="1">One</option><option value="2" disabled>Two</option></optgroup><optgroup label="C" disabled><option value="3">Three</option></optgroup><option value="4">Four</option><option value="5"></option>';
  v.prepend(l,s);
})()`;
/* No id, so the module generates one; aria-label instead of a <label>; then the shapes it must leave alone. */
const ADD_ODD_SELECTS = `(()=>{
  const v=document.querySelector('#view');
  v.insertAdjacentHTML('afterbegin','<select class="select" aria-label="No id" aria-required="true"><option>A</option><option>B</option></select><select class="select" data-native id="n1"><option>A</option></select><select class="select" multiple id="n2"><option>A</option></select><select class="select" size="3" id="n3"><option>A</option></select><select id="n4"><option>A</option></select>');
})()`;

export default [
  {
    name: "mouse",
    pixels: false, // a screenshot blurs the page, which closes the listbox

    start: "jobs",
    steps: [
      KEEP_OPEN_THROUGH_SCREENSHOTS,
      { click: SORT },
      { hover: '.ui-lb [data-i="3"]' },
      { click: '.ui-lb [data-i="2"]' },
      { click: SORT },
      { click: SORT },
      { click: CITY },
      { click: '.ui-lb [data-i="1"]' },
      { click: CITY },
      { click: ".jobs-count" },
    ],
  },
  {
    name: "keyboard",
    start: "jobs",
    steps: [
      KEEP_OPEN_THROUGH_SCREENSHOTS,
      focus(SORT),
      { press: "ArrowDown" },
      { press: "ArrowDown" },
      { press: "ArrowDown" },
      { press: "ArrowUp" },
      { press: "End" },
      { press: "ArrowDown" },
      { press: "Home" },
      { press: "ArrowUp" },
      { press: "PageDown" },
      { press: "PageUp" },
      { press: "Enter" },
      { press: "Space" },
      { press: "ArrowDown" },
      { press: "Space" },
      { press: "Enter" },
      { press: "Escape" },
      { press: "ArrowUp" },
      { press: "Escape" },
      { press: "Home" },
      { press: "Escape" },
      { press: "End" },
      { press: "Alt+ArrowDown" },
      { press: "Escape" },
      { press: "Alt+ArrowUp" },
      { press: "Alt+ArrowDown" },
      { press: "Alt+ArrowUp" },
    ],
  },
  {
    name: "tab-commits",
    start: "jobs",
    steps: [
      KEEP_OPEN_THROUGH_SCREENSHOTS,
      focus(SORT),
      { press: "ArrowDown" },
      { press: "ArrowDown" },
      { press: "Tab" },
    ],
  },
  {
    name: "typeahead",
    start: "jobs",
    steps: [
      KEEP_OPEN_THROUGH_SCREENSHOTS,
      focus(SORT),
      { press: "d" },
      OUT_BUFFER,
      { press: "n" },
      OUT_BUFFER,
      { press: "Enter" },
      { press: "f" },
      OUT_BUFFER,
      { press: "z" },
      OUT_BUFFER,
      { press: "Escape" },
      keys(SORT, "h", "i"),
      OUT_BUFFER,
      keys(SORT, "b", "b"),
      OUT_BUFFER,
      { press: "Enter" },
      keys(SORT, "d", " ", "s"),
      OUT_BUFFER,
      { press: "Enter" },
    ],
  },
  {
    name: "dismiss",
    start: "jobs",
    pixels: false,
    steps: [
      { click: SORT },
      { eval: "dispatchEvent(new Event('resize'))" },
      { click: SORT },
      { scroll: 200 },
      { scroll: 0 },
      { click: SORT },
      { eval: `document.querySelector(${JSON.stringify(SORT)}).blur()` },
      { click: SORT },
      { goto: "#bids" },
    ],
  },
  {
    name: "label-click",
    start: "jobs",
    steps: [
      KEEP_OPEN_THROUGH_SCREENSHOTS,
      { click: 'label[for="jobsCity"]' },
      { press: "ArrowDown" },
      { press: "Escape" },
    ],
  },
  {
    name: "inside-sheet",
    pixels: false, // a screenshot blurs the page, which closes the listbox

    start: "profile",
    steps: [
      KEEP_OPEN_THROUGH_SCREENSHOTS,
      { click: "[data-edit]" },
      focus("#pe-region-ui"),
      { press: "ArrowDown" },
      { press: "ArrowDown" },
      /* Escape closes the listbox only; the sheet stays. */
      { press: "Escape" },
      { press: "Enter" },
      { click: '.ui-lb [data-i="3"]' },
      /* with the listbox closed, Escape reaches the sheet */
      { press: "Escape" },
    ],
  },
  {
    name: "groups-and-disabled",
    pixels: false, // a screenshot blurs the page, which closes the listbox

    start: "jobs",
    steps: [
      KEEP_OPEN_THROUGH_SCREENSHOTS,
      { eval: ADD_TEST_SELECT },
      { click: "#tsel-ui" },
      /* a disabled option or one in a disabled group does nothing, and the list stays open.
         dispatch, because Playwright refuses to click anything aria-disabled */
      { dispatch: '.ui-lb [data-i="1"]' },
      { dispatch: '.ui-lb [data-i="2"]' },
      { hover: '.ui-lb [data-i="1"]' },
      { hover: '.ui-lb [data-i="3"]' },
      { press: "Home" },
      { press: "ArrowDown" },
      { press: "ArrowDown" },
      { press: "End" },
      { press: "PageUp" },
      { press: "ArrowDown" },
      { press: "Enter" },
      { press: "ArrowDown" },
      { click: '.ui-lb [data-i="3"]' },
      { click: 'label[for="tsel"]' },
    ],
  },
  {
    name: "kept-in-step",
    start: "jobs",
    steps: [
      KEEP_OPEN_THROUGH_SCREENSHOTS,
      { eval: ADD_TEST_SELECT },
      { eval: "document.querySelector('#tsel').value='4'" },
      { eval: "document.querySelector('#tsel').selectedIndex=0" },
      { click: "#tsel-ui" },
      /* a programmatic set while open repaints the open list */
      { eval: "document.querySelector('#tsel').value='4'" },
      {
        eval: "document.querySelector('#tsel').insertAdjacentHTML('beforeend','<option value=\"6\">Six</option>')",
      },
      { eval: "document.querySelector('#tsel option[value=\"6\"]').textContent='Six & more'" },
      { press: "Escape" },
      { eval: "document.querySelector('#tsel').setAttribute('aria-invalid','true')" },
      { eval: "document.querySelector('#tsel').removeAttribute('aria-invalid')" },
      { eval: "document.querySelector('#tsel').setAttribute('aria-describedby','jobsCount')" },
      { eval: "document.querySelector('#tsel').className='select is-x'" },
      { eval: "document.querySelector('#tsel').disabled=true" },
      { dispatch: "#tsel-ui" },
      { eval: "document.querySelector('#tsel').disabled=false" },
      { dispatch: "#tsel-ui" },
      { press: "Escape" },
      /* a trigger with no box cannot place its list, so opening it closes it again */
      { eval: "document.querySelector('.jobs-sort').style.display='none'" },
      { dispatch: SORT },
    ],
  },
  {
    name: "generated-id-and-opt-outs",
    start: "jobs",
    steps: [
      KEEP_OPEN_THROUGH_SCREENSHOTS,
      { eval: ADD_ODD_SELECTS },
      { click: "#uisel1-ui" },
      { press: "ArrowDown" },
      { press: "Enter" },
    ],
  },
  {
    name: "native-on-phone",
    start: "jobs",
    viewport: "phone",
    steps: [{ select: ["#jobsSort", "budget"] }, { select: ["#jobsSort", "bids"] }],
  },
  {
    name: "tablet",
    start: "jobs",
    viewport: "tablet",
    steps: [KEEP_OPEN_THROUGH_SCREENSHOTS, { click: SORT }, { press: "End" }, { press: "Enter" }],
  },
];
