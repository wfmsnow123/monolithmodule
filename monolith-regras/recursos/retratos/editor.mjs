/**
 * Retratos: janela do editor. Prévia quadrada em Canvas2D à esquerda, controles à direita.
 * A janela é montada uma vez; mudanças no estado só redesenham a prévia (nada de re-render).
 */
import { estadoPadrao, limparEstado, desenhar, arrastar, zoomNoPonto, fatorRoda, girar, limitar, ZOOM_MIN, ZOOM_MAX } from "./compor.mjs";
import { MOLDURAS, IDS_MOLDURAS, svgMoldura, dataUrlSvg, corValida } from "./molduras.mjs";
import { carregarImagem, imagemMoldura, renderizar, salvarLocal, podeEnviar, imagemPadrao, blobParaDataUrl } from "./arquivo.mjs";

const { ApplicationV2 } = foundry.applications.api;
const FP = () => foundry.applications.apps.FilePicker.implementation;
const PREVIA = 512;
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

/** Moldura e máscara padrão para um ator, conforme as configurações. */
export function estadoInicial(ctx, actor) {
  const tipo = actor.isToken ? actor.baseActor?.type : actor.type;
  const moldura = (tipo === "character" ? ctx.get("molduraPersonagem") : ctx.get("molduraNpc")) || "nenhuma";
  return estadoPadrao({
    mascara: ctx.get("mascara") || "circulo",
    moldura,
    recorte: MOLDURAS[moldura]?.recorte ?? 1
  });
}

