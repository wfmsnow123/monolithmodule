/** Janela de configuração do recurso Visão. */
import { AUDICAO_PADRAO } from "./lib/settings.mjs";

const { ApplicationV2 } = foundry.applications.api;

const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

/** Sentidos que o recurso monta sozinho, para a referência da janela. */
const SENTIDOS = [
  ["Visão no Escuro", "Do campo Sentidos do ator. Vê no escuro como penumbra, em tons de cinza."],
  ["Percepção às Cegas", "Do campo Sentidos. Percebe tudo no alcance, até invisíveis, sem precisar de luz."],
  ["Sentido Sísmico", "Do campo Sentidos. Percebe criaturas que tocam o chão (impreciso, não revela a forma)."],
  ["Visão Verdadeira", "Do campo Sentidos. Vê no escuro mágico, invisíveis, ilusões e o Plano Etéreo."],
  ["Audição", "Todo token ouve até o alcance padrão abaixo. Surdos não ouvem; Inaudíveis não são ouvidos."],
  ["Visão Diabólica", "Invocação de Bruxo ou característica de mesmo nome: enxerga no escuro mágico."],
  ["Ver o Invisível, Detectar Magia, Detectar o Bem e o Mal, Detectar Veneno e Doença, Detectar Pensamentos",
    "Ligados por efeitos ativos com o nome da magia (em português ou inglês)."],
  ["Sentido Divino, Olhos da Sepultura, Visão Etérea, Visão Térmica, Percepção da Vida e do Sangue",
    "Por característica ou efeito com o nome correspondente."]
];

/** Exemplos de alcance de audição para algumas Percepções passivas. */
function exemplosAudicao(formula) {
  const f = String(formula ?? "").trim() || "0";
  const out = [];
  for (const passiva of [10, 13, 15, 18]) {
    try {
      const dados = { skills: { prc: { passive: passiva } } };
      const expr = foundry.dice.Roll.replaceFormulaData(f, dados, { missing: "0" });
      const v = Math.max(0, Math.round(foundry.dice.Roll.safeEval(expr)));
      out.push(`<span class="vz-ex"><b>${passiva}</b> → ${v} pés</span>`);
    } catch {
      return `<span class="vz-erro">Fórmula inválida</span>`;
    }
  }
  return out.join("");
}

export class ConfigVisao extends ApplicationV2 {
  constructor(ctx, options = {}) {
    super(options);
    this.ctx = ctx;
  }

  static DEFAULT_OPTIONS = {
    id: "monolith-regras-visao",
    classes: ["mono", "monolith-visao"],
    tag: "form",
    window: { title: "Visão: configuração", icon: "fas fa-eye", resizable: true },
    position: { width: 580, height: Math.min(720, window.innerHeight - 100) },
    form: { handler: ConfigVisao.#salvar, closeOnSubmit: false },
    actions: { padrao: ConfigVisao.#padrao }
  };

  async _renderHTML() {
    const audicao = this.ctx.get("defaultHearingRange");
    const espectador = this.ctx.get("spectatorMode");
    const sentidos = SENTIDOS.map(([n, d]) => `<li><b>${n}</b><span>${d}</span></li>`).join("");
    return `<div class="vz-corpo">
      <p class="vz-intro">Os sentidos do dnd5e viram modos de detecção no mapa. O alcance de cada sentido vem da ficha
        (Sentidos, características e efeitos ativos) e é aplicado ao token automaticamente: os campos de alcance da aba
        Visão do token ficam travados. Quando o token tem mais de um modo de visão, o HUD do token ganha um botão para alternar.</p>

      <section>
        <h3>Audição</h3>
        <label class="vz-campo">
          <span class="vz-rotulo">Alcance de audição padrão (pés)</span>
          <input type="text" name="defaultHearingRange" value="${esc(audicao)}" placeholder="0" spellcheck="false">
        </label>
        <p class="hint">Número fixo ou fórmula com dados do ator. O padrão da mesa é <code>${esc(AUDICAO_PADRAO)}</code>:
          15 pés com Percepção passiva 10, mais 2,5 pés por ponto acima disso. Use 0 para desligar a audição.
          Mudar este valor recarrega o mundo para todos.</p>
        <div class="vz-exemplos" data-exemplos>${exemplosAudicao(audicao)}</div>
        <button type="button" class="vz-mini" data-action="padrao"><i class="fas fa-rotate-left"></i> Voltar ao padrão</button>
      </section>

      <section>
        <h3>Espectador</h3>
        <label class="vz-linha">
          <input type="checkbox" name="spectatorMode" ${espectador ? "checked" : ""}>
          <span><b>Modo espectador</b>
          <span class="hint">Quando todos os tokens de um jogador estão derrotados, petrificados ou inconscientes, ele passa
            a enxergar pelos tokens de atores em que tem permissão Limitada. Assim ninguém fica com a tela preta enquanto o grupo segue.</span></span>
        </label>
      </section>

      <section>
        <h3>Sentidos automáticos</h3>
        <ul class="vz-sentidos">${sentidos}</ul>
        <p class="hint">Condições que o recurso considera: Cego, Surdo, Invisível, Etéreo, Petrificado, Inconsciente, Derrotado
          e Inaudível (nova condição, para quem não deve ser ouvido). Fontes de escuridão: veja a dica na configuração da luz.</p>
      </section>

      <footer><button type="submit"><i class="fas fa-save"></i> Salvar</button></footer>
    </div>`;
  }

  _replaceHTML(result, content) { content.innerHTML = result; }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const input = this.element.querySelector('[name="defaultHearingRange"]');
    const alvo = this.element.querySelector("[data-exemplos]");
    input?.addEventListener("input", () => { alvo.innerHTML = exemplosAudicao(input.value); });
  }

  static #padrao() {
    const input = this.element.querySelector('[name="defaultHearingRange"]');
    input.value = AUDICAO_PADRAO;
    input.dispatchEvent(new Event("input"));
  }

  static async #salvar(ev, form) {
    const ctx = this.ctx;
    const audicao = String(form.elements.defaultHearingRange.value ?? "").trim() || "0";
    const valida = foundry.dice.Roll.validate(audicao) || Number.isFinite(Number(audicao));
    if (!valida) {
      ui.notifications.warn("Visão: a fórmula de audição não é válida. Nada foi salvo.");
      return;
    }
    const mudouAudicao = audicao !== ctx.get("defaultHearingRange");
    await ctx.set("spectatorMode", !!form.elements.spectatorMode.checked);
    await this.close();
    if (mudouAudicao) {
      await ctx.set("defaultHearingRange", audicao);
      const SettingsConfig = foundry.applications.settings?.SettingsConfig;
      if (SettingsConfig?.reloadConfirm) await SettingsConfig.reloadConfirm({ world: true });
      else foundry.utils.debouncedReload();
    }
  }
}
