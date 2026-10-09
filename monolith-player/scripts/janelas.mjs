import { ID, t, esc, cfg, lerLink, nomeDoLink, lerSpotify, buscarNoYoutube } from "./util.mjs";
import { publicar } from "./tocador.mjs";

const { ApplicationV2, DialogV2 } = foundry.applications.api;

/* ---------- Comandos (só Mestre) ---------- */

const tocadorAtual = () => game.modules.get(ID).tocador;

export function tocar() {
  const estado = cfg("estado") ?? {};
  if (!(estado.lista ?? estado.video)) return Playlists.abrir();
  if (estado.parado) return publicar({ parado: false, tocando: true, tempo: 0, indice: 0 });
  return publicar({ tocando: true, tempo: tocadorAtual().player?.getCurrentTime?.() ?? estado.tempo });
}

export function pausar() {
  const estado = cfg("estado") ?? {};
  if (!estado.tocando) return;
  return publicar({ tocando: false, tempo: tocadorAtual().player?.getCurrentTime?.() ?? estado.tempo });
}

export function parar() {
  return publicar({ tocando: false, parado: true, tempo: 0 });
}

export function pular(passo) {
  const estado = cfg("estado") ?? {};
  const { total } = tocadorAtual().info() ?? {};
  if (!estado.lista || !total) return;
  return publicar({ indice: ((estado.indice ?? 0) + passo + total) % total, tempo: 0, tocando: true, parado: false });
}

/** Liga ou desliga o loop (playlist dá a volta, vídeo avulso recomeça). */
export function alternarLoop() {
  const estado = cfg("estado") ?? {};
  return publicar({ loop: !estado.loop });
}

/** Vai para um ponto da faixa (fração de 0 a 1). */
export function buscar(fracao) {
  const estado = cfg("estado") ?? {};
  const { duracao } = tocadorAtual().info() ?? {};
  if (!duracao || estado.parado) return;
  return publicar({ tempo: Math.max(0, Math.min(1, fracao)) * duracao, tocando: !!estado.tocando });
}

export function tocarPlaylist(id) {
  const pl = cfg("playlists").find((p) => p.id === id);
  if (!pl) return;
  return publicar({ playlistId: pl.id, lista: pl.lista ?? undefined, video: pl.video ?? undefined, indice: 0, tempo: 0, tocando: true, parado: false });
}

