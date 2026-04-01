import { useState, useEffect, useCallback, useRef } from "react";

const API = process.env.REACT_APP_API_URL || 'https://nexai-referral-tracking-1.onrender.com';

// ── UTILS ──
const calcEDD = (lmp) => { if (!lmp) return ""; const d = new Date(lmp); d.setDate(d.getDate()+280); return d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}); };
const getWeeks = (lmp) => { if (!lmp) return null; const days=Math.floor((new Date()-new Date(lmp))/86400000); const w=Math.floor(days/7),r=days%7; return w>=0&&w<=42?`${w}w ${r}d`:null; };
const fmtDate = (d) => { try{return new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});}catch{return "—";}};
const daysUntil = (d) => Math.ceil((new Date(d)-new Date())/86400000);
const isHighBP = (s,d) => s>140||d>90;
const isLowHb = (h) => h&&parseFloat(h)<10;

// ── RISK ENGINE (mirrors backend) ──
function calcRisk(patient, visit) {
  const reasons = [];
  if (visit) {
    if (visit.systolic_bp>140||visit.diastolic_bp>90)
      reasons.push({factor:"BP",value:`${visit.systolic_bp}/${visit.diastolic_bp}`,label:"High Blood Pressure"});
    if (visit.hb!==null&&visit.hb!==undefined&&parseFloat(visit.hb)<10)
      reasons.push({factor:"Hb",value:`${visit.hb} g/dL`,label:parseFloat(visit.hb)<7?"Severely Low Hb":"Low Haemoglobin"});
  }
  if (patient) {
    if (patient.age<18) reasons.push({factor:"Age",value:`${patient.age}y`,label:"Too Young (< 18)"});
    else if (patient.age>35) reasons.push({factor:"Age",value:`${patient.age}y`,label:"Advanced Maternal Age"});
    if (patient.gravida>=3) reasons.push({factor:"Gravida",value:`G${patient.gravida}`,label:"Multiple Pregnancies"});
  }
  return {is_high_risk:reasons.length>0, reasons};
}

// ── ICON ──
const Ic = ({d,s=18,c="currentColor"}) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
);
const ic = {
  user:"M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  phone:"M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z",
  cal:"M3 4h18v18H3zM16 2v4M8 2v4M3 10h18",
  search:"M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z",
  check:"M20 6L9 17l-5-5",
  alert:"M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
  plus:"M12 5v14M5 12h14",
  back:"M19 12H5M12 19l-7-7 7-7",
  x:"M18 6L6 18M6 6l12 12",
  heart:"M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
  ref:"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  clipboard:"M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2",
  dash:"M3 12h18M3 6h18M3 18h18",
  trash:"M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  undo:"M3 7v6h6M3.51 15a9 9 0 1 0 .49-4.4",
  clock:"M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2",
  hosp:"M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V12h6v9",
  arrived:"M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3",
  notarrived:"M10 14l2-2m0 0 2-2m-2 2-2-2m2 2 2 2M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3z",
  verify:"M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  fire:"M17.657 18.657A8 8 0 0 1 6.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0 1 20 13a7.975 7.975 0 0 1-2.343 5.657z",
};

