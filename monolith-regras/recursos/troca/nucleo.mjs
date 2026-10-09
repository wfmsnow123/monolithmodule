/**
 * Núcleo da Troca: a oferta, a transferência (item com conteúdo e moedas), os cartões de chat e o socket.
 * Derivado de lets-trade-core.js e trade-request.js do Let's Trade 5e 0.6.0 (MIT, Charles Miller).
 *
 * O pedido é uma mensagem de chat (sussurrada a quem envia, aos donos de quem recebe e ao Mestre) com a oferta
 * numa flag. Assim ela espera quem está offline e o Mestre pode decidir por qualquer um.
 * Quem executa a troca precisa poder editar os dois atores: o Mestre ativo, ou um usuário dono dos dois.
 * Sem Mestre online, a troca acontece em duas partes: quem enviou retira (e guarda o pacote na mensagem),
 * o dono de quem recebe entrega; uma marca no ator de destino impede entregar duas vezes.
 */

export const S = { ctx: null };
const t = (k, d) => S.ctx.t(k, d);
export const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

export const ESTADOS = ["pendente", "emTransito", "aceita", "recusada", "cancelada", "invalida"];
const emCurso = new Set();

/* ---------- Utilidades ---------- */

export const ehPilha = (actor) => !!(actor?.getFlag?.("item-piles", "data")?.enabled || game.itempiles?.API?.isValidItemPile?.(actor));
export const ehFisico = (item) => !!item && item.system && "quantity" in item.system;
const ator = (uuid) => (uuid ? fromUuidSync(uuid) : null);
const OWNER = () => CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;

/** Jogadores (não Mestres) donos do ator. */
export const donos = (actor) => game.users.filter((u) => !u.isGM && actor?.testUserPermission?.(u, OWNER()));
export const donosOnline = (actor) => donos(actor).filter((u) => u.active);
const mestres = () => game.users.filter((u) => u.isGM).map((u) => u.id);

/** Moedas configuradas no mundo (custom-dnd5e muda CONFIG.DND5E.currencies). */
export function moedas() {
  return Object.entries(CONFIG.DND5E?.currencies ?? {}).map(([k, c]) => ({
    k, nome: game.i18n.localize(c.label ?? k), abrev: game.i18n.localize(c.abbreviation ?? k), icone: c.icon ?? null
  }));
}
const temMoedas = (m) => Object.values(m ?? {}).some((v) => Number(v) > 0);

export const oferta = (msg) => msg?.getFlag?.(S.ctx.ID, `${S.ctx.recurso}.oferta`) ?? null;

/* ---------- Cartões ---------- */

function resumo(o) {
  const linhas = [];
  if (o.item) {
    const extra = o.item.conteudo ? ` <small>${esc(t("comConteudo", { n: o.item.conteudo }))}</small>` : "";
    linhas.push(`<li><img src="${esc(o.item.img)}" alt=""><span><b>${o.item.quantidade > 1 ? `${o.item.quantidade}× ` : ""}${esc(o.item.nome)}</b>${extra}</span></li>`);
  }
  const lista = moedas();
  for (const [k, v] of Object.entries(o.moedas ?? {})) {
    if (!(v > 0)) continue;
    const m = lista.find((x) => x.k === k) ?? { nome: k, icone: null };
    linhas.push(`<li>${m.icone ? `<img src="${esc(m.icone)}" alt="">` : `<i class="fas fa-coins"></i>`}<span><b>${v}</b> ${esc(m.nome)}</span></li>`);
  }
  return `<ul class="mt-itens">${linhas.join("")}</ul>`;
}

export function textoResumo(o) {
  const partes = [];
  if (o.item) partes.push(`${o.item.quantidade > 1 ? `${o.item.quantidade}× ` : ""}${o.item.nome}`);
  const lista = moedas();
  for (const [k, v] of Object.entries(o.moedas ?? {})) if (v > 0) partes.push(`${v} ${lista.find((x) => x.k === k)?.nome ?? k}`);
  return partes.join(", ");
}

