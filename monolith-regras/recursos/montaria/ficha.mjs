/**
 * Aba "Montaria" na configuração do token (e do token protótipo e do tile).
 * O que mais se usa fica em cima; o resto fica recolhido em "Mais opções" e "Mestre".
 */
import { RideableFlags, caminhoFlag, cMaxRiderF, cissetRideableF, cTokenFormF, cInsideMovementF, cRiderPositioningF, cSpawnRidersF, ccanbeGrappledF, cRidersScaleF, cCustomRidingheightF, cMountingEffectsF, cWorldMEffectOverrideF, cTileRideableNameF, cMountonEnterF, cGrapplePlacementF, cSelfApplyEffectsF, cAutoMountBlackListF, cAutoMountWhiteListF, cCanbePilotedF, cCheckPilotedCollisionF, cPilotedbyDefaultF, cforMountEffectsF, cRiderOffsetF, cRiderRotOffsetF, cUseRidingHeightF, cGrapplingEffectsF } from "./nucleo/RideableFlags.mjs";
import { cTokenForms, cTileForms } from "./nucleo/GeometricUtils.mjs";
import { cPlacementPatterns, cGrapplePlacements } from "./nucleo/RidingScript.mjs";
import { RideableCompUtils } from "./nucleo/RideableCompUtils.mjs";
import { RideableUtils } from "./nucleo/RideableUtils.mjs";
import { cfg, RECURSO } from "./nucleo/base.mjs";

const ABA = `monolith-${RECURSO}`;
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));

const POSICOES = {
  RowPlacement: "Em fila no meio", RowPlacementTop: "Em fila em cima", RowPlacementBottom: "Em fila embaixo",
  CirclePlacement: "Em círculo", BlockPlacement: "Em bloco", ClusterPlacement: "Agrupados",
  CornerPlacement: "Nos cantos (fora)", CornerPlacementinner: "Nos cantos (dentro)", MountPosition: "Onde estavam ao montar"
};
const FORMAS = {
  TokenFormCircle: "Círculo", TokenFormRectangle: "Retângulo", TokenTransparency: "Pela imagem (partes transparentes ficam de fora)",
  TokenFormAttachedTiles: "Tiles presos (Token Attacher)", TileFormNone: "Nenhuma"
};
const AGARRADO = {
  RowBelow: "Em fila, logo abaixo", RowAbove: "Em fila, logo acima", RowMiddle: "Em fila, por cima",
  ClosestInside: "No ponto mais próximo, dentro", Following: "Arrastado atrás"
};