export function criarEditor(ctx) {
  const t = ctx.t;

  class EditorRetrato extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      classes: ["mono", "monolith-retratos"],
      tag: "div",
      window: { icon: "fas fa-circle-user", resizable: false },
      position: { width: 860, height: "auto" },
      actions: {
        origemRetrato: EditorRetrato.#origemRetrato,
        origemToken: EditorRetrato.#origemToken,
        origemArquivo: EditorRetrato.#origemArquivo,
        origemUrl: EditorRetrato.#origemUrl,
        origemColar: EditorRetrato.#origemColar,
        girarEsq: function () { this.#mudar(girar(this.estado, -90)); },
        girarDir: function () { this.#mudar(girar(this.estado, 90)); },
        espelharH: function () { this.#mudar({ ...this.estado, espelharH: !this.estado.espelharH }); },
        espelharV: function () { this.#mudar({ ...this.estado, espelharV: !this.estado.espelharV }); },
        centralizar: function () { this.#mudar({ ...this.estado, x: 0, y: 0, zoom: 1, rot: 0 }); },
        mascara: function (ev, el) { this.#mudar({ ...this.estado, mascara: el.dataset.valor }); },
        moldura: EditorRetrato.#escolherMoldura,
        molduraArquivo: EditorRetrato.#molduraArquivo,
        salvar: EditorRetrato.#salvar,
        cancelar: function () { this.close(); }
      }
    };

    /** Abre (ou traz à frente) o editor do ator. */
    static abrir(actor) {
      const id = `monolith-retratos-${actor.uuid.replace(/\./g, "-")}`;
      const aberto = foundry.applications.instances.get(id);
      if (aberto) { aberto.bringToFront?.(); return aberto; }
      return new EditorRetrato({ id, actor }).render(true);
    }

    constructor(options = {}) {
      super(options);
      this.actor = options.actor;
      const salvo = ctx.getFlag(this.actor, "estado");
      const base = estadoInicial(ctx, this.actor);
      // O enquadramento salvo só vale para a mesma imagem de origem.
      this.estado = salvo && salvo.origem === this.actor.img ? limparEstado({ ...base, ...salvo }) : base;
      this.origem = null;          // { tipo: "caminho", src } | { tipo: "blob", blob, src }
      this.img = null;
      this.moldura = null;
      this.ocupado = false;
      this.ouvinteColar = (ev) => this.#aoColar(ev);
    }

    get title() { return `${t("titulo")}: ${this.actor.name}`; }

    /* ---------- HTML ---------- */

    async _renderHTML() {
      const e = this.estado;
      const tamanho = ctx.get("tamanho") || 400;
      const temToken = !imagemPadrao(this.actor.prototypeToken?.texture?.src);
      const molduras = ["nenhuma", ...IDS_MOLDURAS].map((id) =>
        `<button type="button" class="mr-moldura" data-action="moldura" data-valor="${id}" data-tooltip="${esc(t(`moldura.${id}`))}" aria-label="${esc(t(`moldura.${id}`))}">
          ${id === "nenhuma" ? `<i class="fas fa-ban"></i>` : `<img alt="" src="">`}</button>`).join("")
        + `<button type="button" class="mr-moldura" data-action="molduraArquivo" data-valor="personalizada" data-tooltip="${esc(t("moldura.personalizada"))}" aria-label="${esc(t("moldura.personalizada"))}"><i class="fas fa-folder-open"></i></button>`;
      return `
      <div class="mr-editor">
        <section class="mr-palco">
          <div class="mr-quadro" data-mascara="${e.mascara}">
            <canvas width="${PREVIA}" height="${PREVIA}" tabindex="0" aria-label="${esc(t("previa"))}"></canvas>
            <div class="mr-vazio"><i class="fas fa-image"></i><span>${t("semImagem")}</span></div>
          </div>
          <p class="hint mr-dica">${t("dicaPalco")}</p>
          <div class="mr-fontes">
            <button type="button" data-action="origemRetrato"><i class="fas fa-user"></i> ${t("origem.retrato")}</button>
            ${temToken ? `<button type="button" data-action="origemToken"><i class="fas fa-circle-user"></i> ${t("origem.token")}</button>` : ""}
            <button type="button" data-action="origemArquivo"><i class="fas fa-folder-open"></i> ${t("origem.arquivo")}</button>
            <button type="button" data-action="origemColar"><i class="fas fa-paste"></i> ${t("origem.colar")}</button>
          </div>
          <div class="mr-url">
            <input type="text" name="url" placeholder="${esc(t("origem.urlDica"))}" spellcheck="false">
            <button type="button" data-action="origemUrl" data-tooltip="${esc(t("origem.url"))}" aria-label="${esc(t("origem.url"))}"><i class="fas fa-link"></i></button>
          </div>
        </section>

        <section class="mr-controles">
          <h3>${t("secao.enquadramento")}</h3>
          <label class="mr-linha"><span>${t("zoom")}</span>
            <input type="range" name="zoom" min="${Math.log(ZOOM_MIN)}" max="${Math.log(ZOOM_MAX)}" step="0.01" value="${Math.log(e.zoom)}">
            <output data-saida="zoom"></output></label>
          <label class="mr-linha"><span>${t("rotacao")}</span>
            <input type="range" name="rot" min="-180" max="180" step="1" value="${e.rot}">
            <output data-saida="rot"></output></label>
          <div class="mr-botoes">
            <button type="button" data-action="girarEsq" data-tooltip="${esc(t("girarEsq"))}" aria-label="${esc(t("girarEsq"))}"><i class="fas fa-rotate-left"></i></button>
            <button type="button" data-action="girarDir" data-tooltip="${esc(t("girarDir"))}" aria-label="${esc(t("girarDir"))}"><i class="fas fa-rotate-right"></i></button>
            <button type="button" data-action="espelharH" data-tooltip="${esc(t("espelharH"))}" aria-label="${esc(t("espelharH"))}"><i class="fas fa-left-right"></i></button>
            <button type="button" data-action="espelharV" data-tooltip="${esc(t("espelharV"))}" aria-label="${esc(t("espelharV"))}"><i class="fas fa-up-down"></i></button>
            <button type="button" data-action="centralizar" data-tooltip="${esc(t("centralizar"))}" aria-label="${esc(t("centralizar"))}"><i class="fas fa-crosshairs"></i></button>
          </div>

          <h3>${t("secao.recorte")}</h3>
          <div class="mr-segmento" role="radiogroup">
            <button type="button" data-action="mascara" data-valor="circulo"><i class="far fa-circle"></i> ${t("mascara.circulo")}</button>
            <button type="button" data-action="mascara" data-valor="quadrado"><i class="far fa-square"></i> ${t("mascara.quadrado")}</button>
          </div>
          <label class="mr-linha"><span>${t("margem")}</span>
            <input type="range" name="recorte" min="0.6" max="1" step="0.005" value="${e.recorte}">
            <output data-saida="recorte"></output></label>

          <h3>${t("secao.moldura")}</h3>
          <div class="mr-molduras">${molduras}</div>
          <div class="mr-linha mr-cor">
            <label><input type="checkbox" name="usarTinta" ${corValida(e.tinta) ? "checked" : ""}> ${t("tinta")}</label>
            <input type="color" name="tinta" value="${corValida(e.tinta) ? e.tinta : "#a3121b"}">
          </div>
          <div class="mr-linha mr-cor">
            <label><input type="checkbox" name="usarFundo" ${corValida(e.fundo) ? "checked" : ""}> ${t("fundo")}</label>
            <input type="color" name="fundo" value="${corValida(e.fundo) ? e.fundo : "#0e1016"}">
          </div>

          <h3>${t("secao.saida")}</h3>
          <label class="mr-linha"><span>${t("tamanho")}</span>
            <input type="number" name="tamanho" min="64" max="2048" step="1" value="${tamanho}"><em>px · webp</em></label>
          <label class="mr-linha"><span>${t("retrato")}</span>
            <select name="retrato">
              <option value="manter">${t("retratoModo.manter")}</option>
              <option value="origem">${t("retratoModo.origem")}</option>
              <option value="token">${t("retratoModo.token")}</option>
            </select></label>
          ${this.actor.isToken ? `<p class="hint">${t("tokenSintetico")}</p>` : `
          <label class="mr-check"><input type="checkbox" name="todasCenas" ${ctx.get("todasCenas") ? "checked" : ""}> ${t("todasCenas")}</label>`}
        </section>
      </div>
      <footer class="mr-rodape">
        <span class="hint mr-estado"></span>
        <button type="button" data-action="cancelar">${t("cancelar")}</button>
        <button type="button" class="mono-primary" data-action="salvar"><i class="fas fa-floppy-disk"></i> ${t("salvar")}</button>
      </footer>`;
    }

    _replaceHTML(result, content) { content.innerHTML = result; }

    /* ---------- Ciclo de vida ---------- */

    async _onFirstRender(context, options) {
      await super._onFirstRender?.(context, options);
      document.addEventListener("paste", this.ouvinteColar);
    }

    async _onRender(context, options) {
      await super._onRender?.(context, options);
      const el = this.element;
      this.canvas = el.querySelector("canvas");
      this.ctx2d = this.canvas.getContext("2d");
      this.#ligarPalco();
      for (const input of el.querySelectorAll(".mr-controles input, .mr-controles select")) {
        input.addEventListener("input", () => this.#lerControle(input));
        input.addEventListener("change", () => this.#lerControle(input));
      }
      el.querySelector("input[name=url]").addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") { ev.preventDefault(); EditorRetrato.#origemUrl.call(this); }
      });
      this.#atualizarControles();
      this.#atualizarMiniaturas();
      if (!this.origem) {
        const src = !imagemPadrao(this.actor.img) ? this.actor.img
          : !imagemPadrao(this.actor.prototypeToken?.texture?.src) ? this.actor.prototypeToken.texture.src : null;
        if (src) await this.#trocarOrigem({ tipo: "caminho", src }, { manterEnquadramento: true });
        else this.#desenhar();
      } else this.#desenhar();
    }

    async _onClose(options) {
      document.removeEventListener("paste", this.ouvinteColar);
      if (this.origem?.tipo === "blob") URL.revokeObjectURL(this.origem.src);
      return super._onClose?.(options);
    }

    /* ---------- Estado ---------- */

    #mudar(novo) {
      this.estado = novo;
      this.#atualizarControles();
      this.#desenhar();
    }

    async #mudarMoldura(novo) {
      this.estado = novo;
      this.#atualizarControles();
      this.#atualizarMiniaturas();
      this.moldura = await imagemMoldura(this.estado).catch((err) => {
        ui.notifications.warn(t("erroMoldura"));
        console.warn(err);
        return null;
      });
      this.#desenhar();
    }

    #lerControle(input) {
      const e = this.estado;
      switch (input.name) {
        case "zoom": return this.#mudar({ ...e, zoom: limitar(Math.exp(Number(input.value)), ZOOM_MIN, ZOOM_MAX) });
        case "rot": return this.#mudar({ ...e, rot: Number(input.value) });
        case "recorte": return this.#mudar({ ...e, recorte: Number(input.value) });
        case "usarTinta":
        case "tinta": {
          const usar = this.element.querySelector("[name=usarTinta]").checked;
          const cor = this.element.querySelector("[name=tinta]").value;
          if (input.name === "tinta" && !usar) this.element.querySelector("[name=usarTinta]").checked = true;
          return this.#mudarMoldura({ ...e, tinta: usar || input.name === "tinta" ? cor : "" });
        }
        case "usarFundo":
        case "fundo": {
          const box = this.element.querySelector("[name=usarFundo]");
          if (input.name === "fundo") box.checked = true;
          return this.#mudar({ ...e, fundo: box.checked ? this.element.querySelector("[name=fundo]").value : "" });
        }
      }
    }

    #atualizarControles() {
      const el = this.element, e = this.estado;
      if (!el) return;
      const set = (n, v) => { const i = el.querySelector(`[name=${n}]`); if (i && document.activeElement !== i) i.value = v; };
      set("zoom", Math.log(e.zoom));
      set("rot", Math.round(e.rot));
      set("recorte", e.recorte);
      el.querySelector("[data-saida=zoom]").textContent = `${Math.round(e.zoom * 100)}%`;
      el.querySelector("[data-saida=rot]").textContent = `${Math.round(e.rot)}°`;
      el.querySelector("[data-saida=recorte]").textContent = `${Math.round(e.recorte * 100)}%`;
      el.querySelector(".mr-quadro").dataset.mascara = e.mascara;
      for (const b of el.querySelectorAll("[data-action=mascara]")) b.setAttribute("aria-pressed", String(b.dataset.valor === e.mascara));
      for (const b of el.querySelectorAll(".mr-moldura")) b.setAttribute("aria-pressed", String(b.dataset.valor === e.moldura));
      el.querySelector("[data-action=espelharH]").setAttribute("aria-pressed", String(!!e.espelharH));
      el.querySelector("[data-action=espelharV]").setAttribute("aria-pressed", String(!!e.espelharV));
      const custom = el.querySelector("[data-valor=personalizada]");
      if (custom) custom.innerHTML = e.molduraArquivo ? `<img alt="" src="${esc(e.molduraArquivo)}">` : `<i class="fas fa-folder-open"></i>`;
    }

    #atualizarMiniaturas() {
      for (const img of this.element?.querySelectorAll(".mr-moldura img") ?? []) {
        const id = img.closest("button").dataset.valor;
        if (!MOLDURAS[id]) continue;
        img.src = dataUrlSvg(svgMoldura(id, { tinta: this.estado.tinta, forma: this.estado.mascara }));
      }
    }

    /* ---------- Prévia ---------- */

    #pedido = 0;
    #desenhar() {
      if (this.#pedido) return;
      this.#pedido = requestAnimationFrame(() => {
        this.#pedido = 0;
        if (!this.ctx2d) return;
        desenhar(this.ctx2d, this.estado, { img: this.img, moldura: this.moldura }, PREVIA);
        this.element?.querySelector(".mr-quadro")?.classList.toggle("vazio", !this.img);
      });
    }

    #ligarPalco() {
      const c = this.canvas;
      let arrasto = null;
      c.addEventListener("pointerdown", (ev) => {
        if (ev.button !== 0 || !this.img) return;
        c.setPointerCapture(ev.pointerId);
        arrasto = { x: ev.clientX, y: ev.clientY };
        c.classList.add("arrastando");
      });
      c.addEventListener("pointermove", (ev) => {
        if (!arrasto) return;
        const lado = c.getBoundingClientRect().width || PREVIA;
        const dx = ev.clientX - arrasto.x, dy = ev.clientY - arrasto.y;
        arrasto = { x: ev.clientX, y: ev.clientY };
        this.#mudar(arrastar(this.estado, dx, dy, lado));
      });
      const soltar = () => { arrasto = null; c.classList.remove("arrastando"); };
      c.addEventListener("pointerup", soltar);
      c.addEventListener("pointercancel", soltar);
      c.addEventListener("wheel", (ev) => {
        if (!this.img) return;
        ev.preventDefault();
        const r = c.getBoundingClientRect();
        const px = (ev.clientX - r.left) / r.width - 0.5, py = (ev.clientY - r.top) / r.height - 0.5;
        const fino = ev.shiftKey ? 0.25 : 1;
        this.#mudar(zoomNoPonto(this.estado, this.estado.zoom * Math.pow(fatorRoda(ev.deltaY), fino), px, py));
      }, { passive: false });
      c.addEventListener("dblclick", () => this.#mudar({ ...this.estado, x: 0, y: 0 }));
      c.addEventListener("keydown", (ev) => {
        const passo = ev.shiftKey ? 10 : 2;
        const d = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[ev.key];
        if (!d) return;
        ev.preventDefault();
        this.#mudar(arrastar(this.estado, d[0], d[1], PREVIA));
      });
      // Arrastar um arquivo de imagem do computador para a prévia.
      const quadro = this.element.querySelector(".mr-quadro");
      quadro.addEventListener("dragover", (ev) => { if (ev.dataTransfer?.types?.includes("Files")) { ev.preventDefault(); quadro.classList.add("soltando"); } });
      quadro.addEventListener("dragleave", () => quadro.classList.remove("soltando"));
      quadro.addEventListener("drop", (ev) => {
        quadro.classList.remove("soltando");
        const f = [...(ev.dataTransfer?.files ?? [])].find((x) => x.type.startsWith("image/"));
        if (!f) return;
        ev.preventDefault();
        ev.stopPropagation();
        this.#usarBlob(f);
      });
    }

    /* ---------- Origem ---------- */

    async #trocarOrigem(origem, { manterEnquadramento = false } = {}) {
      this.#status(t("carregando"));
      try {
        const img = await carregarImagem(origem.src);
        if (this.origem?.tipo === "blob" && this.origem.src !== origem.src) URL.revokeObjectURL(this.origem.src);
        this.origem = origem;
        this.img = img;
        if (img.contaminada) ui.notifications.warn(t("avisoCors"));
        if (!manterEnquadramento) this.estado = { ...this.estado, x: 0, y: 0, zoom: 1, rot: 0, espelharH: false, espelharV: false };
        this.moldura = await imagemMoldura(this.estado).catch(() => null);
        this.#atualizarControles();
        this.#status("");
      } catch (err) {
        console.warn(err);
        this.#status("");
        ui.notifications.error(t("erroCarregar"));
      }
      this.#desenhar();
    }

    #usarBlob(blob) {
      return this.#trocarOrigem({ tipo: "blob", blob, src: URL.createObjectURL(blob) });
    }

    #status(txt) {
      const s = this.element?.querySelector(".mr-estado");
      if (s) s.textContent = txt;
    }

    static #origemRetrato() {
      if (imagemPadrao(this.actor.img)) return ui.notifications.warn(t("semRetrato"));
      this.#trocarOrigem({ tipo: "caminho", src: this.actor.img });
    }

    static #origemToken() {
      this.#trocarOrigem({ tipo: "caminho", src: this.actor.prototypeToken.texture.src });
    }

    static #origemArquivo() {
      const atual = this.origem?.tipo === "caminho" ? this.origem.src : this.actor.img;
      new (FP())({
        type: "image",
        current: atual,
        callback: (path) => this.#trocarOrigem({ tipo: "caminho", src: path })
      }).render(true);
    }

    static #origemUrl() {
      const url = this.element.querySelector("input[name=url]").value.trim();
      if (!url) return ui.notifications.warn(t("urlVazia"));
      this.#trocarOrigem({ tipo: "caminho", src: url });
    }

    /** Botão "Colar": usa a API da área de transferência quando há (HTTPS); senão, pede Ctrl+V. */
    static async #origemColar() {
      if (!navigator.clipboard?.read) return ui.notifications.info(t("dicaColar"));
      try {
        for (const item of await navigator.clipboard.read()) {
          const tipo = item.types.find((x) => x.startsWith("image/"));
          if (tipo) return this.#usarBlob(await item.getType(tipo));
          if (item.types.includes("text/plain")) {
            const txt = (await (await item.getType("text/plain")).text()).trim();
            if (/^(https?:|data:image\/)/i.test(txt)) return this.#trocarOrigem({ tipo: "caminho", src: txt });
          }
        }
        ui.notifications.warn(t("colarVazio"));
      } catch (err) {
        console.warn(err);
        ui.notifications.info(t("dicaColar"));
      }
    }

    /** Ctrl+V com o editor em foco: imagem copiada ou endereço de imagem. */
    #aoColar(ev) {
      if (!this.rendered || ui.activeWindow !== this) return;
      const dados = ev.clipboardData;
      const arquivo = [...(dados?.items ?? [])].find((i) => i.kind === "file" && i.type.startsWith("image/"))?.getAsFile();
      if (arquivo) { ev.preventDefault(); return this.#usarBlob(arquivo); }
      if (ev.target?.matches?.("input, textarea")) return;
      const txt = dados?.getData("text/plain")?.trim();
      if (txt && /^(https?:|data:image\/)/i.test(txt)) { ev.preventDefault(); this.#trocarOrigem({ tipo: "caminho", src: txt }); }
    }

    /* ---------- Moldura ---------- */

    static #escolherMoldura(ev, el) {
      const id = el.dataset.valor;
      this.#mudarMoldura({ ...this.estado, moldura: id, recorte: id === "nenhuma" ? 1 : MOLDURAS[id]?.recorte ?? this.estado.recorte });
    }

    static #molduraArquivo() {
      new (FP())({
        type: "image",
        current: this.estado.molduraArquivo || "",
        callback: (path) => this.#mudarMoldura({ ...this.estado, moldura: "personalizada", molduraArquivo: path, recorte: Math.min(this.estado.recorte, 0.92) })
      }).render(true);
    }

    /* ---------- Salvar ---------- */

    static async #salvar() {
      if (this.ocupado) return;
      if (!this.img) return ui.notifications.warn(t("semImagem"));
      if (this.img.contaminada) return ui.notifications.error(t("erroCors"));
      const el = this.element;
      const S = limitar(Math.round(Number(el.querySelector("[name=tamanho]").value) || 400), 64, 2048);
      const modoRetrato = el.querySelector("[name=retrato]").value;
      const todasCenas = !!el.querySelector("[name=todasCenas]")?.checked;
      const estado = { ...limparEstado(this.estado), origem: this.origem?.tipo === "caminho" ? this.origem.src : null };
      this.ocupado = true;
      el.querySelector("[data-action=salvar]").disabled = true;
      this.#status(t("salvando"));
      try {
        const blob = await renderizar(this.estado, this.img, S);
        const opcoes = { origem: this.origem, modoRetrato, todasCenas, estado };
        if (podeEnviar() && this.actor.isOwner) {
          const r = await salvarLocal(ctx, this.actor, blob, opcoes);
          ui.notifications.info(t("salvo", { nome: this.actor.name, n: r.tokens }));
        } else {
          await pedirAoMestre(ctx, this.actor, blob, opcoes);
          ui.notifications.info(t("enviadoMestre"));
        }
        this.close();
      } catch (err) {
        console.error("monolith-regras | retratos", err);
        ui.notifications.error(`${t("erroSalvar")} ${err?.message ?? ""}`);
        this.#status("");
        el.querySelector("[data-action=salvar]").disabled = false;
      } finally {
        this.ocupado = false;
      }
    }
  }

  return EditorRetrato;
}

/* ---------- Jogador sem permissão de envio: o Mestre ativo grava por ele ---------- */

const LIMITE_BYTES = 6 * 1024 * 1024;

export async function pedirAoMestre(ctx, actor, blob, { origem, modoRetrato, todasCenas, estado }) {
  if (!game.users.activeGM) throw new Error(ctx.t("semMestre"));
  let origemDados = null;
  if (modoRetrato === "origem" && origem) {
    if (origem.tipo === "blob") {
      if (origem.blob.size > LIMITE_BYTES) throw new Error(ctx.t("origemGrande"));
      origemDados = { tipo: "dataUrl", src: await blobParaDataUrl(origem.blob) };
    } else origemDados = { tipo: "caminho", src: origem.src };
  }
  ctx.socket.emitir({
    tipo: "salvar", uuid: actor.uuid, token: await blobParaDataUrl(blob),
    origem: origemDados, modoRetrato, todasCenas, estado
  });
}
