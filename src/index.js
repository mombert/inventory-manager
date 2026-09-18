
/* ============ theme tokens ============ */
:root{
  --font-display:'Poppins',system-ui,sans-serif;
  --font-body:'Inter',system-ui,sans-serif;
  --font-mono:'JetBrains Mono',ui-monospace,monospace;
  --accent:#7c6cf6; --accent-soft:rgba(124,108,246,.16); --accent-brd:rgba(124,108,246,.38);
  --green:#34d399; --green-soft:rgba(52,211,153,.14);
  --amber:#fbbf24; --amber-soft:rgba(251,191,36,.15);
  --red:#f87171; --red-soft:rgba(248,113,113,.15);
}
/* dark (default — matches the mockup) */
:root[data-theme="dark"]{
  --bg:#0d1117; --bg-grad:#0f1420; --surface:#161c28; --surface-2:#1b2230;
  --raised:#202838; --ink:#e7eaf1; --ink-soft:#aab2c2; --ink-faint:#727d90;
  --rule:#262e3d; --rule-strong:#333d50; --badge:#232b3a; --badge-ink:#c2cadb;
  --shadow:0 1px 0 rgba(255,255,255,.02),0 8px 24px rgba(0,0,0,.35);
}
/* light */
:root[data-theme="light"]{
  --bg:#f5f7fb; --bg-grad:#eef2f9; --surface:#ffffff; --surface-2:#f6f8fc;
  --raised:#ffffff; --ink:#1a2233; --ink-soft:#55617a; --ink-faint:#8b95a8;
  --rule:#e6eaf2; --rule-strong:#d4dae6; --badge:#eef1f7; --badge-ink:#4a5673;
  --shadow:0 1px 2px rgba(20,30,60,.04),0 6px 18px rgba(20,30,60,.06);
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{
  font-family:var(--font-body); color:var(--ink);
  background:radial-gradient(1200px 600px at 50% -10%,var(--bg-grad),var(--bg)) fixed;
  min-height:100vh; -webkit-font-smoothing:antialiased;
}
.wrap{max-width:1360px;margin:0 auto;padding:0 22px 64px}

/* ============ top header (title now at the top, centered) ============ */
.topbar{
  display:flex;align-items:center;justify-content:flex-start;position:relative;
  padding:26px 0 18px;
}
.brand{display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left}
.brand h1{
  font-family:var(--font-display);font-weight:700;font-size:26px;letter-spacing:-.01em;margin:0;
  display:flex;align-items:center;gap:11px;color:var(--ink);
}
.brand .dot{width:18px;height:18px;border-radius:6px;background:linear-gradient(135deg,var(--accent),#a78bfa);box-shadow:0 2px 8px var(--accent-soft)}
.brand .sub{color:var(--ink-soft);font-size:13.5px}
.brand .sub b{color:var(--ink);font-weight:600}
.theme-toggle{
  position:absolute;right:0;top:26px;display:inline-flex;align-items:center;gap:8px;
  background:var(--surface);border:1px solid var(--rule);border-radius:999px;
  padding:7px 12px;cursor:pointer;color:var(--ink-soft);font-family:var(--font-body);
  font-size:13px;font-weight:500;transition:.15s;
}
.theme-toggle:hover{border-color:var(--rule-strong);color:var(--ink)}
.theme-toggle svg{width:16px;height:16px}

/* ============ action toolbar ============ */
.toolbar{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-bottom:18px}
.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:var(--font-body);font-size:14.5px;font-weight:600;
  padding:12px 17px;min-height:46px;border-radius:12px;border:1px solid var(--rule);background:var(--surface);color:var(--ink);
  cursor:pointer;transition:.15s;white-space:nowrap;touch-action:manipulation;-webkit-tap-highlight-color:transparent;
}
.btn:hover{border-color:var(--rule-strong);background:var(--surface-2)}
.btn svg{width:16px;height:16px;opacity:.85}
.btn-accent{background:var(--accent);border-color:var(--accent);color:#fff}
.btn-accent:hover{background:#6a58f0;border-color:#6a58f0}

/* ============ tabs ============ */
.tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.tab{
  display:inline-flex;align-items:center;gap:8px;font-size:14.5px;font-weight:600;
  padding:11px 16px;min-height:46px;border-radius:12px;border:1px solid var(--rule);background:var(--surface);
  color:var(--ink-soft);cursor:pointer;transition:.15s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;
}
.tab:hover{color:var(--ink);border-color:var(--rule-strong)}
/* each tab carries its own semantic color */
.tab.t-all{--c:#7c6cf6;--cs:rgba(124,108,246,.15);--cb:rgba(124,108,246,.42)}
.tab.t-low{--c:#f59e0b;--cs:rgba(245,158,11,.15);--cb:rgba(245,158,11,.42)}
.tab.t-out{--c:#ef4444;--cs:rgba(239,68,68,.15);--cb:rgba(239,68,68,.42)}
.tab.t-ok{--c:#22c55e;--cs:rgba(34,197,94,.15);--cb:rgba(34,197,94,.42)}
.tab .ic{width:15px;height:15px;color:var(--c)}
.tab.on{color:var(--c);border-color:var(--cb);background:var(--cs)}
.tab.on .ic{color:var(--c)}
.tab .cnt{font-family:var(--font-mono);font-size:12px;font-weight:600;color:var(--ink-faint)}
.tab.on .cnt{color:var(--c)}

/* ============ filter row ============ */
.filters{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:22px}
.field{display:flex;flex-direction:column;gap:6px}
.field.grow{flex:1 1 320px;min-width:220px}
.field label{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-faint)}
textarea.input{resize:vertical;min-height:52px;font-family:var(--font-body);line-height:1.4}
.input,.select{
  font-family:var(--font-body);font-size:16px;color:var(--ink);background:var(--surface);
  border:1px solid var(--rule);border-radius:12px;padding:13px 14px;min-height:48px;transition:.15s;width:100%;
}
.input:focus,.select:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.input::placeholder{color:var(--ink-faint)}
.select{min-width:180px;cursor:pointer;appearance:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23808a9d' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 12px center;padding-right:34px}
.viewtoggle{display:inline-flex;background:var(--surface);border:1px solid var(--rule);border-radius:11px;padding:3px;margin-left:auto}
.viewtoggle button{
  display:inline-flex;align-items:center;gap:7px;font-family:var(--font-body);font-size:13px;font-weight:600;
  border:none;background:none;color:var(--ink-soft);padding:7px 13px;border-radius:8px;cursor:pointer;transition:.15s;
}
.viewtoggle button svg{width:15px;height:15px}
.viewtoggle button.on{background:var(--accent);color:#fff}

/* ============ result heading ============ */
.result-head{display:flex;align-items:baseline;gap:12px;margin-bottom:14px}
.result-head h2{font-family:var(--font-display);font-weight:600;font-size:20px;margin:0}
.result-head .shown{color:var(--ink-faint);font-size:13px}

/* ============ cards ============ */
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}
.card{
  background:var(--surface);border:1px solid var(--rule);border-radius:16px;padding:16px;
  display:flex;gap:16px;position:relative;box-shadow:var(--shadow);transition:.15s;
}
.card:hover{border-color:var(--rule-strong);transform:translateY(-1px)}
.card .onhand{flex:0 0 auto;width:74px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:2px}
.card .qty{font-family:var(--font-display);font-weight:700;font-size:32px;line-height:1;color:var(--ink)}
.card .min{font-size:11px;color:var(--ink-faint)}
.card .oh-label{font-size:10px;font-weight:600;letter-spacing:.06em;color:var(--ink-faint)}
.card .body{flex:1 1 auto;min-width:0}
.card .pname{font-weight:600;font-size:15px;line-height:1.3;margin:0 0 9px;padding-right:24px;color:var(--ink)}
.badges{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:11px}
.badge{font-family:var(--font-mono);font-size:11.5px;font-weight:500;padding:3px 9px;border-radius:7px;background:var(--badge);color:var(--badge-ink)}
.badge.ek{color:var(--ink-faint)}
.badge.shelf{background:var(--accent-soft);color:#a99bfb}
:root[data-theme="light"] .badge.shelf{color:#6a58f0}
.card .maker{font-size:13px;color:var(--ink-soft);font-weight:500}
.card .model{font-family:var(--font-mono);font-size:12px;color:var(--ink-faint);margin-top:2px}
.status{position:absolute;top:15px;right:15px;width:20px;height:20px}
.status svg{width:20px;height:20px}
.s-ok{color:var(--green)} .s-low{color:var(--amber)} .s-out{color:var(--red)}

/* ============ table ============ */
.tablewrap{overflow-x:auto;border:1px solid var(--rule);border-radius:16px;background:var(--surface)}
table{width:100%;border-collapse:collapse;font-size:13.5px;min-width:760px}
thead th{
  text-align:left;font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;
  color:var(--ink-faint);padding:13px 16px;border-bottom:1px solid var(--rule);white-space:nowrap;
}
thead th.num{text-align:center}
tbody td{padding:13px 16px;border-bottom:1px solid var(--rule);color:var(--ink);vertical-align:middle}
tbody tr:last-child td{border-bottom:none}
tbody tr:hover{background:var(--surface-2)}
.t-name{font-weight:600}
.t-id{font-family:var(--font-mono);font-size:12px;color:var(--ink-faint)}
.t-mono{font-family:var(--font-mono);font-size:12.5px;color:var(--ink-soft)}
.t-shelf{display:inline-block;font-family:var(--font-mono);font-size:12px;padding:2px 8px;border-radius:6px;background:var(--accent-soft);color:#a99bfb}
:root[data-theme="light"] .t-shelf{color:#6a58f0}
.t-onhand{text-align:center}
.t-qty{font-family:var(--font-display);font-weight:700;font-size:18px}
.t-min{font-size:10.5px;color:var(--ink-faint)}
.pill{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;padding:4px 10px;border-radius:999px}
.pill.ok{background:var(--green-soft);color:var(--green)}
.pill.low{background:var(--amber-soft);color:var(--amber)}
.pill.out{background:var(--red-soft);color:var(--red)}

.hidden{display:none!important}
.empty{padding:60px 20px;text-align:center;color:var(--ink-faint)}

/* ============ detail slide-over ============ */
.dp-scrim{position:fixed;inset:0;background:rgba(0,0,0,.55);opacity:0;pointer-events:none;transition:.2s;z-index:50}
.dp-scrim.show{opacity:1;pointer-events:auto}
.dp-panel{position:fixed;top:0;right:0;height:100%;width:min(468px,94vw);background:var(--surface);
  border-left:1px solid var(--rule);box-shadow:-18px 0 50px rgba(0,0,0,.45);transform:translateX(100%);
  transition:transform .24s cubic-bezier(.4,0,.2,1);overflow-y:auto;z-index:51;display:flex;flex-direction:column}
.dp-scrim.show .dp-panel{transform:none}
.dp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:22px 22px 16px;border-bottom:1px solid var(--rule)}
.dp-title{font-family:var(--font-display);font-weight:600;font-size:20px;margin:0 0 9px;line-height:1.25}
.dp-badge{font-family:var(--font-mono);font-size:12px;background:var(--accent-soft);color:#a99bfb;padding:3px 9px;border-radius:7px}
:root[data-theme="light"] .dp-badge{color:#6a58f0}
.dp-x{flex:0 0 auto;width:32px;height:32px;border-radius:9px;border:1px solid var(--rule);background:var(--surface-2);
  color:var(--ink-soft);font-size:20px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}
.dp-x:hover{color:var(--ink);border-color:var(--rule-strong)}
.dp-body{padding:20px 22px;flex:1 1 auto}
.dp-sec{font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-faint);margin:24px 0 11px}
.dp-sec:first-child{margin-top:0}
.onhand-box{display:flex;align-items:center;gap:14px;background:var(--surface-2);border:1px solid var(--rule);border-radius:14px;padding:14px 16px}
.oh-btn{width:52px;height:52px;border-radius:12px;border:1px solid var(--rule-strong);background:var(--surface);color:var(--ink);
  font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.12s}
.oh-btn:hover{background:var(--raised);border-color:var(--accent)}
.oh-num{font-family:var(--font-display);font-weight:700;font-size:30px;min-width:56px;text-align:center}
.drow{display:flex;justify-content:space-between;gap:16px;padding:11px 0;border-bottom:1px solid var(--rule)}
.drow .k{color:var(--ink-soft);font-size:13.5px}
.drow .v{color:var(--ink);font-size:13.5px;text-align:right;font-weight:500}
.drow .v.mono{font-family:var(--font-mono);font-size:12.5px}
.dgrid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.inv-note{color:var(--ink-faint);font-size:13px;margin-bottom:11px}
.inv-hint{font-size:11.5px;color:var(--ink-faint);margin-left:9px}
.dp-foot{position:sticky;bottom:0;background:var(--surface);border-top:1px solid var(--rule);padding:14px 22px;display:flex;gap:10px}
.dp-foot .btn{flex:1;justify-content:center}
.card,tbody tr{cursor:pointer}

/* ============ cart + checkout ============ */
.cart-btn{position:relative}
.cart-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:var(--accent);color:#fff;font-family:var(--font-mono);font-size:11px;font-weight:600;margin-left:2px}
.cart-badge.zero{display:none}
.card-actions{margin-top:12px;display:flex;justify-content:flex-end}
.add-btn{font-family:var(--font-body);font-size:14px;font-weight:600;color:var(--accent);background:var(--accent-soft);border:1px solid var(--accent-brd);border-radius:10px;padding:10px 15px;min-height:44px;cursor:pointer;transition:.12s;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
:root[data-theme="light"] .add-btn{color:#6a58f0}
.add-btn:hover{background:var(--accent);color:#fff}
.add-btn:disabled{opacity:.45;cursor:not-allowed;color:var(--ink-faint);background:var(--surface-2);border-color:var(--rule)}
td.t-add{text-align:right;white-space:nowrap}
.cart-line{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--rule)}
.cart-line .ci-body{flex:1 1 auto;min-width:0}
.cart-line .ci-name{font-weight:600;font-size:14px}
.cart-line .ci-sub{font-size:12px;color:var(--ink-faint);font-family:var(--font-mono)}
.ci-step{display:flex;align-items:center;gap:8px}
.ci-step button{width:42px;height:42px;border-radius:10px;border:1px solid var(--rule-strong);background:var(--surface);color:var(--ink);font-size:20px;cursor:pointer;touch-action:manipulation}
.ci-step button:hover{border-color:var(--accent)}
.ci-step .n{font-family:var(--font-display);font-weight:700;min-width:30px;text-align:center;font-size:17px}
.ci-rm{background:none;border:none;color:var(--ink-faint);cursor:pointer;font-size:22px;padding:8px 10px;line-height:1;touch-action:manipulation}
.ci-rm:hover{color:var(--red)}
.cart-empty{padding:54px 10px;text-align:center;color:var(--ink-faint);line-height:1.6}
.cart-total{display:flex;justify-content:space-between;align-items:center;font-size:14px;color:var(--ink-soft)}
.cart-total b{color:var(--ink);font-family:var(--font-display);font-size:16px}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(20px);background:var(--raised);color:var(--ink);border:1px solid var(--rule-strong);border-radius:12px;padding:13px 18px;font-size:13.5px;box-shadow:var(--shadow);opacity:0;pointer-events:none;transition:.2s;z-index:60;max-width:90vw}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}

/* ============ take / return / restock actions ============ */
.act-btn{--ac:var(--accent)}
.act-take{--ac:#f59e0b}.act-return{--ac:#22c55e}.act-restock{--ac:#3b82f6}
.act-btn::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--ac);display:inline-block;margin-right:1px;flex:0 0 auto}
.btn.act-btn.on{background:var(--ac);border-color:var(--ac);color:#fff}
.btn.act-btn.on::before{background:#fff}
.btn-sm{padding:6px 11px;font-size:12.5px;border-radius:9px}
.mode-bar{--ac:var(--accent);display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:12px;margin-bottom:18px;border:1px solid var(--ac);background:color-mix(in srgb,var(--ac) 13%,transparent)}
.mode-bar.m-take{--ac:#f59e0b}.mode-bar.m-return{--ac:#22c55e}.mode-bar.m-restock{--ac:#3b82f6}
.mb-dot{width:9px;height:9px;border-radius:50%;background:var(--ac);flex:0 0 auto}
.mb-text{font-size:13.5px;color:var(--ink)}
.add-btn.m-take{color:#f59e0b;background:rgba(245,158,11,.15);border-color:rgba(245,158,11,.4)}
.add-btn.m-take:hover{background:#f59e0b;color:#fff}
.add-btn.m-return{color:#22c55e;background:rgba(34,197,94,.15);border-color:rgba(34,197,94,.4)}
.add-btn.m-return:hover{background:#22c55e;color:#fff}
.add-btn.m-restock{color:#3b82f6;background:rgba(59,130,246,.15);border-color:rgba(59,130,246,.4)}
.add-btn.m-restock:hover{background:#3b82f6;color:#fff}
.dp-actions{display:flex;gap:8px;margin-top:10px}
.dp-actions .btn{flex:1;justify-content:center;padding-left:6px;padding-right:6px;font-size:12.5px}
.dp-badge.m-take{background:rgba(245,158,11,.15);color:#f59e0b}
.dp-badge.m-return{background:rgba(34,197,94,.15);color:#22c55e}
.dp-badge.m-restock{background:rgba(59,130,246,.15);color:#3b82f6}

button{touch-action:manipulation}
/* ---- tablet ---- */
/* ============ receive: new-part modal + label sheet ============ */
.ci-new{border-left:3px solid #3b82f6;padding-left:9px}
.ci-tag{display:inline-block;font-size:10.5px;font-weight:700;letter-spacing:.04em;color:#3b82f6;background:rgba(59,130,246,.14);border-radius:5px;padding:1px 6px;margin-left:6px}
#npScrim,#scanScrim{display:flex;align-items:center;justify-content:center;padding:16px}
.sc-log{font-size:13px;color:var(--ink-soft);min-height:18px}
.np-modal{background:var(--surface);border:1px solid var(--rule);border-radius:16px;width:min(440px,96vw);max-height:90vh;overflow:auto;transform:translateY(14px);transition:transform .2s;box-shadow:var(--shadow);display:flex;flex-direction:column}
#npScrim.show .np-modal{transform:none}
.np-head{display:flex;justify-content:space-between;align-items:center;padding:18px 20px;border-bottom:1px solid var(--rule)}
.np-head h3{margin:0;font-family:var(--font-display);font-size:18px}
.np-body{padding:18px 20px;display:flex;flex-direction:column;gap:14px}
.np-note{font-size:12.5px;color:var(--ink-faint);background:var(--surface-2);border:1px solid var(--rule);border-radius:10px;padding:10px 12px}
.np-foot{display:flex;gap:10px;padding:16px 20px;border-top:1px solid var(--rule)}
.label-hint{font-size:13px;color:var(--ink-faint);margin-bottom:14px}
.label-sheet{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.label-card{display:flex;gap:12px;align-items:center;border:1px solid var(--rule);border-radius:12px;padding:12px;background:var(--surface-2)}
.label-card .qr{width:104px;height:104px;flex:0 0 auto;background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:4px}
.label-card .qr img,.label-card .qr canvas{display:block;width:100%!important;height:100%!important}
.label-card .qr.qr-ph{color:#111;font-family:var(--font-mono);font-weight:600;font-size:13px}
.lm-name{font-weight:600;font-size:14px}
.lm-id{font-family:var(--font-mono);font-size:13px;color:var(--ink-soft)}
.lm-shelf{font-family:var(--font-mono);font-size:11px;color:var(--ink-faint);margin-top:2px}
@media print{
  body *{visibility:hidden}
  #labelScrim,#labelScrim *{visibility:visible}
  #labelScrim{position:absolute;top:0;left:0;opacity:1!important;background:#fff}
  #labelPanel{position:absolute;top:0;left:0;width:100%;transform:none!important;box-shadow:none;border:none;background:#fff;color:#000;overflow:visible}
  .dp-head,.dp-foot,.label-hint{display:none!important}
  .label-card{break-inside:avoid;border:1px dashed #999;background:#fff;color:#000}
  .lm-name,.lm-id,.lm-shelf{color:#000}
}

@media(max-width:1024px){
  .cards{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
  .wrap{padding:0 18px 60px}
}
/* ---- phone & small tablet (portrait) ---- */
@media(max-width:700px){
  .wrap{padding:0 13px 56px}
  .topbar{padding:20px 0 14px}
  .brand h1{font-size:21px}
  .brand .sub{font-size:12.5px}
  .theme-toggle{top:20px;padding:10px}
  .theme-toggle span{display:none}
  .toolbar{gap:8px}
  .toolbar .btn{flex:1 1 46%}
  .tabs{gap:7px}
  .tab{flex:1 1 46%}
  .filters{flex-direction:column;align-items:stretch;gap:12px}
  .field.grow{flex:1 1 auto;min-width:0}
  .select{min-width:0;width:100%}
  .viewtoggle{margin-left:0;width:100%}
  .viewtoggle button{flex:1}
  .cards{grid-template-columns:1fr}
  .card .qty{font-size:29px}
  .dp-panel{width:100vw}
  .mode-bar{flex-wrap:wrap}
  .mode-bar .mb-text{flex:1 1 100%;order:-1}
  .result-head{flex-wrap:wrap;gap:4px}
  table{min-width:640px}
}
/* ---- large phones landscape / mid tablets ---- */
@media(min-width:701px) and (max-width:900px){
  .cards{grid-template-columns:repeat(2,1fr)}
}

/* ============================================================
   Reused components: camera scanner, label printer, invoices
   (themed to the tokens above)
   ============================================================ */

.mono{font-family:var(--font-mono)}
.field-row{display:flex;flex-direction:column;gap:6px;margin-bottom:6px}
.field-row label{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-faint)}
.err-box{background:var(--red-soft);border:1px solid rgba(248,113,113,.4);color:var(--red);border-radius:10px;padding:10px 12px;font-size:13px;margin-top:10px}
.state{padding:44px 20px;text-align:center;color:var(--ink-faint)}
.section h4{font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-faint);margin:24px 0 11px}

/* history in the detail panel */
.hist{margin-top:6px}
.hist-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--rule);font-size:13px}
.hist-row:last-child{border-bottom:none}
.hist-row .c{font-family:var(--font-mono);font-weight:600;min-width:44px}
.hist-row .c.up{color:var(--green)} .hist-row .c.dn{color:var(--amber)}
.hist-row .after{color:var(--ink-faint);font-family:var(--font-mono);font-size:12px}
.hist-row .who{color:var(--ink-soft);flex:1;text-align:right;font-size:12px}

/* ---- camera scanner (full-screen dark overlay) ---- */
.cam-scrim{position:fixed;inset:0;background:rgba(0,0,0,.86);z-index:80;display:flex;align-items:center;justify-content:center;padding:16px}
.cam-panel{background:#0d1117;border:1px solid #262e3d;border-radius:18px;width:min(520px,96vw);max-height:92vh;overflow:auto;color:#e7eaf1}
.cam-head{display:flex;justify-content:space-between;align-items:flex-start;padding:18px 20px;border-bottom:1px solid #262e3d}
.cam-head h2{margin:0;font-family:var(--font-display);font-size:19px}
.cam-sub{color:#aab2c2;font-size:13px;margin-top:2px}
.cam-stage{position:relative;padding:16px 20px}
.cam-region{width:100%;border-radius:12px;overflow:hidden;background:#000;min-height:240px}
.cam-hint{text-align:center;color:#aab2c2;font-size:13px;margin-top:10px}
.cam-err{margin-top:10px}
.cam-foot{display:flex;gap:10px;justify-content:flex-end;padding:14px 20px;border-top:1px solid #262e3d}
.x{width:34px;height:34px;border-radius:9px;border:1px solid var(--rule-strong);background:var(--surface-2);color:var(--ink-soft);font-size:20px;cursor:pointer;flex:0 0 auto}
.x:hover{color:var(--ink)}

/* ---- labels modal (Labels.js) ---- */
.scrim{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:70;display:flex;align-items:center;justify-content:center;padding:16px}
.panel{background:var(--surface);border:1px solid var(--rule);border-radius:18px;width:min(560px,96vw);max-height:92vh;overflow:auto;display:flex;flex-direction:column;color:var(--ink)}
.panel-wide{width:min(880px,96vw)}
.panel-head{display:flex;justify-content:space-between;align-items:flex-start;padding:20px 22px;border-bottom:1px solid var(--rule)}
.panel-head h2{margin:0;font-family:var(--font-display);font-size:20px}
.pid{font-family:var(--font-mono);font-size:12px;color:var(--ink-faint);margin-top:4px}
.panel-body{padding:20px 22px;flex:1}
.panel-foot{display:flex;gap:10px;justify-content:flex-end;padding:16px 22px;border-top:1px solid var(--rule)}
.btn-primary{background:var(--accent);border-color:var(--accent);color:#fff}
.label-note{font-size:13px;color:var(--ink-faint);margin:12px 0}
.label-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.label-grid.one{grid-template-columns:1fr;max-width:300px}
.label-card{display:flex;gap:12px;align-items:center;border:1px solid var(--rule);border-radius:12px;padding:12px;background:var(--surface-2)}
.qr-holder{width:120px;height:120px;flex:0 0 auto;background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:6px;color:#111}
.qr-holder svg{width:100%;height:100%}
.label-meta{display:flex;flex-direction:column;gap:2px}
.label-meta b{font-size:14px}
.label-meta .big{font-size:16px}
.label-meta .dim{color:var(--ink-faint);font-size:12px}
.print-area{margin-top:4px}
@media print{
  body *{visibility:hidden}
  .print-area,.print-area *{visibility:visible}
  .print-area{position:absolute;left:0;top:0;width:100%}
  .no-print{display:none!important}
  .qr-holder{background:#fff}
}

/* ---- invoices (InvoicePanel.js) ---- */
.inv-empty{font-size:13px;color:var(--ink-faint);padding:8px 0 2px}
.inv-empty code{font-family:var(--font-mono);font-size:12px;color:var(--ink-soft)}
.inv-grid{display:flex;flex-direction:column;gap:8px}
.inv-card{display:flex;align-items:center;gap:12px;padding:8px;border:1px solid var(--rule);border-radius:10px;background:var(--surface)}
.inv-thumb{flex:0 0 auto;width:46px;height:46px;border-radius:8px;overflow:hidden;background:var(--surface-2);border:1px solid var(--rule);display:flex;align-items:center;justify-content:center}
.inv-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.inv-pdf{font-family:var(--font-mono);font-size:10px;font-weight:600;color:var(--red)}
.inv-meta{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}
.inv-name{font-size:13px;color:var(--ink);text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.inv-name:hover{color:var(--accent);text-decoration:underline}
.inv-sub{font-size:11.5px;color:var(--ink-faint);font-family:var(--font-mono)}
.inv-confirm{display:flex;gap:6px;flex:0 0 auto}
.inv-del{flex:0 0 auto;background:none;border:1px solid transparent;border-radius:8px;padding:6px 10px;font-size:12px;color:var(--ink-faint);cursor:pointer}
.inv-del:hover{color:var(--ink);border-color:var(--rule-strong)}
.inv-del.on{color:var(--red);border-color:rgba(248,113,113,.4);background:var(--red-soft);font-weight:600}
.inv-actions{display:flex;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap}
.inv-hint{font-size:11.5px;color:var(--ink-faint)}
