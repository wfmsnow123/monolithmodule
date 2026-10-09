import { ID, t, esc, cfg, lerLink, nomeDoLink } from "./util.mjs";
import { publicar } from "./tocador.mjs";

const { ApplicationV2, DialogV2 } = foundry.applications.api;

/* ---------- Comandos (só Mestre) ---------- */

export function tocar() {
  const estado = cfg("estado") ?? {};
  if (!(estado.lista ?? estado.video)) return Playlists.abrir();
  if (estado.parado) return publicar({ parado: false, tocando: true, tempo: 0, indice: 0 });
  return publicar({ tocando: true, tempo: game.modules.get(ID).tocador.player?.getCurrentTime?.() ?? estado.tempo });
}

export function pausar() {
  const estado = cfg("estado") ?? {};
  if (!estado.tocando) return;
  return publicar({ tocando: false, tempo: game.modules.get(ID).tocador.player?.getCurrentTime?.() ?? estado.tempo });
}

export function parar() {
  return publicar({ tocando: false, parado: true, tempo: 0 });
}

export function pular(passo) {
  const estado = cfg("estado") ?? {};
  const { total } = game.modules.get(ID).tocador.info() ?? {};
  if (!estado.lista || !total) return;
  return publicar({ indice: ((estado.indice ?? 0) + passo + total) % total, tempo: 0, tocando: true, parado: false });
}

export function tocarPlaylist(id) {
  const pl = cfg("playlists").find((p) => p.id === id);
  if (!pl) return;
  return publicar({ playlistId: pl.id, lista: pl.lista ?? undefined, video: pl.video ?? undefined, indice: 0, tempo: 0, tocando: true, parado: false });
}

/* ---------- Janela do player ---------- */

export class JanelaPlayer extends ApplicationV2 {
  static #instancia;

  static DEFAULT_OPTIONS = {
    id: "monolith-player",
    classes: ["mono", "monolith-player"],
    window: { title: "MONOLITH_PLAYER.titulo", icon: "fa-solid fa-music", minimizable: true },
    position: { width: 340, height: "auto", top: 80, left: 120 },
    actions: {
      tocar: () => tocar(),
      pausar: () => pausar(),
      parar: () => parar(),
      anterior: () => pular(-1),
      proxima: () => pular(1),
      playlists: () => Playlists.abrir()
    }
  };

  static abrir() {
    this.#instancia ??= new this();
    return this.#instancia.render({ force: true });
  }