const mmss = (s) => {
  s = Math.max(0, Math.floor(Number(s) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/* ---------- Gerenciador: controle completo em cima, playlists salvas embaixo ---------- */

export class Playlists extends ApplicationV2 {
  static #instancia;

  static DEFAULT_OPTIONS = {
    id: "monolith-player-playlists",
    classes: ["mono", "monolith-player-playlists"],
    window: { title: "MONOLITH_PLAYER.gerenciador.titulo", icon: "fa-solid fa-music", resizable: true },
    position: { width: 460, height: 600 },
    actions: {
      tocar: () => tocar(),
      pausar: () => pausar(),
      parar: () => parar(),
      anterior: () => pular(-1),
      proxima: () => pular(1),
      loop: () => alternarLoop(),
      novo: Playlists.#novo,
      cancelar: Playlists.#cancelar,
      salvar: Playlists.#salvar,
      tocarSalva: (ev, alvo) => tocarPlaylist(alvo.closest("[data-id]").dataset.id),
      apagar: Playlists.#apagar
    }
  };

  #adicionando = false;
  #relogio = null;

  static abrir() {
    this.#instancia ??= new this();
    return this.#instancia.render({ force: true });
  }

  /** Redesenha com o estado novo, menos com o formulário aberto (perderia o que está sendo digitado). */
  static atualizar() {
    const j = this.#instancia;
    if (j?.rendered && !j.#adicionando) j.render();
  }

  async _renderHTML() {
    const estado = cfg("estado") ?? {};
    const info = tocadorAtual().info();
    const lista = cfg("playlists");
    const parado = !info || estado.parado;
    const pl = lista.find((p) => p.id === estado.playlistId);
    const titulo = parado ? t("player.parado") : info.titulo || t("player.carregando");
    const faixa = !parado && estado.lista && info.total ? t("player.faixa", { n: info.faixa, total: info.total }) : "";
    const origem = pl?.nome ?? (!parado && (estado.lista || estado.video) ? t("gerenciador.linkDireto") : "");
    const temLista = !parado && estado.lista;
    const vol = game.settings.get(ID, "volume");
    const pct = !parado && info.duracao ? (info.tempo / info.duracao) * 100 : 0;
    const botao = (acao, icone, rotulo, extra = "") =>
      `<button type="button" class="mp-btn ${extra}" data-action="${acao}" data-tooltip="${esc(rotulo)}" aria-label="${esc(rotulo)}"><i class="fa-solid ${icone}"></i></button>`;

    const controle = `<section class="mp-agora ${parado ? "is-parado" : ""} ${estado.tocando && !parado ? "is-tocando" : ""}">
        <span class="mp-rotulo">${parado ? t("player.silencio") : estado.tocando ? t("player.tocando") : t("player.pausado")}</span>
        <div class="mp-titulo" title="${esc(titulo)}">${esc(titulo)}</div>
        <div class="mp-sub">${esc(origem)}${origem && faixa ? " · " : ""}${esc(faixa)}</div>
        <div class="mp-progresso ${parado ? "is-off" : ""}" data-progresso data-tooltip="${esc(t("gerenciador.buscar"))}">
          <span class="mp-progresso__barra"><span style="width:${pct}%"></span></span>
          <span class="mp-progresso__tempo" data-tempo>${parado ? "" : `${mmss(info.tempo)} / ${mmss(info.duracao)}`}</span>
        </div>
        <div class="mp-controles">
          ${botao("anterior", "fa-backward-step", t("player.anterior"), temLista ? "" : "is-off")}
          ${botao("tocar", "fa-play", t("player.tocar"), "mp-btn--tocar")}
          ${botao("pausar", "fa-pause", t("player.pausar"))}
          ${botao("parar", "fa-stop", t("player.parar"))}
          ${botao("proxima", "fa-forward-step", t("player.proxima"), temLista ? "" : "is-off")}
          ${botao("loop", "fa-repeat", t(estado.loop ? "player.loopLigado" : "player.loopDesligado"), estado.loop ? "is-on" : "")}
        </div>
        <label class="mp-volume"><i class="fa-solid ${vol ? "fa-volume-low" : "fa-volume-xmark"}"></i>
          <input type="range" name="volume" min="0" max="100" step="1" value="${vol}" aria-label="${esc(t("gerenciador.volume"))}"><b data-vol>${vol}</b></label>
      </section>`;

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
            <button type="button" class="mp-item__tocar" data-action="tocarSalva" data-tooltip="${esc(t("playlists.tocar"))}"><i class="fa-solid ${ativa && estado.tocando ? "fa-volume-high" : "fa-play"}"></i></button>
            <div class="mp-item__texto">
              <span class="mp-item__nome">${esc(p.nome)}</span>
              <span class="mp-item__tipo">${p.lista ? t("playlists.tipoLista") : t("playlists.tipoVideo")}</span>
            </div>
            <button type="button" class="mp-item__apagar" data-action="apagar" data-tooltip="${esc(t("playlists.apagar"))}"><i class="fa-solid fa-trash"></i></button>
          </li>`;
        }).join("")
      : `<li class="mp-vazio">${t("playlists.vazio")}</li>`;

    return `${controle}
      <header class="mp-topo">
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
    const el = this.element;
    // Volume: só o som e o número mudam enquanto arrasta (redesenhar no meio soltaria o controle).
    el.querySelector('[name="volume"]')?.addEventListener("input", (ev) => {
      el.querySelector("[data-vol]").textContent = ev.target.value;
      game.settings.set(ID, "volume", Number(ev.target.value));
    });
    // Clique na barra de progresso: o Mestre vai para aquele ponto da faixa, para todos.
    el.querySelector("[data-progresso]")?.addEventListener("click", (ev) => {
      const barra = ev.currentTarget.querySelector(".mp-progresso__barra").getBoundingClientRect();
      buscar((ev.clientX - barra.left) / barra.width);
    });
    clearInterval(this.#relogio);
    this.#relogio = setInterval(() => this.#tique(), 1000);

    const form = el.querySelector(".mp-form");
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

  _onClose(options) {
    super._onClose(options);
    clearInterval(this.#relogio);
  }

  /** Atualiza só a barra de progresso e o tempo, a cada segundo. */
  #tique() {
    const info = tocadorAtual().info();
    const estado = cfg("estado") ?? {};
    if (!this.rendered || !info || estado.parado || !info.duracao) return;
    const barra = this.element.querySelector(".mp-progresso__barra > span");
    const tempo = this.element.querySelector("[data-tempo]");
    if (barra) barra.style.width = `${(info.tempo / info.duracao) * 100}%`;
    if (tempo) tempo.textContent = `${mmss(info.tempo)} / ${mmss(info.duracao)}`;
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
    const lista = [...cfg("playlists")];
    let nome = form.elements.nome.value.trim();
    // Link do Spotify: salva o que o YouTube tem com esse nome.
    const spotify = lerSpotify(form.elements.link.value);
    if (spotify) {
      try {
        const r = await buscarNoYoutube(spotify);
        ui.notifications.info(t("aviso.spotifyAchou", { nome: r.nome, titulo: r.titulo }));
        lista.push({ id: foundry.utils.randomID(), nome: nome || r.nome, lista: r.lista, video: r.lista ? null : r.video });
        this.#adicionando = false;
        return game.settings.set(ID, "playlists", lista);
      } catch (err) {
        return ui.notifications.warn(err.message);
      }
    }
    const link = lerLink(form.elements.link.value);
    if (!link) {
      form.elements.link.setAttribute("aria-invalid", "true");
      return ui.notifications.warn(t("aviso.link"));
    }
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
