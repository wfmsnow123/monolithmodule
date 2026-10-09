/**
 * Recurso "Troca": dar itens e moedas a outro personagem, com pedido e aceite.
 * Porta e releitura do Let's Trade 5e 0.6.0 (MIT, Charles Miller). Veja LICENSE-ORIGINAL.txt.
 *
 * Entradas: "Dar a..." no menu de contexto do item (dnd5e e Tidy), "Dar moedas..." no cabeçalho da ficha,
 * e arrastar um item da ficha para o token de outro personagem no mapa.
 */
import { S, oferta, ehPilha, ehFisico, podeDecidir, podeCancelar, decidir, ouvirSocket, recuperar, textoResumo } from "./nucleo.mjs";
import { abrirDar, abrirPedido, fecharPedidoResolvido } from "./dialogo.mjs";

const t = (k, d) => S.ctx.t(k, d);
const ICONE = "fas fa-hand-holding";
const ehTidy = (app) => !!app?.options?.classes?.includes("tidy5e-sheet");

/** Token sob o ponto do mapa (o de cima primeiro). */
function tokenEm(x, y) {
  const lista = canvas?.tokens?.placeables ?? [];
  for (let i = lista.length - 1; i >= 0; i--) {
    const tk = lista[i];
    if (tk.visible !== false && tk.actor && tk.bounds?.contains(x, y)) return tk;
  }
  return null;
}

function aoSoltarNoMapa(_canvas, data) {
  if (!S.ctx.get("arrastarToken") || data?.type !== "Item" || !data.uuid) return;
  const item = fromUuidSync(data.uuid);
  const src = item?.parent;
  if (!(src instanceof Actor) || !src.isOwner || !ehFisico(item) || ehPilha(src)) return;
  const tk = tokenEm(data.x, data.y);
  const dst = tk?.actor;
  if (!dst || ehPilha(dst) || dst.uuid === src.uuid) return;
  if (!game.user.isGM && !dst.hasPlayerOwner) return; // NPC sem dono: deixa para outros módulos
  abrirDar({ ator: src, item, para: dst });
  return false;
}

function ligarCartao(msg, html) {
  const o = oferta(msg);
  if (!o) return;
  const card = html.querySelector?.(".mt-card");
  if (!card) return;
  if (o.estado !== "pendente") return;
  const decide = podeDecidir(o), cancela = podeCancelar(msg, o);
  card.querySelectorAll("[data-troca]").forEach((b) => {
    const acao = b.dataset.troca;
    const pode = acao === "cancelar" ? cancela : decide;
    if (!pode) return b.remove();
    if (acao === "aceitar" && game.user.isGM) b.dataset.tooltip = t("aceitarPeloJogador");
    b.addEventListener("click", async (ev) => {
      ev.preventDefault();
      card.querySelectorAll("[data-troca]").forEach((x) => { x.disabled = true; });
      try { await decidir(msg, acao); } finally { card.querySelectorAll("[data-troca]").forEach((x) => { x.disabled = false; }); }
    });
  });
  if (decide) card.querySelector("[data-troca-espera]")?.remove();
  if (!card.querySelector("[data-troca]")) card.querySelector(".mt-acoes")?.remove();
}

/** O pedido é para mim (jogador dono de quem recebe, e não fui eu que mandei)? */
function paraMim(msg) {
  const o = oferta(msg);
  if (!o || o.estado !== "pendente" || game.user.isGM || o.de.usuario === game.user.id) return false;
  return !!fromUuidSync(o.para.ator)?.isOwner;
}

function registrarTidy(api) {
  api.registerCharacterHeaderControls?.({
    controls: [{
      icon: ICONE, label: t("darMoedas"),
      ownership: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
      async onClickAction() { abrirDar({ ator: this.document ?? this.actor }); }
    }]
  });
}

