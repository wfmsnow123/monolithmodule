import { ID, F, getF, esc, chat } from "./util.mjs";

/**
 * Descansos de Monolith, executados pelo fluxo normal do dnd5e (e pelo diálogo do Rest Recovery, se ativo).
 *  folego   : Fôlego, 10 minutos, tipo "short"
 *  vigilia  : Vigília, 8 horas, tipo "long", sem recuperar PV
 *  completo : Descanso Completo, 10 horas, tipo "long", recupera tudo
 */
export const TIPOS = {
  folego: { nome: "Fôlego", tipo: "short", icon: "fa-wind" },
  vigilia: { nome: "Vigília", tipo: "long", icon: "fa-campground" },
  completo: { nome: "Descanso Completo", tipo: "long", icon: "fa-house-chimney" }
};

const HANDLER = "monolithDescanso";
const RR = "rest-recovery";

/* ---------- Ajustes temporários do Rest Recovery ---------- */

let ajustesAtivos = null;   // { overrides, actorId, ate }
const snapshots = new Map(); // actorId -> { spells }

function ajustesPara(m) {
  const base = { "rest-variant": "custom", "long-rest-heavy-armor-automation": false };
  if (m.tipo === "folego") return {
    ...base,
    "custom-short-rest-duration": 10 / 60,
    "short-recovery-hitpoints": "none",
    "short-recovery-spells": "none",
    "short-rest-recovery-pact-spells": "none",
    "short-rest-recovery-uses-feats": "full",
    "short-rest-recovery-uses-others": "full",
    "disable-short-rest-hit-dice": false
  };
  if (m.tipo === "vigilia") {
    const metade = m.agitada ? "half" : "full";
    return {
      ...base,
      "custom-long-rest-duration": 8,
      "recovery-hitpoints": "none",
      "recovery-hitdice": "half",
      "recovery-spells": metade,
      "long-recovery-pact-spells": m.agitada ? "none" : "full",
      "recovery-uses-feats": metade,
      "recovery-uses-others": metade,
      "recovery-day": metade,
      "long-rest-prevent-exhaustion-recovery": !(m.sono && !m.agitada)
    };
  }
  return {
    ...base,
    "custom-long-rest-duration": 10,
    "recovery-hitpoints": "full",
    "recovery-hitdice": "full",
    "recovery-spells": "full",
    "long-recovery-pact-spells": "full",
    "recovery-uses-feats": "full",
    "recovery-uses-others": "full",
    "recovery-day": "full",
    "long-rest-prevent-exhaustion-recovery": false
  };
}

function ativarAjustes(actor, m) {
  ajustesAtivos = { overrides: ajustesPara(m), actorId: actor.id, ate: Date.now() + 20 * 60 * 1000 };
  snapshots.set(actor.id, { spells: foundry.utils.deepClone(actor.system.spells ?? {}) });
}

function desativarAjustes(actorId) {
  if (!ajustesAtivos || (actorId && ajustesAtivos.actorId !== actorId)) return;
  ajustesAtivos = null;
}

export function instalarLeituraDeAjustes() {
  const original = game.settings.get.bind(game.settings);
  game.settings.get = function (namespace, key, options) {
    if (namespace === RR && ajustesAtivos) {
      if (Date.now() > ajustesAtivos.ate) ajustesAtivos = null;
      else if (key in ajustesAtivos.overrides) return ajustesAtivos.overrides[key];
    }
    return original(namespace, key, options);
  };
}

/* ---------- Pedido de descanso (GM) ---------- */

