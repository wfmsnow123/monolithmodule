/**
 * Monolith: Resting Rules. A fogueira: pilha de comida compartilhada do descanso.
 * O estado vive na configuração de mundo "pilha", que só o Mestre ativo escreve; jogadores pedem
 * pelo socket do módulo e todos os clientes redesenham quando a configuração muda.
 */
import { categorizar, contarPilha, repartir } from "./logica.mjs";
import { registrarRefeicao } from "./fome.mjs";

const ID = "monolith-resting";
const CANAL = `module.${ID}`;
const esc = (v) => foundry.utils.escapeHTML(String(v ?? ""));
const ROTULO = { comida: "Comida", bebida: "Bebida" };

/* ================= Itens ================= */

export function palavras() {
  return { comida: game.settings.get(ID, "palavrasComida"), bebida: game.settings.get(ID, "palavrasBebida") };
}

/** "comida", "bebida" ou null para um item com quantidade. */
export function categoriaDoItem(item) {
  if (!item?.system || !("quantity" in item.system)) return null;
  return categorizar({ nome: item.name, subtipo: item.system.type?.value }, palavras());
}

export function itensDe(actor, categoria) {
  return (actor?.items ?? []).filter((i) => (i.system.quantity ?? 0) > 0 && categoriaDoItem(i) === categoria);
}

/** Devolve unidades de uma contribuição ao inventário de quem trouxe. */
async function restaurar(contrib, qtd) {
  const actor = game.actors.get(contrib.actorId);
  if (!actor || qtd <= 0) return false;
  const atual = actor.items.get(contrib.origemId) ?? actor.items.find((i) => i.name === contrib.itemNome && i.type === contrib.dados?.type);
  if (atual) await atual.update({ "system.quantity": (atual.system.quantity ?? 0) + qtd });
  else {
    const dados = foundry.utils.deepClone(contrib.dados);
    foundry.utils.setProperty(dados, "system.quantity", qtd);
    foundry.utils.setProperty(dados, "system.container", null);
    await actor.createEmbeddedDocuments("Item", [dados]);
  }
  return true;
}

/* ================= Estado ================= */

export function pilhaAtual() {
  const p = game.settings.get(ID, "pilha");
  return p?.id ? foundry.utils.deepClone(p) : null;
}

async function salvarPilha(p) {
  await game.settings.set(ID, "pilha", p ?? {});
}

function participa(p) {
  if (game.user.isGM) return true;
  return [...p.comensais, ...p.contribs.map((c) => c.actorId)].some((id) => game.actors.get(id)?.isOwner);
}

let idVisto = null;
/** onChange da configuração: abre a fogueira nova para quem participa, redesenha nos outros casos. */
export function aoMudarPilha(valor) {
  const p = valor?.id ? valor : null;
  if (!p) { idVisto = null; FogueiraApp.instancia?.close(); return; }
  if (p.id !== idVisto) {
    idVisto = p.id;
    if (p.aberta && participa(p)) return FogueiraApp.abrir();
  }
  FogueiraApp.atualizar();
}

export function aoFicarPronto() {
  const p = pilhaAtual();
  idVisto = p?.id ?? null;
  if (p?.aberta && p.pedido && participa(p)) FogueiraApp.abrir();
}

/* ================= Socket ================= */

let fila = Promise.resolve();
function naFila(fn) {
  fila = fila.then(fn).catch((err) => console.error(`${ID} | fogueira`, err));
  return fila;
}

function avisar(userId, texto) {
  if (!userId || userId === game.user.id) ui.notifications.warn(texto);
  else game.socket.emit(CANAL, { acao: "aviso", userId, texto });
}

export function iniciarSocket() {
  game.socket.on(CANAL, (msg, remetente) => {
    if (msg?.acao === "aviso") { if (msg.userId === game.user.id) ui.notifications.warn(msg.texto); return; }
    if (!game.users.activeGM?.isSelf) return;
    // Se o Foundry informar o remetente, ele vale mais que o userId da mensagem.
    tratar({ ...msg, userId: (typeof remetente === "string" && remetente) || msg?.userId });
  });
}

