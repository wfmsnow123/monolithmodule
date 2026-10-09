/**
 * Configurações da Montaria. As 36 do mundo ficam fora da lista do Foundry (config: false) e são
 * editadas numa janela só, em seções curtas. Os padrões são os valores que a mesa usava no Rideable.
 */
import { MountSelected, MountSelectedFamiliar, GrappleTargeted, UnMountSelected, ToggleMountselected, ToggleGrapplePlacementSelected, TogglePilotingSelected, ProxyTarget } from "./nucleo/MountingScript.mjs";
import { cGrapplePlacements } from "./nucleo/RidingScript.mjs";
import { SelectedToggleFollwing } from "./nucleo/FollowingScript.mjs";
import { ID, RECURSO } from "./nucleo/base.mjs";

const { ApplicationV2, DialogV2 } = foundry.applications.api;

const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
const ativo = (id) => !!game.modules.get(id)?.active;

const MOVER = {
  "RiderMovement-disallow": "Não deixa (o cavaleiro fica parado)",
  "RiderMovement-dismount": "Desmonta e anda",
  "RiderMovement-moveridden": "Move a montaria junto"
};
const LADO_BOTAO = { none: "Sem botão", left: "Coluna da esquerda", right: "Coluna da direita" };
const SO_MONTARIAS = { off: "Desligado", mountsonly: "Só montarias (sem familiares)", all: "Montarias e familiares" };
const AGARRADO = {
  RowBelow: "Em fila, logo abaixo de quem agarra",
  RowAbove: "Em fila, logo acima",
  RowMiddle: "Em fila, por cima de quem agarra",
  ClosestInside: "No ponto mais próximo, dentro do token",
  Following: "Arrastado atrás, seguindo o caminho"
};

/**
 * Esquema: chave, tipo, padrão (= mundo da mesa), seção, texto e dica.
 * Seções: montar, carregar, seguir, efeitos, interface (cliente), integracoes.
 */
