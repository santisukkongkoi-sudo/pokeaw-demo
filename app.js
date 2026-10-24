/* MINI App Betagro Shop โพธิ์แก้ว v3 — หน้าลูกค้า (หน้าหลังร้านอยู่ใน admin.js โหลดเฉพาะพนักงาน)
 * ข้อมูลทั้งหมดอยู่ใน Google Sheet ผ่าน Apps Script, ดีไซน์ขาว–เขียว
 * v3.0.0: Smart Set / Magnet Set, แต้มสะสม, สมุดที่อยู่ + ปักหมุดบนแผนที่ (MapLibre + OpenFreeMap), ตรวจพื้นที่ส่ง, สต็อก SAP
 * v3.1.1: ชื่อโปรฝั่งลูกค้าเป็นภาษาธรรมดา (ซื้อคู่พิเศษ / ส่วนลดครั้งแรก), ลงทะเบียนสั้นลง, บิลวางยอดและ QR ไว้บนสุด, หน้าแรกปุ่มหลักขึ้นก่อน, ตัวอักษรใหญ่ขึ้น, ปักหมุดบอกระยะจากร้าน
 * v3.1.0: ส่งด่วนในวัน (บอกเวลาส่งถึงในตะกร้า), เลือกที่อยู่แบบ Grab, ผูกบัญชีด้วยเบอร์/รหัส S/ชื่อ, สั่งประจำเพิ่มสินค้าได้, กดแล้วตอบสนองทันที
 * v3.1.4: ลูกค้าไม่เห็นเป้าเวลาส่งของร้าน (บอกเวลาที่คาดว่าจะถึง), ผ่อนผันหมุดเดิมเฉพาะลูกค้าเดิมที่ยังไม่มีสมุดที่อยู่, ปุ่มยืนยันสั่งประจำหลังร้านถาม, แจ้งกำลังอัปเดตรายการบิล
 * v3.1.3: สวมบทลูกค้าทดสอบ + แชตจำลอง + นาฬิกาจำลอง (เครื่องมือ UAT ผู้จัดการ), ค้นหาที่อยู่ในเขตส่งก่อน, บิลรับเองที่ร้านบอกเวลามารับ
 */
