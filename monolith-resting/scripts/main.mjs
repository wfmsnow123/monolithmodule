/**
 * Monolith: Resting Rules
 * Fôlego, Vigília e Descanso Completo registrados como tipos de descanso do próprio dnd5e
 * (CONFIG.DND5E.restTypes), com os ajustes de Monolith aplicados em dnd5e.preRestCompleted.
 */
import { PALAVRAS_COMIDA, PALAVRAS_BEBIDA } from "./logica.mjs";
import { acenderFogueira, aoMudarPilha, aoFicarPronto, iniciarSocket, FogueiraApp, servir, pilhaAtual } from "./comida.mjs";
import { verificarFome, iniciarRefeicoes, registrarRefeicao, comerAgora, botoesDeFome, aoUsarAtividade } from "./fome.mjs";

const ID = "monolith-resting";
const HANDLER = "monolithResting";
const DIA = 86400;
const esc = (v) => foundry.utils.escapeHTML(String(v ?? ""));

export const TIPOS = {
  folego: { nome: "Fôlego", icon: "fa-wind", metodo: "shortRest", minutos: 10, porDia: 2 },
  vigilia: { nome: "Vigília", icon: "fa-campground", metodo: "shortRest", minutos: 480, porDia: 1 },
  completo: { nome: "Descanso Completo", icon: "fa-house-chimney", metodo: "longRest", minutos: 600, porDia: null }
};

const FATORES = [
  { id: "clima", rotulo: "Frio ou calor intenso", valor: 2 },
  { id: "climaExtremo", rotulo: "Frio ou calor extremo", valor: 4 },
  { id: "ameaca", rotulo: "Ameaça possível nas redondezas", valor: 2 },
  { id: "magia", rotulo: "Influência mágica nociva", valor: 2 },
  { id: "escuro", rotulo: "Nenhuma fonte de luz ao longo da noite", valor: 2 },
  { id: "conforto", rotulo: "Barraca mágica ou caverna aquecida", valor: -2 },
  { id: "comida", rotulo: "Comida melhor que ração", valor: -2 }
];

/* ================= Tipos de descanso no dnd5e ================= */

function registrarTiposDeDescanso() {
  const dur = (m) => ({ normal: m, gritty: m, epic: m });
  Object.assign(CONFIG.DND5E.restTypes, {
    folego: {
      duration: dur(10), label: "Fôlego", icon: "fa-solid fa-wind",
      activationPeriods: ["shortRest"], recoverPeriods: ["sr"], recoverSpellSlotTypes: new Set()
    },
    vigilia: {
      duration: dur(480), label: "Vigília", icon: "fa-solid fa-campground",
      activationPeriods: ["longRest"], recoverHitDice: true, recoverHitPoints: false,
      recoverPeriods: ["lr", "sr"], recoverSpellSlotTypes: new Set(["spell", "pact"]), exhaustionDelta: 0
    },
    completo: {
      duration: dur(600), label: "Descanso Completo", icon: "fa-solid fa-house-chimney",
      activationPeriods: ["longRest"], recoverHitDice: true, recoverHitPoints: true,
      recoverPeriods: ["lr", "sr"], recoverSpellSlotTypes: new Set(["spell", "pact"]),
      recoverTemp: true, recoverTempMax: true, exhaustionDelta: -2
    }
  });
}

/* ================= Regras por personagem ================= */

function armaduraPesada(actor) {
  return actor.itemTypes.equipment.some((i) => i.system.equipped && ["medium", "heavy"].includes(i.system.type?.value));
}

function historico(actor) {
  return actor.getFlag(ID, "historico") ?? [];
}

function usadosNoDia(actor, tipo) {
  const agora = game.time.worldTime;
  return historico(actor).filter((h) => h.tipo === tipo && agora - h.t < DIA).length;
}

function limiteAtingido(actor, tipo) {
  const max = TIPOS[tipo].porDia;
  return max != null && usadosNoDia(actor, tipo) >= max;
}

