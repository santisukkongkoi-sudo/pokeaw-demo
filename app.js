/* MINI App ร้านโพธิ์แก้ว (ทดลอง) — หน้าลูกค้า + หน้าหลังร้าน · ข้อมูลทั้งหมดอยู่ใน Google Sheet ผ่าน Apps Script */
(function () {
  'use strict';
  var CFG = window.APP_CONFIG || {};

  /* ===== คำนวณตะกร้า (ใช้ร่วมกันทั้งหลังบ้านและหน้า MINI App — แก้ที่เดียวทั้งสองฝั่ง) ===== */
  function daysBetween(a, b) {
    return Math.round((Date.parse(String(b).slice(0, 10) + 'T00:00:00Z') - Date.parse(String(a).slice(0, 10) + 'T00:00:00Z')) / 864e5);
  }
  function unitPrice(p, q) {
    var pr = p.tiers[0].price;
    for (var i = 0; i < p.tiers.length; i++) { if (q >= p.tiers[i].min) pr = p.tiers[i].price; }
    return pr;
  }
  /**
   * cart: { lines: {sku: qty}, bundles: {id: qty}, useCoin: bool, mode: 'deliver'|'pickup', slot }
   * ctx:  { products: [...], bundles: [...], cfg: {...}, member: {couponLeft, couponExpires, sourceKind, inZone, regDate} | null, coinBal, today: 'yyyy-MM-dd' }
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
      var kg = 0, normal = 0;
      b.items.forEach(function (it) { var p = pmap[it[0]]; if (p) { kg += p.kg * it[1]; normal += unitPrice(p, it[1]) * it[1]; } });
      bl.push({ id: id, name: b.name, qty: q, price: b.price, total: b.price * q, kg: kg * q, normal: normal * q });
    });
    var subtotal = 0, eligible = 0, kgSum = 0;
    lines.forEach(function (l) { subtotal += l.total; kgSum += l.kg; if (l.promo) eligible += l.total; });
    bl.forEach(function (l) { subtotal += l.total; kgSum += l.kg; eligible += l.total; });
    var coupon = 0, couponWhy = '';
    if (m && Number(m.couponLeft) > 0) {
      if (String(m.couponExpires || '') < today) couponWhy = 'คูปองหมดอายุแล้ว';
      else if (subtotal < cfg.COUPON_MIN_BILL) couponWhy = 'ยอดยังไม่ถึง ' + cfg.COUPON_MIN_BILL + ' บาท คูปองยังไม่ทำงาน';
      else if (eligible <= 0) couponWhy = 'คูปองใช้ได้กับสินค้าป้าย ร่วมโปร และเซ็ตคุ้มเท่านั้น';
      else coupon = Math.min(Math.round(eligible * cfg.COUPON_PCT / 100), cfg.COUPON_CAP);
    }
    var bal = Math.max(0, Math.floor(Number(ctx.coinBal) || 0));
    var coinMax = Math.max(0, Math.floor((subtotal - coupon) * cfg.COIN_MAX_PCT / 100 / cfg.COIN_VALUE));
    var coinUse = cart.useCoin ? Math.min(bal, coinMax) : 0;
    var net = subtotal - coupon - coinUse * cfg.COIN_VALUE;
    var mode = (cart.mode === 'pickup' && m && m.sourceKind === 'sign') ? 'pickup' : 'deliver';
    var min = cfg.MIN_ORDER;
    if (mode === 'pickup') min = 0;
    else if (m && m.sourceKind === 'ref' && m.inZone && m.regDate && daysBetween(m.regDate, today) <= cfg.NEW_MIN_DAYS) min = cfg.NEW_MIN_ORDER;
    var belowMin = mode !== 'pickup' && subtotal > 0 && subtotal < min;
    return { lines: lines, bundles: bl, subtotal: subtotal, eligible: eligible, coupon: coupon, couponWhy: couponWhy,
      coinBal: bal, coinMax: coinMax, coinUse: coinUse, net: net, kg: Math.round(kgSum * 10) / 10, mode: mode, min: min,
      belowMin: belowMin, count: lines.length + bl.length, errors: errors };
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

  var CAT = { set: 'เซ็ตคุ้ม', pork: 'หมู', poultry: 'ไก่', egg: 'ไข่', process: 'แปรรูป', other: 'อื่นๆ' };
  var CAT_ORDER = ['pork', 'poultry', 'egg', 'process'];
  function catLabel(k) { return CAT[k] || k; }
  function catList() {
    var have = [];
    S.cat.products.forEach(function (p) { if (have.indexOf(p.cat) < 0) have.push(p.cat); });
    return CAT_ORDER.filter(function (k) { return have.indexOf(k) >= 0; }).concat(have.filter(function (k) { return CAT_ORDER.indexOf(k) < 0; }));
  }
  var S = { me: null, cat: null, page: 'home', params: {}, history: [], cart: null, admin: null, adminTab: 'orders', check: null, ui: {} };
  var app = document.getElementById('app');

  /* ---------- ตัวช่วย ---------- */
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); }
  function baht(n) { return '฿' + fmt(n); }
  function toast(t) { var el = document.getElementById('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { el.hidden = true; }, 3200); }
  function busy(on, text) {
    var el = document.getElementById('busy');
    if (on) { if (!el) { el = document.createElement('div'); el.id = 'busy'; el.className = 'busy'; document.body.appendChild(el); } el.innerHTML = '<div>' + esc(text || 'กำลังทำรายการ...') + '</div>'; }
    else if (el) el.remove();
  }
  function store(key, val) { try { if (val === undefined) { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } localStorage.setItem(key, JSON.stringify(val)); } catch (e) { return null; } return null; }
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
  function api(action, data) {
    var token = '';
    try { token = liff.getAccessToken() || ''; } catch (e) { token = ''; }
    var body = Object.assign({ action: action, token: token }, data || {});
    return fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .catch(function () { var e = new Error('ติดต่อหลังบ้านไม่ได้ ตรวจอินเทอร์เน็ต, API_URL ใน config.js และการ Deploy แบบ Who has access = Anyone'); e.code = 'NET'; throw e; })
      .then(function (r) {
        if (!r.ok) { var e = new Error('หลังบ้านตอบกลับผิดปกติ (' + r.status + ') ตรวจ API_URL ใน config.js'); e.code = 'NET'; throw e; }
        return r.text();
      })
      .then(function (t) {
        var j;
        try { j = JSON.parse(t); } catch (x) { var e = new Error('หลังบ้านไม่ได้ตอบเป็นข้อมูล — ตรวจว่า API_URL ลงท้าย /exec, Deploy แบบ Anyone และกด Deploy เวอร์ชันใหม่หลังแก้โค้ด'); e.code = 'NET'; throw e; }
        if (!j.ok) { var e2 = new Error(j.error || 'เกิดข้อผิดพลาด'); e2.code = j.code; throw e2; }
        return j;
      });
  }
  function fail(e) {
    busy(false);
    if (e && e.code === 'AUTH') { render('<div class="wrap"><div class="alert bad">' + esc(e.message) + '</div><button class="btn pri block" data-a="reload">เปิดใหม่</button></div>'); return; }
    toast((e && e.message) || 'เกิดข้อผิดพลาด');
  }
  function run(text, promise, then) {
    busy(true, text);
    return promise.then(function (r) { busy(false); if (then) then(r); return r; }).catch(fail);
  }
  function qrSvg(text) {
    try { return QR.svg(text, 4); } catch (e) { return '<div class="hint">' + esc(e.message) + '</div>'; }
  }
  function copyText(t) {
    function fallback() { var i = document.createElement('input'); i.value = t; document.body.appendChild(i); i.select(); try { document.execCommand('copy'); toast('คัดลอกแล้ว'); } catch (e) { toast(t); } i.remove(); }
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { toast('คัดลอกแล้ว'); }, fallback); else fallback(); } catch (e) { fallback(); }
  }
  function openUrl(url) { try { if (liff.isInClient()) { liff.openWindow({ url: url, external: false }); return; } } catch (e) { } window.open(url, '_blank'); }
  function appLink(page, params) {
    var base = (S.cat && S.cat.cfg.LINK_BASE) || 'https://miniapp.line.me/', id = (S.cat && S.cat.cfg.LIFF_ID) || CFG.LIFF_ID;
    var q = '?page=' + encodeURIComponent(page);
    Object.keys(params || {}).forEach(function (k) { q += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); });
    return base + id + q;
  }
  function addFriendUrl() { var id = (S.cat && S.cat.cfg.OA_BASIC_ID) || ''; return id ? 'https://line.me/R/ti/p/' + encodeURIComponent(id) : ''; }

  /* ---------- ตะกร้า ---------- */
  function cartKey() { return 'cart_' + ((S.me && S.me.userId) || 'x'); }
  function loadCart() { S.cart = store(cartKey()) || { lines: {}, bundles: {}, useCoin: false, mode: 'deliver', slot: '' }; }
  function saveCart() { store(cartKey(), S.cart); }
  function calcNow() {
    var m = S.me && S.me.member;
    return calcCart(S.cart, { products: S.cat.products, bundles: S.cat.bundles, cfg: S.cat.cfg, today: S.cat.today, coinBal: S.me ? S.me.coinBal : 0,
      member: m ? { couponLeft: m.couponLeft, couponExpires: m.couponExpires, sourceKind: m.sourceKind, inZone: m.inZone, regDate: m.regDate } : null });
  }
  function prod(sku) { return S.cat.products.filter(function (p) { return p.sku === sku; })[0]; }

  /* ---------- นำทาง ---------- */
  var MEMBER_PAGES = { catalog: 1, cart: 1, bills: 1, bill: 1, invite: 1, wallet: 1, standing: 1, card: 1, reorder: 1 };
  function go(page, params, noPush) {
    if (!noPush) S.history.push({ page: S.page, params: S.params });
    S.page = page; S.params = params || {};
    if (page === 'admin') S.admin = null; // เข้าหน้าหลังร้านใหม่ทุกครั้ง = โหลดข้อมูลล่าสุด
    window.scrollTo(0, 0);
    show();
  }
  function back() { var h = S.history.pop(); if (h) { S.page = h.page; S.params = h.params; show(); } else go('home', {}, true); }
  function render(html) { app.innerHTML = html; }
  function top(title, sub, canBack) {
    return '<div class="top">' + (canBack ? '<button class="ic" data-a="back" aria-label="ย้อนกลับ">‹</button>' : '') +
      '<div class="t"><b>' + esc(title) + '</b><small>' + esc(sub || (S.cat ? S.cat.cfg.SHOP_NAME : '')) + '</small></div>' +
      (S.page !== 'home' && S.page !== 'admin' ? '<button class="ic" data-a="home" aria-label="หน้าแรก">⌂</button>' : '') + '</div>';
  }

  function show() {
    var p = S.page, m = S.me && S.me.member;
    if (p === 'admin') return pageAdmin();
    if (p === 'staffjoin') return pageStaffJoin();
    if (p === 'partnerjoin') return pagePartnerJoin();
    if (p === 'partner') return pagePartner();
    if (p === 'link') return pageLink();
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

  /* ---------- หน้าแรก ---------- */
  function pageHome() {
    var m = S.me.member;
    if (!m) {
      return render(top('ยินดีต้อนรับ', '', false) + '<div class="wrap">' +
        '<div class="box"><h3>' + esc(S.cat.cfg.SHOP_NAME) + '</h3><div class="hint">สั่งของ ดูบิล และจ่ายเงินได้ใน LINE · ระบบทดลอง ข้อมูลสมมติ</div></div>' +
        '<button class="btn pri block" data-a="go" data-p="register">ลงทะเบียนร้านใหม่</button>' +
        '<button class="btn block" data-a="go" data-p="link">ฉันเป็นลูกค้าเดิม (ผูกเลขสมาชิก)</button>' +
        staffLinks() + '</div>');
    }
    if (m.rejected) return pageRejected();
    var friend = addFriendUrl();
    var html = top(m.name, m.sno ? 'เลขสมาชิก ' + m.sno : 'รอร้านยืนยันสมาชิก (สั่งของได้แล้ว)', false) + '<div class="wrap">';
    if (m.couponLeft > 0 && m.couponExpires >= S.cat.today) html += '<div class="alert ok">คูปองลูกค้าใหม่ ' + S.cat.cfg.COUPON_PCT + '% เหลือ ' + m.couponLeft + ' บิล ถึง ' + esc(m.couponExpires) + '</div>';
    html += '<div class="tiles">' +
      '<button class="tile" data-a="go" data-p="catalog">สั่งของ</button>' +
      '<button class="tile" data-a="go" data-p="reorder">สั่งเหมือนเดิม</button>' +
      '<button class="tile" data-a="go" data-p="bills">บิลของฉัน</button>' +
      '<button class="tile" data-a="go" data-p="' + (S.me.canRefer ? 'invite' : 'card') + '">' + (S.me.canRefer ? 'ชวนเพื่อน' : 'บัตรสมาชิก') + '</button>' +
      '<button class="tile" data-a="go" data-p="wallet">Coin & คูปอง</button>' +
      '<button class="tile" data-a="go" data-p="standing">สั่งประจำ</button></div>';
    html += '<div class="kv"><div><small>Coin ใช้ได้</small><b class="num">' + fmt(S.me.coinBal) + '</b></div><div><small>รออนุมัติ</small><b class="num">' + fmt(S.me.coinPending) + '</b></div><div><small>ที่มา</small><b style="font-size:13px">' + esc(m.sourceName || (m.sourceKind === 'existing' ? 'ลูกค้าเดิม' : 'สมัครเอง')) + '</b></div></div>';
    if (friend) html += '<button class="btn block" data-a="addFriend">เพิ่มเพื่อน LINE OA ของร้าน (รับบิลและแจ้งเตือน)</button>';
    html += staffLinks() + '</div>';
    render(html);
  }
  function staffLinks() {
    var h = '';
    if (S.me.staff) h += '<button class="btn blue block" data-a="go" data-p="admin">เปิดหน้าหลังร้าน</button>';
    if (S.me.partner) h += '<button class="btn block" data-a="go" data-p="partner">ยอดป้ายของฉัน (พาร์ทเนอร์)</button>';
    return h;
  }
  function pageRejected() { render(top('บัญชีนี้ใช้งานไม่ได้', '', false) + '<div class="wrap"><div class="alert bad">กรุณาติดต่อร้านในแชต LINE OA</div></div>'); }

  /* ---------- ลงทะเบียน / ผูกสมาชิก ---------- */
  function pageRegister() {
    var pr = S.params, isSign = !!pr.src && !pr.ref;
    var banner = '';
    if (pr.ref) banner = '<div class="alert ok">คุณได้รับคำชวน ลงทะเบียนแล้วรับคูปองลูกค้าใหม่ ' + S.cat.cfg.COUPON_PCT + '% (ผู้ชวนผูกให้อัตโนมัติ)</div>';
    if (isSign) banner = '<div class="alert ok">มาจากป้าย ' + esc(pr.src) + ' · รับของที่จุดรับได้ รอบ ' + esc(S.cat.cfg.CONDO_TIME) + '</div>';
    var h = top('ลงทะเบียน', '', S.history.length > 0) + '<div class="wrap">' + banner + '<form class="box form" data-form="register">' +
      '<div class="field"><label for="rg-name">' + (isSign ? 'ชื่อ' : 'ชื่อร้าน') + '</label><input id="rg-name" name="name" required maxlength="80"></div>' +
      (isSign ? '<div class="field"><label for="rg-addr">ตึก / ห้อง</label><input id="rg-addr" name="address" maxlength="120" placeholder="เช่น ตึก A ห้อง 1208"></div>' :
        '<div class="field"><label for="rg-contact">ชื่อผู้ติดต่อ</label><input id="rg-contact" name="contact" maxlength="60"></div>' +
        '<div class="field"><label for="rg-type">ประเภท</label><select id="rg-type" name="type"><option value="FS">ร้านอาหาร / แม่ค้า / แคเทอริ่ง</option><option value="Consumer">บ้าน</option></select></div>' +
        '<div class="field"><label for="rg-addr">ที่อยู่จัดส่ง / จุดสังเกต</label><textarea id="rg-addr" name="address" rows="2" maxlength="200"></textarea></div>') +
      '<div class="field"><label for="rg-phone">เบอร์โทร</label><input id="rg-phone" name="phone" inputmode="tel" required maxlength="20"></div>' +
      '<label class="chk"><input type="checkbox" name="consent" required><span>ยินยอมให้ร้านเก็บชื่อ เบอร์ และที่อยู่ เพื่อจัดส่งและแจ้งบิล ขอดูหรือลบข้อมูลได้ (ข้อความจริงรอ Legal/DPO)</span></label>' +
      '<button class="btn pri block" type="submit">ลงทะเบียน</button></form>' +
      (!pr.ref && !pr.src ? '<button class="btn block" data-a="go" data-p="link">ฉันเป็นลูกค้าเดิม (ผูกเลขสมาชิก)</button>' : '') + '</div>';
    render(h);
  }
  function pageLink() {
    if (S.me.member) return pageHome();
    var f = S.ui.linkFound;
    var h = top('ผูกเลขสมาชิก', '', true) + '<div class="wrap">';
    if (!f) h += '<form class="box form" data-form="linkFind"><div>กรอกเบอร์ที่ให้ไว้กับร้าน ระบบจะหาเลขสมาชิกให้</div><div class="field"><label for="lk-phone">เบอร์โทร</label><input id="lk-phone" name="phone" inputmode="tel" required></div><button class="btn pri block" type="submit">ค้นหา</button><div class="hint">ระบบทดลองยังไม่ส่งรหัส OTP</div></form>';
    else h += '<form class="box form" data-form="linkConfirm"><div class="alert ok">พบร้านของคุณ</div><div class="row"><span>ชื่อร้าน</span><span>' + esc(f.name) + '</span></div><div class="row"><span>เลขสมาชิก</span><span class="mono">' + esc(f.sno) + '</span></div>' +
      '<label class="chk"><input type="checkbox" name="consent" required><span>ยินยอมตามนโยบายข้อมูลส่วนบุคคล (ข้อความจริงรอ Legal/DPO)</span></label><button class="btn pri block" type="submit">ยืนยันว่าเป็นร้านของฉัน</button></form>';
    render(h + '</div>');
  }

  /* ---------- แคตตาล็อก ---------- */
  function stepper(kind, id, q) { return '<div class="step"><button data-a="qty" data-k="' + kind + '" data-p="' + esc(id) + '" data-d="-1" aria-label="ลด">−</button><span>' + q + '</span><button data-a="qty" data-k="' + kind + '" data-p="' + esc(id) + '" data-d="1" aria-label="เพิ่ม">+</button></div>'; }
  function tierText(p) { return p.tiers.map(function (t) { return t.min + '+ <b>' + baht(t.price) + '</b>'; }).join(' · '); }
  function pageCatalog() {
    var m = S.me.member, c = S.cart, f = S.params.cat || 'all';
    var cats = catList();
    var h = top('สั่งของ', '', true) + '<div class="wrap">';
    h += '<div class="chips">' + [['all', 'ทั้งหมด'], ['set', 'เซ็ตคุ้ม']].concat(cats.map(function (k) { return [k, catLabel(k)]; }))
      .map(function (x) { return '<button class="chip' + (f === x[0] ? ' on' : '') + '" data-a="cat" data-p="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
    if (m.couponLeft > 0 && m.couponExpires >= S.cat.today) h += '<div class="alert ok">คูปองลูกค้าใหม่ ' + S.cat.cfg.COUPON_PCT + '% ใช้กับสินค้าป้าย ร่วมโปร และเซ็ตคุ้ม เหลือ ' + m.couponLeft + ' บิล</div>';
    if (f === 'all' || f === 'set') {
      var bs = S.cat.bundles.filter(function (b) { return b.active; }).sort(function (a, b) { return (b.for === m.type) - (a.for === m.type); });
      if (bs.length) {
        h += '<div class="box"><h3>เซ็ตคุ้ม <span class="badge">ร่วมโปร</span></h3>' + bs.map(function (b) {
          var normal = 0, names = [];
          b.items.forEach(function (it) { var p = prod(it[0]); if (p) { normal += unitPrice(p, it[1]) * it[1]; names.push(p.name.replace(/\s*\(ตัวอย่าง\)/, '') + ' ×' + it[1]); } });
          return '<div class="bundle"><div><div class="nm">' + esc(b.name) + (b.for !== m.type ? ' <span class="badge b">' + (b.for === 'FS' ? 'ร้านอาหาร' : 'บ้าน') + '</span>' : '') + '</div><div class="it">' + esc(names.join(' · ')) + '</div><div><b>' + baht(b.price) + '</b> ' +
            (normal > b.price ? '<s>' + baht(normal) + '</s> ประหยัด ' + baht(normal - b.price) : '') + '</div></div><div>' + stepper('b', b.id, c.bundles[b.id] || 0) + '</div></div>';
        }).join('') + '<div class="hint" style="margin-top:6px">ราคาเซ็ตตายตัว ไม่คิดราคาขั้นบันไดซ้อน</div></div>';
      }
    }
    var pom = S.cat.products.filter(function (p) { return p.pom; })[0];
    if (pom && pom.inStock && (f === 'all' || f === pom.cat)) h += '<div class="alert info">สินค้าแห่งเดือน: <b>' + esc(pom.name) + '</b> ' + baht(pom.tiers[0].price) + '</div>';
    (f === 'all' ? cats : f === 'set' ? [] : [f]).forEach(function (cat) {
      var ps = S.cat.products.filter(function (p) { return p.cat === cat; });
      if (!ps.length) return;
      h += '<div class="box"><h3>' + esc(catLabel(cat)) + '</h3>' + ps.map(function (p) {
        var q = c.lines[p.sku] || 0, nt = null;
        p.tiers.forEach(function (t) { if (!nt && t.min > q) nt = t; });
        var near = q > 0 && nt && nt.min - q <= 2;
        return '<div class="prod' + (p.inStock ? '' : ' oos') + '"><div><div class="nm">' + esc(p.name) + (p.promo ? '<span class="badge">ร่วมโปร</span>' : '') + (p.inStock ? '' : '<span class="badge r">หมดวันนี้</span>') +
          '</div><div class="tiers">ต่อ' + esc(p.unit) + ': ' + tierText(p) + '</div></div><div>' + (p.inStock ? stepper('p', p.sku, q) : '') + '</div>' +
          (near ? '<div class="nudge"><span>เพิ่มอีก ' + (nt.min - q) + ' ' + esc(p.unit) + ' ได้ราคา ' + baht(nt.price) + '</span><button data-a="toTier" data-p="' + esc(p.sku) + '" data-q="' + nt.min + '">เพิ่มเลย</button></div>' : '') + '</div>';
      }).join('') + '</div>';
    });
    var k = calcNow();
    h += '<div class="hint" style="text-align:center">ราคาจริงตามบิลหลังชั่ง</div></div>';
    h += '<div class="foot"><div class="sum"><b class="num">' + baht(k.subtotal) + '</b><small>' + k.count + ' รายการ · ~' + k.kg + ' กก.</small></div><button class="btn pri" data-a="go" data-p="cart"' + (k.count ? '' : ' disabled') + '>ดูตะกร้า</button></div>';
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
    var k = calcNow();
    var h = top('ตะกร้า', '', true) + '<div class="wrap">';
    if (!k.count) { render(h + '<div class="empty">ตะกร้าว่าง</div><button class="btn pri block" data-a="go" data-p="catalog">เลือกสินค้า</button></div>'); return; }
    if (k.errors.length) h += '<div class="alert bad">' + esc(k.errors.join(' · ')) + '</div>';
    h += '<div class="box">' + k.bundles.map(function (l) { return '<div class="row"><span>' + esc(l.name) + ' ×' + l.qty + ' <span class="badge">เซ็ต</span></span><span class="num">' + baht(l.total) + '</span></div>'; }).join('') +
      k.lines.map(function (l) { return '<div class="row"><span>' + esc(l.name) + ' ×' + l.qty + ' @' + fmt(l.price) + (l.promo ? ' <span class="badge">ร่วมโปร</span>' : '') + '</span><span class="num">' + baht(l.total) + '</span></div>'; }).join('') +
      '<div class="row tot"><span>รวม</span><span class="num">' + baht(k.subtotal) + '</span></div>' +
      (k.coupon ? '<div class="row disc"><span>คูปองลูกค้าใหม่ ' + cfg.COUPON_PCT + '%</span><span class="num">−' + baht(k.coupon) + '</span></div>' : '') +
      (k.coinUse ? '<div class="row disc"><span>ใช้ Coin ' + fmt(k.coinUse) + '</span><span class="num">−' + baht(k.coinUse * cfg.COIN_VALUE) + '</span></div>' : '') +
      (k.coupon || k.coinUse ? '<div class="row tot"><span>ยอดประมาณ</span><span class="num">' + baht(k.net) + '</span></div>' : '') +
      (k.couponWhy ? '<div class="hint">' + esc(k.couponWhy) + '</div>' : '') + '<div class="hint">ราคาจริงตามบิลหลังชั่ง · ~' + k.kg + ' กก.</div></div>';
    h += '<div class="box"><h3>แก้จำนวน</h3>' + k.bundles.map(function (l) { return '<div class="row"><span>' + esc(l.name) + '</span>' + stepper('b', l.id, l.qty) + '</div>'; }).join('') +
      k.lines.map(function (l) { return '<div class="row"><span>' + esc(l.name) + '</span>' + stepper('p', l.sku, l.qty) + '</div>'; }).join('') + '</div>';
    if (k.coinBal > 0) h += '<label class="box chk"><input type="checkbox" data-chg="useCoin"' + (c.useCoin ? ' checked' : '') + '><span>ใช้ Coin (มี ' + fmt(k.coinBal) + ' · ใช้ได้สูงสุด ' + cfg.COIN_MAX_PCT + '% ของบิล = ' + fmt(k.coinMax) + ')</span></label>';
    if (m.sourceKind === 'sign') {
      var r = S.ui.round;
      h += '<div class="box"><h3>รับของ</h3><label class="chk"><input type="radio" name="mode" value="pickup" data-chg="mode"' + (c.mode === 'pickup' ? ' checked' : '') + '><span>รับที่จุดรับ รอบ ' + esc(cfg.CONDO_TIME) + ' (ไม่มีขั้นต่ำต่อคน)</span></label>' +
        '<label class="chk"><input type="radio" name="mode" value="deliver" data-chg="mode"' + (c.mode !== 'pickup' ? ' checked' : '') + '><span>ส่งถึงห้อง (ขั้นต่ำ ' + baht(cfg.MIN_ORDER) + ')</span></label>';
      if (c.mode === 'pickup' && r) { var after = r.total + k.subtotal; h += '<div class="alert ' + (after >= r.min ? 'ok' : 'warn') + '" style="margin-top:6px">ยอดรวมจุดรับวันนี้ ' + baht(after) + ' / ' + baht(r.min) + (after >= r.min ? ' · รอบออกแน่นอน' : ' · ขาดอีก ' + baht(r.min - after) + ' ถ้าไม่ครบ เลื่อนเป็นรอบพรุ่งนี้') + ' · ของรอที่จุดรับได้ ' + r.hold + ' นาที</div>'; }
      h += '</div>';
    } else {
      h += '<div class="box field"><label for="slot">ต้องได้ของ</label><select id="slot" data-chg="slot">' + slots.map(function (s) { return '<option' + (c.slot === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></div>';
    }
    if (k.belowMin) {
      var sug = S.cat.products.filter(function (p) { return p.promo && p.inStock; }).slice(0, 3);
      h += '<div class="alert warn">ยอด ' + baht(k.subtotal) + ' ยังไม่ถึงขั้นต่ำส่งฟรี ' + baht(k.min) + ' สั่งได้ แต่จะส่งรวมรอบถัดไปที่ผ่านโซนของคุณ<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">' +
        sug.map(function (p) { return '<button class="btn sm" data-a="qty" data-k="p" data-p="' + esc(p.sku) + '" data-d="1">+ ' + esc(p.name.replace(/\s*\(ตัวอย่าง\)/, '')) + '</button>'; }).join('') + '</div></div>';
    } else if (k.mode !== 'pickup' && k.min < cfg.MIN_ORDER) h += '<div class="alert ok">สิทธิ์ลูกค้าใหม่ในโซนส่งประจำ: ขั้นต่ำส่งฟรีเหลือ ' + baht(k.min) + '</div>';
    h += '</div><div class="foot"><div class="sum"><b class="num">' + baht(k.net) + '</b><small>ยอดประมาณ' + (k.belowMin ? ' · ส่งรวมรอบถัดไป' : '') + '</small></div><button class="btn pri" data-a="submitOrder"' + (k.errors.length ? ' disabled' : '') + '>ส่งออเดอร์</button></div>';
    render(h);
    if (m.sourceKind === 'sign' && !S.ui.roundLoaded) { S.ui.roundLoaded = true; api('roundInfo').then(function (r) { S.ui.round = r.round; if (S.page === 'cart') pageCart(); }).catch(function () { }); }
  }
  function doReorder() {
    var lb = S.me.lastBasket;
    if (!lb) { toast('ยังไม่มีออเดอร์ก่อนหน้า'); S.page = 'catalog'; return pageCatalog(); }
    S.cart.lines = {}; S.cart.bundles = {};
    Object.keys(lb.lines).forEach(function (sku) { var p = prod(sku); if (p && p.inStock) S.cart.lines[sku] = lb.lines[sku]; });
    Object.keys(lb.bundles).forEach(function (id) { if (S.cat.bundles.some(function (b) { return b.id === id && b.active; })) S.cart.bundles[id] = lb.bundles[id]; });
    saveCart(); toast('ใส่ตะกร้าเหมือนครั้งก่อนแล้ว แก้จำนวนได้');
    S.page = 'cart'; pageCart();
  }
  function pageDone() {
    var id = S.params.id;
    render(top('ส่งออเดอร์แล้ว', '', false) + '<div class="wrap"><div class="box" style="text-align:center"><div class="big">ส่งแล้ว</div><div>ออเดอร์ <b class="mono">' + esc(id) + '</b></div><div class="hint">ร้านจะตรวจรายการ แล้วส่งบิลยอดจริงหลังชั่งเข้าแชต LINE OA</div></div>' +
      '<button class="btn pri block" data-a="closeApp">กลับไปที่แชต</button><button class="btn block" data-a="go" data-p="bills">ดูบิลของฉัน</button></div>');
  }

  /* ---------- บิล ---------- */
  function statusPill(s) { return s === 'new' ? '<span class="pill new">รอร้านตรวจ</span>' : s === 'approved' ? '<span class="pill appr">กำลังจัดของ</span>' : s === 'billed' ? '<span class="pill bill">รอจ่าย</span>' : s === 'paid' ? '<span class="pill paid">จ่ายแล้ว</span>' : '<span class="pill red">ยกเลิก</span>'; }
  function pageBills() {
    render(top('บิลของฉัน', '', true) + '<div class="wrap"><div class="empty">กำลังโหลด...</div></div>');
    api('myOrders').then(function (r) {
      if (S.page !== 'bills') return;
      var h = top('บิลของฉัน', '', true) + '<div class="wrap">' + (r.orders.length ? r.orders.map(function (o) {
        return '<div class="box" style="display:flex;justify-content:space-between;gap:8px;align-items:center"><div><b class="mono">' + esc(o.id) + '</b> ' + statusPill(o.status) + '<div class="hint">' + esc(o.created) + ' · ' + esc(o.src) + (o.txn ? ' · ' + esc(o.txn) : '') + '</div></div>' +
          '<div style="text-align:right"><b class="num">' + baht(o.actual || o.est) + '</b>' + (o.status === 'billed' ? '<div><button class="btn sm pri" data-a="go" data-p="bill" data-id="' + esc(o.id) + '">จ่าย</button></div>' : '') + '</div></div>';
      }).join('') : '<div class="empty">ยังไม่มีออเดอร์</div>') + '</div>';
      render(h);
    }).catch(fail);
  }
  function pageBill() {
    render(top('บิล', '', true) + '<div class="wrap"><div class="empty">กำลังโหลด...</div></div>');
    api('order', { id: S.params.id }).then(function (r) {
      if (S.page !== 'bill') return;
      var o = r.order;
      var h = top('บิล ' + o.id, '', true) + '<div class="wrap"><div class="box">' + o.bundles.map(function (l) { return '<div class="row"><span>' + esc(l.name) + ' ×' + l.qty + '</span><span>' + baht(l.price * l.qty) + '</span></div>'; }).join('') +
        o.items.map(function (l) { return '<div class="row"><span>' + esc(l.name) + ' ×' + l.qty + ' @' + fmt(l.price) + '</span><span>' + baht(l.price * l.qty) + '</span></div>'; }).join('') +
        (o.coupon ? '<div class="row disc"><span>คูปอง</span><span>−' + baht(o.coupon) + '</span></div>' : '') + (o.coinUse ? '<div class="row disc"><span>Coin ' + fmt(o.coinUse) + '</span><span>−' + baht(o.coinUse * S.cat.cfg.COIN_VALUE) + '</span></div>' : '') +
        '<div class="row"><span>ยอดประมาณ</span><span>' + baht(o.est) + '</span></div>' + (o.txn ? '<div class="row"><span>Transaction No.</span><span class="mono">' + esc(o.txn) + '</span></div><div class="row tot"><span>ยอดตามบิล (หลังชั่ง)</span><span>' + baht(o.actual) + '</span></div>' : '') + '</div>';
      if (o.status === 'new' || o.status === 'approved') h += '<div class="alert info">ร้านยังไม่เปิดบิล ยอดจริงจะส่งเข้าแชตหลังชั่งของ</div>';
      if (o.status === 'paid') h += '<div class="alert ok">ชำระแล้ว ' + esc(o.paidAt) + ' ขอบคุณค่ะ</div>';
      if (o.status === 'billed') {
        if (o.promptpay) h += '<div class="box qr"><div class="code">' + qrSvg(o.promptpay.payload) + '</div><b>PromptPay · ' + baht(o.actual) + '</b>' + (o.promptpay.demo ? '<div class="alert warn">QR ตัวอย่าง สแกนจ่ายไม่ได้ (ยังไม่ได้ตั้ง PROMPTPAY_ID)</div>' : '<div class="hint">QR ใส่ยอดไว้แล้ว</div>') + '</div>';
        if (o.slip !== null) h += '<div class="alert info">แจ้งโอนแล้ว ' + baht(o.slip) + ' · รอร้านยืนยัน</div>';
        else h += '<form class="box form" data-form="notifyPaid" data-id="' + esc(o.id) + '"><h3>แจ้งว่าโอนแล้ว</h3><div class="field"><label for="pd-amt">ยอดที่โอน (บาท)</label><input id="pd-amt" name="amount" inputmode="decimal" value="' + o.actual + '"></div><button class="btn pri block" type="submit">แจ้งโอนแล้ว</button><div class="hint">ระบบทดลองยังไม่ตรวจสลิปอัตโนมัติ ร้านยืนยันเอง</div></form>';
      }
      render(h + '</div>');
    }).catch(fail);
  }

  /* ---------- ชวนเพื่อน / Coin ---------- */
  function pageInvite() {
    render(top('ชวนเพื่อน', '', true) + '<div class="wrap"><div class="empty">กำลังโหลด...</div></div>');
    api('invite').then(function (r) {
      if (S.page !== 'invite') return;
      var cfg = S.cat.cfg;
      var h = top('ชวนเพื่อน', '', true) + '<div class="wrap">';
      if (!r.eligible) { render(h + '<div class="alert info">ตอนนี้สิทธิ์ชวนเพื่อนเปิดเฉพาะลูกค้ากลุ่มนำร่องที่ร้านเชิญ</div></div>'); return; }
      var full = r.monthCount >= r.limit;
      h += '<div class="box qr">' + (full ? '<div class="alert warn">เดือนนี้ชวนครบ ' + r.limit + ' ร้านแล้ว</div>' : (r.link ? '<div class="code">' + qrSvg(r.link) + '</div>' : '<div class="alert warn">ร้านยังไม่ได้ตั้ง LIFF_ID</div>')) +
        '<b>QR ชวนเพื่อนของคุณ</b>' + (r.link ? '<div class="copy"><input readonly value="' + esc(r.link) + '" aria-label="ลิงก์ชวน"><button class="btn sm" data-a="copy" data-t="' + esc(r.link) + '">คัดลอก</button></div>' : '') +
        (r.link && canShare() ? '<button class="btn sm pri" data-a="share" data-t="' + esc(r.link) + '">ส่งให้เพื่อนใน LINE</button>' : '') + '</div>';
      h += '<div class="box"><h3>กติกา</h3><div class="row"><span>เพื่อนได้</span><span style="text-align:right">ลด ' + cfg.COUPON_PCT + '% สินค้าร่วมโปร/เซ็ต · ' + cfg.COUPON_BILLS + ' บิลแรกใน ' + cfg.COUPON_DAYS + ' วัน · สูงสุด ' + baht(cfg.COUPON_CAP) + '/บิล</span></div>' +
        '<div class="row"><span>คุณได้</span><span style="text-align:right">' + cfg.COIN_PCT + '% ของยอดบิลเพื่อนเป็น Coin นาน ' + cfg.COIN_MONTHS + ' เดือน · สูงสุด ' + fmt(cfg.COIN_CAP) + ' Coin/เดือน</span></div>' +
        '<div class="hint">นับเฉพาะร้านที่ไม่เคยซื้อมาก่อน และต้องลงทะเบียนผ่าน QR นี้ก่อนบิลแรก</div></div>';
      h += '<div class="kv"><div><small>Coin ใช้ได้</small><b>' + fmt(r.bal) + '</b></div><div><small>รออนุมัติ</small><b>' + fmt(r.pending) + '</b></div><div><small>ชวนเดือนนี้</small><b>' + r.monthCount + '/' + r.limit + '</b></div></div>';
      h += '<div class="box"><h3>เพื่อนที่ชวน</h3>' + (r.refs.length ? r.refs.map(function (x) { return '<div class="row"><span>' + esc(x.name) + '</span><span>' + (x.approved ? '<span class="pill paid">สมาชิกแล้ว</span>' : x.flagged ? '<span class="pill red">ร้านกำลังตรวจ</span>' : '<span class="pill new">รอร้านตรวจ</span>') + '</span></div>'; }).join('') : '<div class="hint">ยังไม่มี</div>') + '</div>';
      render(h + '</div>');
    }).catch(fail);
  }
  function canShare() { try { return liff.isApiAvailable('shareTargetPicker'); } catch (e) { return false; } }
  function pageWallet() {
    render(top('Coin & คูปอง', '', true) + '<div class="wrap"><div class="empty">กำลังโหลด...</div></div>');
    api('wallet').then(function (r) {
      if (S.page !== 'wallet') return;
      var m = r.member || S.me.member, cfg = S.cat.cfg;
      var h = top('Coin & คูปอง', '', true) + '<div class="wrap"><div class="kv"><div><small>Coin ใช้ได้</small><b>' + fmt(r.bal) + '</b></div><div><small>รออนุมัติ</small><b>' + fmt(r.pending) + '</b></div><div><small>มูลค่า</small><b>' + baht(r.bal * cfg.COIN_VALUE) + '</b></div></div>';
      if (m && m.couponLeft > 0) h += '<div class="box"><h3>คูปองลูกค้าใหม่</h3><div class="row"><span>ส่วนลด</span><span>' + cfg.COUPON_PCT + '% สินค้าร่วมโปร/เซ็ต</span></div><div class="row"><span>เหลือ</span><span>' + m.couponLeft + ' บิล</span></div><div class="row"><span>หมดอายุ</span><span>' + esc(m.couponExpires) + '</span></div></div>';
      h += '<div class="box"><h3>ประวัติ Coin</h3>' + (r.coins.length ? r.coins.map(function (c) {
        var label = c.status === 'used' ? 'ใช้กับ ' + c.order : c.status === 'cancelled' ? 'ยกเลิก (' + c.order + ')' : 'จากบิล ' + c.order + (c.from ? ' ของ ' + c.from : '');
        var sub = c.status === 'pending' ? 'รอ ผจก. อนุมัติ' : c.status === 'available' ? 'หมดอายุ ' + c.expires : c.earned;
        return '<div class="row"><span>' + esc(label) + '<br><small class="hint">' + esc(sub) + '</small></span><span class="num">' + (c.status === 'used' ? '−' : '+') + fmt(c.amount) + '</span></div>';
      }).join('') : '<div class="hint">ยังไม่มี</div>') + '</div>';
      render(h + '</div>');
    }).catch(fail);
  }

  /* ---------- สั่งประจำ ---------- */
  function pageStanding() {
    render(top('สั่งประจำ', '', true) + '<div class="wrap"><div class="empty">กำลังโหลด...</div></div>');
    api('standing').then(function (r) {
      if (S.page !== 'standing') return;
      var st = r.standing, cfg = S.cat.cfg, slots = String(cfg.SLOTS).split('|');
      var h = top('สั่งประจำ', '', true) + '<div class="wrap">';
      if (S.params.confirm && st && !st.paused) {
        h += '<div class="box"><h3>ยืนยันรับพรุ่งนี้ (' + esc(S.params.confirm) + ')</h3>' + itemsHtml(st.items) + '<button class="btn pri block" data-a="standingConfirm" style="margin-top:8px">ยืนยัน ส่งพรุ่งนี้</button></div>';
      }
      if (st) {
        h += '<div class="box"><h3>ตะกร้าประจำ</h3>' + itemsHtml(st.items) + '<div class="row"><span>วัน</span><span>' + esc(st.days) + '</span></div><div class="row"><span>รอบ</span><span>' + esc(st.slot) + '</span></div>' + (st.lastConfirmed ? '<div class="hint">ยืนยันล่าสุดสำหรับวันที่ ' + esc(st.lastConfirmed) + '</div>' : '') + '</div>' +
          '<div class="alert info">ทุกเย็นช่วง 18:00–19:00 ร้านจะส่งข้อความถามว่ารับพรุ่งนี้ไหม กดปุ่มในข้อความเพื่อยืนยัน</div>' +
          '<button class="btn block" data-a="standingPause">' + (st.paused ? 'เปิดสั่งประจำอีกครั้ง' : 'หยุดชั่วคราว (ร้านปิด / วันหยุด)') + '</button>' + (st.paused ? '<div class="alert warn">หยุดอยู่ ระบบจะไม่ถาม</div>' : '');
      }
      var lb = S.me.lastBasket;
      h += '<form class="box form" data-form="standingSave"><h3>' + (st ? 'เปลี่ยนตะกร้าประจำ' : 'ตั้งสั่งประจำ') + '</h3>' + (lb && Object.keys(lb.lines).length ? '<div class="hint">ใช้รายการจากออเดอร์ล่าสุด (ไม่รวมเซ็ต)</div>' + itemsHtml(lb.lines) +
        '<div class="field"><label for="st-days">วัน</label><input id="st-days" name="days" value="' + esc(st ? st.days : 'จ.–ส.') + '"></div><div class="field"><label for="st-slot">รอบ</label><select id="st-slot" name="slot">' + slots.map(function (s) { return '<option' + (st && st.slot === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></div>' +
        '<button class="btn pri block" type="submit">บันทึกเป็นสั่งประจำ</button>' : '<div class="hint">สั่งของผ่าน MINI App อย่างน้อย 1 ครั้งก่อน แล้วกลับมาตั้งจากออเดอร์ล่าสุด</div>') + '</form>';
      render(h + '</div>');
    }).catch(fail);
  }
  function itemsHtml(items) { return Object.keys(items || {}).map(function (sku) { var p = prod(sku); return '<div class="row"><span>' + esc(p ? p.name : sku) + '</span><span>×' + items[sku] + '</span></div>'; }).join(''); }

  /* ---------- บัตรสมาชิก ---------- */
  function pageCard() {
    var m = S.me.member, cfg = S.cat.cfg;
    var h = top('บัตรสมาชิก', '', true) + '<div class="wrap"><div class="box qr"><div class="code">' + qrSvg(m.sno || m.id) + '</div><b>' + esc(m.name) + '</b><span class="mono">' + esc(m.sno || 'รอเลขสมาชิก') + '</span></div>' +
      '<div class="alert ' + (cfg.COUNT_COUNTER ? 'ok' : 'info') + '">' + (cfg.COUNT_COUNTER ? 'แสดงบัตรนี้ที่แคชเชียร์ทุกครั้งที่ซื้อหน้าร้าน' : 'ตอนนี้นับ Coin และส่วนแบ่งเฉพาะออเดอร์ที่สั่งผ่าน LINE') + '</div>';
    if (cfg.TEST_MODE) h += '<div class="box"><h3>โหมดทดสอบ</h3><div class="hint">ลบข้อมูลสมาชิกของบัญชี LINE นี้ เพื่อลองลงทะเบียนใหม่ (เช่น ลองเป็นลูกค้าที่ถูกชวน)</div><button class="btn bad block" data-a="resetMe" style="margin-top:8px">ลบข้อมูลสมาชิกของฉัน</button></div>';
    render(h + '</div>');
  }

  /* ---------- พาร์ทเนอร์ ---------- */
  function pagePartnerJoin() {
    render(top('ผูกบัญชีพาร์ทเนอร์', '', false) + '<div class="wrap"><div class="box">ผูกบัญชี LINE นี้กับป้าย <b>' + esc(S.params.pid || '') + '</b> เพื่อดูยอดและส่วนแบ่ง</div><button class="btn pri block" data-a="partnerJoin">ผูกบัญชี</button></div>');
  }
  function pagePartner() {
    render(top('ยอดป้ายของฉัน', '', true) + '<div class="wrap"><div class="empty">กำลังโหลด...</div></div>');
    api('partnerDash').then(function (r) {
      if (S.page !== 'partner') return;
      var d = r.dash;
      var h = top(d.name, 'พาร์ทเนอร์ ' + d.id, true) + '<div class="wrap"><div class="kv"><div><small>สแกน</small><b>' + fmt(d.scans) + '</b></div><div><small>ลูกค้าจากป้าย</small><b>' + fmt(d.members) + '</b></div><div><small>ออเดอร์เดือนนี้</small><b>' + fmt(d.orders) + '</b></div></div>' +
        '<div class="box"><div class="row"><span>ยอดขายจากป้ายเดือนนี้</span><span>' + baht(d.sales) + '</span></div><div class="row tot"><span>ส่วนแบ่ง ' + d.pct + '%</span><span>' + baht(d.share) + '</span></div><div class="hint">' + (d.payout === 'coin' ? 'จ่ายเป็น Coin' : 'โอนเงินรายเดือน ขั้นต่ำ ' + baht(d.minPayout) + ' (ไม่ถึงยกไปเดือนหน้า)') + '</div></div>' +
        '<div class="box"><h3>รอบคอนโดวันนี้ ' + esc(d.round.time) + '</h3><div class="row"><span>ออเดอร์รอรับที่ร้านคุณ</span><span>' + d.round.orders + '</span></div><div class="row"><span>ยอดรวม</span><span>' + baht(d.round.total) + ' / ' + baht(d.round.min) + '</span></div><div class="hint">ลูกค้ามารับภายใน ' + d.round.hold + ' นาที</div></div>' +
        '<div class="box"><h3>ออเดอร์ล่าสุดจากป้าย</h3>' + (d.recent.length ? d.recent.map(function (x) { return '<div class="row"><span>' + esc(x.who) + ' · ' + esc(x.order) + '</span><span>' + baht(x.sales) + ' → ' + baht(x.share) + '</span></div>'; }).join('') : '<div class="hint">ออเดอร์ที่ร้านปิดบิลแล้วจะขึ้นที่นี่</div>') + '</div></div>';
      render(h);
    }).catch(fail);
  }

  /* ---------- พนักงาน ---------- */
  function pageStaffJoin() {
    if (S.me.staff) { S.page = 'admin'; return pageAdmin(); }
    render(top('ตั้งเป็นพนักงาน', '', true) + '<div class="wrap"><form class="box form" data-form="staffJoin"><div>ใส่รหัสจากชีต Config แถว SETUP_CODE</div><div class="field"><label for="sj-code">รหัส</label><input id="sj-code" name="code" inputmode="numeric" required></div><button class="btn pri block" type="submit">ยืนยัน</button><div class="hint">คนแรกที่ใส่รหัสจะเป็น manager (ได้รับสรุปยอด 19:00)</div></form></div>');
  }
  var TABS = [['orders', 'ออเดอร์'], ['pay', 'ชำระเงิน'], ['members', 'สมาชิก'], ['aff', 'ชวนเพื่อน & ป้าย'], ['price', 'ราคา & สต็อก'], ['bc', 'บรอดแคสต์'], ['tools', 'เครื่องมือ']];
  function pageAdmin(force) {
    if (!S.me.staff) { S.page = 'staffjoin'; return pageStaffJoin(); }
    if (!S.admin || force === true) {
      render(top('หน้าหลังร้าน', '', false) + '<div class="wrap wide"><div class="empty">กำลังโหลด...</div></div>');
      return api('adminData').then(function (r) { S.admin = r; if (S.page === 'admin') pageAdmin(); }).catch(fail);
    }
    var d = S.admin, t = S.adminTab;
    var liffWarn = d.cfg.LIFF_ID && d.cfg.LIFF_ID !== CFG.LIFF_ID ? '<div class="alert bad">LIFF_ID ในชีต Config (' + esc(d.cfg.LIFF_ID) + ') ไม่ตรงกับ config.js (' + esc(CFG.LIFF_ID) + ') ปุ่มในการ์ดแชตและลิงก์ชวนจะเปิดไม่ได้ ให้แก้ให้ตรงกัน</div>' : '';
    var cnt = { orders: d.orders.filter(function (o) { return o.status === 'new'; }).length, pay: d.orders.filter(function (o) { return o.status === 'billed' && o.slip !== null; }).length,
      members: d.pendingMembers.length, aff: d.coinsPending.length };
    var h = top('หน้าหลังร้าน', 'ข้อความส่งหาเดือนนี้ ' + fmt(d.quota.used) + ' / ' + (d.quota.plan ? fmt(d.quota.plan) : 'ไม่จำกัด') + (d.quota.source === 'line' ? '' : ' (ประมาณ)'), false).replace('</div></div>', '</div><button class="ic" data-a="refresh" aria-label="โหลดใหม่">↻</button><button class="ic" data-a="home" aria-label="หน้าแรก">⌂</button></div>');
    h += '<div class="tabs">' + TABS.map(function (x) { return '<button class="tab' + (t === x[0] ? ' on' : '') + '" data-a="tab" data-p="' + x[0] + '">' + x[1] + (cnt[x[0]] ? '<span class="cnt">' + cnt[x[0]] + '</span>' : '') + '</button>'; }).join('') + '</div><div class="wrap wide">';
    h += liffWarn;
    h += ({ orders: adOrders, pay: adPay, members: adMembers, aff: adAff, price: adPrice, bc: adBc, tools: adTools }[t] || adOrders)(d);
    render(h + '</div>');
  }
  function posLines(o) {
    var cfg = S.admin.cfg, out = [];
    if (o.coupon > 0) out.push(cfg.POS_MODE === 'freebie' ? 'ของแถมแทนคูปอง มูลค่า ' + baht(o.coupon) + ' (คีย์ 0 บาท)' : 'ส่วนลดท้ายบิล ' + baht(o.coupon) + ' (คูปองลูกค้าใหม่)');
    if (o.coinUse > 0) out.push(cfg.POS_MODE === 'freebie' ? 'แลก Coin เป็นสินค้ามูลค่า ' + baht(o.coinUse * cfg.COIN_VALUE) : 'ส่วนลด Coin ' + baht(o.coinUse * cfg.COIN_VALUE));
    o.bundles.forEach(function (b) { out.push(b.name + ' ×' + b.qty + ': คีย์รายการตามเซ็ต แล้วลดให้เหลือ ' + baht(b.price * b.qty)); });
    return out.length ? out : ['ไม่มีส่วนลด คีย์ตามรายการ'];
  }
  function adOrders(d) {
    var list = d.orders.filter(function (o) { return o.status !== 'paid' && o.status !== 'cancelled'; });
    var done = d.orders.filter(function (o) { return o.status === 'paid' || o.status === 'cancelled'; });
    var h = '';
    if (d.cfg.COUNT_COUNTER) h += '<form class="box acts" data-form="counterBill"><div class="field"><label for="cb-m">บิลหน้าร้านของสมาชิก</label><select id="cb-m" name="memberId">' + d.members.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.name) + ' · ' + esc(m.sno) + '</option>'; }).join('') + '</select></div><div class="field"><label for="cb-t">Transaction No.</label><input id="cb-t" name="txn" required></div><div class="field"><label for="cb-a">ยอด</label><input id="cb-a" name="amount" inputmode="decimal" required></div><button class="btn blue" type="submit">บันทึก</button></form>';
    if (!list.length) h += '<div class="empty">ไม่มีออเดอร์ที่ต้องทำ</div>';
    list.forEach(function (o) {
      var other = list.filter(function (x) { return x !== o && x.memberId === o.memberId && (x.status === 'new' || x.status === 'approved'); })[0];
      h += '<div class="ord"><div class="ord-h"><b class="mono">' + esc(o.id) + '</b><span class="hint">' + esc(o.created) + '</span><span class="pill">' + esc(o.src) + '</span>' + (o.attName ? '<span class="pill appr">' + esc((o.attKind === 'ref' ? 'ผู้ชวน: ' : '') + o.attName) + '</span>' : '') + '<span style="flex:1"></span>' + statusPill(o.status) + '</div>' +
        '<div><b>' + esc(o.memberName) + '</b> <span class="mono hint">' + esc(o.sno || 'ยังไม่มีเลข S') + '</span>' + (o.memberApproved ? '' : ' <span class="pill red">สมาชิกรออนุมัติ</span>') + '</div>' +
        '<div class="hint">' + (o.mode === 'pickup' ? 'รับที่จุด ' + esc(o.pickup) : 'ต้องได้ของ: ' + esc(o.slot)) + ' · ~' + o.kg + ' กก.</div>' +
        o.bundles.map(function (l) { return '<div class="row"><span>' + esc(l.name) + ' ×' + l.qty + ' (เซ็ต)</span><span>' + baht(l.price * l.qty) + '</span></div>'; }).join('') +
        o.items.map(function (l) { return '<div class="row"><span>' + esc(l.name) + ' ×' + l.qty + ' @' + fmt(l.price) + '</span><span>' + baht(l.price * l.qty) + '</span></div>'; }).join('') +
        '<div class="row tot"><span>ยอดประมาณ</span><span>' + baht(o.est) + '</span></div>' +
        (o.belowMin ? '<div class="alert warn">ต่ำกว่าขั้นต่ำ → ส่งรวมรอบถัดไป</div>' : '') + (other ? '<div class="alert info">ลูกค้ารายนี้มีออเดอร์ค้างส่ง ' + esc(other.id) + ' รวมรอบเดียวกันได้</div>' : '') +
        '<div class="pos"><b>ทำใน POS</b>' + posLines(o).map(function (x) { return '<div>• ' + esc(x) + '</div>'; }).join('') + (o.txn ? '<div>บิล ' + esc(o.txn) + ' · ยอดจริง ' + baht(o.actual) + '</div>' : '') + '</div>';
      if (o.status === 'new') h += '<div class="acts"><button class="btn blue" data-a="adm" data-op="approveOrder" data-id="' + esc(o.id) + '">อนุมัติ ส่งไปจัดของ</button><button class="btn bad sm" data-a="adm" data-op="cancelOrder" data-id="' + esc(o.id) + '" data-confirm="ยกเลิกออเดอร์นี้?">ยกเลิก</button></div>';
      if (o.status === 'approved') h += '<form class="acts" data-form="billOrder" data-id="' + esc(o.id) + '"><div class="field"><label>Transaction No. จากสลิป POS</label><input name="txn" class="mono" required placeholder="S212 101 0316349"></div><div class="field"><label>ยอด Net-Total จริง</label><input name="actual" inputmode="decimal" required value="' + o.est + '"></div><button class="btn blue" type="submit">ส่งบิลให้ลูกค้า</button></form>';
      if (o.status === 'billed') h += '<div class="hint">ส่งบิลแล้ว รอลูกค้าจ่าย (ดูแท็บ ชำระเงิน)</div>';
      h += '</div>';
    });
    if (done.length) h += '<details class="box"><summary>จ่ายแล้ว / ยกเลิก วันนี้ (' + done.length + ')</summary>' + done.map(function (o) { return '<div class="row"><span>' + esc(o.id) + ' · ' + esc(o.memberName) + '</span><span>' + statusPill(o.status) + ' ' + baht(o.actual || o.est) + '</span></div>'; }).join('') + '</details>';
    return h;
  }
  function adPay(d) {
    var list = d.orders.filter(function (o) { return o.status === 'billed' || (o.status === 'paid' && o.date === d.today); });
    var paid = 0, due = 0;
    list.forEach(function (o) { if (o.status === 'paid') paid += o.actual; else due += o.actual; });
    var h = '<div class="kv"><div><small>บิล</small><b>' + list.length + '</b></div><div><small>รับแล้ว</small><b>' + baht(paid) + '</b></div><div><small>ค้าง</small><b>' + baht(due) + '</b></div></div>';
    if (!list.length) return h + '<div class="empty">ยังไม่มีบิล</div>';
    h += '<div class="tblw"><table><thead><tr><th>Transaction No.</th><th>ลูกค้า</th><th class="r">ยอดบิล</th><th class="r">แจ้งโอน</th><th>สถานะ</th><th></th></tr></thead><tbody>' + list.map(function (o) {
      var diff = o.slip === null ? 0 : o.slip - o.actual;
      return '<tr class="' + (o.slip !== null && diff !== 0 && o.status === 'billed' ? 'warn' : '') + '"><td class="mono">' + esc(o.txn) + '</td><td>' + esc(o.memberName) + '</td><td class="r">' + baht(o.actual) + '</td><td class="r">' + (o.slip === null ? '–' : baht(o.slip) + (diff ? '<br><small>' + (diff < 0 ? 'ขาด ' : 'เกิน ') + baht(Math.abs(diff)) + '</small>' : '')) + '</td><td>' + statusPill(o.status) + '</td><td>' +
        (o.status === 'billed' ? (o.slip !== null ? '<button class="btn sm blue" data-a="adm" data-op="confirmPay" data-id="' + esc(o.id) + '">ยืนยันรับเงิน</button>' + (diff < 0 ? ' <button class="btn sm" data-a="adm" data-op="askShort" data-id="' + esc(o.id) + '">ขอยอดที่ขาด</button>' : '') : '<button class="btn sm" data-a="adm" data-op="remindOne" data-id="' + esc(o.id) + '">เตือนจ่าย</button> <button class="btn sm" data-a="adm" data-op="confirmPay" data-id="' + esc(o.id) + '" data-confirm="ยืนยันว่ารับเงินแล้ว (ลูกค้ายังไม่แจ้งโอน)?">รับเงินแล้ว</button>') : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>';
    return h;
  }
  function adMembers(d) {
    var mg = d.migration, pct = mg.total ? mg.moved / mg.total * 100 : 0;
    var h = '<div class="box"><h3>ลูกค้าเดิมที่ย้ายเข้า OA แล้ว ' + mg.moved + ' / ' + mg.total + ' (' + pct.toFixed(1) + '%)</h3><div class="hint">เป้า 90% · OA ส่งหาคนที่ยังไม่เพิ่มเพื่อนไม่ได้ ต้องส่งลิงก์จากแชตเดิมหรือโทร</div></div>';
    h += '<h3 style="margin:6px 0 0">สมาชิกใหม่รอตรวจ</h3>';
    if (!d.pendingMembers.length) h += '<div class="empty">ไม่มีรายการรอตรวจ</div>';
    d.pendingMembers.forEach(function (m) {
      h += '<form class="ord" data-form="approveMember" data-id="' + esc(m.id) + '"><div class="ord-h"><b>' + esc(m.name) + '</b><span class="pill appr">' + esc(m.sourceKind === 'ref' ? 'ผู้ชวน: ' + m.sourceName : m.sourceKind === 'sign' ? m.sourceName : 'สมัครเอง') + '</span>' + (m.flags ? '<span class="pill red">ธงแดง</span>' : '') + '</div>' +
        '<div class="hint">เบอร์ ' + esc(m.phone) + ' · ' + esc(m.type) + ' · ลงทะเบียน ' + esc(m.regDate) + (m.address ? ' · ' + esc(m.address) : '') + '</div>' + (m.flags ? '<div class="alert bad">' + esc(m.flags) + '</div>' : '') +
        '<div class="hint">ตรวจใน POS ว่าเบอร์/ชื่อนี้ไม่เคยซื้อใน 6 เดือน แล้วเปิดเลขสมาชิกใหม่</div><div class="acts"><div class="field"><label>เลขสมาชิก S (จาก POS)</label><input name="sno" class="mono" required></div>' +
        (m.flags ? '<label class="chk"><input type="checkbox" name="clearFlags"><span>ตรวจแล้ว ล้างธงแดง (ให้สิทธิ์ลูกค้าใหม่)</span></label>' : '') + '<button class="btn blue" type="submit">อนุมัติ</button><button class="btn bad sm" type="button" data-a="adm" data-op="rejectMember" data-id="' + esc(m.id) + '" data-confirm="ปิดบัญชีนี้?">ปิดบัญชี</button></div></form>';
    });
    h += '<h3 style="margin:6px 0 0">ลูกค้าเดิมที่ยังไม่ย้าย (เรียงตามยอด)</h3>';
    var link = S.cat.cfg.LIFF_ID ? appLink('link', {}) : '';
    h += mg.list.length ? '<div class="tblw"><table><thead><tr><th>ร้าน</th><th>เบอร์</th><th class="r">เฉลี่ย/เดือน</th><th>สถานะ</th><th></th></tr></thead><tbody>' + mg.list.map(function (x) {
      return '<tr><td>' + esc(x.name) + '</td><td class="mono">' + esc(x.phone) + '</td><td class="r">' + baht(x.avg) + '</td><td>' + (x.follow === 'call' ? 'โทรแล้ว' : x.follow === 'link' ? 'ส่งลิงก์แล้ว' : 'ยังไม่ติดต่อ') + '</td><td style="white-space:nowrap"><button class="btn sm" data-a="copyMigrate" data-id="' + esc(x.id) + '" data-name="' + esc(x.name) + '" data-link="' + esc(link) + '">คัดลอกข้อความชวน</button> <button class="btn sm" data-a="adm" data-op="markFollow" data-id="' + esc(x.id) + '" data-status="call">โทรแล้ว</button></td></tr>';
    }).join('') + '</tbody></table></div>' : '<div class="empty">ย้ายครบแล้ว</div>';
    return h;
  }
  function adAff(d) {
    var h = '<div class="box"><h3>Coin รออนุมัติ</h3><div class="hint">ปล่อยได้เมื่อบิลของเพื่อนจ่ายแล้ว</div>' + (d.coinsPending.length ? '<button class="btn sm blue" data-a="adm" data-op="approveCoins" style="margin:6px 0">อนุมัติทั้งหมดที่จ่ายแล้ว</button><div class="tblw"><table><thead><tr><th>ผู้ชวน</th><th>จากบิลของ</th><th>บิล</th><th class="r">ยอดบิล</th><th class="r">Coin</th><th></th></tr></thead><tbody>' +
      d.coinsPending.map(function (c) { return '<tr><td>' + esc(c.owner) + '</td><td>' + esc(c.from) + '</td><td class="mono">' + esc(c.order) + '</td><td class="r">' + baht(c.actual) + '</td><td class="r">' + fmt(c.amount) + '</td><td>' + (c.paid ? '<button class="btn sm blue" data-a="adm" data-op="approveCoin" data-id="' + esc(c.id) + '">อนุมัติ</button>' : '<span class="pill new">บิลยังไม่จ่าย</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty">ไม่มี</div>') + '</div>';
    h += '<div class="box"><h3>ผู้ชวน (' + (d.cfg.REF_SCOPE === 'all' ? 'เปิดทุกคน' : 'เฉพาะกลุ่มนำร่อง') + ')</h3>' + (d.referrers.length ? d.referrers.map(function (r) {
      return '<div class="ord"><div class="ord-h"><b>' + esc(r.name) + '</b><span class="mono hint">' + esc(r.sno) + '</span><span class="hint">ชวนแล้ว ' + r.refs + ' · Coin เดือนนี้ ' + fmt(r.coinMonth) + ' · ใช้ได้ ' + fmt(r.bal) + '</span></div>' +
        (r.link ? '<div class="copy"><input readonly value="' + esc(r.link) + '" aria-label="ลิงก์ชวน"><button class="btn sm" data-a="copy" data-t="' + esc(r.link) + '">คัดลอกลิงก์ชวน</button></div>' : '<div class="alert warn">ตั้ง LIFF_ID ในชีต Config ก่อน</div>') + '</div>';
    }).join('') : '<div class="empty">ยังไม่มี</div>') +
      '<form class="acts" data-form="setPilot" style="margin-top:8px"><div class="field"><label>ให้สิทธิ์ชวนเพื่อน (กลุ่มนำร่อง)</label><select name="id">' + d.members.filter(function (m) { return !m.pilot; }).map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.name) + ' · ' + esc(m.sno) + '</option>'; }).join('') + '</select></div><button class="btn sm" type="submit">ให้สิทธิ์</button></form></div>';
    if (d.flagged.length) h += '<div class="box"><h3>ธงแดง</h3>' + d.flagged.map(function (f) { return '<div class="row"><span>' + esc(f.name) + '<br><small class="hint">' + esc(f.flags) + '</small></span><span>' + (f.rejected ? 'ปิดบัญชี' : f.approved ? 'อนุมัติแล้ว' : 'รอตรวจ') + '</span></div>'; }).join('') + '</div>';
    h += '<div class="box"><h3>พาร์ทเนอร์ & ป้าย QR</h3>' + d.partners.map(function (p) {
      return '<div class="ord"><div class="ord-h"><b class="mono">' + esc(p.id) + '</b><b>' + esc(p.name) + '</b><span class="hint">' + esc(p.type) + ' · ' + esc(p.area) + '</span></div><div class="hint">สแกน ' + p.scans + ' · ลูกค้า ' + p.members + ' · ออเดอร์เดือนนี้ ' + p.orders + ' · ยอด ' + baht(p.sales) + ' · ส่วนแบ่ง ' + baht(p.share) + (p.share < p.minPayout ? ' (ยกไปเดือนหน้า)' : '') + '</div>' +
        (p.link ? '<div class="qr"><div class="code">' + qrSvg(p.link) + '</div><span class="hint">QR สำหรับพิมพ์ติดป้าย</span></div><div class="copy"><input readonly value="' + esc(p.link) + '" aria-label="ลิงก์ป้าย"><button class="btn sm" data-a="copy" data-t="' + esc(p.link) + '">คัดลอกลิงก์ป้าย</button></div>' +
          '<div class="copy"><input readonly value="' + esc(p.joinLink) + '" aria-label="ลิงก์ผูกพาร์ทเนอร์"><button class="btn sm" data-a="copy" data-t="' + esc(p.joinLink) + '">ลิงก์ให้เจ้าของจุด</button></div><div class="hint">' + (p.bound ? 'เจ้าของจุดผูกบัญชีแล้ว' : 'ส่งลิงก์ให้เจ้าของจุดเปิดใน LINE เพื่อดูยอดของตัวเอง') + '</div>' : '<div class="alert warn">ตั้ง LIFF_ID ในชีต Config ก่อน</div>') + '</div>';
    }).join('') + '<form class="acts" data-form="createSign" style="margin-top:8px"><div class="field"><label>ชื่อจุดใหม่</label><input name="name" required></div><div class="field"><label>ประเภท</label><input name="type" placeholder="ร้านใต้คอนโด"></div><div class="field"><label>ที่ตั้ง</label><input name="area"></div><button class="btn sm" type="submit">สร้างป้ายใหม่</button></form></div>';
    return h;
  }
  function adPrice(d) {
    var h = '';
    if (d.staging) h += '<div class="alert info">มีราคาใหม่รอมีผล ' + esc(d.staging.effective) + ' (' + d.staging.rows.length + ' SKU จาก ' + esc(d.staging.file) + ') <button class="btn sm blue" data-a="adm" data-op="priceApply" data-confirm="ให้ราคาใหม่มีผลตอนนี้?">มีผลตอนนี้</button> <button class="btn sm" data-a="adm" data-op="priceCancel">ยกเลิก</button></div>';
    h += '<div class="box"><h3>อัปโหลดราคาสัปดาห์หน้า</h3><div class="hint">หัวตาราง: sku, name, unit, kg, t1_qty, t1_price, t2_qty, t2_price, t3_qty, t3_price, promo (ไฟล์ .xlsx หรือ .csv · แต่ละ SKU มี 1–3 ขั้น)</div>' +
      '<div class="acts" style="margin-top:8px"><input type="file" id="priceFile" accept=".xlsx,.csv" data-chg="priceFile"></div>';
    var ck = S.check;
    if (ck) {
      var errs = ck.rows.filter(function (r) { return r.err; }).length, warns = ck.rows.filter(function (r) { return r.warn && r.warn !== 'สินค้าใหม่'; }).length + ck.missing.length;
      h += '<div style="margin-top:8px">' + (errs ? '<div class="alert bad">มี ' + errs + ' แถวที่ผิด แก้ไฟล์แล้วอัปโหลดใหม่ หรือข้ามแถวนั้น (คงราคาเดิม)</div>' : '') + (warns ? '<div class="alert warn">มี ' + warns + ' จุดที่ควรตรวจกับใบราคาส่วนกลาง</div>' : '') + (!errs && !warns ? '<div class="alert ok">ไฟล์ผ่านการตรวจ</div>' : '') + '</div>';
      h += '<div class="tblw" style="margin-top:6px"><table><thead><tr><th>SKU</th><th>สินค้า</th><th>ราคาเดิม</th><th>ราคาใหม่</th><th>ผลตรวจ</th></tr></thead><tbody>' + ck.rows.map(function (r) {
        return '<tr class="' + (r.err ? 'bad' : r.warn && r.warn !== 'สินค้าใหม่' ? 'warn' : '') + '"><td class="mono">' + esc(r.sku) + '</td><td>' + esc(r.name) + '</td><td>' + (r.old ? r.old.map(function (t) { return t.min + '+ ' + t.price; }).join(' · ') : '–') + '</td><td>' + r.tiers.map(function (t) { return t.min + '+ ' + t.price; }).join(' · ') + '</td><td>' + esc(r.err || r.warn || 'ผ่าน') + '</td></tr>';
      }).join('') + ck.missing.map(function (r) { return '<tr class="warn"><td class="mono">' + esc(r.sku) + '</td><td>' + esc(r.name) + '</td><td>' + r.tiers.map(function (t) { return t.min + '+ ' + t.price; }).join(' · ') + '</td><td>–</td><td>ไม่มีในไฟล์ คงราคาเดิม</td></tr>'; }).join('') + '</tbody></table></div>';
      var tomorrow = new Date(Date.parse(S.cat.today + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10);
      h += '<form class="acts" data-form="priceSave" style="margin-top:8px"><div class="field"><label>มีผลตั้งแต่ (00:00)</label><input type="date" name="effective" value="' + tomorrow + '" required></div>' + (errs ? '<label class="chk"><input type="checkbox" name="skip"><span>ข้ามแถวที่ผิด</span></label>' : '') + (warns ? '<label class="chk"><input type="checkbox" name="warnOk"><span>ตรวจจุดที่เตือนแล้ว</span></label>' : '') + '<button class="btn blue" type="submit">บันทึกราคาใหม่</button><button class="btn" type="button" data-a="clearCheck">ยกเลิกไฟล์นี้</button></form><div class="hint">ใส่วันที่เป็นวันนี้ = มีผลทันที</div>';
    }
    h += '</div><div class="box"><h3>ราคาที่ใช้อยู่ · สต็อกวันนี้</h3><div class="hint">แก้ป้ายร่วมโปร สินค้าแห่งเดือน และชื่อสินค้าได้ในชีต Products</div><div class="tblw" style="margin-top:6px"><table><thead><tr><th>SKU</th><th>สินค้า</th><th>ขั้นราคา</th><th>ร่วมโปร</th><th>มีของ</th></tr></thead><tbody>' + d.products.map(function (p) {
      return '<tr><td class="mono">' + esc(p.sku) + '</td><td>' + esc(p.name) + '</td><td>' + p.tiers.map(function (t) { return t.min + '+ ' + t.price; }).join(' · ') + '</td><td>' + (p.promo ? 'ใช่' : '') + '</td><td><input type="checkbox" data-chg="stock" data-sku="' + esc(p.sku) + '"' + (p.inStock ? ' checked' : '') + ' aria-label="มีของ ' + esc(p.name) + '"></td></tr>';
    }).join('') + '</tbody></table></div></div>';
    return h;
  }
  var SEGS = [['all', 'เพื่อนทั้งหมด'], ['FS', 'Food Service'], ['Consumer', 'Consumer'], ['dormant', 'ไม่ได้สั่งเกิน 14 วัน'], ['referred', 'ลูกค้าใหม่จากคำชวน'], ['sign', 'ลูกค้าจากป้าย']];
  function adBc(d) {
    var h = '<form class="box form" data-form="broadcast"><h3>บรอดแคสต์แบ่งกลุ่ม</h3><div class="field"><label>กลุ่ม</label><select name="segment">' + SEGS.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + ' (' + (d.segments[s[0]] || 0) + ' คน)</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>ข้อความ</label><select name="template"><option value="bundle">เซ็ตคุ้มเดือนนี้</option><option value="pom">สินค้าแห่งเดือน</option><option value="winback">ชวนกลับมาสั่ง</option></select></div><div class="hint">ทุกผู้รับใช้ 1 ข้อความในโควตา · ใช้ไปแล้ว ' + fmt(d.quota.used) + ' / ' + (d.quota.plan ? fmt(d.quota.plan) : 'ไม่จำกัด') + ' · แพ็กเกจฟรีส่งเกินโควตาไม่ได้</div><button class="btn blue" type="submit">ส่ง</button></form>';
    h += '<div class="box"><h3>ส่งแล้ว</h3>' + (d.broadcasts.length ? d.broadcasts.map(function (b) { return '<div class="row"><span>' + esc(b.time) + ' · ' + esc(b.template) + ' · ' + esc(b.segment) + '</span><span>' + b.n + ' คน</span></div>'; }).join('') : '<div class="hint">ยังไม่ได้ส่ง</div>') + '</div>';
    return h;
  }
  function adTools(d) {
    return '<div class="box"><h3>ทดสอบงานตั้งเวลา (ไม่ต้องรอเวลาจริง)</h3><div class="acts"><button class="btn" data-a="adm" data-op="runJob" data-job="reminders">ส่งเตือนบิลค้างจ่าย</button><button class="btn" data-a="adm" data-op="runJob" data-job="standing">ส่งคำถามสั่งประจำ</button><button class="btn" data-a="adm" data-op="runJob" data-job="summary">ส่งสรุปยอดให้ manager</button></div></div>' +
      '<div class="box"><h3>พนักงาน</h3>' + d.staff.map(function (s) { return '<div class="row"><span>' + esc(s.name) + '</span><span>' + esc(s.role) + '</span></div>'; }).join('') + '<div class="hint">เพิ่มพนักงาน: ให้เขาเปิดลิงก์ MINI App ต่อท้าย ?page=staffjoin แล้วใส่ SETUP_CODE</div></div>' +
      '<div class="box"><h3>กติกาและข้อมูล</h3><div class="hint">แก้กติกา (Coin, คูปอง, ส่วนแบ่ง, ขั้นต่ำ, รอบคอนโด) ได้ที่ชีต Config · แก้สินค้า/เซ็ตที่ชีต Products และ Bundles · มีผลทันที</div>' +
      '<div class="copy" style="margin-top:6px"><input readonly value="' + esc(d.sheetUrl) + '" aria-label="ลิงก์ Google Sheet"><button class="btn sm" data-a="copy" data-t="' + esc(d.sheetUrl) + '">คัดลอกลิงก์ชีต</button></div></div>';
  }

  /* ---------- เหตุการณ์ ---------- */
  var ACT = {
    reload: function () { location.reload(); },
    back: back,
    home: function () { go('home', {}); },
    go: function (el) { var p = { }; if (el.dataset.id) p.id = el.dataset.id; go(el.dataset.p, p); },
    cat: function (el) { S.params.cat = el.dataset.p; pageCatalog(); },
    qty: function (el) { var box = el.dataset.k === 'b' ? S.cart.bundles : S.cart.lines; var id = el.dataset.p; box[id] = Math.max(0, (box[id] || 0) + Number(el.dataset.d)); if (!box[id]) delete box[id]; saveCart(); show(); },
    toTier: function (el) { S.cart.lines[el.dataset.p] = Number(el.dataset.q); saveCart(); show(); },
    addFriend: function () { var u = addFriendUrl(); if (u) openUrl(u); },
    closeApp: function () { try { if (liff.isInClient()) { liff.closeWindow(); return; } } catch (e) { } go('home', {}); },
    copy: function (el) { copyText(el.dataset.t); },
    share: function (el) {
      liff.shareTargetPicker([{ type: 'text', text: 'ร้านเปิดสั่งของใน LINE แล้ว ลงทะเบียนผ่านลิงก์นี้รับส่วนลดลูกค้าใหม่: ' + el.dataset.t }]).then(function (r) { if (r) toast('ส่งแล้ว'); }).catch(function (e) { toast('ส่งไม่ได้: ' + e.message); });
    },
    copyMigrate: function (el) {
      copyText('สวัสดีค่ะ ' + el.dataset.name.replace(/\s*\(ตัวอย่าง\)/, '') + ' ร้านเปิด LINE ของร้านแล้ว สั่งของ ดูบิล จ่ายด้วย QR ได้ในที่เดียว กดลิงก์นี้แล้วผูกเลขสมาชิกได้เลย: ' + (el.dataset.link || ''));
      api('markFollow', { id: el.dataset.id, status: 'link' }).catch(function () { });
    },
    submitOrder: function () {
      run('กำลังส่งออเดอร์...', api('submitOrder', { lines: S.cart.lines, bundles: S.cart.bundles, useCoin: !!S.cart.useCoin, mode: S.cart.mode, slot: S.cart.slot }), function (r) {
        S.cart.lines = {}; S.cart.bundles = {}; S.cart.useCoin = false; saveCart();
        return refreshMe().then(function () { go('done', { id: r.orderId }); });
      });
    },
    resetMe: function (el) {
      if (!el.dataset.sure) { el.dataset.sure = '1'; el.textContent = 'กดอีกครั้งเพื่อยืนยัน'; return; }
      run('กำลังลบ...', api('resetMe'), function () {
        S.cart = { lines: {}, bundles: {}, useCoin: false, mode: 'deliver', slot: '' }; saveCart(); S.ui = {};
        return refreshMe().then(function () { toast('ลบแล้ว ลงทะเบียนใหม่ได้'); S.history = []; go('home', {}, true); });
      });
    },
    standingPause: function () { run('กำลังบันทึก...', api('standingPause'), function () { pageStanding(); }); },
    standingConfirm: function () {
      run('กำลังยืนยัน...', api('standingConfirm'), function (r) { toast(r.already ? 'ยืนยันวันที่ ' + r.date + ' ไว้แล้ว' : 'ยืนยันแล้ว ออเดอร์ ' + r.orderId); delete S.params.confirm; pageStanding(); });
    },
    partnerJoin: function () { run('กำลังผูกบัญชี...', api('partnerJoin', { pid: S.params.pid, code: S.params.jc || S.params.code }), function () { return refreshMe().then(function () { go('partner', {}); }); }); },
    tab: function (el) { S.adminTab = el.dataset.p; pageAdmin(); },
    refresh: function () { pageAdmin(true); },
    clearCheck: function () { S.check = null; pageAdmin(); },
    adm: function (el) {
      if (el.dataset.confirm && !el.dataset.sure) { el.dataset.sure = '1'; el.textContent = 'กดอีกครั้งเพื่อยืนยัน'; return; }
      var data = { id: el.dataset.id, status: el.dataset.status, job: el.dataset.job };
      run('กำลังทำรายการ...', api(el.dataset.op, data), function (r) {
        if (el.dataset.op === 'runJob') toast('ส่งแล้ว ' + (r.sent || 0) + ' ข้อความ');
        else if (el.dataset.op === 'approveCoins') toast('อนุมัติ ' + r.approved + ' รายการ');
        else toast('เรียบร้อย');
        return pageAdmin(true);
      });
    }
  };
  function refreshMe() { return api('me').then(function (r) { S.me = r; loadCart(); }); }
  var FORMS = {
    register: function (f) {
      var fd = new FormData(f);
      run('กำลังลงทะเบียน...', api('register', { name: fd.get('name'), contact: fd.get('contact') || '', type: fd.get('type') || 'FS', address: fd.get('address') || '', phone: fd.get('phone'),
        consent: !!fd.get('consent'), ref: S.params.ref || '', src: S.params.ref ? '' : (S.params.src || '') }), function (r) {
        return refreshMe().then(function () { toast(r.flagged ? 'ลงทะเบียนแล้ว ร้านจะตรวจข้อมูลก่อนให้สิทธิ์ลูกค้าใหม่' : 'ลงทะเบียนเรียบร้อย'); S.history = []; go(r.member.sourceKind === 'ref' ? 'catalog' : 'home', r.member.sourceKind === 'ref' ? { cat: 'set' } : {}, true); });
      });
    },
    linkFind: function (f) { var phone = new FormData(f).get('phone'); run('กำลังค้นหา...', api('linkFind', { phone: phone }), function (r) { S.ui.linkFound = Object.assign({ phone: phone }, r.found); pageLink(); }); },
    linkConfirm: function (f) {
      var lf = S.ui.linkFound;
      run('กำลังผูกบัญชี...', api('linkConfirm', { id: lf.id, phone: lf.phone, consent: !!new FormData(f).get('consent') }), function () { S.ui.linkFound = null; return refreshMe().then(function () { toast('ผูกบัญชีเรียบร้อย'); S.history = []; go('home', {}, true); }); });
    },
    notifyPaid: function (f) { run('กำลังแจ้ง...', api('notifyPaid', { id: f.dataset.id, amount: new FormData(f).get('amount') }), function () { toast('แจ้งร้านแล้ว'); pageBill(); }); },
    standingSave: function (f) {
      var fd = new FormData(f);
      run('กำลังบันทึก...', api('standingSave', { items: S.me.lastBasket ? S.me.lastBasket.lines : {}, days: fd.get('days'), slot: fd.get('slot') }), function () { toast('บันทึกสั่งประจำแล้ว'); return refreshMe().then(pageStanding); });
    },
    staffJoin: function (f) { run('กำลังตรวจรหัส...', api('staffJoin', { code: new FormData(f).get('code') }), function () { return refreshMe().then(function () { toast('ตั้งเป็นพนักงานแล้ว'); go('admin', {}, true); }); }); },
    billOrder: function (f) { var fd = new FormData(f); run('กำลังส่งบิล...', api('billOrder', { id: f.dataset.id, txn: fd.get('txn'), actual: fd.get('actual') }), function () { toast('ส่งบิลให้ลูกค้าแล้ว'); return pageAdmin(true); }); },
    approveMember: function (f) { var fd = new FormData(f); run('กำลังอนุมัติ...', api('approveMember', { id: f.dataset.id, sno: fd.get('sno'), clearFlags: !!fd.get('clearFlags') }), function () { toast('อนุมัติแล้ว'); return pageAdmin(true); }); },
    setPilot: function (f) { run('กำลังบันทึก...', api('setPilot', { id: new FormData(f).get('id'), on: true }), function () { toast('ให้สิทธิ์ชวนเพื่อนแล้ว'); return pageAdmin(true); }); },
    createSign: function (f) { var fd = new FormData(f); run('กำลังสร้าง...', api('createSign', { name: fd.get('name'), type: fd.get('type'), area: fd.get('area') }), function (r) { toast('สร้างป้าย ' + r.id + ' แล้ว'); return pageAdmin(true); }); },
    broadcast: function (f) { var fd = new FormData(f); run('กำลังส่ง...', api('broadcast', { segment: fd.get('segment'), template: fd.get('template') }), function (r) { toast('ส่งถึง ' + r.sent + ' คน'); return pageAdmin(true); }); },
    counterBill: function (f) { var fd = new FormData(f); run('กำลังบันทึก...', api('counterBill', { memberId: fd.get('memberId'), txn: fd.get('txn'), amount: fd.get('amount') }), function () { toast('บันทึกแล้ว'); return pageAdmin(true); }); },
    priceSave: function (f) {
      var fd = new FormData(f);
      var errs = S.check.rows.some(function (r) { return r.err; }), warns = S.check.rows.some(function (r) { return r.warn && r.warn !== 'สินค้าใหม่'; }) || S.check.missing.length > 0;
      if (errs && !fd.get('skip')) { toast('มีแถวที่ผิด: แก้ไฟล์ หรือติ๊ก ข้ามแถวที่ผิด'); return; }
      if (warns && !fd.get('warnOk')) { toast('ติ๊กยืนยันว่าตรวจจุดที่เตือนแล้ว'); return; }
      run('กำลังบันทึกราคา...', api('priceUpload', { rows: S.check.upload, save: true, skipErrors: !!fd.get('skip'), effective: fd.get('effective'), fileName: S.check.file }), function (r) {
        S.check = null; toast(r.applied ? 'ราคาใหม่มีผลแล้ว ' + r.staged + ' SKU' : 'ตั้งราคาใหม่ ' + r.staged + ' SKU มีผล ' + r.effective);
        return api('catalog').then(function (c) { S.cat = c; return pageAdmin(true); });
      });
    }
  };
  function parsePriceFile(file) {
    busy(true, 'กำลังอ่านไฟล์...');
    SHEETFILE.read(file).then(function (arr) {
      busy(false);
      var head = (arr[0] || []).map(function (h) { return String(h).trim().toLowerCase(); });
      var ix = function (k) { return head.indexOf(k); };
      if (ix('sku') < 0 || ix('t1_qty') < 0 || ix('t1_price') < 0) { toast('หัวตารางไม่ตรงรูปแบบ แถวแรกต้องมี sku, t1_qty, t1_price'); return; }
      var rows = [];
      for (var r = 1; r < arr.length; r++) {
        var row = arr[r] || [];
        if (row.every(function (v) { return String(v === undefined ? '' : v).trim() === ''; })) continue;
        var cell = function (i) { return i >= 0 && row[i] !== undefined ? String(row[i]).trim() : ''; };
        var tiers = [];
        for (var t = 1; t <= 3; t++) {
          var qv = cell(ix('t' + t + '_qty')), pv = cell(ix('t' + t + '_price'));
          if (qv === '' || pv === '') continue;
          tiers.push({ min: Number(qv.replace(/,/g, '')), price: Number(pv.replace(/,/g, '')) });
        }
        rows.push({ sku: cell(ix('sku')), name: cell(ix('name')), unit: cell(ix('unit')), kg: cell(ix('kg')) || cell(ix('kg_per_unit')), cat: cell(ix('cat')),
          promo: cell(ix('promo')) === '' ? null : cell(ix('promo')), tiers: tiers });
      }
      if (!rows.length) { toast('ไม่พบแถวสินค้าในไฟล์'); return; }
      run('กำลังตรวจไฟล์...', api('priceUpload', { rows: rows, save: false }), function (res) { S.check = { rows: res.check.rows, missing: res.check.missing, upload: rows, file: file.name }; pageAdmin(); });
    }).catch(function (err) { busy(false); toast('อ่านไฟล์ไม่สำเร็จ: ' + err.message); });
    var inp = document.getElementById('priceFile'); if (inp) inp.value = '';
  }

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
    else if (c === 'stock') { run('กำลังบันทึก...', api('setStock', { sku: t.dataset.sku, inStock: t.checked }), function () { return api('catalog').then(function (r) { S.cat = r; toast('บันทึกแล้ว'); }); }); }
    else if (c === 'priceFile') { var f = t.files && t.files[0]; if (f) parsePriceFile(f); }
  });

  /* ---------- เริ่มต้น ---------- */
  function fatal(msg) { render('<div class="wrap"><div class="alert bad">' + esc(msg) + '</div><button class="btn block" data-a="reload">ลองใหม่</button></div>'); }
  function boot() {
    if (!CFG.LIFF_ID || CFG.LIFF_ID.indexOf('ใส่') === 0) return fatal('ยังไม่ได้ใส่ LIFF_ID ในไฟล์ config.js');
    if (!CFG.API_URL || CFG.API_URL.indexOf('https://') !== 0) return fatal('ยังไม่ได้ใส่ API_URL ในไฟล์ config.js');
    if (!window.liff) return fatal('โหลด LINE SDK ไม่ได้ ตรวจอินเทอร์เน็ต');
    liff.init({ liffId: CFG.LIFF_ID, withLoginOnExternalBrowser: true }).then(function () {
      if (!liff.isLoggedIn()) { liff.login({ redirectUri: location.href }); return null; }
      S.params = readParams();
      S.page = S.params.page || 'home';
      cleanUrl();
      return Promise.all([api('catalog'), api('me')]);
    }).then(function (res) {
      if (!res) return;
      S.cat = res[0]; S.me = res[1];
      loadCart();
      if (S.params.src && !S.params.ref && !S.me.member) {
        try { if (!sessionStorage.getItem('scan_' + S.params.src)) { sessionStorage.setItem('scan_' + S.params.src, '1'); api('scan', { src: S.params.src }).catch(function () { }); } } catch (e) { }
      }
      if ((S.params.ref || S.params.src) && !S.me.member && S.page === 'home') S.page = 'register';
      show();
    }).catch(function (e) {
      if (e && e.code === 'AUTH') return fail(e);
      var msg = String((e && e.message) || e);
      var hint = /UrlFetchApp|permission|สิทธิ์/i.test(msg) ? ' — Apps Script ยังได้รับสิทธิ์ไม่ครบ: รันฟังก์ชัน setup อีกครั้งแล้วติ๊ก Select all จากนั้น Deploy เวอร์ชันใหม่'
        : e && (e.code === 'NET' || e.code === 'SETUP') ? '' : ' — ตรวจ LIFF_ID ใน config.js ให้ตรงกับ LINE Developers และ Endpoint URL ให้ตรงกับที่อยู่ GitHub Pages';
      fatal('เปิดระบบไม่สำเร็จ: ' + (e && e.code ? '[' + e.code + '] ' : '') + ((e && e.message) || e) + hint);
    });
  }
  boot();
})();
