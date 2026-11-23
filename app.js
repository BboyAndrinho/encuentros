'use strict';
/* Encuentros D&D 5.5e — gestor de combates para el máster.
   Todo se guarda en el propio teléfono (localStorage). */

// ============ Utilidades ============
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const signo = n => (n < 0 ? '−' : '+') + Math.abs(n || 0);
const modDe = v => Math.floor(((v ?? 10) - 10) / 2);
const bcDeNivel = n => 2 + Math.floor((Math.max(1, Math.min(20, n || 1)) - 1) / 4);
const num = (v, def = null) => {
  if (v === '' || v == null) return def;
  const n = parseInt(String(v).replace('−', '-'), 10);
  return Number.isFinite(n) ? n : def;
};
const vdNum = s => { if (s === '' || s == null) return 0; s = String(s); if (s.includes('/')) { const [a, b] = s.split('/'); return a / b; } return +s; };
const fmt = n => (n || 0).toLocaleString('es-ES');
const CARS = ['Fue', 'Des', 'Con', 'Int', 'Sab', 'Car'];
const CARS_LARGO = { Fue: 'Fuerza', Des: 'Destreza', Con: 'Constitución', Int: 'Inteligencia', Sab: 'Sabiduría', Car: 'Carisma' };

const IC = {
  atras: '<path d="M15 18l-6-6 6-6"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  puntos: '<circle cx="12" cy="5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="19" r="1.4" fill="currentColor"/>',
  deshacer: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>',
  cerrar: '<path d="M18 6L6 18M6 6l12 12"/>',
  ajustes: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  espadas: '<path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/><path d="M9.5 17.5L21 6V3h-3L6.5 14.5"/><path d="M11 19l-6-6"/><path d="M8 16l-4 4"/><path d="M5 21l-2-2"/>',
  escudo: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  logo: '<path d="M12 2l8.7 5v10L12 22l-8.7-5V7z"/><path d="M12 2L7 11h10z"/><path d="M7 11l5 11 5-11"/><path d="M3.3 7L7 11M20.7 7L17 11"/>',
  siguiente: '<path d="M9 18l6-6-6-6"/>'
};
const ic = (p, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

// ============ Datos del SRD ============
const MONS = SRD.monstruos;
const MON = new Map(MONS.map(m => [m.id, m]));
const EST = new Map(SRD.estados.map(e => [e.id, e]));
for (const m of MONS) {
  m._n = norm(m.nombre + ' ' + m.tipo);
  m._vd = vdNum(m.vd);
  const leg = m.secciones.find(s => s.titulo === 'Acciones legendarias');
  const u = leg && leg.intro.match(/Usos de acciones legendarias:\s*(\d+)/);
  m._leg = u ? +u[1] : 0;
}
const TIPOS = [...new Set(MONS.map(m => m.tipo))].sort((a, b) => a.localeCompare(b, 'es'));
const VDS = [...new Set(MONS.map(m => m.vd))].sort((a, b) => vdNum(a) - vdNum(b));

// Conjuros
const CONJS = SRD.conjuros || [];
const CONJ = new Map(CONJS.map(c => [c.id, c]));
const CONJ_N = new Map(CONJS.map(c => [norm(c.nombre), c]));
for (const c of CONJS) c._n = norm(c.nombre + ' ' + c.escuela);
const CLASES_CONJ = [...new Set(CONJS.flatMap(c => c.clases))].sort((a, b) => a.localeCompare(b, 'es'));
const ESCUELAS_CONJ = [...new Set(CONJS.map(c => c.escuela))].sort((a, b) => a.localeCompare(b, 'es'));
const nivelTxt = n => n === 0 ? 'Truco' : `Nivel ${n}`;
const ordenConj = (a, b) => a.nivel - b.nivel || a.nombre.localeCompare(b.nombre, 'es');
// En el SRD los nombres de conjuros van en cursiva: los convertimos en enlaces para consultarlos
function enlazarConjuros(html) {
  return String(html || '').replace(/<em>([^<]+)<\/em>/g, (todo, t) => {
    const c = CONJ_N.get(norm(t).trim().replace(/[.,;:]+$/, ''));
    return c ? `<button class="enl-conj" data-a="verConjuro" data-id="${c.id}">${esc(t.trim())}</button>${/\s$/.test(t) ? ' ' : ''}` : todo;
  });
}

// Lee de una acción de monstruo su ataque, su tirada de salvación y sus daños
const CAR_CORTO = { Fuerza: 'Fue', Destreza: 'Des', Constitución: 'Con', Inteligencia: 'Int', Sabiduría: 'Sab', Carisma: 'Car' };
const RE_DANO = /(\d+)(?: \(([^)]+)\))? de daño (?:de )?(ácido|contundente|cortante|frío|fuego|fuerza|necrótico|perforante|psíquico|radiante|relámpago|trueno|veneno)/gi;
function analizarEntrada(e) {
  if (e._an) return e._an;
  const t = e.html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
  // Admite «+5 a acertar» y notas como «+4 (con ventaja si el osgo tiene agarrado al objetivo)»
  const at = t.match(/Tirada de ataque (cuerpo a cuerpo o a distancia|cuerpo a cuerpo|a distancia):\s*([+−-]\s*\d+)(?:\s*a acertar)?(?:\s*\(([^)]*)\))?(?:,\s*alcance ([^.]+?))?\./);
  const ts = t.match(/Tirada de salvación de (\S+):\s*CD (\d+)/);
  const danos = [...t.matchAll(RE_DANO)].map(x => ({ media: +x[1], dados: x[2] || '', tipo: x[3].toLowerCase() }));
  e._an = {
    ataque: at && { tipo: at[1], bono: at[2].replace(/\s/g, '').replace('-', '−'), nota: at[3] || '', alcance: at[4] || '' },
    ts: ts && { car: CAR_CORTO[ts[1]] || ts[1], cd: +ts[2] },
    danos
  };
  return e._an;
}
// Estados que incluyen el de incapacitado (impiden, por ejemplo, el intercambio de la dote Alerta)
const INCAPACITANTES = new Set(['incapacitado', 'aturdido', 'inconsciente', 'paralizado', 'petrificado']);

// Presupuesto de PX por personaje (SRD 5.2.1, "Dificultad de los encuentros de combate")
const PX_TABLA = {
  1: [50, 75, 100], 2: [100, 150, 200], 3: [150, 225, 400], 4: [250, 375, 500], 5: [500, 750, 1100],
  6: [600, 1000, 1400], 7: [750, 1300, 1700], 8: [1000, 1700, 2100], 9: [1300, 2000, 2600], 10: [1600, 2300, 3100],
  11: [1900, 2900, 4100], 12: [2200, 3700, 4700], 13: [2600, 4200, 5400], 14: [2900, 4900, 6200], 15: [3300, 5400, 7800],
  16: [3800, 6100, 9800], 17: [4500, 7200, 11700], 18: [5000, 8700, 14200], 19: [5500, 10700, 17200], 20: [6400, 13200, 22000]
};

// ============ Almacenamiento ============
const CLAVE = 'encuentros-dnd-v1';
let E = cargar();
function cargar() {
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE));
    if (d && d.version) return completar(d);
  } catch (e) { /* datos dañados o sin acceso */ }
  return completar({});
}
function completar(d) {
  d.version = 1;
  d.personajes ||= [];
  d.encuentros ||= [];
  d.ajustes ||= { pantalla: true };
  return d;
}
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(E)); }
  catch (e) { toast('No se ha podido guardar en el teléfono'); }
  copiaPruebas();
}

