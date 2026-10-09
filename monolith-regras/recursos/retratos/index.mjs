/**
 * Recurso "Retratos" (substitui vtta-tokenizer). Código novo, sem nada do original.
 * Editor leve em Canvas2D: enquadra a imagem, aplica máscara e moldura de Monolith,
 * grava um webp na pasta do mundo e troca a imagem do token do ator.
 */
import { lerPasta, pastaComum, limitar } from "./compor.mjs";
import { IDS_MOLDURAS } from "./molduras.mjs";
import { carregarImagem, renderizar, salvarLocal, dataUrlParaBlob, imagemPadrao, podeEnviar } from "./arquivo.mjs";
import { criarEditor, estadoInicial } from "./editor.mjs";

let Editor = null;
let Config = null;
let CTX = null;

/** Quem pode abrir o editor para este ator. */
function podeUsar(actor) {
  if (!actor || !CTX) return false;
  if (game.user.isGM) return true;
  if (CTX.get("apenasMestre")) return false;
  return actor.isOwner;
}

export function abrirRetratos(actor) {
  if (!podeUsar(actor)) return ui.notifications.warn(CTX.t("semPermissao"));
  return Editor.abrir(actor);
}

/** Gera o token com o enquadramento padrão, sem abrir janela (criação automática, macros). */
export async function gerarAutomatico(actor, { src = actor.img, todasCenas = false } = {}) {
  const img = await carregarImagem(src);
  const e = estadoInicial(CTX, actor);
  const blob = await renderizar(e, img, CTX.get("tamanho") || 400);
  return salvarLocal(CTX, actor, blob, { todasCenas, estado: { ...e, origem: src } });
}

const opcoesMolduras = (t) => Object.fromEntries(["nenhuma", ...IDS_MOLDURAS].map((id) => [id, t(`moldura.${id}`)]));