// ── CSS ──
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
  :root{
    --p:#0A6EBD;--pl:#E8F4FD;--pd:#065A9E;
    --r:#DC2626;--rl:#FEE2E2;
    --g:#0D9F6E;--gl:#D1FAE5;
    --o:#D97706;--ol:#FEF3C7;
    --pu:#7C3AED;--pul:#F3E8FF;
    --bg:#F0F4F8;--card:#FFF;
    --txt:#1A2332;--muted:#64748B;
    --border:#E2E8F0;
    --rad:14px;--rads:10px;
    --sh:0 1px 3px rgba(0,0,0,.08),0 4px 16px rgba(0,0,0,.06);
  }
  body{font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--txt);min-height:100vh}
  .app{max-width:480px;margin:0 auto;min-height:100vh;background:var(--bg)}

  .nav{background:var(--p);padding:14px 18px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;box-shadow:0 2px 12px rgba(10,110,189,.35)}
  .nav-logo{font-family:'Space Mono',monospace;font-size:20px;font-weight:700;color:#fff}
  .nav-logo span{color:#7DD3FC}
  .nav-sub{font-size:11px;color:rgba(255,255,255,.65);margin-top:1px}
  .nav-back{background:rgba(255,255,255,.15);border:none;border-radius:8px;padding:8px 12px;color:#fff;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px}

  .tabs{display:flex;background:#fff;border-bottom:1px solid var(--border);position:sticky;top:57px;z-index:99}
  .tab{flex:1;padding:12px 4px;border:none;background:none;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;color:var(--muted);cursor:pointer;border-bottom:2.5px solid transparent;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:4px}
  .tab.on{color:var(--p);border-bottom-color:var(--p);font-weight:700}

  .cnt{padding:14px}
  .card{background:var(--card);border-radius:var(--rad);box-shadow:var(--sh);overflow:hidden;margin-bottom:14px}
  .card-h{padding:14px 18px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px}
  .card-icon{width:34px;height:34px;border-radius:9px;background:var(--pl);display:flex;align-items:center;justify-content:center;color:var(--p);flex-shrink:0}
  .card-title{font-size:14px;font-weight:700;color:var(--txt)}
  .card-sub{font-size:11px;color:var(--muted);margin-top:1px}
  .card-b{padding:18px}

  .field{margin-bottom:14px}
  .lbl{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:var(--txt);margin-bottom:5px;text-transform:uppercase;letter-spacing:.4px}
  .req{color:#E8325A}
  .inp{width:100%;padding:12px 14px;border:1.5px solid var(--border);border-radius:var(--rads);font-family:'DM Sans',sans-serif;font-size:15px;color:var(--txt);background:#fff;transition:all .2s;outline:none;-webkit-appearance:none}
  .inp:focus{border-color:var(--p);box-shadow:0 0 0 3px rgba(10,110,189,.1)}
  .inp.err{border-color:var(--r)}
  .inp::placeholder{color:#CBD5E1}
  .ferr{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--r);margin-top:4px;font-weight:600}
  .row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .bp-row{display:flex;align-items:center;gap:8px}
  .bp-sep{font-size:20px;color:var(--muted);font-weight:300;padding-top:4px}
  .hint{font-size:11px;color:var(--muted);margin-top:5px}

  .edd{margin-top:8px;padding:10px 14px;background:var(--gl);border-radius:var(--rads);border:1px solid #6EE7B7;display:flex;align-items:center;justify-content:space-between}
  .edd-lbl{font-size:11px;color:var(--g);font-weight:700;text-transform:uppercase;letter-spacing:.5px}
  .edd-val{font-family:'Space Mono',monospace;font-size:13px;font-weight:700;color:var(--g)}

  .btn{width:100%;padding:15px;border:none;border-radius:var(--rads);font-family:'DM Sans',sans-serif;font-size:15px;font-weight:700;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px;touch-action:manipulation;-webkit-tap-highlight-color:transparent;min-height:48px}
  .btn-p{background:var(--p);color:#fff}
  .btn-p:hover{background:var(--pd)}
  .btn-p:disabled{background:#94A3B8;cursor:not-allowed}
  .btn-o{background:var(--ol);color:var(--o);border:1.5px solid #FCD34D}
  .btn-g{background:var(--gl);color:var(--g);border:1.5px solid #6EE7B7}
  .btn-r{background:var(--rl);color:var(--r);border:1.5px solid #FCA5A5}
  .btn-pu{background:var(--pul);color:var(--pu);border:1.5px solid #C4B5FD}
  .btn-sm{width:auto;padding:9px 14px;font-size:12px;border-radius:8px}
  .action-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}

  .success{background:var(--g);color:#fff;padding:14px 18px;border-radius:var(--rad);margin-bottom:14px;display:flex;align-items:flex-start;gap:12px;animation:slideIn .3s ease}
  .success-code{font-family:'Space Mono',monospace;font-size:18px;font-weight:700;margin-top:3px}
  @keyframes slideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}

  .srch-wrap{position:relative;margin-bottom:14px}
  .srch-ic{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--muted);pointer-events:none}
  .srch-inp{width:100%;padding:13px 14px 13px 40px;border:1.5px solid var(--border);border-radius:var(--rads);font-family:'DM Sans',sans-serif;font-size:15px;background:#fff;outline:none;transition:all .2s;box-shadow:var(--sh)}
  .srch-inp:focus{border-color:var(--p);box-shadow:0 0 0 3px rgba(10,110,189,.1)}

  .pt-card{background:#fff;border-radius:var(--rad);padding:14px;margin-bottom:10px;box-shadow:var(--sh);border:1.5px solid var(--border);cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:12px}
  .pt-card:hover{border-color:var(--p);transform:translateY(-1px)}
  .pt-card.selected{border-color:var(--r);background:#FFF8F8}
  .pt-av{width:42px;height:42px;border-radius:50%;background:var(--pl);color:var(--p);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0}
  .pt-name{font-size:15px;font-weight:700;color:var(--txt)}
  .pt-meta{display:flex;align-items:center;gap:7px;margin-top:3px;flex-wrap:wrap}
  .code-badge{font-family:'Space Mono',monospace;font-size:10px;font-weight:700;color:var(--p);background:var(--pl);padding:2px 6px;border-radius:4px}
  .pt-info{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:3px}

  /* STATUS & PRIORITY BADGES */
  .badge-pending{background:var(--ol);color:var(--o);border:1px solid #FCD34D;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:4px}
  .badge-arrived{background:var(--gl);color:var(--g);border:1px solid #6EE7B7;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:4px}
  .badge-notarrived{background:var(--rl);color:var(--r);border:1px solid #FCA5A5;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:4px}
  .badge-high{background:var(--rl);color:var(--r);border:1px solid #FCA5A5;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:3px}
  .badge-medium{background:var(--ol);color:var(--o);border:1px solid #FCD34D;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:3px}
  .badge-low{background:var(--gl);color:var(--g);border:1px solid #6EE7B7;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:3px}
  .badge-unverified{background:#FFF7ED;color:#C2410C;border:1px solid #FDBA74;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:3px}
  .badge-verified{background:var(--gl);color:var(--g);border:1px solid #6EE7B7;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:3px}
  .badge-delayed{background:var(--rl);color:var(--r);border:1px solid #FCA5A5;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:3px}

  /* RISK REASONS */
  .risk-banner{background:var(--rl);border:1.5px solid #FCA5A5;border-left:4px solid var(--r);border-radius:var(--rads);padding:12px 14px;margin-bottom:14px}
  .risk-reasons{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
  .risk-reason-tag{background:var(--r);color:#fff;border-radius:8px;padding:3px 10px;font-size:11px;font-weight:700}

  /* DETAIL */
  .detail-header{background:var(--p);padding:20px 18px;color:#fff}
  .detail-av{width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;margin-bottom:10px}
  .detail-name{font-size:20px;font-weight:700}
  .detail-code{font-family:'Space Mono',monospace;font-size:12px;color:rgba(255,255,255,.7);margin-top:3px}
  .detail-badges{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
  .detail-badge{background:rgba(255,255,255,.15);border-radius:20px;padding:4px 12px;font-size:12px;font-weight:600}
  .detail-row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)}
  .detail-row:last-child{border-bottom:none}
  .dk{font-size:13px;color:var(--muted);font-weight:500}
  .dv{font-size:14px;font-weight:600;color:var(--txt);text-align:right}

  /* VISIT */
  .visit-row{padding:14px 0;border-bottom:1px solid var(--border)}
  .visit-row:last-child{border-bottom:none}
  .visit-top{display:flex;align-items:center;justify-content:space-between}
  .visit-date{font-size:12px;color:var(--muted);font-weight:600}
  .visit-bp{font-family:'Space Mono',monospace;font-size:14px;font-weight:700}
  .visit-bp.high{color:var(--r)}
  .visit-bp.ok{color:var(--g)}
  .visit-reasons{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
  .visit-reason-tag{background:var(--rl);color:var(--r);border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700}
  .visit-footer{display:flex;align-items:center;justify-content:space-between;margin-top:8px}
  .visit-verify-btn{background:none;border:1px solid var(--pu);color:var(--pu);border-radius:8px;padding:5px 12px;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;transition:all .15s}
  .visit-verify-btn:hover{background:var(--pul)}

  /* REFERRAL */
  .ref-card{border:1.5px solid var(--border);border-radius:var(--rads);padding:14px;margin-bottom:10px;background:#FAFBFC}
  .ref-card-top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px}
  .ref-hospital{font-size:14px;font-weight:700;color:var(--txt);display:flex;align-items:center;gap:6px}
  .ref-reason{font-size:12px;color:var(--muted);margin-top:3px}
  .ref-date{font-size:11px;color:var(--muted);margin-top:4px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
  .ref-actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}

  /* MODAL */
  .overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:200;display:flex;align-items:flex-end;animation:fadeIn .2s}
  .modal{background:#fff;border-radius:20px 20px 0 0;width:100%;max-height:88vh;overflow-y:auto;animation:slideUp .3s ease}
  .modal-h{padding:18px 20px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:#fff;z-index:1}
  .modal-title{font-size:16px;font-weight:700}
  .modal-b{padding:18px}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
  .btn-icon{width:34px;height:34px;border-radius:50%;border:none;background:var(--border);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--txt);transition:all .15s}
  .btn-icon:hover{background:var(--rl);color:var(--r)}

  /* DASHBOARD */
  .stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
  .stat-card{background:#fff;border-radius:var(--rads);padding:14px;box-shadow:var(--sh);display:flex;align-items:center;gap:12px;cursor:default;transition:box-shadow .15s}
  .stat-icon{width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .stat-val{font-family:'Space Mono',monospace;font-size:26px;font-weight:700}
  .stat-lbl{font-size:11px;color:var(--muted);margin-top:1px;font-weight:600}
  .dash-row{padding:12px 0;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:12px;cursor:pointer;transition:background .1s}
  .dash-row:hover{background:#FAFBFC;margin:0 -18px;padding:12px 18px}
  .dash-row:last-child{border-bottom:none}
  .dash-av{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;margin-top:2px}
  .dash-name{font-size:13px;font-weight:700;color:var(--txt)}
  .dash-sub{font-size:11px;color:var(--muted);margin-top:2px}
  .dash-reasons{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
  .dash-reason-tag{background:var(--rl);color:var(--r);border-radius:6px;padding:1px 7px;font-size:10px;font-weight:700}
  .days-badge{font-family:'Space Mono',monospace;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;white-space:nowrap}

  /* UNDO TOAST */
  .undo-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1A2332;color:#fff;border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:12px;z-index:500;box-shadow:0 8px 32px rgba(0,0,0,.3);animation:slideIn .3s ease;min-width:280px}
  .undo-btn{background:var(--p);border:none;color:#fff;border-radius:8px;padding:6px 14px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}

  /* CHECKBOX */
  .chk{width:20px;height:20px;border-radius:6px;border:2px solid var(--border);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s}
  .chk.checked{background:var(--r);border-color:var(--r)}

  /* MISC */
  .empty{text-align:center;padding:28px 16px;color:var(--muted)}
  .empty-icon{width:48px;height:48px;border-radius:50%;background:var(--pl);display:flex;align-items:center;justify-content:center;margin:0 auto 10px;color:var(--p)}
  .empty-t{font-size:14px;font-weight:700;color:var(--txt);margin-bottom:5px}
  .err-box{background:var(--rl);border:1.5px solid #FCA5A5;border-left:4px solid var(--r);border-radius:var(--rads);padding:12px 16px;margin-bottom:14px;font-size:13px;color:var(--r);font-weight:600}
  .spin{width:18px;height:18px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:sp .7s linear infinite}
  @keyframes sp{to{transform:rotate(360deg)}}
  .section-divider{height:1px;background:var(--border);margin:4px 0}
`;

console.log("API VALUE:", API);

// ── API ──
const apiGet = async (p) => { try{const r=await fetch(API+p);return await r.json();}catch{return null;}};
const apiPost = async (p,b) => { try{const r=await fetch(API+p,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)});return await r.json();}catch{return null;}};
const apiPatch = async (p,b) => { try{const r=await fetch(API+p,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)});return await r.json();}catch{return null;}};
const apiDelete = async (p) => { try{const r=await fetch(API+p,{method:"DELETE"});return await r.json();}catch{return null;}};

// ── PRIORITY BADGE ──
function PriorityBadge({priority}) {
  if (priority==="HIGH") return <span className="badge-high">🔴 HIGH</span>;
  if (priority==="LOW") return <span className="badge-low">🟢 LOW</span>;
  return <span className="badge-medium">🟡 MEDIUM</span>;
}

function StatusBadge({status}) {
  if (status==="ARRIVED") return <span className="badge-arrived">✅ ARRIVED</span>;
  if (status==="NOT_ARRIVED") return <span className="badge-notarrived">❌ NOT ARRIVED</span>;
  return <span className="badge-pending">⏳ PENDING</span>;
}

// ── RISK REASONS DISPLAY ──
function RiskReasons({reasons, compact=false}) {
  if (!reasons||reasons.length===0) return null;
  if (compact) return (
    <div className="dash-reasons">
      {reasons.map((r,i) => <span key={i} className="dash-reason-tag">{r.factor}: {r.value}</span>)}
    </div>
  );
  return (
    <div className="visit-reasons">
      {reasons.map((r,i) => <span key={i} className="visit-reason-tag">{r.factor}: {r.value} — {r.label}</span>)}
    </div>
  );
}

// ════════════════════════════════════════
// VERIFY MODAL
// ════════════════════════════════════════
function VerifyModal({visit, patient, onClose, onVerified}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onKey = (e) => { if(e.key==="Enter") submit(); };
  const submit = async () => {
    if (!name.trim()) { setErr("Doctor name required"); return; }
    setLoading(true);
    const data = await apiPatch(`/visits/${visit.id}/verify`, { verified_by: name.trim() });
    if (data?.success) { onVerified(data.visit); onClose(); }
    else setErr("Something went wrong. Try again.");
    setLoading(false);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-h">
          <div><div className="modal-title">Verify Visit</div><div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>{patient?.name} · {fmtDate(visit.visit_date)}</div></div>
          <button className="btn-icon" onClick={onClose}><Ic d={ic.x} s={15}/></button>
        </div>
        <div className="modal-b">
          <div style={{background:"var(--pul)",border:"1px solid #C4B5FD",borderRadius:"var(--rads)",padding:"12px 14px",marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:700,color:"var(--pu)"}}>Visit Details</div>
            <div style={{fontSize:12,color:"var(--pu)",marginTop:4}}>BP: {visit.systolic_bp}/{visit.diastolic_bp} mmHg{visit.hb?` · Hb: ${visit.hb} g/dL`:""}</div>
          </div>
          <div className="field">
            <div className="lbl"><Ic d={ic.verify} s={12}/>Doctor Name <span className="req">*</span></div>
            <input className={`inp ${err?"err":""}`} placeholder="e.g. Dr. Priya Sharma" autoFocus value={name} onChange={e=>{setName(e.target.value);setErr("");}} onKeyDown={onKey}/>
            {err&&<div className="ferr"><Ic d={ic.alert} s={11}/>{err}</div>}
          </div>
          <button className="btn btn-pu" onClick={submit} disabled={loading}>
            {loading?<div className="spin"/>:<Ic d={ic.verify} s={17}/>}
            {loading?"Verifying...":"Mark as Verified"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// REFER MODAL
// ════════════════════════════════════════
function ReferModal({patient, latestVisit, onClose, onSaved}) {
  const latestRisk = latestVisit ? calcRisk(patient, latestVisit) : {is_high_risk:false,reasons:[]};
  const autoReason = latestVisit&&(latestVisit.systolic_bp>140||latestVisit.diastolic_bp>90)
    ? `High BP (${latestVisit.systolic_bp}/${latestVisit.diastolic_bp} mmHg)` : "";
  const [form, setForm] = useState({referred_to:"",reason:autoReason,notes:""});
  const [errs, setErrs] = useState({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [apiErr, setApiErr] = useState("");
  const hospRef = useRef(null);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const onKey = (e) => { if(e.key==="Enter"&&e.target.tagName!=="TEXTAREA") submit(); };
  useEffect(() => { setTimeout(()=>hospRef.current?.focus(), 100); }, []);

  const submit = async () => {
    const e={};
    if (!form.referred_to.trim()) e.referred_to="Hospital name required";
    if (!form.reason.trim()) e.reason="Reason required";
    if (Object.keys(e).length) { setErrs(e); return; }
    setApiErr(""); setLoading(true);
    const data = await apiPost("/referrals",{patient_id:patient.id,visit_id:latestVisit?.id||null,referred_to:form.referred_to.trim(),reason:form.reason.trim(),notes:form.notes||null});
    if (data?.success) { setDone(true); setTimeout(()=>{onSaved(data.referral);onClose();},1200); }
    else { setApiErr("Something went wrong. Try again."); }
    setLoading(false);
  };

  if (done) return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-b" style={{textAlign:"center",padding:"40px 20px"}}>
          <div style={{fontSize:48,marginBottom:12}}>🏥</div>
          <div style={{fontSize:20,fontWeight:800,color:"var(--g)",marginBottom:6}}>Referral Created!</div>
          <div style={{fontSize:14,color:"var(--muted)"}}>→ {form.referred_to}</div>
          {latestRisk.is_high_risk&&<div style={{marginTop:8}}><span className="badge-high">🔴 HIGH Priority auto-assigned</span></div>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-h">
          <div><div className="modal-title">Refer Patient</div><div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>{patient.name} · {patient.patient_code}</div></div>
          <button className="btn-icon" onClick={onClose}><Ic d={ic.x} s={15}/></button>
        </div>
        <div className="modal-b">
          {latestRisk.is_high_risk&&(
            <div style={{background:"var(--rl)",border:"1px solid #FCA5A5",borderRadius:"var(--rads)",padding:"10px 14px",marginBottom:14,fontSize:12,color:"var(--r)",fontWeight:600}}>
              ⚠️ HIGH RISK patient — referral will be auto-tagged HIGH priority
            </div>
          )}
          <div className="field">
            <div className="lbl"><Ic d={ic.hosp} s={12}/>Refer To <span className="req">*</span></div>
            <input ref={hospRef} className={`inp ${errs.referred_to?"err":""}`} placeholder="e.g. GH Madurai, AIIMS Chennai" value={form.referred_to} onChange={e=>set("referred_to",e.target.value)} onKeyDown={onKey}/>
            {errs.referred_to&&<div className="ferr"><Ic d={ic.alert} s={11}/>{errs.referred_to}</div>}
          </div>
          <div className="field">
            <div className="lbl">Reason <span className="req">*</span></div>
            <input className={`inp ${errs.reason?"err":""}`} placeholder="e.g. High BP, Severe Anaemia" value={form.reason} onChange={e=>set("reason",e.target.value)} />
            {errs.reason&&<div className="ferr"><Ic d={ic.alert} s={11}/>{errs.reason}</div>}
            {autoReason&&<div className="hint">✅ Auto-filled from latest visit</div>}
          </div>
          <div className="field">
            <div className="lbl">Notes (optional)</div>
            <textarea className="inp" rows={3} placeholder="Additional notes..." style={{resize:"none"}} value={form.notes} onChange={e=>set("notes",e.target.value)} />
          </div>
          {apiErr&&<div className="err-box" style={{marginBottom:12}}>⚠️ {apiErr}</div>}
          <button className="btn btn-p" onClick={submit} disabled={loading}>
            {loading?<div className="spin"/>:<Ic d={ic.ref} s={17}/>}
            {loading?"Submitting...":"Submit Referral"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// ADD VISIT MODAL
// ════════════════════════════════════════
function AddVisitModal({patient, onClose, onSaved}) {
  const [form, setForm] = useState({sys:"",dia:"",hb:"",weight:"",notes:""});
  const [errs, setErrs] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [apiErr, setApiErr] = useState("");
  const sysRef = useRef(null);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  // Autofocus systolic on open
  useEffect(() => { setTimeout(()=>sysRef.current?.focus(), 100); }, []);

  // Live risk preview
  const liveRisk = form.sys&&form.dia ? calcRisk(patient, {systolic_bp:+form.sys,diastolic_bp:+form.dia,hb:form.hb?+form.hb:null}) : null;

  const submit = async () => {
    const e={};
    if (!form.sys||+form.sys<60||+form.sys>250) e.sys="60–250";
    if (!form.dia||+form.dia<40||+form.dia>150) e.dia="40–150";
    if (Object.keys(e).length){setErrs(e);return;}
    setErrs({}); setApiErr(""); setLoading(true);
    const data = await apiPost("/visits",{patient_id:patient.id,systolic_bp:+form.sys,diastolic_bp:+form.dia,hb:form.hb?+form.hb:null,weight:form.weight?+form.weight:null,notes:form.notes||null});
    if (!data?.success) { setApiErr("Something went wrong. Try again."); setLoading(false); return; }
    const hr = data?.is_high_risk ?? liveRisk?.is_high_risk;
    const reasons = data?.reasons ?? liveRisk?.reasons ?? [];
    setResult({hr,reasons});
    const v = data?.visit||{id:Date.now(),patient_id:patient.id,visit_date:new Date().toISOString().split("T")[0],systolic_bp:+form.sys,diastolic_bp:+form.dia,hb:form.hb||null,weight:form.weight||null,notes:form.notes,is_high_risk:hr,risk_reasons:reasons,is_verified:false};
    setTimeout(()=>{onSaved(v,hr);onClose();},1400);
    setLoading(false);
  };

  // Enter key submits
  const onKey = (e) => { if(e.key==="Enter") submit(); };

  if (result!==null) return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-b" style={{textAlign:"center",padding:"36px 20px"}}>
          <div style={{fontSize:48,marginBottom:12}}>{result.hr?"🔴":"🟢"}</div>
          <div style={{fontSize:20,fontWeight:800,color:result.hr?"var(--r)":"var(--g)",marginBottom:6}}>{result.hr?"HIGH RISK":"Normal"}</div>
          <div style={{fontSize:14,color:"var(--muted)",marginBottom:10}}>BP {form.sys}/{form.dia}</div>
          {result.reasons.length>0&&(
            <div style={{textAlign:"left",background:"var(--rl)",borderRadius:"var(--rads)",padding:"10px 14px"}}>
              <div style={{fontSize:11,fontWeight:700,color:"var(--r)",marginBottom:6}}>RISK FACTORS DETECTED</div>
              {result.reasons.map((r,i)=>(
                <div key={i} style={{fontSize:12,color:"var(--r)",marginBottom:3}}>• {r.label}: {r.value}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-h">
          <div><div className="modal-title">Add Visit</div><div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>{patient.name}</div></div>
          <button className="btn-icon" onClick={onClose}><Ic d={ic.x} s={15}/></button>
        </div>
        <div className="modal-b">
          {/* Live risk preview */}
          {liveRisk?.is_high_risk&&(
            <div style={{background:"var(--rl)",border:"1px solid #FCA5A5",borderLeft:"3px solid var(--r)",borderRadius:"var(--rads)",padding:"8px 12px",marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:700,color:"var(--r)"}}>⚠️ Risk detected: {liveRisk.reasons.map(r=>r.factor).join(", ")}</div>
            </div>
          )}
          <div className="field">
            <div className="lbl">Blood Pressure <span className="req">*</span></div>
            <div className="bp-row">
              <input ref={sysRef} className={`inp ${errs.sys?"err":""}`} type="number" inputMode="numeric" placeholder="Systolic" style={{textAlign:"center",fontFamily:"'Space Mono',monospace",fontWeight:700}} value={form.sys} onChange={e=>set("sys",e.target.value)} onKeyDown={onKey}/>
              <div className="bp-sep">/</div>
              <input className={`inp ${errs.dia?"err":""}`} type="number" inputMode="numeric" placeholder="Diastolic" style={{textAlign:"center",fontFamily:"'Space Mono',monospace",fontWeight:700}} value={form.dia} onChange={e=>set("dia",e.target.value)} onKeyDown={onKey}/>
            </div>
            <div className="hint">⚠️ &gt;140/90 = HIGH RISK</div>
          </div>
          <div className="row2">
            <div className="field"><div className="lbl">Hb (g/dL)</div><input className="inp" type="number" inputMode="decimal" step="0.1" placeholder="optional" value={form.hb} onChange={e=>set("hb",e.target.value)} onKeyDown={onKey}/><div className="hint">&lt;10 = risk</div></div>
            <div className="field"><div className="lbl">Weight (kg)</div><input className="inp" type="number" inputMode="decimal" step="0.1" placeholder="optional" value={form.weight} onChange={e=>set("weight",e.target.value)}/></div>
          </div>
          <div className="field">
            <div className="lbl">Notes</div>
            <textarea className="inp" rows={3} placeholder="Observations..." style={{resize:"none"}} value={form.notes} onChange={e=>set("notes",e.target.value)}/>
          </div>
          {apiErr && <div className="err-box" style={{marginBottom:12}}>⚠️ {apiErr}</div>}
          <button className="btn btn-p" onClick={submit} disabled={loading}>
            {loading?<div className="spin"/>:<Ic d={ic.check} s={17}/>}
            {loading?"Saving...":"Save Visit"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════
function DashboardScreen({onSelectPatient}) {
  const [stats, setStats] = useState(null);
  const [highRisk, setHighRisk] = useState([]);
  const [delayed, setDelayed] = useState([]);
  const [highPriority, setHighPriority] = useState([]);
  const [unverified, setUnverified] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingRef, setUpdatingRef] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [s,hr,del,hp,uv] = await Promise.all([
      apiGet("/dashboard/stats"),
      apiGet("/dashboard/high-risk"),
      apiGet("/dashboard/delayed-referrals"),
      apiGet("/dashboard/high-priority"),
      apiGet("/dashboard/unverified-visits"),
    ]);
    if (s?.success) setStats(s.stats);
    if (hr?.success) setHighRisk(hr.patients);
    if (del?.success) setDelayed(del.referrals);
    if (hp?.success) setHighPriority(hp.referrals);
    if (uv?.success) setUnverified(uv.visits);
    setLoading(false);
  }, []);

  useEffect(()=>{load();},[load]);

  const updateRefStatus = async (refId, status, listSetter) => {
    setUpdatingRef(refId);
    const data = await apiPatch(`/referrals/${refId}/status`,{status});
    if (data?.success) {
      listSetter(prev=>prev.filter(r=>r.id!==refId));
      setStats(s=>s?{...s,pending_referrals:Math.max(0,s.pending_referrals-1)}:s);
    }
    setUpdatingRef(null);
  };

  if (loading) return (
    <div className="cnt">
      <div style={{textAlign:"center",padding:40}}>
        <div style={{width:40,height:40,border:"3px solid var(--border)",borderTopColor:"var(--p)",borderRadius:"50%",animation:"sp .7s linear infinite",margin:"0 auto 12px"}}/>
        <div style={{fontSize:13,color:"var(--muted)",fontWeight:600}}>Loading dashboard...</div>
      </div>
    </div>
  );

  const statItems = [
    {icon:ic.user,val:stats?.total??0,lbl:"Total Patients",bg:"var(--pl)",color:"var(--p)",ic:"var(--p)"},
    {icon:ic.alert,val:stats?.high_risk??0,lbl:"High Risk",bg:"var(--rl)",color:"var(--r)",ic:"var(--r)"},
    {icon:ic.ref,val:stats?.pending_referrals??0,lbl:"Pending Referrals",bg:"var(--ol)",color:"var(--o)",ic:"var(--o)"},
    {icon:ic.clock,val:stats?.due_soon??0,lbl:"Due in 14 days",bg:"var(--pul)",color:"var(--pu)",ic:"var(--pu)"},
    {icon:ic.verify,val:stats?.unverified_visits??0,lbl:"Unverified Visits",bg:"#FFF7ED",color:"#C2410C",ic:"#C2410C"},
    {icon:ic.alert,val:stats?.delayed_referrals??0,lbl:"Delayed Referrals",bg:"var(--rl)",color:"var(--r)",ic:"var(--r)"},
  ];

  return (
    <div className="cnt">
      {/* STATS */}
      <div className="stat-grid">
        {statItems.map((s,i)=>(
          <div className="stat-card" key={i}>
            <div className="stat-icon" style={{background:s.bg}}><Ic d={s.icon} s={20} c={s.ic}/></div>
            <div><div className="stat-val" style={{color:s.color}}>{s.val}</div><div className="stat-lbl">{s.lbl}</div></div>
          </div>
        ))}
      </div>

      {/* HIGH RISK */}
      <div className="card">
        <div className="card-h">
          <div className="card-icon" style={{background:"var(--rl)",color:"var(--r)"}}><Ic d={ic.alert} s={17}/></div>
          <div><div className="card-title">🔴 High Risk Patients</div><div className="card-sub">Multi-factor risk — {highRisk.length} patient{highRisk.length!==1?"s":""}</div></div>
        </div>
        <div className="card-b">
          {highRisk.length===0
            ?<div className="empty"><div className="empty-t" style={{fontSize:13}}>🟢 No high risk patients</div></div>
            :highRisk.map(p=>(
              <div className="dash-row" key={p.id} onClick={()=>onSelectPatient(p)}>
                <div className="dash-av" style={{background:"var(--rl)",color:"var(--r)"}}>{p.name.charAt(0)}</div>
                <div style={{flex:1}}>
                  <div className="dash-name">{p.name}</div>
                  <div className="dash-sub">{p.patient_code}</div>
                  <RiskReasons reasons={p.risk_reasons} compact/>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  {p.systolic_bp&&<div style={{fontFamily:"'Space Mono',monospace",fontSize:12,fontWeight:700,color:"var(--r)"}}>{p.systolic_bp}/{p.diastolic_bp}</div>}
                  {p.visit_date&&<div style={{fontSize:10,color:"var(--muted)",marginTop:2}}>{fmtDate(p.visit_date)}</div>}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* DELAYED REFERRALS */}
      <div className="card">
        <div className="card-h">
          <div className="card-icon" style={{background:"var(--rl)",color:"var(--r)"}}><Ic d={ic.clock} s={17}/></div>
          <div><div className="card-title">⚠️ Delayed Referrals</div><div className="card-sub">Pending for more than 2 days</div></div>
        </div>
        <div className="card-b">
          {delayed.length===0
            ?<div className="empty"><div className="empty-t" style={{fontSize:13}}>✅ No delayed referrals</div></div>
            :delayed.map(r=>(
              <div key={r.id} style={{padding:"12px 0",borderBottom:"1px solid var(--border)"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
                  <div style={{cursor:"pointer"}} onClick={()=>onSelectPatient({id:r.patient_id,name:r.name,patient_code:r.patient_code,phone:r.phone,age:r.age,edd:r.edd,lmp:r.lmp,gravida:r.gravida,address:r.address,blood_group:r.blood_group})}>
                    <div className="dash-name">{r.name}</div>
                    <div className="dash-sub">→ {r.referred_to}</div>
                    <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{fmtDate(r.referral_date)}</div>
                  </div>
                  <span className="badge-delayed">⚠️ {r.days_pending}d delay</span>
                </div>
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <button className="btn btn-g btn-sm" disabled={updatingRef===r.id} onClick={()=>updateRefStatus(r.id,"ARRIVED",setDelayed)}><Ic d={ic.arrived} s={12} c="var(--g)"/> Arrived</button>
                  <button className="btn btn-r btn-sm" disabled={updatingRef===r.id} onClick={()=>updateRefStatus(r.id,"NOT_ARRIVED",setDelayed)}><Ic d={ic.notarrived} s={12} c="var(--r)"/> Not Arrived</button>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* HIGH PRIORITY REFERRALS */}
      <div className="card">
        <div className="card-h">
          <div className="card-icon" style={{background:"var(--rl)",color:"var(--r)"}}><Ic d={ic.fire} s={17}/></div>
          <div><div className="card-title">🔥 High Priority Referrals</div><div className="card-sub">Pending HIGH priority cases</div></div>
        </div>
        <div className="card-b">
          {highPriority.length===0
            ?<div className="empty"><div className="empty-t" style={{fontSize:13}}>✅ No high priority pending</div></div>
            :highPriority.map(r=>(
              <div key={r.id} style={{padding:"12px 0",borderBottom:"1px solid var(--border)"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",cursor:"pointer"}} onClick={()=>onSelectPatient({id:r.patient_id,name:r.name,patient_code:r.patient_code,phone:r.phone,age:r.age,edd:r.edd,lmp:r.lmp,gravida:r.gravida,address:r.address,blood_group:r.blood_group})}>
                  <div>
                    <div className="dash-name">{r.name}</div>
                    <div className="dash-sub">→ {r.referred_to} · {r.reason}</div>
                    <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{fmtDate(r.referral_date)}</div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end"}}>
                    <PriorityBadge priority={r.priority}/>
                    {r.days_pending>2&&<span className="badge-delayed">⚠️ {r.days_pending}d</span>}
                  </div>
                </div>
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <button className="btn btn-g btn-sm" disabled={updatingRef===r.id} onClick={()=>updateRefStatus(r.id,"ARRIVED",setHighPriority)}><Ic d={ic.arrived} s={12} c="var(--g)"/> Arrived</button>
                  <button className="btn btn-r btn-sm" disabled={updatingRef===r.id} onClick={()=>updateRefStatus(r.id,"NOT_ARRIVED",setHighPriority)}><Ic d={ic.notarrived} s={12} c="var(--r)"/> Not Arrived</button>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* UNVERIFIED VISITS */}
      <div className="card">
        <div className="card-h">
          <div className="card-icon" style={{background:"#FFF7ED",color:"#C2410C"}}><Ic d={ic.verify} s={17}/></div>
          <div><div className="card-title">🟡 Unverified Visits</div><div className="card-sub">Awaiting doctor verification</div></div>
        </div>
        <div className="card-b">
          {unverified.length===0
            ?<div className="empty"><div className="empty-t" style={{fontSize:13}}>✅ All visits verified</div></div>
            :unverified.slice(0,5).map(v=>(
              <div className="dash-row" key={v.id} onClick={()=>onSelectPatient({id:v.patient_id,name:v.name,patient_code:v.patient_code,age:v.age,gravida:v.gravida})}>
                <div className="dash-av" style={{background:"#FFF7ED",color:"#C2410C"}}>{v.name.charAt(0)}</div>
                <div style={{flex:1}}>
                  <div className="dash-name">{v.name}</div>
                  <div className="dash-sub">{fmtDate(v.visit_date)} · BP {v.systolic_bp}/{v.diastolic_bp}</div>
                </div>
                <span className="badge-unverified">⚠️ Unverified</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// PATIENT DETAIL
// ════════════════════════════════════════
function DetailScreen({patient, onBack}) {
  const [visits, setVisits] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddVisit, setShowAddVisit] = useState(false);
  const [showRefer, setShowRefer] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState(null);
  const [latestRisk, setLatestRisk] = useState(null);
  const [updatingRef, setUpdatingRef] = useState(null);

  const loadAll = useCallback(async()=>{
    setLoading(true);
    const [vd,rd] = await Promise.all([apiGet(`/visits/${patient.id}`),apiGet(`/referrals/${patient.id}`)]);
    if (vd?.success) {
      setVisits(vd.visits);
      if (vd.visits.length>0) {
        const r = vd.visits[0].risk_reasons?.length>0
          ? {is_high_risk:true,reasons:vd.visits[0].risk_reasons}
          : calcRisk(patient,vd.visits[0]);
        setLatestRisk(r);
      } else {
        // Patient-level risk (age/gravida)
        const r = calcRisk(patient,null);
        setLatestRisk(r);
      }
    }
    if (rd?.success) setReferrals(rd.referrals);
    setLoading(false);
  },[patient.id]);

  useEffect(()=>{loadAll();},[loadAll]);

  const updateStatus = async (refId,status) => {
    setUpdatingRef(refId);
    const data = await apiPatch(`/referrals/${refId}/status`,{status});
    if (data?.success) setReferrals(prev=>prev.map(r=>r.id===refId?{...data.referral,is_delayed:false}:r));
    setUpdatingRef(null);
  };

  const onVerified = (updatedVisit) => {
    setVisits(prev=>prev.map(v=>v.id===updatedVisit.id?{...v,...updatedVisit}:v));
  };

  const latestVisit = visits.length>0?visits[0]:null;

  return (
    <div>
      <div className="detail-header">
        <div className="detail-av">{patient.name.charAt(0)}</div>
        <div className="detail-name">{patient.name}</div>
        <div className="detail-code">{patient.patient_code}</div>
        <div className="detail-badges">
          <div className="detail-badge">Age {patient.age}</div>
          <div className="detail-badge">G{patient.gravida}</div>
          <div className="detail-badge">{getWeeks(patient.lmp)||"—"}</div>
          {latestRisk&&(
            <div className="detail-badge" style={{background:latestRisk.is_high_risk?"rgba(220,38,38,.3)":"rgba(13,159,110,.25)",color:latestRisk.is_high_risk?"#FCA5A5":"#6EE7B7"}}>
              {latestRisk.is_high_risk?"🔴 HIGH RISK":"🟢 Normal"}
            </div>
          )}
        </div>
      </div>

      <div className="cnt">
        {/* RISK BANNER WITH REASONS */}
        {latestRisk?.is_high_risk&&(
          <div className="risk-banner">
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <Ic d={ic.alert} s={18} c="var(--r)"/>
              <div style={{fontSize:14,fontWeight:700,color:"var(--r)"}}>HIGH RISK — Reasons Detected</div>
            </div>
            <div className="risk-reasons">
              {latestRisk.reasons.map((r,i)=>(
                <span key={i} className="risk-reason-tag">{r.factor}: {r.value} — {r.label}</span>
              ))}
            </div>
          </div>
        )}

        <div className="action-row">
          <button className="btn btn-g btn-sm" onClick={()=>setShowAddVisit(true)}><Ic d={ic.plus} s={15} c="var(--g)"/> Add Visit</button>
          <button className="btn btn-o btn-sm" onClick={()=>setShowRefer(true)}><Ic d={ic.ref} s={15} c="var(--o)"/> Refer Patient</button>
        </div>

        {/* PATIENT INFO */}
        <div className="card">
          <div className="card-h"><div className="card-icon"><Ic d={ic.user} s={17}/></div><div><div className="card-title">Patient Info</div></div></div>
          <div className="card-b">
            {[["Phone",patient.phone],["Blood Group",patient.blood_group||"—"],["LMP",fmtDate(patient.lmp)],["EDD",fmtDate(patient.edd)],["Gravida",`G${patient.gravida}`],["Address",patient.address||"—"]].map(([k,v])=>(
              <div className="detail-row" key={k}><span className="dk">{k}</span><span className="dv">{v}</span></div>
            ))}
          </div>
        </div>

        {/* REFERRAL HISTORY */}
        <div className="card">
          <div className="card-h">
            <div className="card-icon" style={{background:"var(--ol)",color:"var(--o)"}}><Ic d={ic.ref} s={17}/></div>
            <div><div className="card-title">Referral History</div><div className="card-sub">{referrals.length} referral{referrals.length!==1?"s":""}</div></div>
          </div>
          <div className="card-b">
            {loading&&<div style={{textAlign:"center",padding:16,color:"var(--muted)",fontSize:13}}>Loading...</div>}
            {!loading&&referrals.length===0&&<div style={{textAlign:"center",padding:"16px 0",color:"var(--muted)",fontSize:13}}>No referrals yet</div>}
            {referrals.map(r=>(
              <div className="ref-card" key={r.id}>
                <div className="ref-card-top">
                  <div>
                    <div className="ref-hospital"><Ic d={ic.hosp} s={14} c="var(--p)"/>{r.referred_to}</div>
                    <div className="ref-reason">Reason: {r.reason}</div>
                    <div className="ref-date">
                      📅 {fmtDate(r.referral_date)}
                      <PriorityBadge priority={r.priority}/>
                      {r.is_delayed&&<span className="badge-delayed">⚠️ {r.days_pending}d delay</span>}
                    </div>
                    {r.notes&&<div style={{fontSize:11,color:"var(--muted)",marginTop:4}}>📝 {r.notes}</div>}
                  </div>
                  <StatusBadge status={r.status}/>
                </div>
                {r.status==="PENDING"&&(
                  <div className="ref-actions">
                    <button className="btn btn-g btn-sm" disabled={updatingRef===r.id} onClick={()=>updateStatus(r.id,"ARRIVED")}><Ic d={ic.arrived} s={13} c="var(--g)"/> Arrived</button>
                    <button className="btn btn-r btn-sm" disabled={updatingRef===r.id} onClick={()=>updateStatus(r.id,"NOT_ARRIVED")}><Ic d={ic.notarrived} s={13} c="var(--r)"/> Not Arrived</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* VISIT HISTORY */}
        <div className="card">
          <div className="card-h">
            <div className="card-icon" style={{background:"var(--rl)",color:"var(--r)"}}><Ic d={ic.heart} s={17}/></div>
            <div><div className="card-title">Visit History</div><div className="card-sub">{visits.length} visit{visits.length!==1?"s":""}</div></div>
          </div>
          <div className="card-b">
            {loading&&<div style={{textAlign:"center",padding:16,color:"var(--muted)",fontSize:13}}>Loading...</div>}
            {!loading&&visits.length===0&&(
              <div style={{textAlign:"center",padding:"16px 0",color:"var(--muted)"}}>
                <div style={{fontSize:13}}>No visits yet</div>
                <button className="btn btn-p btn-sm" style={{marginTop:12,width:"auto",padding:"10px 20px"}} onClick={()=>setShowAddVisit(true)}><Ic d={ic.plus} s={14}/> Add First Visit</button>
              </div>
            )}
            {visits.map((v,i)=>{
              const bpH = isHighBP(v.systolic_bp,v.diastolic_bp);
              const hbL = isLowHb(v.hb);
              const reasons = v.risk_reasons||calcRisk(patient,v).reasons;
              return (
                <div className="visit-row" key={v.id||i}>
                  <div className="visit-top">
                    <div className="visit-date">{fmtDate(v.visit_date)}</div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      {v.hb&&<div style={{fontSize:11,color:hbL?"var(--r)":"var(--muted)",fontWeight:hbL?700:400}}>Hb {v.hb}</div>}
                      <div className={`visit-bp ${bpH?"high":"ok"}`}>{v.systolic_bp}/{v.diastolic_bp}</div>
                    </div>
                  </div>
                  {reasons.length>0&&<RiskReasons reasons={reasons}/>}
                  {v.notes&&<div style={{fontSize:11,color:"var(--muted)",marginTop:5}}>{v.notes}</div>}
                  <div className="visit-footer">
                    {v.is_verified
                      ?<span className="badge-verified"><Ic d={ic.verify} s={11}/>Verified by {v.verified_by||"Doctor"}</span>
                      :<span className="badge-unverified">⚠️ Not Verified</span>}
                    {!v.is_verified&&(
                      <button className="visit-verify-btn" onClick={()=>setVerifyTarget(v)}>
                        <Ic d={ic.verify} s={12}/>Verify
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showAddVisit&&<AddVisitModal patient={patient} onClose={()=>setShowAddVisit(false)} onSaved={(v,hr)=>{setVisits(p=>[v,...p]);const r=calcRisk(patient,v);setLatestRisk(r);}}/>}
      {showRefer&&<ReferModal patient={patient} latestVisit={latestVisit} onClose={()=>setShowRefer(false)} onSaved={r=>setReferrals(p=>[r,...p])}/>}
      {verifyTarget&&<VerifyModal visit={verifyTarget} patient={patient} onClose={()=>setVerifyTarget(null)} onVerified={onVerified}/>}
    </div>
  );
}

// ════════════════════════════════════════
// REGISTER
// ════════════════════════════════════════
function RegisterScreen() {
  const [form, setForm] = useState({name:"",age:"",phone:"",gravida:"1",lmp:"",address:"",blood_group:""});
  const [errs, setErrs] = useState({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);
  const [apiErr, setApiErr] = useState("");
  const nameRef = useRef(null);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const patientRisk = form.age||form.gravida ? calcRisk({age:+form.age||0,gravida:+form.gravida||1},null) : null;
  const onKey = (e) => { if(e.key==="Enter") submit(); };

  useEffect(() => { nameRef.current?.focus(); }, []);

  const validate = () => {
    const e={};
    if (!form.name.trim()) e.name="Required";
    if (!form.age||form.age<10||form.age>60) e.age="Age 10–60";
    if (!/^[6-9]\d{9}$/.test(form.phone)) e.phone="Valid 10-digit number";
    if (!form.lmp) e.lmp="Required";
    if (form.lmp&&new Date(form.lmp)>new Date()) e.lmp="Cannot be future";
    return e;
  };

  const submit = async () => {
    const e=validate();
    if (Object.keys(e).length){setErrs(e);return;}
    setErrs({}); setLoading(true);
    const data = await apiPost("/patients",{...form,age:+form.age,gravida:+form.gravida});
    if (data?.success){
      setDone(data.patient);
      setForm({name:"",age:"",phone:"",gravida:"1",lmp:"",address:"",blood_group:""});
      setApiErr("");
    } else if (data?.message?.includes("Phone")) {
      setErrs(p=>({...p,phone:"Already registered — "+data.message}));
    } else {
      setApiErr("Something went wrong. Try again.");
    }
    setLoading(false);
  };

  const edd = form.lmp?calcEDD(form.lmp):"";
  const weeks = getWeeks(form.lmp);

  return (
    <div className="cnt">
      {done&&(
        <div className="success">
          <Ic d={ic.check} s={22}/>
          <div>
            <div style={{fontSize:13,fontWeight:600,opacity:.9}}>Patient Registered!</div>
            <div className="success-code">{done.patient_code}</div>
            <div style={{fontSize:12,opacity:.75}}>EDD: {fmtDate(done.edd)}</div>
          </div>
        </div>
      )}
      <div className="card">
        <div className="card-h"><div className="card-icon"><Ic d={ic.user} s={17}/></div><div><div className="card-title">New Patient</div><div className="card-sub">Faster than paper</div></div></div>
        <div className="card-b">
          {/* Live registration risk hint */}
          {patientRisk?.is_high_risk&&(
            <div style={{background:"var(--ol)",border:"1px solid #FCD34D",borderLeft:"3px solid var(--o)",borderRadius:"var(--rads)",padding:"8px 12px",marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:700,color:"var(--o)"}}>⚠️ Risk factors: {patientRisk.reasons.map(r=>r.label).join(", ")}</div>
            </div>
          )}
          {apiErr&&<div className="err-box" style={{marginBottom:12}}>⚠️ {apiErr}</div>}
          <div className="field">
            <div className="lbl">Name <span className="req">*</span></div>
            <input ref={nameRef} className={`inp ${errs.name?"err":""}`} placeholder="Full name" autoFocus value={form.name} onChange={e=>set("name",e.target.value)} onKeyDown={onKey}/>
            {errs.name&&<div className="ferr"><Ic d={ic.alert} s={11}/>{errs.name}</div>}
          </div>
          <div className="row2">
            <div className="field">
              <div className="lbl">Age <span className="req">*</span></div>
              <input className={`inp ${errs.age?"err":""}`} type="number" inputMode="numeric" placeholder="yrs" min="10" max="60" value={form.age} onChange={e=>set("age",e.target.value)} onKeyDown={onKey}/>
              {errs.age&&<div className="ferr"><Ic d={ic.alert} s={11}/>{errs.age}</div>}
            </div>
            <div className="field">
              <div className="lbl">Gravida</div>
              <input className="inp" type="number" inputMode="numeric" min="1" max="10" value={form.gravida} onChange={e=>set("gravida",e.target.value)}/>
              {+form.gravida>=3&&<div className="hint" style={{color:"var(--o)"}}>⚠️ G3+ is risk factor</div>}
            </div>
          </div>
          <div className="field">
            <div className="lbl">Mobile <span className="req">*</span></div>
            <input className={`inp ${errs.phone?"err":""}`} type="tel" inputMode="tel" placeholder="10-digit number" maxLength={10} value={form.phone} onChange={e=>{set("phone",e.target.value.replace(/\D/g,"")); setApiErr(""); setErrs(p=>({...p,phone:undefined}));}} onKeyDown={onKey}/>
            {errs.phone&&<div className="ferr"><Ic d={ic.alert} s={11}/>{errs.phone}</div>}
          </div>
          <div className="field">
            <div className="lbl">LMP <span className="req">*</span></div>
            <input className={`inp ${errs.lmp?"err":""}`} type="date" max={new Date().toISOString().split("T")[0]} value={form.lmp} onChange={e=>set("lmp",e.target.value)}/>
            {errs.lmp&&<div className="ferr"><Ic d={ic.alert} s={11}/>{errs.lmp}</div>}
            {edd&&<div className="edd"><div><div className="edd-lbl">Expected Delivery</div>{weeks&&<div style={{fontSize:11,color:"var(--g)",marginTop:1}}>{weeks} pregnant</div>}</div><div className="edd-val">{edd}</div></div>}
          </div>
          <div className="row2">
            <div className="field">
              <div className="lbl">Blood Group</div>
              <select className="inp" value={form.blood_group} onChange={e=>set("blood_group",e.target.value)}>
                <option value="">Select</option>
                {["A+","A-","B+","B-","O+","O-","AB+","AB-"].map(g=><option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="field">
              <div className="lbl">Address</div>
              <input className="inp" placeholder="Village/Town" value={form.address} onChange={e=>set("address",e.target.value)}/>
            </div>
          </div>
          <button className="btn btn-p" onClick={submit} disabled={loading}>
            {loading?<div className="spin"/>:<Ic d={ic.check} s={17}/>}
            {loading?"Saving...":"Save Patient"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
// SEARCH
// ════════════════════════════════════════
function SearchScreen({onSelect}) {
  const [q, setQ] = useState("");
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [undoData, setUndoData] = useState(null);
  const [undoProgress, setUndoProgress] = useState(100);
  const undoTimerRef = useRef(null);
  const undoIntervalRef = useRef(null);

  const fetch_ = useCallback(async(search)=>{
    setLoading(true); setApiError(false);
    const data = await apiGet(`/patients?search=${encodeURIComponent(search)}`);
    if (data?.success) setPatients(data.patients);
    else { setApiError(true); setPatients([]); }
    setLoading(false);
  },[]);

  useEffect(()=>{const t=setTimeout(()=>fetch_(q),300);return()=>clearTimeout(t);},[q,fetch_]);

  const toggleSelect=(e,id)=>{e.stopPropagation();setSelected(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});};

  const deleteSelected=async()=>{
    if (!selected.size) return;
    const toDelete=patients.filter(p=>selected.has(p.id));
    setPatients(prev=>prev.filter(p=>!selected.has(p.id)));
    setSelected(new Set());
    for (const p of toDelete) await apiDelete(`/patients/${p.id}`);
    setUndoData({patients:toDelete}); setUndoProgress(100);
    const start=Date.now();
    undoIntervalRef.current=setInterval(()=>setUndoProgress(Math.max(0,100-((Date.now()-start)/10000)*100)),100);
    undoTimerRef.current=setTimeout(()=>{setUndoData(null);clearInterval(undoIntervalRef.current);},10000);
  };

  const handleUndo=async()=>{
    clearTimeout(undoTimerRef.current); clearInterval(undoIntervalRef.current);
    if (!undoData) return;
    for (const p of undoData.patients) await apiPost("/patients/restore",p);
    setUndoData(null); fetch_(q);
  };

  useEffect(()=>()=>{clearTimeout(undoTimerRef.current);clearInterval(undoIntervalRef.current);},[]);

  return (
    <div className="cnt">
      <div className="srch-wrap">
        <div className="srch-ic"><Ic d={ic.search} s={17}/></div>
        <input className="srch-inp" placeholder="Search by name, phone or NX code..." value={q} onChange={e=>setQ(e.target.value)} autoFocus/>
      </div>
      {selected.size>0&&(
        <div style={{background:"var(--rl)",border:"1.5px solid #FCA5A5",borderRadius:"var(--rads)",padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--r)"}}>{selected.size} selected</div>
          <button className="btn btn-r btn-sm" onClick={deleteSelected}><Ic d={ic.trash} s={14}/> Delete</button>
        </div>
      )}
      {apiError&&<div className="err-box">⚠️ Cannot connect to backend. Run: <code>node server.js</code></div>}
      {loading&&<div style={{textAlign:"center",padding:20,color:"var(--muted)",fontSize:13}}>Searching...</div>}
      {!loading&&!apiError&&patients.length===0&&(
        <div className="empty">
          <div className="empty-icon"><Ic d={ic.user} s={26}/></div>
          <div className="empty-t">No patients found</div>
          <div style={{fontSize:13}}>{q?"Try different search":"Register your first patient"}</div>
        </div>
      )}
      {patients.map(p=>{
        const {is_high_risk,reasons}=calcRisk(p,null);
        return (
          <div className={`pt-card ${selected.has(p.id)?"selected":""}`} key={p.id}>
            <div className={`chk ${selected.has(p.id)?"checked":""}`} onClick={e=>toggleSelect(e,p.id)}>{selected.has(p.id)&&<Ic d={ic.check} s={12} c="#fff"/>}</div>
            <div style={{flex:1}} onClick={()=>onSelect(p)}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div className="pt-name">{p.name}</div>
                {is_high_risk&&<span className="badge-high">🔴 RISK</span>}
              </div>
              <div className="pt-meta"><span className="code-badge">{p.patient_code}</span><span className="pt-info"><Ic d={ic.phone} s={10}/>{p.phone}</span></div>
              {is_high_risk&&<RiskReasons reasons={reasons} compact/>}
              <div style={{fontSize:12,color:"var(--muted)",marginTop:4,display:"flex",alignItems:"center",gap:4}}>
                <Ic d={ic.cal} s={10}/>EDD: {fmtDate(p.edd)}
                {getWeeks(p.lmp)&&<span style={{color:"var(--p)",fontWeight:700,marginLeft:4}}>· {getWeeks(p.lmp)}</span>}
              </div>
            </div>
          </div>
        );
      })}
      {undoData&&(
        <div className="undo-toast">
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600}}>{undoData.patients.length} patient{undoData.patients.length>1?"s":""} deleted</div>
            <div style={{height:3,background:"#2D3748",borderRadius:2,marginTop:6}}>
              <div style={{height:"100%",background:"var(--p)",borderRadius:2,width:`${undoProgress}%`,transition:"width .1s linear"}}/>
            </div>
          </div>
          <button className="undo-btn" onClick={handleUndo}><Ic d={ic.undo} s={13}/> Undo</button>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════
// ROOT
// ════════════════════════════════════════
export default function NexAI() {
  const [tab, setTab] = useState("dashboard");
  const [selectedPatient, setSelectedPatient] = useState(null);

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <div className="nav">
          <div>
            {selectedPatient?<div style={{fontSize:17,fontWeight:700,color:"#fff"}}>Patient Detail</div>:<div className="nav-logo">Nex<span>AI</span></div>}
            <div className="nav-sub">{selectedPatient?selectedPatient.patient_code:"Maternal Health Platform"}</div>
          </div>
          {selectedPatient
            ?<button className="nav-back" onClick={()=>setSelectedPatient(null)}><Ic d={ic.back} s={14}/> Back</button>
            :<Ic d={ic.heart} s={22} c="rgba(255,255,255,.7)"/>}
        </div>
        {!selectedPatient&&(
          <div className="tabs">
            <button className={`tab ${tab==="dashboard"?"on":""}`} onClick={()=>setTab("dashboard")}><Ic d={ic.dash} s={13}/> Dashboard</button>
            <button className={`tab ${tab==="register"?"on":""}`} onClick={()=>setTab("register")}><Ic d={ic.plus} s={13}/> Register</button>
            <button className={`tab ${tab==="search"?"on":""}`} onClick={()=>setTab("search")}><Ic d={ic.search} s={13}/> Patients</button>
          </div>
        )}
        {!selectedPatient&&tab==="dashboard"&&<DashboardScreen onSelectPatient={p=>setSelectedPatient(p)}/>}
        {!selectedPatient&&tab==="register"&&<RegisterScreen/>}
        {!selectedPatient&&tab==="search"&&<SearchScreen onSelect={p=>setSelectedPatient(p)}/>}
        {selectedPatient&&<DetailScreen patient={selectedPatient} onBack={()=>setSelectedPatient(null)}/>}
      </div>
    </>
  );
}
