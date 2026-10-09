import { ID, t, esc, cfg, lerLink } from "./util.mjs";
import { publicar } from "./tocador.mjs";
import { tocar, pausar, parar, Playlists } from "./janelas.mjs";

/*
 * Barra do Player, fixa na lateral esquerda: dentro da caixa da lista de jogadores, logo abaixo da linha
 * "Monolith" e dos botões do Regras da Casa (ou no topo da caixa, sem ele).
 * Mestre: título com tocar, pausar, parar e volume; embaixo, um campo para tocar um link direto e o botão
 * Playlists, que abre o gerenciador. Jogador: só o título e o volume dele.
 * O volume é do Player (0 a 100, por pessoa), fora do controle de Música do Foundry, que não desce de 5.
 */

export const Widget = {
  el: null,
  volumeAberto: false,

  /** A lista de jogadores se redesenha sozinha; o gancho renderPlayers põe a barra de volta. */
  montar() {
    ui.players?.render();
  },

  anexar(html) {
    const raiz = html instanceof HTMLElement ? html : html?.[0];
    const caixa = raiz?.querySelector("#players-active");
    caixa?.querySelector("#monolith-player-widget")?.remove();
    this.el = null;
    if (!caixa || !game.settings.get(ID, "widget")) return;
    this.el = document.createElement("div");
    this.el.id = "monolith-player-widget";
    this.el.className = "mono";
    const barra = caixa.querySelector(".mono-jog-barra");
    if (barra) barra.after(this.el);
    else caixa.prepend(this.el);
    this.el.addEventListener("click", (ev) => this._clique(ev));
    this.el.addEventListener("input", (ev) => this._volume(ev));
    this.el.addEventListener("keydown", (ev) => this._tecla(ev));
    this.render();
  },

  render() {
    if (!this.el?.isConnected) return;
    const gm = game.user.isGM;
    const estado = cfg("estado") ?? {};
    const info = game.modules.get(ID).tocador?.info();
    const tocando = !!estado.tocando && !estado.parado && !!info;
    const vol = game.settings.get(ID, "volume");
    const titulo = info && !estado.parado ? info.titulo || t("player.carregando") : t("player.parado");
    const digitado = this.el.querySelector('[name="link"]')?.value ?? "";
    const botao = (acao, icone, rotulo) => `<button type="button" data-acao="${acao}" data-tooltip="${esc(rotulo)}" aria-label="${esc(rotulo)}"><i class="fa-solid ${icone}"></i></button>`;
    this.el.classList.toggle("tocando", tocando);
    this.el.innerHTML = `
      <div class="mpw-topo" data-tooltip="${esc(titulo)}">
        <i class="fa-solid fa-music mpw-icone"></i><span class="mpw-titulo">${t("widget.nome")}</span><i class="fa-solid fa-compact-disc mpw-disco"></i>
        <span class="mpw-acoes">
          ${gm ? botao("tocar", "fa-play", t("player.tocar")) + botao("pausar", "fa-pause", t("player.pausar")) + botao("parar", "fa-stop", t("player.parar")) : ""}
          ${botao("volume", vol ? "fa-volume-low" : "fa-volume-xmark", t("widget.volume", { v: vol }))}
        </span>
      </div>
      <div class="mpw-vol" ${this.volumeAberto ? "" : "hidden"}>
        <input type="range" name="volume" min="0" max="100" step="1" value="${vol}" aria-label="${esc(t("widget.volumeRotulo"))}"><b>${vol}</b>
      </div>
      ${gm ? `<div class="mpw-linha">
        <input type="text" name="link" value="${esc(digitado)}" placeholder="${esc(t("widget.linkDireto"))}" autocomplete="off" spellcheck="false">
        <button type="button" class="mpw-playlists" data-acao="playlists"><i class="fa-solid fa-list-music"></i> ${t("player.playlists")}</button>
      </div>` : ""}`;
  },

  /** Toca um link colado no campo, sem salvar como playlist. */
  async tocarLink(texto) {
    const link = lerLink(texto);
    if (!link) return ui.notifications.warn(t("aviso.link"));
    const campo = this.el?.querySelector('[name="link"]');
    if (campo) campo.value = "";
    await publicar({ playlistId: null, lista: link.lista ?? undefined, video: link.lista ? undefined : link.video, indice: 0, tempo: 0, tocando: true, parado: false });
  },

  _clique(ev) {
    const b = ev.target.closest("[data-acao]");
    if (!b) return;
    ev.preventDefault();
    ev.stopPropagation();
    switch (b.dataset.acao) {
      case "tocar": {
        const campo = this.el.querySelector('[name="link"]');
        return campo?.value.trim() ? this.tocarLink(campo.value) : tocar();
      }
      case "pausar": return pausar();
      case "parar": return parar();
      case "playlists": return Playlists.abrir();
      case "volume":
        this.volumeAberto = !this.volumeAberto;
        return this.render();
    }
  },

  _volume(ev) {
    if (ev.target.name !== "volume") return;
    const v = Number(ev.target.value);
    ev.target.nextElementSibling.textContent = v;
    game.settings.set(ID, "volume", v);
  },

  _tecla(ev) {
    if (ev.target.name !== "link") return;
    ev.stopPropagation();
    if (ev.key === "Enter") { ev.preventDefault(); this.tocarLink(ev.target.value); }
    if (ev.key === "Escape") ev.target.blur();
  }
};
