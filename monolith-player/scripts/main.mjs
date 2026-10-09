import { ID } from "./util.mjs";
import { Tocador } from "./tocador.mjs";
import { JanelaPlayer, Playlists, tocar, pausar, parar, pular, tocarPlaylist } from "./janelas.mjs";

const tocador = new Tocador();

Hooks.once("init", () => {
  game.settings.register(ID, "apiKey", {
    name: "MONOLITH_PLAYER.config.apiKey.nome",
    hint: "MONOLITH_PLAYER.config.apiKey.dica",
    scope: "world", config: true, type: String, default: ""
  });
  game.settings.register(ID, "playlists", {
    scope: "world", config: false, type: Array, default: [],
    onChange: () => {
      Playlists.atualizar();
      JanelaPlayer.atualizar();
    }
  });
  game.settings.register(ID, "estado", {
    scope: "world", config: false, type: Object, default: {},
    onChange: (estado) => tocador.aplicar(estado)
  });

  const mod = game.modules.get(ID);
  mod.tocador = tocador;
  mod.api = {
    abrir: () => JanelaPlayer.abrir(),
    playlists: () => Playlists.abrir(),
    tocar, pausar, parar, tocarPlaylist,
    proxima: () => pular(1),
    anterior: () => pular(-1)
  };
});

Hooks.once("ready", () => tocador.iniciar());

Hooks.on(`${ID}.atualizar`, () => {
  JanelaPlayer.atualizar();
  Playlists.atualizar();
});

// Volume: segue o controle de Música do Foundry (aba Playlists), de cada jogador.
Hooks.on("clientSettingChanged", (chave) => {
  if (chave === "core.globalPlaylistVolume") tocador.volume();
});
Hooks.on("globalPlaylistVolumeChanged", () => tocador.volume());

Hooks.on("getSceneControlButtons", (controles) => {
  const tokens = controles.tokens ?? controles.token;
  if (!tokens?.tools) return;
  tokens.tools.monolithPlayer = {
    name: "monolithPlayer", title: "MONOLITH_PLAYER.titulo", icon: "fa-solid fa-music",
    order: Object.keys(tokens.tools).length, button: true, visible: game.user.isGM,
    onChange: () => JanelaPlayer.abrir()
  };
});
