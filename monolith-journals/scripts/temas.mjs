export const ID = "monolith-journals";

/**
 * Temas oferecidos no seletor. Cada grupo vira um campo de escolha; o valor é uma classe CSS extra.
 * O tema "npc" não entra no seletor: ele exige a estrutura própria do card (.mn-main, .mn-side).
 */
export const TEMAS = [
  { id: "documento", nome: "Documento", descricao: "Ofícios, leis, cartilhas, proclamas.",
    grupos: [{ nome: "Variante", opcoes: { "": "Vinho", "mj-elendor": "Elendor (azul cívico)", "mj-luto": "Luto" } }] },
  { id: "carta", nome: "Carta", descricao: "Correspondência à mão em papel envelhecido.",
    grupos: [{ nome: "Selo", opcoes: { "": "Sem selo", "mj-selada": "Selo de cera" } }, { nome: "Borda", opcoes: { "": "Inteira", "mj-rasgada": "Rasgada" } }] },
  { id: "diario", nome: "Diário", descricao: "Caderno pessoal, folha pautada, letra à mão.",
    grupos: [{ nome: "Estado", opcoes: { "": "Limpo", "mj-manchado": "Manchado" } }] },
  { id: "gazeta", nome: "Gazeta", descricao: "Jornal impresso. O primeiro título vira o cabeçalho.",
    grupos: [{ nome: "Layout", opcoes: { "": "Uma coluna", "mj-colunas": "Duas colunas" } }, { nome: "Papel", opcoes: { "": "Branco", "mj-velha": "Amarelado" } }] },
  { id: "dossie", nome: "Dossiê", descricao: "Relatório datilografado, inquérito, ficha.",
    grupos: [{ nome: "Variante", opcoes: { "": "Comum", "mj-sigiloso": "Sigiloso (Vigília Eterna)" } }] },
  { id: "pergaminho", nome: "Pergaminho", descricao: "Édito, decreto, profecia.",
    grupos: [{ nome: "Rolos", opcoes: { "": "Madeira", "mj-real": "Dourados" } }] },
  { id: "tomo", nome: "Tomo", descricao: "Livro antigo ou proibido, com capitulares.",
    grupos: [{ nome: "Variante", opcoes: { "": "Velino escuro", "mj-proibido": "Proibido (o texto respira)", "mj-codice": "Códice claro" } }] },
  { id: "manual", nome: "Manual", descricao: "Regras e referências no visual do design system.",
    grupos: [{ nome: "Tema", opcoes: { "": "Abismo (escuro)", "mj-ossario": "Ossário (claro)" } }] },
  { id: "conto", nome: "Conto", descricao: "História com banner; a primeira imagem vira o banner.",
    grupos: [
      { nome: "Humor", opcoes: { "": "Sóbrio", verde: "Verde", sangue: "Sangue", gelo: "Gelo", aureo: "Áureo", umbral: "Umbral", abissal: "Abissal", cinza: "Cinza" } },
      { nome: "Efeito", opcoes: { "": "Nenhum", "fx-embers": "Brasas", "fx-mist": "Névoa", "fx-snow": "Neve", "fx-motes": "Partículas" } }
    ] }
];

const PREFIXOS_REMOVER = /^(mj|mj-.+|verde|sangue|gelo|aureo|umbral|abissal|cinza|fx-.+)$/;

/** Configuração efetiva de uma página: a da página, ou a do jornal. */
export function temaDe(page) {
  const propria = page?.getFlag?.(ID, "tema");
  if (propria?.tema === "nenhum") return null;
  if (propria?.tema) return propria;
  const doJornal = page?.parent?.getFlag?.(ID, "tema");
  return doJornal?.tema && doJornal.tema !== "nenhum" ? doJornal : null;
}

/** Classes CSS de uma configuração de tema. */
export function classesDe(cfg) {
  if (!cfg?.tema) return [];
  return ["mj", `mj-${cfg.tema}`, ...(cfg.classes ?? []).filter(Boolean)];
}

/** Aplica (ou tira) as classes do tema no conteúdo de uma página já desenhada. */
export function aplicarNaPagina(page, raiz, pagina = null) {
  if (!page || page.type !== "text" || !raiz) return;
  const conteudo = raiz.matches?.(".journal-page-content") ? raiz : raiz.querySelector(".journal-page-content");
  if (!conteudo) return;
  const cfg = temaDe(page);
  for (const c of [...conteudo.classList]) if (PREFIXOS_REMOVER.test(c)) conteudo.classList.remove(c);
  conteudo.classList.add(...classesDe(cfg));
  if (pagina) {
    pagina.classList.toggle("mj-pagina", !!cfg);
    pagina.classList.toggle("mj-sem-titulo", !!cfg?.semTitulo);
  }
}
