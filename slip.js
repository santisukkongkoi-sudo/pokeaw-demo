/* อ่าน QR บนสลิปโอนเงิน (โหลดเฉพาะตอนแนบสลิป) — ใช้ BarcodeDetector ถ้าเครื่องรองรับ ไม่งั้นใช้ตัวอ่านในไฟล์นี้
 * รองรับ QR เวอร์ชัน 1–20 ทุกระดับแก้ผิด (L/M/Q/H) เหมาะกับภาพสลิปจากแอปธนาคาร (ภาพหน้าจอ) */
(function (root) {
  'use strict';
  /* ---------- GF(256) / Reed–Solomon ---------- */
  var EXP = new Array(512), LOG = new Array(256);
  (function () { var x = 1; for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; } for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255]; })();
  function mul(a, b) { return a && b ? EXP[LOG[a] + LOG[b]] : 0; }
  function div(a, b) { if (!b) throw new Error('div0'); return a ? EXP[(LOG[a] + 255 - LOG[b]) % 255] : 0; }
  function polyEval(p, x) { var y = 0; for (var i = 0; i < p.length; i++) y = mul(y, x) ^ p[i]; return y; } // p[0] = สัมประสิทธิ์ดีกรีสูงสุด
  /* แก้ผิดในบล็อก (codewords = data+ec เรียงดีกรีสูงสุดก่อน) คืน data ที่แก้แล้ว หรือ null */
  function rsCorrect(cw, ec) {
    var n = cw.length, synd = [], bad = false;
    for (var j = 0; j < ec; j++) { synd[j] = polyEval(cw, EXP[j]); if (synd[j]) bad = true; }
    if (!bad) return cw.slice(0, n - ec);
    // Berlekamp–Massey (สัมประสิทธิ์ดีกรีต่ำก่อน)
    var C = [1], B = [1], L = 0, m = 1, b = 1;
    for (var k = 0; k < ec; k++) {
      var d = synd[k];
      for (var i = 1; i <= L; i++) d ^= mul(C[i] || 0, synd[k - i]);
      if (d === 0) { m++; continue; }
      var T = C.slice(), coef = div(d, b);
      for (var t = 0; t < B.length; t++) { C[t + m] = (C[t + m] || 0) ^ mul(coef, B[t]); }
      if (2 * L <= k) { L = k + 1 - L; B = T; b = d; m = 1; } else m++;
    }
    if (L * 2 > ec) return null;
    // ค้นตำแหน่งผิด (Chien): ตำแหน่ง p (นับจากท้าย) ผิด ถ้า Λ(α^-p) = 0
    var pos = [];
    for (var p = 0; p < n; p++) {
      var xi = EXP[(255 - p) % 255], v = 0;
      for (var q = C.length - 1; q >= 0; q--) v = mul(v, xi) ^ (C[q] || 0);
      if (v === 0) pos.push(p);
    }
    if (pos.length !== L) return null;
    // Ω(x) = S(x)Λ(x) mod x^ec
    var om = [];
    for (var a = 0; a < ec; a++) { var s = 0; for (var c2 = 0; c2 <= a; c2++) s ^= mul(C[c2] || 0, synd[a - c2]); om[a] = s; }
    var out = cw.slice();
    for (var e = 0; e < pos.length; e++) {
      var X = EXP[pos[e] % 255], Xi = EXP[(255 - pos[e]) % 255], num = 0, den = 0, pw = 1;
      for (var z = 0; z < ec; z++) { num ^= mul(om[z], pw); pw = mul(pw, Xi); }
      // Λ'(Xi): เฉพาะพจน์ดีกรีคี่
      pw = 1; for (var y = 1; y < C.length; y += 2) { den ^= mul(C[y] || 0, pw); pw = mul(pw, mul(Xi, Xi)); }
      if (!den) return null;
      var mag = mul(X, div(num, den)); // b = 0
      out[n - 1 - pos[e]] ^= mag;
    }
    for (var j2 = 0; j2 < ec; j2++) if (polyEval(out, EXP[j2])) return null;
    return out.slice(0, n - ec);
  }

  /* ---------- ตาราง QR ---------- */
  // [ec ต่อบล็อก, บล็อกกลุ่ม1, data/บล็อก1, บล็อกกลุ่ม2, data/บล็อก2] ลำดับ L, M, Q, H
  var RS = [null,
    [[7, 1, 19], [10, 1, 16], [13, 1, 13], [17, 1, 9]], [[10, 1, 34], [16, 1, 28], [22, 1, 22], [28, 1, 16]], [[15, 1, 55], [26, 1, 44], [18, 2, 17], [22, 2, 13]],
    [[20, 1, 80], [18, 2, 32], [26, 2, 24], [16, 4, 9]], [[26, 1, 108], [24, 2, 43], [18, 2, 15, 2, 16], [22, 2, 11, 2, 12]], [[18, 2, 68], [16, 4, 27], [24, 4, 19], [28, 4, 15]],
    [[20, 2, 78], [18, 4, 31], [18, 2, 14, 4, 15], [26, 4, 13, 1, 14]], [[24, 2, 97], [22, 2, 38, 2, 39], [22, 4, 18, 2, 19], [26, 4, 14, 2, 15]],
    [[30, 2, 116], [22, 3, 36, 2, 37], [20, 4, 16, 4, 17], [24, 4, 12, 4, 13]], [[18, 2, 68, 2, 69], [26, 4, 43, 1, 44], [24, 6, 19, 2, 20], [28, 6, 15, 2, 16]],
    [[20, 4, 81], [30, 1, 50, 4, 51], [28, 4, 22, 4, 23], [24, 3, 12, 8, 13]], [[24, 2, 92, 2, 93], [22, 6, 36, 2, 37], [26, 4, 20, 6, 21], [28, 7, 14, 4, 15]],
    [[26, 4, 107], [22, 8, 37, 1, 38], [24, 8, 20, 4, 21], [22, 12, 11, 4, 12]], [[30, 3, 115, 1, 116], [24, 4, 40, 5, 41], [20, 11, 16, 5, 17], [24, 11, 12, 5, 13]],
    [[22, 5, 87, 1, 88], [24, 5, 41, 5, 42], [30, 5, 24, 7, 25], [24, 11, 12, 7, 13]], [[24, 5, 98, 1, 99], [28, 7, 45, 3, 46], [24, 15, 19, 2, 20], [30, 3, 15, 13, 16]],
    [[28, 1, 107, 5, 108], [28, 10, 46, 1, 47], [28, 1, 22, 15, 23], [28, 2, 14, 17, 15]], [[30, 5, 120, 1, 121], [26, 9, 43, 4, 44], [28, 17, 22, 1, 23], [28, 2, 14, 19, 15]],
    [[28, 3, 113, 4, 114], [26, 3, 44, 11, 45], [26, 17, 21, 4, 22], [26, 9, 13, 16, 14]], [[28, 3, 107, 5, 108], [26, 3, 41, 13, 42], [30, 15, 24, 5, 25], [28, 15, 15, 10, 16]]];
  var ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62],
    [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90]];
  var LEVEL_BY_BITS = { 1: 0, 0: 1, 3: 2, 2: 3 }; // บิตระดับ → ลำดับใน RS (L,M,Q,H)
  function bch(data, poly, shift) { var d = data << shift, pl = poly.toString(2).length; while (d.toString(2).length >= pl) d ^= poly << (d.toString(2).length - pl); return (data << shift) | d; }
  var FORMATS = []; for (var f = 0; f < 32; f++) FORMATS.push([bch(f, 0x537, 10) ^ 0x5412, f]);
  function hamming(a, b) { var x = a ^ b, c = 0; while (x) { c += x & 1; x >>>= 1; } return c; }
  var MASKS = [function (i, j) { return (i + j) % 2 === 0; }, function (i) { return i % 2 === 0; }, function (i, j) { return j % 3 === 0; }, function (i, j) { return (i + j) % 3 === 0; },
    function (i, j) { return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0; }, function (i, j) { return (i * j) % 2 + (i * j) % 3 === 0; },
    function (i, j) { return ((i * j) % 2 + (i * j) % 3) % 2 === 0; }, function (i, j) { return ((i + j) % 2 + (i * j) % 3) % 2 === 0; }];

  function functionMap(v) {
    var n = v * 4 + 17, F = [], i, j, r, c;
    for (i = 0; i < n; i++) F.push(new Array(n).fill(false));
    function box(r0, c0, h, w) { for (r = r0; r < r0 + h; r++) for (c = c0; c < c0 + w; c++) if (r >= 0 && c >= 0 && r < n && c < n) F[r][c] = true; }
    box(0, 0, 9, 9); box(0, n - 8, 9, 8); box(n - 8, 0, 8, 9);
    for (i = 0; i < n; i++) { F[6][i] = true; F[i][6] = true; }
    var pos = ALIGN[v];
    for (i = 0; i < pos.length; i++) for (j = 0; j < pos.length; j++) {
      var ar = pos[i], ac = pos[j];
      if ((ar < 9 && ac < 9) || (ar < 9 && ac > n - 10) || (ar > n - 10 && ac < 9)) continue;
      box(ar - 2, ac - 2, 5, 5);
    }
    if (v >= 7) { box(0, n - 11, 6, 3); box(n - 11, 0, 3, 6); }
    return F;
  }

  /* ---------- อ่านจากตารางโมดูล ---------- */
  function readFormat(M) {
    var n = M.length, a = 0, b = 0;
    for (var i = 0; i < 15; i++) {
      var ra = i < 6 ? i : i < 8 ? i + 1 : n - 15 + i;
      if (M[ra][8]) a |= 1 << i;
      var cb = i < 8 ? n - i - 1 : i < 9 ? 15 - i : 14 - i;
      if (M[8][cb]) b |= 1 << i;
    }
    var best = null, bd = 99;
    FORMATS.forEach(function (fm) { var d = Math.min(hamming(a, fm[0]), hamming(b, fm[0])); if (d < bd) { bd = d; best = fm[1]; } });
    if (bd > 3) return null;
    return { level: LEVEL_BY_BITS[best >> 3], mask: best & 7 };
  }
  function decodeMatrix(M) {
    var n = M.length, v = (n - 17) / 4;
    if (v < 1 || v > 20 || v !== Math.floor(v)) return null;
    var fmt = readFormat(M); if (!fmt) return null;
    var F = functionMap(v), mf = MASKS[fmt.mask], bits = [], up = true;
    for (var col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (var k = 0; k < n; k++) {
        var row = up ? n - 1 - k : k;
        for (var c = 0; c < 2; c++) { var cc = col - c; if (F[row][cc]) continue; bits.push(M[row][cc] !== mf(row, cc)); }
      }
      up = !up;
    }
    var t = RS[v][fmt.level], ec = t[0], blocks = [], nb = t[1] + (t[3] || 0), total = t[1] * t[2] + (t[3] || 0) * (t[4] || 0);
    for (var bi = 0; bi < nb; bi++) blocks.push({ len: bi < t[1] ? t[2] : t[4], data: [], ecw: [] });
    var bytes = []; for (var x = 0; x + 8 <= bits.length; x += 8) { var by = 0; for (var y = 0; y < 8; y++) by = (by << 1) | (bits[x + y] ? 1 : 0); bytes.push(by); }
    var p = 0, maxLen = Math.max(t[2], t[4] || 0);
    for (var i2 = 0; i2 < maxLen; i2++) blocks.forEach(function (bk) { if (i2 < bk.len) bk.data.push(bytes[p++]); });
    for (var e = 0; e < ec; e++) blocks.forEach(function (bk) { bk.ecw.push(bytes[p++]); });
    var data = [];
    for (var b2 = 0; b2 < blocks.length; b2++) { var fixed = rsCorrect(blocks[b2].data.concat(blocks[b2].ecw), ec); if (!fixed) return null; data = data.concat(fixed); }
    if (data.length !== total) return null;
    return parseData(data, v);
  }
  function parseData(data, v) {
    var bitPos = 0, out = '', bytesAcc = [];
    function read(nb) { var x = 0; for (var i = 0; i < nb; i++) { var byi = data[(bitPos >> 3)]; if (byi === undefined) return -1; x = (x << 1) | ((byi >> (7 - (bitPos & 7))) & 1); bitPos++; } return x; }
    var AN = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
    function flush() { if (bytesAcc.length) { try { out += new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytesAcc)); } catch (e) { out += bytesAcc.map(function (c) { return String.fromCharCode(c); }).join(''); } bytesAcc = []; } }
    for (;;) {
      if (bitPos + 4 > data.length * 8) break;
      var mode = read(4);
      if (mode === 0 || mode < 0) break;
      var cbits = function (a, b, c) { return v < 10 ? a : v < 27 ? b : c; };
      if (mode === 1) { flush(); var nN = read(cbits(10, 12, 14)); while (nN >= 3) { out += ('00' + read(10)).slice(-3); nN -= 3; } if (nN === 2) out += ('0' + read(7)).slice(-2); else if (nN === 1) out += read(4); }
      else if (mode === 2) { flush(); var nA = read(cbits(9, 11, 13)); while (nA >= 2) { var w = read(11); out += AN[Math.floor(w / 45)] + AN[w % 45]; nA -= 2; } if (nA === 1) out += AN[read(6)]; }
      else if (mode === 4) { var nB = read(cbits(8, 16, 16)); for (var i = 0; i < nB; i++) bytesAcc.push(read(8)); }
      else if (mode === 7) { var e1 = read(8); if ((e1 & 0x80) === 0x80) read((e1 & 0x40) ? 16 : 8); }
      else return null;
    }
    flush();
    return out;
  }

  /* ---------- หา QR ในภาพ ---------- */
  function binarize(gray, w, h) {
    var S = new Float64Array((w + 1) * (h + 1)), x, y;
    for (y = 0; y < h; y++) { var rs = 0; for (x = 0; x < w; x++) { rs += gray[y * w + x]; S[(y + 1) * (w + 1) + x + 1] = S[y * (w + 1) + x + 1] + rs; } }
    var R = Math.max(8, Math.round(Math.min(w, h) / 16)), out = new Uint8Array(w * h);
    for (y = 0; y < h; y++) {
      var y0 = Math.max(0, y - R), y1 = Math.min(h, y + R + 1);
      for (x = 0; x < w; x++) {
        var x0 = Math.max(0, x - R), x1 = Math.min(w, x + R + 1);
        var mean = (S[y1 * (w + 1) + x1] - S[y0 * (w + 1) + x1] - S[y1 * (w + 1) + x0] + S[y0 * (w + 1) + x0]) / ((y1 - y0) * (x1 - x0));
        var g = gray[y * w + x];
        out[y * w + x] = (g < mean - 8 && g < 200) || g < 60 ? 1 : 0;
      }
    }
    return out;
  }
  function ratioOk(r) {
    var tot = r[0] + r[1] + r[2] + r[3] + r[4]; if (tot < 7) return false;
    var u = tot / 7, tol = u * 0.7;
    return Math.abs(r[0] - u) < tol && Math.abs(r[1] - u) < tol && Math.abs(r[2] - 3 * u) < 3 * tol && Math.abs(r[3] - u) < tol && Math.abs(r[4] - u) < tol;
  }
  function crossCheck(B, w, h, cx, cy, vertical, maxCount) {
    var get = vertical ? function (k) { return k >= 0 && k < h ? B[k * w + cx] : -1; } : function (k) { return k >= 0 && k < w ? B[cy * w + k] : -1; };
    var c0 = vertical ? cy : cx, st = [0, 0, 0, 0, 0], i = c0;
    while (get(i) === 1) { st[2]++; i--; } if (get(i) < 0) return null;
    while (get(i) === 0 && st[1] <= maxCount) { st[1]++; i--; } if (get(i) < 0 || st[1] > maxCount) return null;
    while (get(i) === 1 && st[0] <= maxCount) { st[0]++; i--; } if (st[0] > maxCount) return null;
    i = c0 + 1;
    while (get(i) === 1) { st[2]++; i++; } if (get(i) < 0) return null;
    while (get(i) === 0 && st[3] <= maxCount) { st[3]++; i++; } if (get(i) < 0 || st[3] > maxCount) return null;
    while (get(i) === 1 && st[4] <= maxCount) { st[4]++; i++; } if (st[4] > maxCount) return null;
    if (!ratioOk(st)) return null;
    return { c: i - st[4] - st[3] - st[2] / 2, size: (st[0] + st[1] + st[2] + st[3] + st[4]) / 7 };
  }
  function findFinders(B, w, h) {
    var cands = [], step = Math.max(1, Math.floor(h / 400));
    for (var y = 0; y < h; y += step) {
      var st = [0, 0, 0, 0, 0], s = 0; // สถานะ 0 ดำ 1 ขาว 2 ดำ 3 ขาว 4 ดำ
      for (var x = 0; x <= w; x++) {
        var px = x < w ? B[y * w + x] : 0;
        if (px === 1) { if (s & 1) { s++; st[s] = 0; } st[s]++; continue; }
        if (s === 0 && st[0] === 0) continue;
        if (s & 1) { st[s]++; continue; }
        if (s === 4) {
          if (ratioOk(st)) {
            var cx = x - st[4] - st[3] - st[2] / 2, unit = (st[0] + st[1] + st[2] + st[3] + st[4]) / 7;
            var vy = crossCheck(B, w, h, Math.round(cx), y, true, Math.ceil(unit * 4));
            if (vy) { var hx = crossCheck(B, w, h, Math.round(cx), Math.round(vy.c), false, Math.ceil(unit * 4)); if (hx) addCand(cands, hx.c, vy.c, (hx.size + vy.size + unit) / 3); }
          }
          st = [st[2], st[3], st[4], 1, 0]; s = 3;
        } else { s++; st[s] = 1; }
      }
    }
    return cands.filter(function (c) { return c.n >= 2; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 10);
  }
  function addCand(cands, x, y, size) {
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      if (Math.abs(c.x - x) < c.size * 2 && Math.abs(c.y - y) < c.size * 2 && Math.abs(c.size - size) < c.size) {
        c.x = (c.x * c.n + x) / (c.n + 1); c.y = (c.y * c.n + y) / (c.n + 1); c.size = (c.size * c.n + size) / (c.n + 1); c.n++; return;
      }
    }
    cands.push({ x: x, y: y, size: size, n: 1 });
  }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function tryTriple(B, w, h, A, Bp, C) {
    var dAB = dist(A, Bp), dAC = dist(A, C), dBC = dist(Bp, C), tl, p, q;
    if (dBC >= dAB && dBC >= dAC) { tl = A; p = Bp; q = C; } else if (dAC >= dAB) { tl = Bp; p = A; q = C; } else { tl = C; p = A; q = Bp; }
    var cross = (p.x - tl.x) * (q.y - tl.y) - (p.y - tl.y) * (q.x - tl.x), tr = cross > 0 ? p : q, bl = cross > 0 ? q : p;
    var ms = (tl.size + tr.size + bl.size) / 3, est = (dist(tl, tr) + dist(tl, bl)) / 2 / ms + 7;
    var dim0 = Math.round((est - 17) / 4) * 4 + 17, tries = [dim0, dim0 + 4, dim0 - 4];
    for (var t = 0; t < tries.length; t++) {
      var dim = tries[t]; if (dim < 21 || dim > 97) continue;
      var M = [], k = dim - 7;
      for (var r = 0; r < dim; r++) {
        var row = [];
        for (var c = 0; c < dim; c++) {
          var u = (c - 3) / k, v = (r - 3) / k;
          var X = tl.x + u * (tr.x - tl.x) + v * (bl.x - tl.x), Y = tl.y + u * (tr.y - tl.y) + v * (bl.y - tl.y);
          var xi = Math.round(X), yi = Math.round(Y);
          row.push(xi >= 0 && yi >= 0 && xi < w && yi < h ? B[yi * w + xi] === 1 : false);
        }
        M.push(row);
      }
      var res = decodeMatrix(M);
      if (res) return res;
    }
    return null;
  }
  function decodeGray(gray, w, h) {
    var B = binarize(gray, w, h), cs = findFinders(B, w, h);
    for (var i = 0; i < cs.length; i++) for (var j = i + 1; j < cs.length; j++) for (var k = j + 1; k < cs.length; k++) {
      var a = cs[i], b = cs[j], c = cs[k];
      if (Math.max(a.size, b.size, c.size) > 1.6 * Math.min(a.size, b.size, c.size)) continue;
      var r = tryTriple(B, w, h, a, b, c); if (r !== null) return r;
    }
    return null;
  }
  function decodeImageData(id) {
    var w = id.width, h = id.height, d = id.data, g = new Uint8Array(w * h);
    for (var i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (d[j] * 299 + d[j + 1] * 587 + d[j + 2] * 114) / 1000;
    return decodeGray(g, w, h);
  }
  /* ---------- อ่าน payload สลิปไทย (Mini QR: tag 00 > 01 ธนาคาร, 02 เลขอ้างอิง) ---------- */
  var BANKS = { '002': 'กรุงเทพ', '004': 'กสิกรไทย', '006': 'กรุงไทย', '011': 'ทหารไทยธนชาต', '014': 'ไทยพาณิชย์', '025': 'กรุงศรี', '030': 'ออมสิน', '034': 'ธ.ก.ส.', '069': 'เกียรตินาคินภัทร', '022': 'ซีไอเอ็มบี', '024': 'ยูโอบี', '073': 'แลนด์ แอนด์ เฮ้าส์', '067': 'ทิสโก้' };
  function tlv(s) { var o = {}, i = 0; while (i + 4 <= s.length) { var t = s.substr(i, 2), l = parseInt(s.substr(i + 2, 2), 10); if (isNaN(l)) break; o[t] = s.substr(i + 4, l); i += 4 + l; } return o; }
  function parseSlip(text) {
    if (!text) return null;
    var t = tlv(text), inner = t['00'] ? tlv(t['00']) : {};
    var ref = inner['02'] || '', bank = inner['01'] || '';
    var isSlip = /^\d{6}$/.test(inner['00'] || '') && !!ref;
    return { raw: text, isSlip: isSlip, ref: isSlip ? text : '', transRef: ref, bankCode: bank, bank: BANKS[bank] || '', isPromptPayBill: /^000201/.test(text) };
  }
  /* ภาพ → ข้อความใน QR (ย่อ/ขยายหลายขนาดเพื่อความแม่น) */
  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { resolve(img); setTimeout(function () { URL.revokeObjectURL(url); }, 1000); };
      img.onerror = function () { reject(new Error('เปิดรูปไม่ได้')); };
      img.src = url;
    });
  }
  function scan(img) {
    var tryDetector = root.BarcodeDetector ? new root.BarcodeDetector({ formats: ['qr_code'] }).detect(img).then(function (r) { return r && r[0] ? r[0].rawValue : null; }).catch(function () { return null; }) : Promise.resolve(null);
    return tryDetector.then(function (hit) {
      if (hit) return hit;
      var W = img.naturalWidth || img.width, H = img.naturalHeight || img.height, sizes = [1000, 1600, 700];
      for (var s = 0; s < sizes.length; s++) {
        var k = Math.min(1, sizes[s] / Math.max(W, H)), w = Math.round(W * k), h = Math.round(H * k);
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
        var r = decodeImageData(cx.getImageData(0, 0, w, h));
        if (r) return r;
      }
      return null;
    });
  }
  /* ย่อรูปสลิปก่อนส่ง (ประหยัดเน็ต) */
  function compress(img, maxSide, q) {
    var W = img.naturalWidth || img.width, H = img.naturalHeight || img.height, k = Math.min(1, (maxSide || 1280) / Math.max(W, H));
    var cv = document.createElement('canvas'); cv.width = Math.round(W * k); cv.height = Math.round(H * k);
    var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', q || 0.78);
  }
  var API = { decodeGray: decodeGray, decodeImageData: decodeImageData, decodeMatrix: decodeMatrix, rsCorrect: rsCorrect, parseSlip: parseSlip, readFile: readFile, scan: scan, compress: compress };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.PKSlip = API;
})(typeof window !== 'undefined' ? window : this);
