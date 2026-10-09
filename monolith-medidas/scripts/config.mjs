export const ID = "monolith-medidas";

/** Flags do personagem, no escopo deste módulo. */
export const F = {
  marcadas: "marcadas",        // falhas marcadas no Fio (0-3)
  armadas: "armadas",          // Medidas armadas esperando gatilho [{id, nome}]
  queimando: "queimando",      // Queima de Alma ativa
  recusou: "recusouMorte",     // já usou Recusar a Morte
  ultimaMedida: "ultimaMedida" // "combate.rodada.turno" da última Medida usada
};

/**
 * O que acontece ao usar uma Medida, além de marcar o Fio e anunciar no chat.
 *   nenhum   só anuncia
 *   enfase   arma Ênfase na próxima rolagem de d20 (precisa do Monolith: Regras da Casa)
 *   rolar    rola a fórmula do parâmetro (ex.: 1d8)
 *   espaco   recupera um espaço de magia gasto, do 1º ao círculo do parâmetro
 *   macro    executa a macro do parâmetro (UUID), com actor, token e medida no escopo
 */
export const EFEITOS = {
  nenhum: "Só anunciar",
  enfase: "Armar Ênfase",
  rolar: "Rolar fórmula",
  espaco: "Recuperar espaço de magia",
  macro: "Executar macro"
};

export function medidasPadrao() {
  const m = (id, custo, nome, texto, extra = {}) => ({ id, custo, nome, texto, efeito: "nenhum", parametro: "", armada: false, ativa: true, ...extra });
  return [
    m("arrancada", 1, "Arrancada", "Você realiza as ações Disparada e Desengajar imediatamente como ação padrão ou bônus."),
    m("teimosia", 1, "Teimosia", "Some +5 a um teste de d20 em que você acabou de falhar."),
    m("insistir", 1, "Insistir", "Role novamente uma jogada de ataque que errou. Você deve usar o novo resultado."),
    m("apostar", 1, "Apostar", "Antes de rolar, declare que seu próximo teste de d20 neste turno será rolado com Ênfase.", { efeito: "enfase", armada: true }),
    m("oficio", 1, "Ofício", "Você realiza uma manobra do arquétipo Mestre de Batalha do Guerreiro, com um d8 de superioridade.", { efeito: "rolar", parametro: "1d8" }),
    m("golpe", 2, "Golpe Selvagem", "Quando uma jogada de ataque sua acertar, todos os dados de dano causam o resultado máximo.", { armada: true }),
    m("arrancadaDesesperada", 2, "Arrancada Desesperada", "Você realiza as ações Disparada e Desengajar imediatamente, como uma ação extra."),
    m("martir", 3, "Mártir", "Como reação, criaturas à sua escolha em número igual à sua proficiência ganham resistência a todos os danos até o fim da próxima rodada."),
    m("acao", 3, "Ação Desesperada", "Você realiza imediatamente a ação Atacar ou Magia, como uma ação extra."),
    m("folegoArcano", 3, "Fôlego Arcano", "Você recupera um espaço de magia gasto, de 1º a 5º círculo.", { efeito: "espaco", parametro: "5" })
  ];
}

export const LEGADOS = {
  habilidade: "+2 em um valor de habilidade, até o máximo de 20",
  proficiencia: "uma proficiência em perícia, ferramenta ou arma, aprendida nas próximas sessões",
  sintonia: "sintonização imediata com um item mágico, sem ocupar o limite e ignorando restrições"
};

export function registrarConfiguracoes(EditorClass, aoMudar) {
  game.settings.register(ID, "lista", { scope: "world", config: false, type: Array, default: medidasPadrao(), onChange: aoMudar });
  game.settings.registerMenu(ID, "editor", {
    name: "Medidas Desesperadas",
    label: "Editar Medidas",
    hint: "Nome, custo em falhas, texto e o que cada Medida faz ao ser usada.",
    icon: "fas fa-heart-crack",
    type: EditorClass,
    restricted: true
  });
  game.settings.register(ID, "exigirSangrando", {
    name: "Só enquanto Sangrando",
    hint: "As Medidas só se abrem com metade dos PV máximos ou menos (ou queimando a alma).",
    scope: "world", config: true, type: Boolean, default: true, onChange: aoMudar
  });
  game.settings.register(ID, "umaPorTurno", {
    name: "Uma Medida por turno",
    hint: "Em combate, o que fazer quando o personagem tenta uma segunda Medida no mesmo turno.",
    scope: "world", config: true, type: String, default: "aviso",
    choices: { aviso: "Perguntar antes", bloquear: "Bloquear", livre: "Sem limite" }
  });
  game.settings.register(ID, "coracaoFicha", {
    name: "Coração na ficha Tidy (Clássica)",
    hint: "Botão de Medidas Desesperadas em cima do retrato, com o estado do Fio.",
    scope: "client", config: true, type: Boolean, default: true, onChange: aoMudar
  });
  game.settings.register(ID, "migrado", { scope: "world", config: false, type: Boolean, default: false });
}

export function lista() {
  const l = game.settings.get(ID, "lista");
  return (Array.isArray(l) && l.length ? l : medidasPadrao()).filter((m) => m && m.ativa !== false);
}

export const getF = (actor, key, fallback = 0) => actor?.getFlag(ID, key) ?? fallback;
export const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

/** Retrato 3x4: só ganha zoom (classe "zoom") quando a imagem não é 3x4, para preencher sem cortar as que já são. */
export function ajustarRetratos(raiz) {
  for (const img of raiz.querySelectorAll(".retrato img")) {
    const f = () => { if (img.naturalWidth) img.classList.toggle("zoom", Math.abs(img.naturalWidth / img.naturalHeight - 0.75) > 0.03); };
    if (img.complete) f(); else img.addEventListener("load", f, { once: true });
  }
}