// Solo al probar en el ordenador (localhost): el navegador de pruebas puede borrar sus datos al
// reiniciarse, así que guardamos también una copia en herramientas/salida/datos-prueba.json.
// En el móvil (la app publicada en internet) esto no se usa.
const ES_PRUEBAS = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
let tCopia;
function copiaPruebas() {
  if (!ES_PRUEBAS) return;
  clearTimeout(tCopia);
  tCopia = setTimeout(() => {
    fetch('/__guardar?nombre=datos-prueba.json', { method: 'POST', body: JSON.stringify(E) }).catch(() => {});
  }, 400);
}
async function recuperarCopiaPruebas() {
  if (!ES_PRUEBAS || E.personajes.length || E.encuentros.length) return;
  try {
    const r = await fetch('/herramientas/salida/datos-prueba.json', { cache: 'no-store' });
    if (!r.ok) return;
    const d = JSON.parse(await r.text());
    if (!d || !Array.isArray(d.personajes) || !Array.isArray(d.encuentros)) return;
    if (!d.personajes.length && !d.encuentros.length) return;
    E = completar(d);
    try { localStorage.setItem(CLAVE, JSON.stringify(E)); } catch (e) { /* sin acceso */ }
    render();
    toast('Datos de prueba recuperados del ordenador');
  } catch (e) { /* no hay copia */ }
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

const encPorId = id => E.encuentros.find(e => e.id === id);
const partPorId = (enc, pid) => enc && enc.participantes.find(p => p.id === pid);
const pjPorId = id => E.personajes.find(p => p.id === id);
const encActual = () => encPorId(ruta().id);

// ============ Iniciativa ============
function modIni(p) {
  return (p.ini.usarDes ? p.desMod : 0) + (p.ini.usarBC ? p.bc : 0) + (p.ini.extra || 0);
}
function totalIni(p) {
  if (p.ini.manual != null) return p.ini.manual;
  if (p.ini.tirada == null) return null;
  return p.ini.tirada + modIni(p);
}
function ordenar(ps) {
  return [...ps].sort((a, b) =>
    (totalIni(b) ?? -99) - (totalIni(a) ?? -99) ||
    (b.desMod || 0) - (a.desMod || 0) ||
    (a.tipo === 'pj' ? 0 : 1) - (b.tipo === 'pj' ? 0 : 1));
}

// ============ Participantes ============
function base(p) {
  return Object.assign({
    id: uid(), pgTemp: 0, estados: [], conc: false, reaccion: false, leg: null,
    muerte: { ok: 0, ko: 0 }, estable: false, derrotado: false, aliado: false, notas: ''
  }, p);
}
function participanteDePJ(pj) {
  return base({
    tipo: 'pj', ref: pj.id, nombre: pj.nombre, nivel: pj.nivel || 1, alerta: !!pj.alerta,
    ca: pj.ca, pgMax: pj.pgMax || 1, pg: pj.pgMax || 1,
    desMod: modDe(pj.des), bc: bcDeNivel(pj.nivel),
    ini: { tirada: null, usarDes: pj.iniDes !== false, usarBC: !!pj.iniBC, extra: pj.iniExtra || 0, manual: null }
  });
}
function participanteDeMon(m, nombre) {
  const des = m.car[1] ? m.car[1].mod : 0;
  return base({
    tipo: 'monstruo', ref: m.id, nombre, nombreAuto: true, px: m.px || 0, vd: m.vd,
    ca: m.ca, pgMax: m.pg || 1, pg: m.pg || 1, desMod: des, bc: m.bc || 0,
    ini: { tirada: null, usarDes: true, usarBC: false, extra: (m.ini ?? des) - des, manual: null },
    leg: m._leg ? { max: m._leg, usadas: 0 } : null
  });
}
// Prepara monstruos numerados sin meterlos todavía en el encuentro (se meten con aplicar)
function crearMonstruos(enc, m, cant) {
  const mismos = enc.participantes.filter(p => p.ref === m.id && p.nombreAuto);
  let max = 0;
  for (const p of mismos) { const r = p.nombre.match(/ (\d+)$/); max = Math.max(max, r ? +r[1] : 1); }
  const renombrar = mismos.length === 1 && mismos[0].nombre === m.nombre ? mismos[0] : null;
  const numerar = mismos.length + cant > 1;
  const nuevos = [];
  for (let i = 0; i < cant; i++) nuevos.push(participanteDeMon(m, numerar ? `${m.nombre} ${++max}` : m.nombre));
  const aplicar = e => {
    if (renombrar) renombrar.nombre = m.nombre + ' 1';
    e.participantes.push(...nuevos);
  };
  return { nuevos, aplicar };
}
function anadirMonstruos(enc, m, cant) {
  const r = crearMonstruos(enc, m, cant);
  r.aplicar(enc);
  return r.nuevos;
}
function tipoTexto(p) {
  if (p.tipo === 'pj') { const pj = pjPorId(p.ref); return `Jugador${pj && pj.clase ? ' · ' + pj.clase : ''} · nivel ${p.nivel || 1}`; }
  if (p.tipo === 'monstruo') { const m = MON.get(p.ref); return m ? `${m.tipo} ${m.tamano} · VD ${m.vd}` : 'Criatura'; }
  return 'Criatura personalizada';
}

// ============ Dificultad ============
function dificultad(enc) {
  const pjs = enc.participantes.filter(p => p.tipo === 'pj');
  const enemigos = enc.participantes.filter(p => p.tipo !== 'pj' && !p.aliado);
  const pres = [0, 0, 0];
  for (const p of pjs) { const t = PX_TABLA[Math.max(1, Math.min(20, p.nivel || 1))]; pres[0] += t[0]; pres[1] += t[1]; pres[2] += t[2]; }
  const px = enemigos.reduce((s, p) => s + (p.px || 0), 0);
  let clave = 'nada', etiqueta = 'Sin enemigos';
  if (px > 0) {
    if (px <= pres[0]) { clave = 'baja'; etiqueta = 'Baja'; }
    else if (px <= pres[1]) { clave = 'moderada'; etiqueta = 'Moderada'; }
    else if (px <= pres[2]) { clave = 'alta'; etiqueta = 'Alta'; }
    else { clave = 'extrema'; etiqueta = 'Por encima de alta'; }
  }
  return { pjs: pjs.length, pres, px, clave, etiqueta };
}
function htmlDificultad(d) {
  if (!d.pjs) return `<div class="dificultad"><p class="nota" style="margin:0">Añade jugadores (con su nivel) para calcular la dificultad del encuentro.</p></div>`;
  const tope = Math.max(d.pres[2], d.px) || 1;
  const pc = v => Math.min(100, v / tope * 100).toFixed(1);
  return `<div class="dificultad ${d.clave}">
    <div class="dif-cab"><span>Dificultad estimada</span><b>${d.etiqueta}</b></div>
    <div class="dif-barra"><i style="width:${pc(d.px)}%"></i><span class="marca" style="left:${pc(d.pres[0])}%"></span><span class="marca" style="left:${pc(d.pres[1])}%"></span><span class="marca" style="left:${pc(d.pres[2])}%"></span></div>
    <div class="dif-nums"><span>PX enemigos: <b>${fmt(d.px)}</b></span><span>Baja ≤ ${fmt(d.pres[0])}</span><span>Moderada ≤ ${fmt(d.pres[1])}</span><span>Alta ≤ ${fmt(d.pres[2])}</span></div>
  </div>`;
}

// ============ Combate: lógica de turnos ============
const pilasDeshacer = {};
function instantanea(enc) {
  const pila = pilasDeshacer[enc.id] ||= [];
  pila.push(JSON.stringify({ p: enc.participantes, c: enc.combate }));
  if (pila.length > 50) pila.shift();
}
function accionCombate(enc, fn) {
  instantanea(enc);
  try { fn(); }
  finally { guardar(); refrescar(); }
}
function registrar(enc, t) {
  const c = enc.combate; if (!c) return;
  c.log ||= [];
  c.log.push({ a: c.asalto, t });
  if (c.log.length > 300) c.log.shift();
}
const muertoPJ = p => p.tipo === 'pj' && p.pg === 0 && p.muerte && p.muerte.ko >= 3;
// Los monstruos derrotados y los jugadores muertos no tienen turno
const saltar = p => (p.tipo !== 'pj' && p.derrotado) || muertoPJ(p);

function limpiarOrden(enc) {
  const c = enc.combate;
  const ids = new Set(enc.participantes.map(p => p.id));
  c.orden = c.orden.filter(id => ids.has(id));
  for (const p of enc.participantes) if (!c.orden.includes(p.id)) insertarEnOrden(enc, p);
  if (!c.orden.includes(c.turnoId)) c.turnoId = c.orden[0];
}
function insertarEnOrden(enc, p) {
  const o = enc.combate.orden;
  const t = totalIni(p) ?? -99;
  let i = o.findIndex(id => { const q = partPorId(enc, id); return q && (totalIni(q) ?? -99) < t; });
  if (i < 0) i = o.length;
  o.splice(i, 0, p.id);
}
function siguienteId(enc, desde) {
  const o = enc.combate.orden; const n = o.length;
  let i = o.indexOf(desde), vuelta = false;
  for (let k = 0; k < n; k++) {
    i++; if (i >= n) { i = 0; vuelta = true; }
    const p = partPorId(enc, o[i]);
    if (p && !saltar(p)) return { id: o[i], vuelta };
  }
  return { id: o[(o.indexOf(desde) + 1) % n] || o[0], vuelta: true };
}
function tick(enc, pid, momento, av) {
  for (const p of enc.participantes) {
    p.estados = p.estados.filter(s => {
      if ((s.cuentaEn || p.id) !== pid || (s.momento || 'fin') !== momento || s.rondas == null) return true;
      // Aplicado durante el mismo turno que lo cuenta: ese final de turno aún no cuenta
      // («hasta el final de tu siguiente turno» dura hasta el siguiente, no hasta este)
      if (s.saltar) { s.saltar = false; return true; }
      s.rondas--;
      if (s.rondas <= 0) {
        av.push({ t: `${p.nombre}: termina «${s.nombre}»`, tipo: 'bueno' });
        registrar(enc, `Termina «${s.nombre}» en ${p.nombre}`);
        return false;
      }
      return true;
    });
  }
}
function finTurno(enc, p, av) {
  // Primero terminan los estados que se acaban; solo se pide TS de los que siguen activos
  tick(enc, p.id, 'fin', av);
  for (const s of p.estados) {
    if (s.ts) av.push({
      t: `${p.nombre}: TS de ${CARS_LARGO[s.ts.car]}${s.ts.cd ? ' CD ' + s.ts.cd : ''} para librarse de «${s.nombre}»`,
      accion: { q: 'quitarEstado', pid: p.id, uid: s.uid, txt: 'Superada' }
    });
  }
}
function inicioTurno(enc, p, av) {
  p.reaccion = false;
  if (p.leg) p.leg.usadas = 0;
  tick(enc, p.id, 'inicio', av);
  if (p.tipo === 'pj' && p.pg === 0 && !p.estable && p.muerte.ko < 3) {
    av.push({ t: `${p.nombre} está a 0 PG: tirada de salvación contra muerte`, tipo: 'malo' });
  }
  if (p.estados.length) {
    av.push({ t: `${p.nombre} tiene: ${p.estados.map(s => s.nombre + (s.nivel ? ' ' + s.nivel : '') + (s.rondas != null ? ` (${s.rondas})` : '')).join(', ')}`, tipo: 'info' });
  }
  if (p.conc) av.push({ t: `${p.nombre} se está concentrando en un conjuro`, tipo: 'info' });
}
function pasarTurno(enc) {
  const c = enc.combate; const av = [];
  const actual = partPorId(enc, c.turnoId);
  if (actual) finTurno(enc, actual, av);
  const sig = siguienteId(enc, c.turnoId);
  if (sig.vuelta) { c.asalto++; av.unshift({ t: `Comienza el asalto ${c.asalto}`, tipo: 'info' }); }
  c.turnoId = sig.id;
  const nuevo = partPorId(enc, c.turnoId);
  if (nuevo) { inicioTurno(enc, nuevo, av); registrar(enc, `Turno de ${nuevo.nombre}`); }
  c.avisos = av;
  desplazarAlTurno = true;
}
function iniciarCombate(enc) {
  const orden = ordenar(enc.participantes).map(p => p.id);
  enc.combate = { asalto: 1, orden, turnoId: orden[0], log: [], avisos: [] };
  const av = [{ t: 'Comienza el combate: asalto 1', tipo: 'info' }];
  const p = partPorId(enc, orden[0]);
  if (p && saltar(p)) enc.combate.turnoId = siguienteId(enc, orden[0]).id;
  const q = partPorId(enc, enc.combate.turnoId);
  if (q) { inicioTurno(enc, q, av); registrar(enc, `Turno de ${q.nombre}`); }
  enc.combate.avisos = av;
  delete pilasDeshacer[enc.id];
}

// ---- Daño, curación y puntos de golpe temporales ----
function aplicarDanio(enc, p, n, av) {
  if (!(n > 0)) return;
  let resto = n;
  if (p.pgTemp > 0) { const q = Math.min(p.pgTemp, resto); p.pgTemp -= q; resto -= q; }
  const antes = p.pg;
  p.pg = Math.max(0, p.pg - resto);
  registrar(enc, `${p.nombre} recibe ${n} de daño (${antes} → ${p.pg} PG)`);
  if (p.conc && antes > 0 && p.pg > 0) {
    av.push({ t: `${p.nombre}: TS de Constitución CD ${Math.min(30, Math.max(10, Math.floor(n / 2)))} para mantener la concentración`, accion: { q: 'quitarConc', pid: p.id, txt: 'La falla' } });
  }
  if (antes > 0 && p.pg === 0) {
    if (p.conc) { p.conc = false; av.push({ t: `${p.nombre} pierde la concentración`, tipo: 'info' }); }
    if (p.tipo === 'pj') {
      if (resto - antes >= p.pgMax) {
        p.muerte = { ok: 0, ko: 3 }; p.estable = false;
        av.push({ t: `${p.nombre}: el daño sobrante (${resto - antes}) iguala o supera sus PG máximos: muerte instantánea`, tipo: 'malo' });
      } else {
        if (!p.estados.some(s => s.id === 'inconsciente')) p.estados.push(nuevoEstado('inconsciente', { auto: true }));
        p.muerte = { ok: 0, ko: 0 }; p.estable = false;
        av.push({ t: `${p.nombre} cae a 0 PG y queda inconsciente`, tipo: 'malo' });
      }
    } else {
      p.derrotado = true;
      av.push({ t: `${p.nombre} ha sido derrotado`, tipo: 'bueno' });
      comprobarVictoria(enc, av);
    }
  } else if (antes === 0 && p.tipo === 'pj') {
    p.estable = false;
    p.muerte.ko = Math.min(3, p.muerte.ko + 1);
    av.push({ t: `${p.nombre} recibe daño a 0 PG: 1 fallo de TS contra muerte (añade otro si fue crítico)`, tipo: 'malo' });
    if (p.muerte.ko >= 3) av.push({ t: `${p.nombre} ha muerto`, tipo: 'malo' });
  }
}
// Cuando cae el último enemigo, avisar y ofrecer terminar el combate
function comprobarVictoria(enc, av) {
  const enemigos = enc.participantes.filter(p => p.tipo !== 'pj' && !p.aliado);
  if (enemigos.length && enemigos.every(p => p.derrotado)) {
    av.push({ t: '¡Todos los enemigos han caído!', tipo: 'bueno', accion: { q: 'terminar', txt: 'Terminar combate' } });
    registrar(enc, 'Todos los enemigos han caído');
  }
}
function aplicarCuracion(enc, p, n, av) {
  if (!(n > 0)) return;
  const antes = p.pg;
  p.pg = Math.min(p.pgMax, p.pg + n);
  registrar(enc, `${p.nombre} se cura ${n} (${antes} → ${p.pg} PG)`);
  if (antes === 0 && p.pg > 0) {
    p.muerte = { ok: 0, ko: 0 }; p.estable = false;
    const i = p.estados.findIndex(s => s.id === 'inconsciente' && s.auto);
    if (i >= 0) p.estados.splice(i, 1);
    if (p.derrotado) p.derrotado = false;
    av.push({ t: `${p.nombre} vuelve a estar en pie (${p.pg} PG)`, tipo: 'bueno' });
  }
}
function aplicarTemp(enc, p, n) {
  if (!(n >= 0)) return;
  p.pgTemp = Math.max(p.pgTemp || 0, n);
  registrar(enc, `${p.nombre} obtiene ${n} PG temporales`);
}
function nuevoEstado(id, extra = {}) {
  const e = EST.get(id);
  return Object.assign({ uid: uid(), id, nombre: e ? e.nombre : id, rondas: null, momento: 'fin', cuentaEn: null, ts: null, nota: '' }, extra);
}
function esInmune(p, nombreEstado) {
  if (p.tipo !== 'monstruo') return false;
  const m = MON.get(p.ref); if (!m || !m.campos.Inmunidades) return false;
  const raiz = norm(nombreEstado).slice(0, -1); // "agarrado" -> "agarrad" (cubre agarrada/agarrado)
  return norm(m.campos.Inmunidades.replace(/<[^>]+>/g, '')).includes(raiz);
}
function quitarParticipante(enc, pid) {
  const c = enc.combate;
  if (c) {
    if (c.turnoId === pid) c.turnoId = siguienteId(enc, pid).id;
    c.orden = c.orden.filter(id => id !== pid);
  }
  enc.participantes = enc.participantes.filter(p => p.id !== pid);
  for (const p of enc.participantes) for (const s of p.estados) if (s.cuentaEn === pid) s.cuentaEn = null;
  if (c && !enc.participantes.length) enc.combate = null;
}

// ============ Ventanas (hojas inferiores) ============
const hojas = [];
let ignorarPop = 0, navPendiente = null;
function abrirHoja(render, opts = {}) {
  const d = document.createElement('dialog');
  d.className = 'hoja';
  const h = { el: d, render, opts, cerrar: () => { if (d.open) d.close(); } };
  h.pintar = () => {
    const html = render(h);
    if (html == null) { h.cerrar(); return; }
    const sc = d.scrollTop;
    const t = $('#toast', d); if (t) document.body.appendChild(t);
    // Recordar qué secciones plegables estaban abiertas o cerradas
    const plegables = new Map($$('details[data-k]', d).map(x => [x.dataset.k, x.open]));
    d.innerHTML = `<div class="hoja-asa"></div><div class="hoja-in">${html}</div>`;
    for (const x of $$('details[data-k]', d)) if (plegables.has(x.dataset.k)) x.open = plegables.get(x.dataset.k);
    d.scrollTop = sc;
    opts.alPintar && opts.alPintar(h);
  };
  d.addEventListener('close', () => {
    const i = hojas.indexOf(h); if (i >= 0) hojas.splice(i, 1);
    const t = $('#toast', d); if (t) document.body.appendChild(t);
    d.remove();
    programarHistorial();
    opts.alCerrar && opts.alCerrar();
  });
  d.addEventListener('click', e => { if (e.target === d) h.cerrar(); });
  document.body.appendChild(d);
  h.pintar();
  d.showModal();
  hojas.push(h);
  programarHistorial();
  return h;
}
const hojaActual = () => hojas[hojas.length - 1];

// Historial del navegador y hojas: cada hoja abierta tiene una entrada en el historial para que
// el botón Atrás de Android la cierre. En vez de añadir y quitar entradas en cada apertura y
// cierre, se cuadran al final (así, cerrar una hoja y abrir otra no toca el historial).
let entradasHoja = 0, sincProgramada = false;
function programarHistorial() {
  if (sincProgramada) return;
  sincProgramada = true;
  setTimeout(cuadrarHistorial, 0);
}
function cuadrarHistorial() {
  sincProgramada = false;
  if (ignorarPop > 0) return; // se cuadrará cuando llegue el popstate pendiente
  const dif = hojas.length - entradasHoja;
  if (dif > 0) {
    for (let i = 0; i < dif; i++) history.pushState({ hoja: true }, '');
    entradasHoja += dif;
  } else if (dif < 0) {
    ignorarPop++;
    entradasHoja += dif;
    history.go(dif);
  } else if (navPendiente) {
    const n = navPendiente; navPendiente = null; location.hash = n;
  }
}
window.addEventListener('popstate', () => {
  if (ignorarPop > 0) { ignorarPop--; if (!ignorarPop) cuadrarHistorial(); return; }
  // El usuario ha pulsado Atrás: si hay una hoja abierta, se cierra y no se cambia de pantalla
  if (entradasHoja > 0) {
    entradasHoja--;
    const h = hojaActual();
    if (h) h.cerrar();
  }
});
function navegar(hash) {
  if (hojas.length || entradasHoja || ignorarPop || sincProgramada) {
    navPendiente = hash;
    [...hojas].reverse().forEach(h => h.cerrar());
    programarHistorial();
  } else location.hash = hash;
}
function preguntar(texto, opciones) {
  return new Promise(res => {
    let r;
    const h = abrirHoja(() => `<div class="pregunta"><p>${texto}</p><div class="botonera col">${opciones.map((o, i) => `<button class="btn ${o.clase || 'secundario'}" data-a="resp" data-n="${i}">${esc(o.t)}</button>`).join('')}</div></div>`,
      { fija: true, alCerrar: () => res(r) });
    h.responder = i => { r = opciones[i].v; h.cerrar(); };
  });
}
function pedirNumero(titulo, valor, opciones = {}) {
  return new Promise(res => {
    let r;
    const h = abrirHoja(() => `<div class="pregunta"><p>${titulo}</p>
      <input class="cant" id="pn-val" type="number" inputmode="numeric" value="${valor ?? ''}">
      ${opciones.ayuda ? `<p class="nota">${opciones.ayuda}</p>` : ''}
      <div class="botonera col"><button class="btn primario" data-a="pnOk">Aceptar</button>
      ${opciones.textoVaciar ? `<button class="btn secundario" data-a="pnVaciar">${esc(opciones.textoVaciar)}</button>` : ''}</div></div>`,
      { fija: true, alCerrar: () => res(r), alPintar: () => setTimeout(() => { const i = $('#pn-val'); i && i.focus(); i && i.select(); }, 60) });
    h.aceptar = () => { r = num($('#pn-val').value, undefined); h.cerrar(); };
    h.vaciar = () => { r = null; h.cerrar(); };
  });
}
let tt;
function toast(m) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
  const cont = hojas.length ? hojaActual().el : document.body;
  if (t.parentNode !== cont) cont.appendChild(t);
  t.textContent = m;
  t.classList.add('ver');
  clearTimeout(tt);
  tt = setTimeout(() => t.classList.remove('ver'), 2800);
}