function pedirAoMestre(msg) {
  msg = { ...msg, userId: game.user.id };
  if (game.users.activeGM?.isSelf) return tratar(msg);
  if (!game.users.activeGM) return ui.notifications.warn("Nenhum Mestre conectado para cuidar da fogueira.");
  game.socket.emit(CANAL, msg);
}

function tratar(msg) {
  if (msg?.acao === "contribuir") return naFila(() => contribuir(msg));
  if (msg?.acao === "devolver") return naFila(() => devolver(msg));
}

async function contribuir({ userId, itemUuid, quantidade }) {
  const p = pilhaAtual();
  if (!p?.aberta) return avisar(userId, "A fogueira está apagada.");
  const user = game.users.get(userId);
  const item = await fromUuid(itemUuid);
  const actor = item?.parent;
  if (!user || !item || actor?.documentName !== "Actor") return avisar(userId, "Arraste o item da ficha de um personagem.");
  if (!user.isGM && !actor.testUserPermission(user, "OWNER")) return avisar(userId, `Você não controla ${actor.name}.`);
  const categoria = categoriaDoItem(item);
  if (!categoria) return avisar(userId, `${item.name} não conta como comida nem bebida.`);
  const tem = Number(item.system.quantity) || 0;
  const qtd = Math.min(tem, Math.floor(Number(quantidade) || 0));
  if (qtd < 1) return avisar(userId, `${actor.name} não tem ${item.name} para dar.`);

  const dados = item.toObject();
  delete dados._id;
  delete dados.folder;
  delete dados.sort;
  if (tem - qtd > 0) await item.update({ "system.quantity": tem - qtd });
  else await item.delete();

  const igual = p.contribs.find((c) => c.actorId === actor.id && c.origemId === item.id);
  if (igual) igual.quantidade += qtd;
  else p.contribs.push({
    id: foundry.utils.randomID(), actorId: actor.id, actorNome: actor.name, actorImg: actor.img,
    userId, itemNome: item.name, itemImg: item.img, categoria, quantidade: qtd, origemId: item.id, dados
  });
  await salvarPilha(p);
}

async function devolver({ userId, contribId }) {
  const p = pilhaAtual();
  const c = p?.contribs.find((x) => x.id === contribId);
  if (!c) return;
  const user = game.users.get(userId);
  const actor = game.actors.get(c.actorId);
  if (!user?.isGM && !(p.aberta && actor?.testUserPermission(user, "OWNER"))) return avisar(userId, "Só quem trouxe pode pegar de volta, antes da refeição.");
  p.contribs = p.contribs.filter((x) => x.id !== contribId);
  await salvarPilha(p);
  if (!(await restaurar(c, c.quantidade))) avisar(userId, `${c.actorNome} não existe mais; ${c.itemNome} se perdeu.`);
}

/* ================= Mestre ================= */

/** Acende a fogueira (Mestre). As contribuições que sobraram de uma fogueira anterior continuam na pilha. */
export async function acenderFogueira({ tipo, tipoNome, racoes = 1, agua = 1, comensais = [], pedido = null }) {
  if (!game.user.isGM) return;
  const anterior = pilhaAtual();
  const p = {
    id: foundry.utils.randomID(), aberta: true, tipo, tipoNome, racoes: Number(racoes) || 0, agua: Number(agua) || 0,
    comensais: comensais.map((a) => a.id ?? a), contribs: anterior?.contribs ?? [], pedido, criada: game.time.worldTime
  };
  await salvarPilha(p);
  const reqs = [p.racoes ? `${p.racoes} de comida` : "", p.agua ? `${p.agua} de bebida` : ""].filter(Boolean).join(" e ");
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ alias: "Mestre" }),
    content: `<div class="mono-card"><header><i class="fas fa-fire"></i> Fogueira acesa</header><div class="mono-card__body">
      <p>${esc(tipoNome ?? "Refeição")}: cada um precisa de <b>${reqs || "nada"}</b>. Arrastem comida e bebida da ficha para a pilha.</p>
      <p>Comem: ${p.comensais.map((id) => esc(game.actors.get(id)?.name)).join(", ")}.</p>
      <button type="button" data-monolith-fogueira><i class="fas fa-fire"></i> Abrir a fogueira</button></div></div>`
  });
  FogueiraApp.abrir();
  return p;
}

