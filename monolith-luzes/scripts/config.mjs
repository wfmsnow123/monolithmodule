import { normal, lista, bateNome } from "./calculo.mjs";

export const ID = "monolith-luzes";

export const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

/**
 * Uma fonte de luz.
 * @typedef {object} Fonte
 * @property {string} id
 * @property {string} nome
 * @property {string} nomes        Nomes de item que contam como esta fonte, separados por vírgula (sem diferenciar maiúsculas).
 * @property {"objeto"|"magia"|"qualquer"} tipo  Objeto = equipamento, consumível, ferramenta...; magia = truque ou magia que o personagem tem.
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

const base = (id, nome, nomes, brilho, penumbra, extra = {}) => ({
  id, nome, nomes, tipo: "objeto", brilho, penumbra, angulo: 360, cor: "#ff9b4a", alfa: 0.4, animacao: "torch",
  duracao: 60, consumo: "item", combustivel: "", cobertaBrilho: 0, cobertaPenumbra: 0, ...extra
});

/** Magias de luz (da lista do Torch para o dnd5e). Não gastam nada; acabam com a duração da magia. */
export function fontesMagia() {
  const m = (id, nome, nomes, brilho, penumbra, extra) => base(id, nome, nomes, brilho, penumbra, { tipo: "magia", consumo: "nada", animacao: "", ...extra });
  return [
    m("luz", "Luz", "light, luz", 20, 40, { duracao: 60, cor: "#fff1d6", alfa: 0.2 }),
    m("globos-de-luz", "Globos de Luz", "dancing lights, globos de luz, luzes dancantes", 0, 10, { duracao: 1, cor: "#cfe3ff", alfa: 0.3, animacao: "pulse" }),
    m("criar-chamas", "Criar Chamas", "produce flame, criar chamas, produzir chama", 10, 20, { duracao: 10, cor: "#ff9329", alfa: 0.5, animacao: "flame" }),
    m("luz-do-dia", "Luz do Dia", "daylight, luz do dia", 60, 120, { duracao: 60, cor: "#fff6e5", alfa: 0.2 })
  ];
}

export function fontesPadrao() {
  return [
    base("tocha", "Tocha", "torch, tocha, antorcha", 20, 40),
    base("vela", "Vela", "candle, vela", 5, 10, { alfa: 0.3 }),
    base("lamparina", "Lamparina", "lamp, lamparina, lâmpada, candil", 15, 45,
      { animacao: "flame", duracao: 360, consumo: "combustivel", combustivel: "oil, óleo, oleo", cor: "#ffb15e" }),
    base("lanterna-coberta", "Lanterna coberta", "hooded lantern, hooded, lanterna coberta, lantern, lanterna", 30, 60,
      { animacao: "flame", duracao: 360, consumo: "combustivel", combustivel: "oil, óleo, oleo", cor: "#ffb15e", cobertaBrilho: 0, cobertaPenumbra: 5 }),
    base("lanterna-furta-fogo", "Lanterna furta-fogo", "bullseye lantern, bullseye, lanterna furta-fogo, furta-fogo", 60, 120,
      { angulo: 57, animacao: "flame", duracao: 360, consumo: "combustivel", combustivel: "oil, óleo, oleo", cor: "#ffc773" }),
    ...fontesMagia()
  ];
}

export const novaFonte = () => base(foundry.utils.randomID(), "Nova fonte", "", 10, 20);

const ANIMACOES = { torch: "Tocha", flame: "Chama", pulse: "Pulso", chroma: "Croma", wave: "Onda", fog: "Névoa", sunburst: "Raios", "": "Nenhuma" };
export const animacoes = () => ANIMACOES;
export const TIPOS = { objeto: "Objeto (equipamento, consumível...)", magia: "Magia ou truque", qualquer: "Qualquer item" };