export const ESQUEMA = [
  // Montar
  { k: "defaultRideable", tipo: Boolean, padrao: false, secao: "montar", nome: "Todo token pode ser montado",
    dica: "Ligado: qualquer token aceita cavaleiros. Desligado: só os marcados na aba Montaria do token." },
  { k: "MountingDistance", tipo: Number, padrao: 5, secao: "montar", nome: "Distância para montar (pés)",
    dica: "Até onde o cavaleiro pode estar da montaria. Use -1 para qualquer distância." },
  { k: "BorderDistance", tipo: Boolean, padrao: false, secao: "montar", nome: "Medir pela borda",
    dica: "Mede a distância entre as bordas dos tokens em vez de centro a centro." },
  { k: "MaxRiders", tipo: Number, padrao: -1, secao: "montar", nome: "Cavaleiros por montaria",
    dica: "Limite padrão de cavaleiros (familiares não contam). -1 é sem limite. Cada token pode mudar isso." },
  { k: "RiderMovementworlddefault", tipo: String, padrao: "RiderMovement-moveridden", secao: "montar", nome: "Quando o cavaleiro tenta andar",
    dica: "O que acontece se alguém arrasta o token de quem está montado.", opcoes: MOVER },
  { k: "PreventEnemyRiding", tipo: Boolean, padrao: false, secao: "montar", nome: "Inimigos não montam",
    dica: "Impede montar num token de disposição oposta (o GM sempre pode)." },
  { k: "allowMountingonEntering", tipo: Boolean, padrao: true, secao: "montar", nome: "Montar ao entrar",
    dica: "Permite marcar tokens (barcos, carroças) para montar automaticamente quem entra neles." },
  { k: "allowTileRiding", tipo: Boolean, padrao: false, secao: "montar", nome: "Tiles também podem ser montados",
    dica: "Mostra a aba Montaria na configuração de tiles." },
  { k: "FamiliarRiding", tipo: Boolean, padrao: false, secao: "montar", nome: "Familiares nos cantos",
    dica: "Permite montar como familiar (tecla J): o token fica num canto da montaria, até 4." },
  { k: "FamiliarRidingFirstCorner", tipo: String, padrao: "0", secao: "montar", nome: "Primeiro canto do familiar",
    opcoes: { 0: "Superior esquerdo", 1: "Superior direito", 2: "Inferior esquerdo", 3: "Inferior direito" }, avancado: true },

  // Posição e altura dos cavaleiros
  { k: "FitRidersize", tipo: Boolean, padrao: true, secao: "posicao", nome: "Encolher cavaleiros grandes",
    dica: "Cavaleiro do tamanho da montaria ou maior é reduzido enquanto monta e volta ao desmontar." },
  { k: "FitRiderSizeFactor", tipo: Number, padrao: 0.65, secao: "posicao", nome: "Tamanho ao encolher",
    dica: "Fração do tamanho da montaria.", range: [0, 1, 0.05] },
  { k: "RiderScaleFactor", tipo: Number, padrao: 0.85, secao: "posicao", nome: "Escala da imagem do cavaleiro",
    dica: "Multiplica a escala da imagem de quem monta (1 = sem mudança).", range: [0, 3, 0.05] },
  { k: "RiderRotation", tipo: Boolean, padrao: true, secao: "posicao", nome: "Girar com a montaria",
    dica: "Cavaleiros giram junto quando a montaria gira." },
  { k: "CheckRiderCollision", tipo: Boolean, padrao: true, secao: "posicao", nome: "Cavaleiros não atravessam paredes",
    dica: "Se o lugar do cavaleiro fica do outro lado de uma parede, ele é puxado para o lado da montaria." },
  { k: "TeleportRiders", tipo: String, padrao: "off", secao: "posicao", nome: "Cavaleiros saltam em vez de andar",
    dica: "Desligado: andam junto com a montaria, pelo mesmo caminho.", opcoes: { off: "Desligado (andam junto)", familiaronly: "Só familiares", all: "Todos" } },
  { k: "useRidingHeight", tipo: Boolean, padrao: false, secao: "posicao", nome: "Cavaleiro fica mais alto",
    dica: "Soma a altura de montaria à elevação do cavaleiro. Desligado: o cavaleiro acompanha a elevação da montaria." },
  { k: "RidingHeight", tipo: Number, padrao: 5, secao: "posicao", nome: "Altura de montaria (pés)", avancado: true },
  { k: "useRiddenTokenHeight", tipo: Boolean, padrao: true, secao: "posicao", nome: "Altura pelo Wall Height",
    dica: "Com o Wall Height ativo, usa a altura do token montado como altura de montaria.", avancado: true, modulo: "wall-height" },

  // Carregar e agarrar
  { k: "Grappling", tipo: Boolean, padrao: true, secao: "carregar", nome: "Agarrar e carregar",
    dica: "Com um token selecionado e outro como alvo, a tecla H agarra (ou solta) o alvo, que passa a ser levado junto." },
  { k: "GrappleplacementDefault", tipo: String, padrao: "Following", secao: "carregar", nome: "Onde fica quem é agarrado",
    opcoes: AGARRADO },
  { k: "StopGrappleonEffectRemoval", tipo: Boolean, padrao: true, secao: "carregar", nome: "Soltar ao tirar o efeito",
    dica: "Remover o efeito de Agarrado do alvo também o solta." },
  { k: "MountingWeight", tipo: String, padrao: "mountsonly", secao: "carregar", nome: "Peso dos cavaleiros na montaria",
    dica: "Cria um item na montaria com o peso de quem está em cima, para a carga contar.", opcoes: SO_MONTARIAS },
  { k: "InitiativeLink", tipo: String, padrao: "mountsonly", secao: "carregar", nome: "Iniciativa junto",
    dica: "A montaria age logo depois do primeiro cavaleiro.", opcoes: SO_MONTARIAS },

  // Seguir
  { k: "EnableFollowing", tipo: Boolean, padrao: true, secao: "seguir", nome: "Seguir tokens", reload: true,
    dica: "Tecla G: os selecionados seguem o token sob o cursor (ou o alvo). Recarrega o mundo ao mudar." },
  { k: "FollowingAlgorithm", tipo: String, padrao: "routinglib", secao: "seguir", nome: "Como achar o caminho",
    dica: "routinglib desvia de paredes (precisa do módulo). O histórico refaz o caminho exato de quem é seguido.",
    opcoes: { SimplePathHistory: "Histórico do caminho", routinglib: "routinglib" } },
  { k: "FollowingCombatBehaviour", tipo: String, padrao: "stop", secao: "seguir", nome: "Em combate",
    opcoes: {
      stop: "Para de seguir", "stop-includefollowed": "Para, também se o seguido estiver em combate",
      resumeafter: "Pausa e volta depois", "resumeafter-includefollowed": "Pausa e volta, também pelo seguido", continue: "Continua seguindo"
    } },
  { k: "PreventFollowerStacking", tipo: Boolean, padrao: true, secao: "seguir", nome: "Seguidores não se empilham",
    dica: "Quem segue o mesmo token se espalha ao chegar." },
  { k: "OnlyfollowViewed", tipo: Boolean, padrao: false, secao: "seguir", nome: "Só seguir o que se vê", avancado: true,
    dica: "Só segue tokens visíveis para quem deu a ordem." },
  { k: "FollowingCompatibilityMode", tipo: Boolean, padrao: true, secao: "seguir", nome: "Modo compatível", avancado: true,
    dica: "Espera o caminho ser gravado antes de mover os seguidores. Mais lento, mais preciso." },

  // Efeitos
  { k: "DFredsEffectsIntegration", tipo: Boolean, padrao: true, secao: "efeitos", nome: "Efeitos pelo Convenient Effects", reload: true,
    dica: "Aplica os efeitos abaixo com o DFreds Convenient Effects. Recarrega o mundo ao mudar.", modulo: "dfreds-convenient-effects" },
  { k: "CustomRidingEffects", tipo: String, padrao: "", secao: "efeitos", nome: "Efeitos de quem monta",
    dica: "Nomes ou ids de efeitos, separados por ponto e vírgula." },
  { k: "GrapplingSystemEffects", tipo: Boolean, padrao: false, secao: "efeitos", nome: "Aplicar Agarrado",
    dica: "Quem é agarrado recebe a condição Agarrado." },
  { k: "CustomGrapplingEffects", tipo: String, padrao: "", secao: "efeitos", nome: "Efeitos de quem é agarrado",
    dica: "Nomes ou ids, separados por ponto e vírgula." },
  { k: "SpeedAdjustment", tipo: String, padrao: "off", secao: "efeitos", nome: "Deslocamento da montaria",
    dica: "O cavaleiro passa a usar o deslocamento da montaria (pelo efeito de montar).", opcoes: { off: "Desligado", all: "Ligado" } },

  // Interface (mundo)
  { k: "MountButtonDefaultPosition", tipo: String, padrao: "none", secao: "interface", nome: "Botão de montar no HUD",
    dica: "Onde aparece o botão de cavalo no HUD do token (cada um pode mudar para si).", opcoes: LADO_BOTAO },

  // Integrações pouco usadas
  { k: "CPREffectsIntegration", tipo: Boolean, padrao: false, secao: "integracoes", nome: "Efeitos pelo Chris's Premades", reload: true, modulo: "chris-premades" },
  { k: "LocknKeyintegration", tipo: Boolean, padrao: false, secao: "integracoes", nome: "Montarias trancáveis (Lock & Key)", modulo: "LocknKey" },
  { k: "TaggerMountingIntegration", tipo: Boolean, padrao: false, secao: "integracoes", nome: "Montar por tags (Tagger)", modulo: "tagger" },
  { k: "UseArmReachDistance", tipo: Boolean, padrao: false, secao: "integracoes", nome: "Distância do Arms Reach", modulo: ["foundryvtt-arms-reach", "arms-reach"] },
  { k: "RidingSystemEffects", tipo: Boolean, padrao: true, secao: "integracoes", nome: "Efeito Montado do sistema", sistema: "pf2e" },
  { k: "RideableTag", tipo: Boolean, padrao: false, secao: "integracoes", nome: "Traço montável", sistema: "pf2e" },

  // Deste computador
  { k: "RiderMovement", tipo: String, padrao: "RiderMovement-worlddefault", cliente: true, secao: "cliente", nome: "Quando meu cavaleiro tenta andar",
    opcoes: { "RiderMovement-worlddefault": "Como a mesa definiu", ...MOVER } },
  { k: "MountButtonPosition", tipo: String, padrao: "default", cliente: true, secao: "cliente", nome: "Botão de montar no HUD",
    opcoes: { default: "Como a mesa definiu", ...LADO_BOTAO } },
  { k: "RiderProxySelect", tipo: String, padrao: "never", cliente: true, secao: "cliente", nome: "Selecionar o cavaleiro seleciona a montaria",
    opcoes: { never: "Nunca", familiar: "Só familiares", always: "Sempre", allRiders: "Selecionar a montaria seleciona os cavaleiros", ctrl: "Com Ctrl" } },
  { k: "OnFollowerMovement", tipo: String, padrao: "stopfollowing", cliente: true, secao: "cliente", nome: "Se eu mexer num seguidor",
    opcoes: { stopfollowing: "Ele para de seguir", updatedistance: "Ele segue a nova distância" } },
  { k: "MessagePopUps", tipo: Boolean, padrao: false, cliente: true, secao: "cliente", nome: "Textos sobre os tokens",
    dica: "Mostra no mapa mensagens como \"montou em\"." },
  { k: "OnlyownedMessagePopUps", tipo: Boolean, padrao: false, cliente: true, secao: "cliente", nome: "Só dos meus tokens" },
  { k: "UINotifications", tipo: Boolean, padrao: false, cliente: true, secao: "cliente", nome: "Avisos no canto da tela" }
];