export default {
  id: "retratos",
  nome: "Retratos",
  descricao: "Cria a imagem do token a partir do retrato: enquadrar, recortar em círculo ou quadrado, moldura de Monolith. Botão no cabeçalho da ficha, no menu do retrato (Tidy) e no diretório de atores.",
  original: ["vtta-tokenizer"],
  padrao: true,

  iniciar(ctx) {
    CTX = ctx;
    const t = ctx.t;
    const reg = (k, dados) => ctx.registrar(k, { scope: "world", config: false, ...dados });
    reg("pasta", { type: String, default: "tokens" });
    reg("subpastas", { type: Boolean, default: true });
    reg("tamanho", { type: Number, default: 400 });
    reg("mascara", { type: String, default: "circulo" });
    reg("molduraPersonagem", { type: String, default: "osso" });
    reg("molduraNpc", { type: String, default: "ferro" });
    reg("todasCenas", { type: Boolean, default: false });
    reg("apenasMestre", { type: Boolean, default: false });
    reg("autoCriar", { type: Boolean, default: false });
    reg("menuDiretorio", { type: Boolean, default: true });

    Editor = criarEditor(ctx);
    Config = criarConfig(ctx);
    ctx.registrarMenu("config", {
      name: "MONOLITH.retratos.config.titulo", label: "MONOLITH.retratos.config.botao", hint: "MONOLITH.retratos.config.dica",
      icon: "fas fa-circle-user", type: Config, restricted: true
    });

    // Fichas que não são Tidy (dnd5e padrão e outras V2): botão no cabeçalho.
    Hooks.on("getHeaderControlsActorSheetV2", (app, controls) => {
      if (app.options?.classes?.includes("tidy5e-sheet")) return;
      const actor = app.document ?? app.actor;
      if (!podeUsar(actor)) return;
      controls.push({ icon: "fas fa-circle-user", label: "MONOLITH.retratos.abrir", action: "monolithRetratos", onClick: () => abrirRetratos(actor) });
    });

    // Tidy 5e: menu do cabeçalho de todas as fichas de ator e menu de contexto do retrato.
    Hooks.once("tidy5e-sheet.ready", (api) => {
      try {
        api.registerActorHeaderControls?.({
          controls: [{
            icon: "fas fa-circle-user",
            label: "MONOLITH.retratos.abrir",
            visible() { return podeUsar(this.document ?? this.actor); },
            async onClickAction() { abrirRetratos(this.document ?? this.actor); }
          }]
        });
        api.config?.actorPortrait?.registerMenuCommands?.([{
          label: "MONOLITH.retratos.abrir",
          iconClass: "fas fa-circle-user fa-fw",
          enabled: (p) => podeUsar(p.actor),
          execute: (p) => abrirRetratos(p.actor)
        }]);
      } catch (err) { console.warn(`${ctx.ID} | retratos: Tidy`, err); }
    });

    // Diretório de atores: clique direito.
    Hooks.on("getActorContextOptions", (app, opcoes) => {
      if (!ctx.get("menuDiretorio")) return;
      const ator = (li) => { const el = li?.dataset ? li : li?.[0]; return game.actors.get(el?.dataset?.entryId ?? el?.dataset?.documentId); };
      opcoes.push({
        name: "MONOLITH.retratos.abrir",
        icon: `<i class="fas fa-circle-user"></i>`,
        condition: (li) => podeUsar(ator(li)),
        callback: (li) => abrirRetratos(ator(li))
      });
    });

    // Jogador sem permissão de envio de arquivos: o Mestre ativo grava por ele.
    ctx.socket.ouvir(async (msg, userId) => {
      if (msg?.tipo !== "salvar" || !game.users.activeGM?.isSelf) return;
      const user = game.users.get(userId);
      try {
        const actor = await fromUuid(msg.uuid);
        if (!actor || !user || !actor.testUserPermission(user, "OWNER")) throw new Error(t("semPermissao"));
        if (ctx.get("apenasMestre") && !user.isGM) throw new Error(t("semPermissao"));
        const blob = await dataUrlParaBlob(msg.token);
        let origem = null;
        if (msg.origem?.tipo === "dataUrl") origem = { tipo: "blob", blob: await dataUrlParaBlob(msg.origem.src) };
        else if (msg.origem?.tipo === "caminho") origem = { tipo: "caminho", src: msg.origem.src };
        await salvarLocal(ctx, actor, blob, { origem, modoRetrato: msg.modoRetrato, todasCenas: !!msg.todasCenas, estado: msg.estado });
        ui.notifications.info(t("salvoPor", { nome: actor.name, user: user.name }));
      } catch (err) {
        console.error(`${ctx.ID} | retratos: pedido de ${user?.name}`, err);
        ui.notifications.error(`${t("erroSalvar")} ${err?.message ?? ""}`);
      }
    });

    // Criação automática: ator novo com retrato próprio mas sem imagem própria de token.
    Hooks.on("createActor", async (actor) => {
      if (!ctx.get("autoCriar") || actor.pack || !game.users.activeGM?.isSelf || !podeEnviar()) return;
      const tok = actor.prototypeToken?.texture?.src;
      if (imagemPadrao(actor.img) || !(imagemPadrao(tok) || tok === actor.img)) return;
      try { await gerarAutomatico(actor); }
      catch (err) { console.warn(`${ctx.ID} | retratos: token automático de ${actor.name}`, err); }
    });

    Hooks.once("ready", () => {
      const m = game.modules.get(ctx.ID);
      if (m) m.api = { ...(m.api ?? {}), retratos: { abrir: abrirRetratos, gerar: gerarAutomatico } };
    });
  },

  /** Traz do Tokenizer: pasta de envio, só-Mestre, se a mesa usava moldura e o tamanho. */
  async migrar(ctx) {
    const velho = ctx.configsAntigas("vtta-tokenizer");
    if (!Object.keys(velho).length) return;
    const sim = (v) => v === true || v === "true";
    const pc = velho["image-upload-directory"] ? lerPasta(velho["image-upload-directory"]) : null;
    const npc = velho["npc-image-upload-directory"] ? lerPasta(velho["npc-image-upload-directory"]) : null;
    if (pc?.pasta || npc?.pasta) {
      const fonte = pc?.fonte ?? npc.fonte;
      const bucket = pc?.bucket ?? npc?.bucket;
      const base = pastaComum(pc?.pasta, npc?.pasta) || pc?.pasta || npc?.pasta;
      const prefixo = fonte !== "data" ? `[${fonte}${bucket ? `:${bucket}` : ""}] ` : "";
      await ctx.set("pasta", `${prefixo}${base}`);
      await ctx.set("subpastas", true);
    }
    if (velho["disable-player"] !== undefined) await ctx.set("apenasMestre", sim(velho["disable-player"]));
    if (velho["add-frame-default"] !== undefined && !sim(velho["add-frame-default"])) {
      await ctx.set("molduraPersonagem", "nenhuma");
      await ctx.set("molduraNpc", "nenhuma");
    }
    const tam = Number(velho["token-size"]);
    if (tam >= 64 && tam <= 2048) await ctx.set("tamanho", tam);
  },

  configurar(ctx) {
    new (Config ?? criarConfig(ctx))().render(true);
  }
};