const fluxo = (o) => `<div class="mt-fluxo">
  <span class="mt-quem"><img src="${esc(o.de.img)}" alt=""><b>${esc(o.de.nome)}</b></span>
  <i class="fas fa-arrow-right-long"></i>
  <span class="mt-quem"><img src="${esc(o.para.img)}" alt=""><b>${esc(o.para.nome)}</b></span>
</div>`;

export function cartaoPedido(o) {
  const nome = (id) => esc(game.users.get(id)?.name ?? "?");
  let rodape;
  if (o.estado === "pendente") {
    rodape = `<div class="mt-acoes">
      <button type="button" data-troca="aceitar"><i class="fas fa-check"></i> ${esc(t("aceitar"))}</button>
      <button type="button" data-troca="recusar"><i class="fas fa-xmark"></i> ${esc(t("recusar"))}</button>
      <button type="button" data-troca="cancelar" class="mt-sec"><i class="fas fa-rotate-left"></i> ${esc(t("cancelar"))}</button>
    </div><p class="mt-espera" data-troca-espera>${esc(t("aguardando", { nome: o.para.nome }))}</p>`;
  } else {
    const txt = {
      emTransito: t("estado.emTransito"), aceita: t("estado.aceita", { nome: nome(o.por) }),
      recusada: t("estado.recusada", { nome: nome(o.por) }), cancelada: t("estado.cancelada"),
      invalida: t("estado.invalida", { motivo: o.motivo ?? "" })
    }[o.estado] ?? o.estado;
    rodape = `<p class="mt-estado mt-${o.estado}">${esc(txt)}</p>`;
  }
  return `<div class="mono-card mt-card" data-estado="${o.estado}">
  <header><i class="fas fa-hand-holding"></i> ${esc(t("tituloPedido"))}</header>
  <div class="mono-card__body">${fluxo(o)}${resumo(o)}${o.nota ? `<blockquote class="mt-nota">${esc(o.nota)}</blockquote>` : ""}${rodape}</div>
</div>`;
}

function cartaoResultado(o) {
  const titulo = o.estado === "aceita" ? (o.direto ? t("tituloEntregue") : t("tituloAceita")) : o.estado === "recusada" ? t("tituloRecusada") : t("tituloCancelada");
  const icone = o.estado === "aceita" ? "fa-handshake" : "fa-hand";
  return `<div class="mono-card mt-card mt-resultado" data-estado="${o.estado}">
  <header><i class="fas ${icone}"></i> ${esc(titulo)}</header>
  <div class="mono-card__body">${fluxo(o)}${resumo(o)}${o.nota && o.direto ? `<blockquote class="mt-nota">${esc(o.nota)}</blockquote>` : ""}</div>
</div>`;
}

function destinatarios(o) {
  const ids = new Set([...mestres(), o.de.usuario]);
  for (const u of donos(ator(o.para.ator))) ids.add(u.id);
  return [...ids].filter(Boolean);
}

async function postarResultado(o) {
  const src = ator(o.de.ator);
  const publico = S.ctx.get("cartaoPublico");
  await ChatMessage.create({
    content: cartaoResultado(o),
    speaker: ChatMessage.getSpeaker({ actor: src ?? undefined }),
    whisper: publico ? [] : destinatarios(o)
  });
}

/* ---------- Validação e transferência ---------- */

export function validar(o) {
  const src = ator(o.de.ator), dst = ator(o.para.ator);
  if (!src || !dst) return t("erro.atorSumiu");
  if (src === dst || src.uuid === dst.uuid) return t("erro.mesmoAtor");
  if (o.item) {
    const item = src.items.get(o.item.id);
    if (!item) return t("erro.itemSumiu", { item: o.item.nome });
    if ((item.system.quantity ?? 1) < o.item.quantidade) return t("erro.quantidade", { item: item.name });
  }
  for (const [k, v] of Object.entries(o.moedas ?? {})) {
    if (!(v > 0)) continue;
    if ((Number(src.system.currency?.[k]) || 0) < v) return t("erro.moedas");
  }
  if (!o.item && !temMoedas(o.moedas)) return t("erro.vazio");
  return null;
}

