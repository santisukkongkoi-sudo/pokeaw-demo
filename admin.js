/* หน้าหลังร้าน Betagro Shop โพธิ์แก้ว v3 — โหลดเฉพาะพนักงาน (ลูกค้าไม่ต้องดาวน์โหลดไฟล์นี้)
 * แจ้งออเดอร์ใหม่อัตโนมัติ, ตัวกรองวันที่, ดาวน์โหลด Excel, ตรวจยอดโอน, จัดรอบส่ง, จัดการทีม
 * v3.0.0: โปร Smart/Magnet, สต็อก SAP (F1595/F1077), แต้มผู้แนะนำ, ช่องทาง QR, KPI, พื้นที่จัดส่ง, รีเซ็ตข้อมูล UAT
 * v3.1.0: เมนูซ้าย + โหมดมืด/สว่าง, เปิดบิลขั้นตอนเดียว, ระบบแนะนำการออกรถ (ส่งภายใน 1 ชม. รถ 2 คัน ไม่ใส่เลขไมล์),
 *         ค้นหาราคา/สต๊อก, แท็บโปรโมชั่น (Smart / Magnet), คำขอผูกบัญชีลูกค้าเดิม, ตั้งเวลาทำการ, กดแล้วตอบสนองทันที
 * v3.1.5: ปิดข้อสังเกต UAT ระบบจริง 3.1.4 (ช่องอัปโหลด F1077, ตารางหยุดขาย, ช่องมีของ, คำเตือนออกรถ, ช่องทาง QR, ลบข้อมูลส่วนบุคคล)
 * v3.1.4: KPI ลูกค้าเดิมนับเฉพาะลูกค้าเดิม, บอกจำนวนออเดอร์ที่แก้หมุด, แจ้งลูกค้าเมื่อตรวจไม่พบยอด, บรอดแคสต์นับโควตาเฉพาะคนจริง, ข้อความออกรถบิลหนัก, คำเตือนบนปุ่มออกรถ 8 วินาที
 * v3.1.3: เครื่องมือ UAT บนระบบจริงในแท็บเครื่องมือ (ลูกค้าทดสอบ นาฬิกาจำลอง รันงานแบบทดสอบ โควตาจำลอง แชตจำลอง ล้างข้อมูลทดสอบ)
 */