  static atualizar() {
    if (this.#instancia?.rendered) this.#instancia.render();
  }

  async _renderHTML() {
    const estado = cfg("estado") ?? {};
    const info = game.modules.get(ID).tocador.info();
    const pl = cfg("playlists").find((p) => p.id === estado.playlistId);
    const parado = !info || estado.parado;
    const titulo = parado ? t("player.parado") : info.titulo || t("player.carregando");
    const faixa = !parado && estado.lista && info.total ? t("player.faixa", { n: info.faixa, total: info.total }) : "";
    const lista = !parado && estado.lista;
    const botao = (acao, icone, rotulo, extra = "") =>
      `<button type="button" class="mp-btn ${extra}" data-action="${acao}" data-tooltip="${esc(rotulo)}" aria-label="${esc(rotulo)}"><i class="fa-solid ${icone}"></i></button>`;
    return `<section class="mp-agora ${parado ? "is-parado" : ""} ${estado.tocando && !parado ? "is-tocando" : ""}">
        <span class="mp-rotulo">${parado ? t("player.silencio") : estado.tocando ? t("player.tocando") : t("player.pausado")}</span>
        <div class="mp-titulo" title="${esc(titulo)}">${esc(titulo)}</div>
        <div class="mp-sub">${esc(pl?.nome ?? "")}${pl && faixa ? " · " : ""}${esc(faixa)}</div>
      </section>
      <div class="mp-controles">
        ${lista ? botao("anterior", "fa-backward-step", t("player.anterior")) : ""}
        ${botao("tocar", "fa-play", t("player.tocar"), "mp-btn--tocar")}
        ${botao("pausar", "fa-pause", t("player.pausar"))}
        ${botao("parar", "fa-stop", t("player.parar"))}
        ${lista ? botao("proxima", "fa-forward-step", t("player.proxima")) : ""}
      </div>
      <button type="button" class="mp-abrir" data-action="playlists"><i class="fa-solid fa-list-music"></i> ${t("player.playlists")}</button>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
  }
}

/* ---------- Janela de playlists salvas ---------- */

export class Playlists extends ApplicationV2 {
  static #instancia;

  static DEFAULT_OPTIONS = {
    id: "monolith-player-playlists",
    classes: ["mono", "monolith-player-playlists"],
    window: {
      title: "MONOLITH_PLAYER.playlists.titulo",
      icon: "fa-solid fa-list-music",
      resizable: true,
      controls: []
    },
    position: { width: 440, height: 480 },
    actions: {
      novo: Playlists.#novo,
      cancelar: Playlists.#cancelar,
      salvar: Playlists.#salvar,
      tocar: (ev, alvo) => tocarPlaylist(alvo.closest("[data-id]").dataset.id),
      apagar: Playlists.#apagar
    }
  };

  #adicionando = false;

  static abrir() {
    this.#instancia ??= new this();
    return this.#instancia.render({ force: true });
  }

  static atualizar() {
    if (this.#instancia?.rendered) this.#instancia.render();
  }

  async _renderHTML() {
    const estado = cfg("estado") ?? {};
    const lista = cfg("playlists");
    const form = this.#adicionando
      ? `<form class="mp-form" autocomplete="off">
          <label class="mp-campo"><span>${t("playlists.link")}</span>
            <input type="text" name="link" placeholder="https://www.youtube.com/playlist?list=..." required></label>
          <label class="mp-campo"><span>${t("playlists.nome")}</span>
            <input type="text" name="nome" placeholder="${esc(cfg("apiKey") ? t("playlists.nomeAuto") : t("playlists.nomeSemChave"))}"></label>
          <div class="mp-form__acoes">
            <button type="button" data-action="cancelar">${t("playlists.cancelar")}</button>
            <button type="button" class="mono-primary" data-action="salvar"><i class="fa-solid fa-floppy-disk"></i> ${t("playlists.salvar")}</button>
          </div>
        </form>`
      : "";
    const itens = lista.length
      ? lista.map((p) => {
          const ativa = p.id === estado.playlistId && !estado.parado;
          return `<li class="mp-item ${ativa ? "is-ativa" : ""}" data-id="${esc(p.id)}">
            <button type="button" class="mp-item__tocar" data-action="tocar" data-tooltip="${esc(t("playlists.tocar"))}"><i class="fa-solid ${ativa && estado.tocando ? "fa-volume-high" : "fa-play"}"></i></button>
            <div class="mp-item__texto">
              <span class="mp-item__nome">${esc(p.nome)}</span>
              <span class="mp-item__tipo">${p.lista ? t("playlists.tipoLista") : t("playlists.tipoVideo")}</span>
            </div>
            <button type="button" class="mp-item__apagar" data-action="apagar" data-tooltip="${esc(t("playlists.apagar"))}"><i class="fa-solid fa-trash"></i></button>
          </li>`;
        }).join("")
      : `<li class="mp-vazio">${t("playlists.vazio")}</li>`;
    return `<header class="mp-topo">
        <h2 class="mono-heading">${t("playlists.salvas")}</h2>
        <button type="button" class="mp-novo" data-action="novo" data-tooltip="${esc(t("playlists.adicionar"))}" aria-label="${esc(t("playlists.adicionar"))}" ${this.#adicionando ? "disabled" : ""}><i class="fa-solid fa-plus"></i></button>
      </header>
      ${form}
      <ul class="mp-lista">${itens}</ul>`;
  }

  _replaceHTML(result, content) {
    const s = content.querySelector(".mp-lista")?.scrollTop ?? 0;
    content.innerHTML = result;
    const lista = content.querySelector(".mp-lista");
    if (lista) lista.scrollTop = s;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const form = this.element.querySelector(".mp-form");
    if (!form) return;
    form.querySelector('[name="link"]').focus();
    form.addEventListener("submit", (ev) => ev.preventDefault());
    form.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        Playlists.#salvar.call(this);
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();
        Playlists.#cancelar.call(this);
      }
    });
  }

  static #novo() {
    this.#adicionando = true;
    this.render();
  }

  static #cancelar() {
    this.#adicionando = false;
    this.render();
  }

  static async #salvar() {
    const form = this.element.querySelector(".mp-form");
    if (!form) return;
    const link = lerLink(form.elements.link.value);
    if (!link) {
      form.elements.link.setAttribute("aria-invalid", "true");
      return ui.notifications.warn(t("aviso.link"));
    }
    const lista = [...cfg("playlists")];
    let nome = form.elements.nome.value.trim();
    nome ||= (await nomeDoLink(link)) || t("playlists.semNome", { n: lista.length + 1 });
    lista.push({ id: foundry.utils.randomID(), nome, lista: link.lista, video: link.lista ? null : link.video });
    this.#adicionando = false;
    await game.settings.set(ID, "playlists", lista);
  }

  static async #apagar(ev, alvo) {
    const id = alvo.closest("[data-id]").dataset.id;
    const pl = cfg("playlists").find((p) => p.id === id);
    if (!pl) return;
    const ok = ev.shiftKey || await DialogV2.confirm({
      window: { title: t("playlists.apagar") },
      content: `<p>${t("playlists.apagarConfirma", { nome: esc(pl.nome) })}</p>`,
      classes: ["mono"]
    });
    if (!ok) return;
    if ((cfg("estado") ?? {}).playlistId === id) await parar();
    await game.settings.set(ID, "playlists", cfg("playlists").filter((p) => p.id !== id));
  }
}
