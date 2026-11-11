/* Linkloom Creator Dashboard: sample data. Every name, brand, number and amount here is a sample.
   Money is integer paise (₹1 = 100). "Today" is 4 Nov 2026, 10:42 IST (LLD.today()). */
window.LLD_DATA = {
  session: { signedIn: true, method: 'google', email: 'ananya.iyer@example.com', mobile: '+91 98•••••210', firstLogin: false },

  me: {
    name: 'Ananya Iyer', handle: '@ananyamakes', city: 'Mumbai', region: 'Maharashtra', dob: '2001-03-14', gender: 'Prefer not to say',
    languages: ['Hindi', 'English', 'Marathi'], categories: ['Skincare', 'Beauty', 'Lifestyle'],
    bio: 'Honest skincare for humid Mumbai weather. Routines, ingredient breakdowns and 30-day tests.',
    photo: null,
    platforms: {
      instagram: { handle: '@ananyamakes', url: 'instagram.com/ananyamakes', followers: 182000, avgViews: 64000, er: 6.8, updated: '2026-10-28', source: 'Self-reported' },
      youtube: { handle: '@AnanyaMakes', url: 'youtube.com/@AnanyaMakes', followers: 41000, avgViews: 22000, er: 5.1, updated: '2026-10-28', source: 'Self-reported' }
    },
    audienceGeo: [['Mumbai', 34], ['Pune', 12], ['Delhi NCR', 11], ['Bengaluru', 9], ['Other cities', 34]],
    completedJobs: 7, totalBids: 23,
    portfolio: [
      { title: '30 days with a ceramide moisturiser', platform: 'instagram', format: 'Reel', views: 212000, url: 'instagram.com/reel/sample1' },
      { title: 'Monsoon skincare, 5 rules', platform: 'youtube', format: 'Video', views: 48000, url: 'youtube.com/watch?v=sample2' },
      { title: 'Sunscreen under makeup test', platform: 'instagram', format: 'Reel', views: 156000, url: 'instagram.com/reel/sample3' }
    ],
    reviews: [{ brand: 'Gamla Co.', rating: 5, text: 'Delivered a day early. We reposted it twice.' }]
  },

  /* KYC states: not_started, in_progress, under_review, verified, action_needed, rejected */
  kyc: { status: 'action_needed', step: 0, returnTo: null, pan: 'ABCDE••••F', panName: 'ANANYA IYER', idType: 'Aadhaar', payoutMethod: 'upi', upi: 'ananya••••@upi', bank: { acc: '••••4821', ifsc: 'HDFC0••••12', holder: 'Ananya S Iyer' }, gst: '', note: 'Name on PAN does not match your bank account. Fix it to keep bidding.' },

  jobs: [
    { id: 'j1', brand: 'Mirevo Skincare', bi: 'MS', tone: 'c', title: 'Barrier Repair Serum launch', platform: 'instagram', format: 'Reel', category: 'Skincare', budget: 1800000, deadline: '2026-12-12', city: 'Mumbai', remote: false, languages: ['Hindi', 'English'], bids: 14, posted: '2026-11-03T18:10:00+05:30', match: 94, reasons: ['Skincare is your top category', 'Mumbai audience 34%', 'You post in Hindi and English'], deliverables: ['1 Reel, 30–45 s', 'Product on screen in the first 3 s', '1 Story with link sticker'], brief: 'Introduce the Barrier Repair Serum to humid-weather skin. Show a real morning routine, no filters. Mention the 2% ceramide complex once.', min: 'Min 50K followers', usage: 'Brand can repost for 30 days' },
    { id: 'j2', brand: 'Kaapi Kulture', bi: 'KK', tone: 'b', title: 'Filter coffee at home, Diwali edition', platform: 'instagram', format: 'Reel', category: 'Food & drink', budget: 1200000, deadline: '2026-11-07', city: 'Any city', remote: true, languages: ['English', 'Tamil'], bids: 31, posted: '2026-11-02T11:00:00+05:30', match: 71, reasons: ['Lifestyle is one of your 3 categories', 'Open to any city'], deliverables: ['1 Reel, 20–30 s', 'Brew shot with the steel dabara'], brief: 'Brew filter coffee at home the slow way and gift a pack for Diwali.', min: 'Min 20K followers', usage: 'No repost' },
    { id: 'j3', brand: 'Konkan Kinara Stays', bi: 'KN', tone: 'y', title: 'Weekend in Alibaug, travel vlog', platform: 'youtube', format: 'Video', category: 'Travel', budget: 4500000, deadline: '2026-12-05', city: 'Mumbai', remote: false, languages: ['Hindi', 'English'], bids: 9, posted: '2026-11-01T09:30:00+05:30', match: 82, reasons: ['Mumbai-based creators preferred', 'YouTube long-form'], deliverables: ['1 video, 8–12 min', '60–90 s integration', 'Pinned comment with link'], brief: 'A two-day stay at our Alibaug villa. Honest review, show the ferry ride.', min: 'Min 25K subscribers', usage: 'Brand can embed on site' },
    { id: 'j4', brand: 'Chanderi House', bi: 'CH', tone: 'c', title: 'Handloom saree styling, 3 looks', platform: 'instagram', format: 'Carousel', category: 'Fashion', budget: 950000, deadline: '2026-11-28', city: 'Any city', remote: true, languages: ['English'], bids: 22, posted: '2026-10-31T16:00:00+05:30', match: 66, reasons: ['You already style festive looks', 'English captions'], deliverables: ['1 carousel post, 5 slides', '3 styling looks'], brief: 'Style one handloom saree three ways: office, wedding guest, brunch.', min: 'Min 30K followers', usage: 'Brand can repost for 14 days' },
    { id: 'j5', brand: 'Roz Fit', bi: 'RF', tone: 'b', title: '30-day fitness app challenge', platform: 'youtube', format: 'Short', category: 'Fitness', budget: 1500000, deadline: '2026-12-18', city: 'Any city', remote: true, languages: ['Hindi', 'English'], bids: 18, posted: '2026-11-03T08:00:00+05:30', match: 58, reasons: ['You post in Hindi and English', '3 Shorts; you post weekly on YouTube'], deliverables: ['3 Shorts, 30 s each', 'Day 1, 15 and 30'], brief: 'Try the Roz Fit home workouts for 30 days and share three check-ins.', min: 'Min 10K subscribers', usage: 'No repost' },
    { id: 'j6', status: 'hired', brand: 'Gamla Co.', bi: 'GC', tone: 'y', title: 'Indoor plants for small flats', platform: 'instagram', format: 'Reel', category: 'Home', budget: 800000, deadline: '2026-11-25', city: 'Mumbai', remote: false, languages: ['English', 'Marathi'], bids: 11, posted: '2026-10-30T13:20:00+05:30', match: 77, reasons: ['You worked with Gamla Co. before', 'Mumbai'], deliverables: ['1 Reel, 30 s'], brief: 'Five low-light plants that survive a Mumbai 1BHK.', min: 'Min 20K followers', usage: 'Brand can repost for 30 days' },
    { id: 'j7', brand: 'Nimbu Pani Co', bi: 'NP', tone: 'c', title: 'Nimbu soda, 3 new flavours, blind test', platform: 'instagram', format: 'Story', category: 'Food & drink', budget: 400000, deadline: '2026-11-15', city: 'Pune', remote: false, languages: ['Marathi', 'Hindi'], bids: 6, posted: '2026-11-04T07:45:00+05:30', match: 63, reasons: ['Marathi speaker', 'Pune audience 12%'], deliverables: ['3-frame Story', 'Poll sticker'], brief: 'Blind taste test of three flavours with friends.', min: 'Min 10K followers', usage: 'No repost' },
    { id: 'j8', brand: 'Kagaz Studio', bi: 'KS', tone: 'b', title: 'Journal with me, monthly spread', platform: 'youtube', format: 'Video', category: 'Lifestyle', budget: 2200000, deadline: '2026-12-22', city: 'Any city', remote: true, languages: ['English'], bids: 4, posted: '2026-11-02T20:00:00+05:30', match: 69, reasons: ['Lifestyle category', 'Low competition: 4 bids'], deliverables: ['1 video, 6–10 min'], brief: 'Plan December in our dot-grid journal, real-time.', min: 'Min 15K subscribers', usage: 'Brand can embed on site' }
  ],
  saved: ['j3'],

  /* bid statuses: submitted, viewed, accepted, rejected, withdrawn, completed */
  bids: [
    { id: 'b1', job: 'j6', price: 800000, status: 'accepted', sent: '2026-10-31T10:00:00+05:30', note: 'Deal funded. Work can start.', postDate: '2026-11-20' },
    { id: 'b2', job: 'j2', price: 1100000, status: 'viewed', sent: '2026-11-02T15:30:00+05:30', note: 'Kaapi Kulture opened your bid.', postDate: '2026-11-06' },
    { id: 'b3', job: 'j4', price: 950000, status: 'submitted', sent: '2026-11-03T12:10:00+05:30', note: 'Waiting for the brand to review.', postDate: '2026-11-26' },
    { id: 'b4', job: 'x4', brand: 'Nimbu Pani Co', title: 'Kokum sherbet, Konkan summer', platform: 'instagram', format: 'Story', price: 450000, status: 'rejected', sent: '2026-10-25T09:00:00+05:30', note: 'Nimbu Pani Co picked another creator.', postDate: '2026-11-02' },
    { id: 'b5', job: 'x5', brand: 'Roz Fit', title: 'Navratri dance workout', platform: 'youtube', format: 'Short', price: 1500000, status: 'withdrawn', by: 'you', sent: '2026-10-08T19:00:00+05:30', note: 'You withdrew this bid.', postDate: '2026-10-15' },
    { id: 'b6', job: 'x1', price: 1400000, status: 'completed', sent: '2026-09-28T10:00:00+05:30', note: 'Approved and closed. Leave feedback for the brand.', postDate: '2026-10-10', brand: 'Mirevo Skincare', title: 'Vitamin C gel, first impressions', platform: 'instagram', format: 'Reel' }
  ],

  /* work stages: kickoff, in_progress, submitted, revision, review, approved. Payment status is separate. */
  active: [
    { id: 'a1', job: 'j6', brand: 'Gamla Co.', title: 'Indoor plants for small flats', price: 800000, stage: 'in_progress', pay: 'escrow', due: '2026-11-20', uploads: [], deliverables: ['1 Reel, 30 s'], thread: 't1' },
    { id: 'a2', job: 'x2', brand: 'Mirevo Skincare', title: 'Sunscreen reapplication, office day', platform: 'instagram', format: 'Reel', price: 1600000, stage: 'revision', pay: 'escrow', due: '2026-11-08', uploads: [{ name: 'office-sunscreen-v1.mp4', size: '48 MB', at: '2026-11-02T21:10:00+05:30' }], deliverables: ['1 Reel, 30–45 s', 'Captions in English'], revision: 'Love it. Can the hook be shorter, under 2 s?', thread: 't2' },
    { id: 'a3', job: 'x3', brand: 'Konkan Kinara Stays', title: 'Winter weekend in Lonavala', platform: 'youtube', format: 'Video', price: 3800000, stage: 'review', pay: 'escrow', due: '2026-11-06', uploads: [{ name: 'lonavala-final.mp4', size: '1.2 GB', at: '2026-11-03T17:40:00+05:30' }], deliverables: ['1 video, 10 min'], thread: 't3' }
  ],

  /* chat exists only with brands that accepted a bid */
  threads: [
    { id: 't2', brand: 'Mirevo Skincare', bi: 'MS', tone: 'c', job: 'a2', unread: 2, msgs: [
      { from: 'brand', at: '2026-11-02T21:30:00+05:30', text: 'Draft received, thank you!' },
      { from: 'brand', at: '2026-11-03T10:05:00+05:30', text: 'Love it. Can the hook be shorter, under 2 s?' },
      { from: 'brand', at: '2026-11-03T10:06:00+05:30', text: 'Everything else is approved on our side.' } ] },
    { id: 't1', brand: 'Gamla Co.', bi: 'GC', tone: 'y', job: 'a1', unread: 0, msgs: [
      { from: 'brand', at: '2026-11-01T12:00:00+05:30', text: 'Escrow is funded. Plants ship tomorrow.' },
      { from: 'me', at: '2026-11-01T12:20:00+05:30', text: 'Great, shooting this Saturday.' } ] },
    { id: 't3', brand: 'Konkan Kinara Stays', bi: 'KN', tone: 'y', job: 'a3', unread: 1, msgs: [
      { from: 'me', at: '2026-11-03T17:45:00+05:30', text: 'Final cut uploaded. The integration starts at 3:10.' },
      { from: 'brand', at: '2026-11-04T09:15:00+05:30', text: 'Watching it today, will approve by evening.' } ] }
  ],

  /* ledger: approved work; status paid, pending, failed */
  ledger: [
    { id: 'l1', date: '2026-10-14', brand: 'Mirevo Skincare', job: 'Vitamin C gel, first impressions', amount: 1400000, status: 'paid' },
    { id: 'l2', date: '2026-10-02', brand: 'Gamla Co.', job: 'Balcony herb garden', amount: 700000, status: 'paid' },
    { id: 'l3', date: '2026-09-18', brand: 'Kaapi Kulture', job: 'Cold brew at home', amount: 900000, status: 'paid' },
    { id: 'l4', date: '2026-11-01', brand: 'Chanderi House', job: 'Festive kurta haul', amount: 1100000, status: 'pending' },
    { id: 'l5', date: '2026-08-30', brand: 'Kagaz Studio', job: 'Back to college stationery', amount: 1200000, status: 'paid' },
    { id: 'l6', date: '2026-08-12', brand: 'Roz Fit', job: 'Morning stretch Short', amount: 500000, status: 'failed' }
  ],
  readyToWithdraw: 1890000,
  plan: { name: 'Creator plan', status: 'active', since: '2026-06-01', renews: '2026-12-01' }, /* subscription; no price shown in the app */
  withdrawals: [
    { id: 'w1', amount: 1260000, method: 'UPI ananya••••@upi', date: '2026-10-15', status: 'paid', ref: 'UTR 430918274405' },
    { id: 'w2', amount: 1710000, method: 'Bank a/c ••••4821', date: '2026-09-20', status: 'paid', ref: 'UTR 426317702207' }
  ],

  notifications: [
    { id: 'n1', at: '2026-11-04T09:15:00+05:30', text: 'Konkan Kinara Stays is reviewing your final cut', go: '#work-a3', read: false },
    { id: 'n2', at: '2026-11-03T10:05:00+05:30', text: 'Mirevo Skincare asked for one revision', go: '#work-a2', read: false },
    { id: 'n3', at: '2026-11-02T15:30:00+05:30', text: 'Kaapi Kulture viewed your bid', go: '#bids', read: true }
  ]
};

