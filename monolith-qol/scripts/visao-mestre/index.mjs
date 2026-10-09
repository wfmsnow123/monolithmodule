/**
 * Visão do Mestre: um modo só do Mestre que clareia o mapa, revela a névoa e mostra os tokens fora
 * da visão (com listras). Baseado no GM Vision 2.0.5 (MIT).
 */
import { ID, t } from "../util.mjs";
import { definirRecurso, opcao, definirOpcao } from "../recursos.mjs";
import { criarFiltroDeteccao, mixinMascara, mixinToken } from "./filtros.mjs";

const estado = { ativa: false, listras: true };
let revelarNevoa;

const disponivel = () => game.user?.isGM && !game.settings.get("core", "noCanvas");

function alternar(valor = !opcao("visaoMestre", "ativa")) {
  if (!disponivel()) return;
  return definirOpcao("visaoMestre", "ativa", valor);
}

function redesenhar() {
  if (!globalThis.canvas?.ready) return;
  canvas.perception.update({ refreshVision: true });
  ui.controls?.render();
}

/* ---------- Ganchos do canvas ---------- */

function drawCanvasVisibility(grupo) {
  revelarNevoa = grupo.addChild(new PIXI.LegacyGraphics().beginFill(0xFFFFFF).drawShape(canvas.dimensions.rect).endFill());
  revelarNevoa.visible = false;
}

function sightRefresh() {
  if (revelarNevoa) revelarNevoa.visible = estado.ativa;
  const ilum = canvas.effects.illumination.filter;
  if (ilum?.uniforms) ilum.uniforms.gmVision = estado.ativa;
  const esc = canvas.effects.darkness?.filter;
  if (esc) esc.alpha = estado.ativa ? opcao("visaoMestre", "escuridao") : 1.0;
}

/** A escuridão ganha um AlphaFilter próprio, para ficar translúcida com a Visão ligada. */
function drawCanvasDarknessEffects(camada) {
  const i = camada.filters?.indexOf(camada.filter);
  camada.filter = new PIXI.AlphaFilter();
  if (i >= 0) camada.filters[i] = camada.filter;
}

/** Ícone da Iluminação cheio com a Visão ligada; botão direito nele alterna. */
function renderSceneControls(app, html, context, options) {
  if (!options.parts?.includes("layers")) return;
  const luz = html.querySelector('[data-control="lighting"]');
  if (!luz) return;
  if (estado.ativa) luz.classList.replace("fa-regular", "fa-solid");
  else luz.classList.replace("fa-solid", "fa-regular");
  if (opcao("visaoMestre", "botaoDireito")) {
    luz.addEventListener("contextmenu", (ev) => { ev.preventDefault(); alternar(); });
    // O botão usa o aria-label como dica (data-tooltip vazio).
    luz.setAttribute("aria-label", `${luz.getAttribute("aria-label") ?? ""} (${t("visaoMestre.dicaBotao")})`);
  }
}

definirRecurso({
  id: "visaoMestre",
  icone: "fas fa-eye",
  original: "gm-vision",
  // Troca a classe dos tokens e os filtros do canvas: ligar e desligar só vale ao recarregar.
  recarregar: true,
  opcoes: [
    {
      chave: "ativa", tipo: Boolean, padrao: false, escopo: "client", config: false,
      aoMudar: (v) => {
        if (!disponivel()) return;
        estado.ativa = v;
        redesenhar();
      }
    },
    { chave: "botaoDireito", tipo: Boolean, padrao: true, aoMudar: () => ui.controls?.render() },
    { chave: "listras", tipo: Boolean, padrao: true, aoMudar: (v) => { estado.listras = v; redesenhar(); } },
    { chave: "escuridao", tipo: Number, padrao: 0.5, min: 0, max: 1, step: 0.05, aoMudar: () => redesenhar() }
  ],
  // O original guardava o estado como configuração de cliente (localStorage do navegador do Mestre).
  migracao: { active: "ativa" },

  iniciar() {
    game.keybindings.register(ID, "visaoMestre", {
      name: "MONOLITH_QOL.visaoMestre.tecla",
      hint: "MONOLITH_QOL.visaoMestre.teclaDica",
      editable: [{ key: "KeyG", modifiers: [foundry.helpers.interaction.KeyboardManager.MODIFIER_KEYS.CONTROL] }],
      restricted: true,
      onDown: () => {
        if (!disponivel()) return;
        alternar();
        return true;
      }
    });

    Hooks.once("setup", () => {
      if (!disponivel()) return;
      estado.ativa = opcao("visaoMestre", "ativa");
      estado.listras = opcao("visaoMestre", "listras");
      CONFIG.Token.objectClass = mixinToken(CONFIG.Token.objectClass, () => estado, criarFiltroDeteccao());
      CONFIG.Canvas.visualEffectsMaskingFilter = mixinMascara(CONFIG.Canvas.visualEffectsMaskingFilter);
      Hooks.on("drawCanvasVisibility", drawCanvasVisibility);
      Hooks.on("sightRefresh", sightRefresh);
      Hooks.on("drawCanvasDarknessEffects", drawCanvasDarknessEffects);
      Hooks.on("renderSceneControls", renderSceneControls);
    });
  },

  pronto() {
    game.modules.get(ID).api.visaoMestre = { alternar, get ativa() { return estado.ativa; } };
  }
});