/** Dados de criação do item (e do que ele carrega, se for recipiente), com ids novos. */
async function prepararPacote(src, o) {
  if (!o.item) return [];
  const item = src.items.get(o.item.id);
  if (!item) return [];
  const Item5e = CONFIG.Item.documentClass;
  const limpar = (obj) => {
    obj.system ??= {};
    if ("equipped" in obj.system) obj.system.equipped = false;
    if ("attuned" in obj.system) obj.system.attuned = false;
    delete obj.sort; delete obj.folder; delete obj.ownership;
    return obj;
  };
  if (typeof Item5e.createWithContents === "function") {
    const dados = await Item5e.createWithContents([item], {
      transformFirst: (d) => {
        const obj = d instanceof foundry.abstract.Document ? d.toObject() : foundry.utils.deepClone(d);
        obj.system.quantity = o.item.quantidade;
        return limpar(obj);
      }
    });
    const topo = dados?.[0];
    if (topo) topo.system = { ...topo.system, container: null };
    return (dados ?? []).map((d) => (d === topo ? d : limpar(d)));
  }
  const obj = limpar(item.toObject());
  obj.system.quantity = o.item.quantidade;
  obj.system.container = null;
  obj._id = foundry.utils.randomID();
  return [obj];
}

async function retirar(src, o) {
  if (o.item) {
    const item = src.items.get(o.item.id);
    const q = item.system.quantity ?? 1;
    if (o.item.quantidade >= q) await item.delete({ deleteContents: true });
    else await item.update({ "system.quantity": q - o.item.quantidade });
  }
  if (temMoedas(o.moedas)) {
    const upd = {};
    for (const [k, v] of Object.entries(o.moedas)) if (v > 0) upd[`system.currency.${k}`] = (Number(src.system.currency?.[k]) || 0) - v;
    await src.update(upd);
  }
}

/** Empilha num item igual (mesmo tipo, nome e origem) que já está solto no inventário, se houver. */
function pilhaIgual(dst, dados) {
  if (dados.length !== 1 || dados[0].type === "container") return null;
  const d = dados[0];
  const origem = d._stats?.compendiumSource ?? d.flags?.core?.sourceId ?? null;
  return dst.items.find((i) => i.type === d.type && i.name === d.name && !i.system.container
    && (i._stats?.compendiumSource ?? i.flags?.core?.sourceId ?? null) === origem && "quantity" in i.system) ?? null;
}

async function entregar(dst, pacote, moedasOferta) {
  if (pacote?.length) {
    const pilha = pilhaIgual(dst, pacote);
    if (pilha) await pilha.update({ "system.quantity": (pilha.system.quantity ?? 0) + (pacote[0].system?.quantity ?? 1) });
    else await CONFIG.Item.documentClass.createDocuments(pacote, { parent: dst, keepId: true });
  }
  if (temMoedas(moedasOferta)) {
    const upd = {};
    for (const [k, v] of Object.entries(moedasOferta)) if (v > 0) upd[`system.currency.${k}`] = (Number(dst.system.currency?.[k]) || 0) + v;
    await dst.update(upd);
  }
}

/** Entrega só uma vez por mensagem (marca no ator de destino). */
async function entregarUmaVez(dst, msgId, pacote, moedasOferta) {
  const recebidas = S.ctx.getFlag(dst, "recebidas") ?? [];
  if (recebidas.includes(msgId)) return false;
  await entregar(dst, pacote, moedasOferta);
  await S.ctx.setFlag(dst, "recebidas", [...recebidas, msgId].slice(-50));
  return true;
}

/** Transferência completa feita por quem edita os dois atores. */
async function transferir(o) {
  const src = ator(o.de.ator), dst = ator(o.para.ator);
  const pacote = await prepararPacote(src, o);
  await retirar(src, o);
  await entregar(dst, pacote, o.moedas);
}

/* ---------- Mensagem ---------- */

async function atualizar(msg, patch) {
  const nova = { ...oferta(msg), ...patch };
  await msg.update({ content: cartaoPedido(nova), [S.ctx.caminhoFlag("oferta")]: nova });
  return nova;
}

