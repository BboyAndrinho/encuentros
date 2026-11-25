'use strict';
// Textos de rasgos, dotes y especie para la hoja en PDF: solo lo que sirve para jugar y solo hasta el nivel del personaje.
// No se inventa nada: se quitan frases del SRD (subidas de nivel, tablas, recomendaciones, ejemplos…) y se pone el valor que toca a su nivel.
// textoCorto(html, { nombre, tipo, clase, n, pj }) → html (vacío si no queda nada útil)
(function () {
  const NUM = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];
  const plano = h => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

  // ---------- Frases que nunca hacen falta en la hoja ----------
  const FUERA = [
    /^Se recomiendan? /, /^Por ejemplo, /, /^Consulta (el|la|las|los) /,
    /La información presentada a continuación/, /que encontrarás más adelante|se detallan? (más adelante|tras)/,
    /cada vez que subas un nivel|Siempre que subas un nivel|conforme (subes|subas) de nivel|En niveles superiores/i,
    /^Cuando (alcances|alcanzas) /, /cuando (alcances|alcanzas) (ciertos niveles|determinados niveles|los niveles|el nivel)/,
    /^Obtienes (usos|un uso) adicional/, /aumenta según alcanzas/, /no cuentan para el total que puedes preparar/
  ];
  // ---------- Frases que se quitan en cada rasgo (además de las de arriba) ----------
  const QUITA = {
    'Furia': [/^Puedes imbuirte de un poder/],
    'Ataque temerario': [/^Puedes abandonar por completo/],
    'Sentir el peligro': [/^Eres capaz de percibir/, /^Gracias a ello/],
    'Conocimiento primigenio': [/^Cuando utilizas esta capacidad/, /^Ganas competencia en otra habilidad/],
    'Furia implacable': [/^Tu furia te permite seguir/],
    'Golpe brutal mejorado': [/^Has perfeccionado/],
    'Campeón primordial': [/^Encarnas/],
    'Inspiración bárdica': [/^Puedes recurrir a tus palabras/, /^A niveles superiores/, /^El dado se convierte/, /^Tu dado de inspiración bárdica cambia/],
    'Aprendiz de mucho': [],
    'Contraencantamiento': [/^Puedes emplear notas/],
    'Secretos mágicos': [/^Has aprendido secretos/, /^Cada vez que alcances/, /^Además, cuando sustituyas/],
    'Palabras de creación': [/^Ahora dominas/],
    'Palabras cortantes': [/^Aprendes a usar tu astucia/],
    'Descubrimientos mágicos': [/^Estos conjuros pueden proceder/, /^Los conjuros que elijas/],
    'Contactar patrón': [/^Antes solías/],
    'Arcanum místico': [/^Tu patrón te recompensa/, /^Escoge uno de los conjuros/, /^Obtendrás más conjuros/, /^Recuperas todos los usos de tu Arcanum/],
    'Conjuros del infernal': [/^Cuando alcances/], 'Conjuros del dominio de la vida': [/^Cuando alcances/], 'Conjuros del juramento de entrega': [/^Cuando alcances/], 'Conjuros dracónicos': [],
    'La suerte del oscuro': [/^Puedes invocar a tu patrón/],
    'Canalizar divinidad': [/^Empiezas con/, /^Otros rasgos de paladín/, /^Puedes canalizar energía divina/],
    'Golpes benditos': [/^Te imbuyes de poder/],
    'Orden divina': [/^Te has consagrado/], 'Orden primigenia': [/^Te has consagrado/],
    'Intercesión divina': [/^Puedes recurrir a tu deidad/], 'Intercesión divina mayor': [/^Puedes solicitar/],
    'Druídico': [/^Mientras aprendías/],
    'Compañero salvaje': [/^Puedes invocar un espíritu/],
    'Forma salvaje': [/^El poder de la naturaleza/, /^Al escoger las formas/, /^Además, a partir del nivel 8/, /^El equipo que lleves puesto/, /^Tu equipo no cambia/],
    'Furia elemental': [/^El poder de los elementos/],
    'Archidruida': [/^La vitalidad de la naturaleza/],
    'Estilo de combate': [/^Obtienes una dote/, /^En lugar de elegir/, /^Has pulido/],
    'Fuente de inspiración': [/^Ahora recuperas/],
    'El cazador y la presa': [/^Tu tenacidad puede/],
    'Sabiduría del cazador': [/^Puedes invocar a las fuerzas/],
    'Velo de la naturaleza': [/^Invocas espíritus/],
    'Infatigable': [/^Las fuerzas primigenias/],
    'Tomar aliento': [/^Posees una pequeña reserva/],
    'Acción súbita': [/^Puedes superar tus límites/],
    'Mente táctica': [/^Tienes facilidad/],
    'Ataques estudiados': [/^Estudias a tus adversarios/],
    'Guerrero heroico': [/^La emoción de la batalla/],
    'Superviviente': [/^Alcanzas la cumbre/],
    'Hechicería innata': [/^Un suceso de tu pasado/],
    'Fuente de magia': [/^Puedes acceder a una abundante/, /^Esta fuente se representa/, /^No puedes tener más puntos/],
    'Metamagia': [/^Como la magia fluye/, /^Consigues dos de las opciones/, /^Usarás las opciones/, /^Obtienes dos opciones más/],
    'Afinidad elemental': [/^Tu magia dracónica tiene/],
    'Resistencia dracónica': [/^La magia de tu cuerpo/, /^Además, partes de tu cuerpo/],
    'Académico': [/^Mientras estudiabas/],
    'Recuperación arcana': [/^Puedes recuperar parte/],
    'Maestría sobre conjuros': [/^Has alcanzado tal/],
    'Experto en evocación': [/^Además, siempre que consigas/, /^El conjuro elegido debe/],
    'Truco potente': [/^Tus trucos que causen daño pueden/],
    'Esculpir conjuros': [/^Puedes crear espacios/],
    'Sobrecanalizar': [/^Puedes aumentar el poder/],
    'Artes marciales': [/^Este dado cambia/],
    'Concentración de monje': [/^Tu concentración y tu entrenamiento/, /^Esta energía se representa/, /^Puedes gastar estos puntos/, /^Empiezas con tres/],
    'Movimiento sin armadura': [/^Esta bonificación aumenta/],
    'Superviviente disciplinado': [], 'Cuerpo y mente': [/^Has llevado/],
    'Plenitud de cuerpo': [/^Obtienes la capacidad/], 'Palma estremecedora': [/^Consigues la capacidad/],
    'Imponer las manos': [/^Tu toque bendito/], 'Corcel fiel': [/^Puedes invocar/], 'Golpes radiantes': [/^Ahora, tus golpes/], 'Castigo protector': [/^Tu castigo mágico/],
    'Conjuros del círculo de la tierra': [/^Consulta/],
    'Ataque furtivo': [/^Sabes cómo atacar/, /^El daño adicional aumenta/],
    'Jerga de ladrones': [/^Has aprendido/],
    'Pericia': [/^En el nivel \d+ de/],
    'Acción astuta': [/^Tu agilidad mental/],
    'Golpe astuto': [/^Has desarrollado/], 'Evasión': [/^Puedes esquivar con agilidad/], 'Golpes taimados': [/^Has practicado/], 'Mente escurridiza': [/^Tu mente astuta/], 'Elusivo': [/^Eres tan escurridizo/], 'Golpe de suerte': [/^Has desarrollado/],
    'Balconero': [/^Te has entrenado/], 'Usar objetos mágicos': [/^Has aprendido a sacarles/], 'Reflejos de ladrón': [/^Eres experto/],
    // Dotes
    'Atacante salvaje': [/^Te has preparado/], 'Iniciado en la magia': [/^Tu aptitud mágica para/],
    // Invocaciones
    'Lecciones de los primeros': [],
    // Especies
    'Linaje dracónico': [/^Tu linaje proviene/, /^Elige el tipo/, /^Tu elección afectará/], 'Linaje gigante': [/^Desciendes/], 'Linaje gnomo': []
  };
  // ---------- Apartados enteros que se quitan («Repetible. …») ----------
  const APARTADOS = /^(Repetible|Cambiar conjuro|Mejora de característica|Requisitos|Sustituir y conseguir invocaciones)\./;
  // Rasgos que no aportan nada en la hoja (lo que dan ya sale en otro sitio)
  const SOBRAN = new Set(['Invocaciones sobrenaturales', 'Secretos mágicos', 'Experto en evocación', 'Competencias adicionales', 'Estilo de combate adicional', 'Pericia', 'Explorador hábil', 'Académico']);
  // Rasgos que sustituye otro mejor
  const MEJOR = { 'Ataque adicional': ['Dos ataques adicionales', 'Tres ataques adicionales'], 'Dos ataques adicionales': ['Tres ataques adicionales'], 'Crítico mejorado': ['Crítico superior'] };

  // ---------- Valores a su nivel: (texto, nivel, pj) → texto ----------
  const por = (n, tramos) => { let v; for (const [nv, x] of tramos) if (n >= nv) v = x; return v; };
  const VALOR = {
    'Furia': (t, n) => t.replace(/tantas veces como se indica para tu nivel de bárbaro en la columna “N\.º de furias” de la tabla “Rasgos de bárbaro”/, veces(FURIAS[n])).replace(/obtienes un bonificador al daño que aumenta conforme subes de nivel de bárbaro, como se muestra en la columna “Daño por furia” de la tabla “Rasgos de bárbaro”/, `obtienes un bonificador de +${por(n, [[1, 2], [9, 3], [16, 4]])} al daño`),
    'Frenesí': (t, n) => t.replace('una cantidad de d6 igual a tu bonificación de daño por furia y suma los resultados', `${por(n, [[1, 2], [9, 3], [16, 4]])}d6`),
    'Inspiración bárdica': (t, n) => t.replace('que es un d6', 'que es un d' + por(n, [[1, 6], [5, 8], [10, 10], [15, 12]])).replace('tras finalizar un descanso largo', n >= 5 ? 'tras finalizar un descanso corto o largo' : 'tras finalizar un descanso largo'),
    'Canalizar divinidad': (t, n, c) => t.replace('Canalizar divinidad dos veces', 'Canalizar divinidad ' + veces(c === 'clerigo' ? por(n, [[2, 2], [6, 3], [18, 4]]) : por(n, [[3, 2], [11, 3]]))).replace('Tira 1d8 y suma', `Tira ${por(n, [[2, 1], [7, 2], [13, 3], [18, 4]])}d8 y suma`),
    'Golpes benditos': (t, n) => n >= 14 ? t.replace('sufra 1d8 de daño', 'sufra 2d8 de daño') : t,
    'Golpes benditos mejorados': t => t.replace(/El daño adicional de tu Golpe divino aumenta a 2d8\./, 'El daño adicional de tu Golpe divino es 2d8.'),
    'Furia elemental': (t, n) => n >= 15 ? t.replace('sufra 1d8 de daño', 'sufra 2d8 de daño') : t,
    'Forma salvaje': (t, n) => t.replace('Forma salvaje dos veces', 'Forma salvaje ' + veces(por(n, [[2, 2], [6, 3], [17, 4]]))).replace('Conoces cuatro formas', `Conoces ${NUM[por(n, [[2, 4], [4, 6], [8, 8]])]} formas`).replace('máximo de 1/4', 'máximo de ' + por(n, [[2, '1/4'], [4, '1/2'], [8, '1']])).replace(' y que no tengan una velocidad volando', n >= 8 ? '' : ' y que no tengan una velocidad volando').replace(' (consulta “Formas conocidas” a continuación)', ''),
    'Ayuda de la tierra': (t, n) => t.replace(/2d6/g, por(n, [[3, 2], [10, 3], [14, 4]]) + 'd6'),
    'Enemigo predilecto': (t, n) => t.replace('lanzarlo dos veces', 'lanzarlo ' + veces(ENEMIGO_PREDILECTO[n])),
    'Tomar aliento': (t, n) => t.replace('este rasgo dos veces', 'este rasgo ' + veces(por(n, [[1, 2], [4, 3], [10, 4]]))),
    'Acción súbita': (t, n) => n >= 17 ? t.replace(/Cuando uses este rasgo, no podrás volver a hacerlo hasta que finalices un descanso corto o largo\. A partir del nivel 17, podrás usarlo dos veces antes de descansar/, 'Puedes usar este rasgo dos veces antes de finalizar un descanso corto o largo') : t.replace(/ ?A partir del nivel 17[^.]*\./, ''),
    'Indómito': (t, n) => t.replace(/Puedes usar este rasgo dos veces entre[^.]*\./, '').replace(' y no podrás volver a utilizar este rasgo hasta que finalices un descanso largo', n >= 13 ? `. Puedes usar este rasgo ${n >= 17 ? 'tres' : 'dos'} veces entre descansos largos` : ' y no podrás volver a utilizar este rasgo hasta que finalices un descanso largo'),
    'Fuente de magia': (t, n) => t.replace(/Posees 2 puntos de hechicería, pero[^.]*\./, `Posees ${n} puntos de hechicería.`).replace(' La tabla “Crear espacios de conjuro” indica el coste de crear un espacio de conjuro de un nivel determinado y el nivel mínimo de hechicero que debes tener para crear un espacio. Puedes crear espacios de conjuro de nivel 5 como máximo.', ''),
    'Resistencia dracónica': (t, n) => t.replace('aumentan en 3 y en 1 más por cada nivel de hechicero que subas en el futuro', `aumentan en ${n} (ya está sumado)`),
    'Aguante enano': (t, n) => t.replace('se incrementan en 1 y aumentarán en 1 más cada vez que subas un nivel', `se incrementan en ${n} (ya está sumado)`),
    'Artes marciales': (t, n) => t.replace('tirar 1d6', 'tirar 1d' + por(n, [[1, 6], [5, 8], [11, 10], [17, 12]])),
    'Concentración de monje': (t, n) => t.replace(/Tu nivel de monje determina cuántos[^.]*\./, `Posees ${n} puntos de concentración.`).replace('Ráfaga de golpes y hacer', 'Ráfaga de golpes y hacer'),
    'Movimiento sin armadura': (t, n) => t.replace('aumenta en 3 m', `aumenta en ${String(TABLA('monje', 'movimiento', n)).replace('.', ',')} m`),
    'Ataque furtivo': (t, n) => t.replace('infligir 1d6 de daño', `infligir ${Math.ceil(n / 2)}d6 de daño`),
    'Aura de protección': (t, n) => n >= 18 ? t.replace('emanación de 3 m', 'emanación de 9 m') : t,
    'Golpe brutal': (t, n) => n >= 17 ? t.replace('1d10 de daño adicional', '2d10 de daño adicional') : t,
    'Golpe brutal mejorado': (t, n) => t,
    'Ataque de aliento': (t, n) => t.replace('sufrirán 1d10 de daño', `sufrirán ${por(n, [[1, 1], [5, 2], [11, 3], [17, 4]])}d10 de daño`).replace(/ ?El daño aumenta en 1d10 cuando[^.]*\./, ''),
    'Vuelo dracónico': t => t.replace('Cuando alcanzas el nivel 5 de personaje, puedes', 'Puedes'),
    'Forma grande': t => t.replace('A partir del nivel 5 de personaje, puedes', 'Puedes'),
    'Secretos mágicos': t => t.replace(/ \(consulta[^)]*\)/, ''),
    'Jerga de ladrones': t => t.replace(/ de las tablas de idiomas del capítulo “[^”]*”/, '')
  };
  const veces = k => `${NUM[k] || k} ${k === 1 ? 'vez' : 'veces'}`;
  const MAESTRIA_N = (t, k) => t.replace(/con (dos|tres) tipos de armas/, `con ${k === 2 ? 'dos' : NUM[k] || k} tipos de armas`);

  // ---------- Lanzamiento de conjuros (y Magia del pacto): solo lo que no cambia al subir ----------
  function lanzamiento(html, n, clase) {
    const ps = html.match(/<p[^>]*>[\s\S]*?<\/p>/g) || [], de = re => ps.find(p => re.test(plano(p))), out = [];
    const esp = de(/^Espacios de conjuro\./); if (esp) { const f = plano(esp).match(/Recuperas todos los espacios[^.]*\./); if (f) out.push(`<p><strong>Espacios de conjuro. </strong>${f[0]}</p>`); }
    if (clase === 'mago') {
      const lib = de(/^El libro contiene los conjuros/); if (lib) out.push(`<p><strong>Libro de conjuros. </strong>${plano(lib).match(/^[^.]*\./)[0]}</p>`);
      const tr = de(/^Trucos\./); if (tr) { const f = plano(tr).match(/Tras finalizar un descanso largo, puedes sustituir[^.]*\./); if (f) out.push(`<p><strong>Cambiar un truco. </strong>${f[0]}</p>`); }
    }
    const cam = de(/^Cambiar los conjuros preparados\./); if (cam && !/subas un nivel/.test(plano(cam))) out.push(cam);
    const apt = de(/^Aptitud mágica\./); if (apt) out.push(apt);
    const can = de(/^Canalizador mágico\./); if (can) out.push(can);
    if (clase === 'mago') { const cop = de(/^Copiar un conjuro en tu libro\./); if (cop) out.push(cop); }
    return out.join('');
  }
  // Tablas: solo las filas hasta su nivel (primera columna: nivel de la clase)
  function tablaHasta(html, n, col) {
    return html.replace(/<tr>(?:(?!<\/tr>)[\s\S])*<\/tr>/g, tr => { const c = [...tr.matchAll(/<td>([\s\S]*?)<\/td>/g)].map(x => x[1]); const v = parseInt(c[col], 10); return c.length && v > n ? '' : tr; });
  }
  const frases = t => t.split(/(?<=[a-záéíóúñ0-9»)”>][.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿«“<])/);
  const mayus = t => t.replace(/^((?:<[^>]+>)*)([a-záéíóúñ])/, (m, a, b) => a + b.toUpperCase());

  function textoCorto(html, { nombre, tipo, clase, n = 1, pj } = {}) {
    const h = (pj && pj.hoja) || {}; html = String(html || '');
    if (tipo === 'clase') {
      if (SOBRAN.has(nombre)) return '';
      if (/^(Lanzamiento de conjuros|Magia del pacto)$/.test(nombre)) return lanzamiento(html, n, clase);
      if (nombre === 'Conjuros del círculo de la tierra') return ''; // la lista sale en «Elegido» y en la página de conjuros
      if (nombre === 'Estilo de combate' && (h.dotes || []).some(d => (CR.dotes.find(x => x.id === d.id) || {}).categoria === 'estilo-de-combate')) return ''; // la dote elegida se explica en Dotes
      if (nombre === 'Fuente de magia') html = tablaHasta(html, n, 2);
      else if (/^Conjuros (del|dracónicos)/.test(nombre)) html = html.replace(/<table[\s\S]*?<\/table>/g, '');
      if (nombre === 'Forma salvaje') html = html.replace(/<p[^>]*>(?:<strong>)?Formas de bestia(?:<\/strong>)?<\/p>/, '').replace(/<table[\s\S]*?<\/table>/g, '');
    }
    if (tipo === 'especie' && /^(Vuelo dracónico|Forma grande)$/.test(nombre) && n < 5) return null;
    html = html.replace(/ ?<\/(strong|em)>\(consulta[^)]*\)/gi, '</$1>');
    const val = VALOR[nombre], quita = QUITA[nombre] || [];
    const tr = s => { let t = s.replace(/ ?\(consulta[^)]*\)/gi, '').replace(/,? como se (?:muestra|indica|detalla) (?:en (?:la|las) (?:columna|tabla) “[^”]*”(?: de la tabla “[^”]*”)?|a continuación)/g, ''); if (val) t = val(t, n, clase) || ''; if (nombre === 'Maestría con armas' && clase) t = MAESTRIA_N(t.replace(/, como (?:arcos|dagas|espadas|las hachas)[^.]*(?=.)/, ''), TABLA(clase, 'maestria', n) || 2); return t; };
    let quitar = false, primero = true;
    html = html.replace(/<p[^>]*>([\s\S]*?)<\/p>|<li>([\s\S]*?)<\/li>/g, (todo, p, li) => {
      if (li !== undefined) return `<li>${tr(li)}</li>`;
      const texto = plano(p);
      if (/^<strong>/.test(p.trim())) quitar = APARTADOS.test(texto);
      if (quitar && APARTADOS.test(texto)) { quitar = false; return ''; }
      // El subtítulo en negrita se conserva si queda algo detrás
      const m = p.match(/^\s*(<strong>[\s\S]*?<\/strong>)\s*([\s\S]*)$/), cab = m ? m[1] : '', resto = tr(m ? m[2] : p);
      if (m && !plano(resto)) return /:|Conjuros|Protección|Crear/.test(plano(cab)) && /<table/.test(html) ? todo : '';
      const q = frases(resto).filter(f => { const t = plano(f); return t && !FUERA.some(r => r.test(t)) && !quita.some(r => r.test(t)); });
      // Si lo anterior se ha quitado, sobra el «Además,» o «Por tanto,» del principio
      if (q.length && primero && !cab) q[0] = mayus(q[0].replace(/^(Además|Por tanto|Asimismo), /, ''));
      if (q.length) primero = false;
      return q.length ? `<p>${cab ? cab.replace(/<\/strong>$/, ' </strong>') : ''}${q.join(' ')}</p>` : '';
    });
    return html.trim();
  }
  // Conjuros y rasgos del linaje hasta su nivel
  function linajeCorto(o, n) {
    if (!o || !o.nivel1) return null;
    const l = [n >= 3 && o.nivel3, n >= 5 && o.nivel5].filter(Boolean);
    return `<p>${o.nivel1}</p>` + (l.length ? `<p>Siempre tienes preparado${l.length > 1 ? 's' : ''} ${l.map(x => `<em>${x.toLowerCase()}</em>`).join(' y ')}. Puedes lanzar${l.length > 1 ? ' cada uno' : 'lo'} una vez sin gastar un espacio de conjuro y recuperas la capacidad de hacerlo de esta forma tras finalizar un descanso largo. También puedes lanzar${l.length > 1 ? 'los' : 'lo'} usando cualquier espacio de conjuro que tengas del nivel apropiado.</p>` : '');
  }
  const superado = (nombre, todos) => (MEJOR[nombre] || []).some(x => todos.includes(x));
  window.HOJA_TXT = { textoCorto, linajeCorto, superado };
})();