const SECOES = {
  montar: ["Montar", "Quem pode montar, de onde e o que acontece quando o cavaleiro tenta andar sozinho."],
  posicao: ["Cavaleiros em cima", "Tamanho, giro e altura de quem está montado."],
  carregar: ["Carregar e agarrar", "Levar alguém junto à força, peso e iniciativa."],
  seguir: ["Seguir", "Tokens que andam atrás de outro."],
  efeitos: ["Efeitos", "Efeitos ativos aplicados ao montar e ao agarrar."],
  interface: ["Interface", ""],
  integracoes: ["Integrações", "Só aparecem os módulos ativos neste mundo."],
  cliente: ["Neste computador", "Preferências suas, não mudam nada para os outros."]
};

export function registrarConfiguracoes(ctx) {
  for (const s of ESQUEMA) {
    const dados = {
      name: s.nome, hint: s.dica ?? "", scope: s.cliente ? "client" : "world", config: false,
      type: s.tipo, default: s.padrao
    };
    if (s.reload) dados.requiresReload = true;
    ctx.registrar(s.k, dados);
  }

  ctx.registrarMenu("config", {
    name: "Montaria", label: "Configurar a Montaria", icon: "fas fa-horse",
    hint: "Montar, carregar, agarrar e seguir.", type: ConfigMontaria, restricted: false
  });

  const tecla = (k, nome, dica, fn, editable = []) => game.keybindings.register(ID, `${RECURSO}.${k}`, {
    name: nome, hint: dica, editable, onDown: fn, restricted: false, precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
  tecla("Mount", "Montaria: montar", "Os tokens selecionados montam no token sob o cursor (ou no alvo).", () => { MountSelected(true); }, [{ key: "KeyM" }]);
  tecla("UnMount", "Montaria: desmontar", "Os tokens selecionados desmontam.", () => { UnMountSelected(); }, [{ key: "KeyN" }]);
  tecla("MountFamiliar", "Montaria: montar como familiar", "Monta num canto da montaria.", () => { MountSelectedFamiliar(true); }, [{ key: "KeyJ" }]);
  tecla("GrappleTarget", "Montaria: agarrar ou soltar", "O token selecionado agarra (ou solta) o alvo.", () => { GrappleTargeted(true); }, [{ key: "KeyH" }]);
  tecla("ToggleMount", "Montaria: montar ou desmontar", "Alterna entre montar e desmontar.", (o) => { ToggleMountselected(o); });
  tecla("ToggleGrapplePlacement", "Montaria: mudar onde fica o agarrado", "", () => { ToggleGrapplePlacementSelected(); });
  tecla("TogglePiloting", "Montaria: pilotar", "O cavaleiro passa a conduzir a montaria.", () => { TogglePilotingSelected(); });
  tecla("ToggleFollowing", "Montaria: seguir", "Os selecionados seguem (ou deixam de seguir) o token sob o cursor.", () => { SelectedToggleFollwing(); }, [{ key: "KeyG" }]);
  game.keybindings.register(ID, `${RECURSO}.ProxyTarget`, {
    name: "Montaria: mirar a montaria", hint: "Com o cursor num cavaleiro, mira a montaria dele.",
    editable: [{ key: "KeyT", modifiers: ["Control"] }], onDown: (o) => { ProxyTarget(o); }, restricted: false, reservedModifiers: ["Shift"]
  });
}

/** Configurações de cliente do Rideable (ficam no navegador de cada um): copia uma vez por navegador. */
export function migrarCliente(ctx) {
  const ls = globalThis.localStorage;
  if (!ls) return;
  for (const s of ESQUEMA.filter((x) => x.cliente)) {
    const nova = `${ID}.${RECURSO}.${s.k}`;
    const antiga = ls.getItem(`Rideable.${s.k}`);
    if (antiga === null || ls.getItem(nova) !== null) continue;
    try { ctx.set(s.k, JSON.parse(antiga)); } catch { /* valor estranho: fica o padrão */ }
  }
}

function visivel(s) {
  if (s.sistema && game.system.id !== s.sistema) return false;
  if (s.modulo) return [s.modulo].flat().some(ativo);
  return true;
}

export class ConfigMontaria extends ApplicationV2 {
  constructor(ctx, options = {}) {
    // pelo menu do Foundry o construtor recebe as opções, não o ctx
    if (!ctx?.get) { options = ctx ?? {}; ctx = ConfigMontaria.ctx; }
    super(options);
    this.ctx = ctx;
  }

  static ctx = null;

  static DEFAULT_OPTIONS = {
    id: "monolith-regras-montaria",
    classes: ["mono", "monolith-montaria"],
    tag: "form",
    window: { title: "Montaria: configuração", icon: "fas fa-horse", resizable: true },
    position: { width: 600, height: Math.min(760, window.innerHeight - 100) },
    form: { handler: ConfigMontaria.#salvar, closeOnSubmit: false },
    actions: { restaurar: ConfigMontaria.#restaurar }
  };

  #campo(s) {
    const v = this.ctx.get(s.k);
    const nome = `${esc(s.nome)}${s.reload ? ' <i class="fas fa-rotate" data-tooltip="Recarrega o mundo"></i>' : ""}`;
    const dica = s.dica ? `<span class="hint">${esc(s.dica)}</span>` : "";
    const travado = (!s.cliente && !game.user.isGM) ? "disabled" : "";
    if (s.tipo === Boolean) {
      return `<label class="mt-linha"><input type="checkbox" name="${s.k}" ${v ? "checked" : ""} ${travado}>
        <span><b>${nome}</b>${dica}</span></label>`;
    }
    let entrada;
    if (s.opcoes) {
      const ops = Object.entries(s.opcoes).map(([val, rot]) => `<option value="${esc(val)}" ${String(val) === String(v) ? "selected" : ""}>${esc(rot)}</option>`).join("");
      entrada = `<select name="${s.k}" ${travado}>${ops}</select>`;
    }
    else if (s.range) {
      const [min, max, passo] = s.range;
      entrada = `<range-picker name="${s.k}" value="${v}" min="${min}" max="${max}" step="${passo}" ${travado}></range-picker>`;
    }
    else if (s.tipo === Number) entrada = `<input type="number" name="${s.k}" value="${esc(v)}" step="any" ${travado}>`;
    else entrada = `<input type="text" name="${s.k}" value="${esc(v)}" ${travado}>`;
    return `<div class="mt-campo"><label><b>${nome}</b>${dica}</label>${entrada}</div>`;
  }

  async _renderHTML() {
    const gm = game.user.isGM;
    const secoes = Object.entries(SECOES).map(([id, [titulo, texto]]) => {
      if (!gm && id !== "cliente") return "";
      const itens = ESQUEMA.filter((s) => s.secao === id && visivel(s));
      if (!itens.length) return "";
      const comuns = itens.filter((s) => !s.avancado).map((s) => this.#campo(s)).join("");
      const avancados = itens.filter((s) => s.avancado).map((s) => this.#campo(s)).join("");
      return `<section>
        <h3>${titulo}</h3>${texto ? `<p class="hint">${texto}</p>` : ""}
        <div class="mt-grade">${comuns}</div>
        ${avancados ? `<details class="mt-mais"><summary>Mais opções</summary><div class="mt-grade">${avancados}</div></details>` : ""}
      </section>`;
    }).join("");

    const teclas = `<p class="hint mt-teclas"><b>Teclas:</b> M monta, N desmonta, J monta como familiar, H agarra ou solta o alvo,
      G segue, Ctrl+T mira a montaria. Dá para mudar em Configurar Controles. Cada token tem a aba <b>Montaria</b> na configuração dele.</p>`;

    return `<div class="mt-corpo">
      <p class="mt-intro">Tokens que andam juntos: cavaleiros acompanham a montaria pelo mesmo caminho, quem é agarrado vai junto
        e seguidores andam atrás. ${gm ? "" : "Você só pode mudar as preferências deste computador."}</p>
      ${teclas}
      ${secoes}
      <footer>
        ${gm ? `<button type="button" data-action="restaurar"><i class="fas fa-rotate-left"></i> Restaurar a configuração da mesa</button>` : ""}
        <button type="submit"><i class="fas fa-save"></i> Salvar</button>
      </footer>
    </div>`;
  }

  _replaceHTML(result, content) {
    const rolagem = content.scrollTop;
    content.innerHTML = result;
    content.scrollTop = rolagem;
  }

  static async #salvar(ev, form) {
    const ctx = this.ctx;
    let recarregar = false;
    for (const s of ESQUEMA) {
      const el = form.elements[s.k];
      if (!el || el.disabled) continue;
      if (!s.cliente && !game.user.isGM) continue;
      let v;
      if (s.tipo === Boolean) v = !!el.checked;
      else if (s.tipo === Number) {
        v = Number(el.value);
        if (!Number.isFinite(v)) continue;
      }
      else v = String(el.value ?? "");
      if (v === ctx.get(s.k)) continue;
      await ctx.set(s.k, v);
      if (s.reload) recarregar = true;
    }
    ui.notifications.info("Montaria: configuração salva.");
    if (recarregar) {
      const SettingsConfig = foundry.applications.settings?.SettingsConfig;
      if (SettingsConfig?.reloadConfirm) await SettingsConfig.reloadConfirm({ world: true });
      else foundry.utils.debouncedReload();
    }
    else this.render();
  }

  static async #restaurar() {
    const ok = await DialogV2.confirm({
      classes: ["mono"], window: { title: "Montaria" },
      content: "<p>Voltar todas as opções do mundo para a configuração da mesa (como estava no Rideable)? As preferências de cada computador não mudam.</p>"
    }).catch(() => false);
    if (!ok) return;
    let recarregar = false;
    for (const s of ESQUEMA.filter((x) => !x.cliente)) {
      if (this.ctx.get(s.k) === s.padrao) continue;
      await this.ctx.set(s.k, s.padrao);
      if (s.reload) recarregar = true;
    }
    ui.notifications.info("Montaria: configuração da mesa restaurada.");
    if (recarregar) {
      const SettingsConfig = foundry.applications.settings?.SettingsConfig;
      if (SettingsConfig?.reloadConfirm) await SettingsConfig.reloadConfirm({ world: true });
      else foundry.utils.debouncedReload();
    }
    else this.render();
  }
}

export { cGrapplePlacements };