/** Monta a oferta a partir do que foi escolhido na janela. */
export function montarOferta({ src, dst, item, quantidade, moedas: m, nota }) {
  const conteudo = item?.type === "container" ? (item.system.allContainedItems?.size ?? item.system.contents?.size ?? 0) : 0;
  return {
    v: 1, estado: "pendente",
    de: { ator: src.uuid, nome: src.name, img: src.img, usuario: game.user.id },
    para: { ator: dst.uuid, nome: dst.name, img: dst.img },
    item: item ? { id: item.id, nome: item.name, img: item.img, quantidade: Math.max(1, Number(quantidade) || 1), conteudo } : null,
    moedas: Object.fromEntries(Object.entries(m ?? {}).map(([k, v]) => [k, Math.max(0, Math.floor(Number(v) || 0))]).filter(([, v]) => v > 0)),
    nota: String(nota ?? "").trim().slice(0, 300),
    criada: Date.now()
  };
}

/** Envia: direto (Mestre, ou dono dos dois) ou como pedido no chat. */
export async function enviar(o, { direto = false } = {}) {
  const erro = validar(o);
  if (erro) return ui.notifications.warn(erro);
  const dst = ator(o.para.ator), src = ator(o.de.ator);
  const podeTudo = game.user.isGM || (src.isOwner && dst.isOwner);
  if (podeTudo && (direto || !game.user.isGM)) {
    await transferir(o);
    const final = { ...o, estado: "aceita", por: game.user.id, direto: true };
    await postarResultado(final);
    return ui.notifications.info(t("entregue", { item: textoResumo(o), nome: dst.name }));
  }
  await ChatMessage.create({
    content: cartaoPedido(o),
    speaker: ChatMessage.getSpeaker({ actor: src }),
    whisper: destinatarios(o),
    flags: { [S.ctx.ID]: { [`${S.ctx.recurso}.oferta`]: o } }
  });
  const online = donosOnline(dst).length;
  ui.notifications.info(online ? t("pedidoEnviado", { nome: dst.name }) : t("pedidoEspera", { nome: dst.name }));
}

/* ---------- Decisão ---------- */

export const podeDecidir = (o) => game.user.isGM || !!ator(o?.para?.ator)?.isOwner;
export const podeCancelar = (msg, o) => game.user.isGM || msg.author?.id === game.user.id || o?.de?.usuario === game.user.id;

/** Chamado pelo botão do cartão ou da janela de pedido. */
export async function decidir(msg, decisao) {
  const o = oferta(msg);
  if (!o) return;
  if (o.estado !== "pendente") return ui.notifications.warn(t("jaResolvida"));
  if (decisao === "cancelar") {
    if (!podeCancelar(msg, o)) return;
    if (msg.isOwner) return executar(msg, "cancelar", game.user.id);
    return pedirAoMestreOuAutor(msg, "cancelar");
  }
  if (!podeDecidir(o)) return;
  const src = ator(o.de.ator), dst = ator(o.para.ator);
  if (msg.isOwner && (game.user.isGM || (src?.isOwner && dst?.isOwner))) return executar(msg, decisao, game.user.id);
  return pedirAoMestreOuAutor(msg, decisao);
}

function pedirAoMestreOuAutor(msg, decisao) {
  if (game.users.activeGM) {
    S.ctx.socket.emitir({ op: "executar", msg: msg.id, decisao, por: game.user.id });
    return ui.notifications.info(t("enviadoMestre"));
  }
  if (msg.author?.active) {
    S.ctx.socket.emitir({ op: decisao === "aceitar" ? "retirar" : "fechar", msg: msg.id, decisao, por: game.user.id });
    return;
  }
  ui.notifications.warn(t("precisaOnline", { nome: msg.author?.name ?? "?" }));
}

/** Execução completa (Mestre, ou dono dos dois que é autor da mensagem). */
async function executar(msg, decisao, por) {
  if (emCurso.has(msg.id)) return;
  emCurso.add(msg.id);
  try {
    const o = oferta(msg);
    if (!o || o.estado !== "pendente") return;
    if (decisao !== "aceitar") {
      const nova = await atualizar(msg, { estado: decisao === "recusar" ? "recusada" : "cancelada", por });
      if (decisao === "recusar") await postarResultado(nova);
      return;
    }
    const erro = validar(o);
    if (erro) { await atualizar(msg, { estado: "invalida", motivo: erro, por }); return; }
    await transferir(o);
    const nova = await atualizar(msg, { estado: "aceita", por });
    await postarResultado(nova);
  } catch (err) {
    console.error(`${S.ctx.ID} | troca`, err);
    ui.notifications.error(t("erro.falhou"));
  } finally {
    emCurso.delete(msg.id);
  }
}