/** Serve a refeição: consome o que cada um precisa, reseta a última refeição, aplica a falta e pede o descanso pendente. */
export function servir() {
  return naFila(async () => {
    const p = pilhaAtual();
    if (!p || !game.user.isGM) return;
    const r = repartir(p);
    const consequencia = p.pedido ? game.settings.get(ID, "semComida") : "nada";
    const t = game.time.worldTime + (p.pedido?.avancar ? p.pedido.segundos ?? 0 : 0);
    const nome = (id) => esc(game.actors.get(id)?.name ?? "?");

    const fome = {};
    const linhasFalta = [];
    for (const f of r.faltou) {
      const o = [f.comida ? "comida" : "", f.bebida ? "bebida" : ""].filter(Boolean).join(" e ");
      let efeito = "";
      if (consequencia !== "nada") fome[f.actorId] = consequencia;
      if (consequencia === "agitada") efeito = p.tipo === "completo" ? ": o descanso não reduz Exaustão" : ": Vigília Agitada";
      if (consequencia === "exaustao") {
        efeito = ": +1 de Exaustão";
        const a = game.actors.get(f.actorId);
        if (a) await a.update({ "system.attributes.exhaustion": Math.min(6, (a.system.attributes.exhaustion ?? 0) + 1) });
      }
      linhasFalta.push(`<li><b>${nome(f.actorId)}</b> ficou sem ${o}${efeito}.</li>`);
    }
    if (p.racoes > 0) for (const id of r.recebeu.comida) {
      const a = game.actors.get(id);
      if (a) await registrarRefeicao(a, t);
    }

    const manter = game.settings.get(ID, "sobras") === "manter";
    if (manter) await salvarPilha({ ...p, contribs: r.sobras, pedido: null, servida: true });
    else {
      await salvarPilha(null);
      for (const s of r.sobras) await restaurar(s, s.quantidade);
    }

    const comeram = p.comensais.filter((id) => !r.faltou.some((f) => f.actorId === id));
    const sobras = r.sobras.map((s) => `${s.quantidade}× ${esc(s.itemNome)} (${esc(s.actorNome)})`).join(", ");
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ alias: "Mestre" }),
      content: `<div class="mono-card"><header><i class="fas fa-utensils"></i> Refeição</header><div class="mono-card__body">
        ${comeram.length ? `<p>Comeram: ${comeram.map(nome).join(", ")}.</p>` : "<p>Ninguém comeu.</p>"}
        ${linhasFalta.length ? `<ul>${linhasFalta.join("")}</ul>` : ""}
        ${sobras ? `<p class="hint">Sobras ${manter ? "ficam na pilha" : "voltam aos donos"}: ${sobras}.</p>` : ""}</div></div>`
    });

    if (p.pedido) {
      const atores = (p.pedido.alvos ?? []).map((id) => game.actors.get(id)).filter(Boolean);
      if (atores.length) await game.modules.get(ID).api.pedirDescanso(atores, { ...p.pedido, fome });
    }
  });
}

/** Apaga a fogueira sem comer: tudo volta aos donos e o descanso pendente é cancelado. */
export function apagar() {
  return naFila(async () => {
    const p = pilhaAtual();
    if (!p || !game.user.isGM) return;
    await salvarPilha(null);
    for (const c of p.contribs) await restaurar(c, c.quantidade);
  });
}

/* ================= Janela ================= */

const { ApplicationV2 } = foundry.applications.api;

export class FogueiraApp extends ApplicationV2 {
  static instancia = null;

  static abrir() {
    if (!pilhaAtual()) return ui.notifications.info("Não há fogueira acesa.");
    this.instancia ??= new this();
    this.instancia.render({ force: true });
    return this.instancia;
  }

  static atualizar() {
    if (this.instancia?.rendered) this.instancia.render();
  }

