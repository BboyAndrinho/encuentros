'use strict';
// Hoja de personaje en PDF (A4). Escribe el PDF directamente, sin librerías ni conexión.
// Usa las funciones de app.js: hojaPDF(pj) → { bytes, nombre, paginas }
(function () {
  // Anchos de Helvetica y Helvetica Negrita (caracteres 32-255 de Windows-1252, en milésimas)
  const ANCHOS = '278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,500,556,750,222,556,333,1000,556,556,333,1000,667,333,1000,750,611,750,750,222,222,333,333,350,556,1000,333,1000,500,333,944,750,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,0,737,552,400,549,333,333,333,576,537,333,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,549,611,556,556,556,556,500,556,500|278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,500,556,750,278,556,500,1000,556,556,333,1000,667,333,1000,750,611,750,750,278,278,500,500,350,556,1000,333,1000,556,333,944,750,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,0,737,552,400,549,333,333,333,576,556,333,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,549,611,611,611,611,611,556,611,556'.split('|').map(s => s.split(',').map(Number));
  // ---------- Texto: Windows-1252 ----------
  const W1252 = { '€': 128, '‚': 130, 'ƒ': 131, '„': 132, '…': 133, '†': 134, '‡': 135, '‰': 137, '‹': 139, 'Œ': 140, '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151, '™': 153, '›': 155, 'œ': 156, 'Ÿ': 159, '−': 150, '‑': 45, '‐': 45, '\u00a0': 32, '\u2009': 32, '\u202f': 32, '≥': 62, '≤': 60, '′': 39, '″': 34 };
  const limpio = s => { let o = ''; for (const ch of String(s ?? '').replace(/\s+/g, ' ')) { const n = W1252[ch] || ch.codePointAt(0); if (n >= 32 && n < 256 && n !== 127) o += String.fromCharCode(n); } return o; };
  // s ya es texto «limpio» (cada carácter es un byte)
  const ancho = (s, tam, neg) => { const t = ANCHOS[neg ? 1 : 0]; let n = 0; for (let i = 0; i < s.length; i++) n += t[s.charCodeAt(i) - 32] || 0; return n * tam / 1000; };
  const escPDF = s => s.replace(/[\\()]/g, '\\$&').replace(/[\x80-\xff]/g, c => '\\' + c.charCodeAt(0).toString(8).padStart(3, '0'));

  // ---------- Dibujo ----------
  const W = 595.28, H = 841.89, M = 28;
  const COL = { tinta: [.1, .1, .12], marco: [.42, .42, .45], suave: [.36, .36, .4], rojo: [.55, .13, .13], gris: [.93, .925, .91], linea: [.78, .78, .78], blanco: [1, 1, 1] };
  function Doc() {
    const pags = [], imgs = []; let ops = null;
    const f = n => (Math.round(n * 100) / 100).toString();
    const d = {
      pags,
      pagina() { ops = []; pags.push(ops); return d; },
      color(c, t) { ops.push(c.map(f).join(' ') + (t ? ' RG' : ' rg')); },
      // y: línea base, contando desde arriba
      texto(s, x, y, o = {}) {
        s = limpio(s); if (!s) return 0;
        let tam = o.tam || 8; const neg = !!o.neg;
        if (o.max) while (ancho(s, tam, neg) > o.max && tam > (o.min || 4.5)) tam -= .25;
        if (o.max && ancho(s, tam, neg) > o.max) { while (s.length > 1 && ancho(s + '\x85', tam, neg) > o.max) s = s.slice(0, -1); s = s.trim() + '\x85'; }
        const w = ancho(s, tam, neg);
        if (o.al === 'c') x -= w / 2; else if (o.al === 'd') x -= w;
        d.color(o.color || COL.tinta);
        ops.push(`BT /F${(neg ? 1 : 0) + (o.cur ? 2 : 0) + 1} ${f(tam)} Tf ${f(x)} ${f(H - y)} Td (${escPDF(s)}) Tj ET`);
        return w;
      },
      linea(x1, y1, x2, y2, o = {}) { d.color(o.color || COL.marco, 1); ops.push(`${f(o.g || .7)} w ${f(x1)} ${f(H - y1)} m ${f(x2)} ${f(H - y2)} l S`); },
      rect(x, y, w, h, o = {}) {
        const r = Math.min(o.r ?? 0, w / 2, h / 2), k = r * .5523, b = H - y - h, t = H - y, R = x + w, p = [];
        if (!r) p.push(`${f(x)} ${f(b)} ${f(w)} ${f(h)} re`);
        else p.push(`${f(x + r)} ${f(b)} m ${f(R - r)} ${f(b)} l ${f(R - r + k)} ${f(b)} ${f(R)} ${f(b + r - k)} ${f(R)} ${f(b + r)} c ${f(R)} ${f(t - r)} l ${f(R)} ${f(t - r + k)} ${f(R - r + k)} ${f(t)} ${f(R - r)} ${f(t)} c ${f(x + r)} ${f(t)} l ${f(x + r - k)} ${f(t)} ${f(x)} ${f(t - r + k)} ${f(x)} ${f(t - r)} c ${f(x)} ${f(b + r)} l ${f(x)} ${f(b + r - k)} ${f(x + r - k)} ${f(b)} ${f(x + r)} ${f(b)} c h`);
        if (o.relleno) d.color(o.relleno);
        if (o.borde !== false) { d.color(o.color || COL.marco, 1); p.unshift(`${f(o.g || 1.2)} w`); }
        p.push(o.relleno ? (o.borde === false ? 'f' : 'B') : 'S'); ops.push(p.join(' '));
      },
      circulo(cx, cy, r, o = {}) { d.rect(cx - r, cy - r, 2 * r, 2 * r, { r, ...o }); },
      // Foto JPEG (data:image/jpeg;base64,…) que llena el marco, recortando lo que sobre
      foto(url, x, y, w, h) {
        const b = atob(url.split(',')[1]); let i = 2, iw = 0, ih = 0;
        while (i < b.length) { if (b.charCodeAt(i) !== 255) { i++; continue; } const k = b.charCodeAt(i + 1); if (k >= 0xc0 && k <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(k)) { ih = b.charCodeAt(i + 5) * 256 + b.charCodeAt(i + 6); iw = b.charCodeAt(i + 7) * 256 + b.charCodeAt(i + 8); break; } i += k === 255 ? 1 : 2 + b.charCodeAt(i + 2) * 256 + b.charCodeAt(i + 3); }
        if (!iw || !ih) return;
        imgs.push({ b, iw, ih });
        const e = Math.max(w / iw, h / ih), dw = iw * e, dh = ih * e, dx = x - (dw - w) / 2, dy = y - (dh - h) * .3;
        ops.push(`q ${f(x)} ${f(H - y - h)} ${f(w)} ${f(h)} re W n ${f(dw)} 0 0 ${f(dh)} ${f(dx)} ${f(H - dy - dh)} cm /Im${imgs.length} Do Q`);
      },
      // Escudo para la CA
      escudo(x, y, w, h) {
        const X = v => f(x + v * w), Y = v => f(H - y - v * h);
        d.color(COL.blanco); d.color(COL.marco, 1);
        ops.push(`1.6 w ${X(0)} ${Y(.04)} m ${X(.25)} ${Y(.04)} ${X(.4)} ${Y(.03)} ${X(.5)} ${Y(0)} c ${X(.6)} ${Y(.03)} ${X(.75)} ${Y(.04)} ${X(1)} ${Y(.04)} c ${X(1)} ${Y(.55)} l ${X(1)} ${Y(.78)} ${X(.75)} ${Y(.93)} ${X(.5)} ${Y(1)} c ${X(.25)} ${Y(.93)} ${X(0)} ${Y(.78)} ${X(0)} ${Y(.55)} c h B`);
      },
      // Punto de competencia: vacío, lleno o doble (pericia)
      punto(cx, cy, r, lleno, doble) { if (doble) d.circulo(cx, cy, r + 1.8, { g: .9, color: COL.rojo }); d.circulo(cx, cy, r, lleno ? { relleno: COL.rojo, color: COL.rojo, g: .7 } : { g: .8 }); },
      casilla(x, y, t, o = {}) { d.rect(x, y, t, t, { r: 1, g: .8, ...o }); },
      bytes(titulo) {
        const objs = [], add = s => objs.push(s);
        const n = pags.length, nombres = ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique'];
        add('<< /Type /Catalog /Pages 2 0 R /Lang (es-ES) >>');
        add(`<< /Type /Pages /Count ${n} /Kids [${pags.map((_, i) => `${7 + i * 2} 0 R`).join(' ')}] >>`);
        nombres.forEach(x => add(`<< /Type /Font /Subtype /Type1 /BaseFont /${x} /Encoding /WinAnsiEncoding >>`));
        pags.forEach((p, i) => {
          add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >>${imgs.length ? ` /XObject << ${imgs.map((_, k) => `/Im${k + 1} ${7 + n * 2 + k} 0 R`).join(' ')} >>` : ''} >> /Contents ${8 + i * 2} 0 R >>`);
          const c = p.join('\n'); add(`<< /Length ${c.length} >>\nstream\n${c}\nendstream`);
        });
        imgs.forEach(m => add(`<< /Type /XObject /Subtype /Image /Width ${m.iw} /Height ${m.ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${m.b.length} >>\nstream\n${m.b}\nendstream`));
        add(`<< /Title (${escPDF(limpio(titulo))}) /Creator (Encuentros D&D) >>`);
        let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'; const pos = [];
        objs.forEach((o, i) => { pos.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
        const xref = out.length;
        out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + pos.map(p => String(p).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${objs.length} 0 R >>\nstartxref\n${xref}\n%%EOF`;
        const b = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) b[i] = out.charCodeAt(i) & 255;
        return b;
      }
    };
    return d;
  }

  // ---------- Texto con formato ----------
  // HTML del SRD → párrafos [{ runs: [{t, n, c}], sangria, vineta }] o [{ tabla }]
  const plant = document.createElement('template');
  const memoP = new Map();
  function parrafos(html, sinNegrita) { const k = (sinNegrita ? '1' : '0') + (html || ''); if (!memoP.has(k)) { if (memoP.size > 600) memoP.clear(); const l = leerHTML(html || ''); memoP.set(k, sinNegrita ? l.map(quitarNegrita) : l); } return memoP.get(k).slice(); }
  // Los subtítulos («Requisitos.») pasan a cursiva y con dos puntos, para que no parezcan otro rasgo; el resto de la negrita, a letra normal
  function quitarNegrita(p) {
    if (p.tabla) return { tabla: p.tabla.map(f => f.map(c => c.map(r => r.n ? { ...r, n: false, c: true } : r))) };
    let k = 0; while (k < p.runs.length && (p.runs[k].n || !p.runs[k].t.trim())) k++;
    while (k && !p.runs[k - 1].n) k--;
    const fin = p.runs.slice(0, k).map(r => r.t).join(''), todo = !p.runs.slice(k).some(r => r.t.trim());
    const sub = todo || /[.:]\s*$/.test(fin);
    return { ...p, runs: p.runs.map((r, i) => {
      if (!r.n) return r;
      if (i >= k || !sub) return { ...r, n: false, c: r.c || /:\s*$/.test(r.t) };
      return { ...r, n: false, c: true, t: i === k - 1 ? r.t.replace(/[.:]?\s*$/, ': ') : r.t };
    }) };
  }

  function leerHTML(html) {
    plant.innerHTML = html || '';
    const out = [];
    const inline = (nodo, n, c, runs) => { for (const x of nodo.childNodes) { if (x.nodeType === 3) { if (x.nodeValue) runs.push({ t: x.nodeValue, n, c }); } else if (x.nodeType === 1) { if (x.tagName === 'BR') runs.push({ t: ' ', n, c }); else inline(x, n || /^(STRONG|B|TH)$/.test(x.tagName), c || /^(EM|I)$/.test(x.tagName), runs); } } return runs; };
    const tabla = tb => out.push({ tabla: [...tb.querySelectorAll('tr')].map(tr => [...tr.children].map(td => inline(td, td.tagName === 'TH', false, []))) });
    const bloque = nodo => {
      let suelto = [];
      const cerrar = () => { if (suelto.some(r => r.t.trim())) out.push({ runs: suelto }); suelto = []; };
      for (const x of nodo.childNodes) {
        if (x.nodeType === 3) { suelto.push({ t: x.nodeValue, n: false, c: false }); continue; }
        if (x.nodeType !== 1) continue;
        const t = x.tagName;
        if (t === 'P') { cerrar(); const runs = inline(x, false, false, []); if (runs.some(r => r.t.trim())) out.push({ runs }); }
        else if (t === 'UL' || t === 'OL') { cerrar(); for (const li of x.children) out.push({ runs: inline(li, false, false, []), sangria: 8, vineta: true }); }
        else if (t === 'TABLE') { cerrar(); tabla(x); }
        else if (t === 'DIV' || t === 'SECTION') { cerrar(); bloque(x); }
        else inline({ childNodes: [x] }, false, false, suelto);
      }
      cerrar();
    };
    bloque(plant.content);
    return out;
  }
  // Palabras con su estilo y ancho; «pegada»: va unida a la anterior sin espacio
  const memoW = new WeakMap();
  function palabras(runs, tam) { let m = memoW.get(runs); if (!m) memoW.set(runs, m = {}); return m[tam] ||= medirPalabras(runs, tam); }
  function medirPalabras(runs, tam) {
    const ps = []; let pegada = false;
    for (const r of runs) {
      const s = limpio(r.t); if (!s) continue;
      for (const w of s.split(/( )/)) { if (w === ' ') { pegada = false; continue; } if (!w) continue; ps.push({ t: w, n: r.n, c: r.c, r: r.r, w: ancho(w, tam, r.n), pegada }); pegada = true; }
      if (/ $/.test(s)) pegada = false;
    }
    return ps;
  }
  function partir(ps, anchoMax, tam) {
    const esp = ancho(' ', tam, false), lineas = []; let l = [], w = 0;
    for (let i = 0; i < ps.length;) {
      let j = i + 1; while (j < ps.length && ps[j].pegada) j++;
      const g = ps.slice(i, j), gw = g.reduce((s, p) => s + p.w, 0);
      if (l.length && w + esp + gw > anchoMax) { lineas.push(l); l = []; w = 0; }
      w += (l.length ? esp : 0) + gw; l.push(g); i = j;
    }
    if (l.length) lineas.push(l);
    return lineas;
  }
  function pintarLinea(d, l, x, y, tam, color) {
    const esp = ancho(' ', tam, false);
    let cx = x, buf = '', est = null, bx = x;
    const soltar = () => { if (buf) d.texto(buf, bx, y, { tam, neg: est.n, cur: est.c, color: est.r ? COL.rojo : color }); buf = ''; };
    l.forEach((g, k) => g.forEach((p, q) => {
      const hueco = k > 0 && q === 0 ? esp : 0;
      if (buf && !!est.n === !!p.n && !!est.c === !!p.c && !!est.r === !!p.r) { buf += (hueco ? ' ' : '') + p.t; cx += hueco + p.w; }
      else { soltar(); cx += hueco; bx = cx; buf = p.t; est = p; cx += p.w; }
    }));
    soltar();
  }
  // Texto que fluye por varios marcos (y páginas). nuevoMarco(anterior): {x, y, w, h}
  function Flujo(d, nuevoMarco, tam) {
    let m = null, y = 0; const alto = tam * 1.2;
    const fl = {
      alto, get y() { return y; }, set y(v) { y = v; }, get m() { return m; },
      marco() { m = nuevoMarco(m); y = m.y; return m; },
      queda: () => m ? m.y + m.h - y : 0,
      sitio(h) { if (!m || fl.queda() < h) fl.marco(); },
      fondo(h, sf = 0) { d.rect(m.x - 4 - sf, y + .2, m.w + 8 + sf, h, { relleno: COL.gris, borde: false }); },
      parrafo(p, o = {}) {
        if (!m) fl.marco();
        if (p.tabla) return fl.tabla(p, o);
        const sg = p.sangria || 0;
        let ps = palabras(p.runs, tam), prim = true;
        while (ps.length) {
          const ls = partir(ps, m.w - sg, tam), caben = Math.floor(fl.queda() / alto + .001);
          if (caben < 1 || (caben === 1 && ls.length > 1 && prim)) { fl.marco(); continue; }
          const van = ls.slice(0, caben);
          van.forEach((l, i) => { if (o.fondo) fl.fondo(alto, o.sangFondo); pintarLinea(d, l, m.x + sg, y + tam * .93, tam); if (prim && i === 0 && p.vineta) d.circulo(m.x + 3, y + tam * .62, .95, { relleno: COL.rojo, borde: false }); y += alto; });
          ps = ls.slice(caben).flat(2).map((w, i) => i ? w : { ...w, pegada: false }); prim = false;
        }
      },
      tabla(p, o = {}) {
        if (!m) fl.marco();
        const n = Math.max(0, ...p.tabla.map(f => f.length)); if (!n) return;
        // Ancho de cada columna según su texto más largo (sin pasarse)
        const nat = Array.from({ length: n }, (_, k) => Math.max(12, ...p.tabla.map(f => f[k] ? palabras(f[k], tam).reduce((s, w) => s + w.w + tam * .28, 0) : 0)));
        const sep = 8, libre = m.w - sep * (n - 1); let ws = nat.slice();
        if (nat.reduce((a, b) => a + b, 0) > libre) { const lim = libre / n; let fijo = 0, resto = 0; nat.forEach(w => { if (w <= lim) fijo += w; else resto += w; }); ws = nat.map(w => w <= lim ? w : w / resto * (libre - fijo)); }
        for (const f of p.tabla) {
          const cs = f.map((c, k) => partir(palabras(c, tam), ws[k] + .5, tam)), hl = Math.max(1, ...cs.map(c => c.length));
          fl.sitio(alto * Math.min(hl, 8));
          if (o.fondo) fl.fondo(alto * hl, o.sangFondo);
          let x = m.x; cs.forEach((c, k) => { c.forEach((l, i) => pintarLinea(d, l, x, y + i * alto + tam * .93, tam)); x += ws[k] + sep; });
          y += alto * hl; d.linea(m.x, y - .4, m.x + m.w, y - .4, { g: .3, color: COL.linea });
        }
        y += 2;
      },
      // «Nombre. texto…» con el texto del SRD
      // elegido: lo que escogió el jugador, en rojo y destacado
      entrada(nombre, html, elegido, rot = 'Elegido') {
        const ps = parrafos(cas(html), true); if (!m) fl.marco();
        if (y > m.y) y += 2.5;
        const hay = ps.length && ps[0].runs, tit = { t: nombre + (hay ? '. ' : ''), n: true, c: false };
        if (hay) ps[0] = { ...ps[0], vineta: false, sangria: 0, runs: [tit, ...ps[0].runs] }; else ps.unshift({ runs: [tit] });
        fl.sitio(alto * 2);
        ps.forEach(p => fl.parrafo(p));
        if (elegido) fl.parrafo({ runs: [{ t: rot + ': ', n: true, c: false, r: true }, { t: elegido + '.', n: true, c: false }] }, { fondo: true });
      }
    };
    return fl;
  }
  // Texto corto dentro de una caja: baja el tamaño hasta que quepa; si no cabe, avisa
  function caja(d, texto, x, y, w, h, o = {}) {
    const pars = (Array.isArray(texto) ? texto : String(texto || '').split('\n')).map(t => typeof t === 'string' ? [T(t)] : t).filter(r => r.some(a => String(a.t).trim()));
    let tam = o.tam || 8, ls;
    for (; ; tam -= .25) { ls = pars.map(p => partir(palabras(p, tam), w, tam)); if (ls.reduce((s, l) => s + l.length, 0) * tam * 1.2 + (pars.length - 1) * (o.sep || 0) <= h || tam <= (o.min || 5.5)) break; }
    let cy = y; const fin = y + h;
    for (const p of ls) { for (const l of p) { if (cy + tam * 1.2 > fin + 1) { d.texto('(sigue en la app)', x + w, fin + 2, { tam: 5, al: 'd', cur: true, color: COL.suave }); return cy; } pintarLinea(d, l, x, cy + tam * .95, tam); cy += tam * 1.2; } cy += o.sep || 0; }
    return cy;
  }
  const N = t => ({ t, n: true, c: false }), T = t => ({ t, n: false, c: false });

  // Metros a casillas (1 casilla = 1,5 m). Lo que no da casillas exactas se queda en metros
  const cas = s => {
    const num = t => parseFloat(String(t).replace(',', '.')), ex = t => num(t) >= 1.5 && num(t) % 1.5 === 0, q = t => num(t) / 1.5, u = t => q(t) + (q(t) === 1 ? ' casilla' : ' casillas');
    return String(s ?? '')
      .replace(/(\d+(?:,\d+)?)\/(\d+(?:,\d+)?) m(?![\wáéíóúñ²³])/g, (m, a, b) => ex(a) && ex(b) ? q(a) + '/' + u(b) : m)
      .replace(/(\d+(?:,\d+)?)( m)? (por|y|a|o) (\d+(?:,\d+)?) m(?![\wáéíóúñ²³])/g, (m, a, x, y, b) => ex(a) && ex(b) ? `${x ? u(a) : q(a)} ${y} ${u(b)}` : m.replace(/ m\b/g, '\u0001m'))
      .replace(/(\d+(?:,\d+)?) m(?![\wáéíóúñ²³])/g, (m, a) => ex(a) ? u(a) : m).replace(/\u0001m/g, ' m').replace(/cada 1 casilla/g, 'cada casilla');
  };
  const listaMagia = m => (LISTAS_MAGIA.find(x => x[0] === m.lista) || ['', ''])[1].toLowerCase();
  // ---------- Cálculos ----------
  const APTITUD = { bardo: 'car', brujo: 'car', clerigo: 'sab', druida: 'sab', explorador: 'sab', hechicero: 'car', mago: 'int', paladin: 'car' };
  function sabeUsar(a, txt) {
    const t = norm(txt || '');
    if (a.categoria === 'sencilla') return /sencillas/.test(t);
    const m = t.match(/marciales(.*)$/); if (!m) return false;
    if (!/que tengan|propiedad/.test(m[1])) return true;
    const pr = norm(a.propiedades);
    return (/liger/.test(m[1]) && /liger/.test(pr)) || (/sutil/.test(m[1]) && /sutil/.test(pr));
  }
  function ataquesPJ(pj) {
    const h = inventarioPJ(pj), c = clasePJ(pj), n = pj.nivel || 1, bc = bcDeNivel(n), md = k => modDe(pj[k] ?? 10), out = [];
    const dotes = (h.dotes || []).map(x => x.id), arm = ARMADURAS.find(a => a.id === h.armadura), monje = c.id === 'monje' && !arm && !h.escudo;
    const dadoMonje = n >= 17 ? 12 : n >= 11 ? 10 : n >= 5 ? 8 : 6;
    const fmt = (dado, mod) => dado + (mod ? (mod > 0 ? '+' : '−') + Math.abs(mod) : '');
    for (const it of h.inventario) {
      // El nombre del arma, con lo que se le haya añadido detrás («Daga +1», «Espada larga de plata»)
      const ni = norm(it.n).trim(), a = (CR.armas || []).filter(x => ni === norm(x.nombre) || ni === norm(x.nombre) + 's' || ni.startsWith(norm(x.nombre) + ' ')).sort((x, y) => y.nombre.length - x.nombre.length)[0]; if (!a) continue;
      const mas = +(ni.match(/\+\s?([123])\b/) || [0, 0])[1];
      const pr = norm(a.propiedades), sutil = /sutil/.test(pr);
      const deMonje = monje && a.tipo === 'cac' && (a.categoria === 'sencilla' || /liger/.test(pr));
      const mod = sutil || deMonje ? Math.max(md('fue'), md('des')) : a.tipo === 'distancia' ? md('des') : md('fue');
      const comp = sabeUsar(a, h.armas || c.armas);
      const bono = mod + mas + (comp ? bc : 0) + (a.tipo === 'distancia' && dotes.includes('tiro-con-arco') ? 2 : 0);
      let [dado, ...tipo] = a.dano.split(' ');
      if (deMonje && +(dado.split('d')[1] || 0) < dadoMonje) dado = '1d' + dadoMonje;
      const notas = [];
      if (a.propiedades && a.propiedades !== '—') notas.push(cas(a.propiedades.replace('alcance ', '').replace(/([\d,]+)\/(\d+)/, '$1/$2 m')));
      if ((h.maestria || []).includes(a.nombre)) notas.push('Maestría: ' + a.maestria);
      if (/pesad/.test(pr) && (pj[a.tipo === 'cac' ? 'fue' : 'des'] ?? 10) < 13) notas.push('desventaja (' + (a.tipo === 'cac' ? 'Fue' : 'Des') + ' < 13)');
      if (!comp) notas.push('sin competencia');
      out.push({ nombre: (ni === norm(a.nombre) + 's' ? a.nombre : it.n) + (it.c > 1 ? ` (${it.c})` : ''), bono: signo(bono), dano: `${fmt(dado, mod + mas)} ${tipo.join(' ')}`, notas: notas.join(' · ') });
    }
    const modD = monje ? Math.max(md('fue'), md('des')) : md('fue');
    out.push({ nombre: 'Ataque sin armas', bono: signo(modD + bc), dano: monje ? `${fmt('1d' + dadoMonje, modD)} contundente` : `${Math.max(0, 1 + modD)} contundente`, notas: monje ? 'Artes marciales' : 'O bien agarrar o empujar' });
    // Trucos que hacen daño
    const esc5 = n >= 17 ? 4 : n >= 11 ? 3 : n >= 5 ? 2 : 1;
    for (const id of pj.conjuros || []) {
      const s = CONJ.get(id); if (!s || s.nivel) continue;
      const t = s.html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
      const ataque = /ataque de conjuro/.test(t), m = t.match(/(\d)d(\d+) de daño ((?:de )?[a-záéíóú]+)/); if (!m) continue;
      const ts = t.match(/tirada de salvación de (Fuerza|Destreza|Constitución|Inteligencia|Sabiduría|Carisma)/); if (!ataque && !ts) continue;
      const ap = aptitudDe(pj, id); if (!ap) continue;
      const rayos = id === 'descarga-sobrenatural', tipo = m[3] === 'del' ? 'a elegir' : m[3].replace(/^de /, '');
      const agon = rayos && (h.invocaciones || []).includes('descarga-agonica') ? md(ap) : 0;
      out.push({ nombre: s.nombre, bono: ataque ? signo(bc + md(ap)) : `CD ${8 + bc + md(ap)}`, dano: `${fmt((rayos ? 1 : esc5) + 'd' + m[2], agon)} ${tipo}`, notas: ['Truco', ataque ? '' : 'TS de ' + ts[1], cas(s.alcance), rayos && esc5 > 1 ? esc5 + ' rayos' : ''].filter(Boolean).join(' · ') });
    }
    return out;
  }
  // Aptitud mágica con la que lanza un conjuro (dote Iniciado en la magia, linaje o clase)
  function aptitudDe(pj, id) {
    const h = pj.hoja, m = (h.magia || []).find(x => [...(x.trucos || []), ...(x.conjuros || [])].includes(id));
    if (m) return m.apt;
    if ((h.conjEspecie || []).includes(id) && h.aptitud) return h.aptitud;
    return APTITUD[h.clase] || h.aptitud || ((h.magia || [])[0] || {}).apt || null;
  }

  // ---------- Páginas ----------
  function hojaPDF(pj) {
    ponerSiempreClase(pj);
    const d = Doc(), h = inventarioPJ(pj), c = clasePJ(pj), n = pj.nivel || 1, bc = bcDeNivel(n), md = k => modDe(pj[k] ?? 10);
    const e = CR.especies.find(x => x.id === h.especie), t = CR.trasfondos.find(x => x.id === h.trasfondo), l = e && e.linaje && e.linaje.opciones.find(o => o.id === h.linaje);
    const alin = CR.alineamientos.find(a => a.abr === h.alineamiento), salv = pj.salvComp || [], habs = habilidadesPJ(pj), cal = caPJ(pj);
    const v = velocidadPJ(pj, (l && l.velocidad) || (e && e.velocidad) || 9);
    const ini = (pj.iniDes !== false ? md('des') : 0) + (pj.iniBC ? bc : 0) + (pj.iniExtra || 0);
    const dotes = (h.dotes || []).map(x => ({ ...x, srd: CR.dotes.find(y => y.id === x.id) })).filter(x => x.id !== 'mejora-de-caracteristica');
    const conj = [...new Set(pj.conjuros || [])].map(i => CONJ.get(i)).filter(Boolean).sort(ordenConj);
    const linTxt = l ? l.nombre.replace(/\s*\(.*\)$/, '') : '';
    const rec = pj.recursos || [];

    const nueva = () => { d.pagina(); if (d.pags.length > 1) d.texto(pj.nombre || '', M + 2, 43, { tam: 13, neg: true, max: 172 }); d.texto('Incluye material del SRD 5.2.1 de Wizards of the Coast LLC, con licencia CC BY 4.0.', M, 830, { tam: 5.5, color: COL.suave }); d.texto(`${pj.nombre || 'Personaje'} · página ${d.pags.length}`, W - M, 830, { tam: 5.5, color: COL.suave, al: 'd' }); };
    // Dato con su rótulo debajo de una línea
    const dato = (val, rot, x, y, w, o = {}) => { d.texto(val || '', x + 2, y, { tam: o.tam || 11, max: w - 4, min: 6 }); d.linea(x, y + 3.5, x + w, y + 3.5, { g: .7 }); d.texto(rot, x + 1, y + 11, { tam: 5.8, color: COL.suave }); };
    const rotulo = (txt, cx, y, o = {}) => d.texto(txt, cx, y, { tam: o.tam || 6.6, neg: true, al: 'c', color: COL.rojo, max: o.max });
    const marcoTit = (tit, x, y, w, hh) => { d.rect(x, y, w, hh, { r: 6, relleno: COL.blanco }); rotulo(tit, x + w / 2, y + 11, { max: w - 10 }); d.linea(x + 5, y + 15, x + w - 5, y + 15, { g: .6 }); };
    const util = { c, h, n, bc, md, nueva, rotulo, dato };

    // ===== Página 1 =====
    nueva();
    // Cabecera
    d.rect(M, 28, 132, 74, { r: 8, relleno: COL.gris, borde: false });
    d20(d, M + 27, 65, 19);
    d.texto('HOJA DE', M + 54, 62, { tam: 11, neg: true, color: COL.rojo }); d.texto('PERSONAJE', M + 54, 75, { tam: 11, neg: true, color: COL.rojo });
    d.rect(168, 28, 374, 74, { r: 9, relleno: COL.blanco });
    dato(pj.nombre, 'NOMBRE DEL PERSONAJE', 176, 49, 140, { tam: 13 }); dato((e ? e.nombre : '') + (linTxt ? ` (${linTxt})` : ''), 'ESPECIE', 324, 49, 94); dato(t ? t.nombre : '', 'TRASFONDO', 426, 49, 88);
    dato(`${c.nombre}${n >= 3 && c.subclase ? ` (${c.subclase.nombre})` : ''}`, n >= 3 ? 'CLASE Y SUBCLASE' : 'CLASE', 176, 83, 140); dato(alin ? alin.nombre : '', 'ALINEAMIENTO', 324, 83, 94); dato(pj.jugador, 'JUGADOR', 426, 83, 88);
    d.rect(521, 33, 46, 64, { r: 23, relleno: COL.blanco, g: 1.4 });
    d.texto(String(n), 544, 69, { tam: 22, neg: true, al: 'c' }); d.linea(531, 75, 557, 75); rotulo('NIVEL', 544, 84, { tam: 6.2 });
    // Fila de datos
    const fila = [['BONO COMPETENCIA', signo(bc)], ['INSPIRACIÓN HEROICA', null], ['INICIATIVA', signo(ini)], ['VELOCIDAD', `${String(Math.round(v.total / 1.5 * 10) / 10).replace('.', ',')} casillas`], ['TAMAÑO', h.tamano || ''], ['PERCEPCIÓN PASIVA', String(pasivaPJ(pj))]];
    const fw = (539 - 5 * 7) / 6;
    fila.forEach(([rot, val, sub], i) => { const x = M + i * (fw + 7); d.rect(x, 111, fw, 41, { r: 6, relleno: COL.blanco }); rotulo(rot, x + fw / 2, 121, { tam: 6, max: fw - 6 }); d.linea(x + 4, 125, x + fw - 4, 125, { g: .5 }); if (val === null) d.circulo(x + fw / 2, 138.5, 5.5, { g: 1 }); else { d.texto(val, x + fw / 2, sub ? 138.5 : 143, { tam: 12.5, al: 'c', max: fw - 8 }); if (sub) d.texto(sub, x + fw / 2, 148, { tam: 5.6, al: 'c', color: COL.suave, max: fw - 6 }); } });
    // Características
    [['fue', 'int'], ['des', 'sab'], ['con', 'car']].forEach((par, fi) => par.forEach((k, q) => {
      const x = M + q * 93, y = 161 + fi * 92, w = 87, hh = 85;
      d.rect(x, y, w, hh, { r: 5, relleno: COL.blanco }); rotulo(CAR_NOMBRE[k].toUpperCase(), x + w / 2, y + 11);
      d.rect(x + 36, y + 22, 43, 24, { r: 5, relleno: COL.blanco }); d.texto(String(pj[k] ?? 10), x + 64, y + 38.5, { tam: 12, al: 'c' }); d.texto('PUNT.', x + 64, y + 54, { tam: 5.2, al: 'c', color: COL.suave });
      d.circulo(x + 29, y + 36, 19, { relleno: COL.blanco, g: 1.4 }); d.texto(signo(md(k)), x + 28.5, y + 42.5, { tam: 18, neg: true, al: 'c' }); d.texto('MODIFICADOR', x + 29, y + 63, { tam: 5.2, al: 'c', color: COL.suave });
      d.linea(x + 4, y + 67, x + w - 4, y + 67, { g: .6 });
      d.punto(x + 13, y + 76, 3, salv.includes(k)); d.texto(signo(md(k) + (salv.includes(k) ? bc : 0)), x + 21, y + 79, { tam: 9, neg: true }); d.texto('Salvación', x + 41, y + 78.6, { tam: 7 });
    }));
    // Habilidades
    marcoTit('HABILIDADES', M, 439, 180, 168);
    habs.forEach((s, i) => { const x = M + 9 + (i < 9 ? 0 : 1) * 89, y = 464 + (i % 9) * 15.6; d.punto(x, y - 2.6, 2.6, s.comp, s.pericia); d.texto(signo(s.total), x + 15, y, { tam: 8, neg: true, al: 'c' }); d.texto(s.nombre, x + 24, y, { tam: 6.8, max: 55, min: 5, neg: s.pericia }); });
    d.punto(M + 34, 601, 2.6, true); d.texto('Competente', M + 40, 603, { tam: 5.6, color: COL.suave }); d.punto(M + 96, 601, 2.6, true, true); d.texto('Pericia (doble)', M + 103, 603, { tam: 5.6, color: COL.suave });
    // Competencias
    marcoTit('COMPETENCIAS E IDIOMAS', M, 615, 180, 203);
    const sinPref = (s, re) => { const t2 = String(s || '').replace(re, ''); return t2.charAt(0).toUpperCase() + t2.slice(1); };
    const porGrupo = {}; (h.herramientas || []).forEach(x => { const m = String(x).match(/^(Instrumento musical|Juego): (.+)$/i); (porGrupo[m ? m[1] : ''] ||= []).push(m ? m[2] : x); });
    const herr = Object.entries(porGrupo).map(([g, l2]) => g ? (l2.length > 1 ? { 'Instrumento musical': 'Instrumentos musicales', Juego: 'Juegos' }[g] || g : g) + ': ' + l2.join(', ') : l2.join(', ')).join('; ');
    const maes = (h.maestria || []).map(x => `${x} (${(CR.armas.find(a => a.nombre === x) || {}).maestria || ''})`).join(', ');
    caja(d, [[N('Armaduras: '), T(sinPref(h.armaduras || c.armaduras, /^armaduras /i))], [N('Armas: '), T(sinPref(h.armas || c.armas, /^armas /i))], (h.herramientas || []).length && [N('Herramientas: '), T(herr)], [N('Idiomas: '), T((h.idiomas || []).join(', '))], maes && [N('Maestría con armas: '), T(maes)]].filter(Boolean), M + 8, 635, 164, 176, { tam: 8, sep: 4 });
    // CA y puntos de golpe
    const X2 = 217, A2 = 350;
    d.escudo(X2 + 2, 161, 56, 84); rotulo('CLASE DE', X2 + 30, 174, { tam: 5.8 }); rotulo('ARMADURA', X2 + 30, 181, { tam: 5.8 }); d.texto(String(cal.total), X2 + 30, 208, { tam: 22, neg: true, al: 'c' }); d.linea(X2 + 14, 214, X2 + 46, 214, { g: .5 }); d.texto('ESCUDO', X2 + 30, 221, { tam: 5.2, al: 'c', color: COL.suave }); d.punto(X2 + 30, 228, 3, !!h.escudo);
    d.rect(X2 + 66, 161, A2 - 66, 84, { r: 8, relleno: COL.blanco });
    const px = X2 + 66; rotulo('PUNTOS DE GOLPE', px + 58, 172); dato('', 'ACTUALES', px + 8, 192, 100); dato(String(pj.pgMax ?? ''), 'MÁXIMOS', px + 8, 225, 46, { tam: 13 }); dato('', 'TEMPORALES', px + 62, 225, 46);
    d.linea(px + 116, 166, px + 116, 240, { g: .5, color: COL.linea });
    rotulo('DADOS DE GOLPE', px + 161, 172); dato('', 'GASTADOS', px + 124, 192, 74); dato(`${n}d${dadoGolpe(c)}`, 'TOTALES', px + 124, 225, 74, { tam: 13 });
    d.linea(px + 206, 166, px + 206, 240, { g: .5, color: COL.linea });
    const cx0 = px + 212; rotulo('CANSANCIO', px + 245, 172, { tam: 6 }); for (let i = 0; i < 6; i++) { d.circulo(cx0 + 4 + i * 12, 182, 3.4, { g: .9 }); d.texto(i < 5 ? '−' + (i + 1) * 2 : '†', cx0 + 4 + i * 12, 192, { tam: 4.6, al: 'c', color: COL.suave }); }
    d.linea(px + 211, 197, px + 279, 197, { g: .5 }); rotulo('SALV. DE MUERTE', px + 245, 206, { tam: 6 });
    [['ÉXITOS', 217], ['FALLOS', 231]].forEach(([r, y]) => { d.texto(r, cx0, y + 2, { tam: 5.6, color: COL.suave }); for (let i = 0; i < 3; i++) d.circulo(cx0 + 36 + i * 12, y, 3.4, { g: .9 }); });
    // Ataques
    // El cuadro crece con los ataques que tenga (con una fila libre); equipo y notas se quedan con el resto de la página
    const ats = ataquesPJ(pj), yA = 254, nF = Math.max(5, ats.length + (ats.length < 10 ? 1 : 0)), hf = Math.max(13.5, Math.min(21.5, (h.inventario.length > 26 ? 220 : 285) / nF)), hA = 29 + nF * hf; marcoTit('ATAQUES Y TRUCOS DE DAÑO', X2, yA, A2, hA);
    [[6, 'Nombre'], [98, 'Bonif.'], [136, 'Daño / Tipo'], [218, 'Notas']].forEach(([x, r]) => d.texto(r, X2 + x, yA + 24, { tam: 6, neg: true, color: COL.suave }));
    for (let i = 0; i < nF; i++) {
      const y = yA + 28 + i * hf; d.linea(X2 + 5, y, X2 + A2 - 5, y, { g: .4, color: COL.linea });
      const a = ats[i]; if (!a) continue; const by = y + hf / 2 + 2.8;
      d.texto(a.nombre, X2 + 6, by, { tam: 8, neg: true, max: 88 }); d.texto(a.bono, X2 + 98, by, { tam: 8, max: 34 }); d.texto(a.dano, X2 + 136, by, { tam: 7.6, max: 78 });
      let tn = 5.8, ln; do { ln = partir(palabras([T(a.notas)], tn), 126, tn); tn -= .2; } while (ln.length > 2 && tn > 4.4); tn += .2;
      ln.slice(0, 2).forEach((li, k) => pintarLinea(d, li, X2 + 218, y + hf / 2 + (ln.length > 1 ? (k ? tn : -.6) : 2), tn, COL.suave));
    }
    [95, 133, 215].forEach(x => d.linea(X2 + x, yA + 18, X2 + x, yA + hA - 4, { g: .3, color: COL.linea }));
    // Equipo
    const yE = yA + hA + 9, hE = 818 - yE, items = h.inventario.map(it => (it.c > 1 ? it.c + ' × ' : '') + it.n);
    const pintarEquipo = (x, w, hh, cols) => {
      marcoTit('EQUIPO', x, yE, w, hh);
      const por = Math.ceil(items.length / cols) || 1, cw = (w - 16 - (cols - 1) * 8) / cols; let te = 8; while (te > 5 && por * (te * 1.2 + 1.5) > hh - 70) te -= .25;
      for (let k = 0; k < cols; k++) caja(d, items.slice(k * por, (k + 1) * por).map(s => [T(s)]), x + 8 + k * (cw + 8), yE + 20, cw, hh - 66, { tam: te, min: 5, sep: 1.5 });
      const ym = yE + hh - 45; d.linea(x + 5, ym, x + w - 5, ym, { g: .6 }); rotulo('DINERO', x + w / 2, ym + 9, { tam: 6 });
      MONEDAS.forEach(([k], i) => { const mw = (w - 16 - 12) / 5, mx = x + 8 + i * (mw + 3); d.rect(mx, ym + 13, mw, 18, { r: 3, g: .8, relleno: COL.blanco }); d.texto(String(h.monedas[k] || 0), mx + mw / 2, ym + 25.5, { tam: 9, al: 'c', max: mw - 4 }); d.texto(k.toUpperCase(), mx + mw / 2, ym + 39, { tam: 5.6, al: 'c', color: COL.suave }); });
    };
    const pintarRecursos = (x, y, w, hh) => {
      marcoTit('RECURSOS (USOS)', x, y, w, hh);
      const DES = { corto: 'd. corto o largo', largo: 'd. largo', uno: 'd. corto 1 · largo todos' }, paso = Math.min(21, (hh - 24) / rec.length);
      rec.forEach((r, i) => {
        const yy = y + 25 + i * paso, de = DES[reglaRecurso(r, pj)] || '', wd = de ? ancho(limpio(de), 5.2, false) : 0;
        d.texto(r.nombre, x + 8, yy, { tam: 7, neg: true, max: w - 20 - wd }); d.texto(de, x + w - 7, yy, { tam: 5.2, al: 'd', color: COL.suave });
        if (r.max <= 13) for (let k = 0; k < r.max; k++) d.circulo(x + 12 + k * 11.5, yy + paso * .38, Math.min(3.6, paso * .18), { g: .9 }); else d.texto(`______ / ${r.max}`, x + 8, yy + 11, { tam: 8 });
      });
    };
    const pintarNotas = (x, y, w, hh) => { if (hh < 40) return; marcoTit('NOTAS DE PARTIDA', x, y, w, hh); for (let k = y + 34; k < y + hh - 6; k += 17) d.linea(x + 8, k, x + w - 8, k, { g: .3, color: COL.linea }); };
    const wE = 171, x3 = X2 + wE + 8, w3 = A2 - wE - 8, hRec = rec.length ? 24 + rec.length * 21 : 0;
    if (items.length * 9.9 <= hE - 70) {
      const hr = Math.min(hRec, hE); pintarEquipo(X2, wE, hE, 1); if (hr) pintarRecursos(x3, yE, w3, hr); pintarNotas(x3, yE + (hr ? hr + 8 : 0), w3, hE - (hr ? hr + 8 : 0));
    } else {
      // Mucho equipo: cuadro ancho a dos columnas, y debajo recursos y notas
      const cols = items.length > 30 ? 3 : 2, hEq = Math.min(hE - Math.max(hRec, 60) - 8, Math.ceil(items.length / cols) * 11.1 + 74), y2 = yE + hEq + 8, h2 = hE - hEq - 8;
      pintarEquipo(X2, A2, hEq, cols); if (hRec) { pintarRecursos(X2, y2, wE, h2); pintarNotas(x3, y2, w3, h2); } else pintarNotas(X2, y2, A2, h2);
    }
    const rasgos = rasgosHasta(c, n).filter(r => !/^(Mejora de característica|Subclase de|Don épico)/.test(r.nombre));
    const invocs = (h.invocaciones || []).map(i => (CR.invocaciones || []).find(x => x.id === i)).filter(Boolean), metas = (h.metamagia || []).map(i => (CR.metamagia || []).find(x => x.id === i)).filter(Boolean);
    const orden1 = ORDENES[c.id] && ORDENES[c.id].ops.find(o => o[0] === h.ordenClase);

    // ===== Página 2: personaje y rasgos explicados =====
    nueva();
    const yP = 52, wR = 152, xA = M + wR + 8, wA = 539 - wR - 8, TX = 8.5;
    const largo = (txt, w) => String(txt || '').split('\n').filter(x => x.trim()).reduce((s, x) => s + partir(palabras([T(x)], TX), w, TX).length * TX * 1.2, 0);
    const hP = Math.min(520, Math.max(208, largo(h.descripcion, wA - 16) + 30));
    marcoTit('RETRATO', M, yP, wR, 208); if (h.retrato) d.foto(h.retrato, M + 6, yP + 20, wR - 12, 182);
    marcoTit('APARIENCIA', xA, yP, wA, hP); caja(d, h.descripcion || '', xA + 8, yP + 20, wA - 16, hP - 26, { tam: TX });
    // La historia ocupa todo el ancho y tan larga como sea su texto (aunque pase de página); lo siguiente empieza donde acabe
    const histo = String(h.personalidad || '').split('\n').filter(x => x.trim());
    const secHisto = { tit: 'HISTORIA Y PERSONALIDAD', una: true, tam: TX, pars: histo.map(x => ({ runs: [T(x)] })), alto: histo.length ? 0 : 110 };
    // Los rasgos explicados: especie, clase y dotes, cada uno en su cuadro. Si no caben, siguen en otra página
    const secs = [secHisto];
    const lista = l => l.length > 1 ? l.slice(0, -1).join(', ') + (/^h?[ií]/i.test(l[l.length - 1]) ? ' e ' : ' y ') + l[l.length - 1] : l[0] || '', tiene = i => (pj.conjuros || []).includes(i), nomC = ids => lista((ids || []).filter(tiene).map(i => (CONJ.get(i) || {}).nombre || i));
    const el = h.elecciones || {}, estilo = dotes.filter(x => x.srd && x.srd.categoria === 'estilo-de-combate');
    const eligEspecie = r => /^(Diestro|Sentidos agudos)/.test(r.nombre) ? el.habEspecie : /^Versátil/.test(r.nombre) ? lista(dotes.filter(x => x.origen === 'especie').map(x => x.nombre)) : /^Visión en la oscuridad/.test(r.nombre) && l && l.vision && l.vision !== e.vision ? cas(`${l.vision} m`) + " por su linaje" : '';
    // Textos cortos: solo lo que sirve para jugar y hasta su nivel (hoja-textos.js). Sin texto ni elección, el rasgo no sale
    const TX2 = window.HOJA_TXT, corto = (html, nombre, tipo) => TX2 ? TX2.textoCorto(html, { nombre, tipo, clase: c.id, n, pj }) : html, util2 = x => x[1] !== null && (String(x[1]).trim() || x[2]);
    if (e) secs.push({ tit: `ATRIBUTOS DE ESPECIE · ${e.nombre.toUpperCase()}`, ent: e.rasgos.map(r => l && r.nombre === e.linaje.rasgo ? [r.nombre, TX2 && TX2.linajeCorto(l, n) || corto(detalleLinaje(e, l), r.nombre, 'especie'), l.nombre + (h.aptitud ? ` · aptitud mágica: ${CAR_NOMBRE[h.aptitud]}` : '')] : [r.nombre, corto(r.html, r.nombre, 'especie'), eligEspecie(r)]).filter(util2) });
    const autoC = conjSiempre(c.id, n, h), nomDe = de => lista(autoC.filter(x => x.origen === de && tiene(x.id)).map(x => (CONJ.get(x.id) || {}).nombre || x.id));
    const eligClase = r => /^Maestría con armas/.test(r.nombre) ? maes : /^Estilo de combate/.test(r.nombre) ? lista(estilo.map(x => x.nombre)) : r.nombre === 'Explorador hábil' ? lista((h.pericia || []).slice(0, 1)) : r.nombre === 'Pericia' ? lista((h.pericia || []).slice(c.id === 'explorador' ? 1 : 0)) : r.nombre === 'Académico' ? lista(h.pericia || [])
      : /^Conjuros del c[ií]rculo/i.test(r.nombre) ? h.terreno ? `${(TERRENOS_DRUIDA[h.terreno] || {}).nombre}: ${nomDe('terreno')}` : '' : r.de === 'subclase' && /^Conjuros (del|dracónicos)/.test(r.nombre) ? nomDe('subclase')
      : r.nombre === 'Descubrimientos mágicos' ? nomC((h.conjSiempre || []).filter(i => !autoC.some(x => x.id === i))) : /^Arcanum/.test(r.nombre) ? nomC(h.arcanum) : r.nombre === 'Maestría sobre conjuros' ? nomC(h.maestriaConj) : r.nombre === 'Conjuros característicos' ? nomC(h.caracteristicos) : '';
    // Qué hace cada propiedad de maestría de sus armas
    const txtMaes = [...new Set((h.maestria || []).map(x => (CR.armas.find(a => a.nombre === x) || {}).maestria).filter(Boolean))].map(m => { const d2 = (CR.maestrias || []).find(x => norm(x.nombre) === norm(m)); return d2 ? `<p><strong>${d2.nombre}. </strong>${d2.texto}</p>` : ''; }).join('');
    const nomR = rasgos.map(r => r.nombre), vistas = new Set();
    secs.push({ tit: `RASGOS DE CLASE · ${c.nombre.toUpperCase()} ${n}`, ent: [...rasgos.filter(r => !(TX2 && TX2.superado(r.nombre, nomR))).filter(r => r.nombre !== 'Pericia' || !vistas.has('Pericia') && vistas.add('Pericia')).map(r => orden1 && r.nombre === ORDENES[c.id].rasgo ? [r.nombre, corto(detalleOrden(c, orden1[1]), r.nombre, 'clase'), orden1[1]]
        : [r.nombre + (r.de === 'subclase' ? ` (${c.subclase.nombre})` : ''), corto(r.html, r.nombre, 'clase') + (r.nombre === 'Maestría con armas' ? txtMaes : ''), eligClase(r), r.de === 'subclase' && /^Conjuros (del|dracónicos)/.test(r.nombre) && !/c[ií]rculo/.test(r.nombre) ? `A nivel ${n}` : /^(Explorador hábil|Académico)$/.test(r.nombre) ? 'Pericia en' : 'Elegido']),
      ...[...new Set(invocs)].map(x => { const v = invocs.filter(y => y === x).length; return [`Invocación: ${x.nombre}${v > 1 ? ` (×${v}, con trucos distintos)` : ''}`, corto(x.html, x.nombre, 'invocacion')]; }), ...metas.map(x => [`Metamagia: ${x.nombre} (${x.coste})`, corto(x.html, x.nombre, 'metamagia')])].filter(util2) });
    // En las dotes se dice lo que se eligió con cada una
    const magias = (h.magia || []).slice();
    const eligDote = x => {
      if (x.id === 'iniciado-en-la-magia') { const m = magias.shift(); return m ? `lista de ${listaMagia(m)} · aptitud mágica: ${CAR_NOMBRE[m.apt]} · trucos: ${nomC(m.trucos)} · conjuro de nivel 1, siempre preparado: ${nomC(m.conjuros)}` : ''; }
      const y = x.elige || (x.id === 'habilidoso' && x.origen === 'especie' ? { hab: el.habDote, herr: el.herrDote } : {});
      return [y.car && `+1 a ${CAR_NOMBRE[y.car]}`, lista([...(y.hab || []), ...(y.herr || [])])].filter(Boolean).join(' · ');
    };
    const deDonde = o => o === 'trasfondo' ? `trasfondo: ${t ? t.nombre : ''}` : o === 'especie' ? `especie: ${e ? e.nombre : ''}` : o ? String(o) : '';
    if (dotes.length) secs.push({ tit: 'DOTES', ent: dotes.map(x => [(x.srd ? x.srd.nombre : x.nombre) + (deDonde(x.origen) ? ` (${deDonde(x.origen)})` : ''), corto(x.srd ? x.srd.html : '', x.srd ? x.srd.nombre : x.nombre, 'dote'), eligDote(x)]) });
    cuadros(d, secs, yP + hP + 8, nueva);

    // ===== Página de conjuros =====
    if (conj.length) paginaConjuros(d, pj, conj, util);
    const nombre = `${(pj.nombre || 'personaje').replace(/[\\/:*?"<>|]+/g, '').trim()} - nivel ${n}.pdf`;
    return { bytes: d.bytes(`${pj.nombre || 'Personaje'} - hoja de personaje`), nombre, paginas: d.pags.length };
  }
  // Dado de veinte caras sencillo (dibujo propio de la app)
  function d20(d, cx, cy, r) {
    const pto = (g, rr) => { const a = Math.PI / 180 * g; return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]; };
    const p = k => pto(60 * k - 90, r), q = k => pto(120 * k - 90, r * .58), o = { color: COL.rojo, g: 1.2 };
    for (let k = 0; k < 6; k++) d.linea(...p(k), ...p(k + 1), o);
    for (let k = 0; k < 3; k++) { d.linea(...q(k), ...q(k + 1), o); d.linea(...q(k), ...p(2 * k), o); d.linea(...q(k), ...p(2 * k + 1), o); d.linea(...q(k), ...p(2 * k + 5), o); }
    d.texto('20', cx, cy + 3, { tam: 8, neg: true, al: 'c', color: COL.rojo });
  }
  // Cuadros a todo el ancho con el texto en dos columnas; crecen lo justo y saltan de página si hace falta
  function cuadros(d, secs, y0, nueva) {
    const AN = 539, FIN = 818, ARRIBA = 52, HUECO = 7, colsDe = s => s.una ? 1 : 2, wDe = s => s.una ? AN - 16 : (AN - 16 - 18) / 2;
    const pintar = (fl, s) => { if (s.pars) s.pars.forEach((p, i) => { if (i) fl.y += 2; fl.parrafo(p); }); else s.ent.forEach(x => fl.entrada(...x)); };
    // alturas(p) = alto útil de las columnas en la página p; devuelve cuántas columnas usa
    const simular = (s, tam, alturas) => { const dm = Doc(), nc = colsDe(s); dm.pagina(); let k = -1; const fl = Flujo(dm, () => { k++; return { x: 0, y: 0, w: wDe(s), h: alturas(Math.floor(k / nc)) }; }, tam); fl.marco(); pintar(fl, s); return k + 1; };
    const plan = (s, tam, cy) => {
      const nc = colsDe(s), salta = FIN - cy < (s.alto ? s.alto + 24 : 70), prim = (salta ? FIN - ARRIBA : FIN - cy) - 24, llena = FIN - ARRIBA - 24, de = p => p ? llena : prim;
      const pags = Math.ceil(simular(s, tam, de) / nc);
      let lo = tam * 1.2, hi = de(pags - 1); const cabe = h => simular(s, tam, p => p === pags - 1 ? h : de(p)) <= pags * nc;
      while (hi - lo > 2) { const m = (lo + hi) / 2; if (m >= tam * 1.25 && cabe(m)) hi = m; else lo = m; }
      hi = Math.max(hi, s.alto || 0);
      return { salta, pags, alturas: p => p === pags - 1 ? hi : de(p), ult: hi };
    };
    // La letra más grande de las que gastan menos páginas
    const paginas = tam => { let cy = y0, n = 1; for (const s of secs) { const p = plan(s, s.tam || tam, cy); if (p.salta) { n++; cy = ARRIBA; } if (p.pags > 1) { n += p.pags - 1; cy = ARRIBA; } cy += p.ult + 24 + HUECO; } return n; };
    const min = paginas(7.25); let tam = 8.25; while (tam > 7.25 && paginas(tam) > min) tam -= .25;
    let cy = y0;
    for (const s of secs) {
      const t = s.tam || tam, nc = colsDe(s), p = plan(s, t, cy); let k = -1;
      if (p.salta) { nueva(); cy = ARRIBA; }
      const fl = Flujo(d, () => {
        k++; const h = p.alturas(Math.floor(k / nc));
        if (k % nc === 0) {
          if (k) { nueva(); cy = ARRIBA; }
          d.rect(M, cy, AN, h + 24, { r: 6 });
          d.texto(s.tit + (k ? ' (CONT.)' : ''), M + AN / 2, cy + 11, { tam: 6.6, neg: true, al: 'c', color: COL.rojo, max: AN - 12 }); d.linea(M + 5, cy + 15, M + AN - 5, cy + 15, { g: .6 });
          if (nc > 1) d.linea(M + AN / 2, cy + 20, M + AN / 2, cy + h + 20, { g: .3, color: COL.linea });
          if (s.alto) for (let y = cy + 34; y < cy + h + 18; y += 17) d.linea(M + 8, y, M + AN - 8, y, { g: .3, color: COL.linea });
        }
        return { x: M + 8 + (k % nc) * (wDe(s) + 18), y: cy + 19, w: wDe(s), h };
      }, t);
      fl.marco(); pintar(fl, s);
      cy += p.ult + 24 + HUECO;
    }
    return cy;
  }
  function paginaConjuros(d, pj, conj, { c, h, n, bc, md, nueva, rotulo, dato }) {
    nueva();
    const ap = APTITUD[c.id] || null, lanza = !!(ap && tipoLanzador(c.nombre));
    const fuentes = []; // otras aptitudes (dotes, linaje)
    (h.magia || []).forEach(m => fuentes.push([`Iniciado en la magia (${listaMagia(m)})`, m.apt]));
    if (h.aptitud && (h.conjEspecie || []).length) fuentes.push(['Linaje', h.aptitud]);
    const apP = lanza ? ap : (fuentes[0] || [])[1];
    d.rect(209, 28, 358, 64, { r: 10, relleno: COL.gris, borde: false }); d.rect(214, 33, 228, 54, { r: 8, relleno: COL.blanco });
    dato(lanza ? `${c.nombre} ${n}` : (fuentes[0] || [''])[0], lanza ? 'CLASE LANZADORA' : 'ORIGEN', 222, 58, 104); dato(apP ? CAR_NOMBRE[apP] : '', 'APTITUD MÁGICA', 334, 58, 100);
    [[448, 'CD SALVACIÓN', apP ? String(8 + bc + md(apP)) : ''], [507, 'BONIF. ATAQUE', apP ? signo(bc + md(apP)) : '']].forEach(([x, r, val]) => { d.rect(x, 33, 55, 54, { r: 8, relleno: COL.blanco }); d.texto(val, x + 27.5, 58, { tam: 18, neg: true, al: 'c' }); rotulo(r, x + 27.5, 71, { tam: 5.6, max: 51 }); rotulo('CONJUROS', x + 27.5, 78.5, { tam: 5.6 }); });
    (lanza ? fuentes : fuentes.slice(1)).slice(0, 2).forEach(([nom, k], i) => d.texto(`${nom}: ${CAR_NOMBRE[k]}, CD ${8 + bc + md(k)}, ataque ${signo(bc + md(k))}`, M + 2, 72 + i * 9, { tam: 6.4, max: 174, min: 4.6, color: COL.suave }));
    // Espacios de conjuro
    const esp = espaciosPJ(pj), pacto = pj.pacto && pj.pacto.max ? pj.pacto : null, hayEsp = !!pacto || esp.max.some(x => x > 0);
    const arc = {}; (h.arcanum || []).forEach(i => { const s = CONJ.get(i); if (s && conj.includes(s)) arc[s.nivel] = (arc[s.nivel] || 0) + 1; });
    if (hayEsp) {
    d.texto(pacto ? 'ESPACIOS DE CONJURO (MAGIA DE PACTO)' : 'ESPACIOS DE CONJURO', M + 4, 103, { tam: 6.6, neg: true, color: COL.rojo });
    d.rect(M, 107, 539, 54, { r: 10, relleno: COL.gris, borde: false });
    }
    const bw = 45, xB = i => M + 5 + i * (bw + 3.4);
    if (hayEsp) for (let i = 0; i < 9; i++) {
      const x = xB(i), a = arc[i + 1] || 0, num = pacto ? (pacto.nivel === i + 1 ? pacto.max : a) : esp.max[i] || 0;
      d.rect(x, 111, bw, 46, { r: 7, relleno: COL.blanco }); rotulo('NIVEL ' + (i + 1), x + bw / 2, 121, { tam: 6 });
      if (num) { if (pacto && a) d.texto('Arcanum', x + bw / 2, 136, { tam: 7.5, neg: true, al: 'c' }); else d.texto(String(num), x + bw / 2, 138, { tam: 13, neg: true, al: 'c' }); const sep = Math.min(10, 38 / num); for (let k = 0; k < num; k++) d.circulo(x + bw / 2 + (k - (num - 1) / 2) * sep, 149, Math.min(3.8, sep * .4), { g: .9 }); }
    }
    const prep = lanza ? TABLA(c.id, 'preparados', n) : 0, tr = conj.filter(x => !x.nivel).length;
    if (hayEsp) [['PREPARADOS', prep ? String(prep) : ''], ['TRUCOS', String(tr)]].forEach(([r, val], k) => { const x = xB(9) + k * 48.4 + .4; d.rect(x, 111, 45, 46, { r: 7, relleno: COL.blanco }); rotulo(r, x + 22.5, 121, { tam: 5.8, max: 41 }); d.texto(val, x + 22.5, 144, { tam: 15, neg: true, al: 'c' }); });
    // De dónde sale cada conjuro que no es de los preparados de su clase
    // usos: veces que puede lanzarlo sin gastar espacio (salen círculos para tacharlos)
    const LARGO = 'por descanso largo', origen = new Map(), marca = (ids, txt, siempre, usos) => (ids || []).forEach(i => {
      if (origen.has(i)) return; const s = CONJ.get(i), u = siempre && s && s.nivel ? (usos === undefined ? 0 : usos) : 0;
      origen.set(i, { siempre, usos: u, txt: txt + (u ? `: ${u === 1 ? '1 uso' : u + ' usos'} ${hayEsp ? 'sin gastar espacio ' : ''}${LARGO}${!hayEsp && s.ritual ? ' (y, aparte, como ritual)' : ''}` : '') });
    });
    const GNOMO = h.linaje === 'gnomo-de-los-bosques' ? bc : 1;
    (h.magia || []).forEach(m => { marca(m.trucos, `Iniciado en la magia (${listaMagia(m)})`, false); marca(m.conjuros, `Siempre preparado por Iniciado en la magia (${listaMagia(m)})`, true, 1); });
    (h.conjEspecie || []).forEach(i => { const s = CONJ.get(i); marca([i], s && s.nivel ? 'Siempre preparado por su especie' : 'De su especie', !!(s && s.nivel), GNOMO); });
    marca(h.arcanum, `Arcanum místico: 1 uso sin gastar espacio ${LARGO}`, true);
    marca([...(h.grimorio || []), ...((h.conj || {}).grimT || []), ...((h.conj || {}).grimR || [])], 'Libro de las sombras (Pacto del grimorio)', false);
    marca(h.maestriaConj, 'Siempre preparado por Maestría sobre conjuros: a su nivel, las veces que quiera sin gastar espacio', true);
    (h.caracteristicos || []).forEach(i => { if (!origen.has(i)) origen.set(i, { siempre: true, usos: 1, txt: 'Siempre preparado por Conjuros característicos: 1 uso a nivel 3 sin gastar espacio por descanso corto o largo' }); });
    const auto = new Map(conjSiempre(c.id, n, h).map(x => [x.id, x.origen])), GRATIS = { 'castigo-divino': 1, 'hallar-corcel': 1, 'contactar-con-otro-plano': 1 };
    (h.conjSiempre || []).forEach(i => {
      const de = auto.get(i), t = 'Siempre preparado por ' + ({ clase: 'su clase', subclase: 'su subclase', terreno: 'su terreno', especie: 'su especie' }[de] || 'un rasgo de su clase');
      if (i === 'marca-del-cazador' && de === 'clase') return marca([i], t + `: ${ENEMIGO_PREDILECTO[n]} usos sin gastar espacio ${LARGO} (se apuntan en Recursos)`, true);
      marca([i], t, true, de === "especie" ? 1 : de === 'clase' ? GRATIS[i] || 0 : 0);
    });
    // Leyenda y cuándo se pueden cambiar
    const mago = c.id === 'mago', regla = !lanza ? '' : mago ? `Esta lista es su libro de conjuros: tras un descanso largo elige ${prep} para prepararlos y los marca a lápiz.`
      : c.id === 'clerigo' || c.id === 'druida' ? 'Tras un descanso largo puede cambiar los preparados que quiera por otros de la lista de su clase.'
      : c.id === 'paladin' || c.id === 'explorador' ? 'Tras un descanso largo puede sustituir un conjuro preparado por otro de la lista de su clase.'
      : 'Sus conjuros preparados no cambian con los descansos.';
    let d2 = d;
    const cuad = (x, y, t, tipo) => { d2.casilla(x, y, t, tipo === 'no' ? { relleno: COL.blanco } : { relleno: COL.rojo, color: COL.rojo }); if (tipo === 'S') d2.texto('S', x + t / 2, y + t * .85, { tam: t * .95, neg: true, al: 'c', color: COL.blanco }); };
    // Cuadro de leyenda: marcas, cambios y componentes
    const y0L = hayEsp ? 166 : 100, hayNiv = conj.some(x => x.nivel), lins = [];
    if (regla || !hayEsp) lins.push([T(regla || 'No tiene espacios de conjuro: los trucos los lanza cuando quiera, y cada conjuro solo las veces que indica; las recupera con un descanso largo.')]);
    if (pacto) lins.push([T(`Todos sus espacios son de nivel ${pacto.nivel}: con ellos lanza cualquiera de sus conjuros, siempre a ese nivel, y los recupera con un descanso corto o largo.`)]);
    const tieneC = k => conj.some(s => new RegExp('(^|, )' + k + '($|[ ,])').test(String(s.componentes).split(' (')[0]));
    if (tieneC('V')) lins.push([N('V (verbal): '), T('hay que decir unas palabras con voz normal; no puede lanzarse en silencio mágico ni con la boca tapada.')]);
    if (tieneC('S')) lins.push([N('S (somático): '), T('hay que hacer unos gestos; hace falta tener al menos una mano libre.')]);
    if (tieneC('M')) lins.push([N('M (material): '), T('hace falta el material indicado y una mano libre para cogerlo (vale la de los gestos). Si no tiene precio ni se consume, basta un saquito de componentes, o un canalizador mágico si su clase le deja usarlo.')]);
    if (conj.some(s => s.ritual)) lins.push([N('(R) ritual: '), T('también puede lanzarse como ritual: tarda 10 minutos más y no gasta espacio de conjuro.')]);
    const TL = 6.6, AL = TL * 1.25, filasL = lins.map(l => partir(palabras(l, TL), 523, TL)), hL = (hayNiv ? 11 : 2) + filasL.reduce((s, l) => s + l.length, 0) * AL + 6;
    d.rect(M, y0L, 539, hL, { r: 6, g: .8 });
    let yl = y0L + 10, lx = M + 8; const ley = (tipo, txt) => { if (tipo === 'uso') d.circulo(lx + 3, yl - 2.2, 2.6, { g: .8 }); else cuad(lx, yl - 5.4, 6, tipo); lx += 9; lx += d.texto(txt, lx, yl, { tam: TL }) + 14; };
    if (hayNiv) {
      if (mago) ley('no', 'En su libro (se marca a lápiz al prepararlo)'); else if (lanza) ley('si', 'Preparado');
      if ([...origen.values()].some(x => x.siempre)) ley('S', 'Siempre preparado');
      if ([...origen.values()].some(x => x.usos)) ley('uso', hayEsp ? 'Uso sin gastar espacio: se tacha al lanzarlo y se borra al descansar' : 'Uso: se tacha al lanzarlo y se borra al descansar');
      yl += AL + 1.5;
    } else yl -= 1;
    filasL.forEach(f => f.forEach(l => { pintarLinea(d, l, M + 8, yl, TL); yl += AL; }));
    const yTab = y0L + hL + 6;
    // Lista de conjuros
    const X = M + 8, An = 523, SG = 48, C = { prep: 0, niv: 21, nom: SG, esc: 178, tie: 240, alc: 309, dur: 366, com: 493 };
    const cabecera = y0 => { [['PREP', C.prep], ['NIVEL', C.niv], ['NOMBRE', C.nom], ['ESCUELA', C.esc], ['TIEMPO', C.tie], ['ALCANCE', C.alc], ['DURACIÓN', C.dur], ['COMP.', C.com]].forEach(([r, x]) => d.texto(r, X + x, y0 + 11, { tam: 5.4, neg: true, color: COL.suave })); };
    const pinta = (dd, tam, nuevoMarco) => {
      const fl = Flujo(dd, nuevoMarco, tam); d2 = dd; fl.marco();
      conj.forEach((s, i) => {
        const fondo = i % 2 === 0, hc = tam * 1.5, o2 = origen.get(s.id), tc = String(s.tiempo).split(/, /)[0];
        const res = (window.RESUMENES || {})[s.id], pars = res ? [{ runs: [T(cas(res))] }] : parrafos(cas(s.html));
        const antes = [];
        if (o2) antes.push({ t: o2.txt + '. ', n: true, c: false, r: true });
        if (tc !== s.tiempo) antes.push(N(tc + ': '), { t: cas(String(s.tiempo).slice(tc.length + 2)) + '. ', n: false, c: true });
        if (antes.length) { if (pars[0] && pars[0].runs && !pars[0].vineta) pars[0] = { ...pars[0], runs: [...antes, ...pars[0].runs] }; else pars.unshift({ runs: antes }); }
        const mat = (String(s.componentes).match(/M \((.+)\)\s*$/) || [])[1];
        if (mat) { const u = pars[pars.length - 1], x = [N(' Material: '), { t: mat + '.', n: false, c: true }]; if (u && u.runs) u.runs = [...u.runs, ...x]; else pars.push({ runs: x }); }
        // Con el texto resumido, un conjuro no se parte entre dos páginas
        const lin = pars.reduce((t, p) => t + (p.runs ? partir(palabras(p.runs, tam), An - SG, tam).length : 8), 0);
        fl.sitio(hc + fl.alto * Math.min(lin, 12));
        const m = fl.m, y = fl.y;
        if (fondo) fl.fondo(hc, SG);
        dd.linea(m.x - 8 - SG, y, m.x + m.w + 8, y, { g: .4, color: COL.linea });
        const b = y + tam * 1.15, o = { tam: tam + .2 };
        if (s.nivel) { cuad(X + C.prep + 3, y + tam * .34, 7.4, o2 && o2.siempre ? 'S' : mago && !(o2 && /Libro/.test(o2.txt)) ? 'no' : 'si'); dd.texto(String(s.nivel), X + C.niv + 8, b, { ...o, al: 'c' }); } else dd.texto('Truco', X + C.niv - 1, b, o);
        dd.texto(s.nombre + (s.ritual ? ' (R)' : ''), X + C.nom, b, { tam: tam + 1, neg: true, max: 126, min: 6.5 });
        dd.texto(s.escuela, X + C.esc, b, { ...o, max: 59, min: 5.5 }); dd.texto(tc, X + C.tie, b, { ...o, max: 63, min: 4.2 }); dd.texto(cas(s.alcance), X + C.alc, b, { ...o, max: 54, min: 4.2 }); dd.texto(s.duracion, X + C.dur, b, { ...o, max: 124, min: 4.2 }); dd.texto((String(s.componentes).match(/^[VSM, ]+/) || [''])[0].replace(/[, ]+$/, ''), X + C.com, b, { ...o, max: 32 });
        fl.y = y + hc;
        const yU = fl.y + fl.alto * .55;
        pars.forEach(p => fl.parrafo(p, { fondo, sangFondo: SG }));
        if (o2 && o2.usos) for (let k = 0; k < o2.usos; k++) dd.circulo(X + 6.7 + (k % 5) * 7.4, yU + Math.floor(k / 5) * 7.4, 2.7, { g: .8, relleno: COL.blanco });
        fl.y += 2;
      });
      return fl;
    };
    // El mayor tamaño de letra con el que caben todos en esta página; si no caben, letra normal y páginas siguientes
    let tam = 8, cabe = false; for (; tam >= 7; tam -= .25) { const dm = Doc(); dm.pagina(); if (pinta(dm, tam, () => ({ x: X + SG, y: 0, w: An - SG, h: 1e6 })).y <= 818 - yTab - 20) { cabe = true; break; } }
    // En varias páginas: la letra más grande de las que gastan menos páginas
    if (!cabe) {
      const pags = t => { let k = 0; pinta(Doc().pagina(), t, () => ({ x: X + SG, y: 0, w: An - SG, h: k++ ? 746 : 818 - yTab - 20 })); return k; };
      const ops = [7.75, 7.5, 7.25, 7].map(t => [t, pags(t)]), min = Math.min(...ops.map(x => x[1])); tam = ops.find(x => x[1] === min)[0];
    }
    let prim = true, y0 = 0;
    const fin = pinta(d, tam, () => { if (!prim) { d.rect(M, y0, 539, 818 - y0, { r: 8 }); nueva(); } y0 = prim ? yTab : 52; prim = false; cabecera(y0); return { x: X + SG, y: y0 + 16, w: An - SG, h: 818 - y0 - 20 }; });
    d.rect(M, y0, 539, Math.min(818, fin.y + 5) - y0, { r: 8 });
  }
  window.hojaPDF = hojaPDF; window.ataquesPJ = ataquesPJ;
})();
