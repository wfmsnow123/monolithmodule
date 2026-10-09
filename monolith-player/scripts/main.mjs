import { ID } from "./util.mjs";
import { Tocador } from "./tocador.mjs";
import { Playlists, tocar, pausar, parar, pular, tocarPlaylist } from "./janelas.mjs";
import { Widget } from "./widget.mjs";

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
    }
  });
  game.settings.register(ID, "widget", {
    name: "MONOLITH_PLAYER.config.widget.nome",
    hint: "MONOLITH_PLAYER.config.widget.dica",
    scope: "client", config: true, type: Boolean, default: true, onChange: () => Widget.montar()
  });
  game.settings.register(ID, "volume", {
    name: "MONOLITH_PLAYER.config.volume.nome",
    hint: "MONOLITH_PLAYER.config.volume.dica",
    scope: "client", config: true, type: Number, default: 25, range: { min: 0, max: 100, step: 1 },
    onChange: () => tocador.volume()
  });
  game.settings.register(ID, "estado", {
    scope: "world", config: false, type: Object, default: {},
    onChange: (estado) => tocador.aplicar(estado)
  });

  const mod = game.modules.get(ID);
  mod.tocador = tocador;
  mod.api = {
    abrir: () => Playlists.abrir(),
    tocarLink: (link) => Widget.tocarLink(link),
    playlists: () => Playlists.abrir(),
    tocar, pausar, parar, tocarPlaylist,
    proxima: () => pular(1),
    anterior: () => pular(-1)
  };
});

Hooks.once("ready", () => {
  tocador.iniciar();
  Widget.montar();
});

// A barra mora na caixa da lista de jogadores, abaixo da linha "Monolith".
Hooks.on("renderPlayers", (app, html) => Widget.anexar(html));

Hooks.on(`${ID}.atualizar`, () => {
  Playlists.atualizar();
  Widget.render();
});

Hooks.on("getSceneControlButtons", (controles) => {
  const tokens = controles.tokens ?? controles.token;
  if (!tokens?.tools) return;
  tokens.tools.monolithPlayer = {
    name: "monolithPlayer", title: "MONOLITH_PLAYER.titulo", icon: "fa-solid fa-music",
    order: Object.keys(tokens.tools).length, button: true, visible: game.user.isGM,
    onChange: () => game.settings.set(ID, "widget", !game.settings.get(ID, "widget"))
  };
});
