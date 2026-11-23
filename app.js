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
const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
// Características de un personaje: se guardan en el perfil como pj.fue, pj.des, pj.con, pj.int, pj.sab, pj.car
const CARS_PJ = [['fue', 'Fuerza'], ['des', 'Destreza'], ['con', 'Constitución'], ['int', 'Inteligencia'], ['sab', 'Sabiduría'], ['car', 'Carisma']];

const IC = {
  atras: '<path d="M15 18l-6-6 6-6"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  editar: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
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
// ---- Espacios de conjuro (tablas de «Rasgos de…» del SRD 5.2.1) ----
const ESPACIOS_COMPLETO = { 1: [2], 2: [3], 3: [4, 2], 4: [4, 3], 5: [4, 3, 2], 6: [4, 3, 3], 7: [4, 3, 3, 1], 8: [4, 3, 3, 2], 9: [4, 3, 3, 3, 1], 10: [4, 3, 3, 3, 2], 11: [4, 3, 3, 3, 2, 1], 12: [4, 3, 3, 3, 2, 1], 13: [4, 3, 3, 3, 2, 1, 1], 14: [4, 3, 3, 3, 2, 1, 1], 15: [4, 3, 3, 3, 2, 1, 1, 1], 16: [4, 3, 3, 3, 2, 1, 1, 1], 17: [4, 3, 3, 3, 2, 1, 1, 1, 1], 18: [4, 3, 3, 3, 3, 1, 1, 1, 1], 19: [4, 3, 3, 3, 3, 2, 1, 1, 1], 20: [4, 3, 3, 3, 3, 2, 2, 1, 1] };
const ESPACIOS_MEDIO = { 1: [2], 2: [2], 3: [3], 4: [3], 5: [4, 2], 6: [4, 2], 7: [4, 3], 8: [4, 3], 9: [4, 3, 2], 10: [4, 3, 2], 11: [4, 3, 3], 12: [4, 3, 3], 13: [4, 3, 3, 1], 14: [4, 3, 3, 1], 15: [4, 3, 3, 2], 16: [4, 3, 3, 2], 17: [4, 3, 3, 3, 1], 18: [4, 3, 3, 3, 1], 19: [4, 3, 3, 3, 2], 20: [4, 3, 3, 3, 2] };
const PACTO_BRUJO = { 1: [1, 1], 2: [2, 1], 3: [2, 2], 4: [2, 2], 5: [2, 3], 6: [2, 3], 7: [2, 4], 8: [2, 4], 9: [2, 5], 10: [2, 5], 11: [3, 5], 12: [3, 5], 13: [3, 5], 14: [3, 5], 15: [3, 5], 16: [3, 5], 17: [4, 5], 18: [4, 5], 19: [4, 5], 20: [4, 5] }; // [espacios, nivel]
function tipoLanzador(clase) {
  const w = norm(clase).split(/[\s,/]+/); const es = k => w.some(x => x.startsWith(k));
  if (['bard', 'cleri', 'druid', 'hechicer', 'mag'].some(es)) return 'completo';
  if (['paladin', 'explorador'].some(es)) return 'medio';
  if (es('bruj')) return 'pacto';
  return null;
}
// ---- Recursos de clase (SRD 5.2.1, capítulo «Clases») y cómo se recuperan ----
// descanso: 'uno'   → con descanso corto recupera UN uso; con descanso largo, todos
//           'corto' → con descanso corto o largo recupera todos
//           'largo' → solo con descanso largo
const FURIAS = [0, 2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6];
const ENEMIGO_PREDILECTO = [0, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6];
const RECURSOS_CLASE = {
  barbaro: [{ clave: 'furia', nombre: 'Furia', desde: 1, max: n => FURIAS[n], descanso: 'uno' }],
  // Usos = modificador por Carisma, mínimo 1 (SRD, pág. 36)
  bardo: [{ clave: 'inspiracion-bardica', nombre: 'Inspiración bárdica', desde: 1, max: (n, pj) => Math.max(1, modDe(pj && pj.car != null ? pj.car : 10)), descanso: n => n >= 5 ? 'corto' : 'largo', nota: 'Usos según su modificador por Carisma (mínimo 1)' }],
  clerigo: [{ clave: 'canalizar-divinidad', nombre: 'Canalizar divinidad', desde: 2, max: n => n >= 18 ? 4 : n >= 6 ? 3 : 2, descanso: 'uno' }],
  druida: [{ clave: 'forma-salvaje', nombre: 'Forma salvaje', desde: 2, max: n => n >= 17 ? 4 : n >= 6 ? 3 : 2, descanso: 'uno' }],
  explorador: [{ clave: 'enemigo-predilecto', nombre: 'Enemigo predilecto (marca del cazador sin espacio)', desde: 1, max: n => ENEMIGO_PREDILECTO[n], descanso: 'largo' }],
  guerrero: [
    { clave: 'tomar-aliento', nombre: 'Tomar aliento', desde: 1, max: n => n >= 10 ? 4 : n >= 4 ? 3 : 2, descanso: 'uno' },
    { clave: 'accion-subita', nombre: 'Acción súbita', desde: 2, max: n => n >= 17 ? 2 : 1, descanso: 'corto' },
    { clave: 'indomito', nombre: 'Indómito', desde: 9, max: n => n >= 17 ? 3 : n >= 13 ? 2 : 1, descanso: 'largo' }
  ],
  hechicero: [
    { clave: 'hechiceria-innata', nombre: 'Hechicería innata', desde: 1, max: () => 2, descanso: 'largo' },
    { clave: 'puntos-hechiceria', nombre: 'Puntos de hechicería', desde: 2, max: n => n, descanso: 'largo' }
  ],
  mago: [{ clave: 'recuperacion-arcana', nombre: 'Recuperación arcana (tras un descanso corto)', desde: 1, max: () => 1, descanso: 'largo' }],
  monje: [{ clave: 'puntos-concentracion', nombre: 'Puntos de concentración', desde: 2, max: n => n, descanso: 'corto' }],
  paladin: [
    { clave: 'imponer-manos', nombre: 'Imponer las manos', desde: 1, max: n => 5 * n, descanso: 'largo', reserva: true },
    { clave: 'canalizar-divinidad', nombre: 'Canalizar divinidad', desde: 3, max: n => n >= 11 ? 3 : 2, descanso: 'uno' }
  ]
};
const RAICES_CLASE = { barbar: 'barbaro', bard: 'bardo', bruj: 'brujo', cleri: 'clerigo', druid: 'druida', explorador: 'explorador', guerrer: 'guerrero', hechicer: 'hechicero', mag: 'mago', monj: 'monje', paladin: 'paladin', picar: 'picaro' };
// Competencia en tiradas de salvación de cada clase («Atributos básicos de…», SRD 5.2.1)
const SALVACIONES_CLASE = {
  barbaro: ['fue', 'con'], bardo: ['des', 'car'], brujo: ['sab', 'car'], clerigo: ['sab', 'car'], druida: ['int', 'sab'], explorador: ['fue', 'des'],
  guerrero: ['fue', 'con'], hechicero: ['con', 'car'], mago: ['int', 'sab'], monje: ['fue', 'des'], paladin: ['sab', 'car'], picaro: ['des', 'int']
};
// Más adelante: monje 14 «Superviviente disciplinado» (todas) y pícaro 15 «Mente escurridiza» (+Sab y Car)
function salvacionesDeClase(clase, nivel) {
  const k = claseDe(clase); if (!k) return null;
  if (k === 'monje' && nivel >= 14) return CARS_PJ.map(([c]) => c);
  if (k === 'picaro' && nivel >= 15) return ['des', 'int', 'sab', 'car'];
  return SALVACIONES_CLASE[k].slice();
}
const salvacionPJ = (pj, k) => modDe(pj[k] != null ? pj[k] : 10) + ((pj.salvComp || []).includes(k) ? bcDeNivel(pj.nivel) : 0);
function claseDe(clase) {
  const w = norm(clase).split(/[\s,/]+/);
  for (const [raiz, k] of Object.entries(RAICES_CLASE)) if (w.some(x => x.startsWith(raiz))) return k;
  return null;
}
const defRecurso = r => r.clave && Object.values(RECURSOS_CLASE).flat().find(d => d.clave === r.clave);
// Cómo se recupera un recurso: los de clase según el SRD; los personalizados, como diga el máster
function reglaRecurso(r, pj) {
  const d = defRecurso(r);
  if (!d) return r.descanso === 'corto' ? 'corto' : 'largo';
  return typeof d.descanso === 'function' ? d.descanso(pj.nivel || 1) : d.descanso;
}
const TEXTO_REGLA = { uno: 'descanso corto: recupera 1 · largo: todos', corto: 'descanso corto o largo: todos', largo: 'solo descanso largo' };
// Los espacios y recursos se guardan en el PERFIL: cualquier encuentro lee siempre lo mismo
function espaciosPJ(pj) { pj.espacios ||= { max: Array(9).fill(0), usados: Array(9).fill(0) }; return pj.espacios; }

// ---- Usos limitados de los monstruos: «(2/día)», «(recarga 5–6)», «2/día: orden imperiosa»… ----
function usosDeMonstruo(m) {
  const usos = [];
  for (const s of m.secciones) for (const e of s.entradas) {
    let r = e.nombre.match(/^(.*?)\s*\((\d+)\/día([^)]*)\)?/i);
    if (r) { usos.push({ id: slug(e.nombre), nombre: r[1], max: +r[2], tipo: 'dia', nota: r[3].replace(/^[\s;,]*(o\s*)?/, '').trim() }); continue; }
    // El nombre a veces llega cortado («… (recarga»): el rango puede estar al principio del texto
    r = (e.nombre + ' ' + e.html.replace(/<[^>]+>/g, '').slice(0, 20)).match(/^(.*?)\s*\(recarga\s*(\d)(?:\s*[–-]\s*(\d))?/i);
    if (r) { usos.push({ id: slug(e.nombre), nombre: r[1], max: 1, tipo: 'recarga', rango: r[3] ? `${r[2]}–${r[3]}` : r[2], min: +r[2] }); continue; }
    r = e.nombre.match(/^(.*?)\s*\((?:se )?recarga tras un descanso/i);
    if (r) { usos.push({ id: slug(e.nombre), nombre: r[1], max: 1, tipo: 'descanso' }); continue; }
    // Lanzamiento de conjuros: «<strong>2/día: </strong><em>orden imperiosa</em>…» (o «1/día cada uno:»)
    for (const g of e.html.matchAll(/<strong>(\d+)\/día( cada uno)?:\s*<\/strong>(.*?)(?=<\/p>|<strong>|$)/g)) {
      const conjs = [...g[3].matchAll(/<em>([^<]+)<\/em>/g)].map(x => x[1].trim().replace(/[.,;]+$/, ''));
      if (!conjs.length) continue;
      if (g[2]) conjs.forEach(n => usos.push({ id: slug('conj-' + n), nombre: n, max: +g[1], tipo: 'dia', conjuro: true }));
      else usos.push({ id: slug('conj-' + conjs.join('-')), nombre: conjs.join(', '), max: +g[1], tipo: 'dia', conjuro: true });
    }
  }
  return usos;
}
// Participantes creados antes de existir esta función: se completan al vuelo
function usosDe(p) {
  if (!p.usos) { const m = p.tipo === 'monstruo' && MON.get(p.ref); p.usos = m ? usosDeMonstruo(m).map(u => Object.assign({ usados: 0 }, u)) : []; }
  return p.usos;
}
const bolas = (max, usados, datos, etiqueta) => Array.from({ length: max }, (_, i) => {
  const libre = i < max - usados;
  return `<button class="bola${libre ? ' on' : ''}" ${datos} data-d="${libre ? 1 : -1}" aria-label="${esc(etiqueta)}: ${libre ? 'gastar uno' : 'recuperar uno'}"></button>`;
}).join('');

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
  // En el perfil, sumar el BC a la iniciativa depende solo de la dote Alerta
  for (const pj of d.personajes) pj.iniBC = !!pj.alerta;
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
    leg: m._leg ? { max: m._leg, usadas: 0 } : null,
    usos: usosDeMonstruo(m).map(u => Object.assign({ usados: 0 }, u))
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
  try {
    fn();
    if (enc.combate) { const av = []; revisarVinculos(enc, av); if (av.length) enc.combate.avisos = [...av, ...(enc.combate.avisos || [])]; }
  }
  finally { guardar(); refrescar(); }
}
// Reglas del SRD que se aplican solas tras cada acción del combate:
// · la concentración se pierde al quedar incapacitado o morir (Glosario, «Concentración»);
// · un estado vinculado termina si quien lo causa pierde la concentración, o queda incapacitado o cae
//   (p. ej. «el estado de agarrado también termina si quien agarra tiene el estado de incapacitado»).
const estaIncapacitado = p => p.pg === 0 || p.derrotado || p.estados.some(s => INCAPACITANTES.has(s.id));
function revisarVinculos(enc, av) {
  for (const p of enc.participantes) {
    if (p.conc && estaIncapacitado(p)) {
      p.conc = false;
      av.push({ t: `${p.nombre} pierde la concentración (${p.pg === 0 || p.derrotado ? 'ha caído' : 'está incapacitado'})`, tipo: 'info' });
      registrar(enc, `${p.nombre} pierde la concentración`);
    }
  }
  for (const p of enc.participantes) {
    p.estados = p.estados.filter(s => {
      if (!s.origen || !s.vinculo) return true;
      const o = partPorId(enc, s.origen);
      let motivo = '';
      if (!o) motivo = 'quien lo causaba ya no está en el combate';
      else if (s.vinculo === 'conc' && !o.conc) motivo = `${o.nombre} ha perdido la concentración`;
      else if (s.vinculo === 'cae' && estaIncapacitado(o)) motivo = o.pg === 0 || o.derrotado ? `${o.nombre} ha caído` : `${o.nombre} está incapacitado`;
      if (!motivo) return true;
      av.push({ t: `${p.nombre}: termina «${s.nombre}» porque ${motivo}`, tipo: 'bueno' });
      registrar(enc, `Termina «${s.nombre}» en ${p.nombre} (${motivo})`);
      return false;
    });
  }
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
  // Recarga X–Y (SRD, pág. 282): al comienzo de cada turno del monstruo se tira 1d6
  for (const u of usosDe(p)) if (u.tipo === 'recarga' && u.usados > 0) {
    av.push({ t: `${p.nombre}: tira 1d6 para recargar «${u.nombre}» (lo recupera con ${u.rango})`, accion: { q: 'recargar', pid: p.id, uid: u.id, txt: 'Recargado' } });
  }
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
const TAB_DE = { encuentros: 'encuentros', encuentro: 'encuentros', combate: 'encuentros', ajustes: 'encuentros', personajes: 'personajes', personaje: 'personajes', crear: 'personajes', hoja: 'personajes', subir: 'personajes', bestiario: 'bestiario', monstruo: 'bestiario', conjuros: 'conjuros', conjuro: 'conjuros', estados: 'estados' };
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
  ${enc.combate ? `<div class="aviso"><span>Este encuentro tiene un combate en curso (asalto ${enc.combate.asalto}).</span></div>` : htmlResumen(enc.resumen)}
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
  const html = `<button class="btn primario ancho" data-a="crearPJ">${ic(IC.mas)} ${E.borradorPJ && (E.borradorPJ.clase || E.borradorPJ.paso) ? 'Seguir creando personaje' : 'Crear personaje paso a paso'}</button>
  <button class="btn ancho peq" data-a="nuevoPJ" style="margin-top:0">Perfil rápido (solo datos de combate)</button>
  ${lista.length ? `<div class="lista">${lista.map(pj => `<a class="fila" href="#/${clasePJ(pj) ? 'hoja' : 'personaje'}/${pj.id}"><div class="f-txt"><div class="f-tit">${esc(pj.nombre)}</div>
    <div class="f-sub">${esc([pj.clase, 'nivel ' + (pj.nivel || 1), pj.jugador && 'jugado por ' + pj.jugador].filter(Boolean).join(' · '))}</div></div>
    <div class="f-vd">CA ${pj.ca ?? '—'} · PG ${pj.pgMax ?? '—'}</div></a>`).join('')}</div>`
    : `<p class="vacio">Crea un perfil para cada jugador de tu mesa.<br>Luego podrás añadirlos a cualquier encuentro.</p>`}
  ${lista.length ? `<section class="bloque"><h2 style="font-size:1rem;margin:0 0 4px">Descansos del grupo</h2>
    <p class="nota" style="margin-top:0">Recupera los espacios de conjuro y recursos de todos los personajes. Los PG se gestionan en cada encuentro.</p>
    <div class="botonera"><button class="btn peq" data-a="descanso" data-tipo="corto">Descanso corto</button><button class="btn peq" data-a="descanso" data-tipo="largo">Descanso largo</button></div></section>` : ''}`;
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
    ${clasePJ(pj) ? `<a class="btn primario ancho" href="#/hoja/${pj.id}">Ver hoja completa y subir de nivel</a>` : ''}
    ${campo('nombre', 'Nombre del personaje')}
    ${campo('jugador', 'Jugador (opcional)')}
    <div class="fila2">${campo('clase', 'Clase y especie', 'text', 'placeholder="p. ej. Pícaro elfo"')}${campo('nivel', 'Nivel', 'number', 'min="1" max="20"')}</div>
    <div class="fila2">${campo('ca', 'CA', 'number')}${campo('pgMax', 'PG máximos', 'number')}</div>
    ${clasePJ(pj) ? `<p class="nota" style="margin-top:0">La CA se calcula con la armadura y el escudo que lleva (se eligen en su hoja completa). Si la cambias aquí a mano, la diferencia se guarda como «otros bonos a la CA».</p>` : ''}
    <section class="bloque"><h2 style="font-size:1rem;margin:0 0 6px">Características</h2>
      <div class="cars-pj">${CARS_PJ.map(([k, etq]) => `<label class="car-pj"><span>${etq}</span>
        <input data-in="pj" data-ch="pjSync" data-k="${k}" type="number" inputmode="numeric" min="1" max="30" placeholder="10" value="${esc(pj[k] ?? '')}">
        <b data-mod="${k}">${pj[k] != null ? signo(modDe(pj[k])) : '—'}</b></label>`).join('')}</div>
      <p class="nota" id="pj-calc">Bonificador por competencia ${signo(bcDeNivel(pj.nivel))} (por su nivel)</p>
      <h3 class="sub-tit">Tiradas de salvación</h3>
      <p class="nota" style="margin-top:0">Marca en las que tiene competencia (las da su clase). Se suma su bonificador por competencia.</p>
      <div class="salv-pj" id="pj-salv">${htmlSalvPJ(pj)}</div>
    </section>
    <section class="bloque"><h2 style="font-size:1rem;margin:0 0 4px">Cómo se calcula su iniciativa</h2>
      <label class="check"><input type="checkbox" data-ch="pjchk" data-k="iniDes" ${pj.iniDes !== false ? 'checked' : ''}> Sumar el modificador de Destreza</label>
      <label class="check"><input type="checkbox" data-ch="pjchk" data-k="alerta" ${pj.alerta ? 'checked' : ''}><span>Tiene la dote <b>Alerta</b><small>Suma su BC a la iniciativa y puede intercambiarla con un aliado</small></span></label>
      ${campo('iniExtra', 'Otros bonificadores a la iniciativa', 'number', 'placeholder="0"')}
      <p class="nota" id="pj-ini">${esc(resumenIniPJ(pj))}</p>
    </section>
    <section class="bloque">
      <div class="bloque-cab"><h2>Conjuros <span class="cuenta">${(pj.conjuros || []).length}</span></h2><button class="btn peq" data-a="elegirConjuros" data-id="${pj.id}">${ic(IC.mas)} Añadir</button></div>
      <div id="pj-conjuros">${htmlListaConjPJ(pj)}</div>
    </section>
    ${htmlRecursosPJ(pj, 'perfil')}
    ${campo('pasiva', 'Percepción pasiva (opcional)', 'number')}
    <label class="campo"><span>Notas</span><textarea data-in="pj" data-k="notas" rows="3">${esc(pj.notas || '')}</textarea></label>
    <button class="btn ancho peligro-suave" data-a="borrarPJ" data-id="${pj.id}">Borrar personaje</button>`;
  return { titulo: pj.nombre || 'Personaje', atras: clasePJ(pj) ? '#/hoja/' + pj.id : '#/personajes', html };
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
function hojaConjuro(id, pjId, pid) {
  const c = CONJ.get(id); if (!c) return;
  const h = abrirHoja(() => `<div class="hp-cab"><div><h3>${esc(c.nombre)}</h3><div class="sub">${nivelTxt(c.nivel)} · ${esc(c.escuela)}</div></div><button class="icono" data-a="cerrarHoja" aria-label="Cerrar">${ic(IC.cerrar)}</button></div>
    ${htmlLanzar(c, pjPorId(pjId))}${htmlConjuro(c)}`, { fija: true });
  h.pjId = null; h.lanzar = { cid: id, pjId, pid }; // (pjId va en «lanzar» para no confundirlo con el selector de conjuros)
}
// Botones para lanzar el conjuro gastando un espacio del nivel elegido (o de la Magia del pacto)
function htmlLanzar(c, pj) {
  if (!pj || c.nivel === 0) return '';
  const esp = espaciosPJ(pj); const ops = [];
  for (let n = c.nivel; n <= 9; n++) {
    const mx = esp.max[n - 1]; if (!mx) continue;
    const quedan = mx - (esp.usados[n - 1] || 0);
    ops.push(`<button class="btn peq" data-a="lanzarConj" data-k="esp:${n}" ${quedan > 0 ? '' : 'disabled'}>Nivel ${n} <small>· quedan ${quedan}/${mx}</small></button>`);
  }
  if (pj.pacto && pj.pacto.max && pj.pacto.nivel >= c.nivel) {
    const q = pj.pacto.max - (pj.pacto.usados || 0);
    ops.push(`<button class="btn peq" data-a="lanzarConj" data-k="pacto" ${q > 0 ? '' : 'disabled'}>Pacto (nivel ${pj.pacto.nivel}) <small>· quedan ${q}/${pj.pacto.max}</small></button>`);
  }
  return `<div class="lanzar"><b>${esc(pj.nombre)} lo lanza con un espacio de…</b>
    ${ops.length ? `<div class="botonera">${ops.join('')}</div>${c.concentracion ? '<p class="nota" style="margin:0">Requiere concentración: se marcará en su ficha del combate.</p>' : ''}` : `<p class="nota" style="margin:4px 0 0">No tiene espacios de nivel ${c.nivel} o superior en su perfil.</p>`}</div>`;
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
// ---- Recordatorio de reglas de los estados (resumen fiel del Glosario del SRD 5.2.1, págs. 194-205) ----
const INCAP_TXT = 'No puede hacer acciones, acciones adicionales ni reacciones; no puede hablar';
const REGLAS = {
  agarrado: { vel0: 1, sus: o => [`Desventaja al atacar a cualquiera que no sea ${o || 'quien le agarra'}`], otros: o => [`${o || 'Quien le agarra'} puede arrastrarle (cada metro le cuesta 1 m más)`] },
  apresado: { vel0: 1, contra: 'Ventaja', sus: () => ['Desventaja en sus tiradas de ataque'], ts: ['Desventaja en las TS de Destreza'] },
  asustado: { sus: o => [`Desventaja en ataques y pruebas de característica mientras vea a ${o || 'la fuente de su miedo'}`], mov: o => [`No puede acercarse voluntariamente a ${o || 'la fuente de su miedo'}`] },
  aturdido: { incap: 1, contra: 'Ventaja', ts: ['Falla automáticamente las TS de Fuerza y Destreza'] },
  cegado: { contra: 'Ventaja', sus: () => ['Desventaja en sus tiradas de ataque', 'Falla las pruebas que requieran ver'] },
  derribado: { contraTxt: 'Ventaja si el atacante está a 1,5 m o menos; desventaja si está más lejos', sus: () => ['Desventaja en sus tiradas de ataque'], mov: () => ['Solo puede arrastrarse, o levantarse gastando la mitad de su velocidad (no puede si su velocidad es 0)'] },
  ensordecido: { otros: () => ['No oye: falla las pruebas que requieran oír'] },
  envenenado: { sus: () => ['Desventaja en tiradas de ataque y pruebas de característica'] },
  hechizado: { sus: o => [`No puede atacar ni elegir como objetivo de efectos dañinos o mágicos a ${o || 'quien le hechizó'}`], otros: o => [`${o || 'Quien le hechizó'} tiene ventaja en pruebas sociales con él`] },
  incapacitado: { incap: 1 },
  inconsciente: { incap: 1, vel0: 1, contra: 'Ventaja', crit: 1, ts: ['Falla automáticamente las TS de Fuerza y Destreza'], otros: () => ['Está derribado y suelta lo que sujeta (seguirá derribado al despertar)'] },
  invisible: { contraTxt: 'Desventaja (salvo para quien pueda verle)', sus: () => ['Ventaja en sus tiradas de ataque (salvo contra quien pueda verle)'], otros: () => ['No le afectan los efectos que requieran verle'] },
  paralizado: { incap: 1, vel0: 1, contra: 'Ventaja', crit: 1, ts: ['Falla automáticamente las TS de Fuerza y Destreza'] },
  petrificado: { incap: 1, vel0: 1, contra: 'Ventaja', ts: ['Falla automáticamente las TS de Fuerza y Destreza'], otros: () => ['Resistencia a todo el daño', 'Inmune al estado de envenenado'] }
};
function htmlReglas(enc, p) {
  const contra = new Set(), sus = new Set(), ts = new Set(), mov = new Set(), acc = new Set(), otros = new Set();
  let crit = false;
  for (const s of p.estados) {
    const r = REGLAS[s.id];
    const o = s.origen && partPorId(enc, s.origen) ? partPorId(enc, s.origen).nombre : '';
    if (s.id === 'cansancio') {
      const n = s.nivel || 1;
      sus.add(`−${2 * n} a todas sus pruebas con d20 (ataques, TS y pruebas)`);
      mov.add(`Velocidad reducida en ${String(1.5 * n).replace('.', ',')} m`);
      if (n >= 6) otros.add('Con nivel 6 de cansancio, muere');
      continue;
    }
    if (!r) continue;
    if (r.contra) contra.add(r.contra);
    if (r.contraTxt) contra.add(r.contraTxt);
    if (r.crit) crit = true;
    if (r.incap) { acc.add(INCAP_TXT); acc.add('Pierde la concentración'); }
    if (r.vel0) mov.add('Velocidad 0');
    (r.sus ? r.sus(o) : []).forEach(x => sus.add(x));
    (r.ts || []).forEach(x => ts.add(x));
    (r.mov ? r.mov(o) : []).forEach(x => mov.add(x));
    (r.otros ? r.otros(o) : []).forEach(x => otros.add(x));
  }
  if (contra.has('Ventaja')) [...contra].filter(x => x.startsWith('Ventaja si')).forEach(x => contra.delete(x)); // ya tiene ventaja siempre
  if (mov.has('Velocidad 0')) [...mov].filter(x => x !== 'Velocidad 0' && !/Velocidad reducida/.test(x)).forEach(x => x.startsWith('Solo puede') && mov.delete(x));
  const filas = [
    ['Atacarle', [...contra].concat(crit ? ['Si le aciertan a 1,5 m o menos: crítico automático'] : [])],
    ['Sus ataques', [...sus]], ['Salvaciones', [...ts]], ['Movimiento', [...mov]], ['Acciones', [...acc]], ['Además', [...otros]]
  ].filter(([, v]) => v.length);
  if (!filas.length) return '';
  return `<div class="reglas-box"><div class="reglas-tit">Recuerda (reglas de sus estados)</div>
    ${filas.map(([k, v]) => `<div class="regla-fila"><b>${k}</b><span>${v.map(esc).join(' · ')}</span></div>`).join('')}</div>`;
}

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
// Usos limitados de un monstruo en este encuentro (se gastan tocando las bolitas)
function htmlUsosMon(p) {
  const usos = usosDe(p);
  if (!usos.length) return '';
  return `<details class="sec-mon" data-k="usos" open><summary>Usos limitados <span class="cuenta">${usos.length}</span></summary>
    ${usos.map(u => `<div class="rec-fila"><span class="rec-nom">${u.conjuro ? `<i>${esc(u.nombre)}</i>` : esc(u.nombre)}
      <small>${u.tipo === 'recarga' ? `recarga ${esc(u.rango)} (d6 al inicio de su turno)` : u.tipo === 'descanso' ? 'se recupera con un descanso' : `${u.max}/día${u.nota ? ' · ' + esc(u.nota) : ''}`}</small></span>
      <span class="bolas">${bolas(u.max, u.usados, `data-a="usoMon" data-pid="${p.id}" data-uid="${u.id}"`, u.nombre)}</span></div>`).join('')}
  </details>`;
}
function htmlCombateMonstruo(m, p) {
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
    ${p ? htmlUsosMon(p) : ''}
    ${secciones}
  </div>`;
}
function htmlConjurosPJ(pj, pid) {
  const ids = (pj && pj.conjuros) || [];
  const lista = ids.map(id => CONJ.get(id)).filter(Boolean).sort(ordenConj);
  if (!lista.length) return '';
  return `<details class="sec-mon" data-k="conj-pj" open><summary>Conjuros <span class="cuenta">${lista.length}</span></summary>
    <div class="chips conj-chips">${lista.map(c => `<button class="chip conj" data-a="verConjuro" data-id="${c.id}" data-pj="${pj.id}" data-pid="${pid || ''}"><small>${c.nivel === 0 ? 'T' : c.nivel}</small>${esc(c.nombre)}${c.concentracion ? ' <em>C</em>' : ''}</button>`).join('')}</div></details>`;
}
// Botones de las salvaciones del perfil: tocar para marcar o quitar la competencia
function htmlSalvPJ(pj) {
  const comp = pj.salvComp || [];
  return CARS_PJ.map(([k], i) => `<button class="salv-btn${comp.includes(k) ? ' on' : ''}" data-a="togSalv" data-pj="${pj.id}" data-k="${k}" aria-pressed="${comp.includes(k)}">
    <span>${CARS[i]}</span><b>${signo(salvacionPJ(pj, k))}</b></button>`).join('');
}
// Modificadores y salvaciones del jugador en la ficha del combate (solo si se han rellenado)
function htmlCarsCombate(pj) {
  if (!pj || (!CARS_PJ.some(([k]) => pj[k] != null) && !(pj.salvComp || []).length)) return '';
  const comp = pj.salvComp || [];
  return `<div class="salvs" style="margin-top:10px" aria-label="Modificadores por característica"><span class="salv-tit">Características</span>
    ${CARS_PJ.map(([k], i) => `<span class="salv-chip"><b>${CARS[i]}</b>${pj[k] != null ? signo(modDe(pj[k])) : '—'}</span>`).join('')}</div>
    <div class="salvs" aria-label="Tiradas de salvación"><span class="salv-tit">Salvaciones</span>
    ${CARS_PJ.map(([k], i) => `<span class="salv-chip${comp.includes(k) ? ' comp' : ''}"><b>${CARS[i]}</b>${signo(salvacionPJ(pj, k))}</span>`).join('')}</div>`;
}
// Espacios de conjuro y recursos de un jugador. Se guardan en su PERFIL, así que se ven igual en todos los encuentros
function htmlRecursosPJ(pj, modo) {
  if (!pj) return '';
  const esp = espaciosPJ(pj); const rec = pj.recursos || []; const pacto = pj.pacto && pj.pacto.max ? pj.pacto : null;
  const editar = modo === 'perfil';
  const fila = (etq, sub, mx, us, k) => `<div class="rec-fila"><span class="rec-nom">${etq}${sub ? `<small>${sub}</small>` : ''}</span>
    ${editar ? `<span class="rec-max"><button class="icono peq" data-a="maxPJ" data-pj="${pj.id}" data-k="${k}" data-d="-1" aria-label="Menos">−</button><b>${mx}</b><button class="icono peq" data-a="maxPJ" data-pj="${pj.id}" data-k="${k}" data-d="1" aria-label="Más">+</button></span>` : ''}
    <span class="bolas">${bolas(mx, Math.min(us || 0, mx), `data-a="usoPJ" data-pj="${pj.id}" data-k="${k}"`, etq)}</span></div>`;
  const niveles = esp.max.map((mx, i) => ({ mx, us: esp.usados[i] || 0, n: i + 1 }));
  const ultimo = Math.max(0, ...niveles.filter(x => x.mx > 0).map(x => x.n));
  const visibles = niveles.filter(x => editar ? x.n <= Math.min(9, Math.max(ultimo + 1, 1)) : x.mx > 0);
  const filasEsp = visibles.map(x => fila(`Nivel ${x.n}`, '', x.mx, x.us, `esp:${x.n}`)).join('');
  const filaPacto = pacto ? fila('Magia del pacto', `espacios de nivel ${pacto.nivel} · descanso corto`, pacto.max, pacto.usados, 'pacto') : '';
  const filasRec = rec.map(r => {
    const d = defRecurso(r);
    const sub = TEXTO_REGLA[reglaRecurso(r, pj)] + (d && d.nota && editar ? ' · ' + d.nota : '');
    const ctrl = editar ? `<span class="rec-max"><button class="icono peq" data-a="maxPJ" data-pj="${pj.id}" data-k="rec:${r.id}" data-d="-1" aria-label="Menos">−</button><b>${r.max}</b><button class="icono peq" data-a="maxPJ" data-pj="${pj.id}" data-k="rec:${r.id}" data-d="1" aria-label="Más">+</button>
      ${d ? '' : `<button class="icono peq" data-a="recDescanso" data-pj="${pj.id}" data-id="${r.id}" aria-label="Cambiar descanso" title="Cambiar descanso">⟳</button>`}<button class="icono peq" data-a="quitarRecPJ" data-pj="${pj.id}" data-id="${r.id}" aria-label="Quitar">${ic(IC.cerrar)}</button></span>` : '';
    if (r.reserva) {
      // Reserva grande (Imponer las manos): contador con número en vez de bolitas
      const quedan = r.max - (r.usados || 0);
      return `<div class="rec-fila reserva"><span class="rec-nom">${esc(r.nombre)}<small>${sub}</small></span>${ctrl}
        <span class="reserva-ctrl"><b class="reserva-n">${quedan}<small> / ${r.max}</small></b>
          <input class="reserva-in" type="number" inputmode="numeric" min="1" placeholder="PG" aria-label="Cantidad">
          <button class="btn mini" data-a="gastarReserva" data-pj="${pj.id}" data-id="${r.id}" data-d="1">Gastar</button>
          <button class="btn mini" data-a="gastarReserva" data-pj="${pj.id}" data-id="${r.id}" data-d="-1">Devolver</button></span></div>`;
    }
    return `<div class="rec-fila"><span class="rec-nom">${esc(r.nombre)}<small>${sub}</small></span>${ctrl}
      <span class="bolas">${bolas(r.max, Math.min(r.usados || 0, r.max), `data-a="usoPJ" data-pj="${pj.id}" data-k="rec:${r.id}"`, r.nombre)}</span></div>`;
  }).join('');
  if (!editar) {
    if (!filasEsp && !filaPacto && !filasRec) return '';
    return `<details class="sec-mon" data-k="rec-pj" open><summary>Espacios y recursos</summary>${filaPacto}${filasEsp}${filasRec}
      <p class="nota" style="margin:4px 0 8px">Toca una bolita para gastar o recuperar. Se guarda en su perfil.</p></details>`;
  }
  const tipo = tipoLanzador(pj.clase); const clase = claseDe(pj.clase);
  const sugerencias = (RECURSOS_CLASE[clase] || []).map(d => d.nombre);
  return `<section class="bloque recursos-pj">
    ${tipo || clase ? `<button class="btn ancho" data-a="rellenarEspacios" data-pj="${pj.id}">Rellenar espacios y recursos según su clase y nivel</button>
      <p class="nota" style="margin-top:0">Usa las tablas del SRD. Vuelve a pulsarlo cuando suba de nivel.</p>` : ''}
    <div class="bloque-cab"><h2>Espacios de conjuro</h2></div>
    ${!tipo && !ultimo && !pacto ? '<p class="nota">Si lanza conjuros, pon cuántos espacios tiene de cada nivel con + y −.</p>' : ''}
    ${filaPacto}${filasEsp}
    <div class="bloque-cab" style="margin-top:14px"><h2>Recursos de clase</h2></div>
    <p class="nota" style="margin-top:0">Tomar aliento, Furia, Canalizar divinidad… Cada uno se recupera con el descanso que indica el SRD.</p>
    ${filasRec}
    <div class="fila-anadir"><input id="rec-nombre" list="rec-sug" placeholder="Añadir otro recurso"><datalist id="rec-sug">${sugerencias.map(n => `<option value="${esc(n)}">`).join('')}</datalist><button class="btn peq" data-a="nuevoRecPJ" data-pj="${pj.id}">${ic(IC.mas)} Añadir</button></div>
    <div class="botonera"><button class="btn peq" data-a="descanso" data-tipo="corto" data-pj="${pj.id}">Descanso corto</button><button class="btn peq" data-a="descanso" data-tipo="largo" data-pj="${pj.id}">Descanso largo</button></div>
  </section>`;
}
// Aplica un descanso a uno o varios personajes (solo espacios y recursos; los PG se gestionan en cada encuentro)
function aplicarDescanso(pjs, tipo) {
  for (const pj of pjs) {
    if (pj.pacto) pj.pacto.usados = 0;
    for (const r of pj.recursos || []) {
      const regla = reglaRecurso(r, pj);
      if (tipo === 'largo' || regla === 'corto') r.usados = 0;
      else if (regla === 'uno') r.usados = Math.max(0, (r.usados || 0) - 1); // descanso corto: solo un uso
    }
    if (tipo === 'largo') { const e = espaciosPJ(pj); e.usados = Array(9).fill(0); }
  }
  guardar();
}

// Estados que esta criatura ha causado a otras (p. ej. el osgo: «Agarrado» en Thorin), para soltarlos desde aquí
function htmlEfectosCausados(enc, p) {
  const lista = [];
  for (const q of enc.participantes) for (const s of q.estados) if (s.origen === p.id) lista.push({ q, s });
  if (!lista.length) return '';
  return `<div class="hp-sec causados"><h4>Efectos que causa</h4>
    ${lista.map(({ q, s }) => `<div class="fila-est"><div class="est-txt"><b>${esc(s.nombre)}</b> en ${esc(q.nombre)}
      <span class="est-dur">${s.vinculo === 'conc' ? 'Depende de su concentración' : s.vinculo === 'cae' ? 'Termina si queda incapacitado o cae' : 'No depende de él'}${s.rondas != null ? ` · quedan ${s.rondas}` : ''}</span></div>
      <div class="est-acc"><button class="btn mini" data-a="quitarEstado" data-pid="${q.id}" data-uid="${s.uid}">${s.id === 'agarrado' ? 'Soltar' : 'Terminar'}</button></div></div>`).join('')}
  </div>`;
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
        <span class="est-dur">${dur}${s.ts ? ` · TS de ${CARS_LARGO[s.ts.car]}${s.ts.cd ? ' CD ' + s.ts.cd : ''}` : ''}${s.nota ? ' · ' + esc(s.nota) : ''}</span>
        ${s.origen && partPorId(enc, s.origen) ? `<span class="est-dur est-origen">Lo causa ${esc(partPorId(enc, s.origen).nombre)}${s.vinculo === 'conc' ? ' · termina si pierde la concentración' : s.vinculo === 'cae' ? ' · termina si queda incapacitado o cae' : ''}</span>` : ''}</div>
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
    ${htmlReglas(enc, p)}
    ${htmlEfectosCausados(enc, p)}
    ${m ? htmlCombateMonstruo(m, p) : ''}
    ${p.tipo === 'pj' ? htmlCarsCombate(pjPorId(p.ref)) + htmlRecursosPJ(pjPorId(p.ref), 'combate') + htmlConjurosPJ(pjPorId(p.ref), p.id) : ''}
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
      ${p.tipo !== 'pj' ? `<button class="btn peq" data-a="copiarPart" data-pid="${p.id}">Copiar a otro encuentro</button>` : ''}
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
    ${p.tipo !== 'pj' ? `<label class="check"><input type="checkbox" id="e-aliado" ${p.aliado ? 'checked' : ''}><span>Es un aliado de los jugadores<small>No cuenta para la dificultad del encuentro</small></span></label>` : ''}
    <button class="btn primario ancho" data-a="editarOk">Guardar cambios</button>
    ${p.tipo !== 'pj' ? `<button class="btn ancho" data-a="copiarPart" data-pid="${p.id}">Copiar a otro encuentro (con sus PG y usos)</button>` : ''}`, { fija: true });
  h.encId = enc.id; h.pid = pid; h.nombreOriginal = p.nombre;
}

function hojaEstado(pidInicial) {
  const enc = encActual(); if (!enc) return;
  const ps = enc.participantes;
  // Quien lo causa, por defecto: la criatura a la que le toca (si no es el propio objetivo)
  const origenDefecto = enc.combate && enc.combate.turnoId !== pidInicial ? enc.combate.turnoId : '';
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
    <div class="vinculo">
      <label class="campo"><span>Lo causa</span><select id="fe-origen" data-ch="feOrigen"><option value="">Nadie en concreto</option>${ps.map(p => `<option value="${p.id}" ${p.id === origenDefecto ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></label>
      <label class="campo"><span>Termina antes si quien lo causa…</span><select id="fe-vinc" data-ch="feVinc">
        <option value="">(no depende de él)</option>
        <option value="conc">…pierde la concentración</option>
        <option value="cae">…queda incapacitado o cae</option>
      </select></label>
      <p class="nota" style="margin:0">Así, si el fanático pierde la concentración o cae el osgo que agarra, la app quita el estado sola.</p>
    </div>
    <label class="campo"><span>Nota (opcional)</span><input id="fe-nota" placeholder="p. ej. Inmovilizar persona · CD 12 para escapar"></label>
    <div class="campo"><span>Aplicar a</span><div class="chips" id="fe-obj">${ps.filter(p => !p.derrotado || p.id === pidInicial).map(p => `<button class="chip ${p.id === pidInicial ? 'on' : ''}" data-a="selChip" data-id="${p.id}">${esc(p.nombre)}</button>`).join('')}</div></div>
    <button class="btn primario ancho" data-a="feOk">Añadir estado</button>`, { fija: true });
  h.encId = enc.id; h.estadoSel = null; h.vincManual = false;
}
// Propuesta automática de «termina si…»: el agarre acaba si quien agarra queda incapacitado (SRD);
// si quien lo causa se está concentrando, lo normal es que dependa de su concentración
function proponerVinculo(h) {
  if (h.vincManual) return;
  const enc = encPorId(h.encId); const o = partPorId(enc, $('#fe-origen', h.el).value);
  let v = '';
  if (o && h.estadoSel === 'agarrado') v = 'cae';
  else if (o && o.conc) v = 'conc';
  $('#fe-vinc', h.el).value = v;
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
  for (const p of copia.participantes) { p.id = uid(); p.estados = []; p.pg = p.pgMax; p.pgTemp = 0; p.ini.tirada = null; p.ini.manual = null; p.derrotado = false; p.conc = false; p.muerte = { ok: 0, ko: 0 }; p.estable = false; if (p.usos) p.usos.forEach(u => u.usados = 0); }
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
  for (const p of enc.participantes) { p.pg = p.pgMax; p.pgTemp = 0; p.estados = []; p.conc = false; p.reaccion = false; p.derrotado = false; p.muerte = { ok: 0, ko: 0 }; p.estable = false; p.ini.tirada = null; p.ini.manual = null; if (p.leg) p.leg.usadas = 0; if (p.usos) p.usos.forEach(u => u.usados = 0); }
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
  delete enc.resumen;
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
  proponerVinculo(h);
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
    nota: $('#fe-nota', h.el).value.trim(),
    origen: $('#fe-origen', h.el).value || null,
    vinculo: $('#fe-vinc', h.el).value || null
  };
  if (datos.vinculo && !datos.origen) return toast('Elige quién lo causa');
  const origen = partPorId(enc, datos.origen);
  const inmunes = [];
  accionCombate(enc, () => {
    // Si depende de la concentración de quien lo causa, esa criatura empieza a concentrarse
    if (datos.vinculo === 'conc' && origen && !origen.conc) { origen.conc = true; registrar(enc, `${origen.nombre} empieza a concentrarse`); }
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
A.verConjuro = el => hojaConjuro(el.dataset.id, el.dataset.pj, el.dataset.pid);
// ---- Espacios y recursos de los personajes ----
function cambiarUsoPJ(pj, k, d, campo) {
  if (k.startsWith('esp:')) {
    const i = +k.slice(4) - 1; const e = espaciosPJ(pj);
    if (campo === 'max') { e.max[i] = Math.max(0, Math.min(9, e.max[i] + d)); e.usados[i] = Math.min(e.usados[i] || 0, e.max[i]); }
    else e.usados[i] = Math.max(0, Math.min(e.max[i], (e.usados[i] || 0) + d));
  } else if (k === 'pacto') {
    pj.pacto ||= { max: 0, nivel: 1, usados: 0 };
    if (campo === 'max') { pj.pacto.max = Math.max(0, Math.min(4, pj.pacto.max + d)); pj.pacto.usados = Math.min(pj.pacto.usados, pj.pacto.max); }
    else pj.pacto.usados = Math.max(0, Math.min(pj.pacto.max, pj.pacto.usados + d));
  } else if (k.startsWith('rec:')) {
    const r = (pj.recursos || []).find(x => x.id === k.slice(4)); if (!r) return;
    if (campo === 'max') { r.max = Math.max(1, Math.min(r.reserva ? 300 : 20, r.max + d)); r.usados = Math.min(r.usados || 0, r.max); }
    else r.usados = Math.max(0, Math.min(r.max, (r.usados || 0) + d));
  }
  guardar();
}
A.usoPJ = el => { const pj = pjPorId(el.dataset.pj); if (!pj) return; cambiarUsoPJ(pj, el.dataset.k, +el.dataset.d, 'usados'); refrescar(); };
A.maxPJ = el => { const pj = pjPorId(el.dataset.pj); if (!pj) return; cambiarUsoPJ(pj, el.dataset.k, +el.dataset.d, 'max'); refrescar(); };
A.rellenarEspacios = el => {
  const pj = pjPorId(el.dataset.pj); if (!pj) return;
  const tipo = tipoLanzador(pj.clase); const n = Math.max(1, Math.min(20, pj.nivel || 1));
  const e = espaciosPJ(pj);
  if (tipo === 'pacto') {
    const [max, nivel] = PACTO_BRUJO[n];
    pj.pacto = { max, nivel, usados: Math.min((pj.pacto && pj.pacto.usados) || 0, max) };
  } else if (tipo) {
    const tabla = (tipo === 'completo' ? ESPACIOS_COMPLETO : ESPACIOS_MEDIO)[n];
    e.max = Array.from({ length: 9 }, (_, i) => tabla[i] || 0);
    e.usados = e.usados.map((u, i) => Math.min(u || 0, e.max[i]));
  }
  // Recursos de su clase con los usos de su nivel (la Inspiración bárdica, según su Carisma)
  const defs = (RECURSOS_CLASE[claseDe(pj.clase)] || []).filter(d => n >= d.desde);
  pj.recursos ||= [];
  for (const d of defs) {
    let r = pj.recursos.find(x => x.clave === d.clave);
    if (!r) { r = { id: uid(), clave: d.clave, nombre: d.nombre, max: d.max(n, pj), usados: 0 }; pj.recursos.push(r); }
    else r.max = d.max(n, pj);
    r.reserva = !!d.reserva; r.usados = Math.min(r.usados || 0, r.max);
  }
  const partes = [];
  const salv = salvacionesDeClase(pj.clase, n);
  if (salv) { pj.salvComp = salv; partes.push('Salvaciones: ' + salv.map(c => CARS[CARS_PJ.findIndex(([x]) => x === c)]).join(', ')); }
  if (tipo === 'pacto') partes.push(`Pacto: ${pj.pacto.max} espacios de nivel ${pj.pacto.nivel}`);
  else if (tipo) partes.push(`Espacios: ${(tipo === 'completo' ? ESPACIOS_COMPLETO : ESPACIOS_MEDIO)[n].join(' / ')}`);
  if (defs.length) partes.push(defs.map(d => `${d.nombre.replace(/ \(.*\)$/, '')} ${pj.recursos.find(x => x.clave === d.clave).max}`).join(', '));
  toast(partes.length ? `Nivel ${n}: ${partes.join(' · ')}` : 'Su clase no tiene espacios ni recursos en el SRD');
  guardar(); refrescar();
};
A.nuevoRecPJ = el => {
  const pj = pjPorId(el.dataset.pj); const inp = $('#rec-nombre'); const nombre = inp && inp.value.trim();
  if (!pj || !nombre) return toast('Escribe el nombre del recurso');
  pj.recursos ||= [];
  // Si es un recurso de clase conocido, la app sabe sus usos y cómo se recupera
  const d = Object.values(RECURSOS_CLASE).flat().find(x => norm(x.nombre) === norm(nombre) || norm(x.nombre).startsWith(norm(nombre) + ' ('));
  if (d && pj.recursos.some(x => x.clave === d.clave)) return toast(`${d.nombre} ya está en su lista`);
  const n = Math.max(1, Math.min(20, pj.nivel || 1));
  pj.recursos.push(d ? { id: uid(), clave: d.clave, nombre: d.nombre, max: d.max(n, pj), usados: 0, reserva: !!d.reserva } : { id: uid(), nombre, max: 1, usados: 0, descanso: 'largo' });
  guardar(); refrescar();
  toast(d ? `${d.nombre}: ${TEXTO_REGLA[reglaRecurso({ clave: d.clave }, pj)]}` : `${nombre} añadido: ajusta los usos con + y − y el descanso con ⟳`);
};
A.togSalv = el => {
  const pj = pjPorId(el.dataset.pj); if (!pj) return;
  const k = el.dataset.k; pj.salvComp ||= [];
  pj.salvComp = pj.salvComp.includes(k) ? pj.salvComp.filter(x => x !== k) : [...pj.salvComp, k];
  guardar();
  const sv = $('#pj-salv'); if (sv) sv.innerHTML = htmlSalvPJ(pj); else refrescar();
};
A.gastarReserva = el => {
  const pj = pjPorId(el.dataset.pj); const r = pj && (pj.recursos || []).find(x => x.id === el.dataset.id); if (!r) return;
  const inp = el.closest('.rec-fila').querySelector('.reserva-in'); const n = num(inp && inp.value);
  if (!n || n < 1) { inp && inp.focus(); return toast('Escribe cuántos puntos'); }
  const d = +el.dataset.d; const antes = r.usados || 0;
  r.usados = Math.max(0, Math.min(r.max, antes + d * n)); guardar();
  const enc = encActual();
  if (enc && enc.combate && d > 0) accionCombate(enc, () => registrar(enc, `${pj.nombre} gasta ${r.usados - antes} de ${r.nombre} (quedan ${r.max - r.usados})`));
  else refrescar();
  toast(`${r.nombre}: quedan ${r.max - r.usados} de ${r.max}`);
};
A.quitarRecPJ = async el => {
  const pj = pjPorId(el.dataset.pj); const r = pj && (pj.recursos || []).find(x => x.id === el.dataset.id); if (!r) return;
  const ok = await preguntar(`¿Quitar el recurso «${esc(r.nombre)}» de ${esc(pj.nombre)}?`, [{ t: 'Quitar', v: true, clase: 'peligro' }, { t: 'Cancelar' }]);
  if (!ok) return;
  pj.recursos = pj.recursos.filter(x => x !== r); guardar(); refrescar();
};
A.recDescanso = el => {
  const pj = pjPorId(el.dataset.pj); const r = pj && (pj.recursos || []).find(x => x.id === el.dataset.id); if (!r) return;
  r.descanso = r.descanso === 'corto' ? 'largo' : 'corto'; guardar(); refrescar();
  toast(`${r.nombre}: se recupera con ${r.descanso === 'corto' ? 'un descanso corto o largo' : 'un descanso largo'}`);
};
A.descanso = async el => {
  const tipo = el.dataset.tipo; const todos = !el.dataset.pj;
  const pjs = todos ? E.personajes : [pjPorId(el.dataset.pj)].filter(Boolean);
  if (!pjs.length) return;
  const quien = todos ? 'todo el grupo' : pjs[0].nombre;
  const que = tipo === 'largo' ? 'todos los espacios de conjuro y recursos' : 'la Magia del pacto y los recursos de descanso corto (algunos, como Tomar aliento, solo un uso)';
  const ok = await preguntar(`¿Descanso ${tipo} para ${esc(quien)}? Se recuperan ${que}.`, [{ t: `Descanso ${tipo}`, v: true, clase: 'primario' }, { t: 'Cancelar' }]);
  if (!ok) return;
  aplicarDescanso(pjs, tipo); refrescar(); toast(`Descanso ${tipo}: ${quien} recupera ${que}`);
};
A.lanzarConj = el => {
  const h = hojaActual(); const L = h && h.lanzar; if (!L) return;
  const pj = pjPorId(L.pjId); const c = CONJ.get(L.cid); if (!pj || !c) return;
  const k = el.dataset.k;
  cambiarUsoPJ(pj, k, 1, 'usados');
  const enc = encActual(); const p = L.pid && partPorId(enc, L.pid);
  const nivelEsp = k === 'pacto' ? pj.pacto.nivel : +k.slice(4);
  const texto = `${pj.nombre} lanza ${c.nombre} con un espacio de nivel ${nivelEsp}`;
  if (enc && enc.combate && p) accionCombate(enc, () => { registrar(enc, texto); if (c.concentracion && !p.conc) { p.conc = true; registrar(enc, `${p.nombre} empieza a concentrarse en ${c.nombre}`); } });
  else refrescar();
  h.cerrar();
  const quedan = k === 'pacto' ? pj.pacto.max - pj.pacto.usados : espaciosPJ(pj).max[nivelEsp - 1] - espaciosPJ(pj).usados[nivelEsp - 1];
  toast(`${texto} (le quedan ${quedan})${c.concentracion && p ? ' · se concentra' : ''}`);
};
// ---- Usos limitados de los monstruos ----
A.usoMon = el => {
  const enc = encActual(); const p = partPorId(enc, el.dataset.pid); if (!p) return;
  const u = usosDe(p).find(x => x.id === el.dataset.uid); if (!u) return;
  const d = +el.dataset.d;
  const hacer = () => { u.usados = Math.max(0, Math.min(u.max, u.usados + d)); if (enc.combate) registrar(enc, `${p.nombre} ${d > 0 ? 'usa' : 'recupera un uso de'} ${u.nombre}${d > 0 ? ` (le quedan ${u.max - u.usados})` : ''}`); };
  if (enc.combate) accionCombate(enc, hacer); else { hacer(); guardar(); refrescar(); }
};
// ---- Copiar un monstruo (con sus PG y usos) a otro encuentro: p. ej. un jefe que huye ----
A.copiarPart = el => {
  const enc = encActual(); const p = partPorId(enc, el.dataset.pid); if (!p) return;
  const otros = E.encuentros.filter(e => e.id !== enc.id).sort((a, b) => (b.mod || 0) - (a.mod || 0));
  const h = abrirHoja(() => `<div class="hp-cab"><div><h3>Copiar ${esc(p.nombre)}</h3><div class="sub">Se copia con sus PG actuales (${p.pg}/${p.pgMax}) y los usos que le quedan. Sin estados.</div></div><button class="icono" data-a="cerrarHoja" aria-label="Cerrar">${ic(IC.cerrar)}</button></div>
    <div class="botonera col">${otros.map(e => `<button class="btn" data-a="copiarPartOk" data-enc="${e.id}">${esc(e.nombre)}${e.combate ? ' (en combate)' : ''}</button>`).join('')}
    <button class="btn primario" data-a="copiarPartOk" data-enc="">${ic(IC.mas)} En un encuentro nuevo</button></div>`, { fija: true });
  h.origen = { enc: enc.id, pid: p.id };
};
A.copiarPartOk = el => {
  const h = hojaActual(); const enc = encPorId(h.origen.enc); const p = partPorId(enc, h.origen.pid); if (!p) return;
  let destino = encPorId(el.dataset.enc);
  if (!destino) { destino = { id: uid(), nombre: `Encuentro ${E.encuentros.length + 1}`, participantes: [], combate: null, notas: '', mod: Date.now() }; E.encuentros.push(destino); }
  const c = JSON.parse(JSON.stringify(p));
  Object.assign(c, { id: uid(), estados: [], conc: false, reaccion: false, nombreAuto: false, derrotado: p.pg === 0 });
  c.ini = Object.assign({}, c.ini, { tirada: null, manual: null, cambio: null });
  if (c.leg) c.leg.usadas = 0;
  destino.participantes.push(c);
  if (destino.combate) { c.ini.tirada = 10; insertarEnOrden(destino, c); }
  destino.mod = Date.now(); guardar();
  h.cerrar();
  toast(`${p.nombre} copiado a «${destino.nombre}»${destino.combate ? ' con iniciativa fija' : ''}`);
};
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
    if (p && a.accion.q === 'recargar') { const u = usosDe(p).find(x => x.id === a.accion.uid); if (u) { u.usados = 0; registrar(enc, `${p.nombre} recarga ${u.nombre}`); } }
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
A.cerrarResumen = () => { const enc = encActual(); if (!enc) return; delete enc.resumen; guardar(); refrescar(); };
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
  enc.resumen = resumenCombate(enc);
  enc.combate = null; modoReordenar = false; delete pilasDeshacer[enc.id]; guardar();
  toast('Combate terminado');
  navegar('#/encuentro/' + enc.id);
};
// Resumen del combate (sin experiencia): asaltos, enemigos, cómo acaba cada jugador y qué sigue activo
function resumenCombate(enc) {
  const c = enc.combate; const log = c.log || [];
  const recibido = {}, curado = {}, caidas = {};
  for (const l of log) {
    let m = l.t.match(/^(.+) recibe (\d+) de daño \((\d+) → (\d+) PG\)$/);
    if (m) { recibido[m[1]] = (recibido[m[1]] || 0) + +m[2]; if (+m[3] > 0 && +m[4] === 0) caidas[m[1]] = (caidas[m[1]] || 0) + 1; continue; }
    m = l.t.match(/^(.+) se cura (\d+) \(/);
    if (m) curado[m[1]] = (curado[m[1]] || 0) + +m[2];
  }
  const enemigos = enc.participantes.filter(p => p.tipo !== 'pj' && !p.aliado);
  return {
    asaltos: c.asalto,
    enemigos: { derrotados: enemigos.filter(p => p.derrotado).length, total: enemigos.length },
    jugadores: enc.participantes.filter(p => p.tipo === 'pj').map(p => ({
      nombre: p.nombre, pg: p.pg, pgMax: p.pgMax, muerto: muertoPJ(p),
      caidas: caidas[p.nombre] || 0, recibido: recibido[p.nombre] || 0, curado: curado[p.nombre] || 0
    })),
    activos: enc.participantes.filter(p => !p.derrotado && (p.conc || p.estados.length)).map(p => ({
      nombre: p.nombre, conc: p.conc,
      estados: p.estados.map(s => s.nombre + (s.nivel ? ' ' + s.nivel : '') + (s.rondas != null ? ` (${s.rondas} turnos)` : ''))
    }))
  };
}
function htmlResumen(r) {
  if (!r) return '';
  return `<div class="resumen-combate"><h3>Resumen del último combate <button class="icono peq" data-a="cerrarResumen" aria-label="Ocultar resumen">${ic(IC.cerrar)}</button></h3>
    <p>${r.asaltos} asalto${r.asaltos === 1 ? '' : 's'} · enemigos derrotados: <b>${r.enemigos.derrotados} de ${r.enemigos.total}</b></p>
    <ul>${r.jugadores.map(j => `<li><b>${esc(j.nombre)}</b>: ${j.muerto ? '<b style="color:var(--peligro)">muerto</b>' : `${j.pg}/${j.pgMax} PG`} · recibió ${j.recibido}${j.curado ? `, curado ${j.curado}` : ''}${j.caidas ? ` · cayó a 0 PG ${j.caidas === 1 ? 'una vez' : j.caidas + ' veces'}` : ''}</li>`).join('')}</ul>
    ${r.activos.length ? `<p><b>Sigue activo</b> (decide tú si continúa fuera del combate):</p>
      <ul>${r.activos.map(a => `<li><b>${esc(a.nombre)}</b>: ${[a.conc ? 'concentrado en un conjuro' : '', ...a.estados.map(esc)].filter(Boolean).join(', ')}</li>`).join('')}</ul>` : ''}
  </div>`;
}

// ============ Creador de personajes (SRD 5.2.1, paso a paso) ============
const CR = window.CREACION || null;
const WZ_PASOS = ['Clase', 'Trasfondo', 'Especie', 'Características', 'Conjuros', 'Alineamiento', 'Detalles', 'Resumen'];
// Trucos y conjuros de nivel 1 que elige cada clase al crear el personaje (rasgo Lanzamiento de conjuros, SRD 5.2.1)
const CONJ_CLASE_N1 = {
  bardo: { trucos: 2, conjuros: 4 }, brujo: { trucos: 2, conjuros: 2 }, clerigo: { trucos: 3, conjuros: 4 }, druida: { trucos: 2, conjuros: 4 },
  explorador: { trucos: 0, conjuros: 2 }, hechicero: { trucos: 4, conjuros: 2 }, mago: { trucos: 3, conjuros: 6, libro: 4 }, paladin: { trucos: 0, conjuros: 2 }
};
const LISTAS_MAGIA = [['clerigo', 'Clérigo'], ['druida', 'Druida'], ['mago', 'Mago']];
const CAR_NOMBRE = Object.fromEntries(CARS_PJ);
const CAR_ABR = Object.fromEntries(CARS_PJ.map(([k], i) => [k, CARS[i]]));
const wzNuevo = () => ({
  paso: 0, clase: null, habClase: [], equipoClase: 'A', trasfondo: null, equipoTras: 'A',
  especie: null, linaje: null, tamano: null, aptitud: null, habEspecie: null, doteHumano: null, habDote: [],
  tiradas: ['', '', '', '', '', ''], orden: null, modoBonus: '21', bonus2: null, bonus1: null,
  alineamiento: null, nombre: '', jugador: '', descripcion: '', personalidad: '', idiomas: [],
  conj: {}, magia: {}, pericia: [], herrClase: [], herrTras: [], herrDote: [], estilo: null
});
// ---- Elecciones de clase compartidas por el creador y la subida de nivel ----
const TABLA = (c, k, n) => ((CR.tablas || {})[c] || {})[k] ? CR.tablas[c][k][Math.max(1, Math.min(20, n)) - 1] : 0;
// Armas con las que cada clase puede usar la maestría (rasgo Maestría con armas, SRD 5.2.1)
const FILTRO_MAESTRIA = { barbaro: a => a.tipo === 'cac', picaro: a => a.categoria === 'sencilla' || /ligera|sutil/i.test(a.propiedades) };
const nMaestria = (c, n) => TABLA(c, 'maestria', n);
function htmlMaestria(cid, elegidas, ya, chip) {
  const f = FILTRO_MAESTRIA[cid] || (() => true);
  const grupos = [['Cuerpo a cuerpo sencillas', a => a.categoria === 'sencilla' && a.tipo === 'cac'], ['A distancia sencillas', a => a.categoria === 'sencilla' && a.tipo === 'distancia'], ['Cuerpo a cuerpo marciales', a => a.categoria === 'marcial' && a.tipo === 'cac'], ['A distancia marciales', a => a.categoria === 'marcial' && a.tipo === 'distancia']];
  return grupos.map(([t, g]) => { const l = (CR.armas || []).filter(a => f(a) && g(a)); return l.length ? `<p class="wz-grupo-herr">${t}</p><div class="chips">${l.map(a => chip(a.nombre, elegidas.includes(a.nombre), `${a.nombre} · ${a.maestria}`, !elegidas.includes(a.nombre) && ya.includes(a.nombre))).join('')}</div>` : ''; }).join('')
    + `<details class="regla"><summary>¿Qué hace cada maestría?</summary><div class="cuerpo">${(CR.maestrias || []).map(m => `<p><b>${esc(m.nombre)}.</b> ${esc(m.texto)}</p>`).join('')}</div></details>`;
}
// Invocaciones sobrenaturales que puede aprender (requisitos del SRD)
function invocacionValida(inv, nivel, conocidas, trucos) {
  if (inv.nivelMin > nivel) return 'requiere brujo de nivel ' + inv.nivelMin;
  if (inv.requiereInvocacion && !conocidas.includes(inv.requiereInvocacion)) return 'requiere ' + ((CR.invocaciones.find(x => x.id === inv.requiereInvocacion) || {}).nombre || inv.requiereInvocacion);
  if (inv.requiereTruco) {
    const ok = trucos.map(id => CONJ.get(id)).some(c => c && !c.nivel && (c.clases || []).some(k => slug(k) === 'brujo') && /daño/.test(c.html) && (inv.requiereTruco !== 'ataque' || /tirada de ataque/.test(c.html)));
    if (!ok) return 'requiere un truco de brujo que cause daño' + (inv.requiereTruco === 'ataque' ? ' con tirada de ataque' : '');
  }
  return '';
}
function htmlInvocaciones(nivel, conocidas, elegidas, trucos, op) {
  return `<div class="wz-ops">${(CR.invocaciones || []).map(inv => {
    const on = elegidas.includes(inv.id), ya = conocidas.includes(inv.id) && !inv.repetible;
    const no = ya ? 'ya la conoce' : invocacionValida(inv, nivel, [...conocidas, ...elegidas.filter(x => x !== inv.id)], trucos);
    return op(inv.id, on, `<b>${esc(inv.nombre)}</b><small>${inv.requisitos ? 'Requisitos: ' + esc(inv.requisitos) : 'Sin requisitos'}${no && !on ? ` · <span class="no">${esc(no)}</span>` : ''}</small>${on ? `<div class="wz-op-det">${inv.html}</div>` : ''}`, !!no && !on);
  }).join('')}</div>`;
}
// Orden divina (clérigo) y Orden primigenia (druida)
const ORDENES = {
  clerigo: { rasgo: 'Orden divina', ops: [['protector', 'Protector', 'Competencia con armas marciales y entrenamiento con armaduras pesadas'], ['taumaturgo', 'Taumaturgo', 'Un truco de clérigo adicional y bonificador a Conocimiento arcano y Religión']] },
  druida: { rasgo: 'Orden primigenia', ops: [['guardian', 'Guardián', 'Competencia con armas marciales y entrenamiento con armaduras medias'], ['naturalista', 'Naturalista', 'Un truco de druida adicional y bonificador a Conocimiento arcano y Naturaleza']] }
};
function detalleOrden(c, nombre) {
  const r = c.rasgos.find(x => x.nombre === ORDENES[c.id].rasgo);
  const p = r && r.html.split(/<\/p><p>/).map(x => x.replace(/^<p>|<\/p>$/g, '')).find(x => norm(x.replace(/<[^>]+>/g, '')).startsWith(norm(nombre)));
  return p ? `<p>${p.replace(/^<strong>[^<]*<\/strong>\s*/, '')}</p>` : '';
}
// Grupos de conjuros del Pacto del grimorio (3 trucos de cualquier lista y 2 rituales de nivel 1)
const GRIMORIO = [{ k: 'grimT', titulo: 'Pacto del grimorio: 3 trucos de cualquier lista', n: 3, filtro: x => x.nivel === 0 }, { k: 'grimR', titulo: 'Pacto del grimorio: 2 rituales de nivel 1 de cualquier lista', n: 2, filtro: x => x.nivel === 1 && x.ritual }];
// Conjuros que se tienen siempre preparados, por nivel de clase (rasgos de clase y subclase del SRD 5.2.1)
const CONJ_SIEMPRE_CLASE = { explorador: { 1: ['Marca del cazador'] }, paladin: { 2: ['Castigo divino'], 5: ['Hallar corcel'] } };
const CONJ_SUBCLASE = {
  brujo: { 3: ['Manos ardientes', 'Orden imperiosa', 'Rayo abrasador', 'Sugestión'], 5: ['Bola de fuego', 'Nube apestosa'], 7: ['Escudo de fuego', 'Muro de fuego'], 9: ['Geas', 'Plaga de insectos'] },
  clerigo: { 3: ['Auxilio', 'Bendición', 'Curar heridas', 'Restablecimiento menor'], 5: ['Palabra de curación en masa', 'Revivir'], 7: ['Aura de vida', 'Guarda contra la muerte'], 9: ['Curar heridas en masa', 'Restablecimiento mayor'] },
  hechicero: { 3: ['Aliento de dragón', 'Alterar el propio aspecto', 'Orbe cromático', 'Orden imperiosa'], 5: ['Terror', 'Volar'], 7: ['Hechizar monstruo', 'Ojo arcano'], 9: ['Conocer las leyendas', 'Invocar dragón'] },
  paladin: { 3: ['Escudo de fe', 'Protección contra el bien y el mal'], 5: ['Auxilio', 'Zona de la verdad'], 9: ['Disipar magia', 'Señal de esperanza'], 13: ['Guardián de la fe', 'Libertad de movimiento'], 17: ['Comunión', 'Golpe flamígero'] }
};
// Círculo de la tierra (druida): conjuros según el terreno elegido (se puede cambiar tras un descanso largo)
const TERRENOS_DRUIDA = {
  arido: { nombre: 'Árido', conj: { 3: ['Contorno borroso', 'Descarga de fuego', 'Manos ardientes'], 5: ['Bola de fuego'], 7: ['Marchitar'], 9: ['Muro de piedra'] } },
  polar: { nombre: 'Polar', conj: { 3: ['Inmovilizar persona', 'Nube de oscurecimiento', 'Rayo de escarcha'], 5: ['Tormenta de aguanieve'], 7: ['Tormenta de hielo'], 9: ['Cono de frío'] } },
  templado: { nombre: 'Templado', conj: { 3: ['Agarre electrizante', 'Dormir', 'Paso brumoso'], 5: ['Relámpago'], 7: ['Libertad de movimiento'], 9: ['Paso arbóreo'] } },
  tropical: { nombre: 'Tropical', conj: { 3: ['Rayo nauseabundo', 'Salpicadura ácida', 'Telaraña'], 5: ['Nube apestosa'], 7: ['Polimorfar'], 9: ['Plaga de insectos'] } }
};
const idConj = n => (CONJS.find(x => norm(x.nombre) === norm(n)) || {}).id;
// Conjuros automáticos hasta el nivel n: [{id, origen}] (clase, subclase, terreno y los de nivel 3 y 5 del linaje)
function conjSiempre(cid, n, hoja) {
  const out = [], add = (nombres, origen) => nombres.forEach(x => { const id = idConj(x); if (id && !out.some(o => o.id === id)) out.push({ id, origen }); });
  const porNivel = (t, origen) => Object.entries(t || {}).forEach(([nv, l]) => { if (+nv <= n) add(l, origen); });
  porNivel(CONJ_SIEMPRE_CLASE[cid], 'clase');
  if (n >= 3) porNivel(CONJ_SUBCLASE[cid], 'subclase');
  if (cid === 'druida' && n >= 3 && TERRENOS_DRUIDA[hoja.terreno]) porNivel(TERRENOS_DRUIDA[hoja.terreno].conj, 'terreno');
  const e = CR.especies.find(x => x.id === hoja.especie), l = e && e.linaje && e.linaje.opciones.find(o => o.id === hoja.linaje);
  if (l && l.nivel3 && n >= 3) add([l.nivel3], 'especie');
  if (l && l.nivel5 && n >= 5) add([l.nivel5], 'especie');
  return out;
}
// Metamagia del hechicero (2 en el nivel 2, 2 más en el 10 y en el 17) y Arcanum místico del brujo
const METAMAGIA_NIVEL = { 2: 2, 10: 2, 17: 2 };
const ARCANUM_NIVEL = { 11: 6, 13: 7, 15: 8, 17: 9 };
// Académico (mago, nivel 2): pericia en una de estas habilidades en las que ya sea competente
const SENTIDOS_AGUDOS = ['Percepción', 'Perspicacia', 'Supervivencia'];
const ACADEMICO = ['Conocimiento arcano', 'Historia', 'Investigación', 'Medicina', 'Naturaleza', 'Religión'];
// ---- Armadura y escudo que lleva puestos (SRD 5.2.1, pág. 100, tabla «Armaduras») ----
const ARMADURAS = [
  { id: 'acolchada', nombre: 'Armadura acolchada', tipo: 'ligera', base: 11, sigilo: true },
  { id: 'cuero', nombre: 'Armadura de cuero', tipo: 'ligera', base: 11 },
  { id: 'cuero-tachonado', nombre: 'Armadura de cuero tachonado', tipo: 'ligera', base: 12 },
  { id: 'pieles', nombre: 'Armadura de pieles', tipo: 'media', base: 12 },
  { id: 'camisa-de-malla', nombre: 'Camisa de malla', tipo: 'media', base: 13 },
  { id: 'cota-de-escamas', nombre: 'Cota de escamas', tipo: 'media', base: 14, sigilo: true },
  { id: 'coraza', nombre: 'Coraza', tipo: 'media', base: 14 },
  { id: 'media-armadura', nombre: 'Media armadura', tipo: 'media', base: 15, sigilo: true },
  { id: 'cota-guarnecida', nombre: 'Cota guarnecida', tipo: 'pesada', base: 14, sigilo: true },
  { id: 'cota-de-malla', nombre: 'Cota de malla', tipo: 'pesada', base: 16, fue: 13, sigilo: true },
  { id: 'bandas', nombre: 'Armadura de bandas', tipo: 'pesada', base: 17, fue: 15, sigilo: true },
  { id: 'placas', nombre: 'Armadura de placas', tipo: 'pesada', base: 18, fue: 15, sigilo: true }
];
const TIPOS_ARMADURA = [['ligera', 'Armaduras ligeras (1 minuto para ponérsela o quitársela)'], ['media', 'Armaduras medias (5 minutos para ponérsela, 1 para quitársela)'], ['pesada', 'Armaduras pesadas (10 minutos para ponérsela, 5 para quitársela)']];
const armaduraInicial = txt => (ARMADURAS_INICIALES.find(a => a.re.test(norm(txt || ''))) || {}).id || null;
const escudoInicial = txt => /\bescudo\b/.test(norm(txt || ''));
// ¿Tiene entrenamiento con ese tipo de armadura o con escudos? (clase + Protector/Guardián, ya incluidos en hoja.armaduras)
const entrenadoArmadura = (texto, tipo) => new RegExp({ ligera: 'ligera', media: 'media', pesada: 'pesada', escudo: 'escudo' }[tipo]).test(norm(texto || ''));
// Personajes creados antes de esta versión: se deduce su armadura del equipo inicial y se guarda como bonificador
// extra la diferencia con la CA que ya tenían (así no se pierde lo que se hubiera ajustado a mano)
function equipoPJ(pj) {
  const h = pj.hoja; if (!h || h.armadura !== undefined) return h;
  const eq = (h.equipo || [])[0] || '';
  Object.assign(h, { armadura: armaduraInicial(eq), escudo: escudoInicial(eq), armaduraMago: false, caExtra: 0 });
  h.equipoActual ??= (h.equipo || []).join('\n');
  const calc = caPJ(pj), arm = ARMADURAS.find(a => a.id === h.armadura), md = modDe(pj.des ?? 10);
  // Antes, con armadura pesada se restaba la Destreza negativa por error: esa diferencia no es un ajuste
  const fallo = arm && arm.tipo === 'pesada' && md < 0 && pj.ca === calc.total + md;
  h.caExtra = pj.ca == null || fallo ? 0 : pj.ca - calc.total;
  return h;
}
// CA con lo que lleva puesto. o.cars / o.n / o.dotes permiten calcularla con otras puntuaciones, nivel o dotes (subida de nivel)
function caPJ(pj, o = {}) {
  const h = pj.hoja, c = clasePJ(pj) || {}, cars = o.cars || pj, n = o.n || pj.nivel || 1;
  const dotes = o.dotes || (h.dotes || []).map(d => d.id), md = k => modDe(cars[k] ?? 10);
  const arm = ARMADURAS.find(a => a.id === h.armadura), partes = [], avisos = [], notas = [];
  const textoArm = h.armaduras || c.armaduras || '';
  let total;
  if (arm) {
    const des = arm.tipo === 'ligera' ? md('des') : arm.tipo === 'media' ? Math.min(2, md('des')) : 0;
    total = arm.base + des;
    partes.push(`${arm.nombre} ${arm.base}${arm.tipo === 'pesada' ? '' : ` ${signo(des)} Des${arm.tipo === 'media' ? ' (máx. +2)' : ''}`}`);
    if (!entrenadoArmadura(textoArm, arm.tipo)) avisos.push(`No tiene entrenamiento con armaduras ${arm.tipo}s: desventaja en las pruebas con d20 de Fuerza o Destreza y no puede lanzar conjuros.`);
    if (arm.fue && (cars.fue ?? 10) < arm.fue) avisos.push(`Necesita Fuerza ${arm.fue} para esta armadura: su velocidad baja 3 m.`);
    if (arm.sigilo) notas.push('Con esta armadura tiene desventaja en las pruebas de Destreza (Sigilo).');
  } else {
    const ops = [[10 + md('des'), 'Sin armadura: 10 ' + signo(md('des')) + ' Des']];
    if (c.id === 'barbaro') ops.push([10 + md('des') + md('con'), `Defensa sin armadura: 10 ${signo(md('des'))} Des ${signo(md('con'))} Con`]);
    if (c.id === 'monje' && !h.escudo) ops.push([10 + md('des') + md('sab'), `Defensa sin armadura: 10 ${signo(md('des'))} Des ${signo(md('sab'))} Sab`]);
    if (c.id === 'hechicero' && n >= 3) ops.push([10 + md('des') + md('car'), `Resistencia dracónica: 10 ${signo(md('des'))} Des ${signo(md('car'))} Car`]);
    if (h.armaduraMago) ops.push([13 + md('des'), `Armadura de mago: 13 ${signo(md('des'))} Des`]);
    const mejor = ops.reduce((a, b) => b[0] > a[0] ? b : a);
    total = mejor[0]; partes.push(mejor[1]);
  }
  if (c.id === 'monje' && (arm || h.escudo)) avisos.push(`Con ${arm ? 'armadura' : 'escudo'} el monje pierde Defensa sin armadura, Artes marciales y Movimiento sin armadura.`);
  if (c.id === 'barbaro' && arm && arm.tipo === 'pesada') avisos.push('Con armadura pesada el bárbaro no puede entrar en furia (y la furia termina si se la pone).');
  if (h.escudo) {
    if (entrenadoArmadura(textoArm, 'escudo')) { total += 2; partes.push('escudo +2'); }
    else avisos.push('No tiene entrenamiento con escudos: el escudo no le suma +2 a la CA.');
  }
  if (arm && dotes.includes('defensa')) { total += 1; partes.push('Defensa +1'); }
  if (h.caExtra) { total += h.caExtra; partes.push(`otros ${signo(h.caExtra)}`); }
  return { total, partes, avisos, notas, arm };
}
// Velocidad con lo que lleva puesto: rasgos de clase que dependen de la armadura y Fuerza mínima de la armadura pesada
function velocidadPJ(pj, velBase) {
  const h = pj.hoja, c = clasePJ(pj), n = pj.nivel || 1, vx = velocidadExtra(c, n), arm = ARMADURAS.find(a => a.id === h.armadura);
  const aplica = vx.m && (c.id === 'monje' ? !arm && !h.escudo : !(arm && arm.tipo === 'pesada'));
  const lenta = arm && arm.fue && (pj.fue ?? 10) < arm.fue;
  return { total: velBase + (aplica ? vx.m : 0) - (lenta ? 3 : 0), vx, aplica, lenta, arm };
}
// Bonificador extra a habilidades: Taumaturgo / Naturalista (Sabiduría, mínimo +1)
const notaExtraHab = (orden, habs) => { const l = habs.filter(x => x.extra); return l.length ? ` ${esc(orden)}: ya incluye +${l[0].extra} (Sabiduría) en ${l.map(x => esc(x.nombre)).join(' y ')}.` : ''; };
function extraOrdenHab(orden, hid, sab) {
  const ok = (orden === 'taumaturgo' && (hid === 'conocimiento-arcano' || hid === 'religion')) || (orden === 'naturalista' && (hid === 'conocimiento-arcano' || hid === 'naturaleza'));
  return ok ? Math.max(1, modDe(sab ?? 10)) : 0;
}
A.wzLista = el => {
  const w = WZ(), k = el.dataset.k, v = el.dataset.v, max = +el.dataset.max;
  const l = (w[k] ||= []), i = l.indexOf(v);
  if (i >= 0) l.splice(i, 1);
  else if (l.length >= max) { toast(`Ya has elegido ${max}. Quita uno primero.`); return; }
  else l.push(v);
  if (k === 'invoc' && !l.includes('pacto-del-grimorio')) { w.conj ||= {}; w.conj.grimT = []; w.conj.grimR = []; }
  wzPintar(false);
};
// Estilo de combate de nivel 1 (guerrero)
const wzEstilo1 = () => { const c = CR && E.borradorPJ && wzClase(); return !!c && c.rasgos.some(r => r.nivel === 1 && r.nombre === 'Estilo de combate'); };
// ---- Herramientas (SRD 5.2.1, capítulo «Equipo») ----
const HERR = () => (CR && CR.herramientas) || [];
// Herramientas que una clase o un trasfondo dejan elegir
function eleccionHerr(texto) {
  const t = norm(texto || '');
  if (/^elige tres instrumentos/.test(t)) return { n: 3, filtro: h => h.grupo === 'Instrumento musical', txt: 'Elige 3 instrumentos musicales' };
  if (/^elige un tipo de herramientas de artesano o instrumento/.test(t)) return { n: 1, filtro: h => h.categoria === 'artesano' || h.grupo === 'Instrumento musical', txt: 'Elige 1 herramienta de artesano o instrumento musical' };
  if (/^elige un tipo de juego/.test(t)) return { n: 1, filtro: h => h.grupo === 'Juego', txt: 'Elige 1 juego' };
  return null;
}
const herrFija = txt => { const h = HERR().find(x => norm(x.nombre) === norm(txt)); return h ? h.nombre : txt.charAt(0).toUpperCase() + txt.slice(1); };
// Herramientas con competencia y de dónde vienen
function wzHerramientas() {
  const w = WZ(), c = wzClase(), t = wzTras(), m = new Map();
  const add = (n, origen) => { if (n && !m.has(norm(n))) m.set(norm(n), { nombre: n, origen }); };
  if (c && c.herramientas) { if (eleccionHerr(c.herramientas)) (w.herrClase || []).forEach(n => add(n, 'clase')); else add(herrFija(c.herramientas), 'clase'); }
  if (t && t.herramienta) { if (eleccionHerr(t.herramienta)) (w.herrTras || []).forEach(n => add(n, 'trasfondo')); else add(herrFija(t.herramienta), 'trasfondo'); }
  if (w.especie === 'humano' && w.doteHumano === 'habilidoso') (w.herrDote || []).forEach(n => add(n, 'dote'));
  return m;
}
// Herramientas que llegan a la vez por la clase y por el trasfondo: solo cuentan una vez (el SRD no da otra a cambio)
function wzHerrRepetidas() {
  const w = WZ(), c = wzClase(), t = wzTras(), m = new Map();
  const add = (n, o) => { if (!n) return; const k = norm(n); if (!m.has(k)) m.set(k, { nombre: n, origenes: [] }); m.get(k).origenes.push(o); };
  if (c && c.herramientas) { if (eleccionHerr(c.herramientas)) (w.herrClase || []).forEach(n => add(n, { de: 'clase', nombre: c.nombre, elegida: true })); else add(herrFija(c.herramientas), { de: 'clase', nombre: c.nombre }); }
  if (t && t.herramienta) { if (eleccionHerr(t.herramienta)) (w.herrTras || []).forEach(n => add(n, { de: 'trasfondo', nombre: t.nombre, elegida: true })); else add(herrFija(t.herramienta), { de: 'trasfondo', nombre: t.nombre }); }
  return [...m.values()].filter(x => x.origenes.length > 1);
}
function htmlAvisoHerr() {
  const paso = WZ().paso;
  return wzHerrRepetidas().map(r => {
    const cl = r.origenes.find(o => o.de === 'clase'), tr = r.origenes.find(o => o.de === 'trasfondo');
    return `<div class="aviso malo"><span><b>${esc(r.nombre)}</b> está repetida: la da su clase (<b>${esc(cl.nombre)}</b>${cl.elegida ? ', la elegiste tú' : ''}) y su trasfondo (<b>${esc(tr.nombre)}</b>). Solo aparecerá una vez y no se cambia por otra herramienta. Si lo prefieres, cambia la clase${cl.elegida ? ' (o la herramienta que elegiste en ella)' : ''} o el trasfondo.
      <span class="botonera-mini"><button class="btn mini" data-a="wzIr" data-n="0">Cambiar clase</button>${paso > 1 ? '<button class="btn mini" data-a="wzIr" data-n="1">Cambiar trasfondo</button>' : ''}</span></span></div>`;
  }).join('');
}
const GRUPOS_HERR = [['Herramientas de artesano', h => h.categoria === 'artesano'], ['Instrumentos musicales', h => h.grupo === 'Instrumento musical'], ['Juegos', h => h.grupo === 'Juego'], ['Otras herramientas', h => h.categoria === 'otra' && !h.grupo]];
// Chips para elegir herramientas (agrupadas). «ocupada» = ya la tiene por otro lado
function htmlElegirHerr(k, filtro, elegidas, ocupada) {
  return GRUPOS_HERR.map(([titulo, f]) => {
    const ops = HERR().filter(h => f(h) && filtro(h)); if (!ops.length) return '';
    return `<p class="wz-grupo-herr">${titulo}</p><div class="chips">${ops.map(h => wzChip('wzHerr', k, h.nombre, elegidas.includes(h.nombre), h.grupo ? h.nombre.replace(/^[^:]+:\s*/, '') : h.nombre, !elegidas.includes(h.nombre) && ocupada(h.nombre))).join('')}</div>`;
  }).join('');
}
// ---- Pericia del pícaro (rasgo de nivel 1, SRD 5.2.1) ----
const esPicaro = () => WZ().clase === 'picaro';
function wzPericia() { const comp = wzCompetencias(); return (WZ().pericia || []).filter(h => comp.has(norm(h))); }
function wzNombrePaso(i) {
  if (i !== 4 || !CR || !E.borradorPJ) return WZ_PASOS[i];
  const conj = wzGruposConj().length || wzConjFijos().length || wzMagiaDotes().length;
  const partes = [esPicaro() && 'Pericia', wzEstilo1() && 'Estilo de combate', (conj || (!esPicaro() && !wzEstilo1())) && 'Conjuros'].filter(Boolean);
  return partes.length > 1 ? partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1].toLowerCase() : partes[0];
}
const WZ = () => E.borradorPJ;
const wzClase = () => CR.clases.find(c => c.id === WZ().clase);
const wzTras = () => CR.trasfondos.find(t => t.id === WZ().trasfondo);
const wzEsp = () => CR.especies.find(e => e.id === WZ().especie);
const wzLinaje = () => { const e = wzEsp(); return e && e.linaje ? e.linaje.opciones.find(o => o.id === WZ().linaje) : null; };
const doteSRD = id => CR.dotes.find(d => d.id === id);
// Armaduras que aparecen en el equipo inicial de las clases (SRD 5.2.1, tabla «Armaduras»)
const ARMADURAS_INICIALES = [
  { re: /cuero tachonado/, id: 'cuero-tachonado' },
  { re: /armadura de cuero/, id: 'cuero' },
  { re: /camisa de malla/, id: 'camisa-de-malla' },
  { re: /cota de malla/, id: 'cota-de-malla' }
];
// Resumen corto de cada linaje (se ve antes de elegirlo)
const RESUMEN_LINAJE = {
  azul: 'Aliento de relámpago · resistencia al relámpago', blanco: 'Aliento de frío · resistencia al frío', bronce: 'Aliento de relámpago · resistencia al relámpago',
  cobre: 'Aliento de ácido · resistencia al ácido', negro: 'Aliento de ácido · resistencia al ácido', oro: 'Aliento de fuego · resistencia al fuego',
  oropel: 'Aliento de fuego · resistencia al fuego', plata: 'Aliento de frío · resistencia al frío', rojo: 'Aliento de fuego · resistencia al fuego', verde: 'Aliento de veneno · resistencia al veneno',
  'alto-elfo': 'Truco prestidigitación (puede cambiarlo por otro truco de mago)', drow: 'Visión en la oscuridad de 36 m · truco luces danzantes', 'elfo-de-los-bosques': 'Velocidad de 10,5 m · truco saber druídico',
  'gnomo-de-las-rocas': 'Trucos prestidigitación y reparar · fabrica pequeños aparatos mecánicos', 'gnomo-de-los-bosques': 'Truco ilusión menor · hablar con los animales sin gastar espacios',
  'abrasion-del-fuego': 'Al acertar un ataque, +1d10 de daño de fuego', 'caida-de-las-colinas': 'Al acertar un ataque, puede derribar al objetivo',
  'excursion-de-las-nubes': 'Acción adicional: teletransporte de hasta 9 m', 'frio-de-la-escarcha': 'Al acertar un ataque, +1d6 de frío y le quita 3 m de velocidad',
  'resistencia-de-la-piedra': 'Reacción: reduce el daño que recibe en 1d12 + Con', 'trueno-de-la-tormenta': 'Reacción: 1d8 de trueno a quien le dañe (a 18 m o menos)',
  abisal: 'Resistencia al veneno · truco rociada venenosa', ctonico: 'Resistencia al daño necrótico · truco toque helado', infernal: 'Resistencia al fuego · truco descarga de fuego'
};
// Descripción completa de UN linaje (la del SRD)
function detalleLinaje(e, o) {
  if (o.dano) return `<p>Tu <b>Ataque de aliento</b> causa daño de <b>${esc(o.dano)}</b> y tienes <b>resistencia</b> al daño de ${esc(o.dano)}. Tu aspecto recuerda a un dragón ${esc(o.nombre.toLowerCase())}.</p>`;
  if (o.nivel1) return `<p><b>Nivel 1:</b> ${o.nivel1}</p>${o.nivel3 ? `<p><b>Nivel 3:</b> aprende <em>${esc(o.nivel3.toLowerCase())}</em>. <b>Nivel 5:</b> aprende <em>${esc(o.nivel5.toLowerCase())}</em>. Puede lanzar cada uno una vez sin gastar espacio (se recupera con un descanso largo).</p>` : ''}`;
  // Gnomo y goliat: el texto de cada opción está dentro del rasgo del linaje
  const r = e.rasgos.find(x => x.nombre === e.linaje.rasgo);
  const p = r && r.html.split(/<\/p><p>/).map(x => x.replace(/^<p>|<\/p>$/g, '')).find(x => norm(x.replace(/<[^>]+>/g, '')).startsWith(norm(o.nombre)));
  return p ? `<p>${p.replace(/^<strong>[^<]*<\/strong>\s*/, '')}</p>` : '';
}
const dadoGolpe = c => +String(c.dado).replace(/^\d*d/i, '') || 8;
const nHabClase = c => c.habilidades.n || (c.habilidades.cualquiera ? 3 : 2);
const opcionesHabClase = c => c.habilidades.cualquiera ? CR.habilidades.map(h => h.nombre) : c.habilidades.opciones;
// Orden de preferencia de las características: por defecto, el reparto que el SRD recomienda para la clase
function wzOrden() {
  const w = WZ(); if (w.orden) return w.orden;
  const ord = CR.puntuaciones.ordenCar, v = CR.puntuaciones.conjuntoPorClase[w.clase];
  return v ? ord.slice().sort((a, b) => v[ord.indexOf(b)] - v[ord.indexOf(a)]) : ord.slice();
}
const tiradasValidas = () => WZ().tiradas.map(x => x === '' ? NaN : +x).filter(n => Number.isInteger(n) && n >= 3 && n <= 18);
function wzBase() {
  const t = tiradasValidas(); if (t.length < 6) return null;
  const s = t.slice().sort((a, b) => b - a), o = wzOrden();
  return Object.fromEntries(o.map((k, i) => [k, s[i]]));
}
function wzBonus() {
  const w = WZ(), tr = wzTras(); if (!tr) return {};
  const c = tr.caracteristicas;
  if (w.modoBonus === '111') return Object.fromEntries(c.map(k => [k, 1]));
  const o = wzOrden(), pref = c.slice().sort((a, b) => o.indexOf(a) - o.indexOf(b));
  const b2 = c.includes(w.bonus2) ? w.bonus2 : pref[0];
  const b1 = c.includes(w.bonus1) && w.bonus1 !== b2 ? w.bonus1 : pref.find(k => k !== b2);
  return { [b2]: 2, [b1]: 1 };
}
function wzFinal() {
  const b = wzBase(); if (!b) return null;
  const bo = wzBonus();
  return Object.fromEntries(CARS_PJ.map(([k]) => [k, Math.min(20, b[k] + (bo[k] || 0))]));
}
// Habilidades con competencia y de dónde vienen
function wzCompetencias() {
  const w = WZ(), m = new Map();
  const add = (n, origen) => { if (n && !m.has(norm(n))) m.set(norm(n), { nombre: n, origen }); };
  (w.habClase || []).forEach(n => add(n, 'clase'));
  const tr = wzTras(); if (tr) tr.habilidades.forEach(n => add(n, 'trasfondo'));
  add(w.habEspecie, 'especie');
  if (w.doteHumano === 'habilidoso') (w.habDote || []).forEach(n => add(n, 'dote'));
  return m;
}
function wzDotes() {
  const w = WZ(), tr = wzTras(), l = [];
  if (tr) l.push({ id: tr.doteId, nombre: tr.dote, origen: 'trasfondo' });
  if (w.especie === 'humano' && w.doteHumano) { const d = doteSRD(w.doteHumano); if (d) l.push({ id: d.id, nombre: d.nombre, origen: 'especie' }); }
  if (wzEstilo1() && w.estilo) { const d = doteSRD(w.estilo); if (d) l.push({ id: d.id, nombre: d.nombre, origen: 'clase' }); }
  return l;
}
function wzFalta(p) {
  const w = WZ(), c = wzClase(), e = wzEsp();
  if (p === 0) {
    if (!c) return 'Elige una clase'; if (w.habClase.length !== nHabClase(c)) return `Elige ${nHabClase(c)} habilidades de la clase`;
    const eh = eleccionHerr(c.herramientas); if (eh && (w.herrClase || []).length !== eh.n) return eh.txt + ' (herramientas de la clase)';
    if (ORDENES[c.id] && !w.ordenClase) return 'Elige ' + ORDENES[c.id].rasgo;
    if (nMaestria(c.id, 1) && (w.maestria || []).length !== nMaestria(c.id, 1)) return `Maestría con armas: elige ${nMaestria(c.id, 1)} armas`;
    if (c.id === 'brujo' && (w.invoc || []).length !== 1) return 'Elige una invocación sobrenatural';
  }
  if (p === 1) {
    const t = wzTras(); if (!t) return 'Elige un trasfondo';
    const rep = t.habilidades.filter(h => w.habClase.some(x => norm(x) === norm(h)));
    if (rep.length) return `${rep.join(' y ')} se repite: cámbiala en el paso de clase`;
    const eh = eleccionHerr(t.herramienta); if (eh && (w.herrTras || []).length !== eh.n) return eh.txt + ' (herramienta del trasfondo)';
  }
  if (p === 2) {
    if (!e) return 'Elige una especie';
    if (e.linaje && !wzLinaje()) return `Elige: ${e.linaje.rasgo}`;
    if (e.linaje && e.linaje.aptitud && !w.aptitud) return 'Elige la aptitud mágica de su linaje';
    if (e.tamanos.length > 1 && !w.tamano) return 'Elige su tamaño';
    const comp = wzCompetencias(), origen = h => (comp.get(norm(h)) || {}).origen;
    if (e.id === 'elfo' && !w.habEspecie && SENTIDOS_AGUDOS.every(h => origen(h))) return 'Sentidos agudos: ya es competente en Percepción, Perspicacia y Supervivencia. Cambia una habilidad de la clase en el paso 1';
    if ((e.id === 'elfo' || e.id === 'humano') && !w.habEspecie) return 'Elige la habilidad que da su especie';
    if (w.habEspecie && origen(w.habEspecie) !== 'especie') return `${w.habEspecie} ya la tiene por su ${origen(w.habEspecie)}: elige otra habilidad de especie`;
    const repDote = w.doteHumano === 'habilidoso' ? w.habDote.filter(h => origen(h) !== 'dote') : [];
    if (repDote.length) return `Habilidoso: ${repDote.join(' y ')} ya la tiene por otro lado: quítala y elige otra`;
    if (e.id === 'humano' && !w.doteHumano) return 'Elige la dote de origen (Versátil)';
    const tr = wzTras(), dh = w.doteHumano && doteSRD(w.doteHumano);
    if (e.id === 'humano' && tr && dh && dh.id === tr.doteId && !dh.repetible) return `Versátil: ${dh.nombre} ya la da su trasfondo y no se puede tener dos veces. Elige otra dote`;
    if (e.id === 'humano' && w.doteHumano === 'habilidoso' && w.habDote.length + (w.herrDote || []).length !== 3) return 'Habilidoso: elige 3 entre habilidades y herramientas';
  }
  if (p === 3 && !wzBase()) return 'Escribe las 6 tiradas (cada una entre 3 y 18)';
  if (p === 4) {
    if (esPicaro() && wzPericia().length !== 2) return 'Pericia: elige 2 habilidades';
    if (wzEstilo1() && !w.estilo) return 'Elige el estilo de combate';
    for (const m of wzMagiaDotes()) { if (!m.lista) return 'Elige la lista de conjuros de Iniciado en la magia'; if (!m.apt) return 'Elige la aptitud mágica de Iniciado en la magia'; }
    const grupos = wzGruposConj(), fijos = [...wzConjFijos(), ...wzConjClaseFijos()];
    for (const g of grupos) { const n = wzDisponibles(g, grupos, fijos); if (g.elegidos.length !== n) return `${g.titulo}: elige ${n} (llevas ${g.elegidos.length})`; }
  }
  if (p === 5 && !w.alineamiento) return 'Elige un alineamiento';
  if (p === 6) { if (!w.nombre.trim()) return 'Escribe el nombre del personaje'; if (w.idiomas.length !== 2) return 'Elige 2 idiomas además del común'; }
  return '';
}
const wzOp = (accion, k, v, on, titulo, sub) => `<button class="wz-op${on ? ' on' : ''}" data-a="${accion}" data-k="${k}" data-v="${esc(v)}" aria-pressed="${on}"><b>${esc(titulo)}</b>${sub ? `<small>${sub}</small>` : ''}</button>`;
const wzChip = (accion, k, v, on, txt, deshab) => `<button class="chip${on ? ' on' : ''}" data-a="${accion}" data-k="${k}" data-v="${esc(v)}" aria-pressed="${on}" ${deshab ? 'disabled' : ''}>${esc(txt)}</button>`;
const wzRasgos = (lista, k) => lista.map((r, i) => `<details class="regla" data-k="${k}-${i}"><summary>${esc(r.nombre)}</summary><div class="cuerpo">${r.html}</div></details>`).join('');

function wzPasoClase() {
  const w = WZ(), c = wzClase();
  let html = `<p class="nota">La clase es lo que tu personaje sabe hacer: combatir, lanzar conjuros, sanar… Toca una para ver sus detalles.</p>
    <div class="wz-ops">${CR.clases.map(x => wzOp('wzSet', 'clase', x.id, x.id === w.clase, x.nombre, `Característica principal: ${esc(x.caracteristica)} · Dado de golpe ${esc(x.dado)}`)).join('')}</div>`;
  if (c) {
    const n = nHabClase(c), ops = opcionesHabClase(c);
    html += `<section class="bloque" id="wz-detalle"><h2 style="font-size:1rem;margin:0 0 6px">${esc(c.nombre)}</h2>
      <div class="wz-det"><p><b>Salvaciones:</b> ${esc(c.salvaciones)}</p><p><b>Armaduras:</b> ${esc(c.armaduras)}</p><p><b>Armas:</b> ${esc(c.armas)}</p>${c.herramientas && !/^ninguna/i.test(c.herramientas) ? `<p><b>Herramientas:</b> ${esc(c.herramientas)}</p>` : ''}</div>
      <h3 class="sub-tit">Elige ${n} habilidades <span class="cuenta">${w.habClase.length}/${n}</span></h3>
      <div class="chips">${ops.map(h => wzChip('wzHab', 'habClase', h, w.habClase.includes(h), h)).join('')}</div>
      ${(() => { const eh = eleccionHerr(c.herramientas); return eh ? `<h3 class="sub-tit">Herramientas: ${eh.txt.toLowerCase()} <span class="cuenta">${(w.herrClase || []).length}/${eh.n}</span></h3>${htmlElegirHerr('herrClase', eh.filtro, w.herrClase || [], () => false)}` : ''; })()}
      ${htmlAvisoHerr()}
      ${ORDENES[c.id] ? `<h3 class="sub-tit">${ORDENES[c.id].rasgo}</h3><p class="nota" style="margin-top:0">Elige una de las dos funciones. Toca una para leerla entera.</p>
        <div class="wz-ops">${ORDENES[c.id].ops.map(([id, nom, res]) => { const on = w.ordenClase === id; return `<button class="wz-op${on ? ' on' : ''}" data-a="wzSet" data-k="ordenClase" data-v="${id}" aria-pressed="${on}"><b>${nom}</b><small>${res}</small>${on ? `<div class="wz-op-det">${detalleOrden(c, nom)}</div>` : ''}</button>`; }).join('')}</div>` : ''}
      ${nMaestria(c.id, 1) ? `<h3 class="sub-tit">Maestría con armas: elige ${nMaestria(c.id, 1)} tipos de armas <span class="cuenta">${(w.maestria || []).length}/${nMaestria(c.id, 1)}</span></h3>
        <p class="nota" style="margin-top:0">Con esas armas podrá usar su propiedad de maestría (aparece junto al nombre). Tras un descanso largo puede cambiar una.</p>
        ${htmlMaestria(c.id, w.maestria || [], [], (v, on, txt, des) => `<button class="chip${on ? ' on' : ''}" data-a="wzLista" data-k="maestria" data-v="${esc(v)}" data-max="${nMaestria(c.id, 1)}" ${des ? 'disabled' : ''}>${esc(txt)}</button>`)}` : ''}
      ${c.id === 'brujo' ? `<h3 class="sub-tit">Invocación sobrenatural: elige 1 <span class="cuenta">${(w.invoc || []).length}/1</span></h3>
        <p class="nota" style="margin-top:0">El SRD pone de ejemplo el Pacto del grimorio. A nivel 1 solo puede elegir las que no piden nivel ni otros requisitos. Toca una para leerla.</p>
        ${htmlInvocaciones(1, [], w.invoc || [], [], (v, on, inner, des) => `<button class="wz-op${on ? ' on' : ''}" data-a="wzLista" data-k="invoc" data-v="${v}" data-max="1" ${des ? 'disabled' : ''}>${inner}</button>`)}` : ''}
      <h3 class="sub-tit">Equipo inicial</h3>
      <div class="wz-ops">${Object.entries(c.equipoOpciones).map(([k, v]) => wzOp('wzSet', 'equipoClase', k, w.equipoClase === k, 'Opción ' + k, esc(v))).join('')}</div>
      <h3 class="sub-tit">Rasgos de nivel 1</h3>${wzRasgos(c.rasgos.filter(r => r.nivel === 1), 'rc')}</section>`;
  }
  return html;
}
function wzPasoTrasfondo() {
  const w = WZ(), t = wzTras();
  let html = `<p class="nota">El trasfondo es lo que hacía tu personaje antes de ser aventurero. Le da una dote, dos habilidades, una herramienta y aumentos de características.</p>
    <div class="wz-ops">${CR.trasfondos.map(x => wzOp('wzSet', 'trasfondo', x.id, x.id === w.trasfondo, x.nombre, `${x.caracteristicas.map(k => CAR_ABR[k]).join(', ')} · ${esc(x.dote)} · ${x.habilidades.map(esc).join(', ')}`)).join('')}</div>`;
  if (t) {
    const d = doteSRD(t.doteId);
    const repetidas = t.habilidades.filter(h => w.habClase.some(x => norm(x) === norm(h)));
    html += `<section class="bloque" id="wz-detalle"><h2 style="font-size:1rem;margin:0 0 6px">${esc(t.nombre)}</h2>
      <div class="wz-det"><p><b>Características:</b> ${t.caracteristicas.map(k => CAR_NOMBRE[k]).join(', ')} (las subirás en el paso de características)</p>
      <p><b>Habilidades:</b> ${t.habilidades.map(esc).join(' y ')}</p><p><b>Herramienta:</b> ${esc(t.herramienta)}</p></div>
      ${(() => { const eh = eleccionHerr(t.herramienta); if (!eh) return ''; const deClase = new Set((w.herrClase || []).map(norm)); return `<h3 class="sub-tit">${eh.txt} <span class="cuenta">${(w.herrTras || []).length}/${eh.n}</span></h3>${htmlElegirHerr('herrTras', eh.filtro, w.herrTras || [], n => deClase.has(norm(n)))}`; })()}
      ${repetidas.length ? `<div class="aviso malo"><span><b>${repetidas.map(esc).join(' y ')}</b> ya la${repetidas.length > 1 ? 's' : ''} elegiste en la clase. Vuelve al paso 1 y elige otra${repetidas.length > 1 ? 's' : ''} en su lugar.</span><button class="btn mini" data-a="wzIr" data-n="0">Cambiar</button></div>` : ''}
      ${htmlAvisoHerr()}
      <h3 class="sub-tit">Dote: ${esc(t.dote)}</h3>${d ? `<div class="wz-det">${d.html}</div>` : ''}
      ${t.doteId === 'iniciado-en-la-magia' ? `<p class="nota">Los 2 trucos y el conjuro de nivel 1 de ${esc(t.doteNota)} los elegirás en el paso «Conjuros».</p>` : ''}
      <h3 class="sub-tit">Equipo</h3>
      <div class="wz-ops">${Object.entries(t.equipoOpciones).map(([k, v]) => wzOp('wzSet', 'equipoTras', k, w.equipoTras === k, 'Opción ' + k, esc(v))).join('')}</div></section>`;
  }
  return html;
}
function wzPasoEspecie() {
  const w = WZ(), e = wzEsp();
  let html = `<p class="nota">La especie da el tamaño, la velocidad y unos atributos especiales.</p>
    <div class="wz-ops">${CR.especies.map(x => wzOp('wzSet', 'especie', x.id, x.id === w.especie, x.nombre, `${x.tamanos.join(' o ')} · ${String(x.velocidad).replace('.', ',')} m${x.vision ? ` · visión en la oscuridad ${x.vision} m` : ''}`)).join('')}</div>`;
  if (e) {
    const comp = wzCompetencias();
    const ocupada = h => comp.has(norm(h)) && comp.get(norm(h)).origen !== 'especie' && comp.get(norm(h)).origen !== 'dote';
    html += `<section class="bloque" id="wz-detalle"><h2 style="font-size:1rem;margin:0 0 6px">${esc(e.nombre)}</h2>`;
    if (e.linaje) {
      const l = e.linaje;
      html += `<h3 class="sub-tit">${esc(l.rasgo)}</h3><p class="nota" style="margin-top:0">Toca uno para elegirlo y leer lo que da.</p>
        <div class="wz-ops">${l.opciones.map(o => {
          const on = o.id === w.linaje;
          return `<button class="wz-op${on ? ' on' : ''}" data-a="wzSet" data-k="linaje" data-v="${o.id}" aria-pressed="${on}" aria-expanded="${on}"><b>${esc(o.nombre)}</b><small>${esc(RESUMEN_LINAJE[o.id] || '')}</small>${on ? `<div class="wz-op-det">${detalleLinaje(e, o)}</div>` : ''}</button>`;
        }).join('')}</div>`;
      if (l.aptitud) html += `<h3 class="sub-tit">Aptitud mágica del linaje</h3><div class="seg">${['int', 'sab', 'car'].map(k => `<button class="opc ${w.aptitud === k ? 'on' : ''}" data-a="wzSet" data-k="aptitud" data-v="${k}">${CAR_NOMBRE[k]}</button>`).join('')}</div>`;
    }
    if (e.tamanos.length > 1) html += `<h3 class="sub-tit">Tamaño</h3><div class="seg">${e.tamanos.map(t => `<button class="opc ${w.tamano === t ? 'on' : ''}" data-a="wzSet" data-k="tamano" data-v="${t}">${t}</button>`).join('')}</div><p class="nota" style="margin-top:0">${esc(e.tamanoTexto)}</p>`;
    if (e.id === 'elfo') html += `<h3 class="sub-tit">Sentidos agudos: elige una habilidad</h3><div class="chips">${SENTIDOS_AGUDOS.map(h => wzChip('wzSet', 'habEspecie', h, w.habEspecie === h, h, ocupada(h) && w.habEspecie !== h)).join('')}</div>
      ${SENTIDOS_AGUDOS.every(ocupada) ? `<div class="aviso malo"><span>Ya es competente en las tres por su clase o su trasfondo. Cambia una de las habilidades de la clase para no perder este atributo.</span><button class="btn mini" data-a="wzIr" data-n="0">Cambiar</button></div>` : ''}`;
    if (e.id === 'humano') {
      html += `<h3 class="sub-tit">Diestro: elige una habilidad</h3><div class="chips">${CR.habilidades.map(h => wzChip('wzSet', 'habEspecie', h.nombre, w.habEspecie === h.nombre, h.nombre, ocupada(h.nombre) && w.habEspecie !== h.nombre)).join('')}</div>
        <h3 class="sub-tit">Versátil: elige una dote de origen</h3><div class="wz-ops">${CR.dotes.filter(d => d.categoria === 'origen').map(d => {
          const deTras = wzTras() && wzTras().doteId === d.id, no = deTras && !d.repetible;
          return `<button class="wz-op${w.doteHumano === d.id ? ' on' : ''}" data-a="wzSet" data-k="doteHumano" data-v="${d.id}" aria-pressed="${w.doteHumano === d.id}" ${no && w.doteHumano !== d.id ? 'disabled' : ''}><b>${esc(d.nombre)}${d.id === 'habilidoso' ? ' (recomendada)' : ''}</b>${deTras ? `<small>${no ? 'Ya la da su trasfondo: no se puede tener dos veces' : 'Ya la da su trasfondo: se puede repetir con otra lista de conjuros'}</small>` : ''}</button>`; }).join('')}</div>`;
      if (w.doteHumano === 'habilidoso') {
        const herrD = w.herrDote || [], total = w.habDote.length + herrD.length;
        const yaHerr = wzHerramientas(), ocupadaH = n => yaHerr.has(norm(n)) && yaHerr.get(norm(n)).origen !== 'dote';
        const propias = herrD.filter(n => !HERR().some(h => h.nombre === n));
        html += `<h3 class="sub-tit">Habilidoso: elige 3 en total <span class="cuenta">${total}/3</span></h3>
          <p class="nota" style="margin-top:0">Gana competencia en <b>3, combinando como quieras habilidades y herramientas</b>: 3 habilidades, 2 habilidades y 1 herramienta, 1 habilidad y 2 herramientas, o 3 herramientas.</p>
          <p class="wz-grupo-herr">Habilidades</p>
          <div class="chips">${CR.habilidades.map(h => wzChip('wzHab', 'habDote', h.nombre, w.habDote.includes(h.nombre), h.nombre, !w.habDote.includes(h.nombre) && (ocupada(h.nombre) || norm(h.nombre) === norm(w.habEspecie)))).join('')}</div>
          ${htmlElegirHerr('herrDote', () => true, herrD, ocupadaH)}
          <p class="wz-grupo-herr">Herramienta personalizada</p>
          ${propias.length ? `<div class="chips" style="margin-bottom:6px">${propias.map(n => wzChip('wzHerr', 'herrDote', n, true, n + ' ✕')).join('')}</div>` : ''}
          <div class="fila-anadir"><input id="wz-herr-propia" placeholder="Escribe una herramienta inventada" maxlength="60" enterkeyhint="done"><button class="btn peq" data-a="wzHerrPropia">Añadir</button></div>`;
      }
      else if (w.doteHumano) { const d = doteSRD(w.doteHumano); html += `<div class="wz-det">${d.html}</div>`; }
    }
    html += `<h3 class="sub-tit">Atributos especiales</h3>${wzRasgos(e.rasgos, 're')}</section>`;
  }
  return html;
}
function htmlWzCalculo() {
  const w = WZ(), c = wzClase(), t = wzTras(), o = wzOrden();
  const s = tiradasValidas().sort((a, b) => b - a);
  const base = wzBase(), bo = wzBonus(), fin = wzFinal();
  let html = `<h3 class="sub-tit">2. Ordena las características por preferencia</h3>
    <p class="nota" style="margin-top:0">La primera recibe la tirada más alta y la última la más baja. Para ${c ? `un ${esc(c.nombre.toLowerCase())} lo más importante es <b>${esc(c.caracteristica)}</b>; el orden de partida es el que recomienda el SRD` : 'tu clase'}. Usa las flechas para cambiarlo.</p>
    <div class="wz-orden">${o.map((k, i) => `<div class="fila-orden"><span class="wz-pos">${i + 1}</span><b>${CAR_NOMBRE[k]}</b><span class="wz-val">${s[i] ?? '—'}</span>
      <button class="icono peq" data-a="wzMover" data-k="${k}" data-d="-1" aria-label="Subir ${CAR_NOMBRE[k]}" ${i === 0 ? 'disabled' : ''}>▲</button>
      <button class="icono peq" data-a="wzMover" data-k="${k}" data-d="1" aria-label="Bajar ${CAR_NOMBRE[k]}" ${i === 5 ? 'disabled' : ''}>▼</button></div>`).join('')}</div>`;
  if (t) {
    const cs = t.caracteristicas;
    html += `<h3 class="sub-tit">3. Aumentos del trasfondo (${esc(t.nombre)}: ${cs.map(k => CAR_ABR[k]).join(', ')})</h3>
      <p class="nota" style="margin-top:0">Sube una en +2 y otra en +1, o las tres en +1. Ninguna puede pasar de 20.</p>
      <div class="seg"><button class="opc ${w.modoBonus !== '111' ? 'on' : ''}" data-a="wzSet" data-k="modoBonus" data-v="21">+2 y +1</button><button class="opc ${w.modoBonus === '111' ? 'on' : ''}" data-a="wzSet" data-k="modoBonus" data-v="111">+1 a las tres</button></div>`;
    if (w.modoBonus !== '111') {
      const b2 = Object.keys(bo).find(k => bo[k] === 2), b1 = Object.keys(bo).find(k => bo[k] === 1);
      html += `<div class="wz-bonus"><span>+2 a</span><div class="seg">${cs.map(k => `<button class="opc ${b2 === k ? 'on' : ''}" data-a="wzBonus" data-n="2" data-v="${k}">${CAR_ABR[k]}</button>`).join('')}</div></div>
        <div class="wz-bonus"><span>+1 a</span><div class="seg">${cs.map(k => `<button class="opc ${b1 === k ? 'on' : ''}" data-a="wzBonus" data-n="1" data-v="${k}" ${k === b2 ? 'disabled' : ''}>${CAR_ABR[k]}</button>`).join('')}</div></div>`;
    }
  }
  html += `<h3 class="sub-tit">Resultado</h3>` + (fin
    ? `<table class="wz-tabla"><thead><tr><th>Característica</th><th>Tirada</th><th>Trasfondo</th><th>Total</th><th>Mod.</th></tr></thead><tbody>
      ${CARS_PJ.map(([k, n]) => `<tr><td>${n}</td><td>${base[k]}</td><td>${bo[k] ? '+' + bo[k] : ''}</td><td><b>${fin[k]}</b></td><td><b>${signo(modDe(fin[k]))}</b></td></tr>`).join('')}</tbody></table>`
    : `<p class="nota">Cuando escribas las 6 tiradas verás aquí las puntuaciones finales.</p>`);
  return html;
}
function wzPasoCaracteristicas() {
  const w = WZ();
  return `<div class="reglas-box"><div class="reglas-tit">Cómo se tiran (método 4d6)</div>
      <p style="margin:4px 0">Para <b>cada una</b> de las 6 características:</p>
      <ol class="wz-pasos-lista"><li>Tira <b>4 dados de seis caras</b> (4d6).</li><li><b>Quita el dado más bajo</b>.</li><li><b>Suma los otros tres</b>. Ese es el resultado (entre 3 y 18).</li></ol>
      <p style="margin:4px 0">Ejemplo: sacas 6, 4, 3 y 1 → quitas el 1 → 6 + 4 + 3 = <b>13</b>.</p>
      <p style="margin:4px 0">Repite hasta tener 6 resultados y escríbelos abajo en cualquier orden: la app los ordena de mayor a menor.</p></div>
    <h3 class="sub-tit">1. Escribe los 6 resultados</h3>
    <div class="wz-tiradas">${w.tiradas.map((v, i) => `<label class="car-pj"><span>Tirada ${i + 1}</span><input data-in="wzTirada" data-n="${i}" type="number" inputmode="numeric" min="3" max="18" value="${esc(v)}" enterkeyhint="next"></label>`).join('')}</div>
    <div id="wz-calc">${htmlWzCalculo()}</div>`;
}
// ---- Conjuros del creador ----
// Conjuros recomendados por el SRD en el rasgo de la clase («Se recomiendan …»)
function recomendadosClase(c, tipo) {
  const r = c.rasgos.find(x => x.nivel === 1 && /Lanzamiento de conjuros|Magia del pacto/.test(x.nombre)); if (!r) return [];
  const ps = r.html.split(/<\/p><p>/).map(x => x.replace(/<[^>]+>/g, ''));
  const p = ps.find(x => tipo === 'T' ? /^Trucos\./.test(x) : !/^Trucos\./.test(x) && /Se recomiendan/.test(x));
  const m = p && p.match(/Se recomiendan ([^.]+)\./); if (!m) return [];
  return m[1].split(/,\s*|\s+y\s+|\s+e\s+/).map(n => CONJS.find(x => norm(x.nombre) === norm(n.trim()))).filter(Boolean).map(x => x.id);
}
// Dotes «Iniciado en la magia» que tiene (por el trasfondo y/o por la dote de humano)
function wzMagiaDotes() {
  const w = WZ(), t = wzTras(), out = [];
  w.magia ||= {};
  const nuevo = () => ({ lista: null, apt: null, T: [], C: [] });
  if (t && t.doteId === 'iniciado-en-la-magia') out.push({ origen: 'trasfondo', fija: slug(t.doteNota), est: (w.magia.trasfondo ||= nuevo()) });
  if (w.especie === 'humano' && w.doteHumano === 'iniciado-en-la-magia') out.push({ origen: 'especie', fija: null, est: (w.magia.especie ||= nuevo()) });
  return out.map(m => ({ ...m, lista: m.fija || m.est.lista, apt: m.est.apt }));
}
// Conjuros que da la especie sin elegir (linaje y tiefling)
function wzConjFijos() {
  const e = wzEsp(), l = wzLinaje(), ids = [];
  if (l) ids.push(...(l.trucos || []), ...(l.conjuros || []));
  if (e && e.id === 'tiefling') ids.push('taumaturgia');
  return [...new Set(ids)].filter(id => CONJ.has(id));
}
function wzGruposConj() {
  const w = WZ(), c = wzClase(), g = [];
  w.conj ||= {};
  const cfg = c && CONJ_CLASE_N1[c.id];
  if (cfg) {
    const nom = c.nombre.toLowerCase();
    if (cfg.trucos) g.push({ clave: 'claseT', origen: 'clase', titulo: `Trucos de ${nom}`, lista: c.id, nivel: 0, n: cfg.trucos, rec: recomendadosClase(c, 'T'), elegidos: (w.conj.claseT ||= []) });
    g.push({ clave: 'claseC', origen: 'clase', titulo: cfg.libro ? 'Conjuros de nivel 1 para su libro' : `Conjuros de nivel 1 de ${nom}`, lista: c.id, nivel: 1, n: cfg.conjuros, rec: recomendadosClase(c, 'C'), elegidos: (w.conj.claseC ||= []),
      nota: cfg.libro ? `Los ${cfg.conjuros} se apuntan en su libro de conjuros. Cada día prepara ${cfg.libro} de ellos.` : 'Son los conjuros que tiene preparados. Podrá cambiarlos al subir de nivel.' });
  }
  if (c && (w.ordenClase === 'taumaturgo' || w.ordenClase === 'naturalista'))
    g.push({ clave: 'ordenT', origen: 'clase', titulo: `Truco adicional (${w.ordenClase === 'taumaturgo' ? 'Taumaturgo' : 'Naturalista'})`, lista: c.id, nivel: 0, n: 1, rec: [], elegidos: (w.conj.ordenT ||= []), nota: `Un truco más de la lista de ${c.nombre.toLowerCase()}, por su ${ORDENES[c.id].rasgo}.` });
  if (c && c.id === 'brujo' && (w.invoc || []).includes('pacto-del-grimorio'))
    for (const gr of GRIMORIO) g.push({ clave: gr.k, origen: 'clase', titulo: gr.titulo, filtro: gr.filtro, n: gr.n, rec: [], elegidos: (w.conj[gr.k] ||= []), nota: 'Se escriben en su Libro de las sombras. Los rituales solo se pueden lanzar como ritual. Usa su aptitud mágica de brujo.' });
  for (const m of wzMagiaDotes()) if (m.lista) {
    const ln = LISTAS_MAGIA.find(x => x[0] === m.lista)[1].toLowerCase();
    g.push({ clave: `magia-${m.origen}-T`, origen: m.origen, titulo: `Trucos de ${ln} (Iniciado en la magia)`, lista: m.lista, nivel: 0, n: 2, rec: [], elegidos: m.est.T });
    g.push({ clave: `magia-${m.origen}-C`, origen: m.origen, titulo: `Conjuro de nivel 1 de ${ln} (Iniciado en la magia)`, lista: m.lista, nivel: 1, n: 1, rec: [], elegidos: m.est.C,
      nota: 'Siempre lo tiene preparado. Puede lanzarlo una vez sin gastar espacio de conjuro (se recupera con un descanso largo).' });
  }
  return g;
}
// Conjuros que su clase le da siempre preparados a nivel 1 (explorador: Marca del cazador)
const wzConjClaseFijos = () => { const c = wzClase(); return c ? conjSiempre(c.id, 1, {}).map(x => x.id) : []; };
const wzConjElegidos = () => [...new Set([...wzConjFijos(), ...wzConjClaseFijos(), ...wzGruposConj().flatMap(g => g.elegidos)])];
// Cuántos puede elegir de verdad en un grupo (si ya conoce casi toda la lista, no se le piden más de los que quedan)
function wzDisponibles(g, grupos, fijos) {
  const otros = new Set([...fijos, ...grupos.filter(x => x !== g).flatMap(x => x.elegidos)]);
  return Math.min(g.n, CONJS.filter(g.filtro || (x => x.nivel === g.nivel && (x.clases || []).some(k => slug(k) === g.lista))).filter(x => !otros.has(x.id)).length);
}
function htmlGrupoConj(g, grupos, fijos) {
  const otros = new Set([...fijos, ...grupos.filter(x => x !== g).flatMap(x => x.elegidos)]);
  const lista = CONJS.filter(g.filtro || (x => x.nivel === g.nivel && (x.clases || []).some(k => slug(k) === g.lista)))
    .sort((a, b) => (g.rec.includes(b.id) - g.rec.includes(a.id)) || a.nombre.localeCompare(b.nombre, 'es'));
  const n = wzDisponibles(g, grupos, fijos), completo = g.elegidos.length === n;
  const nombres = g.elegidos.map(id => CONJ.get(id)?.nombre).filter(Boolean);
  return `<details class="regla wz-grupo${completo ? ' completo' : ''}" ${completo ? '' : 'open'}>
    <summary><span><b>${esc(g.titulo)} <span class="cuenta">${g.elegidos.length}/${n}</span></b>${nombres.length ? `<small>${nombres.map(esc).join(', ')}</small>` : ''}</span></summary>
    <div class="cuerpo">${g.nota ? `<p class="nota" style="margin-top:0">${g.nota}</p>` : ''}${n < g.n ? `<p class="nota" style="margin-top:0">Ya conoce casi todos los de esta lista por otro lado: solo puede elegir ${n}.</p>` : ''}
      <div class="lista">${lista.map(c => {
        const on = g.elegidos.includes(c.id), bloq = !on && otros.has(c.id);
        return `<div class="fila"><button class="marca-conj ${on ? 'on' : ''}" data-a="wzConj" data-g="${g.clave}" data-id="${c.id}" aria-label="${on ? 'Quitar' : 'Elegir'} ${esc(c.nombre)}" ${bloq ? 'disabled' : ''}>${on ? '✓' : '+'}</button>
          <div class="f-txt" data-a="verConjuro" data-id="${c.id}"><div class="f-tit">${g.rec.includes(c.id) ? '<span class="wz-rec">★</span> ' : ''}${esc(c.nombre)} ${etiquetasConj(c)}</div><div class="f-sub">${g.filtro ? esc((c.clases || []).join(', ')) + ' · ' : ''}${esc(c.escuela)}${bloq ? ' · ya lo conoce por otro lado' : ''}</div></div></div>`;
      }).join('')}</div></div></details>`;
}
function htmlPericia() {
  const comp = [...wzCompetencias().values()].map(x => x.nombre).sort((a, b) => a.localeCompare(b, 'es')), sel = wzPericia(), f = wzFinal();
  const txt = h => { const s = CR.habilidades.find(x => norm(x.nombre) === norm(h)); if (!f || !s) return h; const m = modDe(f[s.car]); return `${h} ${signo(m + 2)} → ${signo(m + 4)}`; };
  return `<div class="reglas-box"><div class="reglas-tit">Pericia · rasgo de pícaro de nivel 1</div>
      <p style="margin:4px 0">Elige <b>2 habilidades en las que ya es competente</b>. En ellas su bonificador por competencia <b>se duplica</b> (a nivel 1 pasa de +2 a +4). No se puede tener pericia dos veces en la misma habilidad.</p>
      <p style="margin:4px 0">El SRD recomienda <b>Juego de manos</b> y <b>Sigilo</b> si es competente en ellas (★). En el nivel 6 de pícaro ganará pericia en otras 2.</p></div>
    <h3 class="sub-tit">Elige 2 habilidades <span class="cuenta">${sel.length}/2</span></h3>
    <div class="chips">${comp.map(h => wzChip('wzPericia', 'pericia', h, sel.includes(h), (/^(Juego de manos|Sigilo)$/.test(h) ? '★ ' : '') + txt(h))).join('')}</div>`;
}
function htmlEstilo1() {
  const w = WZ(), sel = CR.dotes.find(d => d.id === w.estilo);
  return `<div class="reglas-box"><div class="reglas-tit">Estilo de combate · rasgo de guerrero de nivel 1</div>
      <p style="margin:4px 0">Elige una dote de estilo de combate. El SRD recomienda <b>Defensa</b>. Cada vez que suba de nivel de guerrero puede cambiarla por otra.</p></div>
    <div class="wz-ops">${CR.dotes.filter(d => d.categoria === 'estilo-de-combate').map(d => wzOp('wzSet', 'estilo', d.id, w.estilo === d.id, d.nombre + (d.id === 'defensa' ? ' ★' : ''), '')).join('')}</div>
    ${sel ? `<div class="wz-det">${sel.html}</div>` : ''}`;
}
function wzPasoPericiaConjuros() {
  if (!esPicaro() && !wzEstilo1()) return wzPasoConjuros();
  const hay = wzGruposConj().length || wzConjFijos().length || wzMagiaDotes().length;
  return (esPicaro() ? htmlPericia() : '') + (wzEstilo1() ? htmlEstilo1() : '') + (hay ? `<h2 style="font-size:1.05rem;margin:22px 0 4px">Conjuros</h2>${wzPasoConjuros()}` : '');
}
function wzPasoConjuros() {
  const w = WZ(), grupos = wzGruposConj(), deEspecie = wzConjFijos(), deClase1 = wzConjClaseFijos(), fijos = [...deEspecie, ...deClase1], magia = wzMagiaDotes(), c = wzClase();
  if (!grupos.length && !fijos.length && !magia.length) return `<p class="vacio">Este personaje no conoce conjuros a nivel 1.<br>Puedes pasar al siguiente paso.</p>`;
  let html = `<p class="nota">Los <b>trucos</b> se lanzan a voluntad, sin gastar espacios. Los <b>conjuros de nivel 1</b> gastan un espacio de conjuro. <span class="wz-rec">★</span> = recomendado por el SRD. Toca el nombre de un conjuro para leerlo, y <b>+</b> para elegirlo.</p>`;
  const deClase = grupos.filter(g => g.origen === 'clase');
  const filaFija = id => { const x = CONJ.get(id); return `<div class="fila"><span class="marca-conj on">✓</span><div class="f-txt" data-a="verConjuro" data-id="${x.id}"><div class="f-tit">${esc(x.nombre)} ${etiquetasConj(x)}</div><div class="f-sub">${nivelTxt(x.nivel)} · ${esc(x.escuela)}</div></div></div>`; };
  if (deClase.length || deClase1.length) html += `<h3 class="sub-tit">Por su clase (${esc(c.nombre)})</h3>${deClase1.length ? `<p class="nota" style="margin-top:0">Siempre tiene preparado (no cuenta entre los que elige):</p><div class="lista">${deClase1.map(filaFija).join('')}</div>` : ''}${deClase.map(g => htmlGrupoConj(g, grupos, fijos)).join('')}`;
  for (const m of magia) {
    html += `<h3 class="sub-tit">Dote Iniciado en la magia (por su ${m.origen === 'trasfondo' ? 'trasfondo' : 'especie'})</h3>
      <p class="nota" style="margin-top:0">Aprende 2 trucos y 1 conjuro de nivel 1 de una lista de conjuros${m.fija ? `: la de <b>${esc(LISTAS_MAGIA.find(x => x[0] === m.fija)[1].toLowerCase())}</b>, que fija su trasfondo` : ''}.</p>`;
    if (!m.fija) {
      const otra = magia.find(x => x !== m && x.lista);
      html += `<div class="wz-bonus"><span>Lista</span><div class="seg">${LISTAS_MAGIA.map(([k, n]) => `<button class="opc ${m.est.lista === k ? 'on' : ''}" data-a="wzMagia" data-o="${m.origen}" data-k="lista" data-v="${k}" ${otra && otra.lista === k ? 'disabled' : ''}>${n}</button>`).join('')}</div></div>`;
    }
    html += `<div class="wz-bonus"><span>Aptitud</span><div class="seg">${['int', 'sab', 'car'].map(k => `<button class="opc ${m.est.apt === k ? 'on' : ''}" data-a="wzMagia" data-o="${m.origen}" data-k="apt" data-v="${k}">${CAR_NOMBRE[k]}</button>`).join('')}</div></div>
      <p class="nota" style="margin-top:2px">La aptitud mágica es la característica con la que lanza estos conjuros.</p>`;
    html += grupos.filter(g => g.origen === m.origen && g.clave.startsWith('magia')).map(g => htmlGrupoConj(g, grupos, fijos)).join('');
  }
  if (deEspecie.length) {
    const l = wzLinaje();
    html += `<h3 class="sub-tit">Por su especie (${esc(wzEsp().nombre)}${l ? ', ' + esc(l.nombre) : ''}) ya conoce</h3>
      <div class="lista">${deEspecie.map(filaFija).join('')}</div>
      ${l && l.nivel3 ? `<p class="nota">En los niveles 3 y 5 aprenderá <em>${esc(l.nivel3.toLowerCase())}</em> y <em>${esc(l.nivel5.toLowerCase())}</em>.</p>` : ''}
      ${w.linaje === 'alto-elfo' ? '<p class="nota">Tras un descanso largo puede cambiar <em>prestidigitación</em> por otro truco de mago.</p>' : ''}`;
  }
  return html;
}
A.wzConj = el => {
  const grupos = wzGruposConj(), g = grupos.find(x => x.clave === el.dataset.g); if (!g) return;
  const id = el.dataset.id, i = g.elegidos.indexOf(id), n = wzDisponibles(g, grupos, [...wzConjFijos(), ...wzConjClaseFijos()]);
  if (i >= 0) g.elegidos.splice(i, 1);
  else if (g.elegidos.length >= n) { toast(`Ya has elegido ${n}. Quita uno primero.`); return; }
  else g.elegidos.push(id);
  wzPintar(false);
};
A.wzMagia = el => {
  wzMagiaDotes();
  const est = WZ().magia[el.dataset.o]; if (!est) return;
  est[el.dataset.k] = el.dataset.v;
  if (el.dataset.k === 'lista') { est.T = []; est.C = []; }
  wzPintar(false);
};

function wzPasoAlineamiento() {
  const w = WZ();
  return `<p class="nota">El alineamiento resume su actitud: la moral (bueno, neutral o malvado) y su relación con el orden (legal, neutral o caótico).</p>
    <div class="wz-alin">${CR.alineamientos.map(a => `<button class="opc ${w.alineamiento === a.abr ? 'on' : ''}" data-a="wzSet" data-k="alineamiento" data-v="${a.abr}"><b>${a.abr}</b><small>${esc(a.nombre)}</small></button>`).join('')}</div>
    <p class="nota">El juego da por hecho que los personajes de los jugadores no son malvados. Si alguien quiere uno malvado, que lo hable antes con el GM.</p>`;
}
function wzPasoDetalles() {
  const w = WZ(), c = wzClase();
  const campo = (k, etq, ph) => `<label class="campo"><span>${etq}</span><input data-in="wz" data-k="${k}" value="${esc(w[k])}" placeholder="${ph}"></label>`;
  const area = (k, etq, ph) => `<label class="campo"><span>${etq}</span><textarea data-in="wz" data-k="${k}" rows="4" placeholder="${ph}">${esc(w[k])}</textarea></label>`;
  const extra = wzIdiomasClase(c);
  return `${campo('nombre', 'Nombre del personaje', 'p. ej. Lia Tormenta')}${campo('jugador', 'Jugador (opcional)', '')}
    ${area('descripcion', 'Descripción física', 'Edad, altura, complexión, ojos, pelo, piel, ropa, cicatrices…')}
    ${area('personalidad', 'Personalidad e historia', 'Cómo es, qué quiere, de dónde viene, qué le importa…')}
    <h3 class="sub-tit">Idiomas <span class="cuenta">${w.idiomas.length}/2</span></h3>
    <p class="nota" style="margin-top:0">Sabe <b>común</b>${extra.length ? ` y, por su clase, <b>${extra.map(esc).join(', ')}</b>` : ''}. Elige 2 idiomas estándar más.</p>
    <div class="chips">${CR.idiomas.estandar.filter(i => i !== 'Común').map(i => wzChip('wzIdioma', 'idiomas', i, w.idiomas.includes(i), i)).join('')}</div>`;
}
const wzIdiomasClase = c => !c ? [] : c.rasgos.filter(r => r.nivel === 1 && /^(Jerga de ladrones|Druídico)$/.test(r.nombre)).map(r => r.nombre);
// Todo lo que se calcula del personaje (se usa en el resumen y al crearlo)
function wzHoja() {
  const w = WZ(), c = wzClase(), t = wzTras(), e = wzEsp(), l = wzLinaje(), f = wzFinal();
  const md = k => modDe(f[k]), bc = 2;
  const dotes = wzDotes(), alerta = dotes.some(d => d.id === 'alerta');
  const pg = Math.max(1, dadoGolpe(c) + md('con') + (e.id === 'enano' ? 1 : 0));
  const comp = wzCompetencias();
  const pericia = new Set((c.id === 'picaro' ? wzPericia() : []).map(norm));
  const habilidades = CR.habilidades.map(h => {
    const es = comp.has(norm(h.nombre)), per = es && pericia.has(norm(h.nombre));
    const extra = extraOrdenHab(w.ordenClase, h.id, f.sab);
    return { ...h, comp: es, pericia: per, extra, origen: (comp.get(norm(h.nombre)) || {}).origen, total: md(h.car) + (es ? bc * (per ? 2 : 1) : 0) + extra };
  });
  const herramientas = [...wzHerramientas().values()].map(x => x.nombre);
  const percep = habilidades.find(h => h.id === 'percepcion');
  let vision = e.vision; if (l && l.vision) vision = l.vision;
  let velocidad = e.velocidad; if (l && l.velocidad) velocidad = l.velocidad;
  const tamano = e.tamanos.length > 1 ? w.tamano : e.tamanos[0];
  const alin = CR.alineamientos.find(a => a.abr === w.alineamiento);
  const idiomas = ['Común', ...wzIdiomasClase(c), ...w.idiomas];
  const salv = SALVACIONES_CLASE[c.id] || [];
  const equipo = [c.equipoOpciones[w.equipoClase], t.equipoOpciones[w.equipoTras]].filter(Boolean);
  const especieTxt = e.nombre + (l ? ` (${l.nombre.replace(/\s*\(.*\)$/, '')})` : '');
  const conjuros = wzConjElegidos().map(id => CONJ.get(id)).filter(Boolean).sort(ordenConj);
  // Competencias extra de la Orden (Protector: armas marciales y armadura pesada; Guardián: armas marciales y armadura media)
  const ordenOp = ORDENES[c.id] && ORDENES[c.id].ops.find(o => o[0] === w.ordenClase);
  const orden = ordenOp ? ordenOp[1] : '';
  let armaduras = c.armaduras, armas = c.armas;
  if (w.ordenClase === 'protector') { armaduras += '; armaduras pesadas (Protector)'; armas += '; armas marciales (Protector)'; }
  if (w.ordenClase === 'guardian') { armaduras += '; armaduras medias (Guardián)'; armas += '; armas marciales (Guardián)'; }
  const magia = wzMagiaDotes().filter(m => m.lista && m.apt);
  // Armadura y escudo del equipo inicial de la clase (si se eligió el paquete con equipo): se calcula igual que en la hoja
  const eqClase = c.equipoOpciones[w.equipoClase] || '';
  const armadura = armaduraInicial(eqClase), escudo = escudoInicial(eqClase);
  const cal = caPJ({ ...f, nivel: 1, hoja: { clase: c.id, armadura, escudo, caExtra: 0, armaduras, dotes } });
  const ca = cal.total, caNota = cal.partes.join(' + ');
  return { c, t, e, l, f, bc, ca, caNota, armadura, escudo, pg, alerta, dotes, habilidades, herramientas, conjuros, magia, orden, armaduras, armas, pasiva: 10 + percep.total, vision, velocidad, tamano, alin, idiomas, salv, equipo, especieTxt };
}
function wzPasoResumen() {
  const w = WZ(), h = wzHoja();
  const fila = (k, v) => `<p><b>${k}:</b> ${v}</p>`;
  return `<div class="wz-det wz-resumen">
      <h2 style="margin:0 0 2px;font-size:1.15rem">${esc(w.nombre)}</h2>
      <p class="nota" style="margin:0 0 8px">${esc(h.c.nombre)} de nivel 1 · ${esc(h.especieTxt)} · ${esc(h.t.nombre)} · ${esc(h.alin.nombre)}</p>
      <div class="wz-stats"><div><span>CA</span><b>${h.ca}</b></div><div><span>PG</span><b>${h.pg}</b></div><div><span>Iniciativa</span><b>${signo(modDe(h.f.des) + (h.alerta ? h.bc : 0))}</b></div><div><span>Velocidad</span><b>${String(h.velocidad).replace('.', ',')} m</b></div><div><span>BC</span><b>${signo(h.bc)}</b></div><div><span>Perc. pasiva</span><b>${h.pasiva}</b></div></div>
      <p class="nota" style="margin:4px 0 0">CA: ${esc(h.caNota)}. PG = ${dadoGolpe(h.c)} (dado de golpe) ${signo(modDe(h.f.con))} (Con)${h.e.id === 'enano' ? ' +1 (Aguante enano)' : ''}.</p>
    </div>
    ${htmlAvisoHerr()}
    <h3 class="sub-tit">Características y salvaciones</h3>
    <div class="cars-pj">${CARS_PJ.map(([k, n]) => `<div class="car-pj${h.salv.includes(k) ? ' comp' : ''}"><span>${n}</span><b class="wz-pt">${h.f[k]}</b><b>${signo(modDe(h.f[k]))}</b><small>Salv. ${signo(modDe(h.f[k]) + (h.salv.includes(k) ? h.bc : 0))}${h.salv.includes(k) ? ' ●' : ''}</small></div>`).join('')}</div>
    <p class="nota">● Competencia en la salvación (por su clase).</p>
    <h3 class="sub-tit">Habilidades</h3>
    <div class="wz-habs">${h.habilidades.map(x => `<div class="${x.comp ? 'comp' : ''}"><span>${x.pericia ? '◆ ' : x.comp ? '● ' : ''}${esc(x.nombre)} <small>(${CAR_ABR[x.car]})</small></span><b>${signo(x.total)}</b></div>`).join('')}</div>
    <p class="nota">● Competente (suma +${h.bc}).${h.habilidades.some(x => x.pericia) ? ` ◆ Pericia (suma +${h.bc * 2}).` : ''}${notaExtraHab(h.orden, h.habilidades)}</p>
    <div class="wz-det" style="margin-top:12px">
      ${fila('Tamaño', esc(h.tamano))}${h.vision ? fila('Visión en la oscuridad', h.vision + ' m') : ''}
      ${fila('Dotes', h.dotes.map(d => esc(d.nombre)).join(', '))}
      ${fila('Atributos de especie', h.e.rasgos.map(r => esc(r.nombre)).join(', ') + (h.l ? ` (${esc(h.l.nombre)}${w.aptitud ? ', aptitud mágica: ' + CAR_NOMBRE[w.aptitud] : ''})` : ''))}
      ${fila('Rasgos de clase', h.c.rasgos.filter(r => r.nivel === 1).map(r => esc(r.nombre)).join(', '))}
      ${h.orden ? fila(ORDENES[h.c.id].rasgo, esc(h.orden)) : ''}
      ${(w.maestria || []).length ? fila('Maestría con armas', w.maestria.map(n => esc(n + ' (' + ((CR.armas.find(a => a.nombre === n) || {}).maestria || '') + ')')).join(', ')) : ''}
      ${(w.invoc || []).length ? fila('Invocaciones', w.invoc.map(i => esc((CR.invocaciones.find(x => x.id === i) || {}).nombre || i)).join(', ')) : ''}
      ${fila('Armaduras', esc(h.armaduras))}${fila('Armas', esc(h.armas))}
      ${fila('Herramientas', h.herramientas.length ? h.herramientas.map(esc).join(', ') : '—')}
      ${h.conjuros.length ? fila('Trucos', h.conjuros.filter(c => !c.nivel).map(c => esc(c.nombre)).join(', ') || '—') + fila('Conjuros de nivel 1', h.conjuros.filter(c => c.nivel).map(c => esc(c.nombre)).join(', ') || '—') : ''}
      ${h.magia.map(m => fila('Iniciado en la magia', `lista de ${LISTAS_MAGIA.find(x => x[0] === m.lista)[1].toLowerCase()}, aptitud ${CAR_NOMBRE[m.apt]}`)).join('')}
      ${fila('Idiomas', h.idiomas.map(esc).join(', '))}
      ${fila('Equipo', h.equipo.map(esc).join(' + '))}
      ${w.descripcion.trim() ? fila('Descripción', esc(w.descripcion)) : ''}${w.personalidad.trim() ? fila('Personalidad e historia', esc(w.personalidad)) : ''}
    </div>
    <p class="nota">Al crearlo se rellenan también sus espacios de conjuro y recursos de clase. Todo se puede cambiar después en su perfil.</p>`;
}
VISTAS.crear = () => {
  if (!CR) return { titulo: 'Crear personaje', atras: '#/personajes', html: '<p class="vacio">Faltan los datos de creación.</p>' };
  if (!E.borradorPJ) return { titulo: 'Crear personaje', atras: '#/personajes', html: `<p class="vacio">No hay ningún personaje a medio crear.</p><button class="btn primario ancho" data-a="crearPJ">Empezar uno</button>` };
  const w = WZ(), p = w.paso;
  const cuerpo = [wzPasoClase, wzPasoTrasfondo, wzPasoEspecie, wzPasoCaracteristicas, wzPasoPericiaConjuros, wzPasoAlineamiento, wzPasoDetalles, wzPasoResumen][p]();
  const html = `<p class="wz-paso">Paso ${p + 1} de ${WZ_PASOS.length} · ${wzNombrePaso(p)}</p>
    <div class="wz-prog">${WZ_PASOS.map((n, i) => `<button class="${i < p ? 'hecho' : i === p ? 'actual' : ''}" data-a="wzIr" data-n="${i}" aria-label="Paso ${i + 1}: ${wzNombrePaso(i)}" ${i > p ? 'disabled' : ''}></button>`).join('')}</div>
    ${cuerpo}`;
  const ultimo = p === WZ_PASOS.length - 1;
  return {
    titulo: 'Crear personaje', atras: '#/personajes', html, sinNav: true,
    pie: `${p > 0 ? `<button class="btn secundario" data-a="wzAtras">Atrás</button>` : ''}<button class="btn ${ultimo ? 'ok' : 'primario'}" data-a="${ultimo ? 'wzCrear' : 'wzSig'}">${ultimo ? 'Crear personaje' : 'Siguiente: ' + wzNombrePaso(p + 1)}</button>`
  };
};
function wzPintar(arriba) { guardar(); render(); if (arriba) window.scrollTo(0, 0); }
A.crearPJ = async () => {
  if (E.borradorPJ && (E.borradorPJ.clase || E.borradorPJ.paso)) {
    const r = await preguntar('Tienes un personaje a medio crear. ¿Quieres seguir con él?', [{ t: 'Seguir con él', v: 'seguir', clase: 'primario' }, { t: 'Empezar uno nuevo', v: 'nuevo' }, { t: 'Cancelar' }]);
    if (!r) return;
    if (r === 'nuevo') E.borradorPJ = wzNuevo();
  } else E.borradorPJ = wzNuevo();
  guardar(); navegar('#/crear');
};
A.wzSet = el => {
  const w = WZ(), k = el.dataset.k, v = el.dataset.v;
  if (w[k] === v && (k === 'habEspecie' || k === 'doteHumano')) w[k] = null; else w[k] = v;
  w.magia ||= {};
  if (k === 'clase') { w.habClase = []; w.equipoClase = 'A'; w.orden = null; w.ordenClase = null; w.conj = {}; w.herrClase = []; w.pericia = []; w.estilo = null; w.maestria = []; w.invoc = []; }
  if (k === 'ordenClase') { w.conj ||= {}; w.conj.ordenT = []; }
  if (k === 'trasfondo') { w.equipoTras = 'A'; w.bonus2 = w.bonus1 = null; delete w.magia.trasfondo; w.herrTras = []; }
  if (k === 'especie') { w.linaje = w.tamano = w.aptitud = w.habEspecie = w.doteHumano = null; w.habDote = []; w.herrDote = []; delete w.magia.especie; }
  if (k === 'doteHumano') { w.habDote = []; w.herrDote = []; delete w.magia.especie; }
  wzPintar(false);
  if (['clase', 'trasfondo', 'especie'].includes(k)) { const d = $('#wz-detalle'); if (d) d.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
};
A.wzHab = el => {
  const w = WZ(), lista = w[el.dataset.k], v = el.dataset.v;
  const esDote = el.dataset.k === 'habDote';
  const max = esDote ? 3 - (w.herrDote || []).length : nHabClase(wzClase());
  const i = lista.indexOf(v);
  if (i >= 0) lista.splice(i, 1);
  else if (lista.length >= max) { toast(esDote ? 'Habilidoso: ya tienes 3 entre habilidades y herramientas. Quita una primero.' : `Ya has elegido ${max}. Quita una primero.`); return; }
  else lista.push(v);
  wzPintar(false);
};
// Elegir o quitar una herramienta (de la clase, del trasfondo o de Habilidoso)
A.wzHerr = el => {
  const w = WZ(), k = el.dataset.k, v = el.dataset.v;
  w[k] ||= [];
  const lista = w[k], i = lista.indexOf(v);
  if (i >= 0) { lista.splice(i, 1); wzPintar(false); return; }
  let max;
  if (k === 'herrDote') max = 3 - w.habDote.length;
  else max = (eleccionHerr(k === 'herrClase' ? wzClase().herramientas : wzTras().herramienta) || { n: 0 }).n;
  if (lista.length >= max) { toast(k === 'herrDote' ? 'Habilidoso: ya tienes 3 entre habilidades y herramientas. Quita una primero.' : `Ya has elegido ${max}. Quita una primero.`); return; }
  lista.push(v); wzPintar(false);
};
A.wzHerrPropia = () => {
  const w = WZ(), inp = $('#wz-herr-propia'), v = (inp && inp.value || '').trim().replace(/\s+/g, ' ');
  if (!v) { toast('Escribe el nombre de la herramienta'); inp && inp.focus(); return; }
  w.herrDote ||= [];
  if ([...wzHerramientas().keys()].includes(norm(v))) { toast('Ya tiene esa herramienta'); return; }
  if (w.habDote.length + w.herrDote.length >= 3) { toast('Habilidoso: ya tienes 3 entre habilidades y herramientas. Quita una primero.'); return; }
  w.herrDote.push(v.charAt(0).toUpperCase() + v.slice(1)); wzPintar(false);
};
A.wzPericia = el => {
  const w = WZ(), v = el.dataset.v, sel = wzPericia(), i = sel.indexOf(v);
  if (i >= 0) sel.splice(i, 1);
  else if (sel.length >= 2) { toast('Ya has elegido 2. Quita una primero.'); return; }
  else sel.push(v);
  w.pericia = sel; wzPintar(false);
};
A.wzIdioma = el => {
  const w = WZ(), v = el.dataset.v, i = w.idiomas.indexOf(v);
  if (i >= 0) w.idiomas.splice(i, 1);
  else if (w.idiomas.length >= 2) { toast('Ya has elegido 2. Quita uno primero.'); return; }
  else w.idiomas.push(v);
  wzPintar(false);
};
A.wzMover = el => {
  const w = WZ(), o = wzOrden().slice(), i = o.indexOf(el.dataset.k), j = i + (+el.dataset.d);
  if (j < 0 || j > 5) return;
  [o[i], o[j]] = [o[j], o[i]]; w.orden = o;
  wzPintar(false);
};
A.wzBonus = el => {
  const w = WZ(), bo = wzBonus(), k = el.dataset.v;
  const b2 = Object.keys(bo).find(x => bo[x] === 2), b1 = Object.keys(bo).find(x => bo[x] === 1);
  if (el.dataset.n === '2') { w.bonus2 = k; w.bonus1 = k === b1 ? b2 : b1; }
  else { w.bonus2 = b2; w.bonus1 = k; }
  wzPintar(false);
};
A.wzSig = () => {
  const w = WZ(), falta = wzFalta(w.paso);
  if (falta) { toast(falta); return; }
  w.paso = Math.min(WZ_PASOS.length - 1, w.paso + 1); wzPintar(true);
};
A.wzAtras = () => { const w = WZ(); w.paso = Math.max(0, w.paso - 1); wzPintar(true); };
A.wzIr = el => { const w = WZ(), n = +el.dataset.n; if (n <= w.paso) { w.paso = n; wzPintar(true); } };
A.wzCrear = () => {
  for (let p = 0; p < WZ_PASOS.length - 1; p++) { const f = wzFalta(p); if (f) { WZ().paso = p; wzPintar(true); toast(f); return; } }
  const w = WZ(), h = wzHoja();
  const comp = h.habilidades.filter(x => x.comp).map(x => x.nombre);
  const notas = [
    `${h.c.nombre} 1 · ${h.especieTxt} · ${h.t.nombre} · ${h.alin.nombre}`,
    `Tamaño ${h.tamano} · Velocidad ${String(h.velocidad).replace('.', ',')} m${h.vision ? ` · Visión en la oscuridad ${h.vision} m` : ''}`,
    `Habilidades: ${comp.join(', ')}`,
    `Dotes: ${h.dotes.map(d => d.nombre).join(', ')}`,
    h.orden && `${ORDENES[h.c.id].rasgo}: ${h.orden}`,
    (w.maestria || []).length && `Maestría con armas: ${w.maestria.join(', ')}`,
    (w.invoc || []).length && `Invocaciones: ${w.invoc.map(i => (CR.invocaciones.find(x => x.id === i) || {}).nombre || i).join(', ')}`,
    ...h.magia.map(m => `Iniciado en la magia: lista de ${LISTAS_MAGIA.find(x => x[0] === m.lista)[1].toLowerCase()}, aptitud ${CAR_NOMBRE[m.apt]}`),
    w.aptitud && `Aptitud mágica del linaje: ${CAR_NOMBRE[w.aptitud]}`,
    h.habilidades.some(x => x.pericia) && `Pericia: ${h.habilidades.filter(x => x.pericia).map(x => x.nombre).join(', ')}`,
    `Herramientas: ${h.herramientas.join(', ') || '—'}`,
    `Idiomas: ${h.idiomas.join(', ')}`,
    `Equipo: ${h.equipo.join(' + ')}`,
    w.descripcion.trim() && `Descripción: ${w.descripcion.trim()}`,
    w.personalidad.trim() && `Personalidad e historia: ${w.personalidad.trim()}`
  ].filter(Boolean).join('\n');
  const pj = {
    id: uid(), nombre: w.nombre.trim(), jugador: w.jugador.trim(), clase: `${h.c.nombre} ${h.e.nombre.toLowerCase()}`, nivel: 1,
    ca: h.ca, pgMax: h.pg, ...h.f, salvComp: h.salv.slice(), iniDes: true, alerta: h.alerta, iniBC: h.alerta, iniExtra: 0,
    pasiva: h.pasiva, notas, conjuros: h.conjuros.map(c => c.id),
    hoja: { clase: h.c.id, trasfondo: h.t.id, especie: h.e.id, linaje: w.linaje, aptitud: w.aptitud, tamano: h.tamano, alineamiento: w.alineamiento,
      ordenClase: w.ordenClase || null, maestria: (w.maestria || []).slice(), invocaciones: (w.invoc || []).slice(), armaduras: h.armaduras, armas: h.armas,
      armadura: h.armadura, escudo: h.escudo, armaduraMago: false, caExtra: 0, equipoActual: h.equipo.join('\n'), grimorio: [...((w.conj || {}).grimT || []), ...((w.conj || {}).grimR || [])],
      habilidades: comp, pericia: h.habilidades.filter(x => x.pericia).map(x => x.nombre), dotes: h.dotes, idiomas: h.idiomas, equipo: h.equipo, herramientas: h.herramientas,
      conj: JSON.parse(JSON.stringify(w.conj || {})), magia: h.magia.map(m => ({ origen: m.origen, lista: m.lista, apt: m.apt, trucos: m.est.T, conjuros: m.est.C })), conjEspecie: wzConjFijos(), conjSiempre: wzConjClaseFijos(),
      tiradas: w.tiradas.map(Number), orden: wzOrden(), bonus: wzBonus(), descripcion: w.descripcion.trim(), personalidad: w.personalidad.trim(), creado: Date.now() }
  };
  E.personajes.push(pj);
  E.borradorPJ = null;
  A.rellenarEspacios({ dataset: { pj: pj.id } });
  navegar('#/hoja/' + pj.id);
  setTimeout(() => toast(`${pj.nombre} creado`), 50);
};
// ============ Hoja completa del personaje (fase 4) ============
const clasePJ = pj => CR && pj.hoja && CR.clases.find(c => c.id === pj.hoja.clase);
// Niveles en los que se repite un rasgo («Vuelves a obtener este rasgo en los niveles 8, 12 y 16»)
function nivelesRasgo(r) {
  const m = r.html.replace(/<[^>]+>/g, '').match(/[Vv]uelves a obtener este rasgo en los niveles ([\d,\sy]+)/);
  return [r.nivel, ...(m ? m[1].match(/\d+/g).map(Number) : [])];
}
// Rasgos de clase (y de subclase desde el nivel 3) que se ganan justo en el nivel n
function rasgosDeNivel(c, n) {
  const l = c.rasgos.filter(r => nivelesRasgo(r).includes(n)).map(r => ({ ...r, de: 'clase' }));
  if (c.subclase) l.push(...c.subclase.rasgos.filter(r => r.nivel === n).map(r => ({ ...r, de: 'subclase' })));
  return l;
}
function rasgosHasta(c, n) {
  const l = c.rasgos.filter(r => r.nivel <= n).map(r => ({ ...r, de: 'clase' }));
  if (c.subclase && n >= 3) l.push(...c.subclase.rasgos.filter(r => r.nivel <= n).map(r => ({ ...r, de: 'subclase' })));
  return l.sort((a, b) => a.nivel - b.nivel);
}
// Pericia que da cada clase por nivel (SRD 5.2.1: pícaro 1 y 6, bardo 2 y 9, explorador 2 —Explorador hábil— y 9)
const PERICIA_NIVEL = { picaro: { 1: 2, 6: 2 }, bardo: { 2: 2, 9: 2 }, explorador: { 2: 1, 9: 2 }, mago: { 2: 1 } };
function habilidadesPJ(pj) {
  const comp = new Set((pj.hoja.habilidades || []).map(norm)), per = new Set((pj.hoja.pericia || []).map(norm)), bc = bcDeNivel(pj.nivel);
  // Aprendiz de mucho (bardo, nivel 2): + la mitad del BC en las habilidades sin competencia
  const aprendiz = pj.hoja.clase === 'bardo' && (pj.nivel || 1) >= 2 ? Math.floor(bc / 2) : 0;
  return CR.habilidades.map(h => {
    const c = comp.has(norm(h.nombre)), p = c && per.has(norm(h.nombre)), extra = extraOrdenHab(pj.hoja.ordenClase, h.id, pj.sab);
    return { ...h, comp: c, pericia: p, extra, aprendiz: !c && aprendiz > 0, total: modDe(pj[h.car] ?? 10) + (c ? bc * (p ? 2 : 1) : aprendiz) + extra };
  });
}
const pasivaPJ = pj => 10 + habilidadesPJ(pj).find(h => h.id === 'percepcion').total;
// Velocidad extra por rasgos de clase (SRD 5.2.1): no son acciones, se aplican solas mientras se cumpla la condición
function velocidadExtra(c, n) {
  if (c.id === 'monje' && n >= 2) return { m: TABLA('monje', 'movimiento', n), rasgo: 'Movimiento sin armadura', cond: 'si no lleva armadura ni escudo' };
  if (c.id === 'barbaro' && n >= 5) return { m: 3, rasgo: 'Movimiento rápido', cond: 'si no lleva armadura pesada' };
  if (c.id === 'explorador' && n >= 6) return { m: 3, rasgo: 'Errante', cond: 'si no lleva armadura pesada' };
  return { m: 0 };
}
const fmtM = m => String(m).replace('.', ',') + ' m';
VISTAS.hoja = id => {
  const pj = pjPorId(id); if (!pj) return null;
  const c = clasePJ(pj);
  if (!c) return { titulo: pj.nombre, atras: '#/personajes', html: `<p class="vacio">Este perfil se creó rápido, sin el creador, así que no tiene hoja completa.</p><a class="btn ancho" href="#/personaje/${pj.id}">Ver su perfil</a>` };
  const h = pj.hoja, n = pj.nivel || 1, bc = bcDeNivel(n);
  const e = CR.especies.find(x => x.id === h.especie), t = CR.trasfondos.find(x => x.id === h.trasfondo);
  const l = e && e.linaje && e.linaje.opciones.find(o => o.id === h.linaje);
  const alin = CR.alineamientos.find(a => a.abr === h.alineamiento);
  const velBase = (l && l.velocidad) || (e && e.velocidad) || 9, vis = (l && l.vision) || (e && e.vision) || 0;
  equipoPJ(pj);
  const cal = caPJ(pj), v = velocidadPJ(pj, velBase), vx = v.vx, vel = v.total;
  if (pj.ca !== cal.total) { pj.ca = cal.total; sincronizarPJ(pj, 'ca'); guardar(); }
  const opArm = `<option value="">Sin armadura</option>${TIPOS_ARMADURA.map(([tipo, tit]) => `<optgroup label="${tit}">${ARMADURAS.filter(a => a.tipo === tipo).map(a => `<option value="${a.id}" ${h.armadura === a.id ? 'selected' : ''}>${a.nombre} (CA ${a.base}${tipo === 'ligera' ? ' + Des' : tipo === 'media' ? ' + Des máx. 2' : ''}${a.fue ? ', Fue ' + a.fue : ''})${entrenadoArmadura(h.armaduras || c.armaduras, tipo) ? '' : ' · sin entrenamiento'}</option>`).join('')}</optgroup>`).join('')}`;
  const sabeMago = (pj.conjuros || []).includes('armadura-de-mago');
  const salv = pj.salvComp || [];
  const habs = habilidadesPJ(pj);
  const ini = (pj.iniDes !== false ? modDe(pj.des) : 0) + (pj.iniBC ? bc : 0) + (pj.iniExtra || 0);
  const fila = (k, v) => v ? `<p><b>${k}:</b> ${v}</p>` : '';
  const det = (nombre, html, k, extra = '') => `<details class="regla" data-k="${k}"><summary>${esc(nombre)}${extra}</summary><div class="cuerpo">${html}</div></details>`;
  const dotes = (h.dotes || []).map(d => ({ ...d, srd: CR.dotes.find(x => x.id === d.id) }));
  const conj = (pj.conjuros || []).map(i => CONJ.get(i)).filter(Boolean).sort(ordenConj);
  const html = `
    <div class="wz-det wz-resumen">
      <p class="nota" style="margin:0 0 8px">${esc(c.nombre)} de nivel ${n}${h.subclase ? ` (${esc(h.subclase)})` : ''} · ${esc(e ? e.nombre : '')}${l ? ` (${esc(l.nombre.replace(/\s*\(.*\)$/, ''))})` : ''} · ${esc(t ? t.nombre : '')}${alin ? ' · ' + esc(alin.nombre) : ''}${pj.jugador ? ` · jugado por ${esc(pj.jugador)}` : ''}</p>
      <div class="wz-stats"><div><span>CA</span><b>${pj.ca ?? '—'}</b></div><div><span>PG máx.</span><b>${pj.pgMax ?? '—'}</b></div><div><span>Iniciativa</span><b>${signo(ini)}</b></div>
        <div><span>Velocidad</span><b>${fmtM(vel)}${vx.m || v.lenta ? '*' : ''}</b></div><div><span>BC</span><b>${signo(bc)}</b></div><div><span>Perc. pasiva</span><b>${pasivaPJ(pj)}</b></div></div>
      ${vis || h.tamano ? `<p class="nota" style="margin:6px 0 0">${h.tamano ? 'Tamaño ' + esc(h.tamano) : ''}${vis ? ` · visión en la oscuridad ${vis} m` : ''}</p>` : ''}
      ${vx.m ? `<p class="nota" style="margin:4px 0 0">Velocidad: ${fmtM(velBase)}${v.aplica ? ` + ${fmtM(vx.m)} de <b>${vx.rasgo}</b>, porque ahora ${vx.cond.replace(/^si /, '')}` : `. <b>${vx.rasgo}</b> (+${fmtM(vx.m)}) no se aplica ahora: solo ${vx.cond}`}${v.lenta ? '; −3 m por la Fuerza que pide su armadura' : ''}.</p>` : v.lenta ? `<p class="nota" style="margin:4px 0 0">Velocidad: ${fmtM(velBase)} − 3 m por la Fuerza que pide su armadura.</p>` : ''}
    </div>
    <h3 class="sub-tit">Armadura y CA</h3>
    <div class="wz-det">
      <p style="margin:0 0 8px">CA <b>${cal.total}</b> = ${cal.partes.map(esc).join(' + ')}</p>
      <label class="campo"><span>Armadura que lleva puesta</span><select data-ch="hojaArmadura" data-id="${pj.id}">${opArm}</select></label>
      <label class="check"><input type="checkbox" data-ch="hojaEscudo" data-id="${pj.id}" ${h.escudo ? 'checked' : ''}><span>Lleva escudo (+2; ponérselo o quitárselo es una acción de utilizar)</span></label>
      ${sabeMago && !cal.arm ? `<label class="check"><input type="checkbox" data-ch="hojaMago" data-id="${pj.id}" ${h.armaduraMago ? 'checked' : ''}><span>Armadura de mago activa (13 + Des; dura 8 horas)</span></label>` : ''}
      <label class="campo"><span>Otros bonos a la CA (objetos mágicos, etc.)</span><input class="cant" type="number" inputmode="numeric" data-ch="hojaCAExtra" data-id="${pj.id}" value="${h.caExtra || 0}"></label>
      ${cal.avisos.map(a => `<div class="aviso malo"><span>${esc(a)}</span></div>`).join('')}${cal.notas.map(a => `<p class="nota" style="margin:6px 0 0">${esc(a)}</p>`).join('')}
      <p class="nota" style="margin:6px 0 0">Si se quita la armadura, la pierde o se pone otra, cámbiala aquí: la CA se recalcula y se actualiza en los encuentros.</p>
    </div>
    <h3 class="sub-tit">Características y salvaciones</h3>
    <div class="cars-pj">${CARS_PJ.map(([k, nom]) => `<div class="car-pj${salv.includes(k) ? ' comp' : ''}"><span>${nom}</span><b class="wz-pt">${pj[k] ?? 10}</b><b>${signo(modDe(pj[k]))}</b><small>Salv. ${signo(modDe(pj[k]) + (salv.includes(k) ? bc : 0))}${salv.includes(k) ? ' ●' : ''}</small></div>`).join('')}</div>
    <h3 class="sub-tit">Habilidades</h3>
    <div class="wz-habs">${habs.map(x => `<div class="${x.comp ? 'comp' : ''}"><span>${x.pericia ? '◆ ' : x.comp ? '● ' : ''}${esc(x.nombre)} <small>(${CAR_ABR[x.car]})</small></span><b>${signo(x.total)}</b></div>`).join('')}</div>
    <p class="nota">● Competente (+${bc}).${habs.some(x => x.pericia) ? ` ◆ Pericia (+${bc * 2}).` : ''}${habs.some(x => x.aprendiz) ? ` Sin marca: ya incluye +${Math.floor(bc / 2)} de <b>Aprendiz de mucho</b>.` : ''}${notaExtraHab((ORDENES[c.id] && (ORDENES[c.id].ops.find(o => o[0] === h.ordenClase) || [])[1]) || '', habs)}</p>
    <h3 class="sub-tit">Rasgos de clase</h3>
    ${rasgosHasta(c, n).map((r, i) => det(r.nombre, r.html, 'hr' + i, ` <small class="nv">nv. ${r.nivel}${r.de === 'subclase' ? ' · ' + esc(c.subclase.nombre) : ''}</small>`)).join('')}
    ${e ? `<h3 class="sub-tit">Atributos de especie (${esc(e.nombre)})</h3>${e.rasgos.map((r, i) => det(r.nombre, r.html + (l && r.nombre === e.linaje.rasgo ? `<p><b>Elegido: ${esc(l.nombre)}.</b></p>${detalleLinaje(e, l)}` : ''), 'he' + i)).join('')}` : ''}
    ${dotes.length ? `<h3 class="sub-tit">Dotes</h3>${dotes.map((d, i) => det(d.nombre, d.srd ? d.srd.html : '', 'hd' + i, d.origen ? ` <small class="nv">${esc(String(d.origen))}</small>` : '')).join('')}` : ''}
    <h3 class="sub-tit">Competencias</h3>
    <div class="wz-det">${fila('Armaduras', esc(h.armaduras || c.armaduras))}${fila('Armas', esc(h.armas || c.armas))}
      ${h.ordenClase && ORDENES[c.id] ? fila(ORDENES[c.id].rasgo, esc((ORDENES[c.id].ops.find(o => o[0] === h.ordenClase) || [])[1] || '')) : ''}
      ${(h.maestria || []).length ? fila('Maestría con armas', esc(h.maestria.map(n => n + ' (' + ((CR.armas.find(a => a.nombre === n) || {}).maestria || '') + ')').join(', '))) : ''}
      ${(h.invocaciones || []).length ? fila('Invocaciones', esc(h.invocaciones.map(i => (CR.invocaciones.find(x => x.id === i) || {}).nombre || i).join(', '))) : ''}
      ${fila('Herramientas', esc((h.herramientas || [h.herramienta]).filter(Boolean).join(', ')))}${fila('Idiomas', esc((h.idiomas || []).join(', ')))}</div>
    ${(h.metamagia || []).length ? `<h3 class="sub-tit">Metamagia</h3>${h.metamagia.map((id, i) => { const m = (CR.metamagia || []).find(x => x.id === id); return m ? det(m.nombre, m.html, 'hm' + i, ` <small class="nv">${esc(m.coste)}</small>`) : ''; }).join('')}` : ''}
    ${c.id === 'druida' && h.terreno ? `<h3 class="sub-tit">Círculo de la tierra: terreno</h3><p class="nota" style="margin-top:0">Tras un descanso largo puede cambiarlo; sus conjuros de círculo cambian con él.</p>
      <div class="seg">${Object.entries(TERRENOS_DRUIDA).map(([k, x]) => `<button class="opc ${h.terreno === k ? 'on' : ''}" data-a="hojaTerreno" data-id="${pj.id}" data-v="${k}">${x.nombre}</button>`).join('')}</div>` : ''}
    ${conj.length ? `<h3 class="sub-tit">Conjuros</h3><div class="lista">${conj.map(x => { const marca = [(h.conjSiempre || []).includes(x.id) && 'siempre preparado', (h.arcanum || []).includes(x.id) && 'arcanum místico', (h.maestriaConj || []).includes(x.id) && 'maestría sobre conjuros', (h.caracteristicos || []).includes(x.id) && 'característico'].filter(Boolean);
      return `<div class="fila"><div class="f-txt" data-a="verConjuro" data-id="${x.id}"><div class="f-tit">${esc(x.nombre)} ${etiquetasConj(x)}</div><div class="f-sub">${nivelTxt(x.nivel)} · ${esc(x.escuela)}${marca.length ? ' · <b>' + marca.join(', ') + '</b>' : ''}</div></div></div>`; }).join('')}</div>` : ''}
    <h3 class="sub-tit">Equipo y personaje</h3>
    <label class="campo"><span>Equipo que lleva ahora (escríbelo y cámbialo cuando quieras)</span><textarea data-in="hojaEquipo" data-id="${pj.id}" rows="5">${esc(h.equipoActual ?? (h.equipo || []).join('\n'))}</textarea></label>
    <div class="wz-det">${fila('Equipo inicial', esc((h.equipo || []).join(' + ')))}${fila('Descripción', esc(h.descripcion))}${fila('Personalidad e historia', esc(h.personalidad))}</div>
    ${(h.niveles || []).length ? `<h3 class="sub-tit">Historial de niveles</h3><div class="wz-det">${h.niveles.map(x => `<p><b>Nivel ${x.nivel}:</b> ${esc(x.resumen)}</p>`).join('')}</div>` : ''}`;
  return {
    titulo: pj.nombre || 'Personaje', atras: '#/personajes', html,
    acciones: `<a class="icono" href="#/personaje/${pj.id}" aria-label="Editar datos de combate">${ic(IC.editar)}</a>`,
    pie: n < 20 ? `<a class="btn secundario" href="#/personaje/${pj.id}">Editar</a><button class="btn primario" data-a="subirNivel" data-id="${pj.id}">Subir a nivel ${n + 1}</button>` : `<a class="btn" href="#/personaje/${pj.id}">Editar datos de combate</a>`
  };
};

// Cambiar el terreno del Círculo de la tierra (tras un descanso largo): cambian sus conjuros de círculo
A.hojaTerreno = el => {
  const pj = pjPorId(el.dataset.id); if (!pj || !pj.hoja || pj.hoja.terreno === el.dataset.v) return;
  const h = pj.hoja, deTerreno = () => conjSiempre('druida', pj.nivel || 1, h).filter(x => x.origen === 'terreno').map(x => x.id);
  // Solo se quitan los que entraron por el terreno, no los que el jugador eligió él mismo
  const auto = new Set(h.conjSiempre || []), viejos = deTerreno().filter(i => auto.has(i)); h.terreno = el.dataset.v; const nuevos = deTerreno();
  pj.conjuros = (pj.conjuros || []).filter(i => !viejos.includes(i) || nuevos.includes(i));
  h.conjSiempre = (h.conjSiempre || []).filter(i => !viejos.includes(i) || nuevos.includes(i));
  nuevos.forEach(i => { if (!pj.conjuros.includes(i)) { pj.conjuros.push(i); if (!h.conjSiempre.includes(i)) h.conjSiempre.push(i); } });
  guardar(); render(); toast('Terreno: ' + TERRENOS_DRUIDA[h.terreno].nombre.toLowerCase());
};
// ============ Subir de nivel (fase 4) ============
const RE_CAR = 'Fuerza|Destreza|Constitución|Inteligencia|Sabiduría|Carisma';
const carDeNombre = n => (CARS_PJ.find(([, x]) => norm(x) === norm(n)) || [])[0];
const tieneRasgo = (c, re, n) => c.rasgos.some(r => re.test(r.nombre) && r.nivel <= n);
// ¿Cumple los requisitos de la dote? (nivel, características, rasgos)
function cumpleReq(d, c, n, cars) {
  if (d.nivelMin > n) return false;
  const req = d.requisitos || '';
  const m = req.match(new RegExp(`((?:${RE_CAR})(?:\\s+o\\s+(?:${RE_CAR}))*)\\s+(\\d+) o más`));
  if (m && !m[1].split(/\s+o\s+/).some(x => (cars[carDeNombre(x)] || 0) >= +m[2])) return false;
  if (/rasgo Estilo de combate/.test(req) && !tieneRasgo(c, /^Estilo de combate/, n)) return false;
  if (/rasgo Lanzamiento de conjuros/.test(req) && !tieneRasgo(c, /Lanzamiento de conjuros|Magia del pacto/, n)) return false;
  return true;
}
// Aumento de característica que da una dote: {opciones, max} (la dote Mejora de característica es aparte)
function aumentoDote(d) {
  const t = d.html.replace(/<[^>]+>/g, '');
  let m = t.match(/Aumenta tu puntuación de (.+?) en 1, hasta un máximo de (\d+)/);
  if (m) return { opciones: m[1].split(/,\s*|\s+o\s+/).map(carDeNombre).filter(Boolean), max: +m[2] };
  m = t.match(/Aumenta una puntuación de característica de tu elección en 1, hasta un máximo de (\d+)/);
  if (m) return { opciones: CARS_PJ.map(([k]) => k), max: +m[1] };
  return null;
}
const ranura = () => ({ tipo: 'car', modo: '2', a: null, b: null, dote: null, car: null, lista: null, apt: null, T: [], C: [], hab: [], herr: [] });
function planSubida(pj) {
  const c = clasePJ(pj), n = (pj.nivel || 1) + 1, rasgos = rasgosDeNivel(c, n), s = SU();
  const terreno = pj.hoja.terreno || (s && s.terreno) || null;
  const nc = nivelMaxConjuro(c, n);
  return {
    // Conjuros que gana ya preparados (subclase, clase, linaje); incluye los que le falten de niveles anteriores
    auto: conjSiempre(c.id, n, { ...pj.hoja, terreno }).filter(x => !(pj.conjuros || []).includes(x.id)),
    terreno: c.id === 'druida' && n >= 3 && !pj.hoja.terreno,
    metamagia: c.id === 'hechicero' ? METAMAGIA_NIVEL[n] || 0 : 0,
    arcanum: c.id === 'brujo' ? ARCANUM_NIVEL[n] || 0 : 0,
    habExtra: c.id === 'bardo' && n === 3 ? 3 : 0,
    descub: c.id === 'bardo' && n === 6 ? 2 : 0,
    evocacion: c.id === 'mago' ? (n === 3 ? 2 : n > 3 && nc > nivelMaxConjuro(c, n - 1) ? 1 : 0) : 0,
    capstone: n === 20 && { barbaro: ['fue', 'con'], monje: ['des', 'sab'] }[c.id],
    drac: c.id === 'hechicero' ? (n === 3 ? 3 : n > 3 ? 1 : 0) : 0,
    c, n, rasgos,
    mejora: rasgos.some(r => r.nombre === 'Mejora de característica'),
    don: rasgos.some(r => r.nombre === 'Don épico'),
    estilo: rasgos.find(r => /^Estilo de combate/.test(r.nombre)),
    pericia: (PERICIA_NIVEL[c.id] || {})[n] || 0,
    idiomas: c.id === 'explorador' && n === 2 ? 2 : 0,
    subclase: n === 3 && c.subclase,
    // Tablas de la clase (SRD 5.2.1): cuántos trucos, conjuros, invocaciones y maestrías nuevos
    trucos: Math.max(0, TABLA(c.id, 'trucos', n) - TABLA(c.id, 'trucos', n - 1)),
    conjuros: c.id === 'mago' ? 2 : Math.max(0, TABLA(c.id, 'preparados', n) - TABLA(c.id, 'preparados', n - 1)),
    invoc: Math.max(0, TABLA(c.id, 'invocaciones', n) - TABLA(c.id, 'invocaciones', n - 1)),
    maestria: Math.max(0, nMaestria(c.id, n) - nMaestria(c.id, n - 1)),
    nivelConj: nivelMaxConjuro(c, n)
  };
}
// Nivel de conjuro más alto para el que tiene espacios
function nivelMaxConjuro(c, n) {
  const t = tipoLanzador(c.nombre); if (!t) return 0;
  if (t === 'pacto') return PACTO_BRUJO[n][1];
  const fila = (t === 'completo' ? ESPACIOS_COMPLETO : ESPACIOS_MEDIO)[n];
  return fila.reduce((m, x, i) => x ? i + 1 : m, 0);
}
const enListaDe = (x, cid) => (x.clases || []).some(k => slug(k) === cid);
// Lista de conjuros agrupada por nivel (desplegables), para elegir en la subida de nivel
function suListaConjNiveles(k, filtro, elegidos, n, conocidos, nivelAbierto) {
  const ops = CONJS.filter(filtro).sort((a, b) => a.nivel - b.nivel || a.nombre.localeCompare(b.nombre, 'es'));
  const niveles = [...new Set(ops.map(x => x.nivel))];
  return niveles.map(nv => {
    const l = ops.filter(x => x.nivel === nv), sel = l.filter(x => elegidos.includes(x.id)).length;
    return `<details class="regla wz-grupo" ${nv === nivelAbierto || sel ? 'open' : ''}><summary><span><b>${nv ? 'Conjuros de nivel ' + nv : 'Trucos'}${sel ? ` <span class="cuenta">${sel}</span>` : ''}</b></span></summary><div class="cuerpo"><div class="lista">${l.map(x => { const on = elegidos.includes(x.id), bloq = !on && conocidos.has(x.id);
      return `<div class="fila"><button class="marca-conj ${on ? 'on' : ''}" data-a="suTog" data-s="" data-k="${k}" data-v="${x.id}" data-max="${n}" ${bloq ? 'disabled' : ''}>${on ? '✓' : '+'}</button>
        <div class="f-txt" data-a="verConjuro" data-id="${x.id}"><div class="f-tit">${esc(x.nombre)} ${etiquetasConj(x)}</div><div class="f-sub">${esc(x.escuela)}${bloq ? ' · ya lo conoce' : ''}</div></div></div>`; }).join('')}</div></div></details>`;
  }).join('');
}
// Grupos de conjuros que elige al subir de nivel. «libro» = se eligen de entre los que ya tiene.
// nEf = cuántos puede elegir de verdad (si ya conoce casi toda la lista, no se le piden más de los que quedan)
function suGrupos(pj) {
  const s = SU(), p = planSubida(pj), c = p.c, g = [], q = suQ();
  const libro = x => (pj.conjuros || []).includes(x.id);
  const porCambio = n => n ? ` Incluye ${n === 1 ? '1 más por el que quita' : n + ' más por los que quita'}.` : '';
  const alt = { paladin: 'clerigo', explorador: 'druida' }[c.id];
  const nT = p.trucos + (alt ? 0 : q.trucos.length);
  if (nT) g.push({ k: 'nTrucos', titulo: p.trucos ? 'Trucos nuevos' : 'Truco nuevo (por el que quita)', n: nT, filtro: x => x.nivel === 0 && enListaDe(x, c.id), abierto: 0, nota: p.trucos ? porCambio(q.trucos.length).trim() : '' });
  if (alt && q.trucos.length) g.push({ k: 'nTrucosAlt', titulo: `Truco de ${alt === 'clerigo' ? 'clérigo' : 'druida'} nuevo (por el que quita)`, n: q.trucos.length, filtro: x => x.nivel === 0 && enListaDe(x, alt), abierto: 0 });
  const nC = p.conjuros + q.conj.length;
  if (nC) {
    const listas = c.id === 'bardo' && p.n >= 10 ? ['bardo', 'clerigo', 'druida', 'mago'] : [c.id];
    g.push({ k: 'nConj', titulo: c.id === 'mago' ? 'Conjuros para su libro' : p.conjuros ? 'Conjuros preparados nuevos' : (q.conj.length === 1 ? 'Conjuro nuevo (por el que quita)' : 'Conjuros nuevos (por los que quita)'), n: nC, abierto: p.nivelConj,
      filtro: x => x.nivel >= 1 && x.nivel <= p.nivelConj && listas.some(l => enListaDe(x, l)),
      nota: (c.id === 'mago' ? `Al subir de nivel añade 2 conjuros de mago a su libro (${p.nivelConj > 1 ? `de nivel 1 a ${p.nivelConj}` : 'de nivel 1'}).`
        : p.conjuros ? `Su número de conjuros preparados sube de ${TABLA(c.id, 'preparados', p.n - 1)} a ${TABLA(c.id, 'preparados', p.n)}. ${p.nivelConj > 1 ? `Pueden ser de nivel 1 a ${p.nivelConj}` : 'Deben ser de nivel 1'}.`
        : `${p.nivelConj > 1 ? `De nivel 1 a ${p.nivelConj}` : 'De nivel 1'}.`)
        + (p.conjuros ? porCambio(q.conj.length) : '')
        + (listas.length > 1 ? ' Por <b>Secretos mágicos</b> puede elegirlos de las listas de bardo, clérigo, druida y mago.' : '') });
  }
  if (q.arcanum.length) { const nv = (CONJ.get(q.arcanum[0]) || {}).nivel; g.push({ k: 'cArc', titulo: `Arcanum místico nuevo de nivel ${nv} (por el que quita)`, n: 1, abierto: nv, filtro: x => x.nivel === nv && enListaDe(x, 'brujo') }); }
  if ((s.nInvoc || []).includes('pacto-del-grimorio')) GRIMORIO.forEach(gr => g.push({ k: gr.k, titulo: gr.titulo, n: gr.n, filtro: gr.filtro, abierto: -1 }));
  if (p.arcanum) g.push({ k: 'nArc', titulo: `Arcanum místico: 1 conjuro de brujo de nivel ${p.arcanum}`, n: 1, abierto: p.arcanum, filtro: x => x.nivel === p.arcanum && enListaDe(x, 'brujo'), nota: 'Lo lanza una vez sin gastar espacio de conjuro y lo recupera tras un descanso largo.' });
  if (p.descub) g.push({ k: 'nDesc', titulo: 'Descubrimientos mágicos: 2 conjuros de clérigo, druida o mago', n: 2, abierto: 0, filtro: x => x.nivel <= p.nivelConj && ['clerigo', 'druida', 'mago'].some(l => enListaDe(x, l)), nota: `Pueden ser trucos o conjuros de nivel 1 a ${p.nivelConj}. Siempre los tiene preparados.` });
  if (p.evocacion) { const max = p.n === 3 ? 2 : p.nivelConj; g.push({ k: 'nEvo', titulo: p.n === 3 ? 'Experto en evocación: 2 conjuros de evocación' : 'Experto en evocación: 1 conjuro de evocación', n: p.evocacion, abierto: max, filtro: x => x.escuela === 'Evocación' && x.nivel >= 1 && x.nivel <= max && enListaDe(x, 'mago'), nota: `Conjuros de mago de evocación de nivel ${max} o inferior. Se añaden gratis a su libro.` }); }
  if (c.id === 'mago' && p.n === 18) {
    g.push({ k: 'mc1', titulo: 'Maestría sobre conjuros: 1 conjuro de nivel 1 de su libro', n: 1, libro: true, abierto: 1, filtro: x => libro(x) && x.nivel === 1 && /^Acción$/i.test(x.tiempo), nota: 'Con tiempo de lanzamiento de una acción. Lo lanza a nivel 1 sin gastar espacio, siempre que quiera.' });
    g.push({ k: 'mc2', titulo: 'Maestría sobre conjuros: 1 conjuro de nivel 2 de su libro', n: 1, libro: true, abierto: 2, filtro: x => libro(x) && x.nivel === 2 && /^Acción$/i.test(x.tiempo), nota: 'Con tiempo de lanzamiento de una acción. Lo lanza a nivel 2 sin gastar espacio, siempre que quiera.' });
  }
  if (c.id === 'mago' && p.n === 20) g.push({ k: 'car3', titulo: 'Conjuros característicos: 2 conjuros de nivel 3 de su libro', n: 2, libro: true, abierto: 3, filtro: x => libro(x) && x.nivel === 3, nota: 'Siempre preparados. Lanza cada uno una vez a nivel 3 sin gastar espacio (se recupera con un descanso corto o largo).' });
  const auto = p.auto.map(a => a.id), deDotes = Object.values(s.ranuras || {}).flatMap(r => [...(r.T || []), ...(r.C || [])]);
  g.forEach(x => { x.elegidos = (s[x.k] ||= []); });
  g.forEach(x => {
    x.bloq = x.libro ? new Set() : new Set([...(pj.conjuros || []), ...auto, ...deDotes, ...g.filter(o => o !== x && !o.libro).flatMap(o => o.elegidos)]);
    x.nEf = Math.min(x.n, CONJS.filter(y => x.filtro(y) && (!x.bloq.has(y.id) || x.elegidos.includes(y.id))).length);
  });
  return g;
}
const SU = () => E.subidaPJ;
A.subirNivel = el => {
  const pj = pjPorId(el.dataset.id); if (!pj || !clasePJ(pj)) return;
  if (!E.subidaPJ || E.subidaPJ.pjId !== pj.id || E.subidaPJ.nivel !== (pj.nivel || 1) + 1)
    E.subidaPJ = { pjId: pj.id, nivel: (pj.nivel || 1) + 1, pgModo: 'media', pgTirada: '', ranuras: { mejora: ranura(), don: { ...ranura(), tipo: 'dote' }, estilo: { ...ranura(), tipo: 'dote' } }, pericia: [], idiomas: [] };
  guardar(); navegar('#/subir/' + pj.id);
};
// Puntuaciones tras aplicar las elecciones de esta subida
function suCaracteristicas(pj) {
  const s = SU(), cars = Object.fromEntries(CARS_PJ.map(([k]) => [k, pj[k] ?? 10]));
  const r = s.ranuras.mejora, p = planSubida(pj);
  if (p.mejora) {
    if (r.tipo === 'car') { if (r.modo === '2' && r.a) cars[r.a] = Math.min(20, cars[r.a] + 2); if (r.modo === '11') { if (r.a) cars[r.a] = Math.min(20, cars[r.a] + 1); if (r.b) cars[r.b] = Math.min(20, cars[r.b] + 1); } }
    else if (r.dote && r.car) { const au = aumentoDote(CR.dotes.find(d => d.id === r.dote)); if (au) cars[r.car] = Math.min(au.max, cars[r.car] + 1); }
  }
  const d = s.ranuras.don;
  if (p.don && d.dote && d.car) { const au = aumentoDote(CR.dotes.find(x => x.id === d.dote)); if (au) cars[d.car] = Math.min(au.max, cars[d.car] + 1); }
  // Campeón primordial (bárbaro 20) y Cuerpo y mente (monje 20): +4 a dos características, hasta 25
  if (p.capstone) p.capstone.forEach(k => { cars[k] = Math.max(cars[k], Math.min(25, cars[k] + 4)); });
  return cars;
}
function suPG(pj) {
  const s = SU(), c = clasePJ(pj), dado = dadoGolpe(c), media = dado / 2 + 1;
  const cars = suCaracteristicas(pj), conAntes = modDe(pj.con ?? 10), conDesp = modDe(cars.con);
  const base = s.pgModo === 'tirada' ? +s.pgTirada : media;
  const valida = s.pgModo !== 'tirada' || (Number.isInteger(base) && base >= 1 && base <= dado);
  const enano = pj.hoja.especie === 'enano' ? 1 : 0;
  const drac = planSubida(pj).drac; // Resistencia dracónica: +3 al llegar a hechicero 3 y +1 en cada nivel siguiente
  const nivel = valida ? Math.max(1, base + conDesp) + enano + drac : 0;
  const retro = (conDesp - conAntes) * (pj.nivel || 1);
  return { dado, media, base, valida, conDesp, enano, drac, nivel, retro, total: nivel + retro };
}
// Chips de elección para la subida: data-max limita cuántos se pueden marcar
const suChip = (s, k, v, on, txt, max, deshab) => `<button class="chip${on ? ' on' : ''}" data-a="suTog" data-s="${s}" data-k="${k}" data-v="${esc(v)}" data-max="${max}" aria-pressed="${on}" ${deshab ? 'disabled' : ''}>${esc(txt)}</button>`;
const suOpc = (s, k, v, on, txt, deshab) => `<button class="opc ${on ? 'on' : ''}" data-a="suSet" data-s="${s}" data-k="${k}" data-v="${esc(v)}" ${deshab ? 'disabled' : ''}>${txt}</button>`;
// Lista para elegir conjuros (trucos o nivel 1) de una lista de clase
function suListaConj(s, k, lista, nivel, elegidos, n, conocidos) {
  const ops = CONJS.filter(x => x.nivel === nivel && (x.clases || []).some(cl => slug(cl) === lista)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  return `<div class="lista">${ops.map(x => { const on = elegidos.includes(x.id), bloq = !on && conocidos.has(x.id);
    return `<div class="fila"><button class="marca-conj ${on ? 'on' : ''}" data-a="suTog" data-s="${s}" data-k="${k}" data-v="${x.id}" data-max="${n}" ${bloq ? 'disabled' : ''}>${on ? '✓' : '+'}</button>
      <div class="f-txt" data-a="verConjuro" data-id="${x.id}"><div class="f-tit">${esc(x.nombre)} ${etiquetasConj(x)}</div><div class="f-sub">${esc(x.escuela)}${bloq ? ' · ya lo conoce' : ''}</div></div></div>`; }).join('')}</div>`;
}
// Iniciado en la magia: listas ya usadas (cada vez una distinta) y cuántos conjuros quedan por aprender en la lista elegida
const listasIniciado = pj => (pj.hoja.magia || []).map(m => m.lista);
function iniciadoDisp(pj, r) {
  const conocidos = new Set([...(pj.conjuros || []), ...['T', 'C'].flatMap(k => Object.values(SU().ranuras).filter(x => x !== r).flatMap(x => x[k] || []))]);
  const cuenta = (nivel, n) => Math.min(n, CONJS.filter(x => x.nivel === nivel && enListaDe(x, r.lista) && !conocidos.has(x.id)).length);
  return { conocidos, nT: r.lista ? cuenta(0, 2) : 2, nC: r.lista ? cuenta(1, 1) : 1 };
}
// Elecciones extra de algunas dotes (aumento de característica, Iniciado en la magia, Habilidoso)
function htmlExtrasDote(pj, s, r, cars) {
  const d = CR.dotes.find(x => x.id === r.dote); if (!d) return '';
  let html = `<div class="wz-det">${d.html}</div>`;
  const au = aumentoDote(d);
  if (au) html += `<p class="wz-grupo-herr">Aumenta en 1 (máximo ${au.max})</p><div class="seg">${au.opciones.map(k => suOpc(s, 'car', k, r.car === k, `${CAR_ABR[k]} ${pj[k] ?? 10}`, (pj[k] ?? 10) >= au.max)).join('')}</div>`;
  if (d.id === 'iniciado-en-la-magia') {
    const usadas = listasIniciado(pj), { conocidos, nT, nC } = iniciadoDisp(pj, r);
    html += `<p class="wz-grupo-herr">Lista de conjuros</p><div class="seg">${LISTAS_MAGIA.map(([k, nom]) => suOpc(s, 'lista', k, r.lista === k, nom, usadas.includes(k))).join('')}</div>
      <p class="nota" style="margin-top:2px">Cada vez que se elige esta dote tiene que ser con una lista distinta.</p>
      <p class="wz-grupo-herr">Aptitud mágica</p><div class="seg">${['int', 'sab', 'car'].map(k => suOpc(s, 'apt', k, r.apt === k, CAR_NOMBRE[k])).join('')}</div>`;
    if (r.lista) html += `<p class="wz-grupo-herr">${nT === 1 ? '1 truco' : nT + ' trucos'} <span class="cuenta">${r.T.length}/${nT}</span></p>${nT < 2 ? '<p class="nota">Ya conoce casi todos los trucos de esta lista.</p>' : ''}${suListaConj(s, 'T', r.lista, 0, r.T, nT, conocidos)}
      <p class="wz-grupo-herr">1 conjuro de nivel 1 <span class="cuenta">${r.C.length}/${nC}</span></p>${suListaConj(s, 'C', r.lista, 1, r.C, nC, conocidos)}`;
  }
  if (d.id === 'habilidoso') {
    const comp = new Set((pj.hoja.habilidades || []).map(norm)), herrYa = new Set((pj.hoja.herramientas || []).map(norm));
    const total = r.hab.length + r.herr.length;
    html += `<p class="nota">Elige 3 en total entre habilidades y herramientas <span class="cuenta">${total}/3</span></p>
      <p class="wz-grupo-herr">Habilidades</p><div class="chips">${CR.habilidades.map(h => suChip(s, 'hab', h.nombre, r.hab.includes(h.nombre), h.nombre, 3 - r.herr.length, comp.has(norm(h.nombre)))).join('')}</div>
      ${GRUPOS_HERR.map(([tit, f]) => `<p class="wz-grupo-herr">${tit}</p><div class="chips">${HERR().filter(f).map(h => suChip(s, 'herr', h.nombre, r.herr.includes(h.nombre), h.grupo ? h.nombre.replace(/^[^:]+:\s*/, '') : h.nombre, 3 - r.hab.length, herrYa.has(norm(h.nombre)))).join('')}</div>`).join('')}
      <p class="wz-grupo-herr">Herramienta personalizada</p>
      ${r.herr.filter(x => !HERR().some(h => h.nombre === x)).map(x => suChip(s, 'herr', x, true, x + ' ✕', 3)).join(' ')}
      <div class="fila-anadir"><input id="su-herr-${s}" placeholder="Escribe una herramienta inventada" maxlength="60"><button class="btn peq" data-a="suHerrPropia" data-s="${s}">Añadir</button></div>`;
  }
  return html;
}
function htmlElegirDote(pj, s, r, filtro, cars) {
  const p = planSubida(pj), tomadas = new Set((pj.hoja.dotes || []).map(d => d.id));
  const otras = [...Object.entries(SU().ranuras).filter(([k]) => k !== s && p[k]).map(([, x]) => x.dote).filter(Boolean), ...(suQ().estilo.length ? SU().nEstilo || [] : [])];
  // Iniciado en la magia se puede repetir, pero con otra lista: no se ofrece si ya usó las 3 (contando la otra ranura de este nivel)
  const listasLibres = LISTAS_MAGIA.length - listasIniciado(pj).length - Object.entries(SU().ranuras).filter(([k, x]) => k !== s && p[k] && x.dote === 'iniciado-en-la-magia').length;
  const ops = CR.dotes.filter(d => filtro(d) && (d.repetible || (!tomadas.has(d.id) && !otras.includes(d.id))) && (d.id !== 'iniciado-en-la-magia' || listasLibres > 0));
  const cats = [['origen', 'De origen'], ['generales', 'Generales'], ['estilo-de-combate', 'De estilo de combate'], ['don-epico', 'Dones épicos']];
  return cats.map(([cat, tit]) => { const l = ops.filter(d => d.categoria === cat); if (!l.length) return '';
    return `<p class="wz-grupo-herr">${tit}</p><div class="wz-ops">${l.map(d => { const ok = cumpleReq(d, p.c, p.n, cars); const on = r.dote === d.id;
      return `<button class="wz-op${on ? ' on' : ''}" data-a="suSet" data-s="${s}" data-k="dote" data-v="${d.id}" ${ok ? '' : 'disabled'}><b>${esc(d.nombre)}</b>${d.requisitos ? `<small>Requisitos: ${esc(d.requisitos)}${ok ? '' : ' (no los cumple)'}</small>` : ''}</button>${on ? htmlExtrasDote(pj, s, r, cars) : ''}`; }).join('')}</div>`; }).join('');
}
// Habilidades en las que puede ganar pericia ahora (competente y sin pericia; el mago, solo las de Académico)
function opcionesPericia(pj, p) {
  const ya = new Set((pj.hoja.pericia || []).map(norm));
  return (pj.hoja.habilidades || []).filter(h => !ya.has(norm(h)) && (p.c.id !== 'mago' || ACADEMICO.some(a => norm(a) === norm(h)))).sort((a, b) => a.localeCompare(b, 'es'));
}
// ---- Cambios opcionales al subir de nivel (SRD 5.2.1) ----
// Lo que puede quitar en esta subida; por cada cosa que quite, elige una más en su sección
const suQ = () => (SU().quitar ||= { trucos: [], conj: [], invoc: [], arcanum: [], meta: [], maestria: [], estilo: [] });
const nomInv = i => (CR.invocaciones.find(x => x.id === i) || {}).nombre || i;
const nomMeta = i => ((CR.metamagia || []).find(x => x.id === i) || {}).nombre || i;
function suCambios(pj) {
  const p = planSubida(pj), c = p.c, h = pj.hoja, out = [], cn = c.nombre.toLowerCase();
  // Conjuros que no vienen de su clase (especie, dotes, subclase, arcanum, grimorio…) no se cambian aquí
  const protegidos = new Set([...(h.conjEspecie || []), ...(h.conjSiempre || []), ...conjSiempre(c.id, p.n, { ...h, terreno: h.terreno || SU().terreno }).map(x => x.id), ...(h.arcanum || []), ...(h.grimorio || []), ...((h.conj || {}).grimT || []), ...((h.conj || {}).grimR || []),
    ...(h.magia || []).flatMap(m => [...(m.trucos || []), ...(m.conjuros || [])]), ...(h.maestriaConj || []), ...(h.caracteristicos || [])]);
  const propios = f => (pj.conjuros || []).filter(i => !protegidos.has(i)).map(i => CONJ.get(i)).filter(x => x && f(x)).sort(ordenConj).map(x => ({ v: x.id, txt: x.nombre + (x.nivel ? ` (nv. ${x.nivel})` : '') }));
  if (tipoLanzador(c.nombre)) {
    const alt = { paladin: 'clerigo', explorador: 'druida' }[c.id], lt = alt || c.id;
    // Solo se ofrece si quedan otros por los que cambiar (además de los nuevos que ya elige en este nivel)
    const libres = f => CONJS.filter(x => f(x) && !(pj.conjuros || []).includes(x.id)).length;
    const t = propios(x => x.nivel === 0 && enListaDe(x, lt));
    if (t.length && libres(x => x.nivel === 0 && enListaDe(x, lt)) > (alt ? 0 : p.trucos)) out.push({ k: 'trucos', donde: 'Conjuros', titulo: 'Cambiar un truco', max: 1, items: t,
      regla: c.id === 'mago' ? 'Tras un descanso largo puede sustituir un truco por otro truco de mago.' : alt ? `Al subir de nivel puede sustituir uno de los trucos de su estilo de combate por otro truco de ${alt === 'clerigo' ? 'clérigo' : 'druida'}.` : `Al subir de nivel puede sustituir un truco por otro de la lista de ${cn}.` });
    if (c.id !== 'mago') {
      const listas = c.id === 'bardo' && p.n >= 10 ? ['bardo', 'clerigo', 'druida', 'mago'] : [c.id], todos = c.id === 'clerigo' || c.id === 'druida';
      const l = propios(x => x.nivel >= 1 && listas.some(k => enListaDe(x, k)));
      if (l.length && libres(x => x.nivel >= 1 && x.nivel <= p.nivelConj && listas.some(k => enListaDe(x, k))) > p.conjuros) out.push({ k: 'conj', donde: 'Conjuros', titulo: todos ? 'Cambiar conjuros preparados' : 'Cambiar un conjuro', max: todos ? l.length : 1, items: l,
        regla: todos ? `Tras un descanso largo puede cambiar los conjuros preparados que quiera por otros de ${cn} para los que tenga espacios.`
          : ['paladin', 'explorador'].includes(c.id) ? `Tras un descanso largo puede sustituir un conjuro por otro de ${cn} para el que tenga espacios.` : `Al subir de nivel puede sustituir un conjuro por otro de ${cn} para el que tenga espacios.` });
    }
  }
  if (c.id === 'brujo' && (h.invocaciones || []).length) out.push({ k: 'invoc', donde: 'Invocaciones sobrenaturales', titulo: 'Cambiar una invocación', max: 1,
    regla: 'Al subir de nivel puede sustituir una invocación por otra para la que cumpla los requisitos. No puede quitar una que sea requisito de otra que tenga.',
    items: [...new Set(h.invocaciones)].map(i => { const dep = h.invocaciones.map(x => CR.invocaciones.find(y => y.id === x)).find(y => y && y.requiereInvocacion === i);
      return { v: i, txt: nomInv(i) + (i === 'pacto-del-grimorio' ? ' (pierde su Libro de las sombras)' : ''), no: dep ? 'la necesita ' + dep.nombre : '' }; }) });
  if (c.id === 'brujo' && (h.arcanum || []).length) out.push({ k: 'arcanum', donde: 'Conjuros', titulo: 'Cambiar un conjuro de Arcanum místico', max: 1, regla: 'Al subir de nivel puede sustituir un conjuro de arcanum por otro de brujo del mismo nivel.',
    items: h.arcanum.map(i => ({ v: i, txt: `${(CONJ.get(i) || {}).nombre || i} (nv. ${(CONJ.get(i) || {}).nivel})` })) });
  if (c.id === 'hechicero' && (h.metamagia || []).length) out.push({ k: 'meta', donde: 'Metamagia', titulo: 'Cambiar una opción de metamagia', max: 1, regla: 'Al subir de nivel puede sustituir una opción de metamagia por otra que no conozca.', items: h.metamagia.map(i => ({ v: i, txt: nomMeta(i) })) });
  if ((h.maestria || []).length && nMaestria(c.id, p.n)) { const una = c.id === 'barbaro' || c.id === 'guerrero';
    out.push({ k: 'maestria', donde: 'Maestría con armas', titulo: una ? 'Cambiar un arma de maestría' : 'Cambiar armas de maestría', max: una ? 1 : h.maestria.length,
      regla: una ? 'Tras un descanso largo puede cambiar una de sus armas de maestría.' : 'Tras un descanso largo puede cambiar los tipos de armas elegidos.', items: h.maestria.map(x => ({ v: x, txt: x })) }); }
  if (c.id === 'guerrero') { const est = (h.dotes || []).filter(d => (CR.dotes.find(x => x.id === d.id) || {}).categoria === 'estilo-de-combate');
    if (est.length) out.push({ k: 'estilo', titulo: 'Cambiar una dote de estilo de combate', max: 1, regla: 'Al subir de nivel de guerrero puede sustituir su dote de estilo de combate por otra.', items: est.map(d => ({ v: d.id, txt: d.nombre })) }); }
  return out;
}
// Cuántas invocaciones, maestrías y opciones de metamagia elige en total (las nuevas + las que sustituye)
function suTot(p) { const q = suQ(); return { invoc: p.invoc + q.invoc.length, maestria: p.maestria + q.maestria.length, meta: p.metamagia + q.meta.length }; }
// Dotes elegidas en las ranuras de esta subida (Mejora de característica, Don épico, Estilo de combate)
const suDotesRanuras = p => Object.entries(SU().ranuras).filter(([k, r]) => p[k] && r.tipo === 'dote' && r.dote).map(([, r]) => r.dote);
// Dotes que tendrá al confirmar (para calcular la CA con Defensa)
function suDotesFinales(pj, p) {
  const s = SU(), q = suQ(), ids = (pj.hoja.dotes || []).map(d => d.id);
  if (q.estilo.length) { const i = ids.indexOf(q.estilo[0]); if (i >= 0) ids.splice(i, 1); if ((s.nEstilo || [])[0]) ids.push(s.nEstilo[0]); }
  ['mejora', 'don', 'estilo'].forEach(k => { const r = s.ranuras[k]; if (p[k] && r.dote && r.tipo === 'dote') ids.push(r.dote); });
  return ids;
}
A.suQuitar = el => {
  const s = SU(), q = suQ(), k = el.dataset.k, v = el.dataset.v, max = +el.dataset.max, l = q[k], i = l.indexOf(v);
  if (i >= 0) l.splice(i, 1);
  else if (l.length >= max) { toast(max === 1 ? 'Solo puede cambiar uno: desmarca el otro primero.' : `Como mucho ${max}.`); return; }
  else l.push(v);
  if (k === 'arcanum') s.cArc = [];
  if (k === 'estilo') s.nEstilo = [];
  guardar(); render();
};
function suFalta(pj) {
  const s = SU(), p = planSubida(pj), pg = suPG(pj), q = suQ(), tot = suTot(p);
  if (!pg.valida) return `Escribe lo que ha sacado en el d${pg.dado} (de 1 a ${pg.dado})`;
  const dote = (r, nombre) => {
    if (!r.dote) return `${nombre}: elige una dote`;
    const d = CR.dotes.find(x => x.id === r.dote);
    if (aumentoDote(d) && !r.car) return `${nombre}: elige qué característica aumenta`;
    if (d.id === 'iniciado-en-la-magia') { const { nT, nC } = iniciadoDisp(pj, r); if (!r.lista || !r.apt || r.T.length !== nT || r.C.length !== nC) return `${nombre}: completa Iniciado en la magia (lista, aptitud, ${nT === 1 ? '1 truco' : nT + ' trucos'} y 1 conjuro)`; }
    if (d.id === 'habilidoso' && r.hab.length + r.herr.length !== 3) return `${nombre}: elige 3 entre habilidades y herramientas`;
    return '';
  };
  if (p.mejora) { const r = s.ranuras.mejora; if (r.tipo === 'car') { if (!r.a || (r.modo === '11' && (!r.b || r.b === r.a))) return 'Mejora de característica: elige qué características suben'; } else { const f = dote(r, 'Mejora de característica'); if (f) return f; } }
  if (p.don) { const f = dote(s.ranuras.don, 'Don épico'); if (f) return f; }
  if (p.estilo) { const r = s.ranuras.estilo; if (r.tipo === 'trucos') { if (r.T.length !== 2) return 'Elige 2 trucos'; } else if (!r.dote) return 'Elige el estilo de combate'; }
  if (p.pericia) { const n = Math.min(p.pericia, opcionesPericia(pj, p).length); if (s.pericia.length !== n) return `Pericia: elige ${n}`; }
  if (p.habExtra && (s.nHab || []).length !== p.habExtra) return `Competencias adicionales: elige ${p.habExtra} habilidades`;
  if (p.idiomas && s.idiomas.length !== p.idiomas) return `Elige ${p.idiomas} idiomas`;
  if (p.terreno && !s.terreno) return 'Círculo de la tierra: elige un tipo de terreno';
  if (q.estilo.length && (s.nEstilo || []).length !== 1) return 'Elige la nueva dote de estilo de combate';
  if (q.estilo.length && suDotesRanuras(p).includes(s.nEstilo[0])) return 'Esa dote de estilo de combate ya la elige en otro apartado de esta subida: elige otra';
  if (tot.meta && (s.nMeta || []).length !== tot.meta) return `Metamagia: elige ${tot.meta} (llevas ${(s.nMeta || []).length})`;
  if (tot.maestria && (s.nMaestria || []).length !== tot.maestria) return `Maestría con armas: elige ${tot.maestria} (llevas ${(s.nMaestria || []).length})`;
  if (tot.invoc && (s.nInvoc || []).length !== tot.invoc) return `Invocaciones: elige ${tot.invoc} (llevas ${(s.nInvoc || []).length})`;
  const grupos = suGrupos(pj);
  for (const g of grupos) if (g.elegidos.length !== g.nEf) return `${g.titulo}: elige ${g.nEf} (llevas ${g.elegidos.length})`;
  // Al quitar una invocación o un truco, las invocaciones que le queden deben seguir cumpliendo sus requisitos
  if (pj.hoja.clase === 'brujo') {
    const inv = [...(pj.hoja.invocaciones || []).filter(i => !q.invoc.includes(i)), ...(s.nInvoc || [])];
    const nuevosT = grupos.filter(g => /^nTrucos/.test(g.k)).flatMap(g => g.elegidos);
    const h = pj.hoja, libro = q.invoc.includes('pacto-del-grimorio') ? [...(h.grimorio || []), ...((h.conj || {}).grimT || []), ...((h.conj || {}).grimR || [])] : [];
    const trucos = [...(pj.conjuros || []).filter(i => !q.trucos.includes(i) && !libro.includes(i)), ...nuevosT];
    for (const id of new Set(inv)) { const x = CR.invocaciones.find(y => y.id === id); const no = x && invocacionValida(x, p.n, inv.filter(y => y !== id), trucos); if (no) return `${x.nombre}: ${no}. Cambia lo que quitas o elige otra cosa`; }
  }
  return '';
}
VISTAS.subir = id => {
  const pj = pjPorId(id), c = pj && clasePJ(pj);
  if (!c || !SU() || SU().pjId !== id || SU().nivel !== (pj.nivel || 1) + 1) return { titulo: 'Subir de nivel', atras: pj ? '#/hoja/' + id : '#/personajes', html: `<p class="vacio">No hay ninguna subida de nivel en marcha.</p>` };
  equipoPJ(pj);
  const s = SU(), p = planSubida(pj), pg = suPG(pj), cars = suCaracteristicas(pj), q = suQ(), tot = suTot(p);
  const sec = (t, h) => `<section class="bloque"><h2 style="font-size:1.02rem;margin:0 0 6px">${t}</h2>${h}</section>`;
  let html = `<p class="wz-paso">${esc(pj.nombre)} · ${esc(c.nombre)} de nivel ${p.n - 1} → ${p.n}</p>`;
  // 1. Puntos de golpe
  html += sec('Puntos de golpe', `<p class="nota" style="margin-top:0">En cada nivel gana su dado de golpe (d${pg.dado}) + su modificador de Constitución (${signo(pg.conDesp)})${pg.enano ? ' + 1 por Aguante enano' : ''}. Puedes tirar el dado o usar el valor fijo.</p>
    <div class="seg"><button class="opc ${s.pgModo === 'media' ? 'on' : ''}" data-a="suSet" data-s="" data-k="pgModo" data-v="media">Valor fijo (${pg.media})</button><button class="opc ${s.pgModo === 'tirada' ? 'on' : ''}" data-a="suSet" data-s="" data-k="pgModo" data-v="tirada">Tirar el d${pg.dado}</button></div>
    ${s.pgModo === 'tirada' ? `<label class="campo"><span>Resultado del d${pg.dado}</span><input class="cant" data-in="suPG" type="number" inputmode="numeric" min="1" max="${pg.dado}" value="${esc(s.pgTirada)}"></label>` : ''}
    <p class="wz-pg" id="su-pg">${htmlSuPG(pj)}</p>`);
  // 2. Rasgos nuevos
  html += sec(`Rasgos nuevos de nivel ${p.n}`, (p.subclase ? `<p class="nota" style="margin-top:0">Subclase: <b>${esc(c.subclase.nombre)}</b> (la única del SRD para ${esc(c.nombre.toLowerCase())}).</p>` : '')
    + (p.rasgos.length ? p.rasgos.map((r, i) => `<details class="regla"><summary>${esc(r.nombre)}${r.de === 'subclase' ? ` <small class="nv">${esc(c.subclase.nombre)}</small>` : ''}</summary><div class="cuerpo">${r.html}</div></details>`).join('') : '<p class="nota">En este nivel no gana rasgos nuevos.</p>')
    + `<p class="nota">Bonificador por competencia: ${signo(bcDeNivel(p.n))}${bcDeNivel(p.n) > bcDeNivel(p.n - 1) ? ' (¡sube!)' : ''}.</p>`
    + (p.capstone ? `<p class="nota"><b>${p.capstone.map(k => CAR_NOMBRE[k]).join(' y ')} +4</b> (hasta 25): se suma sola al confirmar (${p.capstone.map(k => `${CAR_ABR[k]} ${pj[k] ?? 10} → ${cars[k]}`).join(', ')}).</p>` : '')
    + (() => { const antes = caPJ(pj).total, nueva = caPJ(pj, { cars, n: p.n, dotes: suDotesFinales(pj, p) });
      return nueva.total !== antes ? `<p class="nota">Clase de armadura: <b>${antes} → ${nueva.total}</b> (${nueva.partes.map(esc).join(' + ')}). Se calcula con lo que lleva puesto según su hoja.</p>` : ''; })());
  // 3. Mejora de característica
  if (p.mejora) {
    const r = s.ranuras.mejora;
    let h = `<div class="seg">${suOpc('mejora', 'tipo', 'car', r.tipo === 'car', 'Subir características')}${suOpc('mejora', 'tipo', 'dote', r.tipo === 'dote', 'Elegir otra dote')}</div>`;
    if (r.tipo === 'car') {
      h += `<p class="nota">Aumenta en 2 una característica, o en 1 dos distintas. Ninguna puede pasar de 20.</p>
        <div class="seg">${suOpc('mejora', 'modo', '2', r.modo === '2', '+2 a una')}${suOpc('mejora', 'modo', '11', r.modo === '11', '+1 a dos')}</div>
        <div class="wz-bonus"><span>${r.modo === '2' ? '+2 a' : '+1 a'}</span><div class="seg">${CARS_PJ.map(([k]) => suOpc('mejora', 'a', k, r.a === k, `${CAR_ABR[k]} ${pj[k] ?? 10}`, (pj[k] ?? 10) > (r.modo === '2' ? 18 : 19))).join('')}</div></div>
        ${r.modo === '11' ? `<div class="wz-bonus"><span>+1 a</span><div class="seg">${CARS_PJ.map(([k]) => suOpc('mejora', 'b', k, r.b === k, `${CAR_ABR[k]} ${pj[k] ?? 10}`, k === r.a || (pj[k] ?? 10) > 19)).join('')}</div></div>` : ''}`;
    } else h += `<p class="nota">En lugar de subir características puede elegir otra dote para la que cumpla los requisitos.</p>` + htmlElegirDote(pj, 'mejora', r, d => d.categoria !== 'don-epico' && d.id !== 'mejora-de-caracteristica', cars);
    html += sec('Mejora de característica', h);
  }
  if (p.don) html += sec('Don épico', `<p class="nota" style="margin-top:0">Elige un don épico u otra dote para la que cumpla los requisitos. El SRD recomienda Don del ataque imparable.</p>` + htmlElegirDote(pj, 'don', s.ranuras.don, () => true, cars));
  if (p.estilo) {
    const r = s.ranuras.estilo, alt = p.estilo.nombre === 'Estilo de combate' && (c.id === 'paladin' || c.id === 'explorador');
    const altLista = c.id === 'paladin' ? 'clerigo' : 'druida', altNom = c.id === 'paladin' ? 'Guerrero bendito (2 trucos de clérigo)' : 'Guerrero druídico (2 trucos de druida)';
    let h = alt ? `<div class="seg">${suOpc('estilo', 'tipo', 'dote', r.tipo === 'dote', 'Dote de estilo de combate')}${suOpc('estilo', 'tipo', 'trucos', r.tipo === 'trucos', esc(altNom))}</div>` : '';
    if (r.tipo === 'trucos' && alt) h += `<p class="nota">Aprende 2 trucos <span class="cuenta">${r.T.length}/2</span>. Usa Carisma (paladín) o Sabiduría (explorador) para lanzarlos.</p>${suListaConj('estilo', 'T', altLista, 0, r.T, 2, new Set(pj.conjuros || []))}`;
    else h += htmlElegirDote(pj, 'estilo', r, d => d.categoria === 'estilo-de-combate' && !(q.estilo.length && (s.nEstilo || []).includes(d.id)), cars);
    html += sec(esc(p.estilo.nombre), h);
  }
  if (p.pericia) {
    const ops = opcionesPericia(pj, p), n = Math.min(p.pericia, ops.length);
    html += sec(c.id === 'mago' ? 'Académico (pericia)' : 'Pericia', `<p class="nota" style="margin-top:0">${c.id === 'mago' ? `Elige 1 de estas habilidades en la que ya sea competente: ${ACADEMICO.join(', ')}.` : `Elige ${p.pericia === 1 ? '1 habilidad' : p.pericia + ' habilidades'} en las que ya es competente y aún no tiene pericia.`} Su bonificador por competencia se duplica en ella${p.pericia > 1 ? 's' : ''}. <span class="cuenta">${s.pericia.length}/${n}</span></p>
      ${ops.length ? `<div class="chips">${ops.map(h => suChip('', 'pericia', h, s.pericia.includes(h), h, n)).join('')}</div>` : '<p class="nota">No es competente en ninguna de ellas, así que este rasgo no le da nada ahora.</p>'}`);
  }
  if (p.habExtra) {
    const comp = new Set((pj.hoja.habilidades || []).map(norm)); s.nHab ||= [];
    html += sec('Competencias adicionales', `<p class="nota" style="margin-top:0">Por el Colegio del conocimiento gana competencia en 3 habilidades de su elección <span class="cuenta">${s.nHab.length}/3</span>.</p>
      <div class="chips">${CR.habilidades.filter(h => !comp.has(norm(h.nombre))).map(h => suChip('', 'nHab', h.nombre, s.nHab.includes(h.nombre), h.nombre, 3)).join('')}</div>`);
  }
  if (p.terreno) {
    const t = TERRENOS_DRUIDA[s.terreno];
    html += sec('Círculo de la tierra: terreno', `<p class="nota" style="margin-top:0">Elige un tipo de terreno. Tendrá siempre preparados sus conjuros de círculo de su nivel o inferior. Tras un descanso largo puede cambiarlo (desde su hoja).</p>
      <div class="seg">${Object.entries(TERRENOS_DRUIDA).map(([k, x]) => suOpc('', 'terreno', k, s.terreno === k, x.nombre)).join('')}</div>
      ${t ? `<p class="nota">${Object.entries(t.conj).map(([nv, l]) => `<b>Nivel ${nv}:</b> ${l.map(esc).join(', ')}`).join(' · ')}</p>` : ''}`);
  }
  // ¿Quiere cambiar algo? (opcional): lo que marque se quita y se elige otro en su sección
  const cambios = suCambios(pj);
  if (cambios.length) {
    const est = q.estilo.length ? (() => { const ya = (pj.hoja.dotes || []).map(d => d.id), sel = CR.dotes.find(d => d.id === (s.nEstilo || [])[0]);
      const ops = CR.dotes.filter(d => d.categoria === 'estilo-de-combate' && !ya.includes(d.id) && (!suDotesRanuras(p).includes(d.id) || (s.nEstilo || []).includes(d.id)));
      return `<p class="wz-grupo-herr">Nueva dote de estilo de combate</p>${ops.length ? `<div class="chips">${ops.map(d => suChip('', 'nEstilo', d.id, (s.nEstilo || []).includes(d.id), d.nombre, 1)).join('')}</div>` : '<p class="nota">No le queda ninguna otra dote de estilo de combate: desmarca el cambio.</p>'}${sel ? `<div class="wz-det">${sel.html}</div>` : ''}`; })() : '';
    html += sec('¿Quiere cambiar algo?', `<p class="nota" style="margin-top:0">Es opcional. Marca lo que quiera quitar y, más abajo, elegirá otro en su lugar: se le pedirá uno más por cada uno que quite. Si no quiere cambiar nada, déjalo como está.</p>`
      + cambios.map(cb => { const sel = q[cb.k];
        return `<details class="regla" ${sel.length ? 'open' : ''}><summary>${esc(cb.titulo)}${sel.length ? ` <span class="cuenta">${sel.length}</span>` : ''}</summary><div class="cuerpo">
          <p class="nota" style="margin-top:0">${esc(cb.regla)}${cb.max > 1 ? '' : ' Toca el que quiera quitar.'}</p>
          <div class="chips">${cb.items.map(it => { const on = sel.includes(it.v), des = !on && !!it.no;
            return `<button class="chip${on ? ' on quitar' : ''}" data-a="suQuitar" data-k="${cb.k}" data-v="${esc(it.v)}" data-max="${cb.max}" aria-pressed="${on}" ${des ? 'disabled' : ''}>${on ? '✕ ' : ''}${esc(it.txt)}${it.no ? ` (${esc(it.no)})` : ''}</button>`; }).join('')}</div>
          ${sel.length && cb.donde ? `<p class="nota">Elige ${sel.length === 1 ? 'el nuevo' : 'los nuevos'} en «${cb.donde}», más abajo.</p>` : ''}${cb.k === 'estilo' ? est : ''}</div></details>`; }).join(''));
  }
  if (tot.meta) {
    const ya = pj.hoja.metamagia || []; s.nMeta ||= [];
    html += sec('Metamagia', `<p class="nota" style="margin-top:0">Elige ${tot.meta === 1 ? '1 opción' : tot.meta + ' opciones'} de metamagia${q.meta.length ? ` (${q.meta.length === tot.meta ? 'por la que quita' : 'incluye 1 por la que quita'})` : ''} <span class="cuenta">${s.nMeta.length}/${tot.meta}</span>. Cada una cuesta puntos de hechicería. Toca una para leerla.</p>
      <div class="wz-ops">${(CR.metamagia || []).map(m => { const on = s.nMeta.includes(m.id), des = !on && ya.includes(m.id);
        return `<button class="wz-op${on ? ' on' : ''}" data-a="suTog" data-s="" data-k="nMeta" data-v="${m.id}" data-max="${tot.meta}" ${des ? 'disabled' : ''}><b>${esc(m.nombre)}</b><small>Coste: ${esc(m.coste)}${des ? ' · <span class="no">ya la conoce</span>' : ''}</small>${on ? `<div class="wz-op-det">${m.html}</div>` : ''}</button>`; }).join('')}</div>`);
  }
  if (p.idiomas) {
    const sabe = new Set((pj.hoja.idiomas || []).map(norm));
    html += sec('Idiomas (Explorador hábil)', `<p class="nota" style="margin-top:0">Aprende 2 idiomas de su elección.</p><div class="chips">${[...CR.idiomas.estandar, ...CR.idiomas.inusuales].map(i => suChip('', 'idiomas', i, s.idiomas.includes(i), i, 2, sabe.has(norm(i)))).join('')}</div>`);
  }
  ['nTrucos', 'nConj', 'nInvoc', 'nMaestria', 'grimT', 'grimR'].forEach(k => s[k] ||= []);
  const quedan = (l, k) => (l || []).filter(x => !q[k].includes(x));
  if (tot.maestria) html += sec('Maestría con armas', `<p class="nota" style="margin-top:0">Elige ${tot.maestria === 1 ? '1 tipo de arma' : tot.maestria + ' tipos de armas'}${q.maestria.length ? ` (${q.maestria.length === tot.maestria ? 'por las que quita' : 'incluye las que quita'})` : ' más'} <span class="cuenta">${s.nMaestria.length}/${tot.maestria}</span>. Sigue teniendo: ${esc(quedan(pj.hoja.maestria, 'maestria').join(', ') || 'ninguna')}.</p>`
    + htmlMaestria(c.id, s.nMaestria, pj.hoja.maestria || [], (v, on, txt, des) => suChip('', 'nMaestria', v, on, txt, tot.maestria, des)));
  if (tot.invoc) {
    const trucos = [...quedan(pj.conjuros, 'trucos'), ...s.nTrucos];
    html += sec('Invocaciones sobrenaturales', `<p class="nota" style="margin-top:0">Aprende ${tot.invoc === 1 ? '1 invocación' : tot.invoc + ' invocaciones'}${q.invoc.length ? ` (${q.invoc.length === tot.invoc ? 'por la que quita' : 'incluye 1 por la que quita'})` : ' nueva' + (tot.invoc > 1 ? 's' : '')} <span class="cuenta">${s.nInvoc.length}/${tot.invoc}</span>. Sigue conociendo: ${esc(quedan(pj.hoja.invocaciones, 'invoc').map(nomInv).join(', ') || 'ninguna')}. Toca una para leerla.</p>`
      + htmlInvocaciones(p.n, quedan(pj.hoja.invocaciones, 'invoc'), s.nInvoc, trucos, (v, on, inner, des) => `<button class="wz-op${on ? ' on' : ''}" data-a="suTog" data-s="" data-k="nInvoc" data-v="${v}" data-max="${tot.invoc}" ${des ? 'disabled' : ''}>${inner}</button>`));
  }
  const tipo = tipoLanzador(c.nombre);
  if (tipo) {
    const esp = tipo === 'pacto' ? `${PACTO_BRUJO[p.n][0]} espacios de nivel ${PACTO_BRUJO[p.n][1]}` : (tipo === 'completo' ? ESPACIOS_COMPLETO : ESPACIOS_MEDIO)[p.n].map((x, i) => x ? `${x} de nivel ${i + 1}` : '').filter(Boolean).join(', ');
    let h = `<p class="nota" style="margin-top:0">Espacios de conjuro a nivel ${p.n}: <b>${esp}</b> (se actualizan solos).</p>`;
    if (p.auto.length) h += `<h3 class="sub-tit">Gana siempre preparados</h3><p class="nota" style="margin-top:0">Se los da ${[...new Set(p.auto.map(a => ({ terreno: 'su Círculo de la tierra', subclase: 'su subclase (' + esc(c.subclase.nombre) + ')', especie: 'su linaje', clase: 'su clase' })[a.origen]))].join(' y ')}. No cuentan entre los que elige.</p>
      <div class="lista">${p.auto.map(a => { const x = CONJ.get(a.id); return `<div class="fila"><span class="marca-conj on">✓</span><div class="f-txt" data-a="verConjuro" data-id="${x.id}"><div class="f-tit">${esc(x.nombre)} ${etiquetasConj(x)}</div><div class="f-sub">${nivelTxt(x.nivel)} · ${esc(x.escuela)}</div></div></div>`; }).join('')}</div>`;
    const grupos = suGrupos(pj);
    for (const g of grupos) h += `<h3 class="sub-tit">${esc(g.titulo)}: elige ${g.nEf} <span class="cuenta">${g.elegidos.length}/${g.nEf}</span></h3>${g.nota ? `<p class="nota" style="margin-top:0">${g.nota}</p>` : ''}${g.nEf < g.n ? `<p class="nota" style="margin-top:0">Ya conoce casi todos los de esta lista: solo quedan ${g.nEf} por elegir.</p>` : ''}
      ${suListaConjNiveles(g.k, g.filtro, g.elegidos, g.nEf, new Set([...g.bloq].filter(i => !g.elegidos.includes(i))), g.abierto)}`;
    if (!grupos.length && !p.auto.length) h += `<p class="nota">En este nivel no aprende trucos ni conjuros nuevos.</p>`;
    h += `<p class="nota">Toca el nombre de un conjuro para leerlo y <b>+</b> para elegirlo.</p>`;
    html += sec('Conjuros', h);
  }
  return { titulo: 'Subir de nivel', atras: '#/hoja/' + id, html, sinNav: true, pie: `<a class="btn secundario" href="#/hoja/${id}">Cancelar</a><button class="btn ok" data-a="suConfirmar">Subir a nivel ${p.n}</button>` };
};
function htmlSuPG(pj) {
  const pg = suPG(pj);
  if (!pg.valida) return `Escribe el resultado del d${pg.dado}.`;
  return `Gana <b>${pg.nivel} PG</b> (${pg.base} ${signo(pg.conDesp)}${pg.base + pg.conDesp < 1 ? ', mínimo 1' : ''}${pg.enano ? ' +1 por Aguante enano' : ''}${pg.drac ? ` +${pg.drac} por Resistencia dracónica` : ''})${pg.retro ? ` y <b>${signo(pg.retro)}</b> más porque su Constitución cambia de modificador en todos sus niveles` : ''}. PG máximos: ${pj.pgMax} → <b>${pj.pgMax + pg.total}</b>.`;
}
A.suSet = el => {
  const s = SU(), r = el.dataset.s ? s.ranuras[el.dataset.s] : s, k = el.dataset.k, v = el.dataset.v;
  r[k] = v;
  if (el.dataset.s) {
    if (k === 'tipo' || k === 'dote') Object.assign(r, { car: null, lista: null, apt: null, T: [], C: [], hab: [], herr: [], ...(k === 'tipo' ? { dote: null, a: null, b: null } : {}) });
    if (k === 'modo') { r.a = r.b = null; }
    if (k === 'a' && r.b === v) r.b = null;
    if (k === 'lista') { r.T = []; r.C = []; }
  }
  guardar(); render();
};
A.suTog = el => {
  const s = SU(), r = el.dataset.s ? s.ranuras[el.dataset.s] : s, lista = (r[el.dataset.k] ||= []), v = el.dataset.v, max = +el.dataset.max;
  const i = lista.indexOf(v);
  if (i >= 0) lista.splice(i, 1);
  else if (lista.length >= max) { toast(`Ya has elegido ${max}. Quita uno primero.`); return; }
  else lista.push(v);
  guardar(); render();
};
A.suHerrPropia = el => {
  const r = SU().ranuras[el.dataset.s], inp = $('#su-herr-' + el.dataset.s), v = (inp && inp.value || '').trim().replace(/\s+/g, ' ');
  if (!v) { toast('Escribe el nombre de la herramienta'); return; }
  if (r.hab.length + r.herr.length >= 3) { toast('Ya tienes 3 entre habilidades y herramientas. Quita una primero.'); return; }
  r.herr.push(v.charAt(0).toUpperCase() + v.slice(1)); guardar(); render();
};
A.suConfirmar = () => {
  const s = SU(), pj = pjPorId(s.pjId); if (!pj) return;
  const falta = suFalta(pj); if (falta) { toast(falta); return; }
  equipoPJ(pj);
  const p = planSubida(pj), pg = suPG(pj), cars = suCaracteristicas(pj), h = pj.hoja, resumen = [], grupos = suGrupos(pj), q = suQ(), tot = suTot(p);
  const antes = Object.fromEntries(CARS_PJ.map(([k]) => [k, pj[k] ?? 10])), caAntes = pj.ca;
  Object.assign(pj, cars);
  pj.nivel = p.n; pj.pgMax = (pj.pgMax || 0) + pg.total;
  resumen.push(`+${pg.total} PG (${s.pgModo === 'tirada' ? 'tirada ' + pg.base : 'valor fijo'})`);
  const subidas = CARS_PJ.filter(([k]) => cars[k] !== antes[k]).map(([k]) => `${CAR_ABR[k]} ${antes[k]}→${cars[k]}`);
  h.dotes ||= []; h.habilidades ||= []; h.herramientas ||= []; h.pericia ||= []; h.idiomas ||= []; h.magia ||= []; pj.conjuros ||= [];
  const ganarDote = (r, origen) => {
    const d = CR.dotes.find(x => x.id === r.dote); if (!d) return;
    h.dotes.push({ id: d.id, nombre: d.nombre + (d.id === 'iniciado-en-la-magia' ? ` (${LISTAS_MAGIA.find(x => x[0] === r.lista)[1].toLowerCase()})` : ''), origen });
    resumen.push('dote ' + d.nombre);
    if (d.id === 'alerta') { pj.alerta = true; pj.iniBC = true; }
    if (d.id === 'iniciado-en-la-magia') { h.magia.push({ origen, lista: r.lista, apt: r.apt, trucos: r.T, conjuros: r.C }); pj.conjuros.push(...r.T, ...r.C); }
    if (d.id === 'habilidoso') { h.habilidades.push(...r.hab); h.herramientas.push(...r.herr); }
  };
  if (p.mejora) { if (s.ranuras.mejora.tipo === 'car') resumen.push('Mejora de característica'); else ganarDote(s.ranuras.mejora, `nivel ${p.n}`); }
  if (p.don) ganarDote(s.ranuras.don, `nivel ${p.n}`);
  if (p.estilo) {
    const r = s.ranuras.estilo;
    if (r.tipo === 'trucos') { pj.conjuros.push(...r.T); resumen.push('2 trucos (' + r.T.map(i => CONJ.get(i).nombre).join(', ') + ')'); }
    else ganarDote(r, `nivel ${p.n}`);
  }
  if (subidas.length) resumen.push(subidas.join(', '));
  if (p.pericia) { h.pericia.push(...s.pericia); resumen.push('pericia en ' + s.pericia.join(' y ')); }
  if (p.idiomas) { h.idiomas.push(...s.idiomas); resumen.push('idiomas ' + s.idiomas.join(' y ')); }
  if (p.subclase) { h.subclase = p.c.subclase.nombre; resumen.push('subclase ' + h.subclase); }
  const nombresC = ids => ids.map(i => (CONJ.get(i) || {}).nombre || i).join(', ');
  // Cambios opcionales: primero se quita lo marcado y luego se añade lo nuevo
  const fuera = [...q.trucos, ...q.conj, ...q.arcanum];
  if (fuera.length) { pj.conjuros = pj.conjuros.filter(i => !fuera.includes(i)); resumen.push('quita ' + nombresC(fuera)); }
  if (q.arcanum.length) h.arcanum = (h.arcanum || []).filter(i => !q.arcanum.includes(i));
  if (q.invoc.length) {
    h.invocaciones ||= []; q.invoc.forEach(x => { const i = h.invocaciones.indexOf(x); if (i >= 0) h.invocaciones.splice(i, 1); }); // las repetibles pueden estar dos veces: se quita una
    resumen.push('quita ' + q.invoc.map(nomInv).join(', '));
    if (q.invoc.includes('pacto-del-grimorio')) { const libro = [...(h.grimorio || []), ...((h.conj || {}).grimT || []), ...((h.conj || {}).grimR || [])]; pj.conjuros = pj.conjuros.filter(i => !libro.includes(i)); h.grimorio = []; if (h.conj) { h.conj.grimT = []; h.conj.grimR = []; } }
  }
  if (q.meta.length) { h.metamagia = (h.metamagia || []).filter(i => !q.meta.includes(i)); resumen.push('quita ' + q.meta.map(nomMeta).join(', ')); }
  if (q.maestria.length) { h.maestria = (h.maestria || []).filter(i => !q.maestria.includes(i)); resumen.push('quita maestría con ' + q.maestria.join(', ')); }
  if (q.estilo.length) {
    const i = h.dotes.findIndex(d => d.id === q.estilo[0]), viejo = h.dotes[i], nueva = CR.dotes.find(x => x.id === s.nEstilo[0]);
    if (i >= 0) h.dotes.splice(i, 1, { id: nueva.id, nombre: nueva.nombre, origen: viejo.origen });
    resumen.push(`cambia ${viejo ? viejo.nombre : 'estilo'} por ${nueva.nombre}`);
  }
  if (tot.maestria) { h.maestria = [...(h.maestria || []), ...s.nMaestria]; resumen.push('maestría con ' + s.nMaestria.join(', ')); }
  if (tot.invoc) { h.invocaciones = [...(h.invocaciones || []), ...s.nInvoc]; resumen.push('invocaciones: ' + s.nInvoc.map(nomInv).join(', ')); }
  if (p.habExtra) { h.habilidades.push(...s.nHab); resumen.push('competencia en ' + s.nHab.join(', ')); }
  if (p.terreno) { h.terreno = s.terreno; resumen.push('terreno ' + TERRENOS_DRUIDA[s.terreno].nombre.toLowerCase()); }
  if (tot.meta) { h.metamagia = [...(h.metamagia || []), ...s.nMeta]; resumen.push('metamagia: ' + s.nMeta.map(i => (CR.metamagia.find(m => m.id === i) || {}).nombre || i).join(', ')); }
  const nuevosConj = grupos.filter(g => !g.libro).flatMap(g => g.elegidos);
  if (nuevosConj.length) { pj.conjuros.push(...nuevosConj); resumen.push('conjuros: ' + nombresC(nuevosConj)); }
  const de = k => (grupos.find(g => g.k === k) || {}).elegidos || [];
  if (p.arcanum || q.arcanum.length) h.arcanum = [...(h.arcanum || []), ...de('nArc'), ...de('cArc')];
  if (de('grimT').length || de('grimR').length) h.grimorio = [...(h.grimorio || []), ...de('grimT'), ...de('grimR')];
  if (p.descub) h.conjSiempre = [...(h.conjSiempre || []), ...de('nDesc')];
  if (de('mc1').length || de('mc2').length) { h.maestriaConj = [...de('mc1'), ...de('mc2')]; resumen.push('maestría sobre ' + nombresC(h.maestriaConj)); }
  if (de('car3').length) { h.caracteristicos = de('car3'); resumen.push('conjuros característicos: ' + nombresC(h.caracteristicos)); }
  if (p.auto.length) { const ids = p.auto.map(a => a.id); pj.conjuros.push(...ids); h.conjSiempre = [...new Set([...(h.conjSiempre || []), ...ids])]; resumen.push('siempre preparados: ' + nombresC(ids)); }
  // CA con lo que lleva puesto, ya con las características, el nivel y las dotes nuevas
  pj.ca = caPJ(pj).total;
  if (pj.ca !== caAntes) resumen.push(`CA ${caAntes} → ${pj.ca}`);
  const nuevos = p.rasgos.map(r => r.nombre).filter(x => !/^Mejora de característica$|^Don épico$/.test(x));
  if (nuevos.length) resumen.push('rasgos: ' + nuevos.join(', '));
  h.niveles ||= []; h.niveles.push({ nivel: p.n, resumen: resumen.join(' · '), fecha: Date.now() });
  pj.conjuros = [...new Set(pj.conjuros)];
  pj.pasiva = pasivaPJ(pj);
  E.subidaPJ = null;
  ['ca', 'nivel', 'pgMax'].forEach(k => sincronizarPJ(pj, k));
  A.rellenarEspacios({ dataset: { pj: pj.id } });
  navegar('#/hoja/' + pj.id);
  setTimeout(() => toast(`${pj.nombre} sube a nivel ${p.n}`), 60);
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
// Creador de personajes: textos y tiradas (sin repintar, para no perder el foco)
I.wz = el => { WZ()[el.dataset.k] = el.value; guardar(); };
I.suPG = el => { const s = E.subidaPJ; if (!s) return; s.pgTirada = el.value.trim(); guardar(); const pj = pjPorId(s.pjId), t = $('#su-pg'); if (t && pj) t.innerHTML = htmlSuPG(pj); };
I.wzTirada = el => {
  WZ().tiradas[+el.dataset.n] = el.value.trim(); guardar();
  const c = $('#wz-calc'); if (c) c.innerHTML = htmlWzCalculo();
};
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
  const c = $('#pj-calc'); if (c) c.textContent = `Bonificador por competencia ${signo(bcDeNivel(pj.nivel))} (por su nivel)`;
  const md = $(`[data-mod="${k}"]`); if (md) md.textContent = pj[k] != null ? signo(modDe(pj[k])) : '—';
  const sv = $('#pj-salv'); if (sv) sv.innerHTML = htmlSalvPJ(pj);
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
// Hoja: armadura, escudo y bonos a la CA. La CA se recalcula y pasa a los encuentros.
function cambiarEquipo(el, fn) {
  const pj = pjPorId(el.dataset.id); if (!pj || !pj.hoja) return;
  equipoPJ(pj); const antes = pj.ca;
  fn(pj.hoja, el);
  pj.ca = caPJ(pj).total; sincronizarPJ(pj, 'ca'); guardar(); render();
  if (pj.ca !== antes) toast(`CA ${antes} → ${pj.ca}`);
}
C.hojaArmadura = el => cambiarEquipo(el, (h, x) => { h.armadura = x.value || null; if (h.armadura) h.armaduraMago = false; });
C.hojaEscudo = el => cambiarEquipo(el, (h, x) => { h.escudo = x.checked; });
C.hojaMago = el => cambiarEquipo(el, (h, x) => { h.armaduraMago = x.checked; });
C.hojaCAExtra = el => cambiarEquipo(el, (h, x) => { h.caExtra = Math.max(-10, Math.min(10, parseInt(x.value, 10) || 0)); });
I.hojaEquipo = el => { const pj = pjPorId(el.dataset.id); if (pj && pj.hoja) { pj.hoja.equipoActual = el.value; guardar(); } };
C.feOrigen = () => { const h = hojaActual(); if (h) proponerVinculo(h); };
C.feVinc = () => { const h = hojaActual(); if (h) h.vincManual = true; };
C.pjchk = el => {
  const pj = pjPorId(ruta().id); if (!pj) return;
  const k = el.dataset.k;
  pj[k] = el.checked;
  // La dote Alerta suma el bonificador por competencia a la iniciativa: van siempre juntos
  if (k === 'alerta') { pj.iniBC = el.checked; sincronizarPJ(pj, 'iniBC'); }
  guardar();
  const r = $('#pj-ini'); if (r) r.textContent = resumenIniPJ(pj);
  sincronizarPJ(pj, k);
};
// Al terminar de escribir un campo del perfil (al salir de la casilla)
C.pjSync = el => {
  const pj = pjPorId(ruta().id); if (!pj) return;
  const k = el.dataset.k;
  if (k === 'nivel') el.value = pj.nivel ?? '';
  // Al escribir la clase, que aparezca (o desaparezca) el botón de rellenar según la clase
  if (k === 'clase') {
    // Si aún no tiene salvaciones marcadas, se ponen las de su clase
    const s = salvacionesDeClase(pj.clase, pj.nivel || 1);
    if (s && !(pj.salvComp || []).length) { pj.salvComp = s; guardar(); }
    sincronizarPJ(pj, k); refrescar(); return;
  }
  // Características: entre 1 y 30 (SRD)
  if (CARS_PJ.some(([c]) => c === k) && pj[k] != null) {
    pj[k] = Math.max(1, Math.min(30, pj[k])); el.value = pj[k]; guardar();
    const md = $(`[data-mod="${k}"]`); if (md) md.textContent = signo(modDe(pj[k]));
  }
  // Personajes con hoja completa: la CA sale de su armadura. Si cambia una característica, se recalcula;
  // si se escribe la CA a mano, la diferencia se guarda como «otros bonos a la CA».
  if (pj.hoja && clasePJ(pj)) {
    equipoPJ(pj);
    if (k === 'ca' && pj.ca != null) { pj.hoja.caExtra = (pj.hoja.caExtra || 0) + pj.ca - caPJ(pj).total; guardar(); }
    else if (CARS_PJ.some(([c]) => c === k)) {
      const nueva = caPJ(pj).total;
      if (nueva !== pj.ca) { const antes = pj.ca; pj.ca = nueva; guardar(); const f = $('[data-k="ca"]'); if (f) f.value = nueva; sincronizarPJ(pj, 'ca'); toast(`CA ${antes} → ${nueva}`); }
    }
  }
  // La Inspiración bárdica cambia sola con el Carisma
  if (k === 'car') {
    const r = (pj.recursos || []).find(x => x.clave === 'inspiracion-bardica');
    if (r) { const d = defRecurso(r); r.max = d.max(pj.nivel || 1, pj); r.usados = Math.min(r.usados || 0, r.max); guardar(); refrescar(); toast(`Inspiración bárdica: ${r.max} uso${r.max === 1 ? '' : 's'} (Carisma ${signo(modDe(pj.car))})`); }
  }
  sincronizarPJ(pj, k);
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