function maiorDadoDeVida(actor) {
  const hd = actor.system.attributes.hd;
  if (hd?.largestFace) return hd.largestFace;
  const faces = actor.itemTypes.class.map((c) => parseInt(String(c.system.hd?.denomination ?? c.system.hitDice ?? "d8").replace("d", ""), 10) || 8);
  return Math.max(8, ...faces);
}

/** Configuração do dnd5e para um personagem num descanso de Monolith. */
function configuracao(actor, tipo, opcoes = {}) {
  const semComida = tipo === "folego" ? null : opcoes.semComida ?? null;
  const agitada = tipo === "vigilia" && (!!opcoes.agitada || semComida === "agitada");
  const sono = tipo === "completo" || (tipo === "vigilia" && opcoes.sono !== false && !agitada && !armaduraPesada(actor));
  const monolith = { tipo, sono, agitada, armadura: tipo === "vigilia" && armaduraPesada(actor), semComida };
  // Descanso Completo sem comida (consequência "agitada"): não reduz Exaustão.
  const completoSemComida = tipo === "completo" && semComida === "agitada";
  return {
    type: tipo,
    dialog: opcoes.dialog ?? true,
    chat: true,
    newDay: tipo !== "folego",
    advanceTime: false,
    duration: TIPOS[tipo].minutos,
    fraction: tipo === "completo" ? 1 : 0.5,
    exhaustionDelta: tipo === "completo" ? (completoSemComida ? 0 : -2) : tipo === "vigilia" && sono ? -1 : 0,
    recoverTemp: tipo === "completo",
    recoverTempMax: tipo === "completo",
    monolith
  };
}

export async function descansar(actor, tipo, opcoes = {}) {
  if (!actor || !TIPOS[tipo]) return;
  if (limiteAtingido(actor, tipo) && !opcoes.ignorarLimite) {
    ui.notifications.warn(`${actor.name} já usou ${TIPOS[tipo].porDia === 1 ? "a" : "os"} ${TIPOS[tipo].nome}${TIPOS[tipo].porDia > 1 ? "s" : ""} das últimas 24 horas.`);
    return null;
  }
  const config = { ...configuracao(actor, tipo, opcoes), ...(opcoes.request ? { request: opcoes.request } : {}) };
  return actor[TIPOS[tipo].metodo](config);
}

/* ================= Ajustes antes de salvar ================= */

function metade(orig, cheio) {
  return orig + Math.floor(Math.max(0, cheio - orig) / 2);
}

Hooks.on("dnd5e.preRestCompleted", (actor, result, config) => {
  const m = config?.monolith;
  if (!m) return;
  const up = result.updateData;
  const pacto = actor.system.spells?.pact;

  if (m.tipo === "folego" && pacto?.max > 0) up["system.spells.pact.value"] = Math.min(pacto.max, pacto.value + 1);
  if (m.tipo === "completo" && m.semComida === "agitada" && "system.attributes.exhaustion" in up) {
    up["system.attributes.exhaustion"] = actor.system.attributes.exhaustion;
  }

  if (m.tipo === "vigilia" && m.agitada) {
    for (const [key, slot] of Object.entries(actor.system.spells ?? {})) {
      const caminho = `system.spells.${key}.value`;
      if (!(caminho in up)) continue;
      if (key === "pact") up[caminho] = Math.min(slot.max, slot.value + 1);
      else if (Number(slot.level ?? key.replace("spell", "")) <= 3) up[caminho] = metade(slot.value, up[caminho]);
      else up[caminho] = slot.value;
    }
    for (const [k, r] of Object.entries(actor.system.resources ?? {})) {
      const caminho = `system.resources.${k}.value`;
      if (caminho in up) up[caminho] = metade(Number(r.value) || 0, Number(up[caminho]) || 0);
    }
    for (const u of result.updateItems ?? []) {
      const novo = foundry.utils.getProperty(u, "system.uses.spent");
      if (novo === undefined) continue;
      const item = actor.items.get(u._id);
      const antes = item?.system.uses?.spent ?? 0;
      const recuperado = Math.max(0, antes - novo);
      foundry.utils.setProperty(u, "system.uses.spent", antes - Math.floor(recuperado / 2));
    }
  }
});