export async function abrirPedidoDeDescanso() {
  if (!game.user.isGM) return;
  const chars = game.actors.filter(a => a.type === "character" && a.hasPlayerOwner);
  const lista = chars.map(a => `<label class="monolith-check"><input type="checkbox" name="a-${a.id}" checked> ${esc(a.name)}</label>`).join("");
  const tipos = Object.entries(TIPOS).map(([k, t], i) =>
    `<label class="monolith-check"><input type="radio" name="tipo" value="${k}" ${i === 1 ? "checked" : ""}> <i class="fas ${t.icon}"></i> ${t.nome}</label>`).join("");
  const content = `
    <div class="monolith-form">
      <fieldset><legend>Tipo de descanso</legend>${tipos}</fieldset>
      <fieldset><legend>Vigília</legend>
        <label class="monolith-check"><input type="checkbox" name="sono" checked> Sono inteiro (8 horas sem interrupção)</label>
        <label class="monolith-check"><input type="checkbox" name="agitada"> Vigília Agitada (acampamento Exposto, teste em grupo falhou)</label>
      </fieldset>
      <fieldset><legend>Personagens</legend><div class="monolith-grid">${lista}</div></fieldset>
    </div>`;
  const dados = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Descanso de Monolith", icon: "fas fa-bed" },
    position: { width: 420 },
    content,
    ok: {
      label: "Pedir descanso",
      callback: (ev, btn) => {
        const f = btn.form.elements;
        return {
          tipo: f.tipo.value,
          sono: f.sono.checked,
          agitada: f.agitada.checked,
          alvos: chars.filter(a => f[`a-${a.id}`]?.checked)
        };
      }
    }
  }).catch(() => null);
  if (!dados || !dados.alvos.length) return;
  return pedirDescanso(dados.alvos, dados);
}

export async function pedirDescanso(actors, { tipo, sono = true, agitada = false }) {
  const t = TIPOS[tipo];
  const monolith = { tipo, sono: tipo === "completo" ? true : sono, agitada: tipo === "vigilia" && agitada };
  let rotulo = t.nome;
  if (tipo === "vigilia") rotulo += monolith.agitada ? " Agitada" : (monolith.sono ? ", sono inteiro" : "");
  return ChatMessage.implementation.create({
    flavor: `Descanso de Monolith: ${rotulo}`,
    speaker: ChatMessage.getSpeaker({ alias: "Mestre" }),
    type: "request",
    system: {
      button: { icon: `<i class="fas ${t.icon}"></i>`, label: `Iniciar ${t.nome}` },
      data: { type: t.tipo, newDay: tipo !== "folego", monolith },
      handler: HANDLER,
      targets: actors.map(a => ({ actor: a.uuid }))
    }
  });
}

/* ---------- Execução no cliente de quem descansa ---------- */

async function tratarPedido(actor, request, config) {
  const m = config.monolith;
  if (m) ativarAjustes(actor, m);
  try {
    const metodo = config.type === "short" ? "shortRest" : "longRest";
    const result = await actor[metodo]({ ...config, request, advanceBastionTurn: false, advanceTime: false });
    return result?.message ?? null;
  } catch (err) {
    desativarAjustes(actor.id);
    throw err;
  }
}

/** Inicia sozinho o descanso no cliente do dono (ou do GM, se o dono não estiver online). */
function autoIniciar(message) {
  if (message.type !== "request" || message.system?.handler !== HANDLER) return;
  for (const t of message.system.targets ?? []) {
    const actor = fromUuidSync(t.actor);
    if (!actor) continue;
    const donoOnline = game.users.find(u => !u.isGM && u.active && actor.testUserPermission(u, "OWNER"));
    const euExecuto = donoOnline ? donoOnline.isSelf : game.users.activeGM?.isSelf;
    if (euExecuto) CONFIG.DND5E.requests[HANDLER](actor, message, message.system.data);
  }
}

async function curarDadoGratis(actor) {
  const hdFaces = actor.system.attributes.hd?.largestFace
    ?? Math.max(8, ...actor.itemTypes.class.map(c => parseInt(String(c.system.hd?.denomination ?? c.system.hitDice ?? "d8").replace("d", "")) || 8));
  const roll = await new Roll(`1d${hdFaces} + @abilities.con.mod`, actor.getRollData()).evaluate();
  const h = actor.system.attributes.hp;
  const max = h.effectiveMax ?? h.max;
  const novo = Math.min(max, (h.value ?? 0) + Math.max(0, roll.total));
  await actor.update({ "system.attributes.hp.value": novo });
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: "Dado de Vida gratuito do descanso" });
  return roll.total;
}

