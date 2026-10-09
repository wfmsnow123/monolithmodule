import { ID, TEMAS, temaDe, classesDe, aplicarNaPagina } from "./temas.mjs";
import { SeletorTema } from "./seletor.mjs";

Hooks.once("init", () => {
  game.modules.get(ID).api = {
    TEMAS, temaDe, classesDe,
    abrirSeletor: (journal, pageId = null) => new SeletorTema(journal, pageId).render({ force: true })
  };
});

// Botão "Tema" no cabeçalho do jornal (quem pode editar).
Hooks.on("getHeaderControlsJournalEntrySheet", (app, controls) => {
  if (!app.document?.isOwner) return;
  controls.push({
    icon: "fas fa-scroll", label: "Tema do jornal", action: "monolithJournalsTema",
    onClick: () => new SeletorTema(app.document, app.pageId ?? null).render({ force: true })
  });
});

// No diretório de jornais, botão direito > Tema.
Hooks.on("getJournalEntryContextOptions", (app, options) => {
  options.push({
    name: "Tema do jornal",
    icon: '<i class="fas fa-scroll"></i>',
    condition: (li) => game.journal.get(li.dataset.entryId)?.isOwner,
    callback: (li) => { const j = game.journal.get(li.dataset.entryId); if (j) new SeletorTema(j).render({ force: true }); }
  });
});

// Cada página de texto desenhada (dentro do jornal ou destacada) recebe as classes do tema.
Hooks.on("renderJournalEntryPageSheet", (app, element) => {
  if (app.isView === false) return;
  aplicarNaPagina(app.document, element);
});

// O jornal inteiro: classes na página (esconder título, fundo) e reaplica no conteúdo.
Hooks.on("renderJournalEntrySheet", (app, element) => {
  for (const pagina of element.querySelectorAll(".journal-entry-page[data-page-id]")) {
    aplicarNaPagina(app.document.pages.get(pagina.dataset.pageId), pagina, pagina);
  }
});

// Mudou o tema: redesenha os jornais abertos.
for (const h of ["updateJournalEntry", "updateJournalEntryPage"]) {
  Hooks.on(h, (doc, changes) => {
    if (!foundry.utils.hasProperty(changes, `flags.${ID}`) && !foundry.utils.hasProperty(changes, `flags.-=${ID}`)) return;
    const journal = doc.parent instanceof JournalEntry ? doc.parent : doc;
    if (journal.sheet?.rendered) journal.sheet.render();
  });
}
