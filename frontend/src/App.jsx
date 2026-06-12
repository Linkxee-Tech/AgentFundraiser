import { useState, useEffect, useRef, useCallback } from "react";
import { ethers } from "ethers";
import { isChainReady, createContracts, fetchRuleSet, fetchTreasuryBalance, fetchBounties, fetchAgents, fetchPayments, fetchTreasuryRequests, fetchAccessProfile, switchToPharos, tokenAddresses, createERC20Contract, contractAddress } from "./contractHelpers";



// ─────────────────────────────────────────────────────────────────────────────

// HELPERS

// ─────────────────────────────────────────────────────────────────────────────

const shortAddr = (a = "") => a.length > 10 ? `${a.slice(0,6)}…${a.slice(-4)}` : a;
const fmt  = (n, d=2) => Number(n).toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});
const now  = () => Date.now();
const tsMs = (offset=0) => new Date(now()-offset).toLocaleTimeString("en-US",{hour12:false});
const tsFull = (ms) => new Date(ms).toLocaleString("en-US",{hour12:false,month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
const uid  = () => Math.random().toString(36).slice(2,9);
const daysLeft = (d) => Math.max(0, Math.ceil((d - now()) / 86400000));
const utcHour  = () => new Date().getUTCHours();
const isMarketingWindow = () => { const h=utcHour(); return h>=9&&h<17; };
const MULTISIG_THRESHOLD  = 100;
const RESERVE_FLOOR_DEF   = 200;
const TX_CONFIRMATIONS    = 2;
const waitForTx           = (tx) => tx.wait(TX_CONFIRMATIONS);
const PAYMENT_CATEGORIES  = ["bounty","a2a","marketing","community","other"];

const TOKENS = {
  PROS:    { symbol:"PROS",   name:"Pharos Native",   color:"#00D4FF" },
  "USDC-P":{ symbol:"USDC-P", name:"Pharos USDC",     color:"#3B82F6" },
  "ETH-P": { symbol:"ETH-P",  name:"Pharos ETH",      color:"#A78BFA" },
};

// ─────────────────────────────────────────────────────────────────────────────

// SEED DATA

// ─────────────────────────────────────────────────────────────────────────────

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#080D1A;--surface:#0F1829;--card:#131E30;--card2:#0D1624;
  --border:#1E2F4A;--border2:#253A58;
  --cyan:#00D4FF;--violet:#8B5CF6;--green:#10B981;--amber:#F59E0B;
  --red:#EF4444;--blue:#3B82F6;--pink:#EC4899;--teal:#14B8A6;
  --text:#E8F0FF;--muted:#5A7090;--muted2:#3D5470;
  --mono:'JetBrains Mono',monospace;--sans:'Space Grotesk',sans-serif;
}

body{background:var(--bg);color:var(--text);font-family:var(--sans);min-height:100vh;overflow-x:hidden}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:var(--surface)}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:2px}
select,input,textarea{color-scheme:dark}
select{appearance:none}
.app{display:flex;flex-direction:column;min-height:100vh}

/* ── Header ── */
.header{position:sticky;top:0;z-index:300;display:flex;align-items:center;justify-content:space-between;padding:0 22px;height:58px;background:rgba(8,13,26,.96);backdrop-filter:blur(14px);border-bottom:1px solid var(--border)}
.logo{display:flex;align-items:center;gap:10px}
.logo-mark{width:34px;height:34px;border-radius:9px;flex-shrink:0;background:linear-gradient(135deg,var(--cyan),var(--violet));display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff}
.logo-text{font-size:15px;font-weight:700;line-height:1.1}
.logo-sub{font-size:10px;color:var(--muted);font-family:var(--mono)}
.hdr-right{display:flex;align-items:center;gap:10px}
.role-wrap{display:flex;align-items:center;gap:6px}
.role-lbl{font-size:11px;color:var(--muted)}
.role-sel{padding:4px 10px;border-radius:20px;border:1px solid var(--border2);background:var(--surface);font-family:var(--sans);font-size:12px;font-weight:600;cursor:pointer;outline:none;min-width:88px}
.role-Owner{border-color:rgba(0,212,255,.45);color:var(--cyan)}
.role-Agent{border-color:rgba(139,92,246,.45);color:var(--violet)}
.role-Verifier{border-color:rgba(245,158,11,.45);color:var(--amber)}
.role-User{border-color:rgba(16,185,129,.45);color:var(--green)}
.net-badge{font-family:var(--mono);font-size:11px;padding:4px 10px;border-radius:20px;background:rgba(0,212,255,.07);color:var(--cyan);border:1px solid rgba(0,212,255,.18);display:flex;align-items:center;gap:6px}
.dot-live{width:6px;height:6px;border-radius:50%;background:var(--green);animation:pulse 2s infinite;flex-shrink:0}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.75)}}
.btn-wallet{padding:6px 14px;border-radius:8px;border:1px solid var(--cyan);background:rgba(0,212,255,.07);color:var(--cyan);cursor:pointer;font-family:var(--sans);font-size:12px;font-weight:500;transition:background .18s}
.btn-wallet:hover{background:rgba(0,212,255,.14)}
.btn-wallet.conn{background:rgba(16,185,129,.07);border-color:var(--green);color:var(--green)}
.btn-wallet.paused{background:rgba(239,68,68,.07);border-color:var(--red);color:var(--red)}

/* ── Notification Bell ── */
.bell-wrap{position:relative;cursor:pointer}
.bell-btn{width:34px;height:34px;border-radius:8px;border:1px solid var(--border);background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:15px;cursor:pointer;transition:background .15s}
.bell-btn:hover{background:var(--border)}
.bell-dot{position:absolute;top:5px;right:5px;width:8px;height:8px;border-radius:50%;background:var(--red);border:2px solid var(--bg)}
.notif-panel{position:absolute;top:42px;right:0;width:320px;background:var(--card);border:1px solid var(--border);border-radius:10px;z-index:500;box-shadow:0 12px 40px rgba(0,0,0,.7);overflow:hidden}
.notif-header{padding:10px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:600}
.notif-item{padding:10px 14px;border-bottom:1px solid rgba(30,47,74,.4);cursor:pointer;transition:background .12s}
.notif-item:hover{background:var(--surface)}
.notif-item:last-child{border-bottom:none}
.notif-unread{background:rgba(0,212,255,.03)}
.notif-msg{font-size:12px;line-height:1.5}
.notif-time{font-size:10px;color:var(--muted);font-family:var(--mono);margin-top:2px}
.notif-type-icon{font-size:14px;flex-shrink:0;margin-right:8px}

/* ── Stats Bar ── */
.stats-bar{display:grid;grid-template-columns:repeat(6,1fr);gap:1px;background:var(--border);border-bottom:1px solid var(--border)}
.stat-cell{background:var(--surface);padding:11px 16px;display:flex;flex-direction:column;gap:2px}
.stat-lbl{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.stat-val{font-family:var(--mono);font-size:19px;font-weight:700}
.stat-sub{font-size:10px;color:var(--muted);font-family:var(--mono)}
.cv{color:var(--cyan)}.vv{color:var(--violet)}.gv{color:var(--green)}.av{color:var(--amber)}.rv{color:var(--red)}.bv{color:var(--blue)}

/* ── Main / Tabs ── */
.main{flex:1;padding:0 22px 48px;max-width:1400px;margin:0 auto;width:100%}
.tabs{display:flex;border-bottom:1px solid var(--border);margin-bottom:22px;overflow-x:auto;gap:0}
.tab-btn{padding:12px 16px;cursor:pointer;border:none;background:transparent;font-family:var(--sans);font-size:12px;font-weight:500;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-1px;transition:color .15s,border-color .15s;display:flex;align-items:center;gap:6px;white-space:nowrap;flex-shrink:0}
.tab-btn:hover{color:var(--text)}
.tab-btn.act{color:var(--cyan);border-bottom-color:var(--cyan)}
.tab-badge{min-width:17px;height:17px;border-radius:9px;padding:0 4px;background:rgba(239,68,68,.2);color:var(--red);font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center}

/* ── Cards ── */
.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px 20px}
.cdk{background:var(--card2);border:1px solid var(--border)}
.ctitle{font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:13px;display:flex;align-items:center;gap:8px}
.cdot{width:6px;height:6px;border-radius:50%;flex-shrink:0}

/* ── Grid ── */
.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.gc{display:grid;grid-template-columns:1fr 3fr;gap:14px}
.s2{grid-column:span 2}
.stack{display:flex;flex-direction:column;gap:14px}

/* ── Form ── */
.fld{display:flex;flex-direction:column;gap:5px}
.fld label{font-size:11px;font-weight:500;color:var(--muted)}
.fld input,.fld textarea,.fld select{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 11px;font-family:var(--sans);font-size:13px;color:var(--text);transition:border-color .15s;outline:none}
.fld input:focus,.fld textarea:focus,.fld select:focus{border-color:rgba(0,212,255,.45)}
.fld textarea{resize:vertical;min-height:66px}
.ig{display:flex;gap:7px}
.ig input,.ig select{flex:1}
.fr{display:grid;grid-template-columns:1fr 1fr;gap:10px}

