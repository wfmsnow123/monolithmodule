import { ID, ABILIDADES, ROTULO_HAB, faixasPadrao, recalcularTodos } from "./regras.mjs";

const { ApplicationV2 } = foundry.applications.api;
const esc = (v) => foundry.utils.escapeHTML(String(v ?? ""));

/** Janela para criar e editar as faixas de carga. */
export class EditorFaixas extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "monolith-encumbrance-editor",
    classes: ["mono", "monolith-enc"],
    tag: "form",
    window: { title: "Monolith: Encumbrance, faixas de carga", icon: "fas fa-weight-hanging", resizable: true },
    position: { width: 720, height: 720 },
    form: { handler: EditorFaixas.#salvar, closeOnSubmit: false },
    actions: {
      adicionar: EditorFaixas.#adicionar,
      remover: EditorFaixas.#remover,
      subir: EditorFaixas.#subir,
      padrao: EditorFaixas.#padrao,
      icone: EditorFaixas.#icone
    }
  };

  #rascunho = null;

  get lista() {
    this.#rascunho ??= foundry.utils.deepClone(game.settings.get(ID, "faixas") ?? faixasPadrao());
    return this.#rascunho;
  }

  async _renderHTML() {
    const metric = game.settings.get("dnd5e", "metricLengthUnits");
    const dist = metric ? "m" : "pés";
    const cards = this.lista.map((f, i) => {
      const d = f.desvantagem ?? {};
      const grade = ABILIDADES.map((a) => `<tr><th>${ROTULO_HAB[a]}</th>
        ${["ataque", "teste", "resistencia"].map((t) => `<td><input type="checkbox" name="f${i}.dv.${t}.${a}" ${(d[t] ?? []).includes(a) ? "checked" : ""}></td>`).join("")}</tr>`).join("");
      const op = (v, l) => `<option value="${v}" ${f.deslocamentoModo === v ? "selected" : ""}>${l}</option>`;
      return `<fieldset class="faixa" data-index="${i}">
        <legend><img src="${esc(f.img)}" alt=""> ${esc(f.nome)}</legend>
        <div class="linha">
          <label>Nome <input type="text" name="f${i}.nome" value="${esc(f.nome)}"></label>
          <label class="curto">Ativa <input type="checkbox" name="f${i}.ativa" ${f.ativa !== false ? "checked" : ""}></label>
        </div>
        <div class="linha">
          <label>Acima de <input type="number" step="0.5" min="0" name="f${i}.multiplicador" value="${esc(f.multiplicador)}"> x Força</label>
          <label>Ícone <input type="text" name="f${i}.img" value="${esc(f.img)}"><button type="button" data-action="icone" data-index="${i}" title="Escolher"><i class="fas fa-file-image"></i></button></label>
        </div>
        <div class="linha">
          <label>Deslocamento <select name="f${i}.deslocamentoModo">${op("nenhum", "Sem mudança")}${op("reduzir", `Reduzir em (${dist})`)}${op("multiplicar", "Multiplicar por")}${op("definir", `Definir em (${dist})`)}</select></label>
          <label>Valor <input type="number" step="any" name="f${i}.deslocamentoValor" value="${esc(f.deslocamentoValor)}"></label>
        </div>
        <div class="linha">
          <table class="grade"><thead><tr><th>Desvantagem</th><th>Ataques</th><th>Testes</th><th>Resistências</th></tr></thead><tbody>${grade}</tbody></table>
          <label class="extras">Efeitos extras <textarea name="f${i}.efeitosExtras" rows="5" placeholder="chave | modo | valor&#10;system.attributes.ac.bonus | add | -1&#10;system.bonuses.abilities.skill | add | -2">${esc(f.efeitosExtras)}</textarea>
            <span class="hint">Modos: add, multiply, override, upgrade, downgrade. Linhas com # são ignoradas.</span></label>
        </div>
        <label>Descrição <input type="text" name="f${i}.descricao" value="${esc(f.descricao)}"></label>
        <div class="acoes">
          <button type="button" data-action="subir" data-index="${i}"><i class="fas fa-arrow-up"></i> Subir</button>
          <button type="button" data-action="remover" data-index="${i}"><i class="fas fa-trash"></i> Remover</button>
        </div>
      </fieldset>`;
    }).join("");
    return `<div class="monolith-enc-body">
      <p class="hint">A faixa aplicada é a de maior limite que o peso carregado ultrapassa. O limite é multiplicador x Força (x tamanho), na unidade escolhida nas configurações do módulo. Cada faixa vira um efeito ativo no personagem, atualizado sozinho quando o peso ou a Força mudam.</p>
      ${cards}
      <footer class="rodape">
        <button type="button" data-action="adicionar"><i class="fas fa-plus"></i> Nova faixa</button>
        <button type="button" data-action="padrao"><i class="fas fa-rotate-left"></i> Restaurar regra de Monolith</button>
        <button type="submit"><i class="fas fa-save"></i> Salvar</button>
      </footer>
    </div>`;
  }

  _replaceHTML(result, content) { content.innerHTML = result; }

  /** Lê o formulário de volta para o rascunho (preserva edições antes de re-renderizar). */
  #ler() {
    const form = this.element;
    if (!form?.elements) return;
    const v = (n) => form.elements[n];
    this.lista.forEach((f, i) => {
      if (!v(`f${i}.nome`)) return;
      f.nome = v(`f${i}.nome`).value.trim() || `Faixa ${i + 1}`;
      f.ativa = v(`f${i}.ativa`).checked;
      f.multiplicador = Number(v(`f${i}.multiplicador`).value) || 0;
      f.img = v(`f${i}.img`).value.trim();
      f.deslocamentoModo = v(`f${i}.deslocamentoModo`).value;
      f.deslocamentoValor = Number(v(`f${i}.deslocamentoValor`).value) || 0;
      f.efeitosExtras = v(`f${i}.efeitosExtras`).value;
      f.descricao = v(`f${i}.descricao`).value;
      f.desvantagem = { ataque: [], teste: [], resistencia: [] };
      for (const t of ["ataque", "teste", "resistencia"]) for (const a of ABILIDADES) if (v(`f${i}.dv.${t}.${a}`)?.checked) f.desvantagem[t].push(a);
      f.id ||= foundry.utils.randomID();
    });
  }

  static async #salvar() {
    this.#ler();
    await game.settings.set(ID, "faixas", this.lista);
    ui.notifications.info("Monolith: Encumbrance: faixas salvas.");
    recalcularTodos();
    this.render();
  }

  static #adicionar() {
    this.#ler();
    this.lista.push({ id: foundry.utils.randomID(), nome: "Nova faixa", ativa: true, multiplicador: 20, img: "icons/svg/anchor.svg", deslocamentoModo: "nenhum", deslocamentoValor: 0, desvantagem: { ataque: [], teste: [], resistencia: [] }, efeitosExtras: "", descricao: "" });
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
    const ok = await foundry.applications.api.DialogV2.confirm({ classes: ["mono"], window: { title: "Restaurar" }, content: "<p>Trocar todas as faixas pela regra de Monolith?</p>" }).catch(() => false);
    if (!ok) return;
    this.#rascunho = faixasPadrao();
    this.render();
  }

  static #icone(ev, el) {
    this.#ler();
    const i = Number(el.dataset.index);
    new foundry.applications.apps.FilePicker.implementation({
      type: "image",
      current: this.lista[i].img,
      callback: (path) => { this.lista[i].img = path; this.render(); }
    }).render(true);
  }
}
