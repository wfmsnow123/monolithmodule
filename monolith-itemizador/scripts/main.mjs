import { ID, ehDocumento, itemizar, sincronizar, capturar, itensDoJornal } from "./itemizar.mjs";
import { Leitor } from "./leitor.mjs";

Hooks.once("init", () => {
  game.settings.register(ID, "imagem", {
    name: "Ícone padrão dos documentos",
    hint: "Imagem que o item recebe quando você não escolhe outra.",
    scope: "world", config: true, type: String, default: "icons/sundries/documents/document-sealed-brown-red.webp",
    filePicker: "image"
  });
  game.settings.register(ID, "peso", {
    name: "Peso padrão",
    hint: "Peso de um documento novo, na unidade do mundo.",
    scope: "world", config: true, type: Number, default: 0
  });
  game.settings.register(ID, "jogadoresArrastam", {
    name: "Jogadores podem itemizar",
    hint: "Permite que jogadores arrastem um jornal que podem ver para a própria ficha e levem uma cópia como item.",
    scope: "world", config: true, type: Boolean, default: false
  });

  // Subtipo de saque "Documento" no dnd5e.
  if (CONFIG.DND5E?.lootTypes) CONFIG.DND5E.lootTypes.documento = { label: "Documento" };

  // Ler: usar o item abre o documento em vez do cartão no chat.
  Hooks.on("dnd5e.preUseActivity", (activity) => {
    const item = activity?.item;
    if (!ehDocumento(item)) return;
    Leitor.abrir(item);
    return false;
  });
  Hooks.on("dnd5e.preDisplayCard", (item) => {
    if (!ehDocumento(item)) return;
    Leitor.abrir(item);
    return false;
  });
});

Hooks.once("ready", () => {
  game.modules.get(ID).api = { itemizar, sincronizar, capturar, itensDoJornal, ler: (item) => Leitor.abrir(item), ehDocumento };

  game.socket.on(`module.${ID}`, async (msg) => {
    if (msg?.acao !== "mostrar") return;
    const item = await fromUuid(msg.uuid);
    if (item) Leitor.abrir(item, { mostradoPor: msg.por });
  });
});

/* ---------- Criar ---------- */

// Botão no cabeçalho do jornal.
Hooks.on("getHeaderControlsJournalEntrySheet", (app, controls) => {
  if (!game.user.isGM) return;
  controls.push({ icon: "fas fa-box-archive", label: "Transformar em item", action: "monolithItemizar",
    onClick: () => itemizar(app.document) });
});

// Diretório de jornais: botão direito.
Hooks.on("getJournalEntryContextOptions", (app, options) => {
  options.push({
    name: "Transformar em item",
    icon: '<i class="fas fa-box-archive"></i>',
    condition: () => game.user.isGM,
    callback: (li) => itemizar(game.journal.get(li.dataset.entryId))
  });
});

// Arrastar um jornal (ou uma página dele) para a ficha do personagem.
Hooks.on("dropActorSheetData", (actor, sheet, data) => {
  if (!["JournalEntry", "JournalEntryPage"].includes(data?.type)) return;
  if (!game.user.isGM && !(game.settings.get(ID, "jogadoresArrastam") && actor.isOwner)) return;
  (async () => {
    const doc = await fromUuid(data.uuid);
    if (!doc) return;
    const journal = doc instanceof JournalEntry ? doc : doc.parent;
    if (!journal.testUserPermission(game.user, "OBSERVER")) return ui.notifications.warn("Você não pode ver esse jornal.");
    await itemizar(journal, { actor, paginas: doc instanceof JournalEntry ? null : [doc.id] });
  })();
  return false;
});

/* ---------- Ler ---------- */

// Ficha do item: botão "Ler" no cabeçalho.
Hooks.on("getHeaderControlsDocumentSheetV2", (app, controls) => {
  const item = app.document;
  if (!(item instanceof Item) || !ehDocumento(item)) return;
  controls.push({ icon: "fas fa-book-open", label: "Ler", action: "monolithLer", onClick: () => Leitor.abrir(item) });
});

Hooks.on("updateItem", (item, changes) => {
  if (foundry.utils.hasProperty(changes, `flags.${ID}`) || "name" in changes) Leitor.atualizar(item);
});

/* ---------- Sincronizar ---------- */

const pendentes = new Map();
function agendar(journal) {
  if (!journal || !game.users.activeGM?.isSelf) return;
  clearTimeout(pendentes.get(journal.id));
  pendentes.set(journal.id, setTimeout(() => {
    pendentes.delete(journal.id);
    sincronizar(journal).catch((err) => console.error(`${ID} |`, err));
  }, 800));
}
for (const h of ["createJournalEntryPage", "updateJournalEntryPage", "deleteJournalEntryPage"]) {
  Hooks.on(h, (page) => agendar(page.parent));
}
// O tema do jornal (Monolith: Journals) também entra na cópia.
Hooks.on("updateJournalEntry", (journal, changes) => {
  if (foundry.utils.hasProperty(changes, "flags.monolith-journals") || foundry.utils.hasProperty(changes, "flags.-=monolith-journals")) agendar(journal);
});