/* ---------- Janela de configuração ---------- */

function criarConfig(ctx) {
  const { ApplicationV2 } = foundry.applications.api;
  const t = ctx.t;
  const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
  const opt = (obj, atual) => Object.entries(obj).map(([v, r]) => `<option value="${v}" ${v === atual ? "selected" : ""}>${esc(r)}</option>`).join("");

  return class ConfigRetratos extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: "monolith-retratos-config",
      classes: ["mono", "monolith-retratos-config"],
      tag: "form",
      window: { title: "MONOLITH.retratos.config.titulo", icon: "fas fa-circle-user" },
      position: { width: 580, height: "auto" },
      form: { handler: ConfigRetratos.#salvar, closeOnSubmit: true },
      actions: { escolherPasta: ConfigRetratos.#escolherPasta }
    };

    async _renderHTML() {
      const g = (k) => ctx.get(k);
      const molduras = opcoesMolduras(t);
      const campo = (k, controle) => `<div class="mono-field"><label class="mono-field__label" for="mr-${k}">${t(`config.${k}`)}</label>${controle}<p class="mono-field__hint">${t(`config.${k}Dica`)}</p></div>`;
      const chave = (k) => campo(k, `<input type="checkbox" class="mono-toggle" id="mr-${k}" name="${k}" ${g(k) ? "checked" : ""}>`);
      return `<div class="mr-config">
        ${campo("pasta", `<div class="mr-pasta"><input type="text" id="mr-pasta" name="pasta" value="${esc(g("pasta"))}"><button type="button" data-action="escolherPasta" aria-label="${esc(t("config.escolherPasta"))}"><i class="fas fa-folder-open"></i></button></div>`)}
        ${chave("subpastas")}
        ${campo("tamanho", `<input type="number" id="mr-tamanho" name="tamanho" min="64" max="2048" value="${g("tamanho")}">`)}
        ${campo("mascara", `<select id="mr-mascara" name="mascara">${opt({ circulo: t("mascara.circulo"), quadrado: t("mascara.quadrado") }, g("mascara"))}</select>`)}
        ${campo("molduraPersonagem", `<select id="mr-molduraPersonagem" name="molduraPersonagem">${opt(molduras, g("molduraPersonagem"))}</select>`)}
        ${campo("molduraNpc", `<select id="mr-molduraNpc" name="molduraNpc">${opt(molduras, g("molduraNpc"))}</select>`)}
        ${chave("todasCenas")}
        ${chave("apenasMestre")}
        ${chave("autoCriar")}
        ${chave("menuDiretorio")}
        <footer class="mr-rodape"><button type="submit"><i class="fas fa-save"></i> ${t("salvarConfig")}</button></footer>
      </div>`;
    }

    _replaceHTML(result, content) { content.innerHTML = result; }

    static #escolherPasta() {
      const input = this.element.querySelector("[name=pasta]");
      const { fonte, pasta } = lerPasta(input.value);
      new (foundry.applications.apps.FilePicker.implementation)({
        type: "folder", current: pasta, activeSource: fonte,
        callback: (path) => { input.value = fonte !== "data" ? `[${fonte}] ${path}` : path; }
      }).render(true);
    }

    static async #salvar(ev, form) {
      const f = form.elements;
      await ctx.set("pasta", f.pasta.value.trim() || "tokens");
      await ctx.set("tamanho", limitar(Math.round(Number(f.tamanho.value) || 400), 64, 2048));
      for (const k of ["mascara", "molduraPersonagem", "molduraNpc"]) await ctx.set(k, f[k].value);
      for (const k of ["subpastas", "todasCenas", "apenasMestre", "autoCriar", "menuDiretorio"]) await ctx.set(k, f[k].checked);
    }
  };
}
