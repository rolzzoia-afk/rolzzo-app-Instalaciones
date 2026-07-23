/* Verifica que toda función o variable que el HTML (index.html) referencia
   directamente en un atributo on* (onclick, onchange, oninput, ondrop, etc.)
   esté realmente expuesta en window a través de src/modules/expose-globals.js.

   Por qué existe: ESLint (no-undef) revisa que los módulos JS no se llamen
   entre sí a funciones inexistentes, pero NO revisa el HTML — un atributo
   onclick="miFuncion()" corre en el scope global del navegador, no dentro de
   ningún módulo ES, así que si "miFuncion" no quedó en window.*, el clic
   tira un error silencioso y no pasa nada (exactamente el bug del botón de
   adjuntar en Registro, julio 2026).

   Uso: node scripts/check-window-exposure.js   (o "npm run check:globals")
   Sale con código 1 si encuentra algo sin exponer, para poder usarse también
   como paso de verificación antes de subir cambios. */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');

const root = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const modulesDir = path.join(root, 'src', 'modules');

// 1) Todos los símbolos (funciones y variables) que existen en algún módulo.
const knownSymbols = new Set();
for (const f of fs.readdirSync(modulesDir)) {
  const src = fs.readFileSync(path.join(modulesDir, f), 'utf8');
  let m;
  const reFn = /export\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  while ((m = reFn.exec(src))) knownSymbols.add(m[1]);
  const reVar = /export\s+(?:let|const)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  while ((m = reVar.exec(src))) knownSymbols.add(m[1]);
}

// 2) Todo lo que expose-globals.js ya deja en window.*
const exposeSrc = fs.readFileSync(path.join(modulesDir, 'expose-globals.js'), 'utf8');
const exposed = new Set((exposeSrc.match(/window\.[A-Za-z_][A-Za-z0-9_]*/g) || []).map(s => s.replace('window.', '')));

// 3) Cada atributo on*="..." del HTML, parseado como JS real (no con regex ingenuo).
const handlerAttrs = indexHtml.match(/\bon[a-z]+="[^"]*"/g) || [];
const jsKeywords = new Set(['true', 'false', 'null', 'undefined', 'this', 'event', 'new', 'typeof', 'void', 'in', 'of', 'instanceof']);
const domGlobals = new Set(['document', 'window', 'console', 'alert', 'confirm', 'prompt', 'navigator', 'localStorage', 'Date', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'parseInt', 'parseFloat', 'isNaN']);

const missing = new Map(); // nombre -> ejemplos
let parseErrors = 0;

for (const attr of handlerAttrs) {
  const m = attr.match(/^on[a-z]+="(.*)"$/);
  if (!m) continue;
  let code = m[1].replace(/\\'/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  let ast;
  try {
    ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'script' });
  } catch (e) {
    parseErrors++;
    continue;
  }
  walk.ancestor(ast, {
    Identifier(node, state, ancestors) {
      const parent = ancestors[ancestors.length - 2];
      if (parent && parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return;
      if (parent && (parent.type === 'FunctionDeclaration' || parent.type === 'FunctionExpression') && parent.params.includes(node)) return;
      if (parent && parent.type === 'VariableDeclarator' && parent.id === node) return;
      const name = node.name;
      if (jsKeywords.has(name) || domGlobals.has(name)) return;
      if (exposed.has(name)) return;
      if (!knownSymbols.has(name)) return; // no es un símbolo nuestro (prop de DOM, fragmento de string, etc.)
      if (!missing.has(name)) missing.set(name, []);
      if (missing.get(name).length < 2) missing.get(name).push(code.slice(0, 90));
    },
  });
}

if (missing.size === 0) {
  console.log(`OK: ${handlerAttrs.length} atributos on* revisados (${parseErrors} no se pudieron parsear), todo lo referenciado está expuesto en window.`);
  process.exit(0);
}

console.error(`Faltan ${missing.size} símbolo(s) por exponer en src/modules/expose-globals.js:\n`);
for (const [name, examples] of missing) {
  console.error(`- ${name}`);
  examples.forEach((e) => console.error('    ej:', e));
}
console.error('\nArregla agregando el import + "window.' + '<nombre> = <nombre>;" en expose-globals.js');
process.exit(1);
