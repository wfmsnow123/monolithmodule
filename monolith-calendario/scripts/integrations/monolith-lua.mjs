/**
 * Monolith fork: aviso de lua cheia no chat.
 * A cada dia que vira no relógio, para cada lua: faltando 3, 2 ou 1 dia para a cheia, e no próprio dia,
 * uma mensagem no chat (uma por dia e por lua). As duas cheias no mesmo dia viram uma convergência.
 * Lua cheia = o passo do meio do ciclo (12 de 24), o dia que o Fantasy-Calendar mostra cheia.
 * @module Integrations/MonolithLua
 */

import { CalendarManager } from '../calendar/_module.mjs';
import { MODULE } from '../constants.mjs';

const ANTECEDENCIA = 3;
let ultimoDia = null;

export function registerMonolithMoonSettings() {
  game.settings.register(MODULE.ID, 'monolithLuaAviso', {
    name: 'Aviso de lua cheia',
    hint: 'A cada dia, avisa no chat quando faltam 3, 2 ou 1 dia para a lua cheia, e no próprio dia.',
    scope: 'world', config: true, type: String, default: 'todos',
    choices: { todos: 'No chat, para todos', mestre: 'Só para o Mestre', nao: 'Desligado' }
  });
  game.settings.register(MODULE.ID, 'monolithLuaAvisados', { scope: 'world', config: false, type: Object, default: {} });
}

export function initializeMonolithMoon() {
  Hooks.on('updateWorldTime', () => conferir());
  conferir();
}

const segundosPorDia = (c) => (c.days?.hoursPerDay ?? 24) * (c.days?.minutesPerHour ?? 60) * (c.days?.secondsPerMinute ?? 60);

/** A lua está cheia no instante dado? */
export function cheia(calendar, indice, tempo) {
  const moon = calendar.moonsArray[indice];
  const fase = calendar.getMoonPhase(indice, tempo);
  if (!moon || !fase) return false;
  if (Number.isFinite(fase.step)) return fase.step === Math.floor(Math.max(1, moon.phaseGranularity || 24) / 2);
  return fase.position >= 0.5 && fase.position < 0.5 + 1 / Math.max(8, Object.keys(moon.phases ?? {}).length || 8);
}

/** Dias até a próxima cheia (0 = hoje), dentro da antecedência; null se for mais longe. */
export function diasAteCheia(calendar, indice, agora, spd) {
  const inicioDoDia = Math.floor(agora / spd) * spd + spd / 2;
  for (let d = 0; d <= ANTECEDENCIA; d++) if (cheia(calendar, indice, inicioDoDia + d * spd)) return d;
  return null;
}

async function conferir() {
  const modo = game.settings.get(MODULE.ID, 'monolithLuaAviso');
  if (modo === 'nao' || !game.users.activeGM?.isSelf) return;
  const calendar = CalendarManager.getActiveCalendar();
  const luas = calendar?.moonsArray ?? [];
  if (!luas.length) return;
  const spd = segundosPorDia(calendar);
  const agora = game.time.worldTime;
  const dia = Math.floor(agora / spd);
  if (dia === ultimoDia) return;
  ultimoDia = dia;

  const avisados = foundry.utils.deepClone(game.settings.get(MODULE.ID, 'monolithLuaAvisados') ?? {});
  const hoje = [], perto = [];
  luas.forEach((moon, i) => {
    const d = diasAteCheia(calendar, i, agora, spd);
    if (d === null || avisados[i] === dia) return;
    avisados[i] = dia;
    (d === 0 ? hoje : perto).push({ nome: game.i18n.localize(moon.name), d, cor: moon.color });
  });
  if (!hoje.length && !perto.length) return;
  await game.settings.set(MODULE.ID, 'monolithLuaAvisados', avisados);

  const lua = (l) => `<b style="color:${l.cor || 'inherit'}">${foundry.utils.escapeHTML(l.nome)}</b>`;
  const linhas = [];
  if (hoje.length > 1) linhas.push(`Hoje é noite de <b>convergência</b>: ${hoje.map(lua).join(' e ')} cheias ao mesmo tempo.`);
  else if (hoje.length) linhas.push(`Hoje é noite de lua cheia de ${lua(hoje[0])}.`);
  for (const l of perto) linhas.push(`Falta${l.d > 1 ? 'm' : ''} <b>${l.d} dia${l.d > 1 ? 's' : ''}</b> para a lua cheia de ${lua(l)}.`);
  await ChatMessage.create({
    speaker: { alias: 'O céu' },
    whisper: modo === 'mestre' ? game.users.filter((u) => u.isGM).map((u) => u.id) : [],
    content: `<div class="mono-card"><header><i class="fas fa-moon"></i> Lua cheia</header>${linhas.map((t) => `<p>${t}</p>`).join('')}</div>`
  });
}
