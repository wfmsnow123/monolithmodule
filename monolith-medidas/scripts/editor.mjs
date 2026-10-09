import { ID, EFEITOS, medidasPadrao, esc } from "./config.mjs";

const { ApplicationV2, DialogV2 } = foundry.applications.api;

const DICA_PARAMETRO = {
  nenhum: "",
  enfase: "",
  rolar: "Fórmula, ex.: 1d8",
  espaco: "Círculo máximo, ex.: 5",
  macro: "UUID ou nome da macro"
};

/** Janela para criar e editar as Medidas Desesperadas. */
export class EditorMedidas extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "monolith-medidas-editor",
    classes: ["mono", "monolith-medidas-editor"],
    tag: "form",
    window: { title: "Medidas Desesperadas: editar", icon: "fas fa-heart-crack", resizable: true },
    position: { width: 680, height: Math.min(780, window.innerHeight - 100) },
    form: { handler: EditorMedidas.#salvar, closeOnSubmit: false },
    actions: {
      adicionar: EditorMedidas.#adicionar,
      remover: EditorMedidas.#remover,
      subir: EditorMedidas.#subir,
      padrao: EditorMedidas.#padrao
    }
  };

  #rascunho = null;

  get lista() {
    this.#rascunho ??= foundry.utils.deepClone(game.settings.get(ID, "lista") ?? medidasPadrao());
    return this.#rascunho;
  }

  async _renderHTML() {
    const cards = this.lista.map((m, i) => {
      const ef = Object.entries(EFEITOS).map(([k, l]) => `<option value="${k}" ${m.efeito === k ? "selected" : ""}>${l}</option>`).join("");
      const custo = [1, 2, 3].map((c) => `<option value="${c}" ${Number(m.custo) === c ? "selected" : ""}>${"✖".repeat(c)} ${c}</option>`).join("");
      return `<fieldset class="medida-ed ${m.ativa === false ? "inativa" : ""}">
        <div class="linha">
          <label class="largo">Nome <input type="text" name="m${i}.nome" value="${esc(m.nome)}"></label>
          <label>Custo <select name="m${i}.custo">${custo}</select></label>
          <label class="check"><input type="checkbox" name="m${i}.ativa" ${m.ativa !== false ? "checked" : ""}> Ativa</label>
        </div>
        <label class="bloco">Texto <textarea name="m${i}.texto" rows="2">${esc(m.texto)}</textarea></label>
        <div class="linha">
          <label>Ao usar <select name="m${i}.efeito">${ef}</select></label>
          <label class="largo">Parâmetro <input type="text" name="m${i}.parametro" value="${esc(m.parametro)}" placeholder="${DICA_PARAMETRO[m.efeito] ?? ""}"></label>
          <label class="check" data-tooltip="Fica na lista de Armadas até ser marcada como usada; expira no descanso."><input type="checkbox" name="m${i}.armada" ${m.armada ? "checked" : ""}> Armada</label>
        </div>
        <div class="acoes">
          <button type="button" data-action="subir" data-index="${i}" ${i ? "" : "disabled"}><i class="fas fa-arrow-up"></i></button>
          <button type="button" data-action="remover" data-index="${i}"><i class="fas fa-trash"></i> Remover</button>
        </div>
      </fieldset>`;
    }).join("");
    return `<div class="mm-editor">
      <p class="hint">Cada Medida marca o número de falhas do custo no Fio e é anunciada no chat. "Ao usar" acrescenta um efeito automático; "Armada" guarda a Medida até o gatilho acontecer. Uma macro recebe <code>actor</code>, <code>token</code> e <code>medida</code>.</p>
      ${cards}
      <footer class="rodape">
        <button type="button" data-action="adicionar"><i class="fas fa-plus"></i> Nova Medida</button>
        <button type="button" data-action="padrao"><i class="fas fa-rotate-left"></i> Restaurar as do livro</button>
        <button type="submit"><i class="fas fa-save"></i> Salvar</button>
      </footer>
    </div>`;
  }

  _replaceHTML(result, content) {
    const scroll = content.scrollTop;
    content.innerHTML = result;
    content.scrollTop = scroll;
  }

  #ler() {
    const form = this.element;
    if (!form?.elements) return;
    const v = (n) => form.elements[n];
    this.lista.forEach((m, i) => {
      if (!v(`m${i}.nome`)) return;
      m.nome = v(`m${i}.nome`).value.trim() || `Medida ${i + 1}`;
      m.custo = Number(v(`m${i}.custo`).value) || 1;
      m.ativa = v(`m${i}.ativa`).checked;
      m.texto = v(`m${i}.texto`).value.trim();
      m.efeito = v(`m${i}.efeito`).value;
      m.parametro = v(`m${i}.parametro`).value.trim();
      m.armada = v(`m${i}.armada`).checked;
      m.id ||= foundry.utils.randomID();
    });
  }

  static async #salvar() {
    this.#ler();
    await game.settings.set(ID, "lista", this.lista);
    ui.notifications.info("Medidas Desesperadas salvas.");
    this.render();
  }

  static #adicionar() {
    this.#ler();
    this.lista.push({ id: foundry.utils.randomID(), custo: 1, nome: "Nova Medida", texto: "", efeito: "nenhum", parametro: "", armada: false, ativa: true });
    this.render();
  }

  static #remover(ev, el) {
    this.#ler();
    this.lista.splice(Number(el.dataset.index), 1);
    this.render();
  }

  static #subir(ev, el) {
    this.#ler();
    const i = Number(el.dataset.index);
    if (i > 0) [this.lista[i - 1], this.lista[i]] = [this.lista[i], this.lista[i - 1]];
    this.render();
  }

  static async #padrao() {
    const ok = await DialogV2.confirm({ classes: ["mono"], window: { title: "Restaurar" }, content: "<p>Trocar todas as Medidas pelas do livro?</p>" }).catch(() => false);
    if (!ok) return;
    this.#rascunho = medidasPadrao();
    this.render();
  }
}