export function registrarConfiguracoes(Editor, aoMudar) {
  const reg = (k, d) => game.settings.register(ID, k, { scope: "world", config: true, ...d });
  game.settings.register(ID, "fontes", { scope: "world", config: false, type: Array, default: fontesPadrao(), onChange: aoMudar });
  game.settings.registerMenu(ID, "editor", {
    name: "Fontes de luz", label: "Editar fontes de luz", icon: "fas fa-fire",
    hint: "Quais itens e magias dão luz, alcance, cor, animação, quanto tempo queimam e o que consomem.",
    type: Editor, restricted: true
  });
  reg("queimar", {
    name: "A chama queima com o tempo",
    hint: "Tochas, velas, o óleo das lanternas e as magias de luz acabam conforme o tempo do mundo passa (calendário, descansos, avanço de horas).",
    type: Boolean, default: true
  });
  reg("avisos", { name: "Avisar no chat", hint: "Mensagem para o dono quando a chama fica fraca (10 minutos) e quando se apaga.", type: Boolean, default: true });
  reg("usarAcende", {
    name: "Usar o item acende",
    hint: "Usar uma tocha ou lanterna pela ficha acende ou apaga (ataques com a tocha continuam sendo ataques). Lançar Luz e afins acende a magia.",
    type: Boolean, default: true
  });
  reg("botaoHud", { name: "Botão no HUD do token", type: Boolean, default: true });
  reg("jogadoresAcendem", { name: "Jogadores acendem as próprias luzes", hint: "Desligado: só o Mestre acende e apaga (os jogadores ainda pegam e carregam objetos do chão).", type: Boolean, default: true, onChange: aoMudar });
  reg("exigirEquipado", { name: "Só acende o que está equipado", hint: "Itens com o campo Equipado (dnd5e) só dão luz quando equipados. Desequipar apaga.", type: Boolean, default: false, onChange: aoMudar });
  reg("jogadorGasta", { name: "Jogador gasta combustível ao acender", hint: "Acender uma lanterna vazia gasta um frasco de óleo do inventário.", type: Boolean, default: true });
  reg("mestreGasta", { name: "Mestre gasta combustível ao acender", hint: "Desligado: quando o Mestre acende uma lanterna vazia, ela enche sem gastar óleo.", type: Boolean, default: false });
  reg("luzAvulsa", {
    name: "Luz sem item",
    hint: "Quem pode acender um token que não tem nenhuma fonte de luz (usa a luz avulsa abaixo).",
    type: String, default: "mestre", choices: { nunca: "Ninguém", mestre: "Só o Mestre", todos: "Todos" }
  });
  reg("avulsaNome", { name: "Luz avulsa: nome", type: String, default: "Tocha" });
  reg("avulsaBrilho", { name: "Luz avulsa: luz plena (pés)", type: Number, default: 20, onChange: aoMudar });
  reg("avulsaPenumbra", { name: "Luz avulsa: penumbra (pés)", type: Number, default: 40, onChange: aoMudar });
  reg("colocarNoMapa", {
    name: "Arrastar luz para o mapa",
    hint: "Soltar uma tocha ou lanterna da ficha no mapa deixa o objeto ali (aceso ou não). Segure Shift ao soltar para deixar o Item Piles ou o Foundry cuidarem do item.",
    type: Boolean, default: true
  });
  // Controle interno das migrações.
  game.settings.register(ID, "migracaoTorch", { scope: "world", config: false, type: Boolean, default: false });
  game.settings.register(ID, "versaoFontes", { scope: "world", config: false, type: Number, default: 1 });
}

export const cfg = (k) => game.settings.get(ID, k);

export function fontes() {
  const l = game.settings.get(ID, "fontes");
  return Array.isArray(l) && l.length ? l : fontesPadrao();
}

/** Aceita um Item ou os dados de um (objeto no chão). */
const flagDe = (item, k) => (typeof item?.getFlag === "function" ? item.getFlag(ID, k) : item?.flags?.[ID]?.[k]);
export const ehMagia = (item) => item?.type === "spell";
export const ehObjeto = (item) => !ehMagia(item) && "quantity" in (item?.system ?? {});
const tipoAceita = (f, item) => {
  const t = f.tipo || "objeto";
  return t === "qualquer" ? (ehMagia(item) || ehObjeto(item)) : t === "magia" ? ehMagia(item) : ehObjeto(item);
};

/** A fonte de luz de um item: a escolhida no item, ou a que tem o nome mais específico que bate (respeitando o tipo). */
export function fonteDe(item) {
  if (!item || !(ehObjeto(item) || ehMagia(item))) return null;
  const escolhida = flagDe(item, "fonte");
  if (escolhida === "nenhuma") return null;
  const todas = fontes();
  if (escolhida) return todas.find((f) => f.id === escolhida) ?? null;
  let melhor = null, tamanho = 0;
  for (const f of todas) {
    if (!tipoAceita(f, item)) continue;
    const t = bateNome(item.name, f.nomes, ehMagia(item));
    if (t > tamanho) { melhor = f; tamanho = t; }
  }
  return melhor;
}

/** O item conta agora: tem quantidade (objeto) e, se exigido, está equipado. Magias contam sempre. */
export function disponivel(item) {
  if (!fonteDe(item)) return false;
  if (ehMagia(item)) return true;
  if (!((item.system.quantity ?? 0) > 0)) return false;
  if (cfg("exigirEquipado") && "equipped" in item.system && !item.system.equipped) return false;
  return true;
}

/** A luz avulsa (token sem fonte), no formato de fonte. */
export function fonteAvulsa() {
  return base("avulsa", cfg("avulsaNome") || "Tocha", "", Number(cfg("avulsaBrilho")) || 0, Number(cfg("avulsaPenumbra")) || 0, { duracao: 0, consumo: "nada" });
}

/** O usuário pode acender e apagar? */
export const podeAcender = (user = game.user) => user.isGM || cfg("jogadoresAcendem");
export const podeAvulsa = (user = game.user) => { const v = cfg("luzAvulsa"); return v === "todos" || (v === "mestre" && user.isGM); };
export const gastaAoAcender = (user = game.user) => (user.isGM ? cfg("mestreGasta") : cfg("jogadorGasta"));

/** Item de combustível no inventário para uma fonte. */
export function combustivelDe(actor, fonte) {
  const nomes = lista(fonte?.combustivel);
  if (!nomes.length) return null;
  return actor?.items.find((i) => (i.system?.quantity ?? 0) > 0 && nomes.some((n) => normal(i.name).includes(n))) ?? null;
}