/* Builder B (discovery and bidding) additions. Screens also default these if missing. */
Object.assign(window.LLD_DATA, {
  /* Find Jobs filter state, kept when opening a job and coming back (mirrored to sessionStorage) */
  jobsUI: { q: '', city: '', platform: '', category: '', minBudget: 0, sort: 'match', savedOnly: false, showHidden: false },
  hiddenJobs: [],              /* jobs swiped left / hidden by the creator */
  reports: [],                 /* job reports sent from job detail */
  bidDrafts: {},               /* jobId -> unsent bid form, kept through the KYC detour */
  justSent: null,              /* bid id to highlight once on My Bids */
  /* sample bid rules: platform minimum and how far over the brand budget a bid may go */
  bidRules: { minPaise: 100000, overBudgetPct: 25, whyMin: 40, whyMax: 500, maxLinks: 5 }
});

/* Builder C (work, chat, money) additions. Only adds missing fields and new rows; nothing existing is renamed or changed.
   Ledger model: paid = released from escrow into your Linkloom balance (cleared); pending = approved, still clearing;
   failed = release did not go through (never counted). Ready to withdraw = paid rows (no per-deal fee) − withdrawals that are paid
   or processing. With these rows it reconciles to readyToWithdraw (₹18,900) exactly, in integer paise. */
