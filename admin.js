/* หน้าหลังร้าน Betagro Shop โพธิ์แก้ว v2 — โหลดเฉพาะพนักงาน (ลูกค้าไม่ต้องดาวน์โหลดไฟล์นี้)
 * แจ้งออเดอร์ใหม่อัตโนมัติ · ตัวกรองวันที่ · ดาวน์โหลด Excel · ตรวจยอดโอน · จัดรอบส่ง · จัดการทีม */
(function () {
  'use strict';
  var C = window.PKCore, S = C.S, api = C.api, run = C.run, render = C.render, top = C.top, icon = C.icon, esc = C.esc, fmt = C.fmt, baht = C.baht, toast = C.toast;
  var ICON_X = { bell: '<path d="M6 16V11a6 6 0 0112 0v5l2 2H4l2-2zM10 20a2 2 0 004 0"/>', mute: '<path d="M6 16V11a6 6 0 0112 0v5l2 2H4l2-2zM10 20a2 2 0 004 0M3 3l18 18"/>',
    dl: '<path d="M12 3v12m-5-5l5 5 5-5M4 21h16"/>', map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>', print: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0114 0M16 4a3.5 3.5 0 010 7M22 20a6 6 0 00-5-6"/>', chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>' };
  function ic(n) { return ICON_X[n] ? '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON_X[n] + '</svg>' : icon(n); }
  function today() { return C.todayStr(); }
  function addDays(d, n) { return new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10); }
  var A = { tab: C.store('pk2_tab') || 'orders', d: {}, at: {}, from: '', to: '', routeDate: '', rev: 0, counts: null, alert: 0, lastLatest: '', sound: C.store('pk2_sound') !== false,
    q: '', payFilter: 'todo', timer: null, audio: null, inviteRes: null, open: {}, sel: {}, slips: {}, selfTest: null, jobRes: null };
  A.from = A.to = A.routeDate = today();

  var TABS = [['orders', 'ออเดอร์', 'view'], ['pay', 'ชำระเงิน', 'view'], ['route', 'จัดรอบส่ง', 'route'], ['members', 'สมาชิก', 'view'], ['aff', 'ชวนเพื่อน & ป้าย', 'view'],
    ['price', 'ราคา & สต็อก', 'view'], ['report', 'รายงาน', 'view'], ['bc', 'บรอดแคสต์', 'manage'], ['team', 'ทีมงาน', 'manage'], ['tools', 'เครื่องมือ', 'manage']];
  function can(perm) { var p = (S.me.staff && S.me.staff.perms) || []; return p.indexOf('*') >= 0 || (perm !== 'manage' && p.indexOf(perm) >= 0); }
  function tabs() { return TABS.filter(function (t) { return can(t[2]) || (t[0] === 'route' && can('route')); }); }
  var RANGE_TABS = { orders: 1, pay: 1, report: 1 };

  /* ---------- โหลดข้อมูลแท็บ (แสดงของเดิมทันที แล้วอัปเดตเบื้องหลัง) ---------- */
  function key(tab) { return tab + '|' + (RANGE_TABS[tab] ? A.from + '|' + A.to : '') + (tab === 'route' ? '|' + A.routeDate : ''); }
  function load(tab, quiet) {
    var k = key(tab);
    return api('adminData', { tab: tab, from: A.from, to: A.to, date: A.routeDate }, { quiet: quiet }).then(function (r) {
      A.d[k] = r; A.at[k] = Date.now(); A.rev = r.rev; noteCounts(r.counts, true);
      if (S.page === 'admin' && A.tab === tab && key(tab) === k && !formFocus()) draw();
      return r;
    });
  }
  function formFocus() { var a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox' && a.type !== 'file' && a.type !== 'date'); }
  function show() {
    var allowed = tabs(); if (!allowed.length) { render(top('หน้าหลังร้าน', '', false) + '<div class="wrap"><div class="alert bad">บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งานแท็บใด</div></div>'); return; }
    if (!allowed.some(function (t) { return t[0] === A.tab; })) A.tab = allowed[0][0];
    var k = key(A.tab);
    startPoll(); unlockAudio();
    if (A.d[k]) { draw(); if (Date.now() - (A.at[k] || 0) > 15000) load(A.tab, true).catch(function () { }); return; }
    render(shell('<div class="empty">กำลังโหลด...</div>'));
    load(A.tab).catch(C.fail);
  }
  function refresh() { A.d = {}; A.at = {}; show(); }

  /* ---------- โครงหน้า ---------- */
  function shell(inner) {
    var st = S.me.staff, cn = A.counts || {};
    var tools = '<button class="ic" data-a="admSound" aria-label="' + (A.sound ? 'ปิดเสียงแจ้งเตือน' : 'เปิดเสียงแจ้งเตือน') + '" title="เสียงแจ้งเตือนออเดอร์ใหม่">' + ic(A.sound ? 'bell' : 'mute') + '</button><button class="ic" data-a="refresh" aria-label="โหลดใหม่">' + icon('repeat') + '</button>';
    var h = top('หน้าหลังร้าน', (st.label || st.role) + ' · ' + (st.name || ''), false, tools);
    if (A.alert > 0) h += '<button class="new-banner" data-a="admBanner">' + ic('bell') + '<b>ออเดอร์ใหม่ ' + A.alert + ' รายการ</b><span>แตะเพื่อดู</span></button>';
    var badge = { orders: cn.newOrders, pay: cn.payReview, route: cn.deliveries, members: cn.pendingMembers, aff: cn.coinsPending };
    h += '<div class="tabs">' + tabs().map(function (x) { return '<button class="tab' + (A.tab === x[0] ? ' on' : '') + '" data-a="tab" data-p="' + x[0] + '">' + x[1] + (badge[x[0]] ? '<span class="cnt">' + badge[x[0]] + '</span>' : '') + '</button>'; }).join('') + '</div>';
    h += '<div class="wrap wide">';
    if (A.tab !== 'team' && A.tab !== 'tools' && can('view')) h += '<div class="admin-overview">' + [['orders', 'รอตรวจออเดอร์', cn.newOrders], ['orders', 'กำลังจัดของ', cn.approved], ['pay', 'รอตรวจยอดโอน', cn.payReview], ['members', 'สมาชิกใหม่', cn.pendingMembers]].map(function (x) { return '<button class="stat-card" data-a="tab" data-p="' + x[0] + '"><span>' + x[1] + '</span><strong>' + (x[2] || 0) + '</strong></button>'; }).join('') + '</div>';
    return h + inner + '</div>';
  }
  function draw() {
    var d = A.d[key(A.tab)]; if (!d) return show();
    var cfg = d.cfg || {}, CFG = window.APP_CONFIG || {};
    var warn = cfg.LIFF_ID && cfg.LIFF_ID !== CFG.LIFF_ID ? '<div class="alert bad">LIFF_ID ในชีต Config (' + esc(cfg.LIFF_ID) + ') ไม่ตรงกับ config.js (' + esc(CFG.LIFF_ID) + ') ปุ่มในการ์ดแชตและลิงก์ชวนจะเปิดไม่ได้ ให้แก้ให้ตรงกัน</div>' : '';
    var body = ({ orders: adOrders, pay: adPay, route: adRoute, members: adMembers, aff: adAff, price: adPrice, report: adReport, bc: adBc, team: adTeam, tools: adTools }[A.tab] || adOrders)(d);
    render(shell(warn + body));
    document.title = (A.alert ? '(' + A.alert + ') ออเดอร์ใหม่ · ' : '') + 'หลังร้าน · ' + (TABS.filter(function (t) { return t[0] === A.tab; })[0] || [0, ''])[1];
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
    if (o.coupon > 0) out.push(cfg.POS_MODE === 'freebie' ? 'ของแถมแทนคูปอง มูลค่า ' + baht(o.coupon) + ' (คีย์ 0 บาท)' : 'ส่วนลดท้ายบิล ' + baht(o.coupon) + ' (คูปองลูกค้าใหม่)');
    if (o.coinUse > 0) out.push(cfg.POS_MODE === 'freebie' ? 'แลก Coin เป็นสินค้ามูลค่า ' + baht(o.coinUse * cfg.COIN_VALUE) : 'ส่วนลด Coin ' + baht(o.coinUse * cfg.COIN_VALUE));
    o.bundles.forEach(function (b) { out.push(b.name + ' ×' + b.qty + ': คีย์รายการตามเซ็ต แล้วลดให้เหลือ ' + baht(b.price * b.qty)); });
    return out.length ? out : ['ไม่มีส่วนลด คีย์ตามรายการ'];
  }
  function orderCard(o, d, list) {
    var other = list.filter(function (x) { return x !== o && x.memberId === o.memberId && (x.status === 'new' || x.status === 'approved'); })[0];
    var h = '<article class="ord' + (o.status === 'new' ? ' is-new' : '') + '" id="o-' + esc(o.id) + '"><div class="ord-h"><b class="mono">' + esc(o.id) + '</b><span class="hint">' + esc(o.created) + '</span><span class="pill">' + esc(o.src) + '</span>' +
      (o.attName ? '<span class="pill appr">' + esc((o.attKind === 'ref' ? 'ผู้ชวน: ' : 'ป้าย: ') + o.attName) + '</span>' : '') + '<span style="flex:1"></span>' + statusPill(o.status) + '</div>' +
      '<div><b>' + esc(o.memberName) + '</b> <span class="mono hint">' + esc(o.sno || 'ยังไม่มีเลข S') + '</span>' + (o.memberApproved ? '' : ' <span class="pill red">สมาชิกรออนุมัติ</span>') + ' ' + tel(o.phone) + '</div>' +
      '<div class="hint">' + (o.mode === 'pickup' ? 'รับที่จุด ' + esc(o.pickup) : 'ส่ง: ' + esc(o.slot) + (o.deliverDate && o.deliverDate !== today() ? ' · ' + C.thDate(o.deliverDate) : '') + (o.zone ? ' · โซน ' + esc(C.zoneName(o.zone)) : '')) + ' · ~' + o.kg + ' กก.' + (o.updatedBy ? ' · ล่าสุดโดย ' + esc(o.updatedBy) : '') + '</div>' +
      o.bundles.map(function (l) { return '<div class="row"><span>' + esc(l.name) + ' ×' + l.qty + ' (เซ็ต)</span><span>' + baht(l.price * l.qty) + '</span></div>'; }).join('') +
      o.items.map(function (l) { return '<div class="row"><span>' + esc(l.name) + ' ×' + l.qty + ' @' + fmt(l.price) + '</span><span>' + baht(l.price * l.qty) + '</span></div>'; }).join('') +
      '<div class="row tot"><span>ยอดประมาณ</span><span>' + baht(o.est) + '</span></div>' +
      (o.belowMin ? '<div class="alert warn">ต่ำกว่าขั้นต่ำ → ส่งรวมรอบถัดไปที่ผ่านย่านนี้</div>' : '') + (other ? '<div class="alert info">ลูกค้ารายนี้มีออเดอร์ค้างส่ง ' + esc(other.id) + ' รวมรอบเดียวกันได้</div>' : '');
    if (o.status !== 'cancelled' && o.status !== 'paid') h += '<div class="pos"><b>ทำใน POS</b>' + posLines(o, d.cfg).map(function (x) { return '<div>• ' + esc(x) + '</div>'; }).join('') + (o.txn ? '<div>บิล ' + esc(o.txn) + ' · ยอดจริง ' + baht(o.actual) + '</div>' : '') + '</div>';
    var edit = can('orders');
    if (edit && o.status === 'new') h += '<div class="acts"><button class="btn blue" data-a="adm" data-op="approveOrder" data-id="' + esc(o.id) + '">อนุมัติ ส่งไปจัดของ</button><button class="btn bad sm" data-a="adm" data-op="cancelOrder" data-id="' + esc(o.id) + '" data-confirm="1">ยกเลิก</button></div>';
    if (edit && o.status === 'approved') h += '<form class="acts" data-form="billOrder" data-id="' + esc(o.id) + '"><div class="field"><label>Transaction No. จากสลิป POS</label><input name="txn" class="mono" required placeholder="S212 101 0316349" autocomplete="off"></div><div class="field"><label>ยอด Net-Total จริง</label><input name="actual" inputmode="decimal" required value="' + o.est + '"></div><button class="btn blue" type="submit">ส่งบิลให้ลูกค้า</button><button class="btn bad sm" type="button" data-a="adm" data-op="cancelOrder" data-id="' + esc(o.id) + '" data-confirm="1">ยกเลิก</button></form>';
    if (o.status === 'billed') h += '<div class="row-flex">' + payPill(o.pay) + '<span class="hint">ยอดที่ต้องรับ ' + baht(o.pay.due) + (o.pay.received ? ' · แจ้งโอนแล้ว ' + baht(o.pay.received) : '') + '</span><button class="text-btn" data-a="tab" data-p="pay">ไปแท็บชำระเงิน →</button></div>';
    return h + '</article>';
  }
  function adOrders(d) {
    var all = (d.orders || []).filter(function (o) { return hit(o, ['id', 'memberName', 'phone', 'sno', 'txn']); });
    var open = all.filter(function (o) { return /new|approved|billed/.test(o.status); }), done = all.filter(function (o) { return /paid|cancelled/.test(o.status); });
    var groups = [['new', 'รอตรวจ (ใหม่)'], ['approved', 'จัดของ · รอเปิดบิล'], ['billed', 'ส่งบิลแล้ว · รอชำระ']];
    var h = searchBox('ค้นหา ชื่อร้าน / เบอร์ / เลขออเดอร์ / Transaction');
    if (d.cfg.COUNT_COUNTER && can('pay')) h += '<details class="box"><summary>บันทึกบิลหน้าร้านของสมาชิก</summary><form class="acts" data-form="counterBill"><div class="field"><label>สมาชิก</label><select name="memberId">' + (d.members || []).map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.name) + ' · ' + esc(m.sno) + '</option>'; }).join('') + '</select></div><div class="field"><label>Transaction No.</label><input name="txn" required></div><div class="field"><label>ยอด</label><input name="amount" inputmode="decimal" required></div><button class="btn blue" type="submit">บันทึก</button></form></details>';
    if (!open.length) h += '<div class="empty">' + icon('check') + '<b>ไม่มีออเดอร์ค้าง</b><span>ออเดอร์ใหม่จะขึ้นเองอัตโนมัติ พร้อมเสียงเตือน</span></div>';
    groups.forEach(function (g) {
      var list = open.filter(function (o) { return o.status === g[0]; });
      if (!list.length) return;
      if (g[0] === 'billed') { h += '<details class="box group"><summary>' + g[1] + ' (' + list.length + ')</summary>' + list.map(function (o) { return orderCard(o, d, open); }).join('') + '</details>'; return; }
      h += '<h3 class="group-h">' + g[1] + ' <span class="cnt-pill">' + list.length + '</span></h3>' + list.map(function (o) { return orderCard(o, d, open); }).join('');
    });
    h += '<h3 class="group-h">เสร็จแล้วในช่วงวันที่</h3>' + rangeBar([['orders', 'ออเดอร์'], ['lines', 'รายการสินค้า']]);
    h += done.length ? '<div class="tblw"><table><thead><tr><th>ออเดอร์</th><th>วันที่</th><th>ลูกค้า</th><th>สถานะ</th><th class="r">ยอด</th></tr></thead><tbody>' + done.map(function (o) { return '<tr><td class="mono">' + esc(o.id) + '</td><td>' + esc(o.created) + '</td><td>' + esc(o.memberName) + '</td><td>' + statusPill(o.status) + '</td><td class="r">' + baht(o.actual || o.est) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="hint">ยังไม่มีออเดอร์ที่ชำระแล้ว/ยกเลิกในช่วงนี้</div>';
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
    var h = '<div class="kv"><div><small>บิลค้างชำระ</small><b>' + billed.length + '</b></div><div><small>ยอดค้าง</small><b>' + baht(dueSum) + '</b></div><div><small>รับแล้ว (ช่วงวันที่)</small><b>' + baht(paidSum) + '</b></div></div>';
    h += searchBox('ค้นหา ชื่อร้าน / เบอร์ / Transaction') + '<div class="chips">' + Object.keys(F).map(function (k) { var n = list.filter(F[k][1]).length; return '<button class="chip' + (A.payFilter === k ? ' on' : '') + '" data-a="admPayF" data-p="' + k + '">' + F[k][0] + ' (' + n + ')</button>'; }).join('') + '</div>';
    if (A.payFilter === 'paid') h += rangeBar([['payments', 'การชำระเงิน'], ['credits', 'เครดิต']]);
    var shown = list.filter(F[A.payFilter][1]);
    if (!shown.length) return h + '<div class="empty">' + icon('check') + '<b>ไม่มีรายการ</b></div>';
    return h + shown.map(function (o) { return payCard(o, d); }).join('');
  }
  function payCard(o, d) {
    var p = o.pay, tol = d.cfg.PAY_TOLERANCE || 0, short = Math.round((p.due - p.received) * 100) / 100, edit = can('pay');
    var h = '<article class="ord pay-card' + (p.pending ? ' is-new' : '') + '"><div class="ord-h"><b class="mono">' + esc(o.id) + '</b><b>' + esc(o.memberName) + '</b>' + tel(o.phone) + '<span class="mono hint">' + esc(o.txn) + '</span><span style="flex:1"></span>' + statusPill(o.status) + payPill(p) + '</div>';
    h += '<div class="pay-grid"><div><small>ยอดบิล</small><b>' + baht(p.bill) + '</b></div>' + (p.credit ? '<div><small>หักเครดิต</small><b>−' + baht(p.credit) + '</b></div>' : '') +
      '<div><small>ยืนยันแล้ว</small><b>' + baht(p.confirmed) + '</b></div><div><small>แจ้งโอน รอตรวจ</small><b>' + baht(p.pending) + '</b></div>' +
      (short > tol ? '<div class="neg"><small>ยังขาด (ถ้ายอดที่แจ้งถูก)</small><b>' + baht(short) + '</b></div>' : short < -tol ? '<div class="pos"><small>แจ้งโอนเกิน</small><b>' + baht(-short) + '</b></div>' : '<div class="pos"><small>ยอดที่แจ้ง</small><b>ครบ ✓</b></div>') + '</div>';
    if ((p.payments || []).length) h += '<div class="pay-list">' + p.payments.map(function (x) {
      var st = x.status === 'confirmed' ? '<span class="pill paid">ยืนยันแล้ว</span>' : x.status === 'rejected' ? '<span class="pill red">ไม่ผ่าน</span>' : '<span class="pill appr">รอตรวจ</span>';
      return '<div class="pay-row"><span><b>' + baht(x.amount) + '</b> · ' + esc(x.at.slice(5, 16)) + ' · ' + esc({ transfer: 'โอน', cash: 'เงินสด', other: 'อื่นๆ' }[x.method] || x.method) + (x.source === 'staff' ? ' (พนักงานบันทึก)' : x.source === 'slip-api' ? ' (ตรวจสลิปอัตโนมัติ)' : '') +
        (x.ref ? ' · <span class="mono" title="' + esc(x.ref) + '">QR สลิป ✓</span>' : '') + (x.note ? '<br><small class="hint">' + esc(x.note) + '</small>' : '') + (x.by ? '<br><small class="hint">ตรวจโดย ' + esc(x.by) + '</small>' : '') + '</span><span class="pay-acts">' + st +
        (x.hasSlip ? '<button class="btn sm" data-a="admSlip" data-id="' + esc(x.id) + '">ดูสลิป</button>' : '') +
        (edit && x.status === 'pending' && o.status === 'billed' ? '<button class="btn sm blue" data-a="adm" data-op="payReview" data-pid="' + esc(x.id) + '" data-ok="1">✓ ยอดเข้าแล้ว</button><button class="btn sm bad" data-a="adm" data-op="payReview" data-pid="' + esc(x.id) + '" data-ok="0" data-confirm="1">✗ ไม่พบยอด</button>' : '') + '</span></div>';
    }).join('') + '</div>';
    if (edit && o.status === 'billed') {
      h += '<div class="acts">';
      if (p.pending > 0) h += '<button class="btn blue" data-a="adm" data-op="confirmPay" data-id="' + esc(o.id) + '">ยืนยันทุกยอดที่แจ้ง (' + baht(p.pending) + ')</button>';
      if (p.received > 0 && short > tol) h += '<button class="btn" data-a="adm" data-op="askShort" data-id="' + esc(o.id) + '">ขอยอดที่ขาด ' + baht(short) + '</button>';
      if (!p.received) h += '<button class="btn" data-a="adm" data-op="remindOne" data-id="' + esc(o.id) + '">เตือนจ่าย' + (o.remindCount ? ' (เตือนแล้ว ' + o.remindCount + ')' : '') + '</button>';
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
  function planTrips(r) {
    var slots = String((A.d[key('route')] && A.d[key('route')].cfg.SLOTS) || '').split('|'), zones = r.zones.map(function (z) { return z.id; }), cap = r.vehicleKg || 50;
    var pend = [], byMem = {}, trips = [];
    r.list.filter(function (x) { return !x.delivery; }).forEach(function (x) { // ลูกค้าเดียวกันหลายออเดอร์ = ส่งจุดเดียว
      var k = x.memberId + '|' + x.slot, s = byMem[k];
      if (!s) { s = byMem[k] = Object.assign({}, x, { ids: [x.id], orders: [x] }); pend.push(s); return; }
      s.ids.push(x.id); s.orders.push(x); s.kg = Math.round((s.kg + x.kg) * 10) / 10; s.est += x.est; s.actual = (s.actual || 0) + (x.actual || 0); s.items += ' | ' + x.items; s.belowMin = s.belowMin && x.belowMin;
      if (x.deliverDate < s.deliverDate) s.deliverDate = x.deliverDate;
    });
    var bySlot = {}; pend.forEach(function (x) { var s = slots.indexOf(x.slot) >= 0 ? x.slot : (x.slot || 'ไม่ระบุรอบ'); (bySlot[s] = bySlot[s] || []).push(x); });
    Object.keys(bySlot).sort(function (a, b) { var ia = slots.indexOf(a), ib = slots.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); }).forEach(function (slot) {
      var byZone = {}; bySlot[slot].forEach(function (x) { (byZone[x.zone] = byZone[x.zone] || []).push(x); });
      Object.keys(byZone).sort(function (a, b) { var ia = zones.indexOf(a), ib = zones.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); }).forEach(function (z) {
        var cur = null;
        nnOrder(byZone[z], r.shop).forEach(function (s) {
          if (!cur || cur.kg + s.kg > cap) { cur = { slot: slot, zone: z, stops: [], kg: 0 }; trips.push(cur); }
          cur.stops.push(s); cur.kg = Math.round((cur.kg + s.kg) * 10) / 10;
        });
      });
    });
    trips.forEach(function (t, i) { t.no = i + 1; t.id = 'R' + (i + 1) + '-' + t.zone; });
    return trips;
  }
  function mapsUrl(stops, shop) {
    var pts = stops.filter(function (s) { return s.lat && s.lng; }); if (!pts.length) return '';
    var o = shop.lat + ',' + shop.lng, dest = pts[pts.length - 1], wp = pts.slice(0, -1).slice(0, 9).map(function (s) { return s.lat + ',' + s.lng; }).join('|');
    return 'https://www.google.com/maps/dir/?api=1&origin=' + o + '&destination=' + dest.lat + ',' + dest.lng + (wp ? '&waypoints=' + encodeURIComponent(wp) : '') + '&travelmode=driving';
  }
  function stopPay(s) {
    var os = s.orders || [s], unpaid = os.filter(function (o) { return o.status !== 'paid'; });
    if (!unpaid.length) return '<span class="pill paid">จ่ายแล้ว</span>';
    return unpaid.some(function (o) { return o.status === 'billed'; }) ? '<span class="pill bill">ค้างจ่าย</span>' : '<span class="pill appr">ยังไม่เปิดบิล</span>';
  }
  function stopRow(s, i, sel, mode) {
    return '<div class="stop">' + (mode === 'plan' ? '<input type="checkbox" data-chg="admSel" data-id="' + esc(s.id) + '"' + (sel ? ' checked' : '') + ' aria-label="เลือก ' + esc(s.name) + '">' : '') + '<span class="stop-no">' + (i + 1) + '</span>' +
      '<div class="stop-main"><b>' + esc(s.name) + '</b> ' + tel(s.phone) + '<div class="hint">' + esc(s.address || 'ยังไม่มีที่อยู่') + (s.lat ? ' · <a href="https://www.google.com/maps/search/?api=1&query=' + s.lat + ',' + s.lng + '" target="_blank" rel="noopener">หมุด</a>' + (s.km ? ' ~' + s.km + ' กม.' : '') : ' · <span class="warn-t">ยังไม่ปักหมุด</span>') + '</div>' +
      '<div class="hint">' + esc((s.ids || [s.id]).join(', ')) + (s.ids && s.ids.length > 1 ? ' <span class="pill appr">รวม ' + s.ids.length + ' ออเดอร์ ส่งครั้งเดียว</span>' : '') + ' · ' + s.kg + ' กก. · ' + baht(s.actual || s.est) + ' ' + stopPay(s) + (s.belowMin ? ' <span class="pill new">ต่ำกว่าขั้นต่ำ</span>' : '') + (s.deliverDate < A.routeDate ? ' <span class="pill red">ค้างจาก ' + C.thDate(s.deliverDate) + '</span>' : '') + '</div>' +
      '<div class="hint items">' + esc(s.items) + '</div></div>' +
      (mode === 'out' && can('route') ? '<button class="btn sm blue" data-a="adm" data-op="deliveryDone" data-id="' + esc(s.id) + '">ส่งแล้ว ✓</button>' : mode === 'done' && can('route') ? '<button class="btn sm" data-a="adm" data-op="deliveryUndo" data-id="' + esc(s.id) + '" data-confirm="1">ย้อนกลับ</button>' : '') + '</div>';
  }
  function adRoute(d) {
    var r = d.route, t = today(), trips = planTrips(r), cap = r.vehicleKg;
    var out = r.list.filter(function (x) { return x.delivery === 'out'; }), done = r.list.filter(function (x) { return x.delivery === 'done'; }), pending = r.list.filter(function (x) { return !x.delivery; });
    var kg = pending.reduce(function (s, x) { return s + x.kg; }, 0);
    var h = '<div class="date-bar"><div class="date-fields"><label>วันส่ง <input type="date" data-chg="admRouteDate" value="' + A.routeDate + '"></label></div><div class="dl-row">' + (can('export') || can('route') ? '<button class="btn sm" data-a="admExport" data-k="route">' + ic('dl') + ' ใบงาน .xlsx</button>' : '') + '<button class="btn sm" data-a="admPrint" data-p="all">' + ic('print') + ' พิมพ์ใบงานทั้งหมด</button></div></div>';
    h += '<div class="kv"><div><small>รอจัดส่ง</small><b>' + pending.length + ' จุด</b></div><div><small>น้ำหนักรวม</small><b>' + Math.round(kg * 10) / 10 + ' กก.</b></div><div><small>รอบที่แนะนำ (≤' + cap + ' กก.)</small><b>' + trips.length + '</b></div></div>';
    h += '<div class="alert info">ระบบจัดรอบให้: แยกตามรอบเวลา → โซน → เรียงจุดใกล้สุดจากร้านก่อน และตัดรอบไม่ให้เกิน ' + cap + ' กก./คัน · คนขับสลับลำดับได้ตามหน้างาน ' + (pending.some(function (x) { return !x.lat; }) ? '· จุดที่ยังไม่ปักหมุดอยู่ท้ายรอบ (ให้ลูกค้าปักหมุดในหน้าสมาชิก หรือพนักงานใส่ในแท็บสมาชิก)' : '') + '</div>';
    if (!trips.length && !out.length) h += '<div class="empty">' + ic('map') + '<b>ไม่มีออเดอร์รอจัดส่ง' + (A.routeDate === t ? 'วันนี้' : '') + '</b><span>ออเดอร์ที่อนุมัติแล้วจะขึ้นที่นี่</span></div>';
    trips.forEach(function (tr) {
      var url = mapsUrl(tr.stops, r.shop), over = tr.kg > cap;
      h += '<section class="box trip" id="trip-' + tr.no + '"><div class="section-heading"><h3>รอบที่ ' + tr.no + ' · ' + esc(tr.slot) + ' · ' + esc(C.zoneName(tr.zone) || tr.zone) + '</h3><span class="pill' + (over ? ' red' : '') + '">' + tr.stops.length + ' จุด · ' + tr.kg + ' กก.</span></div>' +
        '<div class="kg-bar"><span style="width:' + Math.min(100, tr.kg / cap * 100) + '%"></span></div>' +
        tr.stops.map(function (s, i) { return stopRow(s, i, A.sel[s.id] !== false, 'plan'); }).join('') +
        '<div class="acts">' + (can('route') ? '<button class="btn blue" data-a="admTripOut" data-ids="' + esc(tr.stops.map(function (s) { return (s.ids || [s.id]).join(','); }).join(',')) + '" data-trip="' + esc(tr.id) + '">' + icon('truck') + ' ออกรอบนี้ (ที่เลือก)</button>' : '') +
        (url ? '<a class="btn sm" href="' + esc(url) + '" target="_blank" rel="noopener">' + ic('map') + ' เส้นทาง Google Maps</a>' : '') + '<button class="btn sm" data-a="admPrint" data-p="' + tr.no + '">' + ic('print') + ' พิมพ์ใบงาน</button></div></section>';
    });
    if (out.length) {
      var byTrip = {}; out.forEach(function (x) { var k = String(x.trip || '').split('#')[0] || '-'; (byTrip[k] = byTrip[k] || []).push(x); });
      h += '<h3 class="group-h">กำลังนำส่ง</h3>' + Object.keys(byTrip).map(function (k) { var list = byTrip[k].sort(function (a, b) { return String(a.trip).localeCompare(String(b.trip), undefined, { numeric: true }); }); return '<section class="box trip out"><div class="section-heading"><h3>' + esc(k) + '</h3><span class="hint">ออก ' + esc((list[0].deliveryAt || '').slice(11, 16)) + '</span></div>' + list.map(function (s, i) { return stopRow(s, i, true, 'out'); }).join('') + '</section>'; }).join('');
    }
    if (done.length) h += '<details class="box"><summary>ส่งถึงแล้ว (' + done.length + ')</summary>' + done.map(function (s, i) { return stopRow(s, i, true, 'done'); }).join('') + '</details>';
    A.trips = trips;
    return h;
  }
  function printTrips(which) {
    var r = A.d[key('route')] && A.d[key('route')].route, trips = (A.trips || []).filter(function (t) { return which === 'all' || String(t.no) === String(which); });
    if (!r || !trips.length) { toast('ไม่มีรอบให้พิมพ์'); return; }
    var html = trips.map(function (t) {
      return '<section class="print-trip"><h2>ใบงานส่งของ · รอบที่ ' + t.no + ' · ' + esc(t.slot) + ' · ' + esc(C.zoneName(t.zone) || t.zone) + '</h2><p>วันที่ ' + C.thDate(A.routeDate) + ' · ' + t.stops.length + ' จุด · ' + t.kg + ' กก. · คนขับ ____________ ออก ____:____ กลับ ____:____</p>' +
        '<table><thead><tr><th>#</th><th>ลูกค้า / โทร</th><th>ที่อยู่</th><th>รายการ</th><th>กก.</th><th>ชำระ</th><th>ถึงเวลา</th><th>ลายเซ็น</th></tr></thead><tbody>' +
        t.stops.map(function (s, i) { var up = (s.orders || [s]).filter(function (o) { return o.status !== 'paid'; }); return '<tr><td>' + (i + 1) + '</td><td><b>' + esc(s.name) + '</b><br>' + esc(s.phone) + '<br><small>' + esc((s.ids || [s.id]).join(', ')) + '</small></td><td>' + esc(s.address) + '</td><td>' + esc(s.items) + '</td><td>' + s.kg + '</td><td>' + (up.length ? 'ค้าง ' + baht(up.reduce(function (a, o) { return a + (o.actual || o.est); }, 0)) : 'จ่ายแล้ว') + '</td><td></td><td></td></tr>'; }).join('') + '</tbody></table></section>';
    }).join('');
    var el = document.getElementById('print-area'); if (!el) { el = document.createElement('div'); el.id = 'print-area'; document.body.appendChild(el); }
    el.innerHTML = html; document.body.classList.add('printing');
    var done = function () { document.body.classList.remove('printing'); el.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(function () { try { window.print(); } catch (e) { toast('อุปกรณ์นี้พิมพ์ไม่ได้ ใช้ปุ่มดาวน์โหลด .xlsx แทน'); } setTimeout(done, 1500); }, 50);
  }

  /* ---------- สมาชิก ---------- */
  function adMembers(d) {
    var mg = d.migration, pct = mg.total ? mg.moved / mg.total * 100 : 0, edit = can('members'), zones = d.cfg.ZONE_LIST || [];
    var h = '<div class="box"><h3>ลูกค้าเดิมที่ย้ายเข้า OA แล้ว ' + mg.moved + ' / ' + mg.total + ' (' + pct.toFixed(1) + '%)</h3><div class="kg-bar"><span style="width:' + pct + '%"></span></div><div class="hint">เป้า 90% · OA ส่งหาคนที่ยังไม่เพิ่มเพื่อนไม่ได้ ต้องส่งลิงก์จากแชตเดิมหรือโทร</div></div>';
    h += '<h3 class="group-h">สมาชิกใหม่รอตรวจ <span class="cnt-pill">' + d.pendingMembers.length + '</span></h3>';
    if (!d.pendingMembers.length) h += '<div class="empty">ไม่มีรายการรอตรวจ</div>';
    d.pendingMembers.forEach(function (m) {
      h += '<form class="ord" data-form="approveMember" data-id="' + esc(m.id) + '"><div class="ord-h"><b>' + esc(m.name) + '</b><span class="pill appr">' + esc(m.sourceKind === 'ref' ? 'ผู้ชวน: ' + m.sourceName : m.sourceKind === 'sign' ? 'ป้าย: ' + m.sourceName : 'สมัครเอง') + '</span>' + (m.flags ? '<span class="pill red">ธงแดง</span>' : '') + '</div>' +
        '<div class="hint">เบอร์ ' + tel(m.phone) + ' · ' + esc(m.type) + ' · ลงทะเบียน ' + esc(C.thDate(m.regDate)) + (m.address ? ' · ' + esc(m.address) : '') + (m.zone ? ' · โซน ' + esc(C.zoneName(m.zone)) : '') + '</div>' + (m.flags ? '<div class="alert bad">' + esc(m.flags) + '</div>' : '') +
        (edit ? '<div class="hint">ตรวจใน POS ว่าเบอร์/ชื่อนี้ไม่เคยซื้อใน 6 เดือน แล้วเปิดเลขสมาชิกใหม่</div><div class="acts"><div class="field"><label>เลขสมาชิก S (จาก POS)</label><input name="sno" class="mono" required autocomplete="off"></div><div class="field"><label>โซนส่ง</label><select name="zone"><option value="">—</option>' + zones.map(function (z) { return '<option value="' + esc(z.id) + '"' + (z.id === m.zone ? ' selected' : '') + '>' + esc(z.name) + '</option>'; }).join('') + '</select></div>' +
          (m.flags ? '<label class="chk"><input type="checkbox" name="clearFlags"><span>ตรวจแล้ว ล้างธงแดง (ให้สิทธิ์ลูกค้าใหม่)</span></label>' : '') + '<button class="btn blue" type="submit">อนุมัติ</button><button class="btn bad sm" type="button" data-a="adm" data-op="rejectMember" data-id="' + esc(m.id) + '" data-confirm="1">ปิดบัญชี</button></div>' : '') + '</form>';
    });
    var list = (d.memberList || []).filter(function (m) { return hit(m, ['name', 'phone', 'sno', 'zone', 'address']); });
    h += '<h3 class="group-h">รายชื่อสมาชิก (' + (d.memberList || []).length + ')</h3>' + searchBox('ค้นหา ชื่อ / เบอร์ / เลข S / โซน') + (can('export') ? '<div class="dl-row"><button class="btn sm" data-a="admExport" data-k="members" data-all="1">' + ic('dl') + ' สมาชิกทั้งหมด .xlsx</button></div>' : '');
    h += '<div class="tblw"><table><thead><tr><th>ร้าน</th><th>เบอร์</th><th>เลข S</th><th>โซน</th><th>หมุด</th><th></th></tr></thead><tbody>' + list.slice(0, 200).map(function (m) {
      var open = A.open['mem-' + m.id];
      return '<tr><td>' + esc(m.name) + (m.approved ? '' : ' <span class="pill new">รออนุมัติ</span>') + '<br><small class="hint">' + esc(m.address || '') + '</small></td><td>' + tel(m.phone) + '</td><td class="mono">' + esc(m.sno) + '</td><td>' + esc(C.zoneName(m.zone) || '-') + '</td><td>' + (m.lat ? '<a href="https://www.google.com/maps/search/?api=1&query=' + m.lat + ',' + m.lng + '" target="_blank" rel="noopener">✓ ดู</a>' : '—') + '</td><td>' + (edit ? '<button class="btn sm" data-a="admToggle" data-k="mem-' + esc(m.id) + '">' + (open ? 'ปิด' : 'แก้') + '</button>' : '') + '</td></tr>' +
        (open ? '<tr><td colspan="6"><form class="acts" data-form="memberUpdate" data-id="' + esc(m.id) + '"><div class="field"><label>โซน</label><select name="zone"><option value="">—</option>' + zones.map(function (z) { return '<option value="' + esc(z.id) + '"' + (z.id === m.zone ? ' selected' : '') + '>' + esc(z.name) + '</option>'; }).join('') + '</select></div><div class="field"><label>ที่อยู่</label><input name="address" value="' + esc(m.address) + '"></div><div class="field"><label>เบอร์</label><input name="phone" value="' + esc(m.phone) + '"></div><div class="field"><label>พิกัด (วางลิงก์ Google Maps หรือ lat,lng)</label><input name="geo" value="' + (m.lat ? m.lat + ',' + m.lng : '') + '" placeholder="13.80,100.64"></div><button class="btn blue" type="submit">บันทึก</button></form></td></tr>' : '');
    }).join('') + '</tbody></table></div>' + (list.length > 200 ? '<div class="hint">แสดง 200 รายการแรก ค้นหาเพื่อดูเพิ่ม</div>' : '');
    var link = d.cfg.LIFF_ID ? C.appLink('link', {}) : '';
    h += '<h3 class="group-h">ลูกค้าเดิมที่ยังไม่ย้าย (เรียงตามยอด)</h3>';
    h += mg.list.length ? '<div class="tblw"><table><thead><tr><th>ร้าน</th><th>เบอร์</th><th class="r">เฉลี่ย/เดือน</th><th>สถานะ</th><th></th></tr></thead><tbody>' + mg.list.map(function (x) {
      return '<tr><td>' + esc(x.name) + '</td><td>' + tel(x.phone) + '</td><td class="r">' + baht(x.avg) + '</td><td>' + (x.follow === 'call' ? 'โทรแล้ว' : x.follow === 'link' ? 'ส่งลิงก์แล้ว' : 'ยังไม่ติดต่อ') + '</td><td style="white-space:nowrap">' + (edit ? '<button class="btn sm" data-a="copyMigrate" data-id="' + esc(x.id) + '" data-name="' + esc(x.name) + '" data-link="' + esc(link) + '">คัดลอกข้อความชวน</button> <button class="btn sm" data-a="adm" data-op="markFollow" data-id="' + esc(x.id) + '" data-status="call">โทรแล้ว</button>' : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="empty">ย้ายครบแล้ว</div>';
    return h;
  }

  /* ---------- ชวนเพื่อน & ป้าย ---------- */
  function adAff(d) {
    var mg = can('manage');
    var h = '<div class="box"><h3>Coin รออนุมัติ</h3><div class="hint">ปล่อยได้เมื่อบิลของเพื่อนจ่ายแล้ว</div>' + (d.coinsPending.length ? (mg ? '<button class="btn sm blue" data-a="adm" data-op="approveCoins" style="margin:6px 0">อนุมัติทั้งหมดที่จ่ายแล้ว</button>' : '') + '<div class="tblw"><table><thead><tr><th>ผู้ชวน</th><th>จากบิลของ</th><th>บิล</th><th class="r">ยอดบิล</th><th class="r">Coin</th><th></th></tr></thead><tbody>' +
      d.coinsPending.map(function (c) { return '<tr><td>' + esc(c.owner) + '</td><td>' + esc(c.from) + '</td><td class="mono">' + esc(c.order) + '</td><td class="r">' + baht(c.actual) + '</td><td class="r">' + fmt(c.amount) + '</td><td>' + (c.paid ? (mg ? '<button class="btn sm blue" data-a="adm" data-op="approveCoin" data-id="' + esc(c.id) + '">อนุมัติ</button>' : '<span class="pill paid">พร้อมอนุมัติ</span>') : '<span class="pill new">บิลยังไม่จ่าย</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty">ไม่มี</div>') + '</div>';
    h += '<div class="box"><h3>ผู้ชวน (' + (d.cfg.REF_SCOPE === 'all' ? 'เปิดทุกคน' : 'เฉพาะกลุ่มนำร่อง') + ')</h3>' + (d.referrers.length ? d.referrers.map(function (r) {
      return '<div class="ord"><div class="ord-h"><b>' + esc(r.name) + '</b><span class="mono hint">' + esc(r.sno) + '</span><span class="hint">ชวนแล้ว ' + r.refs + ' · Coin เดือนนี้ ' + fmt(r.coinMonth) + ' · ใช้ได้ ' + fmt(r.bal) + '</span></div>' +
        (r.link ? '<div class="copy"><input readonly value="' + esc(r.link) + '" aria-label="ลิงก์ชวน"><button class="btn sm" data-a="copy" data-t="' + esc(r.link) + '">คัดลอกลิงก์ชวน</button></div>' : '<div class="alert warn">ตั้ง LIFF_ID ในชีต Config ก่อน</div>') + '</div>';
    }).join('') : '<div class="empty">ยังไม่มี</div>') +
      (mg ? '<form class="acts" data-form="setPilot" style="margin-top:8px"><div class="field"><label>ให้สิทธิ์ชวนเพื่อน (กลุ่มนำร่อง)</label><select name="id">' + d.members.filter(function (m) { return !m.pilot; }).map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.name) + ' · ' + esc(m.sno) + '</option>'; }).join('') + '</select></div><button class="btn sm" type="submit">ให้สิทธิ์</button></form>' : '') + '</div>';
    if (d.flagged.length) h += '<div class="box"><h3>ธงแดง</h3>' + d.flagged.map(function (f) { return '<div class="row"><span>' + esc(f.name) + '<br><small class="hint">' + esc(f.flags) + '</small></span><span>' + (f.rejected ? 'ปิดบัญชี' : f.approved ? 'อนุมัติแล้ว' : 'รอตรวจ') + '</span></div>'; }).join('') + '</div>';
    h += '<div class="box"><h3>พาร์ทเนอร์ & ป้าย QR</h3>' + d.partners.map(function (p) {
      return '<div class="ord"><div class="ord-h"><b class="mono">' + esc(p.id) + '</b><b>' + esc(p.name) + '</b><span class="hint">' + esc(p.type) + ' · ' + esc(p.area) + '</span></div><div class="hint">สแกน ' + p.scans + ' · ลูกค้า ' + p.members + ' · ออเดอร์เดือนนี้ ' + p.orders + ' · ยอด ' + baht(p.sales) + ' · ส่วนแบ่ง ' + baht(p.share) + (p.share < p.minPayout ? ' (ยกไปเดือนหน้า)' : '') + '</div>' +
        (p.link ? '<div class="qr"><div class="code">' + C.qrSvg(p.link) + '</div><span class="hint">QR สำหรับพิมพ์ติดป้าย</span></div><div class="copy"><input readonly value="' + esc(p.link) + '" aria-label="ลิงก์ป้าย"><button class="btn sm" data-a="copy" data-t="' + esc(p.link) + '">คัดลอกลิงก์ป้าย</button></div>' +
          (mg ? '<div class="copy"><input readonly value="' + esc(p.joinLink) + '" aria-label="ลิงก์ผูกพาร์ทเนอร์"><button class="btn sm" data-a="copy" data-t="' + esc(p.joinLink) + '">ลิงก์ให้เจ้าของจุด</button></div>' : '') + '<div class="hint">' + (p.bound ? 'เจ้าของจุดผูกบัญชีแล้ว' : 'ส่งลิงก์ให้เจ้าของจุดเปิดใน LINE เพื่อดูยอดของตัวเอง') + '</div>' : '<div class="alert warn">ตั้ง LIFF_ID ในชีต Config ก่อน</div>') + '</div>';
    }).join('') + (mg ? '<form class="acts" data-form="createSign" style="margin-top:8px"><div class="field"><label>ชื่อจุดใหม่</label><input name="name" required></div><div class="field"><label>ประเภท</label><input name="type" placeholder="ร้านใต้คอนโด"></div><div class="field"><label>ที่ตั้ง</label><input name="area"></div><button class="btn sm" type="submit">สร้างป้ายใหม่</button></form>' : '') + '</div>';
    if (can('export')) h += '<div class="dl-row">' + [['coins', 'Coin'], ['shares', 'ส่วนแบ่งพาร์ทเนอร์']].map(function (k) { return '<button class="btn sm" data-a="admExport" data-k="' + k[0] + '" data-month="1">' + ic('dl') + ' ' + k[1] + ' เดือนนี้ .xlsx</button>'; }).join('') + '</div>';
    return h;
  }

  /* ---------- ราคา & สต็อก ---------- */
  function adPrice(d) {
    var h = '', mg = can('manage');
    if (d.staging) h += '<div class="alert info">มีราคาใหม่รอมีผล ' + esc(C.thDate(d.staging.effective)) + ' (' + d.staging.rows.length + ' SKU จาก ' + esc(d.staging.file) + ')' + (mg ? ' <button class="btn sm blue" data-a="adm" data-op="priceApply" data-confirm="1">มีผลตอนนี้</button> <button class="btn sm" data-a="adm" data-op="priceCancel" data-confirm="1">ยกเลิก</button>' : '') + '</div>';
    if (mg) {
      h += '<div class="box"><h3>อัปโหลดราคาสัปดาห์หน้า</h3><div class="hint">หัวตาราง: sku, name, unit, kg, t1_qty, t1_price, t2_qty, t2_price, t3_qty, t3_price, promo (ไฟล์ .xlsx หรือ .csv · แต่ละ SKU มี 1–3 ขั้น)</div>' +
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
    h += '<div class="box"><h3>สินค้า · ราคาที่ใช้อยู่ · สต็อกวันนี้</h3><div class="hint">' + (mg ? 'แตะ "รูป" เพื่อถ่าย/เลือกรูปสินค้า (ย่อให้อัตโนมัติ) · ' : '') + 'แก้ป้ายร่วมโปร สินค้าแห่งเดือน และชื่อสินค้าได้ในชีต Products</div><div class="tblw" style="margin-top:6px"><table><thead><tr><th>รูป</th><th>SKU</th><th>สินค้า</th><th>ขั้นราคา</th><th>ร่วมโปร</th><th>มีของ</th></tr></thead><tbody>' + d.products.map(function (p) {
      return '<tr><td class="img-cell">' + C.thumb(p, 'product-photo sm', p.cat) + (mg ? '<label class="btn sm"><input type="file" accept="image/*" hidden data-chg="admPhoto" data-id="' + esc(p.sku) + '">รูป</label>' : '') + '</td><td class="mono">' + esc(p.sku) + '</td><td>' + esc(p.name) + '</td><td>' + p.tiers.map(function (t) { return t.min + '+ ' + t.price; }).join(' · ') + '</td><td>' + (p.promo ? 'ใช่' : '') + '</td><td>' +
        (can('stock') ? '<input type="checkbox" data-chg="stock" data-sku="' + esc(p.sku) + '"' + (p.inStock ? ' checked' : '') + ' aria-label="มีของ ' + esc(p.name) + '">' : (p.inStock ? 'มี' : 'หมด')) + '</td></tr>';
    }).join('') + '</tbody></table></div></div>';
    return h;
  }

  /* ---------- รายงาน ---------- */
  function adReport(d) {
    var r = d.report;
    var h = rangeBar([]) + '<div class="report-grid">' + [['ออเดอร์', fmt(r.orders), r.cancelled ? 'ยกเลิก ' + r.cancelled : ''], ['ยอดเปิดบิล', baht(r.billed), 'ยอดประมาณ ' + baht(r.est)], ['รับเงินแล้ว', baht(r.paid), ''],
      ['ค้างชำระ (ทั้งหมด)', baht(r.outstanding), ''], ['เฉลี่ยต่อบิล', baht(r.avg), ''], ['สมาชิกใหม่', fmt(r.members), ''], ['น้ำหนักรวม', (Math.round(r.kg * 10) / 10) + ' กก.', ''], ['คูปอง / Coin', baht(r.coupon) + ' / ' + fmt(r.coin), 'ส่วนลดที่ให้']]
      .map(function (x) { return '<div class="stat-card"><span>' + x[0] + '</span><strong>' + x[1] + '</strong>' + (x[2] ? '<small class="hint">' + x[2] + '</small>' : '') + '</div>'; }).join('') + '</div>';
    if (r.days.length) {
      var max = Math.max.apply(null, r.days.map(function (x) { return x.sales; }).concat([1]));
      h += '<div class="box"><h3>ยอดรายวัน</h3><div class="bars">' + r.days.map(function (x) { return '<div class="bar-row"><span>' + C.thDate(x.date) + '</span><div class="bar"><i style="width:' + (x.sales / max * 100) + '%"></i></div><b>' + baht(x.sales) + '</b><small>' + x.orders + ' บิล</small></div>'; }).join('') + '</div></div>';
    }
    if (r.top.length) h += '<div class="box"><h3>สินค้าขายดี (ตามยอดในออเดอร์)</h3><div class="tblw"><table><thead><tr><th>SKU</th><th>สินค้า</th><th class="r">จำนวน</th><th class="r">ยอด</th></tr></thead><tbody>' + r.top.map(function (x) { return '<tr><td class="mono">' + esc(x.sku) + '</td><td>' + esc(x.name) + '</td><td class="r">' + fmt(x.qty) + '</td><td class="r">' + baht(x.sales) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    if (can('export')) h += '<div class="box"><h3>' + ic('dl') + ' ดาวน์โหลด Excel (.xlsx) ตามช่วงวันที่ด้านบน</h3><div class="dl-grid">' + [['orders', 'ออเดอร์'], ['lines', 'รายการสินค้าในออเดอร์'], ['payments', 'การชำระเงิน'], ['members', 'สมาชิกใหม่'], ['coins', 'Coin'], ['credits', 'เครดิต (โอนเกิน)'], ['shares', 'ส่วนแบ่งพาร์ทเนอร์']].concat(can('manage') ? [['audit', 'ประวัติการแก้ไข']] : [])
      .map(function (k) { return '<button class="btn sm" data-a="admExport" data-k="' + k[0] + '">' + k[1] + '</button>'; }).join('') + '</div></div>';
    return h;
  }

  /* ---------- บรอดแคสต์ ---------- */
  var SEGS = [['all', 'เพื่อนทั้งหมด'], ['FS', 'Food Service'], ['Consumer', 'Consumer'], ['dormant', 'ไม่ได้สั่งเกิน 14 วัน'], ['referred', 'ลูกค้าใหม่จากคำชวน'], ['sign', 'ลูกค้าจากป้าย']];
  function adBc(d) {
    var q = d.quota || { used: 0, plan: 0 };
    var h = '<form class="box form" data-form="broadcast"><h3>บรอดแคสต์แบ่งกลุ่ม</h3><div class="field"><label>กลุ่ม</label><select name="segment">' + SEGS.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + ' (' + ((d.segments || {})[s[0]] || 0) + ' คน)</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>ข้อความ</label><select name="template"><option value="bundle">เซ็ตคุ้มเดือนนี้</option><option value="pom">สินค้าแห่งเดือน</option><option value="winback">ชวนกลับมาสั่ง</option></select></div><div class="hint">ทุกผู้รับใช้ 1 ข้อความในโควตา · ใช้ไปแล้ว ' + fmt(q.used) + ' / ' + (q.plan ? fmt(q.plan) : 'ไม่จำกัด') + (q.source === 'line' ? '' : ' (ประมาณ)') + ' · แพ็กเกจฟรีส่งเกินโควตาไม่ได้</div><button class="btn blue" type="submit">ส่ง</button></form>';
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
    var P = { '*': 'ทุกอย่าง (รวมตั้งค่า ทีม ราคา บรอดแคสต์)', view: 'ดูข้อมูลหลังร้าน', orders: 'อนุมัติ/เปิดบิล/ยกเลิกออเดอร์', pay: 'ตรวจยอดโอน/รับเงิน', members: 'อนุมัติสมาชิก/แก้ข้อมูล', route: 'จัดรอบส่ง/กดส่งแล้ว', stock: 'เปิดปิดสต็อก', export: 'ดาวน์โหลด Excel' };
    h += '<div class="box"><h3>สิทธิ์แต่ละระดับ</h3>' + roles.map(function (r) { return '<div class="row"><span><b>' + esc(r.label) + '</b></span><span style="text-align:right">' + r.perms.map(function (p) { return P[p] || p; }).join(' · ') + '</span></div>'; }).join('') +
      '<div class="hint">ต้องมีผู้จัดการอย่างน้อย 1 คนเสมอ · ถ้าผู้จัดการคนเดียวจะลาออก ให้เชิญผู้จัดการคนใหม่ก่อน แล้วให้คนใหม่ปิดสิทธิ์คนเดิม · กรณีฉุกเฉิน เจ้าของ Google Sheet แก้คอลัมน์ active ในชีต Staff ได้</div></div>';
    return h;
  }

  /* ---------- เครื่องมือ (ผู้จัดการ) ---------- */
  function adTools(d) {
    var t = d.tools || {}, jobs = t.jobs || {}, q = d.quota || {};
    function jobLine(k, label, btn) {
      var r = jobs[k];
      return '<div class="job-row"><div><b>' + label + '</b><small class="hint">' + (r ? 'ล่าสุด ' + esc(r.at) + ' · ส่ง ' + (r.sent || 0) + ' ข้อความ' + (r.reason ? ' · ' + esc(r.reason) : '') : 'ยังไม่เคยรัน') + '</small></div><button class="btn sm" data-a="adm" data-op="runJob" data-job="' + k + '">' + btn + '</button></div>';
    }
    var h = '<div class="box"><h3>ทดสอบงานตั้งเวลา (ไม่ต้องรอเวลาจริง)</h3>' + jobLine('reminders', '17:00 เตือนบิลค้างจ่าย', 'ส่งเตือนตอนนี้') + jobLine('standing', '18:00 ถามสั่งประจำ', 'ส่งคำถามตอนนี้') + jobLine('summary', '19:00 สรุปยอดให้ผู้จัดการ', 'ส่งสรุปตอนนี้') +
      (A.jobRes ? '<div class="alert ' + (A.jobRes.sent ? 'ok' : 'warn') + '"><b>ผล: ส่ง ' + (A.jobRes.sent || 0) + ' ข้อความ</b>' + (A.jobRes.reason ? '<br>' + esc(A.jobRes.reason) : '') + '</div>' : '') + '</div>';
    h += '<div class="box"><h3>ตรวจระบบ</h3><button class="btn sm" data-a="admSelfTest">ตรวจตอนนี้</button> <button class="btn sm" data-a="adm" data-op="cacheClear">ล้างแคช (หลังแก้ชีตด้วยมือ)</button>' +
      (A.selfTest ? '<div class="checks">' + A.selfTest.map(function (c) { return '<div class="row"><span>' + (c.ok ? '✅' : c.warn ? '⚠️' : '❌') + ' ' + esc(c.name) + '</span><span>' + esc(c.note) + '</span></div>'; }).join('') + '</div>' : '') +
      '<div class="hint">หลังบ้าน v' + esc(t.version || '') + ' · หน้าเว็บ v' + esc(C.version) + ' · LINE token ' + (t.tokenSet ? 'ตั้งแล้ว' : 'ยังไม่ได้ตั้ง') + ' · โควตาเดือนนี้ ' + fmt(q.used) + ' / ' + (q.plan ? fmt(q.plan) : 'ไม่จำกัด') + '</div></div>';
    if (t.testMode) h += '<div class="box test-box"><h3>โหมดทดสอบ (เห็นเฉพาะพนักงาน)</h3><div class="hint">ทดลองเป็นลูกค้าใหม่: ไปหน้าบัตรสมาชิกของคุณ แล้วกด "ลบข้อมูลสมาชิกของฉัน" จากนั้นเปิดลิงก์ชวน/ป้ายเพื่อลงทะเบียนใหม่ · ปิดโหมดนี้ได้ที่ Config TEST_MODE = FALSE</div><button class="btn sm" data-a="go" data-p="card">ไปหน้าบัตรสมาชิกของฉัน</button></div>';
    h += '<div class="box"><h3>กติกาและข้อมูล</h3><div class="hint">แก้กติกา (Coin, คูปอง, ส่วนแบ่ง, ขั้นต่ำ, โซนส่ง, ข้อความที่ส่งเข้าแชต PUSH_EVENTS) ได้ที่ชีต Config · สินค้า/เซ็ตที่ชีต Products และ Bundles · มีผลภายใน 1 นาที</div>' +
      '<div class="copy" style="margin-top:6px"><input readonly value="' + esc(t.sheetUrl || '') + '" aria-label="ลิงก์ Google Sheet"><button class="btn sm" data-a="copy" data-t="' + esc(t.sheetUrl || '') + '">คัดลอกลิงก์ชีต</button></div></div>';
    return h;
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
    var f = input.files && input.files[0], sku = input.dataset.id; if (!f) return;
    var url = URL.createObjectURL(f), img = new Image();
    img.onload = function () {
      var k = Math.min(1, 720 / Math.max(img.width, img.height)), cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
      run('กำลังอัปโหลดรูป...', api('productImage', { id: sku, image: cv.toDataURL('image/jpeg', 0.82) }), function () { toast('เปลี่ยนรูปแล้ว ลูกค้าเห็นภายใน 1 นาที'); return api('catalog').then(function (c) { S.cat = c; }).then(function () { return load('price'); }); });
    };
    img.onerror = function () { toast('เปิดรูปไม่ได้'); };
    img.src = url;
  }

  /* ---------- แจ้งเตือนออเดอร์ใหม่ (เช็กทุก 15 วินาที เฉพาะตอนเปิดหน้านี้) ---------- */
  function noteCounts(c, fromLoad) {
    if (!c) return;
    var prev = A.counts;
    if (prev && c.latestOrder && c.latestOrder !== A.lastLatest && c.latestAt > (prev.latestAt || '') && c.newOrders > 0) {
      A.alert += Math.max(1, c.newOrders - (prev.newOrders || 0)); beep();
      try { if (navigator.vibrate) navigator.vibrate([180, 90, 180]); } catch (e) { }
    }
    A.lastLatest = c.latestOrder; A.counts = c;
    if (!fromLoad && S.page === 'admin') document.title = (A.alert ? '(' + A.alert + ') ออเดอร์ใหม่ · ' : '') + 'หลังร้าน';
  }
  function startPoll() {
    if (A.timer) return;
    var sec = Math.max(10, Number((S.cat && S.cat.cfg.POLL_SEC) || 15));
    A.timer = setInterval(poll, sec * 1000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) poll(); });
  }
  var polling = false;
  function poll() {
    if (polling || document.hidden || S.page !== 'admin') return;
    polling = true;
    api('adminPoll', { rev: A.rev }, { quiet: true, tries: 1, timeout: 12000 }).then(function (r) {
      polling = false;
      if (r.same) return;
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
  function after(r, msg) { if (msg) toast(msg); A.d = {}; return load(A.tab); }
  var ACT = C.ACT, FORMS = C.FORMS;
  ACT.tab = function (el) { A.tab = el.dataset.p; A.q = ''; C.store('pk2_tab', A.tab); window.scrollTo(0, 0); show(); };
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
    var stops = (A.trips || []).reduce(function (a, t) { return a.concat(t.stops); }, []), skip = {};
    stops.forEach(function (s) { if (A.sel[s.id] === false) (s.ids || [s.id]).forEach(function (id) { skip[id] = 1; }); });
    var ids = el.dataset.ids.split(',').filter(function (id) { return !skip[id]; });
    if (!ids.length) { toast('เลือกอย่างน้อย 1 จุด'); return; }
    run('กำลังบันทึกออกรอบ...', api('deliveryOut', { ids: ids, trip: A.routeDate.slice(5).replace('-', '') + '-' + el.dataset.trip }), function (r) { return after(r, 'ออกรอบแล้ว ' + r.count + ' จุด'); });
  };
  ACT.copyMigrate = function (el) {
    C.copyText('สวัสดีค่ะ ' + el.dataset.name.replace(/\s*\(ตัวอย่าง\)/, '') + ' ร้านเปิด LINE ของร้านแล้ว สั่งของ ดูบิล จ่ายด้วย QR ได้ในที่เดียว กดลิงก์นี้แล้วผูกเลขสมาชิกได้เลย: ' + (el.dataset.link || ''));
    api('markFollow', { id: el.dataset.id, status: 'link' }).catch(function () { });
  };
  ACT.adm = function (el) {
    if (el.dataset.confirm && !el.dataset.sure) { el.dataset.sure = '1'; el.dataset.label = el.textContent; el.textContent = 'กดอีกครั้งเพื่อยืนยัน'; setTimeout(function () { if (el.isConnected) { delete el.dataset.sure; el.textContent = el.dataset.label; } }, 4000); return; }
    var op = el.dataset.op, data = { id: el.dataset.id, status: el.dataset.status, job: el.dataset.job, code: el.dataset.code };
    if (op === 'payReview') data = { paymentId: el.dataset.pid, ok: el.dataset.ok === '1' };
    if (op === 'confirmPay' && el.dataset.full) data.full = true;
    run('กำลังทำรายการ...', api(op, data), function (r) {
      if (op === 'runJob') { A.jobRes = r; toast('ส่งแล้ว ' + (r.sent || 0) + ' ข้อความ', 3500); return after(r); }
      if (op === 'approveCoins') return after(r, 'อนุมัติ ' + r.approved + ' รายการ');
      if (op === 'askShort') return after(r, r.sent ? 'ส่งข้อความขอยอดที่ขาด ' + baht(r.short) + ' แล้ว' : 'บันทึกแล้ว (ลูกค้ายังไม่เพิ่มเพื่อน OA/ส่งไม่สำเร็จ)');
      if (op === 'remindOne') return after(r, r.sent ? 'ส่งเตือนแล้ว' : 'ส่งไม่สำเร็จ (ดู MessageLog)');
      if (op === 'confirmPay' || op === 'payReview') return after(r, r.paid ? 'ชำระครบ ปิดบิลแล้ว' + (r.pay && r.pay.over ? ' (โอนเกิน ' + baht(r.pay.over) + ' → เครดิต)' : '') : 'บันทึกแล้ว · คงค้าง ' + baht(r.pay ? Math.max(0, r.pay.balance) : 0));
      if (op === 'cacheClear') { return api('catalog').then(function (c) { S.cat = c; return after(r, 'ล้างแคชแล้ว'); }); }
      if (op === 'priceApply') return api('catalog').then(function (c) { S.cat = c; return after(r, 'ราคาใหม่มีผลแล้ว'); });
      return after(r, 'เรียบร้อย');
    }).catch(function () { });
  };
  function geoParse(s) { var m = /(-?\d{1,2}\.\d+)\s*,\s*(-?\d{2,3}\.\d+)/.exec(String(s || '')) || /@(-?\d{1,2}\.\d+),(-?\d{2,3}\.\d+)/.exec(String(s || '')); return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null; }
  FORMS.billOrder = function (f) { var fd = new FormData(f); run('กำลังส่งบิล...', api('billOrder', { id: f.dataset.id, txn: fd.get('txn'), actual: String(fd.get('actual')).replace(/,/g, '') }), function () { return after(null, 'ส่งบิลให้ลูกค้าแล้ว'); }); };
  FORMS.approveMember = function (f) { var fd = new FormData(f); run('กำลังอนุมัติ...', api('approveMember', { id: f.dataset.id, sno: fd.get('sno'), zone: fd.get('zone') || '', clearFlags: !!fd.get('clearFlags') }), function () { return after(null, 'อนุมัติแล้ว'); }); };
  FORMS.memberUpdate = function (f) {
    var fd = new FormData(f), g = geoParse(fd.get('geo')), data = { id: f.dataset.id, zone: fd.get('zone') || '', address: fd.get('address'), phone: fd.get('phone') };
    if (g) { data.lat = g.lat; data.lng = g.lng; } else if (!String(fd.get('geo') || '').trim()) { data.lat = ''; data.lng = ''; }
    run('กำลังบันทึก...', api('memberUpdate', data), function () { A.open['mem-' + f.dataset.id] = false; return after(null, 'บันทึกแล้ว'); });
  };
  FORMS.setPilot = function (f) { run('กำลังบันทึก...', api('setPilot', { id: new FormData(f).get('id'), on: true }), function () { return after(null, 'ให้สิทธิ์ชวนเพื่อนแล้ว'); }); };
  FORMS.createSign = function (f) { var fd = new FormData(f); run('กำลังสร้าง...', api('createSign', { name: fd.get('name'), type: fd.get('type'), area: fd.get('area') }), function (r) { return after(r, 'สร้างป้าย ' + r.id + ' แล้ว'); }); };
  FORMS.broadcast = function (f) { var fd = new FormData(f); run('กำลังส่ง...', api('broadcast', { segment: fd.get('segment'), template: fd.get('template') }), function (r) { return after(r, 'ส่งถึง ' + r.sent + ' คน'); }); };
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
      A.check = null; toast(r.applied ? 'ราคาใหม่มีผลแล้ว ' + r.staged + ' SKU' : 'ตั้งราคาใหม่ ' + r.staged + ' SKU มีผล ' + C.thDate(r.effective));
      return api('catalog').then(function (c) { S.cat = c; return after(r); });
    });
  };
  function change(t, c) {
    if (c === 'stock') run('กำลังบันทึก...', api('setStock', { sku: t.dataset.sku, inStock: t.checked }), function () { return api('catalog').then(function (r) { S.cat = r; toast('บันทึกแล้ว'); }); });
    else if (c === 'priceFile') { var f = t.files && t.files[0]; if (f) parsePriceFile(f); }
    else if (c === 'admPhoto') photoUpload(t);
    else if (c === 'admFrom' || c === 'admTo') { if (!t.value) return; if (c === 'admFrom') A.from = t.value; else A.to = t.value; if (A.from > A.to) { var s = A.from; A.from = A.to; A.to = s; } show(); }
    else if (c === 'admRouteDate') { if (t.value) { A.routeDate = t.value; show(); } }
    else if (c === 'admSel') { A.sel[t.dataset.id] = t.checked; }
    else if (c === 'admRole') run('กำลังเปลี่ยนสิทธิ์...', api('teamUpdate', { uid: t.dataset.uid, role: t.value }), function () { return after(null, 'เปลี่ยนสิทธิ์แล้ว'); });
  }
  var searchT = null;
  document.addEventListener('input', function (e) {
    if (e.target.id !== 'adm-search' || e.isComposing) return;
    A.q = e.target.value.trim(); clearTimeout(searchT);
    searchT = setTimeout(function () { var pos = e.target.selectionStart; draw(); var i = document.getElementById('adm-search'); if (i) { i.focus({ preventScroll: true }); try { i.setSelectionRange(pos, pos); } catch (x) { } } }, 250);
  });
  window.PKAdmin = { show: show, change: change, xlsx: xlsx, planTrips: planTrips, _A: A };
})();