// ============ Rutas y pintado ============
function ruta() {
  const partes = (location.hash || '#/encuentros').slice(2).split('/');
  return { v: decodeURIComponent(partes[0] || 'encuentros'), id: partes[1] ? decodeURIComponent(partes[1]) : null };
}
const TAB_DE = { encuentros: 'encuentros', encuentro: 'encuentros', combate: 'encuentros', ajustes: 'encuentros', personajes: 'personajes', personaje: 'personajes', bestiario: 'bestiario', monstruo: 'bestiario', conjuros: 'conjuros', conjuro: 'conjuros', estados: 'estados' };
let ultimaRuta = '', desplazarAlTurno = false, modoReordenar = false;
function render() {
  const r = ruta();
  const fn = VISTAS[r.v] || VISTAS.encuentros;
  const v = fn(r.id) || VISTAS.encuentros();
  $('#cabecera').innerHTML = `${v.atras ? `<a class="icono" href="${v.atras}" aria-label="Volver">${ic(IC.atras)}</a>` : `<span class="logo">${ic(IC.logo)}</span>`}<h1>${esc(v.titulo)}</h1><div class="cab-acc">${v.acciones || ''}</div>`;
  $('#vista').innerHTML = v.html;
  $('#pie').innerHTML = v.pie || '';
  $('#pie').hidden = !v.pie;
  $('#nav').hidden = !!v.sinNav;
  document.body.classList.toggle('con-pie', !!v.pie);
  document.body.classList.toggle('con-nav', !v.sinNav);
  const tab = TAB_DE[r.v] || 'encuentros';
  $$('#nav a').forEach(a => a.classList.toggle('activa', a.dataset.tab === tab));
  document.title = v.titulo + ' · Encuentros D&D';
  const clave = r.v + '/' + r.id;
  if (clave !== ultimaRuta) { window.scrollTo(0, 0); ultimaRuta = clave; if (r.v !== 'combate') modoReordenar = false; if (r.v === 'combate') desplazarAlTurno = true; }
  if (desplazarAlTurno) {
    desplazarAlTurno = false;
    const a = $('.carta.actual'); if (a) a.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  if (v.alPintar) v.alPintar();
  gestionarPantalla();
}
function refrescar() {
  render();
  for (const h of hojas) if (!h.opts.fija) h.pintar();
}
window.addEventListener('hashchange', render);

// ============ Vistas ============
const VISTAS = {};

VISTAS.encuentros = () => {
  const lista = E.encuentros.slice().sort((a, b) => (b.mod || 0) - (a.mod || 0));
  const html = `<button class="btn primario ancho" data-a="nuevoEncuentro">${ic(IC.mas)} Nuevo encuentro</button>
  ${lista.length ? lista.map(enc => {
    const npj = enc.participantes.filter(p => p.tipo === 'pj').length;
    const nen = enc.participantes.length - npj;
    return `<a class="tarjeta" href="#/${enc.combate ? 'combate' : 'encuentro'}/${enc.id}">
      <div class="tit">${esc(enc.nombre)}</div>
      <div class="sub">${npj} jugador${npj === 1 ? '' : 'es'} · ${nen} criatura${nen === 1 ? '' : 's'} ${enc.combate ? `<span class="etq viva">En combate · asalto ${enc.combate.asalto}</span>` : ''}</div></a>`;
  }).join('') : `<p class="vacio">Aún no tienes encuentros.<br>Crea uno, añade a tus jugadores y a los monstruos, ¡y a luchar!</p>`}
  ${!E.personajes.length ? `<a class="tarjeta" href="#/personajes"><div class="tit">Consejo: guarda primero a tus jugadores</div><div class="sub">En la pestaña Personajes crea sus perfiles para añadirlos a cualquier encuentro con un toque.</div></a>` : ''}`;
  return { titulo: 'Encuentros', html, acciones: `<a class="icono" href="#/ajustes" aria-label="Ajustes">${ic(IC.ajustes)}</a>` };
};

function filaPrep(p) {
  const t = totalIni(p);
  return `<div class="fila-prep ${p.tipo}${p.aliado ? ' aliado' : ''}">
    <div class="fp-cab">
      <button class="fp-nom" data-a="editarPart" data-pid="${p.id}">${esc(p.nombre)}</button>
      <span class="fp-stats">CA ${p.ca ?? '—'} · PG ${p.pg}/${p.pgMax}${p.vd ? ` · VD ${p.vd}` : ''}</span>
      <button class="icono peq" data-a="quitarPart" data-pid="${p.id}" aria-label="Quitar">${ic(IC.cerrar)}</button>
    </div>
    <div class="fp-ini">
      <label class="d20"><span>d20</span><input type="number" inputmode="numeric" data-in="tirada" data-pid="${p.id}" value="${p.ini.tirada ?? ''}" placeholder="—"></label>
      <button class="chip ${p.ini.usarDes ? 'on' : ''}" data-a="togDes" data-pid="${p.id}">Des ${signo(p.desMod)}</button>
      <button class="chip ${p.ini.usarBC ? 'on' : ''}" data-a="togBC" data-pid="${p.id}">BC ${signo(p.bc)}</button>
      ${p.ini.extra ? `<span class="chip fijo">Otros ${signo(p.ini.extra)}</span>` : ''}
      ${p.alerta ? `<button class="chip alerta" data-a="intercambiar" data-pid="${p.id}" aria-label="Intercambiar iniciativa (dote Alerta)">⇄ Alerta</button>` : ''}
      <button class="ini-total ${p.ini.manual != null ? 'manual' : ''}" data-a="iniManual" data-pid="${p.id}" data-total="${p.id}">${t ?? '—'}</button>
    </div>
    ${p.ini.cambio && p.ini.manual != null ? `<p class="nota-cambio">⇄ Iniciativa intercambiada con ${esc(p.ini.cambio)}</p>` : ''}
  </div>`;
}

VISTAS.encuentro = id => {
  const enc = encPorId(id); if (!enc) return null;
  const pjs = enc.participantes.filter(p => p.tipo === 'pj');
  const otros = enc.participantes.filter(p => p.tipo !== 'pj');
  const html = `
  ${enc.combate ? `<div class="aviso"><span>Este encuentro tiene un combate en curso (asalto ${enc.combate.asalto}).</span></div>` : ''}
  <label class="campo"><span>Nombre del encuentro</span><input data-in="encNombre" value="${esc(enc.nombre)}"></label>
  ${htmlDificultad(dificultad(enc))}
  <section class="bloque">
    <div class="bloque-cab"><h2>Jugadores <span class="cuenta">${pjs.length}</span></h2><button class="btn peq" data-a="anadirPJs">${ic(IC.mas)} Añadir</button></div>
    ${pjs.length ? pjs.map(filaPrep).join('') : `<p class="vacio">Añade a tus jugadores desde sus perfiles guardados.</p>`}
  </section>
  <section class="bloque">
    <div class="bloque-cab"><h2>Enemigos y otros <span class="cuenta">${otros.length}</span></h2></div>
    <div class="botonera"><button class="btn peq" data-a="anadirMon">${ic(IC.mas)} Monstruo o animal</button><button class="btn peq" data-a="anadirOtro">${ic(IC.mas)} Personalizado</button></div>
    ${otros.map(filaPrep).join('')}
    ${otros.length ? `<button class="btn ancho secundario" data-a="iniFija">Usar iniciativa fija (10 + mod.) en los enemigos sin tirada</button>` : ''}
  </section>
  <p class="nota">Escribe en <b>d20</b> lo que saque cada uno en el dado. La app suma la Destreza y, si lo activas, el bonificador por competencia (BC), por ejemplo por la dote Alerta. Toca la iniciativa total para cambiarla a mano.</p>
  <label class="campo"><span>Notas del encuentro</span><textarea data-in="encNotas" rows="3" placeholder="Lugar, tácticas, botín…">${esc(enc.notas || '')}</textarea></label>
  <div class="botonera">
    <button class="btn peq secundario" data-a="restablecer">Restablecer PG y estados</button>
    <button class="btn peq secundario" data-a="duplicarEnc">Duplicar</button>
    <button class="btn peq peligro-suave" data-a="borrarEnc">Borrar encuentro</button>
  </div>`;
  const pie = enc.combate
    ? `<a class="btn primario grande" href="#/combate/${enc.id}">Continuar combate<small>Asalto ${enc.combate.asalto}</small></a>`
    : `<button class="btn primario grande" data-a="iniciarCombate" ${enc.participantes.length ? '' : 'disabled'}>${ic(IC.espadas)} Iniciar combate</button>`;
  return { titulo: enc.nombre, atras: '#/encuentros', html, pie };
};

function carta(enc, p) {
  const actual = enc.combate.turnoId === p.id;
  const t = totalIni(p);
  const pct = p.pgMax ? Math.max(0, Math.min(100, p.pg / p.pgMax * 100)) : 0;
  const nivel = p.pg === 0 ? 'cero' : pct <= 25 ? 'critico' : pct <= 50 ? 'herido' : 'bien';
  const chips = [];
  if (p.tipo === 'pj' && p.pg === 0) {
    chips.push(p.muerte.ko >= 3 ? `<span class="est muerte">Muerto</span>` : p.estable ? `<span class="est gris">Estable</span>` : `<span class="est muerte">Salv. muerte ${p.muerte.ok}✓ ${p.muerte.ko}✗</span>`);
  }
  if (p.conc) chips.push(`<span class="est conc">Concentración</span>`);
  for (const s of p.estados) chips.push(`<span class="est">${esc(s.nombre)}${s.nivel ? ' ' + s.nivel : ''}${s.rondas != null ? ` <b>${s.rondas}</b>` : ''}</span>`);
  if (p.reaccion) chips.push(`<span class="est gris">Reacción usada</span>`);
  if (p.leg) chips.push(`<span class="est gris">Leg. ${p.leg.max - p.leg.usadas}/${p.leg.max}</span>`);
  return `<div class="carta ${p.tipo}${p.aliado ? ' aliado' : ''}${actual ? ' actual' : ''}${p.derrotado || muertoPJ(p) ? ' caido' : ''}" data-a="abrirPart" data-pid="${p.id}" role="button" tabindex="0">
    <div class="c-ini">${t ?? '—'}</div>
    <div class="c-cuerpo"><div class="c-nom">${esc(p.nombre)}</div>${chips.length ? `<div class="c-est">${chips.join('')}</div>` : ''}</div>
    <div class="c-der"><div class="c-ca">${ic(IC.escudo)}${p.ca ?? '—'}</div><div class="c-pg ${nivel}">${p.pg}<small>/${p.pgMax}</small>${p.pgTemp ? `<em>+${p.pgTemp}</em>` : ''}</div><div class="barra ${nivel}"><i style="width:${pct}%"></i></div></div>
    ${modoReordenar ? `<div class="c-orden"><button class="icono peq" data-a="subir" data-pid="${p.id}" aria-label="Subir">▲</button><button class="icono peq" data-a="bajar" data-pid="${p.id}" aria-label="Bajar">▼</button></div>` : ''}
  </div>`;
}

VISTAS.combate = id => {
  const enc = encPorId(id); if (!enc) return null;
  if (!enc.combate) return VISTAS.encuentro(id);
  const c = enc.combate;
  limpiarOrden(enc);
  if (!enc.combate) return VISTAS.encuentro(id);
  const avisos = (c.avisos || []).map((a, i) => `<div class="aviso ${a.tipo || ''}"><span>${esc(a.t)}</span>${a.accion ? `<button class="btn mini" data-a="avisoAccion" data-n="${i}">${esc(a.accion.txt)}</button>` : ''}<button class="icono peq" data-a="cerrarAviso" data-n="${i}" aria-label="Descartar">${ic(IC.cerrar)}</button></div>`).join('');
  const cartas = c.orden.map(pid => partPorId(enc, pid)).filter(Boolean).map(p => carta(enc, p)).join('');
  const sig = partPorId(enc, siguienteId(enc, c.turnoId).id);
  const html = `<div class="avisos">${avisos}</div>
    ${modoReordenar ? `<div class="aviso info"><span>Usa las flechas para cambiar el orden.</span><button class="btn mini" data-a="finReordenar">Hecho</button></div>` : ''}
    <div class="cartas">${cartas}</div>
    <div class="combate-herr">
      <button class="btn peq" data-a="danioArea">Daño en área</button>
      <button class="btn peq" data-a="anadirMon">${ic(IC.mas)} Monstruo</button>
      <button class="btn peq" data-a="anadirPJs">${ic(IC.mas)} Jugador</button>
      <button class="btn peq" data-a="anadirOtro">${ic(IC.mas)} Otro</button>
    </div>
    <p class="nota">Toca una criatura para aplicar daño, curación o estados.</p>`;
  const pie = `<button class="btn secundario" data-a="deshacer" aria-label="Deshacer">${ic(IC.deshacer)}</button>
    <button class="btn primario grande" data-a="siguienteTurno">Siguiente turno${sig ? `<small>${esc(sig.nombre)}</small>` : ''}</button>`;
  return {
    titulo: `Asalto ${c.asalto} · ${enc.nombre}`, atras: `#/encuentro/${enc.id}`, sinNav: true, html, pie,
    acciones: `<button class="icono" data-a="menuCombate" aria-label="Más opciones">${ic(IC.puntos)}</button>`
  };
};

VISTAS.personajes = () => {
  const lista = E.personajes.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const html = `<button class="btn primario ancho" data-a="nuevoPJ">${ic(IC.mas)} Nuevo personaje</button>
  ${lista.length ? `<div class="lista">${lista.map(pj => `<a class="fila" href="#/personaje/${pj.id}"><div class="f-txt"><div class="f-tit">${esc(pj.nombre)}</div>
    <div class="f-sub">${esc([pj.clase, 'nivel ' + (pj.nivel || 1), pj.jugador && 'jugado por ' + pj.jugador].filter(Boolean).join(' · '))}</div></div>
    <div class="f-vd">CA ${pj.ca ?? '—'} · PG ${pj.pgMax ?? '—'}</div></a>`).join('')}</div>`
    : `<p class="vacio">Crea un perfil para cada jugador de tu mesa.<br>Luego podrás añadirlos a cualquier encuentro.</p>`}`;
  return { titulo: 'Personajes', html };
};

function resumenIniPJ(pj) {
  const partes = [];
  if (pj.iniDes !== false) partes.push(`Des ${signo(modDe(pj.des))}`);
  if (pj.iniBC) partes.push(`BC ${signo(bcDeNivel(pj.nivel))}`);
  if (pj.iniExtra) partes.push(`otros ${signo(pj.iniExtra)}`);
  const total = (pj.iniDes !== false ? modDe(pj.des) : 0) + (pj.iniBC ? bcDeNivel(pj.nivel) : 0) + (pj.iniExtra || 0);
  return `Iniciativa: d20 ${signo(total)}${partes.length ? ` (${partes.join(', ')})` : ''}`;
}
VISTAS.personaje = id => {
  const pj = pjPorId(id); if (!pj) return null;
  const campo = (k, etiqueta, tipo = 'text', extra = '') => `<label class="campo"><span>${etiqueta}</span><input data-in="pj" data-ch="pjSync" data-k="${k}" type="${tipo}" ${tipo === 'number' ? 'inputmode="numeric"' : ''} value="${esc(pj[k] ?? '')}" ${extra}></label>`;
  const html = `
    ${campo('nombre', 'Nombre del personaje')}
    ${campo('jugador', 'Jugador (opcional)')}
    <div class="fila2">${campo('clase', 'Clase y especie', 'text', 'placeholder="p. ej. Pícaro elfo"')}${campo('nivel', 'Nivel', 'number', 'min="1" max="20"')}</div>
    <div class="fila3">${campo('ca', 'CA', 'number')}${campo('pgMax', 'PG máximos', 'number')}${campo('des', 'Destreza', 'number', 'placeholder="puntuación"')}</div>
    <p class="nota" id="pj-calc">Mod. de Destreza ${signo(modDe(pj.des))} · Bonificador por competencia ${signo(bcDeNivel(pj.nivel))}</p>
    <section class="bloque"><h2 style="font-size:1rem;margin:0 0 4px">Cómo se calcula su iniciativa</h2>
      <label class="check"><input type="checkbox" data-ch="pjchk" data-k="iniDes" ${pj.iniDes !== false ? 'checked' : ''}> Sumar el modificador de Destreza</label>
      <label class="check"><input type="checkbox" data-ch="pjchk" data-k="alerta" ${pj.alerta ? 'checked' : ''}> Tiene la dote <b>Alerta</b> (suma su BC y puede intercambiar la iniciativa con un aliado)</label>
      <label class="check"><input type="checkbox" data-ch="pjchk" data-k="iniBC" ${pj.iniBC ? 'checked' : ''}> Sumar el bonificador por competencia</label>
      ${campo('iniExtra', 'Otros bonificadores a la iniciativa', 'number', 'placeholder="0"')}
      <p class="nota" id="pj-ini">${esc(resumenIniPJ(pj))}</p>
    </section>
    <section class="bloque">
      <div class="bloque-cab"><h2>Conjuros <span class="cuenta">${(pj.conjuros || []).length}</span></h2><button class="btn peq" data-a="elegirConjuros" data-id="${pj.id}">${ic(IC.mas)} Añadir</button></div>
      <div id="pj-conjuros">${htmlListaConjPJ(pj)}</div>
    </section>
    ${campo('pasiva', 'Percepción pasiva (opcional)', 'number')}
    <label class="campo"><span>Notas</span><textarea data-in="pj" data-k="notas" rows="3">${esc(pj.notas || '')}</textarea></label>
    <button class="btn ancho peligro-suave" data-a="borrarPJ" data-id="${pj.id}">Borrar personaje</button>`;
  return { titulo: pj.nombre || 'Personaje', atras: '#/personajes', html };
};

// ---- Bestiario ----
const FB = { q: '', cat: 'todos', tipo: '', vdMin: '', vdMax: '' };
function filtrarMons(f) {
  const q = norm(f.q).trim();
  const palabras = q ? q.split(/\s+/) : [];
  return MONS.filter(m =>
    (f.cat === 'todos' || m.categoria === f.cat) &&
    (!f.tipo || m.tipo === f.tipo) &&
    (f.vdMin === '' || m._vd >= vdNum(f.vdMin)) &&
    (f.vdMax === '' || m._vd <= vdNum(f.vdMax)) &&
    palabras.every(w => m._n.includes(w))
  ).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
function htmlFiltros(f, clave) {
  const sel = (k, opts, vacio) => `<select data-in="${clave}" data-k="${k}"><option value="">${vacio}</option>${opts.map(o => `<option value="${esc(o)}" ${f[k] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  return `<div class="buscador">
    <input type="search" data-in="${clave}" data-k="q" value="${esc(f.q)}" placeholder="Buscar por nombre o tipo…" autocomplete="off">
    <div class="seg" style="margin-top:6px">${[['todos', 'Todos'], ['monstruo', 'Monstruos'], ['animal', 'Animales']].map(([v, t]) => `<button class="opc ${f.cat === v ? 'on' : ''}" data-a="filtroCat" data-clave="${clave}" data-v="${v}">${t}</button>`).join('')}</div>
    <div class="filtros">${sel('tipo', TIPOS, 'Cualquier tipo')}${sel('vdMin', VDS, 'VD mín.')}${sel('vdMax', VDS, 'VD máx.')}</div>
  </div>`;
}
function htmlResultadosBest(f) {
  const r = filtrarMons(f);
  return `<p class="resumen">${r.length} criatura${r.length === 1 ? '' : 's'}</p>
  ${r.length ? `<div class="lista">${r.map(m => `<a class="fila" href="#/monstruo/${m.id}"><div class="f-txt"><div class="f-tit">${esc(m.nombre)}</div><div class="f-sub">${esc(m.tipo)} ${esc(m.tamano)} · CA ${m.ca} · PG ${m.pg}</div></div><div class="f-vd">VD ${esc(m.vd)}</div></a>`).join('')}</div>` : `<p class="vacio">No hay resultados.</p>`}`;
}
VISTAS.bestiario = () => ({
  titulo: 'Bestiario', html: `${htmlFiltros(FB, 'fb')}<div id="res-fb">${htmlResultadosBest(FB)}</div>`
});

function htmlPerfil(m) {
  const c = m.campos;
  const campos = ['Habilidades', 'Vulnerabilidades', 'Resistencias', 'Inmunidades', 'Equipo', 'Sentidos', 'Idiomas']
    .filter(k => c[k]).map(k => `<p><b>${k}:</b> ${c[k]}</p>`).join('');
  const otros = Object.keys(c).filter(k => !['Velocidad', 'Habilidades', 'Vulnerabilidades', 'Resistencias', 'Inmunidades', 'Equipo', 'Sentidos', 'Idiomas'].includes(k))
    .map(k => `<p><b>${esc(k)}:</b> ${c[k]}</p>`).join('');
  const cars = m.car.map((x, i) => `<div class="car"><b>${CARS[i]}</b><span class="v">${x.v}</span><span>${signo(x.mod)}</span><span class="salv">${signo(x.salv)}</span></div>`).join('');
  const secs = m.secciones.map(s => `<h4>${esc(s.titulo)}</h4>${s.intro ? `<p class="p-intro">${enlazarConjuros(s.intro)}</p>` : ''}${s.entradas.map(e => `<p><b><i>${esc(e.nombre)}.</i></b> ${enlazarConjuros(e.html)}</p>`).join('')}`).join('');
  return `<div class="perfil">
    <p class="p-tipo">${esc(m.tipo)} ${esc(m.tamano)}${m.alineamiento ? ', ' + esc(m.alineamiento) : ''}</p>
    <div class="p-linea"></div>
    <p><b>CA:</b> ${esc(m.caTexto || m.ca)} &nbsp; <b>Iniciativa:</b> ${signo(m.ini)} (${10 + (m.ini || 0)})</p>
    <p><b>PG:</b> ${m.pg}${m.pgDados ? ` (${esc(m.pgDados)})` : ''}</p>
    ${c.Velocidad ? `<p><b>Velocidad:</b> ${c.Velocidad}</p>` : ''}
    <div class="p-linea"></div>
    <div class="cars-cab"><span>MOD · SALV</span><span>MOD · SALV</span><span>MOD · SALV</span></div>
    <div class="cars">${cars}</div>
    <div class="p-linea"></div>
    ${campos}${otros}
    <p><b>VD:</b> ${esc(m.vd)} (${fmt(m.px)} PX; BC ${signo(m.bc)})</p>
    <div class="p-linea"></div>
    ${secs}
    <p class="licencia">SRD 5.2.1, pág. ${m.pagina}.</p>
  </div>`;
}
VISTAS.monstruo = id => {
  const m = MON.get(id); if (!m) return null;
  return {
    titulo: m.nombre, atras: '#/bestiario', html: htmlPerfil(m),
    pie: `<button class="btn primario grande" data-a="monAEncuentro" data-id="${m.id}">${ic(IC.mas)} Añadir a un encuentro</button>`
  };
};

VISTAS.estados = () => ({
  titulo: 'Estados',
  html: `<p class="nota">Los ${SRD.estados.length} estados del juego según el SRD 5.2.1. Toca uno para leer sus reglas.</p>
  ${SRD.estados.map(e => `<details class="regla"><summary>${esc(e.nombre)}</summary><div class="cuerpo">${e.html}</div></details>`).join('')}`
});

// ---- Conjuros ----
const FC = { q: '', nivel: '', clase: '', escuela: '' }; // pestaña Conjuros
const FP = { q: '', nivel: '', clase: '', escuela: '' }; // selector de conjuros de un personaje
function filtrarConjs(f) {
  const palabras = norm(f.q).trim().split(/\s+/).filter(Boolean);
  return CONJS.filter(c =>
    (f.nivel === '' || c.nivel === +f.nivel) &&
    (!f.clase || c.clases.includes(f.clase)) &&
    (!f.escuela || c.escuela === f.escuela) &&
    palabras.every(w => c._n.includes(w))
  ).sort(ordenConj);
}
function htmlFiltrosConj(f, clave, fija) {
  const sel = (k, opts, vacio) => `<select data-in="${clave}" data-k="${k}"><option value="">${vacio}</option>${opts.map(([v, t]) => `<option value="${esc(v)}" ${String(f[k]) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  return `<div class="buscador"${fija ? ' style="position:static"' : ''}>
    <input type="search" data-in="${clave}" data-k="q" value="${esc(f.q)}" placeholder="Buscar conjuro…" autocomplete="off">
    <div class="filtros">
      ${sel('nivel', [['0', 'Trucos'], ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => [String(n), 'Nivel ' + n])], 'Cualquier nivel')}
      ${sel('clase', CLASES_CONJ.map(c => [c, c.charAt(0).toUpperCase() + c.slice(1)]), 'Cualquier clase')}
      ${sel('escuela', ESCUELAS_CONJ.map(e => [e, e]), 'Cualquier escuela')}
    </div>
  </div>`;
}
const etiquetasConj = c => `${c.concentracion ? '<span class="etq">C</span>' : ''}${c.ritual ? '<span class="etq">R</span>' : ''}`;
function htmlResultadosConj(f) {
  const r = filtrarConjs(f);
  return `<p class="resumen">${r.length} conjuro${r.length === 1 ? '' : 's'} · <span class="etq">C</span> concentración · <span class="etq">R</span> ritual</p>
  ${r.length ? `<div class="lista">${r.map(c => `<a class="fila" href="#/conjuro/${c.id}"><div class="f-txt"><div class="f-tit">${esc(c.nombre)} ${etiquetasConj(c)}</div><div class="f-sub">${esc(c.escuela)} · ${esc(c.tiempo)} · ${esc(c.alcance)}</div></div><div class="f-vd">${nivelTxt(c.nivel)}</div></a>`).join('')}</div>` : `<p class="vacio">No hay resultados.</p>`}`;
}
function htmlConjuro(c) {
  return `<div class="perfil conjuro">
    <p class="p-tipo">${esc(c.tipo)}</p>
    <div class="p-linea"></div>
    <p><b>Tiempo de lanzamiento:</b> ${esc(c.tiempo)}</p>
    <p><b>Alcance:</b> ${esc(c.alcance)}</p>
    <p><b>Componentes:</b> ${esc(c.componentes)}</p>
    <p><b>Duración:</b> ${esc(c.duracion)}</p>
    <div class="p-linea"></div>
    <div class="regla-txt">${enlazarConjuros(c.html)}</div>
  </div>`;
}
VISTAS.conjuros = () => ({
  titulo: 'Conjuros', html: `${htmlFiltrosConj(FC, 'fc')}<div id="res-fc">${htmlResultadosConj(FC)}</div>`
});
VISTAS.conjuro = id => {
  const c = CONJ.get(id); if (!c) return null;
  return {
    titulo: c.nombre, atras: '#/conjuros', html: htmlConjuro(c),
    pie: `<button class="btn primario grande" data-a="conjAPJ" data-id="${c.id}">${ic(IC.mas)} Añadir a un personaje</button>`
  };
};
function hojaConjuro(id) {
  const c = CONJ.get(id); if (!c) return;
  abrirHoja(() => `<div class="hp-cab"><div><h3>${esc(c.nombre)}</h3><div class="sub">${nivelTxt(c.nivel)} · ${esc(c.escuela)}</div></div><button class="icono" data-a="cerrarHoja" aria-label="Cerrar">${ic(IC.cerrar)}</button></div>${htmlConjuro(c)}`, { fija: true });
}
// Añadir un conjuro (desde su ficha) a uno o varios personajes
function hojaConjAPJ(cid) {
  const c = CONJ.get(cid); if (!c) return;
  const lista = E.personajes.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  abrirHoja(() => `<div class="hp-cab"><div><h3>¿Quién conoce ${esc(c.nombre)}?</h3><div class="sub">Toca para añadirlo o quitarlo.</div></div><button class="icono" data-a="cerrarHoja" aria-label="Cerrar">${ic(IC.cerrar)}</button></div>
    ${lista.length ? `<div class="chips">${lista.map(pj => `<button class="chip ${(pj.conjuros || []).includes(c.id) ? 'on' : ''}" data-a="togConjPJ" data-pj="${pj.id}" data-id="${c.id}">${esc(pj.nombre)}</button>`).join('')}</div>`
      : `<p class="vacio">No tienes personajes guardados.</p>`}`);
}
// Elegir los conjuros de un personaje (desde su perfil)
function hojaElegirConjuros(pjId) {
  const pj = pjPorId(pjId); if (!pj) return;
  // Empezar filtrando por su clase (vale "maga", "bruja", "paladina"…)
  const palabras = norm(pj.clase).split(/\s+/);
  const cl = CLASES_CONJ.find(k => { const raiz = norm(k).replace(/[oa]$/, ''); return palabras.some(w => w.startsWith(raiz)); });
  Object.assign(FP, { q: '', nivel: '', escuela: '', clase: cl || '' });
  const h = abrirHoja(() => `<div class="hp-cab"><div><h3>Conjuros de ${esc(pj.nombre)}</h3><div class="sub">Toca un conjuro para añadirlo o quitarlo.</div></div><button class="icono" data-a="cerrarHoja" aria-label="Cerrar">${ic(IC.cerrar)}</button></div>
    ${htmlFiltrosConj(FP, 'fp', true)}<div id="res-fp">${htmlElegirConj(pj)}</div>`, { fija: true });
  h.pjId = pjId;
}
function htmlElegirConj(pj) {
  const tiene = new Set(pj.conjuros || []);
  const r = filtrarConjs(FP).slice(0, 120);
  return `<p class="resumen">${(pj.conjuros || []).length} elegidos</p>
  ${r.length ? `<div class="lista">${r.map(c => `<div class="fila"><button class="marca-conj ${tiene.has(c.id) ? 'on' : ''}" data-a="togConjPJ" data-pj="${pj.id}" data-id="${c.id}" aria-label="${tiene.has(c.id) ? 'Quitar' : 'Añadir'} ${esc(c.nombre)}">${tiene.has(c.id) ? '✓' : '+'}</button>
    <div class="f-txt" data-a="verConjuro" data-id="${c.id}"><div class="f-tit">${esc(c.nombre)} ${etiquetasConj(c)}</div><div class="f-sub">${nivelTxt(c.nivel)} · ${esc(c.escuela)}</div></div></div>`).join('')}</div>` : `<p class="vacio">No hay resultados.</p>`}`;
}
function htmlListaConjPJ(pj) {
  const lista = (pj.conjuros || []).map(id => CONJ.get(id)).filter(Boolean).sort(ordenConj);
  if (!lista.length) return `<p class="nota">Sin conjuros. Añádelos para consultarlos rápido durante el combate.</p>`;
  return `<div class="lista">${lista.map(c => `<div class="fila"><div class="f-txt" data-a="verConjuro" data-id="${c.id}"><div class="f-tit">${esc(c.nombre)} ${etiquetasConj(c)}</div><div class="f-sub">${nivelTxt(c.nivel)} · ${esc(c.escuela)}</div></div>
    <button class="icono peq" data-a="togConjPJ" data-pj="${pj.id}" data-id="${c.id}" aria-label="Quitar ${esc(c.nombre)}">${ic(IC.cerrar)}</button></div>`).join('')}</div>`;
}

// ---- Intercambio de iniciativa (dote Alerta) ----
const incapacitado = p => p.pg === 0 || p.estados.some(s => INCAPACITANTES.has(s.id));
function hojaIntercambio(pid) {
  const enc = encActual(); const a = partPorId(enc, pid); if (!a) return;
  const h = abrirHoja(() => {
    const ta = totalIni(a);
    const cands = enc.participantes.filter(p => p.id !== a.id && (p.tipo === 'pj' || p.aliado) && !p.derrotado);
    const filas = cands.map(b => {
      const tb = totalIni(b);
      const motivo = tb == null ? 'sin iniciativa' : incapacitado(b) ? 'incapacitado' : '';
      return `<button class="fila" data-a="intercambiarCon" data-pid="${b.id}" ${motivo || ta == null || incapacitado(a) ? 'disabled' : ''}>
        <div class="f-txt"><div class="f-tit">${esc(b.nombre)}</div><div class="f-sub">${motivo ? esc(motivo) : `Quedaría ${esc(a.nombre)} con ${tb} y ${esc(b.nombre)} con ${ta}`}</div></div>
        <div class="f-vd">Ini ${tb ?? '—'}</div></button>`;
    }).join('');
    return `<div class="hp-cab"><div><h3>⇄ Intercambiar iniciativa</h3><div class="sub">${esc(a.nombre)} tiene la dote Alerta (iniciativa ${ta ?? '—'}). Puede cambiarla con un aliado voluntario.</div></div><button class="icono" data-a="cerrarHoja" aria-label="Cerrar">${ic(IC.cerrar)}</button></div>
      ${ta == null ? '<p class="aviso">Escribe primero su tirada de iniciativa.</p>' : incapacitado(a) ? '<p class="aviso">No puede: está incapacitado.</p>' : ''}
      ${cands.length ? `<div class="lista">${filas}</div>` : '<p class="vacio">No hay aliados en el encuentro.</p>'}`;
  }, { fija: true });
  h.pidA = pid;
}
function intercambiarIni(enc, a, b) {
  const ta = totalIni(a), tb = totalIni(b);
  a.ini.manual = tb; b.ini.manual = ta;
  a.ini.cambio = b.nombre; b.ini.cambio = a.nombre;
  if (enc.combate) {
    const o = enc.combate.orden; const i = o.indexOf(a.id), j = o.indexOf(b.id);
    if (i >= 0 && j >= 0) [o[i], o[j]] = [o[j], o[i]];
    registrar(enc, `${a.nombre} intercambia la iniciativa con ${b.nombre} (${ta} ↔ ${tb})`);
  }
  return [ta, tb];
}

VISTAS.ajustes = () => ({
  titulo: 'Ajustes', atras: '#/encuentros',
  html: `
  <section class="bloque"><h2 style="font-size:1rem">Pantalla</h2>
    <label class="check"><input type="checkbox" data-ch="ajPantalla" ${E.ajustes.pantalla !== false ? 'checked' : ''}> Mantener la pantalla encendida durante el combate</label>
  </section>
  <section class="bloque"><h2 style="font-size:1rem">Copia de seguridad</h2>
    <p class="nota">Tus personajes y encuentros se guardan solo en este teléfono. Haz una copia de vez en cuando (por ejemplo, en Google Drive) por si cambias de móvil o borras los datos del navegador.</p>
    <div class="botonera">
      <button class="btn" data-a="exportar">Guardar copia</button>
      <label class="btn">Restaurar copia<input type="file" accept=".json,application/json" data-ch="importar" hidden></label>
    </div>
  </section>
  <section class="bloque"><h2 style="font-size:1rem">Datos</h2>
    <p class="nota">${E.personajes.length} personajes · ${E.encuentros.length} encuentros guardados.</p>
    <button class="btn peligro-suave" data-a="borrarTodo">Borrar todos los datos</button>
  </section>
  <section class="bloque"><h2 style="font-size:1rem">Licencia</h2>
    <p class="licencia">Esta obra incluye material procedente del documento de referencia del sistema 5.2.1 («SRD 5.2.1») de Wizards of the Coast LLC, disponible en https://www.dndbeyond.com/srd. La licencia sobre el SRD 5.2.1 se concede de acuerdo con la licencia internacional de atribución/reconocimiento 4.0 de Creative Commons, disponible en https://creativecommons.org/licenses/by/4.0/legalcode.</p>
    <p class="licencia">Compatible con la quinta edición. Versión de la app: 1.0</p>
  </section>`
});

// ============ Hojas concretas ============
// ---- Lo que necesita el máster de un enemigo en pleno combate ----
function filaAccion(e, k) {
  const a = analizarEntrada(e);
  const chips = [];
  if (a.ataque) {
    const tipo = a.ataque.tipo === 'cuerpo a cuerpo' ? 'Cuerpo a cuerpo' : a.ataque.tipo === 'a distancia' ? 'A distancia' : 'CaC o distancia';
    chips.push(`<span class="ach at">${esc(a.ataque.bono)} · ${tipo}${a.ataque.alcance ? ' · ' + esc(a.ataque.alcance) : ''}</span>`);
    if (a.ataque.nota) chips.push(`<span class="ach nota">${esc(a.ataque.nota.charAt(0).toUpperCase() + a.ataque.nota.slice(1))}</span>`);
  }
  if (a.ts) chips.push(`<span class="ach ts">TS ${esc(a.ts.car)} CD ${a.ts.cd}</span>`);
  for (const d of a.danos) chips.push(`<span class="ach dano">${d.media}${d.dados ? ` (${esc(d.dados)})` : ''} ${esc(d.tipo)}</span>`);
  const nConj = new Set([...e.html.matchAll(/<em>([^<]+)<\/em>/g)].map(x => CONJ_N.get(norm(x[1]).trim().replace(/[.,;:]+$/, ''))).filter(Boolean)).size;
  if (nConj) chips.push(`<span class="ach conj">${nConj} conjuro${nConj === 1 ? '' : 's'}</span>`);
  return `<details class="accion" data-k="acc-${k}"><summary><span class="acc-nom">${esc(e.nombre)}</span>${chips.length ? `<span class="acc-chips">${chips.join('')}</span>` : ''}</summary>
    <div class="acc-txt"><p>${enlazarConjuros(e.html)}</p></div></details>`;
}
function htmlCombateMonstruo(m) {
  const salv = m.car.map((x, i) => `<span class="salv-chip${x.salv !== x.mod ? ' comp' : ''}"><b>${CARS[i]}</b>${signo(x.salv)}</span>`).join('');
  const limpio = s => String(s || '').replace(/<[^>]+>/g, '');
  const defensas = [['Vulnerable', m.campos.Vulnerabilidades], ['Resiste', m.campos.Resistencias], ['Inmune', m.campos.Inmunidades]]
    .filter(([, v]) => v).map(([k, v]) => `<p class="defensa"><b>${k}:</b> ${esc(limpio(v))}</p>`).join('');
  const secciones = m.secciones.map((s, si) => `<details class="sec-mon" data-k="sec-${si}"${s.titulo === 'Acciones' ? ' open' : ''}>
    <summary>${esc(s.titulo)} <span class="cuenta">${s.entradas.length}</span></summary>
    ${s.intro ? `<p class="p-intro">${enlazarConjuros(s.intro)}</p>` : ''}
    ${s.entradas.map((e, ei) => filaAccion(e, `${si}-${ei}`)).join('')}</details>`).join('');
  return `<div class="hp-sec panel-mon">
    <div class="salvs" aria-label="Tiradas de salvación"><span class="salv-tit">Salvaciones</span>${salv}</div>
    ${m.campos.Velocidad ? `<p class="defensa"><b>Velocidad:</b> ${esc(limpio(m.campos.Velocidad))}</p>` : ''}
    ${defensas}
    ${secciones}
  </div>`;
}
function htmlConjurosPJ(pj) {
  const ids = (pj && pj.conjuros) || [];
  const lista = ids.map(id => CONJ.get(id)).filter(Boolean).sort(ordenConj);
  if (!lista.length) return '';
  return `<details class="sec-mon" data-k="conj-pj" open><summary>Conjuros <span class="cuenta">${lista.length}</span></summary>
    <div class="chips conj-chips">${lista.map(c => `<button class="chip conj" data-a="verConjuro" data-id="${c.id}"><small>${c.nivel === 0 ? 'T' : c.nivel}</small>${esc(c.nombre)}${c.concentracion ? ' <em>C</em>' : ''}</button>`).join('')}</div></details>`;
}

function hojaParticipante(pid) {
  const encId = ruta().id;
  abrirHoja(() => {
    const enc = encPorId(encId); const p = partPorId(enc, pid);
    if (!p || !enc.combate) return null;
    const m = p.tipo === 'monstruo' && MON.get(p.ref);
    const pct = p.pgMax ? p.pg / p.pgMax * 100 : 0;
    const filasEst = p.estados.map(s => {
      const cuenta = s.cuentaEn && s.cuentaEn !== p.id ? partPorId(enc, s.cuentaEn) : null;
      const dur = s.rondas != null ? `Quedan ${s.rondas} · se descuenta al ${s.momento === 'inicio' ? 'inicio' : 'final'} del turno de ${cuenta ? esc(cuenta.nombre) : 'la criatura'}` : 'Sin límite de tiempo';
      const ctrl = s.id === 'cansancio'
        ? `<button class="icono peq" data-a="estNivel" data-pid="${p.id}" data-uid="${s.uid}" data-d="-1">−</button><b>${s.nivel || 1}</b><button class="icono peq" data-a="estNivel" data-pid="${p.id}" data-uid="${s.uid}" data-d="1">+</button>`
        : s.rondas != null ? `<button class="icono peq" data-a="estRondas" data-pid="${p.id}" data-uid="${s.uid}" data-d="-1">−</button><b>${s.rondas}</b><button class="icono peq" data-a="estRondas" data-pid="${p.id}" data-uid="${s.uid}" data-d="1">+</button>` : '';
      return `<div class="fila-est"><div class="est-txt">${EST.has(s.id) ? `<button class="est-nom" data-a="verEstado" data-id="${s.id}">${esc(s.nombre)}</button>` : `<b>${esc(s.nombre)}</b>`}${s.id === 'cansancio' ? ` (nivel ${s.nivel || 1})` : ''}
        <span class="est-dur">${dur}${s.ts ? ` · TS de ${CARS_LARGO[s.ts.car]}${s.ts.cd ? ' CD ' + s.ts.cd : ''}` : ''}${s.nota ? ' · ' + esc(s.nota) : ''}</span></div>
        <div class="est-acc">${ctrl}<button class="icono peq" data-a="quitarEstado" data-pid="${p.id}" data-uid="${s.uid}" aria-label="Quitar estado">${ic(IC.cerrar)}</button></div></div>`;
    }).join('');
    const muerte = p.tipo === 'pj' && p.pg === 0 ? `<div class="muerte">
      <div class="ms-fila"><span>Éxitos</span>${[0, 1, 2].map(i => `<button class="ms ok ${i < p.muerte.ok ? 'on' : ''}" data-a="msMarcar" data-pid="${p.id}" data-k="ok" data-n="${i}" aria-label="Éxito ${i + 1}"></button>`).join('')}</div>
      <div class="ms-fila"><span>Fallos</span>${[0, 1, 2].map(i => `<button class="ms ko ${i < p.muerte.ko ? 'on' : ''}" data-a="msMarcar" data-pid="${p.id}" data-k="ko" data-n="${i}" aria-label="Fallo ${i + 1}"></button>`).join('')}</div>
      <p class="nota" style="margin:4px 0 0">${p.muerte.ko >= 3 ? 'Ha muerto.' : p.estable ? 'Estable: ya no hace tiradas contra muerte.' : 'Tiradas de salvación contra muerte: 10 o más es un éxito. Con un 20 natural recupera 1 PG (usa Curar 1).'}</p>
    </div>` : '';
    return `
    <div class="hp-cab"><div><h3>${esc(p.nombre)}</h3><div class="sub">${esc(tipoTexto(p))} · CA ${p.ca ?? '—'} · Ini ${totalIni(p) ?? '—'}</div></div><button class="icono" data-a="cerrarHoja" aria-label="Cerrar">${ic(IC.cerrar)}</button></div>
    <div class="pg-grande ${p.pg === 0 ? 'cero' : ''}"><span class="n">${p.pg}</span><span class="de">/ ${p.pgMax} PG</span>${p.pgTemp ? `<span class="temp">+${p.pgTemp} temporales</span>` : ''}</div>
    <div class="barra ${p.pg === 0 ? 'cero' : pct <= 25 ? 'critico' : pct <= 50 ? 'herido' : ''}" style="margin-bottom:12px"><i style="width:${Math.min(100, pct)}%"></i></div>
    <div class="pg-acc">
      <input class="cant" id="cant" type="number" inputmode="numeric" min="0" placeholder="Cantidad">
      <button class="btn peligro" data-a="pgAccion" data-q="danio" data-pid="${p.id}">Daño</button>
      <button class="btn ok" data-a="pgAccion" data-q="curar" data-pid="${p.id}">Curar</button>
      <button class="btn" data-a="pgAccion" data-q="temp" data-pid="${p.id}">Temp.</button>
    </div>
    ${muerte}
    ${m ? htmlCombateMonstruo(m) : ''}
    ${p.tipo === 'pj' ? htmlConjurosPJ(pjPorId(p.ref)) : ''}
    <div class="hp-sec"><div class="bloque-cab"><h4>Estados</h4><button class="btn peq" data-a="anadirEstado" data-pid="${p.id}">${ic(IC.mas)} Estado</button></div>
      ${filasEst || '<p class="nota">Sin estados.</p>'}</div>
    <div class="toggles">
      <button class="tog ${p.conc ? 'on' : ''}" data-a="togConc" data-pid="${p.id}">Concentración</button>
      <button class="tog ${p.reaccion ? 'on' : ''}" data-a="togReac" data-pid="${p.id}">Reacción usada</button>
      ${p.leg ? `<div class="leg"><span>Acc. legendarias</span><button data-a="leg" data-pid="${p.id}" data-d="1" aria-label="Gastar uso">−</button><b>${p.leg.max - p.leg.usadas}/${p.leg.max}</b><button data-a="leg" data-pid="${p.id}" data-d="-1" aria-label="Recuperar uso">+</button></div>` : ''}
    </div>
    <label class="campo"><span>Notas</span><textarea data-in="partNotas" data-pid="${p.id}" rows="2" placeholder="Apuntes rápidos…">${esc(p.notas || '')}</textarea></label>
    <div class="botonera">
      ${m ? `<button class="btn peq" data-a="verPerfil" data-id="${m.id}">Ver perfil completo</button>` : ''}
      ${p.alerta ? `<button class="btn peq" data-a="intercambiar" data-pid="${p.id}">⇄ Intercambiar iniciativa</button>` : ''}
      <button class="btn peq" data-a="editarPart" data-pid="${p.id}">Editar</button>
      ${p.tipo !== 'pj' ? `<button class="btn peq" data-a="togDerrotado" data-pid="${p.id}">${p.derrotado ? 'Devolver al combate' : 'Marcar derrotado'}</button>` : ''}
      <button class="btn peq peligro-suave" data-a="quitarPart" data-pid="${p.id}">Quitar</button>
    </div>`;
  });
}

function hojaPerfil(id) {
  const m = MON.get(id); if (!m) return;
  abrirHoja(() => `<div class="hp-cab"><div><h3>${esc(m.nombre)}</h3></div><button class="icono" data-a="cerrarHoja" aria-label="Cerrar">${ic(IC.cerrar)}</button></div>${htmlPerfil(m)}`, { fija: true });
}
function hojaReglaEstado(id) {
  const e = EST.get(id); if (!e) return;
  abrirHoja(() => `<div class="hp-cab"><div><h3>${esc(e.nombre)}</h3></div><button class="icono" data-a="cerrarHoja" aria-label="Cerrar">${ic(IC.cerrar)}</button></div><div class="regla-txt">${e.html}</div>`, { fija: true });
}

function hojaAnadirPJs() {
  const enc = encActual(); if (!enc) return;
  const ya = new Set(enc.participantes.filter(p => p.tipo === 'pj').map(p => p.ref));
  const lista = E.personajes.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const h = abrirHoja(() => `<div class="hp-cab"><div><h3>Añadir jugadores</h3></div><button class="icono" data-a="cerrarHoja" aria-label="Cerrar">${ic(IC.cerrar)}</button></div>
    ${lista.length ? `<div class="chips">${lista.map(pj => `<button class="chip ${ya.has(pj.id) ? '' : 'on'}" data-a="selChip" data-id="${pj.id}" ${ya.has(pj.id) ? 'disabled title="Ya está en el encuentro"' : ''}>${esc(pj.nombre)}${ya.has(pj.id) ? ' ✓' : ''}</button>`).join('')}</div>
      <button class="btn primario ancho" data-a="pjsOk" style="margin-top:14px">Añadir seleccionados</button>`
      : `<p class="vacio">No tienes personajes guardados.</p><button class="btn primario ancho" data-a="ir" data-h="#/personajes">Ir a Personajes</button>`}`, { fija: true });
  h.encId = enc.id;
}

const FA = { q: '', cat: 'todos', tipo: '', vdMin: '', vdMax: '' };
let cantidadMon = 1;
function htmlResultadosAnadir() {
  const r = filtrarMons(FA).slice(0, 80);
  return r.length ? `<div class="lista">${r.map(m => `<div class="fila"><div class="f-txt" data-a="verPerfil" data-id="${m.id}"><div class="f-tit">${esc(m.nombre)}</div><div class="f-sub">${esc(m.tipo)} · VD ${esc(m.vd)} · CA ${m.ca} · PG ${m.pg}</div></div>
    <button class="btn peq primario" data-a="monAnadir" data-id="${m.id}" aria-label="Añadir ${esc(m.nombre)}">${ic(IC.mas)}</button></div>`).join('')}</div>` : `<p class="vacio">No hay resultados.</p>`;
}
function hojaAnadirMon() {
  const enc = encActual(); if (!enc) return;
  cantidadMon = 1;
  const h = abrirHoja(() => `<div class="hp-cab"><div><h3>Añadir monstruo o animal</h3><div class="sub">Toca el nombre para ver su perfil y <b>+</b> para añadirlo.</div></div><button class="icono" data-a="cerrarHoja" aria-label="Cerrar">${ic(IC.cerrar)}</button></div>
    <div class="leg" style="justify-content:space-between;margin:6px 0"><span>Cantidad a añadir</span><span style="display:flex;align-items:center;gap:6px"><button data-a="cantMon" data-d="-1">−</button><b id="cant-mon">${cantidadMon}</b><button data-a="cantMon" data-d="1">+</button></span></div>
    ${htmlFiltros(FA, 'fa').replace('class="buscador"', 'class="buscador" style="position:static"')}
    <div id="res-fa">${htmlResultadosAnadir()}</div>`, { fija: true });
  h.encId = enc.id;
}

function hojaOtro() {
  const enc = encActual(); if (!enc) return;
  const h = abrirHoja(() => `<div class="hp-cab"><div><h3>Criatura personalizada</h3><div class="sub">Para PNJ, aliados o criaturas que no están en el bestiario.</div></div><button class="icono" data-a="cerrarHoja" aria-label="Cerrar">${ic(IC.cerrar)}</button></div>
    <label class="campo"><span>Nombre</span><input id="o-nombre" placeholder="p. ej. Capitán Varn"></label>
    <div class="fila3"><label class="campo"><span>CA</span><input id="o-ca" type="number" inputmode="numeric"></label>
    <label class="campo"><span>PG</span><input id="o-pg" type="number" inputmode="numeric"></label>
    <label class="campo"><span>Mod. iniciativa</span><input id="o-ini" type="number" inputmode="numeric" placeholder="0"></label></div>
    <div class="fila2"><label class="campo"><span>Cantidad</span><input id="o-cant" type="number" inputmode="numeric" value="1" min="1"></label>
    <label class="campo"><span>PX (opcional)</span><input id="o-px" type="number" inputmode="numeric"></label></div>
    <label class="check"><input type="checkbox" id="o-aliado"> Es un aliado de los jugadores</label>
    <button class="btn primario ancho" data-a="otroOk">Añadir</button>`, { fija: true });
  h.encId = enc.id;
}

function hojaEditar(pid) {
  const enc = encActual(); const p = partPorId(enc, pid); if (!p) return;
  const f = (id, etiqueta, valor, extra = '') => `<label class="campo"><span>${etiqueta}</span><input id="${id}" type="number" inputmode="numeric" value="${valor ?? ''}" ${extra}></label>`;
  const h = abrirHoja(() => `<div class="hp-cab"><div><h3>Editar</h3><div class="sub">${esc(tipoTexto(p))}</div></div><button class="icono" data-a="cerrarHoja" aria-label="Cerrar">${ic(IC.cerrar)}</button></div>
    <label class="campo"><span>Nombre</span><input id="e-nombre" value="${esc(p.nombre)}"></label>
    <div class="fila3">${f('e-ca', 'CA', p.ca)}${f('e-pgmax', 'PG máx.', p.pgMax)}${f('e-pg', 'PG actuales', p.pg)}</div>
    <div class="fila3">${f('e-temp', 'PG temp.', p.pgTemp)}${p.tipo === 'pj' ? f('e-nivel', 'Nivel', p.nivel, 'min="1" max="20"') : f('e-px', 'PX', p.px)}${f('e-des', 'Mod. Des', p.desMod)}</div>
    <h4 style="margin:14px 0 0">Iniciativa</h4>
    <div class="fila3">${f('e-tirada', 'Tirada d20', p.ini.tirada)}${f('e-bc', 'BC', p.bc)}${f('e-extra', 'Otros', p.ini.extra)}</div>
    <label class="check"><input type="checkbox" id="e-usardes" ${p.ini.usarDes ? 'checked' : ''}> Sumar Destreza</label>
    <label class="check"><input type="checkbox" id="e-usarbc" ${p.ini.usarBC ? 'checked' : ''}> Sumar bonificador por competencia</label>
    ${f('e-manual', 'Iniciativa total a mano (déjalo vacío para calcularla)', p.ini.manual)}
    ${p.tipo !== 'pj' ? `<label class="check"><input type="checkbox" id="e-aliado" ${p.aliado ? 'checked' : ''}> Es un aliado de los jugadores (no cuenta para la dificultad)</label>` : ''}
    <button class="btn primario ancho" data-a="editarOk">Guardar cambios</button>`, { fija: true });
  h.encId = enc.id; h.pid = pid; h.nombreOriginal = p.nombre;
}

function hojaEstado(pidInicial) {
  const enc = encActual(); if (!enc) return;
  const ps = enc.participantes;
  const h = abrirHoja(() => `<div class="hp-cab"><div><h3>Añadir estado</h3></div><button class="icono" data-a="cerrarHoja" aria-label="Cerrar">${ic(IC.cerrar)}</button></div>
    <div class="rejilla-est" id="fe-estados">${SRD.estados.map(e => `<button class="opc" data-a="feEst" data-id="${e.id}">${esc(e.nombre)}</button>`).join('')}<button class="opc" data-a="feEst" data-id="otro">Otro efecto…</button></div>
    <label class="campo oculto" id="fe-otro"><span>Nombre del efecto</span><input id="fe-nombre" placeholder="p. ej. Bendecido, Marca del cazador, Ardiendo"></label>
    <label class="campo oculto" id="fe-nivel"><span>Nivel de cansancio</span><select id="fe-niv">${[1, 2, 3, 4, 5, 6].map(n => `<option>${n}</option>`).join('')}</select></label>
    <div class="campo"><span>Duración (en turnos)</span>
      <div class="seg" id="fe-dur">${[['', 'Sin límite'], ['1', '1'], ['2', '2'], ['3', '3'], ['10', '10 (1 min)']].map(([v, t], i) => `<button class="opc ${i === 0 ? 'on' : ''}" data-a="feDur" data-v="${v}">${t}</button>`).join('')}</div>
      <input class="cant" id="fe-rondas" type="number" inputmode="numeric" min="1" placeholder="Otro número de turnos"></div>
    <div class="fila2">
      <label class="campo"><span>Se descuenta al</span><select id="fe-mom"><option value="fin">final del turno</option><option value="inicio">inicio del turno</option></select></label>
      <label class="campo"><span>de</span><select id="fe-cuenta"><option value="">la propia criatura</option>${ps.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}</select></label>
    </div>
    <div class="fila2">
      <label class="campo"><span>TS al final de su turno</span><select id="fe-ts"><option value="">No repite tirada</option>${CARS.map(c => `<option value="${c}">${CARS_LARGO[c]}</option>`).join('')}</select></label>
      <label class="campo"><span>CD</span><input id="fe-cd" type="number" inputmode="numeric" placeholder="p. ej. 14"></label>
    </div>
    <label class="campo"><span>Nota (origen, opcional)</span><input id="fe-nota" placeholder="p. ej. Conjuro de Elara"></label>
    <div class="campo"><span>Aplicar a</span><div class="chips" id="fe-obj">${ps.filter(p => !p.derrotado || p.id === pidInicial).map(p => `<button class="chip ${p.id === pidInicial ? 'on' : ''}" data-a="selChip" data-id="${p.id}">${esc(p.nombre)}</button>`).join('')}</div></div>
    <button class="btn primario ancho" data-a="feOk">Añadir estado</button>`, { fija: true });
  h.encId = enc.id; h.estadoSel = null;
}

function hojaArea() {
  const enc = encActual(); if (!enc || !enc.combate) return;
  const ps = enc.combate.orden.map(id => partPorId(enc, id)).filter(p => p && !p.derrotado);
  const h = abrirHoja(() => `<div class="hp-cab"><div><h3>Daño en área</h3><div class="sub">Marca a los afectados. «½» aplica la mitad (por ejemplo, si superan la tirada de salvación).</div></div><button class="icono" data-a="cerrarHoja" aria-label="Cerrar">${ic(IC.cerrar)}</button></div>
    <input class="cant" id="ar-cant" type="number" inputmode="numeric" min="0" placeholder="Cantidad de daño o curación">
    <div style="margin:10px 0">${ps.map(p => `<div class="objetivo"><button class="chip" data-a="selChip" data-id="${p.id}">Afectado</button><span class="o-nom">${esc(p.nombre)}</span><button class="chip" data-a="toggleOn" data-mitad="${p.id}">½</button></div>`).join('')}</div>
    <div class="botonera"><button class="btn peligro" data-a="areaOk" data-q="danio" style="flex:1">Aplicar daño</button><button class="btn ok" data-a="areaOk" data-q="curar" style="flex:1">Aplicar curación</button></div>`, { fija: true });
  h.encId = enc.id;
}

// Iniciativa de los que se unen a un combate ya empezado (oleadas, refuerzos…)
const textoTotalNuevo = p => p.ini.manual != null ? String(p.ini.manual)
  : p.ini.tirada != null ? String(p.ini.tirada + modIni(p)) : `${10 + modIni(p)}<small> fija</small>`;
function filaIniNuevo(p) {
  return `<div class="fila-prep ${p.tipo}${p.aliado ? ' aliado' : ''}">
    <div class="fp-cab"><span class="fp-nom">${esc(p.nombre)}</span><span class="fp-stats">CA ${p.ca ?? '—'} · PG ${p.pgMax}</span></div>
    <div class="fp-ini">
      <label class="d20"><span>d20</span><input type="number" inputmode="numeric" enterkeyhint="next" data-in="tiradaNuevo" data-pid="${p.id}" value="${p.ini.tirada ?? ''}" placeholder="—"></label>
      <button class="chip ${p.ini.usarDes ? 'on' : ''}" data-a="togNuevo" data-k="usarDes" data-pid="${p.id}">Des ${signo(p.desMod)}</button>
      <button class="chip ${p.ini.usarBC ? 'on' : ''}" data-a="togNuevo" data-k="usarBC" data-pid="${p.id}">BC ${signo(p.bc)}</button>
      ${p.ini.extra ? `<span class="chip fijo">Otros ${signo(p.ini.extra)}</span>` : ''}
      <span class="ini-total" data-tn="${p.id}">${textoTotalNuevo(p)}</span>
    </div>
  </div>`;
}
function hojaIniNuevos(encId, nuevos, aplicar, despues) {
  if (!nuevos.length) return;
  const h = abrirHoja(() => `<div class="hp-cab"><div><h3>Iniciativa de los que llegan</h3><div class="sub">Escribe lo que saca cada uno en el d20. Si lo dejas vacío, se usa la iniciativa fija (10 + mod.).</div></div><button class="icono" data-a="cerrarHoja" aria-label="Cancelar">${ic(IC.cerrar)}</button></div>
    ${nuevos.length > 1 ? `<button class="btn peq" data-a="iniCopiar">Copiar la primera tirada a todos</button>` : ''}
    ${nuevos.map(filaIniNuevo).join('')}
    <button class="btn primario ancho" data-a="iniNuevosOk">${ic(IC.espadas)} Añadir al combate</button>`,
    { fija: true, alPintar: () => setTimeout(() => { const i = $('[data-in="tiradaNuevo"]', h.el); if (i) i.focus(); }, 80) });
  h.encId = encId; h.nuevos = nuevos; h.aplicar = aplicar; h.despues = despues;
}

function hojaMenuCombate() {
  const enc = encActual(); if (!enc) return;
  abrirHoja(() => `<div class="hp-cab"><div><h3>Combate</h3></div><button class="icono" data-a="cerrarHoja" aria-label="Cerrar">${ic(IC.cerrar)}</button></div>
    <div class="botonera col">
      <button class="btn" data-a="reordenar">Cambiar el orden a mano</button>
      <button class="btn" data-a="reordenarIni">Reordenar por iniciativa</button>
      <button class="btn" data-a="historial">Ver historial</button>
      <button class="btn peligro" data-a="terminarCombate">Terminar combate</button>
    </div>`, { fija: true });
}

function hojaMonAEncuentro(mid) {
  const m = MON.get(mid); if (!m) return;
  let cant = 1;
  const h = abrirHoja(() => `<div class="hp-cab"><div><h3>Añadir ${esc(m.nombre)}</h3></div><button class="icono" data-a="cerrarHoja" aria-label="Cerrar">${ic(IC.cerrar)}</button></div>
    <div class="leg" style="justify-content:space-between;margin:6px 0 12px"><span>Cantidad</span><span style="display:flex;align-items:center;gap:6px"><button data-a="cantMon" data-d="-1">−</button><b id="cant-mon">${cant}</b><button data-a="cantMon" data-d="1">+</button></span></div>
    <div class="botonera col">${E.encuentros.slice().sort((a, b) => (b.mod || 0) - (a.mod || 0)).map(enc => `<button class="btn" data-a="monAEncOk" data-enc="${enc.id}">${esc(enc.nombre)}</button>`).join('')}
    <button class="btn primario" data-a="monAEncOk" data-enc="">${ic(IC.mas)} En un encuentro nuevo</button></div>`, { fija: true });
  h.mid = mid;
  cantidadMon = 1;
}

// ============ Acciones (botones) ============
const A = {};
A.cerrarHoja = () => { const h = hojaActual(); h && h.cerrar(); };
A.resp = el => hojaActual().responder(+el.dataset.n);
A.pnOk = () => hojaActual().aceptar();
A.pnVaciar = () => hojaActual().vaciar();
A.ir = el => navegar(el.dataset.h);
A.selChip = el => el.classList.toggle('on');
A.toggleOn = el => el.classList.toggle('on');

// --- Encuentros
A.nuevoEncuentro = () => {
  const enc = { id: uid(), nombre: `Encuentro ${E.encuentros.length + 1}`, participantes: [], combate: null, notas: '', mod: Date.now() };
  E.encuentros.push(enc); guardar();
  navegar('#/encuentro/' + enc.id);
};
A.duplicarEnc = () => {
  const enc = encActual(); if (!enc) return;
  const copia = JSON.parse(JSON.stringify(enc));
  copia.id = uid(); copia.nombre = enc.nombre + ' (copia)'; copia.combate = null; copia.mod = Date.now();
  for (const p of copia.participantes) { p.id = uid(); p.estados = []; p.pg = p.pgMax; p.pgTemp = 0; p.ini.tirada = null; p.ini.manual = null; p.derrotado = false; p.conc = false; p.muerte = { ok: 0, ko: 0 }; p.estable = false; }
  E.encuentros.push(copia); guardar();
  toast('Encuentro duplicado');
  navegar('#/encuentro/' + copia.id);
};
A.borrarEnc = async () => {
  const enc = encActual(); if (!enc) return;
  const ok = await preguntar(`¿Borrar el encuentro «${esc(enc.nombre)}»? No se puede deshacer.`, [{ t: 'Borrar', v: true, clase: 'peligro' }, { t: 'Cancelar' }]);
  if (!ok) return;
  E.encuentros = E.encuentros.filter(e => e.id !== enc.id); guardar();
  navegar('#/encuentros');
};
A.restablecer = async () => {
  const enc = encActual(); if (!enc) return;
  const ok = await preguntar(`¿Restablecer el encuentro? Todos recuperan sus PG, se quitan los estados y se borran las tiradas de iniciativa.${enc.combate ? ' <b>El combate en curso también terminará.</b>' : ''}`, [{ t: 'Restablecer', v: true, clase: 'primario' }, { t: 'Cancelar' }]);
  if (!ok) return;
  for (const p of enc.participantes) { p.pg = p.pgMax; p.pgTemp = 0; p.estados = []; p.conc = false; p.reaccion = false; p.derrotado = false; p.muerte = { ok: 0, ko: 0 }; p.estable = false; p.ini.tirada = null; p.ini.manual = null; if (p.leg) p.leg.usadas = 0; }
  enc.combate = null; enc.mod = Date.now(); guardar(); refrescar();
  toast('Encuentro restablecido');
};
A.anadirPJs = () => hojaAnadirPJs();
A.pjsOk = () => {
  const h = hojaActual(); const enc = encPorId(h.encId); if (!enc) return;
  const ids = $$('.chip.on', h.el).map(b => b.dataset.id);
  if (!ids.length) return toast('Selecciona al menos un personaje');
  const nuevos = ids.map(id => pjPorId(id)).filter(Boolean).map(participanteDePJ);
  h.cerrar();
  if (enc.combate) return hojaIniNuevos(enc.id, nuevos, e => e.participantes.push(...nuevos));
  enc.participantes.push(...nuevos); enc.mod = Date.now(); guardar(); refrescar();
  toast(`Añadido${nuevos.length > 1 ? 's' : ''} ${nuevos.length} jugador${nuevos.length > 1 ? 'es' : ''}`);
};
A.anadirMon = () => hojaAnadirMon();
A.cantMon = el => { cantidadMon = Math.max(1, Math.min(30, cantidadMon + +el.dataset.d)); const b = $('#cant-mon', hojaActual().el); if (b) b.textContent = cantidadMon; };
A.monAnadir = el => {
  const h = hojaActual(); const enc = encPorId(h.encId); const m = MON.get(el.dataset.id); if (!enc || !m) return;
  if (enc.combate) { const r = crearMonstruos(enc, m, cantidadMon); return hojaIniNuevos(enc.id, r.nuevos, r.aplicar); }
  anadirMonstruos(enc, m, cantidadMon); enc.mod = Date.now(); guardar(); refrescar();
  toast(`Añadido${cantidadMon > 1 ? 's' : ''}: ${cantidadMon} × ${m.nombre}`);
};
A.togNuevo = el => {
  const p = nuevoDeHoja(el.dataset.pid); if (!p) return;
  p.ini[el.dataset.k] = !p.ini[el.dataset.k];
  el.classList.toggle('on', p.ini[el.dataset.k]);
  actTotalNuevo(p);
};
A.iniCopiar = () => {
  const h = hojaActual(); const t = h.nuevos[0].ini.tirada;
  if (t == null) return toast('Escribe primero la tirada del primero');
  for (const p of h.nuevos) {
    p.ini.tirada = t;
    const i = $(`[data-in="tiradaNuevo"][data-pid="${p.id}"]`, h.el); if (i) i.value = t;
    actTotalNuevo(p);
  }
};
A.iniNuevosOk = () => {
  const h = hojaActual(); const enc = encPorId(h.encId); if (!enc) return;
  const fijas = h.nuevos.filter(p => p.ini.tirada == null && p.ini.manual == null);
  for (const p of fijas) p.ini.tirada = 10;
  accionCombate(enc, () => {
    h.aplicar(enc);
    if (enc.combate) for (const p of h.nuevos) { insertarEnOrden(enc, p); registrar(enc, `${p.nombre} se une al combate (iniciativa ${totalIni(p)})`); }
    enc.mod = Date.now();
  });
  h.cerrar();
  const n = h.nuevos.length;
  toast(`${n === 1 ? h.nuevos[0].nombre + ' se une' : n + ' criaturas se unen'} al combate${fijas.length ? ` (${fijas.length} con iniciativa fija)` : ''}`);
  if (h.despues) navegar(h.despues);
};
const nuevoDeHoja = pid => { const h = hojaActual(); return h && h.nuevos && h.nuevos.find(p => p.id === pid); };
function actTotalNuevo(p) { const t = $(`[data-tn="${p.id}"]`, hojaActual().el); if (t) t.innerHTML = textoTotalNuevo(p); }
A.filtroCat = el => {
  const f = el.dataset.clave === 'fb' ? FB : FA;
  f.cat = el.dataset.v;
  const cont = el.closest('.seg');
  $$('.opc', cont).forEach(b => b.classList.toggle('on', b === el));
  actualizarResultados(el.dataset.clave);
};
A.anadirOtro = () => hojaOtro();
A.otroOk = () => {
  const h = hojaActual(); const enc = encPorId(h.encId); if (!enc) return;
  const nombre = $('#o-nombre').value.trim() || 'Criatura';
  const cant = Math.max(1, Math.min(30, num($('#o-cant').value, 1)));
  const ini = num($('#o-ini').value, 0);
  const pg = Math.max(1, num($('#o-pg').value, 1));
  const nuevos = [];
  for (let i = 1; i <= cant; i++) {
    nuevos.push(base({
      tipo: 'otro', nombre: cant > 1 ? `${nombre} ${i}` : nombre, ca: num($('#o-ca').value), pgMax: pg, pg,
      px: num($('#o-px').value, 0), aliado: $('#o-aliado').checked, desMod: 0, bc: 2,
      ini: { tirada: null, usarDes: false, usarBC: false, extra: ini, manual: null }
    }));
  }
  h.cerrar();
  if (enc.combate) return hojaIniNuevos(enc.id, nuevos, e => e.participantes.push(...nuevos));
  enc.participantes.push(...nuevos); enc.mod = Date.now(); guardar(); refrescar();
  toast('Añadido: ' + nombre);
};
A.quitarPart = async el => {
  const enc = encActual(); const p = partPorId(enc, el.dataset.pid); if (!p) return;
  const ok = await preguntar(`¿Quitar a ${esc(p.nombre)} del encuentro?`, [{ t: 'Quitar', v: true, clase: 'peligro' }, { t: 'Cancelar' }]);
  if (!ok) return;
  if (enc.combate) accionCombate(enc, () => { registrar(enc, `${p.nombre} sale del combate`); quitarParticipante(enc, p.id); });
  else { quitarParticipante(enc, p.id); guardar(); refrescar(); }
};
A.editarPart = el => hojaEditar(el.dataset.pid);
A.editarOk = () => {
  const h = hojaActual(); const enc = encPorId(h.encId); const p = partPorId(enc, h.pid); if (!p) return;
  const v = id => { const e = $('#' + id, h.el); return e ? e.value : undefined; };
  const hacer = () => {
    const iniAntes = totalIni(p);
    const pgAntes = p.pg;
    p.nombre = v('e-nombre').trim() || p.nombre;
    if (p.nombre !== h.nombreOriginal) p.nombreAuto = false;
    p.ca = num(v('e-ca'), p.ca);
    p.pgMax = Math.max(1, num(v('e-pgmax'), p.pgMax));
    p.pg = Math.max(0, Math.min(p.pgMax, num(v('e-pg'), p.pg)));
    p.pgTemp = Math.max(0, num(v('e-temp'), 0));
    if (p.tipo === 'pj') p.nivel = Math.max(1, Math.min(20, num(v('e-nivel'), p.nivel)));
    else p.px = num(v('e-px'), 0);
    p.desMod = num(v('e-des'), 0);
    p.bc = num(v('e-bc'), p.bc);
    p.ini.tirada = num(v('e-tirada'));
    p.ini.extra = num(v('e-extra'), 0);
    p.ini.usarDes = $('#e-usardes', h.el).checked;
    p.ini.usarBC = $('#e-usarbc', h.el).checked;
    p.ini.manual = num(v('e-manual'));
    const al = $('#e-aliado', h.el); if (al) p.aliado = al.checked;
    if (p.tipo !== 'pj') {
      if (p.pg === 0) p.derrotado = true;
      else if (pgAntes === 0) p.derrotado = false;
    }
    if (enc.combate && totalIni(p) !== iniAntes) {
      enc.combate.orden = enc.combate.orden.filter(id => id !== p.id);
      insertarEnOrden(enc, p);
    }
    enc.mod = Date.now();
  };
  if (enc.combate) accionCombate(enc, hacer); else { hacer(); guardar(); refrescar(); }
  h.cerrar();
};
A.togDes = el => { const p = partPorId(encActual(), el.dataset.pid); if (!p) return; p.ini.usarDes = !p.ini.usarDes; p.ini.manual = null; p.ini.cambio = null; guardar(); refrescar(); };
A.togBC = el => { const p = partPorId(encActual(), el.dataset.pid); if (!p) return; p.ini.usarBC = !p.ini.usarBC; p.ini.manual = null; p.ini.cambio = null; guardar(); refrescar(); };
A.iniManual = async el => {
  const enc = encActual(); const p = partPorId(enc, el.dataset.pid); if (!p) return;
  const r = await pedirNumero(`Iniciativa de ${esc(p.nombre)}`, totalIni(p), { textoVaciar: p.ini.manual != null ? 'Volver a calcularla' : null, ayuda: 'Escribe el total que quieras. Se mantendrá aunque cambies la tirada.' });
  if (r === undefined) return;
  p.ini.manual = r; p.ini.cambio = null; guardar(); refrescar();
};
A.iniFija = () => {
  const enc = encActual(); if (!enc) return;
  let n = 0;
  for (const p of enc.participantes) if (p.tipo !== 'pj' && p.ini.tirada == null && p.ini.manual == null) { p.ini.tirada = 10; n++; }
  guardar(); refrescar();
  toast(n ? `Iniciativa fija aplicada a ${n} criatura${n > 1 ? 's' : ''}` : 'Todas las criaturas ya tenían iniciativa');
};
A.iniciarCombate = async () => {
  const enc = encActual(); if (!enc || !enc.participantes.length) return;
  const sin = enc.participantes.filter(p => totalIni(p) == null);
  if (sin.length) {
    const r = await preguntar(`${sin.length === 1 ? 'Falta la iniciativa de' : 'Falta la iniciativa de ' + sin.length + ' participantes:'} ${sin.map(p => esc(p.nombre)).join(', ')}.`,
      [{ t: 'Usar iniciativa fija (10 + mod.)', v: 'fija', clase: 'primario' }, { t: 'Volver para escribirla' }]);
    if (r !== 'fija') return;
    for (const p of sin) p.ini.tirada = 10;
  }
  iniciarCombate(enc);
  enc.mod = Date.now(); guardar();
  navegar('#/combate/' + enc.id);
};
A.monAEncuentro = el => hojaMonAEncuentro(el.dataset.id);
A.monAEncOk = el => {
  const h = hojaActual(); const m = MON.get(h.mid); if (!m) return;
  let enc = encPorId(el.dataset.enc);
  if (enc && enc.combate) {
    // Combate empezado: primero se pide la iniciativa y luego vamos al combate
    const r = crearMonstruos(enc, m, cantidadMon);
    h.cerrar();
    hojaIniNuevos(enc.id, r.nuevos, r.aplicar, '#/combate/' + enc.id);
    return;
  }
  if (!enc) { enc = { id: uid(), nombre: `Encuentro ${E.encuentros.length + 1}`, participantes: [], combate: null, notas: '', mod: Date.now() }; E.encuentros.push(enc); }
  anadirMonstruos(enc, m, cantidadMon);
  enc.mod = Date.now(); guardar();
  toast(`${cantidadMon} × ${m.nombre} → ${enc.nombre}`);
  navegar('#/encuentro/' + enc.id);
};

// --- Combate
let ultimoPaseTurno = 0;
A.siguienteTurno = () => {
  // Evita saltarse a alguien por un doble toque sin querer
  if (Date.now() - ultimoPaseTurno < 600) return;
  ultimoPaseTurno = Date.now();
  const enc = encActual(); if (enc && enc.combate) accionCombate(enc, () => pasarTurno(enc));
};
A.deshacer = () => {
  const enc = encActual(); if (!enc) return;
  const pila = pilasDeshacer[enc.id];
  if (!pila || !pila.length) return toast('No hay nada que deshacer');
  const s = JSON.parse(pila.pop());
  enc.participantes = s.p; enc.combate = s.c;
  guardar(); refrescar(); toast('Deshecho');
};
A.abrirPart = el => hojaParticipante(el.dataset.pid);
A.pgAccion = el => {
  const enc = encActual(); const p = partPorId(enc, el.dataset.pid); if (!p) return;
  const inp = $('#cant', hojaActual().el);
  const n = num(inp && inp.value);
  if (n == null || n < 0) { inp && inp.focus(); return toast('Escribe primero una cantidad'); }
  const av = [];
  accionCombate(enc, () => {
    if (el.dataset.q === 'danio') aplicarDanio(enc, p, n, av);
    else if (el.dataset.q === 'curar') aplicarCuracion(enc, p, n, av);
    else aplicarTemp(enc, p, n);
    enc.combate.avisos = [...av, ...(enc.combate.avisos || [])];
  });
  toast(av.length ? av[0].t : el.dataset.q === 'danio' ? `${p.nombre}: −${n} PG` : el.dataset.q === 'curar' ? `${p.nombre}: +${n} PG` : `${p.nombre}: ${n} PG temporales`);
};
A.anadirEstado = el => hojaEstado(el.dataset.pid);
A.feEst = el => {
  const h = hojaActual();
  $$('#fe-estados .opc', h.el).forEach(b => b.classList.toggle('on', b === el));
  h.estadoSel = el.dataset.id;
  $('#fe-otro', h.el).classList.toggle('oculto', h.estadoSel !== 'otro');
  $('#fe-nivel', h.el).classList.toggle('oculto', h.estadoSel !== 'cansancio');
  if (h.estadoSel === 'otro') setTimeout(() => $('#fe-nombre', h.el).focus(), 50);
};
A.feDur = el => {
  const h = hojaActual();
  $$('#fe-dur .opc', h.el).forEach(b => b.classList.toggle('on', b === el));
  $('#fe-rondas', h.el).value = el.dataset.v;
};
A.feOk = () => {
  const h = hojaActual(); const enc = encPorId(h.encId); if (!enc) return;
  if (!h.estadoSel) return toast('Elige un estado');
  const nombreOtro = $('#fe-nombre', h.el).value.trim();
  if (h.estadoSel === 'otro' && !nombreOtro) return toast('Escribe el nombre del efecto');
  const objetivos = $$('#fe-obj .chip.on', h.el).map(b => partPorId(enc, b.dataset.id)).filter(Boolean);
  if (!objetivos.length) return toast('Elige al menos una criatura');
  const rondas = num($('#fe-rondas', h.el).value);
  const car = $('#fe-ts', h.el).value;
  const datos = {
    rondas: rondas && rondas > 0 ? rondas : null,
    momento: $('#fe-mom', h.el).value,
    cuentaEn: $('#fe-cuenta', h.el).value || null,
    ts: car ? { car, cd: num($('#fe-cd', h.el).value) } : null,
    nota: $('#fe-nota', h.el).value.trim()
  };
  const inmunes = [];
  accionCombate(enc, () => {
    for (const p of objetivos) {
      let s;
      if (h.estadoSel === 'otro') s = nuevoEstado('otro', Object.assign({ nombre: nombreOtro }, datos));
      else {
        s = nuevoEstado(h.estadoSel, datos);
        if (h.estadoSel === 'cansancio') s.nivel = num($('#fe-niv', h.el).value, 1);
        if (esInmune(p, s.nombre)) inmunes.push(p.nombre);
        p.estados = p.estados.filter(x => x.id !== s.id);
      }
      if (s.rondas != null && s.momento === 'fin' && enc.combate && (s.cuentaEn || p.id) === enc.combate.turnoId) s.saltar = true;
      p.estados.push(s);
      registrar(enc, `${p.nombre}: ${s.nombre}${s.rondas ? ` (${s.rondas} turnos)` : ''}`);
    }
  });
  h.cerrar();
  toast(inmunes.length ? `Atención: ${inmunes.join(', ')} es inmune a este estado según su perfil` : 'Estado añadido');
};
A.quitarEstado = el => {
  const enc = encActual(); const p = partPorId(enc, el.dataset.pid); if (!p) return;
  accionCombate(enc, () => {
    const s = p.estados.find(x => x.uid === el.dataset.uid);
    p.estados = p.estados.filter(x => x.uid !== el.dataset.uid);
    if (s) registrar(enc, `${p.nombre}: se quita «${s.nombre}»`);
  });
};
A.estRondas = el => {
  const enc = encActual(); const p = partPorId(enc, el.dataset.pid); if (!p) return;
  const s = p.estados.find(x => x.uid === el.dataset.uid); if (!s) return;
  accionCombate(enc, () => { s.rondas = Math.max(1, (s.rondas || 1) + +el.dataset.d); });
};
A.estNivel = el => {
  const enc = encActual(); const p = partPorId(enc, el.dataset.pid); if (!p) return;
  const s = p.estados.find(x => x.uid === el.dataset.uid); if (!s) return;
  accionCombate(enc, () => {
    s.nivel = (s.nivel || 1) + +el.dataset.d;
    if (s.nivel <= 0) p.estados = p.estados.filter(x => x !== s);
    else if (s.nivel >= 6) { s.nivel = 6; toast(`${p.nombre} alcanza el nivel 6 de cansancio: muere`); }
  });
};
A.verEstado = el => hojaReglaEstado(el.dataset.id);
A.verPerfil = el => hojaPerfil(el.dataset.id);
A.verConjuro = el => hojaConjuro(el.dataset.id);
A.conjAPJ = el => hojaConjAPJ(el.dataset.id);
A.elegirConjuros = el => hojaElegirConjuros(el.dataset.id);
A.togConjPJ = el => {
  const pj = pjPorId(el.dataset.pj); const id = el.dataset.id; if (!pj || !CONJ.has(id)) return;
  pj.conjuros ||= [];
  const i = pj.conjuros.indexOf(id);
  if (i >= 0) pj.conjuros.splice(i, 1); else pj.conjuros.push(id);
  guardar();
  const tiene = i < 0;
  // Actualizar lo que se ve sin redibujar las ventanas (para no perder la búsqueda escrita)
  const h = hojaActual();
  if (h && h.pjId) { const r = $('#res-fp', h.el); if (r) r.innerHTML = htmlElegirConj(pj); }
  else if (el.classList.contains('chip')) el.classList.toggle('on', tiene);
  const lista = $('#pj-conjuros'); if (lista && ruta().id === pj.id) lista.innerHTML = htmlListaConjPJ(pj);
  const cuenta = lista && lista.closest('.bloque').querySelector('.cuenta'); if (cuenta) cuenta.textContent = pj.conjuros.length;
  toast(`${CONJ.get(id).nombre}: ${tiene ? 'añadido a' : 'quitado de'} ${pj.nombre}`);
};
A.intercambiar = el => hojaIntercambio(el.dataset.pid);
A.intercambiarCon = el => {
  const h = hojaActual(); const enc = encActual(); if (!h || !enc) return;
  const a = partPorId(enc, h.pidA), b = partPorId(enc, el.dataset.pid); if (!a || !b) return;
  let res;
  if (enc.combate) accionCombate(enc, () => { res = intercambiarIni(enc, a, b); });
  else { res = intercambiarIni(enc, a, b); guardar(); refrescar(); }
  h.cerrar();
  toast(`${a.nombre} ahora tiene ${res[1]} y ${b.nombre} tiene ${res[0]}`);
};
A.togConc = el => {
  const enc = encActual(); const p = partPorId(enc, el.dataset.pid); if (!p) return;
  accionCombate(enc, () => { p.conc = !p.conc; registrar(enc, `${p.nombre} ${p.conc ? 'empieza a concentrarse' : 'deja de concentrarse'}`); });
};
A.togReac = el => { const enc = encActual(); const p = partPorId(enc, el.dataset.pid); if (p) accionCombate(enc, () => { p.reaccion = !p.reaccion; }); };
A.leg = el => {
  const enc = encActual(); const p = partPorId(enc, el.dataset.pid); if (!p || !p.leg) return;
  accionCombate(enc, () => { p.leg.usadas = Math.max(0, Math.min(p.leg.max, p.leg.usadas + +el.dataset.d)); });
};
A.togDerrotado = el => {
  const enc = encActual(); const p = partPorId(enc, el.dataset.pid); if (!p) return;
  accionCombate(enc, () => {
    p.derrotado = !p.derrotado;
    if (!p.derrotado && p.pg === 0) p.pg = 1;
    registrar(enc, `${p.nombre} ${p.derrotado ? 'queda fuera de combate' : 'vuelve al combate'}`);
    if (p.derrotado) { const av = []; comprobarVictoria(enc, av); enc.combate.avisos = [...av, ...(enc.combate.avisos || [])]; }
  });
};
A.msMarcar = el => {
  const enc = encActual(); const p = partPorId(enc, el.dataset.pid); if (!p) return;
  const k = el.dataset.k, i = +el.dataset.n;
  accionCombate(enc, () => {
    p.muerte[k] = p.muerte[k] > i ? i : i + 1;
    p.estable = p.muerte.ok >= 3;
    if (p.estable) toast(`${p.nombre} está estable`);
    if (p.muerte.ko >= 3) toast(`${p.nombre} ha muerto`);
  });
};
A.avisoAccion = el => {
  const enc = encActual(); const c = enc && enc.combate; if (!c) return;
  const i = +el.dataset.n; const a = c.avisos[i]; if (!a || !a.accion) return;
  if (a.accion.q === 'terminar') return A.terminarCombate();
  accionCombate(enc, () => {
    const p = partPorId(enc, a.accion.pid);
    if (p && a.accion.q === 'quitarEstado') {
      const s = p.estados.find(x => x.uid === a.accion.uid);
      p.estados = p.estados.filter(x => x.uid !== a.accion.uid);
      if (s) registrar(enc, `${p.nombre} supera la TS y se libra de «${s.nombre}»`);
    }
    if (p && a.accion.q === 'quitarConc') { p.conc = false; registrar(enc, `${p.nombre} pierde la concentración`); }
    c.avisos.splice(i, 1);
  });
};
A.cerrarAviso = el => {
  const enc = encActual(); const c = enc && enc.combate; if (!c) return;
  c.avisos.splice(+el.dataset.n, 1); guardar(); refrescar();
};
A.danioArea = () => hojaArea();
A.areaOk = el => {
  const h = hojaActual(); const enc = encPorId(h.encId); if (!enc) return;
  const n = num($('#ar-cant', h.el).value);
  if (n == null || n < 0) return toast('Escribe primero una cantidad');
  const ids = $$('.chip.on[data-id]', h.el).map(b => b.dataset.id);
  if (!ids.length) return toast('Marca al menos una criatura');
  const mitad = new Set($$('.chip.on[data-mitad]', h.el).map(b => b.dataset.mitad));
  accionCombate(enc, () => {
    const av = [];
    for (const id of ids) {
      const p = partPorId(enc, id); if (!p) continue;
      const q = mitad.has(id) ? Math.floor(n / 2) : n;
      if (el.dataset.q === 'danio') aplicarDanio(enc, p, q, av); else aplicarCuracion(enc, p, q, av);
    }
    enc.combate.avisos = [...av, ...(enc.combate.avisos || [])];
  });
  h.cerrar();
  toast(el.dataset.q === 'danio' ? 'Daño aplicado' : 'Curación aplicada');
};
A.menuCombate = () => hojaMenuCombate();
A.reordenar = () => { modoReordenar = true; hojaActual().cerrar(); render(); };
A.finReordenar = () => { modoReordenar = false; render(); };
A.reordenarIni = () => {
  const enc = encActual(); if (!enc || !enc.combate) return;
  hojaActual().cerrar();
  accionCombate(enc, () => { enc.combate.orden = ordenar(enc.participantes).map(p => p.id); });
  toast('Orden actualizado según la iniciativa');
};
A.subir = el => mover(el.dataset.pid, -1);
A.bajar = el => mover(el.dataset.pid, 1);
function mover(pid, d) {
  const enc = encActual(); if (!enc || !enc.combate) return;
  const o = enc.combate.orden; const i = o.indexOf(pid); const j = i + d;
  if (i < 0 || j < 0 || j >= o.length) return;
  accionCombate(enc, () => { [o[i], o[j]] = [o[j], o[i]]; });
}
A.historial = () => {
  const enc = encActual(); if (!enc || !enc.combate) return;
  hojaActual().cerrar();
  abrirHoja(() => `<div class="hp-cab"><div><h3>Historial</h3></div><button class="icono" data-a="cerrarHoja" aria-label="Cerrar">${ic(IC.cerrar)}</button></div>
    <div class="historial">${(enc.combate.log || []).slice().reverse().map(l => `<p><b>A${l.a}</b>${esc(l.t)}</p>`).join('') || '<p class="vacio">Todavía no ha pasado nada.</p>'}</div>`, { fija: true });
};
A.terminarCombate = async () => {
  const enc = encActual(); if (!enc) return;
  const hm = hojaActual(); if (hm) hm.cerrar();
  const ok = await preguntar('¿Terminar el combate? Se conservan los PG y estados actuales; puedes restablecerlos después.', [{ t: 'Terminar combate', v: true, clase: 'peligro' }, { t: 'Cancelar' }]);
  if (!ok) return;
  enc.combate = null; modoReordenar = false; delete pilasDeshacer[enc.id]; guardar();
  toast('Combate terminado');
  navegar('#/encuentro/' + enc.id);
};

// --- Personajes
A.nuevoPJ = () => {
  const pj = { id: uid(), nombre: `Personaje ${E.personajes.length + 1}`, jugador: '', clase: '', nivel: 1, ca: 10, pgMax: 10, des: 10, iniDes: true, iniBC: false, iniExtra: 0, notas: '' };
  E.personajes.push(pj); guardar();
  navegar('#/personaje/' + pj.id);
};
A.borrarPJ = async el => {
  const pj = pjPorId(el.dataset.id); if (!pj) return;
  const ok = await preguntar(`¿Borrar el perfil de ${esc(pj.nombre)}? Los encuentros donde ya está no cambian.`, [{ t: 'Borrar', v: true, clase: 'peligro' }, { t: 'Cancelar' }]);
  if (!ok) return;
  E.personajes = E.personajes.filter(p => p.id !== pj.id); guardar();
  navegar('#/personajes');
};

// --- Ajustes
A.exportar = () => {
  const blob = new Blob([JSON.stringify(E, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `encuentros-dnd-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Copia guardada en Descargas');
};
A.borrarTodo = async () => {
  const ok = await preguntar('¿Borrar TODOS los personajes y encuentros de este teléfono? No se puede deshacer.', [{ t: 'Borrar todo', v: true, clase: 'peligro' }, { t: 'Cancelar' }]);
  if (!ok) return;
  E = completar({}); guardar(); refrescar(); toast('Datos borrados');
};

// ============ Campos (escritura) ============
const I = {};
I.encNombre = el => { const enc = encActual(); if (!enc) return; enc.nombre = el.value; enc.mod = Date.now(); guardar(); $('#cabecera h1').textContent = el.value; document.title = el.value + ' · Encuentros D&D'; };
I.encNotas = el => { const enc = encActual(); if (!enc) return; enc.notas = el.value; guardar(); };
I.tirada = el => {
  const enc = encActual(); const p = partPorId(enc, el.dataset.pid); if (!p) return;
  p.ini.tirada = num(el.value); p.ini.manual = null; guardar();
  const t = $(`[data-total="${p.id}"]`);
  if (t) { t.textContent = totalIni(p) ?? '—'; t.classList.remove('manual'); }
  if (p.ini.cambio) { p.ini.cambio = null; guardar(); const n = t && t.closest('.fila-prep').querySelector('.nota-cambio'); if (n) n.remove(); }
};
I.tiradaNuevo = el => { const p = nuevoDeHoja(el.dataset.pid); if (!p) return; p.ini.tirada = num(el.value); actTotalNuevo(p); };
I.partNotas = el => { const enc = encActual(); const p = partPorId(enc, el.dataset.pid); if (!p) return; p.notas = el.value; guardar(); };
I.pj = el => {
  const pj = pjPorId(ruta().id); if (!pj) return;
  const k = el.dataset.k;
  pj[k] = el.type === 'number' ? num(el.value) : el.value;
  if (k === 'nivel' && pj.nivel != null) pj.nivel = Math.max(1, Math.min(20, pj.nivel));
  guardar();
  if (k === 'nombre') { $('#cabecera h1').textContent = pj.nombre || 'Personaje'; document.title = (pj.nombre || 'Personaje') + ' · Encuentros D&D'; }
  const c = $('#pj-calc'); if (c) c.textContent = `Mod. de Destreza ${signo(modDe(pj.des))} · Bonificador por competencia ${signo(bcDeNivel(pj.nivel))}`;
  const r = $('#pj-ini'); if (r) r.textContent = resumenIniPJ(pj);
};
I.fb = el => { FB[el.dataset.k] = el.value; actualizarResultados('fb'); };
I.fa = el => { FA[el.dataset.k] = el.value; actualizarResultados('fa'); };
I.fc = el => { FC[el.dataset.k] = el.value; const r = $('#res-fc'); if (r) r.innerHTML = htmlResultadosConj(FC); };
I.fp = el => {
  FP[el.dataset.k] = el.value;
  const h = hojaActual(); const pj = h && pjPorId(h.pjId); const r = h && $('#res-fp', h.el);
  if (r && pj) r.innerHTML = htmlElegirConj(pj);
};
function actualizarResultados(clave) {
  if (clave === 'fb') { const r = $('#res-fb'); if (r) r.innerHTML = htmlResultadosBest(FB); }
  else { const h = hojaActual(); const r = h && $('#res-fa', h.el); if (r) r.innerHTML = htmlResultadosAnadir(); }
}
const C = {};
C.pjchk = el => {
  const pj = pjPorId(ruta().id); if (!pj) return;
  const k = el.dataset.k;
  pj[k] = el.checked;
  // La dote Alerta suma el bonificador por competencia a la iniciativa
  if (k === 'alerta' && el.checked && !pj.iniBC) {
    pj.iniBC = true;
    const bc = $('[data-ch="pjchk"][data-k="iniBC"]'); if (bc) bc.checked = true;
    sincronizarPJ(pj, 'iniBC');
  }
  guardar();
  const r = $('#pj-ini'); if (r) r.textContent = resumenIniPJ(pj);
  sincronizarPJ(pj, k);
};
// Al terminar de escribir un campo del perfil (al salir de la casilla)
C.pjSync = el => {
  const pj = pjPorId(ruta().id); if (!pj) return;
  if (el.dataset.k === 'nivel') el.value = pj.nivel ?? '';
  sincronizarPJ(pj, el.dataset.k);
};
// Lleva los cambios del perfil a los encuentros donde ya está ese personaje
function sincronizarPJ(pj, k) {
  let n = 0;
  for (const enc of E.encuentros) for (const p of enc.participantes) {
    if (p.tipo !== 'pj' || p.ref !== pj.id) continue;
    n++;
    if (k === 'nombre') p.nombre = pj.nombre || p.nombre;
    else if (k === 'nivel') { p.nivel = pj.nivel || 1; p.bc = bcDeNivel(pj.nivel); }
    else if (k === 'ca') p.ca = pj.ca;
    else if (k === 'des') p.desMod = modDe(pj.des);
    else if (k === 'iniDes') p.ini.usarDes = pj.iniDes !== false;
    else if (k === 'iniBC') p.ini.usarBC = !!pj.iniBC;
    else if (k === 'iniExtra') p.ini.extra = pj.iniExtra || 0;
    else if (k === 'alerta') p.alerta = !!pj.alerta;
    else if (k === 'pgMax') {
      const nuevo = Math.max(1, pj.pgMax || 1);
      p.pg = p.pg === p.pgMax ? nuevo : Math.min(p.pg, nuevo);
      p.pgMax = nuevo;
    } else n--;
  }
  if (n) guardar();
}
C.ajPantalla = el => { E.ajustes.pantalla = el.checked; guardar(); };
C.importar = el => {
  const f = el.files && el.files[0]; if (!f) return;
  const lector = new FileReader();
  lector.onload = async () => {
    try {
      const d = JSON.parse(lector.result);
      if (!d || !Array.isArray(d.personajes) || !Array.isArray(d.encuentros)) throw new Error('formato');
      const ok = await preguntar(`La copia tiene ${d.personajes.length} personajes y ${d.encuentros.length} encuentros. ¿Sustituir los datos actuales?`, [{ t: 'Restaurar copia', v: true, clase: 'primario' }, { t: 'Cancelar' }]);
      if (!ok) return;
      E = completar(d); guardar(); refrescar(); toast('Copia restaurada');
    } catch (e) { toast('Ese archivo no es una copia válida'); }
  };
  lector.readAsText(f);
  el.value = '';
};

// ============ Eventos globales ============
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  const fn = A[el.dataset.a]; if (!fn) return;
  e.preventDefault();
  fn(el, e);
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.carta')) { e.preventDefault(); e.target.click(); }
  if (e.key === 'Enter' && e.target.id === 'pn-val') { e.preventDefault(); A.pnOk(); }
  if (e.key === 'Enter' && e.target.matches('[data-in="tiradaNuevo"], [data-in="tirada"]')) {
    // Pasar a la siguiente casilla de d20 para escribir rápido
    e.preventDefault();
    const todas = $$(`[data-in="${e.target.dataset.in}"]`, e.target.closest('dialog') || document);
    const sig = todas[todas.indexOf(e.target) + 1];
    if (sig) sig.focus(); else e.target.blur();
  }
});
document.addEventListener('input', e => { const el = e.target.closest('[data-in]'); if (el && I[el.dataset.in]) I[el.dataset.in](el, e); });
document.addEventListener('change', e => { const el = e.target.closest('[data-ch]'); if (el && C[el.dataset.ch]) C[el.dataset.ch](el, e); });

// Mantener la pantalla encendida en combate
let bloqueo = null;
async function gestionarPantalla() {
  const quiere = E.ajustes.pantalla !== false && ruta().v === 'combate' && document.visibilityState === 'visible';
  try {
    if (quiere && !bloqueo && 'wakeLock' in navigator) {
      bloqueo = await navigator.wakeLock.request('screen');
      bloqueo.addEventListener('release', () => { bloqueo = null; });
    } else if (!quiere && bloqueo) { await bloqueo.release(); bloqueo = null; }
  } catch (e) { /* no disponible */ }
}
document.addEventListener('visibilitychange', gestionarPantalla);

// Funcionamiento sin conexión (solo cuando la app está publicada en internet)
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  // Si ya había una versión guardada y se activa otra nueva, avisamos (sin recargar solos)
  const habiaVersion = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (habiaVersion) mostrarAvisoActualizacion();
  });
  navigator.serviceWorker.register('sw.js').then(reg => {
    // Al volver a la app (estaba en segundo plano), mirar si hay versión nueva
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(() => {});
}
function mostrarAvisoActualizacion() {
  if ($('#actualizacion')) return;
  const b = document.createElement('button');
  b.id = 'actualizacion';
  b.type = 'button';
  b.innerHTML = '<b>Hay una versión nueva de la app.</b><span>Toca aquí para cargarla. Tus datos no se pierden.</span>';
  b.addEventListener('click', () => location.reload());
  document.body.appendChild(b);
}

render();
recuperarCopiaPruebas();