  static DEFAULT_OPTIONS = {
    id: "monolith-fogueira",
    classes: ["mono", "monolith-fogueira"],
    window: { title: "Fogueira", icon: "fas fa-fire", resizable: true },
    position: { width: 520, height: "auto" },
    actions: {
      retirar: FogueiraApp.#retirar,
      servir: FogueiraApp.#servir,
      apagar: FogueiraApp.#apagar,
      ficha: FogueiraApp.#ficha
    }
  };

  async _renderHTML() {
    const p = pilhaAtual();
    if (!p) return `<div class="mf-body"><p class="mf-vazio">A fogueira está apagada.</p></div>`;
    const gm = game.user.isGM;
    const cont = contarPilha(p);
    const r = repartir(p);

    const medidor = (cat, rotulo, icone) => {
      const { tem, precisa } = cont[cat];
      if (!precisa) return "";
      const pct = Math.min(100, Math.round((tem / precisa) * 100));
      return `<div class="mf-meta ${tem >= precisa ? "ok" : ""}">
        <span class="mf-meta__rotulo"><i class="fas ${icone}"></i> ${rotulo}</span>
        <span class="mf-meta__num"><b>${tem}</b>/${precisa}</span>
        <span class="mf-meta__barra"><span style="width:${pct}%"></span></span></div>`;
    };

    const comensais = p.comensais.map((id) => {
      const a = game.actors.get(id);
      const f = r.faltou.find((x) => x.actorId === id);
      const estado = !f ? ["ok", "Come"] : f.comida && f.bebida ? ["falta", "Sem nada"] : f.comida ? ["falta", "Sem comida"] : ["falta", "Sem bebida"];
      return `<li class="mf-comensal ${estado[0]}" data-action="ficha" data-actor="${id}">
        <span class="retrato"><img src="${esc(a?.img ?? "icons/svg/mystery-man.svg")}" alt=""></span>
        <span class="nome">${esc(a?.name ?? "?")}</span><span class="mf-chip">${estado[1]}</span></li>`;
    }).join("");

    const contribs = p.contribs.map((c) => {
      const pode = gm || (p.aberta && game.actors.get(c.actorId)?.isOwner);
      return `<li class="mf-contrib">
        <span class="retrato"><img src="${esc(c.actorImg)}" alt=""></span>
        <img class="mf-item" src="${esc(c.itemImg)}" alt="">
        <span class="mf-contrib__txt"><span class="mf-contrib__item"><b>${c.quantidade}×</b> ${esc(c.itemNome)}</span>
          <span class="mf-contrib__quem">${esc(c.actorNome)}</span></span>
        <span class="mf-tag ${c.categoria}">${ROTULO[c.categoria]}</span>
        ${pode ? `<button type="button" class="mf-retirar" data-action="retirar" data-id="${c.id}" data-tooltip="Pegar de volta"><i class="fas fa-rotate-left"></i></button>` : ""}
      </li>`;
    }).join("");

    const porPessoa = [p.racoes ? `${p.racoes} de comida` : "", p.agua ? `${p.agua} de bebida` : ""].filter(Boolean).join(" e ") || "sem exigência";
    const rodape = gm ? `<footer class="mf-rodape">
        <button type="button" data-action="apagar"><i class="fas fa-fire-extinguisher"></i> ${p.pedido ? "Cancelar" : "Apagar"}</button>
        <button type="button" class="mono-primary" data-action="servir"><i class="fas fa-utensils"></i> ${p.pedido ? "Comer e descansar" : "Comer"}</button>
      </footer>` : `<p class="mf-hint">O Mestre serve a refeição quando todos tiverem contribuído.</p>`;

    return `<div class="mf-body">
      <header class="mf-topo"><i class="fas fa-fire mf-chama"></i>
        <div><h2>${esc(p.tipoNome ?? "Fogueira")}</h2><span class="mf-hint">Por pessoa: ${porPessoa}${p.servida ? " · sobras da última refeição" : ""}</span></div></header>
      <div class="mf-metas">${medidor("comida", "Comida", "fa-drumstick-bite")}${medidor("bebida", "Bebida", "fa-droplet")}</div>
      <h3>Quem come</h3>
      <ul class="mf-comensais">${comensais || `<li class="mf-hint">Ninguém.</li>`}</ul>
      <div class="mf-drop ${p.aberta ? "" : "fechada"}"><i class="fas fa-hand-holding"></i>
        <span>Arraste comida e bebida da ficha para cá</span></div>
      <h3>Na pilha</h3>
      <ul class="mf-contribs">${contribs || `<li class="mf-hint">A pilha está vazia.</li>`}</ul>
      ${rodape}
    </div>`;
  }