function campo({ tipo, flag, nome, dica, valor, opcoes, range, largo }) {
  const name = caminhoFlag(flag);
  const d = dica ? `<p class="hint">${dica}</p>` : "";
  if (tipo === "checkbox") {
    return `<div class="form-group"><label>${nome}</label><div class="form-fields"><input type="checkbox" name="${name}" ${valor ? "checked" : ""}></div>${d}</div>`;
  }
  let entrada;
  if (tipo === "select") {
    entrada = `<select name="${name}">${Object.entries(opcoes).map(([v, r]) => `<option value="${esc(v)}" ${v == valor ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>`;
  }
  else if (tipo === "range") {
    entrada = `<range-picker name="${name}" value="${valor}" min="${range[0]}" max="${range[1]}" step="${range[2]}"></range-picker>`;
  }
  else if (tipo === "xy") {
    entrada = `<label>x</label><input type="number" step="0.01" name="${name}" value="${valor[0]}"><label>y</label><input type="number" step="0.01" name="${name}" value="${valor[1]}">`;
  }
  else if (tipo === "number") {
    entrada = `<input type="number" step="any" name="${name}" value="${valor ?? ""}" placeholder="padrão">`;
  }
  else entrada = `<input type="text" name="${name}" value="${esc(valor)}">`;
  return `<div class="form-group ${largo ? "stacked" : ""}"><label>${nome}</label><div class="form-fields">${entrada}</div>${d}</div>`;
}

const opcoesDe = (lista, rotulos) => Object.fromEntries(lista.map((k) => [k, rotulos[k] ?? k]));

function conteudo(doc, ehTile) {
  const principais = [];
  const mais = [];
  const mestre = [];

  principais.push(campo({ tipo: "checkbox", flag: cissetRideableF, nome: "Pode ser montado", valor: RideableFlags.TokenissetRideable(doc),
    dica: "Outros tokens podem montar neste (tecla M com o cursor sobre ele)." }));
  if (ehTile) principais.push(campo({ tipo: "text", flag: cTileRideableNameF, nome: "Nome", valor: RideableFlags.RideableName(doc) }));
  principais.push(campo({ tipo: "number", flag: cMaxRiderF, nome: "Cavaleiros (máximo)", valor: RideableFlags.MaxRidersRaw(doc),
    dica: "-1 é sem limite. Familiares não contam." }));
  principais.push(campo({ tipo: "select", flag: cRiderPositioningF, nome: "Como os cavaleiros ficam", valor: RideableFlags.RiderPositioning(doc) || "RowPlacement",
    opcoes: opcoesDe(cPlacementPatterns, POSICOES) }));
  principais.push(campo({ tipo: "checkbox", flag: cInsideMovementF, nome: "Cavaleiros andam livres em cima", valor: RideableFlags.RiderscanMoveWithin(doc),
    dica: "Para barcos e carroças: os cavaleiros podem andar dentro do token e mantêm o lugar quando ele se move." }));
  if (cfg("allowMountingonEntering")) {
    principais.push(campo({ tipo: "checkbox", flag: cMountonEnterF, nome: "Montar ao entrar", valor: RideableFlags.MountonEnter(doc, true),
      dica: "Quem entrar no espaço deste token monta automaticamente." }));
    mais.push(campo({ tipo: "text", flag: cAutoMountWhiteListF, nome: "Montar ao entrar: só estes", largo: true, valor: RideableFlags.AutomountWhiteList(doc, true),
      dica: "Nomes ou ids separados por ponto e vírgula. Vazio: todos." }));
    mais.push(campo({ tipo: "text", flag: cAutoMountBlackListF, nome: "Montar ao entrar: menos estes", largo: true, valor: RideableFlags.AutomountBlackList(doc, true) }));
  }

  mais.push(campo({ tipo: "select", flag: cTokenFormF, nome: "Forma", valor: RideableFlags.TokenForm(doc), opcoes: opcoesDe(ehTile ? cTileForms : cTokenForms, FORMAS),
    dica: "Usada para saber se alguém está dentro e onde fica a borda." }));
  mais.push(campo({ tipo: "range", flag: cRidersScaleF, nome: "Escala dos cavaleiros", valor: RideableFlags.RidersScale(doc), range: [0.2, 3, 0.05] }));
  mais.push(campo({ tipo: "xy", flag: cRiderOffsetF, nome: "Deslocar cavaleiros (em quadrados)", valor: RideableFlags.RidersOffset(doc) }));
  if (cfg("RiderRotation")) mais.push(campo({ tipo: "number", flag: cRiderRotOffsetF, nome: "Giro dos cavaleiros (graus)", valor: RideableFlags.RidersRotOffsetRaw(doc) }));
  mais.push(campo({ tipo: "checkbox", flag: cUseRidingHeightF, nome: "Cavaleiros ficam mais altos", valor: RideableFlags.UseRidingHeight(doc) }));
  mais.push(campo({ tipo: "number", flag: cCustomRidingheightF, nome: "Altura de montaria (pés)", valor: RideableFlags.customRidingHeight(doc),
    dica: "Vazio: a altura padrão da mesa." }));
  if (cfg("Grappling")) mais.push(campo({ tipo: "select", flag: cGrapplePlacementF, nome: "Onde fica quem este token agarra", valor: RideableFlags.GrapplePlacement(doc), opcoes: opcoesDe(cGrapplePlacements, AGARRADO) }));

  mestre.push(campo({ tipo: "text", flag: cSpawnRidersF, nome: "Criar já montados", largo: true, valor: RideableFlags.SpawnRidersstring(doc),
    dica: "Atores (nome ou id) que aparecem montados quando este token é posto na cena. Separe com ponto e vírgula." }));
  mestre.push(campo({ tipo: "checkbox", flag: cCanbePilotedF, nome: "Pode ser pilotado", valor: RideableFlags.canbePiloted(doc),
    dica: "Um cavaleiro que pilota conduz este token ao se mover." }));
  mestre.push(campo({ tipo: "checkbox", flag: cPilotedbyDefaultF, nome: "Pilotado sempre", valor: RideableFlags.PilotedbyDefault(doc) }));
  mestre.push(campo({ tipo: "checkbox", flag: cCheckPilotedCollisionF, nome: "Paredes param quem pilota", valor: RideableFlags.CheckPilotedCollision(doc) }));
  if (RideableUtils.isPf2e() || RideableCompUtils.hasactiveEffectModule()) {
    mestre.push(campo({ tipo: "text", flag: cMountingEffectsF, nome: "Efeitos de quem monta aqui", largo: true, valor: RideableFlags.MountingEffects(doc, true) }));
    mestre.push(campo({ tipo: "checkbox", flag: cWorldMEffectOverrideF, nome: "Só estes efeitos (ignora os da mesa)", valor: RideableFlags.OverrideWorldMEffects(doc) }));
    if (!ehTile) {
      mestre.push(campo({ tipo: "checkbox", flag: cSelfApplyEffectsF, nome: "Também recebe esses efeitos ao montar em outro", valor: RideableFlags.SelfApplyCustomEffects(doc) }));
      mestre.push(campo({ tipo: "text", flag: cforMountEffectsF, nome: "Efeitos que dá à montaria", largo: true, valor: RideableFlags.forMountEffects(doc, true) }));
      if (cfg("Grappling")) {
        mestre.push(campo({ tipo: "checkbox", flag: ccanbeGrappledF, nome: "Pode ser agarrado", valor: RideableFlags.canbeGrappled(doc) }));
        mestre.push(campo({ tipo: "text", flag: cGrapplingEffectsF, nome: "Efeitos em quem este token agarra", largo: true, valor: RideableFlags.GrapplingEffects(doc, true) }));
      }
    }
  }

  return `<div class="montaria-aba">
    ${principais.join("")}
    <details class="montaria-mais"><summary>Mais opções</summary>${mais.join("")}</details>
    <details class="montaria-mais"><summary>Mestre: criar montados, pilotar e efeitos</summary>${mestre.join("")}</details>
  </div>`;
}

function injetar(app, html, ehTile = false) {
  if (!game.user.isGM) return;
  if (ehTile && !cfg("allowTileRiding")) return;
  const doc = app.token ?? app.document;
  if (!doc || !html?.querySelector) return;

  const nav = html.querySelector('nav.sheet-tabs[data-group="sheet"]') ?? html.querySelector("nav.sheet-tabs");
  const abas = [...html.querySelectorAll('.tab[data-group="sheet"]')];
  if (!nav || !abas.length) return;
  const ativa = app.tabGroups?.sheet === ABA;

  if (!nav.querySelector(`[data-tab="${ABA}"]`)) {
    const botao = document.createElement("a");
    botao.dataset.action = "tab";
    botao.dataset.group = "sheet";
    botao.dataset.tab = ABA;
    botao.className = ativa ? "active" : "";
    botao.innerHTML = `<i class="fas fa-horse"></i> <span>Montaria</span>`;
    nav.append(botao);
  }
  if (!html.querySelector(`.tab[data-tab="${ABA}"]`)) {
    const aba = document.createElement("div");
    aba.className = `tab scrollable ${ativa ? "active" : ""}`;
    aba.dataset.group = "sheet";
    aba.dataset.tab = ABA;
    aba.innerHTML = conteudo(doc, ehTile);
    abas.at(-1).after(aba);
  }
  nav.style.overflowX = "auto";
}

export function ligarFicha() {
  Hooks.on("renderTokenConfig", (app, html) => injetar(app, html));
  Hooks.on("renderPrototypeTokenConfig", (app, html) => injetar(app, html));
  Hooks.on("renderTileConfig", (app, html) => injetar(app, html, true));
}
