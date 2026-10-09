import { ID, cfg, mestreAtivo } from "./util.mjs";

/*
 * O player do YouTube fica fora da tela (só o som importa) e cada cliente tem o seu.
 * Quem manda é a configuração de mundo "estado": o Mestre escreve, o Foundry espalha,
 * e todo cliente (o Mestre também) aplica o estado no próprio player.
 *
 * estado = { playlistId, lista, video, indice, tempo, em, tocando, parado }
 *   tempo é a posição em segundos no instante "em" (game.time.serverTime).
 */

const TOLERANCIA = 3; // segundos de diferença antes de corrigir a posição
const PULSO = 30000; // o Mestre ativo republica a posição a cada 30s enquanto toca

let api;
function carregarApi() {
  api ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve();
    const anterior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      anterior?.();
      resolve();
    };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  });
  return api;
}

/** Espera o primeiro clique do usuário: navegadores bloqueiam som antes disso. */
const desbloqueio = () => (game.audio?.locked ? game.audio.unlock : Promise.resolve());

export class Tocador {
  player = null;
  #pronto;
  #fila = Promise.resolve();
  #carregado = null; // lista ou vídeo que está no player agora

  iniciar() {
    const alvo = document.createElement("div");
    alvo.id = "monolith-player-yt";
    document.body.appendChild(alvo);
    this.#pronto = carregarApi().then(() => new Promise((resolve) => {
      this.player = new YT.Player(alvo, {
        width: 200,
        height: 200,
        playerVars: { controls: 0, disablekb: 1, playsinline: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady: () => {
            this.volume();
            resolve();
          },
          onStateChange: (e) => this.#mudouEstado(e.data),
          onError: (e) => this.#erro(e.data)
        }
      });
    }));
    this.aplicar(cfg("estado"));
    setInterval(() => this.#pulso(), PULSO);
  }

  /** Aplica o estado do mundo neste cliente, um de cada vez. */
  aplicar(estado) {
    this.#fila = this.#fila.then(() => this.#aplicar(estado ?? {})).catch((err) => console.error(`${ID} |`, err));
    return this.#fila;
  }

  async #aplicar(estado) {
    await this.#pronto;
    const p = this.player;
    const midia = estado.lista ?? estado.video;
    if (!midia || estado.parado) {
      if (this.#carregado) p.stopVideo();
      this.#carregado = null;
      return this.#avisar();
    }
    if (estado.tocando) await desbloqueio();
    const alvo = Tocador.posicao(estado);

    if (midia !== this.#carregado) {
      this.#carregado = midia;
      const verbo = estado.tocando ? "load" : "cue";
      if (estado.lista) {
        p[`${verbo}Playlist`]({ listType: "playlist", list: estado.lista, index: estado.indice ?? 0, startSeconds: alvo });
      } else {
        p[`${verbo}VideoById`]({ videoId: estado.video, startSeconds: alvo });
      }
      return this.#avisar();
    }

    if (estado.lista && (estado.indice ?? 0) !== p.getPlaylistIndex()) {
      p.playVideoAt(estado.indice ?? 0);
      if (!estado.tocando) p.pauseVideo();
      return this.#avisar();
    }
    if (estado.lista) p.setLoop?.(!!estado.loop);
    if (Math.abs((p.getCurrentTime?.() ?? 0) - alvo) > TOLERANCIA) p.seekTo(alvo, true);
    if (estado.tocando) p.playVideo();
    else p.pauseVideo();
    this.#avisar();
  }

  /** Onde o estado diz que a música está agora. */
  static posicao(estado) {
    const andou = estado.tocando && estado.em ? (game.time.serverTime - estado.em) / 1000 : 0;
    return Math.max(0, (estado.tempo ?? 0) + andou);
  }

  #mudouEstado(codigo) {
    const p = this.player;
    const estado = cfg("estado") ?? {};
    // Loop: com o botão ligado, a playlist dá a volta e o vídeo avulso recomeça; desligado, a música
    // toca até o fim e para, e o Mestre ativo registra a parada para todo mundo.
    if (codigo === YT.PlayerState.PLAYING && estado.lista) p.setLoop(!!estado.loop);
    if (codigo === YT.PlayerState.ENDED && estado.video && !estado.lista) {
      if (estado.loop) {
        p.seekTo(0, true);
        p.playVideo();
      } else if (mestreAtivo()) publicar({ tocando: false, parado: true, tempo: 0 });
    }
    if (codigo === YT.PlayerState.ENDED && estado.lista && !estado.loop && mestreAtivo()) {
      const total = p.getPlaylist?.()?.length ?? 0;
      if (total && p.getPlaylistIndex() >= total - 1) publicar({ tocando: false, parado: true, tempo: 0 });
    }
    // A playlist passou de faixa sozinha: o Mestre ativo registra para todo mundo.
    if (codigo === YT.PlayerState.PLAYING && estado.lista && mestreAtivo() && p.getPlaylistIndex() !== estado.indice) {
      publicar({ indice: p.getPlaylistIndex(), tempo: 0, tocando: true });
    }
    this.#avisar();
  }

  /** Vídeo privado, removido ou que não pode ser incorporado: pula. */
  #erro(codigo) {
    console.warn(`${ID} | YouTube recusou o vídeo (erro ${codigo})`);
    const estado = cfg("estado") ?? {};
    if (estado.lista && mestreAtivo()) this.player.nextVideo();
  }

  #pulso() {
    const estado = cfg("estado") ?? {};
    const p = this.player;
    if (!mestreAtivo() || !estado.tocando || estado.parado || !p?.getPlayerState) return;
    if (p.getPlayerState() !== YT.PlayerState.PLAYING) return;
    publicar({ tempo: p.getCurrentTime(), indice: estado.lista ? p.getPlaylistIndex() : undefined });
  }

  volume() {
    if (!this.player?.setVolume) return;
    // Volume do próprio Player (0 a 100, por pessoa): mais fino que o controle de Música do Foundry.
    this.player.setVolume(Math.round(Number(game.settings.get(ID, "volume")) || 0));
  }

  /** O que está tocando, para a janela do Mestre. */
  info() {
    const p = this.player;
    if (!p?.getVideoData || !this.#carregado) return null;
    return {
      titulo: p.getVideoData()?.title || "",
      faixa: (p.getPlaylistIndex?.() ?? -1) + 1,
      total: p.getPlaylist?.()?.length ?? 0,
      tocando: p.getPlayerState() === YT.PlayerState.PLAYING,
      tempo: p.getCurrentTime?.() ?? 0,
      duracao: p.getDuration?.() ?? 0
    };
  }

  #avisar() {
    Hooks.callAll(`${ID}.atualizar`);
  }
}

/** Muda o estado do mundo (só Mestre). O "em" sai do relógio do servidor. */
export function publicar(mudancas) {
  if (!game.user.isGM) return;
  const estado = { ...(cfg("estado") ?? {}), ...mudancas, em: game.time.serverTime };
  for (const [k, v] of Object.entries(estado)) if (v === undefined) delete estado[k];
  return game.settings.set(ID, "estado", estado);
}