  _replaceHTML(result, content) {
    const scroll = content.scrollTop;
    content.innerHTML = result;
    content.scrollTop = scroll;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;
    if (el.dataset.mfDrop) return;
    el.dataset.mfDrop = "1";
    el.addEventListener("dragover", (ev) => { ev.preventDefault(); el.querySelector(".mf-drop")?.classList.add("sobre"); });
    el.addEventListener("dragleave", (ev) => { if (!el.contains(ev.relatedTarget)) el.querySelector(".mf-drop")?.classList.remove("sobre"); });
    el.addEventListener("drop", (ev) => { el.querySelector(".mf-drop")?.classList.remove("sobre"); this.#aoSoltar(ev); });
  }

  _onClose(options) {
    super._onClose(options);
    FogueiraApp.instancia = null;
  }

  async #aoSoltar(ev) {
    ev.preventDefault();
    const TE = foundry.applications.ux?.TextEditor?.implementation;
    let data;
    try { data = TE ? TE.getDragEventData(ev) : JSON.parse(ev.dataTransfer.getData("text/plain")); } catch { data = null; }
    if (data?.type !== "Item" || !data.uuid) return ui.notifications.warn("Arraste um item da ficha do personagem.");
    const p = pilhaAtual();
    if (!p?.aberta) return ui.notifications.warn("A fogueira está apagada.");
    const item = await fromUuid(data.uuid);
    if (item?.parent?.documentName !== "Actor") return ui.notifications.warn("Arraste da ficha de um personagem, não do diretório de itens.");
    if (!item.isOwner) return ui.notifications.warn(`Você não controla ${item.parent.name}.`);
    const categoria = categoriaDoItem(item);
    if (!categoria) return ui.notifications.warn(`${item.name} não conta como comida nem bebida.`);
    const tem = Number(item.system.quantity) || 0;
    if (tem < 1) return ui.notifications.warn(`${item.parent.name} não tem ${item.name}.`);
    let quantidade = 1;
    if (tem > 1) {
      const c = contarPilha(p)[categoria];
      const falta = c.precisa - c.tem;
      const sugestao = falta > 0 ? Math.min(tem, falta) : tem;
      quantidade = await foundry.applications.api.DialogV2.prompt({
        classes: ["mono"], window: { title: `Fogueira: ${item.name}`, icon: "fas fa-fire" }, position: { width: 320 },
        content: `<div class="mr-form"><p>${esc(item.parent.name)} tem <b>${tem}</b>. Quantos vão para a pilha?</p>
          <input type="number" name="qtd" min="1" max="${tem}" step="1" value="${sugestao}" autofocus></div>`,
        ok: { label: "Colocar", callback: (e, btn) => Number(btn.form.elements.qtd.value) }
      }).catch(() => null);
      if (!quantidade) return;
    }
    pedirAoMestre({ acao: "contribuir", itemUuid: item.uuid, quantidade });
  }

  static #retirar(ev, el) { pedirAoMestre({ acao: "devolver", contribId: el.dataset.id }); }
  static #servir() { servir(); }
  static async #apagar() {
    const p = pilhaAtual();
    const ok = await foundry.applications.api.DialogV2.confirm({
      classes: ["mono"], window: { title: "Apagar a fogueira" },
      content: `<p>Devolver tudo aos donos${p?.pedido ? " e cancelar o descanso pedido" : ""}?</p>`
    }).catch(() => false);
    if (ok) apagar();
  }
  static #ficha(ev, el) {
    const a = game.actors.get(el.dataset.actor);
    if (a?.isOwner) a.sheet?.render(true);
  }
}