/* ---------- Caminho sem Mestre (duas partes) ---------- */

async function retirarPar(msg, por) {
  if (emCurso.has(msg.id)) return;
  emCurso.add(msg.id);
  try {
    const o = oferta(msg);
    if (!o || o.estado !== "pendente") return;
    const erro = validar(o);
    if (erro) return void (await atualizar(msg, { estado: "invalida", motivo: erro, por }));
    const src = ator(o.de.ator);
    const pacote = await prepararPacote(src, o);
    await retirar(src, o);
    await atualizar(msg, { estado: "emTransito", pacote, por });
    S.ctx.socket.emitir({ op: "entregar", msg: msg.id });
  } finally {
    emCurso.delete(msg.id);
  }
}

/** Sou eu quem entrega? O usuário que aceitou, ou o primeiro dono online se ele saiu. */
function souEntregador(o) {
  const dst = ator(o.para.ator);
  if (!dst?.isOwner || game.user.isGM) return false;
  const quem = game.users.get(o.por);
  if (quem?.active && !quem.isGM && dst.testUserPermission(quem, OWNER())) return quem.isSelf;
  const online = donosOnline(dst).sort((a, b) => a.id.localeCompare(b.id));
  return online[0]?.isSelf ?? false;
}

async function entregarPar(msg) {
  const o = oferta(msg);
  if (!o || o.estado !== "emTransito") return;
  const dst = ator(o.para.ator);
  if (!dst) return;
  await entregarUmaVez(dst, msg.id, o.pacote, o.moedas);
  S.ctx.socket.emitir({ op: "entregue", msg: msg.id });
  if (msg.isOwner) await concluirPar(msg);
}

async function concluirPar(msg) {
  const o = oferta(msg);
  if (!o || o.estado !== "emTransito") return;
  const nova = await atualizar(msg, { estado: "aceita", pacote: null });
  await postarResultado(nova);
}

/** No "ready": termina trocas que ficaram no meio (alguém caiu entre retirar e entregar). */
export async function recuperar() {
  const msgs = game.messages.contents.slice(-200).filter((m) => oferta(m)?.estado === "emTransito");
  for (const msg of msgs) {
    const o = oferta(msg);
    const dst = ator(o.para.ator);
    if (!dst) continue;
    try {
      if (game.users.activeGM?.isSelf) {
        await entregarUmaVez(dst, msg.id, o.pacote, o.moedas);
        await concluirPar(msg);
      } else if (!game.users.activeGM && souEntregador(o)) {
        await entregarPar(msg);
      } else if (msg.isOwner && (S.ctx.getFlag(dst, "recebidas") ?? []).includes(msg.id)) {
        await concluirPar(msg);
      }
    } catch (err) { console.error(`${S.ctx.ID} | troca: recuperação`, err); }
  }
}

/* ---------- Socket ---------- */

export function ouvirSocket() {
  S.ctx.socket.ouvir(async (d) => {
    const msg = game.messages.get(d?.msg);
    if (!msg) return;
    switch (d.op) {
      case "executar":
        if (game.users.activeGM?.isSelf) await executar(msg, d.decisao, d.por);
        break;
      case "retirar":
        if (msg.author?.isSelf && !game.users.activeGM) await retirarPar(msg, d.por);
        else if (game.users.activeGM?.isSelf) await executar(msg, "aceitar", d.por);
        break;
      case "fechar":
        if (msg.author?.isSelf || game.users.activeGM?.isSelf) await executar(msg, d.decisao, d.por);
        break;
      case "entregar":
        if (souEntregador(oferta(msg) ?? {})) await entregarPar(msg);
        break;
      case "entregue":
        if (msg.author?.isSelf) await concluirPar(msg);
        break;
    }
  });
}