/* ── Buttons ── */
.btn{padding:8px 15px;border-radius:8px;border:none;font-family:var(--sans);font-size:12px;font-weight:600;cursor:pointer;transition:opacity .15s,transform .1s;display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.btn:hover{opacity:.84}
.btn:active{transform:scale(.98)}
.btn:disabled{opacity:.35;cursor:not-allowed}
.bp{background:var(--cyan);color:var(--bg)}
.bv2{background:var(--violet);color:#fff}
.bg{background:var(--green);color:#fff}
.br{background:var(--red);color:#fff}
.ba{background:var(--amber);color:var(--bg)}
.bb{background:var(--blue);color:#fff}
.bt{background:var(--teal);color:#fff}
.bgh{background:var(--surface);color:var(--text);border:1px solid var(--border)}
.bsm{padding:4px 10px;font-size:11px;border-radius:6px}
.bxs{padding:3px 8px;font-size:10px;border-radius:5px}
.bfull{width:100%;justify-content:center}

/* ── Table ── */
.tw{overflow-x:auto;border-radius:8px}
table{width:100%;border-collapse:collapse;font-size:12px}
thead th{text-align:left;padding:7px 10px;font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--border);background:var(--surface)}
tbody tr{border-bottom:1px solid rgba(30,47,74,.35);transition:background .1s}
tbody tr:last-child{border-bottom:none}
tbody tr:hover{background:rgba(255,255,255,.01)}
tbody td{padding:8px 10px;vertical-align:middle}
.mono{font-family:var(--mono);font-size:11px}

/* ── Badges ── */
.badge{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;font-family:var(--mono)}
.b-open{background:rgba(0,212,255,.1);color:var(--cyan)}
.b-submitted{background:rgba(245,158,11,.1);color:var(--amber)}
.b-approved{background:rgba(16,185,129,.1);color:var(--green)}
.b-expired{background:rgba(239,68,68,.1);color:var(--red)}
.b-cancelled{background:rgba(90,112,144,.12);color:var(--muted)}
.b-pending{background:rgba(245,158,11,.1);color:var(--amber)}
.b-active{background:rgba(16,185,129,.1);color:var(--green)}
.b-inactive{background:rgba(90,112,144,.12);color:var(--muted)}
.b-deposit{background:rgba(0,212,255,.1);color:var(--cyan)}
.b-withdraw{background:rgba(239,68,68,.1);color:var(--red)}
.b-agentpay{background:rgba(139,92,246,.1);color:var(--violet)}
.b-bounty{background:rgba(245,158,11,.1);color:var(--amber)}
.b-scheduled{background:rgba(59,130,246,.1);color:var(--blue)}
.b-multisig{background:rgba(236,72,153,.1);color:var(--pink)}
.b-marketing{background:rgba(20,184,166,.1);color:var(--teal)}
.b-community{background:rgba(139,92,246,.1);color:var(--violet)}
.b-operations{background:rgba(59,130,246,.1);color:var(--blue)}
.b-a2a{background:rgba(139,92,246,.1);color:var(--violet)}
.b-other{background:rgba(90,112,144,.12);color:var(--muted)}

/* ── Terminal ── */
.term{background:#040811;border:1px solid var(--border);border-radius:12px;overflow:hidden;font-family:var(--mono);font-size:11.5px}
.term-bar{display:flex;align-items:center;gap:7px;padding:9px 14px;background:var(--surface);border-bottom:1px solid var(--border)}
.tdot{width:10px;height:10px;border-radius:50%}
.t-title{color:var(--muted);font-size:10px;margin-left:4px;flex:1}
.t-status{display:flex;align-items:center;gap:5px;font-size:10px}
.term-body{padding:11px 14px;height:240px;overflow-y:auto;display:flex;flex-direction:column;gap:3px}
.ll{display:flex;gap:10px;line-height:1.65}
.lt{color:var(--muted);flex-shrink:0;font-size:10px}
.lk{flex-shrink:0;width:62px;font-size:10px}
.lk-deposit{color:var(--cyan)}.lk-pay{color:var(--violet)}.lk-approve{color:var(--green)}
.lk-bounty{color:var(--amber)}.lk-rule{color:#A78BFA}.lk-info{color:var(--muted)}
.lk-multisig{color:var(--pink)}.lk-warn{color:var(--red)}
.lv{color:#BDD0F0;font-size:11px;word-break:break-all}
.cursor{display:inline-block;width:7px;height:12px;background:var(--cyan);animation:blink 1s step-end infinite;vertical-align:text-bottom}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
.fu{animation:fadeUp .3s ease}
@keyframes fadeUp{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}

/* ── Tx row ── */
.txr{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(30,47,74,.3)}
.txr:last-child{border-bottom:none}
.txi{width:30px;height:30px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0}
.txm{flex:1;min-width:0}
.txt{font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.txs{font-size:10px;color:var(--muted);font-family:var(--mono);margin-top:1px}
.txa{font-family:var(--mono);font-size:13px;font-weight:700;text-align:right;flex-shrink:0}

/* ── Mini bar ── */
.bw{display:flex;flex-direction:column;gap:7px}
.br2{display:flex;align-items:center;gap:8px;font-size:11px}
.bl{width:110px;color:var(--muted);flex-shrink:0}
.bt2{flex:1;height:5px;background:var(--border);border-radius:3px;overflow:hidden}
.bf{height:100%;border-radius:3px;transition:width .8s ease}
.bval{width:52px;text-align:right;font-family:var(--mono);color:var(--muted)}

/* ── Rule row ── */
.rr{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid rgba(30,47,74,.35)}
.rr:last-child{border-bottom:none}
.rk{font-family:var(--mono);font-size:11px}
.rd{font-size:11px;color:var(--muted);margin-top:2px}
.rrr{display:flex;align-items:center;gap:7px;flex-shrink:0}
.ri{width:82px;text-align:right;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-family:var(--mono);font-size:12px;color:var(--cyan);outline:none;transition:border-color .15s}
.ri:focus{border-color:rgba(0,212,255,.45)}
.rs{width:190px;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-family:var(--mono);font-size:11px;color:var(--text);outline:none}
.rs:focus{border-color:rgba(0,212,255,.45)}
.toggle{position:relative;width:38px;height:20px;cursor:pointer;background:var(--border2);border-radius:10px;border:none;transition:background .2s;flex-shrink:0}
.toggle.on{background:var(--green)}
.toggle.ron.on{background:var(--red)}
.toggle::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .2s}
.toggle.on::after{transform:translateX(18px)}
.toggle:disabled{opacity:.4;cursor:not-allowed}

/* ── Toast ── */
.tst-wrap{position:fixed;bottom:20px;right:20px;z-index:999;display:flex;flex-direction:column;gap:7px;pointer-events:none}
.tst{padding:10px 16px;border-radius:9px;font-size:12px;font-weight:500;border-left:3px solid;pointer-events:auto;max-width:340px;animation:slideIn .25s ease;box-shadow:0 6px 24px rgba(0,0,0,.6)}
.tst-success{background:#0A1F15;border-color:var(--green);color:var(--green)}
.tst-error{background:#1F0A0A;border-color:var(--red);color:var(--red)}
.tst-info{background:#0A1220;border-color:var(--cyan);color:var(--cyan)}
.tst-warn{background:#1F180A;border-color:var(--amber);color:var(--amber)}
@keyframes slideIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}

/* ── Section heading ── */
.sh{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.sht{font-size:14px;font-weight:600}

/* ── Pills ── */
.pills{display:flex;gap:6px;flex-wrap:wrap}
.pill{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:500;border:1px solid var(--border2);color:var(--muted);cursor:pointer;transition:all .15s;background:transparent}
.pill.ap{background:rgba(0,212,255,.1);color:var(--cyan);border-color:rgba(0,212,255,.3)}

/* ── Alert banner ── */
.alert{padding:10px 16px;border-radius:8px;border-left:3px solid;font-size:12px;display:flex;align-items:center;gap:9px}
.alert-warn{background:rgba(245,158,11,.07);border-color:var(--amber);color:var(--amber)}
.alert-err{background:rgba(239,68,68,.07);border-color:var(--red);color:var(--red)}
.alert-ok{background:rgba(16,185,129,.07);border-color:var(--green);color:var(--green)}
.alert-info{background:rgba(0,212,255,.06);border-color:var(--cyan);color:var(--cyan)}

/* ── AI Box ── */
.ai-box{background:rgba(139,92,246,.05);border:1px solid rgba(139,92,246,.2);border-radius:8px;padding:11px;margin-top:8px}
.ai-bar-track{height:6px;border-radius:3px;background:var(--border);overflow:hidden;margin:6px 0}
.ai-bar-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--violet),var(--cyan))}

/* ── Multi-sig ── */
.ms-card{background:rgba(236,72,153,.04);border:1px solid rgba(236,72,153,.2);border-radius:8px;padding:13px;margin-bottom:10px}
.ms-sigs{display:flex;gap:6px;margin:8px 0}
.ms-sig{display:flex;align-items:center;gap:5px;font-size:11px;font-family:var(--mono);padding:3px 9px;border-radius:20px}
.ms-done{background:rgba(16,185,129,.1);color:var(--green)}
.ms-wait{background:rgba(30,47,74,.5);color:var(--muted)}

/* ── Health row ── */
.hr2{display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(30,47,74,.35)}
.hr2:last-child{border-bottom:none}
.hdot{width:7px;height:7px;border-radius:50%;flex-shrink:0}

/* ── Submission item ── */
.sub-it{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:6px}
.sub-it:last-child{margin-bottom:0}

/* ── Sch item ── */
.sc-it{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(30,47,74,.3)}
.sc-it:last-child{border-bottom:none}

/* ── Commands ── */
.cmd-console{background:#040811;border:1px solid var(--border);border-radius:12px;overflow:hidden}
.cmd-header{background:var(--surface);padding:10px 14px;border-bottom:1px solid var(--border);font-family:var(--mono);font-size:11px;color:var(--muted)}
.cmd-body{padding:14px;display:flex;flex-direction:column;gap:10px}
.cmd-input-row{display:flex;gap:8px;align-items:center}
.cmd-prompt{font-family:var(--mono);font-size:14px;color:var(--cyan);flex-shrink:0}
.cmd-input{flex:1;background:transparent;border:none;outline:none;font-family:var(--mono);font-size:13px;color:var(--text)}
.cmd-output{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 12px;min-height:80px;max-height:200px;overflow-y:auto;font-family:var(--mono);font-size:11px}
.cmd-line{color:#BDD0F0;line-height:1.7}
.cmd-line.ok{color:var(--green)}
.cmd-line.err{color:var(--red)}
.cmd-line.info{color:var(--cyan)}
.cmd-ref{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px}
.cmd-row{display:flex;gap:10px;padding:6px 0;border-bottom:1px solid rgba(30,47,74,.3)}
.cmd-row:last-child{border-bottom:none}
.cmd-name{font-family:var(--mono);font-size:12px;color:var(--cyan);width:200px;flex-shrink:0}
.cmd-desc{font-size:11px;color:var(--muted)}

/* ── Token chip ── */
.tkchip{display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;border:1px solid var(--border2);cursor:pointer;font-size:11px;font-weight:600;transition:all .15s;background:var(--surface)}
.tkchip.sel{border-color:rgba(0,212,255,.4);color:var(--cyan);background:rgba(0,212,255,.06)}

/* ── Marketing/Community hours indicator ── */
.hours-badge{display:inline-flex;align-items:center;gap:5px;font-family:var(--mono);font-size:11px;padding:4px 10px;border-radius:20px}
.hours-ok{background:rgba(16,185,129,.1);color:var(--green)}
.hours-off{background:rgba(239,68,68,.1);color:var(--red)}

/* ── Divider ── */
hr{border:none;border-top:1px solid var(--border)}

/* ── Empty ── */
.empty{text-align:center;padding:32px 20px;color:var(--muted);font-size:12px}
.ei{font-size:26px;margin-bottom:8px}

/* ── Glow ── */
.gc2{box-shadow:0 0 0 1px rgba(0,212,255,.1),0 0 24px rgba(0,212,255,.04)}
.gv2{box-shadow:0 0 0 1px rgba(139,92,246,.1),0 0 20px rgba(139,92,246,.04)}
.gr2{box-shadow:0 0 0 1px rgba(239,68,68,.18),0 0 16px rgba(239,68,68,.06)}

/* ── Responsive ── */
@media(max-width:900px){
  .stats-bar{grid-template-columns:repeat(3,1fr)}
  .g2,.g3,.g4,.gc{grid-template-columns:1fr}
  .s2{grid-column:span 1}
  .header,.main{padding-left:14px;padding-right:14px}
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// TOAST + NOTIFICATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function Toasts({ toasts }) {
  return (
    <div className="tst-wrap">
      {toasts.map(t=><div key={t.id} className={`tst tst-${t.type}`}>{t.msg}</div>)}
    </div>
  );
}

const NOTIF_ICONS = { bounty:"🎯", payment:"⚡", approve:"✅", rule:"🛡", multisig:"🔐", info:"ℹ" };
function NotificationBell({ notifications, setNotifications }) {
  const [open, setOpen] = useState(false);
  const unread = notifications.filter(n=>!n.read).length;
  const markAll = () => setNotifications(ns=>ns.map(n=>({...n,read:true})));

  return (
    <div className="bell-wrap">
      <div className="bell-btn" onClick={()=>setOpen(!open)}>🔔
        {unread>0&&<div className="bell-dot"/>}
      </div>
      {open&&(
        <div className="notif-panel">
          <div className="notif-header">
            <span>Notifications {unread>0&&<span className="tab-badge" style={{marginLeft:6}}>{unread}</span>}</span>
            <button className="btn bgh bxs" onClick={markAll}>Mark all read</button>
          </div>
          <div style={{maxHeight:340,overflowY:"auto"}}>
            {notifications.length===0&&<div className="empty" style={{padding:20}}>No notifications</div>}
            {notifications.map(n=>(
              <div key={n.id} className={`notif-item${n.read?"":" notif-unread"}`} onClick={()=>setNotifications(ns=>ns.map(x=>x.id===n.id?{...x,read:true}:x))}>
                <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                  <span className="notif-type-icon">{NOTIF_ICONS[n.type]||"ℹ"}</span>
                  <div>
                    <div className="notif-msg" style={{color:n.read?"var(--muted)":"var(--text)"}}>{n.msg}</div>
                    <div className="notif-time">{tsFull(n.time)}</div>
                  </div>
                  {!n.read&&<div style={{width:7,height:7,borderRadius:"50%",background:"var(--cyan)",flexShrink:0,marginTop:4,marginLeft:"auto"}}/>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────
function AccessDenied({ role }) {
  return (
    <div className="card" style={{maxWidth:640}}>
      <div className="ctitle"><span className="cdot" style={{background:"var(--red)"}}/>Protected Admin Route</div>
      <p className="muted" style={{lineHeight:1.7}}>
        Admin capabilities are available only to wallets that are contract owners. Your authenticated role is <b>{role}</b>.
      </p>
      <p className="muted" style={{lineHeight:1.7,marginTop:10}}>
        Connect the owner wallet on Pharos Testnet to access treasury controls, rule management, multi-sig approvals, emergency controls, and monitoring.
      </p>
    </div>
  );
}

function OverviewTab({ tokenBalances, bounties, payments, txns, logs, multisigQueue, agents, rules }) {
  const openB   = bounties.filter(b=>b.status==="open").length;
  const pendB   = bounties.filter(b=>b.status==="submitted").length;
  const totalPaid = payments.reduce((a,p)=>a+p.amount,0);
  const paused  = rules.bool.EMERGENCY_PAUSE?.value;
  const pros    = tokenBalances.PROS;
  const floor   = rules.numeric.RESERVE_FLOOR?.value||200;

  return (
    <div className="stack">
      {paused&&<div className="alert alert-err">⚠ EMERGENCY PAUSE ACTIVE — all outgoing payments are halted. Visit Admin to resume.</div>}
      {multisigQueue.filter(m=>m.status==="pending").length>0&&
        <div className="alert alert-warn">🔐 {multisigQueue.filter(m=>m.status==="pending").length} multi-sig request(s) pending Owner approval — visit Admin panel</div>}
      {!isMarketingWindow()&&rules.bool.ENFORCE_MARKETING_HOURS?.value&&
        <div className="alert alert-info">🕐 Marketing payment window: 09:00–17:00 UTC. Current UTC hour: {utcHour()}:xx — marketing payments are currently blocked.</div>}
      <div className="g4">
        {[
          {label:"PROS Balance",      val:`${fmt(pros)}`,    sub:"PROS available",     cls:"cv", extra:`Reserve: ${fmt(floor)} locked`},
          {label:"Open Bounties",     val:openB,             sub:`${pendB} pending`,   cls:"av", extra:`${bounties.filter(b=>b.status==="approved").length} approved total`},
          {label:"Active Agents",     val:agents.filter(a=>a.active).length, sub:`${agents.length} registered`, cls:"vv", extra:"A2A payments enabled"},
          {label:"Total Paid Out",    val:`${fmt(totalPaid)}`,sub:"PROS lifetime",     cls:"gv", extra:`${payments.length} transactions`},
        ].map(k=>(
          <div key={k.label} className="card">
            <div className="ctitle"><span className="cdot" style={{background:`var(--${k.cls.replace("v","")})`}}/>{k.label}</div>
            <div style={{fontFamily:"var(--mono)",fontSize:24,fontWeight:700}} className={k.cls}>{k.val}</div>
            <div style={{fontSize:11,color:"var(--muted)",marginTop:3,fontFamily:"var(--mono)"}}>{k.sub}</div>
            <div style={{fontSize:10,color:"var(--muted2)",marginTop:2}}>{k.extra}</div>
          </div>
        ))}
      </div>
      <div className="g2">
        {/* Agent Terminal */}
        <div className="term gc2" style={{gridColumn:"span 2"}}>
          <div className="term-bar">
            <div className="tdot" style={{background:"#EF4444"}}/><div className="tdot" style={{background:"#F59E0B"}}/><div className="tdot" style={{background:"#10B981"}}/>
            <span className="t-title">agent-fundraiser@pharos-testnet ~ agent.core [loop pid:1337] [{rules.string.GEMINI_MODEL?.value}]</span>
            <span className="t-status" style={{color:paused?"var(--red)":"var(--green)"}}>
              <div className="dot-live" style={{background:paused?"var(--red)":"var(--green)"}}/>
              {paused?"PAUSED":"RUNNING"}
            </span>
          </div>
          <div className="term-body" id="term-body">
            {logs.slice(-22).map((l,i)=>(
              <div key={l.id} className={`ll${i===Math.min(logs.length,22)-1?" fu":""}`}>
                <span className="lt">{new Date(l.time).toLocaleTimeString("en-US",{hour12:false})}</span>
                <span className={`lk lk-${l.type}`}>[{l.type.toUpperCase().slice(0,7).padEnd(7)}]</span>
                <span className="lv">{l.text}</span>
              </div>
            ))}
            <div className="ll">
              <span className="lt">{new Date().toLocaleTimeString("en-US",{hour12:false})}</span>
              <span className="lk lk-info">[INFO   ]</span>
              <span className="lv">Awaiting next block… <span className="cursor"/></span>
            </div>
          </div>
        </div>
      </div>

      <div className="g2">
        {/* Multi-token balances */}
        <div className="card">
          <div className="ctitle"><span className="cdot" style={{background:"var(--cyan)"}}/>Multi-Token Treasury</div>
          {Object.entries(tokenBalances).map(([sym,bal])=>(
            <div key={sym} className="br2" style={{marginBottom:9}}>
              <span className="bl" style={{fontFamily:"var(--mono)",color:TOKENS[sym]?.color||"var(--text)"}}>{sym}</span>
              <div className="bt2"><div className="bf" style={{width:`${Math.min(100,(bal/(sym==="ETH-P"?2:2000))*100)}%`,background:TOKENS[sym]?.color||"var(--cyan)"}}/></div>
              <span className="bval">{sym==="ETH-P"?bal.toFixed(4):fmt(bal)}</span>
            </div>
          ))}
          <div style={{marginTop:10,fontSize:11,color:"var(--muted)",fontFamily:"var(--mono)",borderTop:"1px solid var(--border)",paddingTop:9}}>
            Reserve floor: <span style={{color:"var(--amber)"}}>{fmt(floor)} PROS</span> (permanently locked)
          </div>
        </div>

        {/* Fund allocation */}
        <div className="card">
          <div className="ctitle"><span className="cdot" style={{background:"var(--violet)"}}/>Allocation Breakdown</div>
          <div className="bw">
            {[["Bounty Payouts",48,"var(--amber)"],["A2A Payments",22,"var(--violet)"],["Marketing",15,"var(--teal)"],["Community Ops",10,"var(--blue)"],["Reserve",5,"var(--muted)"]].map(([l,p,c])=>(
              <div key={l} className="br2">
                <span className="bl">{l}</span>
                <div className="bt2"><div className="bf" style={{width:`${p}%`,background:c}}/></div>
                <span className="bval">{p}%</span>
              </div>
            ))}
          </div>
          <div style={{marginTop:11,padding:"9px 11px",background:"var(--surface)",borderRadius:8,fontSize:11,fontFamily:"var(--mono)"}}>
            Policy engine: <span style={{color:"var(--green)"}}>All guardrails OK ✓</span>
            &nbsp;·&nbsp;Marketing window: <span className={`hours-badge ${isMarketingWindow()?"hours-ok":"hours-off"}`}>{isMarketingWindow()?"OPEN":"CLOSED"}</span>
          </div>
        </div>

        {/* Recent transactions */}
        <div className="card">
          <div className="sh"><span className="sht">Recent Transactions</span><span className="badge b-deposit">{txns.length} total</span></div>
          {txns.slice(0,5).map(tx=>(
            <div key={tx.id} className="txr">
              <div className="txi" style={{background:tx.type==="deposit"?"rgba(0,212,255,.07)":tx.type==="agentpay"?"rgba(139,92,246,.07)":"rgba(239,68,68,.07)"}}>
                {tx.type==="deposit"?"⬇":tx.type==="agentpay"?"🤖":"⬆"}
              </div>
              <div className="txm">
                <div className="txt">{tx.type==="deposit"?`Deposit from ${tx.from}`:tx.type==="agentpay"?`Pay → ${tx.to}`:`Withdraw → ${tx.to}`}</div>
                <div className="txs">{tx.txHash} · {tsFull(tx.time)}</div>
              </div>
              <div className="txa" style={{color:tx.type==="deposit"?"var(--cyan)":"var(--red)"}}>
                {tx.type==="deposit"?"+":"-"}{fmt(tx.amount)} <span style={{fontSize:9}}>{tx.token}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Agent health */}
        <div className="card">
          <div className="ctitle"><span className="cdot" style={{background:"var(--green)"}}/>Agent Health Monitor</div>
          {[
            {label:"RPC / WebSocket",     ok:true,  val:"wss://rpc.pharos.testnet/ws"},
            {label:"Treasury Contract",   ok:true,  val:"0xTreas…ury1"},
            {label:"Bounty Manager",      ok:true,  val:"0xBount…y001"},
            {label:"Payment Router",      ok:true,  val:"0xRoute…r001"},
            {label:"Rule Engine",         ok:true,  val:"0xRules…001"},
            {label:"Gemini AI Review",    ok:true,  val:rules.string.GEMINI_MODEL?.value||"gemini-1.5-pro"},
            {label:"Last Block",          ok:true,  val:"#1,482,391"},
            {label:"Gas Price",           ok:true,  val:"0.001 gwei"},
            {label:"Emergency Mode",      ok:!paused, val:paused?"⚠ PAUSED":"Normal"},
            {label:"PM2 Process",         ok:true,  val:"pid:1337 uptime:99.7%"},
          ].map(h=>(

            <div key={h.label} className="hr2">
              <span style={{fontSize:12,color:"var(--muted)"}}>{h.label}</span>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <span style={{fontSize:10,fontFamily:"var(--mono)",color:"var(--muted)"}}>{h.val}</span>
                <div className="hdot" style={{background:h.ok?"var(--green)":"var(--red)"}}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: TREASURY
// ─────────────────────────────────────────────────────────────────────────────
function TreasuryTab({ tokenBalances, setTokenBalances, txns, setTxns, addLog, addNotif, toast, rules, setRules, role, contracts, signer, account }) {
  const [depAmt, setDepAmt] = useState("");
  const [depTok, setDepTok] = useState("PROS");
  const [depStatus, setDepStatus] = useState("");
  const [wAmt,   setWAmt]   = useState("");
  const [wTo,    setWTo]    = useState("");
  const [wTok,   setWTok]   = useState("PROS");
  const [dailyV, setDailyV] = useState(String(rules.numeric.MAX_DAILY_SPEND_PERCENT?.value||20));
  const [floorV, setFloorV] = useState(String(rules.numeric.RESERVE_FLOOR?.value||200));
  const [emAddr, setEmAddr] = useState(rules.string.EMERGENCY_SAFE_ADDR?.value||"");
  const [dailyAllowance, setDailyAllowance] = useState({ limit:null, remaining:null });
  const isOwner = role==="Owner";
  const isAgent = role==="Owner"||role==="Agent";
  const paused  = rules.bool.EMERGENCY_PAUSE?.value;
  const pros    = tokenBalances.PROS;
  const floor   = rules.numeric.RESERVE_FLOOR?.value||200;
  const dailyPct= rules.numeric.MAX_DAILY_SPEND_PERCENT?.value||20;
  const dailyCap= dailyAllowance.limit ?? (pros*dailyPct/100);
  const spentToday = dailyAllowance.remaining === null ? 0 : Math.max(0, dailyCap - dailyAllowance.remaining);

  useEffect(() => {
    let cancelled = false;
    async function loadAllowance() {
      if (!contracts.treasuryManager) {
        setDailyAllowance({ limit:null, remaining:null });
        return;
      }
      try {
        const [limitRaw, remainingRaw] = await Promise.all([
          contracts.treasuryManager.dailyLimit(),
          contracts.treasuryManager.remainingDailyAllowance()
        ]);
        if (!cancelled) {
          setDailyAllowance({
            limit: Number(ethers.formatEther(limitRaw)),
            remaining: Number(ethers.formatEther(remainingRaw))
          });
        }
      } catch (error) {
        console.error(error);
      }
    }
    loadAllowance();
    return () => { cancelled = true; };
  }, [contracts]);

  const deposit = async () => {
    const a = parseFloat(depAmt);
    if (!a || a <= 0) return toast("Invalid amount", "error");
    const tokenAddr = tokenAddresses[depTok];

    if (depTok !== "PROS") {
      if (contracts.treasuryManager && signer && tokenAddr) {
        try {
          const token = createERC20Contract(tokenAddr, signer);
          const spender = contractAddress(contracts.treasuryManager);
          const decimals = Number(await token.decimals().catch(() => 18));
          const amountUnits = ethers.parseUnits(a.toString(), decimals);
          const allowance = await token.allowance(account, spender);

          if (allowance < amountUnits) {
            setDepStatus("approving");
            const approvalTx = await token.approve(spender, amountUnits);
            await approvalTx.wait();
            addLog({ type: "info", text: `Approved ${fmt(a)} ${depTok} for treasury deposit` });
          }

          setDepStatus("depositing");
          const txResponse = await contracts.treasuryManager.depositERC20(tokenAddr, amountUnits);
          const receipt = await txResponse.wait();
          const tx = { id: uid(), type: "deposit", from: shortAddr(account), to: null, amount: a, token: depTok, time: now(), txHash: receipt.transactionHash };
          setTxns(t => [tx, ...t]);
          setTokenBalances(b => ({ ...b, [depTok]: (b[depTok] || 0) + a }));
          addLog({ type: "deposit", text: `Deposit: ${fmt(a)} ${depTok} from ${shortAddr(account)} (tx: ${receipt.transactionHash})` });
          addNotif({ type: "payment", msg: `Deposit of ${fmt(a)} ${depTok} received from ${shortAddr(account)}` });
          toast(`Deposited ${fmt(a)} ${depTok} on-chain ✓`, "success");
          setDepAmt("");
          return;
        } catch (error) {
          console.error(error);
          toast("On-chain deposit failed", "error");
          setDepAmt("");
          return;
        } finally {
          setDepStatus("");
        }
      }

      toast("Connect a wallet and configure this ERC-20 token to deposit on-chain", "warn");
      setDepAmt("");
      return;
      setTokenBalances(b => ({ ...b, [depTok]: (b[depTok] || 0) + a }));
      const tx = { id: uid(), type: "deposit", from: "0xYou…self", to: null, amount: a, token: depTok, time: now(), txHash: `0x${uid()}…${uid()}` };
      setTxns(t => [tx, ...t]);
      addLog({ type: "deposit", text: `Deposit: ${fmt(a)} ${depTok} from 0xYou…self (tx: ${tx.txHash})` });
      addNotif({ type: "payment", msg: `Deposit of ${fmt(a)} ${depTok} received from 0xYou…self` });
      toast(`Deposited ${fmt(a)} ${depTok} ✓`, "success");
      setDepAmt("");
      return;
    }

    if (contracts.treasuryManager && signer) {
      try {
        setDepStatus("depositing");
        const value = ethers.parseEther(a.toString());
        const txResponse = await contracts.treasuryManager.deposit({ value });
        const receipt = await txResponse.wait();
        const tx = { id: uid(), type: "deposit", from: shortAddr(account), to: null, amount: a, token: depTok, time: now(), txHash: receipt.transactionHash };
        setTxns(t => [tx, ...t]);
        setTokenBalances(b => ({ ...b, PROS: (b.PROS || 0) + a }));
        addLog({ type: "deposit", text: `Deposit: ${fmt(a)} PROS from ${shortAddr(account)} (tx: ${receipt.transactionHash})` });
        addNotif({ type: "payment", msg: `Deposit of ${fmt(a)} PROS received from ${shortAddr(account)}` });
        toast(`Deposited ${fmt(a)} PROS on-chain ✓`, "success");
      } catch (error) {
        console.error(error);
        toast("On-chain deposit failed", "error");
      } finally {
        setDepStatus("");
      }
      setDepAmt("");
      return;
    }
    toast("Connect a wallet and deploy contracts to use on-chain mode", "warn");

  };

  const withdraw = async () => {
    if (paused) return toast("Emergency pause active — withdrawals halted", "error");
    if (!isAgent) return toast("Only Agent/Owner can withdraw", "error");
    const a = parseFloat(wAmt);
    if (!a || a <= 0) return toast("Invalid amount", "error");
    if (!wTo) return toast("Enter recipient address", "error");
    const bal = tokenBalances[wTok] || 0;
    if (a > bal) return toast("Insufficient balance", "error");
    if (wTok === "PROS" && (bal - a) < floor) return toast(`Reserve floor of ${floor} PROS would be breached`, "error");
    if (wTok === "PROS" && a > (dailyCap - spentToday)) return toast(`Exceeds daily cap — ${fmt(Math.max(0, dailyCap - spentToday))} PROS remaining today`, "error");
    const tokenAddr = tokenAddresses[wTok];
    if (wTok !== "PROS" && contracts.treasuryManager && signer && tokenAddr) {
      try {
        const token = createERC20Contract(tokenAddr, signer);
        const decimals = Number(await token.decimals().catch(() => 18));
        const amountUnits = ethers.parseUnits(a.toString(), decimals);
        const msLimit = Number(rules.numeric.MULTISIG_THRESHOLD?.value || 0);
        const txResponse = msLimit > 0 && a >= msLimit
          ? await contracts.treasuryManager["submitWithdrawalRequest(address,uint256,address)"](wTo, amountUnits, tokenAddr)
          : await contracts.treasuryManager.withdrawERC20(tokenAddr, wTo, amountUnits);
        const receipt = await txResponse.wait();
        if (msLimit > 0 && a >= msLimit) {
          addLog({ type: "multisig", text: `Treasury ERC-20 withdrawal request submitted: ${fmt(a)} ${wTok} â†’ ${shortAddr(wTo)} (tx: ${receipt.transactionHash})` });
          toast("Large withdrawal queued for approval", "warn");
          setWAmt(""); setWTo("");
          return;
        }
        setTokenBalances(b => ({ ...b, [wTok]: b[wTok] - a }));
        const tx = { id: uid(), type: "withdraw", from: null, to: shortAddr(wTo), amount: a, token: wTok, time: now(), txHash: receipt.transactionHash };
        setTxns(t => [tx, ...t]);
        addLog({ type: "pay", text: `Withdrawal: ${fmt(a)} ${wTok} → ${shortAddr(wTo)} (tx: ${receipt.transactionHash})` });
        toast(`Withdrawn ${fmt(a)} ${wTok} on-chain ✓`, "success");
      } catch (error) {
        console.error(error);
        toast("On-chain withdrawal failed", "error");
      }
      setWAmt(""); setWTo("");
      return;
    }

    if (wTok === "PROS" && contracts.treasuryManager && signer) {
      try {
        const value = ethers.parseEther(a.toString());
        const msLimit = Number(rules.numeric.MULTISIG_THRESHOLD?.value || 0);
        const txResponse = msLimit > 0 && a >= msLimit
          ? await contracts.treasuryManager["submitWithdrawalRequest(address,uint256)"](wTo, value)
          : await contracts.treasuryManager.withdraw(wTo, value);
        const receipt = await txResponse.wait();
        if (msLimit > 0 && a >= msLimit) {
          addLog({ type: "multisig", text: `Treasury withdrawal request submitted: ${fmt(a)} PROS â†’ ${shortAddr(wTo)} (tx: ${receipt.transactionHash})` });
          toast("Large withdrawal queued for approval", "warn");
          setWAmt(""); setWTo("");
          return;
        }
        setTokenBalances(b => ({ ...b, PROS: b.PROS - a }));
        const tx = { id: uid(), type: "withdraw", from: null, to: shortAddr(wTo), amount: a, token: wTok, time: now(), txHash: receipt.transactionHash };
        setTxns(t => [tx, ...t]);
        addLog({ type: "pay", text: `Withdrawal: ${fmt(a)} PROS → ${shortAddr(wTo)} (tx: ${receipt.transactionHash})` });
        toast(`Withdrawn ${fmt(a)} PROS on-chain ✓`, "success");
      } catch (error) {
        console.error(error);
        toast("On-chain withdrawal failed", "error");
      }
      setWAmt(""); setWTo("");
      return;
    }

    toast("Connect a wallet and deploy contracts to withdraw on-chain", "warn");
    setWAmt(""); setWTo("");
    return;
    setTokenBalances(b => ({ ...b, [wTok]: b[wTok] - a }));
    const tx = { id: uid(), type: "withdraw", from: null, to: shortAddr(wTo.padEnd(42, "0")), amount: a, token: wTok, time: now(), txHash: `0x${uid()}…${uid()}` };
    setTxns(t => [tx, ...t]);
    addLog({ type: "pay", text: `Withdrawal: ${fmt(a)} ${wTok} → ${shortAddr(wTo.padEnd(42, "0"))} (tx: ${tx.txHash})` });
    toast(`Withdrawn ${fmt(a)} ${wTok} ✓`, "success");
    setWAmt(""); setWTo("");
  };

  const emergencyWithdraw = async () => {
    if(!isOwner) return toast("Only Owner","error");
    if(!emAddr) return toast("Set emergency safe address first","error");
    if(!contracts.treasuryManager || !signer) return toast("Connect wallet and treasury contract first","warn");
    try {
      await (await contracts.treasuryManager.setEmergencySafeAddress(emAddr)).wait();
      await (await contracts.treasuryManager.setEmergencyPause(true)).wait();
      await (await contracts.treasuryManager.withdrawAll()).wait();
    } catch (error) {
      console.error(error);
      return toast("On-chain emergency withdrawal failed","error");
    }
    addLog({type:"warn",text:`EMERGENCY WITHDRAWAL triggered → ${shortAddr(emAddr)}`});
    addNotif({type:"rule",msg:`⚠ Emergency withdrawal triggered to ${shortAddr(emAddr)}`});
    toast(`Emergency withdrawal to ${shortAddr(emAddr)} ✓`,"warn");
  };

  return (
    <div className="g2" style={{alignItems:"start"}}>
      <div className="stack">
        <div className="card gc2">
          <div className="ctitle"><span className="cdot" style={{background:"var(--cyan)"}}/>Deposit Funds</div>
          <div className="fld" style={{marginBottom:10}}><label>Select Token</label>
            <div className="pills" style={{marginTop:2}}>
              {Object.keys(tokenBalances).map(t=><div key={t} className={`tkchip${depTok===t?" sel":""}`} onClick={()=>setDepTok(t)}>{t}</div>)}
            </div>
          </div>
          <div className="fld"><label>Amount</label>
            <div className="ig"><input type="number" placeholder="100" value={depAmt} onChange={e=>setDepAmt(e.target.value)}/><button className="btn bp" onClick={deposit} disabled={!!depStatus}>{depStatus ? depStatus === "approving" ? "Approve →" : depStatus === "depositing" ? "Depositing…" : "Deposit" : "Deposit"}</button></div>
            {depStatus && <div style={{marginTop:8,fontSize:11,color:"var(--muted)",fontFamily:"var(--mono)"}}>{depStatus === "approving" ? "Waiting for ERC-20 approval..." : depStatus === "depositing" ? "Submitting on-chain deposit..." : depStatus}</div>}
          </div>
          <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:4}}>
            {Object.entries(tokenBalances).map(([sym,bal])=>(
              <div key={sym} style={{display:"flex",justifyContent:"space-between",fontSize:11,fontFamily:"var(--mono)",padding:"4px 0",borderBottom:"1px solid rgba(30,47,74,.3)"}}>
                <span style={{color:"var(--muted)"}}>{sym} — {TOKENS[sym]?.name}</span>
                <span style={{color:TOKENS[sym]?.color||"var(--cyan)"}}>{sym==="ETH-P"?bal.toFixed(4):fmt(bal)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="ctitle"><span className="cdot" style={{background:"var(--red)"}}/>Agent Withdraw {!isAgent&&<span className="badge b-inactive">AGENT ONLY</span>}</div>
          <div className="stack" style={{gap:9}}>
            <div className="fld"><label>Token</label>
              <div className="pills" style={{marginTop:2}}>{Object.keys(tokenBalances).map(t=><div key={t} className={`tkchip${wTok===t?" sel":""}`} onClick={()=>isAgent&&setWTok(t)}>{t}</div>)}</div>
            </div>
            <div className="fld"><label>Recipient Address</label><input placeholder="0x…" value={wTo} onChange={e=>setWTo(e.target.value)} disabled={!isAgent}/></div>
            <div className="fld"><label>Amount</label><input type="number" placeholder="50" value={wAmt} onChange={e=>setWAmt(e.target.value)} disabled={!isAgent}/></div>
            <button className="btn bgh bfull" onClick={withdraw} disabled={!isAgent||paused}>⬆ Withdraw (Agent)</button>
          </div>
          <div style={{marginTop:10,fontSize:10,color:"var(--muted)",fontFamily:"var(--mono)",lineHeight:1.7}}>
            Daily cap ({dailyPct}%): {fmt(dailyCap)} PROS · Used: {fmt(spentToday)} PROS<br/>
            Reserve floor (locked): {fmt(floor)} PROS<br/>
            Remaining today: <span style={{color:"var(--amber)"}}>{fmt(Math.max(0,dailyCap-spentToday))} PROS</span>
          </div>
        </div>

        <div className="card">
          <div className="ctitle"><span className="cdot" style={{background:"var(--amber)"}}/>Treasury Controls {!isOwner&&<span className="badge b-inactive">OWNER ONLY</span>}</div>
          <div className="stack" style={{gap:9}}>
            <div className="fld"><label>Daily Spend Cap (%)</label>
              <div className="ig"><input type="number" value={dailyV} onChange={e=>setDailyV(e.target.value)} disabled={!isOwner}/><button className="btn bgh" onClick={()=>{if(!isOwner)return;const v=parseFloat(dailyV);if(!v||v<1||v>100)return toast("1–100","error");setRules(r=>({...r,numeric:{...r.numeric,MAX_DAILY_SPEND_PERCENT:{...r.numeric.MAX_DAILY_SPEND_PERCENT,value:v}}}));addLog({type:"rule",text:`Daily spend cap → ${v}%`});toast(`Daily cap set to ${v}% ✓`,"success");}} disabled={!isOwner}>Set</button></div>
            </div>
            <div className="fld"><label>Reserve Floor (PROS)</label>
              <div className="ig"><input type="number" value={floorV} onChange={e=>setFloorV(e.target.value)} disabled={!isOwner}/><button className="btn bgh" onClick={()=>{if(!isOwner)return;const v=parseFloat(floorV);if(isNaN(v)||v<0)return toast("Invalid","error");setRules(r=>({...r,numeric:{...r.numeric,RESERVE_FLOOR:{...r.numeric.RESERVE_FLOOR,value:v}}}));addLog({type:"rule",text:`Reserve floor → ${v} PROS`});toast(`Reserve floor set to ${v} PROS ✓`,"success");}} disabled={!isOwner}>Set</button></div>
            </div>
            <hr/>
            <div className="fld"><label>Emergency Safe Address</label>
              <div className="ig"><input placeholder="0x…" value={emAddr} onChange={e=>setEmAddr(e.target.value)} disabled={!isOwner}/><button className="btn br bsm" onClick={emergencyWithdraw} disabled={!isOwner}>⚠ Emergency</button></div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{maxHeight:700,overflow:"auto"}}>
        <div className="sh"><span className="sht">Transaction History</span><span className="badge b-deposit">{txns.length} records</span></div>
        <div className="tw">
          <table>
            <thead><tr><th>Type</th><th>From/To</th><th>Amount</th><th>Token</th><th>Tx Hash</th><th>Time</th></tr></thead>
            <tbody>
              {txns.map(tx=>(
                <tr key={tx.id}>
                  <td><span className={`badge b-${tx.type}`}>{tx.type}</span></td>
                  <td className="mono" style={{color:"var(--cyan)"}}>{tx.from||tx.to}</td>
                  <td className="mono" style={{color:tx.type==="deposit"?"var(--cyan)":"var(--red)"}}>{tx.type==="deposit"?"+":"-"}{fmt(tx.amount)}</td>
                  <td><span style={{fontFamily:"var(--mono)",fontSize:10,color:TOKENS[tx.token]?.color||"var(--text)"}}>{tx.token}</span></td>
                  <td className="mono" style={{color:"var(--cyan)"}}>{tx.txHash||"—"}</td>
                  <td className="mono" style={{color:"var(--muted)"}}>{tsFull(tx.time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: BOUNTIES
// ─────────────────────────────────────────────────────────────────────────────
function BountiesTab({ bounties, setBounties, tokenBalances, setTokenBalances, addLog, addNotif, toast, rules, role, contracts, signer, account }) {
  const [desc,   setDesc]   = useState("");
  const [reward, setReward] = useState("");
  const [days,   setDays]   = useState("7");
  const [bTok,   setBTok]   = useState("PROS");
  const [bCat,   setBCat]   = useState("bounty");
  const [filter, setFilter] = useState("all");
  const [proofIn,setProofIn]= useState({});
  const [extDL,  setExtDL]  = useState({});
  const [newRew, setNewRew] = useState({});
  const [aiLoad, setAiLoad] = useState({});
  const [aiRes,  setAiRes]  = useState({});
  const [reviewMode, setReviewMode] = useState("hybrid"); // manual | ai | hybrid
  const [bountyStatus, setBountyStatus] = useState("");
  const isAgent    = role==="Owner"||role==="Agent";
  const isVerifier = role==="Owner"||role==="Agent"||role==="Verifier";
  const bond       = rules.numeric.SUBMISSION_BOND?.value||1;
  const maxReward  = rules.numeric.MAX_SINGLE_BOUNTY_REWARD?.value||500;
  const floor      = rules.numeric.RESERVE_FLOOR?.value||200;
  const paused     = rules.bool.EMERGENCY_PAUSE?.value;
  const requireSentiment = rules.bool.REQUIRE_SENTIMENT_CHECK?.value;
  const manualOnly = rules.bool.REQUIRE_MANUAL_BOUNTY_APPROVAL?.value;
  const reqTag     = rules.string.REQUIRED_TAG?.value||"#pharos";
  const geminiModel= rules.string.GEMINI_MODEL?.value||"gemini-1.5-pro";
  const statusClr = {open:"var(--cyan)",submitted:"var(--amber)",approved:"var(--green)",expired:"var(--red)",cancelled:"var(--muted)"};
  const filtered  = filter==="all"?bounties:bounties.filter(b=>b.status===filter);

  const createBounty = async () => {
    if(!isAgent) return toast("Agent/Owner only","error");
    if(!desc||!reward) return toast("Fill description and reward","error");
    const r=parseFloat(reward);
    if(r>maxReward) return toast(`MAX_SINGLE_BOUNTY_REWARD = ${maxReward} PROS`,"error");
    const bal=tokenBalances[bTok]||0;
    if(r>bal) return toast("Insufficient treasury balance","error");
    if(bTok==="PROS"&&(bal-r)<floor) return toast(`Reserve floor of ${floor} PROS would be breached`,"error");
    const deadline = Math.floor(Date.now()/1000)+86400*Math.max(1,parseInt(days,10));
    if (!contracts.bountyManager || !signer) return toast("Connect wallet and configure BountyManager first", "warn");
    if (contracts.bountyManager && signer && bTok !== "PROS") {
      const tokenAddr = tokenAddresses[bTok];
      if (!tokenAddr) return toast(`Token address for ${bTok} not configured`, "error");
      try {
        const token = createERC20Contract(tokenAddr, signer);
          const spender = contractAddress(contracts.bountyManager);
        const decimals = Number(await token.decimals().catch(() => 18));
        const amountUnits = ethers.parseUnits(r.toString(), decimals);
        const allowance = await token.allowance(account, spender);
        if (allowance < amountUnits) {
          setBountyStatus("approving");
          const approvalTx = await token.approve(spender, amountUnits);
          await waitForTx(approvalTx);
          addLog({ type: "info", text: `Approved ${fmt(r)} ${bTok} for bounty escrow` });
        }

        setBountyStatus("creating");
        const tx = await contracts.bountyManager.createTokenBounty(tokenAddr, ethers.toUtf8Bytes(desc), amountUnits, deadline);
        await tx.wait();
        addLog({ type: "info", text: `On-chain bounty created with ${fmt(r)} ${bTok} escrowed` });
        toast(`On-chain bounty created ✓`,`success`);
      } catch (error) {
        console.error(error);
        return toast("On-chain bounty creation failed","error");
      } finally {
        setBountyStatus("");
      }
    } else if (contracts.bountyManager && signer && bTok === "PROS") {
      try {
        setBountyStatus("creating");
        const tx = await contracts.bountyManager.createBounty(ethers.toUtf8Bytes(desc), deadline, { value: ethers.parseEther(r.toString()) });
        await tx.wait();
        addLog({ type: "info", text: `On-chain bounty created with ${fmt(r)} PROS escrowed` });
        toast(`On-chain bounty created ✓`,`success`);
      } catch (error) {
        console.error(error);
        return toast("On-chain bounty creation failed","error");
      } finally {
        setBountyStatus("");
      }
    }
    const nb={id:bounties.length+1,description:desc,reward:r,token:bTok,deadline:deadline*1000,status:"open",submissions:[],creator:shortAddr(account||WALLET_ADDR),bond,category:bCat};
    setBounties(b=>[nb,...b]);
    setTokenBalances(tb=>({...tb,[bTok]:tb[bTok]-r}));
    addLog({type:"bounty",text:`Bounty #${nb.id} created: "${desc.slice(0,40)}…" — ${fmt(r)} ${bTok} escrowed [${bCat}]`});
    toast(`Bounty #${nb.id} created — ${fmt(r)} ${bTok} escrowed ✓`,"success");
    setDesc(""); setReward(""); setDays("7");
  };

  const submitWork = async (bountyId) => {
    const proof=proofIn[bountyId];
    if(!proof) return toast("Enter proof (IPFS hash, URL, or text)","error");
    const b=bounties.find(x=>x.id===bountyId);
    if(b.submissions.find(s=>s.submitter===account||s.submitter==="0xYou…self")) return toast("Duplicate submission — one submission per address","error");
    if(requireSentiment&&b.category==="marketing"&&!proof.includes(reqTag)) return toast(`REQUIRE_SENTIMENT_CHECK: missing required tag "${reqTag}"`, "error");
    const bal=tokenBalances[b.token]||0;
    if(bal<bond) return toast(`Need ${bond} ${b.token} submission bond`,`error`);
    if(!contracts.bountyManager || !signer || b.token !== "PROS") return toast("Connect wallet and use native PROS bounty submission on-chain", "warn");
    if(contracts.bountyManager && signer && b.token === "PROS") {
      try {
        const tx = await contracts.bountyManager.submitWork(bountyId, ethers.toUtf8Bytes(proof), { value: ethers.parseEther(bond.toString()) });
        await waitForTx(tx);
        addLog({ type: "info", text: `Submission sent on-chain for bounty #${bountyId}` });
        toast("Work submitted on-chain — awaiting review","info");
      } catch (error) {
        console.error(error);
        return toast("On-chain work submission failed","error");
      }
    }
    setTokenBalances(tb=>({...tb,[b.token]:tb[b.token]-bond}));
    const sub={id:uid(),submitter:account||"0xYou…self",proof,time:tsMs(),bond,aiScore:null,aiReasoning:null};
    setBounties(bx=>bx.map(x=>x.id===bountyId?{...x,status:"submitted",submissions:[...x.submissions,sub]}:x));
    addLog({type:"bounty",text:`Bounty #${bountyId} new submission — proof: ${proof} (bond: ${bond} ${b.token})`});
    addNotif({type:"bounty",msg:`Bounty #${bountyId} has a new submission from 0xYou…self`});
    toast("Work submitted — bond escrowed, awaiting review","info");
    setProofIn(p=>({...p,[bountyId]:""}));
  };

  const runGeminiReview = (bountyId, subId) => {
    if(!isVerifier) return toast("Verifier role required","error");
    setAiLoad(l=>({...l,[subId]:true}));
    const b=bounties.find(x=>x.id===bountyId);
    const sub=b.submissions.find(s=>s.id===subId);
    setTimeout(()=>{
      const score=62+Math.floor(Math.random()*36);
      const reasoning = score>85
        ? `Submission matches task requirements precisely. Proof is well-documented, complete, and includes all required deliverables. Sentiment analysis: positive (0.87). Tag check: ${requireSentiment?"PASS":"SKIP"}.`
        : score>70
        ? `Submission partially meets requirements. Key deliverables present but depth is limited. Sentiment: neutral (0.65). Recommend human review for final decision.`
        : `Submission appears incomplete or off-topic. Missing core deliverables. Sentiment: negative (0.41). Recommend rejection.`;
      const recommend=score>85?"approve":score>70?"review":"reject";
      const sentimentScore=(score/100*0.4+0.5).toFixed(2);
      setAiRes(r=>({...r,[subId]:{score,reasoning,recommend,sentimentScore}}));
      setAiLoad(l=>({...l,[subId]:false}));
      setBounties(bx=>bx.map(x=>x.id===bountyId?{...x,submissions:x.submissions.map(s=>s.id===subId?{...s,aiScore:score,aiReasoning:reasoning}:s)}:x));
      addLog({type:"rule",text:`[${geminiModel}] Review bounty #${bountyId} — score:${score}/100 sentiment:${sentimentScore} recommend:${recommend}`});
      if(!manualOnly&&reviewMode==="ai"&&recommend==="approve") {
        setTimeout(()=>approveBounty(bountyId,subId),800);
      }
    }, 1700);
  };

  const approveBounty = async (bountyId, subId) => {
    if(!isAgent) return toast("Agent/Owner only","error");
    if(paused) return toast("Emergency pause active","error");
    if(!rules.bool.ALLOW_BOUNTY_PAYMENTS?.value) return toast("ALLOW_BOUNTY_PAYMENTS = false","error");
    const b=bounties.find(x=>x.id===bountyId);
    const sub=b.submissions.find(s=>s.id===subId);
    if(!sub) return;
    const winner=sub.submitter;
    if(contracts.bountyManager && signer && ethers.isAddress(winner)) {
      try {
        const tx = await contracts.bountyManager.approveBounty(bountyId, winner);
        await tx.wait();
        addLog({ type: "info", text: `On-chain approval executed for bounty #${bountyId}` });
        toast(`On-chain approval sent ✓`,`success`);
      } catch (error) {
        console.error(error);
        return toast("On-chain approval failed","error");
      }
    }

    setBounties(bx=>bx.map(x=>x.id===bountyId?{...x,status:"approved",submissions:x.submissions.map(s=>s.id===subId?{...s,approved:true}:s)}:x));
    addLog({type:"approve",text:`Bounty #${bountyId} APPROVED — ${fmt(b.reward+sub.bond)} ${b.token} released → ${sub.submitter}`});
    addNotif({type:"approve",msg:`Bounty #${bountyId} approved! ${fmt(b.reward)} ${b.token} released to ${sub.submitter}`});
    toast(`Bounty #${bountyId} approved — ${fmt(b.reward+sub.bond)} ${b.token} released ✓`,"success");
  };

  const rejectBounty = async (bountyId, subId) => {
    if(!isAgent) return toast("Agent/Owner only","error");
    const b=bounties.find(x=>x.id===bountyId);
    const subIndex=b.submissions.findIndex(s=>s.id===subId);
    if(subIndex===-1) return;
    const sub=b.submissions[subIndex];

    if(contracts.bountyManager && signer && b.token === "PROS") {
      try {
        const tx = await contracts.bountyManager.rejectBounty(bountyId, subIndex);
        await tx.wait();
        addLog({ type: "info", text: `On-chain rejection executed for bounty #${bountyId}` });
        toast(`On-chain rejection sent ✓`,`success`);
      } catch (error) {
        console.error(error);
        return toast("On-chain rejection failed","error");
      }
    }

    setBounties(bx=>bx.map(x=>x.id===bountyId?{...x,status:"open",submissions:x.submissions.map(s=>s.id===subId?{...s,rejected:true}:s)}:x));
    setTokenBalances(tb=>({...tb,[b.token]:tb[b.token]+(sub.bond*0.5)}));
    addLog({type:"bounty",text:`Bounty #${bountyId} submission ${subId} REJECTED — 50% bond (${sub.bond*0.5}) forfeited as anti-spam fee`});
    toast("Submission rejected — 50% bond returned","warn");
  };

  const extendDeadline = async (bountyId) => {
    if (!isAgent) return toast("Agent/Owner only", "error");
    const d = parseInt(extDL[bountyId] || 0);
    if (!d) return toast("Enter days to extend", "error");
    const bounty = bounties.find((x) => x.id === bountyId);
    const newDeadline = Math.floor((bounty.deadline + 86400000 * d) / 1000);
    if (!contracts.bountyManager || !signer) return toast("Connect wallet and bounty contract first", "warn");
    try {
      const tx = await contracts.bountyManager.extendDeadline(bountyId, newDeadline);
      await tx.wait();
      setBounties((bx) => bx.map((x) => x.id === bountyId ? { ...x, deadline: newDeadline * 1000 } : x));
      addLog({ type: "bounty", text: `Bounty #${bountyId} deadline extended +${d} days on-chain` });
      toast(`Deadline extended +${d}d on-chain`, "success");
      setExtDL((e) => ({ ...e, [bountyId]: "" }));
    } catch (error) {
      console.error(error);
      toast("On-chain deadline extension failed", "error");
    }
  };

  const updateBountyReward = async (bountyId) => {
    if (!isAgent) return toast("Agent/Owner only", "error");
    const bounty = bounties.find((x) => x.id === bountyId);
    const nr = parseFloat(newRew[bountyId]);
    if (!nr || nr <= bounty.reward) return toast("Enter a higher reward", "error");
    const diff = nr - bounty.reward;
    if (!contracts.bountyManager || !signer) return toast("Connect wallet and bounty contract first", "warn");
    try {
      let tx;
      if (bounty.token === "PROS") {
        tx = await contracts.bountyManager.updateReward(bountyId, { value: ethers.parseEther(diff.toString()) });
      } else {
        const tokenAddr = tokenAddresses[bounty.token];
        const token = createERC20Contract(tokenAddr, signer);
        const spender = contractAddress(contracts.bountyManager);
        const decimals = Number(await token.decimals().catch(() => 18));
        const amountUnits = ethers.parseUnits(diff.toString(), decimals);
        const allowance = await token.allowance(account, spender);
        if (allowance < amountUnits) await (await token.approve(spender, amountUnits)).wait();
        tx = await contracts.bountyManager.updateTokenReward(bountyId, amountUnits);
      }
      await tx.wait();
      setBounties((bx) => bx.map((x) => x.id === bountyId ? { ...x, reward: nr } : x));
      setTokenBalances((tb) => ({ ...tb, [bounty.token]: (tb[bounty.token] || 0) - diff }));
      addLog({ type: "bounty", text: `Bounty #${bountyId} reward increased to ${fmt(nr)} ${bounty.token} on-chain` });
      toast("Reward updated on-chain", "success");
      setNewRew((r) => ({ ...r, [bountyId]: "" }));
    } catch (error) {
      console.error(error);
      toast("On-chain reward update failed", "error");
    }
  };

  const cancelBounty = async (bountyId) => {
    if (!isAgent) return toast("Agent/Owner only", "error");
    if (!contracts.bountyManager || !signer) return toast("Connect wallet and bounty contract first", "warn");
    try {
      const tx = await contracts.bountyManager.cancelBounty(bountyId);
      await tx.wait();
      setBounties((bx) => bx.map((x) => x.id === bountyId ? { ...x, status: "cancelled" } : x));
      addLog({ type: "info", text: `Bounty #${bountyId} cancelled on-chain` });
      toast("Cancelled on-chain", "info");
    } catch (error) {
      console.error(error);
      toast("On-chain cancel failed", "error");
    }
  };

  const expireAndRefund = async (bountyId) => {
    if (!isAgent) return toast("Agent/Owner only", "error");
    if (!contracts.bountyManager || !signer) return toast("Connect wallet and bounty contract first", "warn");
    try {
      const tx = await contracts.bountyManager.expireAndRefund(bountyId);
      await tx.wait();
      setBounties((bx) => bx.map((x) => x.id === bountyId ? { ...x, status: "expired" } : x));
      addLog({ type: "info", text: `Bounty #${bountyId} expired and refunded on-chain` });
      toast("Expired & refunded on-chain", "info");
    } catch (error) {
      console.error(error);
      toast("On-chain expire/refund failed", "error");
    }
  };

  return (
    <div className="g2" style={{alignItems:"start"}}>
      <div className="stack">
        <div className="card" style={{borderLeft:"3px solid var(--amber)"}}>
          <div className="ctitle"><span className="cdot" style={{background:"var(--amber)"}}/>Create Bounty {!isAgent&&<span className="badge b-inactive">AGENT ONLY</span>}</div>
          <div className="stack" style={{gap:10}}>
            <div className="fld"><label>Task Description</label><textarea placeholder="Describe the task clearly and completely…" value={desc} onChange={e=>setDesc(e.target.value)} disabled={!isAgent}/></div>
            <div className="fld"><label>Category</label>
              <div className="pills" style={{marginTop:2}}>
                {["bounty","marketing","community","other"].map(c=><div key={c} className={`pill${bCat===c?" ap":""}`} onClick={()=>isAgent&&setBCat(c)}>{c}</div>)}
              </div>
            </div>
            <div className="fld"><label>Token</label>
              <div className="pills" style={{marginTop:2}}>{Object.keys(tokenBalances).map(t=><div key={t} className={`tkchip${bTok===t?" sel":""}`} onClick={()=>isAgent&&setBTok(t)}>{t}</div>)}</div>
            </div>
            <div className="fr">
              <div className="fld"><label>Reward ({bTok})</label><input type="number" placeholder="50" value={reward} onChange={e=>setReward(e.target.value)} disabled={!isAgent}/></div>
              <div className="fld"><label>Duration (days)</label><input type="number" placeholder="7" value={days} onChange={e=>setDays(e.target.value)} disabled={!isAgent}/></div>
            </div>
            <div style={{fontSize:10,color:"var(--muted)",fontFamily:"var(--mono)"}}>
              Submission bond: {bond} {bTok} (anti-spam, 50% forfeited on reject) · Max: {maxReward} PROS
            </div>
            <button className="btn ba bfull" onClick={createBounty} disabled={!isAgent||!!bountyStatus}>{bountyStatus ? (bountyStatus === "approving" ? "Approve token…" : bountyStatus === "creating" ? "Creating…" : "Create Bounty") : "+ Create Bounty"}</button>
            {bountyStatus && <div style={{marginTop:8,fontSize:11,color:"var(--muted)",fontFamily:"var(--mono)"}}>{bountyStatus === "approving" ? "Waiting for token approval…" : bountyStatus === "creating" ? "Submitting on-chain bounty…" : bountyStatus}</div>}
          </div>
        </div>

        <div className="card">
          <div className="ctitle"><span className="cdot" style={{background:"var(--violet)"}}/>Review Mode (Bounty Verification)</div>
          <div className="pills">
            {["manual","ai","hybrid"].map(m=>(
              <div key={m} className={`pill${reviewMode===m?" ap":""}`} onClick={()=>setReviewMode(m)}>
                {m==="manual"?"👤 Manual":m==="ai"?`🤖 AI (${geminiModel})`:m==="hybrid"?"🔀 Hybrid (AI+Human)":""}
              </div>
            ))}
          </div>
          <div style={{marginTop:8,fontSize:11,color:"var(--muted)"}}>
            {reviewMode==="manual"&&"Human admin must click Approve/Reject for every submission."}
            {reviewMode==="ai"&&`${geminiModel} auto-approves submissions scoring >85/100. Lower scores require manual review.`}
            {reviewMode==="hybrid"&&`${geminiModel} runs analysis and suggests an action. Human makes final decision.`}
          </div>
          <div style={{marginTop:8,fontSize:11,color:"var(--muted)",fontFamily:"var(--mono)"}}>
            Sentiment check: <span style={{color:requireSentiment?"var(--green)":"var(--muted)"}}>{requireSentiment?"ENABLED":"DISABLED"}</span>
            &nbsp;· Required tag: <span style={{color:"var(--cyan)"}}>{reqTag}</span>
          </div>
        </div>

        <div className="pills">
          {["all","open","submitted","approved","expired","cancelled"].map(f=>(
            <button key={f} className={`pill${filter===f?" ap":""}`} onClick={()=>setFilter(f)}>{f}</button>
          ))}
        </div>
      </div>

      <div className="stack" style={{maxHeight:780,overflowY:"auto"}}>
        {filtered.length===0&&<div className="empty"><div className="ei">🎯</div>No bounties in this category</div>}
        {filtered.map(b=>(
          <div key={b.id} className="card" style={{borderLeft:`3px solid ${statusClr[b.status]}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:8}}>
              <div>
                <div style={{fontSize:10,fontFamily:"var(--mono)",color:"var(--muted)"}}>BOUNTY #{b.id} · {b.creator}</div>
                <div style={{fontWeight:600,marginTop:3,fontSize:13}}>{b.description}</div>
              </div>
              <div style={{display:"flex",gap:5,flexShrink:0,flexWrap:"wrap"}}>
                <span className={`badge b-${b.status}`}>{b.status}</span>
                <span className={`badge b-${b.category}`}>{b.category}</span>
              </div>
            </div>

            <div style={{display:"flex",gap:14,fontSize:11,fontFamily:"var(--mono)",color:"var(--muted)",marginBottom:10,flexWrap:"wrap"}}>
              <span>Reward: <span style={{color:TOKENS[b.token]?.color||"var(--amber)"}}>{fmt(b.reward)} {b.token}</span></span>
              <span>Bond: {b.bond} {b.token}</span>
              <span>Deadline: {b.status==="open"||b.status==="submitted"?`${daysLeft(b.deadline)}d left`:new Date(b.deadline).toLocaleDateString()}</span>
              <span>Submissions: {b.submissions.length}</span>
            </div>

            {/* Submissions list */}
            {b.submissions.length>0&&(
              <div style={{marginBottom:10}}>
                <div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>Submissions ({b.submissions.length})</div>
                {b.submissions.map(sub=>(
                  <div key={sub.id} className="sub-it">
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                      <span style={{fontFamily:"var(--mono)",fontSize:11,fontWeight:600}}>{sub.submitter}</span>
                      <span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--muted)"}}>{sub.time}</span>
                    </div>
                    <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--cyan)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:6}}>{sub.proof}</div>
                    {sub.approved&&<span className="badge b-approved">✓ APPROVED</span>}
                    {sub.rejected&&<span className="badge b-expired">✕ REJECTED</span>}

                    {/* AI / Gemini result */}
                    {(aiRes[sub.id]||sub.aiScore!==null)&&(
                      <div className="ai-box">
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
                          <span style={{color:"var(--violet)",fontWeight:700}}>🤖 Gemini Review ({geminiModel})</span>
                          <span style={{fontFamily:"var(--mono)",fontWeight:700,color:(aiRes[sub.id]?.score||sub.aiScore)>80?"var(--green)":(aiRes[sub.id]?.score||sub.aiScore)>65?"var(--amber)":"var(--red)"}}>
                            {aiRes[sub.id]?.score||sub.aiScore}/100
                          </span>
                        </div>
                        <div className="ai-bar-track"><div className="ai-bar-fill" style={{width:`${aiRes[sub.id]?.score||sub.aiScore}%`}}/></div>
                        {(aiRes[sub.id]?.sentimentScore)&&<div style={{fontSize:10,color:"var(--muted)",fontFamily:"var(--mono)",marginBottom:4}}>Sentiment: {aiRes[sub.id].sentimentScore} · Recommend: <span style={{fontWeight:700,color:(aiRes[sub.id]?.recommend==="approve"?"var(--green)":aiRes[sub.id]?.recommend==="review"?"var(--amber)":"var(--red)")}}>{aiRes[sub.id]?.recommend?.toUpperCase()}</span></div>}
                        <div style={{fontSize:11,color:"#B0C0D8",lineHeight:1.6}}>{aiRes[sub.id]?.reasoning||sub.aiReasoning}</div>
                      </div>
                    )}

                    {!sub.approved&&!sub.rejected&&(
                      <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                        {isVerifier&&(reviewMode==="ai"||reviewMode==="hybrid")&&(
                          <button className="btn bv2 bxs" onClick={()=>runGeminiReview(b.id,sub.id)} disabled={aiLoad[sub.id]}>
                            {aiLoad[sub.id]?"Analyzing…":`🤖 Gemini Review`}
                          </button>
                        )}
                        {isAgent&&(reviewMode==="manual"||reviewMode==="hybrid")&&<>
                          <button className="btn bg bxs" onClick={()=>approveBounty(b.id,sub.id)}>✓ Approve</button>
                          <button className="btn br bxs" onClick={()=>rejectBounty(b.id,sub.id)}>✕ Reject</button>
                        </>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Submit work */}
            {b.status==="open"&&(
              <div className="ig" style={{marginBottom:8}}>
                <input placeholder="IPFS hash / URL / proof text…" style={{fontSize:12}} value={proofIn[b.id]||""} onChange={e=>setProofIn(p=>({...p,[b.id]:e.target.value}))}/>
                <button className="btn bgh bsm" onClick={()=>submitWork(b.id)}>Submit Work</button>
              </div>
            )}

            {/* Agent management */}
            {isAgent&&(b.status==="open"||b.status==="submitted")&&(
              <div style={{borderTop:"1px solid var(--border)",paddingTop:9,display:"flex",gap:6,flexWrap:"wrap"}}>
                <div style={{display:"flex",gap:5,alignItems:"center"}}>
                  <input placeholder="+days" type="number" style={{width:68,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:6,padding:"3px 7px",fontSize:11,color:"var(--text)",fontFamily:"var(--mono)",outline:"none"}} value={extDL[b.id]||""} onChange={e=>setExtDL(x=>({...x,[b.id]:e.target.value}))}/>
                <button className="btn bgh bxs" onClick={()=>extendDeadline(b.id)}>Extend</button>
                </div>
                <div style={{display:"flex",gap:5,alignItems:"center"}}>
                  <input placeholder="new reward" type="number" style={{width:86,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:6,padding:"3px 7px",fontSize:11,color:"var(--text)",fontFamily:"var(--mono)",outline:"none"}} value={newRew[b.id]||""} onChange={e=>setNewRew(x=>({...x,[b.id]:e.target.value}))}/>
                <button className="btn bgh bxs" onClick={()=>updateBountyReward(b.id)}>Update Reward</button>
                </div>
              {b.status==="open"&&b.submissions.length===0&&<button className="btn bgh bxs" style={{color:"var(--red)"}} onClick={()=>cancelBounty(b.id)}>Cancel</button>}
              {(daysLeft(b.deadline)===0||b.status==="submitted")&&<button className="btn bgh bxs" onClick={()=>expireAndRefund(b.id)}>Expire & Refund</button>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: PAYMENTS
// ─────────────────────────────────────────────────────────────────────────────
function PaymentsTab({ agents, setAgents, payments, setPayments, scheduled, setScheduled, tokenBalances, setTokenBalances, addLog, addNotif, toast, rules, role, contracts, signer, account }) {
  const [nAddr, setNAddr] = useState(""); const [nName, setNName] = useState(""); const [nMeta, setNMeta] = useState(""); const [nDL, setNDL] = useState("50"); const [nCat, setNCat] = useState("analytics");
  const [pAddr, setPAddr] = useState(""); const [pAmt, setPAmt] = useState(""); const [pMemo, setPMemo] = useState(""); const [pTok, setPTok] = useState("PROS"); const [pCat, setPCat] = useState("a2a");
  const [sAddr, setSAddr] = useState(""); const [sAmt, setSAmt] = useState(""); const [sInt, setSInt] = useState("daily"); const [sMemo, setSMemo] = useState(""); const [sTok, setSTok] = useState("PROS"); const [sCat, setSCat] = useState("a2a");
  const [filterType, setFilterType] = useState("all");
  const isAgent = role==="Owner"||role==="Agent";
  const paused  = rules.bool.EMERGENCY_PAUSE?.value;
  const allowA2A= rules.bool.ALLOW_AGENT_TO_AGENT_PAYMENTS?.value;
  const allowMkt= rules.bool.ALLOW_MARKETING_PAYMENTS?.value;
  const allowCom= rules.bool.ALLOW_COMMUNITY_PAYMENTS?.value;
  const enfHours= rules.bool.ENFORCE_MARKETING_HOURS?.value;
  const msThresh= rules.numeric.MULTISIG_THRESHOLD?.value||100;
  const floor   = rules.numeric.RESERVE_FLOOR?.value||200;
  const rlHours = rules.numeric.RATE_LIMIT_WINDOW_HOURS?.value||24;
 
  const checkCategoryAllowed = (cat) => {
    if(cat==="marketing"&&!allowMkt) return "ALLOW_MARKETING_PAYMENTS = false";
    if(cat==="marketing"&&enfHours&&!isMarketingWindow()) return `Marketing payments blocked outside 09:00–17:00 UTC (current: ${utcHour()}:xx UTC)`;
    if(cat==="community"&&!allowCom) return "ALLOW_COMMUNITY_PAYMENTS = false";
    if((cat==="a2a"||cat==="other")&&!allowA2A) return "ALLOW_AGENT_TO_AGENT_PAYMENTS = false";
    return null;
  };

  const checkRateLimit = (addr) => {
    const last = payments.filter(p=>p.recipient===addr||p.recipient===shortAddr(addr)).sort((a,b)=>b.time-a.time)[0];
    if(last&&(now()-last.time)<rlHours*3600000) return `Rate limit: recipient received payment within last ${rlHours}h`;
    return null;
  };

  const payAgent = async () => {
    if(!isAgent) return toast("Agent/Owner only","error");
    if(paused) return toast("Emergency pause active","error");
    const agent=agents.find(a=>a.address===pAddr);
    if(!agent||!agent.active) return toast("Agent not found or inactive","error");
    const a=parseFloat(pAmt); if(!a||a<=0) return toast("Invalid amount","error");
    const catErr=checkCategoryAllowed(pCat); if(catErr) return toast(`Rule Engine: ${catErr}`,"error");
    const rlErr=checkRateLimit(pAddr); if(rlErr) return toast(`Rule Engine: ${rlErr}`,"warn");
    if(a>agent.dailyLimit) return toast(`Per-agent daily limit: ${agent.dailyLimit} PROS`,"error");
    if(a>(tokenBalances[pTok]||0)) return toast("Insufficient balance","error");
    if(pTok==="PROS"&&(tokenBalances.PROS-a)<floor) return toast(`Reserve floor of ${floor} PROS would be breached`,"error");
    if(a>=msThresh&&pTok==="PROS") { addNotif({type:"multisig",msg:`Multi-sig needed for ${fmt(a)} PROS payment to ${agent.name}`}); return toast(`≥ ${msThresh} PROS — submitted to multi-sig queue`,"warn"); }
    if (contracts.agentPaymentRouter && signer) {
      const tokenAddr = pTok === "PROS" ? ethers.ZeroAddress : tokenAddresses[pTok];
      if (pTok !== "PROS" && !tokenAddr) return toast(`Token address for ${pTok} not configured`, "error");
      try {
        let amountUnits = ethers.parseEther(a.toString());
        if (pTok !== "PROS") {
          const token = createERC20Contract(tokenAddr, signer);
          const decimals = Number(await token.decimals().catch(() => 18));
          amountUnits = ethers.parseUnits(a.toString(), decimals);
        }
        const tx = await contracts.agentPaymentRouter.payAgent(pAddr, amountUnits, pMemo||"No memo", tokenAddr);
        const receipt = await tx.wait();
        addLog({ type: "info", text: `On-chain payment executed to ${agent.name} (tx: ${receipt.transactionHash})` });
      } catch (error) {
        console.error(error);
        return toast("On-chain payment failed","error");
      }
    }
    setTokenBalances(tb=>({...tb,[pTok]:tb[pTok]-a}));
    const pay={id:uid(),recipient:agent.address,name:agent.name,amount:a,token:pTok,memo:pMemo||"No memo",time:now(),type:"manual",category:pCat,txHash:`0x${uid()}…${uid()}`};
    setPayments(p=>[pay,...p]);
    setAgents(ag=>ag.map(x=>x.address===pAddr?{...x,paidToday:x.paidToday+a}:x));
    addLog({type:"pay",text:`A2A payment [${pCat}]: ${fmt(a)} ${pTok} → ${agent.name} | memo: ${pMemo||"none"} (tx: ${pay.txHash})`});
    addNotif({type:"payment",msg:`Payment of ${fmt(a)} ${pTok} sent to ${agent.name}`});
    toast(`Paid ${fmt(a)} ${pTok} → ${agent.name} ✓`,"success");
    setPAddr(""); setPAmt(""); setPMemo("");
  };

  const registerAgent = async () => {
    if(!isAgent) return toast("Agent/Owner only","error");
    if(!nAddr||!nName) return toast("Fill address and name","error");
    if(agents.find(a=>a.address.toLowerCase()===nAddr.toLowerCase())) return toast("Already registered","error");
    if(contracts.agentPaymentRouter && signer) {
      try {
        const tx = await contracts.agentPaymentRouter.registerAgent(nAddr, nName, nMeta||"ipfs://QmNew", ethers.parseEther((parseFloat(nDL)||50).toString()));
        await tx.wait();
        addLog({ type: "info", text: `On-chain agent registration executed for ${shortAddr(nAddr)}` });
      } catch (error) {
        console.error(error);
        return toast("On-chain registration failed","error");
      }
    }

    setAgents(a=>[...a,{address:nAddr,name:nName,metaURI:nMeta||"ipfs://QmNew",active:true,registered:now(),dailyLimit:parseFloat(nDL)||50,paidToday:0,category:nCat}]);
    addLog({type:"pay",text:`Agent registered: "${nName}" addr:${shortAddr(nAddr)} category:${nCat}`});
    toast(`"${nName}" registered ✓`,"success");
    setNAddr(""); setNName(""); setNMeta(""); setNDL("50");
  };

  const updateAgentStatus = async (agentAddress, isActive, agentName) => {
    if (!isAgent) return toast("Agent/Owner only", "error");
    if (!contracts.agentPaymentRouter || !signer) return toast("Connect wallet and payment router first", "warn");
    try {
      const tx = await contracts.agentPaymentRouter.updateAgentStatus(agentAddress, !isActive);
      await tx.wait();
      setAgents((ag) => ag.map((x) => x.address === agentAddress ? { ...x, active: !isActive } : x));
      addLog({ type: "pay", text: `Agent ${agentName} ${isActive ? "deactivated" : "activated"} on-chain` });
      toast(`${agentName} ${isActive ? "deactivated" : "activated"} on-chain`, "info");
    } catch (error) {
      console.error(error);
      toast("On-chain agent status update failed", "error");
    }
  };

  const addSchedule = () => {
    if(!isAgent) return toast("Agent/Owner only","error");
    const agent=agents.find(a=>a.address===sAddr); if(!agent) return toast("Agent not found","error");
    const a=parseFloat(sAmt); if(!a||a<=0) return toast("Invalid amount","error");
    if(scheduled.find(s=>s.address===sAddr&&s.interval===sInt&&s.token===sTok)) return toast("Duplicate schedule — modify the existing one (idempotency check)","error");
    setScheduled(s=>[...s,{id:uid(),name:agent.name,address:sAddr,amount:a,token:sTok,interval:sInt,lastPaid:0,memo:sMemo||"Scheduled payment",enabled:true,category:sCat}]);
    addLog({type:"pay",text:`Schedule added: ${fmt(a)} ${sTok}/${sInt} → ${agent.name} [${sCat}]`});
    toast(`Scheduled ${fmt(a)} ${sTok}/${sInt} → ${agent.name} ✓`,"success");
    setSAddr(""); setSAmt(""); setSMemo("");
  };

  const execSchedule = async (id) => {
    if(!isAgent||paused) return toast(paused?"Paused":"Unauthorized","error");
    const sch=scheduled.find(s=>s.id===id); if(!sch.enabled) return toast("Schedule disabled","error");
    const intervalMs={daily:86400000,weekly:604800000}[sch.interval]||86400000;
    if(sch.lastPaid>0&&(now()-sch.lastPaid)<intervalMs) return toast("Idempotency check: interval not elapsed yet","error");
    const catErr=checkCategoryAllowed(sch.category); if(catErr) return toast(`Rule Engine: ${catErr}`,"error");
    if(sch.amount>(tokenBalances[sch.token]||0)) return toast("Insufficient balance","error");
    if(!contracts.agentPaymentRouter || !signer) return toast("Connect wallet and payment router first","warn");
    try {
      const tokenAddr = sch.token === "PROS" ? ethers.ZeroAddress : tokenAddresses[sch.token];
      const amountUnits = ethers.parseEther(sch.amount.toString());
      const dueBucket = Math.floor(Date.now() / intervalMs);
      const key = ethers.id(`${sch.id}:${sch.address}:${sch.amount}:${dueBucket}`);
      const tx = await contracts.agentPaymentRouter.payAgentWithIdempotency(sch.address, amountUnits, sch.memo, tokenAddr, key);
      const receipt = await tx.wait();
      const pay={id:uid(),recipient:sch.address,name:sch.name,amount:sch.amount,token:sch.token,memo:sch.memo,time:now(),type:"scheduled",category:sch.category,txHash:receipt.transactionHash};
      setPayments(p=>[pay,...p]);
      setScheduled(s=>s.map(x=>x.id===id?{...x,lastPaid:now()}:x));
      setTokenBalances(tb=>({...tb,[sch.token]:tb[sch.token]-sch.amount}));
      addLog({type:"pay",text:`Scheduled payment [${sch.interval}][${sch.category}]: ${fmt(sch.amount)} ${sch.token} â†’ ${sch.name} (tx: ${receipt.transactionHash})`});
      toast(`Executed ${fmt(sch.amount)} ${sch.token} on-chain`,"success");
      return;
    } catch (error) {
      console.error(error);
      return toast("On-chain scheduled payment failed","error");
    }
    setTokenBalances(tb=>({...tb,[sch.token]:tb[sch.token]-sch.amount}));
    const pay={id:uid(),recipient:sch.address,name:sch.name,amount:sch.amount,token:sch.token,memo:sch.memo,time:now(),type:"scheduled",category:sch.category,txHash:`0x${uid()}…${uid()}`};
    setPayments(p=>[pay,...p]);
    setScheduled(s=>s.map(x=>x.id===id?{...x,lastPaid:now()}:x));
    addLog({type:"pay",text:`Scheduled payment [${sch.interval}][${sch.category}]: ${fmt(sch.amount)} ${sch.token} → ${sch.name} (tx: ${pay.txHash})`});
    toast(`Executed ${fmt(sch.amount)} ${sch.token} → ${sch.name} ✓`,"success");
  };

  const isDue = (sch) => {
    const ms={daily:86400000,weekly:604800000}[sch.interval]||86400000;
    return sch.enabled&&(sch.lastPaid===0||(now()-sch.lastPaid)>=ms);
  };

  const filteredPay = filterType==="all"?payments:payments.filter(p=>p.category===filterType||p.type===filterType);

  return (
    <div className="stack">
      <div className="g2">
        <div className="card">
          <div className="ctitle"><span className="cdot" style={{background:"var(--violet)"}}/>Register Agent {!isAgent&&<span className="badge b-inactive">AGENT ONLY</span>}</div>
          <div className="stack" style={{gap:9}}>
            <div className="fld"><label>Address (0x…)</label><input placeholder="0x…" value={nAddr} onChange={e=>setNAddr(e.target.value)} disabled={!isAgent}/></div>
            <div className="fr">
              <div className="fld"><label>Name</label><input placeholder="Analytics Agent" value={nName} onChange={e=>setNName(e.target.value)} disabled={!isAgent}/></div>
              <div className="fld"><label>Daily Limit (PROS)</label><input type="number" value={nDL} onChange={e=>setNDL(e.target.value)} disabled={!isAgent}/></div>
            </div>
            <div className="fld"><label>Category</label>
              <select value={nCat} onChange={e=>setNCat(e.target.value)} disabled={!isAgent} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:8,padding:"8px 11px",color:"var(--text)",fontFamily:"var(--sans)",outline:"none",fontSize:13}}>
                {["analytics","marketing","research","operations","other"].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="fld"><label>Metadata URI (optional)</label><input placeholder="ipfs://…" value={nMeta} onChange={e=>setNMeta(e.target.value)} disabled={!isAgent}/></div>
            <button className="btn bv2 bfull" onClick={registerAgent} disabled={!isAgent}>Register Agent</button>
          </div>
        </div>

        <div className="card">
          <div className="ctitle"><span className="cdot" style={{background:"var(--cyan)"}}/>Pay Agent {!isAgent&&<span className="badge b-inactive">AGENT ONLY</span>}</div>
          <div className="stack" style={{gap:9}}>
            <div className="fld"><label>Select Agent</label>
              <select value={pAddr} onChange={e=>setPAddr(e.target.value)} disabled={!isAgent} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:8,padding:"8px 11px",color:"var(--text)",fontFamily:"var(--sans)",outline:"none",fontSize:13}}>
                <option value="">— Select agent —</option>
                {agents.filter(a=>a.active).map(a=><option key={a.address} value={a.address}>{a.name} · lim:{a.dailyLimit} PROS</option>)}
              </select>
            </div>
            <div className="fld"><label>Category</label>
              <div className="pills" style={{marginTop:2}}>
                {PAYMENT_CATEGORIES.map(c=><div key={c} className={`pill${pCat===c?" ap":""}`} onClick={()=>isAgent&&setPCat(c)}>{c}</div>)}
              </div>
            </div>
            <div className="fld"><label>Token</label>
              <div className="pills" style={{marginTop:2}}>{Object.keys(tokenBalances).map(t=><div key={t} className={`tkchip${pTok===t?" sel":""}`} onClick={()=>isAgent&&setPTok(t)}>{t}</div>)}</div>
            </div>
            <div className="fr">
              <div className="fld"><label>Amount</label><input type="number" placeholder="5" value={pAmt} onChange={e=>setPAmt(e.target.value)} disabled={!isAgent}/></div>
              <div className="fld"><label>Memo</label><input placeholder="Service note…" value={pMemo} onChange={e=>setPMemo(e.target.value)} disabled={!isAgent}/></div>
            </div>
            {pCat==="marketing"&&<div style={{fontSize:10,fontFamily:"var(--mono)"}}>Marketing window: <span className={`hours-badge ${isMarketingWindow()?"hours-ok":"hours-off"}`}>{isMarketingWindow()?"OPEN (09–17 UTC)":"CLOSED"}</span></div>}
            {parseFloat(pAmt)>=msThresh&&<div className="alert alert-warn" style={{fontSize:10}}>⚠ Amount ≥ {msThresh} PROS → will route to multi-sig queue</div>}
            <button className="btn bp bfull" onClick={payAgent} disabled={!isAgent||paused}>⚡ Send Payment</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="sh"><span className="sht">Registered Agents</span></div>
        <div className="tw">
          <table>
            <thead><tr><th>Name</th><th>Address</th><th>Category</th><th>Daily Limit</th><th>Paid Today</th><th>Metadata</th><th>Registered</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {agents.map(a=>(
                <tr key={a.address}>
                  <td style={{fontWeight:600}}>{a.name}</td>
                  <td className="mono" style={{color:"var(--cyan)"}}>{shortAddr(a.address)}</td>
                  <td><span className={`badge b-${a.category}`}>{a.category}</span></td>
                  <td className="mono">{a.dailyLimit} PROS</td>
                  <td className="mono" style={{color:a.paidToday>a.dailyLimit*0.8?"var(--amber)":"var(--muted)"}}>{fmt(a.paidToday)}</td>
                  <td className="mono" style={{color:"var(--muted)"}}>{a.metaURI?.slice(0,20)}…</td>
                  <td className="mono" style={{color:"var(--muted)"}}>{tsFull(a.registered)}</td>
                  <td><span className={`badge b-${a.active?"active":"inactive"}`}>{a.active?"Active":"Inactive"}</span></td>
                  <td>{isAgent&&<button className="btn bgh bxs" onClick={()=>updateAgentStatus(a.address, a.active, a.name)}>{a.active?"Revoke":"Activate"}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="g2">
        <div className="card">
          <div className="ctitle"><span className="cdot" style={{background:"var(--blue)"}}/>Add Scheduled Payment</div>
          <div className="stack" style={{gap:9}}>
            <div className="fld"><label>Agent</label>
              <select value={sAddr} onChange={e=>setSAddr(e.target.value)} disabled={!isAgent} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:8,padding:"8px 11px",color:"var(--text)",fontFamily:"var(--sans)",outline:"none",fontSize:13}}>
                <option value="">— Select agent —</option>
                {agents.filter(a=>a.active).map(a=><option key={a.address} value={a.address}>{a.name}</option>)}
              </select>
            </div>
            <div className="fld"><label>Category</label>
              <div className="pills" style={{marginTop:2}}>
                {PAYMENT_CATEGORIES.map(c=><div key={c} className={`pill${sCat===c?" ap":""}`} onClick={()=>isAgent&&setSCat(c)}>{c}</div>)}
              </div>
            </div>
            <div className="fr">
              <div className="fld"><label>Amount</label><input type="number" placeholder="5" value={sAmt} onChange={e=>setSAmt(e.target.value)} disabled={!isAgent}/></div>
              <div className="fld"><label>Interval</label>
                <select value={sInt} onChange={e=>setSInt(e.target.value)} disabled={!isAgent} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:8,padding:"8px 11px",color:"var(--text)",fontFamily:"var(--sans)",outline:"none",fontSize:13}}>
                  <option value="daily">Daily</option><option value="weekly">Weekly</option>
                </select>
              </div>
            </div>
            <div className="fld"><label>Memo</label><input placeholder="Service description…" value={sMemo} onChange={e=>setSMemo(e.target.value)} disabled={!isAgent}/></div>
            <button className="btn bb bfull" onClick={addSchedule} disabled={!isAgent}>+ Add Schedule</button>
          </div>
        </div>

        <div className="card">
          <div className="ctitle"><span className="cdot" style={{background:"var(--blue)"}}/>Scheduled Payments (with Idempotency)</div>
          {scheduled.map(sch=>(
            <div key={sch.id} className="sc-it">
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:3}}>
                  <span style={{fontSize:12,fontWeight:600}}>{sch.name}</span>
                  {isDue(sch)&&<span className="badge" style={{background:"rgba(16,185,129,.1)",color:"var(--green)",fontSize:9}}>DUE</span>}
                  {!sch.enabled&&<span className="badge b-inactive">PAUSED</span>}
                  <span className={`badge b-${sch.category}`}>{sch.category}</span>
                </div>
                <div style={{fontSize:10,fontFamily:"var(--mono)",color:"var(--muted)"}}>
                  {fmt(sch.amount)} {sch.token} / {sch.interval} · {sch.memo}
                </div>
                <div style={{fontSize:10,fontFamily:"var(--mono)",color:"var(--muted2)",marginTop:2}}>
                  Last: {sch.lastPaid?tsFull(sch.lastPaid):"Never"} · Idempotency: {isDue(sch)?"eligible":"cooldown"}
                </div>
              </div>
              <div style={{display:"flex",gap:5,flexShrink:0}}>
                {isAgent&&isDue(sch)&&<button className="btn bg bxs" onClick={()=>execSchedule(sch.id)}>Execute</button>}
                {isAgent&&<button className="btn bgh bxs" onClick={()=>setScheduled(s=>s.map(x=>x.id===sch.id?{...x,enabled:!x.enabled}:x))}>{sch.enabled?"Pause":"Enable"}</button>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="sh">
          <span className="sht">Payment History</span>
          <div className="pills">
            {["all",...PAYMENT_CATEGORIES,"scheduled","manual","bounty"].map(f=><button key={f} className={`pill${filterType===f?" ap":""}`} onClick={()=>setFilterType(f)}>{f}</button>)}
          </div>
        </div>
        <div className="tw">
          <table>
            <thead><tr><th>Recipient</th><th>Amount</th><th>Token</th><th>Category</th><th>Memo</th><th>Type</th><th>Tx Hash</th><th>Time</th></tr></thead>
            <tbody>
              {filteredPay.map(p=>(
                <tr key={p.id}>
                  <td><div style={{fontWeight:500}}>{p.name}</div><div className="mono" style={{color:"var(--muted)"}}>{shortAddr(p.recipient)}</div></td>
                  <td className="mono" style={{color:"var(--violet)"}}>-{fmt(p.amount)}</td>
                  <td><span style={{fontFamily:"var(--mono)",fontSize:10,color:TOKENS[p.token]?.color||"var(--text)"}}>{p.token}</span></td>
                  <td><span className={`badge b-${p.category}`}>{p.category}</span></td>
                  <td style={{fontSize:11,color:"var(--muted)",maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.memo}</td>
                  <td><span className={`badge b-${p.type}`}>{p.type}</span></td>
                  <td className="mono" style={{color:"var(--cyan)"}}>{p.txHash}</td>
                  <td className="mono" style={{color:"var(--muted)"}}>{tsFull(p.time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: RULE ENGINE
// ─────────────────────────────────────────────────────────────────────────────
function RulesTab({ rules, setRules, addLog, toast, role, contracts, signer }) {

  const [numE, setNumE] = useState({});

  const [strE, setStrE] = useState({});

  const isOwner = role==="Owner";



  const saveNum = async (k) => {

    if(!isOwner) return toast("Owner only","error");

    const v=parseFloat(numE[k]); if(isNaN(v)||v<0) return toast("Invalid value","error");

    if(contracts.ruleEngine && signer) {
      try {
        const key = ethers.id(k);
        const tx = await contracts.ruleEngine.setNumericRule(key, v);
        await tx.wait();
        addLog({ type: "info", text: `On-chain numeric rule updated: ${k} = ${v}` });
      } catch (error) {
        console.error(error);
        return toast("On-chain rule update failed","error");
      }
    }

    setRules(r=>({...r,numeric:{...r.numeric,[k]:{...r.numeric[k],value:v}}}));

    setNumE(e=>{const n={...e};delete n[k];return n;});

    addLog({type:"rule",text:`numericRule[${k}] = ${v}`});

    toast(`${k} = ${v} ✓`,"success");

  };

  const saveBool = async (k,v) => {

    if(!isOwner) return toast("Owner only","error");

    if(contracts.ruleEngine && signer) {
      try {
        const key = ethers.id(k);
        const tx = await contracts.ruleEngine.setBoolRule(key, v);
        await tx.wait();
        addLog({ type: "info", text: `On-chain bool rule updated: ${k} = ${v}` });
      } catch (error) {
        console.error(error);
        return toast("On-chain rule update failed","error");
      }
    }

    setRules(r=>({...r,bool:{...r.bool,[k]:{...r.bool[k],value:v}}}));

    addLog({type:"rule",text:`boolRule[${k}] = ${v}`});

    toast(`${k} → ${v}`, v?"info":"warn");

  };

  const saveStr = async (k) => {

    if(!isOwner) return toast("Owner only","error");

    const v=strE[k]; if(v===undefined) return;

    if(contracts.ruleEngine && signer) {
      try {
        const key = ethers.id(k);
        const tx = await contracts.ruleEngine.setStringRule(key, v);
        await tx.wait();
        addLog({ type: "info", text: `On-chain string rule updated: ${k}` });
      } catch (error) {
        console.error(error);
        return toast("On-chain rule update failed","error");
      }
    }

    setRules(r=>({...r,string:{...r.string,[k]:{...r.string[k],value:v}}}));

    setStrE(e=>{const n={...e};delete n[k];return n;});

    addLog({type:"rule",text:`stringRule[${k}] = "${v}"`});

    toast(`${k} updated ✓`,"success");

  };



  return (

    <div className="g2" style={{alignItems:"start"}}>

      <div className="stack">

        <div className="card">

          <div className="ctitle"><span className="cdot" style={{background:"var(--cyan)"}}/>Numeric Rules {!isOwner&&<span className="badge b-inactive">OWNER ONLY</span>}</div>

          {Object.entries(rules.numeric).map(([k,r])=>(

            <div key={k} className="rr">

              <div><div className="rk" style={{color:"var(--cyan)"}}>{k}</div><div className="rd">{r.desc}</div></div>

              <div className="rrr">

                <input type="number" className="ri" value={numE[k]!==undefined?numE[k]:r.value} onChange={e=>setNumE(x=>({...x,[k]:e.target.value}))} disabled={!isOwner}/>

                {isOwner&&<button className="btn bgh bxs" onClick={()=>saveNum(k)}>Set</button>}

              </div>

            </div>

          ))}

        </div>



        <div className="card">

          <div className="ctitle"><span className="cdot" style={{background:"var(--amber)"}}/>String Rules {!isOwner&&<span className="badge b-inactive">OWNER ONLY</span>}</div>

          {Object.entries(rules.string).map(([k,r])=>(

            <div key={k} className="rr">

              <div style={{flex:1,minWidth:0}}><div className="rk" style={{color:"var(--amber)"}}>{k}</div><div className="rd">{r.desc}</div></div>

              <div className="rrr">

                <input className="rs" value={strE[k]!==undefined?strE[k]:r.value} onChange={e=>setStrE(x=>({...x,[k]:e.target.value}))} disabled={!isOwner}/>

                {isOwner&&<button className="btn bgh bxs" onClick={()=>saveStr(k)}>Set</button>}

              </div>

            </div>

          ))}

        </div>

      </div>



      <div className="stack">

        <div className="card">

          <div className="ctitle"><span className="cdot" style={{background:"var(--violet)"}}/>Boolean Rules {!isOwner&&<span className="badge b-inactive">OWNER ONLY</span>}</div>

          {Object.entries(rules.bool).map(([k,r])=>(

            <div key={k} className="rr">

              <div>

                <div className="rk" style={{color:k==="EMERGENCY_PAUSE"?"var(--red)":"var(--violet)"}}>{k}</div>

                <div className="rd">{r.desc}</div>

              </div>

              <button className={`toggle${r.value?" on":""}${k==="EMERGENCY_PAUSE"?" ron":""}`} onClick={()=>isOwner&&saveBool(k,!r.value)} disabled={!isOwner}/>

            </div>

          ))}

        </div>



        <div className="card cdk">

          <div className="ctitle"><span className="cdot" style={{background:"var(--green)"}}/>Live Policy Evaluation</div>

          <div style={{fontFamily:"var(--mono)",fontSize:11,display:"flex",flexDirection:"column",gap:4}}>

            {[

              {ok:true,   t:`Daily spend cap: ${rules.numeric.MAX_DAILY_SPEND_PERCENT?.value}%`},

              {ok:true,   t:`Reserve floor: ${rules.numeric.RESERVE_FLOOR?.value} PROS locked`},

              {ok:true,   t:`Multi-sig threshold: ${rules.numeric.MULTISIG_THRESHOLD?.value} PROS`},

              {ok:true,   t:`Rate limit window: ${rules.numeric.RATE_LIMIT_WINDOW_HOURS?.value}h`},

              {ok:rules.bool.ALLOW_BOUNTY_PAYMENTS?.value, t:`Bounty payments: ${rules.bool.ALLOW_BOUNTY_PAYMENTS?.value?"ENABLED":"BLOCKED"}`},

              {ok:rules.bool.ALLOW_AGENT_TO_AGENT_PAYMENTS?.value, t:`A2A payments: ${rules.bool.ALLOW_AGENT_TO_AGENT_PAYMENTS?.value?"ENABLED":"BLOCKED"}`},

              {ok:rules.bool.ALLOW_MARKETING_PAYMENTS?.value, t:`Marketing payments: ${rules.bool.ALLOW_MARKETING_PAYMENTS?.value?"ENABLED":"BLOCKED"}`},

              {ok:isMarketingWindow()||!rules.bool.ENFORCE_MARKETING_HOURS?.value, t:`Marketing hours: ${isMarketingWindow()?"OPEN (09–17 UTC)":"CLOSED — UTC hour "+utcHour()}`},

              {ok:!rules.bool.EMERGENCY_PAUSE?.value, t:`Emergency pause: ${rules.bool.EMERGENCY_PAUSE?.value?"⚠ ACTIVE":"Inactive"}`},

              {ok:true,   t:`Gemini model: ${rules.string.GEMINI_MODEL?.value}`},

              {ok:true,   t:`Version: ${rules.string.AGENT_VERSION?.value}`},

            ].map((ev,i)=>(

              <div key={i} style={{display:"flex",gap:9,padding:"4px 0",borderBottom:"1px solid rgba(30,47,74,.25)"}}>

                <span style={{color:ev.ok?"var(--green)":"var(--red)",flexShrink:0}}>{ev.ok?"✓":"✕"}</span>

                <span style={{color:ev.ok?"#A0BDD8":"var(--red)"}}>{ev.t}</span>

              </div>

            ))}

          </div>

        </div>

      </div>

    </div>

  );

}



// ─────────────────────────────────────────────────────────────────────────────

// TAB: ADMIN

// ─────────────────────────────────────────────────────────────────────────────

function AdminTab({ multisigQueue, setMultisigQueue, rules, setRules, agents, bounties, addLog, addNotif, toast, role, tokenBalances, contracts, signer }) {

  const isOwner = role==="Owner";

  const isAgent = role==="Owner"||role==="Agent";

  const paused  = rules.bool.EMERGENCY_PAUSE?.value;



  const approveMS = async (id) => {

    if(!isOwner) return toast("Owner only","error");
    const item = multisigQueue.find((m) => m.id === id);
    if (item?.source === "treasury" && contracts.treasuryManager && signer) {
      try {
        await (await contracts.treasuryManager.approveRequest(id)).wait();
        await (await contracts.treasuryManager.executeRequest(id)).wait();
      } catch (error) {
        console.error(error);
        return toast("On-chain Treasury request approval failed","error");
      }
    } else if (contracts.agentPaymentRouter && signer) {
      try {
        await (await contracts.agentPaymentRouter.approvePayment(id)).wait();
      } catch (error) {
        console.error(error);
        return toast("On-chain payment approval failed","error");
      }
    }

    setMultisigQueue(q=>q.map(m=>m.id===id?{...m,approvals:[...m.approvals,"Owner"],status:"approved"}:m));

    addLog({type:"multisig",text:`Multi-sig ${id} APPROVED by Owner — payment executed`});

    addNotif({type:"approve",msg:`Multi-sig ${id} approved and executed`});

    toast("Multi-sig approved — payment executed ✓","success");

  };

  const rejectMS = async (id) => {

    if(!isOwner) return toast("Owner only","error");
    const item = multisigQueue.find((m) => m.id === id);
    if (item?.source === "treasury" && contracts.treasuryManager && signer) {
      try {
        await (await contracts.treasuryManager.rejectRequest(id)).wait();
      } catch (error) {
        console.error(error);
        return toast("On-chain Treasury request rejection failed","error");
      }
    } else if (contracts.agentPaymentRouter && signer) {
      try {
        await (await contracts.agentPaymentRouter.rejectPayment(id)).wait();
      } catch (error) {
        console.error(error);
        return toast("On-chain payment rejection failed","error");
      }
    }

    setMultisigQueue(q=>q.map(m=>m.id===id?{...m,status:"rejected"}:m));

    addLog({type:"multisig",text:`Multi-sig ${id} REJECTED by Owner`});

    toast("Multi-sig rejected","warn");

  };

  const togglePause = async () => {

    if(!isOwner) return toast("Owner only","error");

    const v=!paused;

    if (contracts.ruleEngine && signer) {
      try {
        const key = ethers.id("EMERGENCY_PAUSE");
        const tx = await contracts.ruleEngine.setBoolRule(key, v);
        await waitForTx(tx);
        addLog({ type: "info", text: `On-chain emergency pause set = ${v}` });
      } catch (error) {
        console.error(error);
        return toast("On-chain emergency pause update failed","error");
      }
    }

    if (contracts.treasuryManager && signer) {
      try {
        const tx = await contracts.treasuryManager.setEmergencyPause(v);
        await waitForTx(tx);
      } catch (error) {
        console.error(error);
        return toast("Treasury pause update failed","error");
      }
    }

    setRules(r=>({...r,bool:{...r.bool,EMERGENCY_PAUSE:{...r.bool.EMERGENCY_PAUSE,value:v}}}));

    addLog({type:"warn",text:v?"⚠ EMERGENCY PAUSE ACTIVATED — all payments halted":"Emergency pause DEACTIVATED — operations resumed"});

    addNotif({type:"rule",msg:v?"⚠ Emergency pause activated by Owner":"Emergency pause deactivated — operations resumed"});

    toast(v?"Emergency pause activated":"Operations resumed",v?"error":"success");

  };



  return (

    <div className="stack">

      {/* Emergency control */}

      <div className={`card${paused?" gr2":""}`} style={{borderLeft:`3px solid ${paused?"var(--red)":"var(--border)"}`}}>

        <div className="ctitle"><span className="cdot" style={{background:paused?"var(--red)":"var(--green)"}}/>Emergency Controls {!isOwner&&<span className="badge b-inactive">OWNER ONLY</span>}</div>

        <div style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>

          <div>

            <div style={{fontSize:13,fontWeight:600}}>{paused?"🔴 Emergency Pause Active":"🟢 Agent Operating Normally"}</div>

            <div style={{fontSize:11,color:"var(--muted)",marginTop:3}}>{paused?"All outgoing transactions halted. Treasury read-only.":"All systems nominal. Payments processing normally."}</div>

          </div>

          <button className={`btn ${paused?"bg":"br"}`} onClick={togglePause} disabled={!isOwner}>{paused?"▶ Resume Operations":"⏸ Emergency Pause"}</button>

        </div>

        <div style={{marginTop:11,padding:"8px 11px",background:"var(--surface)",borderRadius:8,fontSize:11,fontFamily:"var(--mono)",display:"flex",gap:20,flexWrap:"wrap"}}>

          <span>Safe address: <span style={{color:"var(--cyan)"}}>{rules.string.EMERGENCY_SAFE_ADDR?.value||"Not set"}</span></span>

          <span>Version: <span style={{color:"var(--muted)"}}>{rules.string.AGENT_VERSION?.value}</span></span>

          <span>Webhook: <span style={{color:"var(--muted)"}}>{rules.string.ALERT_WEBHOOK?.value?.slice(0,28)}…</span></span>

        </div>

      </div>



      <div className="g2">

        {/* Multi-sig queue */}

        <div className="card">

          <div className="sh"><span className="sht">Multi-Sig Approval Queue</span>{multisigQueue.filter(m=>m.status==="pending").length>0&&<span className="tab-badge">{multisigQueue.filter(m=>m.status==="pending").length}</span>}</div>

          {multisigQueue.length===0&&<div className="empty"><div className="ei">🔐</div>No pending approvals</div>}

          {multisigQueue.map(m=>(

            <div key={m.id} className="ms-card" style={{opacity:m.status==="pending"?1:.55,marginBottom:10}}>

              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>

                <div>

                  <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--muted)"}}>MS-{m.id} · {tsFull(m.time)}</div>

                  <div style={{fontWeight:600,marginTop:3,fontSize:13}}>{m.action}: {fmt(m.amount)} {m.token}</div>

                  <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>→ {m.recipient}</div>

                  <div style={{fontSize:11,color:"var(--muted)"}}>Memo: {m.memo}</div>

                  <span className={`badge b-${m.category}`} style={{marginTop:5}}>{m.category}</span>

                </div>

                <span className={`badge b-${m.status==="pending"?"pending":m.status==="approved"?"approved":"expired"}`}>{m.status}</span>

              </div>

              <div className="ms-sigs">

                {["Agent","Owner"].map(s=>(

                  <span key={s} className={`ms-sig ${m.approvals.includes(s)?"ms-done":"ms-wait"}`}>

                    {m.approvals.includes(s)?"✓":"⋯"} {s}

                  </span>

                ))}

                <span style={{fontSize:10,color:"var(--muted)",marginLeft:"auto"}}>{m.threshold}-of-2 required</span>

              </div>

              {m.status==="pending"&&isOwner&&(

                <div style={{display:"flex",gap:7,marginTop:8}}>

                  <button className="btn bg bsm" onClick={()=>approveMS(m.id)}>✓ Approve & Execute</button>

                  <button className="btn br bsm" onClick={()=>rejectMS(m.id)}>✕ Reject</button>

                </div>

              )}

            </div>

          ))}

        </div>



        <div className="stack">

          {/* Role matrix */}

          <div className="card">

            <div className="ctitle"><span className="cdot" style={{background:"var(--violet)"}}/>Role Separation Matrix</div>

            {[

              {role:"Owner",  clr:"var(--cyan)",   source:"Contract owner wallet", perms:["Set rules","Emergency pause/resume","Multi-sig approve","Set reserve floor","Transfer ownership","Set emergency address"]},

              {role:"Agent",  clr:"var(--violet)", source:"On-chain agent role", perms:["Create bounties","Approve/reject submissions","Pay agents","Execute scheduled payments","Register agents","Withdraw (daily limit)"]},

              {role:"Verifier",clr:"var(--amber)",  source:"Bounty verifier role", perms:["Run PVE review","Flag submissions","View treasury (read-only)","Sentiment analysis"]},

              {role:"User",   clr:"var(--green)",  source:"Connected public wallet", perms:["Deposit funds","Submit bounty work","View all public state","Read rules"]},
            ].map(r=>(

              <div key={r.role} style={{padding:"10px 0",borderBottom:"1px solid rgba(30,47,74,.35)"}}>

                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>

                  <div style={{width:8,height:8,borderRadius:"50%",background:r.clr,flexShrink:0}}/>

                  <span style={{fontWeight:600,fontSize:13,color:r.clr}}>{r.role}</span>

                  <span style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--muted)",marginLeft:"auto"}}>{r.source}</span>

                </div>

                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>

                  {r.perms.map(p=><span key={p} style={{fontSize:10,padding:"2px 7px",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:4,color:"var(--muted)"}}>{p}</span>)}

                </div>

              </div>

            ))}

          </div>



          {/* Pending review queue */}

          <div className="card">

            <div className="sh"><span className="sht">Submissions Pending Review</span><span className="badge b-submitted">{bounties.filter(b=>b.status==="submitted").length}</span></div>

            {bounties.filter(b=>b.status==="submitted").length===0&&<div className="empty" style={{padding:16}}>No submissions pending</div>}

            {bounties.filter(b=>b.status==="submitted").map(b=>(

              <div key={b.id} style={{padding:"9px 0",borderBottom:"1px solid rgba(30,47,74,.3)"}}>

                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>

                  <span style={{fontWeight:600}}>Bounty #{b.id}</span>

                  <span style={{fontFamily:"var(--mono)",color:"var(--amber)"}}>{fmt(b.reward)} {b.token}</span>

                </div>

                <div style={{fontSize:11,color:"var(--muted)",marginBottom:2}}>{b.description.slice(0,60)}…</div>

                <div style={{fontSize:10,fontFamily:"var(--mono)",color:"var(--cyan)"}}>{b.submissions.length} submission(s) · category: {b.category}</div>

              </div>

            ))}

          </div>

        </div>

      </div>



      {/* Treasury snapshot */}

      <div className="card">

        <div className="ctitle"><span className="cdot" style={{background:"var(--green)"}}/>Treasury Snapshot</div>

        <div style={{display:"flex",gap:0,flexWrap:"wrap"}}>

          {Object.entries(tokenBalances).map(([sym,bal])=>(

            <div key={sym} style={{flex:1,minWidth:120,textAlign:"center",padding:"12px 0",borderRight:"1px solid var(--border)"}}>

              <div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:4}}>{sym}</div>

              <div style={{fontFamily:"var(--mono)",fontSize:20,fontWeight:700,color:TOKENS[sym]?.color||"var(--cyan)"}}>{sym==="ETH-P"?bal.toFixed(4):fmt(bal)}</div>

            </div>

          ))}

          <div style={{flex:1,minWidth:120,textAlign:"center",padding:"12px 0"}}>

            <div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:4}}>Reserve Locked</div>

            <div style={{fontFamily:"var(--mono)",fontSize:20,fontWeight:700,color:"var(--amber)"}}>{fmt(rules.numeric.RESERVE_FLOOR?.value||200)}</div>

          </div>

        </div>

      </div>

    </div>

  );

}



// ─────────────────────────────────────────────────────────────────────────────

// TAB: AUDIT LOG

// ─────────────────────────────────────────────────────────────────────────────

function AuditTab({ logs }) {

  const [filter, setFilter] = useState("all");

  const [search, setSearch] = useState("");

  const typeClr = {deposit:"var(--cyan)",pay:"var(--violet)",approve:"var(--green)",bounty:"var(--amber)",rule:"#A78BFA",multisig:"var(--pink)",warn:"var(--red)",info:"var(--muted)"};

  const types = ["all","deposit","pay","approve","bounty","rule","multisig","warn","info"];



  const filtered = logs

    .filter(l=>(filter==="all"||l.type===filter)&&(!search||l.text.toLowerCase().includes(search.toLowerCase())))

    .slice().reverse();



  return (

    <div className="stack">

      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>

        <div className="pills" style={{flex:1}}>

          {types.map(t=><button key={t} className={`pill${filter===t?" ap":""}`} onClick={()=>setFilter(t)}>{t==="all"?`all (${logs.length})`:t}</button>)}

        </div>

        <input placeholder="Search events…" value={search} onChange={e=>setSearch(e.target.value)} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:8,padding:"6px 12px",fontFamily:"var(--sans)",fontSize:12,color:"var(--text)",outline:"none",width:200}}/>

      </div>



      <div className="card" style={{padding:0,overflow:"hidden"}}>

        <div style={{background:"var(--surface)",padding:"7px 14px",borderBottom:"1px solid var(--border)",fontSize:10,color:"var(--muted)",fontFamily:"var(--mono)",display:"flex",gap:16}}>

          <span>TIMESTAMP</span><span style={{marginLeft:8}}>TYPE</span><span style={{marginLeft:55}}>EVENT TEXT</span>

        </div>

        <div style={{maxHeight:520,overflowY:"auto",padding:"6px 14px",display:"flex",flexDirection:"column",gap:2}}>

          {filtered.length===0&&<div className="empty"><div className="ei">📋</div>No matching events</div>}

          {filtered.map(l=>(

            <div key={l.id} style={{display:"flex",gap:12,padding:"5px 0",borderBottom:"1px solid rgba(30,47,74,.2)",fontFamily:"var(--mono)",fontSize:11,lineHeight:1.65}}>

              <span style={{color:"var(--muted)",flexShrink:0,fontSize:10,minWidth:140}}>{tsFull(l.time)}</span>

              <span style={{flexShrink:0,width:66,fontSize:10,color:typeClr[l.type]||"var(--muted)"}}>

                [{l.type.toUpperCase().slice(0,7)}]

              </span>

              <span style={{color:"#BDD0F0",flex:1,wordBreak:"break-all"}}>{l.text}</span>

            </div>

          ))}

        </div>

      </div>



      <div className="g4">

        {Object.entries(typeClr).map(([type,clr])=>(

          <div key={type} className="card" style={{borderLeft:`2px solid ${clr}`,padding:"12px 14px"}}>

            <div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase",letterSpacing:".05em"}}>{type}</div>

            <div style={{fontFamily:"var(--mono)",fontSize:20,fontWeight:700,color:clr,marginTop:3}}>{logs.filter(l=>l.type===type).length}</div>

          </div>

        ))}

      </div>

    </div>

  );

}



// ─────────────────────────────────────────────────────────────────────────────

// TAB: COMMANDS (Web App Bot Interface)

// ─────────────────────────────────────────────────────────────────────────────

const CMD_DOCS = [

  {cmd:"/balance",               args:"",                       desc:"Show treasury balances for all tokens"},

  {cmd:"/tip",                   args:"<amount> <token>",        desc:"Deposit funds to the agent treasury"},

  {cmd:"/create_bounty",         args:'"<desc>" <amount> <days>'  ,desc:"Create a new bounty (Agent/Owner only)"},

  {cmd:"/submit_bounty",         args:"<id> <proof>",            desc:"Submit work for a bounty with proof link"},

  {cmd:"/approve_bounty",        args:"<id> <submissionId>",     desc:"Approve a bounty submission (Agent only)"},

  {cmd:"/reject_bounty",         args:"<id> <submissionId>",     desc:"Reject a bounty submission (Agent only)"},

  {cmd:"/pay_agent",             args:"<name> <amount> <memo>",  desc:"Send payment to a registered agent"},

  {cmd:"/list_agents",           args:"",                        desc:"List all registered agents and status"},

  {cmd:"/list_bounties",         args:"[status]",                desc:"List bounties, optionally filter by status"},

  {cmd:"/rules",                 args:"",                        desc:"Show current active Rule Engine config"},

  {cmd:"/set_rule",              args:"<key> <value>",           desc:"Update a rule (Owner only)"},

  {cmd:"/pause",                 args:"",                        desc:"Activate emergency pause (Owner only)"},

  {cmd:"/resume",                args:"",                        desc:"Deactivate emergency pause (Owner only)"},

  {cmd:"/status",                args:"",                        desc:"Show full agent health status"},

  {cmd:"/help",                  args:"",                        desc:"Show this command reference"},

];



function CommandsTab({ tokenBalances, bounties, agents, rules, payments, role, addLog, toast, setBounties, setTokenBalances, addNotif, contracts, signer, account }) {

  const [input, setInput] = useState("");

  const [output, setOutput] = useState([

    {t:"info",  msg:"Agent Fundraiser Command Console — type /help for available commands"},

    {t:"info",  msg:`Connected as role: ${role} · Pharos Testnet`},

  ]);

  const outRef = useRef(null);



  useEffect(()=>{ if(outRef.current) outRef.current.scrollTop=outRef.current.scrollHeight; },[output]);



  const emit = (msgs) => setOutput(o=>[...o,...msgs]);



  const runCmd = async (raw) => {

    const line = raw.trim();

    if(!line) return;

    emit([{t:"cmd",msg:`$ ${line}`}]);

    const [cmd,...rest] = line.split(" ");

    const args = rest.join(" ");



    switch(cmd.toLowerCase()) {

      case "/help":

        emit(CMD_DOCS.map(c=>({t:"info",msg:`${c.cmd} ${c.args} — ${c.desc}`})));

        break;

      case "/balance":

        emit(Object.entries(tokenBalances).map(([sym,bal])=>({t:"ok",msg:`${sym}: ${sym==="ETH-P"?bal.toFixed(4):fmt(bal)} (${TOKENS[sym]?.name})`})));

        emit([{t:"info",msg:`Reserve floor locked: ${rules.numeric.RESERVE_FLOOR?.value||200} PROS`}]);

        break;

      case "/tip": {

        const [a,tok] = args.split(" ");

        const amt=parseFloat(a); const token=(tok||"PROS").toUpperCase();

        if(!amt||amt<=0) { emit([{t:"err",msg:"Usage: /tip <amount> <token>"}]); break; }

        if(!TOKENS[token]) { emit([{t:"err",msg:`Unknown token: ${token}. Available: ${Object.keys(TOKENS).join(", ")}`}]); break; }

        if(!contracts.treasuryManager || !signer) { emit([{t:"err",msg:"Connect wallet and configure Treasury contract first"}]); break; }
        try {
          let receipt;
          if(token === "PROS") {
            const tx = await contracts.treasuryManager.deposit({ value: ethers.parseEther(amt.toString()) });
            receipt = await waitForTx(tx);
          } else {
            const tokenAddr = tokenAddresses[token];
            if(!tokenAddr) { emit([{t:"err",msg:`Missing token address for ${token}`}]); break; }
            const erc20 = createERC20Contract(tokenAddr, signer);
            const spender = contractAddress(contracts.treasuryManager);
            const decimals = Number(await erc20.decimals().catch(() => 18));
            const amountUnits = ethers.parseUnits(amt.toString(), decimals);
            const allowance = await erc20.allowance(account, spender);
            if(allowance < amountUnits) await waitForTx(await erc20.approve(spender, amountUnits));
            const tx = await contracts.treasuryManager.depositERC20(tokenAddr, amountUnits);
            receipt = await waitForTx(tx);
          }
          setTokenBalances(b=>({...b,[token]:(b[token]||0)+amt}));
          addLog({type:"deposit",text:`[CMD] On-chain tip: ${fmt(amt)} ${token} from ${shortAddr(account)} tx:${receipt.transactionHash}`});
          addNotif({type:"payment",msg:`Tip of ${fmt(amt)} ${token} received via command console`});
          emit([{t:"ok",msg:`Deposited ${fmt(amt)} ${token} to treasury. tx:${receipt.transactionHash}`}]);
        } catch(error) {
          console.error(error);
          emit([{t:"err",msg:"On-chain tip failed"}]);
        }
        break;

        setTokenBalances(b=>({...b,[token]:(b[token]||0)+amt}));

        addLog({type:"deposit",text:`[CMD] Tip: ${fmt(amt)} ${token} from 0xCmd…User`});

        addNotif({type:"payment",msg:`Tip of ${fmt(amt)} ${token} received via command console`});

        emit([{t:"ok",msg:`✓ Deposited ${fmt(amt)} ${token} to treasury`}]);

        break;

      }

      case "/list_bounties": {

        const st=args.trim()||"all";

        const list=st==="all"?bounties:bounties.filter(b=>b.status===st);

        if(list.length===0) { emit([{t:"info",msg:`No bounties with status: ${st}`}]); break; }

        emit(list.map(b=>({t:"info",msg:`#${b.id} [${b.status}][${b.category}] "${b.description.slice(0,50)}" — ${fmt(b.reward)} ${b.token} · ${daysLeft(b.deadline)}d left`})));

        break;

      }

      case "/list_agents":

        if(agents.length===0) { emit([{t:"info",msg:"No agents registered"}]); break; }

        emit(agents.map(a=>({t:a.active?"ok":"info",msg:`${a.active?"[ACTIVE]":"[INACTIVE]"} ${a.name} · ${shortAddr(a.address)} · limit:${a.dailyLimit} PROS · ${a.category}`})));

        break;

      case "/rules":

        emit([{t:"info",msg:"=== NUMERIC RULES ==="},...Object.entries(rules.numeric).map(([k,r])=>({t:"ok",msg:`${k} = ${r.value}`}))]);

        emit([{t:"info",msg:"=== BOOLEAN RULES ==="},...Object.entries(rules.bool).map(([k,r])=>({t:r.value?"ok":"info",msg:`${k} = ${r.value}`}))]);

        emit([{t:"info",msg:"=== STRING RULES ==="},...Object.entries(rules.string).map(([k,r])=>({t:"info",msg:`${k} = "${r.value}"`}))]);

        break;

      case "/status":

        emit([

          {t:"ok",  msg:`Agent: RUNNING (pid:1337) · version:${rules.string.AGENT_VERSION?.value}`},

          {t:"ok",  msg:`RPC: ${rules.string.PHAROS_RPC_URL?.value}`},

          {t:"ok",  msg:`PROS: ${fmt(tokenBalances.PROS)} | USDC-P: ${fmt(tokenBalances["USDC-P"])} | ETH-P: ${tokenBalances["ETH-P"]?.toFixed(4)}`},

          {t:rules.bool.EMERGENCY_PAUSE?.value?"err":"ok", msg:`Emergency pause: ${rules.bool.EMERGENCY_PAUSE?.value?"ACTIVE":"Inactive"}`},

          {t:"info",msg:`Marketing window: ${isMarketingWindow()?"OPEN":"CLOSED"} (UTC ${utcHour()}:xx)`},

          {t:"ok",  msg:`Gemini AI model: ${rules.string.GEMINI_MODEL?.value}`},

          {t:"ok",  msg:`Open bounties: ${bounties.filter(b=>b.status==="open").length} | Pending review: ${bounties.filter(b=>b.status==="submitted").length}`},

        ]);

        break;

      case "/pause":

        if(role!=="Owner") { emit([{t:"err",msg:"Permission denied — Owner role required"}]); break; }

        if(!contracts.ruleEngine || !contracts.treasuryManager || !signer) { emit([{t:"err",msg:"Connect wallet and configure RuleEngine/Treasury first"}]); break; }
        try {
          await waitForTx(await contracts.ruleEngine.setBoolRule(ethers.id("EMERGENCY_PAUSE"), true));
          await waitForTx(await contracts.treasuryManager.setEmergencyPause(true));
        } catch(error) {
          console.error(error);
          emit([{t:"err",msg:"On-chain pause failed"}]);
          break;
        }
        addLog({type:"warn",text:"[CMD] Emergency pause activated"});

        emit([{t:"err",msg:"⚠ Emergency pause activated — all payments halted"}]);

        toast("Emergency pause activated","error");

        break;

      case "/resume":

        if(role!=="Owner") { emit([{t:"err",msg:"Permission denied — Owner role required"}]); break; }

        if(!contracts.ruleEngine || !contracts.treasuryManager || !signer) { emit([{t:"err",msg:"Connect wallet and configure RuleEngine/Treasury first"}]); break; }
        try {
          await waitForTx(await contracts.ruleEngine.setBoolRule(ethers.id("EMERGENCY_PAUSE"), false));
          await waitForTx(await contracts.treasuryManager.setEmergencyPause(false));
        } catch(error) {
          console.error(error);
          emit([{t:"err",msg:"On-chain resume failed"}]);
          break;
        }
        addLog({type:"info",text:"[CMD] Emergency pause deactivated"});

        emit([{t:"ok",msg:"✓ Emergency pause deactivated — operations resumed"}]);

        toast("Operations resumed","success");

        break;

      case "/create_bounty": {

        if(role!=="Owner"&&role!=="Agent") { emit([{t:"err",msg:"Permission denied — Agent/Owner only"}]); break; }

        const match = args.match(/^"([^"]+)"\s+(\d+\.?\d*)\s+(\d+)$/);

        if(!match) { emit([{t:"err",msg:'Usage: /create_bounty "description" <amount> <days>'}]); break; }

        const [,d,r,dy] = match;

        const reward=parseFloat(r);

        if(reward>tokenBalances.PROS) { emit([{t:"err",msg:"Insufficient treasury balance"}]); break; }

        const nb={id:bounties.length+1,description:d,reward,token:"PROS",deadline:now()+86400000*parseInt(dy),status:"open",submissions:[],creator:shortAddr(WALLET_ADDR),bond:rules.numeric.SUBMISSION_BOND?.value||1,category:"bounty"};

        if(!contracts.bountyManager || !signer) { emit([{t:"err",msg:"Connect wallet and configure BountyManager first"}]); break; }
        try {
          const deadline = Math.floor(Date.now() / 1000) + parseInt(dy) * 86400;
          const tx = await contracts.bountyManager.createBounty(ethers.toUtf8Bytes(d), deadline, { value: ethers.parseEther(reward.toString()) });
          const receipt = await waitForTx(tx);
          setBounties(b=>[nb,...b]);
          setTokenBalances(tb=>({...tb,PROS:tb.PROS-reward}));
          addLog({type:"bounty",text:`[CMD] On-chain bounty created: "${d.slice(0,40)}" tx:${receipt.transactionHash}`});
          emit([{t:"ok",msg:`Bounty created on-chain. tx:${receipt.transactionHash}`}]);
        } catch(error) {
          console.error(error);
          emit([{t:"err",msg:"On-chain bounty creation failed"}]);
        }
        break;

        setBounties(b=>[nb,...b]);

        setTokenBalances(tb=>({...tb,PROS:tb.PROS-reward}));

        addLog({type:"bounty",text:`[CMD] Bounty #${nb.id} created: "${d.slice(0,40)}" — ${fmt(reward)} PROS`});

        emit([{t:"ok",msg:`✓ Bounty #${nb.id} created — "${d.slice(0,40)}" · ${fmt(reward)} PROS escrowed · deadline: ${parseInt(dy)} days`}]);

        break;

      }

      case "/submit_bounty": {

        const [id, ...proofParts] = args.split(" ");

        const proof = proofParts.join(" ");

        const bid=parseInt(id);

        const b=bounties.find(x=>x.id===bid);

        if(!b) { emit([{t:"err",msg:`Bounty #${id} not found`}]); break; }

        if(!proof) { emit([{t:"err",msg:"Usage: /submit_bounty <id> <proof>"}]); break; }
        if(!contracts.bountyManager || !signer) { emit([{t:"err",msg:"Connect wallet and configure BountyManager first"}]); break; }
        try {
          const tx = await contracts.bountyManager.submitWork(bid, ethers.toUtf8Bytes(proof), { value: ethers.parseEther((b.bond || 0).toString()) });
          const receipt = await waitForTx(tx);
          setBounties(bx=>bx.map(x=>x.id===bid?{...x,status:"submitted",submissions:[...x.submissions,{id:uid(),submitter:account,proof,time:tsMs(),bond:b.bond,aiScore:null}]}:x));
          addLog({type:"bounty",text:`[CMD] On-chain bounty #${bid} submission: ${proof} tx:${receipt.transactionHash}`});
          addNotif({type:"bounty",msg:`Bounty #${bid} has a new on-chain submission`});
          emit([{t:"ok",msg:`Work submitted on-chain for bounty #${bid}. tx:${receipt.transactionHash}`}]);
        } catch(error) {
          console.error(error);
          emit([{t:"err",msg:"On-chain bounty submission failed"}]);
        }
        break;

        if(b.status!=="open") { emit([{t:"err",msg:`Bounty #${id} is ${b.status} — cannot submit`}]); break; }

        setBounties(bx=>bx.map(x=>x.id===bid?{...x,status:"submitted",submissions:[...x.submissions,{id:uid(),submitter:"0xCmd…User",proof,time:tsMs(),bond:b.bond,aiScore:null}]}:x));

        addLog({type:"bounty",text:`[CMD] Bounty #${bid} submission: ${proof}`});

        addNotif({type:"bounty",msg:`Bounty #${bid} has a new submission via command console`});

        emit([{t:"ok",msg:`✓ Work submitted for bounty #${bid} — proof: ${proof}`}]);

        break;

      }

      default:

        emit([{t:"err",msg:`Unknown command: ${cmd}. Type /help for available commands.`}]);

    }

    setInput("");

  };



  const typeColors = { ok:"var(--green)", err:"var(--red)", info:"var(--cyan)", cmd:"var(--violet)" };



  return (

    <div className="g2" style={{alignItems:"start"}}>

      <div className="stack">

        <div className="cmd-console">

          <div className="cmd-header">agent-fundraiser / command console · {role} · Pharos Testnet</div>

          <div className="cmd-body">

            <div className="cmd-output" ref={outRef}>

              {output.map((o,i)=>(

                <div key={i} className="cmd-line" style={{color:typeColors[o.t]||"var(--text)"}}>{o.t==="cmd"?o.msg:`> ${o.msg}`}</div>

              ))}

            </div>

            <div className="cmd-input-row" style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:8,padding:"8px 12px"}}>

              <span className="cmd-prompt">$</span>

              <input className="cmd-input" placeholder="Type a command… (/help for list)" value={input} onChange={e=>setInput(e.target.value)}

                onKeyDown={e=>{if(e.key==="Enter")runCmd(input);}}/>

              <button className="btn bp bsm" onClick={()=>runCmd(input)}>Run</button>

            </div>

          </div>

        </div>



        {/* Quick actions */}

        <div className="card">

          <div className="ctitle"><span className="cdot" style={{background:"var(--teal)"}}/>Quick Actions</div>

          <div style={{display:"flex",flexDirection:"column",gap:6}}>

            {[

              {label:"/balance",                     cmd:"/balance"},

              {label:"/status",                      cmd:"/status"},

              {label:"/rules",                       cmd:"/rules"},

              {label:"/list_bounties open",          cmd:"/list_bounties open"},

              {label:"/list_agents",                 cmd:"/list_agents"},

              {label:'/tip 10 PROS',                 cmd:"/tip 10 PROS"},

              {label:'/create_bounty "Test task" 25 3', cmd:'/create_bounty "Test task" 25 3'},

            ].map(q=>(

              <button key={q.cmd} className="btn bgh" style={{justifyContent:"flex-start",fontFamily:"var(--mono)",fontSize:11}} onClick={()=>runCmd(q.cmd)}>{q.label}</button>

            ))}

          </div>

        </div>

      </div>



      {/* Command Reference */}

      <div className="card">

        <div className="ctitle"><span className="cdot" style={{background:"var(--violet)"}}/>Command Reference</div>

        <div className="cmd-ref">

          {CMD_DOCS.map(c=>(

            <div key={c.cmd} className="cmd-row" style={{cursor:"pointer"}} onClick={()=>setInput(c.cmd+(c.args?` ${c.args}`:""))}>

              <span className="cmd-name">{c.cmd} <span style={{color:"var(--muted)",fontSize:10}}>{c.args}</span></span>

              <span className="cmd-desc">{c.desc}</span>

            </div>

          ))}

        </div>

        <div style={{marginTop:12,padding:"8px 11px",background:"var(--surface)",borderRadius:8,fontSize:11,fontFamily:"var(--mono)",color:"var(--muted)"}}>

          Click any command row to pre-fill it in the console. Press Enter or click Run to execute.

        </div>

      </div>

    </div>

  );

}



// ─────────────────────────────────────────────────────────────────────────────

// ROOT APP

// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab,           setTab]           = useState("overview");
  const [role,          setRole]          = useState("Disconnected");
  const [connected,     setConnected]     = useState(false);
  const [account,       setAccount]       = useState("");
  const [provider,      setProvider]      = useState(null);
  const [signer,        setSigner]        = useState(null);
  const [contracts,     setContracts]     = useState({});
  const [chainReady,    setChainReady]    = useState(isChainReady());
  const [onChainLive,   setOnChainLive]   = useState(false);
  const [tokenBalances, setTokenBalances] = useState({PROS:0,"USDC-P":0,"ETH-P":0});
  const [bounties,      setBounties]      = useState([]);
  const [agents,        setAgents]        = useState([]);
  const [payments,      setPayments]      = useState([]);
  const [scheduled,     setScheduled]     = useState([]);
  const [txns,          setTxns]          = useState([]);
  const [rules,         setRules]         = useState({ numeric:{}, bool:{}, string:{} });
  const [logs,          setLogs]          = useState([{ id:"startup", type:"info", text:"Connect a wallet to load live Pharos contract state.", time:now() }]);
  const [msQueue,       setMsQueue]       = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [toasts,        setToasts]        = useState([]);



  const addLog = useCallback((entry) => setLogs(l=>[...l,{id:uid(),time:now(),...entry}]), []);

  const addNotif = useCallback((entry) => setNotifications(n=>[{id:uid(),time:now(),read:false,...entry},...n]), []);

  const toast = useCallback((msg,type="info") => {

    const id=uid();

    setToasts(t=>[...t,{id,msg,type}]);

    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),3600);

  },[]);

  const syncOnChainState = useCallback(async (chainContracts = contracts, currentAccount = account) => {
    if (!chainContracts || Object.keys(chainContracts).length === 0) return;

    try {
      const [ruleSet, treasuryBalance, chainBounties, chainAgents, chainPayments, treasuryRequests, accessProfile] = await Promise.all([
        chainContracts.ruleEngine ? fetchRuleSet(chainContracts.ruleEngine) : null,
        chainContracts.treasuryManager ? fetchTreasuryBalance(chainContracts.treasuryManager) : null,
        chainContracts.bountyManager ? fetchBounties(chainContracts.bountyManager) : null,
        chainContracts.agentPaymentRouter ? fetchAgents(chainContracts.agentPaymentRouter) : null,
        chainContracts.agentPaymentRouter ? fetchPayments(chainContracts.agentPaymentRouter) : null,
        chainContracts.treasuryManager ? fetchTreasuryRequests(chainContracts.treasuryManager) : null,
        fetchAccessProfile(chainContracts, currentAccount)
      ]);

      if (ruleSet) setRules(ruleSet);
      if (treasuryBalance) setTokenBalances((b) => ({ ...b, ...treasuryBalance }));
      if (chainBounties) setBounties(chainBounties);
      if (chainAgents) setAgents(chainAgents);
      if (chainPayments) setPayments(chainPayments);
      if (treasuryRequests) setMsQueue(treasuryRequests);
      if (accessProfile?.role) setRole(accessProfile.role);

      setOnChainLive(Boolean(ruleSet || treasuryBalance || chainBounties || chainAgents || chainPayments));
      addLog({ type: "info", text: "On-chain dashboard state synchronized." });
    } catch (error) {
      console.error(error);
      toast("Failed to synchronize on-chain state", "error");
    }
  }, [contracts, account, addLog, toast]);



  const disconnectWallet = () => {
    setConnected(false);
    setAccount("");
    setRole("Disconnected");
    setSigner(null);
    setProvider(null);
    setContracts({});
    setOnChainLive(false);
    toast("Wallet disconnected", "info");
  };

  const connectWallet = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      toast("No Ethereum wallet detected", "error");
      return;
    }

    try {
      await switchToPharos(window.ethereum);
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      await browserProvider.send("eth_requestAccounts", []);
      const signer = await browserProvider.getSigner();
      const address = await signer.getAddress();
      const chainContracts = createContracts(signer);

      setProvider(browserProvider);
      setSigner(signer);
      setAccount(address);
      setConnected(true);
      setContracts(chainContracts);
      setChainReady(isChainReady());
      toast(`Connected ${shortAddr(address)}`, "success");

      await syncOnChainState(chainContracts, address);
    } catch (error) {
      console.error(error);
      toast("Wallet connection failed", "error");
    }
  };


  useEffect(() => {

    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = (accounts) => {

      if (accounts.length === 0) {

        disconnectWallet();

      } else {

        setAccount(accounts[0]);
        if (contracts && Object.keys(contracts).length) syncOnChainState(contracts, accounts[0]);

      }

    };

    const handleChainChanged = () => {
      toast("Network changed; refreshing contract state", "info");
      if (contracts && Object.keys(contracts).length) syncOnChainState(contracts);
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };

  }, [contracts, syncOnChainState, toast]);

  useEffect(() => {
    if (!contracts || Object.keys(contracts).length === 0) return;
    const refresh = () => syncOnChainState(contracts);
    const listeners = [
      [contracts.treasuryManager, "Deposited"],
      [contracts.treasuryManager, "Withdrawn"],
      [contracts.treasuryManager, "WithdrawalRequestSubmitted"],
      [contracts.treasuryManager, "WithdrawalRequestApproved"],
      [contracts.treasuryManager, "WithdrawalRequestExecuted"],
      [contracts.bountyManager, "BountyCreated"],
      [contracts.bountyManager, "WorkSubmitted"],
      [contracts.bountyManager, "BountyApproved"],
      [contracts.bountyManager, "BountyRejected"],
      [contracts.agentPaymentRouter, "AgentRegistered"],
      [contracts.agentPaymentRouter, "AgentStatusUpdated"],
      [contracts.agentPaymentRouter, "AgentPayment"],
      [contracts.agentPaymentRouter, "PaymentQueued"],
      [contracts.ruleEngine, "NumericRuleUpdated"],
      [contracts.ruleEngine, "BoolRuleUpdated"],
      [contracts.ruleEngine, "StringRuleUpdated"]
    ].filter(([contract]) => contract?.on);

    listeners.forEach(([contract, eventName]) => contract.on(eventName, refresh));
    return () => listeners.forEach(([contract, eventName]) => contract.off(eventName, refresh));
  }, [contracts, syncOnChainState]);



  // Auto-scroll terminal

  useEffect(()=>{ const el=document.getElementById("term-body"); if(el) el.scrollTop=el.scrollHeight; },[logs,tab]);



  const pendingMS     = msQueue.filter(m=>m.status==="pending").length;

  const pendingBounty = bounties.filter(b=>b.status==="submitted").length;

  const unreadNotif   = notifications.filter(n=>!n.read).length;

  const paused        = rules.bool.EMERGENCY_PAUSE?.value;



  const TABS = [

    {id:"overview", label:"Overview",    icon:"📊"},

    {id:"treasury", label:"Treasury",    icon:"🏦"},

    {id:"bounties", label:"Bounties",    icon:"🎯", badge:pendingBounty},

    {id:"payments", label:"Payments",    icon:"⚡"},

    {id:"rules",    label:"Rule Engine", icon:"🛡"},

    {id:"admin",    label:"Admin",       icon:"⚙",  badge:pendingMS},

    {id:"audit",    label:"Audit Log",   icon:"📋"},

    {id:"commands", label:"Commands",    icon:"💻"},

  ];



  const sharedProps = { role, addLog, addNotif, toast, contracts, signer, account };



  return (

    <>

      <style>{STYLES}</style>

      <div className="app">

        {/* ── Header ── */}

        <header className="header">

          <div className="logo">

            <div className="logo-mark">AF</div>

            <div>

              <div className="logo-text">Agent Fundraiser</div>

              <div className="logo-sub">Pharos Skill-to-Agent Hackathon</div>

            </div>

          </div>



          <div className="hdr-right">

            <div className="role-wrap">

              <span className="role-lbl">Authenticated Role:</span>

              <span className={`role-sel role-${role}`}>{role}</span>

            </div>



            <div className="net-badge">

              <div className="dot-live" style={{background:paused?"var(--red)":"var(--green)"}}/>

              Pharos Testnet

            </div>



            <NotificationBell notifications={notifications} setNotifications={setNotifications}/>



            <button className={`btn-wallet${connected?" conn":""}${paused?" paused":""}`}

              onClick={()=>connected?disconnectWallet():connectWallet()}>

              {connected?shortAddr(account):"Connect Wallet"}

            </button>

          </div>

        </header>



        {/* ── Stats Bar ── */}

        <div className="stats-bar">

          <div className="stat-cell"><span className="stat-lbl">PROS Balance</span><span className="stat-val cv">{fmt(tokenBalances.PROS)}</span><span className="stat-sub">PROS</span></div>

          <div className="stat-cell"><span className="stat-lbl">USDC-P Balance</span><span className="stat-val bv">{fmt(tokenBalances["USDC-P"])}</span><span className="stat-sub">USDC-P</span></div>

          <div className="stat-cell"><span className="stat-lbl">Open Bounties</span><span className="stat-val av">{bounties.filter(b=>b.status==="open").length}</span><span className="stat-sub">{pendingBounty} pending review</span></div>

          <div className="stat-cell"><span className="stat-lbl">Active Agents</span><span className="stat-val vv">{agents.filter(a=>a.active).length}</span><span className="stat-sub">{agents.length} registered</span></div>

          <div className="stat-cell"><span className="stat-lbl">Multi-sig Queue</span><span className={`stat-val ${pendingMS>0?"av":"gv"}`}>{pendingMS}</span><span className="stat-sub">pending approval</span></div>

          <div className="stat-cell"><span className="stat-lbl">Agent Status</span><span className={`stat-val ${paused?"rv":"gv"}`}>{paused?"PAUSED":"LIVE"}</span><span className="stat-sub">{rules.string.AGENT_VERSION?.value}</span></div>

        </div>



        {/* ── Tabs + Content ── */}

        <main className="main">

          <div className="tabs">

            {TABS.map(t=>(

              <button key={t.id} className={`tab-btn${tab===t.id?" act":""}`} onClick={()=>setTab(t.id)}>

                {t.icon} {t.label}

                {t.badge>0&&<span className="tab-badge">{t.badge}</span>}

              </button>

            ))}

          </div>



          {tab==="overview"&&<OverviewTab tokenBalances={tokenBalances} bounties={bounties} payments={payments} txns={txns} logs={logs} multisigQueue={msQueue} agents={agents} rules={rules}/>}

          {tab==="treasury"&&<TreasuryTab tokenBalances={tokenBalances} setTokenBalances={setTokenBalances} txns={txns} setTxns={setTxns} rules={rules} setRules={setRules} {...sharedProps}/>}

          {tab==="bounties"&&<BountiesTab bounties={bounties} setBounties={setBounties} tokenBalances={tokenBalances} setTokenBalances={setTokenBalances} rules={rules} {...sharedProps}/>}

          {tab==="payments"&&<PaymentsTab agents={agents} setAgents={setAgents} payments={payments} setPayments={setPayments} scheduled={scheduled} setScheduled={setScheduled} tokenBalances={tokenBalances} setTokenBalances={setTokenBalances} rules={rules} {...sharedProps}/>}

          {tab==="rules"   &&<RulesTab rules={rules} setRules={setRules} {...sharedProps}/>}

          {tab==="admin"   &&(role==="Owner"
            ? <AdminTab multisigQueue={msQueue} setMultisigQueue={setMsQueue} rules={rules} setRules={setRules} agents={agents} bounties={bounties} tokenBalances={tokenBalances} {...sharedProps}/>
            : <AccessDenied role={role}/>)}

          {tab==="audit"   &&<AuditTab logs={logs}/>}

          {tab==="commands"&&<CommandsTab tokenBalances={tokenBalances} bounties={bounties} agents={agents} rules={rules} payments={payments} setBounties={setBounties} setTokenBalances={setTokenBalances} {...sharedProps}/>}

        </main>



        <Toasts toasts={toasts}/>

      </div>

    </>

  );

}

