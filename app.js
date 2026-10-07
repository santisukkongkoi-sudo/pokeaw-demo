/* MINI App Betagro Shop โพธิ์แก้ว v2 — หน้าลูกค้า (หน้าหลังร้านอยู่ใน admin.js โหลดเฉพาะพนักงาน)
 * ข้อมูลทั้งหมดอยู่ใน Google Sheet ผ่าน Apps Script · ดีไซน์ขาว–เขียว */
(function () {
  'use strict';
  var CFG = window.APP_CONFIG || {};
  var APP_VERSION = '2.2.0';

  /* ===== คำนวณตะกร้า (ใช้ร่วมกันทั้งหลังบ้านและหน้า MINI App — แก้ที่เดียวทั้งสองฝั่ง) ===== */
  function daysBetween(a, b) {
    return Math.round((Date.parse(String(b).slice(0, 10) + 'T00:00:00Z') - Date.parse(String(a).slice(0, 10) + 'T00:00:00Z')) / 864e5);
  }
  function unitPrice(p, q) {
    var pr = p.tiers[0].price;
    for (var i = 0; i < p.tiers.length; i++) { if (q >= p.tiers[i].min) pr = p.tiers[i].price; }
    return pr;
  }
  function numList(s) { return String(s === undefined || s === null ? '' : s).split(/[,|\s]+/).map(Number).filter(function (n) { return n > 0; }); }
  /**
   * แถวกติกาจากแท็บ Offers → แผนส่วนลด (ใช้ทั้งหลังบ้านและหน้าเว็บ)
   * steps: "150" = ลด 150 บาท · "33%" = ลด 33% · หลายบิลคั่นด้วย , เช่น "50,15%"
   */
  function offerPlan(o) {
    if (!o) return null;
    var steps = String(o.steps === undefined || o.steps === null ? '' : o.steps).split(/[,|]+/).map(function (x) {
      x = String(x).trim(); if (!x) return null;
      var pct = /%$/.test(x), v = Number(x.replace(/[%฿,\s]/g, ''));
      return v > 0 ? (pct ? { pct: v } : { amt: v }) : null;
    }).filter(Boolean);
    function list(v) { return String(v === undefined || v === null ? '' : v).split(/[,|]+/).map(function (x) { return Number(String(x).trim()) || 0; }); }
    return { id: String(o.id || o.offer_id || ''), steps: steps, caps: list(o.caps), mins: list(o.min_bill !== undefined ? o.min_bill : o.mins), days: Number(o.days) || 30,
      scope: String(o.scope || 'promo') === 'all' ? 'all' : 'promo', label: String(o.label || '') };
  }
  /**
   * คูปองลูกค้าใหม่แบบบันได แยกตามประเภทลูกค้า (B2C = Consumer / FS = ร้านอาหาร) หรือตามกติกาในแท็บ Offers (offer)
   * → { pcts: [% บิลที่ 1, 2, ...], amts: [บาท...], caps: [เพดานบาท...], mins: [ขั้นต่ำ...], days, minBill, scope, sources, bills }
   */
  function couponPlan(cfg, type, offer) {
    var op = offer && Array.isArray(offer.steps) ? offer : offerPlan(offer);
    if (op && op.steps.length) {
      return { pcts: op.steps.map(function (x) { return x.pct || 0; }), amts: op.steps.map(function (x) { return x.amt || 0; }), caps: op.caps.length ? op.caps : [0], mins: op.mins.length ? op.mins : [0],
        days: op.days, minBill: op.mins[0] || 0, scope: op.scope, sources: [], bills: op.steps.length, offerId: op.id, label: op.label };
    }
    var fs = type !== 'Consumer';
    var pcts = numList(fs ? cfg.COUPON_FS_LADDER : cfg.COUPON_LADDER);
    if (!pcts.length) { var n = Math.max(1, Math.floor(Number(cfg.COUPON_BILLS) || 1)); for (var i = 0; i < n; i++) pcts.push(Number(cfg.COUPON_PCT) || 0); }
    var caps = numList(fs ? cfg.COUPON_FS_CAPS : cfg.COUPON_CAPS);
    if (!caps.length) caps = [Number(cfg.COUPON_CAP) || 0];
    var days = fs ? (Number(cfg.COUPON_FS_DAYS) || Number(cfg.COUPON_DAYS) || 60) : (Number(cfg.COUPON_DAYS) || 30);
    var minRaw = fs ? cfg.COUPON_FS_MIN_BILL : cfg.COUPON_MIN_BILL, minBill = minRaw === '' || minRaw === undefined || minRaw === null ? 0 : Number(minRaw) || 0;
    var src = String((fs ? cfg.COUPON_FS_SOURCES : cfg.COUPON_SOURCES) || (fs ? 'ref' : 'ref,sign,self')).split(/[,|\s]+/).filter(Boolean);
    return { pcts: pcts, amts: pcts.map(function () { return 0; }), caps: caps, mins: [minBill], days: days, minBill: minBill, scope: 'promo', sources: src, bills: pcts.length, offerId: '', label: '' };
  }
  /* ข้อความสั้นของขั้นคูปอง เช่น "ลด ฿150" / "ลด 33% (สูงสุด ฿60)" */
  function stepText(plan, i) {
    var cap = plan.caps[Math.min(i, plan.caps.length - 1)] || 0;
    return plan.amts[i] ? 'ลด ฿' + plan.amts[i].toLocaleString('en-US') : 'ลด ' + plan.pcts[i] + '%' + (cap ? ' (สูงสุด ฿' + cap.toLocaleString('en-US') + ')' : '');
  }
  /* ขั้นของคูปองที่จะใช้กับบิลถัดไป (0 = บิลแรก) จากจำนวนที่เหลือ */
  function couponStep(plan, couponLeft) { return Math.max(0, Math.min(plan.bills - 1, plan.bills - Math.floor(Number(couponLeft) || 0))); }
  /**
   * cart: { lines: {sku: qty}, bundles: {id: qty}, useCoin: bool, mode: 'deliver'|'pickup'|'shop', slot }
   * cart: evening = true → รอบเย็น (Evening Extension)
   * ctx:  { products: [...], bundles: [...], cfg: {...}, member: {type, couponLeft, couponExpires, sourceKind, inZone, regDate, offer} | null, coinBal, today: 'yyyy-MM-dd' }
   */
  function calcCart(cart, ctx) {
    var cfg = ctx.cfg, today = ctx.today, m = ctx.member || null;
    var pmap = {}, bmap = {};
    ctx.products.forEach(function (p) { pmap[p.sku] = p; });
    ctx.bundles.forEach(function (b) { bmap[b.id] = b; });
    var lines = [], bl = [], errors = [];
    var cl = cart.lines || {}, cb = cart.bundles || {};
    Object.keys(cl).forEach(function (sku) {
      var q = Math.floor(Number(cl[sku]) || 0); if (q <= 0) return;
      var p = pmap[sku];
      if (!p) { errors.push('ไม่พบสินค้า ' + sku); return; }
      if (!p.inStock) { errors.push(p.name + ' หมดวันนี้'); return; }
      var price = unitPrice(p, q);
      lines.push({ sku: sku, name: p.name, unit: p.unit, qty: q, price: price, total: price * q, promo: !!p.promo, kg: p.kg * q });
    });
    Object.keys(cb).forEach(function (id) {
      var q = Math.floor(Number(cb[id]) || 0); if (q <= 0) return;
      var b = bmap[id];
      if (!b || !b.active) { errors.push('ไม่พบเซ็ต ' + id); return; }
      var kg = 0, normal = 0, out = b.items.filter(function (it) { var p = pmap[it[0]]; return !p || !p.inStock; });
      if (out.length) { errors.push(b.name + ' หมดวันนี้ (สินค้าในเซ็ตหมด)'); return; }
      b.items.forEach(function (it) { var p = pmap[it[0]]; if (p) { kg += p.kg * it[1]; normal += unitPrice(p, it[1]) * it[1]; } });
      bl.push({ id: id, name: b.name, qty: q, price: b.price, total: b.price * q, kg: kg * q, normal: normal * q });
    });
    var subtotal = 0, eligible = 0, kgSum = 0;
    lines.forEach(function (l) { subtotal += l.total; kgSum += l.kg; if (l.promo) eligible += l.total; });
    bl.forEach(function (l) { subtotal += l.total; kgSum += l.kg; eligible += l.total; });
    var coupon = 0, couponWhy = '', couponPct = 0, couponCap = 0, couponAmt = 0, step = 0, plan = couponPlan(cfg, m ? m.type : 'FS', m ? m.offer : null);
    if (m && Number(m.couponLeft) > 0) {
      step = couponStep(plan, m.couponLeft); couponPct = plan.pcts[step] || 0; couponAmt = plan.amts[step] || 0; couponCap = plan.caps[Math.min(step, plan.caps.length - 1)] || 0;
      var minB = plan.mins[Math.min(step, plan.mins.length - 1)] || 0, base = plan.scope === 'all' ? subtotal : eligible;
      if (String(m.couponExpires || '') < today) couponWhy = 'คูปองหมดอายุแล้ว';
      else if (subtotal < minB) couponWhy = 'ยอดยังไม่ถึง ' + minB.toLocaleString('en-US') + ' บาท คูปองยังไม่ทำงาน';
      else if (base <= 0) couponWhy = 'คูปองใช้ได้กับสินค้าร่วมรายการและเซ็ตคุ้มเท่านั้น';
      else coupon = couponAmt ? Math.min(couponAmt, base) : Math.min(Math.round(base * couponPct / 100), couponCap || 1e9);
    }
    var bal = Math.max(0, Math.floor(Number(ctx.coinBal) || 0));
    var coinBase = Math.max(0, subtotal - coupon), coinMax = Math.max(0, Math.floor(coinBase * cfg.COIN_MAX_PCT / 100 / cfg.COIN_VALUE));
    var coinWhy = '';
    if (cfg.COIN_SCOPE !== 'all') { // ส่วนลดสะสมใช้ได้เฉพาะสินค้าร่วมรายการ
      var elig = Math.max(0, Math.floor((eligible - (plan.scope === 'all' ? Math.min(coupon, Math.max(0, coupon - (subtotal - eligible))) : coupon)) / cfg.COIN_VALUE));
      if (coinMax > elig) coinMax = elig;
      if (bal > 0 && coinMax <= 0 && subtotal > 0) coinWhy = 'ส่วนลดสะสมใช้ได้กับสินค้าร่วมรายการและเซ็ตคุ้มเท่านั้น';
    }
    var coinUse = cart.useCoin ? Math.min(bal, coinMax) : 0;
    var net = subtotal - coupon - coinUse * cfg.COIN_VALUE;
    var mode = (cart.mode === 'shop' && cfg.PICKUP_SHOP !== false) ? 'shop' : (cart.mode === 'pickup' && m && m.sourceKind === 'sign') ? 'pickup' : 'deliver';
    var evening = mode === 'deliver' && !!cart.evening && cfg.EVENING_ENABLED !== false; // รอบเย็น: ขั้นต่ำของรอบเย็น ไม่มีส่งรวมรอบ
    var min = cfg.MIN_ORDER;
    if (mode !== 'deliver') min = 0;
    else if (evening) min = Number(cfg.EVENING_MIN) || 0;
    else if (m && m.sourceKind === 'ref' && m.inZone && m.regDate && daysBetween(m.regDate, today) <= cfg.NEW_MIN_DAYS) min = cfg.NEW_MIN_ORDER;
    var belowMin = mode === 'deliver' && subtotal > 0 && subtotal < min;
    var poolMin = Number(cfg.POOL_MIN) || 0;
    var pool = !evening && belowMin && (poolMin <= 0 || subtotal >= poolMin); // ต่ำกว่าขั้นต่ำ แต่รับแบบ "รอรวมรอบ" ได้ (POOL_MIN 0 = รับทุกยอดเหมือนเดิม)
    var tooSmall = belowMin && !pool;
    return { lines: lines, bundles: bl, subtotal: subtotal, eligible: eligible, coupon: coupon, couponWhy: couponWhy, couponPct: couponPct, couponCap: couponCap, couponAmt: couponAmt, couponStep: step, couponBills: plan.bills,
      couponScope: plan.scope, coinBal: bal, coinMax: coinMax, coinUse: coinUse, coinWhy: coinWhy, net: net, kg: Math.round(kgSum * 10) / 10, mode: mode, min: min, evening: evening,
      belowMin: belowMin, pool: pool, tooSmall: tooSmall, poolMin: poolMin, count: lines.length + bl.length, errors: errors };
  }
  /* ===== จบส่วนคำนวณ ===== */


  /* ===== ตัวสร้าง QR (เขียนเอง ไม่ต้องโหลดไลบรารีจากภายนอก) · โหมด byte UTF-8 · ระดับแก้ผิด M · เวอร์ชัน 1–20 ===== */
  var QR = (function () {
    // [จำนวนบล็อกกลุ่ม1, data ต่อบล็อก, จำนวนบล็อกกลุ่ม2, data ต่อบล็อก, ec ต่อบล็อก] ระดับ M
    var RS = [null, [1, 16, 0, 0, 10], [1, 28, 0, 0, 16], [1, 44, 0, 0, 26], [2, 32, 0, 0, 18], [2, 43, 0, 0, 24], [4, 27, 0, 0, 16], [4, 31, 0, 0, 18],
      [2, 38, 2, 39, 22], [3, 36, 2, 37, 22], [4, 43, 1, 44, 26], [1, 50, 4, 51, 30], [6, 36, 2, 37, 22], [8, 37, 1, 38, 22], [4, 40, 5, 41, 24],
      [5, 41, 5, 42, 24], [7, 45, 3, 46, 28], [10, 46, 1, 47, 28], [9, 43, 4, 44, 26], [3, 44, 11, 45, 26], [3, 41, 13, 42, 26]];
    var ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62],
      [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90]];
    var EXP = new Array(512), LOG = new Array(256);
    (function () { var x = 1; for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; } for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255]; })();
    function gmul(a, b) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; }
    function genPoly(n) { var g = [1]; for (var i = 0; i < n; i++) { var ng = new Array(g.length + 1).fill(0); for (var j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= gmul(g[j], EXP[i]); } g = ng; } return g; }
    function rsEc(data, n) {
      var g = genPoly(n), res = data.concat(new Array(n).fill(0));
      for (var i = 0; i < data.length; i++) { var c = res[i]; if (c) for (var j = 0; j < g.length; j++) res[i + j] ^= gmul(g[j], c); }
      return res.slice(data.length);
    }
    function utf8(s) {
      if (window.TextEncoder) return Array.prototype.slice.call(new TextEncoder().encode(s));
      var b = unescape(encodeURIComponent(s)), out = []; for (var i = 0; i < b.length; i++) out.push(b.charCodeAt(i)); return out;
    }
    function bch(data, poly, shift) {
      var d = data << shift, pl = poly.toString(2).length;
      while (d.toString(2).length >= pl) d ^= poly << (d.toString(2).length - pl);
      return (data << shift) | d;
    }
    function maskFn(m) {
      return [function (i, j) { return (i + j) % 2 === 0; }, function (i) { return i % 2 === 0; }, function (i, j) { return j % 3 === 0; }, function (i, j) { return (i + j) % 3 === 0; },
        function (i, j) { return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0; }, function (i, j) { return (i * j) % 2 + (i * j) % 3 === 0; },
        function (i, j) { return ((i * j) % 2 + (i * j) % 3) % 2 === 0; }, function (i, j) { return ((i + j) % 2 + (i * j) % 3) % 2 === 0; }][m];
    }
    function codewords(bytes, v) {
      var t = RS[v], dataCw = t[0] * t[1] + t[2] * t[3], bits = [];
      function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
      put(4, 4); put(bytes.length, v < 10 ? 8 : 16); bytes.forEach(function (b) { put(b, 8); });
      for (var k = 0; k < 4 && bits.length < dataCw * 8; k++) bits.push(0);
      while (bits.length % 8) bits.push(0);
      var data = []; for (var i = 0; i < bits.length; i += 8) { var x = 0; for (var j = 0; j < 8; j++) x = (x << 1) | bits[i + j]; data.push(x); }
      for (var p = 0; data.length < dataCw; p++) data.push(p % 2 ? 0x11 : 0xEC);
      var blocks = [], ecs = [], off = 0;
      for (var b = 0; b < t[0] + t[2]; b++) { var len = b < t[0] ? t[1] : t[3]; var blk = data.slice(off, off + len); off += len; blocks.push(blk); ecs.push(rsEc(blk, t[4])); }
      var out = [], maxLen = Math.max(t[1], t[3]);
      for (var r = 0; r < maxLen; r++) blocks.forEach(function (bk) { if (r < bk.length) out.push(bk[r]); });
      for (var e = 0; e < t[4]; e++) ecs.forEach(function (ec) { out.push(ec[e]); });
      return out;
    }
    function build(cw, v, mask) {
      var n = v * 4 + 17, M = [], i, j, r, c;
      for (i = 0; i < n; i++) { M.push(new Array(n).fill(null)); }
      function finder(row, col) {
        for (r = -1; r <= 7; r++) for (c = -1; c <= 7; c++) {
          if (row + r < 0 || row + r >= n || col + c < 0 || col + c >= n) continue;
          M[row + r][col + c] = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6)) || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        }
      }
      finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
      var pos = ALIGN[v];
      for (i = 0; i < pos.length; i++) for (j = 0; j < pos.length; j++) {
        var ar = pos[i], ac = pos[j];
        if (M[ar][ac] !== null) continue;
        for (r = -2; r <= 2; r++) for (c = -2; c <= 2; c++) M[ar + r][ac + c] = r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0);
      }
      for (i = 8; i < n - 8; i++) { if (M[i][6] === null) M[i][6] = i % 2 === 0; if (M[6][i] === null) M[6][i] = i % 2 === 0; }
      var fb = bch(mask, 0x537, 10) ^ 0x5412; // ระดับ M = 00
      for (i = 0; i < 15; i++) {
        var bit = ((fb >> i) & 1) === 1;
        if (i < 6) M[i][8] = bit; else if (i < 8) M[i + 1][8] = bit; else M[n - 15 + i][8] = bit;
        if (i < 8) M[8][n - i - 1] = bit; else if (i < 9) M[8][15 - i] = bit; else M[8][14 - i] = bit;
      }
      M[n - 8][8] = true;
      if (v >= 7) {
        var vb = bch(v, 0x1F25, 12);
        for (i = 0; i < 18; i++) { var b2 = ((vb >> i) & 1) === 1; M[Math.floor(i / 3)][i % 3 + n - 11] = b2; M[i % 3 + n - 11][Math.floor(i / 3)] = b2; }
      }
      var mf = maskFn(mask), inc = -1, row = n - 1, bitIdx = 7, byteIdx = 0;
      for (var col = n - 1; col > 0; col -= 2) {
        if (col === 6) col--;
        for (;;) {
          for (c = 0; c < 2; c++) {
            if (M[row][col - c] === null) {
              var dark = byteIdx < cw.length ? ((cw[byteIdx] >>> bitIdx) & 1) === 1 : false;
              if (mf(row, col - c)) dark = !dark;
              M[row][col - c] = dark;
              if (--bitIdx < 0) { byteIdx++; bitIdx = 7; }
            }
          }
          row += inc;
          if (row < 0 || row >= n) { row -= inc; inc = -inc; break; }
        }
      }
      return M;
    }
    function penalty(M) {
      var n = M.length, p = 0, i, j, k;
      for (i = 0; i < n; i++) {
        var runR = 1, runC = 1;
        for (j = 1; j < n; j++) {
          if (M[i][j] === M[i][j - 1]) { runR++; } else { if (runR >= 5) p += runR - 2; runR = 1; }
          if (M[j][i] === M[j - 1][i]) { runC++; } else { if (runC >= 5) p += runC - 2; runC = 1; }
        }
        if (runR >= 5) p += runR - 2; if (runC >= 5) p += runC - 2;
      }
      for (i = 0; i < n - 1; i++) for (j = 0; j < n - 1; j++) { var s = M[i][j] + M[i + 1][j] + M[i][j + 1] + M[i + 1][j + 1]; if (s === 0 || s === 4) p += 3; }
      var pat = [true, false, true, true, true, false, true];
      for (i = 0; i < n; i++) for (j = 0; j + 7 <= n; j++) {
        var h = true, vv = true;
        for (k = 0; k < 7; k++) { if (M[i][j + k] !== pat[k]) h = false; if (M[j + k][i] !== pat[k]) vv = false; }
        if (h) p += 40; if (vv) p += 40;
      }
      var dk = 0; for (i = 0; i < n; i++) for (j = 0; j < n; j++) if (M[i][j]) dk++;
      p += Math.floor(Math.abs(dk * 100 / (n * n) - 50) / 5) * 10;
      return p;
    }
    function matrix(text) {
      var bytes = utf8(String(text)), v = 1;
      for (; v <= 20; v++) { var t = RS[v]; if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= (t[0] * t[1] + t[2] * t[3]) * 8) break; }
      if (v > 20) throw new Error('ข้อความยาวเกินกว่าจะทำ QR');
      var cw = codewords(bytes, v), best = null, bestP = Infinity;
      for (var m = 0; m < 8; m++) { var M = build(cw, v, m), pp = penalty(M); if (pp < bestP) { bestP = pp; best = M; } }
      return best;
    }
    function svg(text, margin) {
      var M = matrix(text), n = M.length, q = margin === undefined ? 4 : margin, d = '';
      for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) if (M[i][j]) d += 'M' + (j + q) + ' ' + (i + q) + 'h1v1h-1z';
      var s = n + q * 2;
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + s + ' ' + s + '" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="' + s + '" height="' + s + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
    }
    return { matrix: matrix, svg: svg };
  })();


  var CAT = { set: 'เซ็ตคุ้ม', pork: 'หมู', poultry: 'ไก่', egg: 'ไข่', process: 'แปรรูป', other: 'อื่นๆ' };
  var CAT_ORDER = ['pork', 'poultry', 'egg', 'process'];
  function catLabel(k) { return CAT[k] || k; }
  function catList() {
    var have = [];
    S.cat.products.forEach(function (p) { if (have.indexOf(p.cat) < 0) have.push(p.cat); });
    return CAT_ORDER.filter(function (k) { return have.indexOf(k) >= 0; }).concat(have.filter(function (k) { return CAT_ORDER.indexOf(k) < 0; }));
  }
  var S = { me: null, cat: null, page: 'home', params: {}, history: [], cart: null, ui: {}, data: {}, busyN: 0 };
  var app = document.getElementById('app');

  /* ---------- ไอคอน (SVG ในไฟล์ ไม่โหลดจากภายนอก) ---------- */
  var UI_ICONS = {
    shop: '<path d="M3 9l2-6h14l2 6M3 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0M5 12v9h14v-9M9 21v-6h6v6"/>',
    bag: '<path d="M5 7h14l1 14H4L5 7zM8 8V6a4 4 0 018 0v2"/>',
    repeat: '<path d="M20 7h-6m6 0V1M4 17h6m-6 0v6M20 7a9 9 0 00-16-1M4 17a9 9 0 0016 1"/>',
    bill: '<path d="M6 3h12v19l-3-2-3 2-3-2-3 2V3zM9 7h6M9 11h6M9 15h3"/>',
    invite: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a7 7 0 0114 0v2M19 8v6m-3-3h6"/>',
    wallet: '<path d="M20 8H5a3 3 0 010-6h13v6M3 5v14a2 2 0 002 2h15V8m0 5h-6v4h6"/><circle cx="16.5" cy="15" r=".5"/>',
    card: '<rect x="2" y="4" width="20" height="16" rx="3"/><circle cx="8" cy="10" r="2"/><path d="M5 16a3 3 0 016 0M15 9h4m-4 4h4"/>',
    home: '<path d="M3 10l9-8 9 8M5 9v12h14V9M9 21v-7h6v7"/>',
    arrow: '<path d="M4 12h16m-6-6l6 6-6 6"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M16 16l5 5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    truck: '<path d="M1 4h13v13H1zM14 9h5l4 5v3h-9"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
    check: '<path d="M5 12l4 4L19 6"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M15 8h-5a2 2 0 000 4h4a2 2 0 010 4H9m3-10v12"/>',
    set: '<path d="M3 8l9-5 9 5v11l-9 3-9-3V8zm0 0l9 4 9-4M12 12v10M7 5l10 5"/>',
    pork: '<path d="M5 7c-4 4-2 11 3 13s12-1 13-7-3-11-8-10c-3 0-5 1-8 4z"/><path d="M8 9c-3 3-1 7 2 8s7-1 7-5-4-6-9-3z"/>',
    poultry: '<path d="M10 15C3 14 2 8 7 4s12-1 12 4c0 3-3 5-6 6l-3 4-2-2 2-1zM9 18l-2 3a2 2 0 01-3-2 2 2 0 01-1-3l3-1"/>',
    egg: '<path d="M19 14c0 5-3 8-7 8s-7-3-7-8S9 2 12 2s7 7 7 12zM9 15c0 2 1 3 3 3"/>',
    process: '<path d="M5 6c5-4 13-1 15 5s-2 11-7 9c-3-1-2-5-3-8S1 10 5 6zM6 4l1-2m-3 2L2 3M14 21v2m3-2l1 2"/>',
    leaf: '<path d="M20 3C8 2 2 7 5 15s15 3 15-12zM4 21L15 9"/>',
    pin: '<path d="M12 22s7-7.2 7-12a7 7 0 00-14 0c0 4.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
    phone: '<path d="M5 3h4l2 5-3 2a12 12 0 006 6l2-3 5 2v4a2 2 0 01-2 2A17 17 0 013 5a2 2 0 012-2z"/>',
    slip: '<path d="M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21V3z"/><path d="M10 8h4M10 12h4"/>',
    camera: '<path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13" r="4"/>',
    bell: '<path d="M6 16V11a6 6 0 0112 0v5l2 2H4l2-2zM10 20a2 2 0 004 0"/>',
    alert: '<path d="M12 3l10 18H2L12 3zM12 10v5M12 18v.5"/>'
  };
  function icon(name) { return '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (UI_ICONS[name] || UI_ICONS.bag) + '</svg>'; }
  function navBar() {
    if (!S.me || !S.me.member || S.me.member.rejected || /^(admin|staffjoin|partner|partnerjoin|catalog|cart|done)$/.test(S.page)) return '';
    return '<nav class="bottom-nav" aria-label="เมนูหลัก">' + [['home', 'home', 'หน้าแรก'], ['catalog', 'bag', 'สั่งของ'], ['bills', 'bill', 'บิลของฉัน'], ['card', 'card', 'สมาชิก']].map(function (n) {
      var on = S.page === n[0] || n[0] === 'bills' && S.page === 'bill' || n[0] === 'card' && /^(wallet|invite|standing)$/.test(S.page);
      var badge = n[0] === 'bills' && S.me.unpaid ? '<i class="dot" aria-label="มีบิลรอชำระ"></i>' : '';
      return '<button data-a="go" data-p="' + n[0] + '"' + (on ? ' aria-current="page" class="on"' : '') + '>' + icon(n[1]) + badge + '<span>' + n[2] + '</span></button>';
    }).join('') + '</nav>';
  }
  function hero() {
    return '<section class="shop-hero"><img src="assets/ingredients.jpg" alt="ภาพประกอบวัตถุดิบ หมู ไก่ และไข่" width="960" height="640" decoding="async"><div class="hero-copy"><span class="eyebrow">BETAGRO SHOP · โพธิ์แก้ว</span><h2>พร้อมทุกมื้อ<br>เพื่อร้านของคุณ</h2><p>หมู · ไก่ · ไข่ · สินค้าแปรรูป</p><span class="hero-tag">สั่งง่าย ผ่าน LINE</span></div><small class="image-note">ภาพประกอบ</small></section>';
  }
  function menuTile(page, name, detail, glyph, primary) {
    return '<button class="tile' + (primary ? ' featured' : '') + '" data-a="go" data-p="' + page + '"><span class="tile-icon">' + icon(glyph) + '</span><b>' + name + '</b><small>' + detail + '</small></button>';
  }
  function orderProgress(status, delivery) {
    if (status === 'cancelled') return '<div class="alert bad">ออเดอร์นี้ถูกยกเลิกแล้ว</div>';
    var at = ['new', 'approved', 'billed', 'paid'].indexOf(status);
    var h = '<ol class="order-progress" aria-label="สถานะออเดอร์">' + ['รับออเดอร์', 'จัดของ', 'รอชำระ', 'ชำระแล้ว'].map(function (label, i) { return '<li class="' + (i <= at ? 'complete' : '') + '"' + (i === at ? ' aria-current="step"' : '') + '><span>' + (i < at || (i === at && i === 3) ? icon('check') : i + 1) + '</span>' + label + '</li>'; }).join('') + '</ol>';
    if (delivery === 'out') h += '<div class="alert info row-flex">' + icon('truck') + '<span>กำลังนำส่ง</span></div>';
    if (delivery === 'done') h += '<div class="alert ok row-flex">' + icon('check') + '<span>ส่งถึงแล้ว</span></div>';
    return h;
  }

  /* ---------- ตัวช่วย ---------- */
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { n = Number(n) || 0; return Math.abs(n - Math.round(n)) > 0.004 ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(n).toLocaleString('en-US'); }
  function baht(n) { return '฿' + fmt(n); }
  function toast(t, ms) { var el = document.getElementById('toast'); if (!el) return; el.textContent = t; el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { el.hidden = true; }, ms || 3200); }
  function busy(on, text) {
    var el = document.getElementById('busy');
    if (on) { if (!el) { el = document.createElement('div'); el.id = 'busy'; el.className = 'busy'; document.body.appendChild(el); } el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); el.innerHTML = '<div><span class="spinner" aria-hidden="true"></span><b>' + esc(text || 'กำลังทำรายการ...') + '</b><small>รอสักครู่</small></div>'; }
    else if (el) el.remove();
  }
  function store(key, val) { try { if (val === undefined) { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(val)); } catch (e) { return null; } return null; }
  function todayStr() { return (S.cat && S.cat.today) || new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); }
  function nowHM() { return new Date(Date.now() + 7 * 3600e3).toISOString().slice(11, 16); }
  function thDate(d) { var M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']; d = String(d || ''); return d.length >= 10 ? Number(d.slice(8, 10)) + ' ' + M[Number(d.slice(5, 7)) - 1] : d; }
  function dayName(d) { return ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์', 'เสาร์'][new Date(String(d).slice(0, 10) + 'T00:00:00Z').getUTCDay()]; }
  function isStaff() { return !!(S.me && S.me.staff); }
  function readParams() {
    var raw = {}, out = {};
    new URLSearchParams(location.search).forEach(function (v, k) { raw[k] = v; });
    var callback = !!(raw.liffClientId || raw.liffRedirectUri); // กลับจากหน้า LINE Login บนคอม
    Object.keys(raw).forEach(function (k) {
      if (k === 'liff.state' || k === 'liffClientId' || k === 'liffRedirectUri') return;
      if (callback && (k === 'code' || k === 'state')) return;
      out[k] = raw[k];
    });
    function merge(u) { u = String(u || ''); var q = u.indexOf('?') >= 0 ? u.slice(u.indexOf('?') + 1) : ''; new URLSearchParams(q).forEach(function (v, k) { if (!out[k]) out[k] = v; }); }
    merge(raw['liff.state']);      // เปิดครั้งแรกจาก LINE
    merge(raw.liffRedirectUri);    // หน้าที่ตั้งใจเปิดก่อนไปล็อกอิน
    return out;
  }
  /* ล้างพารามิเตอร์ของการล็อกอินออกจากแถบที่อยู่ เพื่อให้กด Bookmark แล้วเปิดซ้ำได้ */
  function cleanUrl() {
    try {
      if (!/[?&](code|liffClientId|liffRedirectUri|liff\.state)=/.test(location.search)) return;
      var q = new URLSearchParams(); Object.keys(S.params).forEach(function (k) { q.set(k, S.params[k]); });
      history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q.toString() : ''));
    } catch (e) { }
  }

  /* ---------- เชื่อมหลังบ้าน: ลองใหม่อัตโนมัติ + กันกดซ้ำ (rid) ---------- */
  var READS = { catalog: 1, ping: 1, init: 1, me: 1, myOrders: 1, order: 1, wallet: 1, invite: 1, standing: 1, partnerDash: 1, roundInfo: 1, linkFind: 1, staffInviteInfo: 1,
    adminData: 1, adminPoll: 1, exportData: 1, slipImage: 1, selfTest: 1, memberLinkInfo: 1 };
  function rid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function netErr(kind, status) { var e = new Error(kind); e.code = 'NET'; e.kind = kind; e.status = status || 0; return e; }
  /* เปิดหน้าจากข้อมูลในเครื่องได้ก่อน LINE พร้อม → คำสั่งที่ต้องใช้ token รอจน LINE พร้อม */
  var liffReady = null, readyResolve = null;
  liffReady = new Promise(function (res) { readyResolve = res; });
  var PERF = [];
  function perfAdd(action, ms, sms, ok) { PERF.push({ a: action, ms: ms, sms: sms || 0, ok: ok, t: Date.now() }); if (PERF.length > 300) PERF.shift(); }
  function api(action, data, opt) {
    opt = opt || {};
    var isRead = !!READS[action], body = Object.assign({ action: action }, data || {});
    if (!isRead) body.rid = body.rid || rid();
    if (S.asRole) body.asRole = S.asRole; // ผู้จัดการทดสอบบทบาทอื่น (หลังบ้านลดสิทธิ์ให้เท่านั้น)
    var tries = opt.tries || (isRead ? 4 : 3), t0 = Date.now();
    function attempt(n) {
      try { body.token = liff.getAccessToken() || ''; } catch (e) { body.token = ''; }
      var ctrl = window.AbortController ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, opt.timeout || (isRead ? 20000 : 30000)) : null;
      return fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined, cache: 'no-store', redirect: 'follow' })
        .then(function (r) { if (!r.ok) throw netErr('HTTP ' + r.status, r.status); return r.text(); })
        .then(function (t) {
          var j; try { j = JSON.parse(t); } catch (x) { throw netErr(/<html/i.test(t) ? 'HTML' : 'NOTJSON'); }
          if (!j || !j.ok) { var e = new Error((j && j.error) || 'เกิดข้อผิดพลาด'); e.code = (j && j.code) || 'SERVER'; e.detail = j && j.detail; e.server = true; throw e; }
          if (timer) clearTimeout(timer);
          perfAdd(action, Date.now() - t0, j.ms, true);
          return j;
        })
        .catch(function (e) {
          if (timer) clearTimeout(timer);
          if (e && e.name === 'AbortError') e = netErr('TIMEOUT');
          if (!e.code) e = netErr('OFFLINE');
          var retry = (e.code === 'NET' || e.code === 'BUSY') && n + 1 < tries;
          if (retry) {
            if (n >= 1 && !opt.quiet) toast('สัญญาณช้า กำลังลองใหม่ให้อัตโนมัติ (' + (n + 1) + '/' + (tries - 1) + ')', 2500);
            return sleep(Math.min(6000, 700 * Math.pow(2, n)) + Math.random() * 400).then(function () { return attempt(n + 1); });
          }
          perfAdd(action, Date.now() - t0, 0, false);
          throw e;
        });
    }
    return (action === 'catalog' || action === 'ping' ? Promise.resolve() : liffReady).then(function () { return attempt(0); });
  }
  /* ข้อความที่ลูกค้าเห็น: สั้น ไม่มีศัพท์เทคนิค (พนักงานเห็นรายละเอียดเพิ่ม) */
  function friendly(e) {
    if (!e) return 'เกิดข้อผิดพลาด กรุณาลองใหม่';
    if (e.code === 'RATE') return 'ใช้งานถี่เกินไป กรุณารอ 1 นาทีแล้วลองใหม่';
    if (e.code === 'NET') return e.kind === 'TIMEOUT' ? 'ร้านตอบช้ากว่าปกติ กรุณาลองอีกครั้ง' : e.kind === 'OFFLINE' ? 'ไม่มีสัญญาณอินเทอร์เน็ต กรุณาตรวจการเชื่อมต่อแล้วลองใหม่' : 'เชื่อมต่อร้านไม่สำเร็จชั่วคราว กรุณาลองใหม่อีกครั้ง';
    return e.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
  }
  function techNote(e) {
    if (!e || !isStaff()) return '';
    var t = [e.code, e.kind, e.detail].filter(Boolean).join(' · ');
    if (e.code === 'NET' && /404|HTML|NOTJSON/.test(e.kind || '')) t += ' — ตรวจ API_URL ใน config.js ต้องลงท้าย /exec และ Deploy แบบ Who has access: Anyone';
    return t ? '<small class="tech">' + esc(t) + '</small>' : '';
  }
  function fail(e) {
    busy(false);
    S.lastErr = e;
    if (e && e.code === 'AUTH') { render('<div class="wrap"><section class="box empty-state">' + icon('alert') + '<h2>' + esc(friendly(e)) + '</h2>' + techNote(e) + '<button class="btn pri block" data-a="reload">เปิดใหม่</button></section></div>'); return; }
    if (e && e.code === 'NOMEMBER') { S.page = 'home'; return refreshMe().then(show, function () { show(); }); }
    var loading = app.querySelector('.empty.loading');
    if (loading) { loading.classList.remove('loading'); loading.innerHTML = icon('alert') + '<b>โหลดข้อมูลไม่สำเร็จ</b><span>' + esc(friendly(e)) + '</span>' + techNote(e) + '<button class="btn pri" data-a="retry">ลองใหม่</button>'; }
    else toast(friendly(e), 4500);
  }
  function run(text, promise, then) {
    busy(true, text); S.lastErr = null;
    return promise.then(function (r) {
      S.data = {}; // ข้อมูลเปลี่ยนแล้ว ล้างแคชหน้า
      return Promise.resolve(then ? then(r) : null).then(function () { busy(false); return r; });
    }).catch(fail);
  }
  /* แสดงข้อมูลเดิมทันที แล้วค่อยอัปเดตเบื้องหลัง (เปลี่ยนหน้าเร็ว) */
  function loadPage(key, action, data, draw, placeholder) {
    var page = S.page, hit = S.data[key];
    if (hit) draw(hit, true); else render(placeholder || (top(pageTitle(), '', true) + '<div class="wrap"><div class="empty">กำลังโหลด...</div></div>'));
    return api(action, data, { quiet: !!hit }).then(function (r) {
      S.data[key] = r;
      if (S.page === page && (!S.params.id || key.indexOf(S.params.id) >= 0) && !formBusy()) draw(r, false);
    }).catch(function (e) { if (S.page !== page) return; if (hit) toast('อัปเดตไม่สำเร็จ แสดงข้อมูลล่าสุดที่มี', 2500); else fail(e); });
  }
  function formBusy() { var a = document.activeElement; return !!(a && app.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox' && a.type !== 'radio' && a.type !== 'file'); }
  function pageTitle() { return { bills: 'บิลของฉัน', bill: 'บิล', invite: 'ชวนเพื่อน', wallet: 'ส่วนลดของฉัน', standing: 'สั่งประจำ', partner: 'ยอดป้ายของฉัน' }[S.page] || ''; }
  function qrSvg(text) { try { return QR.svg(text, 4); } catch (e) { return '<div class="hint">' + esc(e.message) + '</div>'; } }
  function copyText(t) {
    function fallback() { var i = document.createElement('input'); i.value = t; document.body.appendChild(i); i.select(); try { document.execCommand('copy'); toast('คัดลอกแล้ว'); } catch (e) { toast(t); } i.remove(); }
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { toast('คัดลอกแล้ว'); }, fallback); else fallback(); } catch (e) { fallback(); }
  }
  function openUrl(url, external) { try { if (liff.isInClient()) { liff.openWindow({ url: url, external: !!external }); return; } } catch (e) { } window.open(url, '_blank'); }
  function appLink(page, params) {
    var base = (S.cat && S.cat.cfg.LINK_BASE) || 'https://miniapp.line.me/', id = (S.cat && S.cat.cfg.LIFF_ID) || CFG.LIFF_ID;
    var q = '?page=' + encodeURIComponent(page);
    Object.keys(params || {}).forEach(function (k) { q += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); });
    return base + id + q;
  }
  function addFriendUrl() { var id = (S.cat && S.cat.cfg.OA_BASIC_ID) || ''; return id ? 'https://line.me/R/ti/p/@' + encodeURIComponent(id) : ''; }
  function imgUrl(ref, w) {
    if (!ref) return '';
    if (ref.indexOf('drive:') === 0) return 'https://lh3.googleusercontent.com/d/' + ref.slice(6) + '=w' + (w || 240);
    if (/^https?:\/\//.test(ref)) return ref;
    return ref.indexOf('/') >= 0 ? ref.replace(/^\/+/, '') : 'images/' + ref;
  }
  function thumb(item, cls, glyph) {
    var u = imgUrl(item && item.img, 240);
    return u ? '<img class="' + cls + '" src="' + esc(u) + '" alt="" loading="lazy" decoding="async" width="56" height="56" data-fb="' + esc(glyph) + '">' : '<div class="product-symbol">' + icon(glyph) + '</div>';
  }
  function demoNote() { return S.cat && S.cat.cfg.DEMO_NOTE ? '<p class="demo-note">ระบบทดลอง · ข้อมูลและราคาเป็นตัวอย่าง</p>' : ''; }
  function zoneName(id) { var z = (S.cat && S.cat.cfg.ZONE_LIST || []).filter(function (x) { return x.id === id; })[0]; return z ? z.name : id || ''; }
  function zoneSelect(name, val, idAttr) {
    return '<select id="' + idAttr + '" name="' + name + '"><option value="">— เลือกย่าน —</option>' + (S.cat.cfg.ZONE_LIST || []).map(function (z) { return '<option value="' + esc(z.id) + '"' + (z.id === val ? ' selected' : '') + '>' + esc(z.name) + '</option>'; }).join('') + '</select>';
  }

  /* ---------- ตะกร้า ---------- */
  function cartKey() { return 'cart_' + ((S.me && S.me.userId) || 'x'); }
  function loadCart() { S.cart = store(cartKey()) || { lines: {}, bundles: {}, useCoin: false, mode: 'deliver', slot: '' }; S.cart.lines = S.cart.lines || {}; S.cart.bundles = S.cart.bundles || {}; }
  function saveCart() { store(cartKey(), S.cart); }
  function calcNow() {
    var m = S.me && S.me.member;
    return calcCart(S.cart, { products: S.cat.products, bundles: S.cat.bundles, cfg: S.cat.cfg, today: S.cat.today, coinBal: S.me ? S.me.coinBal : 0,
      member: m ? { type: m.type, couponLeft: m.couponLeft, couponExpires: m.couponExpires, sourceKind: m.sourceKind, inZone: m.inZone, regDate: m.regDate, offer: S.me.offer || null } : null });
  }
  function prod(sku) { return S.cat.products.filter(function (p) { return p.sku === sku; })[0]; }
  /* รอบส่งที่ร้านจะจัดให้ (กติกาเดียวกับหลังบ้าน): สั่งก่อนปิดรับของรอบไหน ได้รอบนั้น · หลังรอบสุดท้าย = รอบเช้าพรุ่งนี้ */
  function waves() {
    var w = String(S.cat.cfg.WAVES || '').split('|').map(function (x) { var t = x.split(':'); return t.length >= 5 ? { name: t[0].trim(), depart: t[1] + ':' + t[2], cutoff: t[3] + ':' + t[4] } : null; }).filter(Boolean);
    return w.length ? w : [{ name: 'รอบเช้า', depart: '07:00', cutoff: '20:00' }, { name: 'รอบสาย', depart: '11:00', cutoff: '09:00' }, { name: 'รอบบ่าย', depart: '14:30', cutoff: '13:00' }];
  }
  function waveNow() {
    var W = waves(), t = nowHM(), today = todayStr(), i;
    function tmr() { var d = new Date(); d.setDate(d.getDate() + 1); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    for (i = 1; i < W.length; i++) if (t < W[i].cutoff) return { slot: W[i].name, date: today, depart: W[i].depart };
    if (t < W[0].cutoff) return { slot: W[0].name, date: tmr(), depart: W[0].depart };
    i = Math.min(1, W.length - 1); return { slot: W[i].name, date: tmr(), depart: W[i].depart };
  }
  function autoSlot() { return String(S.cat.cfg.SLOT_MODE || 'auto') !== 'choose'; }
  function couponStrip(cp) {
    if (!cp || !(cp.left > 0) || !(cp.expires >= S.cat.today)) return '';
    var txt = cp.text || ('ลด ' + cp.pct + '%' + (cp.cap ? ' (สูงสุด ' + baht(cp.cap) + ')' : ''));
    return '<div class="coupon-strip">' + icon('wallet') + '<span><b>ส่วนลดลูกค้าใหม่ บิลถัดไป' + esc(txt) + '</b><small>ใช้ได้อีก ' + cp.left + ' บิล · ' + (cp.scope === 'all' ? 'ทุกสินค้า' : 'สินค้าร่วมรายการและเซ็ตคุ้ม') + (cp.minBill > 0 ? ' · ขั้นต่ำ ' + baht(cp.minBill) : '') + ' · ถึง ' + esc(thDate(cp.expires)) + '</small></span></div>';
  }
  /* กติกาส่วนลดจากแท็บ Offers (ตรงกับหลังบ้าน) */
  function anyOf(v, want) { v = String(v || ''); return !v || v === 'any' || v === '*' || v.split(/[,|\s]+/).indexOf(want) >= 0; }
  function offerFor(kind, type, source) { return ((S.cat && S.cat.cfg.OFFERS) || []).filter(function (o) { return o.kind === kind && anyOf(o.memberType, type) && (kind === 'referrer' || anyOf(o.source, source)); })[0] || null; }
  function offerText(o) {
    if (!o) return '';
    var pl = couponPlan(S.cat.cfg, o.memberType, o);
    return pl.amts.map(function (a, i) { return (pl.bills > 1 ? 'บิลที่ ' + (i + 1) + ' ' : 'บิลแรก ') + stepText(pl, i) + (pl.mins[Math.min(i, pl.mins.length - 1)] > 0 ? ' (ขั้นต่ำ ' + baht(pl.mins[Math.min(i, pl.mins.length - 1)]) + ')' : ''); }).join(' · ');
  }
  function rewardText(o) {
    var c = S.cat.cfg; if (!o) return 'ส่วนลดสะสม ' + c.COIN_PCT + '% ของยอดบิลเพื่อน นาน ' + c.COIN_MONTHS + ' เดือน';
    var st = offerPlan(o).steps; return st.map(function (x, i) { return (x.amt ? baht(x.amt) : x.pct + '% ของยอด') + (st.length > 1 ? ' เมื่อเพื่อนจ่ายบิลที่ ' + (i + 1) : ' เมื่อเพื่อนจ่ายบิลแรก'); }).join(' + ');
  }
  /* รอบเย็น (Evening Extension) */
  function evCfg() { return (S.cat && S.cat.cfg.EVENING) || null; }
  function evOn() { var e = evCfg(); return !!(e && e.enabled && S.me && S.me.evening); }
  function evDayText(d) { return d === todayStr() ? 'คืนนี้' : 'คืน' + dayName(d) + 'ที่ ' + thDate(d); }
  function needBySelect(val, id) {
    var opts = String(S.cat.cfg.NEEDBY_OPTIONS || '').split('|').map(function (x) { return x.trim(); }).filter(Boolean);
    return '<select id="' + id + '" data-chg="needBy"><option value="">ไม่กำหนด (ตามรอบปกติ)</option>' + opts.map(function (o) { return '<option value="' + o + '"' + (val === o ? ' selected' : '') + '>ก่อน ' + o + ' น.</option>'; }).join('') + '</select>';
  }
  function tradeSelect(val, id, name) {
    var opts = String(S.cat.cfg.TRADES || '').split('|').map(function (x) { return x.trim(); }).filter(Boolean);
    if (!opts.length) return '';
    return '<div class="field"><label for="' + id + '">ประเภทธุรกิจ</label><select id="' + id + '" name="' + name + '"><option value="">เลือก</option>' + opts.map(function (o) { return '<option' + (val === o ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></div>';
  }

  /* ---------- นำทาง ---------- */
  var MEMBER_PAGES = { catalog: 1, cart: 1, bills: 1, bill: 1, invite: 1, wallet: 1, standing: 1, card: 1, reorder: 1 };
  function go(page, params, noPush) {
    if (!noPush) S.history.push({ page: S.page, params: S.params });
    S.page = page; S.params = params || {};
    window.scrollTo(0, 0);
    show();
  }
  function back() { var h = S.history.pop(); if (h) { S.page = h.page; S.params = h.params; show(); } else go('home', {}, true); }
  function render(html) {
    var samePage = app.dataset.page === S.page;
    var scrollers = ['.chips', '.bundle-grid', '.tabs'].map(function (selector) { var el = app.querySelector(selector); return { selector: selector, left: samePage && el ? el.scrollLeft : 0 }; });
    var active = document.activeElement, searchFocus = active && active.id === 'catalog-search';
    var selection = searchFocus ? active.selectionStart : 0;
    var control = active && active.dataset && /^(qty|cat|toTier)$/.test(active.dataset.a) ? { a: active.dataset.a, k: active.dataset.k, p: active.dataset.p, d: active.dataset.d } : null;
    var changeControl = active && active.dataset ? active.dataset.chg : null;
    app.innerHTML = html + navBar();
    app.dataset.page = S.page;
    scrollers.forEach(function (saved) { var el = app.querySelector(saved.selector); if (el) el.scrollLeft = saved.left; });
    var main = app.querySelector('.wrap'); if (main) { main.setAttribute('role', 'main'); main.id = 'main-content'; }
    app.querySelectorAll('.empty').forEach(function (el) { if (/กำลังโหลด/.test(el.textContent)) { el.classList.add('loading'); el.setAttribute('role', 'status'); el.innerHTML = '<span class="spinner" aria-hidden="true"></span><b>กำลังโหลดข้อมูล</b><span class="hint">รอสักครู่</span>'; } });
    app.querySelectorAll('.field label:not([for])').forEach(function (label, i) { var field = label.parentNode.querySelector('input,select,textarea'); if (field) { if (!field.id) field.id = 'ui-field-' + i; label.htmlFor = field.id; } });
    if (searchFocus) { var input = document.getElementById('catalog-search'); if (input) { input.focus({ preventScroll: true }); try { input.setSelectionRange(selection, selection); } catch (e) { } } }
    if (control) { var next = Array.prototype.find.call(app.querySelectorAll('[data-a]'), function (e) { return e.dataset.a === control.a && e.dataset.k === control.k && e.dataset.p === control.p && e.dataset.d === control.d; }); if (next) next.focus({ preventScroll: true }); }
    if (changeControl === 'useCoin') { var coinInput = app.querySelector('[data-chg="useCoin"]'); if (coinInput) coinInput.focus({ preventScroll: true }); }
    var header = app.querySelector('h1'); if (header && S.page !== 'admin') document.title = header.textContent + ' · Betagro Shop โพธิ์แก้ว';
  }
  function top(title, sub, canBack, extra) {
    return '<header class="top"><div class="top-inner">' + (canBack ? '<button class="ic" data-a="back" aria-label="ย้อนกลับ">' + icon('back') + '</button>' : '<span class="brand-symbol">' + icon('shop') + '</span>') +
      '<div class="t"><span class="brand-name">BETAGRO SHOP <span>· โพธิ์แก้ว</span></span><h1>' + esc(title) + '</h1>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>' + (extra || '') +
      (S.page !== 'home' ? '<button class="ic" data-a="home" aria-label="หน้าแรก">' + icon('home') + '</button>' : '') + '</div></header>';
  }
  function show() {
    if (!S.cat || !S.me) return bootScreen();
    var p = S.page, m = S.me.member;
    if (p === 'admin') return pageAdmin();
    if (p === 'staffjoin') return pageStaffJoin();
    if (p === 'partnerjoin') return pagePartnerJoin();
    if (p === 'partner') return pagePartner();
    if (p === 'link') return pageLink();
    if (p === 'join') return pageJoin();
    if (p === 'register') return m ? pageHome() : pageRegister();
    if (MEMBER_PAGES[p] && (!m || m.rejected)) return m && m.rejected ? pageRejected() : pageHome();
    if (p === 'reorder') return doReorder();
    if (p === 'catalog') return pageCatalog();
    if (p === 'cart') return pageCart();
    if (p === 'done') return pageDone();
    if (p === 'bills') return pageBills();
    if (p === 'bill') return pageBill();
    if (p === 'invite') return pageInvite();
    if (p === 'wallet') return pageWallet();
    if (p === 'standing') return pageStanding();
    if (p === 'card') return pageCard();
    return pageHome();
  }
  function bootScreen(msg) {
    render('<div class="boot" role="status"><span class="boot-brand">BETAGRO SHOP</span><span class="spinner" aria-hidden="true"></span><b>' + esc(msg || 'กำลังเปิดร้านโพธิ์แก้ว') + '</b><small>รอสักครู่</small></div>');
  }

  /* ---------- หน้าแรก ---------- */
  function pageHome() {
    var m = S.me.member;
    if (!m) {
      return render(top('ยินดีต้อนรับค่ะ', '', false) + '<div class="wrap">' + hero() +
        '<div class="intro"><h2>สั่งวัตถุดิบให้ร้านคุณ<br>ง่ายขึ้นในทุกวัน</h2><p>เลือกสินค้า ดูบิล และใช้สิทธิ์สมาชิกในที่เดียว</p></div>' +
        '<button class="btn pri block" data-a="go" data-p="register">เริ่มต้นลงทะเบียน ' + icon('arrow') + '</button><button class="btn block" data-a="go" data-p="link">เป็นลูกค้าเดิม · ผูกเลขสมาชิก</button>' +
        demoNote() + staffLinks() + '</div>');
    }
    if (m.rejected) return pageRejected();
    var sh = S.me.shared || {};
    var h = top('สวัสดีค่ะ ' + (sh.owner === false && sh.me ? sh.me + ' · ' : '') + m.name, (m.sno ? 'สมาชิก ' + m.sno : 'รอร้านยืนยันสมาชิก · สั่งของได้แล้ว') + (sh.owner === false ? ' · ใช้บัญชีร่วมกับ ' + (sh.ownerName || 'เจ้าของร้าน') : ''), false) + '<div class="wrap">';
    if (S.me.eveningDue) h += '<button class="notice warn" data-a="go" data-p="bill" data-id="' + esc(S.me.eveningDue.id) + '">' + icon('clock') + '<span><b>รอบเย็น' + esc(evDayText(S.me.eveningDue.date)) + ': โอนก่อน ' + esc(S.me.eveningDue.payBy.slice(11, 16)) + ' น. · ' + baht(S.me.eveningDue.amount) + '</b><small>แตะเพื่อสแกน QR และแนบสลิป · ไม่ทันเวลา ระบบเลื่อนเป็นคืนถัดไปให้</small></span>' + icon('arrow') + '</button>';
    if (S.me.unpaid) h += '<button class="notice warn" data-a="go" data-p="bills">' + icon('bill') + '<span><b>มีบิลรอชำระ ' + S.me.unpaid.count + ' ใบ · ' + baht(S.me.unpaid.amount) + '</b><small>แตะเพื่อดู QR และแนบสลิป</small></span>' + icon('arrow') + '</button>';
    if (S.me.outForDelivery) h += '<button class="notice info" data-a="go" data-p="bills">' + icon('truck') + '<span><b>ออเดอร์กำลังนำส่ง</b><small>ได้รับของแล้ว กดยืนยันในหน้าบิลได้เลย</small></span>' + icon('arrow') + '</button>';
    if (S.me.friend === false && addFriendUrl()) h += '<button class="notice ok" data-a="addFriend">' + icon('bell') + '<span><b>เพิ่มเพื่อน LINE OA ของร้าน</b><small>เพื่อรับบิลยอดจริงและแจ้งเตือนในแชต</small></span>' + icon('arrow') + '</button>';
    h += hero();
    h += '<div class="section-heading"><h2>วันนี้ให้เราช่วยอะไรดี?</h2></div><div class="tiles">' +
      menuTile('catalog', 'สั่งของ', 'ดูราคา · เซ็ตคุ้ม', 'bag', true) + menuTile('reorder', 'สั่งเหมือนเดิม', 'จากออเดอร์ล่าสุด', 'repeat') + menuTile('bills', 'บิลของฉัน', 'ดูยอด · แจ้งชำระ', 'bill') +
      menuTile(S.me.canRefer ? 'invite' : 'card', S.me.canRefer ? 'ชวนเพื่อน' : 'บัตรสมาชิก', S.me.canRefer ? 'รับส่วนลดสะสม' : 'แสดง QR ที่ร้าน', S.me.canRefer ? 'invite' : 'card') +
      menuTile('wallet', 'ส่วนลดของฉัน', 'ส่วนลดสะสม · คูปอง', 'wallet') + menuTile('standing', 'สั่งประจำ', 'จัดการรายการประจำ', 'clock') + '</div>';
    h += '<button class="benefit-strip" data-a="go" data-p="wallet"><span class="benefit-icon">' + icon('coin') + '</span><span><small>ส่วนลดสะสมพร้อมใช้</small><b>' + baht(S.me.coinBal) + '</b></span><span class="benefit-end">' +
      (S.me.coinPending ? 'รออนุมัติ ' + baht(S.me.coinPending) + '<br>' : '') + (m.credit > 0 ? 'เครดิต ' + baht(m.credit) + '<br>' : '') + 'ดูสิทธิ์ของฉัน →</span></button>';
    h += couponStrip(S.me.coupon);
    h += staffLinks() + demoNote() + '</div>';
    render(h);
  }
  function staffLinks() {
    var h = '';
    if (S.me.staff) h += '<button class="btn blue block" data-a="go" data-p="admin">' + icon('shop') + ' เปิดหน้าหลังร้าน (' + esc(S.me.staff.label || S.me.staff.role) + ')</button>';
    if (S.me.partner) h += '<button class="btn block" data-a="go" data-p="partner">ยอดป้ายของฉัน (พาร์ทเนอร์)</button>';
    return h;
  }
  function pageRejected() { render(top('บัญชีนี้ใช้งานไม่ได้', '', false) + '<div class="wrap"><div class="alert bad">กรุณาติดต่อร้านในแชต LINE OA</div></div>'); }

  /* ---------- ลงทะเบียน / ผูกสมาชิก ---------- */
  function geoBox() {
    var g = S.ui.geo;
    return '<div class="geo-box"><button type="button" class="btn sm" data-a="geo">' + icon('pin') + (g ? ' ปักหมุดใหม่' : ' ปักหมุดตำแหน่งร้าน') + '</button><span class="hint">' + (g ? 'ปักหมุดแล้ว ✓ ช่วยให้จัดรอบส่งได้เร็วขึ้น' : 'ไม่บังคับ · กดตอนอยู่ที่ร้าน') + '</span></div>';
  }
  function pageRegister() {
    var pr = S.params, isSign = !!pr.src && !pr.ref, cfg = S.cat.cfg, planC = couponPlan(cfg, 'Consumer');
    var ty = S.ui.regType || (isSign ? 'Consumer' : 'FS'), src = pr.ref ? 'ref' : isSign ? 'sign' : 'self', of = offerFor('welcome', isSign ? 'Consumer' : ty, src);
    var banner = '', offer = of ? offerText(of) : planC.pcts[0] > 0 ? 'ลูกค้าใหม่รับส่วนลดบิลแรก ' + planC.pcts[0] + '%' + (planC.pcts[1] ? ' และบิลที่สอง ' + planC.pcts[1] + '%' : '') + ' สำหรับสินค้าร่วมรายการ' : '';
    if (of && offer) offer = 'ลูกค้าใหม่' + (ty === 'FS' && !isSign ? ' (ร้านอาหาร)' : '') + ' รับส่วนลด ' + offer;
    if (pr.ref) banner = '<div class="alert ok">คุณได้รับคำชวน ' + esc(offer || 'ลงทะเบียนแล้วสั่งได้เลย') + '</div>';
    if (isSign) banner = '<div class="alert ok">' + (offer ? esc(offer) + ' · ' : '') + 'รับของที่จุดรับ รอบ ' + esc(cfg.CONDO_TIME) + ' หรือให้ส่งถึงบ้านได้</div>';
    var h = top('ลงทะเบียน', 'ใช้เวลาไม่ถึง 1 นาที', S.history.length > 0) + '<div class="wrap">' + banner + '<form class="box form" data-form="register">' +
      '<div class="field"><label for="rg-name">' + (isSign ? 'ชื่อ' : 'ชื่อร้าน') + '</label><input id="rg-name" name="name" required maxlength="80" autocomplete="organization"></div>' +
      (isSign ? '<div class="field"><label for="rg-addr">ตึก / ห้อง</label><input id="rg-addr" name="address" maxlength="120" placeholder="เช่น ตึก A ห้อง 1208"></div>' :
        '<div class="field"><label for="rg-contact">ชื่อผู้ติดต่อ</label><input id="rg-contact" name="contact" maxlength="60" autocomplete="name"></div>' +
        '<div class="field"><label for="rg-type">ประเภท</label><select id="rg-type" name="type" data-chg="regType"><option value="FS"' + (ty === 'FS' ? ' selected' : '') + '>ร้านอาหาร / แม่ค้า / แคเทอริ่ง</option><option value="Consumer"' + (ty === 'Consumer' ? ' selected' : '') + '>บ้าน / ครัวเรือน</option></select></div>' +
        (ty === 'FS' ? tradeSelect('', 'rg-trade', 'trade') : '') +
        '<div class="field"><label for="rg-zone">ย่านที่ให้ส่ง</label>' + zoneSelect('zone', '', 'rg-zone') + '</div>' +
        '<div class="field"><label for="rg-addr">ที่อยู่จัดส่ง / จุดสังเกต</label><textarea id="rg-addr" name="address" rows="2" maxlength="200" autocomplete="street-address"></textarea></div>' + geoBox()) +
      '<div class="field"><label for="rg-phone">เบอร์โทร</label><input id="rg-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required maxlength="20" placeholder="0812345678"></div>' +
      '<label class="chk"><input type="checkbox" name="consent" required><span>ยินยอมให้ร้านเก็บชื่อ เบอร์ และที่อยู่ เพื่อจัดส่งและแจ้งบิล ขอดูหรือลบข้อมูลได้ <a href="privacy.html" target="_blank" rel="noopener">นโยบายข้อมูลส่วนบุคคล</a></span></label>' +
      '<button class="btn pri block" type="submit">ลงทะเบียน</button></form>' +
      (!pr.ref && !pr.src ? '<button class="btn block" data-a="go" data-p="link">ฉันเป็นลูกค้าเดิม (ผูกเลขสมาชิก)</button>' : '') + '</div>';
    render(h);
  }
  function pageLink() {
    if (S.me.member) return pageHome();
    var f = S.ui.linkFound;
    var h = top('ผูกเลขสมาชิก', 'สำหรับลูกค้าที่เคยซื้อกับร้าน', true) + '<div class="wrap">';
    if (!f) h += '<form class="box form" data-form="linkFind"><div>กรอกเบอร์ที่ให้ไว้กับร้าน ระบบจะหาเลขสมาชิกให้</div><div class="field"><label for="lk-phone">เบอร์โทร</label><input id="lk-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required value="' + esc(S.params.phone || '') + '"></div><button class="btn pri block" type="submit">ค้นหา</button></form>';
    else h += '<form class="box form" data-form="linkConfirm"><div class="alert ok">พบร้านของคุณ</div><div class="row"><span>ชื่อร้าน</span><span>' + esc(f.name) + '</span></div><div class="row"><span>เลขสมาชิก</span><span class="mono">' + esc(f.sno) + '</span></div>' +
      '<label class="chk"><input type="checkbox" name="consent" required><span>ยินยอมตาม <a href="privacy.html" target="_blank" rel="noopener">นโยบายข้อมูลส่วนบุคคล</a></span></label><button class="btn pri block" type="submit">ยืนยันว่าเป็นร้านของฉัน</button><button class="btn block" type="button" data-a="linkReset">ไม่ใช่ร้านของฉัน</button></form>';
    render(h + '</div>');
  }

  /* ---------- แคตตาล็อก ---------- */
  function stepper(kind, id, q) {
    var item = kind === 'p' ? prod(id) : S.cat.bundles.filter(function (b) { return b.id === id; })[0];
    var name = item ? item.name : id;
    if (!q) return '<button class="btn add-btn" data-a="qty" data-k="' + kind + '" data-p="' + esc(id) + '" data-d="1" aria-label="เพิ่ม ' + esc(name) + '"><span aria-hidden="true">＋</span> เพิ่ม</button>';
    return '<div class="step" role="group" aria-label="จำนวน ' + esc(name) + '"><button data-a="qty" data-k="' + kind + '" data-p="' + esc(id) + '" data-d="-1" aria-label="ลด ' + esc(name) + '">−</button><span aria-label="จำนวน ' + q + '">' + q + '</span><button data-a="qty" data-k="' + kind + '" data-p="' + esc(id) + '" data-d="1" aria-label="เพิ่ม ' + esc(name) + '">+</button></div>';
  }
  function tierText(p) { return p.tiers.map(function (t) { return '<span>' + t.min + '+ ' + esc(p.unit) + ' <b>' + baht(t.price) + '</b></span>'; }).join(''); }
  function pageCatalog() {
    var m = S.me.member, c = S.cart, f = S.params.cat || 'all', search = String(S.ui.search || '').trim().toLowerCase(), cats = catList(), results = 0;
    function matches(name, id) { return !search || (String(name) + ' ' + String(id || '')).toLowerCase().indexOf(search) >= 0; }
    var h = top('สั่งของ', 'เลือกวัตถุดิบ แล้วตรวจตะกร้าก่อนส่ง', true) + '<div class="wrap catalog-wrap">';
    h += '<div class="catalog-tools"><label class="search-box" for="catalog-search">' + icon('search') + '<input type="search" id="catalog-search" placeholder="ค้นหาสินค้า หรือรหัสสินค้า" aria-label="ค้นหาสินค้า หรือรหัสสินค้า" value="' + esc(S.ui.search || '') + '" autocomplete="off"></label><div class="chips" aria-label="หมวดสินค้า">' + [['all', 'ทั้งหมด'], ['set', 'เซ็ตคุ้ม']].concat(cats.map(function (k) { return [k, catLabel(k)]; })).map(function (x) {
      return '<button class="chip' + (f === x[0] ? ' on' : '') + '" data-a="cat" data-p="' + esc(x[0]) + '" aria-pressed="' + (f === x[0]) + '">' + x[1] + '</button>';
    }).join('') + '</div></div>';
    h += couponStrip(S.me.coupon);
    if (f === 'all' || f === 'set') {
      var mine = {}; (S.me.lastSkus || []).forEach(function (k) { mine[k] = 1; });
      function score(b) { var n = 0; b.items.forEach(function (it) { if (mine[it[0]]) n++; }); return (b['for'] === m.type ? 10 : 0) + (b['for'] ? 0 : 5) + n; }
      function soldOut(b) { return b.items.some(function (it) { var p = prod(it[0]); return !p || !p.inStock; }); } // สินค้าในเซ็ตหมด = ซ่อนเซ็ต (sync stock)
      var bs = S.cat.bundles.filter(function (b) { return b.active && !soldOut(b) && (matches(b.name, b.id) || b.items.some(function (it) { var p = prod(it[0]); return p && matches(p.name, p.sku); })); }).sort(function (a, b) { return score(b) - score(a); });
      if (bs.length) {
        results += bs.length;
        h += '<section class="bundle-section"><div class="section-heading"><h2>' + icon('set') + ' เซ็ตคุ้ม</h2><span class="badge">ร่วมโปร</span></div><p class="section-sub">จัดเป็นเซ็ต เลือกง่าย คุมงบได้</p><div class="bundle-grid">' + bs.map(function (b) {
          var normal = 0, names = [];
          b.items.forEach(function (it) { var p = prod(it[0]); if (p) { normal += unitPrice(p, it[1]) * it[1]; names.push(p.name.replace(/\s*\(ตัวอย่าง\)/, '') + ' ×' + it[1]); } });
          var forMe = b.items.some(function (it) { return mine[it[0]]; });
          return '<article class="bundle' + (forMe ? ' for-me' : '') + '">' + (b.img ? '<img class="bundle-photo" src="' + esc(imgUrl(b.img, 480)) + '" alt="" loading="lazy" decoding="async" data-fb="set">' : '') + '<div class="bundle-top"><span class="bundle-label">' + (forMe ? '★ แนะนำสำหรับคุณ' : b['for'] === 'FS' ? 'สำหรับร้านอาหาร' : 'สำหรับครอบครัว') + '</span>' + (b.img ? '' : icon('set')) + '</div><h3 class="nm">' + esc(b.name) + '</h3><div class="it">' + esc(names.join(' · ')) + '</div><div class="bundle-buy"><div><b class="price">' + baht(b.price) + '</b> <small>/ เซ็ต</small>' + (normal > b.price ? '<div class="saving"><s>' + baht(normal) + '</s> ประหยัด ' + baht(normal - b.price) + '</div>' : '') + '</div>' + stepper('b', b.id, c.bundles[b.id] || 0) + '</div></article>';
        }).join('') + '</div><p class="hint">ราคาเซ็ตคงที่ ไม่รวมส่วนลดราคาขั้นบันได</p></section>';
      }
    }
    var pom = S.cat.products.filter(function (p) { return p.pom; })[0];
    if (!search && pom && pom.inStock && (f === 'all' || f === pom.cat)) h += '<div class="monthly-pick">' + icon('leaf') + '<span><small>สินค้าแห่งเดือน</small><b>' + esc(pom.name) + '</b></span><strong>' + baht(pom.tiers[0].price) + '<small>/ ' + esc(pom.unit) + '</small></strong></div>';
    (f === 'all' ? cats : f === 'set' ? [] : [f]).forEach(function (cat) {
      var ps = S.cat.products.filter(function (p) { return p.cat === cat && matches(p.name, p.sku); });
      if (!ps.length) return;
      results += ps.length;
      h += '<section class="box product-section"><div class="section-heading"><h2>' + icon(cat) + ' ' + esc(catLabel(cat)) + '</h2><span class="hint">' + ps.length + ' รายการ</span></div>' + ps.map(function (p) {
        var q = c.lines[p.sku] || 0, nt = null;
        p.tiers.forEach(function (t) { if (!nt && t.min > q) nt = t; });
        var near = q > 0 && nt && nt.min - q <= 2;
        return '<article class="prod' + (p.inStock ? '' : ' oos') + (p.img ? ' has-img' : '') + '">' + thumb(p, 'product-photo', p.cat) + '<div class="product-info"><h3 class="nm">' + esc(p.name) + '</h3><div class="product-meta">' + esc(p.sku) + (p.promo ? ' <span class="badge">ร่วมโปร</span>' : '') + (p.inStock ? '' : ' <span class="badge r">หมดวันนี้</span>') + '</div></div><div class="product-buy"><div><b class="price">' + baht(unitPrice(p, q || 1)) + '</b><small> / ' + esc(p.unit) + '</small></div>' + (p.inStock ? stepper('p', p.sku, q) : '<span class="hint">เลือกสินค้าอื่นได้เลย</span>') + '</div><div class="tiers" aria-label="ราคาตามจำนวน">' + tierText(p) + '</div>' +
          (near ? '<div class="nudge"><span>เพิ่มอีก <b>' + (nt.min - q) + ' ' + esc(p.unit) + '</b> เหลือ ' + baht(nt.price) + '/' + esc(p.unit) + '</span><button data-a="toTier" data-p="' + esc(p.sku) + '" data-q="' + nt.min + '">เพิ่มเลย +</button></div>' : '') + '</article>';
      }).join('') + '</section>';
    });
    if (!results) h += '<div class="empty">' + icon('search') + '<b>ไม่พบสินค้าในหมวดนี้</b><span>ลองเปลี่ยนคำค้น หรือเลือกหมวดทั้งหมด</span></div>';
    var k = calcNow();
    h += '<p class="demo-note">ราคาจริงตามบิลหลังชั่งสินค้า</p></div><div class="foot"><div class="foot-inner"><div class="sum"><small>ยอดสินค้าโดยประมาณ</small><b class="num">' + baht(k.subtotal) + '</b><small>' + k.count + ' รายการ · ~' + k.kg + ' กก.</small></div><button class="btn pri" data-a="go" data-p="cart"' + (k.count ? '' : ' disabled') + '>' + icon('bag') + ' ดูตะกร้า' + (k.count ? ' (' + k.count + ')' : '') + '</button></div></div>';
    render(h);
  }

  /* ---------- ตะกร้า ---------- */
  function pageCart() {
    if (S.params.add) {
      S.params.add.split(',').forEach(function (x) { var t = x.split(':'); if (prod(t[0])) S.cart.lines[t[0]] = Math.max(1, parseInt(t[1], 10) || 1); });
      delete S.params.add; saveCart();
    }
    var m = S.me.member, c = S.cart, cfg = S.cat.cfg;
    var slots = String(cfg.SLOTS || '').split('|');
    if (!c.slot || slots.indexOf(c.slot) < 0) c.slot = slots[0];
    if (m.sourceKind === 'sign' && !c.modeSet) { c.mode = 'pickup'; c.modeSet = true; }
    if (c.needBy === undefined) c.needBy = m.needBy || '';
    if (c.evening && (!evOn() || (c.mode && c.mode !== 'deliver'))) c.evening = false;
    var k = calcNow();
    var h = top('ตะกร้า', '', true) + '<div class="wrap">';
    if (!k.count) { render(h + '<div class="empty">' + icon('bag') + '<b>ตะกร้ายังว่างอยู่</b><span>เลือกวัตถุดิบที่ต้องการ แล้วกลับมาตรวจรายการที่นี่</span></div><button class="btn pri block" data-a="go" data-p="catalog">เลือกสินค้า</button></div>'); return; }
    if (k.errors.length) h += '<div class="alert bad">' + esc(k.errors.join(' · ')) + '</div>';
    h += '<div class="section-heading"><h2>ตรวจรายการของคุณ</h2><button class="text-btn" data-a="go" data-p="catalog">+ เพิ่มสินค้า</button></div><div class="box cart-items">' +
      k.bundles.map(function (l) { return '<article class="cart-item"><div><h3>' + esc(l.name) + ' <span class="badge">เซ็ต</span></h3><small class="hint">' + baht(l.price) + ' / เซ็ต</small></div><strong class="num">' + baht(l.total) + '</strong>' + stepper('b', l.id, l.qty) + '</article>'; }).join('') +
      k.lines.map(function (l) { return '<article class="cart-item"><div><h3>' + esc(l.name) + (l.promo ? ' <span class="badge">ร่วมโปร</span>' : '') + '</h3><small class="hint">' + baht(l.price) + ' / ' + esc(l.unit) + '</small></div><strong class="num">' + baht(l.total) + '</strong>' + stepper('p', l.sku, l.qty) + '</article>'; }).join('') + '</div>';
    if (k.coinBal > 0) h += '<label class="box chk coin-toggle"><input type="checkbox" data-chg="useCoin"' + (c.useCoin ? ' checked' : '') + (k.coinMax <= 0 ? ' disabled' : '') + '><span><b>ใช้ส่วนลดสะสม</b><small>มี ' + baht(k.coinBal) + ' · ใช้ได้ ' + baht(Math.min(k.coinBal, k.coinMax)) + ' ในบิลนี้<br>' + (k.coinWhy ? esc(k.coinWhy) : 'สินค้าร่วมรายการและเซ็ตคุ้ม · สูงสุด ' + cfg.COIN_MAX_PCT + '% ของบิล') + '</small></span>' + icon('coin') + '</label>';
    h += '<section class="box order-summary"><h3>สรุปยอดประมาณ</h3><div class="row"><span>รวมสินค้า (' + k.count + ' รายการ)</span><span class="num">' + baht(k.subtotal) + '</span></div>' +
      (k.coupon ? '<div class="row disc"><span>ส่วนลดลูกค้าใหม่ บิลที่ ' + (k.couponStep + 1) + ' (' + (k.couponAmt ? baht(k.couponAmt) : k.couponPct + '%') + ')</span><span class="num">−' + baht(k.coupon) + '</span></div>' : '') +
      (k.coinUse ? '<div class="row disc"><span>ส่วนลดสะสม</span><span class="num">−' + baht(k.coinUse * cfg.COIN_VALUE) + '</span></div>' : '') +
      '<div class="row tot"><span>ยอดประมาณสุทธิ</span><strong class="price num">' + baht(k.net) + '</strong></div>' +
      (m.credit > 0 ? '<div class="hint">มีเครดิต ' + baht(m.credit) + ' ระบบหักให้ตอนออกบิลยอดจริง</div>' : '') +
      (k.couponWhy ? '<div class="hint">' + esc(k.couponWhy) + '</div>' : '') + '<p class="hint">ยอดจริงจะแจ้งในแชตหลังชั่งสินค้า · ประมาณ ' + k.kg + ' กก.</p></section>';
    var shopOk = cfg.PICKUP_SHOP !== false, w = waveNow(), ev = evCfg(), me = S.me.evening;
    h += '<div class="box"><h3>รับของ</h3>';
    if (m.sourceKind === 'sign') h += '<label class="chk"><input type="radio" name="mode" value="pickup" data-chg="mode"' + (c.mode === 'pickup' ? ' checked' : '') + '><span>รับที่จุดรับ รอบ ' + esc(cfg.CONDO_TIME) + ' (ไม่มีขั้นต่ำต่อคน)</span></label>';
    h += '<label class="chk"><input type="radio" name="mode" value="deliver" data-chg="mode"' + (k.mode === 'deliver' ? ' checked' : '') + '><span>ส่งถึงที่ (ส่งฟรีขั้นต่ำ ' + baht(cfg.MIN_ORDER) + ')</span></label>';
    if (shopOk) h += '<label class="chk"><input type="radio" name="mode" value="shop" data-chg="mode"' + (k.mode === 'shop' ? ' checked' : '') + '><span>รับเองที่ร้าน (ไม่มีขั้นต่ำ)</span></label>';
    if (k.mode === 'pickup') { var r = S.ui.round; if (r) { var after = r.total + k.subtotal; h += '<div class="alert ' + (after >= r.min ? 'ok' : 'warn') + '" style="margin-top:6px">ยอดรวมจุดรับวันนี้ ' + baht(after) + ' / ' + baht(r.min) + (after >= r.min ? ' · รอบออกแน่นอน' : ' · ขาดอีก ' + baht(r.min - after) + ' ถ้าไม่ครบ เลื่อนเป็นรอบพรุ่งนี้') + ' · ของรอที่จุดรับได้ ' + r.hold + ' นาที</div>'; } }
    else if (k.mode === 'shop') h += '<div class="hint">ร้านจะแจ้งในแชตเมื่อจัดของเสร็จ มารับได้ในเวลาทำการ</div>';
    else if (autoSlot()) {
      if (evOn()) { // เลือก รอบกลางวัน (ร้านจัดให้) / รอบเย็น 17:30–20:00 (โอนก่อน)
        var evDate = me.tonight && me.tonightLeft > 0 ? me.tonight : me.next, evLeft = evDate === me.tonight ? me.tonightLeft : me.nextLeft;
        if (c.evening && c.eveningDate && c.eveningDate !== me.tonight && c.eveningDate !== me.next) c.eveningDate = '';
        var pick = c.evening && c.eveningDate ? c.eveningDate : evDate;
        h += '<div class="slot-pick"><small class="hint">รอบส่ง</small><label class="chk"><input type="radio" name="when" value="day" data-chg="when"' + (c.evening ? '' : ' checked') + '><span><b>รอบกลางวัน</b> · ' + esc(w.slot) + ' ' + (w.date === todayStr() ? 'วันนี้' : 'พรุ่งนี้') + ' รถออกประมาณ ' + esc(w.depart) + '</span></label>' +
          '<label class="chk"><input type="radio" name="when" value="evening" data-chg="when"' + (c.evening ? ' checked' : '') + '><span><b>รอบเย็น ' + esc(ev.depart) + '–' + esc(ev.end) + '</b> · ' + esc(evDayText(evDate)) + (evLeft <= 3 ? ' (เหลือ ' + evLeft + ' คิว)' : '') + '<br><small class="hint">โอนก่อน ' + esc(ev.cutoff) + ' น. · ขั้นต่ำ ' + baht(ev.min) + ' · เหมาะกับมื้อเย็นที่บ้าน</small></span></label></div>';
        if (c.evening) {
          h += (me.tonight && me.tonightLeft > 0 && me.next ? '<div class="field"><label for="evdate">คืนที่ต้องการ</label><select id="evdate" data-chg="evDate"><option value="' + me.tonight + '"' + (pick === me.tonight ? ' selected' : '') + '>คืนนี้ (โอนก่อน ' + esc(ev.cutoff) + ')</option><option value="' + me.next + '"' + (pick === me.next ? ' selected' : '') + '>' + esc(evDayText(me.next)) + '</option></select></div>' : '') +
            '<div class="alert info">รอบเย็นต้องโอนตามยอดประมาณก่อน ' + esc(ev.cutoff) + ' น. ของวันส่ง · ยอดจริงต่างจากนี้ ร้านคืนเป็นเครดิตหรือแจ้งส่วนต่าง · ไม่ทันเวลา ระบบเลื่อนเป็นรอบเย็นคืนถัดไปให้</div>';
        }
      }
      if (!c.evening) h += '<div class="wave-box"><div><small>รอบส่งที่คาด (ร้านจัดรอบให้)</small><b>' + esc(w.slot) + ' ' + (w.date === todayStr() ? 'วันนี้' : 'พรุ่งนี้') + ' · รถออกประมาณ ' + esc(w.depart) + '</b></div><small class="hint">สั่งก่อน ' + esc(waves()[0].cutoff) + ' น. ได้รอบเช้าวันถัดไป · ร้านจะแจ้งเวลาถึงโดยประมาณตอนรถออก</small></div>' +
        '<div class="field"><label for="needby">ต้องได้ของก่อนกี่โมง (บอกร้านไว้ ไม่ใช่การจอง)</label>' + needBySelect(c.needBy, 'needby') + '</div>';
    }
    else h += '<div class="field"><label for="slot">เลือกรอบจัดส่ง</label><select id="slot" data-chg="slot">' + slots.map(function (s) { return '<option' + (c.slot === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select>' +
      (cfg.ORDER_CUTOFF && nowHM() >= cfg.ORDER_CUTOFF ? '<div class="hint">สั่งหลัง ' + esc(cfg.ORDER_CUTOFF) + ' น. ร้านจะส่งให้พรุ่งนี้ตามรอบที่เลือก</div>' : '') + '</div>';
    h += '</div>';
    if (k.belowMin) {
      var sug = S.cat.products.filter(function (p) { return p.promo && p.inStock; }).slice(0, 3);
      h += '<div class="alert warn">' + (k.evening ? 'รอบเย็นสั่งขั้นต่ำ ' + baht(k.min) + ' (ตอนนี้ ' + baht(k.subtotal) + ') เพิ่มของอีกนิด หรือเลือกรอบกลางวัน' : k.tooSmall ? 'ยอด ' + baht(k.subtotal) + ' ต่ำกว่าขั้นต่ำสำหรับส่ง ' + baht(k.poolMin) + ' เพิ่มของอีกนิด หรือเลือก "รับเองที่ร้าน"' : 'ยอด ' + baht(k.subtotal) + ' ยังไม่ถึงขั้นต่ำส่งฟรี ' + baht(k.min) + ' สั่งได้แบบ <b>ส่งรวมรอบ</b>: ร้านจะส่งให้เมื่อมีรอบผ่านย่านของคุณ (วันนี้หรือพรุ่งนี้) · อยากได้ตามรอบแน่นอน เพิ่มของให้ถึง ' + baht(k.min)) + '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">' +
        sug.map(function (p) { return '<button class="btn sm" data-a="qty" data-k="p" data-p="' + esc(p.sku) + '" data-d="1">+ ' + esc(p.name.replace(/\s*\(ตัวอย่าง\)/, '')) + '</button>'; }).join('') + (shopOk ? '<button class="btn sm" data-a="setMode" data-p="shop">รับเองที่ร้าน</button>' : '') + '</div></div>';
    } else if (k.mode === 'deliver' && k.min < cfg.MIN_ORDER) h += '<div class="alert ok">สิทธิ์ลูกค้าใหม่ในโซนส่งประจำ: ขั้นต่ำส่งฟรีเหลือ ' + baht(k.min) + '</div>';
    h += '</div><div class="foot"><div class="foot-inner"><div class="sum"><b class="num">' + baht(k.net) + '</b><small>ยอดประมาณ' + (k.evening ? ' · รอบเย็น โอนก่อน ' + esc(ev.cutoff) : k.pool ? ' · ส่งรวมรอบ' : k.mode === 'shop' ? ' · รับเองที่ร้าน' : '') + '</small></div><button class="btn pri" data-a="submitOrder"' + (k.errors.length || k.tooSmall ? ' disabled' : '') + '>' + (k.evening ? 'ยืนยัน แล้วไปจ่าย' : 'ยืนยันส่งออเดอร์') + '</button></div></div>';
    render(h);
    if (m.sourceKind === 'sign' && !S.ui.roundLoaded) { S.ui.roundLoaded = true; api('roundInfo', {}, { quiet: true }).then(function (r) { S.ui.round = r.round; if (S.page === 'cart') pageCart(); }).catch(function () { }); }
  }
  function doReorder() {
    var lb = S.me.lastBasket;
    if (!lb) { toast('ยังไม่มีออเดอร์ก่อนหน้า เลือกสินค้าได้เลย'); S.page = 'catalog'; return pageCatalog(); }
    S.cart.lines = {}; S.cart.bundles = {};
    var skipped = 0;
    Object.keys(lb.lines).forEach(function (sku) { var p = prod(sku); if (p && p.inStock) S.cart.lines[sku] = lb.lines[sku]; else skipped++; });
    Object.keys(lb.bundles).forEach(function (id) { if (S.cat.bundles.some(function (b) { return b.id === id && b.active; })) S.cart.bundles[id] = lb.bundles[id]; else skipped++; });
    saveCart(); toast(skipped ? 'ใส่ตะกร้าแล้ว (' + skipped + ' รายการหมดวันนี้)' : 'ใส่ตะกร้าเหมือนครั้งก่อนแล้ว แก้จำนวนได้');
    S.page = 'cart'; pageCart();
  }
  function pageDone() {
    var pr = S.params, tmr = pr.dd && pr.dd > todayStr(), line = '', ev = evCfg();
    if (pr.evening === '1') {
      return render(top('ส่งออเดอร์แล้ว', '', false) + '<div class="wrap"><section class="box success-panel"><span class="success-icon">' + icon('clock') + '</span><h2>รอบเย็น' + esc(evDayText(pr.dd)) + '</h2><p>ออเดอร์ <b class="mono">' + esc(pr.id) + '</b> · ส่ง ' + esc(ev ? ev.depart + '–' + ev.end : '') + ' น.</p>' +
        (pr.payBy ? '<p class="alert warn">โอนตามยอดประมาณก่อน <b>' + esc(pr.payBy.slice(11, 16)) + ' น.' + (pr.payBy.slice(0, 10) === todayStr() ? ' วันนี้' : ' ' + esc(thDate(pr.payBy))) + '</b> เพื่อยืนยันคิว</p>' : '') + '</section>' +
        '<button class="btn pri block" data-a="go" data-p="bill" data-id="' + esc(pr.id) + '">' + icon('bill') + ' จ่ายเลย · สแกน QR</button><button class="btn block" data-a="closeApp">กลับไปที่แชต LINE</button></div>');
    }
    if (pr.mode === 'shop') line = 'รับเองที่ร้าน · ร้านจะแจ้งในแชตเมื่อจัดของเสร็จ';
    else if (pr.mode === 'pickup') line = 'รับที่จุดรับ รอบ ' + esc(S.cat.cfg.CONDO_TIME);
    else if (pr.pool === '1') line = 'ส่งรวมรอบ: ร้านจะส่งเมื่อมีรอบผ่านย่านของคุณ (วันนี้หรือพรุ่งนี้) และแจ้งเวลาในแชต';
    else if (pr.slot) line = (tmr ? 'จัดส่งวัน' + dayName(pr.dd) + 'ที่ ' + thDate(pr.dd) + ' ' : 'จัดส่งวันนี้ ') + esc(pr.slot) + (pr.depart ? ' (รถออกประมาณ ' + esc(pr.depart) + ')' : '');
    else if (tmr) line = 'จัดส่งวัน' + dayName(pr.dd) + 'ที่ ' + thDate(pr.dd);
    render(top('ส่งออเดอร์แล้ว', '', false) + '<div class="wrap"><section class="box success-panel"><span class="success-icon">' + icon('check') + '</span><h2>ร้านได้รับออเดอร์แล้วค่ะ</h2><p>ออเดอร์ <b class="mono">' + esc(pr.id) + '</b></p>' +
      (line ? '<p class="alert info">' + line + '</p>' : '') +
      '<p class="hint">ร้านจะตรวจรายการและชั่งสินค้า<br>แล้วส่งบิลยอดจริงเข้าแชต LINE OA</p></section>' + orderProgress('new') + '<button class="btn pri block" data-a="go" data-p="bills">ติดตามบิลของฉัน</button><button class="btn block" data-a="closeApp">กลับไปที่แชต LINE</button></div>');
  }

  /* ---------- บิล ---------- */
  function statusPill(s) { return s === 'new' ? '<span class="pill new">รอร้านตรวจ</span>' : s === 'approved' ? '<span class="pill appr">กำลังจัดของ</span>' : s === 'billed' ? '<span class="pill bill">รอชำระ</span>' : s === 'paid' ? '<span class="pill paid">ชำระแล้ว</span>' : '<span class="pill red">ยกเลิก</span>'; }
  function payPill(p) { return !p ? '' : p.status === 'review' ? '<span class="pill appr">รอร้านตรวจยอดโอน</span>' : p.status === 'partial' ? '<span class="pill new">ยังขาด ' + baht(p.balance) + '</span>' : p.status === 'over' ? '<span class="pill paid">โอนเกิน → เครดิต</span>' : ''; }
  function pageBills() {
    loadPage('bills', 'myOrders', {}, function (r) {
      var due = r.orders.filter(function (o) { return o.status === 'billed' && o.pay && o.pay.remain > 0; });
      var h = top('บิลของฉัน', 'ติดตามออเดอร์และการชำระเงิน', true) + '<div class="wrap">' + (due.length ? '<div class="alert warn">มี ' + due.length + ' บิลรอชำระ รวม ' + baht(due.reduce(function (s, o) { return s + o.pay.remain; }, 0)) + ' · แตะบิลเพื่อสแกน QR และแนบสลิป</div>' : '');
      h += r.orders.length ? r.orders.map(function (o) {
        var amt = o.status === 'billed' ? o.pay.remain : (o.actual || o.est);
        return '<button class="box bill-card" data-a="go" data-p="bill" data-id="' + esc(o.id) + '"><div class="bill-card-head"><b class="mono">' + esc(o.id) + '</b>' + statusPill(o.status) + '</div><div class="hint">' + esc(o.created) + (o.txn ? ' · ' + esc(o.txn) : '') + (o.delivery === 'out' ? ' · <b>กำลังนำส่ง</b>' : '') + (o.evening ? ' · รอบเย็น' + esc(evDayText(o.deliverDate)) : '') + '</div>' + (o.status === 'billed' ? payPill(o.pay) : '') + (o.evening && o.payBy && /new|approved/.test(o.status) && o.pay.remain > 0 ? '<span class="pill new">โอนก่อน ' + esc(o.payBy.slice(11, 16)) + ' น.</span>' : '') +
          '<div class="bill-card-foot"><div><small>' + (o.status === 'billed' ? (o.pay.status === 'review' ? 'แจ้งโอนแล้ว รอร้านตรวจ' : 'ยอดที่ต้องโอน') : o.txn ? 'ยอดตามบิล' : 'ยอดประมาณ') + '</small><strong class="price">' + baht(o.status === 'billed' && o.pay.status === 'review' ? o.pay.received : amt) + '</strong></div><span class="bill-link">' + (o.status === 'billed' && o.pay.remain > 0 ? 'ชำระเงิน' : 'ดูรายละเอียด') + ' →</span></div></button>';
      }).join('') : '<div class="empty">' + icon('bill') + '<b>ยังไม่มีออเดอร์</b><span>เมื่อสั่งสินค้าแล้ว ติดตามบิลได้ที่นี่</span></div><button class="btn pri block" data-a="go" data-p="catalog">เริ่มเลือกสินค้า</button>';
      render(h + '</div>');
    });
  }
  function payRows(o) {
    var p = o.pay, h = '<section class="box pay-ledger"><h3>การชำระเงิน</h3><div class="row"><span>' + (o.txn ? 'ยอดตามบิล' : 'ยอดประมาณ (จ่ายก่อน)') + '</span><span class="num">' + baht(p.bill) + '</span></div>';
    if (p.credit > 0) h += '<div class="row disc"><span>หักเครดิต (โอนเกินครั้งก่อน)</span><span class="num">−' + baht(p.credit) + '</span></div>';
    if (p.confirmed > 0) h += '<div class="row disc"><span>ร้านยืนยันรับแล้ว</span><span class="num">−' + baht(p.confirmed) + '</span></div>';
    if (p.pending > 0) h += '<div class="row"><span>แจ้งโอนแล้ว รอร้านตรวจ</span><span class="num">−' + baht(p.pending) + '</span></div>';
    if (o.status === 'billed' || (o.evening && /new|approved/.test(o.status))) h += '<div class="row tot"><span>' + (p.remain > 0 ? 'ยังต้องโอนอีก' : 'ยอดครบแล้ว') + '</span><strong class="price num">' + baht(p.remain) + '</strong></div>';
    if (p.over > 0) h += '<div class="alert ok">โอนเกิน ' + baht(p.over) + ' ' + (S.cat.cfg.OVERPAY_MODE === 'refund' ? 'ร้านจะติดต่อคืนเงิน' : 'เก็บเป็นเครดิต หักบิลถัดไปให้อัตโนมัติ') + '</div>';
    if ((p.payments || []).length) h += '<details class="pay-history"' + (p.payments.some(function (x) { return x.status === 'rejected'; }) ? ' open' : '') + '><summary>ประวัติการแจ้งโอน (' + p.payments.length + ')</summary>' + p.payments.map(function (x) {
      var st = x.status === 'confirmed' ? '<span class="pill paid">ยืนยันแล้ว</span>' : x.status === 'rejected' ? '<span class="pill red">ร้านตรวจไม่พบยอด</span>' : '<span class="pill appr">รอตรวจ</span>';
      return '<div class="row"><span>' + esc(x.at.slice(5, 16).replace('-', '/')) + (x.method === 'cash' ? ' · เงินสด' : '') + (x.hasSlip ? ' · มีสลิป' : '') + (x.status === 'rejected' && x.note ? '<br><small class="hint">' + esc(x.note) + '</small>' : '') + '</span><span>' + baht(x.amount) + ' ' + st + '</span></div>';
    }).join('') + '</details>';
    return h + '</section>';
  }
  function pageBill() {
    var id = S.params.id;
    if (!id) return go('bills', {}, true);
    loadPage('bill:' + id, 'order', { id: id }, function (r) {
      var o = r.order, p = o.pay, cfg = S.cat.cfg, pre = o.evening && o.payBy && /new|approved/.test(o.status);
      var h = top('บิล ' + o.id, o.created, true) + '<div class="wrap">' + orderProgress(o.status, o.delivery);
      if (o.evening) h += '<div class="alert ' + (pre && p.remain > 0 ? 'warn' : 'info') + '">รอบเย็น' + esc(evDayText(o.deliverDate)) + (evCfg() ? ' ส่ง ' + esc(evCfg().depart + '–' + evCfg().end) + ' น.' : '') + (pre && p.remain > 0 ? ' · <b>โอนก่อน ' + esc(o.payBy.slice(11, 16)) + ' น.' + (o.payBy.slice(0, 10) === todayStr() ? ' วันนี้' : ' ' + esc(thDate(o.payBy))) + '</b> ตามยอดประมาณ · ยอดจริงต่าง ร้านคืนเป็นเครดิตหรือแจ้งส่วนต่าง' : '') + (o.eveningMoved ? ' · เลื่อนมาแล้ว ' + o.eveningMoved + ' ครั้ง' : '') + '</div>';
      if (o.delivery === 'out') h += '<button class="btn pri block" data-a="received" data-id="' + esc(o.id) + '">' + icon('check') + ' ได้รับของแล้ว</button>';
      h += '<div class="box">' + o.bundles.map(function (l) { return '<div class="row"><span>' + esc(l.name) + ' ×' + l.qty + '</span><span>' + baht(l.price * l.qty) + '</span></div>'; }).join('') +
        o.items.map(function (l) { return '<div class="row"><span>' + esc(l.name) + ' ×' + l.qty + ' @' + fmt(l.price) + '</span><span>' + baht(l.price * l.qty) + '</span></div>'; }).join('') +
        (o.coupon ? '<div class="row disc"><span>ส่วนลดลูกค้าใหม่' + (o.couponStep ? ' บิลที่ ' + o.couponStep : '') + '</span><span>−' + baht(o.coupon) + '</span></div>' : '') + (o.coinUse ? '<div class="row disc"><span>ส่วนลดสะสม</span><span>−' + baht(o.coinUse * cfg.COIN_VALUE) + '</span></div>' : '') +
        '<div class="row"><span>ยอดประมาณ</span><span>' + baht(o.est) + '</span></div>' + (o.txn ? '<div class="row"><span>Transaction No.</span><span class="mono">' + esc(o.txn) + '</span></div><div class="row tot"><span>ยอดตามบิล (หลังชั่ง)</span><span>' + baht(o.actual) + '</span></div>' : '') +
        (o.mode === 'pickup' ? '<div class="hint">รับที่จุด ' + esc(o.pickup) + ' รอบ ' + esc(cfg.CONDO_TIME) + '</div>' : o.mode === 'shop' ? '<div class="hint">รับเองที่ร้าน</div>' : '<div class="hint">รอบส่ง: ' + esc(o.slot) + (o.deliverDate && o.deliverDate !== o.date ? ' · ' + thDate(o.deliverDate) : '') + (o.eta && o.delivery === 'out' ? ' · ถึงประมาณ ' + esc(o.eta) + ' น.' : '') + (o.needBy ? ' · ต้องได้ก่อน ' + esc(o.needBy) : '') + (o.pool && !o.delivery ? ' · <b>ส่งรวมรอบ</b> (รอรอบผ่านย่านของคุณ)' : '') + '</div>') + '</div>';
      if ((o.status === 'new' || o.status === 'approved') && !pre) h += '<div class="alert info">ร้านยังไม่เปิดบิล ยอดจริงจะส่งเข้าแชตหลังชั่งของ</div>';
      if (o.status === 'billed' || o.status === 'paid' || (pre && (p.received > 0 || p.remain > 0))) h += payRows(o);
      if (o.status === 'paid') h += '<div class="alert ok">ชำระครบแล้ว ' + esc(o.paidAt) + ' ขอบคุณค่ะ</div>';
      if ((o.status === 'billed' || pre) && p.remain > 0) {
        if (o.promptpay) h += '<div class="box qr"><div class="code">' + qrSvg(o.promptpay.payload) + '</div><b>สแกนจ่าย PromptPay · ' + baht(o.promptpay.amount) + '</b>' + (o.promptpay.demo ? '<div class="alert warn">QR ตัวอย่าง (ร้านยังไม่ได้ตั้งบัญชีรับเงิน)</div>' : '<div class="hint">ใส่ยอดไว้แล้ว · บันทึกภาพหน้าจอแล้วสแกนในแอปธนาคารได้</div>') + '</div>';
        var auto = cfg.SLIP_VERIFY && cfg.SLIP_VERIFY !== 'off', sl = S.ui.slip && S.ui.slip.id === o.id ? S.ui.slip : null;
        h += '<form class="box form" data-form="notifyPaid" data-id="' + esc(o.id) + '"><h3>แจ้งโอนแล้ว</h3>' +
          '<div class="slip-box">' + (sl && sl.preview ? '<img src="' + sl.preview + '" alt="สลิปที่แนบ">' : '<span class="slip-ph">' + icon('slip') + '</span>') +
          '<div><b>' + (sl ? (sl.reading ? 'กำลังอ่านสลิป...' : sl.qr ? 'อ่าน QR บนสลิปแล้ว ✓' + (sl.bank ? ' (' + esc(sl.bank) + ')' : '') : 'แนบสลิปแล้ว') : 'แนบสลิป (แนะนำ)') + '</b><small class="hint">' + (sl && !sl.reading && !sl.qr ? 'อ่าน QR ไม่ได้ ไม่เป็นไร ร้านตรวจจากรูปให้' : auto ? 'แนบสลิปแล้ว ระบบอ่านยอดให้อัตโนมัติ' : 'ร้านตรวจได้เร็วขึ้น') + '</small>' +
          '<label class="btn sm"><input type="file" accept="image/*" data-chg="slip" data-id="' + esc(o.id) + '" hidden>' + icon('camera') + (sl ? ' เปลี่ยนรูป' : ' เลือกรูปสลิป') + '</label></div></div>' +
          (auto && sl && sl.qr && !sl.manual ? '<input type="hidden" name="amount" value="">' : '<div class="field"><label for="pd-amt">ยอดที่โอน (บาท)</label><input id="pd-amt" name="amount" inputmode="decimal" value="' + p.remain + '"><small class="hint">ถ้าโอนไม่เท่ายอดนี้ แก้ตัวเลขได้ ระบบจะรวมทุกครั้งที่แจ้งโอนให้</small></div>') +
          '<button class="btn pri block" type="submit"' + (sl && sl.reading ? ' disabled' : '') + '>แจ้งโอนแล้ว</button></form>';
      } else if ((o.status === 'billed' || pre) && p.pending > 0) h += '<div class="alert info">ได้รับแจ้งโอนครบแล้ว ร้านกำลังตรวจยอด จะแจ้งในแชตเมื่อยืนยัน</div>';
      render(h + '</div>');
    });
  }

  /* ---------- ชวนเพื่อน / Coin ---------- */
  function pageInvite() {
    loadPage('invite', 'invite', {}, function (r) {
      var cfg = S.cat.cfg, h = top('ชวนเพื่อน', '', true) + '<div class="wrap">';
      if (!r.eligible) { render(h + '<div class="alert info">ตอนนี้สิทธิ์ชวนเพื่อนเปิดเฉพาะลูกค้ากลุ่มนำร่องที่ร้านเชิญ</div></div>'); return; }
      var full = r.monthCount >= r.limit;
      h += '<div class="box qr">' + (full ? '<div class="alert warn">เดือนนี้ชวนครบ ' + r.limit + ' ร้านแล้ว</div>' : (r.link ? '<div class="code">' + qrSvg(r.link) + '</div>' : '<div class="alert warn">ร้านยังไม่ได้ตั้งค่าลิงก์ชวน</div>')) +
        '<b>QR ชวนเพื่อนของคุณ</b>' + (r.link ? '<div class="copy"><input readonly value="' + esc(r.link) + '" aria-label="ลิงก์ชวน"><button class="btn sm" data-a="copy" data-t="' + esc(r.link) + '">คัดลอก</button></div>' : '') +
        (r.link && canShare() ? '<button class="btn sm pri" data-a="share" data-t="' + esc(r.link) + '">ส่งให้เพื่อนใน LINE</button>' : '') + '</div>';
      var pC = couponPlan(cfg, 'Consumer'), pF = couponPlan(cfg, 'FS'), oF = offerFor('welcome', 'FS', 'ref'), oC = offerFor('welcome', 'Consumer', 'ref'), rF = offerFor('referrer', 'FS'), rC = offerFor('referrer', 'Consumer');
      function ladder(p) { return p.pcts[0] > 0 ? p.pcts.map(function (x, i) { return 'บิลที่ ' + (i + 1) + ' ลด ' + x + '%'; }).join(' · ') + ' (สินค้าร่วมรายการ ภายใน ' + p.days + ' วัน)' : 'ตามที่ร้านประกาศ'; }
      var mine = (cfg.OFFERS || []).length ? (rF ? 'เพื่อนร้านอาหาร: ' + rewardText(rF) : '') + (rF && rC ? ' · ' : '') + (rC ? 'เพื่อนลูกค้าบ้าน: ' + rewardText(rC) : '') : rewardText(null);
      h += '<div class="box"><h3>กติกา</h3><div class="row"><span>เพื่อนที่เป็นร้านอาหาร</span><span style="text-align:right">' + esc(oF ? offerText(oF) + ' · ภายใน ' + oF.days + ' วัน' : ladder(pF)) + '</span></div><div class="row"><span>เพื่อนที่เป็นลูกค้าบ้าน</span><span style="text-align:right">' + esc(oC ? offerText(oC) + ' · ภายใน ' + oC.days + ' วัน' : ladder(pC)) + '</span></div>' +
        '<div class="row"><span>คุณได้</span><span style="text-align:right">' + esc(mine || rewardText(null)) + ' · สูงสุด ' + baht(cfg.COIN_CAP) + '/เดือน · เป็นส่วนลดสะสมใช้ลดบิลถัดไปของคุณ (ร้านอนุมัติหลังเพื่อนชำระเงิน)</span></div>' +
        '<div class="hint">นับเฉพาะคนที่ไม่เคยซื้อมาก่อน และต้องลงทะเบียนผ่าน QR นี้ก่อนบิลแรก</div></div>';
      h += '<div class="kv"><div><small>ส่วนลดใช้ได้</small><b>' + baht(r.bal) + '</b></div><div><small>รออนุมัติ</small><b>' + baht(r.pending) + '</b></div><div><small>ชวนเดือนนี้</small><b>' + r.monthCount + '/' + r.limit + '</b></div></div>';
      h += '<div class="box"><h3>เพื่อนที่ชวน</h3>' + (r.refs.length ? r.refs.map(function (x) { return '<div class="row"><span>' + esc(x.name) + '</span><span>' + (x.approved ? '<span class="pill paid">สมาชิกแล้ว</span>' : x.flagged ? '<span class="pill red">ร้านกำลังตรวจ</span>' : '<span class="pill new">รอร้านตรวจ</span>') + '</span></div>'; }).join('') : '<div class="hint">ยังไม่มี</div>') + '</div>';
      render(h + '</div>');
    });
  }
  function canShare() { try { return liff.isApiAvailable('shareTargetPicker'); } catch (e) { return false; } }
  function pageWallet() {
    loadPage('wallet', 'wallet', {}, function (r) {
      var m = r.member || S.me.member, cfg = S.cat.cfg;
      var h = top('ส่วนลดของฉัน', 'ส่วนลดสะสม · คูปอง · เครดิต', true) + '<div class="wrap"><div class="kv"><div><small>ส่วนลดสะสมใช้ได้</small><b>' + baht(r.bal) + '</b></div><div><small>รออนุมัติ</small><b>' + baht(r.pending) + '</b></div><div><small>เครดิตเงิน</small><b>' + baht(r.credit || 0) + '</b></div></div>';
      if (r.soon && r.soonDate) h += '<div class="alert warn">ส่วนลดสะสม ' + baht(r.soon) + ' จะหมดอายุ ' + esc(thDate(r.soonDate)) + ' ใช้ก่อนนะคะ</div>';
      h += couponStrip(S.me.coupon) + '<div class="hint">ส่วนลดสะสมได้จากการชวนเพื่อน ใช้ลดสินค้าร่วมรายการและเซ็ตคุ้มในบิลถัดไป (1 หน่วย = 1 บาท) · แต้มสมาชิกบริษัทยังสะสมที่หน้าร้านตามปกติ</div>';

      if ((r.credits || []).length) h += '<div class="box"><h3>เครดิตเงิน</h3><div class="hint">ได้จากการโอนเกิน ระบบหักให้อัตโนมัติในบิลถัดไป</div>' + r.credits.map(function (c) { return '<div class="row"><span>' + esc({ overpay: 'โอนเกิน', use: 'หักในบิล', refund: 'ร้านคืนเงิน', restore: 'คืนเครดิต' }[c.kind] || c.kind) + ' ' + esc(c.order) + '<br><small class="hint">' + esc(thDate(c.at)) + '</small></span><span class="num">' + (c.amount > 0 ? '+' : '−') + baht(Math.abs(c.amount)) + '</span></div>'; }).join('') + '</div>';
      h += '<div class="box"><h3>ประวัติส่วนลดสะสม</h3>' + (r.coins.length ? r.coins.map(function (c) {
        var label = c.status === 'used' ? 'ใช้กับ ' + c.order : c.status === 'cancelled' ? 'ยกเลิก (' + c.order + ')' : 'จากบิล ' + c.order + (c.from ? ' ของ ' + c.from : '');
        var sub = c.status === 'pending' ? 'รอร้านอนุมัติ' : c.status === 'available' ? 'หมดอายุ ' + thDate(c.expires) : thDate(c.earned);
        return '<div class="row"><span>' + esc(label) + '<br><small class="hint">' + esc(sub) + '</small></span><span class="num">' + (c.status === 'used' ? '−' : '+') + fmt(c.amount) + '</span></div>';
      }).join('') : '<div class="hint">ยังไม่มี</div>') + '</div>';
      render(h + '</div>');
    });
  }

  /* ---------- สั่งประจำ ---------- */
  var DAYS = [[1, 'จ'], [2, 'อ'], [3, 'พ'], [4, 'พฤ'], [5, 'ศ'], [6, 'ส'], [0, 'อา']];
  function pageStanding() {
    loadPage('standing', 'standing', {}, function (r) {
      var st = r.standing, cfg = S.cat.cfg, slots = String(cfg.SLOTS).split('|'), h = top('สั่งประจำ', 'ร้านทักถามทุกเย็น กดยืนยันปุ่มเดียว', true) + '<div class="wrap">';
      if (S.params.confirm && st && !st.paused) h += '<div class="box confirm-box"><h3>ยืนยันรับวัน' + dayName(S.params.confirm) + 'ที่ ' + esc(thDate(S.params.confirm)) + '</h3>' + itemsHtml(st.items) + '<div class="hint">รอบ ' + esc(st.slot) + '</div><button class="btn pri block" data-a="standingConfirm" style="margin-top:8px">ยืนยัน ส่งตามรายการนี้</button></div>';
      if (st) {
        var d = st.diag || {};
        h += '<div class="box"><div class="section-heading"><h3>รายการประจำ</h3>' + (st.paused ? '<span class="pill red">หยุดชั่วคราว</span>' : '<span class="pill paid">เปิดอยู่</span>') + '</div>' + itemsHtml(st.items) +
          '<div class="row"><span>วัน</span><span>' + esc(daysText(st.daysArr)) + '</span></div><div class="row"><span>รอบ</span><span>' + esc(st.slot) + '</span></div>' +
          (st.lastConfirmed ? '<div class="hint">ยืนยันล่าสุดสำหรับวันที่ ' + esc(thDate(st.lastConfirmed)) + '</div>' : '') + '</div>';
        h += d.willAsk ? '<div class="alert info">วันนี้ 18:00 ร้านจะส่งข้อความถามว่ารับวัน' + dayName(d.tomorrow) + 'ไหม กดปุ่มในข้อความเพื่อยืนยัน</div>'
          : '<div class="alert warn">คืนนี้ร้านจะยังไม่ถาม เพราะ ' + esc((d.why || []).join(' · ')) + (d.friend === false && addFriendUrl() ? ' <button class="text-btn" data-a="addFriend">เพิ่มเพื่อนตอนนี้</button>' : '') + '</div>';
        h += '<button class="btn block" data-a="standingPause">' + (st.paused ? 'เปิดสั่งประจำอีกครั้ง' : 'หยุดชั่วคราว (ร้านปิด / วันหยุด)') + '</button>';
      }
      var lb = S.me.lastBasket, items = st ? st.items : (lb ? lb.lines : null), useDays = st ? st.daysArr : [1, 2, 3, 4, 5, 6];
      h += '<form class="box form" data-form="standingSave"><h3>' + (st ? 'แก้รายการประจำ' : 'ตั้งสั่งประจำ') + '</h3>';
      if (items && Object.keys(items).length) {
        h += (st ? '' : '<div class="hint">เริ่มจากรายการในออเดอร์ล่าสุด (ไม่รวมเซ็ต) แก้จำนวนได้</div>') + Object.keys(items).map(function (sku) { var p = prod(sku); return '<div class="row qty-row"><span>' + esc(p ? p.name : sku) + '</span><input type="number" min="0" max="999" inputmode="numeric" name="q_' + esc(sku) + '" value="' + items[sku] + '" aria-label="จำนวน ' + esc(p ? p.name : sku) + '"></div>'; }).join('') +
          (lb && st ? '<button type="button" class="text-btn" data-a="standingFromLast">ใช้รายการจากออเดอร์ล่าสุดแทน</button>' : '') +
          '<fieldset class="day-pick"><legend>วันที่ต้องการรับของ</legend>' + DAYS.map(function (d) { return '<label><input type="checkbox" name="d" value="' + d[0] + '"' + (useDays.indexOf(d[0]) >= 0 ? ' checked' : '') + '><span>' + d[1] + '</span></label>'; }).join('') + '</fieldset>' +
          '<div class="field"><label for="st-slot">รอบส่ง</label><select id="st-slot" name="slot">' + slots.map(function (s) { return '<option' + (st && st.slot === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></div>' +
          '<button class="btn pri block" type="submit">บันทึกสั่งประจำ</button>';
      } else h += '<div class="hint">สั่งของผ่านหน้านี้อย่างน้อย 1 ครั้งก่อน แล้วกลับมาตั้งจากออเดอร์ล่าสุด</div><button type="button" class="btn block" data-a="go" data-p="catalog">ไปสั่งของ</button>';
      render(h + '</form></div>');
    });
  }
  function daysText(arr) { if (!arr || !arr.length) return '-'; if (arr.length === 7) return 'ทุกวัน'; return DAYS.filter(function (d) { return arr.indexOf(d[0]) >= 0; }).map(function (d) { return d[1]; }).join(' '); }
  function itemsHtml(items) { return Object.keys(items || {}).map(function (sku) { var p = prod(sku); return '<div class="row"><span>' + esc(p ? p.name : sku) + '</span><span>×' + items[sku] + '</span></div>'; }).join(''); }

  /* ---------- บัตรสมาชิก + ข้อมูลจัดส่ง ---------- */
  function pageCard() {
    var m = S.me.member, cfg = S.cat.cfg;
    var h = top('บัตรสมาชิก', m.sno ? 'สมาชิก ' + m.sno : 'รอร้านยืนยันเลขสมาชิก', true) + '<div class="wrap"><div class="box qr"><div class="code">' + qrSvg(m.sno || m.id) + '</div><b>' + esc(m.name) + '</b><span class="mono">' + esc(m.sno || 'รอเลขสมาชิก') + '</span></div>' +
      '<div class="alert ' + (cfg.COUNT_COUNTER ? 'ok' : 'info') + '">' + (cfg.COUNT_COUNTER ? 'แสดงบัตรนี้ที่แคชเชียร์ทุกครั้งที่ซื้อหน้าร้าน' : 'ส่วนลดสะสมและสิทธิ์นับจากออเดอร์ที่สั่งผ่าน LINE') + '</div>';
    h += '<div class="tiles member-shortcuts">' + menuTile('wallet', 'ส่วนลดของฉัน', 'ส่วนลดสะสม · คูปอง', 'wallet') + menuTile('standing', 'สั่งประจำ', 'จัดการตะกร้าประจำ', 'clock') + menuTile('bills', 'บิลของฉัน', 'ดูประวัติออเดอร์', 'bill') + '</div>';
    if (S.ui.geo === undefined && m.lat) S.ui.geo = { lat: m.lat, lng: m.lng, saved: true };
    h += '<form class="box form" data-form="profileSave"><h3>' + icon('truck') + ' ข้อมูลจัดส่ง</h3>' +
      (m.sourceKind !== 'sign' ? '<div class="field"><label for="pf-zone">ย่านที่ให้ส่ง</label>' + zoneSelect('zone', m.zone, 'pf-zone') + '</div>' : '') +
      '<div class="field"><label for="pf-addr">ที่อยู่ / จุดสังเกต</label><textarea id="pf-addr" name="address" rows="2" maxlength="200">' + esc(m.address) + '</textarea></div>' +
      '<div class="field"><label for="pf-note">จุดจอดรถ / คนรับของ / ช่วงเวลาที่รับได้</label><input id="pf-note" name="deliveryNote" maxlength="120" value="' + esc(m.deliveryNote || '') + '" placeholder="เช่น จอดหน้าซอย โทรหาพี่แดง รับได้ 07–11 น."></div>' +
      '<div class="field"><label for="pf-needby">ปกติต้องได้ของก่อนกี่โมง</label>' + needBySelect(m.needBy || '', 'pf-needby').replace('data-chg="needBy"', 'name="needBy"') + '</div>' +
      (m.type !== 'Consumer' ? tradeSelect(m.trade || '', 'pf-trade', 'trade') : '') +
      (m.sourceKind !== 'sign' ? geoBox() : '') + '<button class="btn block" type="submit">บันทึกข้อมูลจัดส่ง</button></form>';
    var sh = S.me.shared || {};
    if (sh.owner) {
      var iv = S.ui.memberInvite;
      h += '<div class="box"><h3>' + icon('invite') + ' LINE ของคนในร้าน</h3><div class="hint">ให้สามี/ภรรยา/ลูกน้องสั่งของจาก LINE ของเขาเอง โดยใช้เลขสมาชิก ส่วนลด และประวัติเดียวกัน บิลจะส่งไปที่คนสั่ง · เพิ่มได้สูงสุด 5 บัญชี</div>' +
        (sh.links || []).map(function (l) { return '<div class="row"><span>' + esc(l.name) + ' <small class="hint">' + (l.status === 'active' ? 'ใช้งานอยู่' : 'รอกดยืนยัน (ถึง ' + esc((l.expires || '').slice(0, 16)) + ')') + '</small></span><span>' + (l.status === 'open' && l.link ? '<button class="btn sm" data-a="copy" data-t="' + esc(l.link) + '">คัดลอกลิงก์</button> ' : '') + '<button class="btn sm bad" data-a="memberLinkRemove" data-code="' + esc(l.code) + '">ถอด</button></span></div>'; }).join('') +
        '<form class="form" data-form="memberInvite" style="margin-top:8px"><div class="acts"><div class="field"><label for="mi-name">ชื่อเรียก</label><input id="mi-name" name="name" maxlength="40" placeholder="เช่น พี่แดง"></div><button class="btn sm pri" type="submit">สร้างลิงก์เชิญ</button></div></form>' +
        (iv ? '<div class="invite-out"><div class="code">' + qrSvg(iv.link) + '</div><div><b>ส่งลิงก์นี้ให้เขาเปิดใน LINE</b><small class="hint">ใช้ได้ครั้งเดียว ภายใน 3 วัน</small><div class="copy"><input readonly value="' + esc(iv.link) + '"><button class="btn sm" type="button" data-a="copy" data-t="' + esc(iv.link) + '">คัดลอก</button></div>' + (canShare() ? '<button class="btn sm pri" type="button" data-a="share" data-t="' + esc(iv.link) + '" data-msg="' + esc('ใช้บัญชีร้านใน LINE ร่วมกัน กดลิงก์นี้แล้วกดยืนยัน: ' + iv.link) + '">ส่งใน LINE</button>' : '') + '</div></div>' : '') + '</div>';
    } else if (sh.owner === false) h += '<div class="box"><h3>บัญชีร่วม</h3><div class="hint">LINE นี้ใช้บัญชีร้านร่วมกับ ' + esc(sh.ownerName || 'เจ้าของร้าน') + ' ในชื่อ "' + esc(sh.me || '') + '" บิลที่คุณสั่งจะส่งมาที่แชตนี้</div></div>';
    h += '<div class="box"><h3>ข้อมูลส่วนบุคคลของฉัน</h3><div class="hint">ร้านเก็บชื่อ เบอร์ และที่อยู่เพื่อจัดส่งและแจ้งบิลเท่านั้น · ขอแก้ไขได้ที่ "ข้อมูลจัดส่ง" ด้านบน · ขอลบข้อมูลได้ที่ปุ่มด้านล่าง (ประวัติการซื้อขายเก็บตามกฎหมายบัญชี แต่ไม่มีชื่อ/เบอร์) · <a href="privacy.html" target="_blank" rel="noopener">นโยบายข้อมูลส่วนบุคคล</a></div>' +
      (m.privacyAt ? '<div class="alert info" style="margin-top:8px">ส่งคำขอลบข้อมูลแล้วเมื่อ ' + esc(thDate(m.privacyAt)) + ' ' + esc(m.privacyAt.slice(11, 16)) + ' ร้านจะดำเนินการและแจ้งใน ' + esc(cfg.PRIVACY_CONTACT || 'แชต') + '</div>' : '<button class="btn block" data-a="privacyRequest" style="margin-top:8px">ขอลบข้อมูลของฉัน</button>') + '</div>';
    if (isStaff() && cfg.TEST_MODE) h += '<div class="box test-box"><h3>เครื่องมือทดสอบ (เห็นเฉพาะพนักงาน)</h3><div class="hint">ลบข้อมูลสมาชิกของบัญชี LINE นี้ เพื่อทดลองลงทะเบียนใหม่ เช่น ลองเป็นลูกค้าที่ถูกชวน</div><button class="btn bad block" data-a="resetMe" style="margin-top:8px">ลบข้อมูลสมาชิกของฉัน</button></div>';
    render(h + staffLinks() + '</div>');
  }

  /* ---------- เข้าใช้บัญชีร้านร่วมกัน (LINE ที่ 2, 3 ของร้านเดียวกัน) ---------- */
  function pageJoin() {
    var code = S.params.code || '';
    if (!code) return pageHome();
    if (S.me.member) return render(top('ใช้บัญชีร่วมกัน', '', false) + '<div class="wrap"><div class="alert info">LINE นี้เป็นสมาชิกอยู่แล้ว (' + esc(S.me.member.name) + ') จึงเข้าร่วมบัญชีอื่นไม่ได้</div><button class="btn block" data-a="home">กลับหน้าแรก</button></div>');
    var info = S.data['join:' + code];
    if (!info) { render(top('ใช้บัญชีร่วมกัน', '', false) + '<div class="wrap"><div class="empty">กำลังโหลด...</div></div>'); return api('memberLinkInfo', { code: code }).then(function (r) { S.data['join:' + code] = r; if (S.page === 'join') pageJoin(); }).catch(fail); }
    if (!info.valid) return render(top('ใช้บัญชีร่วมกัน', '', false) + '<div class="wrap"><div class="alert bad">' + esc(info.reason) + '</div><button class="btn block" data-a="home">กลับหน้าแรก</button></div>');
    render(top('ใช้บัญชีร่วมกัน', '', false) + '<div class="wrap"><section class="box success-panel"><span class="success-icon">' + icon('invite') + '</span><h2>เข้าใช้บัญชีของ<br>' + esc(info.memberName) + '</h2><p>ในชื่อ "' + esc(info.name) + '"</p><p class="hint">สั่งของ ดูบิล และใช้ส่วนลดของร้านได้จาก LINE นี้ บิลที่คุณสั่งจะส่งมาที่แชตนี้</p></section>' +
      '<form class="box form" data-form="joinConfirm"><label class="chk"><input type="checkbox" name="consent" required><span>ยินยอมตาม <a href="privacy.html" target="_blank" rel="noopener">นโยบายข้อมูลส่วนบุคคล</a></span></label><button class="btn pri block" type="submit">ยืนยันเข้าร่วม</button></form></div>');
  }

  /* ---------- พาร์ทเนอร์ ---------- */
  function pagePartnerJoin() {
    render(top('ผูกบัญชีพาร์ทเนอร์', '', false) + '<div class="wrap"><div class="box">ผูกบัญชี LINE นี้กับป้าย <b>' + esc(S.params.pid || '') + '</b> เพื่อดูยอดและส่วนแบ่งของคุณ</div><button class="btn pri block" data-a="partnerJoin">ผูกบัญชี</button></div>');
  }
  function pagePartner() {
    loadPage('partner', 'partnerDash', {}, function (r) {
      var d = r.dash;
      render(top(d.name, 'พาร์ทเนอร์ ' + d.id, true) + '<div class="wrap"><div class="kv"><div><small>สแกน</small><b>' + fmt(d.scans) + '</b></div><div><small>ลูกค้าจากป้าย</small><b>' + fmt(d.members) + '</b></div><div><small>ออเดอร์เดือนนี้</small><b>' + fmt(d.orders) + '</b></div></div>' +
        '<div class="box"><div class="row"><span>ยอดขายจากป้ายเดือนนี้</span><span>' + baht(d.sales) + '</span></div><div class="row tot"><span>ส่วนแบ่ง ' + d.pct + '%</span><span>' + baht(d.share) + '</span></div><div class="hint">' + (d.payout === 'coin' ? 'จ่ายเป็นส่วนลดสะสม' : 'โอนเงินรายเดือน ขั้นต่ำ ' + baht(d.minPayout) + ' (ไม่ถึงยกไปเดือนหน้า)') + '</div></div>' +
        '<div class="box"><h3>รอบจุดรับวันนี้ ' + esc(d.round.time) + '</h3><div class="row"><span>ออเดอร์รอรับ</span><span>' + d.round.orders + '</span></div><div class="row"><span>ยอดรวม</span><span>' + baht(d.round.total) + ' / ' + baht(d.round.min) + '</span></div><div class="hint">ลูกค้ามารับภายใน ' + d.round.hold + ' นาที</div></div>' +
        '<div class="box"><h3>ออเดอร์ล่าสุดจากป้าย</h3>' + (d.recent.length ? d.recent.map(function (x) { return '<div class="row"><span>' + esc(x.who) + ' · ' + esc(x.order) + '</span><span>' + baht(x.sales) + ' → ' + baht(x.share) + '</span></div>'; }).join('') : '<div class="hint">ออเดอร์ที่ร้านเปิดบิลแล้วจะขึ้นที่นี่</div>') + '</div></div>');
    });
  }

  /* ---------- พนักงาน: เข้าร่วมทีม ---------- */
  function pageStaffJoin() {
    if (S.me.staff && !S.params.inv) { S.page = 'admin'; return pageAdmin(); }
    if (S.params.inv) {
      var info = S.data['inv:' + S.params.inv];
      if (!info) { render(top('เข้าร่วมทีมร้าน', '', false) + '<div class="wrap"><div class="empty">กำลังโหลด...</div></div>'); return api('staffInviteInfo', { inv: S.params.inv }).then(function (r) { S.data['inv:' + S.params.inv] = r; if (S.page === 'staffjoin') pageStaffJoin(); }).catch(fail); }
      if (!info.valid) return render(top('เข้าร่วมทีมร้าน', '', false) + '<div class="wrap"><div class="alert bad">' + esc(info.reason) + '</div><div class="hint">ขอลิงก์เชิญใหม่จากผู้จัดการร้าน</div><button class="btn block" data-a="home">กลับหน้าแรก</button></div>');
      return render(top('เข้าร่วมทีมร้าน', '', false) + '<div class="wrap"><section class="box success-panel"><span class="success-icon">' + icon('invite') + '</span><h2>คุณได้รับเชิญเป็น<br>' + esc(info.label) + '</h2>' + (info.name ? '<p>สำหรับ ' + esc(info.name) + '</p>' : '') + '<p class="hint">เชิญโดย ' + esc(info.by) + ' · ลิงก์ใช้ได้ถึง ' + esc(info.expires.slice(0, 16)) + '</p></section>' +
        (S.me.staff ? '<div class="alert info">บัญชีนี้เป็น ' + esc(S.me.staff.label) + ' อยู่แล้ว ถ้ากดยืนยัน สิทธิ์จะเปลี่ยนเป็น ' + esc(info.label) + '</div>' : '') +
        '<button class="btn pri block" data-a="acceptInvite">ยืนยันเข้าร่วมทีม</button></div>');
    }
    render(top('ตั้งผู้จัดการคนแรก', '', true) + '<div class="wrap"><form class="box form" data-form="staffJoin"><div>ใส่รหัสตั้งระบบจากชีต Config แถว SETUP_CODE</div><div class="field"><label for="sj-code">รหัส</label><input id="sj-code" name="code" inputmode="numeric" required autocomplete="off"></div><button class="btn pri block" type="submit">ยืนยัน</button><div class="hint">รหัสนี้ใช้ได้เฉพาะตอนร้านยังไม่มีผู้จัดการ · พนักงานคนอื่นให้ผู้จัดการส่ง "ลิงก์เชิญ" จากหน้าหลังร้าน แท็บทีมงาน</div></form></div>');
  }

  /* ---------- หน้าหลังร้าน: โหลด admin.js เมื่อจำเป็นเท่านั้น ---------- */
  var adminLoading = null;
  function loadAdmin() {
    if (window.PKAdmin) return Promise.resolve(window.PKAdmin);
    if (!adminLoading) adminLoading = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = 'admin.js?v=' + APP_VERSION; s.async = true;
      s.onload = function () { window.PKAdmin ? res(window.PKAdmin) : rej(new Error('admin.js')); };
      s.onerror = function () { adminLoading = null; rej(netErr('ADMINJS')); };
      document.head.appendChild(s);
    });
    return adminLoading;
  }
  function pageAdmin() {
    if (!S.me.staff) { S.page = 'staffjoin'; return pageStaffJoin(); }
    if (window.PKAdmin) return window.PKAdmin.show();
    render(top('หน้าหลังร้าน', '', false) + '<div class="wrap wide"><div class="empty">กำลังโหลด...</div></div>');
    loadAdmin().then(function (A) { if (S.page === 'admin') A.show(); }).catch(fail);
  }

  /* ---------- เหตุการณ์ ---------- */
  var ACT = {
    reload: function () { location.reload(); },
    retry: function () { show(); },
    back: back,
    home: function () { go('home', {}); },
    go: function (el) { var p = {}; if (el.dataset.id) p.id = el.dataset.id; go(el.dataset.p, p); },
    cat: function (el) { S.params.cat = el.dataset.p; pageCatalog(); },
    qty: function (el) { var box = el.dataset.k === 'b' ? S.cart.bundles : S.cart.lines; var id = el.dataset.p; box[id] = Math.max(0, (box[id] || 0) + Number(el.dataset.d)); if (!box[id]) delete box[id]; saveCart(); show(); },
    toTier: function (el) { S.cart.lines[el.dataset.p] = Number(el.dataset.q); saveCart(); show(); },
    addFriend: function () { var u = addFriendUrl(); if (u) openUrl(u, false); },
    closeApp: function () { try { if (liff.isInClient()) { liff.closeWindow(); return; } } catch (e) { } go('home', {}); },
    copy: function (el) { copyText(el.dataset.t); },
    share: function (el) {
      liff.shareTargetPicker([{ type: 'text', text: el.dataset.msg || ('ร้านเปิดสั่งของใน LINE แล้ว ลงทะเบียนผ่านลิงก์นี้รับส่วนลดลูกค้าใหม่: ' + el.dataset.t) }]).then(function (r) { if (r) toast('ส่งแล้ว'); }).catch(function (e) { toast('ส่งไม่ได้: ' + e.message); });
    },
    linkReset: function () { S.ui.linkFound = null; pageLink(); },
    geo: function () {
      if (!navigator.geolocation) { toast('อุปกรณ์นี้ปักหมุดไม่ได้ พิมพ์จุดสังเกตแทนได้'); return; }
      busy(true, 'กำลังหาตำแหน่ง...');
      navigator.geolocation.getCurrentPosition(function (p) {
        busy(false); S.ui.geo = { lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 };
        var gb = app.querySelector('.geo-box'); if (gb) gb.outerHTML = geoBox(); toast('ปักหมุดแล้ว');
      }, function () { busy(false); toast('ใช้ตำแหน่งไม่ได้ (ยังไม่อนุญาต) พิมพ์จุดสังเกตแทนได้', 4000); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
    },
    submitOrder: function () {
      var evx = !!(S.cart.evening && evOn() && S.cart.mode === 'deliver');
      run('กำลังส่งออเดอร์...', api('submitOrder', { lines: S.cart.lines, bundles: S.cart.bundles, useCoin: !!S.cart.useCoin, mode: S.cart.mode, slot: S.cart.slot, needBy: evx ? undefined : S.cart.needBy || '', evening: evx, eveningDate: evx ? S.cart.eveningDate || '' : '' }), function (r) {
        S.cart.lines = {}; S.cart.bundles = {}; S.cart.useCoin = false; S.cart.evening = false; S.cart.eveningDate = ''; saveCart();
        go('done', { id: r.orderId, dd: r.deliverDate || '', slot: r.slot || '', depart: r.depart || '', mode: r.mode || '', pool: r.pool ? '1' : '', evening: r.evening ? '1' : '', payBy: r.payBy || '' });
        refreshMe().catch(function () { }); // อัปเดตข้อมูลของฉันเบื้องหลัง ไม่ต้องรอ
      });
    },
    setMode: function (el) { S.cart.mode = el.dataset.p; S.cart.modeSet = true; saveCart(); pageCart(); },
    memberLinkRemove: function (el) {
      if (!el.dataset.sure) { el.dataset.sure = '1'; el.textContent = 'ยืนยันถอด'; return; }
      run('กำลังถอด...', api('memberLinkRemove', { code: el.dataset.code }), function () { toast('ถอดแล้ว'); return refreshMe().then(pageCard); });
    },
    privacyRequest: function (el) {
      if (!el.dataset.sure) { el.dataset.sure = '1'; el.textContent = 'กดอีกครั้งเพื่อยืนยันขอลบข้อมูล'; return; }
      run('กำลังส่งคำขอ...', api('privacyRequest', { kind: 'delete' }), function () { toast('ร้านได้รับคำขอแล้ว จะดำเนินการและแจ้งให้ทราบ', 4500); return refreshMe().then(pageCard); });
    },
    received: function (el) { run('กำลังบันทึก...', api('confirmReceived', { id: el.dataset.id }), function () { toast('ขอบคุณที่ยืนยันค่ะ'); return refreshMe().then(pageBill); }); },
    resetMe: function (el) {
      if (!el.dataset.sure) { el.dataset.sure = '1'; el.textContent = 'กดอีกครั้งเพื่อยืนยัน'; return; }
      run('กำลังลบ...', api('resetMe'), function () {
        S.cart = { lines: {}, bundles: {}, useCoin: false, mode: 'deliver', slot: '' }; saveCart(); S.ui = {};
        return refreshMe().then(function () { toast('ลบแล้ว ลงทะเบียนใหม่ได้'); S.history = []; go('home', {}, true); });
      });
    },
    standingPause: function () { run('กำลังบันทึก...', api('standingPause'), function (r) { S.data.standing = { standing: r.standing }; pageStanding(); }); },
    standingFromLast: function () { var lb = S.me.lastBasket; if (!lb) return; var st = S.data.standing && S.data.standing.standing; if (st) { st.items = Object.assign({}, lb.lines); pageStanding(); } },
    standingConfirm: function () {
      run('กำลังยืนยัน...', api('standingConfirm', { date: S.params.confirm }), function (r) { toast(r.already ? 'ยืนยันวันที่ ' + thDate(r.date) + ' ไว้แล้ว' : 'ยืนยันแล้ว ออเดอร์ ' + r.orderId, 4000); delete S.params.confirm; return refreshMe().then(pageStanding); });
    },
    partnerJoin: function () { run('กำลังผูกบัญชี...', api('partnerJoin', { pid: S.params.pid, code: S.params.jc || S.params.code }), function () { return refreshMe().then(function () { go('partner', {}); }); }); },
    acceptInvite: function () { run('กำลังเข้าร่วมทีม...', api('staffJoin', { inv: S.params.inv }), function (r) { return refreshMe().then(function () { toast('เข้าร่วมทีมแล้ว: ' + r.label); S.history = []; go('admin', {}, true); }); }); }
  };
  function refreshMe() { return api('me').then(function (r) { S.me = r; loadCart(); saveBoot(); }); }
  var FORMS = {
    register: function (f) {
      var fd = new FormData(f), g = S.ui.geo || {};
      run('กำลังลงทะเบียน...', api('register', { name: fd.get('name'), contact: fd.get('contact') || '', type: fd.get('type') || 'FS', trade: fd.get('trade') || '', address: fd.get('address') || '', phone: fd.get('phone'), zone: fd.get('zone') || '',
        lat: g.lat || '', lng: g.lng || '', consent: !!fd.get('consent'), ref: S.params.ref || '', src: S.params.ref ? '' : (S.params.src || '') }), function (r) {
        return refreshMe().then(function () { toast(r.flagged ? 'ลงทะเบียนแล้ว ร้านจะตรวจข้อมูลก่อนให้สิทธิ์ลูกค้าใหม่' : 'ลงทะเบียนเรียบร้อย'); S.history = []; go(r.member.sourceKind === 'ref' ? 'catalog' : 'home', r.member.sourceKind === 'ref' ? { cat: 'set' } : {}, true); });
      }).then(function (r) { if (!r && S.lastErr && S.lastErr.code === 'LINK') { S.ui.linkFound = null; go('link', { phone: fd.get('phone') }); } });
    },
    linkFind: function (f) { var phone = new FormData(f).get('phone'); run('กำลังค้นหา...', api('linkFind', { phone: phone }), function (r) { S.ui.linkFound = Object.assign({ phone: phone }, r.found); pageLink(); }); },
    linkConfirm: function (f) {
      var lf = S.ui.linkFound;
      run('กำลังผูกบัญชี...', api('linkConfirm', { id: lf.id, phone: lf.phone, consent: !!new FormData(f).get('consent') }), function () { S.ui.linkFound = null; return refreshMe().then(function () { toast('ผูกบัญชีเรียบร้อย'); S.history = []; go('home', {}, true); }); });
    },
    notifyPaid: function (f) {
      var id = f.dataset.id, sl = S.ui.slip && S.ui.slip.id === id ? S.ui.slip : null, amt = new FormData(f).get('amount');
      if (!sl && !(Number(String(amt).replace(/,/g, '')) > 0)) { toast('กรุณาใส่ยอดที่โอน หรือแนบสลิป'); return; }
      var call = api('notifyPaid', { id: id, amount: String(amt || '').replace(/,/g, ''), slipRef: sl && sl.qr ? sl.qr : '', slipImage: sl ? sl.data : '' }).catch(function (e) {
        if (e.code !== 'NEEDAMT' || !sl) throw e; // ตรวจสลิปอัตโนมัติไม่ได้ → เปิดช่องให้พิมพ์ยอดเอง
        sl.manual = true; busy(false); pageBill(); toast(e.message, 5000); return null;
      });
      run('กำลังแจ้งร้าน...', call, function (r) {
        if (!r) return;
        S.ui.slip = null;
        toast(r.paid ? 'ชำระครบแล้ว ขอบคุณค่ะ' : r.autoConfirmed ? 'ตรวจสลิปแล้ว ยอดเข้าแล้วค่ะ' : r.dup ? 'แจ้งรายการนี้ไว้แล้ว' : 'แจ้งร้านแล้ว ร้านจะยืนยันในแชต', 4000);
        return refreshMe().then(pageBill);
      });
    },
    standingSave: function (f) {
      var fd = new FormData(f), items = {}, days = fd.getAll('d').map(Number);
      Array.prototype.forEach.call(f.querySelectorAll('input[name^="q_"]'), function (i) { var q = parseInt(i.value, 10); if (q > 0) items[i.name.slice(2)] = q; });
      if (!days.length) { toast('เลือกวันที่ต้องการรับของอย่างน้อย 1 วัน'); return; }
      run('กำลังบันทึก...', api('standingSave', { items: items, days: days, slot: fd.get('slot') }), function (r) { toast('บันทึกสั่งประจำแล้ว'); S.data.standing = { standing: r.standing }; pageStanding(); });
    },
    profileSave: function (f) {
      var fd = new FormData(f), g = S.ui.geo || {}, data = { address: fd.get('address') || '', deliveryNote: fd.get('deliveryNote') || '', needBy: fd.get('needBy') || '' };
      if (fd.get('zone') !== null) data.zone = fd.get('zone') || '';
      if (fd.get('trade') !== null) data.trade = fd.get('trade') || '';
      if (g.lat && !g.saved) { data.lat = g.lat; data.lng = g.lng; }
      run('กำลังบันทึก...', api('profileSave', data), function () { toast('บันทึกข้อมูลจัดส่งแล้ว'); S.ui.geo = undefined; return refreshMe().then(pageCard); });
    },
    memberInvite: function (f) { run('กำลังสร้างลิงก์...', api('memberInvite', { name: new FormData(f).get('name') || '' }), function (r) { S.ui.memberInvite = r; return refreshMe().then(pageCard); }); },
    joinConfirm: function (f) {
      run('กำลังเข้าร่วม...', api('memberLinkJoin', { code: S.params.code, consent: !!new FormData(f).get('consent') }), function () { return refreshMe().then(function () { toast('เข้าร่วมแล้ว สั่งของได้เลย'); S.history = []; go('home', {}, true); }); });
    },
    staffJoin: function (f) { run('กำลังตรวจรหัส...', api('staffJoin', { code: new FormData(f).get('code') }), function () { return refreshMe().then(function () { toast('ตั้งเป็นผู้จัดการแล้ว'); go('admin', {}, true); }); }); }
  };
  /* แนบสลิป: ย่อรูป + อ่าน QR (โหลดตัวอ่านเมื่อใช้ครั้งแรก) */
  var slipLib = null;
  function loadSlipLib() {
    if (window.PKSlip) return Promise.resolve(window.PKSlip);
    if (!slipLib) slipLib = new Promise(function (res, rej) { var s = document.createElement('script'); s.src = 'slip.js?v=' + APP_VERSION; s.onload = function () { res(window.PKSlip); }; s.onerror = function () { slipLib = null; rej(new Error('slip')); }; document.head.appendChild(s); });
    return slipLib;
  }
  function pickSlip(input) {
    var file = input.files && input.files[0], id = input.dataset.id; if (!file) return;
    S.ui.slip = { id: id, reading: true }; pageBill();
    loadSlipLib().then(function (L) {
      return L.readFile(file).then(function (img) {
        var data = L.compress(img, 1280, 0.78);
        return L.scan(img).then(function (txt) { var p = L.parseSlip(txt); return { data: data, qr: p && p.isSlip ? p.ref : '', bank: p && p.bank }; }, function () { return { data: data, qr: '' }; });
      });
    }).then(function (r) { S.ui.slip = { id: id, preview: r.data, data: r.data, qr: r.qr, bank: r.bank }; if (S.page === 'bill') pageBill(); })
      .catch(function () { S.ui.slip = null; toast('เปิดรูปไม่ได้ ลองเลือกรูปใหม่'); if (S.page === 'bill') pageBill(); });
  }

  document.addEventListener('input', function (e) {
    if (e.target.id !== 'catalog-search' || e.isComposing) return;
    S.ui.search = e.target.value; pageCatalog();
  });
  document.addEventListener('compositionend', function (e) { if (e.target.id === 'catalog-search') { S.ui.search = e.target.value; pageCatalog(); } });
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-a]');
    if (!el || el.disabled) return;
    var fn = ACT[el.dataset.a];
    if (!fn) return;
    e.preventDefault();
    fn(el, e);
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-form]');
    if (!f) return;
    e.preventDefault();
    var fn = FORMS[f.dataset.form];
    if (fn) fn(f);
  });
  document.addEventListener('change', function (e) {
    var t = e.target, c = t.dataset.chg;
    if (!c) return;
    if (c === 'useCoin') { S.cart.useCoin = t.checked; saveCart(); pageCart(); }
    else if (c === 'mode') { S.cart.mode = t.value; S.cart.modeSet = true; saveCart(); pageCart(); }
    else if (c === 'slot') { S.cart.slot = t.value; saveCart(); }
    else if (c === 'needBy') { S.cart.needBy = t.value; saveCart(); }
    else if (c === 'when') { S.cart.evening = t.value === 'evening'; saveCart(); pageCart(); }
    else if (c === 'evDate') { S.cart.eveningDate = t.value; saveCart(); }
    else if (c === 'regType') { S.ui.regType = t.value; var kept = {}; Array.prototype.forEach.call(t.form.elements, function (el) { if (el.name) kept[el.name] = el.value; }); pageRegister(); Array.prototype.forEach.call(app.querySelectorAll('form[data-form=register] [name]'), function (el) { if (kept[el.name] !== undefined && el.type !== 'checkbox') el.value = kept[el.name]; }); }
    else if (c === 'slip') pickSlip(t);
    else if (window.PKAdmin && window.PKAdmin.change) window.PKAdmin.change(t, c);
  });
  /* รูปสินค้าโหลดไม่ได้ → ใช้ไอคอนแทน */
  document.addEventListener('error', function (e) {
    var t = e.target; if (!t || t.tagName !== 'IMG' || !t.dataset.fb) return;
    var d = document.createElement('div'); d.className = 'product-symbol'; d.innerHTML = icon(t.dataset.fb); t.replaceWith(d);
  }, true);

  /* ---------- เริ่มต้น: เปิดเร็วด้วยข้อมูลล่าสุดในเครื่อง แล้วค่อยอัปเดต ---------- */
  var BOOT_KEY = 'pk2_boot';
  function saveBoot() { if (S.cat && S.me) store(BOOT_KEY, { v: APP_VERSION, uid: S.me.userId, cat: S.cat, me: S.me, at: Date.now() }); }
  function validCat(c) { return c && c.cfg && Array.isArray(c.products) && Array.isArray(c.bundles); }
  function validMe(m) { return m && typeof m.userId === 'string'; }
  function fatal(msg, e) {
    render('<div class="wrap"><section class="box empty-state">' + icon('alert') + '<h2>' + esc(msg) + '</h2><p class="hint">ลองปิดหน้านี้แล้วเปิดใหม่จากเมนูใน LINE</p>' +
      (e ? '<details class="tech-detail"><summary>รายละเอียดสำหรับร้าน</summary><small>' + esc([e.code, e.kind, e.message, e.detail].filter(Boolean).join(' · ')) + '</small></details>' : '') +
      '<button class="btn pri block" data-a="reload">ลองใหม่</button></section></div>');
  }
  function loadInit() {
    return api('init').then(function (r) { return r; }, function (e) {
      if (e.code === 'INPUT' && /init/.test(String(e.message) + String(e.detail))) return Promise.all([api('catalog'), api('me')]).then(function (x) { return { catalog: x[0], me: x[1] }; }); // หลังบ้านรุ่นเก่า
      throw e;
    });
  }
  function boot() {
    if (!CFG.LIFF_ID || CFG.LIFF_ID.indexOf('ใส่') === 0) return fatal('ยังไม่ได้ใส่ LIFF_ID ในไฟล์ config.js');
    if (!CFG.API_URL || CFG.API_URL.indexOf('https://') !== 0) return fatal('ยังไม่ได้ใส่ API_URL ในไฟล์ config.js');
    if (!window.liff) { // โหลด LINE SDK ไม่ทัน/สัญญาณหลุด → ลองโหลดใหม่อีกครั้งก่อนแจ้ง
      if (boot.retried) return fatal('โหลด LINE ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่');
      boot.retried = true;
      var sdk = document.createElement('script'); sdk.charset = 'utf-8'; sdk.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js?r=' + Date.now();
      sdk.onload = function () { boot(); }; sdk.onerror = function () { fatal('โหลด LINE ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่'); };
      document.head.appendChild(sdk); return;
    }
    var cached = store(BOOT_KEY), fresh = cached && cached.v === APP_VERSION && validCat(cached.cat) && Date.now() - cached.at < 12 * 3600e3;
    S.params = readParams(); S.page = S.params.page || 'home'; S.asRole = (store('pk2_asrole') || '');
    if (fresh && validMe(cached.me) && !S.params.inv && !S.params.ref && !S.params.src) { // เปิดทันทีจากข้อมูลล่าสุดในเครื่อง ไม่ต้องรอ LINE (เร็วขึ้น ~1 วินาที)
      S.cat = cached.cat; S.me = cached.me; S.fromCache = true; S.early = true; loadCart(); show();
    }
    liff.init({ liffId: CFG.LIFF_ID, withLoginOnExternalBrowser: true }).then(function () {
      if (!liff.isLoggedIn()) { liff.login({ redirectUri: location.href }); return null; }
      readyResolve();
      cleanUrl();
      var uid = ''; try { uid = (liff.getContext() || {}).userId || ''; } catch (e) { }
      if (S.early && uid && cached.uid !== uid) { S.me = null; S.early = false; S.fromCache = false; bootScreen(); } // คนละบัญชี LINE → ไม่ใช้ข้อมูลเก่า
      if (!S.early && fresh) {
        S.cat = cached.cat;
        if (uid && cached.uid === uid && validMe(cached.me)) { S.me = cached.me; S.fromCache = true; loadCart(); show(); }
      }
      return loadInit();
    }).then(function (res) {
      if (!res) return;
      if (!validCat(res.catalog) || !validMe(res.me)) { var e = new Error('ข้อมูลจากร้านไม่ครบ'); e.code = 'NET'; e.kind = 'BADDATA'; throw e; }
      var first = !S.fromCache;
      S.cat = res.catalog; S.me = res.me; S.fromCache = false;
      loadCart(); saveBoot();
      if ((S.params.src || S.params.ref) && !S.me.member) { // นับ "สแกน/เปิดลิงก์" ของป้ายและลิงก์ชวน (ครั้งเดียวต่อการเปิด)
        var sk = 'scan_' + (S.params.src || 'r:' + S.params.ref);
        try { if (!sessionStorage.getItem(sk)) { sessionStorage.setItem(sk, '1'); api('scan', { src: S.params.ref ? '' : S.params.src, ref: S.params.ref || '', page: S.page }, { quiet: true, tries: 1 }).catch(function () { }); } } catch (e) { }
      }
      if ((S.params.ref || S.params.src) && !S.me.member && S.page === 'home') S.page = 'register';
      if (S.params.inv) S.page = 'staffjoin';
      if (first || !formBusy()) show();
      setTimeout(prefetch, 600);
    }).catch(function (e) {
      readyResolve(); // ให้คำสั่งที่รออยู่ทำงานต่อ (จะแจ้งให้เปิดใหม่ถ้ายืนยันตัวตนไม่ได้)
      if (S.cat && S.me) { toast('อัปเดตข้อมูลไม่สำเร็จ แสดงข้อมูลล่าสุดที่มี', 4000); return; }
      if (e && e.code === 'AUTH') return fail(e);
      fatal(e && e.code === 'NET' ? 'เชื่อมต่อร้านไม่สำเร็จ' : 'เปิดระบบไม่สำเร็จ', e);
    });
  }
  /* โหลดล่วงหน้าเบื้องหลัง ให้หน้าบิล/หลังร้านเปิดทันที */
  function prefetch() {
    if (S.me && S.me.member && !S.data.bills) api('myOrders', {}, { quiet: true, tries: 2 }).then(function (r) { S.data.bills = r; }).catch(function () { });
    if (S.me && S.me.staff) loadAdmin().catch(function () { });
  }
  /* ให้ admin.js ใช้ตัวช่วยชุดเดียวกัน */
  window.PKCore = { S: S, api: api, run: run, render: render, top: top, icon: icon, esc: esc, fmt: fmt, baht: baht, toast: toast, busy: busy, go: go, show: show, fail: fail, friendly: friendly, techNote: techNote,
    statusPill: statusPill, qrSvg: qrSvg, copyText: copyText, openUrl: openUrl, appLink: appLink, imgUrl: imgUrl, thumb: thumb, prod: prod, thDate: thDate, store: store, refreshMe: refreshMe,
    zoneName: zoneName, zoneSelect: zoneSelect, canShare: canShare, ACT: ACT, FORMS: FORMS, todayStr: todayStr, nowHM: nowHM, version: APP_VERSION,
    perf: PERF, evDayText: evDayText, offerText: offerText, rewardText: rewardText, txnNorm: function (v, n) { var d = String(v || '').replace(/\D/g, ''); n = n || 7; return d.length >= n ? d.slice(-n) : d.length >= 4 ? ('0000000000' + d).slice(-n) : ''; } };
  boot();
})();