(function () {
  'use strict';
  var CFG = window.APP_CONFIG || {};
  var APP_VERSION = '3.1.4';

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
  function rnd2(n) { return Math.round((Number(n) || 0) * 100 + (n >= 0 ? 1e-7 : -1e-7)) / 100; }
  function bahtText(n) { n = rnd2(n); return '฿' + (Math.round(n) === n ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })); }
  /* ราคาต่อหน่วยหลังลด % จากราคาเต็ม (ราคา 1+) — ชิ้นที่ได้ลดไม่ใช้ราคาขั้นบันได */
  function promoPrice(full, pct) { return rnd2(full * (100 - pct) / 100); }
  function isWeighed(p) { return /^(กก\.?|kg|กิโล)$/i.test(String(p.unit || '').trim()); }
  /**
   * Smart Set + Magnet Set (ตาม Logic spec ของ Alex · 18 เคสทดสอบ)
   * lines: [{sku, name, qty, price, total}] (ไม่รวมเซ็ตคุ้ม) · m: {magnet, magnetExpires} · featured: {sku: 1} (ใช้เมื่อ SMART_SCOPE = FEATURED)
   * → { kind: 'SMART'|'MAGNET'|'', disc, both, smart: {...}, magnet: {...}, lineDisc: {index: บาท}, lineQty: {index: ชิ้นที่ลด}, units: [...] }
   */
  function promoCalc(lines, pmap, cfg, m, today, featured, subtotal, choice) {
    var units = [], sPct = Number(cfg.SMART_DISCOUNT) || 0, mPct = Number(cfg.MAGNET_DISCOUNT) || 0;
    lines.forEach(function (l, li) {
      var p = pmap[l.sku]; if (!p) return;
      var full = p.tiers[0].price, w = Number(p.kg) || 0, q = Number(l.qty) || 0, whole = Math.floor(q + 1e-9), frac = Math.round((q - whole) * 1000) / 1000;
      var base = { li: li, sku: l.sku, name: l.name, main: String(p.promoCat || '') === 'Main', smart: !!p.smart, magnet: !!p.magnet };
      for (var i = 0; i < whole; i++) units.push({ li: li, sku: base.sku, name: base.name, main: base.main, smart: base.smart, magnet: base.magnet, full: full, charged: l.price, kg: w, whole: true });
      if (frac > 0) units.push({ li: li, sku: base.sku, name: base.name, main: base.main, smart: false, magnet: base.magnet, full: full * frac, charged: l.price * frac, kg: w * frac, whole: false });
    });
    var trig = Number(cfg.SMART_TRIGGER_KG) || 1, maxKg = Number(cfg.SMART_MAX_ITEM_KG) || 1.1, maxR = Math.max(0, Math.floor(Number(cfg.SMART_MAX_RIGHTS) || 0));
    var smartOn = cfg.SMART_ENABLED !== false && sPct > 0, feat = String(cfg.SMART_SCOPE || 'POOL').toUpperCase() === 'FEATURED';
    var mainKg = 0; units.forEach(function (u) { if (u.main) mainKg += u.kg; });
    var used = {}, nUsed = 0, usedMain = 0, sm = { on: smartOn, rights: 0, used: 0, disc: 0, unused: 0, nextKg: 0, cands: 0, units: [] };
    if (smartOn) {
      var cands = units.map(function (u, i) { return i; }).filter(function (i) { var u = units[i]; return u.smart && u.whole && u.kg <= maxKg + 1e-9 && (!feat || (featured && featured[u.sku])); })
        .sort(function (a, b) { return units[b].full - units[a].full || a - b; });
      sm.cands = cands.length;
      cands.forEach(function (i) {
        if (maxR > 0 && nUsed >= maxR) return;
        var u = units[i], kg = mainKg - usedMain - (u.main ? u.kg : 0);
        if (Math.floor(kg / trig + 1e-9) >= nUsed + 1) { used[i] = 1; nUsed++; if (u.main) usedMain += u.kg; }
      });
      var paidKg = mainKg - usedMain;
      sm.rights = Math.floor(paidKg / trig + 1e-9); sm.used = nUsed; sm.unused = Math.max(0, sm.rights - nUsed);
      sm.nextKg = Math.round(((sm.rights + 1) * trig - paidKg) * 100) / 100;
      Object.keys(used).forEach(function (k) { var u = units[k], d = Math.max(0, rnd2(u.charged - promoPrice(u.full, sPct))); sm.disc += d; sm.units.push({ li: u.li, sku: u.sku, name: u.name, full: u.full, price: promoPrice(u.full, sPct), disc: d }); });
      sm.disc = rnd2(sm.disc);
      sm.units.sort(function (a, b) { return b.full - a.full; });
    }
    var mg = { on: false, status: m ? String(m.magnet || '') : '', expires: m ? String(m.magnetExpires || '') : '', disc: 0, raw: 0, gross: 0, capped: false, ok: false, why: '', short: 0, cap: Number(cfg.MAGNET_CAP) || 0, minNet: Number(cfg.MAGNET_MIN_NET) || 0, lines: {} };
    mg.on = cfg.MAGNET_ENABLED !== false && mPct > 0 && !!m && mg.status === 'AVAILABLE' && (!mg.expires || mg.expires >= today);
    if (mg.on) {
      units.forEach(function (u) { if (!u.magnet) return; var d = Math.max(0, rnd2(u.charged - rnd2(u.full * (100 - mPct) / 100))); mg.gross += u.full; mg.raw += d; mg.lines[u.li] = rnd2((mg.lines[u.li] || 0) + d); });
      mg.gross = rnd2(mg.gross); mg.raw = rnd2(mg.raw);
      mg.disc = mg.cap > 0 ? Math.min(mg.raw, mg.cap) : mg.raw; mg.capped = mg.cap > 0 && mg.raw > mg.cap;
      if (mg.disc > 0) {
        var after = rnd2(subtotal - mg.disc);
        if (after >= mg.minNet) mg.ok = true;
        else { mg.short = rnd2(mg.minNet - after); mg.why = 'ยอดหลังหักส่วนลด ' + bahtText(after) + ' ยังไม่ถึง ' + bahtText(mg.minNet) + ' เพิ่มอีก ' + bahtText(mg.short); }
      } else mg.why = 'ยังไม่มีสินค้าที่ร่วมรายการในตะกร้า';
    }
    var kind = '';
    if (mg.ok && mg.disc > 0 && mg.disc >= sm.disc) kind = 'MAGNET'; else if (sm.disc > 0) kind = 'SMART';
    if (choice === 'SMART' && sm.disc > 0) kind = 'SMART'; else if (choice === 'MAGNET' && mg.ok) kind = 'MAGNET';
    var lineDisc = {}, lineQty = {};
    if (kind === 'SMART') sm.units.forEach(function (u) { lineDisc[u.li] = rnd2((lineDisc[u.li] || 0) + u.disc); lineQty[u.li] = (lineQty[u.li] || 0) + 1; });
    if (kind === 'MAGNET') { // แบ่งส่วนลดที่ชนเพดานกลับไปรายบรรทัดตามสัดส่วน (รวมแล้วเท่ายอดลดจริงพอดี)
      var keys = Object.keys(mg.lines).filter(function (k) { return mg.lines[k] > 0; }), left = mg.disc;
      keys.forEach(function (k, j) { var v = j === keys.length - 1 ? rnd2(left) : rnd2(mg.lines[k] * mg.disc / mg.raw); lineDisc[k] = v; left = rnd2(left - v); });
    }
    delete mg.lines;
    return { kind: kind, disc: kind === 'MAGNET' ? mg.disc : kind === 'SMART' ? sm.disc : 0, both: sm.disc > 0 && mg.ok, smart: sm, magnet: mg, lineDisc: lineDisc, lineQty: lineQty };
  }
  /**
   * cart: { lines: {sku: qty}, bundles: {id: qty}, useCoin: bool, usePoints: bool, promo: ''|'SMART'|'MAGNET', mode: 'deliver'|'pickup'|'shop', slot }
   * cart: evening = true → รอบเย็น (Evening Extension)
   * ctx:  { products: [...], bundles: [...], cfg: {...}, member: {type, couponLeft, couponExpires, sourceKind, inZone, regDate, offer, magnet, magnetExpires} | null,
   *         coinBal, pointsBal, featured: {sku: 1}, today: 'yyyy-MM-dd' }
   */
  function calcCart(cart, ctx) {
    var cfg = ctx.cfg, today = ctx.today, m = ctx.member || null;
    var pmap = {}, bmap = {};
    ctx.products.forEach(function (p) { pmap[p.sku] = p; });
    ctx.bundles.forEach(function (b) { bmap[b.id] = b; });
    var lines = [], bl = [], errors = [], low = [];
    var cl = cart.lines || {}, cb = cart.bundles || {};
    Object.keys(cl).forEach(function (sku) {
      var p0 = pmap[sku], raw = Number(cl[sku]) || 0, q = p0 && isWeighed(p0) ? Math.round(raw * 1000) / 1000 : Math.floor(raw); if (q <= 0) return;
      var p = p0;
      if (!p) { errors.push('ไม่พบสินค้า ' + sku); return; }
      if (!p.inStock) { errors.push(p.name + ' หมดวันนี้'); return; }
      if (p.stockLow) low.push(p.name);
      var price = unitPrice(p, q);
      lines.push({ sku: sku, name: p.name, unit: p.unit, qty: q, price: price, total: rnd2(price * q), promo: !!p.promo, kg: p.kg * q, full: p.tiers[0].price, tag: p.promoCat === 'Main' ? 'main' : p.smart ? 'smart' : p.magnet ? 'magnet' : '' });
    });
    Object.keys(cb).forEach(function (id) {
      var q = Math.floor(Number(cb[id]) || 0); if (q <= 0) return;
      var b = bmap[id];
      if (!b || !b.active) { errors.push('ไม่พบเซ็ต ' + id); return; }
      var kg = 0, normal = 0, out = b.items.filter(function (it) { var p = pmap[it[0]]; return !p || !p.inStock; });
      if (out.length) { errors.push(b.name + ' หมดวันนี้ (สินค้าในเซ็ตหมด)'); return; }
      b.items.forEach(function (it) { var p = pmap[it[0]]; if (p) { kg += p.kg * it[1]; normal += unitPrice(p, it[1]) * it[1]; if (p.stockLow && low.indexOf(p.name) < 0) low.push(p.name); } });
      bl.push({ id: id, name: b.name, qty: q, price: b.price, total: b.price * q, kg: kg * q, normal: normal * q });
    });
    var subtotal = 0, eligible = 0, kgSum = 0;
    lines.forEach(function (l) { subtotal += l.total; kgSum += l.kg; if (l.promo) eligible += l.total; });
    bl.forEach(function (l) { subtotal += l.total; kgSum += l.kg; eligible += l.total; });
    subtotal = rnd2(subtotal); eligible = rnd2(eligible);
    /* Smart Set / Magnet Set: 1 บิล 1 โปร (ระบบเลือกอันที่ลดมากกว่า ลูกค้ากดสลับได้) */
    var pr = promoCalc(lines, pmap, cfg, m, today, ctx.featured || null, subtotal, String(cart.promo || ''));
    lines.forEach(function (l, i) { l.promoDisc = pr.lineDisc[i] || 0; l.promoQty = pr.lineQty[i] || 0; });
    var promoDisc = pr.disc;
    var coupon = 0, couponWhy = '', couponPct = 0, couponCap = 0, couponAmt = 0, step = 0, plan = couponPlan(cfg, m ? m.type : 'FS', m ? m.offer : null);
    if (m && Number(m.couponLeft) > 0) {
      step = couponStep(plan, m.couponLeft); couponPct = plan.pcts[step] || 0; couponAmt = plan.amts[step] || 0; couponCap = plan.caps[Math.min(step, plan.caps.length - 1)] || 0;
      var minB = plan.mins[Math.min(step, plan.mins.length - 1)] || 0, base = plan.scope === 'all' ? subtotal - promoDisc : eligible;
      if (String(m.couponExpires || '') < today) couponWhy = 'คูปองหมดอายุแล้ว';
      else if (subtotal < minB) couponWhy = 'ยอดยังไม่ถึง ' + minB.toLocaleString('en-US') + ' บาท คูปองยังไม่ทำงาน';
      else if (base <= 0) couponWhy = 'คูปองใช้ได้กับสินค้าร่วมรายการและเซ็ตคุ้มเท่านั้น';
      else coupon = couponAmt ? Math.min(couponAmt, base) : Math.min(Math.round(base * couponPct / 100), couponCap || 1e9);
      coupon = Math.max(0, Math.min(coupon, rnd2(subtotal - promoDisc)));
    }
    var bal = Math.max(0, Math.floor(Number(ctx.coinBal) || 0));
    var coinBase = Math.max(0, subtotal - promoDisc - coupon), coinMax = Math.max(0, Math.floor(coinBase * cfg.COIN_MAX_PCT / 100 / cfg.COIN_VALUE));
    var coinWhy = '';
    if (cfg.COIN_SCOPE !== 'all') { // ส่วนลดสะสมใช้ได้เฉพาะสินค้าร่วมรายการ
      var elig = Math.max(0, Math.floor((eligible - (plan.scope === 'all' ? Math.min(coupon, Math.max(0, coupon - (subtotal - eligible))) : coupon)) / cfg.COIN_VALUE));
      if (coinMax > elig) coinMax = elig;
      if (bal > 0 && coinMax <= 0 && subtotal > 0) coinWhy = 'ส่วนลดสะสมใช้ได้กับสินค้าร่วมรายการและเซ็ตคุ้มเท่านั้น';
    }
    var coinUse = cart.useCoin ? Math.min(bal, coinMax) : 0;
    /* แต้มสะสม: แลกทีละ POINT_REDEEM_UNIT แต้ม = POINT_REDEEM_VALUE บาท (ไม่เกินยอดที่เหลือ) */
    var pUnit = Math.floor(Number(cfg.POINT_REDEEM_UNIT) || 0), pVal = Number(cfg.POINT_REDEEM_VALUE) || 0, pBal = Math.max(0, Math.floor(Number(ctx.pointsBal) || 0));
    var left = rnd2(subtotal - promoDisc - coupon - coinUse * cfg.COIN_VALUE);
    var pointsMax = cfg.POINTS_ENABLED !== false && pUnit > 0 && pVal > 0 ? Math.max(0, Math.min(Math.floor(pBal / pUnit), Math.floor(left / pVal))) : 0;
    var pointsUse = cart.usePoints && pointsMax > 0 ? pointsMax * pUnit : 0, pointsDisc = cart.usePoints && pointsMax > 0 ? rnd2(pointsMax * pVal) : 0;
    var net = rnd2(subtotal - promoDisc - coupon - coinUse * cfg.COIN_VALUE - pointsDisc);
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
      belowMin: belowMin, pool: pool, tooSmall: tooSmall, poolMin: poolMin, count: lines.length + bl.length, errors: errors,
      promo: pr, promoKind: pr.kind, promoDisc: promoDisc, pointsBal: pBal, pointsMax: pointsMax, pointsUse: pointsUse, pointsDisc: pointsDisc, lowStock: low };
  }
  /* ===== พื้นที่จัดส่ง: จุดอยู่ในเส้นเขต / ห่างจากขอบกี่เมตร (โค้ดเดียวกันทั้งหน้า MINI App และหลังบ้าน · ไม่พึ่งผู้ให้บริการแผนที่) ===== */
  function geoXY(lat, lng, o) { return [(lng - o[1]) * 111320 * Math.cos(o[0] * Math.PI / 180), (lat - o[0]) * 110574]; }
  function geoInPoly(x, y, P) {
    var inside = false;
    for (var i = 0, j = P.length - 1; i < P.length; j = i++) { var a = P[i], b = P[j]; if (((a[1] > y) !== (b[1] > y)) && (x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0])) inside = !inside; }
    return inside;
  }
  function geoSegDist(x, y, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? ((x - a[0]) * dx + (y - a[1]) * dy) / L : 0;
    t = Math.max(0, Math.min(1, t)); var px = a[0] + t * dx - x, py = a[1] + t * dy - y; return Math.sqrt(px * px + py * py);
  }
  /**
   * poly: [[lat, lng], ...] (≥ 3 จุด) · bandM: แถบขอบนอกที่ยังส่งได้ (เมตร)
   * → { status: 'in' | 'band' | 'out' | 'none' (ไม่มีพิกัด) | 'off' (ยังไม่ตั้งเส้นเขต), distM: ระยะจากขอบ (เมตร · ในเขต = 0) }
   */
  function geoArea(lat, lng, poly, bandM) {
    lat = Number(lat); lng = Number(lng);
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return { status: 'none', distM: 0 };
    if (!poly || poly.length < 3) return { status: 'off', distM: 0 };
    var o = [0, 0]; poly.forEach(function (p) { o[0] += Number(p[0]); o[1] += Number(p[1]); }); o[0] /= poly.length; o[1] /= poly.length;
    var P = poly.map(function (p) { return geoXY(Number(p[0]), Number(p[1]), o); }), q = geoXY(lat, lng, o);
    if (geoInPoly(q[0], q[1], P)) return { status: 'in', distM: 0 };
    var d = 1e12; for (var i = 0, j = P.length - 1; i < P.length; j = i++) d = Math.min(d, geoSegDist(q[0], q[1], P[j], P[i]));
    d = Math.round(d);
    return { status: d <= (Number(bandM) || 0) ? 'band' : 'out', distM: d };
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
  var S = { me: null, cat: null, page: 'home', params: {}, history: [], cart: null, ui: {}, data: {}, busyN: 0, asCust: '', uat: null }; // 3.1.3 asCust = ลูกค้าทดสอบที่ผู้จัดการสวมบท · uat = สถานะสวมบท/นาฬิกาจำลองจากหลังบ้าน
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
    alert: '<path d="M12 3l10 18H2L12 3zM12 10v5M12 18v.5"/>',
    mute: '<path d="M6 16V11a6 6 0 0112 0v5l2 2H4l2-2zM10 20a2 2 0 004 0M3 3l18 18"/>',
    out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 15A8 8 0 019 4a8 8 0 1011 11z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chev: '<path d="M9 5l7 7-7 7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>'
  };
  function icon(name) { return '<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (UI_ICONS[name] || UI_ICONS.bag) + '</svg>'; }
  function navBar() {
    if (!S.me || !S.me.member || S.me.member.rejected || /^(admin|staffjoin|partner|partnerjoin|catalog|cart|done|pin|address|shipto)$/.test(S.page)) return '';
    return '<nav class="bottom-nav" aria-label="เมนูหลัก">' + [['home', 'home', 'หน้าแรก'], ['catalog', 'bag', 'สั่งของ'], ['bills', 'bill', 'บิลของฉัน'], ['card', 'card', 'สมาชิก']].map(function (n) {
      var on = S.page === n[0] || n[0] === 'bills' && S.page === 'bill' || n[0] === 'card' && /^(wallet|invite|standing)$/.test(S.page);
      var badge = n[0] === 'bills' && S.me.unpaid ? '<i class="dot" aria-label="มีบิลรอชำระ"></i>' : '';
      return '<button data-a="go" data-p="' + n[0] + '"' + (on ? ' aria-current="page" class="on"' : '') + '>' + icon(n[1]) + badge + '<span>' + n[2] + '</span></button>';
    }).join('') + '</nav>';
  }
  function hero(small) { // v3.1.1 small = แบนเนอร์เตี้ยลง ไว้ท้ายหน้าแรกของสมาชิก
    return '<section class="shop-hero' + (small ? ' sm' : '') + '"><img src="assets/ingredients.jpg" alt="ภาพประกอบวัตถุดิบ หมู ไก่ และไข่" width="960" height="640" decoding="async"><div class="hero-copy"><span class="eyebrow">BETAGRO SHOP · โพธิ์แก้ว</span><h2>พร้อมทุกมื้อ<br>เพื่อร้านของคุณ</h2><p>หมู · ไก่ · ไข่ · สินค้าแปรรูป</p><span class="hero-tag">สั่งง่าย ผ่าน LINE</span></div><small class="image-note">ภาพประกอบ</small></section>';
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

  /* ---------- 3.1.3 เครื่องมือ UAT: แถบสวมบท / นาฬิกาจำลอง + แชตจำลอง ---------- */
  function uatBar() {
    var u = S.uat || {}, p = S.asCust ? (u.persona || { name: (S.me && S.me.displayName) || 'ลูกค้าทดสอบ' }) : null, sim = u.sim;
    if (!p && !sim) return '';
    return '<div id="uat-bar" class="uat-bar" role="status">' + (p ? '<span><b>กำลังสวมบท: ' + esc(p.name) + '</b> ลูกค้าทดสอบ ข้อความไม่ส่งออก LINE</span>' : '') +
      (sim ? '<span>' + icon('clock') + ' นาฬิกาจำลอง <b class="num">' + esc(thDate(sim.now.slice(0, 10)) + ' ' + sim.now.slice(11, 16)) + '</b> (เวลาจริง ' + esc(sim.real) + ' ปิดเอง ' + esc(sim.until) + ')</span>' : '') +
      (p ? '<span class="uat-acts"><button class="btn sm" data-a="uatChat">แชตจำลอง</button><button class="btn sm" data-a="uatExit">ออกจากสวมบท</button></span>' : '') + '</div>';
  }
  function uatNote(u) {
    if (S.asCust && (!u || !u.persona) && S.uat && S.uat.persona) u = Object.assign({}, u || {}, { persona: S.uat.persona }); // คำสั่งหลังร้านระหว่างสวมบทไม่ได้แนบชื่อลูกค้าทดสอบ → คงไว้
    if (u && !u.persona && !u.sim) u = null;
    var before = JSON.stringify(S.uat || null), after = JSON.stringify(u || null), dayBefore = todayStr();
    S.uat = u; if (before === after) return;
    var el = document.getElementById('uat-bar'), h = S.page !== 'admin' ? uatBar() : '';
    if (el) { if (h) el.outerHTML = h; else el.remove(); } else if (h && app) app.insertAdjacentHTML('afterbegin', h);
    if (window.PKAdmin && window.PKAdmin.onClock) try { window.PKAdmin.onClock(dayBefore); } catch (e) { }
  }
  function personaStart(uid) { sessSet('pk2_ascust', uid); store('pk2_tab', 'tools'); location.href = location.pathname + '?page=home'; }
  function personaExit(msg) { sessSet('pk2_ascust', ''); S.asCust = ''; store('pk2_tab', 'tools'); if (msg) try { sessionStorage.setItem('pk2_uatmsg', msg); } catch (e) { } location.href = location.pathname + '?page=admin'; }
  /* การ์ด LINE (Flex) แบบย่อ: ข้อความ ตาราง ปุ่ม รูป · ลิงก์ MINI App ในการ์ดเปิดหน้าเดียวกันในหน้าเว็บนี้ */
  function chatLink(u) {
    u = String(u || ''); var m = /^https:\/\/(?:miniapp\.line\.me|liff\.line\.me)\/[^?#]+(\?[^#]*)?/.exec(u);
    if (m) return location.pathname + (m[1] || '');
    return /^https?:\/\//.test(u) ? u : '#';
  }
  function flexNode(n) {
    if (!n || typeof n !== 'object') return '';
    if (n.type === 'carousel') return '<div class="fx-carousel">' + (n.contents || []).map(flexNode).join('') + '</div>';
    if (n.type === 'bubble') return '<div class="fx-bubble">' + ['header', 'hero', 'body', 'footer'].map(function (k) { return n[k] ? '<div class="fx-' + k + '">' + flexNode(n[k]) + '</div>' : ''; }).join('') + '</div>';
    if (n.type === 'box') return '<div class="fx-box fx-' + esc(n.layout || 'vertical') + '">' + (n.contents || []).map(flexNode).join('') + '</div>';
    if (n.type === 'text') { var t = n.contents && n.contents.length ? n.contents.map(function (x) { return x.text || ''; }).join('') : n.text; return '<div class="fx-text fx-' + esc(n.size || 'md') + (n.weight === 'bold' ? ' b' : '') + (n.align === 'end' ? ' r' : '') + '"' + (n.flex !== undefined ? ' style="flex:' + (Number(n.flex) || 0) + '"' : '') + '>' + esc(t).replace(/\n/g, '<br>') + '</div>'; }
    if (n.type === 'separator') return '<hr class="fx-sep">';
    if (n.type === 'image') return n.url ? '<img class="fx-img" src="' + esc(chatLink(n.url)) + '" alt="" loading="lazy">' : '';
    if (n.type === 'button') { var a = n.action || {}; return a.uri ? '<a class="btn sm fx-btn' + (n.style === 'primary' ? ' pri' : '') + '" href="' + esc(chatLink(a.uri)) + '">' + esc(a.label || 'เปิด') + '</a>' : '<span class="btn sm fx-btn">' + esc(a.label || a.text || 'ปุ่ม') + '</span>'; }
    return '';
  }
  function flexHtml(list) {
    return (Array.isArray(list) ? list : []).map(function (m) {
      if (m.type === 'text') return '<div class="tc-msg tc-text">' + esc(m.text).replace(/\n/g, '<br>') + '</div>';
      if (m.type === 'flex') return '<div class="tc-msg tc-flex">' + flexNode(m.contents) + '</div>';
      return '<div class="tc-msg tc-text">[' + esc(m.type) + '] ' + esc(m.altText || '') + '</div>';
    }).join('');
  }
  var CHAT_TH = { welcome: 'ต้อนรับ', bill: 'บิล', short: 'ยอดขาด', paid: 'รับเงินแล้ว', remind: 'ตามเงิน', standing: 'ถามสั่งประจำ', cancel: 'ยกเลิก', approved: 'ยืนยันสมาชิก', received: 'รับออเดอร์', coin: 'เหรียญ', refnotify: 'แจ้งผู้ชวน', pool: 'รอรวมรอบ', winback: 'ชวนกลับ', evening: 'รอบเย็น',
    refpoints: 'แต้มผู้ชวน', out: 'ออกรถ', magnetremind: 'เตือนส่วนลดครั้งแรก', broadcast: 'บรอดแคสต์', summary: 'สรุปยอด', 'staff-order': 'แจ้งออเดอร์ใหม่', 'staff-pay': 'แจ้งโอน', 'email-order': 'อีเมลออเดอร์ใหม่', 'email-pay': 'อีเมลแจ้งโอน' };
  function chatList(rows, withName) {
    if (!rows || !rows.length) return '<div class="hint">ยังไม่มีข้อความ</div>';
    return rows.map(function (r) { var ty = CHAT_TH[r.type] || CHAT_TH[String(r.type).replace(/-text$/, '')] || r.type; return '<div class="tc-row' + (r.real ? ' real' : '') + '"><div class="tc-meta"><b>' + (withName ? esc(r.name) + ' ' : '') + '</b><span class="hint">' + esc(r.time.slice(5, 16)) + ' ' + esc(ty) + (r.by ? ' (' + esc(r.by) + ')' : '') + '</span></div>' + flexHtml(r.msgs) + '</div>'; }).join('');
  }

  /* ---------- ตัวช่วย ---------- */
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { n = Number(n) || 0; return Math.abs(n - Math.round(n)) > 0.004 ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(n).toLocaleString('en-US'); }
  function baht(n) { return '฿' + fmt(n); }
  function toast(t, ms) { var el = document.getElementById('toast'); if (!el) return; el.textContent = plainSep(t); el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { el.hidden = true; }, ms || 3200); }
  /* v3.1.0 กดแล้วตอบสนองทันที: แถบบางด้านบนขึ้นทันที (ไม่บังจอ กันกดซ้ำ) · ถ้าเกิน 0.7 วินาที จึงขึ้นกล่อง "กำลัง..." */
  var busyT = null;
  function busy(on, text) {
    var el = document.getElementById('busy'), bar = document.getElementById('busy-bar');
    clearTimeout(busyT);
    if (on) {
      if (!bar) { bar = document.createElement('div'); bar.id = 'busy-bar'; bar.className = 'busy-bar'; bar.setAttribute('aria-hidden', 'true'); bar.innerHTML = '<i></i>'; document.body.appendChild(bar); }
      document.body.classList.add('is-busy');
      var show = function () {
        if (!el) { el = document.createElement('div'); el.id = 'busy'; el.className = 'busy'; document.body.appendChild(el); }
        el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); el.innerHTML = '<div><span class="spinner" aria-hidden="true"></span><b>' + esc(plainSep(text || 'กำลังทำรายการ...')) + '</b><small>รอสักครู่</small></div>';
      };
      if (el) show(); else busyT = setTimeout(show, 700);
    } else { if (el) el.remove(); if (bar) bar.remove(); document.body.classList.remove('is-busy'); }
  }
  /* v3.1.0 ไม่ใช้จุดกลาง (·) คั่นคำบนหน้าจอ: ข้อความล้วน → ", " · ในหน้าเว็บ → เส้นคั่นบาง (span.sep) */
  function plainSep(t) { return String(t === undefined || t === null ? '' : t).replace(/\s*\u00b7\s*/g, ', ').replace(/^, |, $/g, ''); }
  var SEP_SKIP = /^(SCRIPT|STYLE|TEXTAREA|OPTION|OPTGROUP|TITLE|SELECT)$/;
  function undot(root) {
    if (!root || !root.nodeType) return;
    if (root.nodeType === 3) { if (root.nodeValue.indexOf('\u00b7') >= 0 && root.parentNode) undotText(root); return; }
    if (root.nodeType !== 1) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), list = [], n;
    while ((n = w.nextNode())) if (n.nodeValue.indexOf('\u00b7') >= 0) list.push(n);
    list.forEach(undotText);
    if (root.querySelectorAll) Array.prototype.forEach.call([root].concat(Array.prototype.slice.call(root.querySelectorAll('[title],[aria-label],[placeholder],[alt]'))), function (el) {
      ['title', 'aria-label', 'placeholder', 'alt'].forEach(function (k) { var v = el.getAttribute && el.getAttribute(k); if (v && v.indexOf('\u00b7') >= 0) el.setAttribute(k, plainSep(v)); });
    });
  }
  function undotText(t) {
    var p = t.parentNode; if (!p) return;
    if (SEP_SKIP.test(p.nodeName) || (p.closest && p.closest('svg,select,textarea'))) { t.nodeValue = plainSep(t.nodeValue); return; }
    var parts = t.nodeValue.split('\u00b7'), last = parts.length - 1, frag = document.createDocumentFragment(), hasBefore = !!t.previousSibling, hasAfter = !!t.nextSibling;
    parts.forEach(function (x, i) {
      var s = x; if (i > 0) s = s.replace(/^\s+/, ''); if (i < last) s = s.replace(/\s+$/, '');
      if (i > 0 && (frag.childNodes.length || hasBefore) && (s || i < last || hasAfter)) { var sp = document.createElement('span'); sp.className = 'sep'; sp.textContent = ' '; frag.appendChild(sp); }
      if (s) frag.appendChild(document.createTextNode(s));
    });
    p.replaceChild(frag, t);
  }
  try { new MutationObserver(function (recs) { recs.forEach(function (r) { if (r.type === 'characterData') { if (r.target.nodeValue && r.target.nodeValue.indexOf('\u00b7') >= 0) undot(r.target); return; } Array.prototype.forEach.call(r.addedNodes, undot); }); }).observe(document.documentElement, { childList: true, subtree: true, characterData: true }); } catch (e) { }
  function store(key, val) { try { if (val === undefined) { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(val)); } catch (e) { return null; } return null; }
  /* 3.1.3 นาฬิกาจำลอง (เฉพาะผู้จัดการที่ตั้งไว้ · หลังบ้านบอกส่วนต่างเวลามากับทุกคำตอบ) */
  function clockNow() { return Date.now() + ((S.uat && S.uat.sim && Number(S.uat.sim.ms)) || 0); }
  function todayStr() { return S.uat && S.uat.sim ? new Date(clockNow() + 7 * 3600e3).toISOString().slice(0, 10) : (S.cat && S.cat.today) || new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); }
  function nowHM() { return new Date(clockNow() + 7 * 3600e3).toISOString().slice(11, 16); }
  function sessGet(k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function sessSet(k, v) { try { if (v) sessionStorage.setItem(k, v); else sessionStorage.removeItem(k); } catch (e) { } }
  function thDate(d) { var M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']; d = String(d || ''); return d.length >= 10 ? Number(d.slice(8, 10)) + ' ' + M[Number(d.slice(5, 7)) - 1] : d; }
  function dayName(d) { return ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์', 'เสาร์'][new Date(String(d).slice(0, 10) + 'T00:00:00Z').getUTCDay()]; }
  function isStaff() { return !!(S.me && S.me.staff); }
  function paramsOf(search) { var o = {}; (function m(q, d) { q = String(q || ''); q = q.indexOf('?') >= 0 ? q.slice(q.indexOf('?') + 1) : q; new URLSearchParams(q).forEach(function (v, k) { if (k === 'liff.state' || k === 'liffRedirectUri') { if (d < 3) m(v, d + 1); return; } if (/^(code|state|liffClientId)$/.test(k)) return; if (!o[k]) o[k] = v; }); })(search, 0); return o; }
  function readParams() {
    var raw = {}, out = {};
    new URLSearchParams(location.search).forEach(function (v, k) { raw[k] = v; });
    var callback = !!(raw.liffClientId || raw.liffRedirectUri); // กลับจากหน้า LINE Login บนคอม
    Object.keys(raw).forEach(function (k) {
      if (k === 'liff.state' || k === 'liffClientId' || k === 'liffRedirectUri') return;
      if (callback && (k === 'code' || k === 'state')) return;
      out[k] = raw[k];
    });
    function merge(u, d) { u = String(u || ''); var q = u.indexOf('?') >= 0 ? u.slice(u.indexOf('?') + 1) : ''; new URLSearchParams(q).forEach(function (v, k) { if (k === 'liff.state') { if ((d || 0) < 3) merge(v, (d || 0) + 1); return; } if (/^(code|state|liffClientId|liffRedirectUri)$/.test(k)) return; if (!out[k]) out[k] = v; }); } // 3.1.2: liff.state ซ้อนใน liffRedirectUri ก็อ่านได้
    merge(raw['liff.state']);      // เปิดครั้งแรกจาก LINE
    merge(raw.liffRedirectUri);    // หน้าที่ตั้งใจเปิดก่อนไปล็อกอิน
    return out;
  }
  /* 3.1.2 อ่านพิกัดจากข้อความที่วาง: "13.79, 100.64" · ลิงก์ที่มี @lat,lng · q=/ll=/query= · !3d..!4d.. (ลิงก์ย่อ maps.app.goo.gl ยังต้องให้หลังบ้านเปิดให้) */
  function localLatLng(u) {
    var s = String(u || '').trim(), m = /^(-?\d{1,2}\.\d+)\s*[,\s]\s*(-?\d{1,3}\.\d+)$/.exec(s) || /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/.exec(s) ||
      /[?&](?:q|query|ll|center|destination)=(-?\d{1,2}\.\d+)(?:,|%2C)\s*(-?\d{1,3}\.\d+)/i.exec(s) || /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/.exec(s);
    if (!m) return null;
    var lat = Number(m[1]), lng = Number(m[2]);
    return lat > 4 && lat < 22 && lng > 96 && lng < 107 ? [lat, lng] : null; // นอกประเทศไทย → ให้หลังบ้านตรวจ
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
    adminData: 1, adminPoll: 1, exportData: 1, slipImage: 1, selfTest: 1, memberLinkInfo: 1, expandLink: 1, shopPhoto: 1, deliveryEta: 1 };
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
    var isRead = !!READS[action], body = Object.assign({ action: action, cv: APP_VERSION }, data || {}); // cv: หลังบ้านจดว่ามีคนใช้หน้าเว็บเวอร์ชันไหน (3.1.2)
    if (!isRead) body.rid = body.rid || rid();
    if (S.asRole) body.asRole = S.asRole; // ผู้จัดการทดสอบบทบาทอื่น (หลังบ้านลดสิทธิ์ให้เท่านั้น)
    if (S.asCust) body.asCustomer = S.asCust; // 3.1.3 ผู้จัดการสวมบทลูกค้าทดสอบ (หลังบ้านตรวจสิทธิ์ทุกคำขอ)
    var tries = opt.tries || (isRead ? 4 : 3), t0 = Date.now();
    function attempt(n) {
      try { body.token = liff.getAccessToken() || ''; } catch (e) { body.token = ''; }
      var ctrl = window.AbortController ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, opt.timeout || (isRead ? 20000 : 30000)) : null;
      return fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined, cache: 'no-store', redirect: 'follow' })
        .then(function (r) { if (!r.ok) throw netErr('HTTP ' + r.status, r.status); return r.text(); })
        .then(function (t) {
          var j; try { j = JSON.parse(t); } catch (x) { throw netErr(/<html/i.test(t) ? 'HTML' : 'NOTJSON'); }
          if (!j || !j.ok) { var e = new Error((j && j.error) || 'เกิดข้อผิดพลาด'); e.code = (j && j.code) || 'SERVER'; e.detail = j && j.detail; e.server = true; if (e.code === 'PERSONA' && S.asCust) setTimeout(function () { personaExit(e.message); }, 0); throw e; }
          if (timer) clearTimeout(timer);
          if (action !== 'catalog' && action !== 'ping') uatNote(j.uatMode || null);
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
  function pageTitle() { return { bills: 'บิลของฉัน', bill: 'บิล', invite: 'ชวนเพื่อน', wallet: 'สิทธิ์ของฉัน', standing: 'สั่งประจำ', partner: 'ยอดป้ายของฉัน' }[S.page] || ''; }
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
  function loadCart() { S.cart = store(cartKey()) || { lines: {}, bundles: {}, useCoin: false, mode: 'deliver', slot: '' }; S.cart.lines = S.cart.lines || {}; S.cart.bundles = S.cart.bundles || {}; if (!/^(SMART|MAGNET)?$/.test(S.cart.promo || '')) S.cart.promo = ''; }
  function saveCart() { store(cartKey(), S.cart); }
  function calcNow() {
    var m = S.me && S.me.member;
    return calcCart(S.cart, { products: S.cat.products, bundles: S.cat.bundles, cfg: S.cat.cfg, today: todayStr(), coinBal: S.me ? S.me.coinBal : 0, pointsBal: ptsBal(), featured: featuredMap(),
      member: m ? { type: m.type, couponLeft: m.couponLeft, couponExpires: m.couponExpires, sourceKind: m.sourceKind, inZone: m.inZone, regDate: m.regDate, offer: S.me.offer || null, magnet: S.cat.cfg.MAGNET_ENABLED === false ? '' : m.magnet, magnetExpires: m.magnetExpires } : null });
  }
  function prod(sku) { return S.cat.products.filter(function (p) { return p.sku === sku; })[0]; }
  /* รอบส่งที่ร้านจะจัดให้ (กติกาเดียวกับหลังบ้าน): สั่งก่อนปิดรับของรอบไหน ได้รอบนั้น · หลังรอบสุดท้าย = รอบเช้าพรุ่งนี้ */
  function waves() {
    var w = String(S.cat.cfg.WAVES || '').split('|').map(function (x) { var t = x.split(':'); return t.length >= 5 ? { name: t[0].trim(), depart: t[1] + ':' + t[2], cutoff: t[3] + ':' + t[4] } : null; }).filter(Boolean);
    return w.length ? w : [{ name: 'รอบเช้า', depart: '07:00', cutoff: '20:00' }, { name: 'รอบสาย', depart: '11:00', cutoff: '09:00' }, { name: 'รอบบ่าย', depart: '14:30', cutoff: '13:00' }];
  }
  function waveNow() {
    var W = waves(), t = nowHM(), today = todayStr(), i;
    function tmr() { return dayAfter(today); } // 3.1.3 ใช้วันเดียวกับนาฬิการ้าน (เวลาไทย / นาฬิกาจำลอง)
    for (i = 1; i < W.length; i++) if (t < W[i].cutoff) return { slot: W[i].name, date: today, depart: W[i].depart };
    if (t < W[0].cutoff) return { slot: W[0].name, date: tmr(), depart: W[0].depart };
    i = Math.min(1, W.length - 1); return { slot: W[i].name, date: tmr(), depart: W[i].depart };
  }
  function autoSlot() { return String(S.cat.cfg.SLOT_MODE || 'auto') !== 'choose'; }
  /* v3.1.0 เวลาทำการ + เวลาส่งถึงโดยประมาณ (ตรงกับหลังบ้าน hours_ / deliveryQuote_) */
  function hmv(v, d) { v = String(v === undefined || v === null ? '' : v).trim(); return /^\d{1,2}:\d{2}$/.test(v) ? ('0' + v).slice(-5) : d; }
  function hoursOf() {
    var c = (S.cat && S.cat.cfg) || {};
    return { open: hmv(c.SHOP_OPEN, '07:00'), close: hmv(c.SHOP_CLOSE, '19:00'), lastDeliver: hmv(c.DELIVERY_LAST_ORDER, '17:00'), payChase: hmv(c.PAY_CHASE_FROM, '18:00'), morningDue: hmv(c.MORNING_DUE, '09:00'),
      target: Math.max(15, Number(c.DELIVERY_TARGET_MIN) || 60), prep: Math.max(0, Number(c.PREP_MIN) || 15), eta: String(c.SLOT_MODE || '') === 'eta' };
  }
  function etaMode() { return hoursOf().eta; }
  function custSlot(s) { s = String(s || ''); return /^ส่งภายใน\s/.test(s) ? 'ส่งวันนี้' : s; } // 3.1.4 ชื่อรอบส่งด่วนใช้ภายในร้าน ลูกค้าเห็น "ส่งวันนี้"
  function addHm(t, min) { var x = Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) + min; x = ((x % 1440) + 1440) % 1440; return ('0' + Math.floor(x / 60)).slice(-2) + ':' + ('0' + (x % 60)).slice(-2); }
  function dayAfter(d) { return new Date(Date.parse(d + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10); }
  /* เวลาโดยประมาณในเครื่อง (แสดงทันที) แล้วแทนด้วยเวลาที่หลังบ้านคำนวณจากรถที่ว่างจริง */
  function localQuote(mode) {
    var H = hoursOf(), t = nowHM(), today = todayStr();
    if (mode === 'shop') { if (t >= H.close) return { kind: 'pickup', date: dayAfter(today), at: addHm(H.open, H.prep), until: H.close }; var at = t < H.open ? addHm(H.open, H.prep) : addHm(t, H.prep); return { kind: 'pickup', date: today, at: at > H.close ? H.close : at, until: H.close }; }
    if (t < H.open) return { kind: 'morning', date: today, at: H.morningDue };
    if (t >= H.lastDeliver) return { kind: 'morning', date: dayAfter(today), at: H.morningDue };
    return { kind: 'express', date: today, at: '', within: true, local: true };
  }
  /* ข้อความเวลา: ใช้ทั้งตะกร้า หน้าส่งออเดอร์แล้ว และหน้าบิล */
  function etaText(q, H) {
    H = H || hoursOf(); var tmr = q.date && q.date > todayStr();
    if (q.kind === 'pickup') return { big: (tmr ? 'พรุ่งนี้ ' : '') + 'มารับได้ ' + q.at + ' ถึง ' + q.until + ' น.', sub: 'ร้านแจ้งในแชตเมื่อจัดของเสร็จ' };
    if (q.kind === 'morning') return { big: 'ส่งเที่ยวแรก' + (tmr ? 'พรุ่งนี้' : 'เช้านี้') + ' ถึงก่อน ' + q.at + ' น.', sub: tmr ? 'ร้านปิดรับออเดอร์ส่งวันนี้หลัง ' + H.lastDeliver + ' น.' : 'ร้านเปิด ' + H.open + ' น.' };
    /* 3.1.4 ลูกค้าไม่เห็นเป้าเวลาส่งของร้าน (ใช้ภายในร้าน) บอกเวลาที่คาดว่าจะถึงอย่างเดียว */
    if (!q.at) return { big: 'กำลังคำนวณเวลาส่งถึง', sub: 'คำนวณจากรถที่ว่างตอนนี้' };
    return { big: 'ส่งถึงประมาณ ' + q.at + ' น.', sub: q.within === false ? 'ช่วงนี้มีออเดอร์ส่งหลายจุด เวลาโดยประมาณ' : 'เวลาโดยประมาณ' };
  }
  function etaCard(mode) {
    var q = S.ui.eta && S.ui.etaFor === mode ? S.ui.eta : localQuote(mode), x = etaText(q);
    return '<div class="eta-card' + (q.kind === 'morning' ? ' later' : '') + '" aria-live="polite"><span class="eta-ic">' + icon(q.kind === 'pickup' ? 'shop' : 'clock') + '</span><div><b>' + esc(x.big) + '</b><small>' + esc(x.sub) + '</small></div></div>';
  }
  function etaRules() {
    var H = hoursOf();
    return '<details class="eta-rules"><summary>ร้านจัดรอบให้อัตโนมัติ แตะดูเวลาส่ง</summary><table><tbody>' +
      '<tr><th>สั่ง ' + H.open + ' ถึง ' + H.lastDeliver + ' น.</th><td>ส่งวันนี้ ดูเวลาที่คาดว่าจะถึงก่อนกดสั่ง</td></tr>' +
      '<tr><th>สั่งหลัง ' + H.lastDeliver + ' น.</th><td>ส่งเที่ยวแรกพรุ่งนี้ ถึงก่อน ' + H.morningDue + ' น.</td></tr>' +
      '<tr><th>สั่งก่อน ' + H.open + ' น.</th><td>ส่งเที่ยวแรก ถึงก่อน ' + H.morningDue + ' น.</td></tr>' +
      '<tr><th>รับเองที่ร้าน</th><td>สั่งและมารับได้ถึง ' + H.close + ' น.</td></tr></tbody></table></details>';
  }
  function etaFetch(k) {
    if (!etaMode() || !/^(deliver|shop)$/.test(k.mode)) return;
    var a = k.mode === 'deliver' ? shipAddr() : null, key = [k.mode, a ? a.id : '', Math.round(k.kg * 2), Math.floor(Date.now() / 120000)].join('|');
    if (S.ui.etaKey === key) return;
    S.ui.etaKey = key; if (S.ui.etaFor !== k.mode) S.ui.eta = null;
    clearTimeout(S.ui.etaT);
    S.ui.etaT = setTimeout(function () {
      api('deliveryEta', { mode: k.mode, kg: k.kg, addrId: a ? a.id : '' }, { quiet: true, tries: 2 }).then(function (r) {
        if (S.ui.etaKey !== key) return;
        S.ui.eta = r.quote; S.ui.etaFor = k.mode;
        var box = app.querySelector('.eta-card'); if (S.page === 'cart' && box) box.outerHTML = etaCard(k.mode);
      }).catch(function () { S.ui.etaKey = ''; });
    }, 200);
  }
  function couponStrip(cp) {
    if (!cp || !(cp.left > 0) || !(cp.expires >= todayStr())) return '';
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

  /* ---------- v3: Smart Set / Magnet Set / แต้มสะสม / พื้นที่จัดส่ง ---------- */
  /* v3.1.1 ชื่อโปรที่ลูกค้าเห็นเป็นภาษาธรรมดา (หลังร้านยังเรียก Smart Set / Magnet Set ตามเดิม) */
  var SMART_TH = 'ซื้อคู่พิเศษ', MAGNET_TH = 'ส่วนลดครั้งแรก';
  function smartName(pct) { return SMART_TH + 'ลด ' + pct + '%'; }
  function magnetName(pct) { return MAGNET_TH + ' ' + pct + '%'; }
  function smartOn() { var c = S.cat.cfg; return c.SMART_ENABLED !== false && Number(c.SMART_DISCOUNT) > 0; }
  function magnetMine() { var g = S.me && S.me.magnet; return g && g.available && S.cat.cfg.MAGNET_ENABLED !== false ? g : null; }
  function pointsOn() { var c = S.cat.cfg; return c.POINTS_ENABLED !== false && Number(c.POINT_REDEEM_UNIT) > 0; }
  function ptsBal() { return (S.me && S.me.points && Number(S.me.points.bal)) || 0; }
  function fmtPts(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); }
  function featuredMap() {
    if (String(S.cat.cfg.SMART_SCOPE || 'POOL').toUpperCase() !== 'FEATURED') return null;
    var f = {}; ((S.cat.smart || {}).items || []).forEach(function (i) { f[i.sku] = 1; }); return f;
  }
  /* ราคาเมื่อใช้สิทธิ์ Smart Set (null = สินค้านี้ใช้สิทธิ์ไม่ได้) */
  function smartPriceOf(p) {
    var c = S.cat.cfg, feat = featuredMap();
    if (!smartOn() || !p || !p.smart || Number(p.kg) > (Number(c.SMART_MAX_ITEM_KG) || 1.1) + 1e-9 || (feat && !feat[p.sku])) return null;
    return promoPrice(p.tiers[0].price, Number(c.SMART_DISCOUNT));
  }
  function promoTags(p, prefer) {
    var c = S.cat.cfg, t = '';
    if (smartOn() && p.promoCat === 'Main') t += '<span class="tag main">สินค้าหลัก</span>';
    var useMg = p.magnet && magnetMine() && !(prefer === 'smart' && smartPriceOf(p)); // ป้ายโปรเดียวต่อสินค้า
    if (useMg) t += '<span class="tag magnet">' + MAGNET_TH + ' −' + c.MAGNET_DISCOUNT + '%</span>';
    else if (smartPriceOf(p)) t += '<span class="tag smart">' + SMART_TH + ' −' + c.SMART_DISCOUNT + '%</span>';
    if (p.stockLow && p.inStock) t += '<span class="tag low">ใกล้หมด</span>';
    return t;
  }
  function midnightLeft() { var t = nowHM().split(':'), m = 24 * 60 - (Number(t[0]) * 60 + Number(t[1])); return (Math.floor(m / 60) ? Math.floor(m / 60) + ' ชม. ' : '') + (m % 60) + ' นาที'; }
  function magnetCond(g) { return 'ลดสินค้าที่ร่วมรายการ ' + g.pct + '% สูงสุด ' + baht(g.cap) + ', ยอดหลังหักส่วนลดต้องถึง ' + baht(g.minNet) + ', ใช้ได้ 1 ครั้ง (1 บิลใช้ได้ 1 โปร)' + (g.expires ? ', ใช้ได้ถึง ' + thDate(g.expires) : ''); }
  function magnetBanner() {
    var g = magnetMine(); if (!g) return '';
    return '<div class="magnet-banner">' + icon('wallet') + '<span><b>' + esc(magnetName(g.pct)) + '</b><small>สำหรับลูกค้าใหม่' + (g.expires ? ' ใช้ได้ถึง ' + esc(thDate(g.expires)) : '') + '</small><details class="cond"><summary>ดูเงื่อนไข</summary>' + esc(magnetCond(g)) + '</details></span></div>';
  }
  /* แถบสิทธิ์ Smart Set: ซื้อสินค้าหลักทุก 1 กก. = ลด 30% สินค้า Smart Set 1 ชิ้น */
  function smartBar(k) {
    if (!smartOn()) return '';
    var c = S.cat.cfg, sm = k.promo.smart, trig = Number(c.SMART_TRIGGER_KG) || 1, prog = Math.max(0, Math.min(1, 1 - sm.nextKg / trig));
    return '<div class="smart-bar"><div><b>สิทธิ์' + SMART_TH + ' ' + sm.rights + ' ชิ้น</b>' + (sm.rights ? '<span> ใช้แล้ว ' + sm.used + (sm.unused ? ', <span class="ok-t">เหลือ ' + sm.unused + '</span>' : '') + '</span>' : '') +
      '<small>ซื้อสินค้าหลักอีก ' + fmt(sm.nextKg) + ' กก. ได้เพิ่ม 1 ชิ้น (ทุก ' + trig + ' กก. ลด ' + c.SMART_DISCOUNT + '% ได้ 1 ชิ้น ไม่จำกัด)</small></div><div class="kg-bar" aria-hidden="true"><span style="width:' + Math.round(prog * 100) + '%"></span></div></div>';
  }
  /* Smart Set วันนี้: 6 รายการ (1 หมวด 1 รายการ) เปลี่ยนชุดทุกเที่ยงคืน */
  function smartToday() {
    var sm = S.cat.smart, c = S.cat.cfg;
    if (!smartOn() || !sm || !(sm.items || []).length) return '';
    var items = sm.items.map(function (it) { return { it: it, p: prod(it.sku) }; }).filter(function (x) { return x.p; });
    if (!items.length) return '';
    return '<section class="box product-section smart-today"><div class="section-heading"><h2>' + icon('set') + ' ' + SMART_TH + 'วันนี้ ลด ' + sm.pct + '%</h2></div><p class="section-sub">ซื้อสินค้าหลักทุก ' + (Number(c.SMART_TRIGGER_KG) || 1) + ' กก. ลดสินค้าในชุดนี้ ' + sm.pct + '% ได้ 1 ชิ้น' + (String(sm.scope).toUpperCase() === 'FEATURED' ? '' : ' (สินค้าที่มีป้าย "' + SMART_TH + '" ชิ้นอื่นก็ใช้ได้)') + '<br>เปลี่ยนชุดใน ' + midnightLeft() + '</p>' +
      items.map(function (x) { return prodRow(x.p, S.cart, 'smart'); }).join('') + '</section>';
  }
  /* สมุดที่อยู่ + ตรวจพื้นที่ส่ง (ตรงกับหลังบ้าน areaDecide_) */
  function addrList() { return (S.me && S.me.addresses) || []; }
  function shipAddr() { var L = addrList(), id = S.cart && S.cart.addrId; return L.filter(function (a) { return a.id === id; })[0] || L.filter(function (a) { return a.isDefault; })[0] || L[0] || null; }
  function excOn(v) { v = String(v || ''); if (!v) return false; var m = /(\d{4}-\d{2}-\d{2})/.exec(v); return !m || m[1] >= todayStr(); }
  function isShopPin(lat, lng) { var A = S.cat.cfg.AREA || {}, sh = A.shop || []; return Math.abs(Number(lat) - Number(sh[0])) < 1e-5 && Math.abs(Number(lng) - Number(sh[1])) < 1e-5; }
  function areaOf(a) {
    var A = S.cat.cfg.AREA || {}, m = S.me.member || {};
    if (!A.enabled || !(A.poly || []).length || A.poly.length < 3) return { ok: true, status: 'off' };
    if (excOn(m.areaExc) || (a && a.exc)) return { ok: true, status: 'exc' };
    var lat = a ? a.lat : m.lat, lng = a ? a.lng : m.lng;
    var g = lat && lng && !isShopPin(lat, lng) ? geoArea(lat, lng, A.poly, A.band) : { status: 'none', distM: 0 };
    if (g.status === 'in' || g.status === 'band') return { ok: true, status: g.status, distM: g.distM };
    if (A.grace && (a ? a.source === 'legacy' : !!m.legacyPin)) return { ok: true, status: 'grace', raw: g.status, distM: g.distM }; // 3.1.4 ไม่มีสมุดที่อยู่: ผ่อนผันเฉพาะลูกค้าเดิมที่ยังไม่เคยบันทึกที่อยู่ (ตรงกับหลังบ้าน)
    return { ok: false, status: g.status, distM: g.distM };
  }
  function areaPill(ar) {
    return { 'in': '<span class="pill paid">ในพื้นที่ส่ง</span>', band: '<span class="pill appr">ขอบพื้นที่ · ส่งได้</span>', exc: '<span class="pill appr">ร้านอนุญาตส่งพิเศษ</span>',
      grace: '<span class="pill new">หมุดเดิม · กรุณาปักหมุดใหม่' + (S.cat.cfg.AREA && S.cat.cfg.AREA.grace ? ' ภายใน ' + esc(thDate(S.cat.cfg.AREA.grace)) : '') + '</span>', out: '<span class="pill red">นอกพื้นที่ส่ง</span>', none: '<span class="pill new">ยังไม่มีหมุด</span>' }[ar.status] || '';
  }
  function areaChip(lat, lng) {
    var A = S.cat.cfg.AREA || {};
    if (!lat || !lng) return '<span class="area-chip none">' + icon('pin') + ' ยังไม่ได้ปักหมุด</span>';
    if (isShopPin(lat, lng)) return '<span class="area-chip out">' + icon('alert') + ' หมุดอยู่ที่ร้านพอดี · เลื่อนไปที่อยู่ของคุณ</span>';
    if (!A.enabled || !(A.poly || []).length) return '<span class="area-chip in">' + icon('check') + ' ปักหมุดแล้ว</span>';
    var g = geoArea(lat, lng, A.poly, A.band);
    if (g.status === 'in') return '<span class="area-chip in">' + icon('check') + ' อยู่ในพื้นที่จัดส่ง</span>';
    if (g.status === 'band') return '<span class="area-chip band">' + icon('check') + ' ขอบพื้นที่ (ห่างขอบ ' + fmt(g.distM) + ' ม.) · ส่งได้</span>';
    return '<span class="area-chip out">' + icon('alert') + ' นอกพื้นที่จัดส่ง (~' + (Math.round(g.distM / 100) / 10) + ' กม. จากขอบ) · บันทึกได้ แต่ส่งไม่ได้ เลือกรับเองที่ร้านได้</span>';
  }
  /* ตะกร้า: ส่งที่ไหน (แบบ Grab: การ์ดเดียวบอกที่อยู่ + ส่งได้หรือไม่ แตะเพื่อเปลี่ยน) */
  var AREA_LINE = { 'in': 'อยู่ในพื้นที่จัดส่ง', band: 'อยู่ขอบพื้นที่จัดส่ง ส่งได้', exc: 'ร้านอนุญาตส่งพิเศษ', grace: 'หมุดเดิม ส่งได้ชั่วคราว กรุณาปักหมุดใหม่', out: 'อยู่นอกพื้นที่จัดส่ง ส่งไม่ได้', none: 'ยังไม่ได้ปักหมุด ส่งไม่ได้' };
  function shipCard(k) {
    var a = shipAddr(), ar = areaOf(a), L = addrList();
    if (ar.status === 'off' && !L.length) return '';
    var cls = !ar.ok ? 'bad' : ar.status === 'grace' ? 'warn' : 'ok', line = AREA_LINE[ar.status] || '';
    if (ar.status === 'out' && ar.distM) line += ' (เลยขอบประมาณ ' + (Math.round(ar.distM / 100) / 10) + ' กม.)';
    return '<button class="ship-card ' + cls + '" data-a="shipTo" aria-label="เปลี่ยนที่อยู่จัดส่ง"><span class="ship-ic">' + icon('pin') + '</span><span class="ship-txt"><small>ส่งที่</small><b>' + (a ? esc(a.label) : 'เพิ่มที่อยู่จัดส่ง') + '</b>' +
      (a && (a.address || a.landmark) ? '<span class="ship-addr">' + esc([a.address, a.landmark].filter(Boolean).join(' ')) + '</span>' : !a ? '<span class="ship-addr">ปักหมุดตำแหน่งที่ให้ร้านส่งของ</span>' : '') +
      (line ? '<span class="area-line ' + cls + '">' + icon(ar.ok ? 'check' : 'alert') + '<span>' + esc(line) + '</span></span>' : '') + '</span><span class="chev">' + icon('chev') + '</span></button>' + (ar.ok ? '' : areaOutCard(ar));
  }
  function areaOutCard(ar) {
    var cfg = S.cat.cfg, none = ar.status === 'none', br = (cfg.BRANCHES || []).filter(function (b) { return b.active !== false; });
    return '<div class="area-out" role="alert"><b>' + (none ? 'ปักหมุดที่อยู่ก่อนสั่งแบบส่งถึงที่' : 'ขออภัยค่ะ ที่อยู่นี้อยู่นอกพื้นที่จัดส่ง') + '</b><div class="area-opts">' +
      (cfg.PICKUP_SHOP !== false ? '<button class="btn sm pri" data-a="setMode" data-p="shop">รับเองที่ร้านแทน</button>' : '') +
      '<button class="btn sm" data-a="shipTo">' + icon('pin') + (none ? ' ปักหมุดที่อยู่' : ' เปลี่ยนที่อยู่') + '</button>' +
      (addFriendUrl() ? '<button class="btn sm" data-a="addFriend">แชตถามร้าน</button>' : '') + '</div>' +
      (!none && br.length ? '<div class="branch-list"><b>สาขาใกล้คุณ</b>' + br.map(function (b) { return '<div class="row"><span>' + esc(b.name) + (b.hours ? '<br><small class="hint">' + esc(b.hours) + '</small>' : '') + '</span><span>' + (b.phone ? '<a class="mono" href="tel:' + esc(b.phone) + '">' + esc(b.phone) + '</a>' : '') + (b.line ? ' <button class="btn sm" data-a="openLink" data-u="' + esc(b.line) + '">LINE</button>' : '') + '</span></div>'; }).join('') + '</div>' : '') + '</div>';
  }
  /* หน้าเลือกที่อยู่จัดส่ง (แบบ Grab) */
  function pageShipTo() {
    var L = addrList(), cur = shipAddr(), A = S.cat.cfg.AREA || {};
    var h = top('ส่งที่ไหน', 'เลือกที่อยู่จัดส่ง', true) + '<div class="wrap ship-page">';
    h += L.length < 5 ? '<button class="ship-new" data-a="addrNew" data-ret="cart">' + icon('plus') + '<span><b>ปักหมุดที่อยู่ใหม่</b><small>ใช้ตำแหน่งปัจจุบัน หรือเลื่อนแผนที่ให้ตรงจุดส่ง</small></span>' + icon('chev') + '</button>' : '<div class="alert info">บันทึกได้สูงสุด 5 ที่ ลบที่อยู่เก่าที่หน้าบัตรสมาชิกก่อนเพิ่มใหม่</div>';
    if (L.length) h += '<h2 class="ship-h">ที่อยู่ที่บันทึกไว้</h2><div class="ship-list">' + L.map(function (a) {
      var ar = areaOf(a), on = cur && cur.id === a.id, cls = !ar.ok ? 'bad' : ar.status === 'grace' ? 'warn' : 'ok';
      return '<div class="ship-item' + (on ? ' on' : '') + '"><button class="ship-use" data-a="shipUse" data-id="' + esc(a.id) + '" aria-pressed="' + !!on + '"><span class="ship-ic">' + icon(on ? 'check' : 'pin') + '</span><span class="ship-txt"><b>' + esc(a.label) + (a.isDefault ? ' <small class="pill">หลัก</small>' : '') + '</b><span class="ship-addr">' + esc([a.address, a.landmark].filter(Boolean).join(' ') || 'ปักหมุดแล้ว') + '</span><span class="area-line ' + cls + '">' + icon(ar.ok ? 'check' : 'alert') + '<span>' + esc(AREA_LINE[ar.status] || 'ส่งได้') + '</span></span></span></button><button class="text-btn" data-a="addrEdit" data-id="' + esc(a.id) + '" data-ret="cart">แก้</button></div>';
    }).join('') + '</div>';
    else h += '<div class="empty">' + icon('pin') + '<b>ยังไม่มีที่อยู่จัดส่ง</b><span>ปักหมุดครั้งเดียว ครั้งต่อไปเลือกได้เลย</span></div>';
    if (A.enabled && S.cat.cfg.PICKUP_SHOP !== false) h += '<p class="hint ship-foot">ร้านส่งได้ในพื้นที่รอบร้าน ถ้าอยู่นอกพื้นที่ เลือก "รับเองที่ร้าน" ได้ในตะกร้า</p>';
    render(h + '</div>');
  }
  /* ตะกร้า: โปรโมชันบิลนี้ (1 บิล 1 โปร: Smart หรือ Magnet) + ข้อความชวนเพิ่มของ */
  function promoBox(k) {
    var pr = k.promo, sm = pr.smart, mg = pr.magnet, c = S.cat.cfg, h = '', n = [], trig = Number(c.SMART_TRIGGER_KG) || 1;
    if (!sm.on && !mg.on) return '';
    if (pr.both) {
      h += '<div class="hint">ใช้ได้ 1 โปรต่อบิล ระบบเลือกแบบที่ลดมากกว่าให้แล้ว เปลี่ยนได้</div><div class="promo-pick">' +
        '<label class="chk"><input type="radio" name="promo" value="SMART" data-chg="promo"' + (k.promoKind === 'SMART' ? ' checked' : '') + '><span><b>' + SMART_TH + ' ลด ' + baht(sm.disc) + '</b><small>ลด ' + c.SMART_DISCOUNT + '% ' + sm.used + ' ชิ้น ' + MAGNET_TH + 'เก็บไว้ใช้บิลถัดไป</small></span></label>' +
        '<label class="chk"><input type="radio" name="promo" value="MAGNET" data-chg="promo"' + (k.promoKind === 'MAGNET' ? ' checked' : '') + '><span><b>' + MAGNET_TH + ' ลด ' + baht(mg.disc) + '</b><small>ลูกค้าใหม่ ใช้ได้ครั้งเดียว' + (mg.capped ? ' (ลดได้สูงสุด ' + baht(mg.cap) + ')' : '') + '</small></span></label></div>';
    } else if (k.promoKind === 'SMART') h += '<div class="row disc"><span>' + SMART_TH + ' ลด ' + c.SMART_DISCOUNT + '% (' + sm.used + ' ชิ้น)</span><span class="num">−' + baht(sm.disc) + '</span></div>';
    else if (k.promoKind === 'MAGNET') h += '<div class="row disc"><span>' + magnetName(c.MAGNET_DISCOUNT) + (mg.capped ? ' (สูงสุด ' + baht(mg.cap) + ')' : '') + '</span><span class="num">−' + baht(mg.disc) + '</span></div>';
    if (sm.on && k.promoKind !== 'MAGNET') {
      if (sm.unused > 0) n.push('<button class="nudge-line act" data-a="go" data-p="catalog" data-cat="promo">ยังมีสิทธิ์' + SMART_TH + ' ลด ' + c.SMART_DISCOUNT + '% อีก <b>' + sm.unused + ' ชิ้น</b> เลือกของลด →</button>');
      else if (sm.cands > sm.used) n.push('<div class="nudge-line">ซื้อสินค้าหลักเพิ่มอีก <b>' + fmt(sm.nextKg) + ' กก.</b> ลดสินค้า' + SMART_TH + 'ในตะกร้าได้อีก 1 ชิ้น</div>');
      else if (!sm.rights) n.push('<div class="nudge-line">ซื้อสินค้าหลัก (ป้าย "สินค้าหลัก") ครบ ' + trig + ' กก. ได้สิทธิ์' + SMART_TH + ' ลด ' + c.SMART_DISCOUNT + '% 1 ชิ้น</div>');
    }
    if (mg.on && !mg.ok) n.push(mg.short > 0 ? '<div class="nudge-line">' + MAGNET_TH + ': ' + esc(mg.why) + '</div>' : '<button class="nudge-line act" data-a="go" data-p="catalog" data-cat="promo">ใช้' + magnetName(c.MAGNET_DISCOUNT) + ' (สูงสุด ' + baht(mg.cap) + ') เลือกสินค้าที่ร่วมรายการ →</button>');
    if (mg.on && k.promoKind === 'SMART') n.push('<div class="nudge-line">' + MAGNET_TH + 'ของคุณยังอยู่ ใช้บิลถัดไปได้' + (mg.expires ? ' ถึง ' + esc(thDate(mg.expires)) : '') + '</div>');
    if (!h && !n.length) return '';
    return '<section class="box promo-box"><h3>' + icon('set') + ' โปรโมชันบิลนี้</h3>' + h + n.join('') + '</section>';
  }
  function couponLabel(step) {
    var o = S.me && S.me.offer;
    return o && /^AFF-/.test(o.id || '') ? 'คูปองร้านผู้แนะนำ' : 'ส่วนลดลูกค้าใหม่' + (step !== undefined ? ' บิลที่ ' + (step + 1) : '');
  }
  /* อ่าน/คืนค่าฟอร์ม (ไปปักหมุดแล้วกลับมา ข้อมูลที่พิมพ์ไว้ไม่หาย) */
  function formVals(name) {
    var f = app.querySelector('form[data-form="' + name + '"]'), o = {}; if (!f) return o;
    Array.prototype.forEach.call(f.elements, function (el) { if (!el.name || el.type === 'file' || el.type === 'submit' || el.type === 'button') return; if (el.type === 'checkbox') o[el.name] = el.checked; else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; } else o[el.name] = el.value; });
    return o;
  }
  function fillForm(name, o) {
    if (!o) return; var f = app.querySelector('form[data-form="' + name + '"]'); if (!f) return;
    Array.prototype.forEach.call(f.elements, function (el) { if (!el.name || o[el.name] === undefined || el.type === 'file') return; if (el.type === 'checkbox') el.checked = !!o[el.name]; else if (el.type === 'radio') el.checked = o[el.name] === el.value; else el.value = o[el.name]; });
  }

  /* ---------- นำทาง ---------- */
  var MEMBER_PAGES = { catalog: 1, cart: 1, bills: 1, bill: 1, invite: 1, wallet: 1, standing: 1, card: 1, reorder: 1, address: 1, shipto: 1 };
  function go(page, params, noPush) {
    if (page === 'standing' && S.page !== 'standing') S.ui.stDraft = null; // เปิดหน้าสั่งประจำใหม่ = เริ่มจากรายการที่บันทึกไว้
    if (!noPush) S.history.push({ page: S.page, params: S.params });
    S.page = page; S.params = params || {};
    window.scrollTo(0, 0);
    show();
  }
  function back() { var h = S.history.pop(); if (h) { S.page = h.page; S.params = h.params; show(); } else go('home', {}, true); }
  function backTo(page) { while (S.history.length) { var h = S.history.pop(); if (h.page === page) { S.page = h.page; S.params = h.params; window.scrollTo(0, 0); return show(); } } go(page, {}, true); }
  function render(html) {
    if (S.ui.mapObj && S.page !== 'pin') dropMap(); // ออกจากหน้าปักหมุด → คืนหน่วยความจำของแผนที่
    var samePage = app.dataset.page === S.page;
    var scrollers = ['.chips', '.bundle-grid', '.tabs'].map(function (selector) { var el = app.querySelector(selector); return { selector: selector, left: samePage && el ? el.scrollLeft : 0 }; });
    var active = document.activeElement, searchFocus = active && active.id === 'catalog-search';
    var selection = searchFocus ? active.selectionStart : 0;
    var control = active && active.dataset && /^(qty|cat|toTier)$/.test(active.dataset.a) ? { a: active.dataset.a, k: active.dataset.k, p: active.dataset.p, d: active.dataset.d } : null;
    var changeControl = active && active.dataset ? active.dataset.chg : null;
    if (S.page !== 'admin') document.documentElement.removeAttribute('data-theme'); // ธีมมืด/สว่างที่เลือกเอง ใช้เฉพาะหน้าหลังร้าน
    document.documentElement.classList.toggle('cust', S.page !== 'admin'); // v3.1.1 ตัวอักษรฝั่งลูกค้าอ่านง่ายขึ้น
    app.innerHTML = (S.page !== 'admin' ? uatBar() : '') + html + navBar(); // 3.1.3 แถบสวมบท/นาฬิกาจำลอง (หลังร้านแสดงในแถบของหลังร้าน)
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
      '<div class="t"><span class="brand-name">BETAGRO SHOP <span>โพธิ์แก้ว</span></span><h1>' + esc(title) + '</h1>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>' + (extra || '') +
      (S.page !== 'home' ? '<button class="ic" data-a="home" aria-label="หน้าแรก">' + icon('home') + '</button>' : '') + '</div></header>';
  }
  /* ---------- หน้าหลังร้าน: โครงหน้าเดียวกันทั้งตอนกำลังโหลดและโหลดเสร็จ (เมนูซ้าย + ปุ่มมุมขวา) ---------- */
  function adminTheme() {
    var t = store('pk2_theme') || '', r = document.documentElement;
    if (t === 'dark' || t === 'light') r.setAttribute('data-theme', t); else r.removeAttribute('data-theme');
    return t;
  }
  function isDark() { var t = adminTheme(); return t ? t === 'dark' : !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
  function adminTools(o) {
    o = o || {};
    return '<button class="ic" data-a="admSound" aria-label="' + (o.sound === false ? 'เปิดเสียงแจ้งเตือน' : 'ปิดเสียงแจ้งเตือน') + '" title="เสียงแจ้งเตือนออเดอร์ใหม่">' + icon(o.sound === false ? 'mute' : 'bell') + '</button>' +
      '<button class="ic" data-a="refresh" aria-label="โหลดใหม่" title="โหลดใหม่">' + icon('repeat') + '</button>' +
      '<button class="ic" data-a="admLogout" aria-label="ออกจากระบบ" title="ออกจากระบบ">' + icon('out') + '</button>' +
      '<button class="ic" data-a="home" aria-label="หน้าแรก" title="หน้าแรก">' + icon('home') + '</button>';
  }
  function adminFrame(o) {
    o = o || {};
    var st = staffNowCore(), dark = isDark();
    var nav = o.nav ? o.nav.map(function (x) {
      return '<button class="side-link' + (x.on ? ' on' : '') + '" data-a="tab" data-p="' + esc(x.id) + '"' + (x.on ? ' aria-current="page"' : '') + '>' + (x.icon || '') + '<span>' + esc(x.label) + '</span>' + (x.badge ? '<b class="cnt">' + esc(x.badge) + '</b>' : '') + '</button>';
    }).join('') : new Array(9).join('<span class="side-skel" aria-hidden="true"></span>');
    return '<div class="adm' + (S.ui.navOpen ? ' nav-open' : '') + '">' +
      '<aside class="adm-side" id="adm-side" aria-label="เมนูหลังร้าน"><div class="side-brand"><span class="brand-symbol">' + icon('shop') + '</span><div><b>BETAGRO SHOP</b><span>สาขาโพธิ์แก้ว</span></div></div>' +
      '<div class="side-user"><b>หน้าหลังร้าน</b><small>' + esc(st.label || st.role || 'พนักงาน') + '</small><small>' + esc(st.name || '') + '</small></div>' +
      '<nav class="side-nav">' + nav + '</nav>' +
      '<div class="side-foot"><button class="theme-btn" data-a="admTheme" aria-pressed="' + dark + '">' + icon(dark ? 'sun' : 'moon') + '<span>' + (dark ? 'โหมดสว่าง' : 'โหมดมืด') + '</span></button><small class="hint">v' + APP_VERSION + '</small></div></aside>' +
      '<div class="adm-scrim" data-a="admNav" aria-hidden="true"></div>' +
      '<div class="adm-main"><header class="adm-top"><button class="ic adm-menu" data-a="admNav" aria-label="เปิดเมนู" aria-controls="adm-side">' + icon('menu') + '</button><h1>' + esc(o.title || 'หน้าหลังร้าน') + '</h1><div class="adm-tools">' + (o.tools || adminTools()) + '</div></header>' +
      (o.banner || '') + '<div class="wrap wide">' + (o.body || '') + '</div></div></div>';
  }
  function staffNowCore() { return (window.PKAdmin && window.PKAdmin.staffNow ? window.PKAdmin.staffNow() : (S.me && S.me.staff)) || {}; }
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
    if (p === 'pin') return pagePin();
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
    if (p === 'address') return pageAddress();
    if (p === 'shipto') return pageShipTo();
    return pageHome();
  }
  function bootScreen(msg) {
    render('<div class="boot" role="status"><span class="boot-brand">BETAGRO SHOP</span><span class="spinner" aria-hidden="true"></span><b>' + esc(msg || 'กำลังเปิดร้านโพธิ์แก้ว') + '</b><small>รอสักครู่</small></div>');
  }

  /* ---------- หน้าแรก ---------- */
  function pageHome() {
    var m = S.me.member, cfg = S.cat.cfg;
    if (!m) {
      return render(top('ยินดีต้อนรับค่ะ', '', false) + '<div class="wrap">' + hero() +
        '<div class="intro"><h2>สั่งวัตถุดิบให้ร้านคุณ<br>ง่ายขึ้นในทุกวัน</h2><p>เลือกสินค้า ดูบิล และใช้สิทธิ์สมาชิกในที่เดียว</p></div>' +
        (cfg.MAGNET_ENABLED !== false && Number(cfg.MAGNET_DISCOUNT) > 0 ? '<div class="magnet-banner">' + icon('wallet') + '<span><b>ลูกค้าใหม่รับ' + magnetName(cfg.MAGNET_DISCOUNT) + '</b><small>ลดได้สูงสุด ' + baht(cfg.MAGNET_CAP) + ' ในออเดอร์แรก ลงทะเบียนประมาณ 1 นาที</small></span></div>' : '') +
        '<button class="btn pri block" data-a="go" data-p="register">เริ่มต้นลงทะเบียน ' + icon('arrow') + '</button><button class="btn block" data-a="go" data-p="link">เป็นลูกค้าเดิม · ผูกเลขสมาชิก</button>' +
        demoNote() + staffLinks() + '</div>');
    }
    if (m.rejected) return pageRejected();
    var sh = S.me.shared || {}, v3pts = pointsOn();
    var h = top('สวัสดีค่ะ ' + (sh.owner === false && sh.me ? sh.me + ' · ' : '') + m.name, (m.sno ? 'สมาชิก ' + m.sno : 'รอร้านยืนยันสมาชิก · สั่งของได้แล้ว') + (sh.owner === false ? ' · ใช้บัญชีร่วมกับ ' + (sh.ownerName || 'เจ้าของร้าน') : ''), false) + '<div class="wrap">';
    if (S.me.eveningDue) h += '<button class="notice warn" data-a="go" data-p="bill" data-id="' + esc(S.me.eveningDue.id) + '">' + icon('clock') + '<span><b>รอบเย็น' + esc(evDayText(S.me.eveningDue.date)) + ': โอนก่อน ' + esc(S.me.eveningDue.payBy.slice(11, 16)) + ' น. · ' + baht(S.me.eveningDue.amount) + '</b><small>แตะเพื่อสแกน QR และแนบสลิป · ไม่ทันเวลา ระบบเลื่อนเป็นคืนถัดไปให้</small></span>' + icon('arrow') + '</button>';
    if (S.me.unpaid) h += '<button class="notice warn" data-a="go" data-p="bills">' + icon('bill') + '<span><b>มีบิลรอชำระ ' + S.me.unpaid.count + ' ใบ · ' + baht(S.me.unpaid.amount) + '</b><small>แตะเพื่อดู QR และแนบสลิป</small></span>' + icon('arrow') + '</button>';
    if (S.me.outForDelivery) h += '<button class="notice info" data-a="go" data-p="bills">' + icon('truck') + '<span><b>ออเดอร์กำลังนำส่ง</b><small>' + (S.me.outEta ? 'ถึงประมาณ ' + esc(S.me.outEta) + ' น.' : 'แตะเพื่อดูรายละเอียด') + '</small></span>' + icon('arrow') + '</button>';
    if (S.me.friend === false && addFriendUrl()) h += '<button class="notice ok" data-a="addFriend">' + icon('bell') + '<span><b>เพิ่มเพื่อน LINE OA ของร้าน</b><small>เพื่อรับบิลยอดจริงและแจ้งเตือนในแชต</small></span>' + icon('arrow') + '</button>';
    if (m.linkPending) h += '<div class="alert info">' + icon('clock') + ' ร้านกำลังยืนยันบัญชีลูกค้าเดิมของคุณ (ภายใน 1 วันทำการ)<br>ระหว่างนี้สั่งของได้ตามปกติ ประวัติบิลและสิทธิ์เดิมจะแสดงหลังร้านยืนยัน</div>';
    if (m.status === 'review') h += '<div class="alert info">ร้านกำลังตรวจข้อมูลเพื่อยืนยันสิทธิ์ลูกค้าใหม่ (ภายใน 1 วันทำการ) · ระหว่างนี้สั่งของได้ตามปกติ</div>';
    if (m.couponLock === 'approval') h += '<div class="alert info">คูปองร้านผู้แนะนำจะใช้ได้หลังร้านยืนยันข้อมูลร้านของคุณ (ภายใน 1 วันทำการ)</div>';
    h += '<div class="section-heading"><h2>วันนี้ให้เราช่วยอะไรดี?</h2></div><div class="tiles">' +
      menuTile('catalog', 'สั่งของ', 'ดูราคา · โปรวันนี้', 'bag', true) + menuTile('reorder', 'สั่งเหมือนเดิม', 'จากออเดอร์ล่าสุด', 'repeat') + menuTile('bills', 'บิลของฉัน', 'ดูยอด · แจ้งชำระ', 'bill') +
      menuTile(S.me.canRefer ? 'invite' : 'card', S.me.canRefer ? 'ชวนเพื่อน' : 'บัตรสมาชิก', S.me.canRefer ? (cfg.REF_REWARD === 'points' ? 'รับแต้มผู้แนะนำ' : 'รับส่วนลดสะสม') : 'แสดง QR ที่ร้าน', S.me.canRefer ? 'invite' : 'card') +
      menuTile('wallet', 'สิทธิ์ของฉัน', v3pts ? 'แต้ม ส่วนลด คูปอง' : 'ส่วนลดสะสม คูปอง', 'wallet') + menuTile('standing', 'สั่งประจำ', 'จัดการรายการประจำ', 'clock') + '</div>';
    h += promoStrip();
    if (v3pts) h += '<button class="benefit-strip" data-a="go" data-p="wallet"><span class="benefit-icon">' + icon('coin') + '</span><span><small>แต้มสะสมใช้ได้</small><b>' + fmtPts(ptsBal()) + ' <span>แต้ม</span></b></span><span class="benefit-end">' +
      (S.me.points && S.me.points.pending ? 'พักไว้ ' + fmtPts(S.me.points.pending) + '<br>' : '') + (S.me.coinBal > 0 ? 'ส่วนลดสะสม ' + baht(S.me.coinBal) + '<br>' : '') + (m.credit > 0 ? 'เครดิต ' + baht(m.credit) + '<br>' : '') + (S.me.saved > 0 ? 'ประหยัดแล้ว ' + baht(S.me.saved) + '<br>' : '') + 'ดูสิทธิ์ของฉัน →</span></button>';
    else h += '<button class="benefit-strip" data-a="go" data-p="wallet"><span class="benefit-icon">' + icon('coin') + '</span><span><small>ส่วนลดสะสมพร้อมใช้</small><b>' + baht(S.me.coinBal) + '</b></span><span class="benefit-end">' +
      (S.me.coinPending ? 'รออนุมัติ ' + baht(S.me.coinPending) + '<br>' : '') + (m.credit > 0 ? 'เครดิต ' + baht(m.credit) + '<br>' : '') + 'ดูสิทธิ์ของฉัน →</span></button>';
    h += hero(true);
    h += staffLinks() + demoNote() + '</div>';
    render(h);
  }
  /* v3.1.1 หน้าแรก: รวมโปรทั้งหมดเป็นกล่องเดียว เงื่อนไขละเอียดอยู่ที่หน้าสิทธิ์ของฉัน */
  function promoStrip() {
    var cfg = S.cat.cfg, g = magnetMine(), cp = S.me.coupon, sm = S.cat.smart, rows = [];
    if (g) rows.push(['wallet', magnetName(g.pct), 'ลูกค้าใหม่ ใช้ได้ 1 ครั้ง' + (g.expires ? ' ถึง ' + thDate(g.expires) : ''), 'catalog', 'promo']);
    if (smartOn() && sm && (sm.items || []).length) rows.push(['set', smartName(sm.pct), 'ซื้อสินค้าหลักทุก ' + (Number(cfg.SMART_TRIGGER_KG) || 1) + ' กก. ลดได้ 1 ชิ้น วันนี้ ' + sm.items.length + ' รายการ', 'catalog', 'promo']);
    if (cp && cp.left > 0 && cp.expires >= todayStr()) rows.push(['coin', 'ส่วนลดลูกค้าใหม่ บิลถัดไป' + (cp.text || ('ลด ' + cp.pct + '%' + (cp.cap ? ' (สูงสุด ' + baht(cp.cap) + ')' : ''))), 'ใช้ได้อีก ' + cp.left + ' บิล ถึง ' + thDate(cp.expires), 'wallet', '']);
    if (!rows.length) return '';
    return '<section class="box promo-strip"><div class="section-heading"><h2>สิทธิ์ของคุณวันนี้</h2><button class="text-btn" data-a="go" data-p="wallet">ดูเงื่อนไข</button></div>' + rows.map(function (r) {
      return '<button class="ps-row" data-a="go" data-p="' + r[3] + '"' + (r[4] ? ' data-cat="' + r[4] + '"' : '') + '><span class="ps-ic">' + icon(r[0]) + '</span><span class="ps-txt"><b>' + esc(r[1]) + '</b><small>' + esc(r[2]) + '</small></span>' + icon('chev') + '</button>';
    }).join('') + '</section>';
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
  function regPinBox() {
    var g = S.ui.regPin;
    return '<div class="geo-box pin-box">' + areaChip(g && g.lat, g && g.lng) + '<button type="button" class="btn sm" data-a="pinOpen" data-for="reg">' + icon('pin') + (g ? ' แก้หมุด' : ' ปักหมุดบนแผนที่') + '</button>' + (g ? '' : '<span class="hint">ร้านตรวจพื้นที่ส่งให้ทันที และส่งของได้ตรงจุด</span>') + '</div>';
  }
  function chKind(ch) { var m = /^(AFF|PARTNER|BOOTH|ORGANIC)\b/i.exec(String(ch || '')); return m ? m[1].toUpperCase() : ''; }
  function pageRegister() {
    var pr = S.params, cfg = S.cat.cfg, ck = chKind(pr.ch), isRef = !!pr.ref || ck === 'AFF', isSign = (!!pr.src && !pr.ref) || ck === 'PARTNER';
    var ty = S.ui.regType || (isSign ? 'Consumer' : 'FS'), src = isRef ? 'ref' : isSign ? 'sign' : 'self', of = offerFor('welcome', isSign ? 'Consumer' : ty, src);
    var mgOn = cfg.MAGNET_ENABLED !== false && Number(cfg.MAGNET_DISCOUNT) > 0, gifts = [];
    if (mgOn) gifts.push(magnetName(cfg.MAGNET_DISCOUNT) + ' (สูงสุด ' + baht(cfg.MAGNET_CAP) + ')');
    if (of) gifts.push('คูปอง ' + offerText(of) + (of.needsApproval ? ' (ใช้ได้หลังร้านยืนยันข้อมูลร้าน)' : ''));
    if (!mgOn && !of) { var planC = couponPlan(cfg, 'Consumer'); if (planC.pcts[0] > 0) gifts.push('ส่วนลดบิลแรก ' + planC.pcts[0] + '%' + (planC.pcts[1] ? ' และบิลที่สอง ' + planC.pcts[1] + '%' : '')); }
    var offer = gifts.length ? 'ลูกค้าใหม่' + (ty === 'FS' && !isSign ? ' (ร้านค้า) ' : '') + 'รับ ' + gifts.join(' + ') : '';
    var banner = isRef ? '<div class="alert ok">คุณได้รับคำชวนจากลูกค้าของร้าน · ' + esc(offer || 'ลงทะเบียนแล้วสั่งได้เลย') + '</div>' : isSign ? '<div class="alert ok">' + (offer ? esc(offer) + ' · ' : '') + 'รับของที่จุดรับ รอบ ' + esc(cfg.CONDO_TIME) + ' หรือให้ส่งถึงบ้านได้</div>' : offer ? '<div class="alert ok">' + esc(offer) + '</div>' : '';
    var sp = S.ui.shopPhoto, d0 = S.ui.regDraft || {}, fs = ty === 'FS';
    /* v3.1.1 กรอกเท่าที่จำเป็น: ชื่อ เบอร์ ปักหมุด ยินยอม ที่เหลือพับไว้ใน "ข้อมูลเพิ่มเติม (ไม่บังคับ)" · ย่านส่งให้ร้านกำหนดตอนอนุมัติ */
    var more = (!isSign ? '<div class="field"><label for="rg-contact">ชื่อผู้ติดต่อ</label><input id="rg-contact" name="contact" maxlength="60" autocomplete="name"></div>' +
        '<div class="field"><label for="rg-lm">จุดจอดรถ / คนรับของ</label><input id="rg-lm" name="deliveryNote" maxlength="120" placeholder="เช่น จอดหน้าซอย ฝากพี่แดง"></div>' : '') +
      (!isSign && fs ? tradeSelect('', 'rg-trade', 'trade') +
        '<div class="field"><label for="rg-tax">เลขผู้เสียภาษี 13 หลัก</label><input id="rg-tax" name="taxId" inputmode="numeric" maxlength="17" autocomplete="off" placeholder="ช่วยให้ร้านยืนยันสิทธิ์ลูกค้าใหม่ได้เร็วขึ้น"></div>' +
        '<div class="field"><span class="field-label">รูปหน้าร้าน</span><div class="slip-box shop-photo">' + (sp ? '<img src="' + sp.preview + '" alt="รูปหน้าร้านที่แนบ">' : '<span class="slip-ph">' + icon('camera') + '</span>') + '<div><b>' + (sp ? (sp.reading ? 'กำลังย่อรูป...' : 'แนบรูปแล้ว ✓') : 'ไม่บังคับ') + '</b><small class="hint">ร้านใช้ยืนยันว่าเป็นร้านจริง เก็บเป็นความลับ</small><label class="btn sm"><input type="file" accept="image/*" data-chg="shopPhoto" hidden>' + icon('camera') + (sp ? ' เปลี่ยนรูป' : ' ถ่าย / เลือกรูป') + '</label></div></div></div>' : '') +
      (!isRef && !isSign && cfg.REF_REWARD === 'points' ? '<div class="field"><label for="rg-ref">รหัสร้านที่แนะนำ</label><input id="rg-ref" name="refCode" maxlength="20" autocomplete="off" placeholder="เช่น S0000101234"></div>' : '');
    var moreOpen = !!(sp || d0.contact || d0.deliveryNote || d0.trade || d0.taxId || d0.refCode || S.ui.regMore);
    var h = top('ลงทะเบียน', isSign ? 'ใช้เวลาไม่ถึง 1 นาที' : 'กรอกชื่อ เบอร์ และปักหมุด ประมาณ 1 นาที', S.history.length > 0) + '<div class="wrap">' + banner + '<form class="box form reg-form" data-form="register" novalidate>' +
      (isSign ? '' : '<div class="field"><span class="field-label">ลงทะเบียนในนาม</span><div class="seg" role="radiogroup" aria-label="ลงทะเบียนในนาม">' +
        [['FS', 'ร้านค้า', 'ร้านอาหาร แม่ค้า', 'shop'], ['Consumer', 'บ้าน', 'ครัวเรือน', 'home']].map(function (x) { return '<label class="seg-opt"><input type="radio" name="type" value="' + x[0] + '" data-chg="regType"' + (ty === x[0] ? ' checked' : '') + '><span>' + icon(x[3]) + '<span class="seg-t"><b>' + x[1] + '</b><small>' + x[2] + '</small></span></span></label>'; }).join('') + '</div></div>') +
      '<div class="field"><label for="rg-name">' + (isSign ? 'ชื่อ' : fs ? 'ชื่อร้าน' : 'ชื่อของคุณ') + ' <span class="req">*</span></label><input id="rg-name" name="name" required maxlength="80" autocomplete="organization"></div>' +
      '<div class="field"><label for="rg-phone">เบอร์โทร <span class="req">*</span></label><input id="rg-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required maxlength="20" placeholder="0812345678"></div>' +
      (isSign ? '<div class="field"><label for="rg-addr">ตึก / ห้อง</label><input id="rg-addr" name="address" maxlength="120" placeholder="เช่น ตึก A ห้อง 1208"></div>' :
        '<div class="field"><span class="field-label">ที่อยู่จัดส่ง <span class="req">*</span></span>' + regPinBox() + '</div>' +
        '<div class="field"><label for="rg-addr">บ้านเลขที่ ซอย หรือจุดสังเกต</label><textarea id="rg-addr" name="address" rows="2" maxlength="200" autocomplete="street-address" placeholder="ช่วยให้คนส่งหาร้านเจอเร็ว เช่น 12/3 ซอยโพธิ์แก้ว 3 ตรงข้ามเซเว่น"></textarea></div>') +
      (more ? '<details class="reg-more"' + (moreOpen ? ' open' : '') + '><summary>ข้อมูลเพิ่มเติม (ไม่บังคับ)</summary>' + more + '</details>' : '') +
      '<label class="chk"><input type="checkbox" name="consent" required><span>ยินยอมให้ร้านเก็บชื่อ เบอร์ และที่อยู่ เพื่อจัดส่งและแจ้งบิล ขอดูหรือลบข้อมูลได้ <a href="privacy.html" target="_blank" rel="noopener">นโยบายข้อมูลส่วนบุคคล</a> <span class="req">*</span></span></label>' +
      '<label class="chk"><input type="checkbox" name="consentMkt"><span>รับข่าวโปรโมชันทาง LINE (ไม่บังคับ)</span></label>' +
      '<button class="btn pri block" type="submit"' + (sp && sp.reading ? ' disabled' : '') + '>ลงทะเบียน</button></form>' +
      (!isRef && !isSign ? '<button class="btn block" data-a="go" data-p="link">ฉันเป็นลูกค้าเดิม (ผูกเลขสมาชิก)</button>' : '') + '</div>';
    render(h);
    fillForm('register', S.ui.regDraft);
  }
  /* v3.1.0 ลูกค้าเดิมผูก LINE: ค้นด้วยเบอร์ / รหัส S / ชื่อร้าน → ยืนยันตามข้อมูลที่ร้านมี (เบอร์เต็ม / 4 ตัวท้าย / ให้ร้านยืนยัน) */
  function pageLink() {
    if (S.me.member) return pageHome();
    var L = S.ui.linkList, sel = S.ui.linkSel;
    if (!L && !sel && S.params.phone && !S.ui.linkAuto) { S.ui.linkAuto = true; S.ui.linkQ = S.params.phone; linkSearch(S.params.phone); }
    var h = top('ลูกค้าเดิมของร้าน', 'ผูก LINE กับข้อมูลที่ร้านมีอยู่', true) + '<div class="wrap">';
    if (sel) {
      h += '<form class="box form" data-form="linkConfirm"><div class="found-card">' + icon('shop') + '<span><b>' + esc(sel.name) + '</b><small>' + esc([sel.sno, sel.zone].filter(Boolean).join(' ')) + '</small></span></div>';
      if (sel.verify === 'phone') h += '<div class="alert ok">เบอร์ตรงกับข้อมูลของร้าน ยืนยันได้เลย</div>';
      else if (sel.verify === 'last4') h += '<div class="field"><label for="lk-l4">เบอร์โทร 4 ตัวท้าย ที่เคยให้ร้านไว้</label><input id="lk-l4" name="last4" class="mono" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" required autocomplete="off" placeholder="เช่น 0101"></div>';
      else h += '<div class="alert info">ร้านยังไม่มีเบอร์ของรายชื่อนี้ ใส่เบอร์ของคุณ ร้านจะยืนยันให้ภายใน 1 วันทำการ<br>ระหว่างนี้สั่งของได้ตามปกติ</div><div class="field"><label for="lk-ph">เบอร์โทรของคุณ</label><input id="lk-ph" name="phone" type="tel" inputmode="tel" autocomplete="tel" required></div>';
      h += '<label class="chk"><input type="checkbox" name="consent" required><span>ยินยอมตาม <a href="privacy.html" target="_blank" rel="noopener">นโยบายข้อมูลส่วนบุคคล</a></span></label><button class="btn pri block" type="submit">' + (sel.verify === 'staff' ? 'ส่งให้ร้านยืนยัน' : 'ยืนยันว่าเป็นร้านของฉัน') + '</button><button class="btn block" type="button" data-a="linkBack">ไม่ใช่ร้านนี้</button></form>';
    } else {
      h += '<form class="box form" data-form="linkFind"><div class="field"><label for="lk-q">เบอร์โทร รหัสสมาชิก หรือชื่อร้าน ที่เคยให้ร้านไว้</label><input id="lk-q" name="q" required minlength="2" maxlength="60" autocomplete="off" value="' + esc(S.ui.linkQ || '') + '" placeholder="เช่น 0891234567, S0000101234, ร้านเจ๊หมวย"></div><button class="btn pri block" type="submit">' + icon('search') + ' ค้นหา</button></form>';
      if (L && L.length) h += '<h3 class="group-h">แตะเลือกร้านของคุณ</h3><div class="link-list">' + L.map(function (x, i) { return '<button class="link-item" data-a="linkPick" data-i="' + i + '"><span><b>' + esc(x.name) + '</b><small>' + esc([x.sno, x.zone].filter(Boolean).join(' ')) + '</small></span>' + icon('chev') + '</button>'; }).join('') + '</div>' + (S.ui.linkMore ? '<div class="hint">พบหลายรายการ พิมพ์ให้ละเอียดขึ้นเพื่อกรอง</div>' : '');
      h += '<div class="link-new"><span class="hint">ไม่พบร้านของคุณ?</span><button class="btn sm" data-a="go" data-p="register">ลงทะเบียนใหม่</button>' + (addFriendUrl() ? '<button class="btn sm" data-a="addFriend">แชตถามร้าน</button>' : '') + '</div>';
    }
    render(h + '</div>');
  }
  function linkSearch(q) {
    S.ui.linkQ = q;
    return run('กำลังค้นหา...', api('linkFind', { q: q }), function (r) {
      S.ui.linkList = r.list || (r.found ? [r.found] : []); S.ui.linkMore = !!r.more; S.ui.linkSel = null;
      if (S.ui.linkList.length === 1 && S.ui.linkList[0].verify === 'phone') S.ui.linkSel = S.ui.linkList[0];
      if (S.page === 'link') pageLink();
    });
  }

  /* ---------- แคตตาล็อก ---------- */
  function stepper(kind, id, q) {
    var item = kind === 'p' ? prod(id) : S.cat.bundles.filter(function (b) { return b.id === id; })[0];
    var name = item ? item.name : id;
    if (!q) return '<button class="btn add-btn" data-a="qty" data-k="' + kind + '" data-p="' + esc(id) + '" data-d="1" aria-label="เพิ่ม ' + esc(name) + '"><span aria-hidden="true">＋</span> เพิ่ม</button>';
    return '<div class="step" role="group" aria-label="จำนวน ' + esc(name) + '"><button data-a="qty" data-k="' + kind + '" data-p="' + esc(id) + '" data-d="-1" aria-label="ลด ' + esc(name) + '">−</button><span aria-label="จำนวน ' + q + '">' + q + '</span><button data-a="qty" data-k="' + kind + '" data-p="' + esc(id) + '" data-d="1" aria-label="เพิ่ม ' + esc(name) + '">+</button></div>';
  }
  function tierText(p) { return p.tiers.map(function (t) { return '<span>' + t.min + '+ ' + esc(p.unit) + ' <b>' + baht(t.price) + '</b></span>'; }).join(''); }
  function prodRow(p, c, prefer) {
    var q = c.lines[p.sku] || 0, nt = null, mgOn = p.magnet && magnetMine() && !(prefer === 'smart' && smartPriceOf(p)), sp = mgOn ? null : smartPriceOf(p), tags = promoTags(p, prefer);
    p.tiers.forEach(function (t) { if (!nt && t.min > q) nt = t; });
    var near = q > 0 && nt && nt.min - q <= 2;
    return '<article class="prod' + (p.inStock ? '' : ' oos') + (p.img ? ' has-img' : '') + '">' + thumb(p, 'product-photo', p.cat) + '<div class="product-info"><h3 class="nm">' + esc(p.name) + '</h3>' + (p.promo || !p.inStock ? '<div class="product-meta">' + (p.promo ? '<span class="badge">ร่วมโปร</span>' : '') + (p.inStock ? '' : ' <span class="badge r">หมดวันนี้</span>') + '</div>' : '') + (tags ? '<div class="tags">' + tags + '</div>' : '') + '</div><div class="product-buy"><div><b class="price">' + baht(unitPrice(p, q || 1)) + '</b><small> / ' + esc(p.unit) + '</small>' + (mgOn && p.inStock ? '<small class="smart-hint">ใช้' + MAGNET_TH + ' ลดอีก ' + S.cat.cfg.MAGNET_DISCOUNT + '%</small>' : sp && p.inStock ? '<small class="smart-hint">' + SMART_TH + ' เหลือ ' + baht(sp) + '</small>' : '') + '</div>' + (p.inStock ? stepper('p', p.sku, q) : '<span class="hint">เลือกสินค้าอื่นได้เลย</span>') + '</div><div class="tiers" aria-label="ราคาตามจำนวน">' + tierText(p) + '</div>' +
      (near ? '<div class="nudge"><span>เพิ่มอีก <b>' + (nt.min - q) + ' ' + esc(p.unit) + '</b> เหลือ ' + baht(nt.price) + '/' + esc(p.unit) + '</span><button data-a="toTier" data-p="' + esc(p.sku) + '" data-q="' + nt.min + '">เพิ่มเลย +</button></div>' : '') + '</article>';
  }
  function pageCatalog() {
    var m = S.me.member, c = S.cart, cfg = S.cat.cfg, f = S.params.cat || 'all', search = String(S.ui.search || '').trim().toLowerCase(), cats = catList(), results = 0, promoChip = smartOn() || !!magnetMine();
    if (f === 'promo' && !promoChip) f = 'all';
    function matches(name, id) { return !search || (String(name) + ' ' + String(id || '')).toLowerCase().indexOf(search) >= 0; }
    var h = top('สั่งของ', 'เลือกวัตถุดิบ แล้วตรวจตะกร้าก่อนส่ง', true) + '<div class="wrap catalog-wrap">';
    h += '<div class="catalog-tools"><label class="search-box" for="catalog-search">' + icon('search') + '<input type="search" id="catalog-search" placeholder="ค้นหาสินค้า" aria-label="ค้นหาสินค้า" value="' + esc(S.ui.search || '') + '" autocomplete="off"></label><div class="chips" aria-label="หมวดสินค้า">' + [['all', 'ทั้งหมด']].concat(promoChip ? [['promo', 'โปรวันนี้']] : [], [['set', 'เซ็ตคุ้ม']], cats.map(function (k) { return [k, catLabel(k)]; })).map(function (x) {
      return '<button class="chip' + (f === x[0] ? ' on' : '') + (x[0] === 'promo' ? ' promo' : '') + '" data-a="cat" data-p="' + esc(x[0]) + '" aria-pressed="' + (f === x[0]) + '">' + x[1] + '</button>';
    }).join('') + '</div></div>';
    h += couponStrip(S.me.coupon);
    var k = calcNow();
    if (!search && (f === 'all' || f === 'promo')) { h += magnetBanner(); var st = smartToday(); if (st) { h += st; results += (S.cat.smart.items || []).length; } }
    if (f === 'promo') {
      h += smartBar(k);
      var mg = magnetMine(), trig = Number(cfg.SMART_TRIGGER_KG) || 1, secs = [];
      if (mg) secs.push(['wallet', 'ใช้' + magnetName(mg.pct) + ' ได้กับสินค้านี้', S.cat.products.filter(function (p) { return p.magnet && matches(p.name, p.sku); })]);
      if (smartOn()) {
        secs.push(['set', 'สินค้า' + SMART_TH + (featuredMap() ? 'วันนี้' : 'ทั้งหมด') + ' ลด ' + cfg.SMART_DISCOUNT + '%', S.cat.products.filter(function (p) { return smartPriceOf(p) && matches(p.name, p.sku); })]);
        secs.push(['pork', 'สินค้าหลัก ซื้อทุก ' + trig + ' กก. ได้สิทธิ์' + SMART_TH + ' 1 ชิ้น', S.cat.products.filter(function (p) { return p.promoCat === 'Main' && matches(p.name, p.sku); })]);
      }
      secs.forEach(function (s) {
        if (!s[2].length) return; results += s[2].length;
        h += '<section class="box product-section"><div class="section-heading"><h2>' + icon(s[0]) + ' ' + esc(s[1]) + '</h2><span class="hint">' + s[2].length + ' รายการ</span></div>' + s[2].map(function (p) { return prodRow(p, c); }).join('') + '</section>';
      });
    }
    if (f === 'all' || f === 'set') {
      var mine = {}; (S.me.lastSkus || []).forEach(function (x) { mine[x] = 1; });
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
        }).join('') + '</div><p class="hint">ราคาเซ็ตคงที่ ไม่รวมส่วนลดราคาขั้นบันได' + (smartOn() ? ', เซ็ตคุ้มไม่นับสิทธิ์' + SMART_TH : '') + '</p></section>';
      }
    }
    var pom = S.cat.products.filter(function (p) { return p.pom; })[0];
    if (!search && pom && pom.inStock && (f === 'all' || f === pom.cat)) h += '<div class="monthly-pick">' + icon('leaf') + '<span><small>สินค้าแห่งเดือน</small><b>' + esc(pom.name) + '</b></span><strong>' + baht(pom.tiers[0].price) + '<small>/ ' + esc(pom.unit) + '</small></strong></div>';
    (f === 'all' ? cats : f === 'set' || f === 'promo' ? [] : [f]).forEach(function (cat) {
      var ps = S.cat.products.filter(function (p) { return p.cat === cat && matches(p.name, p.sku); });
      if (!ps.length) return;
      results += ps.length;
      h += '<section class="box product-section"><div class="section-heading"><h2>' + icon(cat) + ' ' + esc(catLabel(cat)) + '</h2><span class="hint">' + ps.length + ' รายการ</span></div>' + ps.map(function (p) { return prodRow(p, c); }).join('') + '</section>';
    });
    if (!results) h += '<div class="empty">' + icon('search') + '<b>ไม่พบสินค้าในหมวดนี้</b><span>ลองเปลี่ยนคำค้น หรือเลือกหมวดทั้งหมด</span></div>';
    var sm = k.promo.smart, net0 = rnd2(k.subtotal - k.promoDisc);
    h += '<p class="demo-note">ราคาจริงตามบิลหลังชั่งสินค้า</p></div><div class="foot">' + (sm.on && sm.unused > 0 && f !== 'promo' ? '<button class="rights-strip" data-a="cat" data-p="promo">' + icon('set') + ' มีสิทธิ์' + SMART_TH + ' ลด ' + cfg.SMART_DISCOUNT + '% เหลือ ' + sm.unused + ' ชิ้น แตะเลือกของลด</button>' : '') +
      '<div class="foot-inner"><div class="sum"><small>' + (k.promoDisc > 0 ? 'ยอดประมาณหลังโปร (ลด ' + baht(k.promoDisc) + ')' : 'ยอดสินค้าโดยประมาณ') + '</small><b class="num">' + baht(net0) + '</b><small>' + k.count + ' รายการ · ~' + k.kg + ' กก.' + (sm.on && sm.unused > 0 && f === 'promo' ? ' · สิทธิ์เหลือ ' + sm.unused + ' ชิ้น' : '') + '</small></div><button class="btn pri" data-a="go" data-p="cart"' + (k.count ? '' : ' disabled') + '>' + icon('bag') + ' ดูตะกร้า' + (k.count ? ' (' + k.count + ')' : '') + '</button></div></div>';
    render(h);
  }

  /* ---------- ตะกร้า ---------- */
  function pageCart() {
    if (S.params.add) {
      S.params.add.split(',').forEach(function (x) { var t = x.split(':'); if (prod(t[0])) S.cart.lines[t[0]] = Math.max(1, parseInt(t[1], 10) || 1); });
      delete S.params.add; saveCart();
    }
    var m = S.me.member, c = S.cart, cfg = S.cat.cfg, H = hoursOf();
    var slots = String(cfg.SLOTS || '').split('|');
    if (!c.slot || slots.indexOf(c.slot) < 0) c.slot = slots[0];
    if (m.sourceKind === 'sign' && !c.modeSet) { c.mode = 'pickup'; c.modeSet = true; }
    c.evening = false; c.eveningDate = ''; // v3.1.0 รอบเย็นพักไว้ (ไม่มีให้เลือก)
    if (c.addrId && !addrList().some(function (a) { return a.id === c.addrId; })) c.addrId = '';
    var k = calcNow();
    var h = top('ตะกร้า', '', true) + '<div class="wrap cart-wrap">';
    if (!k.count) { render(h + '<div class="empty">' + icon('bag') + '<b>ตะกร้ายังว่างอยู่</b><span>เลือกวัตถุดิบที่ต้องการ แล้วกลับมาตรวจรายการที่นี่</span></div><button class="btn pri block" data-a="go" data-p="catalog">เลือกสินค้า</button></div>'); return; }
    var shopOk = cfg.PICKUP_SHOP !== false, ar = k.mode === 'deliver' ? areaOf(shipAddr()) : { ok: true }, a0 = shipAddr();
    /* 1) รับของแบบไหน + ส่งที่ไหน + ถึงกี่โมง (อยู่บนสุดแบบแอปส่งของ) */
    var modes = [['deliver', 'ส่งถึงที่', 'truck']].concat(shopOk ? [['shop', 'รับเองที่ร้าน', 'shop']] : [], m.sourceKind === 'sign' ? [['pickup', 'รับที่จุดรับ', 'pin']] : []);
    if (modes.length > 1) h += '<div class="mode-tabs" role="tablist" aria-label="วิธีรับของ">' + modes.map(function (x) { var on = k.mode === x[0]; return '<button role="tab" class="mode-tab' + (on ? ' on' : '') + '" aria-selected="' + on + '" data-a="setMode" data-p="' + x[0] + '">' + icon(x[2]) + '<span>' + x[1] + '</span></button>'; }).join('') + '</div>';
    if (k.mode === 'deliver') {
      h += shipCard(k);
      if (ar.ok) {
        if (etaMode()) h += etaCard('deliver') + etaRules();
        else if (autoSlot()) { var w = waveNow(); h += '<div class="eta-card"><span class="eta-ic">' + icon('clock') + '</span><div><b>' + esc(w.slot) + ' ' + (w.date === todayStr() ? 'วันนี้' : 'พรุ่งนี้') + ' รถออกประมาณ ' + esc(w.depart) + '</b><small>แจ้งเวลาถึงในแชตตอนรถออก</small></div></div>' + waveRules(); }
        else h += '<div class="field"><label for="slot">เลือกรอบจัดส่ง</label><select id="slot" data-chg="slot">' + slots.map(function (x) { return '<option' + (c.slot === x ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></div>';
      }
    } else if (k.mode === 'shop') {
      h += '<div class="ship-card ok static"><span class="ship-ic">' + icon('shop') + '</span><span class="ship-txt"><small>รับเองที่ร้าน</small><b>' + esc(cfg.SHOP_NAME || 'Betagro Shop โพธิ์แก้ว') + '</b><span class="ship-addr">ไม่มีขั้นต่ำ เปิด ' + H.open + ' ถึง ' + H.close + ' น.</span></span></div>';
      if (etaMode()) h += etaCard('shop');
    } else if (k.mode === 'pickup') { var r = S.ui.round; h += '<div class="ship-card ok static"><span class="ship-ic">' + icon('pin') + '</span><span class="ship-txt"><small>รับที่จุดรับ</small><b>รอบ ' + esc(cfg.CONDO_TIME) + '</b><span class="ship-addr">ไม่มีขั้นต่ำต่อคน</span></span></div>'; if (r) { var after = r.total + k.subtotal; h += '<div class="alert ' + (after >= r.min ? 'ok' : 'warn') + '">ยอดรวมจุดรับวันนี้ ' + baht(after) + ' จาก ' + baht(r.min) + (after >= r.min ? ' รอบออกแน่นอน' : ' ขาดอีก ' + baht(r.min - after) + ' ถ้าไม่ครบ เลื่อนเป็นรอบพรุ่งนี้') + '<br>ของรอที่จุดรับได้ ' + r.hold + ' นาที</div>'; } }
    if (k.errors.length) h += '<div class="alert bad">' + k.errors.map(esc).join('<br>') + '</div>';
    /* 2) รายการสินค้า */
    var tagTh = { main: '<span class="tag main">สินค้าหลัก</span>', smart: '<span class="tag smart">' + SMART_TH + '</span>', magnet: '<span class="tag magnet">' + MAGNET_TH + '</span>' };
    h += '<div class="section-heading"><h2>รายการของคุณ</h2><button class="text-btn" data-a="go" data-p="catalog">+ เพิ่มสินค้า</button></div><div class="box cart-items">' +
      k.bundles.map(function (l) { return '<article class="cart-item"><div><h3>' + esc(l.name) + ' <span class="badge">เซ็ต</span></h3><small class="hint">' + baht(l.price) + ' / เซ็ต</small></div><strong class="num">' + baht(l.total) + '</strong>' + stepper('b', l.id, l.qty) + '</article>'; }).join('') +
      k.lines.map(function (l) {
        var d = l.promoDisc || 0;
        return '<article class="cart-item"><div><h3>' + esc(l.name) + (l.promo ? ' <span class="badge">ร่วมโปร</span>' : '') + (smartOn() || magnetMine() ? ' ' + (tagTh[l.tag] || '') : '') + '</h3><small class="hint">' + baht(l.price) + ' / ' + esc(l.unit) + (d > 0 ? ' <span class="ok-t">ลด ' + baht(d) + (k.promoKind === 'SMART' && l.promoQty ? ' (' + l.promoQty + ' ชิ้น)' : '') + '</span>' : '') + '</small></div><strong class="num">' + (d > 0 ? '<s class="was">' + baht(l.total) + '</s> ' + baht(rnd2(l.total - d)) : baht(l.total)) + '</strong>' + stepper('p', l.sku, l.qty) + '</article>';
      }).join('') + '</div>';
    if ((k.lowStock || []).length) h += '<div class="alert warn">ใกล้หมด: ' + esc(k.lowStock.join(', ')) + '<br>สั่งได้ ร้านจะยืนยันจำนวนให้หลังตรวจของ</div>';
    h += promoBox(k);
    if (k.coinBal > 0) h += '<label class="box chk coin-toggle"><input type="checkbox" data-chg="useCoin"' + (c.useCoin ? ' checked' : '') + (k.coinMax <= 0 ? ' disabled' : '') + '><span><b>ใช้ส่วนลดสะสม</b><small>มี ' + baht(k.coinBal) + ' ใช้ได้ ' + baht(Math.min(k.coinBal, k.coinMax)) + ' ในบิลนี้<br>' + (k.coinWhy ? esc(k.coinWhy) : 'สินค้าร่วมรายการและเซ็ตคุ้ม สูงสุด ' + cfg.COIN_MAX_PCT + '% ของบิล') + '</small></span>' + icon('coin') + '</label>';
    if (pointsOn() && ptsBal() > 0) {
      var pu = Number(cfg.POINT_REDEEM_UNIT), pv = Number(cfg.POINT_REDEEM_VALUE);
      h += ptsBal() >= pu ? '<label class="box chk coin-toggle"><input type="checkbox" data-chg="usePoints"' + (c.usePoints ? ' checked' : '') + (k.pointsMax <= 0 ? ' disabled' : '') + '><span><b>ใช้แต้มสะสม</b><small>มี ' + fmtPts(ptsBal()) + ' แต้ม ใช้ได้ ' + fmtPts(k.pointsMax * pu) + ' แต้ม = ลด ' + baht(k.pointsMax * pv) + '<br>ทุก ' + fmtPts(pu) + ' แต้ม = ' + baht(pv) + '</small></span>' + icon('coin') + '</label>'
        : '<div class="hint">มีแต้ม ' + fmtPts(ptsBal()) + ' แต้ม สะสมครบ ' + fmtPts(pu) + ' แต้ม แลกส่วนลด ' + baht(pv) + ' ได้</div>';
    }
    /* 3) สรุปยอด */
    var saved = rnd2(k.promoDisc + k.coupon + k.coinUse * cfg.COIN_VALUE + k.pointsDisc);
    h += '<section class="box order-summary"><h3>สรุปยอดประมาณ</h3><div class="row"><span>รวมสินค้า (' + k.count + ' รายการ)</span><span class="num">' + baht(k.subtotal) + '</span></div>' +
      (k.promoDisc ? '<div class="row disc"><span>' + (k.promoKind === 'MAGNET' ? magnetName(cfg.MAGNET_DISCOUNT) : SMART_TH + ' ลด ' + cfg.SMART_DISCOUNT + '% (' + k.promo.smart.used + ' ชิ้น)') + '</span><span class="num">−' + baht(k.promoDisc) + '</span></div>' : '') +
      (k.coupon ? '<div class="row disc"><span>' + esc(couponLabel(k.couponStep)) + ' (' + (k.couponAmt ? baht(k.couponAmt) : k.couponPct + '%') + ')</span><span class="num">−' + baht(k.coupon) + '</span></div>' : '') +
      (k.coinUse ? '<div class="row disc"><span>ส่วนลดสะสม</span><span class="num">−' + baht(k.coinUse * cfg.COIN_VALUE) + '</span></div>' : '') +
      (k.pointsDisc ? '<div class="row disc"><span>ใช้แต้ม ' + fmtPts(k.pointsUse) + ' แต้ม</span><span class="num">−' + baht(k.pointsDisc) + '</span></div>' : '') +
      '<div class="row tot"><span>ยอดประมาณสุทธิ</span><strong class="price num">' + baht(k.net) + '</strong></div>' +
      (saved > 0 ? '<div class="saved-line">' + icon('check') + ' บิลนี้ประหยัด ' + baht(saved) + '</div>' : '') +
      (m.credit > 0 && !m.linkPending ? '<div class="hint">มีเครดิต ' + baht(m.credit) + ' ระบบหักให้ตอนออกบิลยอดจริง</div>' : '') +
      (k.couponWhy ? '<div class="hint">' + esc(k.couponWhy) + '</div>' : '') + (m.couponLock === 'approval' ? '<div class="hint">คูปองร้านผู้แนะนำจะใช้ได้หลังร้านยืนยันข้อมูลร้านของคุณ</div>' : '') +
      (pointsOn() && Number(cfg.POINT_EARN_SPEND) > 0 && k.net >= Number(cfg.POINT_EARN_SPEND) ? '<div class="hint">บิลนี้ได้แต้มประมาณ ' + fmtPts(Math.floor(k.net / Number(cfg.POINT_EARN_SPEND))) + ' แต้ม (คิดจากยอดที่จ่ายจริง)</div>' : '') + '</section>';
    if (k.mode === 'deliver' && ar.ok && k.tooSmall) h += '<div class="alert warn">ยอดยังไม่ถึงขั้นต่ำสำหรับส่ง ' + baht(k.poolMin) + ' เพิ่มอีก ' + baht(rnd2(k.poolMin - k.subtotal)) + (shopOk ? ' หรือเลือก "รับเองที่ร้าน" (ไม่มีขั้นต่ำ)' : '') + '</div>';
    else if (k.mode === 'deliver' && ar.ok && k.belowMin) h += '<div class="alert warn">ยอดยังไม่ถึง ' + baht(k.min) + ' ร้านอาจรวมส่งกับออเดอร์ใกล้เคียง เพิ่มอีก ' + baht(rnd2(k.min - k.subtotal)) + ' เพื่อส่งตามเวลาปกติ</div>';
    else if (k.mode === 'deliver' && ar.ok && k.min < cfg.MIN_ORDER) h += '<div class="alert ok">สิทธิ์ลูกค้าใหม่: ขั้นต่ำส่งเหลือ ' + baht(k.min) + '</div>';
    /* 4) ปุ่มยืนยัน: สั่งไม่ได้ยังกดได้ เพื่อบอกเหตุผล */
    var why = cartBlocks(k, ar), sub = k.mode === 'shop' ? 'รับเองที่ร้าน' : k.mode === 'pickup' ? 'รับที่จุดรับ' : !ar.ok ? 'ยังส่งที่อยู่นี้ไม่ได้' : 'ยอดประมาณ';
    h += '</div><div class="foot"><div class="foot-inner"><div class="sum"><b class="num">' + baht(k.net) + '</b><small>' + sub + '</small></div><button class="btn pri" data-a="' + (why.length ? 'submitWhy' : 'submitOrder') + '"' + (why.length ? ' aria-disabled="true"' : '') + '>ยืนยันส่งออเดอร์</button></div></div>';
    render(h);
    etaFetch(k);
    if (m.sourceKind === 'sign' && !S.ui.roundLoaded) { S.ui.roundLoaded = true; api('roundInfo', {}, { quiet: true }).then(function (r) { S.ui.round = r.round; if (S.page === 'cart') pageCart(); }).catch(function () { }); }
    if (k.mode === 'deliver' && ar.status === 'out' && a0) { // บันทึกว่าลูกค้าเห็นการ์ดนอกพื้นที่ (วันละครั้งต่อที่อยู่) ไว้ดูโอกาสเปิดสาขา/ขยายเขต
      S.ui.seen = S.ui.seen || {};
      if (!S.ui.seen[a0.id]) { S.ui.seen[a0.id] = 1; api('areaSeen', { addrId: a0.id, cart: k.subtotal, outcome: 'เห็นการ์ดนอกพื้นที่' }, { quiet: true, tries: 1 }).catch(function () { }); }
    }
  }
  /* เหตุผลที่ยังยืนยันออเดอร์ไม่ได้ + ปุ่มแก้ (แสดงในป๊อปอัพเมื่อกดปุ่มยืนยัน) */
  function cartBlocks(k, ar) {
    var r = [], shopOk = S.cat.cfg.PICKUP_SHOP !== false;
    k.errors.forEach(function (e) { r.push({ t: e, b: [['แก้ตะกร้า', 'close']] }); });
    if (k.mode === 'deliver' && !ar.ok) r.push(ar.status === 'none' ? { t: 'ยังไม่ได้ปักหมุดที่อยู่จัดส่ง', b: [['ปักหมุดที่อยู่', 'shipTo']].concat(shopOk ? [['รับเองที่ร้านแทน', 'shop']] : []) }
      : { t: 'ที่อยู่ที่เลือกอยู่นอกพื้นที่จัดส่ง', b: [['เปลี่ยนที่อยู่', 'shipTo']].concat(shopOk ? [['รับเองที่ร้านแทน', 'shop']] : []) });
    if (k.tooSmall) r.push({ t: 'ยอดยังไม่ถึงขั้นต่ำสำหรับส่ง ' + baht(k.poolMin) + ' (ขาดอีก ' + baht(rnd2(k.poolMin - k.subtotal)) + ')', b: [['เพิ่มสินค้า', 'catalog']].concat(shopOk && k.mode === 'deliver' ? [['รับเองที่ร้าน (ไม่มีขั้นต่ำ)', 'shop']] : []) });
    return r;
  }
  function waveRules() {
    var W = waves();
    return '<details class="eta-rules"><summary>ร้านจัดรอบให้อัตโนมัติ แตะดูเวลาปิดรับ</summary><table><tbody>' + W.slice(1).concat(W.slice(0, 1)).map(function (w, i) { return '<tr><th>' + esc(w.name) + ' รถออก ' + esc(w.depart) + '</th><td>สั่งก่อน ' + esc(w.cutoff) + ' น.' + (i === W.length - 1 ? ' (ของวันถัดไป)' : '') + '</td></tr>'; }).join('') + '</tbody></table></details>';
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
  function doneExtra(pr) {
    var x = pr.promo === 'SMART' ? 'ใช้' + SMART_TH + ' ลด ' + baht(pr.pd) : pr.promo === 'MAGNET' ? 'ใช้' + MAGNET_TH + ' ลด ' + baht(pr.pd) + ' (ถ้าออเดอร์ถูกยกเลิก ได้สิทธิ์คืน)' : '';
    if (Number(pr.pu) > 0) x += (x ? ' · ' : '') + 'ใช้แต้ม ' + fmtPts(pr.pu) + ' แต้ม';
    return (x ? '<p class="alert ok">' + esc(x) + '</p>' : '') + (pr.low ? '<p class="alert warn">ใกล้หมด: ' + esc(pr.low) + ' · ร้านจะยืนยันจำนวนให้</p>' : '');
  }
  function pageDone() {
    var pr = S.params, tmr = pr.dd && pr.dd > todayStr(), line = '', ev = evCfg();
    if (pr.evening === '1') {
      return render(top('ส่งออเดอร์แล้ว', '', false) + '<div class="wrap"><section class="box success-panel"><span class="success-icon">' + icon('clock') + '</span><h2>รอบเย็น' + esc(evDayText(pr.dd)) + '</h2><p>ออเดอร์ <b class="mono">' + esc(pr.id) + '</b> · ส่ง ' + esc(ev ? ev.depart + '–' + ev.end : '') + ' น.</p>' +
        (pr.payBy ? '<p class="alert warn">โอนตามยอดประมาณก่อน <b>' + esc(pr.payBy.slice(11, 16)) + ' น.' + (pr.payBy.slice(0, 10) === todayStr() ? ' วันนี้' : ' ' + esc(thDate(pr.payBy))) + '</b> เพื่อยืนยันคิว</p>' : '') + doneExtra(pr) + '</section>' +
        '<button class="btn pri block" data-a="go" data-p="bill" data-id="' + esc(pr.id) + '">' + icon('bill') + ' จ่ายเลย · สแกน QR</button><button class="btn block" data-a="closeApp">กลับไปที่แชต LINE</button></div>');
    }
    if (pr.mode === 'shop' && pr.qk === 'pickup') line = '<b>' + esc(etaText({ kind: 'pickup', date: pr.qd, at: pr.qa, until: pr.qu }).big) + '</b><br>ร้านจะแจ้งในแชตเมื่อจัดของเสร็จ';
    else if (pr.mode === 'shop') line = 'รับเองที่ร้าน ร้านจะแจ้งในแชตเมื่อจัดของเสร็จ';
    else if (pr.mode === 'pickup') line = 'รับที่จุดรับ รอบ ' + esc(S.cat.cfg.CONDO_TIME);
    else if (pr.qk) { var x = etaText({ kind: pr.qk, date: pr.qd, at: pr.qa, within: pr.qw !== '0' }); line = '<b>' + esc(x.big) + '</b><br>' + esc(x.sub) + (pr.qk === 'express' ? '<br>ร้านจัดรอบให้อัตโนมัติ' : ''); }
    else if (pr.pool === '1') line = 'ส่งรวมรอบ: ร้านจะส่งเมื่อมีรอบผ่านย่านของคุณ (วันนี้หรือพรุ่งนี้) และแจ้งเวลาในแชต';
    else if (pr.slot) line = (tmr ? 'จัดส่งวัน' + dayName(pr.dd) + 'ที่ ' + thDate(pr.dd) + ' ' : 'จัดส่งวันนี้ ') + esc(custSlot(pr.slot)) + (pr.depart ? ' (รถออกประมาณ ' + esc(pr.depart) + ')' : '');
    else if (tmr) line = 'จัดส่งวัน' + dayName(pr.dd) + 'ที่ ' + thDate(pr.dd);
    render(top('ส่งออเดอร์แล้ว', '', false) + '<div class="wrap"><section class="box success-panel"><span class="success-icon">' + icon('check') + '</span><h2>ร้านได้รับออเดอร์แล้วค่ะ</h2><p>ออเดอร์ <b class="mono">' + esc(pr.id) + '</b></p>' +
      (line ? '<p class="alert info">' + line + '</p>' : '') + doneExtra(pr) +
      '<p class="hint">ร้านชั่งสินค้าแล้วส่งบิลยอดจริงเข้าแชต LINE OA</p></section>' + orderProgress(pr.st === 'approved' ? 'approved' : 'new') + '<button class="btn pri block" data-a="go" data-p="bills">ติดตามบิลของฉัน</button><button class="btn block" data-a="closeApp">กลับไปที่แชต LINE</button></div>');
  }

  /* ---------- บิล ---------- */
  function statusPill(s) { return s === 'new' ? '<span class="pill new">รอร้านตรวจ</span>' : s === 'approved' ? '<span class="pill appr">กำลังจัดของ</span>' : s === 'billed' ? '<span class="pill bill">รอชำระ</span>' : s === 'paid' ? '<span class="pill paid">ชำระแล้ว</span>' : '<span class="pill red">ยกเลิก</span>'; }
  function payPill(p) { return !p ? '' : p.status === 'review' ? '<span class="pill appr">รอร้านตรวจยอดโอน</span>' : p.status === 'partial' ? '<span class="pill new">ยังขาด ' + baht(p.balance) + '</span>' : p.status === 'over' ? '<span class="pill paid">โอนเกิน → เครดิต</span>' : ''; }
  function pageBills() {
    loadPage('bills', 'myOrders', {}, function (r, cached) {
      var due = r.orders.filter(function (o) { return o.status === 'billed' && o.pay && o.pay.remain > 0; });
      var h = top('บิลของฉัน', 'ติดตามออเดอร์และการชำระเงิน', true) + '<div class="wrap">' + (cached ? '<div class="hint refreshing">' + icon('clock') + ' กำลังอัปเดตสถานะล่าสุด...</div>' : '') + (due.length ? '<div class="alert warn">มี ' + due.length + ' บิลรอชำระ รวม ' + baht(due.reduce(function (s, o) { return s + o.pay.remain; }, 0)) + ' · แตะบิลเพื่อสแกน QR และแนบสลิป</div>' : '');
      h += r.orders.length ? r.orders.map(function (o) {
        var amt = o.status === 'billed' ? o.pay.remain : (o.actual || o.est);
        return '<button class="box bill-card" data-a="go" data-p="bill" data-id="' + esc(o.id) + '"><div class="bill-card-head"><b class="mono">' + esc(o.id) + '</b>' + statusPill(o.status) + '</div><div class="hint">' + esc(o.created) + (o.txn ? ' · บิล ' + esc(o.txn) : '') + (o.evening ? ' · รอบเย็น' + esc(evDayText(o.deliverDate)) : '') + '</div>' + (o.status === 'billed' ? payPill(o.pay) : '') + (o.evening && o.payBy && /new|approved/.test(o.status) && o.pay.remain > 0 ? '<span class="pill new">โอนก่อน ' + esc(o.payBy.slice(11, 16)) + ' น.</span>' : '') +
          (whenShort(o) ? '<div class="bill-when">' + icon(o.mode === 'shop' ? 'shop' : 'truck') + '<span>' + whenShort(o) + '</span></div>' : '') +
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
  /* 3.1.2 รายการบิล: บอกเวลาส่ง / เวลามารับ ของออเดอร์ที่ยังไม่ถึงมือลูกค้า */
  function whenShort(o) {
    if (o.status === 'cancelled' || o.delivery === 'done') return '';
    if (o.mode === 'pickup') return 'รับที่จุด ' + esc(o.pickup) + ' รอบ ' + esc(S.cat.cfg.CONDO_TIME);
    if (o.mode === 'shop') return pickupWhen(o);
    return billWhen(o);
  }
  /* 3.1.3 รับเองที่ร้าน: บอกเวลามารับจนกว่าจะเลยวันนัด (รวมบิลที่จ่ายแล้วแต่ยังไม่ได้มารับ) */
  function pickupWhen(o) {
    if (o.status === 'cancelled' || o.delivery === 'done') return '';
    var p = String(o.promiseAt || ''), d = p.slice(0, 10), t = p.slice(11, 16), today = todayStr();
    if (o.status === 'paid' && (!t || d < today)) return '';
    return 'รับเองที่ร้าน' + (t && d >= today ? ' มารับได้ตั้งแต่ ' + esc(t) + ' น.' + (d !== today ? ' ' + thDate(d) : '') : '');
  }
  /* หน้าบิล: ส่งเมื่อไร (ตามที่ร้านแจ้งตอนสั่ง / ตอนรถออก) */
  function billWhen(o) {
    if (o.delivery === 'done') return 'ส่งถึงแล้ว';
    if (o.delivery === 'out') return '<b>กำลังนำส่ง' + (o.eta ? ' ถึงประมาณ ' + esc(o.eta) + ' น.' : '') + '</b>';
    var p = String(o.promiseAt || ''), d = p.slice(0, 10), t = p.slice(11, 16), day = d && d !== todayStr() ? ' ' + thDate(d) : '';
    if (t && o.slot === 'เที่ยวแรก') return 'ส่งเที่ยวแรก' + (day || ' วันนี้') + ' ถึงก่อน ' + esc(t) + ' น.';
    if (t) return 'ส่งถึงประมาณ ' + esc(t) + ' น.' + day;
    return 'รอบส่ง: ' + esc(custSlot(o.slot)) + (o.deliverDate && o.deliverDate !== o.date ? ' ' + thDate(o.deliverDate) : '') + (o.pool && !o.delivery ? '<br><b>ส่งรวมรอบ</b> (รอรอบผ่านย่านของคุณ)' : '');
  }
  /* v3.1.1 บิลที่ยังไม่จ่าย: ยอดที่ต้องโอน + QR + แนบสลิป อยู่บนสุด */
  function payTop(o) {
    var p = o.pay, cfg = S.cat.cfg, h = '<section class="box pay-top"><div class="pay-amt"><small>' + (p.received > 0 ? 'ยังต้องโอนอีก' : 'ยอดที่ต้องโอน') + '</small><b class="price num">' + baht(p.remain) + '</b></div>';
        if (o.promptpay) h += '<div class="qr pay-qr"><div class="code">' + qrSvg(o.promptpay.payload) + '</div><b>สแกนจ่าย PromptPay ' + baht(o.promptpay.amount) + '</b>' + (o.promptpay.demo ? '<div class="alert warn">QR ตัวอย่าง (ร้านยังไม่ได้ตั้งบัญชีรับเงิน)</div>' : '<div class="hint">ใส่ยอดไว้แล้ว · บันทึกภาพหน้าจอแล้วสแกนในแอปธนาคารได้</div>') + '</div>';
        var auto = cfg.SLIP_VERIFY && cfg.SLIP_VERIFY !== 'off', sl = S.ui.slip && S.ui.slip.id === o.id ? S.ui.slip : null;
        h += '</section><form class="box form" data-form="notifyPaid" data-id="' + esc(o.id) + '"><h3>แจ้งโอนแล้ว</h3>' +
          '<div class="slip-box">' + (sl && sl.preview ? '<img src="' + sl.preview + '" alt="สลิปที่แนบ">' : '<span class="slip-ph">' + icon('slip') + '</span>') +
          '<div><b>' + (sl ? (sl.reading ? 'กำลังอ่านสลิป...' : sl.qr ? 'อ่าน QR บนสลิปแล้ว ✓' + (sl.bank ? ' (' + esc(sl.bank) + ')' : '') : 'แนบสลิปแล้ว') : 'แนบสลิป (แนะนำ)') + '</b><small class="hint">' + (sl && !sl.reading && !sl.qr ? 'อ่าน QR ไม่ได้ ไม่เป็นไร ร้านตรวจจากรูปให้' : auto ? 'แนบสลิปแล้ว ระบบอ่านยอดให้อัตโนมัติ' : 'ร้านตรวจได้เร็วขึ้น') + '</small>' +
          '<label class="btn sm"><input type="file" accept="image/*" data-chg="slip" data-id="' + esc(o.id) + '" hidden>' + icon('camera') + (sl ? ' เปลี่ยนรูป' : ' เลือกรูปสลิป') + '</label></div></div>' +
          (auto && sl && sl.qr && !sl.manual ? '<input type="hidden" name="amount" value="">' : '<div class="field"><label for="pd-amt">ยอดที่โอน (บาท)</label><input id="pd-amt" name="amount" inputmode="decimal" value="' + p.remain + '"><small class="hint">ถ้าโอนไม่เท่ายอดนี้ แก้ตัวเลขได้ ระบบจะรวมทุกครั้งที่แจ้งโอนให้</small></div>') +
          '<button class="btn pri block" type="submit"' + (sl && sl.reading ? ' disabled' : '') + '>แจ้งโอนแล้ว</button></form>';
    return h;
  }
  /* ส่วนต่างระหว่างยอดประมาณกับยอดตามบิลหลังชั่ง (บอกลูกค้าว่ายอดเปลี่ยนเพราะอะไร) */
  function adjRow(o) {
    var d = Math.round((Number(o.actual) - Number(o.est)) * 100) / 100;
    if (!o.txn || !isFinite(d) || Math.abs(d) < 0.01) return '';
    return '<div class="row adj"><span>ปรับตามของที่ชั่งและจัดจริง</span><span>' + (d > 0 ? '+' : '−') + baht(Math.abs(d)) + '</span></div>';
  }
  function pageBill() {
    var id = S.params.id;
    if (!id) return go('bills', {}, true);
    loadPage('bill:' + id, 'order', { id: id }, function (r) {
      var o = r.order, p = o.pay, cfg = S.cat.cfg, pre = o.evening && o.payBy && /new|approved/.test(o.status);
      var h = top('บิล ' + o.id, o.created, true) + '<div class="wrap">' + orderProgress(o.status, o.delivery);
      var due = (o.status === 'billed' || pre) && p.remain > 0;
      if (due) h += payTop(o);
      if (o.evening) h += '<div class="alert ' + (pre && p.remain > 0 ? 'warn' : 'info') + '">รอบเย็น' + esc(evDayText(o.deliverDate)) + (evCfg() ? ' ส่ง ' + esc(evCfg().depart + '–' + evCfg().end) + ' น.' : '') + (pre && p.remain > 0 ? ' · <b>โอนก่อน ' + esc(o.payBy.slice(11, 16)) + ' น.' + (o.payBy.slice(0, 10) === todayStr() ? ' วันนี้' : ' ' + esc(thDate(o.payBy))) + '</b> ตามยอดประมาณ · ยอดจริงต่าง ร้านคืนเป็นเครดิตหรือแจ้งส่วนต่าง' : '') + (o.eveningMoved ? ' · เลื่อนมาแล้ว ' + o.eveningMoved + ' ครั้ง' : '') + '</div>';
      h += '<div class="box">' + o.bundles.map(function (l) { return '<div class="row"><span>' + esc(l.name) + ' ×' + l.qty + '</span><span>' + baht(l.price * l.qty) + '</span></div>'; }).join('') +
        o.items.map(function (l) { return '<div class="row"><span>' + esc(l.name) + ' ×' + l.qty + ' @' + fmt(l.price) + '</span><span>' + baht(l.price * l.qty) + '</span></div>' +
          (l.promoDisc > 0 ? '<div class="row disc sub"><span>↳ ' + (o.promo === 'MAGNET' ? magnetName(cfg.MAGNET_DISCOUNT) : SMART_TH + ' ลด ' + cfg.SMART_DISCOUNT + '%' + (l.promoQty ? ' (' + l.promoQty + ' ชิ้น)' : '')) + '</span><span>−' + baht(l.promoDisc) + '</span></div>' : ''); }).join('') +
        (o.coupon ? '<div class="row disc"><span>คูปองส่วนลด' + (o.couponStep ? ' บิลที่ ' + o.couponStep : '') + '</span><span>−' + baht(o.coupon) + '</span></div>' : '') + (o.coinUse ? '<div class="row disc"><span>ส่วนลดสะสม</span><span>−' + baht(o.coinUse * cfg.COIN_VALUE) + '</span></div>' : '') +
        (o.pointsUse ? '<div class="row disc"><span>ใช้แต้ม ' + fmtPts(o.pointsUse) + ' แต้ม</span><span>−' + baht(o.pointsDisc) + '</span></div>' : '') +
        '<div class="row"><span>ยอดประมาณ</span><span>' + baht(o.est) + '</span></div>' + (o.txn ? adjRow(o) + '<div class="row"><span>เลขที่บิล</span><span class="mono">' + esc(o.txn) + '</span></div><div class="row tot"><span>ยอดตามบิล (หลังชั่ง)</span><span>' + baht(o.actual) + '</span></div>' : '') +
        (o.mode === 'pickup' ? '<div class="hint">รับที่จุด ' + esc(o.pickup) + ' รอบ ' + esc(cfg.CONDO_TIME) + '</div>' : o.mode === 'shop' ? '<div class="hint">' + (pickupWhen(o) || 'รับเองที่ร้าน') + '</div>' : '<div class="hint">' + (o.ship && o.ship.text ? 'ส่งที่: ' + esc(o.ship.text) + '<br>' : '') + billWhen(o) + '</div>') + '</div>';
      if ((o.status === 'new' || o.status === 'approved') && !pre) h += '<div class="alert info">ร้านยังไม่เปิดบิล ยอดจริงจะส่งเข้าแชตหลังชั่งของ</div>';
      if (o.status === 'billed' || o.status === 'paid' || (pre && (p.received > 0 || p.remain > 0))) h += payRows(o);
      if (o.status === 'paid') h += '<div class="alert ok">ชำระครบแล้ว ' + esc(o.paidAt) + ' ขอบคุณค่ะ</div>';
      if (!due && (o.status === 'billed' || pre) && p.pending > 0) h += '<div class="alert info">ได้รับแจ้งโอนครบแล้ว ร้านกำลังตรวจยอด จะแจ้งในแชตเมื่อยืนยัน</div>';
      render(h + '</div>');
    });
  }

  /* ---------- ชวนเพื่อน / Coin ---------- */
  function pageInvite() {
    loadPage('invite', 'invite', {}, function (r) {
      var cfg = S.cat.cfg, h = top('ชวนเพื่อน', '', true) + '<div class="wrap">';
      if (!r.eligible) { // 3.1.2: ไม่ใช่ทางตัน บอกเหตุผล + ยังส่งลิงก์ LINE ร้านให้เพื่อนได้ (ไม่ได้แต้มผู้แนะนำ)
        var sl = r.shareLink || '';
        render(h + '<div class="alert info">' + (r.why === 'approval' ? 'ชวนเพื่อนรับแต้มได้หลังร้านยืนยันสมาชิกของคุณ (ภายใน 1 วันทำการ)' : 'สิทธิ์ชวนเพื่อนรับแต้มตอนนี้เปิดให้ร้านค้ากลุ่มนำร่องที่ร้านเชิญ') + '</div>' +
          (sl ? '<div class="box qr"><b>ชวนเพื่อนมาสั่งที่ร้านได้เลย</b><div class="hint">ส่งลิงก์ LINE ของร้านให้เพื่อน เพื่อนแอดแล้วสั่งของได้ทันที (ลิงก์นี้ไม่ได้รับแต้มผู้แนะนำ)</div><div class="code">' + qrSvg(sl) + '</div>' +
            '<div class="copy"><input readonly value="' + esc(sl) + '" aria-label="ลิงก์ LINE ร้าน"><button class="btn sm" data-a="copy" data-t="' + esc(sl) + '">คัดลอก</button></div>' +
            (canShare() ? '<button class="btn sm pri" data-a="share" data-t="' + esc(sl) + '">ส่งให้เพื่อนใน LINE</button>' : '') + '</div>' : '') +
          '<button class="btn block" data-a="go" data-p="catalog">' + icon('bag') + ' ไปสั่งของ</button></div>');
        return;
      }
      if (r.reward === 'points') { render(h + inviteV3(r) + '</div>'); return; }
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
  /* ชวนเพื่อน v3: ผู้แนะนำได้แต้ม · เพื่อนได้คูปอง Affiliate + Magnet Set */
  function inviteV3(r) {
    var c = S.cat.cfg, oC = offerFor('welcome', 'Consumer', 'ref'), oF = offerFor('welcome', 'FS', 'ref'), rp = r.refPoints || {};
    var mg = c.MAGNET_ENABLED !== false && Number(c.MAGNET_DISCOUNT) > 0 ? ' + ' + magnetName(c.MAGNET_DISCOUNT) + ' (สูงสุด ' + baht(c.MAGNET_CAP) + ')' : '';
    var h = '<div class="box qr">' + (r.link ? '<div class="code">' + qrSvg(r.link) + '</div>' : '<div class="alert warn">ร้านยังไม่ได้ตั้งค่าลิงก์ชวน</div>') + '<b>QR แนะนำร้านของคุณ</b>' + (r.code ? '<span class="mono">รหัสผู้แนะนำ ' + esc(r.code) + '</span>' : '') +
      (r.link ? '<div class="copy"><input readonly value="' + esc(r.link) + '" aria-label="ลิงก์แนะนำ"><button class="btn sm" data-a="copy" data-t="' + esc(r.link) + '">คัดลอก</button></div>' : '') +
      (r.link && canShare() ? '<button class="btn sm pri" data-a="share" data-t="' + esc(r.link) + '" data-msg="' + esc('ร้าน Betagro Shop โพธิ์แก้ว เปิดสั่งของใน LINE แล้ว ลงทะเบียนผ่านลิงก์นี้รับสิทธิ์ลูกค้าใหม่: ' + r.link) + '">ส่งให้เพื่อนใน LINE</button>' : '') + '</div>';
    h += '<div class="kv"><div><small>แต้มผู้แนะนำใช้ได้</small><b>' + fmtPts(rp.available) + '</b></div><div><small>พักไว้ ' + c.QUALIFY_HOLD_DAYS + ' วัน</small><b>' + fmtPts(rp.pending) + '</b></div><div><small>รอร้านตรวจ</small><b>' + fmtPts(rp.review) + '</b></div></div>';
    h += '<div class="box"><h3>กติกาแนะนำร้าน</h3>' +
      '<div class="rule"><b>เพื่อนเป็นบ้าน / ครัวเรือน (B2C)</b><span>คุณได้ <b>' + fmtPts(c.REF_POINTS_B2C) + ' แต้ม</b> เมื่อออเดอร์แรกของเขาจ่ายแล้ว' + (Number(c.REF_CAP_B2C_MONTH) > 0 ? ' (สูงสุด ' + fmtPts(c.REF_CAP_B2C_MONTH) + ' แต้ม/เดือน)' : '') + '<br>เพื่อนได้ ' + esc(oC ? 'คูปอง ' + offerText(oC) + ' ภายใน ' + oC.days + ' วัน' : 'สิทธิ์ลูกค้าใหม่') + esc(mg) + '</span></div>' +
      '<div class="rule"><b>เพื่อนเป็นร้านค้า / ร้านอาหาร (B2B)</b><span>คุณได้ <b>' + fmtPts(c.REF_POINTS_B2B_STEP1) + ' แต้ม</b> เมื่อออเดอร์แรกจ่ายแล้ว + อีก <b>' + fmtPts(c.REF_POINTS_B2B_STEP2) + ' แต้ม</b> เมื่อร้านนั้นซื้อสะสมครบ ' + baht(c.B2B_RETAIN_SPEND) + ' ใน ' + c.B2B_RETAIN_DAYS + ' วัน' + (Number(c.REF_CAP_B2B_MONTH) > 0 ? ' (นับสูงสุด ' + c.REF_CAP_B2B_MONTH + ' ร้าน/เดือน)' : '') + '<br>เพื่อนได้ ' + esc(oF ? 'คูปอง ' + offerText(oF) + ' ภายใน ' + oF.days + ' วัน' + (oF.needsApproval ? ' (ใช้ได้หลังร้านยืนยันข้อมูลร้าน)' : '') : 'สิทธิ์ลูกค้าใหม่') + esc(mg) + '</span></div>' +
      '<div class="hint">แต้มพักไว้ ' + c.QUALIFY_HOLD_DAYS + ' วันหลังเพื่อนจ่าย แล้วใช้ได้ · ' + fmtPts(c.POINT_REDEEM_UNIT) + ' แต้ม = ลด ' + baht(c.POINT_REDEEM_VALUE) + ' · นับเฉพาะลูกค้าใหม่ที่ไม่เคยซื้อกับร้าน และลงทะเบียนผ่าน QR / ลิงก์ / รหัสนี้ก่อนสั่งครั้งแรก</div></div>';
    var stTh = { 'new': ['paid', 'ลูกค้าใหม่'], existing: ['', 'ลูกค้าเดิม (ไม่นับแต้ม)'], review: ['new', 'ร้านกำลังตรวจ'] };
    h += '<div class="box"><h3>เพื่อนที่แนะนำ (' + r.refs.length + ')</h3>' + (r.refs.length ? r.refs.map(function (x) { var s = stTh[x.status] || ['', x.status]; return '<div class="row"><span>' + esc(x.name) + '<br><small class="hint">' + (x.type === 'Consumer' ? 'บ้าน (B2C)' : 'ร้าน (B2B)') + ' · ' + esc(thDate(x.regDate)) + '</small></span><span><span class="pill ' + s[0] + '">' + s[1] + '</span>' + (x.points ? '<br><small class="ok-t">+' + fmtPts(x.points) + ' แต้ม</small>' : '') + '</span></div>'; }).join('') : '<div class="hint">ยังไม่มี · ส่ง QR หรือลิงก์ให้ร้านคู่ค้า/ลูกค้าบ้านใกล้ ๆ</div>') + '</div>';
    return h;
  }
  function canShare() { if (S.asCust) return false; try { return liff.isApiAvailable('shareTargetPicker'); } catch (e) { return false; } } // 3.1.3 สวมบท: ไม่เปิดหน้าเลือกเพื่อน LINE (ใช้คัดลอกลิงก์แทน)
  var PT_KIND = { earn: 'แต้มจากบิล', use: 'ใช้ลดบิล', refB2C: 'แนะนำลูกค้าบ้าน', refB2B1: 'แนะนำร้านใหม่ (งวด 1)', refB2B2: 'แนะนำร้านใหม่ (งวด 2)', adjust: 'ร้านปรับแต้ม' };
  function magnetCard(mg) {
    var st = { AVAILABLE: ['paid', 'ใช้ได้' + (mg.expires ? ' ถึง ' + thDate(mg.expires) : '')], RESERVED: ['appr', 'จองไว้กับออเดอร์ ' + (mg.order || '')], USED: ['', 'ใช้สิทธิ์แล้ว'], EXPIRED: ['new', 'หมดอายุแล้ว'] }[mg.status] || ['', mg.status];
    return '<section class="box magnet-card"><div class="section-heading"><h3>' + icon('wallet') + ' ' + esc(magnetName(mg.pct)) + '</h3><span class="pill ' + st[0] + '">' + esc(st[1]) + '</span></div><div class="hint">ลูกค้าใหม่ ลดสินค้าที่ร่วมรายการ ' + mg.items + ' รายการ สูงสุด ' + baht(mg.cap) + (mg.status === 'RESERVED' ? '<br>ถ้าออเดอร์นี้ถูกยกเลิก ได้สิทธิ์คืนอัตโนมัติ' : '') + '</div><details class="cond"><summary>ดูเงื่อนไข</summary>ยอดหลังหักส่วนลดต้องถึง ' + baht(mg.minNet) + ', ใช้ได้ 1 ครั้ง, 1 บิลใช้ได้ 1 โปร (ระบบเลือกโปรที่ลดมากกว่าให้)</details>' + (mg.available ? '<button class="btn sm" data-a="go" data-p="catalog" data-cat="promo" style="margin-top:10px">ดูสินค้าที่ใช้ได้</button>' : '') + '</section>';
  }
  function pageWallet() {
    loadPage('wallet', 'wallet', {}, function (r) {
      var cfg = S.cat.cfg, pts = r.points || { bal: 0, pending: 0, review: 0, value: 0, history: [] }, v3 = pointsOn(), mg = r.magnet, sm = r.smart;
      var h = top('สิทธิ์ของฉัน', v3 ? 'แต้ม ส่วนลด คูปอง' : 'ส่วนลดสะสม คูปอง เครดิต', true) + '<div class="wrap">';
      h += v3 ? '<div class="kv"><div><small>แต้มใช้ได้</small><b>' + fmtPts(pts.bal) + '</b></div><div><small>ประหยัดไปแล้ว</small><b>' + baht(r.saved || 0) + '</b></div><div><small>เครดิตเงิน</small><b>' + baht(r.credit || 0) + '</b></div></div>'
        : '<div class="kv"><div><small>ส่วนลดสะสมใช้ได้</small><b>' + baht(r.bal) + '</b></div><div><small>รออนุมัติ</small><b>' + baht(r.pending) + '</b></div><div><small>เครดิตเงิน</small><b>' + baht(r.credit || 0) + '</b></div></div>';
      if (mg && mg.status) h += magnetCard(mg);
      h += couponStrip(S.me.coupon);
      if ((r.member || {}).couponLock === 'approval') h += '<div class="alert info">คูปองร้านผู้แนะนำรอร้านยืนยันข้อมูลร้านของคุณ แล้วจะใช้ได้ทันที</div>';
      if (v3) {
        h += '<section class="box"><h3>' + icon('coin') + ' แต้มสะสม</h3><div class="row"><span>ใช้ได้</span><span><b>' + fmtPts(pts.bal) + ' แต้ม</b> (แลกได้ ' + baht(pts.value) + ')</span></div>' +
          (pts.pending ? '<div class="row"><span>พักไว้ (ใช้ได้หลังครบ ' + cfg.QUALIFY_HOLD_DAYS + ' วัน)</span><span>' + fmtPts(pts.pending) + '</span></div>' : '') + (pts.review ? '<div class="row"><span>รอร้านตรวจ</span><span>' + fmtPts(pts.review) + '</span></div>' : '') +
          '<div class="hint">ทุก ' + baht(cfg.POINT_EARN_SPEND) + ' ที่จ่ายจริง ได้ 1 แต้ม, ' + fmtPts(cfg.POINT_REDEEM_UNIT) + ' แต้ม แลกส่วนลด ' + baht(cfg.POINT_REDEEM_VALUE) + ' กดใช้ในตะกร้า</div><details class="cond"><summary>ดูเงื่อนไข</summary>ได้แต้มเมื่อร้านยืนยันเงินแล้ว, ยกเลิกหรือคืนสินค้า แต้มของบิลนั้นถูกหักคืน, แต้มสมาชิกบริษัทที่หน้าร้านยังสะสมแยกตามปกติ</details>' +
          ((pts.history || []).length ? '<details class="pay-history"><summary>ประวัติแต้ม (' + pts.history.length + ')</summary>' + pts.history.slice(0, 40).map(function (x) {
            var sub = x.status === 'pending' ? 'พักไว้ ใช้ได้ ' + thDate(x.availableAt) : x.status === 'review' ? 'รอร้านตรวจ' : x.status === 'cancelled' ? 'ยกเลิก' : x.status === 'reversed' ? 'หักคืน (ยกเลิก/คืนสินค้า)' : thDate(x.at);
            return '<div class="row"><span>' + esc(PT_KIND[x.kind] || x.kind) + (x.order ? ' ' + esc(x.order) : '') + (x.note && x.kind === 'adjust' ? ' · ' + esc(x.note) : '') + '<br><small class="hint">' + esc(sub) + '</small></span><span class="num">' + (x.points > 0 ? '+' : '−') + fmtPts(Math.abs(x.points)) + '</span></div>';
          }).join('') + '</details>' : '<div class="hint">ยังไม่มีแต้ม สั่งของและชำระเงินครบ แต้มจะเข้าที่นี่</div>') + '</section>';
      }
      if (smartOn()) h += '<section class="box"><h3>' + icon('set') + ' ' + esc(smartName(cfg.SMART_DISCOUNT)) + '</h3><div class="hint">ซื้อสินค้าหลัก (ป้าย "สินค้าหลัก") ทุก ' + (Number(cfg.SMART_TRIGGER_KG) || 1) + ' กก. ลดสินค้าที่มีป้าย "' + SMART_TH + '" ได้ 1 ชิ้น</div><details class="cond"><summary>ดูเงื่อนไข</summary>ชิ้นละไม่เกิน ' + (Number(cfg.SMART_MAX_ITEM_KG) || 1.1) + ' กก., ไม่จำกัดจำนวนสิทธิ์, ระบบลดชิ้นราคาสูงสุดก่อน, ไม่รวมเซ็ตคุ้ม, 1 บิลใช้ได้ 1 โปร (' + SMART_TH + ' หรือ' + MAGNET_TH + ')</details>' +
        (sm && (sm.items || []).length ? '<div class="smart-list">' + sm.items.map(function (x) { return '<span>' + esc(x.catTh) + ': ' + esc(x.name) + ' <b>' + baht(x.price) + '</b></span>'; }).join('') + '</div>' : '') + '<button class="btn sm" data-a="go" data-p="catalog" data-cat="promo" style="margin-top:10px">ดูโปรวันนี้</button></section>';
      if (r.soon && r.soonDate) h += '<div class="alert warn">ส่วนลดสะสม ' + baht(r.soon) + ' จะหมดอายุ ' + esc(thDate(r.soonDate)) + ' ใช้ก่อนนะคะ</div>';
      if ((r.credits || []).length) h += '<div class="box"><h3>เครดิตเงิน</h3><div class="hint">ได้จากการโอนเกิน ระบบหักให้อัตโนมัติในบิลถัดไป</div>' + r.credits.map(function (c) { return '<div class="row"><span>' + esc({ overpay: 'โอนเกิน', use: 'หักในบิล', refund: 'ร้านคืนเงิน', restore: 'คืนเครดิต' }[c.kind] || c.kind) + ' ' + esc(c.order) + '<br><small class="hint">' + esc(thDate(c.at)) + '</small></span><span class="num">' + (c.amount > 0 ? '+' : '−') + baht(Math.abs(c.amount)) + '</span></div>'; }).join('') + '</div>';
      if (!v3 || r.coins.length || r.bal > 0 || r.pending > 0) {
        if (!v3) h += '<div class="hint">ส่วนลดสะสมได้จากการชวนเพื่อน ใช้ลดสินค้าร่วมรายการและเซ็ตคุ้มในบิลถัดไป (1 หน่วย = 1 บาท) · แต้มสมาชิกบริษัทยังสะสมที่หน้าร้านตามปกติ</div>';
        h += '<div class="box"><h3>' + (v3 ? 'ส่วนลดสะสม (กติกาเดิม)' : 'ประวัติส่วนลดสะสม') + '</h3>' + (v3 ? '<div class="row"><span>ใช้ได้ในตะกร้า</span><span>' + baht(r.bal) + (r.pending ? ' · รออนุมัติ ' + baht(r.pending) : '') + '</span></div>' : '') + (r.coins.length ? r.coins.map(function (c) {
          var label = c.status === 'used' ? 'ใช้กับ ' + c.order : c.status === 'cancelled' ? 'ยกเลิก (' + c.order + ')' : 'จากบิล ' + c.order + (c.from ? ' ของ ' + c.from : '');
          var sub = c.status === 'pending' ? 'รอร้านอนุมัติ' : c.status === 'available' ? 'หมดอายุ ' + thDate(c.expires) : thDate(c.earned);
          return '<div class="row"><span>' + esc(label) + '<br><small class="hint">' + esc(sub) + '</small></span><span class="num">' + (c.status === 'used' ? '−' : '+') + fmt(c.amount) + '</span></div>';
        }).join('') : '<div class="hint">ยังไม่มี</div>') + '</div>';
      }
      render(h + '</div>');
    });
  }

  /* ---------- สั่งประจำ ---------- */
  var DAYS = [[1, 'จ'], [2, 'อ'], [3, 'พ'], [4, 'พฤ'], [5, 'ศ'], [6, 'ส'], [0, 'อา']];
  function pageStanding() {
    loadPage('standing', 'standing', {}, function (r) {
      var st = r.standing, cfg = S.cat.cfg, slots = String(cfg.SLOTS).split('|'), H = hoursOf(), eta = H.eta, slotTxt = function (x) { return eta ? 'ส่งเที่ยวแรก ถึงก่อน ' + H.morningDue + ' น.' : 'รอบ ' + x; };
      var h = top('สั่งประจำ', 'ร้านทักถามทุกเย็น กดยืนยันปุ่มเดียว', true) + '<div class="wrap">';
      if (S.params.confirm && st && !st.paused) h += '<div class="box confirm-box"><h3>ยืนยันรับวัน' + dayName(S.params.confirm) + 'ที่ ' + esc(thDate(S.params.confirm)) + '</h3>' + itemsHtml(st.items) + '<div class="hint">' + esc(slotTxt(st.slot)) + '</div><button class="btn pri block" data-a="standingConfirm" style="margin-top:8px">ยืนยัน ส่งตามรายการนี้</button></div>';
      if (st) {
        var d = st.diag || {};
        h += '<div class="box"><div class="section-heading"><h3>รายการประจำ</h3>' + (st.paused ? '<span class="pill red">หยุดชั่วคราว</span>' : '<span class="pill paid">เปิดอยู่</span>') + '</div>' + itemsHtml(st.items) +
          '<div class="row"><span>วัน</span><span>' + esc(daysText(st.daysArr)) + '</span></div><div class="row"><span>ส่ง</span><span>' + esc(eta ? 'เที่ยวแรก ถึงก่อน ' + H.morningDue + ' น.' : st.slot) + '</span></div>' +
          (st.lastConfirmed ? '<div class="hint">ยืนยันล่าสุดสำหรับวันที่ ' + esc(thDate(st.lastConfirmed)) + '</div>' : '') + '</div>';
        h += d.asked && d.willAsk ? '<div class="alert info">ร้านส่งข้อความถามแล้วว่ารับวัน' + dayName(d.tomorrow) + 'ไหม กดยืนยันในแชต หรือกดปุ่มนี้ <button class="btn sm pri" data-a="go" data-p="standing" data-confirm="' + esc(d.tomorrow) + '">ยืนยันรับวัน' + dayName(d.tomorrow) + '</button></div>' // 3.1.4 หลังร้านถามแล้ว
          : d.willAsk ? '<div class="alert info">วันนี้ 18:00 ร้านจะส่งข้อความถามว่ารับวัน' + dayName(d.tomorrow) + 'ไหม กดปุ่มในข้อความเพื่อยืนยัน</div>'
          : '<div class="alert warn">คืนนี้ร้านจะยังไม่ถาม เพราะ ' + esc((d.why || []).join(', ')) + (d.friend === false && addFriendUrl() ? ' <button class="text-btn" data-a="addFriend">เพิ่มเพื่อนตอนนี้</button>' : '') + '</div>';
        h += '<button class="btn block" data-a="standingPause">' + (st.paused ? 'เปิดสั่งประจำอีกครั้ง' : 'หยุดชั่วคราว (ร้านปิด / วันหยุด)') + '</button>';
      }
      var lb = S.me.lastBasket, useDays = st ? st.daysArr : [1, 2, 3, 4, 5, 6];
      if (!S.ui.stDraft) S.ui.stDraft = Object.assign({}, st ? st.items : (lb ? lb.lines : {}));
      var items = S.ui.stDraft, keys = Object.keys(items).filter(function (k) { return prod(k); });
      var avail = S.cat.products.filter(function (p) { return p.inStock && keys.indexOf(p.sku) < 0; });
      h += '<form class="box form" data-form="standingSave"><h3>' + (st ? 'แก้รายการประจำ' : 'ตั้งสั่งประจำ') + '</h3>';
      h += keys.length ? '<div class="st-items">' + keys.map(function (sku) { var p = prod(sku); return '<div class="row qty-row"><span>' + esc(p.name) + '<small class="hint"> ' + esc(p.unit) + '</small></span><span class="st-qty"><input type="number" min="0" max="999" inputmode="numeric" name="q_' + esc(sku) + '" value="' + items[sku] + '" aria-label="จำนวน ' + esc(p.name) + '"><button type="button" class="ic sm" data-a="standingDel" data-p="' + esc(sku) + '" aria-label="เอา ' + esc(p.name) + ' ออก">' + icon('x') + '</button></span></div>'; }).join('') + '</div>'
        : '<div class="hint">ยังไม่มีสินค้า เลือกเพิ่มด้านล่าง</div>';
      if (avail.length) h += '<div class="st-add"><select id="st-add" aria-label="เลือกสินค้าที่จะเพิ่ม"><option value="">เลือกสินค้าที่จะเพิ่ม</option>' + catList().map(function (cat) { var ps = avail.filter(function (p) { return p.cat === cat; }); return ps.length ? '<optgroup label="' + esc(catLabel(cat)) + '">' + ps.map(function (p) { return '<option value="' + esc(p.sku) + '">' + esc(p.name) + '</option>'; }).join('') + '</optgroup>' : ''; }).join('') + '</select><button type="button" class="btn sm" data-a="standingAdd">' + icon('plus') + ' เพิ่ม</button></div>';
      if (lb && st) h += '<button type="button" class="text-btn" data-a="standingFromLast">ใช้รายการจากออเดอร์ล่าสุดแทน</button>';
      h += '<fieldset class="day-pick"><legend>วันที่ต้องการรับของ</legend>' + DAYS.map(function (d) { return '<label><input type="checkbox" name="d" value="' + d[0] + '"' + (useDays.indexOf(d[0]) >= 0 ? ' checked' : '') + '><span>' + d[1] + '</span></label>'; }).join('') + '</fieldset>' +
        (eta ? '<div class="hint">ส่งเที่ยวแรกของวันที่เลือก ถึงก่อน ' + H.morningDue + ' น.</div><input type="hidden" name="slot" value="' + esc(slots[0]) + '">' : '<div class="field"><label for="st-slot">รอบส่ง</label><select id="st-slot" name="slot">' + slots.map(function (x) { return '<option' + (st && st.slot === x ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></div>') +
        '<button class="btn pri block" type="submit"' + (keys.length ? '' : ' disabled') + '>บันทึกสั่งประจำ</button>';
      render(h + '</form></div>');
    });
  }
  /* อ่านจำนวนที่พิมพ์ไว้ก่อนวาดหน้าใหม่ (เพิ่ม/ลบสินค้าแล้วตัวเลขไม่หาย) */
  function stKeep() { var f = app.querySelector('form[data-form="standingSave"]'), d = S.ui.stDraft || {}; if (!f) return d; Array.prototype.forEach.call(f.querySelectorAll('input[name^="q_"]'), function (i) { var q = parseInt(i.value, 10); d[i.name.slice(2)] = q > 0 ? q : 0; }); return d; }
  function daysText(arr) { if (!arr || !arr.length) return '-'; if (arr.length === 7) return 'ทุกวัน'; return DAYS.filter(function (d) { return arr.indexOf(d[0]) >= 0; }).map(function (d) { return d[1]; }).join(' '); }
  function itemsHtml(items) { return Object.keys(items || {}).map(function (sku) { var p = prod(sku); return '<div class="row"><span>' + esc(p ? p.name : sku) + '</span><span>×' + items[sku] + '</span></div>'; }).join(''); }

  /* ---------- บัตรสมาชิก + สมุดที่อยู่ + ข้อมูลการรับของ ---------- */
  function addrBook() {
    var L = addrList(), max = 5;
    return '<section class="box addr-book"><div class="section-heading"><h3>' + icon('pin') + ' ที่อยู่จัดส่ง</h3>' + (L.length && L.length < max ? '<button class="text-btn" data-a="addrNew" data-ret="card">+ เพิ่มที่อยู่</button>' : '') + '</div>' +
      (L.length ? L.map(function (a) {
        var ar = areaOf(a);
        return '<div class="addr-row"><div><b>' + esc(a.label) + '</b>' + (a.isDefault ? ' <span class="pill paid">หลัก</span>' : '') + ' ' + areaPill(ar) + '<small class="hint">' + esc([a.address, a.landmark, a.contact ? 'ผู้รับ ' + a.contact : ''].filter(Boolean).join(' · ') || 'ปักหมุดแล้ว') + '</small></div><div class="addr-acts">' +
          (a.isDefault ? '' : '<button class="btn sm" data-a="addrDefault" data-id="' + esc(a.id) + '">ตั้งเป็นหลัก</button>') + '<button class="btn sm" data-a="addrEdit" data-id="' + esc(a.id) + '">แก้</button></div></div>';
      }).join('') : '<div class="hint">ยังไม่มีที่อยู่ ปักหมุดเพื่อให้ร้านส่งของได้ถูกที่</div><button class="btn block" data-a="addrNew" data-ret="card" style="margin-top:8px">' + icon('pin') + ' ปักหมุดที่อยู่</button>') +
      '<div class="hint" style="margin-top:6px">เก็บได้สูงสุด ' + max + ' ที่ · เลือกที่ส่งของแต่ละครั้งได้ในตะกร้า</div></section>';
  }
  function pageCard() {
    var m = S.me.member, cfg = S.cat.cfg;
    var h = top('บัตรสมาชิก', m.sno ? 'สมาชิก ' + m.sno : 'รอร้านยืนยันเลขสมาชิก', true) + '<div class="wrap"><div class="box qr"><div class="code">' + qrSvg(m.sno || m.id) + '</div><b>' + esc(m.name) + '</b><span class="mono">' + esc(m.sno || 'รอเลขสมาชิก') + '</span></div>' +
      '<div class="alert ' + (cfg.COUNT_COUNTER ? 'ok' : 'info') + '">' + (cfg.COUNT_COUNTER ? 'แสดงบัตรนี้ที่แคชเชียร์ทุกครั้งที่ซื้อหน้าร้าน' : 'แต้มและสิทธิ์ในแอปนับจากออเดอร์ที่สั่งผ่าน LINE') + '</div>';
    h += '<div class="tiles member-shortcuts">' + menuTile('wallet', 'สิทธิ์ของฉัน', pointsOn() ? 'แต้ม ส่วนลด คูปอง' : 'ส่วนลดสะสม คูปอง', 'wallet') + menuTile('standing', 'สั่งประจำ', 'จัดการตะกร้าประจำ', 'clock') + menuTile('bills', 'บิลของฉัน', 'ดูประวัติออเดอร์', 'bill') + '</div>';
    if (m.sourceKind !== 'sign') h += addrBook();
    h += '<form class="box form" data-form="profileSave"><h3>' + icon('truck') + ' การรับของ</h3>' +
      (m.sourceKind !== 'sign' ? '' : '<div class="field"><label for="pf-addr">ตึก / ห้อง</label><input id="pf-addr" name="address" maxlength="120" value="' + esc(m.address) + '"></div>') +
      '<div class="field"><label for="pf-note">จุดจอดรถ / คนรับของ / ช่วงเวลาที่รับได้</label><input id="pf-note" name="deliveryNote" maxlength="120" value="' + esc(m.deliveryNote || '') + '" placeholder="เช่น จอดหน้าซอย โทรหาพี่แดง รับได้ 07–11 น."></div>' +
      (String(cfg.NEEDBY_OPTIONS || '').trim() ? '<div class="field"><label for="pf-needby">ปกติต้องได้ของก่อนกี่โมง</label>' + needBySelect(m.needBy || '', 'pf-needby').replace('data-chg="needBy"', 'name="needBy"') + '</div>' : '') +
      (m.type !== 'Consumer' ? tradeSelect(m.trade || '', 'pf-trade', 'trade') : '') + '<button class="btn block" type="submit">บันทึก</button></form>';
    var sh = S.me.shared || {};
    if (sh.owner) {
      var iv = S.ui.memberInvite;
      h += '<div class="box"><h3>' + icon('invite') + ' LINE ของคนในร้าน</h3><div class="hint">ให้สามี/ภรรยา/ลูกน้องสั่งของจาก LINE ของเขาเอง โดยใช้เลขสมาชิก ส่วนลด และประวัติเดียวกัน บิลจะส่งไปที่คนสั่ง · เพิ่มได้สูงสุด 5 บัญชี</div>' +
        (sh.links || []).map(function (l) { return '<div class="row"><span>' + esc(l.name) + ' <small class="hint">' + (l.status === 'active' ? 'ใช้งานอยู่' : 'รอกดยืนยัน (ถึง ' + esc((l.expires || '').slice(0, 16)) + ')') + '</small></span><span>' + (l.status === 'open' && l.link ? '<button class="btn sm" data-a="copy" data-t="' + esc(l.link) + '">คัดลอกลิงก์</button> ' : '') + '<button class="btn sm bad" data-a="memberLinkRemove" data-code="' + esc(l.code) + '">ถอด</button></span></div>'; }).join('') +
        '<form class="form" data-form="memberInvite" style="margin-top:8px"><div class="acts"><div class="field"><label for="mi-name">ชื่อเรียก</label><input id="mi-name" name="name" maxlength="40" placeholder="เช่น พี่แดง"></div><button class="btn sm pri" type="submit">สร้างลิงก์เชิญ</button></div></form>' +
        (iv ? '<div class="invite-out"><div class="code">' + qrSvg(iv.link) + '</div><div><b>ส่งลิงก์นี้ให้เขาเปิดใน LINE</b><small class="hint">ใช้ได้ครั้งเดียว ภายใน 3 วัน</small><div class="copy"><input readonly value="' + esc(iv.link) + '"><button class="btn sm" type="button" data-a="copy" data-t="' + esc(iv.link) + '">คัดลอก</button></div>' + (canShare() ? '<button class="btn sm pri" type="button" data-a="share" data-t="' + esc(iv.link) + '" data-msg="' + esc('ใช้บัญชีร้านใน LINE ร่วมกัน กดลิงก์นี้แล้วกดยืนยัน: ' + iv.link) + '">ส่งใน LINE</button>' : '') + '</div></div>' : '') + '</div>';
    } else if (sh.owner === false) h += '<div class="box"><h3>บัญชีร่วม</h3><div class="hint">LINE นี้ใช้บัญชีร้านร่วมกับ ' + esc(sh.ownerName || 'เจ้าของร้าน') + ' ในชื่อ "' + esc(sh.me || '') + '" บิลที่คุณสั่งจะส่งมาที่แชตนี้</div></div>';
    h += '<div class="box"><h3>ข้อมูลส่วนบุคคลของฉัน</h3><div class="hint">ร้านเก็บชื่อ เบอร์ และที่อยู่เพื่อจัดส่งและแจ้งบิลเท่านั้น · แก้ไขได้ที่ "ที่อยู่จัดส่ง" และ "การรับของ" ด้านบน · ขอลบข้อมูลได้ที่ปุ่มด้านล่าง (ประวัติการซื้อขายเก็บตามกฎหมายบัญชี แต่ไม่มีชื่อ/เบอร์) · <a href="privacy.html" target="_blank" rel="noopener">นโยบายข้อมูลส่วนบุคคล</a></div>' +
      (m.privacyAt ? '<div class="alert info" style="margin-top:8px">ส่งคำขอลบข้อมูลแล้วเมื่อ ' + esc(thDate(m.privacyAt)) + ' ' + esc(m.privacyAt.slice(11, 16)) + ' ร้านจะดำเนินการและแจ้งใน ' + esc(cfg.PRIVACY_CONTACT || 'แชต') + '</div>' : '<button class="btn block" data-a="privacyRequest" style="margin-top:8px">ขอลบข้อมูลของฉัน</button>') + '</div>';
    if (isStaff() && cfg.TEST_MODE) h += '<div class="box test-box"><h3>เครื่องมือทดสอบ (เห็นเฉพาะพนักงาน)</h3><div class="hint">ลบข้อมูลสมาชิกของบัญชี LINE นี้ เพื่อทดลองลงทะเบียนใหม่ เช่น ลองเป็นลูกค้าที่ถูกชวน</div><button class="btn bad block" data-a="resetMe" style="margin-top:8px">ลบข้อมูลสมาชิกของฉัน</button></div>';
    render(h + staffLinks() + '</div>');
  }
  /* ---------- เพิ่ม / แก้ที่อยู่ ---------- */
  function pageAddress() {
    var d = S.ui.addrDraft; if (!d) { S.page = 'card'; return pageCard(); }
    var L = addrList(), cur = d.id ? L.filter(function (a) { return a.id === d.id; })[0] : null;
    var h = top(d.id ? 'แก้ที่อยู่' : 'เพิ่มที่อยู่จัดส่ง', 'ปักหมุดให้ตรงจุดส่งของ', true) + '<div class="wrap"><form class="box form" data-form="addressSave">' +
      '<div class="field"><label for="ad-label">ชื่อเรียก</label><input id="ad-label" name="label" maxlength="30" list="ad-labels" value="' + esc(d.label || '') + '" placeholder="เช่น ร้าน บ้าน ที่ทำงาน" required><datalist id="ad-labels"><option value="ร้าน"><option value="บ้าน"><option value="ที่ทำงาน"><option value="ครัวกลาง"></datalist></div>' +
      '<div class="field"><label for="ad-addr">ที่อยู่ (บ้านเลขที่ / ซอย / ถนน)</label><textarea id="ad-addr" name="address" rows="2" maxlength="200" autocomplete="street-address">' + esc(d.address || '') + '</textarea></div>' +
      '<div class="field"><label for="ad-lm">จุดสังเกต / จุดจอดรถ</label><input id="ad-lm" name="landmark" maxlength="120" value="' + esc(d.landmark || '') + '" placeholder="เช่น ตรงข้ามเซเว่น จอดหน้าซอย"></div>' +
      '<div class="field"><label for="ad-ct">ผู้รับของ (ถ้าไม่ใช่คุณ)</label><input id="ad-ct" name="contact" maxlength="60" value="' + esc(d.contact || '') + '" placeholder="ชื่อ / เบอร์"></div>' +
      '<div class="geo-box pin-box">' + areaChip(d.lat, d.lng) + '<button type="button" class="btn sm" data-a="pinOpen" data-for="addr">' + icon('pin') + (d.lat ? ' แก้หมุด' : ' ปักหมุดบนแผนที่') + '</button></div>' +
      (L.length && !(cur && cur.isDefault) ? '<label class="chk"><input type="checkbox" name="makeDefault"' + (d.makeDefault ? ' checked' : '') + '><span>ตั้งเป็นที่อยู่หลัก</span></label>' : '') +
      '<button class="btn pri block" type="submit"' + (d.lat ? '' : ' disabled') + '>บันทึกที่อยู่</button>' + (d.lat ? '' : '<div class="hint">ปักหมุดก่อน แล้วจึงบันทึกได้</div>') + '</form>' +
      (d.id ? '<button class="btn bad block" data-a="addrDelete" data-id="' + esc(d.id) + '">ลบที่อยู่นี้</button>' : '') + '</div>';
    render(h);
  }
  /* ---------- ปักหมุด: แผนที่ MapLibre + OpenFreeMap (ไม่ใช้คีย์ ไม่มีค่าใช้จ่าย) · ค้นหา · GPS · วางลิงก์ Google Maps ---------- */
  var MAP_JS = ['https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl', 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl'], mapLib = null;
  function loadMapLib() {
    if (window.maplibregl) return Promise.resolve(window.maplibregl);
    if (mapLib) return mapLib;
    mapLib = new Promise(function (res, rej) {
      (function at(i) {
        if (i >= MAP_JS.length) { mapLib = null; rej(new Error('map')); return; }
        var css = document.createElement('link'), s = document.createElement('script'), done = false, t;
        function next() { if (done) return; done = true; clearTimeout(t); if (window.maplibregl) { res(window.maplibregl); return; } css.remove(); s.remove(); at(i + 1); }
        css.rel = 'stylesheet'; css.href = MAP_JS[i] + '.css'; document.head.appendChild(css);
        t = setTimeout(next, 10000); s.src = MAP_JS[i] + '.js'; s.async = true; s.onload = next; s.onerror = next; document.head.appendChild(s);
      })(0);
    });
    return mapLib;
  }
  function dropMap() { if (S.ui.mapObj) { try { S.ui.mapObj.remove(); } catch (e) { } S.ui.mapObj = null; } }
  function pinCenter(P) { var A = S.cat.cfg.AREA || {}, sh = A.shop || []; return P.lat ? [P.lng, P.lat] : (Number(sh[0]) ? [Number(sh[1]), Number(sh[0])] : [100.6458, 13.8008]); }
  function setPin(lat, lng, src) {
    var P = S.ui.pin; if (!P) return;
    P.lat = Math.round(Number(lat) * 1e6) / 1e6; P.lng = Math.round(Number(lng) * 1e6) / 1e6; P.source = src || P.source || 'map';
    var chip = document.getElementById('pin-chip'), co = document.getElementById('pin-coord'), ok = document.getElementById('pin-ok');
    if (chip) chip.innerHTML = areaChip(P.lat, P.lng); if (co) { co.textContent = pinDist(P.lat, P.lng); co.dataset.ll = P.lat.toFixed(5) + ', ' + P.lng.toFixed(5); } if (ok) ok.disabled = false;
  }
  /* v3.1.1 บอกระยะจากร้าน (ระยะถนนโดยประมาณ = เส้นตรง x 1.3 แบบเดียวกับการคิดเวลาส่ง) แทนพิกัดตัวเลข */
  /* 3.1.3 กรอบค้นหาที่อยู่ = เส้นเขตส่ง + แถบขอบ + 500 ม. (ไม่มีเส้นเขต: รอบร้านราว 5 กม.) → [ซ้าย, บน, ขวา, ล่าง] ตามรูปแบบ viewbox ของ Nominatim */
  function searchBox(A, sh) {
    var lat0 = Number(sh[0]), lng0 = Number(sh[1]), poly = (A && A.poly) || [], pad = ((Number(A && A.band) || 0) + 500) / 111320, padL = pad / Math.cos(lat0 * Math.PI / 180);
    if (poly.length < 3) return [lng0 - 0.046, lat0 + 0.045, lng0 + 0.046, lat0 - 0.045];
    var la = poly.map(function (p) { return Number(p[0]); }).concat([lat0]), ln = poly.map(function (p) { return Number(p[1]); }).concat([lng0]);
    return [Math.min.apply(null, ln) - padL, Math.max.apply(null, la) + pad, Math.max.apply(null, ln) + padL, Math.min.apply(null, la) - pad].map(function (v) { return Math.round(v * 1e5) / 1e5; });
  }
  function haversineKm(a, b, lat, lng) { var R0 = 6371, r = Math.PI / 180, dLa = (lat - a) * r, dLo = (lng - b) * r, x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a * r) * Math.cos(lat * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2); return 2 * R0 * Math.asin(Math.min(1, Math.sqrt(x))); }
  function pinDist(lat, lng) {
    var sh = (S.cat.cfg.AREA || {}).shop || [], a = Number(sh[0]), b = Number(sh[1]);
    if (!a || !b || !lat || !lng) return 'ปักหมุดแล้ว';
    var km = haversineKm(a, b, lat, lng) * 1.3;
    return km < 0.1 ? 'ใกล้ร้านมาก' : 'ห่างร้านประมาณ ' + (km < 10 ? (Math.round(km * 10) / 10) : Math.round(km)) + ' กม.';
  }
  function pinGo(lat, lng, src) {
    var P = S.ui.pin; if (!P) return; setPin(lat, lng, src);
    var map = S.ui.mapObj; if (map) { P.src2 = src; map.flyTo({ center: [P.lng, P.lat], zoom: 17, speed: 1.6 }); }
  }
  function pagePin() {
    var P = S.ui.pin; if (!P) { S.page = 'home'; return pageHome(); }
    var cfg = S.cat.cfg, search = String(cfg.MAP_SEARCH || 'nominatim') === 'nominatim';
    var h = top('ปักหมุดที่อยู่', 'เลื่อนแผนที่ให้หมุดตรงจุดส่งของ', true) + '<div class="wrap pin-wrap">' +
      (search ? '<form class="pin-search" data-form="pinSearch" role="search"><label class="search-box">' + icon('search') + '<input type="search" name="q" placeholder="ค้นหา เช่น ชื่อซอย หมู่บ้าน ร้านใกล้ ๆ" value="' + esc(P.q || '') + '" autocomplete="off" aria-label="ค้นหาสถานที่"></label><button class="btn sm" type="submit">ค้นหา</button></form><div id="pin-results" class="pin-results"></div>' : '') +
      '<div class="pin-map-box"><div id="pin-map" class="pin-map" role="application" aria-label="แผนที่ปักหมุด เลื่อนแผนที่ให้หมุดกลางจอตรงจุดส่งของ"></div><span class="pin-center" aria-hidden="true">' + icon('pin') + '</span><button type="button" class="btn sm pin-gps" data-a="pinGps">' + icon('pin') + ' ตำแหน่งปัจจุบัน</button></div>' +
      '<div id="pin-chip" class="pin-chip" aria-live="polite">' + areaChip(P.lat, P.lng) + '</div>' +
      '<details class="box pin-link"' + (P.mapFail ? ' open' : '') + '><summary>มีลิงก์ Google Maps หรือพิกัด? วางที่นี่</summary><form class="acts" data-form="pinLink"><div class="field"><label for="pin-url">ลิงก์หรือพิกัด</label><input id="pin-url" name="url" placeholder="https://maps.app.goo.gl/... หรือ 13.8001, 100.6492" autocomplete="off"></div><button class="btn sm" type="submit">ใช้ตำแหน่งนี้</button></form><div class="hint">ในแอป Google Maps: กดค้างที่ร้าน/บ้าน → แชร์ → คัดลอกลิงก์ แล้ววางที่นี่ได้เลย</div></details>' +
      '</div><div class="foot"><div class="foot-inner"><div class="sum"><small>ตำแหน่งที่เลือก</small><span id="pin-coord"' + (P.lat ? ' data-ll="' + P.lat.toFixed(5) + ', ' + P.lng.toFixed(5) + '"' : '') + '>' + (P.lat ? esc(pinDist(P.lat, P.lng)) : 'เลื่อนแผนที่ หรือกด "ตำแหน่งปัจจุบัน"') + '</span></div><button id="pin-ok" class="btn pri" data-a="pinConfirm"' + (P.lat ? '' : ' disabled') + '>ใช้ตำแหน่งนี้</button></div></div>';
    render(h);
    pinMap();
  }
  function pinMap() {
    var el = document.getElementById('pin-map'), P = S.ui.pin; if (!el || !P) return;
    dropMap();
    var cfg = S.cat.cfg, A = cfg.AREA || {};
    el.innerHTML = '<div class="pin-map-msg"><span class="spinner" aria-hidden="true"></span><span>กำลังโหลดแผนที่...</span></div>';
    function failed() {
      P.mapFail = true;
      if (!el.isConnected) return;
      el.innerHTML = '<div class="pin-map-msg">' + icon('alert') + '<b>แผนที่โหลดไม่ได้ในเครือข่ายนี้</b><span>กด "ตำแหน่งปัจจุบัน" ตอนอยู่ที่ร้าน/บ้าน หรือวางลิงก์ Google Maps ด้านล่างแทนได้</span></div>';
      var d = app.querySelector('.pin-link'); if (d) d.open = true;
    }
    loadMapLib().then(function (gl) {
      if (!el.isConnected || S.page !== 'pin') return;
      el.innerHTML = '';
      var map;
      try { map = new gl.Map({ container: el, style: cfg.MAP_STYLE || 'https://tiles.openfreemap.org/styles/liberty', center: pinCenter(P), zoom: P.lat ? 16.5 : 14, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, touchPitch: false }); }
      catch (e) { failed(); return; }
      S.ui.mapObj = map;
      try { map.touchZoomRotate.disableRotation(); } catch (e) { }
      map.addControl(new gl.NavigationControl({ showCompass: false }), 'top-right');
      var loaded = false, slow = setTimeout(function () { if (!loaded && el.isConnected) { var d = app.querySelector('.pin-link'); if (d) d.open = true; toast('แผนที่โหลดช้า ใช้ "ตำแหน่งปัจจุบัน" หรือวางลิงก์แทนได้', 4000); } }, 15000);
      map.on('load', function () {
        loaded = true; clearTimeout(slow);
        var poly = (A.poly || []).map(function (p) { return [Number(p[1]), Number(p[0])]; });
        if (A.enabled && poly.length >= 3) {
          poly.push(poly[0]);
          try {
            map.addSource('area', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [poly] } } });
            map.addLayer({ id: 'area-fill', type: 'fill', source: 'area', paint: { 'fill-color': '#00845F', 'fill-opacity': 0.08 } });
            map.addLayer({ id: 'area-line', type: 'line', source: 'area', paint: { 'line-color': '#006B4E', 'line-width': 2, 'line-dasharray': [2, 1] } });
          } catch (e) { }
        }
        var sh = A.shop || [];
        if (Number(sh[0])) { var d = document.createElement('div'); d.className = 'shop-marker'; d.title = 'ร้าน Betagro Shop โพธิ์แก้ว'; d.innerHTML = icon('shop'); new gl.Marker({ element: d }).setLngLat([Number(sh[1]), Number(sh[0])]).addTo(map); }
      });
      map.on('dragstart', function () { P.moved = true; P.src2 = ''; });
      map.on('moveend', function (e) { if (!(e && e.originalEvent) && !P.moved && !P.src2) return; var ct = map.getCenter(); setPin(ct.lat, ct.lng, P.src2 || 'map'); P.src2 = ''; });
    }).catch(failed);
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
    render(adminFrame({ title: 'หน้าหลังร้าน', tools: adminTools({ sound: store('pk2_sound') !== false }), body: '<div class="empty">กำลังโหลด...</div>' }));
    loadAdmin().then(function (A) { if (S.page === 'admin') A.show(); }).catch(fail);
  }

  /* ---------- เหตุการณ์ ---------- */
  var ACT = {
    reload: function () { location.reload(); },
    admNav: function () { S.ui.navOpen = !S.ui.navOpen; var a = app.querySelector('.adm'); if (a) a.classList.toggle('nav-open', S.ui.navOpen); },
    admTheme: function () { store('pk2_theme', isDark() ? 'light' : 'dark'); adminTheme(); if (window.PKAdmin && S.page === 'admin') window.PKAdmin.draw(); else show(); },
    retry: function () { show(); },
    back: back,
    home: function () { go('home', {}); },
    go: function (el) { var p = {}; if (el.dataset.id) p.id = el.dataset.id; if (el.dataset.cat) p.cat = el.dataset.cat; if (el.dataset.confirm) p.confirm = el.dataset.confirm; go(el.dataset.p, p); },
    cat: function (el) { S.params.cat = el.dataset.p; pageCatalog(); },
    qty: function (el) { var box = el.dataset.k === 'b' ? S.cart.bundles : S.cart.lines; var id = el.dataset.p; box[id] = Math.max(0, (box[id] || 0) + Number(el.dataset.d)); if (!box[id]) delete box[id]; saveCart(); show(); },
    toTier: function (el) { S.cart.lines[el.dataset.p] = Number(el.dataset.q); saveCart(); show(); },
    addFriend: function () { var u = addFriendUrl(); if (u) openUrl(u, false); },
    closeApp: function () { try { if (liff.isInClient()) { liff.closeWindow(); return; } } catch (e) { } go('home', {}); },
    copy: function (el) { copyText(el.dataset.t); },
    share: function (el) {
      liff.shareTargetPicker([{ type: 'text', text: el.dataset.msg || ('ร้านเปิดสั่งของใน LINE แล้ว ลงทะเบียนผ่านลิงก์นี้รับส่วนลดลูกค้าใหม่: ' + el.dataset.t) }]).then(function (r) { if (r) toast('ส่งแล้ว'); }).catch(function (e) { toast('ส่งไม่ได้: ' + e.message); });
    },
    linkReset: function () { S.ui.linkList = null; S.ui.linkSel = null; pageLink(); },
    linkBack: function () { S.ui.linkSel = null; pageLink(); },
    linkPick: function (el) { var x = (S.ui.linkList || [])[Number(el.dataset.i)]; if (!x) return; S.ui.linkSel = x; pageLink(); },
    geo: function () {
      if (!navigator.geolocation) { toast('อุปกรณ์นี้ปักหมุดไม่ได้ พิมพ์จุดสังเกตแทนได้'); return; }
      busy(true, 'กำลังหาตำแหน่ง...');
      navigator.geolocation.getCurrentPosition(function (p) {
        busy(false); S.ui.geo = { lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 };
        var gb = app.querySelector('.geo-box'); if (gb) gb.outerHTML = geoBox(); toast('ปักหมุดแล้ว');
      }, function () { busy(false); toast('ใช้ตำแหน่งไม่ได้ (ยังไม่อนุญาต) พิมพ์จุดสังเกตแทนได้', 4000); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
    },
    submitOrder: function () {
      var k = calcNow(), a = k.mode === 'deliver' ? shipAddr() : null;
      run('กำลังส่งออเดอร์...', api('submitOrder', { lines: S.cart.lines, bundles: S.cart.bundles, useCoin: !!S.cart.useCoin, usePoints: !!(S.cart.usePoints && k.pointsMax > 0), promo: k.promo.both ? k.promoKind : (S.cart.promo || ''), addrId: a ? a.id : '',
        mode: S.cart.mode, slot: S.cart.slot }), function (r) {
        S.cart.lines = {}; S.cart.bundles = {}; S.cart.useCoin = false; S.cart.usePoints = false; S.cart.promo = ''; S.cart.evening = false; S.cart.eveningDate = ''; saveCart(); S.ui.eta = null; S.ui.etaKey = '';
        var q = r.quote || {};
        go('done', { id: r.orderId, dd: r.deliverDate || '', slot: r.slot || '', depart: r.depart || '', mode: r.mode || '', pool: r.pool ? '1' : '', evening: r.evening ? '1' : '', payBy: r.payBy || '', promo: r.promo || '', pd: r.promoDisc || '', pu: r.pointsUse || '', low: (r.lowStock || []).join(', '),
          qk: q.kind || '', qd: q.date || '', qa: q.at || '', qu: q.until || '', qw: q.within === false ? '0' : '', st: r.status || '' });
        refreshMe().catch(function () { }); // อัปเดตข้อมูลของฉันเบื้องหลัง ไม่ต้องรอ
      }).then(function (r) { // หลังบ้านปฏิเสธ (พื้นที่/หมุด/สถานะเปลี่ยน) → โหลดข้อมูลล่าสุด (รวมเส้นเขต/แถบขอบ) แล้ววาดตะกร้าใหม่ให้ตรงกับหลังบ้าน
        var ec = !r && S.lastErr ? S.lastErr.code || '' : ''; if (!/^(PIN|AREA|STATE)$/.test(ec)) return;
        Promise.all([refreshMe(), /^(PIN|AREA)$/.test(ec) ? api('catalog', {}, { quiet: true, tries: 1 }).then(function (c) { if (validCat(c)) { S.cat = c; saveBoot(); } }).catch(function () { }) : null]).then(function () { if (S.page === 'cart') pageCart(); }).catch(function () { });
      });
    },
    setMode: function (el) { S.cart.mode = el.dataset.p; S.cart.modeSet = true; S.ui.etaKey = ''; saveCart(); pageCart(); },
    shipTo: function () { go('shipto', {}); },
    shipUse: function (el) { S.cart.addrId = el.dataset.id; S.ui.etaKey = ''; S.ui.eta = null; saveCart(); backTo('cart'); },
    submitWhy: function () {
      var k = calcNow(), ar = k.mode === 'deliver' ? areaOf(shipAddr()) : { ok: true }, why = cartBlocks(k, ar);
      if (!why.length) return ACT.submitOrder();
      var LBL = { close: 1 }, m = document.createElement('div'); m.className = 'modal why-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'why-h');
      m.innerHTML = '<div class="modal-in"><h3 id="why-h">' + icon('alert') + ' ยังยืนยันออเดอร์ไม่ได้</h3><ol class="why-list">' + why.map(function (x) { return '<li><b>' + esc(x.t) + '</b>' + (x.b && x.b.length && !(x.b.length === 1 && LBL[x.b[0][1]]) ? '<div class="why-acts">' + x.b.map(function (b, i) { return '<button class="btn sm' + (i === 0 ? ' pri' : '') + '" data-a="whyDo" data-p="' + b[1] + '">' + esc(b[0]) + '</button>'; }).join('') + '</div>' : '') + '</li>'; }).join('') + '</ol><button class="btn block" data-a="modalClose">ปิด</button></div>';
      m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
      document.body.appendChild(m); var f = m.querySelector('.why-acts .btn, [data-a=modalClose]'); if (f) f.focus();
    },
    whyDo: function (el) {
      var x = document.querySelector('.modal'); if (x) x.remove();
      var p = el.dataset.p;
      if (p === 'shipTo') return go('shipto', {});
      if (p === 'shop') { S.cart.mode = 'shop'; S.cart.modeSet = true; S.ui.etaKey = ''; saveCart(); return pageCart(); }
      if (p === 'catalog') return go('catalog', {});
    },
    modalClose: function () { var x = document.querySelector('.modal'); if (x) x.remove(); },
    /* 3.1.3 สวมบทลูกค้าทดสอบ */
    uatExit: function () { personaExit(''); },
    uatChat: function () {
      busy(true, 'กำลังโหลดแชตจำลอง...');
      api('uatTool', { op: 'chat', uid: S.asCust, limit: 30 }).then(function (r) {
        busy(false);
        var m = document.createElement('div'); m.className = 'modal chat-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'tc-h');
        m.innerHTML = '<div class="modal-in"><h3 id="tc-h">แชตจำลอง: ' + esc((S.uat && S.uat.persona && S.uat.persona.name) || '') + '</h3><div class="hint">ข้อความที่ร้านส่งถึงลูกค้าทดสอบ (ล่าสุดอยู่บน) ไม่ได้ส่งออก LINE จริง</div><div class="tc-list">' + chatList(r.chat, false) + '</div><button class="btn block" data-a="modalClose">ปิด</button></div>';
        m.addEventListener('click', function (e) { if (e.target === m) m.remove(); });
        document.body.appendChild(m); var f = m.querySelector('[data-a=modalClose]'); if (f) f.focus();
      }).catch(function (e) { busy(false); toast(friendly(e), 4500); });
    },
    /* v3: ที่อยู่ / ปักหมุด / โปร */
    openLink: function (el) { if (el.dataset.u) openUrl(el.dataset.u, true); },
    shipPick: function () { S.ui.shipPick = !S.ui.shipPick; pageCart(); },
    addrNew: function (el) {
      if (addrList().length >= 5) { toast('บันทึกที่อยู่ได้สูงสุด 5 ที่ ลบที่อยู่เก่าก่อน'); return; }
      var first = !addrList().length, m = S.me.member;
      S.ui.addrDraft = { ret: el.dataset.ret || 'card', label: first ? (m.type === 'Consumer' ? 'บ้าน' : 'ร้าน') : '', address: first ? m.address || '' : '', landmark: first ? m.deliveryNote || '' : '', lat: first && m.lat && !isShopPin(m.lat, m.lng) ? m.lat : null, lng: first && m.lat && !isShopPin(m.lat, m.lng) ? m.lng : null, source: first && m.lat ? 'gps' : '' };
      S.ui.shipPick = false;
      if (S.ui.addrDraft.ret === 'cart' && !S.ui.addrDraft.lat) { // แบบ Grab: ปักหมุดก่อน แล้วค่อยกรอกรายละเอียด
        S.history.push({ page: S.page, params: S.params }); S.page = 'address'; S.params = {};
        S.ui.pin = { 'for': 'addr', lat: null, lng: null, source: '' }; go('pin', {}); return;
      }
      go('address', {});
    },
    addrEdit: function (el) { var a = addrList().filter(function (x) { return x.id === el.dataset.id; })[0]; if (!a) return; S.ui.addrDraft = Object.assign({ ret: el.dataset.ret || 'card' }, a, { source: a.source === 'legacy' ? 'map' : a.source }); go('address', {}); },
    addrDefault: function (el) { run('กำลังบันทึก...', api('addressDefault', { id: el.dataset.id }), function (r) { S.me.addresses = r.addresses; saveBoot(); toast('ตั้งเป็นที่อยู่หลักแล้ว'); show(); refreshMe().catch(function () { }); }); },
    addrDelete: function (el) {
      if (!el.dataset.sure) { el.dataset.sure = '1'; el.textContent = 'กดอีกครั้งเพื่อยืนยันลบ'; return; }
      run('กำลังลบ...', api('addressDelete', { id: el.dataset.id }), function (r) { S.me.addresses = r.addresses; if (S.cart.addrId === el.dataset.id) { S.cart.addrId = ''; saveCart(); } saveBoot(); S.ui.addrDraft = null; toast('ลบที่อยู่แล้ว'); back(); refreshMe().catch(function () { }); });
    },
    pinOpen: function (el) {
      var fr = el.dataset['for'] || 'addr', cur = fr === 'reg' ? S.ui.regPin : S.ui.addrDraft;
      if (fr === 'reg') S.ui.regDraft = formVals('register'); else if (S.ui.addrDraft) Object.assign(S.ui.addrDraft, formVals('addressSave'));
      S.ui.pin = { 'for': fr, lat: cur && cur.lat ? Number(cur.lat) : null, lng: cur && cur.lng ? Number(cur.lng) : null, source: (cur && cur.source) || '' };
      go('pin', {});
    },
    pinGps: function () {
      if (!navigator.geolocation) { toast('อุปกรณ์นี้หาตำแหน่งไม่ได้ เลื่อนแผนที่ หรือวางลิงก์แทนได้'); return; }
      busy(true, 'กำลังหาตำแหน่ง...');
      navigator.geolocation.getCurrentPosition(function (p) {
        busy(false); pinGo(p.coords.latitude, p.coords.longitude, 'gps');
        toast(p.coords.accuracy > 100 ? 'ตำแหน่งคลาดเคลื่อนประมาณ ' + Math.round(p.coords.accuracy) + ' ม. เลื่อนแผนที่ให้หมุดตรงอีกครั้ง' : 'ได้ตำแหน่งแล้ว ตรวจหมุดอีกครั้ง', 4000);
      }, function () { busy(false); toast('ใช้ตำแหน่งไม่ได้ (ยังไม่อนุญาต) เลื่อนแผนที่ หรือวางลิงก์แทนได้', 4500); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
    },
    pinUse: function (el) { var P = S.ui.pin, x = P && P.results && P.results[Number(el.dataset.i)]; if (!x) return; pinGo(x.lat, x.lng, 'search'); P.results = null; var box = document.getElementById('pin-results'); if (box) box.innerHTML = ''; },
    pinConfirm: function () {
      var P = S.ui.pin; if (!P || !P.lat) { toast('เลื่อนแผนที่ให้หมุดตรงจุดส่งของก่อน'); return; }
      if (isShopPin(P.lat, P.lng)) { toast('หมุดตรงกับตำแหน่งร้านพอดี กรุณาเลื่อนไปที่อยู่ของคุณ', 4000); return; }
      var g = { lat: P.lat, lng: P.lng, source: P.source || 'map' };
      if (P['for'] === 'reg') S.ui.regPin = g; else if (S.ui.addrDraft) Object.assign(S.ui.addrDraft, g);
      dropMap(); S.ui.pin = null; back();
    },
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
    standingFromLast: function () { var lb = S.me.lastBasket; if (!lb) return; S.ui.stDraft = Object.assign({}, lb.lines); pageStanding(); },
    standingAdd: function () { var sel = document.getElementById('st-add'), sku = sel && sel.value; if (!sku) { toast('เลือกสินค้าก่อน'); return; } var d = stKeep(); d[sku] = d[sku] || 1; S.ui.stDraft = d; pageStanding(); },
    standingDel: function (el) { var d = stKeep(); delete d[el.dataset.p]; S.ui.stDraft = d; pageStanding(); },
    standingConfirm: function () {
      run('กำลังยืนยัน...', api('standingConfirm', { date: S.params.confirm }), function (r) { toast(r.already ? 'ยืนยันวันที่ ' + thDate(r.date) + ' ไว้แล้ว' : 'ยืนยันแล้ว ออเดอร์ ' + r.orderId, 4000); delete S.params.confirm; return refreshMe().then(pageStanding); });
    },
    partnerJoin: function () { run('กำลังผูกบัญชี...', api('partnerJoin', { pid: S.params.pid, code: S.params.jc || S.params.code }), function () { return refreshMe().then(function () { go('partner', {}); }); }); },
    acceptInvite: function () { run('กำลังเข้าร่วมทีม...', api('staffJoin', { inv: S.params.inv }), function (r) { return refreshMe().then(function () { toast('เข้าร่วมทีมแล้ว: ' + r.label); S.history = []; go('admin', {}, true); }); }); }
  };
  /* เบอร์โทรแบบเดียวกับหลังบ้าน (phone_): เหลือแต่ตัวเลข, +66 → 0 */
  function phoneNorm(v) { var x = String(v === null || v === undefined ? '' : v).replace(/\D/g, ''); if (/^66\d{9}$/.test(x)) x = '0' + x.slice(2); if (/^\d{9}$/.test(x) && x.charAt(0) !== '0') x = '0' + x; return x; }
  function refreshMe() { return api('me').then(function (r) { S.me = r; loadCart(); saveBoot(); }); }
  var FORMS = {
    register: function (f) {
      var fd = new FormData(f), g = S.ui.regPin || {}, sp = S.ui.shopPhoto, pr0 = S.params, ck0 = chKind(pr0.ch), sign0 = (!!pr0.src && !pr0.ref) || ck0 === 'PARTNER';
      var miss = !String(fd.get('name') || '').trim() ? ['#rg-name', 'กรอกชื่อ' + (fd.get('type') === 'Consumer' || sign0 ? 'ของคุณ' : 'ร้าน')] : !/^0\d{8,9}$/.test(phoneNorm(fd.get('phone'))) ? ['#rg-phone', 'กรอกเบอร์โทร 10 หลัก เช่น 0812345678']
        : !sign0 && !g.lat ? ['.pin-box', 'ปักหมุดที่อยู่จัดส่งก่อน (กด "ปักหมุดบนแผนที่")'] : !fd.get('consent') ? ['input[name=consent]', 'ติ๊กยินยอมการเก็บข้อมูลก่อน'] : null;
      if (miss) { toast(miss[1], 3500); var el0 = f.querySelector(miss[0]); if (el0) { el0.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (el0.focus) el0.focus({ preventScroll: true }); } return; }
      run('กำลังลงทะเบียน...', api('register', { name: fd.get('name'), contact: fd.get('contact') || '', type: fd.get('type') || 'FS', trade: fd.get('trade') || '', address: fd.get('address') || '', deliveryNote: fd.get('deliveryNote') || '', phone: phoneNorm(fd.get('phone')),
        lat: g.lat || '', lng: g.lng || '', pinSource: g.source || '', consent: !!fd.get('consent'), consentMkt: !!fd.get('consentMkt'), taxId: fd.get('taxId') || '', shopPhoto: sp && sp.data ? sp.data : '', refCode: fd.get('refCode') || '',
        ref: S.params.ref || '', src: S.params.ref ? '' : (S.params.src || ''), ch: S.params.ch || '' }), function (r) {
        S.ui.regDraft = null; S.ui.regPin = null; S.ui.shopPhoto = null;
        return refreshMe().then(function () {
          toast(r.status === 'review' || r.flagged ? 'ลงทะเบียนแล้ว ร้านจะตรวจข้อมูลก่อนให้สิทธิ์ลูกค้าใหม่ (ภายใน 1 วันทำการ)' : r.status === 'existing' ? 'ลงทะเบียนแล้ว · ร้านพบว่าเป็นลูกค้าเดิม ใช้ราคาและแต้มตามปกติ' : 'ลงทะเบียนเรียบร้อย ยินดีต้อนรับค่ะ', 4500);
          S.history = [];
          var promo = magnetMine() || (r.member.sourceKind === 'ref' && smartOn());
          go(promo ? 'catalog' : r.member.sourceKind === 'ref' ? 'catalog' : 'home', promo ? { cat: 'promo' } : r.member.sourceKind === 'ref' ? { cat: 'set' } : {}, true);
        });
      }).then(function (r) { if (!r && S.lastErr && S.lastErr.code === 'LINK') { S.ui.linkList = null; S.ui.linkSel = null; S.ui.linkAuto = false; go('link', { phone: fd.get('phone') }); } });
    },
    profileSave: function (f) {
      var fd = new FormData(f), data = { deliveryNote: fd.get('deliveryNote') || '' };
      if (fd.get('needBy') !== null) data.needBy = fd.get('needBy') || '';
      if (fd.get('address') !== null) data.address = fd.get('address') || '';
      if (fd.get('zone') !== null) data.zone = fd.get('zone') || '';
      if (fd.get('trade') !== null) data.trade = fd.get('trade') || '';
      run('กำลังบันทึก...', api('profileSave', data), function () { toast('บันทึกแล้ว'); return refreshMe().then(pageCard); });
    },
    addressSave: function (f) {
      var d = S.ui.addrDraft, fd = new FormData(f); if (!d) return;
      if (!d.lat) { toast('กรุณาปักหมุดตำแหน่งส่งของก่อน'); return; }
      run('กำลังบันทึกที่อยู่...', api('addressSave', { id: d.id || '', label: fd.get('label') || '', address: fd.get('address') || '', landmark: fd.get('landmark') || '', contact: fd.get('contact') || '', lat: d.lat, lng: d.lng, source: d.source || 'map', makeDefault: !!fd.get('makeDefault') }), function (r) {
        S.me.addresses = r.addresses; saveBoot();
        if (d.ret === 'cart') { S.cart.addrId = r.address.id; S.ui.etaKey = ''; S.ui.eta = null; saveCart(); }
        var st = r.address.area; toast(st === 'out' ? 'บันทึกแล้ว ที่อยู่นี้อยู่นอกพื้นที่จัดส่ง (เลือกรับเองที่ร้านได้)' : 'บันทึกที่อยู่แล้ว', st === 'out' ? 5000 : 2500);
        S.ui.addrDraft = null; if (d.ret === 'cart') backTo('cart'); else back();
        refreshMe().catch(function () { });
      });
    },
    pinSearch: function (f) {
      var P = S.ui.pin, q = String(new FormData(f).get('q') || '').trim(); if (!q || !P) return;
      if (Date.now() - (P.lastQ || 0) < 1200) { toast('รอสักครู่แล้วค้นหาใหม่'); return; } // นโยบาย Nominatim: ไม่เกิน 1 ครั้ง/วินาที
      P.lastQ = Date.now(); P.q = q; busy(true, 'กำลังค้นหา...');
      var A = S.cat.cfg.AREA || {}, sh = A.shop && Number(A.shop[0]) ? A.shop : [13.8008, 100.6458], vb = searchBox(A, sh).join(',');
      var look = function (bounded) { // 3.1.3: ค้นในเขตส่งก่อน (กรอบเส้นเขต + แถบขอบ) ไม่พบค่อยค้นทั้งประเทศ · เรียงใกล้ร้านก่อน + บอกระยะ + ในเขต/นอกเขต
        return fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=th&accept-language=th&viewbox=' + vb + (bounded ? '&bounded=1' : '') + '&q=' + encodeURIComponent(q), { headers: { Accept: 'application/json' }, referrerPolicy: 'strict-origin-when-cross-origin' })
          .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
      };
      look(true).then(function (list) { if (list && list.length) return list; P.far = true; return new Promise(function (res) { setTimeout(res, 1200); }).then(function () { return look(false); }); })
        .then(function (list) {
          var near = !P.far; P.far = false;
          busy(false); P.results = (list || []).map(function (x) { var la = Number(x.lat), ln = Number(x.lon); return { name: String(x.display_name || ''), lat: la, lng: ln, km: la && ln ? haversineKm(Number(sh[0]), Number(sh[1]), la, ln) : 999, area: la && ln && A.poly && A.poly.length >= 3 ? geoArea(la, ln, A.poly, A.band).status : '' }; }).filter(function (x) { return x.lat && x.lng; })
            .sort(function (a, b) { return a.km - b.km; });
          if (!near && P.results.length) toast('ไม่พบในเขตส่งของร้าน แสดงผลที่อื่นแทน ตรวจระยะก่อนเลือก', 4000);
          var box = document.getElementById('pin-results');
          if (box) box.innerHTML = P.results.length ? P.results.map(function (x, i) { var tag = x.area === 'in' ? '<span class="pill paid">ในเขตส่ง</span>' : x.area === 'band' ? '<span class="pill new">แถบขอบเขต</span>' : x.area === 'out' ? '<span class="pill red">นอกเขตส่ง</span>' : ''; return '<button type="button" class="pin-res" data-a="pinUse" data-i="' + i + '">' + icon('pin') + '<span>' + esc(x.name) + (x.km < 999 ? '<small class="hint">ห่างร้านประมาณ ' + (Math.round(x.km * 1.3 * 10) / 10) + ' กม. ' + tag + '</small>' : '') + '</span></button>'; }).join('') : '<div class="hint">ไม่พบสถานที่ ลองพิมพ์ชื่ออื่น หรือเลื่อนแผนที่เอง</div>';
        })
        .catch(function () { busy(false); toast('ค้นหาไม่สำเร็จ ลองเลื่อนแผนที่เอง หรือวางลิงก์ Google Maps แทน', 4000); });
    },
    pinLink: function (f) {
      var u = String(new FormData(f).get('url') || '').trim(); if (!u) return;
      var ll = localLatLng(u); // 3.1.2: พิกัดตัวเลข / ลิงก์ Google Maps แบบยาว อ่านในเครื่องเลย ไม่ต้องรอหลังบ้าน
      if (ll) { pinGo(ll[0], ll[1], 'link'); toast('ได้ตำแหน่งแล้ว ตรวจหมุดอีกครั้ง', 3000); return; }
      busy(true, 'กำลังอ่านตำแหน่งจากลิงก์...');
      api('expandLink', { url: u }, { tries: 2 }).then(function (r) { busy(false); pinGo(r.lat, r.lng, 'link'); toast('ได้ตำแหน่งจากลิงก์แล้ว ตรวจหมุดอีกครั้ง', 3500); }).catch(function (e) { busy(false); toast(friendly(e), 5500); });
    },
    linkFind: function (f) { var q = String(new FormData(f).get('q') || '').trim(); if (q.length < 2) { toast('พิมพ์อย่างน้อย 2 ตัวอักษร'); return; } linkSearch(q); },
    linkConfirm: function (f) {
      var x = S.ui.linkSel, fd = new FormData(f); if (!x) return;
      run('กำลังผูกบัญชี...', api('linkConfirm', { id: x.id, consent: !!fd.get('consent'), phone: x.verify === 'phone' ? S.ui.linkQ : String(fd.get('phone') || ''), last4: String(fd.get('last4') || '') }), function (r) {
        S.ui.linkList = null; S.ui.linkSel = null; S.ui.linkQ = '';
        return refreshMe().then(function () { toast(r.pending ? 'ส่งคำขอแล้ว ร้านจะยืนยันภายใน 1 วันทำการ สั่งของได้เลย' : 'ผูกบัญชีเรียบร้อย', 4500); S.history = []; go('home', {}, true); });
      });
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
      if (!Object.keys(items).length) { toast('ใส่จำนวนสินค้าอย่างน้อย 1 รายการ'); return; }
      run('กำลังบันทึก...', api('standingSave', { items: items, days: days, slot: fd.get('slot') }), function (r) { toast('บันทึกสั่งประจำแล้ว'); S.ui.stDraft = null; S.data.standing = { standing: r.standing }; pageStanding(); });
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
  function pickShopPhoto(input) { // รูปหน้าร้าน (ไม่บังคับ): ย่อในเครื่องก่อนส่ง
    var file = input.files && input.files[0]; if (!file) return;
    S.ui.regDraft = formVals('register'); S.ui.shopPhoto = { reading: true }; pageRegister();
    loadSlipLib().then(function (L) { return L.readFile(file).then(function (img) { return L.compress(img, 1024, 0.72); }); })
      .then(function (data) { S.ui.shopPhoto = { data: data, preview: data }; if (S.page === 'register') { S.ui.regDraft = formVals('register'); pageRegister(); } })
      .catch(function () { S.ui.shopPhoto = null; toast('เปิดรูปไม่ได้ ลองเลือกรูปใหม่'); if (S.page === 'register') pageRegister(); });
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
    else if (c === 'usePoints') { S.cart.usePoints = t.checked; saveCart(); pageCart(); }
    else if (c === 'promo') { S.cart.promo = t.value; saveCart(); pageCart(); }
    else if (c === 'shipAddr') { S.cart.addrId = t.value; S.ui.shipPick = false; saveCart(); pageCart(); }
    else if (c === 'shopPhoto') pickShopPhoto(t);
    else if (c === 'mode') { S.cart.mode = t.value; S.cart.modeSet = true; saveCart(); pageCart(); }
    else if (c === 'slot') { S.cart.slot = t.value; saveCart(); }
    else if (c === 'needBy') { S.cart.needBy = t.value; saveCart(); }
    else if (c === 'when') { S.cart.evening = t.value === 'evening'; saveCart(); pageCart(); }
    else if (c === 'evDate') { S.cart.eveningDate = t.value; saveCart(); }
    else if (c === 'regType') { S.ui.regType = t.value; S.ui.regDraft = formVals('register'); pageRegister(); }
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
  function saveBoot() { if (S.cat && S.me && !S.asCust) store(BOOT_KEY, { v: APP_VERSION, uid: S.me.userId, cat: S.cat, me: S.me, at: Date.now() }); }
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
    S.params = readParams(); S.page = S.params.page || 'home'; S.asRole = (store('pk2_asrole') || ''); S.asCust = sessGet('pk2_ascust'); // 3.1.3 สวมบทลูกค้าทดสอบ (เฉพาะแท็บนี้)
    if (S.asCust) fresh = false; // สวมบท: ไม่ใช้ข้อมูลของบัญชีจริงที่เก็บในเครื่อง
    if (fresh && validMe(cached.me) && !S.params.inv && !S.params.ref && !S.params.src && !S.params.ch) { // เปิดทันทีจากข้อมูลล่าสุดในเครื่อง ไม่ต้องรอ LINE (เร็วขึ้น ~1 วินาที)
      S.cat = cached.cat; S.me = cached.me; S.fromCache = true; S.early = true; loadCart(); show();
    }
    liff.init({ liffId: CFG.LIFF_ID, withLoginOnExternalBrowser: false }).then(function () { // 3.1.2: ล็อกอินเองพร้อมหน้าปัจจุบัน (ล็อกอินอัตโนมัติของ LINE พากลับหน้าแรกเสมอ)
      if (!liff.isLoggedIn()) { try { sessionStorage.setItem('pk2_after_login', location.search); } catch (e) { } liff.login({ redirectUri: location.href }); return null; }
      try { var al = sessionStorage.getItem('pk2_after_login'); sessionStorage.removeItem('pk2_after_login'); if (al && !S.params.page) { var ap = paramsOf(al); Object.keys(ap).forEach(function (k) { if (!S.params[k]) S.params[k] = ap[k]; }); S.page = S.params.page || S.page; } } catch (e) { }
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
      if ((S.params.src || S.params.ref || S.params.ch) && !S.me.member) { // นับ "สแกน/เปิดลิงก์" ของป้าย ลิงก์ชวน และช่องทาง (ครั้งเดียวต่อการเปิด) · ช่องทางแรกที่สแกน = ที่มาของลูกค้า
        var sk = 'scan_' + (S.params.src || (S.params.ref ? 'r:' + S.params.ref : 'c:' + S.params.ch));
        try { if (!sessionStorage.getItem(sk)) { sessionStorage.setItem(sk, '1'); api('scan', { src: S.params.ref ? '' : S.params.src || '', ref: S.params.ref || '', ch: S.params.ch || '', page: S.page }, { quiet: true, tries: 1 }).catch(function () { }); } } catch (e) { }
      }
      if ((S.params.ref || S.params.src || S.params.ch) && !S.me.member && S.page === 'home') S.page = 'register';
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
    statusPill: statusPill, qrSvg: qrSvg, flexHtml: flexHtml, chatList: chatList, personaStart: personaStart, personaExit: personaExit, clockNow: clockNow, copyText: copyText, openUrl: openUrl, appLink: appLink, imgUrl: imgUrl, thumb: thumb, prod: prod, thDate: thDate, store: store, refreshMe: refreshMe,
    zoneName: zoneName, zoneSelect: zoneSelect, canShare: canShare, ACT: ACT, FORMS: FORMS, todayStr: todayStr, nowHM: nowHM, version: APP_VERSION,
    adminFrame: adminFrame, adminTools: adminTools, adminTheme: adminTheme, isDark: isDark, plainSep: plainSep, undot: undot, hoursOf: hoursOf, etaText: etaText,
    perf: PERF, evDayText: evDayText, offerText: offerText, rewardText: rewardText, geoArea: geoArea, areaPill: areaPill, fmtPts: fmtPts, promoPrice: promoPrice, loadSlipLib: loadSlipLib, txnNorm: function (v, n) { var d = String(v || '').replace(/\D/g, ''); n = n || 7; return d.length >= n ? d.slice(-n) : d.length >= 4 ? ('0000000000' + d).slice(-n) : ''; } };
  boot();
})();