(function () {
  'use strict';
  var C = window.PKCore, S = C.S, api = C.api, run = C.run, render = C.render, top = C.top, icon = C.icon, esc = C.esc, fmt = C.fmt, baht = C.baht, toast = C.toast;
  var ICON_X = { bell: '<path d="M6 16V11a6 6 0 0112 0v5l2 2H4l2-2zM10 20a2 2 0 004 0"/>', mute: '<path d="M6 16V11a6 6 0 0112 0v5l2 2H4l2-2zM10 20a2 2 0 004 0M3 3l18 18"/>',
    dl: '<path d="M12 3v12m-5-5l5 5 5-5M4 21h16"/>', map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>', print: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0114 0M16 4a3.5 3.5 0 010 7M22 20a6 6 0 00-5-6"/>', chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>', img: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-6-6-9 9"/>',
    tag: '<path d="M3 12V4a1 1 0 011-1h8l9 9-9 9-9-9z"/><circle cx="8" cy="8" r="1.5"/>', pct: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4V7zM3 7l9 4 9-4M12 11v10"/>', mega: '<path d="M3 10v4h4l6 4V6L7 10H3zM17 9a4 4 0 010 6M19.5 6.5a8 8 0 010 11"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>' };
  function ic(n) { return ICON_X[n] ? '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON_X[n] + '</svg>' : icon(n); }
  function today() { return C.todayStr(); }
  function addDays(d, n) { return new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10); }
  var A = { tab: C.store('pk2_tab') || 'orders', d: {}, at: {}, from: '', to: '', routeDate: '', rev: 0, counts: null, alert: 0, lastLatest: '', sound: C.store('pk2_sound') !== false, riderOf: {}, kmOf: {}, bikeOf: {},
    q: '', payFilter: 'todo', timer: null, audio: null, inviteRes: null, open: {}, sel: {}, slips: {}, selfTest: null, jobRes: null,
    pick: {}, dupTxn: {}, locked: false, lastAct: Date.now(), imp: null, speed: null };
  A.from = A.to = A.routeDate = today();

  var TABS = [['orders', 'ออเดอร์', 'view', 'bill'], ['pay', 'ชำระเงิน', 'view', 'wallet'], ['route', 'จัดรอบส่ง', 'route', 'truck'], ['members', 'สมาชิก', 'view', 'users'], ['aff', 'ชวนเพื่อน & ป้าย', 'view', 'share'],
    ['price', 'ราคา & สต๊อก', 'view', 'tag'], ['promo', 'โปรโมชั่น', 'view', 'pct'], ['stock', 'สต๊อก', 'view', 'box'], ['report', 'รายงาน', 'view', 'chart'], ['bc', 'บรอดแคสต์', 'manage', 'mega'], ['team', 'ทีมงาน', 'manage', 'users'], ['tools', 'เครื่องมือ', 'manage', 'gear']];
  /* ทดสอบบทบาท (ผู้จัดการ + TEST_MODE): หน้าจอและสิทธิ์เหมือนบทบาทที่เลือก — หลังบ้านลดสิทธิ์ให้จริงด้วย */
  var ROLE_AS = { cashier: ['พนักงานร้าน', ['view', 'orders', 'pay', 'members', 'route', 'stock', 'export', 'pii']], driver: ['พนักงานส่งของ', ['route', 'pii']], viewer: ['ดูอย่างเดียว', ['view', 'export']] };
  function staffNow() {
    var st = S.me.staff || {};
    if (S.asRole && st.role === 'manager' && ROLE_AS[S.asRole] && S.cat && S.cat.cfg.TEST_MODE) return { role: S.asRole, label: ROLE_AS[S.asRole][0], perms: ROLE_AS[S.asRole][1], name: st.name, viewAs: true };
    if (S.asRole && st.role !== 'manager') S.asRole = '';
    return st;
  }
  function can(perm) { var p = staffNow().perms || []; return p.indexOf('*') >= 0 || (perm !== 'manage' && p.indexOf(perm) >= 0); }
  /* เลือก / เลือกทั้งหมด → ทำหลายรายการพร้อมกัน */
  function picked(g) { var m = A.pick[g] || {}; return Object.keys(m).filter(function (k) { return m[k]; }); }
  function pickBox(g, id, label) { return '<input type="checkbox" class="pick" data-chg="admPick" data-g="' + g + '" data-id="' + esc(id) + '"' + ((A.pick[g] || {})[id] ? ' checked' : '') + ' aria-label="เลือก ' + esc(label || id) + '">'; }
  function pickAll(g, ids, text) {
    if (!ids.length) return '';
    var on = ids.every(function (id) { return (A.pick[g] || {})[id]; });
    return '<label class="pick-all"><input type="checkbox" data-chg="admPickAll" data-g="' + g + '" data-ids="' + esc(ids.join(',')) + '"' + (on ? ' checked' : '') + '><span>' + (text || 'เลือกทั้งหมด') + ' (' + ids.length + ')</span></label>';
  }
  function bulkBar(g, acts) {
    var n = picked(g).length; if (!n) return '';
    return '<div class="bulk-bar" role="region" aria-label="ทำรายการที่เลือก"><b>เลือก ' + n + ' รายการ</b>' + acts.filter(Boolean).join('') + '<button class="btn sm" data-a="admPickClear" data-g="' + g + '">ล้างที่เลือก</button></div>';
  }
  function bulkBtn(g, op, label, count, extra) { return count ? '<button class="btn sm' + (extra && extra.cls ? ' ' + extra.cls : ' blue') + '" data-a="admBulk" data-g="' + g + '" data-op="' + op + '"' + (extra && extra.confirm ? ' data-confirm="1"' : '') + (extra && extra.p ? ' data-p="' + esc(extra.p) + '"' : '') + '>' + label + ' (' + count + ')</button>' : ''; }
  function tabs() { return TABS.filter(function (t) { return can(t[2]) || (t[0] === 'route' && can('route')); }); }
  var RANGE_TABS = { orders: 1, pay: 1, report: 1, promo: 1 };

  /* ---------- โหลดข้อมูลแท็บ (แสดงของเดิมทันที แล้วอัปเดตเบื้องหลัง) ---------- */
  function key(tab) { return tab + '|' + (RANGE_TABS[tab] ? A.from + '|' + A.to : '') + (tab === 'route' ? '|' + A.routeDate : ''); }
  function load(tab, quiet) {
    var k = key(tab);
    return api('adminData', { tab: tab, from: A.from, to: A.to, date: A.routeDate }, { quiet: quiet }).then(function (r) {
      A.d[k] = r; A.at[k] = Date.now(); A.rev = r.rev; noteCounts(r.counts, true);
      if (S.page === 'admin' && A.tab === tab && key(tab) === k) { if (!formFocus()) draw(); else A.dirty = true; } // 3.1.5 กำลังพิมพ์อยู่: วาดใหม่เมื่อออกจากช่อง
      return r;
    });
  }
  function formFocus() { var a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox' && a.type !== 'file' && a.type !== 'date'); }
  function show() {
    if (A.locked) return;
    var allowed = tabs(); if (!allowed.length) { render(C.adminFrame({ title: 'หน้าหลังร้าน', nav: [], body: '<div class="alert bad">บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งานแท็บใด</div>' })); return; }
    if (!allowed.some(function (t) { return t[0] === A.tab; })) A.tab = allowed[0][0];
    var k = key(A.tab);
    startPoll(); unlockAudio();
    if (A.d[k]) { draw(); if (Date.now() - (A.at[k] || 0) > 15000) load(A.tab, true).catch(function () { }); return; }
    render(shell('<div class="empty">กำลังโหลด...</div>'));
    load(A.tab).catch(C.fail);
  }
  function refresh() { A.d = {}; A.at = {}; show(); }

  /* ---------- โครงหน้า: เมนูซ้าย (ชื่อร้าน ผู้ใช้ แท็บ) + ปุ่มมุมขวา (แจ้งเตือน โหลดใหม่ ออกจากระบบ หน้าแรก) ---------- */
  function tabTitle(t) { return (TABS.filter(function (x) { return x[0] === t; })[0] || [0, 'หน้าหลังร้าน'])[1]; }
  function shell(inner) {
    var st = staffNow(), cn = A.counts || {};
    var badge = { orders: cn.toBill || cn.newOrders, pay: cn.payReview, route: cn.deliveries, members: (cn.pendingMembers || 0) || '', aff: (cn.coinsPending || 0) + (cn.pointsReview || 0), stock: cn.stockAlert ? '!' : cn.stockLow };
    var banner = '';
    var sim = S.uat && S.uat.sim; // 3.1.3 นาฬิกาจำลอง (เฉพาะผู้จัดการที่ตั้ง)
    if (sim) banner += '<div class="view-as uat-sim">' + icon('clock') + '<span>นาฬิกาจำลอง <b class="num">' + esc(C.thDate(sim.now.slice(0, 10)) + ' ' + sim.now.slice(11, 16)) + '</b> (เวลาจริง ' + esc(sim.real) + ') ทุกอย่างที่คุณทำตอนนี้ใช้เวลานี้ ปิดเอง ' + esc(sim.until) + '</span><button class="btn sm" data-a="admUat" data-op="clockOff">ปิดนาฬิกาจำลอง</button></div>';
    if (st.viewAs) banner += '<div class="view-as">' + ic('users') + '<span>กำลังทดสอบเป็น <b>' + esc(st.label) + '</b> เห็นแท็บและทำได้เท่าบทบาทนี้</span><button class="btn sm" data-a="admAsRole" data-p="">กลับเป็นผู้จัดการ</button></div>';
    if (A.alert > 0) banner += '<button class="new-banner" data-a="admBanner">' + ic('bell') + '<b>ออเดอร์ใหม่ ' + A.alert + ' รายการ</b><span>แตะเพื่อดู</span></button>';
    var ov = '';
    if (/^(orders|pay|route|members)$/.test(A.tab) && can('view')) ov = '<div class="admin-overview">' + [['orders', 'รอเปิดบิล', cn.toBill !== undefined ? cn.toBill : (cn.newOrders || 0) + (cn.approved || 0)], ['pay', 'รอตรวจยอดโอน', cn.payReview], ['route', 'รอส่ง', cn.deliveries], ['members', 'สมาชิกรอตรวจ', cn.pendingMembers]]
      .map(function (x) { return '<button class="stat-card' + (A.tab === x[0] ? ' on' : '') + '" data-a="tab" data-p="' + x[0] + '"><span>' + x[1] + '</span><strong>' + (A.counts ? (x[2] || 0) : '<span class="sk-num" aria-label="กำลังโหลด">–</span>') + '</strong></button>'; }).join('') + '</div>';
    return C.adminFrame({ title: tabTitle(A.tab), tools: C.adminTools({ sound: A.sound }), banner: banner, body: ov + inner,
      nav: tabs().map(function (x) { return { id: x[0], label: x[1], icon: ic(x[3]), badge: badge[x[0]] || '', on: A.tab === x[0] }; }) });
  }
  function draw() {
    var d = A.d[key(A.tab)]; if (!d) return show();
    A.dirty = false;
    var cfg = d.cfg || {}, CFG = window.APP_CONFIG || {};
    var warn = cfg.LIFF_ID && cfg.LIFF_ID !== CFG.LIFF_ID ? '<div class="alert bad">LIFF_ID ในชีต Config (' + esc(cfg.LIFF_ID) + ') ไม่ตรงกับ config.js (' + esc(CFG.LIFF_ID) + ') ปุ่มในการ์ดแชตและลิงก์ชวนจะเปิดไม่ได้ ให้แก้ให้ตรงกัน</div>' : '';
    var body = ({ orders: adOrders, pay: adPay, route: adRoute, members: adMembers, aff: adAff, price: adPrice, promo: adPromo, stock: adStock, report: adReport, bc: adBc, team: adTeam, tools: adTools }[A.tab] || adOrders)(d);
    render(shell(warn + (can('manage') ? readyWarn(d) : '') + body));
    document.title = (A.alert ? '(' + A.alert + ') ออเดอร์ใหม่ - ' : '') + 'หลังร้าน - ' + tabTitle(A.tab);
  }
  function rangeBar(kinds) {
    var t = today(), m0 = t.slice(0, 8) + '01', pm = new Date(Date.parse(m0 + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10), pm0 = pm.slice(0, 8) + '01';
    var presets = [['วันนี้', t, t], ['7 วัน', addDays(t, -6), t], ['เดือนนี้', m0, t], ['เดือนก่อน', pm0, pm]];
    return '<div class="date-bar"><div class="chips">' + presets.map(function (p) { return '<button class="chip' + (A.from === p[1] && A.to === p[2] ? ' on' : '') + '" data-a="admRange" data-f="' + p[1] + '" data-t="' + p[2] + '">' + p[0] + '</button>'; }).join('') + '</div>' +
      '<div class="date-fields"><label>จาก <input type="date" data-chg="admFrom" value="' + A.from + '" max="' + t + '"></label><label>ถึง <input type="date" data-chg="admTo" value="' + A.to + '" max="' + t + '"></label></div>' +
      (kinds && kinds.length && can('export') ? '<div class="dl-row">' + kinds.map(function (k) { return '<button class="btn sm" data-a="admExport" data-k="' + k[0] + '">' + ic('dl') + ' ' + k[1] + ' .xlsx</button>'; }).join('') + '</div>' : '') + '</div>';
  }
  function searchBox(ph) { return '<label class="search-box adm-search">' + icon('search') + '<input type="search" id="adm-search" placeholder="' + esc(ph) + '" value="' + esc(A.q) + '" autocomplete="off"></label>'; }
  function hit(o, fields) { if (!A.q) return true; var q = A.q.toLowerCase(); return fields.some(function (f) { return String(o[f] || '').toLowerCase().indexOf(q) >= 0; }); }
  var statusPill = C.statusPill;
  function payPill(p) { if (!p) return ''; return { review: '<span class="pill appr">รอตรวจยอดโอน</span>', partial: '<span class="pill new">ยังขาด ' + baht(p.balance) + '</span>', unpaid: '<span class="pill bill">ยังไม่โอน</span>', over: '<span class="pill paid">โอนเกิน ' + baht(p.over) + '</span>', paid: '<span class="pill paid">ครบ</span>' }[p.status] || ''; }
  function tel(p) { return p ? '<a class="mono" href="tel:' + esc(p) + '">' + esc(p) + '</a>' : ''; }

  /* ---------- ออเดอร์ ---------- */
  function posLines(o, cfg) {
    var out = [];
    if (o.promoDisc > 0) {
      var det = (o.items || []).filter(function (l) { return l.promoDisc > 0; }).map(function (l) { return l.name.replace(/\s*\(ตัวอย่าง\)/, '') + (o.promo === 'SMART' && l.promoQty ? ' ' + l.promoQty + ' ชิ้น' : '') + ' −' + fmt(l.promoDisc); });
      out.push((o.promo === 'MAGNET' ? 'Magnet Set (สิทธิ์ลูกค้าใหม่ ลด ' + cfg.MAGNET_DISCOUNT + '%)' : 'Smart Set ลด ' + cfg.SMART_DISCOUNT + '% ' + o.smartUsed + ' ชิ้น') + ': ส่วนลดท้ายบิล ' + baht(o.promoDisc) + (det.length ? ' (' + det.join(', ') + ')' : ''));
    }
    if (o.pointsDisc > 0) out.push('ส่วนลดแต้มสะสม ' + baht(o.pointsDisc) + ' (ใช้ ' + fmt(o.pointsUse) + ' แต้ม)');
    if (o.coupon > 0) out.push(cfg.POS_MODE === 'freebie' ? 'ของแถมแทนคูปอง มูลค่า ' + baht(o.coupon) + ' (คีย์ 0 บาท)' : 'ส่วนลดท้ายบิล ' + baht(o.coupon) + ' (คูปองลูกค้าใหม่)');
    if (o.coinUse > 0) out.push(cfg.POS_MODE === 'freebie' ? 'แลก Coin เป็นสินค้ามูลค่า ' + baht(o.coinUse * cfg.COIN_VALUE) : 'ส่วนลด Coin ' + baht(o.coinUse * cfg.COIN_VALUE));
    o.bundles.forEach(function (b) { out.push(b.name + ' ×' + b.qty + ': คีย์รายการตามเซ็ต แล้วลดให้เหลือ ' + baht(b.price * b.qty)); });
    return out.length ? out : ['ไม่มีส่วนลด คีย์ตามรายการ'];
  }
  function evPill(o) {
    if (!o.evening) return '';
    var p = o.pay || {}, paid = o.status === 'paid' || (p.confirmed || 0) + 1 >= (p.due || 0);
    return '<span class="pill ' + (paid ? 'paid' : (p.pending ? 'appr' : 'red')) + '">รอบเย็น ' + esc(C.evDayText(o.deliverDate)) + ' · ' + (paid ? 'จ่ายก่อนแล้ว ✓' : p.pending ? 'แจ้งโอน รอตรวจ' : 'ยังไม่จ่าย (ก่อน ' + esc(String(o.payBy || '').slice(11, 16)) + ')') + '</span>';
  }
  /* v3.1.0 ออเดอร์: ไม่มีขั้น "รอตรวจ" แล้ว ใส่เลขบิลได้ทันที · ปัญหาขึ้นเป็นแถบแดง · เรียงตามเวลาที่ต้องส่ง */
  function dueKey(o) { return String(o.dueAt || o.promiseAt || '9999') + String(o.created || ''); }
  function whenLine(o) {
    var p = String(o.promiseAt || ''), due = String(o.dueAt || ''), dd = (due || p).slice(0, 10), day = dd && dd !== today() ? ' ' + C.thDate(dd) : '';
    if (o.mode === 'pickup') return 'รับที่จุด ' + esc(o.pickup);
    if (o.mode === 'shop') return 'ลูกค้ารับเองที่ร้าน' + (p ? ' มารับ ' + esc(p.slice(11, 16)) + ' น.' + day : '');
    if (o.slot === 'เที่ยวแรก' && due) return '<b>เที่ยวแรก' + (day || ' วันนี้') + ' ถึงก่อน ' + esc(due.slice(11, 16)) + ' น.</b>';
    if (due) return '<b>ต้องถึงลูกค้าภายใน ' + esc(due.slice(11, 16)) + ' น.</b>' + day + (p && p !== due ? ' <span class="hint">(แจ้งลูกค้า ' + esc(p.slice(11, 16)) + ')</span>' : '');
    return 'ส่ง ' + esc(o.slot) + (o.deliverDate && o.deliverDate !== today() ? ' ' + C.thDate(o.deliverDate) : '');
  }
  function orderProblems(o) {
    var p = [];
    if (!o.memberApproved) p.push('สมาชิกใหม่ยังไม่ได้อนุมัติ ตรวจในแท็บสมาชิก');
    if (o.linkPending) p.push('ลูกค้าขอผูกบัญชีเดิม รอร้านยืนยัน (บิลนี้ยังไม่ใช้สิทธิ์และเครดิตเดิม)');
    if (o.memberStatus === 'review') p.push('ลูกค้ารอตรวจ อาจเป็นลูกค้าเดิม');
    if (o.stockWarn && o.stockWarn.length) p.push('สต๊อกไม่พอ: ' + o.stockWarn.join(', '));
    if (o.ship && o.ship.area === 'grace') p.push('หมุดเดิม (ช่วงผ่อนผัน) ตรวจที่อยู่ก่อนส่ง');
    return p;
  }
  function orderCard(o, d, list) {
    var other = (o.mode || 'deliver') !== 'deliver' ? null : list.filter(function (x) { return x !== o && x.memberId === o.memberId && (x.mode || 'deliver') === 'deliver' && (x.status === 'new' || x.status === 'approved'); })[0] /* 3.1.2: เฉพาะส่งถึงที่ทั้งคู่ */, open = /new|approved/.test(o.status), probs = orderProblems(o);
    var h = '<article class="ord' + (probs.length ? ' has-problem' : '') + ((A.pick.ord || {})[o.id] ? ' picked' : '') + '" id="o-' + esc(o.id) + '"><div class="ord-h">' + (/new|approved|billed/.test(o.status) ? pickBox('ord', o.id, o.id + ' ' + o.memberName) : '') + '<b class="mono">' + esc(o.id) + '</b><span class="hint">' + esc(o.created) + '</span><span class="pill">' + esc(o.src) + '</span>' +
      (o.memberStatus === 'new' ? '<span class="pill paid">ลูกค้าใหม่</span>' : '') + (o.preOrder ? '<span class="pill bill">สั่งตอนร้านปิด</span>' : '') + (o.promo ? '<span class="pill appr">' + (o.promo === 'MAGNET' ? 'Magnet' : 'Smart Set') + '</span>' : '') + (o.attName ? '<span class="pill">' + esc((o.attKind === 'ref' ? 'ผู้ชวน ' : 'ป้าย ') + o.attName) + '</span>' : '') +
      '<span class="grow"></span>' + (open ? '<span class="pill new">รอเปิดบิล</span>' : statusPill(o.status)) + '</div>' +
      '<div class="ord-who"><b>' + esc(o.memberName) + '</b> <span class="mono hint">' + esc(o.sno || 'ยังไม่มีเลข S') + '</span> ' + tel(o.phone) + '</div>' +
      '<div class="ord-when">' + whenLine(o) + '<span class="hint">~' + o.kg + ' กก.</span>' + (o.zone ? '<span class="hint">โซน ' + esc(C.zoneName(o.zone)) + '</span>' : '') + '</div>' +
      (probs.length ? '<div class="alert bad problem">' + icon('alert') + '<span>' + probs.map(esc).join('<br>') + '</span></div>' : '') +
      o.bundles.map(function (l) { return '<div class="row"><span>' + esc(l.name) + ' ×' + l.qty + ' (เซ็ต)</span><span>' + baht(l.price * l.qty) + '</span></div>'; }).join('') +
      o.items.map(function (l) { return '<div class="row"><span>' + esc(l.name) + ' ×' + l.qty + ' @' + fmt(l.price) + '</span><span>' + baht(l.price * l.qty) + '</span></div>'; }).join('') +
      '<div class="row tot"><span>ยอดประมาณ</span><span>' + baht(o.est) + '</span></div>' +
      (o.belowMin ? '<div class="alert warn">ยอดต่ำกว่าขั้นต่ำส่ง</div>' : '') + (other ? '<div class="alert info">ลูกค้ารายนี้มีอีกออเดอร์ ' + esc(other.id) + ' ส่งพร้อมกันได้</div>' : '');
    if (o.status !== 'cancelled' && o.status !== 'paid') h += '<div class="pos"><b>คีย์ใน POS</b>' + posLines(o, d.cfg).map(function (x) { return '<div>' + esc(x) + '</div>'; }).join('') + (o.txn ? '<div>บิล ' + esc(o.txn) + ' ยอดจริง ' + baht(o.actual) + '</div>' : '') + '</div>';
    var edit = can('orders');
    if (edit && open) {
      var dup = A.dupTxn[o.id], dg = d.cfg.TXN_DIGITS || 7;
      h += '<form class="bill-form" data-form="billOrder" data-id="' + esc(o.id) + '"><label class="bf-field"><span>Transaction No.</span><input name="txn" class="mono" required inputmode="numeric" placeholder="เช่น 0316349" autocomplete="off" value="' + esc(dup ? dup.txn : '') + '"></label>' +
        '<label class="bf-field"><span>ยอด Net-Total จริง</span><input name="actual" inputmode="decimal" required value="' + (dup ? esc(dup.actual) : o.est) + '"></label>' +
        '<div class="bf-acts"><button class="btn blue" type="submit">ส่งบิลให้ลูกค้า</button><button class="btn bad sm" type="button" data-a="adm" data-op="cancelOrder" data-id="' + esc(o.id) + '" data-confirm="1">ยกเลิก</button></div>' +
        '<small class="hint txn-hint">' + (dup ? 'จะบันทึกเป็น ' + esc(C.txnNorm(dup.txn, dg)) : 'พิมพ์เลขเต็มจากสลิป POS ได้ ระบบเก็บ ' + dg + ' หลักท้าย') + '</small></form>' +
        (dup ? '<div class="alert warn">' + esc(dup.msg) + ' <button class="btn sm" data-a="admForceTxn" data-id="' + esc(o.id) + '">ยืนยันใช้เลขนี้ (บิลคนละใบ)</button></div>' : '');
    }
    if (o.status === 'billed') h += '<div class="row-flex">' + payPill(o.pay) + '<span class="hint">ยอดที่ต้องรับ ' + baht(o.pay.due) + (o.pay.received ? ', แจ้งโอนแล้ว ' + baht(o.pay.received) : '') + '</span><button class="text-btn" data-a="tab" data-p="pay">ไปแท็บชำระเงิน</button></div>';
    return h + '</article>';
  }
  function adOrders(d) {
    var all = (d.orders || []).filter(function (o) { return hit(o, ['id', 'memberName', 'phone', 'sno', 'txn']); });
    var open = all.filter(function (o) { return /new|approved|billed/.test(o.status); }), done = all.filter(function (o) { return /paid|cancelled/.test(o.status); });
    var h = searchBox('ค้นหา ชื่อร้าน เบอร์ เลขออเดอร์ หรือ Transaction');
    var pk = picked('ord'), byId = {}; open.forEach(function (o) { byId[o.id] = o; });
    var nPick = pk.filter(function (id) { return byId[id] && /new|approved/.test(byId[id].status); }).length, nBill = pk.filter(function (id) { return byId[id] && byId[id].status === 'billed'; }).length;
    h += bulkBar('ord', ['<button class="btn sm" data-a="admPicking" data-g="ord">' + ic('print') + ' พิมพ์ใบจัดของ (' + nPick + ')</button>', can('pay') ? bulkBtn('ord', 'remindOne', 'เตือนจ่าย', nBill, { cls: '' }) : '', can('orders') ? bulkBtn('ord', 'cancelOrder', 'ยกเลิก', nPick, { cls: 'bad', confirm: 1 }) : '']);
    if (d.cfg.COUNT_COUNTER && can('pay')) h += '<details class="box"><summary>บันทึกบิลหน้าร้านของสมาชิก</summary><form class="acts" data-form="counterBill"><div class="field"><label>สมาชิก</label><select name="memberId">' + (d.members || []).map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.name) + ' ' + esc(m.sno) + '</option>'; }).join('') + '</select></div><div class="field"><label>Transaction No.</label><input name="txn" required></div><div class="field"><label>ยอด</label><input name="amount" inputmode="decimal" required></div><button class="btn blue" type="submit">บันทึก</button></form></details>';
    if (!open.length) h += '<div class="empty">' + icon('check') + '<b>ไม่มีออเดอร์ค้าง</b><span>ออเดอร์ใหม่ขึ้นเองพร้อมเสียงเตือน</span></div>';
    var toBill = open.filter(function (o) { return /new|approved/.test(o.status); }).sort(function (a, b) { return dueKey(a) < dueKey(b) ? -1 : dueKey(a) > dueKey(b) ? 1 : 0; }), billed = open.filter(function (o) { return o.status === 'billed'; });
    if (toBill.length) h += '<h3 class="group-h">รอเปิดบิล <span class="cnt-pill">' + toBill.length + '</span><span class="hint">เรียงตามเวลาที่ต้องส่ง</span>' + pickAll('ord', toBill.map(function (o) { return o.id; })) + '</h3>' + toBill.map(function (o) { return orderCard(o, d, open); }).join('');
    if (billed.length) { var ids = billed.map(function (o) { return o.id; }); h += '<details class="box group"' + (ids.some(function (id) { return (A.pick.ord || {})[id]; }) ? ' open' : '') + '><summary>ส่งบิลแล้ว รอชำระ (' + billed.length + ')</summary>' + pickAll('ord', ids) + billed.map(function (o) { return orderCard(o, d, open); }).join('') + '</details>'; }
    h += '<h3 class="group-h">เสร็จแล้วในช่วงวันที่</h3>' + rangeBar([['orders', 'ออเดอร์'], ['lines', 'รายการสินค้า']]);
    h += done.length ? '<div class="tblw"><table><thead><tr><th>ออเดอร์</th><th>วันที่</th><th>ลูกค้า</th><th>สถานะ</th><th class="r">ยอด</th></tr></thead><tbody>' + done.map(function (o) { return '<tr><td class="mono">' + esc(o.id) + '</td><td>' + esc(o.created) + '</td><td>' + esc(o.memberName) + '</td><td>' + statusPill(o.status) + '</td><td class="r">' + baht(o.actual || o.est) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="hint">ยังไม่มีออเดอร์ที่ชำระแล้วหรือยกเลิกในช่วงนี้</div>';
    return h;
  }

  /* ---------- ชำระเงิน (ยอดสะสม · ขาด · เกิน · สลิป) ---------- */
  function adPay(d) {
    var list = (d.payOrders || []).filter(function (o) { return hit(o, ['id', 'memberName', 'phone', 'txn']); });
    var billed = list.filter(function (o) { return o.status === 'billed'; }), paid = list.filter(function (o) { return o.status === 'paid'; });
    var F = { todo: ['รอตรวจยอดโอน', function (o) { return o.status === 'billed' && o.pay.pending > 0; }], unpaid: ['ยังไม่โอน', function (o) { return o.status === 'billed' && !o.pay.received; }],
      short: ['ยังขาด', function (o) { return o.status === 'billed' && o.pay.received > 0 && o.pay.due - o.pay.received > (d.cfg.PAY_TOLERANCE || 0); }], billed: ['ค้างทั้งหมด', function (o) { return o.status === 'billed'; }],
      paid: ['ชำระแล้ว (ช่วงวันที่)', function (o) { return o.status === 'paid'; }] };
    if (!F[A.payFilter]) A.payFilter = 'todo';
    var dueSum = billed.reduce(function (s, o) { return s + Math.max(0, o.pay.balance); }, 0), paidSum = paid.reduce(function (s, o) { return s + o.pay.confirmed; }, 0);
    var over = Math.round(paid.reduce(function (s, o) { return s + Math.max(0, (o.pay.confirmed || 0) - (o.pay.due || 0)); }, 0) * 100) / 100;
    var h = '<div class="kv"><div><small>บิลค้างชำระ</small><b>' + billed.length + '</b></div><div><small>ยอดค้าง</small><b>' + baht(dueSum) + '</b></div><div><small>รับแล้ว (ช่วงวันที่)</small><b>' + baht(paidSum) + '</b></div></div>' +
      '<div class="hint">รับแล้ว = เงินที่ร้านยืนยันแล้วของบิลที่ชำระครบ นับตามวันที่ชำระ' + (over > 0 ? ' รวมโอนเกิน ' + baht(over) : '') + ' ส่วนแท็บรายงานนับยอดตามบิล ตามวันที่สั่ง ตัวเลขจึงอาจต่างกัน</div>'; // 3.1.5
    h += searchBox('ค้นหา ชื่อร้าน / เบอร์ / Transaction') + '<div class="chips">' + Object.keys(F).map(function (k) { var n = list.filter(F[k][1]).length; return '<button class="chip' + (A.payFilter === k ? ' on' : '') + '" data-a="admPayF" data-p="' + k + '">' + F[k][0] + ' (' + n + ')</button>'; }).join('') + '</div>';
    if (A.payFilter === 'paid') h += rangeBar([['payments', 'การชำระเงิน'], ['credits', 'เครดิต']]);
    var shown = list.filter(F[A.payFilter][1]), pk = picked('pay'), byId = {}; list.forEach(function (o) { byId[o.id] = o; });
    if (!shown.length) return h + '<div class="empty">' + icon('check') + '<b>ไม่มีรายการ</b></div>';
    var nRev = pk.filter(function (id) { return byId[id] && byId[id].pay.pending > 0; }).length, nUn = pk.filter(function (id) { return byId[id] && byId[id].status === 'billed' && !byId[id].pay.received; }).length, nAll = pk.filter(function (id) { return byId[id] && byId[id].status !== 'paid'; }).length;
    if (can('pay')) h += bulkBar('pay', [bulkBtn('pay', 'confirmPay', 'ยืนยันยอดที่แจ้ง', nRev), bulkBtn('pay', 'remindOne', 'เตือนจ่าย', nUn, { cls: '' }), bulkBtn('pay', 'confirmPayFull', 'รับเงินครบแล้ว', nAll, { cls: '', confirm: 1 })]) + pickAll('pay', shown.filter(function (o) { return o.status !== 'paid'; }).map(function (o) { return o.id; }));
    return h + shown.map(function (o) { return payCard(o, d); }).join('');
  }
  function payCard(o, d) {
    var p = o.pay, tol = d.cfg.PAY_TOLERANCE || 0, short = Math.round((p.due - p.received) * 100) / 100, edit = can('pay'), pre = o.evening && /new|approved/.test(o.status);
    var h = '<article class="ord pay-card' + (p.pending ? ' is-new' : '') + '"><div class="ord-h">' + (o.status !== 'paid' && edit ? pickBox('pay', o.id, o.id) : '') + '<b class="mono">' + esc(o.id) + '</b><b>' + esc(o.memberName) + '</b>' + tel(o.phone) + '<span class="mono hint">' + esc(o.txn) + '</span><span style="flex:1"></span>' + statusPill(o.status) + payPill(p) + evPill(o) + '</div>' + (pre ? '<div class="hint">รอบเย็นจ่ายก่อนเปิดบิล (ตามยอดประมาณ) · เปิดบิลยอดจริงแล้วระบบคิดส่วนต่าง/เครดิตให้เอง</div>' : '');
    h += '<div class="pay-grid"><div><small>ยอดบิล</small><b>' + baht(p.bill) + '</b></div>' + (p.credit ? '<div><small>หักเครดิต</small><b>−' + baht(p.credit) + '</b></div>' : '') +
      '<div><small>ยืนยันแล้ว</small><b>' + baht(p.confirmed) + '</b></div><div><small>แจ้งโอน รอตรวจ</small><b>' + baht(p.pending) + '</b></div>' +
      (short > tol ? '<div class="neg"><small>ยังขาด (ถ้ายอดที่แจ้งถูก)</small><b>' + baht(short) + '</b></div>' : short < -tol ? '<div class="pos"><small>แจ้งโอนเกิน</small><b>' + baht(-short) + '</b></div>' : '<div class="pos"><small>ยอดที่แจ้ง</small><b>ครบ ✓</b></div>') + '</div>';
    if ((p.payments || []).length) h += '<div class="pay-list">' + p.payments.map(function (x) {
      var st = x.status === 'confirmed' ? '<span class="pill paid">ยืนยันแล้ว</span>' : x.status === 'rejected' ? '<span class="pill red">ไม่ผ่าน</span>' : '<span class="pill appr">รอตรวจ</span>';
      return '<div class="pay-row"><span><b>' + baht(x.amount) + '</b> · ' + esc(x.at.slice(5, 16)) + ' · ' + esc({ transfer: 'โอน', cash: 'เงินสด', other: 'อื่นๆ' }[x.method] || x.method) + (x.source === 'staff' ? ' (พนักงานบันทึก)' : x.source === 'slip-api' ? ' (ตรวจสลิปอัตโนมัติ)' : '') +
        (x.ref ? ' · <span class="mono" title="' + esc(x.ref) + '">QR สลิป ✓</span>' : '') + (x.note ? '<br><small class="hint">' + esc(x.note) + '</small>' : '') + (x.by ? '<br><small class="hint">ตรวจโดย ' + esc(x.by) + '</small>' : '') + '</span><span class="pay-acts">' + st +
        (x.hasSlip ? '<button class="btn sm" data-a="admSlip" data-id="' + esc(x.id) + '">ดูสลิป</button>' : '') +
        (edit && x.status === 'pending' && (o.status === 'billed' || pre) ? '<button class="btn sm blue" data-a="adm" data-op="payReview" data-pid="' + esc(x.id) + '" data-ok="1">✓ ยอดเข้าแล้ว</button><button class="btn sm bad" data-a="adm" data-op="payReview" data-pid="' + esc(x.id) + '" data-ok="0" data-confirm="1">✗ ไม่พบยอด</button>' : '') + '</span></div>';
    }).join('') + '</div>';
    if (edit && (o.status === 'billed' || pre)) {
      h += '<div class="acts">';
      if (p.pending > 0) h += '<button class="btn blue" data-a="adm" data-op="confirmPay" data-id="' + esc(o.id) + '">ยืนยันทุกยอดที่แจ้ง (' + baht(p.pending) + ')</button>';
      if (p.received > 0 && short > tol && !pre) h += '<button class="btn" data-a="adm" data-op="askShort" data-id="' + esc(o.id) + '">ขอยอดที่ขาด ' + baht(short) + '</button>';
      if (!p.received && !pre) h += '<button class="btn" data-a="adm" data-op="remindOne" data-id="' + esc(o.id) + '">เตือนจ่าย' + (o.remindCount ? ' (เตือนแล้ว ' + o.remindCount + ')' : '') + '</button>';
      h += '<button class="btn sm" data-a="admToggle" data-k="rec-' + esc(o.id) + '">บันทึกรับเงินเอง</button>';
      if (p.balance > tol) h += '<button class="btn sm" data-a="adm" data-op="confirmPay" data-id="' + esc(o.id) + '" data-full="1" data-confirm="1">รับเงินครบแล้ว (' + baht(p.balance) + ')</button>';
      h += '</div>';
      if (A.open['rec-' + o.id]) h += '<form class="acts" data-form="payRecord" data-id="' + esc(o.id) + '"><div class="field"><label>ยอดที่รับ</label><input name="amount" inputmode="decimal" required value="' + Math.max(0, p.balance) + '"></div><div class="field"><label>วิธี</label><select name="method"><option value="transfer">โอน (เห็นในบัญชีร้าน)</option><option value="cash">เงินสด</option><option value="other">อื่นๆ</option></select></div><div class="field"><label>หมายเหตุ</label><input name="note" maxlength="100"></div><button class="btn blue" type="submit">บันทึก</button></form>';
    }
    if (o.status === 'paid' && p.over > 0) h += '<div class="alert ok">โอนเกิน ' + baht(p.over) + ' → ' + (d.cfg.OVERPAY_MODE === 'refund' ? 'รอคืนเงิน' : 'เก็บเป็นเครดิตของลูกค้าแล้ว (หักบิลถัดไปอัตโนมัติ)') + (edit ? ' <button class="text-btn" data-a="admToggle" data-k="ref-' + esc(o.id) + '">คืนเงินแล้ว?</button>' : '') + '</div>' +
      (A.open['ref-' + o.id] ? '<form class="acts" data-form="creditRefund" data-member="' + esc(o.memberId) + '" data-order="' + esc(o.id) + '"><div class="field"><label>ยอดที่คืนให้ลูกค้า</label><input name="amount" inputmode="decimal" value="' + p.over + '"></div><div class="field"><label>หมายเหตุ</label><input name="note" value="โอนคืนส่วนเกิน"></div><button class="btn" type="submit">บันทึกการคืนเงิน (หักเครดิต)</button></form>' : '');
    return h + '</article>';
  }

  /* ---------- จัดรอบส่ง ---------- */
  function hav(a, b, c, d) { var R = 6371, r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r, h = Math.sin(x / 2) * Math.sin(x / 2) + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) * Math.sin(y / 2); return 2 * R * Math.asin(Math.sqrt(h)); }
  function nnOrder(stops, shop) {
    var withP = stops.filter(function (s) { return s.lat && s.lng; }), noP = stops.filter(function (s) { return !(s.lat && s.lng); }), out = [], cur = shop;
    while (withP.length) { var bi = 0, bd = 1e9; withP.forEach(function (s, i) { var dd = hav(cur.lat, cur.lng, s.lat, s.lng); if (dd < bd) { bd = dd; bi = i; } }); var s = withP.splice(bi, 1)[0]; s.km = Math.round(bd * 10) / 10; out.push(s); cur = s; }
    return out.concat(noP);
  }
  /* จัดรอบ: รอบเวลา → โซน → เรียงจุดใกล้สุด → ตัด ≤ cap กก. · บิลหนักเกิน cap แยกเป็นหลายเที่ยวติดกัน · แบ่งรถ A/B สลับให้น้ำหนักใกล้กัน */
  function planTrips(r) {
    var cfg = (A.d[key('route')] && A.d[key('route')].cfg) || {}, waves = (r.waves || []).map(function (w) { return w.name; });
    var slots = waves.length && String(cfg.SLOT_MODE || 'auto') !== 'choose' ? waves : String(cfg.SLOTS || '').split('|'), zones = r.zones.map(function (z) { return z.id; }), cap = r.vehicleKg || 50, bikes = r.bikes && r.bikes.length ? r.bikes : ['A'];
    var pend = [], byMem = {}, trips = [];
    r.list.filter(function (x) { return !x.delivery; }).forEach(function (x) { // ลูกค้าเดียวกันหลายออเดอร์ = ส่งจุดเดียว
      var k = x.memberId + '|' + x.slot, s = byMem[k];
      if (!s) { s = byMem[k] = Object.assign({}, x, { ids: [x.id], orders: [x] }); pend.push(s); return; }
      s.ids.push(x.id); s.orders.push(x); s.kg = Math.round((s.kg + x.kg) * 10) / 10; s.est += x.est; s.actual = (s.actual || 0) + (x.actual || 0); s.items += ' | ' + x.items; s.belowMin = s.belowMin && x.belowMin;
      if (x.deliverDate < s.deliverDate) s.deliverDate = x.deliverDate;
      if (x.needBy && (!s.needBy || x.needBy < s.needBy)) s.needBy = x.needBy;
    });
    var bySlot = {}; pend.forEach(function (x) { var s = slots.indexOf(x.slot) >= 0 ? x.slot : (x.slot || 'ไม่ระบุรอบ'); (bySlot[s] = bySlot[s] || []).push(x); });
    Object.keys(bySlot).sort(function (a, b) { var ia = slots.indexOf(a), ib = slots.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); }).forEach(function (slot) {
      var byZone = {}, slotTrips = [];
      bySlot[slot].forEach(function (x) { (byZone[x.zone] = byZone[x.zone] || []).push(x); });
      Object.keys(byZone).sort(function (a, b) { var ia = zones.indexOf(a), ib = zones.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); }).forEach(function (z) {
        var cur = null;
        nnOrder(byZone[z], r.shop).forEach(function (s) {
          if (s.kg > cap) { // บิลหนัก: แยกเป็นหลายเที่ยว จุดเดียวกัน
            var legs = Math.ceil(s.kg / cap), left = s.kg;
            for (var li = 1; li <= legs; li++) { var w = Math.min(cap, left); left = Math.round((left - w) * 10) / 10; var leg = Object.assign({}, s, { kg: w, leg: li, legs: legs }); slotTrips.push({ slot: slot, zone: z, stops: [leg], kg: w, heavy: true }); }
            cur = null; return;
          }
          if (!cur || cur.kg + s.kg > cap) { cur = { slot: slot, zone: z, stops: [], kg: 0 }; slotTrips.push(cur); }
          cur.stops.push(s); cur.kg = Math.round((cur.kg + s.kg) * 10) / 10;
        });
      });
      var isEv = r.evening && slot === r.evening, bk = isEv && r.eveningBikes && r.eveningBikes.length ? r.eveningBikes : bikes, wv = (r.waves || []).filter(function (w) { return w.name === slot; })[0];
      var load = {}; bk.forEach(function (b) { load[b] = 0; }); // แบ่งรถ: ใส่รอบถัดไปให้คันที่เบากว่า
      slotTrips.forEach(function (t, ti) {
        var best = bk[0]; bk.forEach(function (b) { if (load[b] < load[best]) best = b; });
        t.bike = A.bikeOf[slot + '|' + t.stops.map(function (x) { return x.id; }).join(',')] || best; load[t.bike] += t.kg || 1;
        t.evening = isEv; t.depart = isEv && wv && wv.runs ? wv.runs[ti % wv.runs.length] : (wv ? wv.depart : ''); trips.push(t);
      });
    });
    trips.forEach(function (t, i) { t.no = i + 1; t.id = 'R' + (i + 1) + '-' + t.zone; t.key = t.slot + '|' + t.stops.map(function (x) { return x.id; }).join(','); });
    return trips;
  }
  /* เวลาถึงโดยประมาณของแต่ละจุด: รถออก (ตอนนี้) + ลำดับ × นาที/จุด */
  function etaFor(trip, cfg) {
    var per = Number(cfg.STOP_MIN) || 10, now = new Date(), out = {};
    trip.stops.forEach(function (s, i) { var t = new Date(now.getTime() + (i + 1) * per * 60000); out[s.id] = ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2); (s.ids || [s.id]).forEach(function (id) { out[id] = out[s.id]; }); });
    return out;
  }
  function mapsUrl(stops, shop) {
    var pts = stops.filter(function (s) { return s.lat && s.lng; }); if (!pts.length) return '';
    var o = shop.lat + ',' + shop.lng, dest = pts[pts.length - 1], wp = pts.slice(0, -1).slice(0, 9).map(function (s) { return s.lat + ',' + s.lng; }).join('|');
    return 'https://www.google.com/maps/dir/?api=1&origin=' + o + '&destination=' + dest.lat + ',' + dest.lng + (wp ? '&waypoints=' + encodeURIComponent(wp) : '') + '&travelmode=driving';
  }
  function stopPay(s) {
    var os = s.orders || [s], unpaid = os.filter(function (o) { return o.status !== 'paid' && !(o.evening && o.paid); }); // รอบเย็นที่จ่ายก่อนแล้ว = จ่ายแล้ว
    if (!unpaid.length) return '<span class="pill paid">จ่ายแล้ว</span>';
    return unpaid.some(function (o) { return o.status === 'billed'; }) ? '<span class="pill bill">ค้างจ่าย</span>' : '<span class="pill appr">ยังไม่เปิดบิล</span>';
  }
  function stopRow(s, i, sel, mode) {
    return '<div class="stop' + (s.belowMin ? ' pool' : '') + '">' + (mode === 'plan' ? '<input type="checkbox" data-chg="admSel" data-id="' + esc(s.id) + '"' + (sel ? ' checked' : '') + ' aria-label="เลือก ' + esc(s.name) + '">' : mode === 'out' && can('route') ? pickBox('out', s.id, s.name) : '') + '<span class="stop-no">' + (i + 1) + '</span>' +
      '<div class="stop-main"><b>' + esc(s.name) + '</b> ' + tel(s.phone) + '<div class="hint">' + esc(s.address || 'ยังไม่มีที่อยู่') + (s.lat ? ' · <a href="https://www.google.com/maps/search/?api=1&query=' + s.lat + ',' + s.lng + '" target="_blank" rel="noopener">หมุด</a>' + (s.km ? ' ~' + s.km + ' กม.' : '') : ' · <span class="warn-t">ยังไม่ปักหมุด</span>') + '</div>' +
      '<div class="hint">' + esc((s.ids || [s.id]).join(', ')) + ((s.orders || [s]).some(function (o) { return o.evening && !o.paid; }) ? ' <span class="pill red">รอบเย็น ยังไม่จ่าย</span>' : s.evening ? ' <span class="pill paid">รอบเย็น จ่ายแล้ว</span>' : '') + (s.ids && s.ids.length > 1 ? ' <span class="pill appr">รวม ' + s.ids.length + ' ออเดอร์ ส่งครั้งเดียว</span>' : '') + (s.leg ? ' <span class="pill red">บิลหนัก เที่ยวที่ ' + s.leg + '/' + s.legs + '</span>' : '') + ' · ' + s.kg + ' กก. · ' + baht(s.actual || s.est) + ' ' + stopPay(s) + (s.belowMin ? ' <span class="pill new">ส่งรวมรอบ (ต่ำกว่าขั้นต่ำ)</span>' : '') + (s.deliverDate < A.routeDate ? ' <span class="pill red">ค้างจาก ' + C.thDate(s.deliverDate) + '</span>' : '') + (s.needBy ? ' <span class="pill bill">ต้องได้ก่อน ' + esc(s.needBy) + '</span>' : '') + (mode === 'out' && s.eta ? ' · ถึงประมาณ ' + esc(s.eta) : '') + '</div>' +
      (s.deliveryNote ? '<div class="hint"><b>จุดจอด/คนรับ:</b> ' + esc(s.deliveryNote) + '</div>' : '') +
      '<div class="hint items">' + esc(s.items) + '</div>' + (mode === 'plan' && can('route') ? '<span class="wave-pick">ย้ายไป <select data-chg="admWave" data-id="' + esc((s.ids || [s.id]).join(',')) + '"><option value="">รอบ…</option>' + (A.waveNames || []).map(function (w) { return '<option' + (w === s.slot ? ' selected' : '') + '>' + esc(w) + '</option>'; }).join('') + '</select> <select data-chg="admBike" data-id="' + esc((s.ids || [s.id]).join(',')) + '"><option value="">รถ…</option>' + (A.bikeNames || []).map(function (b) { return '<option value="' + esc(b) + '">รถ ' + esc(b) + '</option>'; }).join('') + '</select></span>' : '') + '</div>' +
      (mode === 'out' && can('route') ? '<button class="btn sm blue" data-a="adm" data-op="deliveryDone" data-id="' + esc(s.id) + '">ส่งแล้ว ✓</button>' : mode === 'done' && can('route') ? '<button class="btn sm" data-a="adm" data-op="deliveryUndo" data-id="' + esc(s.id) + '" data-confirm="1">ย้อนกลับ</button>' : '') + '</div>';
  }
  /* v3.1.0 ระบบแนะนำการออกรถ: รถว่างคันไหน เที่ยวไหนออกได้เลย / ออกกี่โมง · ไม่ต้องเลือกรถ ไม่ต้องใส่เลขไมล์ */
  function dispStop(s, i, tr, edit) {
    var multi = tr.stops.length > 1, no = tr.stops.slice(0, i + 1).filter(function (x) { return !x.same; }).length; // 3.1.5 ที่เดียวกับจุดก่อนหน้า = เลขจุดเดียวกัน
    return '<div class="stop' + (s.late ? ' late' : '') + '">' + (edit && multi ? '<input type="checkbox" data-chg="admSel" data-id="' + esc(s.id) + '"' + (A.sel[s.id] !== false ? ' checked' : '') + ' aria-label="เลือก ' + esc(s.name) + '">' : '') + '<span class="stop-no">' + (no || i + 1) + '</span>' +
      '<div class="stop-main"><div class="stop-name"><b>' + esc(s.name) + '</b> ' + tel(s.phone) + '</div>' +
      '<div class="stop-times"><span>ถึงประมาณ <b>' + esc(s.eta) + '</b></span><span class="' + (s.late ? 'bad-t' : 'hint') + '">ต้องถึงก่อน ' + esc(s.due) + (s.dueDay > 0 ? ' พรุ่งนี้' : '') + '</span>' + (s.ready ? '' : '<span class="pill appr">ยังไม่เปิดบิล</span>') + (s.legs ? '<span class="pill red">บิลหนัก เที่ยว ' + s.leg + '/' + s.legs + '</span>' : '') + (s.area === 'grace' ? '<span class="pill new">หมุดเดิม</span>' : '') + (s.same ? '<span class="pill paid">ที่เดียวกับจุดก่อนหน้า</span>' : '') + '</div>' +
      '<div class="hint">' + esc(s.address || 'ยังไม่มีที่อยู่') + ' ' + (s.lat ? mapLink(s.lat, s.lng, 'หมุด') : '<span class="warn-t">ไม่มีหมุด</span>') + '</div>' +
      (s.deliveryNote ? '<div class="hint"><b>จุดจอด / คนรับ:</b> ' + esc(s.deliveryNote) + '</div>' : '') + '<div class="hint"><span class="mono">' + esc(s.id) + '</span> ' + s.kg + ' กก. ' + baht(s.est) + '</div></div></div>';
  }
  function adDispatch(d) {
    var r = d.route, D = r.dispatch, edit = can('route'), kpi = D.kpi || {}; A.bikes = D.bikes || [];
    var h = '<div class="date-bar"><div class="date-fields"><label>วันส่ง <input type="date" data-chg="admRouteDate" value="' + A.routeDate + '"></label></div><div class="dl-row"><button class="btn sm" data-a="admPrint" data-p="all">' + ic('print') + ' พิมพ์ใบงานทั้งหมด</button>' + (can('export') ? '<button class="btn sm" data-a="admExport" data-k="trips" data-month="1">' + ic('dl') + ' สมุดจดรอบ .xlsx</button>' : '') + '</div></div>';
    h += '<div class="bike-row">' + D.bikes.map(function (b) {
      return '<div class="bike-card ' + (b.free ? 'free' : 'onroad') + '"><span class="bike-ic">' + icon('truck') + '</span><div><b>รถ ' + esc(b.bike) + '</b><small>' + (b.free ? 'ว่าง พร้อมออก' : 'กำลังส่ง กลับประมาณ ' + esc(b.freeAt) + ' น.') + '</small></div>' + (!b.free && b.trip && edit ? '<button class="btn sm" data-a="admBack" data-trip="' + esc(b.trip.id) + '">กลับแล้ว</button>' : '') + '</div>';
    }).join('') + '<div class="bike-card kpi"><div><b>' + (kpi.pct === null || kpi.pct === undefined ? '–' : kpi.pct + '%') + '</b><small>ส่งทันภายใน ' + (D.hours && D.hours.target ? D.hours.target : 60) + ' นาที วันนี้' + (kpi.orders ? ' (' + kpi.onTime + ' จาก ' + kpi.orders + ')' : '') + '</small></div></div></div>';
    if (!D.trips.length) h += '<div class="empty">' + ic('map') + '<b>ไม่มีออเดอร์รอส่ง</b><span>ออเดอร์ส่งถึงที่ขึ้นที่นี่ทันทีที่ลูกค้าสั่ง</span></div>';
    else h += '<h3 class="group-h">ระบบแนะนำ <span class="hint">ตอนนี้ ' + esc(D.now) + ' น.</span></h3>';
    D.trips.forEach(function (tr) {
      var chip = tr.now ? '<span class="go-chip now">ออกได้เลย</span>' : !tr.ready ? '<span class="go-chip wait">รอเปิดบิล</span>' : '<span class="go-chip later">ออก ' + esc(tr.depart) + ' น.</span>';
      var url = mapsUrl(tr.stops, r.shop), heavy = tr.stops.some(function (s) { return s.legs > 1; });
      h += '<section class="box trip dispatch' + (tr.late ? ' late' : '') + (tr.now ? ' go' : '') + '" id="trip-' + tr.no + '"><div class="trip-top"><div><h3>เที่ยวที่ ' + tr.no + ' <span class="pill appr">รถ ' + esc(tr.bike) + '</span></h3><small class="hint">' + (tr.drops || tr.stops.length) + ' จุด ' + tr.kg + ' กก. กลับประมาณ ' + esc(tr.back) + ' น.' + (tr.latest ? ' ออกไม่เกิน ' + esc(tr.latest) + ' น.' : '') + '</small></div>' + chip + '</div>' +
        (tr.late ? '<div class="alert bad">มีจุดที่จะส่งไม่ทันเวลา ควรออกทันที</div>' : '') + (!tr.ready ? '<div class="alert warn">ยังไม่เปิดบิล ' + tr.stops.filter(function (s) { return !s.ready; }).length + ' จุด' + (can('orders') ? ' <button class="text-btn" data-a="tab" data-p="orders">ไปเปิดบิล</button>' : '') + '</div>' : '') +
        (edit && tr.stops.length > 1 ? '<div class="sel-all"><button class="text-btn" data-a="admTripSel" data-no="' + tr.no + '" data-on="1">เลือกทุกจุด</button><span class="vbar" aria-hidden="true">|</span><button class="text-btn" data-a="admTripSel" data-no="' + tr.no + '" data-on="0">ไม่เลือกทุกจุด</button></div>' : '') +
        tr.stops.map(function (s, i) { return dispStop(s, i, tr, edit); }).join('') +
        '<div class="acts">' + (edit ? (function () { var w = outWarn(tr); return '<button class="btn ' + (tr.now ? 'pri' : 'blue') + '" data-a="admDispatchOut" data-no="' + tr.no + '"' + (w ? ' data-sure="1"' : '') + '>' + (w ? esc(w.text) : icon('truck') + ' ออกรถ ' + esc(tr.bike) + (heavy ? ' (บิลหนัก)' : '')) + '</button>'; })() : '') + (url ? '<a class="btn sm" href="' + esc(url) + '" target="_blank" rel="noopener">' + ic('map') + ' เส้นทาง</a>' : '') + '<button class="btn sm" data-a="admPrint" data-p="' + tr.no + '">' + ic('print') + ' พิมพ์ใบงาน</button></div></section>';
    });
    var out = r.list.filter(function (x) { return x.delivery === 'out'; });
    if (out.length) {
      var byTrip = {}; out.forEach(function (x) { var k = String(x.trip || '').split('#')[0] || '-'; (byTrip[k] = byTrip[k] || []).push(x); });
      h += '<h3 class="group-h">กำลังส่ง</h3>' + Object.keys(byTrip).map(function (k) {
        var list = byTrip[k].sort(function (a, b) { return String(a.trip).localeCompare(String(b.trip), undefined, { numeric: true }); }), tl = (r.trips || []).filter(function (x) { return x.id === k; })[0];
        return '<section class="box trip out"><div class="trip-top"><div><h3>' + esc(k) + (tl ? ' <span class="pill appr">รถ ' + esc(tl.bike) + '</span>' : '') + '</h3><small class="hint">ออก ' + esc((list[0].deliveryAt || '').slice(11, 16)) + ' น.' + (tl && tl.estBack ? ' กลับประมาณ ' + esc(tl.estBack) + ' น.' : '') + '</small></div></div>' +
          list.map(function (s, i) { return '<div class="stop"><span class="stop-no">' + (i + 1) + '</span><div class="stop-main"><b>' + esc(s.name) + '</b> ' + tel(s.phone) + '<div class="hint">ถึงประมาณ ' + esc(s.eta || '-') + ' น. <span class="mono">' + esc(s.id) + '</span> ' + stopPay(s) + '</div></div></div>'; }).join('') +
          (edit && tl && !tl.backAt ? '<div class="acts"><button class="btn sm" data-a="admBack" data-trip="' + esc(k) + '">รถกลับแล้ว</button><span class="hint">ไม่กดก็ได้ ระบบปิดเที่ยวเองตามเวลาประมาณ</span></div>' : '') + '</section>';
      }).join('');
    }
    if ((D.tomorrow || []).length) h += '<details class="box"><summary>ออเดอร์ล่วงหน้า ส่งเที่ยวแรก (' + D.tomorrow.length + ')</summary>' + D.tomorrow.map(function (x) { return '<div class="row"><span>' + esc(x.name) + ' <small class="mono hint">' + esc(x.id) + '</small></span><span>' + esc(C.thDate(x.date)) + ' ' + x.kg + ' กก.</span></div>'; }).join('') + '</details>';
    var logs = (r.trips || []).filter(function (x) { return x.backAt; });
    if (logs.length) h += '<details class="box"><summary>เที่ยวที่จบแล้ววันนี้ (' + logs.length + ')</summary><div class="tblw"><table><thead><tr><th>เที่ยว</th><th>รถ</th><th>ออก</th><th>กลับ</th><th class="r">นาที</th><th class="r">จุด</th><th class="r">กก.</th></tr></thead><tbody>' + logs.map(function (x) { return '<tr><td class="mono">' + esc(x.id) + '</td><td>' + esc(x.bike) + '</td><td>' + esc((x.outAt || '').slice(11, 16)) + '</td><td>' + esc((x.backAt || '').slice(11, 16)) + (x.auto ? ' <small class="hint">(ประมาณ)</small>' : '') + '</td><td class="r">' + (x.minutes === null ? '–' : x.minutes) + '</td><td class="r">' + x.stops + '</td><td class="r">' + x.kg + '</td></tr>'; }).join('') + '</tbody></table></div></details>';
    A.trips = D.trips.map(function (tr) { var byId = {}; r.list.forEach(function (x) { byId[x.id] = x; }); return { no: tr.no, slot: 'ส่งภายใน 1 ชม.', zone: '', bike: tr.bike, kg: tr.kg, depart: tr.depart, back: tr.back, dispatch: true, stops: tr.stops.map(function (s) { var o = byId[s.id] || {}; return Object.assign({}, s, { ids: [s.id], orders: [o.id ? o : s], items: o.items || '', actual: o.actual, status: o.status || s.status }); }) }; });
    return h;
  }
  function adRoute(d) {
    if (d.route && d.route.dispatch) return adDispatch(d);
    var r = d.route, t = today(), cap = r.vehicleKg, cfg = d.cfg || {};
    A.waveNames = (r.waves || []).map(function (w) { return w.name; }); A.bikeNames = (r.bikes || ['A']).concat((r.eveningBikes || []).filter(function (b) { return (r.bikes || []).indexOf(b) < 0; })); A.bikeOf = A.bikeOf || {};
    var trips = planTrips(r);
    var out = r.list.filter(function (x) { return x.delivery === 'out'; }), done = r.list.filter(function (x) { return x.delivery === 'done'; }), pending = r.list.filter(function (x) { return !x.delivery; });
    var kg = pending.reduce(function (s, x) { return s + x.kg; }, 0), pools = pending.filter(function (x) { return x.belowMin; }).length;
    var h = '<div class="date-bar"><div class="date-fields"><label>วันส่ง <input type="date" data-chg="admRouteDate" value="' + A.routeDate + '"></label></div><div class="dl-row">' + (can('export') || can('route') ? '<button class="btn sm" data-a="admExport" data-k="route">' + ic('dl') + ' ใบงาน .xlsx</button><button class="btn sm" data-a="admExport" data-k="trips" data-month="1">' + ic('dl') + ' สมุดจดรอบ .xlsx</button>' : '') + '<button class="btn sm" data-a="admPrint" data-p="all">' + ic('print') + ' พิมพ์ใบงานทั้งหมด</button></div></div>';
    var byBike = {}; trips.forEach(function (x) { byBike[x.bike] = (byBike[x.bike] || 0) + 1; });
    h += '<div class="kv"><div><small>รอจัดส่ง</small><b>' + pending.length + ' จุด</b>' + (pools ? '<small class="hint">รอรวมรอบ ' + pools + '</small>' : '') + '</div><div><small>น้ำหนักรวม</small><b>' + Math.round(kg * 10) / 10 + ' กก.</b></div><div><small>รอบที่แนะนำ (≤' + cap + ' กก.)</small><b>' + trips.length + '</b><small class="hint">' + Object.keys(byBike).map(function (b) { return 'รถ ' + b + ' ' + byBike[b]; }).join(' · ') + '</small></div></div>';
    h += '<div class="alert info">ระบบจัดรอบให้: รอบเวลา (' + esc((r.waves || []).map(function (w) { return w.name + ' ' + w.depart; }).join(' · ')) + ') → โซน → เรียงจุดใกล้สุดจากร้าน → ตัดรอบไม่เกิน ' + cap + ' กก. → แบ่งรถ ' + esc(A.bikeNames.join('/')) + ' · บิลหนักเกิน ' + cap + ' กก. แยกเป็นหลายเที่ยวติดกัน · ออเดอร์ "ส่งรวมรอบ" (สีเหลือง) ไปกับรอบที่ผ่านย่านเดียวกัน · ย้ายรอบ/รถได้ที่แต่ละจุด' + (pending.some(function (x) { return !x.lat; }) ? ' · จุดที่ยังไม่ปักหมุดอยู่ท้ายรอบ' : '') + '</div>';
    if (!trips.length && !out.length) h += '<div class="empty">' + ic('map') + '<b>ไม่มีออเดอร์รอจัดส่ง' + (A.routeDate === t ? 'วันนี้' : '') + '</b><span>ออเดอร์ที่อนุมัติแล้วจะขึ้นที่นี่</span></div>';
    trips.forEach(function (tr) {
      var url = mapsUrl(tr.stops, r.shop), over = tr.kg > cap, wv = (r.waves || []).filter(function (w) { return w.name === tr.slot; })[0];
      var unpaidEv = tr.evening ? tr.stops.filter(function (s) { return (s.orders || [s]).some(function (o) { return o.evening && !o.paid; }); }).length : 0;
      h += '<section class="box trip' + (tr.evening ? ' evening' : '') + '" id="trip-' + tr.no + '"><div class="section-heading"><h3>รอบที่ ' + tr.no + ' · ' + esc(tr.slot) + (tr.depart ? ' ' + esc(tr.depart) : '') + ' · ' + esc(C.zoneName(tr.zone) || tr.zone) + ' · <span class="pill appr">รถ ' + esc(tr.bike) + '</span>' + (tr.heavy ? ' <span class="pill red">บิลหนัก</span>' : '') + '</h3><span class="pill' + (over ? ' red' : '') + '">' + tr.stops.length + ' จุด · ' + tr.kg + ' กก.</span></div>' +
        '<div class="kg-bar"><span style="width:' + Math.min(100, tr.kg / cap * 100) + '%"></span></div>' + (unpaidEv ? '<div class="alert bad">รอบเย็น: ' + unpaidEv + ' จุดยังไม่จ่าย · ระบบเลื่อนเป็นคืนถัดไปให้เองหลังเวลาปิดรับ · ห้ามนำออกจากตู้จนกว่าจะจ่าย</div>' : '') + (tr.evening ? '<div class="hint">แพ็กหลัง 16:30 · ออกจากตู้ไม่เกิน 60 นาทีก่อนถึงลูกค้า · ไรเดอร์พาร์ทเนอร์ ≤ 20 กก./เที่ยว</div>' : '') +
        '<div class="sel-all"><button class="text-btn" data-a="admTripSel" data-no="' + tr.no + '" data-on="1">เลือกทุกจุด</button><span class="vbar" aria-hidden="true">|</span><button class="text-btn" data-a="admTripSel" data-no="' + tr.no + '" data-on="0">ไม่เลือกทุกจุด</button></div>' +
        tr.stops.map(function (s, i) { return stopRow(s, i, A.sel[s.id] !== false, 'plan'); }).join('') +
        '<div class="acts">' + (can('route') ? '<span class="trip-head"><select data-chg="admTripBike" data-key="' + esc(tr.key) + '" aria-label="รถ">' + A.bikeNames.map(function (b) { return '<option value="' + esc(b) + '"' + (b === tr.bike ? ' selected' : '') + '>รถ ' + esc(b) + '</option>'; }).join('') + '</select><select data-chg="admRider" data-no="' + tr.no + '" aria-label="คนขับ"><option value="">คนขับ…</option>' + (r.riders || []).map(function (n) { return '<option' + (A.riderOf[tr.no] === n ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select></span><button class="btn blue" data-a="admTripOut" data-no="' + tr.no + '" data-ids="' + esc(tr.stops.map(function (s) { return (s.ids || [s.id]).join(','); }).join(',')) + '" data-trip="' + esc(tr.id) + '">' + icon('truck') + ' ออกรอบนี้ (ที่เลือก)</button>' : '') +
        (url ? '<a class="btn sm" href="' + esc(url) + '" target="_blank" rel="noopener">' + ic('map') + ' เส้นทาง Google Maps</a>' : '') + '<button class="btn sm" data-a="admPrint" data-p="' + tr.no + '">' + ic('print') + ' พิมพ์ใบงาน</button></div></section>';
    });
    if (out.length) {
      var byTrip = {}; out.forEach(function (x) { var k = String(x.trip || '').split('#')[0] || '-'; (byTrip[k] = byTrip[k] || []).push(x); });
      h += '<h3 class="group-h">กำลังนำส่ง' + (can('route') ? pickAll('out', out.map(function (x) { return x.id; })) : '') + '</h3>' + (can('route') ? bulkBar('out', [bulkBtn('out', 'deliveryDone', 'ส่งแล้ว ✓', picked('out').length)]) : '') + Object.keys(byTrip).map(function (k) {
        var list = byTrip[k].sort(function (a, b) { return String(a.trip).localeCompare(String(b.trip), undefined, { numeric: true }); }), tl = (r.trips || []).filter(function (x) { return x.id === k; })[0];
        return '<section class="box trip out"><div class="section-heading"><h3>' + esc(k) + (tl && tl.rider ? ' · ' + esc(tl.rider) : '') + '</h3><span class="hint">ออก ' + esc((list[0].deliveryAt || '').slice(11, 16)) + '</span></div>' + list.map(function (s, i) { return stopRow(s, i, true, 'out'); }).join('') +
          (can('route') && tl && !tl.backAt ? '<div class="acts"><button class="btn sm blue" data-a="admBack" data-trip="' + esc(k) + '">รถกลับแล้ว (ส่งครบทุกจุด)</button></div>' : '') + '</section>';
      }).join('');
    }
    var logs = (r.trips || []).filter(function (x) { return x.backAt; });
    if (logs.length) h += '<details class="box" open><summary>สมุดจดรอบวันนี้ (' + logs.length + ' รอบจบแล้ว)</summary><div class="tblw"><table><thead><tr><th>รอบ</th><th>รถ</th><th>คนขับ</th><th>ออก</th><th>กลับ</th><th class="r">นาที</th><th class="r">จุด</th><th class="r">กก.</th></tr></thead><tbody>' + logs.map(function (x) { return '<tr><td class="mono">' + esc(x.id) + '</td><td>' + esc(x.bike) + '</td><td>' + esc(x.rider) + '</td><td>' + esc((x.outAt || '').slice(11, 16)) + '</td><td>' + esc((x.backAt || '').slice(11, 16)) + (x.auto ? ' <small class="hint">(ประมาณ)</small>' : '') + '</td><td class="r">' + (x.minutes === null ? '–' : x.minutes) + '</td><td class="r">' + x.stops + '</td><td class="r">' + x.kg + '</td></tr>'; }).join('') + '</tbody></table></div></details>';
    if (done.length) h += '<details class="box"><summary>ส่งถึงแล้ว (' + done.length + ')</summary>' + done.map(function (s, i) { return stopRow(s, i, true, 'done'); }).join('') + '</details>';
    A.trips = trips;
    return h;
  }
  function printTrips(which) {
    var r = A.d[key('route')] && A.d[key('route')].route, trips = (A.trips || []).filter(function (t) { return which === 'all' || String(t.no) === String(which); });
    if (!r || !trips.length) { toast('ไม่มีรอบให้พิมพ์'); return; }
    var html = trips.map(function (t) {
      if (t.dispatch) return '<section class="print-trip"><h2>ใบงานส่งของ เที่ยวที่ ' + t.no + ' รถ ' + esc(t.bike) + '</h2><p>วันที่ ' + C.thDate(A.routeDate) + ' ออก ' + esc(t.depart) + ' น. กลับประมาณ ' + esc(t.back) + ' น. ' + t.stops.length + ' จุด ' + t.kg + ' กก.</p>' +
        '<table><thead><tr><th>#</th><th>ลูกค้า / โทร</th><th>ที่อยู่ / จุดจอด</th><th>รายการ</th><th>กก.</th><th>เก็บเงิน</th><th>ต้องถึงก่อน</th><th>ถึงประมาณ</th><th>ลายเซ็น</th></tr></thead><tbody>' +
        t.stops.map(function (s, i) { var paid = s.status === 'paid'; return '<tr><td>' + (i + 1) + '</td><td><b>' + esc(s.name) + '</b><br>' + esc(s.phone || '') + '<br><small>' + esc(s.id) + (s.legs ? ' เที่ยว ' + s.leg + '/' + s.legs : '') + '</small></td><td>' + esc(s.address || '') + (s.deliveryNote ? '<br><b>' + esc(s.deliveryNote) + '</b>' : '') + '</td><td>' + esc(s.items || '') + '</td><td>' + s.kg + '</td><td>' + (paid ? 'จ่ายแล้ว' : baht(s.actual || s.est)) + '</td><td>' + esc(s.due) + '</td><td>' + esc(s.eta) + '</td><td></td></tr>'; }).join('') + '</tbody></table></section>';
      return '<section class="print-trip"><h2>ใบงานส่งของ รอบที่ ' + t.no + ' ' + esc(t.slot) + ' ' + esc(C.zoneName(t.zone) || t.zone) + ' รถ ' + esc(t.bike || '') + '</h2><p>วันที่ ' + C.thDate(A.routeDate) + ' ' + t.stops.length + ' จุด ' + t.kg + ' กก. คนขับ ' + esc(A.riderOf[t.no] || '____________') + ' ออก ____:____ กลับ ____:____</p>' +
        '<table><thead><tr><th>#</th><th>ลูกค้า / โทร</th><th>ที่อยู่ · จุดจอด/คนรับ</th><th>รายการ</th><th>กก.</th><th>ชำระ</th><th>ต้องได้ก่อน</th><th>ถึงเวลา</th><th>ลายเซ็น</th></tr></thead><tbody>' +
        t.stops.map(function (s, i) { var up = (s.orders || [s]).filter(function (o) { return o.status !== 'paid'; }); return '<tr><td>' + (i + 1) + '</td><td><b>' + esc(s.name) + '</b><br>' + esc(s.phone) + '<br><small>' + esc((s.ids || [s.id]).join(', ')) + (s.leg ? ' · เที่ยว ' + s.leg + '/' + s.legs : '') + '</small></td><td>' + esc(s.address) + (s.deliveryNote ? '<br><b>' + esc(s.deliveryNote) + '</b>' : '') + '</td><td>' + esc(s.items) + '</td><td>' + s.kg + '</td><td>' + (up.length ? 'ค้าง ' + baht(up.reduce(function (a, o) { return a + (o.actual || o.est); }, 0)) : 'จ่ายแล้ว') + '</td><td>' + esc(s.needBy || '') + '</td><td></td><td></td></tr>'; }).join('') + '</tbody></table></section>';
    }).join('');
    var el = document.getElementById('print-area'); if (!el) { el = document.createElement('div'); el.id = 'print-area'; document.body.appendChild(el); }
    el.innerHTML = html; document.body.classList.add('printing');
    var done = function () { document.body.classList.remove('printing'); el.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(function () { try { window.print(); } catch (e) { toast('อุปกรณ์นี้พิมพ์ไม่ได้ ใช้ปุ่มดาวน์โหลด .xlsx แทน'); } setTimeout(done, 1500); }, 50);
  }

  /* ใบจัดของ (Picking sheet) ของออเดอร์ที่เลือก: ใช้ตอนจัดของ + คีย์ POS */
  function printPicking(ids) {
    var d = A.d[key(A.tab)] || {}, byId = {}, cfg = d.cfg || {};
    (d.orders || []).forEach(function (o) { byId[o.id] = o; });
    var list = ids.map(function (id) { return byId[id]; }).filter(function (o) { return o && /new|approved/.test(o.status); });
    if (!list.length) { toast('เลือกออเดอร์ที่ "รอตรวจ" หรือ "จัดของ" ก่อน'); return; }
    var pm = {}; (S.cat.products || []).forEach(function (p) { pm[p.sku] = p; });
    var html = list.map(function (o) {
      var rows = [];
      o.bundles.forEach(function (b) { rows.push('<tr class="set"><td colspan="5"><b>เซ็ต ' + esc(b.name) + ' ×' + b.qty + '</b> (' + baht(b.price * b.qty) + ')</td></tr>'); (b.items || []).forEach(function (it) { var p = pm[it[0]]; rows.push('<tr><td>☐</td><td>' + esc(p ? p.name : it[0]) + ' <small>' + esc(it[0]) + '</small></td><td>' + (it[1] * b.qty) + ' ' + esc(p ? p.unit : '') + '</td><td></td><td></td></tr>'); }); });
      o.items.forEach(function (l) { rows.push('<tr><td>☐</td><td>' + esc(l.name) + ' <small>' + esc(l.sku) + '</small></td><td>' + l.qty + ' ' + esc(l.unit || '') + '</td><td>' + baht(l.price) + '</td><td></td></tr>'); });
      return '<section class="print-trip"><h2>ใบจัดของ · ' + esc(o.id) + (o.evening ? ' · รอบเย็น ' + esc(C.evDayText(o.deliverDate)) : '') + '</h2><p><b>' + esc(o.memberName) + '</b> ' + esc(o.sno || '') + ' · โทร ' + esc(o.phone || '-') + ' · สั่ง ' + esc(o.created) + '<br>' +
        (o.mode === 'pickup' ? 'รับที่จุด ' + esc(o.pickup) : o.mode === 'shop' ? 'รับเองที่ร้าน' : 'ส่ง ' + esc(o.slot) + ' ' + esc(C.thDate(o.deliverDate)) + (o.zone ? ' · โซน ' + esc(C.zoneName(o.zone)) : '')) + (o.needBy ? ' · ต้องได้ก่อน ' + esc(o.needBy) : '') + ' · ~' + o.kg + ' กก.' + (o.deliveryNote ? '<br>จุดจอด/คนรับ: <b>' + esc(o.deliveryNote) + '</b>' : '') + '</p>' +
        '<table><thead><tr><th>จัด</th><th>สินค้า</th><th>จำนวน</th><th>ราคา/หน่วย</th><th>น้ำหนักจริง</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>' +
        '<p><b>ทำใน POS:</b> ' + posLines(o, cfg).map(esc).join(' · ') + '<br>ยอดประมาณ ' + baht(o.est) + (o.evening ? ' · <b>รอบเย็น: ' + (o.pay && o.pay.confirmed + 1 >= o.pay.due ? 'จ่ายแล้ว' : 'ยังไม่จ่าย ห้ามออกจากตู้') + '</b> · แพ็กหลัง 16:30 ออกจากตู้ไม่เกิน 60 นาที' : '') + '</p>' +
        '<p>Transaction No. (เลขท้าย ' + (cfg.TXN_DIGITS || 7) + ' หลัก) ______________ ยอด Net-Total ______________ จัดโดย __________ เวลา ____:____</p></section>';
    }).join('');
    var el = document.getElementById('print-area'); if (!el) { el = document.createElement('div'); el.id = 'print-area'; document.body.appendChild(el); }
    el.innerHTML = html; document.body.classList.add('printing');
    var done = function () { document.body.classList.remove('printing'); el.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(function () { try { window.print(); } catch (e) { toast('อุปกรณ์นี้พิมพ์ไม่ได้'); } setTimeout(done, 1500); }, 50);
  }

  /* ---------- สมาชิก ---------- */
  function adMembers(d) {
    var mg = d.migration, pct = mg.total ? mg.moved / mg.total * 100 : 0, edit = can('members'), zones = d.cfg.ZONE_LIST || [];
    var lr = d.linkRequests || [], h = '';
    if (lr.length) h += '<div class="box link-req"><h3>คำขอผูกบัญชีลูกค้าเดิม <span class="cnt-pill">' + lr.length + '</span></h3>' + lr.map(function (x) {
      return '<div class="row"><span><b>' + esc(x.name) + '</b> <span class="mono hint">' + esc(x.sno || '') + '</span><br><small class="hint">LINE ' + esc(x.lineName) + ', เบอร์ที่ให้มา </small>' + tel(x.phone) + '<small class="hint"> ขอเมื่อ ' + esc(x.at) + '</small></span><span class="row-acts">' +
        (edit ? '<button class="btn sm blue" data-a="admLink" data-id="' + esc(x.id) + '" data-ok="1">ใช่ ลูกค้ารายนี้</button><button class="btn sm bad" data-a="admLink" data-id="' + esc(x.id) + '" data-ok="0" data-confirm="1">ไม่ใช่</button>' : '') + '</span></div>';
    }).join('') + '<div class="hint">โทรหาเบอร์ที่ให้มาก่อนกดยืนยัน</div></div>';
    h += '<div class="box"><h3>ลูกค้าเดิมที่ย้ายเข้า OA แล้ว ' + mg.moved + ' / ' + mg.total + ' (' + pct.toFixed(1) + '%)</h3><div class="kg-bar"><span style="width:' + pct + '%"></span></div><div class="hint">เป้า 90% นับเฉพาะลูกค้าเดิมจากฐานร้าน (ไม่นับลูกค้าใหม่ที่สมัครเอง)</div></div>';
    if (can('manage') && (d.privacy || []).length) h += '<div class="box privacy-box"><h3>' + ic('lock') + ' คำขอข้อมูลส่วนบุคคล (' + d.privacy.length + ')</h3><div class="hint">ลูกค้าขอลบข้อมูล · ตรวจว่าไม่มีบิลค้าง แล้วกด "ลบข้อมูลส่วนบุคคล" (ชื่อ เบอร์ เลขผู้เสียภาษี รูปหน้าร้าน ที่อยู่ทุกแห่ง ที่อยู่จัดส่งในออเดอร์เก่า และ LINE ถูกลบ ออเดอร์ที่ยังไม่เปิดบิลถูกยกเลิก ประวัติขายเก็บไว้ตามกฎหมายบัญชี) ภายใน 30 วัน ระบบแจ้งลูกค้าในแชตให้เอง</div>' +
      d.privacy.map(function (x) { return '<div class="row"><span><b>' + esc(x.name) + '</b> ' + esc(x.sno) + ' · ' + tel(x.phone) + '<br><small class="hint">ขอเมื่อ ' + esc(x.at.slice(0, 16)) + '</small></span><span><button class="btn sm bad" data-a="adm" data-op="anonymizeMember" data-id="' + esc(x.id) + '" data-confirm="1">ลบข้อมูลส่วนบุคคล</button> <button class="btn sm" data-a="adm" data-op="privacyDone" data-id="' + esc(x.id) + '" data-confirm="1">ปิดคำขอ (ไม่ต้องลบ)</button></span></div>'; }).join('') + '</div>';
    var pIds = d.pendingMembers.map(function (m) { return m.id; });
    h += '<h3 class="group-h">สมาชิกใหม่รอตรวจ <span class="cnt-pill">' + d.pendingMembers.length + '</span>' + (edit ? pickAll('mnew', pIds) : '') + '</h3>';
    if (edit) h += bulkBar('mnew', [bulkBtn('mnew', 'approveMember', 'อนุมัติ (ใช้เลข S ที่กรอกในแต่ละร้าน)', picked('mnew').length), bulkBtn('mnew', 'rejectMember', 'ปิดบัญชี', picked('mnew').length, { cls: 'bad', confirm: 1 })]);
    if (!d.pendingMembers.length) h += '<div class="empty">ไม่มีรายการรอตรวจ</div>';
    d.pendingMembers.forEach(function (m) {
      h += '<form class="ord" data-form="approveMember" data-id="' + esc(m.id) + '"><div class="ord-h">' + (edit ? pickBox('mnew', m.id, m.name) : '') + '<b>' + esc(m.name) + '</b><span class="pill appr">' + esc(m.sourceKind === 'ref' ? 'ผู้ชวน: ' + m.sourceName : m.sourceKind === 'sign' ? 'ป้าย: ' + m.sourceName : 'สมัครเอง') + '</span>' + mstPill(m.status) + (m.channel ? '<span class="pill">' + esc(m.channel) + '</span>' : '') + (m.flags ? '<span class="pill red">ธงแดง</span>' : '') + '</div>' +
        '<div class="hint">เบอร์ ' + tel(m.phone) + ' · ' + esc(m.type === 'Consumer' ? 'บ้าน (B2C)' : 'ร้าน (B2B)') + ' · ลงทะเบียน ' + esc(C.thDate(m.regDate)) + (m.address ? ' · ' + esc(m.address) : '') + (m.zone ? ' · โซน ' + esc(C.zoneName(m.zone)) : '') + (m.taxId ? ' · เลขภาษี <span class="mono">' + esc(m.taxId) + '</span>' : '') + (m.couponLock ? ' · <b>คูปองรอยืนยันร้าน</b>' : '') + '</div>' + (m.flags ? '<div class="alert bad">' + esc(m.flags) + '</div>' : '') +
        (m.shopPhoto ? '<button class="btn sm" type="button" data-a="admShopPhoto" data-id="' + esc(m.id) + '">ดูรูปหน้าร้าน</button>' : '') +
        (edit && m.status === 'review' ? '<div class="acts"><span class="hint">ระบบสงสัยว่าเป็นลูกค้าเดิม (เลขภาษี/หมุด/ข้อมูลซ้ำ) · ตรวจใน POS แล้วเลือก:</span><button type="button" class="btn sm blue" data-a="adm" data-op="memberStatus" data-id="' + esc(m.id) + '" data-status="new">เป็นลูกค้าใหม่จริง (ให้สิทธิ์)</button><button type="button" class="btn sm" data-a="adm" data-op="memberStatus" data-id="' + esc(m.id) + '" data-status="existing">เป็นลูกค้าเดิม (ไม่ให้สิทธิ์)</button></div>' : '') +
        (edit ? '<div class="acts"><div class="field"><label>เลขสมาชิก S (จาก POS)</label><input name="sno" class="mono" required autocomplete="off"></div><div class="field"><label>โซนส่ง</label><select name="zone"><option value="">—</option>' + zones.map(function (z) { return '<option value="' + esc(z.id) + '"' + (z.id === m.zone ? ' selected' : '') + '>' + esc(z.name) + '</option>'; }).join('') + '</select></div>' +
          (m.flags ? '<label class="chk"><input type="checkbox" name="clearFlags"><span>ตรวจแล้ว ล้างธงแดง (ให้สิทธิ์ลูกค้าใหม่)</span></label>' : '') + '<button class="btn blue" type="submit">อนุมัติ</button><button class="btn bad sm" type="button" data-a="adm" data-op="rejectMember" data-id="' + esc(m.id) + '" data-confirm="1">ปิดบัญชี</button></div>' : '') + '</form>';
    });
    var list = (d.memberList || []).filter(function (m) { return hit(m, ['name', 'phone', 'sno', 'zone', 'address']); });
    h += '<datalist id="trade-list">' + String(d.cfg.TRADES || '').split('|').map(function (t) { return '<option value="' + esc(t.trim()) + '">'; }).join('') + '</datalist>';
    h += '<h3 class="group-h">รายชื่อสมาชิก (' + (d.memberList || []).length + ')</h3>' + searchBox('ค้นหา ชื่อ / เบอร์ / เลข S / โซน') + (can('export') ? '<div class="dl-row"><button class="btn sm" data-a="admExport" data-k="members" data-all="1">' + ic('dl') + ' สมาชิกทั้งหมด .xlsx</button></div>' : '');
    if (edit) h += bulkBar('mem', ['<select id="bulk-zone" aria-label="โซน"><option value="">เลือกโซน…</option>' + zones.map(function (z) { return '<option value="' + esc(z.id) + '">' + esc(z.name) + '</option>'; }).join('') + '</select>', bulkBtn('mem', 'memberZone', 'ตั้งโซน', picked('mem').length)]);
    h += '<div class="tblw"><table><thead><tr>' + (edit ? '<th>' + pickAll('mem', list.slice(0, 200).map(function (m) { return m.id; }), ' ') + '</th>' : '') + '<th>ร้าน</th><th>เบอร์</th><th>เลข S</th><th>โซน</th><th>หมุด</th><th></th></tr></thead><tbody>' + list.slice(0, 200).map(function (m) {
      var open = A.open['mem-' + m.id];
      return '<tr>' + (edit ? '<td class="pick-cell">' + pickBox('mem', m.id, m.name) + '</td>' : '') + '<td>' + esc(m.name) + ' ' + mstPill(m.status) + (m.yard ? ' <span class="pill appr">ลานเย็น ' + esc(m.yard) + '</span>' : '') + (m.approved ? '' : ' <span class="pill new">รออนุมัติ</span>') + (m.links ? ' <span class="pill appr">+' + m.links + ' LINE</span>' : '') + '<br><small class="hint">' + esc([m.trade, m.address, m.deliveryNote ? 'จุดจอด: ' + m.deliveryNote : '', m.needBy ? 'ต้องได้ก่อน ' + m.needBy : ''].filter(Boolean).join(' · ')) + '</small></td><td>' + tel(m.phone) + '</td><td class="mono">' + esc(m.sno) + '</td><td>' + esc(C.zoneName(m.zone) || '-') + '</td><td>' + areaTag(m.areaExc ? 'exc' : m.area) + ' ' + (function () { var a = (m.addresses || []).filter(function (x) { return x.isDefault; })[0] || (m.addresses || [])[0]; return a ? mapLink(a.lat, a.lng, 'ดู') : m.lat ? mapLink(m.lat, m.lng, 'ดู') : ''; })() + '</td><td>' + (edit ? '<button class="btn sm" data-a="admToggle" data-k="mem-' + esc(m.id) + '">' + (open ? 'ปิด' : 'แก้') + '</button>' : '') + '</td></tr>' +
        (open ? '<tr><td colspan="7"><form class="acts" data-form="memberUpdate" data-id="' + esc(m.id) + '"><div class="field"><label>โซน</label><select name="zone"><option value="">—</option>' + zones.map(function (z) { return '<option value="' + esc(z.id) + '"' + (z.id === m.zone ? ' selected' : '') + '>' + esc(z.name) + '</option>'; }).join('') + '</select></div><div class="field"><label>ที่อยู่</label><input name="address" value="' + esc(m.address) + '"></div><div class="field"><label>เบอร์</label><input name="phone" value="' + esc(m.phone) + '"></div>' +
          '<div class="field"><label>จุดจอด / คนรับ / เวลารับได้</label><input name="deliveryNote" value="' + esc(m.deliveryNote || '') + '"></div><div class="field"><label>ต้องได้ก่อน (HH:MM)</label><input name="needBy" value="' + esc(m.needBy || '') + '" placeholder="10:00"></div><div class="field"><label>ประเภทธุรกิจ</label><input name="trade" value="' + esc(m.trade || '') + '" list="trade-list"></div><div class="field"><label>ร้านในลานเย็น (ช่อง เช่น Y1 · ว่าง = ไม่ใช่)</label><input name="yard" maxlength="10" value="' + esc(m.yard || '') + '"></div><button class="btn blue" type="submit">บันทึก</button></form>' + memberV3Tools(m, d) + '</td></tr>' : '');
    }).join('') + '</tbody></table></div>' + (list.length > 200 ? '<div class="hint">แสดง 200 รายการแรก ค้นหาเพื่อดูเพิ่ม</div>' : '');
    var link = d.cfg.LIFF_ID ? C.appLink('link', {}) : '';
    h += '<h3 class="group-h">ลูกค้าเดิมที่ยังไม่ย้าย (เรียงตามยอด)' + (edit ? pickAll('mig', mg.list.map(function (x) { return x.id; })) : '') + '</h3>';
    if (edit) h += bulkBar('mig', ['<button class="btn sm" data-a="admCopyMigrate" data-g="mig">คัดลอกข้อความชวน (' + picked('mig').length + ')</button>', bulkBtn('mig', 'markFollow', 'ทำเครื่องหมาย โทรแล้ว', picked('mig').length, { cls: '' })]);
    h += mg.list.length ? '<div class="tblw"><table><thead><tr>' + (edit ? '<th></th>' : '') + '<th>ร้าน</th><th>เบอร์</th><th class="r">เฉลี่ย/เดือน</th><th>สถานะ</th><th></th></tr></thead><tbody>' + mg.list.map(function (x) {
      return '<tr>' + (edit ? '<td class="pick-cell">' + pickBox('mig', x.id, x.name) + '</td>' : '') + '<td>' + esc(x.name) + '</td><td>' + tel(x.phone) + '</td><td class="r">' + baht(x.avg) + '</td><td>' + (x.follow === 'call' ? 'โทรแล้ว' : x.follow === 'link' ? 'ส่งลิงก์แล้ว' : 'ยังไม่ติดต่อ') + '</td><td style="white-space:nowrap">' + (edit ? '<button class="btn sm" data-a="copyMigrate" data-id="' + esc(x.id) + '" data-name="' + esc(x.name) + '" data-link="' + esc(link) + '">คัดลอกข้อความชวน</button> <button class="btn sm" data-a="adm" data-op="markFollow" data-id="' + esc(x.id) + '" data-status="call">โทรแล้ว</button>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="empty">ย้ายครบแล้ว</div>';
    if (can('manage')) h += memberImportBox();
    return h;
  }
  /* นำเข้า/อัปเดตรายชื่อลูกค้าเดิม (Customer master จาก POS/SAP) */
  function memberImportBox() {
    var im = A.imp, h = '<div class="box"><h3>' + ic('users') + ' นำเข้า / อัปเดตรายชื่อลูกค้าเดิม (Customer master)</h3><div class="hint">ไฟล์ .xlsx/.csv หัวตาราง: s_member_no, name, phone, type (FS/Consumer), address, zone, lat, lng, trade, contact, avg_month, tax_id · จับคู่ด้วยเลข S ก่อน แล้วค่อยเบอร์ · ลูกค้าในไฟล์ = ลูกค้าเดิม (ไม่ได้สิทธิ์ลูกค้าใหม่) · เลขภาษีใช้ตรวจร้านที่สมัครซ้ำ · ไม่แตะการผูก LINE · ใช้ข้อมูลสมมติในระบบทดลอง</div>' +
      '<div class="acts" style="margin-top:8px"><input type="file" accept=".xlsx,.csv" data-chg="admImport"><button class="btn sm" data-a="admImportTpl">' + ic('dl') + ' แม่แบบ .xlsx</button></div>';
    if (im) {
      h += '<div class="kv" style="margin-top:8px"><div><small>ใหม่</small><b>' + im.sum.new + '</b></div><div><small>อัปเดต</small><b>' + im.sum.update + '</b></div><div><small>ชน / ข้าม</small><b>' + im.sum.conflict + ' / ' + im.sum.skip + '</b></div></div>' +
        '<div class="tblw" style="margin-top:6px;max-height:320px"><table><thead><tr><th>แถว</th><th>ผล</th><th>เลข S</th><th>ชื่อ</th><th>เบอร์</th><th>หมายเหตุ</th></tr></thead><tbody>' + im.check.slice(0, 300).map(function (r) { return '<tr class="' + (r.act === 'conflict' ? 'bad' : r.act === 'skip' ? 'warn' : '') + '"><td>' + r.row + '</td><td>' + ({ 'new': 'เพิ่มใหม่', update: 'อัปเดต' + (r.target ? ' ' + esc(r.target) : ''), skip: 'ข้าม', conflict: 'ชนกัน' }[r.act]) + '</td><td class="mono">' + esc(r.sno) + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.phone) + '</td><td>' + esc(r.why) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<div class="acts" style="margin-top:8px"><button class="btn blue" data-a="admImportSave">บันทึก (เพิ่ม ' + im.sum.new + ' · อัปเดต ' + im.sum.update + ')</button><button class="btn" data-a="admImportCancel">ยกเลิกไฟล์นี้</button></div>';
    }
    return h + '</div>';
  }

  /* ---------- ชวนเพื่อน & ป้าย ---------- */
  function adAff(d) {
    var mg = can('manage');
    var offs = (d.offers || []).filter(function (o) { return o.active; });
    var h = offs.length && d.cfg.OFFERS_ENABLED ? '<div class="box"><h3>กติกาส่วนลดที่ใช้อยู่ (แท็บ Offers)</h3>' + offs.map(function (o) { return '<div class="row"><span><b class="mono">' + esc(o.id) + '</b> ' + esc(o.label) + '</span><span class="hint">' + (o.kind === 'referrer' ? 'ผู้ชวนได้' : 'ลูกค้าใหม่ได้') + ' · ' + esc(o.steps) + (o.min_bill ? ' · ขั้นต่ำ ' + esc(o.min_bill) : '') + ' · ' + o.days + ' วัน</span></div>'; }).join('') + '<div class="hint">เปิด/ปิด หรือแก้จำนวนเงินได้ที่ชีต Offers คอลัมน์ active / steps (มีผลภายใน 1 นาที) · ลูกค้าที่ได้สิทธิ์ไปแล้วใช้กติกาเดิมจนหมดอายุ</div></div>' : '';
    h += affV3(d);
    var cIds = d.coinsPending.filter(function (c) { return c.paid; }).map(function (c) { return c.id; });
    if (d.coinsPending.length || d.cfg.REF_REWARD !== 'points') h += '<div class="box"><h3>ส่วนลดสะสม (Coin) รออนุมัติ' + (d.cfg.REF_REWARD === 'points' ? ' · กติกาเดิมของเพื่อนที่ชวนก่อน v3' : '') + (mg ? pickAll('coin', cIds, 'เลือกที่จ่ายแล้วทั้งหมด') : '') + '</h3><div class="hint">ปล่อยได้เมื่อบิลของเพื่อนจ่ายแล้ว · ผู้ชวนใช้ลดบิลถัดไปได้เฉพาะสินค้าร่วมรายการ</div>' + (mg ? bulkBar('coin', [bulkBtn('coin', 'approveCoin', 'อนุมัติที่เลือก', picked('coin').length)]) : '') + (d.coinsPending.length ? (mg ? '<button class="btn sm blue" data-a="adm" data-op="approveCoins" style="margin:6px 0">อนุมัติทั้งหมดที่จ่ายแล้ว</button>' : '') + '<div class="tblw"><table><thead><tr>' + (mg ? '<th></th>' : '') + '<th>ผู้ชวน</th><th>จากบิลของ</th><th>บิล</th><th class="r">ยอดบิล</th><th class="r">Coin</th><th></th></tr></thead><tbody>' +
      d.coinsPending.map(function (c) { return '<tr>' + (mg ? '<td class="pick-cell">' + (c.paid ? pickBox('coin', c.id, c.owner) : '') + '</td>' : '') + '<td>' + esc(c.owner) + '</td><td>' + esc(c.from) + '</td><td class="mono">' + esc(c.order) + '</td><td class="r">' + baht(c.actual) + '</td><td class="r">' + fmt(c.amount) + '</td><td>' + (c.paid ? (mg ? '<button class="btn sm blue" data-a="adm" data-op="approveCoin" data-id="' + esc(c.id) + '">อนุมัติ</button>' : '<span class="pill paid">พร้อมอนุมัติ</span>') : '<span class="pill new">บิลยังไม่จ่าย</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty">ไม่มี</div>') + '</div>';
    h += '<div class="box"><h3>ผู้ชวน (' + (d.cfg.REF_SCOPE === 'all' ? 'เปิดทุกคน' : 'เฉพาะกลุ่มนำร่อง') + ')</h3>' + (d.referrers.length ? d.referrers.map(function (r) {
      return '<div class="ord"><div class="ord-h"><b>' + esc(r.name) + '</b><span class="mono hint">' + esc(r.sno) + '</span><span class="hint">ชวนแล้ว ' + r.refs + ' · ส่วนลดเดือนนี้ ' + baht(r.coinMonth) + ' · ใช้ได้ ' + baht(r.bal) + '</span></div>' +
        (r.link ? '<div class="copy"><input readonly value="' + esc(r.link) + '" aria-label="ลิงก์ชวน"><button class="btn sm" data-a="copy" data-t="' + esc(r.link) + '">คัดลอกลิงก์ชวน</button></div>' : '<div class="alert warn">ตั้ง LIFF_ID ในชีต Config ก่อน</div>') + '</div>';
    }).join('') : '<div class="empty">ยังไม่มี</div>') +
      (mg ? '<form class="acts" data-form="setPilot" style="margin-top:8px"><div class="field"><label>ให้สิทธิ์ชวนเพื่อน (กลุ่มนำร่อง) · เลือกให้หลากหลายประเภทธุรกิจ เพื่อให้ผู้ชวนกับเพื่อนไม่แข่งกันเอง</label><select name="id">' + d.members.filter(function (m) { return !m.pilot; }).map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.name) + ' · ' + esc(m.sno) + (m.trade ? ' · ' + esc(m.trade) : '') + '</option>'; }).join('') + '</select></div><button class="btn sm" type="submit">ให้สิทธิ์</button></form>' : '') + '</div>';
    if (d.flagged.length) h += '<div class="box"><h3>ธงแดง</h3>' + d.flagged.map(function (f) { return '<div class="row"><span>' + esc(f.name) + '<br><small class="hint">' + esc(f.flags) + '</small></span><span>' + (f.rejected ? 'ปิดบัญชี' : f.approved ? 'อนุมัติแล้ว' : 'รอตรวจ') + '</span></div>'; }).join('') + '</div>';
    h += '<div class="box"><h3>พาร์ทเนอร์ & ป้าย QR</h3>' + d.partners.map(function (p) {
      return '<div class="ord"><div class="ord-h"><b class="mono">' + esc(p.id) + '</b><b>' + esc(p.name) + '</b><span class="hint">' + esc(p.type) + ' · ' + esc(p.area) + '</span></div><div class="hint">สแกน ' + p.scans + ' · ลูกค้า ' + p.members + ' · ออเดอร์เดือนนี้ ' + p.orders + ' · ยอด ' + baht(p.sales) + ' · ส่วนแบ่ง ' + baht(p.share) + (p.share < p.minPayout ? ' (ยกไปเดือนหน้า)' : '') + '</div>' +
        (p.link ? '<div class="qr"><div class="code">' + C.qrSvg(p.link) + '</div><span class="hint">QR สำหรับพิมพ์ติดป้าย</span></div><div class="copy"><input readonly value="' + esc(p.link) + '" aria-label="ลิงก์ป้าย"><button class="btn sm" data-a="copy" data-t="' + esc(p.link) + '">คัดลอกลิงก์ป้าย</button></div>' +
          (mg ? '<div class="copy"><input readonly value="' + esc(p.joinLink) + '" aria-label="ลิงก์ผูกพาร์ทเนอร์"><button class="btn sm" data-a="copy" data-t="' + esc(p.joinLink) + '">ลิงก์ให้เจ้าของจุด</button></div>' : '') + '<div class="hint">' + (p.bound ? 'เจ้าของจุดผูกบัญชีแล้ว' : 'ส่งลิงก์ให้เจ้าของจุดเปิดใน LINE เพื่อดูยอดของตัวเอง') + '</div>' : '<div class="alert warn">ตั้ง LIFF_ID ในชีต Config ก่อน</div>') + '</div>';
    }).join('') + (mg ? '<form class="acts" data-form="createSign" style="margin-top:8px"><div class="field"><label>ชื่อจุดใหม่</label><input name="name" required></div><div class="field"><label>ประเภท</label><input name="type" placeholder="ร้านใต้คอนโด"></div><div class="field"><label>ที่ตั้ง</label><input name="area"></div><button class="btn sm" type="submit">สร้างป้ายใหม่</button></form>' : '') + '</div>';
    h += '<div class="box"><h3>Funnel 90 วัน: สแกน → ลงทะเบียน → บิลแรก → ซื้อซ้ำ</h3><div class="hint">นับการเปิดลิงก์จาก QR ป้ายและลิงก์ชวน (คนสแกน = ไม่ซ้ำกัน) · ใช้ดูว่าป้ายไหนคุ้ม และหยุดป้ายที่ไม่เกิดออเดอร์ใน 4–6 สัปดาห์</div>' +
      ((d.funnel || []).length ? '<div class="tblw"><table class="funnel-table"><thead><tr><th>แหล่งที่มา</th><th>สแกน</th><th>คนสแกน</th><th>ลงทะเบียน</th><th>บิลแรก</th><th>ซื้อซ้ำ</th><th>ยอดขาย</th></tr></thead><tbody>' + d.funnel.map(function (f) { return '<tr><td>' + (f.kind === 'sign' ? '<span class="pill appr">ป้าย</span> ' : '<span class="pill paid">ผู้ชวน</span> ') + esc(f.name) + ' <small class="mono hint">' + esc(f.ref) + '</small></td><td>' + f.scans + '</td><td>' + f.scanners + '</td><td>' + f.members + '</td><td>' + f.first + '</td><td>' + f.repeat + '</td><td>' + baht(f.sales) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty">ยังไม่มีการสแกนหรือลงทะเบียนจากป้าย/ลิงก์ชวน</div>') + '</div>';
    if (can('export')) h += '<div class="dl-row">' + [['coins', 'ส่วนลดสะสม'], ['shares', 'ส่วนแบ่งพาร์ทเนอร์'], ['funnel', 'Funnel']].map(function (k) { return '<button class="btn sm" data-a="admExport" data-k="' + k[0] + '" data-month="1">' + ic('dl') + ' ' + k[1] + ' เดือนนี้ .xlsx</button>'; }).join('') + (mg ? '<button class="btn sm" data-a="admExport" data-k="points" data-month="1">' + ic('dl') + ' ไฟล์แต้มรายเดือน (โอนเข้าระบบสมาชิก) .xlsx</button>' : '') + '<button class="btn sm" data-a="admExport" data-k="pointsLedger" data-month="1">' + ic('dl') + ' สมุดแต้มเดือนนี้ .xlsx</button><button class="btn sm" data-a="admExport" data-k="channels" data-all="1">' + ic('dl') + ' ช่องทางและ QR .xlsx</button></div>';
    return h;
  }

  /* ---------- ราคา & สต็อก ---------- */
  function adPrice(d) {
    var h = '', mg = can('manage');
    if (d.staging) h += '<div class="alert info">มีราคาใหม่รอมีผล ' + esc(C.thDate(d.staging.effective)) + ' (' + d.staging.rows.length + ' SKU จาก ' + esc(d.staging.file) + ')' + (mg ? ' <button class="btn sm blue" data-a="adm" data-op="priceApply" data-confirm="1">มีผลตอนนี้</button> <button class="btn sm" data-a="adm" data-op="priceCancel" data-confirm="1">ยกเลิก</button>' : '') + '</div>';
    if (mg) {
      h += '<div class="box"><h3>อัปโหลดราคาสัปดาห์หน้า</h3><div class="hint">ไฟล์ .xlsx หรือ .csv ใช้แม่แบบจากปุ่มด้านขวา</div>' +
        '<div class="acts" style="margin-top:8px"><input type="file" id="priceFile" accept=".xlsx,.csv" data-chg="priceFile"><button class="btn sm" data-a="admExport" data-k="products">' + ic('dl') + ' ดาวน์โหลดราคาปัจจุบันเป็นแม่แบบ</button></div>';
      var ck = A.check;
      if (ck) {
        var errs = ck.rows.filter(function (r) { return r.err; }).length, warns = ck.rows.filter(function (r) { return r.warn && r.warn !== 'สินค้าใหม่'; }).length + ck.missing.length;
        h += '<div style="margin-top:8px">' + (errs ? '<div class="alert bad">มี ' + errs + ' แถวที่ผิด แก้ไฟล์แล้วอัปโหลดใหม่ หรือข้ามแถวนั้น (คงราคาเดิม)</div>' : '') + (warns ? '<div class="alert warn">มี ' + warns + ' จุดที่ควรตรวจกับใบราคาส่วนกลาง</div>' : '') + (!errs && !warns ? '<div class="alert ok">ไฟล์ผ่านการตรวจ</div>' : '') + '</div>';
        h += '<div class="tblw" style="margin-top:6px"><table><thead><tr><th>SKU</th><th>สินค้า</th><th>ราคาเดิม</th><th>ราคาใหม่</th><th>ผลตรวจ</th></tr></thead><tbody>' + ck.rows.map(function (r) {
          return '<tr class="' + (r.err ? 'bad' : r.warn && r.warn !== 'สินค้าใหม่' ? 'warn' : '') + '"><td class="mono">' + esc(r.sku) + '</td><td>' + esc(r.name) + '</td><td>' + (r.old ? r.old.map(function (t) { return t.min + '+ ' + t.price; }).join(' · ') : '–') + '</td><td>' + r.tiers.map(function (t) { return t.min + '+ ' + t.price; }).join(' · ') + '</td><td>' + esc(r.err || r.warn || 'ผ่าน') + '</td></tr>';
        }).join('') + ck.missing.map(function (r) { return '<tr class="warn"><td class="mono">' + esc(r.sku) + '</td><td>' + esc(r.name) + '</td><td>' + r.tiers.map(function (t) { return t.min + '+ ' + t.price; }).join(' · ') + '</td><td>–</td><td>ไม่มีในไฟล์ คงราคาเดิม</td></tr>'; }).join('') + '</tbody></table></div>';
        h += '<form class="acts" data-form="priceSave" style="margin-top:8px"><div class="field"><label>มีผลตั้งแต่ (00:00)</label><input type="date" name="effective" value="' + addDays(today(), 1) + '" required></div>' + (errs ? '<label class="chk"><input type="checkbox" name="skip"><span>ข้ามแถวที่ผิด</span></label>' : '') + (warns ? '<label class="chk"><input type="checkbox" name="warnOk"><span>ตรวจจุดที่เตือนแล้ว</span></label>' : '') + '<button class="btn blue" type="submit">บันทึกราคาใหม่</button><button class="btn" type="button" data-a="clearCheck">ยกเลิกไฟล์นี้</button></form><div class="hint">ใส่วันที่เป็นวันนี้ = มีผลทันที</div>';
      }
      h += '</div>';
    }
    var stk = can('stock'), list = d.products.filter(function (p) { return hit({ sku: p.sku, name: p.name, alias: (p.alias || []).join(' ') }, ['sku', 'name', 'alias']); }), pIds = list.map(function (p) { return p.sku; }), np = picked('prod').length;
    if (stk || mg) h += bulkBar('prod', [stk ? bulkBtn('prod', 'setStockOn', 'มีของ', np, { cls: '' }) : '', stk ? bulkBtn('prod', 'setStockOff', 'หมดวันนี้', np, { cls: 'bad' }) : '', mg ? bulkBtn('prod', 'imgReset', 'คืนรูปเริ่มต้น', np, { cls: '', confirm: 1 }) : '', mg ? bulkBtn('prod', 'imgClear', 'ลบรูป', np, { cls: 'bad', confirm: 1 }) : '']);
    h += '<div class="box"><div class="section-heading"><h3>สินค้า ราคา และสต๊อกวันนี้ <span class="cnt-pill">' + list.length + '</span></h3>' + (stk || mg ? pickAll('prod', pIds) : '') + '</div>' + searchBox('ค้นหาชื่อสินค้า หรือ SKU') +
      (mg ? '<div class="hint">ช่องใต้ชื่อสินค้า = คำที่ลูกค้าพิมพ์สั่งในแชต บันทึกเองเมื่อออกจากช่อง</div>' : '') +
      (list.length ? '<div class="tblw" style="margin-top:6px"><table class="price-table"><thead><tr>' + (stk || mg ? '<th></th>' : '') + '<th>รูป</th><th>SKU</th><th>สินค้า</th><th>ขั้นราคา</th><th>ร่วมโปร</th><th>มีของ</th></tr></thead><tbody>' + list.map(function (p) {
      return '<tr>' + (stk || mg ? '<td class="pick-cell">' + pickBox('prod', p.sku, p.name) + '</td>' : '') + '<td class="img-cell">' + C.thumb(p, 'product-photo sm', p.cat) + (mg ? imgBtns('p', p) : '') + '</td><td class="mono">' + esc(p.sku) + '</td><td>' + esc(p.name) + (mg ? '<div class="alias-row"><input data-chg="admAlias" data-sku="' + esc(p.sku) + '" value="' + esc((p.alias || []).join(', ')) + '" placeholder="เช่น หมูสับ, หมูบด" aria-label="คำที่ลูกค้าพิมพ์สั่ง ' + esc(p.name) + '"><small class="save-st" aria-live="polite"></small></div>' : (p.alias && p.alias.length ? '<br><small class="hint">คำเรียก: ' + esc(p.alias.join(', ')) + '</small>' : '')) + '</td><td><div class="tier-lines">' + p.tiers.map(function (t) { return '<span>' + t.min + '+ ' + esc(p.unit || '') + ' <b>' + baht(t.price) + '</b></span>'; }).join('') + '</div></td><td>' + (p.promo ? 'ใช่' : '') + '</td><td>' +
        (can('stock') ? '<input type="checkbox" data-chg="stock" data-sku="' + esc(p.sku) + '"' + (p.inStock ? ' checked' : '') + ' aria-label="มีของ ' + esc(p.name) + '">' : (p.inStock ? 'มี' : 'หมด')) + (p.inStock ? '' : '<br><small class="hint">' + esc(sellNote(p)) + '</small>') + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="empty">ไม่พบสินค้าที่ค้นหา</div>') + '</div>';
    if (mg && (d.bundles || []).length) h += '<div class="box"><h3>รูปเซ็ตคุ้ม</h3><div class="hint">ชื่อ ราคา และรายการในเซ็ต แก้ในชีต Bundles</div><div class="tblw" style="margin-top:6px"><table><thead><tr><th>รูป</th><th>รหัส</th><th>เซ็ต</th><th class="r">ราคา</th><th>สถานะ</th></tr></thead><tbody>' + d.bundles.map(function (b) {
      return '<tr><td class="img-cell">' + C.thumb(b, 'product-photo sm', 'set') + imgBtns('b', b) + '</td><td class="mono">' + esc(b.id) + '</td><td>' + esc(b.name) + '</td><td class="r">' + baht(b.price) + '</td><td>' + (b.active ? 'เปิดขาย' : 'ปิด') + '</td></tr>';
    }).join('') + '</tbody></table></div></div>';
    return h;
  }
  function imgBtns(kind, x) {
    var id = kind === 'b' ? x.id : x.sku;
    return '<div class="img-acts"><label class="btn sm"><input type="file" accept="image/*" hidden data-chg="admPhoto" data-k="' + kind + '" data-id="' + esc(id) + '">' + ic('img') + ' รูป</label>' +
      (x.img ? '<button class="btn sm" data-a="admImg" data-k="' + kind + '" data-id="' + esc(id) + '" data-mode="clear" data-confirm="1">ลบรูป</button>' : '') +
      (x.imgDef && x.img !== x.imgDef ? '<button class="btn sm" data-a="admImg" data-k="' + kind + '" data-id="' + esc(id) + '" data-mode="reset">คืนรูปเดิม</button>' : '') + '</div>';
  }

  /* ---------- รายงาน ---------- */
  function adReport(d) {
    var r = d.report;
    var h = rangeBar([]) + '<div class="report-grid">' + [['ออเดอร์', fmt(r.orders), r.cancelled ? 'ยกเลิก ' + r.cancelled : ''], ['ยอดเปิดบิล', baht(r.billed), 'ยอดประมาณ ' + baht(r.est)], ['รับเงินแล้ว', baht(r.paid), 'ยอดตามบิลที่ชำระครบ ตามวันที่สั่ง'],
      ['ค้างชำระ (ทั้งหมด)', baht(r.outstanding), ''], ['เฉลี่ยต่อบิล', baht(r.avg), ''], ['สมาชิกใหม่', fmt(r.members), ''], ['น้ำหนักรวม', (Math.round(r.kg * 10) / 10) + ' กก.', ''], ['คูปอง / ส่วนลดสะสม', baht(r.coupon) + ' / ' + baht(r.coin), 'ส่วนลดที่ให้']]
      .map(function (x) { return '<div class="stat-card"><span>' + x[0] + '</span><strong>' + x[1] + '</strong>' + (x[2] ? '<small class="hint">' + x[2] + '</small>' : '') + '</div>'; }).join('') + '</div>';
    if (r.days.length) {
      var max = Math.max.apply(null, r.days.map(function (x) { return x.sales; }).concat([1]));
      h += '<div class="box"><h3>ยอดรายวัน</h3><div class="bars">' + r.days.map(function (x) { return '<div class="bar-row"><span>' + C.thDate(x.date) + '</span><div class="bar"><i style="width:' + (x.sales / max * 100) + '%"></i></div><b>' + baht(x.sales) + '</b><small>' + x.orders + ' บิล</small></div>'; }).join('') + '</div></div>';
    }
    h += kpiBox(d) + areaBox(d);
    var at = r.attach || { by: { FS: {}, Consumer: {} }, bundles: [] }, tp = r.trips || {}, am = r.adminMin || {};
    h += '<div class="report-grid">' + [['Attach rate เซ็ต · ร้านอาหาร', (at.by.FS.rate || 0) + '%', (at.by.FS.withBundle || 0) + ' จาก ' + (at.by.FS.orders || 0) + ' ออเดอร์ · เป้า ≥15%'], ['Attach rate เซ็ต · ครัวเรือน', (at.by.Consumer.rate || 0) + '%', (at.by.Consumer.withBundle || 0) + ' จาก ' + (at.by.Consumer.orders || 0) + ' ออเดอร์'],
      ['เวลาสั่ง → เปิดบิล', am.avg === null || am.avg === undefined ? '–' : am.avg + ' นาที', 'เฉลี่ยจาก ' + (am.n || 0) + ' บิล (ใช้แทนเวลาแอดมินต่อออเดอร์)'], ['รอบส่ง/วัน', tp.perDay === null || tp.perDay === undefined ? '–' : tp.perDay, (tp.trips || 0) + ' รอบใน ' + (tp.tripDays || 0) + ' วันที่จดรอบ'],
      ['กก. / นาที / กม. ต่อรอบ', (tp.kgAvg === null || tp.kgAvg === undefined ? '–' : tp.kgAvg) + ' / ' + (tp.minAvg === null || tp.minAvg === undefined ? '–' : tp.minAvg) + ' / ' + (tp.kmAvg === null || tp.kmAvg === undefined ? '–' : tp.kmAvg), 'จากสมุดจดรอบ'], ['ต้นทุนต่อบิลส่ง', tp.costPerDrop === null || tp.costPerDrop === undefined ? '–' : baht(tp.costPerDrop), 'ค่าจ้าง+เช่ารถ+น้ำมัน ' + baht(tp.fixedCost || 0) + ' (' + (tp.days || 0) + ' วันที่ผ่านมา) ÷ ' + (tp.drops || 0) + ' บิลที่ส่งแล้ว']]
      .map(function (x) { return '<div class="stat-card"><span>' + x[0] + '</span><strong>' + x[1] + '</strong><small class="hint">' + x[2] + '</small></div>'; }).join('') + '</div>';
    var ev = r.evening;
    if (ev && (ev.orders || (ev.yard && ev.yard.stalls))) {
      var y = ev.yard || {};
      h += '<div class="box"><h3>Evening Extension · รอบเย็น + ลานเย็น</h3><div class="report-grid">' + [['ออเดอร์รอบเย็น', fmt(ev.orders), 'เฉลี่ย ' + ev.perNight + ' จุด/คืน · ' + ev.nights + ' คืน · เป้าทดลอง ≥ 4'], ['ยอดรอบเย็น', baht(ev.sales), 'ใช้โควตา ' + ev.fill + '% ของ ' + ev.quota + ' จุด/คืน'],
        ['ค่าส่งรอบเย็น (ประมาณ)', baht(ev.cost), '< 4 จุด/คืน = ไรเดอร์พาร์ทเนอร์ต่อจุด · ≥ 4 = OT ไรเดอร์ร้าน'], ['GP หลังค่าส่ง', ev.gp === null || ev.gp === undefined ? '–' : baht(ev.gp), 'จากต้นทุนในแท็บ Costs'],
        ['เลื่อนเพราะยังไม่จ่าย', fmt(ev.moved), 'ยังไม่ชำระ ' + ev.unpaid], ['ร้านในลานเย็น', fmt(y.stalls || 0) + ' ร้าน', (y.nights || 0) + ' คืนลานเย็นในช่วงนี้'],
        ['ร้านในลานซื้อของจากเรา', baht(y.buys || 0), 'เฉลี่ย ' + baht(y.perStallNight || 0) + '/ร้าน/คืน · ถึง ' + baht(y.min || 0) + ' ' + (y.metMin || 0) + '/' + (y.stallNights || 0) + ' ครั้ง'], ['สมาชิกใหม่จาก QR ลานเย็น', fmt(y.newMembers || 0), 'ลงทะเบียนผ่านป้ายประเภท "ลานเย็น"']]
        .map(function (x) { return '<div class="stat-card"><span>' + x[0] + '</span><strong>' + x[1] + '</strong><small class="hint">' + x[2] + '</small></div>'; }).join('') + '</div><div class="hint">เกณฑ์ไปต่อ (Go) หลังทดลอง 4 สัปดาห์: รอบเย็น ≥ 4 ออเดอร์/คืน และร้านในลานซื้อ ≥ ' + baht(y.min || 500) + '/คืน</div></div>';
    }
    if (r.top.length) h += '<div class="box"><h3>สินค้าขายดี (ตามยอดในออเดอร์)' + (r.hasCost ? ' · GP จากแท็บ Costs' : '') + '</h3><div class="tblw"><table><thead><tr><th>SKU</th><th>สินค้า</th><th class="r">จำนวน</th><th class="r">ยอด</th>' + (r.hasCost ? '<th class="r">GP</th><th class="r">GP%</th>' : '') + '</tr></thead><tbody>' + r.top.map(function (x) { return '<tr><td class="mono">' + esc(x.sku) + '</td><td>' + esc(x.name) + '</td><td class="r">' + fmt(x.qty) + '</td><td class="r">' + baht(x.sales) + '</td>' + (r.hasCost ? '<td class="r">' + (x.gp === undefined ? '–' : baht(x.gp)) + '</td><td class="r">' + (x.gpPct === undefined ? '–' : x.gpPct + '%') + '</td>' : '') + '</tr>'; }).join('') + '</tbody></table></div></div>';
    if (at.bundles.length) h += '<div class="box"><h3>เซ็ตที่ขายได้</h3><div class="tblw"><table><thead><tr><th>เซ็ต</th><th class="r">จำนวน</th><th class="r">ยอด</th><th class="r">GP</th></tr></thead><tbody>' + at.bundles.map(function (b) { return '<tr><td>' + esc(b.name) + ' <small class="mono hint">' + esc(b.id) + '</small></td><td class="r">' + fmt(b.qty) + '</td><td class="r">' + baht(b.sales) + '</td><td class="r">' + (b.gp === undefined ? '–' : baht(b.gp) + ' (' + b.gpPct + '%)') + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    if ((r.cohort || []).length) h += '<div class="box"><h3>ลูกค้าใหม่กลับมาซื้อซ้ำ (cohort ตามเดือนที่ลงทะเบียน)</h3><div class="hint">% ของสมาชิกใหม่ที่มีบิลที่ 2 ภายใน 30/60/90/180 วันนับจากบิลแรก · เกณฑ์ทีม: ≥20–28% ใน 6 เดือน</div><div class="tblw"><table class="cohort-table"><thead><tr><th>เดือน</th><th>กลุ่ม</th><th>สมาชิกใหม่</th><th>มีบิลแรก</th><th>30 วัน</th><th>60 วัน</th><th>90 วัน</th><th>180 วัน</th></tr></thead><tbody>' + r.cohort.map(function (c) { return '<tr><td>' + esc(c.month) + '</td><td>' + esc(c.type) + ' <small class="hint">' + esc(Object.keys(c.src || {}).map(function (k) { return ({ ref: 'ชวน', sign: 'ป้าย', self: 'เอง', existing: 'เดิม' }[k] || k) + ' ' + c.src[k]; }).join(' ')) + '</small></td><td>' + c.n + '</td><td>' + c.first + '</td><td>' + c.d30Pct + '%</td><td>' + c.d60Pct + '%</td><td>' + c.d90Pct + '%</td><td>' + c.d180Pct + '%</td></tr>'; }).join('') + '</tbody></table></div></div>';
    if (can('export')) h += '<div class="box"><h3>' + ic('dl') + ' ดาวน์โหลด Excel (.xlsx) ตามช่วงวันที่ด้านบน</h3><div class="dl-grid">' + [['orders', 'ออเดอร์'], ['lines', 'รายการสินค้าในออเดอร์'], ['payments', 'การชำระเงิน'], ['members', 'สมาชิกใหม่'], ['coins', 'ส่วนลดสะสม'], ['credits', 'เครดิต (โอนเกิน)'], ['shares', 'ส่วนแบ่งพาร์ทเนอร์'], ['trips', 'สมุดจดรอบส่ง'], ['funnel', 'Funnel ป้าย/ผู้ชวน'], ['kpi', 'KPI รายช่องทาง'], ['promo', 'การใช้โปร'], ['pointsLedger', 'สมุดแต้ม'], ['areaLog', 'ลูกค้านอกพื้นที่'], ['stock', 'สต็อกและ buffer'], ['channels', 'ช่องทางและ QR']].concat(can('manage') ? [['audit', 'ประวัติการแก้ไข'], ['points', 'ไฟล์แต้มรายเดือน']] : [])
      .map(function (k) { return '<button class="btn sm" data-a="admExport" data-k="' + k[0] + '">' + k[1] + '</button>'; }).join('') + '</div></div>';
    return h;
  }

  /* ---------- บรอดแคสต์ ---------- */
  var SEGS = [['all', 'เพื่อนทั้งหมด'], ['FS', 'Food Service'], ['Consumer', 'Consumer'], ['dormant', 'ไม่ได้สั่งเกิน 14 วัน'], ['referred', 'ลูกค้าใหม่จากคำชวน'], ['sign', 'ลูกค้าจากป้าย']];
  function adBc(d) {
    var q = d.quota || { used: 0, plan: 0 };
    var h = '<form class="box form" data-form="broadcast"><h3>บรอดแคสต์แบ่งกลุ่ม</h3><div class="field"><label>กลุ่ม</label><select name="segment">' + SEGS.map(function (s) { var sg = d.segments || {}, n = sg[s[0]] || 0, lv = sg.live && sg.live[s[0]] !== undefined ? sg.live[s[0]] : n; return '<option value="' + s[0] + '" data-live="' + lv + '">' + s[1] + ' (' + n + ' คน)' + (lv !== n ? ' คนจริง ' + lv + ', ลูกค้าทดสอบ ' + (n - lv) : '') + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>ข้อความ</label><select name="template"><option value="bundle">เซ็ตคุ้มเดือนนี้</option><option value="pom">สินค้าแห่งเดือน</option><option value="winback">ชวนกลับมาสั่ง</option>' + (d.cfg.SMART_ENABLED !== false ? '<option value="smart">Smart Set วันนี้ (ราคาลด 30% ถึง 23:59)</option>' : '') + '</select></div><div class="hint">ทุกผู้รับใช้ 1 ข้อความในโควตา · ใช้ไปแล้ว ' + fmt(q.used) + ' / ' + (q.plan ? fmt(q.plan) : 'ไม่จำกัด') + (q.source === 'line' ? '' : ' (ประมาณ)') + ' · แพ็กเกจฟรีส่งเกินโควตาไม่ได้</div><button class="btn blue" type="submit">ส่ง</button></form>';
    h += '<div class="box"><h3>ส่งแล้ว</h3>' + ((d.broadcasts || []).length ? d.broadcasts.map(function (b) { return '<div class="row"><span>' + esc(b.time) + ' · ' + esc(b.template) + ' · ' + esc(b.segment) + (b.by ? ' · ' + esc(b.by) : '') + '</span><span>' + b.n + ' คน</span></div>'; }).join('') : '<div class="hint">ยังไม่ได้ส่ง</div>') + '</div>';
    return h;
  }

  /* ---------- ทีมงาน (ผู้จัดการ) ---------- */
  function adTeam(d) {
    var me = S.me.userId, roles = d.roles || [];
    var h = '<div class="box"><h3>' + ic('users') + ' ทีมงาน (' + d.staff.filter(function (s) { return s.active; }).length + ' คนใช้งานอยู่)</h3><div class="hint">ทุกคนเข้าทีมด้วยวิธีเดียวกัน: ผู้จัดการสร้างลิงก์เชิญ → ส่งให้ทาง LINE → เขากดลิงก์แล้วกดยืนยัน · ลาออก/ย้ายงาน กด "ปิดสิทธิ์" ได้ทันที</div>';
    h += d.staff.map(function (s) {
      return '<div class="team-row' + (s.active ? '' : ' off') + '"><div><b>' + esc(s.name) + (s.uid === me ? ' (คุณ)' : '') + '</b><small class="hint">' + (s.active ? 'ใช้งานอยู่' : 'ปิดสิทธิ์แล้ว') + ' · เข้าร่วม ' + esc(C.thDate(s.added)) + (s.lastSeen ? ' · ใช้งานล่าสุด ' + esc(s.lastSeen.slice(5, 16)) : '') + (s.note ? ' · ' + esc(s.note) : '') + '</small></div>' +
        '<select data-chg="admRole" data-uid="' + esc(s.uid) + '" aria-label="สิทธิ์ของ ' + esc(s.name) + '"' + (s.active ? '' : ' disabled') + '>' + roles.map(function (r) { return '<option value="' + r.id + '"' + (r.id === s.role ? ' selected' : '') + '>' + esc(r.label) + '</option>'; }).join('') + '</select>' +
        (s.active ? '<button class="btn sm bad" data-a="admActive" data-uid="' + esc(s.uid) + '" data-on="0" data-confirm="1">ปิดสิทธิ์ (ลาออก)</button>' : '<button class="btn sm" data-a="admActive" data-uid="' + esc(s.uid) + '" data-on="1">เปิดสิทธิ์อีกครั้ง</button>') + '</div>';
    }).join('') + '</div>';
    h += '<form class="box form" data-form="teamInvite"><h3>เชิญคนเข้าทีม</h3><div class="acts"><div class="field"><label>ชื่อ (ไว้จำ)</label><input name="name" maxlength="60" placeholder="เช่น น้องมะลิ แคชเชียร์เช้า"></div><div class="field"><label>สิทธิ์</label><select name="role">' + roles.map(function (r) { return '<option value="' + r.id + '"' + (r.id === 'cashier' ? ' selected' : '') + '>' + esc(r.label) + '</option>'; }).join('') + '</select></div><div class="field"><label>ลิงก์ใช้ได้</label><select name="hours"><option value="24">1 วัน</option><option value="72" selected>3 วัน</option><option value="168">7 วัน</option></select></div><button class="btn blue" type="submit">สร้างลิงก์เชิญ</button></div>';
    var iv = A.inviteRes;
    if (iv) h += '<div class="invite-out"><div class="code">' + C.qrSvg(iv.link) + '</div><div><b>ลิงก์เชิญเป็น ' + esc(iv.label) + '</b><small class="hint">ใช้ได้ 1 ครั้ง ถึง ' + esc(iv.expires.slice(0, 16)) + ' · ให้เขาสแกน QR นี้ด้วยมือถือ หรือส่งลิงก์ทาง LINE</small><div class="copy"><input readonly value="' + esc(iv.link) + '"><button class="btn sm" type="button" data-a="copy" data-t="' + esc(iv.link) + '">คัดลอก</button></div>' + (C.canShare() ? '<button class="btn sm pri" type="button" data-a="share" data-t="' + esc(iv.link) + '" data-msg="' + esc('เชิญเข้าทีมร้าน Betagro Shop โพธิ์แก้ว (' + iv.label + ') กดลิงก์นี้แล้วกดยืนยัน: ' + iv.link) + '">ส่งใน LINE</button>' : '') + '</div></div>';
    h += '</form>';
    if ((d.invites || []).length) h += '<div class="box"><h3>ลิงก์เชิญที่ยังไม่มีคนใช้</h3>' + d.invites.map(function (i) { return '<div class="row"><span>' + esc(i.label) + (i.name ? ' · ' + esc(i.name) : '') + '<br><small class="hint">โดย ' + esc(i.by) + ' · หมดอายุ ' + esc(i.expires.slice(0, 16)) + '</small></span><span><button class="btn sm" data-a="copy" data-t="' + esc(i.link) + '">คัดลอก</button> <button class="btn sm bad" data-a="adm" data-op="teamRevoke" data-code="' + esc(i.code) + '" data-confirm="1">ยกเลิก</button></span></div>'; }).join('') + '</div>';
    var P = { '*': 'ทุกอย่าง (รวมตั้งค่า ทีม ราคา บรอดแคสต์)', view: 'ดูข้อมูลหลังร้าน', orders: 'อนุมัติ/เปิดบิล/ยกเลิกออเดอร์', pay: 'ตรวจยอดโอน/รับเงิน', members: 'อนุมัติสมาชิก/แก้ข้อมูล', route: 'จัดรอบส่ง/กดส่งแล้ว', stock: 'เปิดปิดสต็อก', export: 'ดาวน์โหลด Excel', pii: 'เห็นเบอร์และที่อยู่ลูกค้า' }; // 3.1.5 เพิ่มคำแปล pii
    h += '<div class="box"><h3>สิทธิ์แต่ละระดับ</h3>' + roles.map(function (r) { return '<div class="row"><span><b>' + esc(r.label) + '</b></span><span style="text-align:right">' + r.perms.map(function (p) { return P[p] || p; }).join(', ') + '</span></div>'; }).join('') +
      '<div class="hint">ต้องมีผู้จัดการอย่างน้อย 1 คนเสมอ · ถ้าผู้จัดการคนเดียวจะลาออก ให้เชิญผู้จัดการคนใหม่ก่อน แล้วให้คนใหม่ปิดสิทธิ์คนเดิม · กรณีฉุกเฉิน เจ้าของ Google Sheet แก้คอลัมน์ active ในชีต Staff ได้</div></div>';
    return h;
  }

  /* ---------- เครื่องมือ (ผู้จัดการ) ---------- */
  /* 3.1.2 รายการพร้อมเปิดให้ลูกค้าจริง (ผู้จัดการ) */
  function readyBox(list) {
    if (!list || !list.length) return '';
    var bad = list.filter(function (x) { return !x.ok; }).length;
    return '<div class="box ready-box"><h3>' + ic('check') + ' พร้อมเปิดให้ลูกค้าจริง ' + (bad ? '<span class="pill red">เหลือ ' + bad + ' ข้อ</span>' : '<span class="pill paid">ครบแล้ว</span>') + '</h3>' +
      list.map(function (x) { return '<div class="row ready-row ' + (x.ok ? 'ok' : x.level) + '"><span><b>' + (x.ok ? '✓ ' : x.level === 'block' ? '✗ ' : '! ') + esc(x.name) + '</b><small class="hint">' + esc(x.note) + '</small></span></div>'; }).join('') + '</div>';
  }
  function readyWarn(d) {
    var list = d.ready || [], block = list.filter(function (x) { return !x.ok && x.level === 'block'; }), q = list.filter(function (x) { return x.key === 'quota' && !x.ok; })[0];
    if (A.tab === 'tools' || (!block.length && !q)) return '';
    return (block.length ? '<div class="alert bad ready-warn">' + ic('alert') + ' ยังไม่พร้อมเปิดให้ลูกค้าจริง: ' + block.map(function (x) { return esc(x.name); }).join(', ') + ' <button class="text-btn" data-a="tab" data-p="tools">ดูรายการ</button></div>' : '') +
      (q ? '<div class="alert warn ready-quota">' + esc(q.name) + ': ' + esc(q.note) + '</div>' : '');
  }
  function adTools(d) {
    var t = d.tools || {}, jobs = t.jobs || {}, q = d.quota || {};
    function jobLine(k, label, btn) {
      var r = jobs[k];
      return '<div class="job-row"><div><b>' + label + '</b><small class="hint">' + (r ? 'ล่าสุด ' + esc(r.at) + ' · ' + jobText(r) : 'ยังไม่เคยรัน') + '</small></div><button class="btn sm" data-a="adm" data-op="runJob" data-job="' + k + '">' + btn + '</button></div>';
    }
    var h = can('manage') ? readyBox(d.ready) : '';
    if (S.me.staff && S.me.staff.role === 'manager' && t.testMode) h += '<div class="box test-box"><h3>' + ic('users') + ' ทดสอบบทบาท (เฉพาะผู้จัดการ + TEST_MODE)</h3><div class="hint">ดูหน้าจอและทำรายการได้เท่ากับบทบาทที่เลือก เพื่อทดสอบ/สอนงาน · หลังบ้านลดสิทธิ์ให้จริง (เพิ่มสิทธิ์ไม่ได้) · กลับได้จากแถบด้านบน</div><div class="acts" style="margin-top:8px">' +
      [['cashier', 'พนักงานร้าน'], ['driver', 'พนักงานส่งของ'], ['viewer', 'ดูอย่างเดียว']].map(function (x) { return '<button class="btn sm" data-a="admAsRole" data-p="' + x[0] + '">ดูเป็น ' + x[1] + '</button>'; }).join('') + '</div></div>';
    if (S.me.staff && S.me.staff.role === 'manager' && t.testMode && d.uatTools) h += uatTools(d.uatTools);
    var c = d.cfg || {}, H = { open: c.SHOP_OPEN || '07:00', last: c.DELIVERY_LAST_ORDER || '17:00', pay: c.PAY_CHASE_FROM || '18:00', close: c.SHOP_CLOSE || '19:00', morning: c.MORNING_DUE || '09:00' };
    if (can('manage')) h += '<form class="box hours-box" data-form="hoursSave"><h3>' + icon('clock') + ' เวลาทำการและการส่ง</h3><div class="hours-grid">' +
      [['SHOP_OPEN', 'ร้านเปิด', H.open], ['DELIVERY_LAST_ORDER', 'ออเดอร์ส่งด่วนสุดท้าย', H.last], ['PAY_CHASE_FROM', 'เริ่มตามเงิน', H.pay], ['SHOP_CLOSE', 'ร้านปิด (รับเองได้ถึง)', H.close], ['MORNING_DUE', 'เที่ยวแรกถึงลูกค้าก่อน', H.morning]].map(function (x) { return '<label class="field"><span>' + x[1] + '</span><input type="time" name="' + x[0] + '" value="' + esc(x[2]) + '" data-old="' + esc(x[2]) + '" required></label>'; }).join('') +
      [['DELIVERY_TARGET_MIN', 'เป้าส่งถึง (นาที)', c.DELIVERY_TARGET_MIN || 60], ['PREP_MIN', 'เวลาจัดของ (นาที)', c.PREP_MIN === undefined ? 15 : c.PREP_MIN], ['RIDE_KMH', 'ความเร็วรถเฉลี่ย (กม./ชม.)', c.RIDE_KMH || 20], ['STOP_MIN', 'จอดส่งจุดละ (นาที)', c.STOP_MIN || 10]].map(function (x) { return '<label class="field"><span>' + x[1] + '</span><input type="number" min="0" max="240" name="' + x[0] + '" value="' + esc(x[2]) + '" data-old="' + esc(x[2]) + '" inputmode="numeric"></label>'; }).join('') + '</div>' +
      '<label class="chk"><input type="checkbox" name="AUTO_ACCEPT"' + (c.AUTO_ACCEPT !== false ? ' checked' : '') + ' data-old="' + (c.AUTO_ACCEPT !== false ? '1' : '') + '"><span>รับออเดอร์อัตโนมัติในเวลาทำการ (พนักงานเปิดบิลได้ทันที)</span></label>' +
      '<label class="chk"><input type="checkbox" name="PUSH_OUT"' + (c.PUSH_OUT ? ' checked' : '') + ' data-old="' + (c.PUSH_OUT ? '1' : '') + '"><span>ส่งข้อความเวลาถึงให้ลูกค้าตอนออกรถ (ใช้โควตา LINE 1 ข้อความต่อออเดอร์ ไม่ติ๊ก = ลูกค้าดูเวลาถึงในแอป)</span></label><button class="btn blue" type="submit">บันทึกเวลา</button></form>';
    h += '<div class="box"><h3>ทดสอบงานตั้งเวลา (ไม่ต้องรอเวลาจริง)</h3>' + jobLine('reminders', H.pay + ' ตามเงินบิลค้างจ่าย', 'ส่งเตือนตอนนี้') + jobLine('standing', '18:00 ถามสั่งประจำ', 'ส่งคำถามตอนนี้') + jobLine('summary', H.close + ' สรุปยอดให้ผู้จัดการ', 'ส่งสรุปตอนนี้') + jobLine('winback', '10:00 เตือนซื้อซ้ำตามรอบของลูกค้า (เปิดที่ WINBACK_ENABLED)', 'ส่งตอนนี้') +
      (c.EVENING_ENABLED ? jobLine('evening', (c.EVENING ? c.EVENING.cutoff : '16:00') + ' รอบเย็น: เลื่อนออเดอร์ที่ยังไม่จ่ายเป็นคืนถัดไป', 'ตรวจตอนนี้') : '') + jobLine('archive', 'วันที่ 1 ของเดือน: ย้ายออเดอร์ที่จบแล้วเก่ากว่า ' + (c.ARCHIVE_DAYS || 120) + ' วัน ไปแท็บ OrdersArchive', 'ย้ายตอนนี้') +
      jobLine('smartRotate', 'ราว 00:05 เปลี่ยนชุด Smart Set วันนี้ (สุ่มใหม่ทันที)', 'สุ่มตอนนี้') + jobLine('pointsRelease', 'ราว 00:05 ปล่อยแต้มที่พักครบ ' + d.cfg.QUALIFY_HOLD_DAYS + ' วัน', 'ปล่อยตอนนี้') + jobLine('magnetRemind', 'เตือนลูกค้าใหม่ที่ยังไม่ใช้ Magnet (เปิดที่ PUSH_EVENTS: magnetremind)', 'ส่งตอนนี้') +
      jobLine('stock', (d.cfg.STOCK_REMIND || '19:30') + ' เตือนอัปโหลดไฟล์สต็อกปิดร้าน', 'ตรวจตอนนี้') + jobLine('stockCalib', 'คำนวณ buffer สต็อกใหม่ (หลังอัปโหลดไฟล์ปิดร้าน)', 'คำนวณตอนนี้') + jobLine('areaRetag', 'ตรวจพื้นที่ส่งของทุกที่อยู่ใหม่ (หลังแก้เส้นเขต/แถบขอบ)', 'ตรวจตอนนี้') +
      (A.jobRes ? '<div class="alert ' + (A.jobRes.sent || A.jobRes.released || A.jobRes.changed || A.jobRes.products || A.jobRes.picks || A.jobRes.skus ? 'ok' : 'warn') + '"><b>ผล: ' + esc(jobText(A.jobRes)) + '</b></div>' : '') + '</div>';
    h += areaTools(d) + uatBox(d);
    h += '<div class="box"><h3>ตรวจระบบ</h3><button class="btn sm" data-a="admSelfTest">ตรวจตอนนี้</button> <button class="btn sm" data-a="adm" data-op="cacheClear">ล้างแคช (หลังแก้ชีตด้วยมือ)</button>' +
      (A.selfTest ? '<div class="checks">' + A.selfTest.map(function (c) { return '<div class="row"><span>' + (c.ok ? '✅' : c.warn ? '⚠️' : '❌') + ' ' + esc(c.name) + '</span><span>' + esc(c.note) + '</span></div>'; }).join('') + '</div>' : '') +
      '<div class="hint">หลังบ้าน v' + esc(t.version || '') + ' · หน้าเว็บ v' + esc(C.version) + ' · LINE token ' + (t.tokenSet ? 'ตั้งแล้ว' : 'ยังไม่ได้ตั้ง') + ' · โควตาเดือนนี้ ' + fmt(q.used) + ' / ' + (q.plan ? fmt(q.plan) : 'ไม่จำกัด') + '</div>' +
      (t.version && t.version !== C.version ? '<div class="alert bad">หลังบ้าน (v' + esc(t.version) + ') กับหน้าเว็บ (v' + esc(C.version) + ') คนละเวอร์ชัน — อัปเดตให้ตรงกันตามคู่มือ</div>' : '<div class="alert ok">หลังบ้านและหน้าเว็บเวอร์ชันตรงกัน ✓</div>') + '</div>';
    var wh = t.webhook || {}, apiUrl = (window.APP_CONFIG || {}).API_URL || ''; wh.url = wh.key && apiUrl ? apiUrl.split('?')[0] + '?wh=' + wh.key : '';
    h += '<div class="box"><h3>' + ic('lock') + ' ความปลอดภัย Webhook</h3>' + (wh.secured ? '<div class="alert ok">รับเฉพาะ webhook ที่มีรหัสลับแล้ว ✓' + (wh.blocked ? ' · ปฏิเสธคำขอปลอม ' + wh.blocked + ' ครั้ง' : '') + '</div>' : '<div class="alert warn">ยังใช้ Webhook URL แบบเดิม (ยังไม่ใส่รหัสลับ) ' + (wh.legacy ? '· รับมาแล้ว ' + wh.legacy + ' ครั้ง' : '') + ' — คัดลอกลิงก์ด้านล่างไปวางที่ LINE Developers > Messaging API > Webhook URL แล้วกด Verify</div>') +
      (wh.url ? '<div class="copy"><input readonly value="' + esc(wh.url) + '" aria-label="Webhook URL ที่ปลอดภัย"><button class="btn sm" data-a="copy" data-t="' + esc(wh.url) + '">คัดลอก</button></div><div class="hint">ลิงก์นี้มีรหัสลับ ห้ามส่งต่อในกลุ่มแชต · ถ้าหลุด ให้ลบ WEBHOOK_KEY และ WEBHOOK_SEEN ใน Script Properties แล้วรัน setup เพื่อสร้างใหม่</div>' : '<div class="hint">เปิดดูลิงก์ได้หลัง Deploy (หรือดูใน log ของการรัน setup)</div>') + '</div>';
    var rw = t.rows || {};
    h += '<div class="box"><h3>ขนาดข้อมูล (ยิ่งเล็ก ยิ่งเร็ว)</h3><div class="row"><span>ออเดอร์ (แท็บ Orders)</span><span>' + fmt(rw.Orders || 0) + ' แถว</span></div><div class="row"><span>ออเดอร์เก่าที่ย้ายแล้ว (OrdersArchive)</span><span>' + fmt(rw.OrdersArchive || 0) + ' แถว' + (t.archiveUntil ? ' · ถึง ' + esc(C.thDate(t.archiveUntil)) : '') + '</span></div><div class="row"><span>สมาชิก</span><span>' + fmt(rw.Members || 0) + '</span></div><div class="row"><span>การชำระเงิน</span><span>' + fmt(rw.Payments || 0) + '</span></div><div class="hint">แท็บ Orders เกิน ~5,000 แถว ระบบจะช้าลง · ระบบย้ายข้อมูลเก่าให้ทุกวันที่ 1 (รายงาน/ดาวน์โหลดย้อนหลังยังรวมข้อมูลที่ย้ายแล้ว)</div></div>';
    h += perfBox();
    if (t.testMode) h += '<div class="box test-box"><h3>โหมดทดสอบ (เห็นเฉพาะพนักงาน)</h3><div class="hint">ทดลองเป็นลูกค้าใหม่: ไปหน้าบัตรสมาชิกของคุณ แล้วกด "ลบข้อมูลสมาชิกของฉัน" จากนั้นเปิดลิงก์ชวน/ป้ายเพื่อลงทะเบียนใหม่ · ปิดโหมดนี้ได้ที่ Config TEST_MODE = FALSE</div><button class="btn sm" data-a="go" data-p="card">ไปหน้าบัตรสมาชิกของฉัน</button></div>';
    h += '<div class="box"><h3>กติกาและข้อมูล</h3><div class="hint">แก้กติกา (Coin, คูปอง, ส่วนแบ่ง, ขั้นต่ำ, โซนส่ง, ข้อความที่ส่งเข้าแชต PUSH_EVENTS) ได้ที่ชีต Config · สินค้า/เซ็ตที่ชีต Products และ Bundles · มีผลภายใน 1 นาที</div>' +
      '<div class="copy" style="margin-top:6px"><input readonly value="' + esc(t.sheetUrl || '') + '" aria-label="ลิงก์ Google Sheet"><button class="btn sm" data-a="copy" data-t="' + esc(t.sheetUrl || '') + '">คัดลอกลิงก์ชีต</button></div></div>';
    return h;
  }

  /* ความเร็วที่วัดจากเครื่องนี้ (แต่ละคำสั่ง: เวลารอทั้งหมด / เวลาที่หลังบ้านใช้) */
  function perfBox() {
    var P = C.perf || [], by = {};
    P.forEach(function (x) { var b = by[x.a] = by[x.a] || { n: 0, ms: [], sms: 0, bad: 0 }; b.n++; b.ms.push(x.ms); b.sms += x.sms || 0; if (!x.ok) b.bad++; });
    var rows = Object.keys(by).map(function (k) { var b = by[k], s2 = b.ms.slice().sort(function (a, c) { return a - c; }); return { a: k, n: b.n, avg: Math.round(b.ms.reduce(function (a, c) { return a + c; }, 0) / b.n), p90: s2[Math.min(s2.length - 1, Math.floor(s2.length * 0.9))], srv: Math.round(b.sms / b.n), bad: b.bad }; }).sort(function (a, c) { return c.n - a.n; });
    var sp = A.speed;
    return '<div class="box"><h3>' + ic('chart') + ' ความเร็ว (วัดจากเครื่องนี้)</h3><div class="hint">เวลารอ = เน็ต + Google Apps Script + Google Sheet · "หลังบ้าน" = เวลาที่สคริปต์ใช้จริง ส่วนที่เหลือคือเครือข่าย/คิว · เป้าหมาย: อ่าน < 1.5 วินาที เขียน < 2.5 วินาที</div>' +
      '<div class="acts" style="margin:8px 0"><button class="btn sm" data-a="admSpeed">ทดสอบความเร็ว 5 ครั้ง</button>' + (sp ? '<span class="hint">ping เฉลี่ย ' + sp.avg + ' ms (ต่ำสุด ' + sp.min + ' · สูงสุด ' + sp.max + ')</span>' : '') + '</div>' +
      (rows.length ? '<div class="tblw"><table><thead><tr><th>คำสั่ง</th><th class="r">ครั้ง</th><th class="r">รอเฉลี่ย (ms)</th><th class="r">รอ 90% (ms)</th><th class="r">หลังบ้าน (ms)</th><th class="r">ไม่สำเร็จ*</th></tr></thead><tbody>' + rows.map(function (x) { return '<tr><td class="mono">' + esc(x.a) + '</td><td class="r">' + x.n + '</td><td class="r">' + fmt(x.avg) + '</td><td class="r">' + fmt(x.p90) + '</td><td class="r">' + fmt(x.srv) + '</td><td class="r">' + (x.bad || '') + '</td></tr>'; }).join('') + '</tbody></table></div><div class="hint">* รวมกรณีที่ระบบปฏิเสธตามกติกา เช่น เลข Transaction ซ้ำ</div>' : '<div class="hint">ใช้งานสักพักแล้วกลับมาดู</div>') + '</div>';
  }

  /* ---------- v3: ตัวช่วยหน้าหลังร้าน ---------- */
  var MST = { 'new': ['paid', 'ลูกค้าใหม่'], existing: ['', 'ลูกค้าเดิม'], review: ['new', 'รอตรวจ (อาจเป็นลูกค้าเดิม)'] };
  function mstPill(st) { var x = MST[st]; return x ? '<span class="pill ' + x[0] + '">' + x[1] + '</span>' : ''; }
  var AREA_TH = { 'in': ['paid', 'ในพื้นที่'], band: ['appr', 'แถบขอบ'], out: ['red', 'นอกพื้นที่'], none: ['new', 'ไม่มีหมุด'], grace: ['new', 'หมุดเดิม (ผ่อนผัน)'], exc: ['appr', 'ส่งพิเศษ'], off: ['', ''] };
  function areaTag(st) { var x = AREA_TH[st]; return x && x[1] ? '<span class="pill ' + x[0] + '">' + x[1] + '</span>' : ''; }
  var PK_TH = { earn: 'แต้มจากบิล', use: 'ใช้ลดบิล', refB2C: 'แนะนำลูกค้าบ้าน', refB2B1: 'แนะนำร้าน งวด 1', refB2B2: 'แนะนำร้าน งวด 2', adjust: 'ปรับโดยร้าน' };
  var AEV_TH = { cart_out: 'เห็นการ์ดนอกพื้นที่ในตะกร้า', address_out: 'บันทึกที่อยู่นอกพื้นที่', address_band: 'บันทึกที่อยู่แถบขอบ', register_out: 'ลงทะเบียน (นอกพื้นที่)', order_block: 'สั่งส่งไม่ได้ (นอกพื้นที่/ไม่มีหมุด)' };
  function mapLink(lat, lng, label) { return lat && lng ? '<a href="https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng + '" target="_blank" rel="noopener">' + (label || 'ดูแผนที่') + '</a>' : ''; }
  /* สมาชิก: เครื่องมือ v3 ในแถวที่กด "แก้" */
  function memberV3Tools(m, d) {
    var mg = can('manage'), h = '<div class="mem-v3">';
    h += '<div class="mem-v3-row"><b>สถานะลูกค้า:</b> ' + mstPill(m.status) + (m.channel ? ' <span class="pill">' + esc(m.channel) + '</span>' : '') + (m.magnet ? ' <span class="pill appr">Magnet ' + esc(m.magnet) + '</span>' : '') + (m.couponLock ? ' <span class="pill new">คูปองรอยืนยันร้าน</span>' : '') + (m.taxId ? ' · เลขภาษี <span class="mono">' + esc(m.taxId) + '</span>' : '') +
      (m.shopPhoto ? ' <button class="btn sm" type="button" data-a="admShopPhoto" data-id="' + esc(m.id) + '">ดูรูปหน้าร้าน</button>' : '') +
      (can('members') ? ' <button class="btn sm" data-a="adm" data-op="memberStatus" data-id="' + esc(m.id) + '" data-status="new" data-confirm="1">ตั้งเป็นลูกค้าใหม่ (ให้สิทธิ์)</button> <button class="btn sm" data-a="adm" data-op="memberStatus" data-id="' + esc(m.id) + '" data-status="existing" data-confirm="1">ตั้งเป็นลูกค้าเดิม</button>' : '') + '</div>';
    h += '<div class="mem-v3-row"><b>ที่อยู่จัดส่ง:</b> ' + ((m.addresses || []).length ? m.addresses.map(function (a) { return esc(a.label) + (a.isDefault ? ' (หลัก)' : '') + ' ' + areaTag(a.exc ? 'exc' : a.area) + (a.distM ? ' <small class="hint">' + (Math.round(a.distM / 100) / 10) + ' กม.จากขอบ</small>' : '') + ' ' + mapLink(a.lat, a.lng); }).join(' · ') : '<span class="hint">ยังไม่มี</span>') + '</div>';
    if (can('members')) h += '<form class="acts" data-form="addressStaff" data-id="' + esc(m.id) + '"><div class="field"><label>ปักหมุดให้ลูกค้า (วางลิงก์ Google Maps ที่ลูกค้าส่งในแชต หรือ lat,lng)</label><input name="geo" placeholder="https://maps.app.goo.gl/... หรือ 13.8001, 100.6492" autocomplete="off"></div><div class="field"><label>ที่อยู่ (ถ้าต้องการแก้)</label><input name="address" maxlength="200"></div><button class="btn sm blue" type="submit">บันทึกหมุด (ที่อยู่หลัก)</button></form>';
    if (mg) h += '<form class="acts" data-form="memberArea" data-id="' + esc(m.id) + '"><label class="chk"><input type="checkbox" name="on"' + (m.areaExc ? ' checked' : '') + '><span>อนุญาตส่งนอกพื้นที่ (ทุกที่อยู่ของลูกค้านี้)</span></label><div class="field"><label>ถึงวันที่ (ว่าง = ไม่มีกำหนด)</label><input type="date" name="until"></div><div class="field"><label>เหตุผล</label><input name="note" maxlength="80" value="' + esc((m.areaExc || '').replace(/^ถึง \d{4}-\d{2}-\d{2} · /, '')) + '" placeholder="เช่น ลูกค้าประจำ ยอดสูง"></div><button class="btn sm" type="submit">บันทึก</button></form>';
    if (mg && d.cfg.POINTS_ENABLED !== false) h += '<form class="acts" data-form="pointsAdjust" data-id="' + esc(m.id) + '"><div class="field" style="max-width:140px"><label>ปรับแต้ม (+/−)</label><input name="points" inputmode="numeric" required placeholder="เช่น 100 หรือ -50"></div><div class="field"><label>เหตุผล (บังคับ)</label><input name="note" required maxlength="120"></div><button class="btn sm" type="submit">ปรับแต้ม</button></form>' +
      '<form class="acts" data-form="pointsReverse"><div class="field" style="max-width:200px"><label>หักแต้มคืนจากบิล (คืนสินค้า)</label><input name="id" class="mono" required placeholder="เลขออเดอร์ O2610..."></div><div class="field"><label>เหตุผล</label><input name="reason" required maxlength="80"></div><button class="btn sm bad" type="submit" >หักแต้มคืน</button></form>';
    if (mg && d.cfg.TEST_MODE) h += '<div class="acts test-acts"><span class="hint">ทดสอบ (TEST_MODE):</span><button class="btn sm" data-a="adm" data-op="uatMember" data-id="' + esc(m.id) + '" data-what="magnet">คืนสิทธิ์ Magnet</button><button class="btn sm" data-a="adm" data-op="uatMember" data-id="' + esc(m.id) + '" data-what="new">ให้สิทธิ์ลูกค้าใหม่ใหม่ทั้งหมด</button><button class="btn sm bad" data-a="adm" data-op="uatMember" data-id="' + esc(m.id) + '" data-what="points" data-confirm="1">ล้างแต้มของสมาชิกนี้</button></div>';
    return h + '</div>';
  }
  /* ชวนเพื่อน & ช่องทาง: แต้มผู้แนะนำ + QR ช่องทาง */
  function affV3(d) {
    var mg = can('manage'), pt = d.points || { review: [], referrers: [], totals: {} }, h = '';
    if (pt.review.length || mg) {
      var ids = pt.review.map(function (r) { return r.id; });
      h += '<div class="box"><h3>แต้มผู้แนะนำ รอตรวจ (เกินเพดานเดือน) ' + (mg && ids.length ? pickAll('prv', ids) : '') + '</h3><div class="hint">ระบบพักไว้เมื่อผู้แนะนำได้แต้มเกินเพดาน (B2C ' + fmt(d.cfg.REF_CAP_B2C_MONTH) + ' แต้ม/เดือน · B2B ' + d.cfg.REF_CAP_B2B_MONTH + ' ร้าน/เดือน) · ตรวจว่าเป็นร้าน/ลูกค้าใหม่จริงก่อนอนุมัติ</div>' +
        (mg ? bulkBar('prv', [bulkBtn('prv', 'pointsOk', 'อนุมัติ', picked('prv').length), bulkBtn('prv', 'pointsNo', 'ไม่อนุมัติ', picked('prv').length, { cls: 'bad', confirm: 1 })]) : '') +
        (pt.review.length ? '<div class="tblw"><table><thead><tr>' + (mg ? '<th></th>' : '') + '<th>ผู้แนะนำ</th><th>รายการ</th><th class="r">แต้ม</th><th>เพื่อน</th><th>บิล</th><th></th></tr></thead><tbody>' + pt.review.map(function (r) { return '<tr>' + (mg ? '<td class="pick-cell">' + pickBox('prv', r.id, r.member) + '</td>' : '') + '<td>' + esc(r.member) + ' <small class="mono hint">' + esc(r.sno) + '</small></td><td>' + esc(PK_TH[r.kind] || r.kind) + '<br><small class="hint">' + esc(r.at.slice(0, 16)) + '</small></td><td class="r">' + fmt(r.points) + '</td><td>' + esc(r.from) + '</td><td class="mono">' + esc(r.order) + '</td><td>' + (mg ? '<button class="btn sm blue" data-a="adm" data-op="pointsReview" data-id="' + esc(r.id) + '" data-ok="1">อนุมัติ</button> <button class="btn sm bad" data-a="adm" data-op="pointsReview" data-id="' + esc(r.id) + '" data-ok="0" data-confirm="1">ไม่อนุมัติ</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty">ไม่มีรายการรอตรวจ</div>') + '</div>';
    }
    var tt = pt.totals || {};
    h += '<div class="box"><h3>ร้านผู้แนะนำ (แต้ม)</h3><div class="report-grid">' + [['แต้มจากบิล (ใช้ได้)', fmt(tt.earn || 0)], ['แต้มผู้แนะนำ (ใช้ได้)', fmt(tt.ref || 0)], ['พักไว้ ' + d.cfg.QUALIFY_HOLD_DAYS + ' วัน', fmt(tt.pending || 0)], ['ใช้ลดบิลแล้ว', fmt(tt.used || 0)], ['มูลค่าแต้มคงเหลือ', baht(tt.value || 0)]].map(function (x) { return '<div class="stat-card"><span>' + x[0] + '</span><strong>' + x[1] + '</strong></div>'; }).join('') + '</div>' +
      ((pt.referrers || []).length ? '<div class="tblw" style="margin-top:8px"><table><thead><tr><th>ร้านผู้แนะนำ</th><th class="r">ลูกค้าบ้าน</th><th class="r">ร้านใหม่</th><th class="r">แต้มเดือนนี้</th><th class="r">ใช้ได้</th><th class="r">พักไว้</th><th class="r">รอตรวจ</th></tr></thead><tbody>' + pt.referrers.map(function (r) { return '<tr><td>' + esc(r.name) + ' <small class="mono hint">' + esc(r.sno) + '</small></td><td class="r">' + r.b2c + '</td><td class="r">' + r.b2b + '</td><td class="r">' + fmt(r.month) + '</td><td class="r">' + fmt(r.available) + '</td><td class="r">' + fmt(r.pending) + '</td><td class="r">' + fmt(r.review) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="hint">ยังไม่มีผู้แนะนำที่ได้แต้ม</div>') + '</div>';
    var ch = (d.channels || []).filter(function (c) { return hit(c, ['code', 'name', 'kindTh']); });
    h += '<div class="box"><h3>ช่องทางและ QR (นับจาก QR แรกที่สแกน)</h3><div class="hint">ทุก QR/ลิงก์มีรหัสช่องทาง (ORGANIC / AFF-เลขสมาชิก / PARTNER-ป้าย / BOOTH) · ลูกค้าที่สแกนหลายช่องทาง นับช่องทางแรกที่สแกน · ใช้ดูว่าช่องทางไหนได้ลูกค้าใหม่จริง</div>' + searchBox('ค้นหารหัส / ชื่อช่องทาง') +
      '<div class="tblw" style="margin-top:6px"><table><thead><tr><th>ช่องทาง</th><th class="r">สแกน</th><th class="r">คนสแกน</th><th class="r">ลงทะเบียน</th><th class="r">ใหม่ / เดิม / รอตรวจ</th><th class="r">บิลแรก</th><th></th></tr></thead><tbody>' + ch.map(function (c) {
        return '<tr class="' + (c.active ? '' : 'off') + '"><td><span class="pill">' + esc(c.kindTh) + '</span> ' + esc(c.name) + '<br><small class="mono hint">' + esc(c.code) + (c.note ? ' · ' + esc(c.note) : '') + (c.active ? '' : ' · ปิดอยู่') + '</small></td><td class="r">' + c.scans + '</td><td class="r">' + c.scanners + '</td><td class="r">' + c.signups + '</td><td class="r">' + c.newC + ' / ' + c.existing + ' / ' + c.review + '</td><td class="r">' + c.first + '</td><td style="white-space:nowrap">' +
          (c.link ? '<button class="btn sm" data-a="admQR" data-t="' + esc(c.link) + '" data-n="' + esc(c.name + ' · ' + c.code) + '">QR</button> <button class="btn sm" data-a="copy" data-t="' + esc(c.link) + '">ลิงก์</button>' : '') + (mg && /^(ORGANIC|BOOTH)/.test(c.code) && c.link ? ' <button class="btn sm" data-a="admChan" data-code="' + esc(c.code) + '" data-name="' + esc(c.name) + '" data-on="' + (c.active ? '0' : '1') + '">' + (c.active ? 'ปิด' : 'เปิด') + '</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (mg ? '<form class="acts" data-form="channelSave" style="margin-top:8px"><div class="field"><label>รหัสช่องทางใหม่ (ORGANIC-… หรือ BOOTH-…)</label><input name="code" required class="mono" placeholder="เช่น ORGANIC-POS หรือ BOOTH-ตลาดนัด" maxlength="40"></div><div class="field"><label>ชื่อเรียก</label><input name="name" maxlength="60" placeholder="เช่น ป้ายหน้าแคชเชียร์"></div><div class="field"><label>หมายเหตุ</label><input name="note" maxlength="120"></div><button class="btn sm blue" type="submit">สร้างช่องทาง + QR</button></form><div class="hint">BOOTH (บูธนอกร้าน) สร้างไว้ได้ แต่ยังพักโครงการ (HOLD) · ปิดไว้ก่อนจนกว่าจะเริ่ม</div>' : '') + '</div>';
    return h;
  }
  /* รายงาน: KPI รายช่องทาง + ลูกค้านอกพื้นที่ */
  function kpiBox(d) {
    var k = d.kpi; if (!k) return '';
    var t = k.totals || {}, h = '<div class="box"><h3>' + ic('chart') + ' KPI ลูกค้าใหม่ & โปร (ช่วงวันที่ด้านบน)</h3><div class="report-grid">' + [
      ['ลูกค้าใหม่ (สิทธิ์ใหม่)', fmt(t.newC || 0), 'ลงทะเบียนทั้งหมด ' + fmt(t.signups || 0) + ' · เดิม ' + (t.existing || 0) + ' · รอตรวจ ' + (t.review || 0)],
      ['ซื้อครั้งแรกใน 14 วัน', (k.conv14 || 0) + '%', fmt(t.first14 || 0) + ' จาก ' + fmt(t.newC || 0) + ' คน'], ['ใช้สิทธิ์ Magnet', (k.magnetRate || 0) + '%', fmt(t.magnetUsed || 0) + ' คน'],
      ['บิลที่ใช้ Smart Set', (k.smartAttach || 0) + '%', fmt(t.smartOrders || 0) + ' จาก ' + fmt(t.orders || 0) + ' บิล'], ['ร้านใหม่ซื้อซ้ำ (B2B)', (k.b2bRate || 0) + '%', (k.b2b || {}).retained + ' จาก ' + (k.b2b || {}).withFirst + ' ร้าน · ซื้อสะสม ≥ ' + baht(d.cfg.B2B_RETAIN_SPEND) + ' ใน ' + d.cfg.B2B_RETAIN_DAYS + ' วัน'],
      ['ลูกค้าซื้อ ≥ 3 บิล', (k.retentionRate || 0) + '%', (k.retention || {}).third + ' จาก ' + (k.retention || {}).first + ' คน'], ['ยอดขาย (เปิดบิลแล้ว)', baht(t.revenue || 0), fmt(t.orders || 0) + ' บิล'],
      ['ต้นทุนโปรแกรม', baht(t.programCost || 0), 'คูปอง ' + baht(t.couponCost || 0) + ' · แต้มที่ใช้ ' + baht(t.pointsCost || 0) + ' · แต้มผู้แนะนำ ' + baht(t.refPointsCost || 0)], ['ส่วนลด Smart/Magnet', baht(t.promoCost || 0), 'ลดในบิล (ไม่รวมคูปอง)']]
      .map(function (x) { return '<div class="stat-card"><span>' + x[0] + '</span><strong>' + x[1] + '</strong><small class="hint">' + esc(x[2]) + '</small></div>'; }).join('') + '</div>';
    if (k.pilotStart) h += '<div class="hint" style="margin-top:8px">Pilot เริ่ม ' + esc(C.thDate(k.pilotStart)) + ' · เกณฑ์ไปต่อ: ลูกค้าใหม่ ≥ ' + k.stopNew + ' คน ภายในสัปดาห์ที่ 6 · ตอนนี้ ' + (k.newSoFar || 0) + ' คน ' + ((k.newSoFar || 0) >= k.stopNew ? '<span class="pill paid">ผ่านเกณฑ์</span>' : '<span class="pill new">ยังไม่ถึง</span>') + '</div>' +
      ((k.weeks || []).length ? '<div class="bars" style="margin-top:6px">' + k.weeks.map(function (w) { var mx = Math.max.apply(null, k.weeks.map(function (x) { return x.newC; }).concat([1])); return '<div class="bar-row"><span>สัปดาห์ ' + w.week + '</span><div class="bar"><i style="width:' + (w.newC / mx * 100) + '%"></i></div><b>' + w.newC + ' คน</b><small>' + C.thDate(w.from) + '–' + C.thDate(w.to) + '</small></div>'; }).join('') + '</div>' : '');
    else h += '<div class="hint" style="margin-top:8px">ใส่วันเริ่ม Pilot ที่ชีต Config แถว PILOT_START (เช่น 2026-11-02) เพื่อดูยอดรายสัปดาห์เทียบเกณฑ์ไปต่อ</div>';
    h += (k.channels || []).length ? '<div class="tblw" style="margin-top:8px"><table><thead><tr><th>ช่องทาง</th><th class="r">สแกน</th><th class="r">ลงทะเบียน</th><th class="r">ใหม่</th><th class="r">ซื้อใน 14 วัน</th><th class="r">ใช้ Magnet</th><th class="r">บิล</th><th class="r">ยอดขาย</th></tr></thead><tbody>' + k.channels.map(function (c) { return '<tr><td class="mono">' + esc(c.code) + '</td><td class="r">' + c.scans + '</td><td class="r">' + c.signups + '</td><td class="r">' + c.newC + '</td><td class="r">' + c.first14 + ' (' + c.conv + '%)</td><td class="r">' + c.magnetUsed + ' (' + c.magnetRate + '%)</td><td class="r">' + c.orders + '</td><td class="r">' + baht(c.revenue) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '';
    if ((k.referrers || []).length) h += '<h3 style="margin-top:12px">ร้านผู้แนะนำ: ลูกค้าที่พามา + ยอดของร้านเอง</h3><div class="hint">ยอดของร้านเองเดือนนี้ต่ำกว่าค่าเฉลี่ยเดิมมาก = ควรคุยกับร้าน (อาจย้ายยอดไปเปิดบัญชีใหม่)</div><div class="tblw"><table><thead><tr><th>ร้าน</th><th class="r">บ้าน</th><th class="r">ร้าน</th><th class="r">บิลแรกแล้ว</th><th class="r">แต้ม</th><th class="r">ยอดร้านเองเดือนนี้</th><th class="r">ค่าเฉลี่ยเดิม</th></tr></thead><tbody>' + k.referrers.map(function (r) { var low = r.avg > 0 && r.own < r.avg * 0.5; return '<tr class="' + (low ? 'warn' : '') + '"><td>' + esc(r.name) + ' <small class="mono hint">' + esc(r.sno) + '</small></td><td class="r">' + r.b2c + '</td><td class="r">' + r.b2b + '</td><td class="r">' + r.first + '</td><td class="r">' + fmt(r.points) + '</td><td class="r">' + baht(r.own) + (low ? ' ⚠' : '') + '</td><td class="r">' + (r.avg ? baht(r.avg) : '–') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    return h + '</div>';
  }
  function areaBox(d) {
    var a = d.area; if (!a) return '';
    var h = '<div class="box"><h3>' + ic('map') + ' ลูกค้านอกพื้นที่ (ใช้ดูโอกาสขยายเขต / เปิดสาขา)</h3><div class="hint">เก็บพิกัดแบบหยาบ (ทศนิยม 3 ตำแหน่ง ≈ 100 ม.) ไม่ผูกชื่อลูกค้า · เก็บ ' + (d.cfg.AREA_LOG_DAYS || 180) + ' วัน</div>';
    if (!a.total) return h + '<div class="empty">ยังไม่มีบันทึกในช่วงนี้</div></div>';
    h += '<div class="row-flex" style="flex-wrap:wrap;gap:6px;margin:8px 0">' + Object.keys(a.byEvent).map(function (e) { return '<span class="pill">' + esc(AEV_TH[e] || e) + ' ' + a.byEvent[e] + '</span>'; }).join('') + '</div>';
    var wd = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์', 'เสาร์', 'อาทิตย์'].filter(function (x) { return a.byWeekday[x]; }), mx = Math.max.apply(null, wd.map(function (x) { return a.byWeekday[x]; }).concat([1]));
    if (wd.length) h += '<div class="bars">' + wd.map(function (x) { return '<div class="bar-row"><span>' + x + '</span><div class="bar"><i style="width:' + (a.byWeekday[x] / mx * 100) + '%"></i></div><b>' + a.byWeekday[x] + '</b><small>ครั้ง</small></div>'; }).join('') + '</div>';
    h += '<div class="tblw" style="margin-top:8px"><table><thead><tr><th>เวลา</th><th>เหตุการณ์</th><th class="r">ห่างจากขอบ</th><th class="r">ยอดตะกร้า</th><th>ผล</th><th>ตำแหน่ง</th></tr></thead><tbody>' + a.rows.map(function (r) { return '<tr><td>' + esc(r.time) + '</td><td>' + esc(AEV_TH[r.event] || r.event) + '</td><td class="r">' + (r.distM ? (Math.round(r.distM / 100) / 10) + ' กม.' : '–') + '</td><td class="r">' + (r.cart ? baht(r.cart) : '–') + '</td><td>' + esc(r.outcome) + '</td><td>' + mapLink(r.lat, r.lng, '≈ ดู') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    return h + '</div>';
  }
  /* เครื่องมือ: พื้นที่จัดส่ง (แถบขอบแก้ได้) + พรีวิวเส้นเขต */
  function areaSvg(ac, band) {
    var poly = (ac.poly || []).map(function (p) { return [Number(p[0]), Number(p[1])]; }); if (poly.length < 3) return '<div class="hint">ยังไม่มีเส้นเขต (แท็บ Area ในชีต)</div>';
    var o = [0, 0]; poly.forEach(function (p) { o[0] += p[0]; o[1] += p[1]; }); o[0] /= poly.length; o[1] /= poly.length;
    var xy = function (la, ln) { return [(ln - o[1]) * 111320 * Math.cos(o[0] * Math.PI / 180), -(la - o[0]) * 110574]; };
    var P = poly.map(function (p) { return xy(p[0], p[1]); }), sh = ac.shop && Number(ac.shop[0]) ? xy(Number(ac.shop[0]), Number(ac.shop[1])) : null, b = Number(band) || 0;
    var xs = P.map(function (p) { return p[0]; }), ys = P.map(function (p) { return p[1]; }), pad = b + 300;
    var minX = Math.min.apply(null, xs) - pad, maxX = Math.max.apply(null, xs) + pad, minY = Math.min.apply(null, ys) - pad, maxY = Math.max.apply(null, ys) + pad, W = 320, k = W / (maxX - minX), H = Math.round((maxY - minY) * k);
    var pt = function (p) { return ((p[0] - minX) * k).toFixed(1) + ',' + ((p[1] - minY) * k).toFixed(1); }, path = 'M' + P.map(pt).join('L') + 'Z';
    return '<svg class="area-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="พรีวิวเส้นเขตจัดส่ง และแถบขอบ ' + b + ' เมตร">' + (b > 0 ? '<path d="' + path + '" fill="none" stroke="#7FB8D4" stroke-opacity=".45" stroke-width="' + (2 * b * k).toFixed(1) + '" stroke-linejoin="round"/>' : '') +
      '<path d="' + path + '" fill="#00845F" fill-opacity=".14" stroke="#006B4E" stroke-width="2"/>' + (sh ? '<circle cx="' + ((sh[0] - minX) * k).toFixed(1) + '" cy="' + ((sh[1] - minY) * k).toFixed(1) + '" r="5" fill="#C2410C"/><text x="' + ((sh[0] - minX) * k + 8).toFixed(1) + '" y="' + ((sh[1] - minY) * k + 4).toFixed(1) + '" font-size="11" fill="currentColor">ร้าน</text>' : '') +
      '<line x1="10" y1="' + (H - 10) + '" x2="' + (10 + 1000 * k).toFixed(1) + '" y2="' + (H - 10) + '" stroke="currentColor" stroke-width="2"/><text x="10" y="' + (H - 14) + '" font-size="10" fill="currentColor">1 กม.</text></svg>';
  }
  function areaTools(d) {
    var ac = d.areaCfg; if (!ac) return '';
    var band = A.bandDraft !== undefined ? A.bandDraft : ac.band, by = ac.byArea || {};
    return '<div class="box"><h3>' + ic('map') + ' พื้นที่จัดส่ง</h3>' + cfgToggle('AREA_ENABLED', ac.enabled, 'ตรวจพื้นที่ส่งตอนสั่งแบบส่งถึงที่ (เส้นเขต ' + (ac.poly || []).length + ' จุด)') +
      '<div class="area-tools"><div>' + areaSvg(ac, band) + '<div class="hint">เขียว = ในเขต · ฟ้า = แถบขอบที่ยังส่งได้ (' + fmt(band) + ' ม.) · จุดส้ม = ร้าน</div></div><div>' +
      '<form class="form" data-form="areaBand"><div class="field"><label for="ab-band">แถบขอบ (เมตร) · 0–5,000</label><input id="ab-band" name="band" type="number" min="0" max="5000" step="50" value="' + band + '" data-chg="admBand"></div><button class="btn sm blue" type="submit">บันทึกแถบขอบ</button><div class="hint">บันทึกแล้วระบบตรวจทุกที่อยู่ใหม่ทันที</div></form>' +
      '<form class="form" data-form="areaGrace" style="margin-top:12px"><div class="field"><label for="ab-grace">ผ่อนผันลูกค้าเดิม (หมุดเดิม/ไม่มีหมุด) ถึงวันที่</label><input id="ab-grace" name="grace" type="date" value="' + esc(ac.grace || '') + '"></div><button class="btn sm" type="submit">บันทึก</button><div class="hint">ระหว่างนี้ลูกค้าที่ยังไม่ปักหมุดใหม่ ยังสั่งส่งได้ตามเดิม · ว่าง = ไม่ผ่อนผัน</div></form>' +
      '<div class="row" style="margin-top:10px"><span>ที่อยู่ทั้งหมด</span><span>' + fmt(ac.addresses || 0) + '</span></div>' + ['in', 'band', 'out', 'none'].map(function (k) { return '<div class="row"><span>' + areaTag(k) + '</span><span>' + fmt(by[k] || 0) + '</span></div>'; }).join('') +
      '<button class="btn sm" data-a="adm" data-op="runJob" data-job="areaRetag" style="margin-top:6px">ตรวจพื้นที่ทุกที่อยู่ตอนนี้</button></div></div>' +
      '<div class="hint">แก้จุดเส้นเขตได้ที่แท็บ Area ในชีต (lat, lng เรียงตามขอบ) · สาขาอื่นสำหรับแนะนำลูกค้านอกเขตที่แท็บ Branches</div></div>';
  }
  /* ---------- 3.1.3 เครื่องมือ UAT บนระบบจริง (ผู้จัดการ + TEST_MODE) ---------- */
  function uatTools(u) {
    var cn = u.counts || {}, pins = u.pins || {}, H = (S.cat && S.cat.cfg) || {};
    var st = function (p) { var m = p.member; if (!m) return '<span class="pill">ยังไม่ลงทะเบียน</span>'; if (m.rejected) return '<span class="pill red">ปิดบัญชี</span>'; return '<span class="pill ' + (m.approved ? 'paid' : 'new') + '">' + esc(m.id) + ' ' + (m.approved ? 'อนุมัติแล้ว' : m.pending ? 'รอยืนยันผูกบัญชี' : 'รออนุมัติ') + '</span> <small class="hint">' + esc(m.type === 'Consumer' ? 'บ้าน' : 'ร้าน') + (m.status ? ' ' + esc(m.status === 'new' ? 'ลูกค้าใหม่' : m.status === 'existing' ? 'ลูกค้าเดิม' : m.status) : '') + '</small>'; };
    var h = '<div class="box test-box uat-tools" id="uat-tools"><h3>' + ic('users') + ' เครื่องมือ UAT บนระบบจริง (เฉพาะผู้จัดการ + TEST_MODE)</h3>' +
      '<div class="hint">ทดสอบเหมือนวันจริงด้วยบัญชีเดียว ข้อความถึงลูกค้าทดสอบไม่ส่งออก LINE จึงไม่เสียโควตา ข้อมูลทดสอบล้างทิ้งได้ทั้งหมดก่อนเปิดจริง เวลาจริงตอนนี้ ' + esc(String(u.realNow || '').slice(11)) + '</div>';
    /* ลูกค้าทดสอบ */
    h += '<h4>1. ลูกค้าทดสอบ (' + (u.personas || []).length + '/' + u.max + ')</h4>' + ((u.personas || []).length ? '<div class="uat-list">' + u.personas.map(function (p) {
      return '<div class="row uat-row"><span><b>' + esc(p.name) + '</b> ' + st(p) + (p.orders ? ' <small class="hint">ออเดอร์ ' + p.orders + '</small>' : '') + '<small class="hint mono">' + esc(p.uid) + '</small></span><span class="acts"><button class="btn sm blue" data-a="admUatAs" data-p="' + esc(p.uid) + '">สวมบท</button><button class="btn sm" data-a="admUatChat" data-p="' + esc(p.uid) + '">แชต</button><button class="btn sm bad" data-a="admUat" data-op="personaDel" data-uid="' + esc(p.uid) + '" data-confirm="1">ลบ</button></span></div>';
    }).join('') + '</div>' : '<div class="hint">ยังไม่มี กดเพิ่มแล้วกด "สวมบท" จะเห็นหน้าลูกค้าเหมือนคนเพิ่งเพิ่มเพื่อน OA (ลงทะเบียนใหม่ หรือผูกบัญชีลูกค้าเดิมได้)</div>') +
      '<div class="acts"><button class="btn sm" data-a="admUat" data-op="personaAdd">' + icon('plus') + ' เพิ่มลูกค้าทดสอบ</button></div>' +
      '<div class="uat-sub"><b>สมาชิกเดิมทดสอบ</b> <small class="hint">ใช้ทดสอบ "ผูกบัญชีลูกค้าเดิม" ด้วยเบอร์ / รหัส S / ชื่อ</small>' + ((u.legacy || []).length ? u.legacy.map(function (m) { return '<div class="row"><span>' + esc(m.name) + ' <small class="hint">เบอร์ <span class="mono">' + esc(m.phone) + '</span> รหัส <span class="mono">' + esc(m.sno) + '</span></small></span><span>' + (m.linked ? '<span class="pill paid">ผูกแล้ว</span>' : '<span class="pill">ยังไม่ผูก</span>') + '</span></div>'; }).join('') : '') +
      '<div class="acts"><button class="btn sm" data-a="admUat" data-op="legacyAdd" data-type="FS">' + icon('plus') + ' ร้านเดิม (FS)</button><button class="btn sm" data-a="admUat" data-op="legacyAdd" data-type="Consumer">' + icon('plus') + ' บ้านเดิม (Consumer)</button></div></div>';
    if (pins.inPin) h += '<div class="uat-sub"><b>พิกัดทดสอบ</b> <small class="hint">วางในช่อง "วางลิงก์ Google Maps หรือพิกัด" ตอนปักหมุด</small>' + [['inPin', 'ในเขตส่ง'], ['bandPin', 'แถบขอบ ' + (pins.bandM || 0) + ' ม.'], ['outPin', 'นอกเขตส่ง']].filter(function (x) { return pins[x[0]]; }).map(function (x) { return '<div class="row"><span>' + x[1] + ' <span class="mono">' + esc(pins[x[0]]) + '</span></span><button class="btn sm" data-a="admUatCopy" data-p="' + esc(pins[x[0]]) + '">คัดลอก</button></div>'; }).join('') + (!pins.area ? '<div class="hint">ยังไม่มีเส้นเขตในแท็บ Area (ทุกพิกัดส่งได้)</div>' : '') + '</div>';
    /* นาฬิกาจำลอง */
    var ck = u.clock;
    h += '<h4>2. นาฬิกาจำลอง</h4><div class="hint">เวลาที่ใช้เฉพาะคำขอของผู้จัดการที่ตั้ง (ทั้งหน้าลูกค้าตอนสวมบทและหลังร้าน) ลูกค้าคนอื่นและงานตั้งเวลาจริงใช้เวลาจริงเสมอ ปิดเองใน ' + u.clockHours + ' ชม.</div>' +
      (ck ? '<div class="alert warn">เปิดอยู่: ' + esc(C.thDate(ck.now.slice(0, 10)) + ' ' + ck.now.slice(11, 16)) + ' ตั้งโดย ' + esc(ck.by) + ' ปิดเอง ' + esc(ck.until) + ' <button class="btn sm" data-a="admUat" data-op="clockOff">ปิด</button></div>' : '') +
      '<form class="uat-clock" data-form="uatClock"><label class="field"><span>วัน</span><select name="day"><option value="today">วันนี้</option><option value="tomorrow">พรุ่งนี้</option></select></label><label class="field"><span>เวลา</span><input type="time" name="time" required value="' + esc(ck ? ck.now.slice(11, 16) : H.SHOP_OPEN || '07:00') + '"></label><button class="btn blue" type="submit">ตั้งเวลา</button></form>' +
      '<div class="acts uat-quick">' + [['today', '06:30', 'ก่อนร้านเปิด'], ['today', H.SHOP_OPEN || '07:00', 'ร้านเปิด'], ['today', '10:00', 'สาย'], ['today', hmAddLocal(H.DELIVERY_LAST_ORDER || '17:00', -5), 'ก่อนหมดเวลาส่งด่วน'], ['today', hmAddLocal(H.DELIVERY_LAST_ORDER || '17:00', 5), 'หลังหมดเวลาส่งด่วน'], ['today', hmAddLocal(H.PAY_CHASE_FROM || '18:00', 5), 'ตามเงิน'], ['today', hmAddLocal(H.SHOP_CLOSE || '19:00', 5), 'ปิดร้าน'], ['tomorrow', H.SHOP_OPEN || '07:00', 'พรุ่งนี้ร้านเปิด']].map(function (x) { return '<button class="btn sm" data-a="admUat" data-op="clock" data-day="' + x[0] + '" data-time="' + x[1] + '">' + (x[0] === 'tomorrow' ? 'พรุ่งนี้ ' : '') + x[1] + ' <small>' + x[2] + '</small></button>'; }).join('') + '</div>';
    /* รันงานแบบทดสอบ */
    h += '<h4>3. รันงานแบบทดสอบ</h4><div class="hint">ทำเหมือนงานตั้งเวลาจริง (ดูเวลา/สวิตช์ใน Config) แต่เฉพาะลูกค้าทดสอบ ข้อความไปที่แชตจำลอง ไม่ทับสถานะงานจริง</div>' +
      (u.jobList || []).map(function (j) { var r = (u.jobs || {})[j.id]; return '<div class="job-row"><div><b>' + esc(j.label) + '</b><small class="hint">' + (r ? 'ล่าสุด ' + esc(r.at) + ' · ' + esc(jobText(r)) : 'ยังไม่เคยรันแบบทดสอบ') + '</small></div><button class="btn sm" data-a="admUat" data-op="job" data-job="' + esc(j.id) + '">รันแบบทดสอบ</button></div>'; }).join('');
    /* โควตาจำลอง */
    var q = u.quota;
    h += '<h4>4. โควตาจำลอง</h4><div class="hint">ทั้งระบบเห็นโควตาเหลือตามที่ตั้ง เพื่อทดสอบการกันโควตา (ระบบงดข้อความชวนกลับ/แต้ม) และบรอดแคสต์ถูกปฏิเสธ ปิดเองใน ' + u.quotaMin + ' นาที</div>' +
      (q ? '<div class="alert warn">เปิดอยู่: เหลือ ' + q.left + ' จาก ' + q.plan + ' ปิดเอง ' + esc(q.until) + ' <button class="btn sm" data-a="admUat" data-op="quotaOff">ปิด</button></div>' : '') +
      '<form class="uat-clock" data-form="uatQuota"><label class="field"><span>โควตาที่เหลือ (ข้อความ)</span><input type="number" name="left" min="0" max="100000" inputmode="numeric" value="' + (q ? q.left : 20) + '" required></label><button class="btn blue" type="submit">ตั้งโควตาจำลอง</button></form>';
    /* แชตจำลอง */
    h += '<h4>5. แชตจำลอง (' + (cn.chat || 0) + ' ข้อความ)</h4><div class="hint">ข้อความที่ระบบจะส่งถึงลูกค้าทดสอบ และข้อความที่เก็บไว้แทนการส่งระหว่างสวมบท/รันงานทดสอบ</div><div class="acts"><button class="btn sm" data-a="admUatChat" data-p="">' + (A.uatChat ? 'โหลดใหม่' : 'เปิดแชตจำลอง') + '</button>' + (A.uatChat ? '<button class="btn sm" data-a="admUatChatClose">ซ่อน</button>' : '') + '</div>' +
      (A.uatChat ? '<div class="tc-list">' + (A.uatChat.uid ? '<div class="hint">เฉพาะ ' + esc(((u.personas || []).filter(function (p) { return p.uid === A.uatChat.uid; })[0] || {}).name || A.uatChat.uid) + '</div>' : '') + C.chatList(A.uatChat.rows, true) + '</div>' : '');
    /* ล้างข้อมูลทดสอบ */
    h += '<h4>6. ล้างข้อมูลทดสอบ</h4><form data-form="uatClean"><div class="hint">ลบเฉพาะลูกค้าทดสอบ สมาชิกเดิมทดสอบ และออเดอร์ การชำระ แต้ม ที่อยู่ เที่ยวรถ แชตจำลองของเขา ข้อมูลจริงไม่ถูกแตะ (ตอนนี้: ลูกค้าทดสอบ ' + (cn.personas || 0) + ' บัญชี, สมาชิกทดสอบ ' + (cn.members || 0) + ', ออเดอร์ทดสอบ ' + (cn.orders || 0) + ')</div><div class="field" style="max-width:260px"><label for="uat-clean">พิมพ์ TEST เพื่อยืนยัน</label><input id="uat-clean" name="confirm" autocomplete="off" class="mono" placeholder="TEST"></div><button class="btn bad" type="submit">ล้างข้อมูลทดสอบ</button></form></div>';
    return h;
  }
  function hmAddLocal(t, min) { var p = String(t).split(':'), x = Number(p[0]) * 60 + Number(p[1]) + min; x = ((x % 1440) + 1440) % 1440; return ('0' + Math.floor(x / 60)).slice(-2) + ':' + ('0' + (x % 60)).slice(-2); }
  function uatBox(d) {
    if (!d.cfg.TEST_MODE || !d.uat) return '';
    return '<form class="box test-box uat-box" data-form="uatReset"><h3>' + ic('lock') + ' รีเซ็ตข้อมูลเพื่อทดสอบ (UAT) · เฉพาะ TEST_MODE</h3><div class="alert warn">ก่อนกด: ทำสำเนา Google Sheet ไว้ก่อนเสมอ (ไฟล์ → ทำสำเนา) · ไม่แตะ Config / สินค้า / ราคา / เซ็ต / ทีมงาน / กติกา / ช่องทาง / เส้นเขต</div>' +
      d.uat.scopes.map(function (s) { return '<label class="chk"><input type="checkbox" name="scope" value="' + esc(s.id) + '"><span><b>' + esc(s.label) + '</b> <small class="mono hint">' + esc(s.id) + '</small></span></label>'; }).join('') +
      '<div class="field" style="margin-top:10px;max-width:260px"><label for="uat-confirm">พิมพ์ RESET เพื่อยืนยัน</label><input id="uat-confirm" name="confirm" autocomplete="off" class="mono" placeholder="RESET"></div><button class="btn bad" type="submit" style="margin-top:8px">ล้างข้อมูลที่เลือก</button>' +
      '<div class="hint" style="margin-top:8px">"สมาชิกที่ลงทะเบียนระหว่างทดสอบ" = ลบสมาชิกที่สมัครผ่าน LINE · ลูกค้าเดิมจากไฟล์ยังอยู่ แต่ถอดการผูก LINE · หลังล้าง ให้ทุกคนปิด/เปิด MINI App ใหม่</div>' +
      '<div class="acts" style="margin-top:10px"><button class="btn sm" type="button" data-a="adm" data-op="runJob" data-job="demoPromo">ใส่ข้อมูลโปรตัวอย่าง (P001–P014)</button><button class="btn sm" type="button" data-a="adm" data-op="runJob" data-job="pointsRelease" data-all="1">ปล่อยแต้มที่พักไว้ทั้งหมดทันที</button></div></form>';
  }
  /* ---------- v3: โปร Smart Set / Magnet Set ---------- */
  var PCAT_TH = { Main: 'สินค้าหลัก', 'Co-product': 'ผลพลอยได้', Offal: 'เครื่องใน', Trading: 'สินค้าซื้อมาขายไป', Marinated: 'หมัก/ปรุงรส', Process: 'แปรรูป', Chicken: 'ไก่', Egg: 'ไข่' };
  function onOff(v) { return v ? '<span class="pill paid">เปิด</span>' : '<span class="pill">ปิด</span>'; }
  function cfgToggle(key, on, label) { return can('manage') ? '<label class="chk cfg-toggle"><input type="checkbox" data-chg="admCfg" data-k="' + key + '"' + (on ? ' checked' : '') + '><span>' + label + '</span></label>' : '<div class="row"><span>' + label + '</span><span>' + onOff(on) + '</span></div>'; }
  /* v3.1.0 แท็บโปรโมชั่น: เลือกหน้า Smart Set / Magnet Set / สรุป */
  function poolTable(P, st, kind, mg, ed, cats, catTh) {
    var pool = (P.pool || []).filter(function (p) { return hit(p, ['sku', 'name', 'promoCat']); }), nEd = Object.keys(ed).length, smart = kind === 'smart';
    return '<div class="box"><div class="section-heading"><h3>' + (smart ? 'สินค้าที่ร่วม Smart Set' : 'สินค้าที่ร่วม Magnet Set') + '</h3>' + (mg && nEd ? '<button class="btn sm blue" data-a="admPromoSave">บันทึก ' + nEd + ' รายการ</button>' : '') + '</div>' +
      '<div class="hint">' + (smart ? 'ติ๊ก Smart = ลด ' + st.smartPct + '% เมื่อลูกค้ามีสิทธิ์ หมวด "สินค้าหลัก" ใช้นับน้ำหนักเป็นสิทธิ์' : 'ติ๊ก Magnet = ลด ' + st.magnetPct + '% ในสิทธิ์ลูกค้าใหม่') + ' GP ไม่เกิน ' + st.gpMin + '% ใส่โปรไม่ได้</div>' +
      (mg ? '<div class="acts" style="margin:8px 0"><label class="btn sm"><input type="file" accept=".xlsx,.csv" hidden data-chg="admPoolFile">' + ic('dl') + ' อัปโหลดไฟล์รายการโปร</label><button class="btn sm" data-a="admPoolTpl">' + ic('dl') + ' ดาวน์โหลดรายการปัจจุบัน</button></div>' : '') +
      searchBox('ค้นหา SKU ชื่อ หรือหมวด') + '<div class="tblw" style="margin-top:6px"><table class="promo-table"><thead><tr><th>SKU</th><th>สินค้า</th><th class="r">กก./ชิ้น</th><th class="r">ราคา</th><th class="r">GP%</th><th class="r">ขาย 30 วัน</th>' + (smart ? '<th>หมวดโปร</th><th>Smart</th>' : '<th>Magnet</th>') + '<th>หมายเหตุ</th></tr></thead><tbody>' + pool.map(function (p) {
        var e = ed[p.sku] || {}, cat = e.promoCat !== undefined ? e.promoCat : p.promoCat, sm = e.smart !== undefined ? e.smart : p.smart, mgn = e.magnet !== undefined ? e.magnet : p.magnet, dirty = !!ed[p.sku];
        return '<tr class="' + (dirty ? 'dirty' : '') + (p.why ? ' warn' : '') + '"><td class="mono">' + esc(p.sku) + '</td><td>' + esc(p.name) + (p.inStock ? '' : ' <span class="pill red">หมด</span>') + '</td><td class="r">' + fmt(p.kg) + '</td><td class="r">' + baht(p.price) + '</td><td class="r">' + (p.gp === null ? '<span class="hint">–</span>' : p.gp + '%') + '</td><td class="r">' + fmt(p.mov) + '</td>' +
          (smart ? '<td>' + (mg ? '<select data-chg="admPromoEdit" data-sku="' + esc(p.sku) + '" data-f="promoCat" aria-label="หมวดโปร ' + esc(p.name) + '"><option value="">—</option>' + cats.map(function (c) { return '<option value="' + esc(c) + '"' + (c === cat ? ' selected' : '') + '>' + esc(catTh[c] || c) + '</option>'; }).join('') + '</select>' : esc(catTh[cat] || cat || '—')) + '</td>' +
            '<td>' + (mg ? '<input type="checkbox" data-chg="admPromoEdit" data-sku="' + esc(p.sku) + '" data-f="smart"' + (sm ? ' checked' : '') + ' aria-label="Smart ' + esc(p.name) + '">' : (sm ? '✓' : '')) + '</td>'
            : '<td>' + (mg ? '<input type="checkbox" data-chg="admPromoEdit" data-sku="' + esc(p.sku) + '" data-f="magnet"' + (mgn ? ' checked' : '') + ' aria-label="Magnet ' + esc(p.name) + '">' : (mgn ? '✓' : '')) + '</td>') +
          '<td><small class="hint">' + esc(p.why || (p.noCost ? 'ยังไม่มีต้นทุน' : '')) + '</small></td></tr>';
      }).join('') + '</tbody></table></div>' + (A.poolErr && A.poolErr.length ? '<div class="alert bad" style="margin-top:8px">บันทึกไม่ได้ ' + A.poolErr.length + ' รายการ: ' + esc(A.poolErr.slice(0, 8).map(function (x) { return x.sku + ' ' + x.error; }).join(', ')) + '</div>' : '') + '</div>';
  }
  function statCards(rows) { return '<div class="report-grid">' + rows.map(function (x) { return '<div class="stat-card"><span>' + x[0] + '</span><strong>' + x[1] + '</strong>' + (x[2] ? '<small class="hint">' + esc(x[2]) + '</small>' : '') + '</div>'; }).join('') + '</div>'; }
  function adPromo(d) {
    var P = d.promo || {}, st = P.settings || {}, mg = can('manage'), cfg = d.cfg || {}, u = P.usage || {}, f = P.magnetFunnel || {}, ed = A.promoEdit || {};
    var cats = (P.catsAll || []).map(function (c) { return c.id; }), catTh = {}; (P.catsAll || []).forEach(function (c) { catTh[c.id] = c.th; });
    var sub = A.promoSub || 'smart';
    var h = '<div class="sub-tabs" role="tablist" aria-label="หัวข้อโปรโมชั่น">' + [['smart', 'Smart Set', st.smart], ['magnet', 'Magnet Set', st.magnet], ['sum', 'สรุปและแต้ม', true]].map(function (x) { var on = sub === x[0]; return '<button role="tab" class="sub-tab' + (on ? ' on' : '') + '" aria-selected="' + on + '" data-a="admPromoSub" data-p="' + x[0] + '">' + x[1] + (x[0] !== 'sum' ? ' <small class="' + (x[2] ? 'ok-t' : 'hint') + '">' + (x[2] ? 'เปิด' : 'ปิด') + '</small>' : '') + '</button>'; }).join('') + '</div>';
    if (sub === 'smart') {
      h += '<div class="box"><h3>Smart Set</h3>' + cfgToggle('SMART_ENABLED', st.smart, 'เปิดใช้ Smart Set (ซื้อสินค้าหลักทุก ' + st.trigger + ' กก. = ลด ' + st.smartPct + '% 1 ชิ้น ชิ้นละไม่เกิน ' + st.maxKg + ' กก.)') +
        (mg ? '<div class="field" style="margin-top:10px;max-width:420px"><label>สินค้าที่ใช้สิทธิ์ได้</label><select data-chg="admCfgSel" data-k="SMART_SCOPE"><option value="POOL"' + (st.scope !== 'FEATURED' ? ' selected' : '') + '>ทุกสินค้าที่ติ๊ก Smart (แนะนำ)</option><option value="FEATURED"' + (st.scope === 'FEATURED' ? ' selected' : '') + '>เฉพาะ 6 รายการของวัน</option></select></div>' : '<div class="row"><span>สินค้าที่ใช้สิทธิ์ได้</span><span>' + esc(st.scope) + '</span></div>') +
        statCards([['บิลที่ใช้ Smart Set', fmt(u.smart || 0), 'Attach ' + (u.attach || 0) + '% จาก ' + fmt(u.orders || 0) + ' บิล'], ['ส่วนลด Smart Set', baht(u.smartDisc || 0), fmt(u.smartUnits || 0) + ' ชิ้น ในช่วงวันที่']]) + '</div>';
      h += '<div class="box"><div class="section-heading"><h3>ชุดวันนี้ (' + esc(C.thDate(today())) + ')</h3>' + (mg ? '<button class="btn sm" data-a="adm" data-op="runJob" data-job="smartRotate" data-confirm="1">สุ่มชุดวันนี้ใหม่</button>' : '') + '</div>' +
        ((P.today || []).length ? '<div class="tblw"><table><thead><tr><th>หมวด</th><th>สินค้า</th><th class="r">ราคาเต็ม</th><th class="r">ราคาลด</th><th>เลือกโดย</th></tr></thead><tbody>' + P.today.map(function (x) { return '<tr><td>' + esc(catTh[x.cat] || x.cat) + '</td><td>' + esc(x.name) + ' <small class="mono hint">' + esc(x.sku) + '</small></td><td class="r">' + baht(x.full) + '</td><td class="r">' + baht(C.promoPrice(x.full, st.smartPct)) + '</td><td>' + esc(x.by || 'ระบบ') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty">ยังไม่มีชุดของวันนี้ ติ๊กสินค้าด้านล่าง แล้วกด "สุ่มชุดวันนี้ใหม่"</div>') + '<div class="hint">ระบบเปลี่ยนชุดทุกคืน ราว 00:05 หมวดละ 1 รายการ</div></div>';
      if ((P.tomorrow || []).length || mg) {
        h += '<div class="box"><h3>ชุดพรุ่งนี้ (' + esc(C.thDate(P.tomorrowDate)) + ')</h3><div class="tblw"><table class="lock-table"><thead><tr><th>หมวด</th><th>ระบบจะเลือก</th>' + (mg ? '<th>ล็อกรายการ</th>' : '') + '</tr></thead><tbody>' + (st.cats || []).map(function (cat) {
          var pick = (P.tomorrow || []).filter(function (x) { return x.cat === cat; })[0], opts = (P.pool || []).filter(function (p) { return p.smart && p.promoCat === cat && p.okSmart; });
          return '<tr><td>' + esc(catTh[cat] || cat) + '</td><td>' + (pick ? esc(pick.name) + (pick.by ? ' <span class="pill appr">ล็อกโดย ' + esc(pick.by) + '</span>' : '') : '<span class="hint">ไม่มีสินค้าในหมวดนี้</span>') + '</td>' +
            (mg ? '<td>' + (opts.length ? '<select data-chg="admSmartPick" data-cat="' + esc(cat) + '" data-date="' + esc(P.tomorrowDate) + '" aria-label="ล็อกรายการหมวด ' + esc(catTh[cat] || cat) + '"><option value="">ให้ระบบเลือก</option>' + opts.map(function (p) { return '<option value="' + esc(p.sku) + '"' + (pick && pick.by && pick.sku === p.sku ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '</select>' : '<span class="hint">ไม่มีให้เลือก</span>') + '</td>' : '') + '</tr>';
        }).join('') + '</tbody></table></div></div>';
      }
      h += poolTable(P, st, 'smart', mg, ed, cats, catTh);
    } else if (sub === 'magnet') {
      h += '<div class="box"><h3>Magnet Set (สิทธิ์ลูกค้าใหม่)</h3>' + cfgToggle('MAGNET_ENABLED', st.magnet, 'เปิดใช้ Magnet Set (ลด ' + st.magnetPct + '% สูงสุด ' + baht(st.cap) + ' ยอดหลังหักอย่างน้อย ' + baht(st.minNet) + ' ใช้ได้ภายใน ' + st.expiry + ' วัน)') +
        statCards([['ได้สิทธิ์', fmt(f.granted || 0) + ' คน', 'ยังไม่ใช้ ' + (f.available || 0) + ' หมดอายุ ' + (f.expired || 0)], ['ใช้แล้ว', fmt(f.used || 0) + ' คน', 'จองกับออเดอร์ ' + (f.reserved || 0)], ['บิลที่ใช้ Magnet', fmt(u.magnet || 0), 'ส่วนลด ' + baht(u.magnetDisc || 0)]]) + '</div>';
      h += poolTable(P, st, 'magnet', mg, ed, cats, catTh);
    } else {
      h += rangeBar([['promo', 'การใช้โปร']]) + statCards([['บิลที่ใช้ Smart Set', fmt(u.smart || 0), 'Attach ' + (u.attach || 0) + '% จาก ' + fmt(u.orders || 0) + ' บิล'], ['ส่วนลด Smart Set', baht(u.smartDisc || 0), ''], ['บิลที่ใช้ Magnet', fmt(u.magnet || 0), 'ส่วนลด ' + baht(u.magnetDisc || 0)], ['คูปอง Affiliate', baht(u.coupon || 0), 'ส่วนลดคูปองลูกค้าใหม่'], ['แต้มที่ใช้ลดบิล', baht(u.points || 0), '']]);
      h += '<div class="box"><h3>แต้มสะสม</h3>' + cfgToggle('POINTS_ENABLED', cfg.POINTS_ENABLED !== false, 'เปิดใช้แต้มสะสม (฿' + cfg.POINT_EARN_SPEND + ' = 1 แต้ม, ' + cfg.POINT_REDEEM_UNIT + ' แต้ม = ฿' + cfg.POINT_REDEEM_VALUE + ')') + '<div class="hint">1 บิลใช้ได้ 1 โปร (Smart หรือ Magnet) คูปอง Affiliate ใช้ร่วมได้ ตัวเลขเปอร์เซ็นต์และเพดานแก้ที่ชีต Config</div></div>';
    }
    return h;
  }
  /* ---------- v3: สต็อก SAP (Plan B · ไฟล์ Fiori F1595 + F1077) ---------- */
  var STOCK_MODES = [['off', 'ปิด', 'ใช้ติ๊ก "มีของ/หมด" อย่างเดียวเหมือนเดิม'], ['shadow', 'ทดลองเงียบ', 'คำนวณให้ร้านดูในแท็บนี้ ลูกค้ายังไม่เห็น (แนะนำ 2 สัปดาห์แรก)'], ['night', 'ลูกค้าเห็นนอกเวลาร้าน', 'ช่วงร้านปิด ลูกค้าเห็น "ใกล้หมด/หมด" จากไฟล์ปิดร้าน · เวลาเปิดร้านใช้ติ๊กมือ'], ['full', 'ลูกค้าเห็นตลอด', 'ลูกค้าเห็น "ใกล้หมด/หมด" ตามสต็อกคงเหลือหัก buffer ตลอดวัน']];
  var STK_TH = { ok: ['paid', 'มีของ'], low: ['new', 'ใกล้หมด'], out: ['red', 'หมด'], '': ['', '—'] };
  var MVT_TH = { receipt: 'รับเข้า', sale: 'ขาย', transfer: 'โอน', scrap: 'ตัดเสีย', adjust: 'ปรับยอด', internal: 'ย้ายภายใน', other: 'อื่น ๆ', unknown: 'ไม่รู้จัก' };
  /* 3.1.5 สถานะขายรายสินค้า (ใช้ทั้งแท็บราคา & สต๊อก และแท็บสต๊อก) */
  var SELL_STATES = [['on', 'ขายอยู่'], ['today', 'หมดวันนี้'], ['upload', 'หมดจนกว่าไฟล์ถัดไป'], ['hold', 'ระงับขาย']];
  function sellState(p) { return p.inStock ? 'on' : p.hold ? 'hold' : p.outUntil === 'upload' ? 'upload' : 'today'; }
  function sellNote(p) { return p.inStock ? '' : p.hold ? 'ระงับขาย' : p.outUntil === 'upload' ? 'จนกว่าไฟล์ถัดไป' : /^\d{4}-\d{2}-\d{2}$/.test(p.outUntil || '') ? 'กลับมาพรุ่งนี้' : 'จนกว่าจะติ๊กกลับ'; }
  /* 3.1.5 แก้สถานะสินค้าในข้อมูลทุกแท็บที่โหลดไว้ทันที (กันช่องติ๊กเด้งกลับเมื่อหน้าวาดใหม่) */
  function patchProduct(np) {
    if (!np || !np.sku) return;
    function fix(list) { (list || []).forEach(function (p) { if (p.sku === np.sku) { p.inStock = np.inStock; p.hold = np.hold; p.outUntil = np.outUntil; } }); }
    fix(S.cat && S.cat.products); Object.keys(A.d).forEach(function (k) { if (A.d[k]) fix(A.d[k].products); });
  }
  function stockCheckBox(ck, kind) {
    var c = ck.check || ck, h = '<div class="stock-check">';
    if (kind === 'snap') {
      h += '<div class="kv"><div><small>แถวที่ใช้ได้</small><b>' + fmt(c.rows) + '</b></div><div><small>SKU ที่จับคู่ได้</small><b>' + fmt(c.skus) + '</b></div><div><small>SKU หายจากไฟล์</small><b>' + fmt(c.missing.length) + ' (' + c.missingPct + '%)</b></div></div>';
      if (c.dup) h += '<div class="alert warn">ไฟล์นี้เหมือนไฟล์ที่อัปโหลดเมื่อ ' + esc(c.dup.slice(0, 16)) + ' · ถ้าเป็นไฟล์ใหม่จริง ติ๊ก "ยืนยันเป็นไฟล์ใหม่"</div>';
      if (c.partial) h += '<div class="alert bad">ไฟล์อาจไม่ครบ: ' + esc(c.partialWhy) + ' — ตรวจตัวกรอง Plant / Storage Location ใน Fiori ก่อน · ถ้าถูกต้อง ผู้จัดการติ๊กยืนยัน</div>';
      if (c.skipPlant || c.skipSloc) h += '<div class="hint">ข้ามแถว Plant อื่น ' + fmt(c.skipPlant || 0) + ' · ไม่มี Storage Location (ของระหว่างทาง) ' + fmt(c.skipSloc || 0) + '</div>';
      if (c.newSkus.length) h += '<div class="alert info">รหัส SAP ที่ยังไม่จับคู่กับสินค้าในร้าน ' + c.newSkus.length + ' รายการ (ไม่นับในสต็อก · จับคู่ได้ในกล่อง "รหัส SAP ใหม่")</div>';
      if (c.jumps.length) h += '<div class="alert warn">จำนวนเปลี่ยนผิดปกติ (เกิน 5 เท่า): ' + esc(c.jumps.slice(0, 6).map(function (j) { return j.name + ' ' + fmt(j.prev) + '→' + fmt(j.now); }).join(' · ')) + '</div>';
      if (c.zeroOpen.length) h += '<div class="alert warn">มีออเดอร์ที่ยังไม่เปิดบิลแต่สต็อกในไฟล์เป็น 0: ' + esc(c.zeroOpen.slice(0, 6).map(function (z) { return z.name; }).join(', ')) + '</div>';
      if (c.missing.length) h += '<details><summary>SKU ที่หายจากไฟล์ (' + c.missing.length + ') → จะถูกตั้งเป็น 0</summary>' + c.missing.slice(0, 60).map(function (m) { return '<div class="row"><span>' + esc(m.name) + ' <small class="mono hint">' + esc(m.sku) + '</small></span><span>เดิม ' + fmt(m.prev) + (m.big ? ' <span class="pill red">สต็อกเยอะ</span>' : '') + '</span></div>'; }).join('') + '</details>';
      h += '<details><summary>ดูตัวอย่างข้อมูล (' + c.preview.length + ' SKU)</summary><div class="tblw"><table><thead><tr><th>SKU</th><th>สินค้า</th><th class="r">เดิม</th><th class="r">ไฟล์นี้</th><th>หน่วย SAP</th></tr></thead><tbody>' + c.preview.slice(0, 200).map(function (r) { return '<tr><td class="mono">' + esc(r.sku) + '</td><td>' + esc(r.name) + '</td><td class="r">' + (r.prev === null ? '–' : fmt(r.prev)) + '</td><td class="r">' + fmt(r.now) + ' ' + esc(r.unit) + '</td><td>' + fmt(r.sap) + ' ' + esc(r.sapUnit) + '</td></tr>'; }).join('') + '</tbody></table></div></details>';
    } else {
      h += '<div class="kv"><div><small>แถวในไฟล์</small><b>' + fmt(c.rows) + '</b></div><div><small>เพิ่มใหม่</small><b>' + fmt(c.add) + '</b></div><div><small>ซ้ำ (เคยอัปโหลด)</small><b>' + fmt(c.dups) + '</b></div></div>' +
        '<div class="hint">วันที่ในไฟล์: ' + esc((c.dates || []).join(', ') || '–') + ' · รหัสที่ยังไม่จับคู่ ' + fmt(c.unmapped) + ' แถว</div>' +
        (c.unknown.length ? '<div class="alert warn">Movement Type ที่ระบบไม่รู้จัก: ' + esc(c.unknown.map(function (u) { return u.mvt + ' × ' + u.n; }).join(', ')) + ' (บันทึกได้ แต่ไม่นับเป็นยอดขาย · แจ้งผู้ดูแลระบบ)</div>' : '') +
        '<div class="row-flex" style="flex-wrap:wrap;gap:6px;margin-top:6px">' + Object.keys(c.byBucket || {}).map(function (k) { return '<span class="pill">' + esc(MVT_TH[k] || k) + ' ' + fmt(c.byBucket[k]) + '</span>'; }).join('') + '</div>';
    }
    return h + '</div>';
  }
  function adStock(d) {
    var s = d.stock || {}, mg = can('manage'), edit = can('stock'), ps = d.products || [], pm = {};
    ps.forEach(function (p) { pm[p.sku] = p; });
    var h = (s.alerts || []).map(function (a) { return '<div class="alert ' + (a.level === 'bad' ? 'bad' : a.level === 'warn' ? 'warn' : 'info') + '">' + esc(a.text) + '</div>'; }).join('');
    var mode = STOCK_MODES.filter(function (x) { return x[0] === s.mode; })[0] || STOCK_MODES[0];
    h += '<div class="box"><h3>สต็อกจาก SAP (อัปโหลดไฟล์จาก Fiori)</h3><div class="row"><span>โหมด</span><span><b>' + esc(mode[1]) + '</b></span></div><div class="hint">' + esc(mode[2]) + '</div>' +
      (mg ? '<div class="field" style="margin-top:8px;max-width:420px"><label>เปลี่ยนโหมด (ผู้จัดการ)</label><select data-chg="admCfgSel" data-k="STOCK_MODE">' + STOCK_MODES.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === s.mode ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></div>' : '') +
      '<div class="row"><span>ไฟล์ล่าสุด</span><span>' + (s.last ? esc(s.last.slice(0, 16)) + ' (' + s.ageH + ' ชม.ที่แล้ว)' : 'ยังไม่มี') + '</span></div><div class="row"><span>ตอนนี้</span><span>' + (s.isOpen ? 'เวลาเปิดร้าน · buffer × ' + s.timeFactor : 'นอกเวลาร้าน · buffer × ' + s.timeFactor) + (s.customer ? ' · <b>ลูกค้าเห็นสถานะสต็อก</b>' : ' · ลูกค้ายังไม่เห็น') + '</span></div>' +
      (s.calibAt ? '<div class="hint">คำนวณ buffer ล่าสุด ' + esc(String(s.calibAt).slice(0, 16)) + ' (จากยอดขายหน้าร้านย้อนหลัง ' + (d.cfg.STOCK_WINDOW_DAYS || 28) + ' วัน)</div>' : '') + '</div>';
    if (edit) {
      var sk = A.stk, mv = A.mv;
      h += '<div class="box"><h3>1) ไฟล์สต๊อกคงเหลือ (F1595)</h3><div class="hint">Fiori: <b>Stock – Multiple Materials</b> (F1595) Plant <b>' + esc(d.cfg.STOCK_PLANT || 'S212') + '</b> แล้ว Export .xlsx ไฟล์ใหม่แทนที่ของเดิมทั้งหมด</div>' +
        '<div class="acts" style="margin-top:8px"><div class="field" style="max-width:260px"><label>ไฟล์รอบไหน</label><select id="stk-kind" data-chg="admStockKind"><option value="close"' + (stkKind() === 'close' ? ' selected' : '') + '>ปิดร้าน (หลัง ' + esc(d.cfg.SHOP_CLOSE || '19:00') + ')</option><option value="mid"' + (stkKind() === 'mid' ? ' selected' : '') + '>ระหว่างวัน</option></select></div><input type="file" accept=".xlsx,.csv" data-chg="admStockFile"></div>';
      if (sk) h += '<div class="stock-file"><b>' + esc(sk.file) + '</b>' + stockCheckBox(sk.res, 'snap') + '<div class="acts" style="margin-top:8px">' + (sk.res.check.dup ? '<label class="chk"><input type="checkbox" id="stk-dup"><span>ยืนยันเป็นไฟล์ใหม่ (Export ใหม่แล้ว)</span></label>' : '') + (sk.res.check.partial && mg ? '<label class="chk"><input type="checkbox" id="stk-partial"><span>ผู้จัดการยืนยัน: ไฟล์ถูกต้อง (ตรวจตัวกรองแล้ว)</span></label>' : '') +
        '<button class="btn blue" data-a="admStockSave"' + (sk.res.check.partial && !mg ? ' disabled' : '') + '>บันทึกสต็อก (' + (stkKind() === 'mid' ? 'ไฟล์ระหว่างวัน' : 'ไฟล์ปิดร้าน') + ')</button><button class="btn" data-a="admStockCancel">ยกเลิกไฟล์นี้</button></div>' + (sk.res.check.partial && !mg ? '<div class="hint">ไฟล์อาจไม่ครบ ต้องให้ผู้จัดการยืนยัน</div>' : '') + '</div>';
      h += '</div><div class="box"><h3>2) ไฟล์การเคลื่อนไหว (F1077)</h3><div class="hint">Fiori: <b>Material Documents Overview</b> (F1077) วันที่วันนี้ Plant ' + esc(d.cfg.STOCK_PLANT || 'S212') + ' แล้ว Export .xlsx ใช้ปรับ buffer อัปโหลดซ้ำได้ ระบบตัดแถวซ้ำให้</div><div class="acts" style="margin-top:8px"><input type="file" accept=".xlsx,.csv" data-chg="admMovesFile" aria-label="เลือกไฟล์ F1077"></div>';
      if (mv) h += '<div class="stock-file"><b>' + esc(mv.file) + '</b>' + stockCheckBox(mv.res, 'moves') + '<div class="acts" style="margin-top:8px"><button class="btn blue" data-a="admMovesSave"' + (mv.res.check.add ? '' : ' disabled') + '>บันทึก ' + fmt(mv.res.check.add) + ' แถว</button><button class="btn" data-a="admMovesCancel">ยกเลิกไฟล์นี้</button></div></div>';
      h += '</div>';
    }
    var rows = (s.rows || []).filter(function (r) { return hit(r, ['sku', 'name', 'material']); });
    h += '<div class="box"><div class="section-heading"><h3>สต็อกคงเหลือ (' + rows.length + ')</h3>' + (mg ? '<button class="btn sm" data-a="adm" data-op="runJob" data-job="stockCalib">คำนวณ buffer ใหม่</button>' : '') + '</div><div class="hint">ขายได้ = คงเหลือ − ค้างเปิดบิล − buffer</div>' + searchBox('ค้นหา SKU / ชื่อ / รหัส SAP') +
      (rows.length ? '<div class="tblw" style="margin-top:6px"><table><thead><tr><th>สินค้า</th><th class="r">คงเหลือ</th><th class="r">ค้างเปิดบิล</th><th class="r">buffer</th><th class="r">ขายได้</th><th>สถานะ</th><th class="r">วันข้อมูล</th>' + (edit ? '<th></th>' : '') + '</tr></thead><tbody>' + rows.map(function (r) {
        var st = STK_TH[r.state] || STK_TH[''], open = A.open['stk-' + r.sku];
        return '<tr><td>' + esc(r.name) + ' <small class="mono hint">' + esc(r.sku) + (r.material ? ' · ' + esc(r.material) : '') + '</small>' + (r.note ? '<br><small class="hint">' + esc(r.note) + '</small>' : '') + (r.mult && r.mult !== 1 ? ' <span class="pill appr">× ' + r.mult + '</span>' : '') + '</td><td class="r">' + fmt(r.onHand) + ' ' + esc(r.unit) + '</td><td class="r">' + fmt(r.open) + '</td><td class="r">' + (r.bufEff === null ? fmt(r.buffer) : fmt(r.bufEff)) + '</td><td class="r">' + (r.avail === null ? '–' : fmt(r.avail)) + '</td><td><span class="pill ' + st[0] + '">' + st[1] + '</span>' + (r.manualOut ? ' <span class="pill red">ติ๊กหมด</span>' : '') + '</td><td class="r">' + fmt(r.conf) + (r.abc ? ' · ' + esc(r.abc) : '') + '</td>' +
          (edit ? '<td><button class="btn sm" data-a="admToggle" data-k="stk-' + esc(r.sku) + '">' + (open ? 'ปิด' : 'นับจริง') + '</button></td>' : '') + '</tr>' +
          (open ? '<tr><td colspan="8"><form class="acts" data-form="stockAdjust" data-sku="' + esc(r.sku) + '"><div class="field"><label>จำนวนที่นับได้จริง (' + esc(r.unit) + ')</label><input name="qty" inputmode="decimal" required value="' + r.onHand + '"></div><div class="field"><label>เหตุผล (บังคับ)</label><input name="reason" required maxlength="120" placeholder="เช่น นับจริงหลังปิดร้าน / ของเสีย"></div><button class="btn blue" type="submit">บันทึก</button></form>' +
            (mg ? '<form class="acts" data-form="stockMult" data-sku="' + esc(r.sku) + '" style="margin-top:6px"><div class="field"><label>ตัวคูณ buffer ชั่วคราวของสินค้านี้ (0.5–5 · 1 = ปกติ)</label><input name="mult" inputmode="decimal" value="' + (r.mult || 1) + '"></div><button class="btn sm" type="submit">ตั้งตัวคูณ</button></form>' : '') + '</td></tr>' : '');
      }).join('') + '</tbody></table></div>' : '<div class="empty">ยังไม่มีข้อมูลสต็อก · อัปโหลดไฟล์ F1595 ครั้งแรก</div>') + '</div>';
    if (edit) h += '<div class="box"><h3>หยุดขาย / กลับมาขาย (รายสินค้า)</h3><div class="hint">"หมดวันนี้" กลับมาขายเองพรุ่งนี้ "หมดจนกว่าไฟล์ถัดไป" กลับมาเองเมื่อไฟล์ F1595 ใหม่มีของ "ระงับขาย" ต้องเปลี่ยนกลับเอง (เช่น ของเสีย รอ QC)</div><div class="tblw" style="margin-top:6px"><table><thead><tr><th>สินค้า</th><th>สถานะขาย</th></tr></thead><tbody>' + ps.map(function (p) {
      var v = sellState(p);
      return '<tr><td>' + esc(p.name) + ' <small class="mono hint">' + esc(p.sku) + '</small>' + (p.hold ? '<br><small class="hint">' + esc(p.hold) + '</small>' : '') + '</td><td><select data-chg="admSellState" data-sku="' + esc(p.sku) + '" aria-label="สถานะขาย ' + esc(p.name) + '">' + SELL_STATES.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === v ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></td></tr>';
    }).join('') + '</tbody></table></div></div>';
    if ((s.newSkus || []).length) h += '<div class="box"><h3>รหัส SAP ใหม่ที่ยังไม่จับคู่ (' + s.newSkus.length + ')</h3><div class="hint">จับคู่กับ SKU ในร้าน + ตัวคูณหน่วย (เช่น SAP นับเป็นฟอง 30 ฟอง = 1 แผง → ตัวคูณ 30) · ถ้าไม่ขายใน MINI App กด "ไม่ขาย"</div>' + s.newSkus.map(function (n) {
      return mg ? '<form class="acts" data-form="stockMap" data-mat="' + esc(n.material) + '" style="margin-top:8px"><div class="field"><label>' + esc(n.material) + ' · ' + esc(n.name) + ' (' + fmt(n.qty) + ' ' + esc(n.unit) + ')</label><select name="sku"><option value="">เลือก SKU</option>' + ps.map(function (p) { return '<option value="' + esc(p.sku) + '">' + esc(p.sku) + ' ' + esc(p.name) + '</option>'; }).join('') + '</select></div><div class="field" style="max-width:120px"><label>ตัวคูณ</label><input name="factor" inputmode="decimal" value="1"></div><input type="hidden" name="sapUnit" value="' + esc(n.unit) + '"><button class="btn sm blue" type="submit">จับคู่</button><button class="btn sm" type="button" data-a="admMapIgnore" data-mat="' + esc(n.material) + '">ไม่ขาย</button></form>'
        : '<div class="row"><span>' + esc(n.material) + ' · ' + esc(n.name) + '</span><span>' + fmt(n.qty) + ' ' + esc(n.unit) + '</span></div>';
    }).join('') + '</div>';
    if (mg) h += '<form class="box acts" data-form="stockMult" data-sku=""><div class="field"><label>ตัวคูณ buffer ทั้งร้านชั่วคราว (เทศกาล/โปรใหญ่ · 0.5–5 · 1 = ปกติ)</label><input name="mult" inputmode="decimal" value="1"></div><button class="btn sm" type="submit">ตั้งทุกสินค้า</button></form>';
    if ((s.snaps || []).length) h += '<div class="box"><h3>ประวัติไฟล์สต็อก</h3>' + s.snaps.map(function (x) { return '<div class="row"><span>' + esc(x.at) + ' · ' + (x.kind === 'close' ? 'ปิดร้าน' : 'ระหว่างวัน') + ' · ' + esc(x.file) + '<br><small class="hint">โดย ' + esc(x.by) + (x.note ? ' · ' + esc(x.note) : '') + '</small></span><span>' + fmt(x.skus) + ' SKU' + (x.missing ? ' · หาย ' + x.missing : '') + (x.newSkus ? ' · ใหม่ ' + x.newSkus : '') + '</span></div>'; }).join('') + '</div>';
    if (can('export')) h += '<div class="dl-row"><button class="btn sm" data-a="admExport" data-k="stock">' + ic('dl') + ' สต็อกและ buffer .xlsx</button></div>';
    return h;
  }
  /* อ่านไฟล์ Fiori → ส่งตรวจ (ยังไม่บันทึก) */
  /* 3.1.5 "ไฟล์รอบไหน" อ่านค่าล่าสุดที่เลือก (เปลี่ยนหลังเลือกไฟล์ได้ หน้าวาดใหม่ไม่ล้างค่า) */
  function stkKind() { var v = A.stkKind || (A.stk && A.stk.kind) || 'close'; return v === 'mid' ? 'mid' : 'close'; }
  function stockFile(file, kind) {
    C.busy(true, 'กำลังอ่านไฟล์...');
    SHEETFILE.read(file).then(function (arr) {
      C.busy(false);
      var rows = arr.filter(function (r) { return r && r.some(function (v) { return String(v === undefined || v === null ? '' : v).trim() !== ''; }); }).map(function (r) { return r.map(function (v) { return v === undefined || v === null ? '' : String(v); }); });
      if (rows.length < 2) { toast('ไม่พบแถวข้อมูลในไฟล์'); return; }
      var body = { head: rows[0], rows: rows.slice(1), fileName: file.name, save: false };
      if (kind === 'snap') body.kind = stkKind();
      if (JSON.stringify(body).length > 3600000) { toast('ไฟล์ใหญ่เกินไป · ใน Fiori กรอง Plant ' + ((S.cat && S.cat.cfg.STOCK_PLANT) || 'S212') + ' และเลือกเฉพาะคอลัมน์ที่จำเป็นก่อน Export', 6000); return; }
      run('กำลังตรวจไฟล์...', api(kind === 'snap' ? 'stockUpload' : 'stockMoves', body), function (r) {
        if (kind === 'snap') A.stk = { file: file.name, body: body, res: r, kind: body.kind }; else A.mv = { file: file.name, body: body, res: r };
        draw();
      });
    }).catch(function (e) { C.busy(false); toast('อ่านไฟล์ไม่สำเร็จ: ' + e.message, 5000); });
  }
  /* ---------- Excel (.xlsx) เขียนเอง ไม่ต้องใช้ไลบรารี ---------- */
  var CRC = (function () { var t = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {
    var enc = new TextEncoder(), parts = [], central = [], off = 0;
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
      central.push(new Uint8Array(c.buffer), name);
      off += 30 + name.length + data.length;
    });
    var csize = central.reduce(function (s, p) { return s + p.length; }, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function xesc(s) { return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function col(i) { var s = ''; i++; while (i) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function xlsx(sheetName, columns, rows, title) {
    var all = [columns].concat(rows), widths = columns.map(function (c, j) { var w = String(c).length; rows.slice(0, 300).forEach(function (r) { w = Math.max(w, String(r[j] === undefined || r[j] === null ? '' : r[j]).length); }); return Math.min(60, Math.max(8, w + 2)); });
    var sd = all.map(function (r, i) {
      return '<row r="' + (i + 1) + '">' + r.map(function (v, j) {
        var ref = col(j) + (i + 1);
        if (i > 0 && typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + (Math.round(v) !== v ? ' s="2"' : '') + '><v>' + v + '</v></c>';
        if (v === null || v === undefined || v === '') return '';
        return '<c r="' + ref + '" t="inlineStr"' + (i === 0 ? ' s="1"' : '') + '><is><t xml:space="preserve">' + xesc(v) + '</t></is></c>';
      }).join('') + '</row>';
    }).join('');
    var last = col(columns.length - 1) + all.length;
    var sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' +
      widths.map(function (w, j) { return '<col min="' + (j + 1) + '" max="' + (j + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols><sheetData>' + sd + '</sheetData>' + (rows.length ? '<autoFilter ref="A1:' + last + '"/>' : '') + '</worksheet>';
    var name = String(sheetName || 'Sheet1').replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31);
    return zip([
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>' },
      { name: 'docProps/core.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + xesc(title || name) + '</dc:title><dc:creator>Betagro Shop โพธิ์แก้ว</dc:creator></cp:coreProperties>' },
      { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + xesc(name) + '" sheetId="1" r:id="rId1"/></sheets>' + (rows.length ? '<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">\'' + xesc(name).replace(/'/g, "''") + '\'!$A$1:$' + col(columns.length - 1) + '$' + all.length + '</definedName></definedNames>' : '') + '</workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Tahoma"/></font><font><b/><sz val="11"/><name val="Tahoma"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE9F4EC"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' },
      { name: 'xl/worksheets/sheet1.xml', data: sheet }
    ]);
  }
  function inLine() { try { return liff.isInClient(); } catch (e) { return false; } }
  function saveBlob(blob, file) {
    if (inLine()) {
      try {
        var f = new File([blob], file, { type: blob.type });
        if (navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f], title: file }).catch(function () { }); return; }
      } catch (e) { }
      toast('แอป LINE บนมือถือดาวน์โหลดไฟล์ไม่ได้ กำลังเปิดในเบราว์เซอร์…', 4000);
      var u = location.href.split('?')[0] + '?page=admin';
      try { liff.openWindow({ url: u, external: true }); } catch (e) { window.open(u, '_blank'); }
      return;
    }
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    toast('ดาวน์โหลดแล้ว: ' + file, 3500);
  }
  function doExport(kind, opt) {
    var from = A.from, to = A.to;
    if (opt.month) { from = today().slice(0, 8) + '01'; to = today(); }
    var data = { kind: kind, from: from, to: to, date: A.routeDate };
    if (opt.all) { data.from = '2000-01-01'; data.all = true; }
    C.busy(true, 'กำลังเตรียมไฟล์ Excel...');
    api('exportData', data).then(function (r) {
      C.busy(false);
      if (!r.rows.length) { toast('ช่วงวันที่นี้ไม่มีข้อมูล'); return; }
      saveBlob(xlsx(r.title, r.columns, r.rows, r.title + ' ' + r.from + ' ถึง ' + r.to), r.file);
    }).catch(C.fail);
  }

  /* ---------- อ่านไฟล์ราคา .xlsx / .csv (เขียนเอง) ---------- */
  /* ===== อ่านไฟล์ราคา .xlsx / .csv (เขียนเอง ไม่ต้องโหลดไลบรารี) → ตาราง [[...], ...] ===== */
  var SHEETFILE = (function () {
    function inflate(bytes) {
      if (!window.DecompressionStream) return Promise.reject(new Error('อุปกรณ์นี้อ่านไฟล์ .xlsx ไม่ได้ ให้บันทึกเป็น .csv หรือเปิดหน้านี้ใน Chrome บนคอมพิวเตอร์'));
      var ds = new DecompressionStream('deflate-raw');
      var stream = new Blob([bytes]).stream().pipeThrough(ds);
      return new Response(stream).arrayBuffer().then(function (b) { return new Uint8Array(b); });
    }
    function unzip(buf) {
      var u8 = new Uint8Array(buf), dv = new DataView(buf), eocd = -1;
      for (var i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
      if (eocd < 0) return Promise.reject(new Error('ไฟล์นี้ไม่ใช่ .xlsx'));
      var count = dv.getUint16(eocd + 10, true), p = dv.getUint32(eocd + 16, true), files = {}, jobs = [];
      var dec = new TextDecoder('utf-8');
      for (var k = 0; k < count; k++) {
        if (dv.getUint32(p, true) !== 0x02014b50) break;
        var method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
        var name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
        var start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
        (function (name, method, data) {
          if (!/\.(xml|rels)$/i.test(name)) return;
          jobs.push((method === 0 ? Promise.resolve(data) : inflate(data)).then(function (b) { files[name] = dec.decode(b); }));
        })(name, method, u8.slice(start, start + csize));
        p += 46 + nlen + elen + clen;
      }
      return Promise.all(jobs).then(function () { return files; });
    }
    function xml(s) { return new DOMParser().parseFromString(s, 'application/xml'); }
    function all(node, tag) { return Array.prototype.slice.call(node.getElementsByTagNameNS('*', tag)); }
    function textOf(node) { return all(node, 't').filter(function (t) { var p = t.parentNode; return !(p && (p.localName === 'rPh' || p.localName === 'phoneticPr')); }).map(function (t) { return t.textContent; }).join(''); }
    function colIndex(ref) { var m = /^([A-Z]+)/.exec(ref || ''), n = 0; if (!m) return -1; for (var i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64); return n - 1; }
    function readXlsx(buf) {
      return unzip(buf).then(function (f) {
        var sheetPath = 'xl/worksheets/sheet1.xml';
        try {
          var wb = xml(f['xl/workbook.xml']), first = all(wb, 'sheet')[0];
          var rid = first.getAttribute('r:id') || first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
          var rel = all(xml(f['xl/_rels/workbook.xml.rels']), 'Relationship').filter(function (r) { return r.getAttribute('Id') === rid; })[0];
          var tg = rel.getAttribute('Target'); sheetPath = tg.charAt(0) === '/' ? tg.slice(1) : 'xl/' + tg.replace(/^\.\//, '');
        } catch (e) { }
        if (!f[sheetPath]) throw new Error('ไม่พบชีตแรกในไฟล์ Excel');
        var ss = f['xl/sharedStrings.xml'] ? all(xml(f['xl/sharedStrings.xml']), 'si').map(textOf) : [];
        var rows = [];
        all(xml(f[sheetPath]), 'row').forEach(function (rw) {
          var out = [], next = 0;
          all(rw, 'c').forEach(function (c) {
            var ci = colIndex(c.getAttribute('r')); if (ci < 0) ci = next; next = ci + 1;
            var t = c.getAttribute('t') || 'n', vEl = all(c, 'v')[0], v = vEl ? vEl.textContent : '';
            var val = t === 's' ? (ss[Number(v)] || '') : t === 'inlineStr' ? textOf(c) : t === 'b' ? (v === '1' ? 'TRUE' : 'FALSE') : t === 'e' ? '' : v;
            while (out.length < ci) out.push('');
            out[ci] = val;
          });
          var rn = Number(rw.getAttribute('r')) || rows.length + 1;
          while (rows.length < rn - 1) rows.push([]);
          rows[rn - 1] = out;
        });
        return rows;
      });
    }
    function decodeText(buf) {
      var u8 = new Uint8Array(buf);
      try { return new TextDecoder('utf-8', { fatal: true }).decode(u8); }
      catch (e) { try { return new TextDecoder('windows-874').decode(u8); } catch (e2) { return new TextDecoder('utf-8').decode(u8); } }
    }
    function parseCsv(text) {
      text = text.replace(/^﻿/, '');
      var delim = (text.split(/\r?\n/)[0].match(/;/g) || []).length > (text.split(/\r?\n/)[0].match(/,/g) || []).length ? ';' : ',';
      var rows = [], row = [], cell = '', q = false;
      for (var i = 0; i < text.length; i++) {
        var ch = text[i];
        if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
        else if (ch === '"') q = true;
        else if (ch === delim) { row.push(cell); cell = ''; }
        else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
        else cell += ch;
      }
      if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
      return rows;
    }
    function read(file) {
      return file.arrayBuffer().then(function (buf) {
        if (/\.csv$/i.test(file.name)) return parseCsv(decodeText(buf));
        if (/\.xlsx$/i.test(file.name)) return readXlsx(buf);
        throw new Error('รองรับเฉพาะไฟล์ .xlsx และ .csv (ถ้าเป็น .xls ให้เปิดใน Excel แล้ว Save As เป็น .xlsx)');
      });
    }
    return { read: read, parseCsv: parseCsv };
  })();
  function parsePriceFile(file) {
    C.busy(true, 'กำลังอ่านไฟล์...');
    SHEETFILE.read(file).then(function (arr) {
      C.busy(false);
      var head = (arr[0] || []).map(function (h) { return String(h).trim().toLowerCase(); });
      var ix = function (k) { return head.indexOf(k); };
      if (ix('sku') < 0 || ix('t1_qty') < 0 || ix('t1_price') < 0) { toast('หัวตารางไม่ตรงรูปแบบ แถวแรกต้องมี sku, t1_qty, t1_price'); return; }
      var rows = [];
      for (var r = 1; r < arr.length; r++) {
        var row = arr[r] || [];
        if (row.every(function (v) { return String(v === undefined ? '' : v).trim() === ''; })) continue;
        var cell = function (i) { return i >= 0 && row[i] !== undefined ? String(row[i]).trim() : ''; };
        var tiers = [];
        for (var t = 1; t <= 3; t++) { var qv = cell(ix('t' + t + '_qty')), pv = cell(ix('t' + t + '_price')); if (qv === '' || pv === '') continue; tiers.push({ min: Number(qv.replace(/,/g, '')), price: Number(pv.replace(/,/g, '')) }); }
        rows.push({ sku: cell(ix('sku')), name: cell(ix('name')), unit: cell(ix('unit')), kg: cell(ix('kg')) || cell(ix('kg_per_unit')), cat: cell(ix('cat')), promo: cell(ix('promo')) === '' ? null : cell(ix('promo')), tiers: tiers });
      }
      if (!rows.length) { toast('ไม่พบแถวสินค้าในไฟล์'); return; }
      run('กำลังตรวจไฟล์...', api('priceUpload', { rows: rows, save: false }), function (res) { A.check = { rows: res.check.rows, missing: res.check.missing, upload: rows, file: file.name }; draw(); });
    }).catch(function (err) { C.busy(false); toast('อ่านไฟล์ไม่สำเร็จ: ' + err.message); });
    var inp = document.getElementById('priceFile'); if (inp) inp.value = '';
  }
  function photoUpload(input) {
    var f = input.files && input.files[0], sku = input.dataset.id, kind = input.dataset.k || 'p'; if (!f) return;
    var url = URL.createObjectURL(f), img = new Image();
    img.onload = function () {
      var k = Math.min(1, 720 / Math.max(img.width, img.height)), cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
      run('กำลังอัปโหลดรูป...', api('productImage', { id: sku, kind: kind, image: cv.toDataURL('image/jpeg', 0.82) }), function () { toast('เปลี่ยนรูปแล้ว ลูกค้าเห็นภายใน 1 นาที'); return refreshCatalog(); });
    };
    img.onerror = function () { toast('เปิดรูปไม่ได้'); };
    img.src = url;
  }

  /* ---------- แจ้งเตือนออเดอร์ใหม่ (เช็กทุก 15 วินาที เฉพาะตอนเปิดหน้านี้) ---------- */
  function noteCounts(c, fromLoad) {
    if (!c) return;
    var prev = A.counts;
    if (prev && c.latestOrder && c.latestOrder !== A.lastLatest && c.latestAt > (prev.latestAt || '')) { // 3.1.2: เตือนทุกออเดอร์ใหม่ (รวมที่ระบบรับอัตโนมัติ)
      A.alert += Math.max(1, (c.todayOrders || 0) - (prev.todayOrders || 0), c.newOrders - (prev.newOrders || 0)); beep();
      try { if (navigator.vibrate) navigator.vibrate([180, 90, 180]); } catch (e) { }
    }
    A.lastLatest = c.latestOrder; A.counts = c;
    if (!fromLoad && S.page === 'admin') document.title = (A.alert ? '(' + A.alert + ') ออเดอร์ใหม่ - ' : '') + 'หลังร้าน';
  }
  function startPoll() {
    if (A.timer) return;
    var sec = Math.max(10, Number((S.cat && S.cat.cfg.POLL_SEC) || 15)), cn = navigator.connection || {};
    if (/^(slow-2g|2g|3g)$/.test(String(cn.effectiveType || '')) || cn.saveData) sec = Math.max(sec, 30); // 3.1.2: เน็ตช้า → เช็กห่างขึ้น ไม่แย่งเน็ตกับงานอื่น
    A.timer = setInterval(poll, sec * 1000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) poll(); });
  }
  var polling = false;
  function poll() {
    if (polling || document.hidden || S.page !== 'admin') return;
    polling = true;
    api('adminPoll', { rev: A.rev }, { quiet: true, tries: 1, timeout: 12000 }).then(function (r) {
      polling = false;
      if (r.same) { if (A.dirty && !formFocus()) draw(); return; } // 3.1.5 ข้อมูลใหม่ที่โหลดมาตอนกำลังพิมพ์ → วาดเมื่อออกจากช่องแล้ว
      A.rev = r.rev; noteCounts(r.counts);
      Object.keys(A.at).forEach(function (k) { A.at[k] = 0; }); // ข้อมูลเปลี่ยน → แท็บอื่นโหลดใหม่เมื่อเปิด
      if (/orders|pay|route|members/.test(A.tab) && !formFocus()) load(A.tab, true).catch(function () { }); else draw();
    }).catch(function () { polling = false; });
  }
  function unlockAudio() {
    if (A.audioBound) return; A.audioBound = true;
    document.addEventListener('pointerdown', function () { try { if (!A.audio) A.audio = new (window.AudioContext || window.webkitAudioContext)(); if (A.audio.state === 'suspended') A.audio.resume(); } catch (e) { } }, { once: false, passive: true });
  }
  function beep() {
    if (!A.sound) return;
    try {
      var ctx = A.audio || (A.audio = new (window.AudioContext || window.webkitAudioContext)()), t = ctx.currentTime;
      [0, 0.22].forEach(function (d, i) { var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = i ? 1320 : 880; g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.35, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.18); o.connect(g); g.connect(ctx.destination); o.start(t + d); o.stop(t + d + 0.2); });
    } catch (e) { }
  }

  /* ---------- ปุ่ม / ฟอร์ม ---------- */
  /* หลังทำรายการ: แก้ข้อมูลบนจอทันทีจากผลที่ได้ แล้วโหลดล่าสุดเบื้องหลัง (ไม่ต้องรอรอบที่สอง) */
  function eachList(fn) { Object.keys(A.d).forEach(function (k) { var d = A.d[k]; if (!d) return; ['orders', 'payOrders'].forEach(function (f) { if (d[f]) fn(d[f], f, d); }); if (d.route && d.route.list) fn(d.route.list, 'route', d); }); }
  function patchOrder(o) { if (!o || !o.id) return; eachList(function (list, f) { if (f === 'route') return; for (var i = 0; i < list.length; i++) if (list[i].id === o.id) list[i] = o; }); }
  function refreshCatalog() { return api('catalog').then(function (c) { S.cat = c; A.at = {}; draw(); load(A.tab, true).catch(function () { }); }); }
  function after(r, msg, mutate) {
    if (msg) toast(msg);
    if (r && r.order) patchOrder(r.order);
    if (mutate) try { mutate(A.d[key(A.tab)] || {}); } catch (e) { }
    Object.keys(A.d).forEach(function (k) { if (k !== key(A.tab)) delete A.d[k]; }); A.at = {};
    if (S.page === 'admin') draw();
    load(A.tab, true).catch(function () { });
    return null;
  }
  function reloadQuiet() { A.at = {}; Object.keys(A.d).forEach(function (k) { if (k !== key(A.tab)) delete A.d[k]; }); return load(A.tab, true).catch(function () { }); }
  /* ทำหลายรายการด้วยคำสั่งเดียว (หลังบ้านทำในคิวเดียว ส่งข้อความ LINE พร้อมกันทีเดียว) */
  function doBulk(g, op, items, data, okMsg, optimistic) {
    if (!items.length) { toast('ในรายการที่เลือก ไม่มีรายการที่ทำคำสั่งนี้ได้'); return; }
    var call = api('bulk', { op: op, items: items.map(function (it) { return typeof it === 'object' ? it : { id: it }; }), data: data || {} });
    var done = function (r) {
      A.pick[g] = {};
      var bad = (r.results || []).filter(function (x) { return !x.ok; });
      toast((okMsg || 'เรียบร้อย') + ' ' + r.done + '/' + r.total + (bad.length ? ' · ไม่สำเร็จ ' + bad.length + ': ' + bad.slice(0, 2).map(function (x) { return x.id + ' ' + x.error; }).join(' · ') : ''), bad.length ? 7000 : 3000);
      return reloadQuiet();
    };
    if (optimistic) { optimistic(); A.pick[g] = {}; draw(); call.then(done).catch(function (e) { toast(C.friendly(e), 5000); refresh(); }); return; }
    run('กำลังทำ ' + items.length + ' รายการ...', call, function (r) { done(r); return null; });
  }
  var ACT = C.ACT, FORMS = C.FORMS;
  ACT.tab = function (el) { A.tab = el.dataset.p; A.q = ''; S.ui.navOpen = false; C.store('pk2_tab', A.tab); window.scrollTo(0, 0); show(); };
  ACT.refresh = function () { refresh(); };
  ACT.clearCheck = function () { A.check = null; draw(); };
  ACT.admSound = function () { A.sound = !A.sound; C.store('pk2_sound', A.sound); if (A.sound) { unlockAudio(); beep(); } draw(); toast(A.sound ? 'เปิดเสียงแจ้งเตือนออเดอร์ใหม่' : 'ปิดเสียงแจ้งเตือน'); };
  ACT.admBanner = function () { A.alert = 0; A.tab = 'orders'; C.store('pk2_tab', 'orders'); refresh(); };
  ACT.admRange = function (el) { A.from = el.dataset.f; A.to = el.dataset.t; show(); };
  ACT.admPayF = function (el) { A.payFilter = el.dataset.p; draw(); };
  ACT.admToggle = function (el) { A.open[el.dataset.k] = !A.open[el.dataset.k]; draw(); };
  ACT.admExport = function (el) { doExport(el.dataset.k, { month: !!el.dataset.month, all: !!el.dataset.all }); };
  ACT.admPrint = function (el) { printTrips(el.dataset.p); };
  ACT.admSelfTest = function () { run('กำลังตรวจระบบ...', api('selfTest'), function (r) { A.selfTest = r.checks; draw(); }); };
  ACT.admSlip = function (el) {
    var id = el.dataset.id;
    var showIt = function (u) { var m = document.createElement('div'); m.className = 'modal'; m.innerHTML = '<div class="modal-in"><img src="' + u + '" alt="สลิป"><button class="btn block" data-a="admClose">ปิด</button></div>'; document.body.appendChild(m); };
    if (A.slips[id]) return showIt(A.slips[id]);
    run('กำลังเปิดสลิป...', api('slipImage', { paymentId: id }), function (r) { A.slips[id] = r.dataUrl; showIt(r.dataUrl); });
  };
  ACT.admClose = function () { var m = document.querySelector('.modal'); if (m) m.remove(); };
  ACT.admActive = function (el) {
    if (el.dataset.confirm && !el.dataset.sure) { el.dataset.sure = '1'; el.textContent = 'กดอีกครั้งเพื่อยืนยัน'; return; }
    run('กำลังบันทึก...', api('teamUpdate', { uid: el.dataset.uid, active: el.dataset.on === '1' }), function () { return after(null, el.dataset.on === '1' ? 'เปิดสิทธิ์แล้ว' : 'ปิดสิทธิ์แล้ว เข้าหลังร้านไม่ได้ทันที'); });
  };
  ACT.admTripOut = function (el) {
    var trip = (A.trips || []).filter(function (t) { return String(t.no) === String(el.dataset.no); })[0], stops = (A.trips || []).reduce(function (a, t) { return a.concat(t.stops); }, []), skip = {};
    stops.forEach(function (s) { if (A.sel[s.id] === false) (s.ids || [s.id]).forEach(function (id) { skip[id] = 1; }); });
    var ids = el.dataset.ids.split(',').filter(function (id) { return !skip[id]; });
    if (!ids.length) { toast('เลือกอย่างน้อย 1 จุด'); return; }
    var cfg = (A.d[key('route')] && A.d[key('route')].cfg) || {}, etas = trip ? etaFor(trip, cfg) : {};
    A.forceOut = A.forceOut || {}; var bk = trip ? trip.bike : '', force = !!bk && Date.now() - (A.forceOut[bk] || 0) < 60000; // 3.1.2: รถยังไม่กดกลับ → กดอีกครั้งปิดเที่ยวเดิม
    run('กำลังบันทึกออกรอบ...', api('deliveryOut', { ids: ids, wave: trip ? trip.slot : '', bike: bk, rider: A.riderOf[el.dataset.no] || '', stops: trip ? trip.stops.length : ids.length, etas: etas, closePrev: force }).catch(function (e) { if (e.code === 'BIKEOUT' && bk) A.forceOut[bk] = Date.now(); throw e; }),
      function (r) { if (bk) delete A.forceOut[bk]; return after(r, 'ออกรอบ ' + r.trip + ' แล้ว ' + r.count + ' จุด' + (r.notified > 0 ? ' แจ้งเวลาถึงในแชตแล้ว ' + r.notified + ' ราย' : r.pushOut ? '' : ' ลูกค้าดูเวลาถึงได้ในแอป')); });
  };
  /* 3.1.5 คำเตือนบนปุ่มออกรถ: จำไว้ตามรถ + จุดส่ง ครบ 8 วินาทีแล้วปุ่มกลับเป็นปกติ (หน้าวาดใหม่ระหว่างนั้น คำเตือนยังอยู่) */
  function outKey(tr) { return tr.bike + '|' + tr.stops.map(function (s) { return s.id; }).join(','); }
  function outWarn(tr) { var w = A.outWarn; return w && w.key === outKey(tr) && Date.now() < w.until ? w : null; }
  function outWarnSet(el, tr, text) {
    A.outWarn = { key: outKey(tr), text: text, until: Date.now() + 8000 };
    el.dataset.sure = '1'; el.textContent = text;
    clearTimeout(A.outWarnT); A.outWarnT = setTimeout(function () { A.outWarn = null; if (S.page === 'admin' && A.tab === 'route' && !formFocus()) draw(); }, 8000);
  }
  ACT.admDispatchOut = function (el) {
    var tr = (A.trips || []).filter(function (t) { return String(t.no) === String(el.dataset.no); })[0]; if (!tr) return;
    var ids = tr.stops.filter(function (s) { return tr.stops.length < 2 || A.sel[s.id] !== false; }).map(function (s) { return s.id; }).filter(function (id, i, a) { return a.indexOf(id) === i; });
    if (!ids.length) { toast('เลือกอย่างน้อย 1 จุด'); return; }
    var notReady = tr.stops.filter(function (s) { return ids.indexOf(s.id) >= 0 && !s.ready; }).length, sure = !!el.dataset.sure || !!outWarn(tr);
    /* 3.1.2 บิลหนัก: ทุกเที่ยวของบิลเดียวกันออกพร้อมกัน แยกตามรถ (รถคันเดียวส่งครั้งเดียว รวมรอบที่ต้องวิ่งซ้ำ) */
    var heavy = tr.stops.filter(function (s) { return s.legs > 1 && ids.indexOf(s.id) >= 0; }).map(function (s) { return s.id; });
    var group = heavy.length ? (A.trips || []).filter(function (t) { return t === tr || t.stops.some(function (s) { return s.legs > 1 && heavy.indexOf(s.id) >= 0; }); }) : [tr];
    var byBike = {}, order = [];
    group.forEach(function (t) {
      var b = byBike[t.bike]; if (!b) { b = byBike[t.bike] = { bike: t.bike, ids: [], kg: 0, rounds: 0 }; order.push(t.bike); }
      (t === tr ? ids : t.stops.map(function (s) { return s.id; })).forEach(function (id) { if (b.ids.indexOf(id) < 0) b.ids.push(id); });
      b.kg += Number(t.kg) || 0; b.rounds++;
    });
    var busyB = order.filter(function (bk) { var st = (A.bikes || []).filter(function (x) { return x.bike === bk; })[0]; return st && !st.free; });
    A.forceOut = A.forceOut || {}; var forced = el.dataset.force === '1' || order.some(function (bk) { return Date.now() - (A.forceOut[bk] || 0) < 60000; }); // หลังบ้านเพิ่งบอกว่ารถยังไม่กลับ แล้วกดอีกครั้ง = ยืนยันแล้ว
    /* 3.1.5 คำเตือนก่อนออกรถ: ยังไม่เปิดบิล / รถยังไม่กลับ (บอกเวลากลับคู่กับชื่อรถแต่ละคัน) รวมเป็นข้อความเดียว ค้างครบ 8 วินาทีแม้หน้าวาดใหม่ */
    var warn = [];
    if (notReady) warn.push('ยังไม่เปิดบิล ' + notReady + ' จุด');
    if (busyB.length && !forced) warn.push(busyB.map(function (bk) { var st = (A.bikes || []).filter(function (x) { return x.bike === bk; })[0] || {}; return 'รถ ' + bk + ' ยังไม่กลับ' + (st.freeAt ? ' (กลับประมาณ ' + st.freeAt + ' น.)' : ''); }).join(', '));
    if (warn.length && !sure) { outWarnSet(el, tr, warn.join(', ') + (busyB.length && !forced ? ' ถ้ากลับแล้ว กดอีกครั้ง' : ' กดอีกครั้งเพื่อออกรถ')); return; }
    A.outWarn = null;
    var closePrev = !!busyB.length || forced;
    var calls = order.map(function (bk) { var b = byBike[bk]; return api('deliveryOut', { ids: b.ids, bike: b.bike, stops: b.ids.length, kg: heavy.length ? Math.round(b.kg * 10) / 10 : undefined, rounds: b.rounds, closePrev: closePrev, note: heavy.length ? 'บิลหนัก' + (order.length > 1 ? ' (ออกพร้อมกัน ' + order.length + ' คัน)' : '') + (b.rounds > 1 ? ' วิ่ง ' + b.rounds + ' รอบ' : '') : '' }).catch(function (e) { if (e.code === 'BIKEOUT') { el.dataset.force = '1'; A.forceOut[b.bike] = Date.now(); } throw e; }); }); // BIKEOUT = หลังบ้านเห็นว่ารถยังไม่กดกลับ (ไม่ใช้ BUSY เพราะ BUSY หน้าเว็บลองใหม่เอง) → กดอีกครั้งปิดเที่ยวเดิมให้
    run('กำลังบันทึกออกรถ...', Promise.all(calls), function (rs) {
      order.forEach(function (bk) { delete A.forceOut[bk]; });
      var r0 = rs[0] || {}, n = rs.reduce(function (s, r) { return s + (r.notified || 0); }, 0);
      var tell = n > 0 ? ' แจ้งเวลาถึงในแชตแล้ว ' + n + ' ราย' : r0.pushOut ? '' : ' ลูกค้าดูเวลาถึงได้ในแอป';
      var stops = {}; order.forEach(function (bk) { byBike[bk].ids.forEach(function (id) { stops[id] = 1; }); }); // 3.1.4 นับจุดตามลูกค้า (บิลหนักหลายคัน = 1 จุด)
      return after(r0, 'ออกรถ ' + rs.map(function (r) { return r.bike; }).join(' และ ') + ' แล้ว ' + (heavy.length && order.length > 1 ? Object.keys(stops).length : rs.reduce(function (s, r) { return s + (r.drops || r.count || 0); }, 0)) + ' จุด' + (heavy.length && order.length > 1 ? ' (บิลหนัก ' + order.length + ' คัน)' : '') + ' กลับประมาณ ' + (r0.back || '-') + ' น.' + tell);
    });
  };
  ACT.admLink = function (el) {
    if (el.dataset.confirm && !el.dataset.sure) { el.dataset.sure = '1'; el.dataset.label = el.textContent; el.textContent = 'กดอีกครั้งเพื่อยืนยัน'; setTimeout(function () { if (el.isConnected) { delete el.dataset.sure; el.textContent = el.dataset.label; } }, 4000); return; }
    var id = el.dataset.id, ok = el.dataset.ok === '1', d = A.d[key(A.tab)] || {};
    d.linkRequests = (d.linkRequests || []).filter(function (x) { return x.id !== id; }); draw(); // เอาออกจากจอทันที แล้วบันทึกเบื้องหลัง
    api('linkReview', { id: id, ok: ok }).then(function () { toast(ok ? 'ยืนยันแล้ว ลูกค้าเห็นประวัติและสิทธิ์เดิมแล้ว' : 'ถอดการผูกแล้ว แจ้งลูกค้าในแชตแล้ว', 3000); reloadQuiet(); }).catch(function (e) { toast(C.friendly(e), 5000); refresh(); });
  };
  ACT.admBack = function (el) {
    var trip = el.dataset.trip; if (!trip) return;
    el.disabled = true;
    api('tripBack', { trip: trip, markDone: true }).then(function (r) { toast('บันทึกรถกลับแล้ว' + (r.trip && r.trip.minutes !== null ? ' ' + r.trip.minutes + ' นาที' : ''), 2500); reloadQuiet(); }).catch(function (e) { el.disabled = false; toast(C.friendly(e), 5000); });
  };
  FORMS.tripBack = function (f) { var fd = new FormData(f); run('กำลังบันทึก...', api('tripBack', { trip: f.dataset.trip, kmEnd: fd.get('kmEnd') || '', markDone: !!fd.get('markDone') }), function (r) { return after(r, 'ปิดรอบแล้ว' + (r.trip && r.trip.minutes !== null ? ' ' + r.trip.minutes + ' นาที' : '') + (r.trip && r.trip.km !== null ? ' · ' + r.trip.km + ' กม.' : '')); }); };
  ACT.copyMigrate = function (el) {
    C.copyText('สวัสดีค่ะ ' + el.dataset.name.replace(/\s*\(ตัวอย่าง\)/, '') + ' ร้านเปิด LINE ของร้านแล้ว สั่งของ ดูบิล จ่ายด้วย QR ได้ในที่เดียว กดลิงก์นี้แล้วผูกเลขสมาชิกได้เลย: ' + (el.dataset.link || ''));
    api('markFollow', { id: el.dataset.id, status: 'link' }).catch(function () { });
  };
  ACT.admPickClear = function (el) { A.pick[el.dataset.g] = {}; draw(); };
  ACT.admBulk = function (el) {
    if (el.dataset.confirm && !el.dataset.sure) { el.dataset.sure = '1'; el.dataset.label = el.textContent; el.textContent = 'กดอีกครั้งเพื่อยืนยัน'; setTimeout(function () { if (el.isConnected) { delete el.dataset.sure; el.textContent = el.dataset.label; } }, 4000); return; }
    var g = el.dataset.g, op = el.dataset.op, ids = picked(g), d = A.d[key(A.tab)] || {}, byId = {};
    (d.orders || []).concat(d.payOrders || []).forEach(function (o) { byId[o.id] = o; });
    function st(re) { return ids.filter(function (id) { return byId[id] && re.test(byId[id].status); }); }
    if (op === 'approveOrder') return doBulk(g, op, st(/^new$/), {}, 'อนุมัติแล้ว', function () { st(/^new$/).forEach(function (id) { byId[id].status = 'approved'; }); });
    if (op === 'cancelOrder') return doBulk(g, op, st(/^(new|approved)$/), { reason: 'ยกเลิกโดยร้าน' }, 'ยกเลิกแล้ว');
    if (op === 'remindOne') return doBulk(g, op, st(/^billed$/), {}, 'ส่งเตือนจ่ายแล้ว');
    if (op === 'confirmPay') return doBulk(g, op, ids.filter(function (id) { return byId[id] && byId[id].pay.pending > 0; }), {}, 'ยืนยันยอดแล้ว');
    if (op === 'confirmPayFull') return doBulk(g, 'confirmPay', ids.filter(function (id) { return byId[id] && byId[id].status !== 'paid'; }), { full: true, note: 'พนักงานยืนยันรับเงินครบ (หลายรายการ)' }, 'บันทึกรับเงินครบแล้ว');
    if (op === 'approveMember') {
      var miss = [], items = ids.map(function (id) { var f = app().querySelector('form[data-form=approveMember][data-id="' + id + '"]'), sno = f ? f.elements.sno.value.trim() : '', zone = f && f.elements.zone ? f.elements.zone.value : ''; if (!sno) miss.push(id); return { id: id, sno: sno, zone: zone, clearFlags: !!(f && f.elements.clearFlags && f.elements.clearFlags.checked) }; });
      if (miss.length) { toast('ใส่เลขสมาชิก S ให้ครบก่อน (ยังขาด ' + miss.length + ' ร้าน)', 4500); return; }
      return doBulk(g, op, items, {}, 'อนุมัติสมาชิกแล้ว');
    }
    if (op === 'rejectMember') return doBulk(g, op, ids, {}, 'ปิดบัญชีแล้ว');
    if (op === 'memberZone') { var z = (document.getElementById('bulk-zone') || {}).value; if (!z) { toast('เลือกโซนก่อน'); return; } return doBulk(g, 'memberUpdate', ids.map(function (id) { return { id: id, zone: z }; }), {}, 'ตั้งโซนแล้ว'); }
    if (op === 'markFollow') return doBulk(g, op, ids, { status: 'call' }, 'บันทึกแล้ว', function () { ((d.migration || {}).list || []).forEach(function (x) { if (ids.indexOf(x.id) >= 0) x.follow = 'call'; }); });
    if (op === 'approveCoin') return doBulk(g, op, ids, {}, 'อนุมัติส่วนลดสะสมแล้ว');
    if (op === 'setStockOn' || op === 'setStockOff') return doBulk(g, 'setStock', ids, { inStock: op === 'setStockOn', kind: op === 'setStockOn' ? '' : 'today' }, op === 'setStockOn' ? 'มีของแล้ว' : 'ตั้งเป็นหมดวันนี้แล้ว', function () { ids.forEach(function (sku) { patchProduct({ sku: sku, inStock: op === 'setStockOn', hold: '', outUntil: op === 'setStockOn' ? '' : today() }); }); });
    if (op === 'imgReset' || op === 'imgClear') return doBulk(g, 'productImage', ids, { mode: op === 'imgReset' ? 'reset' : 'clear' }, op === 'imgReset' ? 'คืนรูปเริ่มต้นแล้ว' : 'ลบรูปแล้ว');
    if (op === 'pointsOk' || op === 'pointsNo') return doBulk(g, 'pointsReview', ids, { ok: op === 'pointsOk', note: op === 'pointsNo' ? 'ไม่อนุมัติ (หลายรายการ)' : '' }, op === 'pointsOk' ? 'อนุมัติแต้มแล้ว' : 'ไม่อนุมัติแล้ว');
    if (op === 'deliveryDone') return doBulk(g, op, ids, {}, 'บันทึกส่งแล้ว', function () { ((d.route || {}).list || []).forEach(function (x) { if (ids.indexOf(x.id) >= 0) { x.delivery = 'done'; x.deliveredAt = new Date().toISOString().slice(0, 16).replace('T', ' '); } }); });
    toast('ยังไม่รองรับคำสั่งนี้');
  };
  function app() { return document.getElementById('app'); }
  function jobText(r) {
    if (!r) return '';
    var x = [];
    var other = r.released !== undefined || r.changed !== undefined || r.products !== undefined || !!r.picks || r.skus !== undefined;
    if (r.sent || !other) x.push('ส่ง ' + (r.sent || 0) + ' ข้อความ');
    if (r.released !== undefined) x.push('ปล่อยแต้ม ' + r.released + ' รายการ');
    if (r.changed !== undefined) x.push('ที่อยู่เปลี่ยนสถานะ ' + r.changed + ' ที่');
    if (r.products !== undefined) x.push('ตั้งสินค้าโปรตัวอย่าง ' + r.products + ' รายการ');
    if (r.picks) x.push('Smart Set ' + r.picks.length + ' รายการ' + (r.kept ? ' (ใช้ชุดเดิม)' : ''));
    if (r.skus !== undefined) x.push('คำนวณ buffer ' + r.skus + ' SKU');
    if (r.reason) x.push(r.reason);
    return x.length ? x.join(' · ') : 'ทำแล้ว (ไม่มีรายการที่ต้องทำ)';
  }
  ACT.admPicking = function (el) { printPicking(picked(el.dataset.g)); };
  ACT.admCopyMigrate = function (el) {
    var d = A.d[key(A.tab)] || {}, ids = picked(el.dataset.g), link = d.cfg && d.cfg.LIFF_ID ? C.appLink('link', {}) : '';
    var list = ((d.migration || {}).list || []).filter(function (x) { return ids.indexOf(x.id) >= 0; });
    C.copyText(list.map(function (x) { return x.name.replace(/\s*\(ตัวอย่าง\)/, '') + ' ' + (x.phone || '') + '\nสวัสดีค่ะ ร้านเปิด LINE ของร้านแล้ว สั่งของ ดูบิล จ่ายด้วย QR ได้ในที่เดียว กดลิงก์นี้แล้วผูกเลขสมาชิกได้เลย: ' + link; }).join('\n\n'));
    doBulk(el.dataset.g, 'markFollow', ids, { status: 'link' }, 'คัดลอกแล้ว · ทำเครื่องหมาย "ส่งลิงก์แล้ว"', function () { list.forEach(function (x) { x.follow = 'link'; }); });
  };
  ACT.admTripSel = function (el) { var t = (A.trips || []).filter(function (x) { return String(x.no) === String(el.dataset.no); })[0]; if (!t) return; t.stops.forEach(function (s) { A.sel[s.id] = el.dataset.on === '1'; }); draw(); };
  ACT.admImg = function (el) {
    if (el.dataset.confirm && !el.dataset.sure) { el.dataset.sure = '1'; el.dataset.label = el.textContent; el.textContent = 'ยืนยัน?'; setTimeout(function () { if (el.isConnected) { delete el.dataset.sure; el.textContent = el.dataset.label; } }, 4000); return; }
    run(el.dataset.mode === 'reset' ? 'กำลังคืนรูปเดิม...' : 'กำลังลบรูป...', api('productImage', { id: el.dataset.id, kind: el.dataset.k, mode: el.dataset.mode }), function () { toast(el.dataset.mode === 'reset' ? 'คืนรูปเริ่มต้นแล้ว' : 'ลบรูปแล้ว (แสดงไอคอนแทน)'); return refreshCatalog(); });
  };
  ACT.admForceTxn = function (el) {
    var id = el.dataset.id, dp = A.dupTxn[id]; if (!dp) return;
    run('กำลังส่งบิล...', api('billOrder', { id: id, txn: dp.txn, actual: dp.actual, forceTxn: true }), function (r) { delete A.dupTxn[id]; return after(r, 'ส่งบิลให้ลูกค้าแล้ว'); });
  };
  ACT.admAsRole = function (el) {
    S.asRole = el.dataset.p || ''; C.store('pk2_asrole', S.asRole || null);
    A.d = {}; A.at = {}; A.tab = S.asRole === 'driver' ? 'route' : 'orders'; A.pick = {};
    toast(S.asRole ? 'กำลังดูเป็น ' + ROLE_AS[S.asRole][0] + ' (ทดสอบ)' : 'กลับเป็นผู้จัดการแล้ว'); show();
  };
  /* 3.1.3 เครื่องมือ UAT บนระบบจริง */
  function uatAfter(r, msg) { return after(r, msg, function (d) { if (r && r.uatTools) d.uatTools = r.uatTools; }); }
  ACT.admUat = function (el) {
    if (el.dataset.confirm && !el.dataset.sure) { el.dataset.sure = '1'; el.dataset.label = el.textContent; el.textContent = 'กดอีกครั้งเพื่อยืนยัน'; setTimeout(function () { if (el.isConnected) { delete el.dataset.sure; el.textContent = el.dataset.label; } }, 4000); return; }
    var op = el.dataset.op, data = { op: op };
    if (op === 'personaDel') data.uid = el.dataset.uid;
    if (op === 'legacyAdd') data.type = el.dataset.type;
    if (op === 'job') data.job = el.dataset.job;
    if (op === 'clock') { data.day = el.dataset.day; data.time = el.dataset.time; }
    run(op === 'job' ? 'กำลังรันงานแบบทดสอบ...' : 'กำลังทำรายการ...', api('uatTool', data), function (r) {
      var msg = { personaAdd: r.persona ? 'เพิ่ม ' + r.persona.name + ' แล้ว กด "สวมบท" เพื่อใช้หน้าลูกค้า' : 'เพิ่มแล้ว', personaDel: 'ลบลูกค้าทดสอบและข้อมูลของเขาแล้ว', legacyAdd: r.legacy ? 'เพิ่ม ' + r.legacy.name + ' เบอร์ ' + r.legacy.phone + ' รหัส ' + r.legacy.sno : 'เพิ่มแล้ว',
        clock: 'ตั้งนาฬิกาจำลองแล้ว', clockOff: 'ปิดนาฬิกาจำลองแล้ว (กลับเป็นเวลาจริง)', quotaOff: 'ปิดโควตาจำลองแล้ว', job: r.job ? 'ผล: ' + jobText(r.job) : 'รันแล้ว' }[op] || 'เรียบร้อย';
      if (op === 'job') A.jobRes = null;
      if (A.uatChat && /job|personaDel/.test(op)) A.uatChat = null;
      return uatAfter(r, msg);
    }).catch(function () { });
  };
  ACT.admUatAs = function (el) { var uid = el.dataset.p; if (!uid) return; toast('กำลังเปิดหน้าลูกค้าในนามลูกค้าทดสอบ...', 2500); C.personaStart(uid); };
  ACT.admUatChat = function (el) {
    var uid = el.dataset.p || '';
    run('กำลังโหลดแชตจำลอง...', api('uatTool', { op: 'chat', uid: uid, limit: 40 }), function (r) { A.uatChat = { uid: uid, rows: r.chat || [] }; draw(); var b = document.getElementById('uat-tools'); if (b && uid) b.querySelector('.tc-list') && b.querySelector('.tc-list').scrollIntoView({ block: 'nearest' }); }).catch(function () { });
  };
  ACT.admUatChatClose = function () { A.uatChat = null; draw(); };
  ACT.admUatCopy = function (el) { C.copyText(el.dataset.p || ''); };
  FORMS.uatClock = function (f) { var fd = new FormData(f); run('กำลังตั้งนาฬิกาจำลอง...', api('uatTool', { op: 'clock', day: fd.get('day'), time: fd.get('time') }), function (r) { return uatAfter(r, 'ตั้งนาฬิกาจำลองแล้ว'); }).catch(function () { }); };
  FORMS.uatQuota = function (f) { var fd = new FormData(f); run('กำลังตั้งโควตาจำลอง...', api('uatTool', { op: 'quota', left: fd.get('left') }), function (r) { return uatAfter(r, 'ตั้งโควตาจำลองแล้ว (เหลือ ' + (r.uatTools && r.uatTools.quota ? r.uatTools.quota.left : fd.get('left')) + ')'); }).catch(function () { }); };
  FORMS.uatClean = function (f) {
    var v = String(new FormData(f).get('confirm') || '').trim(); if (v !== 'TEST') { toast('พิมพ์คำว่า TEST (ตัวพิมพ์ใหญ่) เพื่อยืนยัน'); return; }
    run('กำลังล้างข้อมูลทดสอบ...', api('uatTool', { op: 'clean', confirm: 'TEST' }), function (r) { A.uatChat = null; var c = r.cleaned || {}; return uatAfter(r, 'ล้างแล้ว: สมาชิก ' + (c.members || 0) + ', ออเดอร์ ' + (c.orders || 0) + (c.unlinked ? ', ถอดการผูก ' + c.unlinked : '')); }).catch(function () { });
  };
  /* นาฬิกาจำลองเปลี่ยน (ตั้ง/ปิด/หมดอายุ) → วันที่ของตัวกรองและหน้าจัดรอบส่งตามวันของนาฬิการ้าน */
  function onClock(dayBefore) {
    var t = today(), ch = false;
    ['from', 'to', 'routeDate'].forEach(function (k) { if (A[k] === dayBefore && dayBefore !== t) { A[k] = t; ch = true; } });
    if (S.page === 'admin' && !A.locked) { if (ch) refresh(); else if (A.d[key(A.tab)]) draw(); }
  }
  ACT.admLogout = function (el) {
    if (!el.dataset.sure) { el.dataset.sure = '1'; toast('กดปุ่มออกจากระบบอีกครั้งเพื่อยืนยัน (ล้างข้อมูลหลังร้านในเครื่องนี้)', 3500); setTimeout(function () { delete el.dataset.sure; }, 4000); return; }
    try { Object.keys(localStorage).forEach(function (k) { if (/^(pk2_|cart_)/.test(k)) localStorage.removeItem(k); }); } catch (e) { }
    A.d = {}; clearInterval(A.timer);
    try { if (liff.isLoggedIn() && !liff.isInClient()) liff.logout(); } catch (e) { }
    try { if (liff.isInClient()) { liff.closeWindow(); return; } } catch (e) { }
    location.href = location.pathname;
  };
  ACT.admSpeed = function () {
    var t = [], n = 0;
    (function one() {
      var t0 = Date.now();
      api('ping', {}, { quiet: true, tries: 1 }).then(function () { t.push(Date.now() - t0); }, function () { }).then(function () {
        if (++n < 5) return one();
        A.speed = t.length ? { avg: Math.round(t.reduce(function (a, b) { return a + b; }, 0) / t.length), min: Math.min.apply(null, t), max: Math.max.apply(null, t) } : null; draw();
      });
    })();
    toast('กำลังวัด 5 ครั้ง...');
  };
  ACT.admImportTpl = function () {
    saveBlob(xlsx('Customers', ['s_member_no', 'name', 'phone', 'type', 'address', 'zone', 'lat', 'lng', 'trade', 'contact', 'avg_month', 'tax_id'], [['S0000109999', 'ร้านตัวอย่าง (สมมติ)', '0890009999', 'FS', 'ซ.ตัวอย่าง 1', 'A', 13.8001, 100.6402, 'อาหารตามสั่ง', 'คุณตัวอย่าง', 12000, '0105500000000']], 'แม่แบบนำเข้ารายชื่อลูกค้าเดิม'), 'Phokeaw_customer_master_template.xlsx');
  };
  ACT.admImportSave = function () { var im = A.imp; if (!im) return; run('กำลังบันทึก...', api('memberImport', { rows: im.rows, save: true, fileName: im.file }), function (r) { A.imp = null; return after(r, 'เพิ่ม ' + r.added + ' · อัปเดต ' + r.updated + ' ร้าน'); }); };
  ACT.admImportCancel = function () { A.imp = null; draw(); };
  function importFile(file) {
    C.busy(true, 'กำลังอ่านไฟล์...');
    SHEETFILE.read(file).then(function (arr) {
      C.busy(false);
      var alias = { s_member_no: /^(s_member_no|sno|member_no|เลขสมาชิก|เลข s)$/i, name: /^(name|ชื่อ|ชื่อร้าน)$/i, phone: /^(phone|tel|เบอร์|เบอร์โทร)$/i, type: /^(type|ประเภท)$/i, address: /^(address|ที่อยู่)$/i, zone: /^(zone|โซน)$/i, lat: /^(lat|latitude|ละติจูด)$/i, lng: /^(lng|lon|long|longitude|ลองจิจูด)$/i, trade: /^(trade|ประเภทธุรกิจ)$/i, contact: /^(contact|ผู้ติดต่อ)$/i, avg_month: /^(avg_month|ยอดเฉลี่ย)$/i, tax_id: /^(tax_id|taxid|tax id|เลขผู้เสียภาษี|เลขภาษี)$/i };
      var head = (arr[0] || []).map(function (h) { return String(h).trim(); }), ix = {};
      Object.keys(alias).forEach(function (k) { ix[k] = head.findIndex(function (h) { return alias[k].test(h); }); });
      if (ix.s_member_no < 0 && ix.phone < 0) { toast('ไม่พบคอลัมน์ s_member_no หรือ phone ในแถวแรก'); return; }
      var rows = [];
      for (var i = 1; i < arr.length; i++) { var row = arr[i] || []; if (row.every(function (v) { return String(v === undefined ? '' : v).trim() === ''; })) continue; var o = {}; Object.keys(ix).forEach(function (k) { o[k] = ix[k] >= 0 && row[ix[k]] !== undefined ? String(row[ix[k]]).trim() : ''; }); rows.push(o); }
      if (!rows.length) { toast('ไม่พบแถวข้อมูล'); return; }
      run('กำลังตรวจไฟล์...', api('memberImport', { rows: rows }), function (r) { A.imp = { rows: rows, check: r.check, sum: r.sum, file: file.name }; draw(); });
    }).catch(function (e) { C.busy(false); toast('อ่านไฟล์ไม่สำเร็จ: ' + e.message); });
  }
  ACT.adm = function (el) {
    if (el.dataset.confirm && !el.dataset.sure) { el.dataset.sure = '1'; el.dataset.label = el.textContent; el.textContent = 'กดอีกครั้งเพื่อยืนยัน'; setTimeout(function () { if (el.isConnected) { delete el.dataset.sure; el.textContent = el.dataset.label; } }, 4000); return; }
    var op = el.dataset.op, data = { id: el.dataset.id, status: el.dataset.status, job: el.dataset.job, code: el.dataset.code };
    if (el.dataset.all) data.all = el.dataset.all === '1'; if (el.dataset.ok !== undefined) data.ok = el.dataset.ok === '1'; if (el.dataset.what) data.what = el.dataset.what;
    if (op === 'payReview') data = { paymentId: el.dataset.pid, ok: el.dataset.ok === '1' };
    if (op === 'confirmPay' && el.dataset.full) data.full = true;
    var cur = A.d[key(A.tab)] || {};
    if (op === 'approveOrder' || op === 'deliveryDone' || op === 'markFollow') { // เปลี่ยนบนจอทันที แล้วบันทึกเบื้องหลัง
      if (op === 'approveOrder') eachList(function (list) { list.forEach(function (o) { if (o.id === data.id) o.status = 'approved'; }); });
      if (op === 'deliveryDone') ((cur.route || {}).list || []).forEach(function (x) { if (x.id === data.id) x.delivery = 'done'; });
      if (op === 'markFollow') ((cur.migration || {}).list || []).forEach(function (x) { if (x.id === data.id) x.follow = data.status; });
      draw();
      api(op, data).then(function (r) { if (r.order) patchOrder(r.order); toast(op === 'approveOrder' ? 'อนุมัติแล้ว ส่งไปจัดของ' : 'บันทึกแล้ว', 1800); reloadQuiet(); }).catch(function (e) { toast(C.friendly(e), 5000); refresh(); });
      return;
    }
    run('กำลังทำรายการ...', api(op, data), function (r) {
      if (op === 'runJob') { A.jobRes = r; toast(jobText(r), 3500); return (/smartRotate|demoPromo|stockCalib|areaRetag/.test(data.job) ? api('catalog').then(function (c) { S.cat = c; }) : Promise.resolve()).then(function () { return after(r); }); }
      if (op === 'memberStatus') return after(r, data.status === 'new' ? 'ตั้งเป็นลูกค้าใหม่แล้ว (ได้สิทธิ์ลูกค้าใหม่)' : 'ตั้งเป็นลูกค้าเดิมแล้ว');
      if (op === 'pointsReview') return after(r, data.ok ? 'อนุมัติแต้มแล้ว' : 'ไม่อนุมัติแล้ว', function (d) { if (d.points) d.points.review = (d.points.review || []).filter(function (x) { return x.id !== data.id; }); });
      if (op === 'uatMember') return after(r, { magnet: 'คืนสิทธิ์ Magnet แล้ว', 'new': 'ให้สิทธิ์ลูกค้าใหม่ใหม่แล้ว', points: 'ล้างแต้มแล้ว' }[data.what] || 'เรียบร้อย');
      if (op === 'approveCoins') return after(r, 'อนุมัติ ' + r.approved + ' รายการ');
      if (op === 'askShort') return after(r, r.sent ? 'ส่งข้อความขอยอดที่ขาด ' + baht(r.short) + ' แล้ว' : 'บันทึกแล้ว (ลูกค้ายังไม่เพิ่มเพื่อน OA/ส่งไม่สำเร็จ)');
      if (op === 'remindOne') return after(r, r.sent ? 'ส่งเตือนแล้ว' : 'ส่งไม่สำเร็จ (ดู MessageLog)');
      if (op === 'confirmPay' || op === 'payReview') return after(r, r.paid ? 'ชำระครบ ปิดบิลแล้ว' + (r.pay && r.pay.over ? ' (โอนเกิน ' + baht(r.pay.over) + ' → เครดิต)' : '') : 'บันทึกแล้ว · คงค้าง ' + baht(r.pay ? Math.max(0, r.pay.balance) : 0) + (r.notified ? ' (แจ้งลูกค้าในแชตแล้ว)' : ''));
      if (op === 'cacheClear') { return api('catalog').then(function (c) { S.cat = c; return after(r, 'ล้างแคชแล้ว'); }); }
      if (op === 'priceApply') return api('catalog').then(function (c) { S.cat = c; return after(r, 'ราคาใหม่มีผลแล้ว'); });
      if (op === 'rejectMember' || op === 'anonymizeMember' || op === 'privacyDone') return after(r, op === 'anonymizeMember' ? 'ลบข้อมูลส่วนบุคคลแล้ว (ที่อยู่ ' + (r.addresses || 0) + ' แห่ง ออเดอร์ ' + (r.orders || 0) + ' ใบ' + (r.cancelled && r.cancelled.length ? ' ยกเลิกออเดอร์ที่ยังไม่เปิดบิล ' + r.cancelled.length + ' ใบ' : '') + ')' : op === 'rejectMember' ? 'ปิดบัญชีแล้ว' + (r.cancelled && r.cancelled.length ? ' ยกเลิกออเดอร์ที่ยังไม่เปิดบิล ' + r.cancelled.length + ' ใบ' : '') : 'ปิดคำขอแล้ว', function (d) { d.pendingMembers = (d.pendingMembers || []).filter(function (m) { return m.id !== data.id; }); d.privacy = (d.privacy || []).filter(function (m) { return m.id !== data.id; }); });
      if (op === 'approveCoin') return after(r, 'อนุมัติแล้ว', function (d) { d.coinsPending = (d.coinsPending || []).filter(function (c) { return c.id !== data.id; }); });
      return after(r, 'เรียบร้อย');
    }).catch(function () { });
  };
  function geoParse(s) { var m = /(-?\d{1,2}\.\d+)\s*,\s*(-?\d{2,3}\.\d+)/.exec(String(s || '')) || /@(-?\d{1,2}\.\d+),(-?\d{2,3}\.\d+)/.exec(String(s || '')); return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null; }
  FORMS.billOrder = function (f) {
    var fd = new FormData(f), id = f.dataset.id, txn = String(fd.get('txn') || ''), actual = String(fd.get('actual')).replace(/,/g, '');
    C.busy(true, 'กำลังส่งบิล...');
    api('billOrder', { id: id, txn: txn, actual: actual }).then(function (r) { C.busy(false); delete A.dupTxn[id]; after(r, 'ส่งบิลให้ลูกค้าแล้ว'); }).catch(function (e) {
      C.busy(false);
      if (e.code === 'DUPTXN') { A.dupTxn[id] = { txn: txn, actual: actual, msg: e.message }; draw(); var el = document.getElementById('o-' + id); if (el) el.scrollIntoView({ block: 'center' }); return; }
      C.fail(e);
    });
  };
  FORMS.approveMember = function (f) { var fd = new FormData(f), id = f.dataset.id; run('กำลังอนุมัติ...', api('approveMember', { id: id, sno: fd.get('sno'), zone: fd.get('zone') || '', clearFlags: !!fd.get('clearFlags') }), function () { return after(null, 'อนุมัติแล้ว', function (d) { d.pendingMembers = (d.pendingMembers || []).filter(function (m) { return m.id !== id; }); }); }); };
  FORMS.memberUpdate = function (f) {
    var fd = new FormData(f), data = { id: f.dataset.id, zone: fd.get('zone') || '', address: fd.get('address'), phone: fd.get('phone'), deliveryNote: fd.get('deliveryNote') || '', needBy: fd.get('needBy') || '', trade: fd.get('trade') || '', yard: fd.get('yard') || '' };
    if (fd.get('geo') !== null) { var g = geoParse(fd.get('geo')); if (g) { data.lat = g.lat; data.lng = g.lng; } else if (!String(fd.get('geo') || '').trim()) { data.lat = ''; data.lng = ''; } } // v3: ปักหมุดผ่านช่อง "ปักหมุดให้ลูกค้า" (สมุดที่อยู่)
    run('กำลังบันทึก...', api('memberUpdate', data), function () { A.open['mem-' + f.dataset.id] = false; return after(null, 'บันทึกแล้ว'); });
  };
  FORMS.setPilot = function (f) { run('กำลังบันทึก...', api('setPilot', { id: new FormData(f).get('id'), on: true }), function () { return after(null, 'ให้สิทธิ์ชวนเพื่อนแล้ว'); }); };
  FORMS.createSign = function (f) { var fd = new FormData(f); run('กำลังสร้าง...', api('createSign', { name: fd.get('name'), type: fd.get('type'), area: fd.get('area') }), function (r) { return after(r, 'สร้างป้าย ' + r.id + ' แล้ว'); }); };
  FORMS.broadcast = function (f) { // 3.1.2: กดยืนยันก่อนส่ง (ใช้โควตาทีเดียวทั้งกลุ่ม)
    var fd = new FormData(f), btn = f.querySelector('button[type=submit]'), sel = f.querySelector('select[name=segment]'), tpl = f.querySelector('select[name=template]');
    var opt = sel ? sel.options[sel.selectedIndex] : null, label = opt ? opt.textContent : '', n = (/\((\d[\d,]*) คน\)/.exec(label) || [0, '?'])[1], lv = opt && opt.dataset.live !== undefined ? opt.dataset.live : n, key = fd.get('segment') + '|' + fd.get('template');
    if (f.dataset.sure !== key) { f.dataset.sure = key; if (btn) btn.textContent = 'ยืนยันส่ง "' + (tpl ? tpl.options[tpl.selectedIndex].textContent : '') + '" ถึง ' + n + ' คน (ใช้โควตา ' + lv + ' ข้อความ' + (String(lv) !== String(n) ? ', ลูกค้าทดสอบไปแชตจำลอง' : '') + ')'; /* 3.1.4 นับโควตาเฉพาะคนจริง */ setTimeout(function () { if (f.isConnected && f.dataset.sure === key) { delete f.dataset.sure; if (btn) btn.textContent = 'ส่ง'; } }, 8000); return; }
    delete f.dataset.sure;
    run('กำลังส่ง...', api('broadcast', { segment: fd.get('segment'), template: fd.get('template') }), function (r) { return after(r, 'ส่งถึง ' + r.sent + ' คน' + (r.test ? ' (คนจริง ' + r.live + ', ลูกค้าทดสอบ ' + r.test + ' ไปแชตจำลอง)' : '')); });
  };
  FORMS.counterBill = function (f) { var fd = new FormData(f); run('กำลังบันทึก...', api('counterBill', { memberId: fd.get('memberId'), txn: fd.get('txn'), amount: fd.get('amount') }), function () { return after(null, 'บันทึกแล้ว'); }); };
  FORMS.payRecord = function (f) { var fd = new FormData(f); run('กำลังบันทึก...', api('payRecord', { id: f.dataset.id, amount: String(fd.get('amount')).replace(/,/g, ''), method: fd.get('method'), note: fd.get('note') }), function (r) { A.open['rec-' + f.dataset.id] = false; return after(r, r.paid ? 'ชำระครบ ปิดบิลแล้ว' : 'บันทึกแล้ว'); }); };
  FORMS.creditRefund = function (f) { var fd = new FormData(f); run('กำลังบันทึก...', api('creditRefund', { memberId: f.dataset.member, orderId: f.dataset.order, amount: fd.get('amount'), note: fd.get('note') }), function () { A.open['ref-' + f.dataset.order] = false; return after(null, 'บันทึกการคืนเงินแล้ว'); }); };
  FORMS.teamInvite = function (f) { var fd = new FormData(f); run('กำลังสร้างลิงก์...', api('teamInvite', { name: fd.get('name'), role: fd.get('role'), hours: fd.get('hours') }), function (r) { A.inviteRes = r; return after(r, 'สร้างลิงก์เชิญแล้ว'); }); };
  FORMS.priceSave = function (f) {
    var fd = new FormData(f), ck = A.check;
    var errs = ck.rows.some(function (r) { return r.err; }), warns = ck.rows.some(function (r) { return r.warn && r.warn !== 'สินค้าใหม่'; }) || ck.missing.length > 0;
    if (errs && !fd.get('skip')) { toast('มีแถวที่ผิด: แก้ไฟล์ หรือติ๊ก ข้ามแถวที่ผิด'); return; }
    if (warns && !fd.get('warnOk')) { toast('ติ๊กยืนยันว่าตรวจจุดที่เตือนแล้ว'); return; }
    run('กำลังบันทึกราคา...', api('priceUpload', { rows: ck.upload, save: true, skipErrors: !!fd.get('skip'), effective: fd.get('effective'), fileName: ck.file }), function (r) {
      var file = ck.file; A.check = null; toast(r.applied ? 'ราคาใหม่มีผลแล้ว ' + r.staged + ' SKU' : 'ตั้งราคาใหม่ ' + r.staged + ' SKU มีผล ' + C.thDate(r.effective));
      return api('catalog').then(function (c) { S.cat = c; return after(r, null, function (d) { d.staging = r.applied ? null : { effective: r.effective, rows: new Array(Number(r.staged) || 0), file: file }; }); });
    });
  };
  function change(t, c) {
    if (v3change(t, c)) return;
    if (c === 'admPick') { var g = A.pick[t.dataset.g] = A.pick[t.dataset.g] || {}; g[t.dataset.id] = t.checked; draw(); }
    else if (c === 'admPickAll') { var g2 = A.pick[t.dataset.g] = A.pick[t.dataset.g] || {}; t.dataset.ids.split(',').forEach(function (id) { g2[id] = t.checked; }); draw(); }
    else if (c === 'admImport') { var fi = t.files && t.files[0]; if (fi) importFile(fi); t.value = ''; }
    else if (c === 'stock') { // บันทึกเบื้องหลัง ไม่ต้องรอ · 3.1.5 เอาติ๊กออก = หมดวันนี้ (กลับมาขายเองพรุ่งนี้) ตรงกับข้อความ และแก้ข้อมูลบนจอทุกแท็บ
      var sku = t.dataset.sku, on = t.checked; patchProduct({ sku: sku, inStock: on, hold: '', outUntil: on ? '' : today() });
      api('setStock', { sku: sku, inStock: on, kind: on ? '' : 'today' }).then(function (r) { patchProduct(r.product); toast(on ? 'มีของแล้ว' : 'ตั้งเป็นหมดวันนี้แล้ว (กลับมาขายเองพรุ่งนี้)', 2200); })
        .catch(function (e) { patchProduct({ sku: sku, inStock: !on, hold: '', outUntil: '' }); t.checked = !on; toast(C.friendly(e), 5000); });
    }
    else if (c === 'priceFile') { var f = t.files && t.files[0]; if (f) parsePriceFile(f); }
    else if (c === 'admPhoto') photoUpload(t);
    else if (c === 'admFrom' || c === 'admTo') { if (!t.value) return; if (c === 'admFrom') A.from = t.value; else A.to = t.value; if (A.from > A.to) { var s = A.from; A.from = A.to; A.to = s; } show(); }
    else if (c === 'admRouteDate') { if (t.value) { A.routeDate = t.value; show(); } }
    else if (c === 'admSel') { A.sel[t.dataset.id] = t.checked; }
    else if (c === 'admRider') { A.riderOf[t.dataset.no] = t.value; }
    else if (c === 'admKm') { A.kmOf[t.dataset.no] = t.value; }
    else if (c === 'admTripBike') { A.bikeOf[t.dataset.key] = t.value; draw(); }
    else if (c === 'admWave' || c === 'admBike') { if (!t.value) return; var ids = t.dataset.id.split(','), data = c === 'admWave' ? { slot: t.value } : { bike: t.value }; run('กำลังย้าย...', Promise.all(ids.map(function (id) { return api('orderWave', Object.assign({ id: id }, data)); })), function () { return after(null, c === 'admWave' ? 'ย้ายรอบแล้ว' : 'เปลี่ยนรถแล้ว'); }); }
    else if (c === 'admAlias') { // v3.1.0 บันทึกเงียบ ๆ ไม่บังจอ (เดิมขึ้น "กำลังบันทึก" หมุนเอง)
      var sku = t.dataset.sku, val = t.value, stEl = t.parentNode && t.parentNode.querySelector('.save-st'), al = val.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      if (stEl) { stEl.textContent = 'กำลังบันทึก'; stEl.className = 'save-st on'; }
      api('productAlias', { sku: sku, alias: val }, { quiet: true }).then(function () {
        if (stEl && stEl.isConnected) { stEl.textContent = 'บันทึกแล้ว'; stEl.className = 'save-st ok'; }
        (S.cat.products || []).forEach(function (p) { if (p.sku === sku) p.alias = al; });
        Object.keys(A.d).forEach(function (k) { ((A.d[k] || {}).products || []).forEach(function (p) { if (p.sku === sku) p.alias = al; }); });
      }).catch(function (e) { if (stEl && stEl.isConnected) { stEl.textContent = 'บันทึกไม่สำเร็จ'; stEl.className = 'save-st bad'; } toast(C.friendly(e), 5000); });
    }
    else if (c === 'admRole') run('กำลังเปลี่ยนสิทธิ์...', api('teamUpdate', { uid: t.dataset.uid, role: t.value }), function () { return after(null, 'เปลี่ยนสิทธิ์แล้ว'); });
  }
  /* ---------- v3: ปุ่ม / ฟอร์ม / ช่องเลือก ---------- */
  function modal(inner) { var m = document.createElement('div'); m.className = 'modal'; m.innerHTML = '<div class="modal-in">' + inner + '<button class="btn block" data-a="admClose">ปิด</button></div>'; document.body.appendChild(m); }
  ACT.admShopPhoto = function (el) { run('กำลังเปิดรูป...', api('shopPhoto', { id: el.dataset.id }), function (r) { modal('<img src="' + r.dataUrl + '" alt="รูปหน้าร้าน"><div class="hint">รูปส่วนตัวของลูกค้า ใช้ยืนยันร้านเท่านั้น ห้ามส่งต่อ</div>'); }); };
  ACT.admQR = function (el) { modal('<div class="qr"><div class="code">' + C.qrSvg(el.dataset.t) + '</div><b>' + esc(el.dataset.n || '') + '</b><div class="copy"><input readonly value="' + esc(el.dataset.t) + '"><button class="btn sm" data-a="copy" data-t="' + esc(el.dataset.t) + '">คัดลอก</button></div><div class="hint">แคปหน้าจอ/พิมพ์ติดป้าย · ลิงก์มีรหัสช่องทาง ระบบนับลูกค้าจาก QR นี้</div></div>'); };
  ACT.admChan = function (el) { // 3.1.5 ส่งแค่ code + active (หลังบ้านคงชื่อและหมายเหตุเดิม) แล้วแก้แถวบนจอทันที
    var code = el.dataset.code, on = el.dataset.on === '1';
    run('กำลังบันทึก...', api('channelSave', { code: code, active: on }), function () { return after(null, on ? 'เปิดช่องทางแล้ว' : 'ปิดช่องทางแล้ว', function (d) { (d.channels || []).forEach(function (c) { if (c.code === code) c.active = on; }); }); });
  };
  ACT.admPromoSub = function (el) { A.promoSub = el.dataset.p; A.q = ''; draw(); };
  ACT.admPromoSave = function () {
    var ed = A.promoEdit || {}, rows = Object.keys(ed).map(function (k) { return Object.assign({ sku: k }, ed[k]); });
    if (!rows.length) return;
    run('กำลังบันทึกรายการโปร...', api('promoPool', { rows: rows }), function (r) { A.poolErr = r.errors || []; A.promoEdit = {}; return api('catalog').then(function (c) { S.cat = c; return after(r, 'บันทึกแล้ว ' + r.saved + ' รายการ' + (r.errors.length ? ' · ไม่ผ่าน ' + r.errors.length : '')); }); });
  };
  ACT.admPoolTpl = function () {
    var P = (A.d[key('promo')] || {}).promo || {};
    saveBlob(xlsx('Pool', ['sku', 'name', 'promo_cat', 'smart', 'magnet', 'kg', 'price', 'gp_pct', 'note'], (P.pool || []).map(function (p) { return [p.sku, p.name, p.promoCat || '', p.smart ? 'Y' : 'N', p.magnet ? 'Y' : 'N', p.kg, p.price, p.gp === null ? '' : p.gp, p.why || '']; }), 'รายการสินค้าโปร Smart / Magnet'), 'Phokeaw_promo_pool.xlsx');
  };
  function poolFile(file) {
    C.busy(true, 'กำลังอ่านไฟล์...');
    SHEETFILE.read(file).then(function (arr) {
      C.busy(false);
      var head = (arr[0] || []).map(function (h) { return String(h).trim().toLowerCase(); }), ix = function (k) { return head.indexOf(k); };
      if (ix('sku') < 0) { toast('แถวแรกต้องมีคอลัมน์ sku (และ promo_cat / smart / magnet)'); return; }
      var yes = function (v) { return /^(y|yes|true|1|ใช่|✓)$/i.test(String(v || '').trim()); }, ed = A.promoEdit = A.promoEdit || {}, n = 0;
      arr.slice(1).forEach(function (r) {
        var sku = String(r[ix('sku')] || '').trim(); if (!sku) return; var e = {};
        if (ix('promo_cat') >= 0) e.promoCat = String(r[ix('promo_cat')] || '').trim();
        if (ix('smart') >= 0) e.smart = yes(r[ix('smart')]);
        if (ix('magnet') >= 0) e.magnet = yes(r[ix('magnet')]);
        if (Object.keys(e).length) { ed[sku] = Object.assign(ed[sku] || {}, e); n++; }
      });
      toast('อ่านแล้ว ' + n + ' รายการ · ตรวจในตาราง แล้วกด "บันทึก"', 4000); draw();
    }).catch(function (e) { C.busy(false); toast('อ่านไฟล์ไม่สำเร็จ: ' + e.message); });
  }
  ACT.admStockSave = function () {
    var sk = A.stk; if (!sk) return;
    var dup = document.getElementById('stk-dup'), part = document.getElementById('stk-partial');
    if (sk.res.check.dup && !(dup && dup.checked)) { toast('ไฟล์นี้เหมือนไฟล์เดิม · ติ๊ก "ยืนยันเป็นไฟล์ใหม่" ก่อน'); return; }
    if (sk.res.check.partial && !(part && part.checked)) { toast('ไฟล์อาจไม่ครบ · ผู้จัดการต้องติ๊กยืนยันก่อน'); return; }
    var body = Object.assign({}, sk.body, { save: true, kind: stkKind(), force: !!((dup && dup.checked) || (part && part.checked)) }); // 3.1.5 ใช้ "ไฟล์รอบไหน" ตอนกดบันทึก
    run('กำลังบันทึกสต็อก...', api('stockUpload', body), function (r) { A.stk = null; A.stkKind = ''; return api('catalog').then(function (c) { S.cat = c; return after(r, 'บันทึกสต็อกแล้ว ' + r.check.skus + ' SKU' + (r.back ? ' · กลับมาขาย ' + r.back + ' รายการ' : '') + (r.calibrated ? ' · คำนวณ buffer ใหม่แล้ว' : '')); }); });
  };
  ACT.admStockCancel = function () { A.stk = null; A.stkKind = ''; draw(); };
  ACT.admMovesSave = function () { var mv = A.mv; if (!mv) return; run('กำลังบันทึก...', api('stockMoves', Object.assign({}, mv.body, { save: true })), function (r) { A.mv = null; return after(r, 'บันทึกการเคลื่อนไหว ' + r.check.add + ' แถว · คำนวณ buffer ใหม่แล้ว'); }); };
  ACT.admMovesCancel = function () { A.mv = null; draw(); };
  ACT.admMapIgnore = function (el) { run('กำลังบันทึก...', api('stockMap', { material: el.dataset.mat, status: 'ignored' }), function () { return after(null, 'ตั้งเป็น "ไม่ขายใน MINI App" แล้ว'); }); };
  FORMS.stockAdjust = function (f) { var fd = new FormData(f); run('กำลังบันทึก...', api('stockAdjust', { sku: f.dataset.sku, qty: String(fd.get('qty')).replace(/,/g, ''), reason: fd.get('reason') }), function (r) { A.open['stk-' + f.dataset.sku] = false; return after(r, 'ปรับสต็อก ' + fmt(r.from) + ' → ' + fmt(r.to)); }); };
  FORMS.stockMult = function (f) { run('กำลังบันทึก...', api('stockMult', { sku: f.dataset.sku || '', mult: new FormData(f).get('mult') }), function (r) { return after(r, 'ตั้งตัวคูณแล้ว ' + r.n + ' สินค้า'); }); };
  FORMS.stockMap = function (f) { var fd = new FormData(f); if (!fd.get('sku')) { toast('เลือก SKU ก่อน'); return; } run('กำลังจับคู่...', api('stockMap', { material: f.dataset.mat, sku: fd.get('sku'), factor: fd.get('factor'), sapUnit: fd.get('sapUnit') }), function () { return after(null, 'จับคู่แล้ว · มีผลกับไฟล์ถัดไป'); }); };
  FORMS.memberArea = function (f) { var fd = new FormData(f); run('กำลังบันทึก...', api('memberArea', { id: f.dataset.id, on: !!fd.get('on'), until: fd.get('until') || '', note: fd.get('note') || '' }), function () { return after(null, fd.get('on') ? 'อนุญาตส่งนอกพื้นที่แล้ว' : 'ยกเลิกการอนุญาตแล้ว'); }); };
  FORMS.addressStaff = function (f) { var fd = new FormData(f); run('กำลังบันทึกหมุด...', api('addressStaff', { id: f.dataset.id, geo: fd.get('geo') || '', address: fd.get('address') || '' }), function (r) { return after(r, 'บันทึกหมุดแล้ว · ' + ({ 'in': 'ในพื้นที่', band: 'แถบขอบ', out: 'นอกพื้นที่' }[r.area] || r.area) + (r.orders ? ' (แก้ที่อยู่ในออเดอร์ที่ยังไม่ออกส่ง ' + r.orders + ' รายการ)' : '')); }); };
  FORMS.pointsAdjust = function (f) { var fd = new FormData(f); run('กำลังปรับแต้ม...', api('pointsAdjust', { memberId: f.dataset.id, points: fd.get('points'), note: fd.get('note') }), function (r) { return after(r, 'ปรับแต้มแล้ว คงเหลือ ' + fmt(r.points.bal)); }); };
  FORMS.pointsReverse = function (f) { var fd = new FormData(f); run('กำลังหักแต้มคืน...', api('pointsReverse', { id: String(fd.get('id') || '').trim(), reason: fd.get('reason') }), function (r) { return after(r, 'หักแต้มคืนแล้ว ' + (r.reversed || 0) + ' รายการ'); }); };
  FORMS.channelSave = function (f) { var fd = new FormData(f); run('กำลังสร้าง...', api('channelSave', { code: fd.get('code'), name: fd.get('name'), note: fd.get('note'), active: true }), function (r) { ACT.admQR({ dataset: { t: r.link, n: (fd.get('name') || r.code) + ' · ' + r.code } }); return after(r, 'สร้างช่องทาง ' + r.code + ' แล้ว'); }); };
  FORMS.areaBand = function (f) { var v = new FormData(f).get('band'); run('กำลังบันทึก...', api('configSet', { key: 'AREA_BAND_M', value: v }), function () { A.bandDraft = undefined; return api('catalog').then(function (c) { S.cat = c; return after(null, 'บันทึกแถบขอบ ' + fmt(v) + ' ม. แล้ว · ตรวจทุกที่อยู่ใหม่แล้ว'); }); }); };
  FORMS.areaGrace = function (f) { var v = new FormData(f).get('grace') || ''; run('กำลังบันทึก...', api('configSet', { key: 'AREA_GRACE_UNTIL', value: v }), function () { return api('catalog').then(function (c) { S.cat = c; return after(null, v ? 'ผ่อนผันถึง ' + C.thDate(v) : 'ยกเลิกการผ่อนผันแล้ว'); }); }); };
  FORMS.uatReset = function (f) {
    var fd = new FormData(f), scopes = fd.getAll('scope');
    if (!scopes.length) { toast('เลือกข้อมูลที่จะล้างอย่างน้อย 1 อย่าง'); return; }
    if (String(fd.get('confirm') || '') !== 'RESET') { toast('พิมพ์คำว่า RESET (ตัวพิมพ์ใหญ่) เพื่อยืนยัน'); return; }
    run('กำลังล้างข้อมูลทดสอบ...', api('uatReset', { scopes: scopes, confirm: 'RESET' }), function (r) {
      try { Object.keys(localStorage).forEach(function (k) { if (/^cart_/.test(k)) localStorage.removeItem(k); }); } catch (e) { }
      A.d = {}; A.at = {};
      return Promise.all([api('catalog'), C.refreshMe()]).then(function (x) { S.cat = x[0]; toast('ล้างแล้ว: ' + r.scopes.join(', ') + ' · ให้ผู้ทดสอบปิดแล้วเปิด MINI App ใหม่', 6000); show(); });
    });
  };
  FORMS.hoursSave = function (f) {
    var ch = {}, n = 0, all = {};
    Array.prototype.forEach.call(f.elements, function (el) { if (!el.name) return; var v = el.type === 'checkbox' ? (el.checked ? 'TRUE' : 'FALSE') : String(el.value || '').trim(), old = el.type === 'checkbox' ? (el.dataset.old ? 'TRUE' : 'FALSE') : el.dataset.old; all[el.name] = v; if (v !== old) { ch[el.name] = v; n++; } });
    if (!n) { toast('ยังไม่ได้เปลี่ยนค่า'); return; }
    var bad = hoursBad(all); if (bad) { toast(bad, 5000); return; } // 3.1.2: ตรวจลำดับเวลาก่อนบันทึก
    run('กำลังบันทึก ' + n + ' ค่า...', api('hoursSave', { values: ch }).then(function () { return api('catalog'); }), function (c) { S.cat = c; return after(null, 'บันทึกเวลาแล้ว มีผลทันที'); });
  };
  function hoursBad(v) {
    var K = ['SHOP_OPEN', 'DELIVERY_LAST_ORDER', 'PAY_CHASE_FROM', 'SHOP_CLOSE', 'MORNING_DUE'];
    var t = function (k) { var m = /^(\d{1,2})[:.](\d{2})$/.exec(String(v[k] || '')); return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? ('0' + m[1]).slice(-2) + ':' + m[2] : null; };
    if (K.some(function (k) { return v[k] !== undefined && t(k) === null; })) return 'เวลาไม่ถูกต้อง ใช้รูปแบบ 17:00';
    var o = t('SHOP_OPEN'), l = t('DELIVERY_LAST_ORDER'), p = t('PAY_CHASE_FROM'), c = t('SHOP_CLOSE'), md = t('MORNING_DUE');
    if (o && l && !(o < l)) return 'เวลาปิดรับส่งด่วน (' + l + ') ต้องหลังร้านเปิด (' + o + ')';
    if (l && c && !(l <= c)) return 'เวลาปิดรับส่งด่วน (' + l + ') ต้องไม่เกินเวลาร้านปิด (' + c + ')';
    if (p && o && c && !(o < p && p <= c)) return 'เวลาเริ่มตามเงิน (' + p + ') ต้องอยู่ระหว่างร้านเปิดถึงร้านปิด (' + o + ' ถึง ' + c + ')';
    if (md && o && !(md > o)) return 'เวลาเที่ยวแรกถึงลูกค้า (' + md + ') ต้องหลังร้านเปิด (' + o + ')';
    var tg = Number(v.DELIVERY_TARGET_MIN); if (v.DELIVERY_TARGET_MIN !== undefined && !(tg >= 15 && tg <= 240)) return 'เป้าส่งถึงต้องอยู่ระหว่าง 15 ถึง 240 นาที';
    return '';
  }
  function cfgSet(k, v, msg) { run('กำลังบันทึก...', api('configSet', { key: k, value: v }), function () { return api('catalog').then(function (c) { S.cat = c; return after(null, msg || 'บันทึกแล้ว'); }); }); }
  function v3change(t, c) {
    if (c === 'admCfg') { cfgSet(t.dataset.k, t.checked ? 'TRUE' : 'FALSE', (t.checked ? 'เปิด ' : 'ปิด ') + t.dataset.k); return true; }
    if (c === 'admCfgSel') { cfgSet(t.dataset.k, t.value, 'ตั้ง ' + t.dataset.k + ' = ' + t.value); return true; }
    if (c === 'admPromoEdit') { var ed = A.promoEdit = A.promoEdit || {}, e = ed[t.dataset.sku] = ed[t.dataset.sku] || {}; e[t.dataset.f] = t.type === 'checkbox' ? t.checked : t.value; draw(); return true; }
    if (c === 'admSmartPick') { run('กำลังบันทึก...', api('smartOverride', { date: t.dataset.date, cat: t.dataset.cat, sku: t.value }), function () { return after(null, t.value ? 'ล็อกรายการของพรุ่งนี้แล้ว' : 'ให้ระบบเลือกเอง'); }); return true; }
    if (c === 'admStockKind') { A.stkKind = t.value === 'mid' ? 'mid' : 'close'; if (A.stk) A.stk.kind = A.stkKind; draw(); return true; }
    if (c === 'admStockFile' || c === 'admMovesFile') { var fi = t.files && t.files[0]; if (fi) stockFile(fi, c === 'admStockFile' ? 'snap' : 'moves'); t.value = ''; return true; }
    if (c === 'admPoolFile') { var fp = t.files && t.files[0]; if (fp) poolFile(fp); t.value = ''; return true; }
    if (c === 'admSellState') {
      var v = t.value, data = { sku: t.dataset.sku, inStock: v === 'on', kind: v === 'on' ? '' : v };
      run('กำลังบันทึก...', api('setStock', data), function (r) { patchProduct(r.product); return after(r, { on: 'กลับมาขายแล้ว', today: 'หมดวันนี้ (กลับมาพรุ่งนี้)', upload: 'หมดจนกว่าไฟล์สต็อกถัดไป', hold: 'ระงับขายแล้ว' }[v]); });
      return true;
    }
    if (c === 'admBand') { A.bandDraft = Math.max(0, Math.min(5000, Number(t.value) || 0)); var svg = app().querySelector('.area-svg'), d = A.d[key('tools')]; if (svg && d && d.areaCfg) svg.outerHTML = areaSvg(d.areaCfg, A.bandDraft); return true; }
    return false;
  }
  /* ล็อกหน้าจอหลังร้านเมื่อไม่ได้ใช้งาน (ADMIN_IDLE_MIN) — เครื่องที่ใช้ร่วมกันหน้าร้าน */
  ['pointerdown', 'keydown'].forEach(function (ev) { document.addEventListener(ev, function () { A.lastAct = Date.now(); }, { passive: true }); });
  setInterval(function () {
    var mins = Number((S.cat && S.cat.cfg.ADMIN_IDLE_MIN) || 0);
    if (!mins || A.locked || S.page !== 'admin' || Date.now() - A.lastAct < mins * 60000) return;
    A.locked = true; A.d = {}; A.pick = {};
    render('<div class="wrap"><section class="box empty-state lock-screen">' + ic('lock') + '<h2>หน้าหลังร้านล็อกแล้ว</h2><p class="hint">ไม่ได้ใช้งานเกิน ' + mins + ' นาที ระบบซ่อนข้อมูลลูกค้าเพื่อความปลอดภัย</p><button class="btn pri block" data-a="admUnlock">แตะเพื่อใช้งานต่อ</button></section></div>');
  }, 30000);
  ACT.admUnlock = function () { run('กำลังยืนยันตัวตน...', C.refreshMe(), function () { A.locked = false; A.lastAct = Date.now(); if (!S.me.staff) { C.go('home', {}, true); return; } show(); }); };
  var searchT = null;
  document.addEventListener('input', function (e) {
    if (e.target.name === 'txn' && e.target.form && e.target.form.dataset.form === 'billOrder') { var hint = e.target.form.querySelector('.txn-hint'), dg = (S.cat && S.cat.cfg.TXN_DIGITS) || 7, v = C.txnNorm(e.target.value, dg); if (hint) hint.textContent = v ? 'จะบันทึกเป็น ' + v : 'ต้องมีตัวเลขอย่างน้อย 4 หลัก'; return; }
    if (e.target.id !== 'adm-search' || e.isComposing) return;
    A.q = e.target.value.trim(); clearTimeout(searchT);
    searchT = setTimeout(function () { var pos = e.target.selectionStart; draw(); var i = document.getElementById('adm-search'); if (i) { i.focus({ preventScroll: true }); try { i.setSelectionRange(pos, pos); } catch (x) { } } }, 250);
  });
  try { var um = sessionStorage.getItem('pk2_uatmsg'); if (um) { sessionStorage.removeItem('pk2_uatmsg'); setTimeout(function () { toast(um, 5000); }, 800); } } catch (e) { } // 3.1.3 ออกจากสวมบทเพราะเหตุผลจากหลังบ้าน
  window.PKAdmin = { show: show, draw: function () { if (A.locked) return; if (A.d[key(A.tab)]) draw(); else show(); }, change: change, xlsx: xlsx, planTrips: planTrips, staffNow: staffNow, onClock: onClock, _A: A };
})();