/* ================= Depois do descanso ================= */

async function curarDadoGratis(actor) {
  const roll = await new Roll(`1d${maiorDadoDeVida(actor)} + @abilities.con.mod`, actor.getRollData()).evaluate();
  const hp = actor.system.attributes.hp;
  const max = hp.effectiveMax ?? hp.max;
  await actor.update({ "system.attributes.hp.value": Math.min(max, (hp.value ?? 0) + Math.max(0, roll.total)) });
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: "Dado de Vida gratuito do descanso" });
  return roll.total;
}

Hooks.on("dnd5e.restCompleted", async (actor, result, config) => {
  const m = config?.monolith;
  if (!m || !actor.isOwner) return;
  const agora = game.time.worldTime;
  const hist = historico(actor).filter((h) => agora - h.t < 3 * DIA);
  hist.push({ tipo: m.tipo, t: agora });
  const updates = { [`flags.${ID}.historico`]: hist };
  if (m.tipo !== "folego") Object.assign(updates, { [`flags.${ID}.ultimaVigilia`]: agora, [`flags.${ID}.periodosSemSono`]: 0 });
  await actor.update(updates);

  const linhas = [];
  if (m.tipo === "folego" || (m.tipo === "vigilia" && m.sono)) linhas.push(`Dado de Vida gratuito: ${await curarDadoGratis(actor)} PV.`);
  if (m.tipo === "vigilia" && m.armadura) linhas.push("Dormiu de armadura média ou pesada: sem os benefícios de sono inteiro.");
  if (m.tipo === "vigilia" && m.agitada) linhas.push("Vigília Agitada: metade das características e espaços, nada acima do 3º círculo.");
  if (m.tipo === "vigilia" && m.sono) linhas.push("Sono inteiro: -1 de Exaustão.");
  if (m.tipo === "completo") linhas.push(m.semComida === "agitada" ? "Todos os PV e Dados de Vida." : "-2 de Exaustão, todos os PV e Dados de Vida.");
  if (m.semComida === "agitada") linhas.push(m.tipo === "completo" ? "Sem comida: o descanso não reduziu a Exaustão." : "Sem comida: a Vigília foi Agitada.");
  if (m.semComida === "exaustao") linhas.push("Sem comida: +1 de Exaustão.");
  if (linhas.length) {
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="mono-card"><header><i class="fas ${TIPOS[m.tipo].icon}"></i> ${TIPOS[m.tipo].nome}</header><ul>${linhas.map((l) => `<li>${l}</li>`).join("")}</ul></div>`
    });
  }
  Hooks.callAll("monolithResting.restCompleted", actor, m.tipo, { sonoInteiro: m.sono, agitada: m.agitada });
});

/* ================= Pedido de descanso (Mestre) ================= */

export async function abrirPedido() {
  if (!game.user.isGM) return ui.notifications.warn("Só o Mestre pede descansos.");
  const chars = game.actors.filter((a) => a.type === "character" && a.hasPlayerOwner);
  const linhaChar = (a) => {
    const avisos = [];
    if (limiteAtingido(a, "folego")) avisos.push("sem Fôlego");
    if (limiteAtingido(a, "vigilia")) avisos.push("sem Vigília");
    if (armaduraPesada(a)) avisos.push("de armadura");
    return `<label class="mr-check"><input type="checkbox" name="a-${a.id}" checked> ${esc(a.name)}${avisos.length ? ` <span class="mr-aviso">(${avisos.join(", ")})</span>` : ""}</label>`;
  };
  // Seções recolhíveis: só o tipo de descanso começa aberto; o cabeçalho de cada uma resume o que está marcado.
  const secao = (id, titulo, corpo, { aberta = false, attrs = "" } = {}) => `<details class="mr-secao" data-secao="${id}" ${aberta ? "open" : ""} ${attrs}>
      <summary><span class="mr-titulo">${titulo}</span><span class="mr-resumo" data-resumo="${id}"></span></summary>
      <div class="mr-corpo">${corpo}</div></details>`;
  const content = `<div class="mr-form">
    ${secao("descanso", "Descanso", `<div class="mr-tipos">${Object.entries(TIPOS).map(([k, t], i) => `<label class="mr-check"><input type="radio" name="tipo" value="${k}" ${i === 1 ? "checked" : ""}> <i class="fas ${t.icon}"></i> ${t.nome} (${t.minutos >= 60 ? t.minutos / 60 + " h" : t.minutos + " min"})</label>`).join("")}</div>`, { aberta: true })}
    ${secao("vigilia", "Vigília", `
      <label class="mr-check"><input type="checkbox" name="sono" checked> Sono inteiro (8 horas sem interrupção)</label>
      <p class="mr-hint">Acampamento Exposto: o grupo faz um teste em grupo de Sabedoria (Sobrevivência), ou Constituição para quem é proficiente na resistência de Constituição.</p>
      <div class="mr-grid">${FATORES.map((f) => `<label class="mr-check"><input type="checkbox" name="f-${f.id}" data-valor="${f.valor}"> ${f.rotulo} (${f.valor > 0 ? "+" : ""}${f.valor})</label>`).join("")}</div>
      <p class="mr-cd">CD do acampamento: <b data-cd>10</b> <span class="mr-hint">(sem fatores, o acampamento é Abrigado e não precisa de teste)</span></p>
      <label class="mr-check"><input type="checkbox" name="agitada"> O grupo falhou: Vigília Agitada</label>`)}
    ${secao("personagens", "Personagens", `<div class="mr-grid">${chars.map(linhaChar).join("")}</div>`)}
    ${secao("comida", "Comida", `
      <label class="mr-check"><input type="checkbox" name="comida" ${game.settings.get(ID, "comidaExigida") ? "checked" : ""}> Exigir comida: abre a fogueira para o grupo juntar a refeição</label>
      <div class="mr-qtd">
        <label>Comida por pessoa <input type="number" name="racoes" min="0" step="1" value="${game.settings.get(ID, "racoesPorPessoa")}"></label>
        <label>Bebida por pessoa <input type="number" name="agua" min="0" step="1" value="${game.settings.get(ID, "aguaPorPessoa")}"></label>
      </div>
      <p class="mr-hint">Quem come:</p>
      <div class="mr-grid">${chars.map((a) => `<label class="mr-check"><input type="checkbox" name="c-${a.id}" checked> ${esc(a.name)}</label>`).join("")}</div>
      <p class="mr-hint">Com comida exigida, o descanso só é pedido quando o Mestre serve a refeição na fogueira.</p>`, { attrs: "data-comida" })}
    ${secao("opcoes", "Opções", `
      <label class="mr-check"><input type="checkbox" name="avancar" checked> Avançar o relógio do mundo pela duração</label>
      <label class="mr-check"><input type="checkbox" name="ignorar"> Ignorar o limite por dia</label>`)}</div>`;
  const dados = await foundry.applications.api.DialogV2.prompt({ classes: ["mono", "monolith-descanso"], window: { title: "Monolith: descanso", icon: "fas fa-bed", resizable: true },
    position: { width: 640 },
    content,
    render: (ev, dialog) => {
      const el = dialog.element;
      const marcado = (n) => !!el.querySelector(`[name="${n}"]`)?.checked;
      const contar = (prefixo) => [...el.querySelectorAll(`[name^="${prefixo}"]`)].filter((i) => i.checked).length;
      const resumo = (id, texto) => { const s = el.querySelector(`[data-resumo="${id}"]`); if (s) s.textContent = texto; };
      const atualizar = () => {
        const soma = FATORES.reduce((s, f) => s + (marcado(`f-${f.id}`) ? f.valor : 0), 0);
        el.querySelector("[data-cd]").textContent = String(10 + soma);
        const t = TIPOS[el.querySelector('[name="tipo"]:checked')?.value];
        el.querySelector("[data-comida]").hidden = t === TIPOS.folego;
        resumo("descanso", t ? `${t.nome}, ${t.minutos >= 60 ? t.minutos / 60 + " h" : t.minutos + " min"}` : "");
        resumo("vigilia", [soma ? `CD ${10 + soma}` : "Abrigado", marcado("sono") ? "sono inteiro" : "sono interrompido", marcado("agitada") ? "Agitada" : ""].filter(Boolean).join(", "));
        resumo("personagens", `${contar("a-")} de ${chars.length}`);
        const racoes = el.querySelector('[name="racoes"]')?.value, agua = el.querySelector('[name="agua"]')?.value;
        resumo("comida", marcado("comida") ? `exigida: ${racoes} comida, ${agua} bebida, ${contar("c-")} comem` : "não exigida");
        resumo("opcoes", [marcado("avancar") ? "avança o relógio" : "relógio parado", marcado("ignorar") ? "ignora o limite" : ""].filter(Boolean).join(", "));
      };
      el.querySelector(".mr-form").addEventListener("change", atualizar);
      el.querySelector(".mr-form").addEventListener("input", atualizar);
      atualizar();
    },
    ok: {
      label: "Pedir descanso",
      callback: (ev, btn) => {
        const f = btn.form.elements;
        return {
          tipo: f.tipo.value, sono: f.sono.checked, agitada: f.agitada.checked, avancar: f.avancar.checked, ignorarLimite: f.ignorar.checked,
          alvos: chars.filter((a) => f[`a-${a.id}`]?.checked),
          comida: {
            exige: f.comida.checked, racoes: Math.max(0, Number(f.racoes.value) || 0), agua: Math.max(0, Number(f.agua.value) || 0),
            comensais: chars.filter((a) => f[`c-${a.id}`]?.checked)
          }
        };
      }
    }
  }).catch(() => null);
  if (!dados?.alvos?.length) return;
  const c = dados.comida;
  if (c.exige && dados.tipo !== "folego" && c.comensais.length && (c.racoes || c.agua)) {
    const { tipo, sono, agitada, avancar, ignorarLimite } = dados;
    return acenderFogueira({
      tipo, tipoNome: TIPOS[tipo].nome, racoes: c.racoes, agua: c.agua, comensais: c.comensais,
      pedido: { tipo, sono, agitada, avancar, ignorarLimite, alvos: dados.alvos.map((a) => a.id), segundos: TIPOS[tipo].minutos * 60 }
    });
  }
  return pedirDescanso(dados.alvos, dados);
}

export async function pedirDescanso(actors, { tipo, sono = true, agitada = false, avancar = false, ignorarLimite = false, fome = {} }) {
  const t = TIPOS[tipo];
  let rotulo = t.nome;
  if (tipo === "vigilia") rotulo += agitada ? " Agitada" : sono ? ", sono inteiro" : "";
  const msg = await ChatMessage.implementation.create({
    flavor: `Descanso de Monolith: ${rotulo}`,
    speaker: ChatMessage.getSpeaker({ alias: "Mestre" }),
    type: "request",
    system: {
      button: { icon: `<i class="fas ${t.icon}"></i>`, label: `Iniciar ${t.nome}` },
      data: { tipo, sono, agitada, ignorarLimite, fome },
      handler: HANDLER,
      targets: actors.map((a) => ({ actor: a.uuid }))
    }
  });
  if (tipo !== "folego") {
    // A Vigília conta desde o pedido, para o aviso de 24 horas não disparar no meio do descanso.
    for (const a of actors) await a.update({ [`flags.${ID}.ultimaVigilia`]: game.time.worldTime, [`flags.${ID}.periodosSemSono`]: 0 });
  }
  if (avancar) await game.time.advance(t.minutos * 60);
  return msg;
}

async function tratarPedido(actor, request, data) {
  const result = await descansar(actor, data.tipo, { sono: data.sono, agitada: data.agitada, ignorarLimite: data.ignorarLimite, semComida: data.fome?.[actor.id], request });
  return result?.message ?? null;
}

function autoIniciar(message) {
  if (message.type !== "request" || message.system?.handler !== HANDLER) return;
  for (const t of message.system.targets ?? []) {
    const actor = fromUuidSync(t.actor);
    if (!actor) continue;
    const dono = game.users.find((u) => !u.isGM && u.active && actor.testUserPermission(u, "OWNER"));
    const euExecuto = dono ? dono.isSelf : game.users.activeGM?.isSelf;
    if (euExecuto) CONFIG.DND5E.requests[HANDLER](actor, message, message.system.data);
  }
}

/* ================= Dormir é para os Fracos ================= */

async function verificarSono() {
  if (!game.users.activeGM?.isSelf || !game.settings.get(ID, "dormirFracos")) return;
  const agora = game.time.worldTime;
  for (const actor of game.actors.filter((a) => a.type === "character" && a.hasPlayerOwner)) {
    let ultima = actor.getFlag(ID, "ultimaVigilia");
    if (ultima === undefined) { await actor.setFlag(ID, "ultimaVigilia", agora); continue; }
    const periodos = Math.floor((agora - ultima) / DIA);
    const ja = actor.getFlag(ID, "periodosSemSono") ?? 0;
    for (let p = ja + 1; p <= periodos; p++) {
      const cd = 10 + 5 * (p - 1);
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        whisper: game.users.filter((u) => u.isGM || actor.testUserPermission(u, "OWNER")).map((u) => u.id),
        content: `<div class="mono-card"><header><i class="fas fa-bed"></i> Dormir é para os Fracos</header>
          <p><b>${esc(actor.name)}</b> passou ${p * 24} horas sem concluir uma Vigília.</p>
          <p>Teste de resistência de Constituição <b>CD ${cd}</b>. Falha: +1 de Exaustão.</p>
          <button type="button" data-monolith-sono="${actor.id}" data-cd="${cd}"><i class="fas fa-dice-d20"></i> Rolar Constituição</button></div>`
      });
    }
    if (periodos > ja) await actor.setFlag(ID, "periodosSemSono", periodos);
  }
}

function botoesDoChat(message, html) {
  html.querySelectorAll("[data-monolith-sono]").forEach((btn) => {
    const actor = game.actors.get(btn.dataset.monolithSono);
    if (!actor?.isOwner) { btn.disabled = true; return; }
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const cd = Number(btn.dataset.cd);
      const rolls = await actor.rollSavingThrow({ ability: "con", target: cd });
      const total = rolls?.[0]?.total;
      if (total !== undefined && total < cd) {
        const ex = actor.system.attributes.exhaustion ?? 0;
        await actor.update({ "system.attributes.exhaustion": ex + 1 });
      }
    });
  });
}

/* ================= Comida e fome: configurações ================= */

function registrarConfiguracoesDeComida() {
  const reg = (chave, dados) => game.settings.register(ID, chave, { scope: "world", config: true, ...dados });
  game.settings.register(ID, "pilha", { scope: "world", config: false, type: Object, default: {}, onChange: aoMudarPilha });
  reg("comidaExigida", {
    name: "Comida: exigir por padrão",
    hint: "Marca \"Exigir comida\" no pedido de Vigília ou Descanso Completo, abrindo a fogueira para o grupo juntar a refeição.",
    type: Boolean, default: true
  });
  reg("racoesPorPessoa", { name: "Comida: porções por pessoa", type: Number, default: 1 });
  reg("aguaPorPessoa", { name: "Comida: bebida por pessoa", type: Number, default: 1 });
  reg("palavrasComida", {
    name: "Comida: palavras de comida",
    hint: "Itens com estas palavras no nome (separadas por vírgula, sem diferenciar acento, aceitando plural) contam como comida. Consumíveis do tipo Comida do dnd5e também contam.",
    type: String, default: PALAVRAS_COMIDA
  });
  reg("palavrasBebida", {
    name: "Comida: palavras de bebida",
    hint: "Itens com estas palavras no nome contam como bebida (bebida ganha de comida: \"Odre de vinho\" é bebida).",
    type: String, default: PALAVRAS_BEBIDA
  });
  reg("sobras", {
    name: "Comida: sobras da refeição",
    type: String, default: "devolver",
    choices: { devolver: "Voltam para quem trouxe", manter: "Ficam na pilha para a próxima refeição" }
  });
  reg("semComida", {
    name: "Comida: descansar sem comer",
    hint: "O que acontece com quem fica sem a comida ou a bebida exigida no descanso. Agitado: a Vigília vira Agitada e o Descanso Completo não reduz Exaustão.",
    type: String, default: "agitada",
    choices: { nada: "Nada", agitada: "O descanso fica Agitado", exaustao: "+1 de Exaustão" }
  });
  reg("fome", {
    name: "Fome",
    hint: "Avisa no chat quando um personagem passa muito tempo sem comer, pelo relógio do mundo. Ao ligar, todos contam como alimentados agora.",
    type: Boolean, default: true,
    onChange: (v) => { if (v) iniciarRefeicoes({ todos: true }); }
  });
  reg("fomeIntervalo", { name: "Fome: horas por nível", hint: "Começando a ficar com fome, com fome e faminto a cada tantas horas sem comer.", type: Number, default: 8 });
  reg("fomeSussurro", { name: "Fome: só para dono e Mestre", hint: "Desligado, o aviso de fome é público.", type: Boolean, default: true });
  reg("fomeNPCs", { name: "Fome: incluir NPCs", hint: "Também acompanha atores sem jogador com token ligado na cena ativa.", type: Boolean, default: false });
  reg("fomeInanicao", {
    name: "Fome: inanição",
    hint: "Regra opcional: depois de 3 + mod. de Constituição dias sem comer (mínimo 1), cada dia dá 1 de Exaustão.",
    type: Boolean, default: false
  });
}

/* ================= Interface ================= */

Hooks.once("init", () => {
  game.settings.register(ID, "dormirFracos", {
    name: "Dormir é para os Fracos",
    hint: "A cada 24 horas sem Vigília, pede um teste de Constituição (CD 10, +5 por período seguido); falha dá 1 de Exaustão.",
    scope: "world", config: true, type: Boolean, default: true
  });
  registrarConfiguracoesDeComida();
  game.settings.register(ID, "botaoJogadores", {
    name: "Botão de descanso na lista de jogadores",
    scope: "world", config: true, type: Boolean, default: true
  });
  registrarTiposDeDescanso();
  CONFIG.DND5E.requests[HANDLER] = tratarPedido;
  game.keybindings.register(ID, "pedir", {
    name: "Pedir descanso (Mestre)",
    editable: [],
    restricted: true,
    onDown: () => { abrirPedido(); return true; }
  });
});

Hooks.once("ready", () => {
  game.modules.get(ID).api = {
    abrirPedido, pedirDescanso, descansar, TIPOS,
    acenderFogueira, abrirFogueira: () => FogueiraApp.abrir(), servir, pilha: pilhaAtual,
    registrarRefeicao, comerAgora, verificarFome
  };
  iniciarSocket();
  aoFicarPronto();
  if (game.settings.get(ID, "fome")) iniciarRefeicoes();
  if (game.user.isGM && game.modules.get("rest-recovery")?.active) {
    ui.notifications.warn("Monolith: Resting Rules substitui o Rest Recovery. Desative o Rest Recovery para os descansos não serem configurados duas vezes.", { permanent: true });
  }
});

Hooks.on("createChatMessage", autoIniciar);
Hooks.on("renderChatMessageHTML", botoesDoChat);
Hooks.on("renderChatMessageHTML", (message, html) => botoesDeFome(message, html, () => FogueiraApp.abrir()));
Hooks.on("updateWorldTime", () => { verificarSono(); verificarFome(); });
Hooks.on("dnd5e.postUseActivity", (activity) => aoUsarAtividade(activity));

Hooks.on("renderPlayers", (app, html) => {
  if (!game.user.isGM || !game.settings.get(ID, "botaoJogadores")) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  // Dentro da caixa dos jogadores ativos: fora dela a interface do Foundry não recebe cliques.
  const ativos = root?.querySelector("#players-active");
  if (!ativos || ativos.querySelector(".monolith-rest-btn")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "monolith-rest-btn";
  btn.innerHTML = '<i class="fas fa-bed"></i> Descanso';
  btn.addEventListener("click", () => abrirPedido());
  ativos.insertBefore(btn, ativos.querySelector("#performance-stats"));
});
