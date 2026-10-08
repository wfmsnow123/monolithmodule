/**
 * Monolith: Reach
 * Players can only interact with doors, Monk's Active Tiles click triggers and Light Switch toggles
 * when one of their tokens is within reach (default 5 ft, any direction including diagonals).
 * Idea for the "interact with nearest door" key inspired by Arms Reach (p4535992, MIT).
 */
const ID = "monolith-reach";
const CLIQUES = new Set(["click", "dblclick", "rightclick", "dblrightclick"]);
let ultimoAviso = 0;

const cfg = (k) => game.settings.get(ID, k);

Hooks.once("init", () => {
  const reg = (key, data) => game.settings.register(ID, key, { scope: "world", config: true, ...data });
  reg("alcance", { name: "Alcance (na unidade da cena)", hint: "Distância máxima entre a borda do token e o objeto. 5 = um quadrado em qualquer direção, incluindo diagonais.", type: Number, default: 5 });
  reg("portas", { name: "Aplicar a portas", type: Boolean, default: true });
  reg("tiles", { name: "Aplicar a tiles clicáveis (Monk's Active Tiles)", type: Boolean, default: true });
  reg("interruptores", { name: "Aplicar a interruptores (Light Switch)", type: Boolean, default: true });
  reg("semToken", { name: "Permitir interação sem token na cena", hint: "Desligado: quem não tem token na cena não abre portas nem aciona nada.", type: Boolean, default: false });
  reg("aviso", { name: "Avisar quando estiver longe", type: Boolean, default: true });

  game.keybindings.register(ID, "abrirPorta", {
    name: "Interagir com a porta mais próxima",
    hint: "Abre ou fecha a porta mais próxima ao alcance do token selecionado.",
    editable: [{ key: "KeyE" }],
    onDown: () => { interagirPortaProxima(); return true; }
  });
});

/* ---------- Geometria ---------- */

function tokensDoJogador() {
  const cena = canvas.scene;
  if (!cena) return [];
  const controlados = canvas.tokens.controlled.filter((t) => t.document.isOwner);
  if (controlados.length) return controlados;
  const ch = game.user.character;
  return ch ? ch.getActiveTokens(false, false).filter((t) => t.document.parent === cena) : [];
}

/** Retângulo do token expandido pelo alcance, em pixels. */
function areaDeAlcance(token) {
  const d = canvas.dimensions;
  const px = (cfg("alcance") / d.distance) * d.size;
  const { x, y, width, height } = token.bounds;
  // Pequena folga para não falhar em bordas exatas.
  const e = px + 1;
  return { x: x - e, y: y - e, w: width + 2 * e, h: height + 2 * e };
}

function pontoNoRetangulo(p, r) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

function segmentosCruzam(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y));
  const on = (p, q, r) => Math.min(p.x, r.x) <= q.x && q.x <= Math.max(p.x, r.x) && Math.min(p.y, r.y) <= q.y && q.y <= Math.max(p.y, r.y);
  const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  return (o1 === 0 && on(a, c, b)) || (o2 === 0 && on(a, d, b)) || (o3 === 0 && on(c, a, d)) || (o4 === 0 && on(c, b, d));
}