async function configurar(ctx) {
  const chk = (k, rotulo, dica) => `<label class="mt-check"><input type="checkbox" name="${k}" ${ctx.get(k) ? "checked" : ""}>
    <span>${rotulo}${dica ? `<small>${dica}</small>` : ""}</span></label>`;
  const r = await foundry.applications.api.DialogV2.prompt({
    classes: ["mono", "monolith-troca", "mt-config"],
    window: { title: t("tituloConfig"), icon: ICONE },
    position: { width: 460 },
    content: `<div class="mt-form">
      ${game.user.isGM ? chk("cartaoPublico", t("cfg.publico"), t("cfg.publicoDica")) + chk("arrastarToken", t("cfg.arrastar"), t("cfg.arrastarDica")) : ""}
      ${chk("janelaPedido", t("cfg.janela"), t("cfg.janelaDica"))}
      ${game.user.isGM ? chk("mestreDireto", t("cfg.direto"), t("cfg.diretoDica")) : ""}
    </div>`,
    ok: {
      label: t("salvar"), icon: "fas fa-save",
      callback: (ev, btn) => Object.fromEntries([...btn.form.querySelectorAll("input[type=checkbox]")].map((i) => [i.name, i.checked]))
    }
  }).catch(() => null);
  if (!r) return;
  for (const [k, v] of Object.entries(r)) await ctx.set(k, v);
}

export default {
  id: "troca",
  nome: "Troca",
  descricao: "Dar itens e moedas a outro personagem: \"Dar a...\" no menu do item, \"Dar moedas...\" no cabeçalho da ficha ou arrastando o item até o token. Quem recebe aceita ou recusa; o Mestre pode decidir por quem está offline ou entregar direto.",
  original: ["lets-trade-5e"],
  padrao: true,

  iniciar(ctx) {
    S.ctx = ctx;
    ctx.registrar("cartaoPublico", { scope: "world", config: false, type: Boolean, default: false });
    ctx.registrar("arrastarToken", { scope: "world", config: false, type: Boolean, default: true });
    ctx.registrar("janelaPedido", { scope: "client", config: false, type: Boolean, default: true });
    ctx.registrar("mestreDireto", { scope: "client", config: false, type: Boolean, default: true });

    // Menu de contexto do item (ficha do dnd5e e Tidy).
    Hooks.on("dnd5e.getItemContextOptions", (item, options) => {
      const actor = item?.parent;
      if (!(actor instanceof Actor) || !actor.isOwner || !ehFisico(item) || ehPilha(actor)) return;
      options.push({ name: t("darA"), icon: `<i class="${ICONE}"></i>`, callback: () => abrirDar({ ator: actor, item }) });
    });

    // Cabeçalho das fichas que não são Tidy.
    Hooks.on("getHeaderControlsActorSheetV2", (app, controls) => {
      if (ehTidy(app)) return;
      const actor = app.document;
      if (!(actor instanceof Actor) || !actor.isOwner || ehPilha(actor) || !actor.system?.currency) return;
      controls.push({ icon: ICONE, label: t("darMoedas"), action: "monolithTrocaMoedas", onClick: () => abrirDar({ ator: actor }) });
    });
    Hooks.once("tidy5e-sheet.ready", (api) => registrarTidy(api));

    // Arrastar o item até o token de outro personagem.
    Hooks.on("dropCanvasData", aoSoltarNoMapa);

    // Cartões de pedido: botões de quem pode decidir.
    Hooks.on("renderChatMessageHTML", (msg, html) => ligarCartao(msg, html));
    Hooks.on("createChatMessage", (msg) => { if (paraMim(msg) && S.ctx.get("janelaPedido")) abrirPedido(msg); });
    Hooks.on("updateChatMessage", (msg) => {
      fecharPedidoResolvido(msg);
      const o = oferta(msg);
      if (!o || o.de.usuario !== game.user.id || o.por === game.user.id) return;
      if (o.estado === "aceita") ui.notifications.info(t("avisoAceita", { nome: o.para.nome, item: textoResumo(o) }));
      else if (o.estado === "recusada") ui.notifications.info(t("avisoRecusada", { nome: o.para.nome, item: textoResumo(o) }));
      else if (o.estado === "invalida") ui.notifications.warn(t("avisoInvalida", { motivo: o.motivo ?? "" }));
    });

    Hooks.once("ready", async () => {
      ouvirSocket();
      game.modules.get(ctx.ID).api ??= {};
      game.modules.get(ctx.ID).api.troca = { dar: abrirDar };
      await recuperar();
      // Pedidos que chegaram enquanto o jogador estava fora.
      if (!game.user.isGM && S.ctx.get("janelaPedido")) {
        const pend = game.messages.contents.slice(-100).filter(paraMim);
        for (const m of pend.slice(-3)) abrirPedido(m);
      }
    });
  },

  async migrar() {
    // O Let's Trade 5e não guardava configurações nem flags: nada a migrar.
  },

  configurar(ctx) { S.ctx ??= ctx; return configurar(ctx); }
};