(d => {
  const fill = (rows, id, f) => { const o = rows.find(x => x.id === id); if (o) for (const k in f) if (!(k in o)) o[k] = f[k]; };
  fill(d.active, 'a1', { platform: 'instagram', format: 'Reel', bid: 'b1', revisionsIncluded: 2,
    brief: 'Five low-light plants that survive a Mumbai 1BHK. Shoot in your own flat, real light, no studio.',
    usage: 'Brand can repost for 30 days', languages: ['English', 'Marathi'], accepted: '2026-10-31T10:40:00+05:30', funded: '2026-10-31T16:20:00+05:30', draftDue: '2026-11-14',
    log: [{ at: '2026-10-31T10:40:00+05:30', kind: 'accepted' }, { at: '2026-10-31T16:20:00+05:30', kind: 'funded' }, { at: '2026-11-02T09:00:00+05:30', kind: 'kickoff' }] });
  fill(d.active, 'a2', { revisionsIncluded: 2, revisionAt: '2026-11-03T10:05:00+05:30',
    brief: 'Reapply sunscreen over makeup on a real office day in Mumbai. Say SPF 50 once. No before-and-after claims.',
    usage: 'Brand can repost for 30 days', languages: ['English', 'Hindi'], accepted: '2026-10-24T11:00:00+05:30', funded: '2026-10-24T15:30:00+05:30', draftDue: '2026-11-02',
    log: [{ at: '2026-10-24T11:00:00+05:30', kind: 'accepted' }, { at: '2026-10-24T15:30:00+05:30', kind: 'funded' }, { at: '2026-10-25T10:00:00+05:30', kind: 'kickoff' },
      { at: '2026-11-02T21:10:00+05:30', kind: 'upload', file: 'office-sunscreen-v1.mp4' }, { at: '2026-11-03T10:05:00+05:30', kind: 'revision' }] });
  fill(d.active, 'a3', { revisionsIncluded: 1, liveUrl: 'youtube.com/watch?v=sample-lonavala',
    brief: 'Two winter nights at our Lonavala stay. Honest review; show the drive up the ghat, the misty mornings and the bonfire.',
    usage: 'Brand can embed on site', languages: ['Hindi', 'English'], accepted: '2026-10-12T12:30:00+05:30', funded: '2026-10-13T09:10:00+05:30', draftDue: '2026-10-31',
    log: [{ at: '2026-10-12T12:30:00+05:30', kind: 'accepted' }, { at: '2026-10-13T09:10:00+05:30', kind: 'funded' }, { at: '2026-10-14T08:00:00+05:30', kind: 'kickoff' },
      { at: '2026-11-03T17:40:00+05:30', kind: 'upload', file: 'lonavala-final.mp4' }, { at: '2026-11-03T17:44:00+05:30', kind: 'live' }] });

  fill(d.ledger, 'l4', { clears: '2026-11-08' });
  fill(d.ledger, 'l6', { reason: 'Roz Fit’s bank reversed the escrow payment. Linkloom support is recovering it; nothing for you to do.' });
  if (!d.ledger.some(l => l.id === 'l7')) d.ledger.push(
    { id: 'l7', date: '2026-10-29', brand: 'Gamla Co.', job: 'Diwali balcony plants Story', amount: 500000, status: 'paid' },
    { id: 'l8', date: '2026-05-22', brand: 'Mirevo Skincare', job: 'Summer SPF myths', amount: 1000000, status: 'paid' },
    { id: 'l9', date: '2026-02-10', brand: 'Kaapi Kulture', job: 'Pongal filter coffee Story', amount: 600000, status: 'paid' });
  if (!d.withdrawals.some(w => w.id === 'w3')) d.withdrawals.push(
    { id: 'w5', amount: 1080000, method: 'Bank a/c ••••1190', date: '2026-09-03', status: 'failed', ref: 'Returned by bank', reason: 'Account closed. The money went back to your balance.' },
    { id: 'w3', amount: 900000, method: 'UPI ananya••••@upi', date: '2026-06-02', status: 'paid', ref: 'UTR 415302116630' },
    { id: 'w4', amount: 540000, method: 'UPI ananya••••@upi', date: '2026-02-20', status: 'paid', ref: 'UTR 405112381094' });
  if (!d.payoutMethods) d.payoutMethods = [
    { id: 'upi', kind: 'UPI', label: 'ananya••••@upi', method: 'UPI ananya••••@upi', note: 'Usually reaches you in minutes' },
    { id: 'bank', kind: 'Bank', label: 'HDFC Bank ••••4821', method: 'Bank a/c ••••4821', note: 'IMPS, usually within a few hours' }];
  if (!d.workUI) d.workUI = { activeFilter: 'all', earnRange: 'fy', earnFilter: 'all', earnPick: 'l1' };
  /* readyToWithdraw = Σ paid ledger rows (subscription model: no per-deal fee, creator gets the agreed price) − Σ withdrawals that are paid or processing; pending and failed never count */
  const net = p => p;
  d.readyToWithdraw = d.ledger.filter(l => l.status === 'paid').reduce((n, l) => n + net(l.amount), 0)
    - d.withdrawals.filter(w => w.status === 'paid' || w.status === 'processing').reduce((n, w) => n + w.amount, 0);
})(window.LLD_DATA);