function segmentoNoRetangulo(a, b, r) {
  if (pontoNoRetangulo(a, r) || pontoNoRetangulo(b, r)) return true;
  const c = [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
  for (let i = 0; i < 4; i++) if (segmentosCruzam(a, b, c[i], c[(i + 1) % 4])) return true;
  return false;
}

function retangulosCruzam(a, b) {
  return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
}

/* ---------- Regras ---------- */

function liberado() {
  return game.user.isGM;
}

function avisar(msg) {
  if (!cfg("aviso")) return;
  const agora = Date.now();
  if (agora - ultimoAviso < 1200) return;
  ultimoAviso = agora;
  ui.notifications.warn(msg);
}

/** Algum token do jogador alcança o objeto? `teste` recebe a área de alcance de cada token. */
function alcanca(teste, nome) {
  const tokens = tokensDoJogador();
  if (!tokens.length) {
    if (cfg("semToken")) return true;
    avisar(`Selecione seu token para interagir com ${nome}.`);
    return false;
  }
  if (tokens.some((t) => teste(areaDeAlcance(t)))) return true;
  avisar(`Longe demais para alcançar ${nome}. Chegue a ${cfg("alcance")} ${canvas.dimensions.units || "pés"}.`);
  return false;
}

function portaAlcancavel(wall) {
  const [x1, y1, x2, y2] = wall.c;
  return (r) => segmentoNoRetangulo({ x: x1, y: y1 }, { x: x2, y: y2 }, r);
}

/* ---------- Portas ---------- */

Hooks.on("preUpdateWall", (wall, changes, options, userId) => {
  if (userId !== game.user.id || liberado() || !cfg("portas")) return;
  if (!("ds" in changes) || options.monolithReachIgnore) return;
  if (!wall.door) return;
  if (!alcanca(portaAlcancavel(wall), "a porta")) return false;
});

async function interagirPortaProxima() {
  if (!canvas.ready) return;
  const tokens = tokensDoJogador();
  if (!tokens.length) return avisar("Selecione seu token.");
  const portas = canvas.walls.placeables.filter((w) => w.document.door && w.document.ds !== CONST.WALL_DOOR_STATES.LOCKED);
  let melhor = null;
  let menor = Infinity;
  for (const t of tokens) {
    const area = areaDeAlcance(t);
    const c = t.center;
    for (const w of portas) {
      if (!portaAlcancavel(w.document)(area)) continue;
      const [x1, y1, x2, y2] = w.document.c;
      const dist = Math.hypot((x1 + x2) / 2 - c.x, (y1 + y2) / 2 - c.y);
      if (dist < menor) { menor = dist; melhor = w; }
    }
  }
  if (!melhor) return avisar("Nenhuma porta ao alcance.");
  const S = CONST.WALL_DOOR_STATES;
  await melhor.document.update({ ds: melhor.document.ds === S.OPEN ? S.CLOSED : S.OPEN });
}

/* ---------- Monk's Active Tiles ---------- */

function envolverMonksActiveTiles() {
  if (!game.modules.get("monks-active-tiles")?.active) return;
  // Find the prototype in the chain that actually owns the trigger method installed by MATT.
  let proto = CONFIG.Tile.documentClass.prototype;
  while (proto && !Object.prototype.hasOwnProperty.call(proto, "trigger")) proto = Object.getPrototypeOf(proto);
  if (!proto) return;
  const original = proto.trigger;
  if (typeof original !== "function" || original.monolithReach) return;
  const envolvido = async function (args = {}) {
    if (!liberado() && cfg("tiles") && CLIQUES.has(args?.method) && (args.userId ?? game.user.id) === game.user.id) {
      const tile = this;
      const area = { x: tile.x, y: tile.y, w: tile.width, h: tile.height };
      if (!alcanca((r) => retangulosCruzam(r, area), "isso")) return;
    }
    return original.call(this, args);
  };
  envolvido.monolithReach = true;
  proto.trigger = envolvido;
}

/* ---------- Light Switch ---------- */

function envolverLightSwitch() {
  if (!game.modules.get("light-switch")?.active) return;
  const camada = canvas.controls?.lightSwitches;
  const exemplo = camada?.children?.[0];
  if (!exemplo) return;
  const proto = Object.getPrototypeOf(exemplo);
  if (proto._onMouseDown?.monolithReach) return;
  const original = proto._onMouseDown;
  const envolvido = function (event) {
    if (!liberado() && cfg("interruptores")) {
      const doc = this.light?.document;
      if (doc && !alcanca((r) => pontoNoRetangulo({ x: doc.x, y: doc.y }, r), "o interruptor")) {
        event?.stopPropagation?.();
        return false;
      }
    }
    return original.call(this, event);
  };
  envolvido.monolithReach = true;
  proto._onMouseDown = envolvido;
  // Os listeners já registrados apontam para a função antiga: redesenha os interruptores.
  for (const c of camada.children) c.draw?.();
}

Hooks.once("ready", () => envolverMonksActiveTiles());
Hooks.on("canvasReady", () => setTimeout(envolverLightSwitch, 500));
Hooks.on("createAmbientLight", () => setTimeout(envolverLightSwitch, 500));
Hooks.on("updateAmbientLight", () => setTimeout(envolverLightSwitch, 500));