async function posDescanso(actor, result, config) {
  const m = config?.monolith;
  if (!m) return;
  desativarAjustes(actor.id);
  const snap = snapshots.get(actor.id);
  snapshots.delete(actor.id);
  const linhas = [];
  const updates = {};

  const pacto = actor.system.spells?.pact;
  const umEspacoDePacto = () => {
    if (pacto?.max > 0) {
      updates["system.spells.pact.value"] = Math.min(pacto.max, (snap?.spells?.pact?.value ?? pacto.value) + 1);
      linhas.push("Recuperou 1 espaço de magia de pacto.");
    }
  };

  if (m.tipo === "folego") {
    umEspacoDePacto();
  }

  if (m.tipo === "vigilia") {
    const apagar = m.sono && !m.agitada ? 2 : 1;
    const marcadas = getF(actor, F.marcadas);
    updates[`flags.${ID}.${F.marcadas}`] = Math.max(0, marcadas - apagar);
    updates[`flags.${ID}.${F.armadas}`] = [];
    if (marcadas) linhas.push(`Apagou ${Math.min(apagar, marcadas)} falha(s) marcada(s) do Fio.`);
    if (m.agitada) {
      for (let n = 4; n <= 9; n++) {
        const antes = snap?.spells?.[`spell${n}`]?.value;
        if (antes !== undefined) updates[`system.spells.spell${n}.value`] = antes;
      }
      umEspacoDePacto();
      linhas.push("Vigília Agitada: metade das características e espaços, nenhum acima do 3º círculo.");
    }
  }

  if (m.tipo === "completo") {
    const ex = actor.system.attributes.exhaustion ?? 0;
    if (ex > 0) {
      updates["system.attributes.exhaustion"] = Math.max(0, ex - 1);
      linhas.push("Perdeu um nível extra de Exaustão.");
    }
    updates[`flags.${ID}.${F.marcadas}`] = 0;
    updates[`flags.${ID}.${F.armadas}`] = [];
    linhas.push("Apagou todas as falhas marcadas do Fio.");
  }

  if (!foundry.utils.isEmpty(updates)) await actor.update(updates);

  if (m.tipo === "folego" || (m.tipo === "vigilia" && m.sono && !m.agitada)) {
    const cura = await curarDadoGratis(actor);
    linhas.push(`Dado de Vida gratuito: ${cura} PV.`);
  }

  const nome = TIPOS[m.tipo]?.nome ?? "Descanso";
  await chat(actor, nome, `<b>${esc(actor.name)}</b> concluiu: ${nome}.<ul>${linhas.map(l => `<li>${l}</li>`).join("")}</ul>`, { icon: TIPOS[m.tipo]?.icon });
}

export function registrarDescanso() {
  CONFIG.DND5E.requests[HANDLER] = tratarPedido;
  Hooks.on("createChatMessage", autoIniciar);

  // Sem o Rest Recovery, o próprio dnd5e calcula; aqui se corta o que Monolith não dá.
  Hooks.on("dnd5e.preRestCompleted", (actor, result, config) => {
    const m = config?.monolith;
    if (!m || game.modules.get(RR)?.active) return;
    if (m.tipo === "vigilia") {
      delete result.updateData["system.attributes.hp.value"];
      delete result.updateData["system.attributes.hp.temp"];
      if (!(m.sono && !m.agitada)) delete result.updateData["system.attributes.exhaustion"];
    }
  });

  Hooks.on("dnd5e.restCompleted", (actor, result, config) => {
    if (!actor.isOwner) return;
    posDescanso(actor, result, config);
  });
}
