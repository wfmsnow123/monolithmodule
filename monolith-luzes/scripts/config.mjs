export const ID = "monolith-luzes";

export const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

/**
 * Uma fonte de luz.
 * @typedef {object} Fonte
 * @property {string} id
 * @property {string} nome
 * @property {string} nomes        Nomes de item que contam como esta fonte, separados por vírgula (sem diferenciar maiúsculas).
 * @property {number} brilho       Luz plena, em pés.
 * @property {number} penumbra     Penumbra, em pés.
 * @property {number} angulo       360 = em volta; menos que isso é um cone na direção do token.
 * @property {string} cor
 * @property {number} alfa         Força da cor (0 a 1).
 * @property {string} animacao     Animação de luz do Foundry (torch, flame, pulse...).
 * @property {number} duracao      Minutos de queima; 0 = não se apaga sozinha.
 * @property {"item"|"combustivel"|"nada"} consumo  O que acaba quando a chama se apaga.
 * @property {string} combustivel  Nomes do item de combustível (ex.: óleo), separados por vírgula.
 * @property {number} cobertaBrilho   Modo coberto (lanterna coberta): luz plena.
 * @property {number} cobertaPenumbra Modo coberto: penumbra. Os dois em 0 = sem modo coberto.
 */

export function fontesPadrao() {
  const f = (id, nome, nomes, brilho, penumbra, extra = {}) => ({
    id, nome, nomes, brilho, penumbra, angulo: 360, cor: "#ff9b4a", alfa: 0.4, animacao: "torch",
    duracao: 60, consumo: "item", combustivel: "", cobertaBrilho: 0, cobertaPenumbra: 0, ...extra
  });
  return [
    f("tocha", "Tocha", "torch, tocha, antorcha", 20, 40),
    f("vela", "Vela", "candle, vela", 5, 10, { alfa: 0.3 }),
    f("lamparina", "Lamparina", "lamp, lamparina, lâmpada, candil", 15, 45,
      { animacao: "flame", duracao: 360, consumo: "combustivel", combustivel: "oil, óleo, oleo", cor: "#ffb15e" }),
    f("lanterna-coberta", "Lanterna coberta", "hooded lantern, hooded, lanterna coberta, lantern, lanterna", 30, 60,
      { animacao: "flame", duracao: 360, consumo: "combustivel", combustivel: "oil, óleo, oleo", cor: "#ffb15e", cobertaBrilho: 0, cobertaPenumbra: 5 }),
    f("lanterna-furta-fogo", "Lanterna furta-fogo", "bullseye lantern, bullseye, lanterna furta-fogo, furta-fogo", 60, 120,
      { angulo: 57, animacao: "flame", duracao: 360, consumo: "combustivel", combustivel: "oil, óleo, oleo", cor: "#ffc773" })
  ];
}

const ANIMACOES = { torch: "Tocha", flame: "Chama", pulse: "Pulso", chroma: "Croma", wave: "Onda", fog: "Névoa", sunburst: "Raios", "": "Nenhuma" };
export const animacoes = () => ANIMACOES;

export function registrarConfiguracoes(Editor, aoMudar) {
  game.settings.register(ID, "fontes", { scope: "world", config: false, type: Array, default: fontesPadrao(), onChange: aoMudar });
  game.settings.registerMenu(ID, "editor", {
    name: "Fontes de luz", label: "Editar fontes de luz", icon: "fas fa-fire",
    hint: "Quais itens dão luz, alcance, cor, animação, quanto tempo queimam e o que consomem.",
    type: Editor, restricted: true
  });
  game.settings.register(ID, "queimar", {
    name: "A chama queima com o tempo",
    hint: "Tochas, velas e o óleo das lanternas acabam conforme o tempo do mundo passa (calendário, descansos, avanço de horas).",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(ID, "avisos", {
    name: "Avisar no chat",
    hint: "Mensagem para o dono quando a chama fica fraca (10 minutos) e quando se apaga.",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(ID, "usarAcende", {
    name: "Usar o item acende",
    hint: "Usar uma tocha ou lanterna pela ficha acende ou apaga (ataques com a tocha continuam sendo ataques).",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(ID, "botaoHud", {
    name: "Botão no HUD do token",
    scope: "world", config: true, type: Boolean, default: true
  });
}

export function fontes() {
  const l = game.settings.get(ID, "fontes");
  return Array.isArray(l) && l.length ? l : fontesPadrao();
}

const normal = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const lista = (s) => String(s ?? "").split(",").map(normal).filter(Boolean);

/** A fonte de luz de um item: a escolhida no item, ou a primeira cujo nome bate (o mais específico vence). */
export function fonteDe(item) {
  if (!item || !("quantity" in (item.system ?? {}))) return null;
  const escolhida = item.getFlag(ID, "fonte");
  if (escolhida === "nenhuma") return null;
  const todas = fontes();
  if (escolhida) return todas.find((f) => f.id === escolhida) ?? null;
  const nome = normal(item.name);
  let melhor = null, tamanho = 0;
  for (const f of todas) for (const n of lista(f.nomes)) {
    if ((nome === n || nome.includes(n)) && n.length > tamanho) { melhor = f; tamanho = n.length; }
  }
  return melhor;
}

/** Item de combustível no inventário para uma fonte. */
export function combustivelDe(actor, fonte) {
  const nomes = lista(fonte?.combustivel);
  if (!nomes.length) return null;
  return actor?.items.find((i) => (i.system?.quantity ?? 0) > 0 && nomes.some((n) => normal(i.name).includes(n))) ?? null;
}
