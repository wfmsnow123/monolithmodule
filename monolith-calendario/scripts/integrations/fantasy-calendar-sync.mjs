/**
 * Monolith fork: live date sync with app.fantasy-calendar.com.
 *
 * Fantasy-Calendar has an undocumented public API (https://app.fantasy-calendar.com/api/v1):
 *  - GET  /calendar/{hash}/dynamic_data   current date (public calendars, no login)
 *  - GET  /calendar/{hash}/last_changed   timestamps, used for cheap polling
 *  - Personal access token (Premium) from /profile/api-tokens, sent as a Bearer token
 *  - POST /calendar/{hash}/changeDate {unit: 'days'|'minutes', count} (needs the token)
 *
 * Only the active GM talks to the site. The structure of the calendar (months, moons, seasons,
 * events) still comes from the exported JSON through the Fantasy-Calendar importer.
 * @module Integrations/FantasyCalendarSync
 */

import { CalendarManager } from '../calendar/_module.mjs';
import { MODULE } from '../constants.mjs';
import { createImporter } from '../importers/_module.mjs';
import { NoteManager } from '../notes/_module.mjs';
import { log } from '../utils/_module.mjs';

const API = 'https://app.fantasy-calendar.com/api/v1';
/** Calendário de Monolith no Fantasy-Calendar (embutido: módulo de uso pessoal). */
const MONOLITH_HASH = 'eebf9d7a7158b0bc734c8d5420e8e66d';
const S = {
  HASH: 'fcHash',
  PULL: 'fcPull',
  PUSH: 'fcPush',
  CLOCK: 'fcUseClock',
  POLL: 'fcPollSeconds',
  TOKEN: 'fcToken',
  TOKEN_WORLD: 'fcTokenMundo',
  EVENTS: 'fcEvents',
  LAST: 'fcLastKnown'
};

let pollTimer = null;
let applyingRemote = false;
let pushTimer = null;
let lastChange = null;
let applyingEvents = false;
let eventsSignature = null;
let pollCount = 0;
let fcCalendarId = null;
const pushEventTimers = new Map();
const NOTE_TYPE = `${MODULE.ID}.calendarnote`;

const get = (k) => game.settings.get(MODULE.ID, k);
const set = (k, v) => game.settings.set(MODULE.ID, k, v);
const isLeader = () => game.users.activeGM?.isSelf ?? false;
/** Token do site: o salvo no mundo (fica para o Mestre em qualquer navegador) ou, antes dele, o deste navegador. */
const getToken = () => String(get(S.TOKEN_WORLD) || get(S.TOKEN) || '').trim();

/** Hash salvo, aceitando também o link inteiro do calendário colado no campo. */
export function normalizeHash(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return text.match(/[0-9a-f]{32}/i)?.[0].toLowerCase() ?? text;
}
const getHash = () => normalizeHash(get(S.HASH));

/** Token de acesso pessoal do site (Sanctum: "115|abc..."), nunca um hash de calendário. */
export const looksLikeToken = (value) => /^\d+\|\S+$/.test(String(value ?? '').trim());

/**
 * O token já foi parar no campo do calendário (configuração de mundo, que todos os jogadores leem).
 * O Mestre move o valor para o token deste navegador e devolve o calendário de Monolith.
 */
async function repairTokenInHash() {
  const saved = get(S.HASH);
  if (!game.user.isGM || !looksLikeToken(saved)) return;
  if (!getToken()) await set(S.TOKEN_WORLD, String(saved).trim());
  await set(S.HASH, MONOLITH_HASH);
  ui.notifications.warn('Fantasy-Calendar: o token estava salvo no lugar do calendário, visível para os jogadores. Corrigido; gere um token novo no site e apague o antigo.', { permanent: true });
}

/** dynamic_data de uma resposta do site; erro claro quando ela não traz a data. */
function readDynamicData(res) {
  const dd = res?.dynamic_data;
  if (!dd || dd.year === undefined || dd.day === undefined) throw new Error(res?.message ? `o site respondeu "${res.message}"` : 'a resposta do site não trouxe a data');
  return dd;
}

/** Register settings (call during init). */
export function registerFantasyCalendarSettings() {
  game.settings.register(MODULE.ID, S.HASH, {
    name: 'Fantasy-Calendar: hash do calendário',
    hint: 'O código no fim do link do calendário (app.fantasy-calendar.com/calendars/<hash>). Deixe vazio para desligar a sincronização.',
    scope: 'world', config: false, type: String, default: MONOLITH_HASH, onChange: () => restart()
  });
  game.settings.register(MODULE.ID, S.PULL, {
    name: 'Fantasy-Calendar: puxar a data do site',
    hint: 'Quando a data muda no site, o Foundry acompanha.',
    scope: 'world', config: false, type: Boolean, default: true, onChange: () => restart()
  });
  game.settings.register(MODULE.ID, S.PUSH, {
    name: 'Fantasy-Calendar: enviar avanços do Foundry para o site',
    hint: 'Precisa de um token de acesso pessoal do site (contas Premium), salvo no menu "Token do Fantasy-Calendar".',
    scope: 'world', config: false, type: Boolean, default: true
  });
  game.settings.register(MODULE.ID, S.CLOCK, {
    name: 'Fantasy-Calendar: sincronizar também a hora',
    hint: 'Desligado: só o dia é sincronizado e a hora do Foundry é preservada (use se o relógio do calendário no site está desativado).',
    scope: 'world', config: false, type: Boolean, default: false
  });
  game.settings.register(MODULE.ID, S.POLL, {
    name: 'Fantasy-Calendar: intervalo de verificação (segundos)',
    scope: 'world', config: false, type: Number, default: 60, range: { min: 15, max: 3600, step: 15 }, onChange: () => restart()
  });
  game.settings.register(MODULE.ID, S.TOKEN, { scope: 'client', config: false, type: String, default: '' });
  game.settings.register(MODULE.ID, S.TOKEN_WORLD, { scope: 'world', config: false, type: String, default: '' });
  game.settings.register(MODULE.ID, S.EVENTS, {
    name: 'Fantasy-Calendar: sincronizar os eventos',
    hint: 'Eventos do site viram notas (com descrição); notas criadas ou editadas no Foundry vão para o site (com token).',
    scope: 'world', config: false, type: Boolean, default: true
  });
  game.settings.register(MODULE.ID, S.LAST, { scope: 'world', config: false, type: Object, default: {} });
  game.settings.registerMenu(MODULE.ID, 'fcConnection', {
    name: 'Fantasy-Calendar',
    label: 'Conexão com o Fantasy-Calendar',
    hint: 'Hash do calendário, sincronização da data e token de acesso pessoal, tudo numa janela.',
    icon: 'fas fa-link',
    type: FantasyCalendarApp,
    restricted: true
  });
}

/** Start polling and hooks (call during ready). */
export async function initializeFantasyCalendarSync() {
  Hooks.on('updateWorldTime', onWorldTimeChanged);
  Hooks.on('createJournalEntryPage', (page) => onNoteChanged(page, true));
  Hooks.on('updateJournalEntryPage', (page, changes) => onNoteChanged(page, false, changes));
  await repairTokenInHash();
  // O token deste navegador passa a ficar salvo no mundo, para não ter de colar de novo.
  if (game.user.isGM && get(S.TOKEN) && !get(S.TOKEN_WORLD)) await set(S.TOKEN_WORLD, String(get(S.TOKEN)).trim());
  restart();
  globalThis.CALENDARIA ??= {};
  globalThis.CALENDARIA.fantasyCalendar = { pull: () => pull(true), push: () => pushNow(), events: () => pullEvents(true), status, open: () => new FantasyCalendarApp().render(true) };
}

function restart() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  if (!game.ready || !isLeader() || !getHash()) return;
  if (get(S.PULL)) {
    pull(true);
    if (get(S.EVENTS)) pullEvents(false).then(() => enviarPendentes({ limite: 10 }));
    pollTimer = setInterval(() => poll(), Math.max(15, get(S.POLL)) * 1000);
  }
}

async function request(path, { method = 'GET', body = null, auth = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getToken();
    if (!token) throw new Error('Sem token do Fantasy-Calendar. Use a janela "Conexão com o Fantasy-Calendar".');
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : null });
  if (!res.ok) throw new Error(`Fantasy-Calendar respondeu ${res.status} em ${path}`);
  const data = await res.json();
  // Hash inexistente ou rota errada voltam com HTTP 200 e só uma mensagem.
  if (data && typeof data.message === 'string' && Object.keys(data).length === 1) {
    throw new Error(/No query results/.test(data.message) ? `calendário "${path.split('/')[2]}" não encontrado no site` : data.message);
  }
  return data;
}

/** Absolute day number on the Fantasy-Calendar side (equals internal day count when year zero exists). */
function fcToComponents(dd) {
  const calendar = CalendarManager.getActiveCalendar();
  const yearZero = calendar?.years?.yearZero ?? 0;
  return { year: (dd.year ?? 0) - yearZero, month: dd.timespan ?? 0, dayOfMonth: Math.max(0, (dd.day ?? 1) - 1), hour: dd.hour ?? 0, minute: dd.minute ?? 0, second: 0 };
}

function dayNumber(calendar, worldTime) {
  const spd = (calendar.days?.hoursPerDay ?? 24) * (calendar.days?.minutesPerHour ?? 60) * (calendar.days?.secondsPerMinute ?? 60);
  return Math.floor(worldTime / spd);
}

async function poll() {
  try {
    const hash = getHash();
    const lc = await request(`/calendar/${hash}/last_changed`);
    const stamp = lc?.last_dynamic_change ?? null;
    if (stamp && stamp !== lastChange) await pull(false, stamp);
    if (get(S.EVENTS) && ++pollCount % 10 === 0) await pullEvents(false);
  } catch (err) {
    log(2, 'Fantasy-Calendar: falha ao verificar mudanças', err);
  }
}

async function pull(force = false, stamp = null) {
  if (!isLeader()) return;
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return;
  try {
    const hash = getHash();
    const res = await request(`/calendar/${hash}/dynamic_data`);
    const dd = readDynamicData(res);
    if (stamp) lastChange = stamp;
    else {
      const lc = await request(`/calendar/${hash}/last_changed`).catch(() => null);
      lastChange = lc?.last_dynamic_change ?? lastChange;
    }
    const target = fcToComponents(dd);
    const spd = (calendar.days?.hoursPerDay ?? 24) * (calendar.days?.minutesPerHour ?? 60) * (calendar.days?.secondsPerMinute ?? 60);
    const now = game.time.worldTime;
    let targetTime;
    if (get(S.CLOCK)) targetTime = calendar.componentsToTime(target);
    else {
      const dayStart = calendar.componentsToTime({ ...target, hour: 0, minute: 0, second: 0 });
      const timeOfDay = ((now % spd) + spd) % spd;
      targetTime = dayStart + timeOfDay;
    }
    await set(S.LAST, { day: dayNumber(calendar, targetTime), minuteOfDay: Math.floor((targetTime % spd) / 60) });
    if (!force && Math.abs(targetTime - now) < 60) return;
    if (Math.abs(targetTime - now) < 60) return;
    applyingRemote = true;
    try {
      await game.time.set(targetTime);
      ui.notifications.info(`Fantasy-Calendar: data sincronizada (${dd.day}/${(dd.timespan ?? 0) + 1}/${dd.year}).`);
    } finally {
      setTimeout(() => (applyingRemote = false), 500);
    }
  } catch (err) {
    log(1, 'Fantasy-Calendar: falha ao puxar a data', err);
    if (force) ui.notifications.warn(`Fantasy-Calendar: ${err.message}`);
  }
}

function onWorldTimeChanged() {
  if (applyingRemote || !isLeader() || !get(S.PUSH) || !getHash() || !getToken()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushNow(), 2000);
}

async function pushNow() {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar || !isLeader() || !getToken()) return;
  const spd = (calendar.days?.hoursPerDay ?? 24) * (calendar.days?.minutesPerHour ?? 60) * (calendar.days?.secondsPerMinute ?? 60);
  const now = game.time.worldTime;
  const last = get(S.LAST) ?? {};
  if (!Number.isFinite(last.day)) return pull(true);
  const hash = getHash();
  try {
    const deltaDays = dayNumber(calendar, now) - last.day;
    if (deltaDays) await request(`/calendar/${hash}/changeDate`, { method: 'POST', auth: true, body: { unit: 'days', count: deltaDays } });
    let minuteOfDay = last.minuteOfDay ?? 0;
    if (get(S.CLOCK)) {
      const nowMinute = Math.floor((((now % spd) + spd) % spd) / 60);
      const deltaMinutes = nowMinute - minuteOfDay;
      if (deltaMinutes) await request(`/calendar/${hash}/changeDate`, { method: 'POST', auth: true, body: { unit: 'minutes', count: deltaMinutes } });
      minuteOfDay = nowMinute;
    }
    await set(S.LAST, { day: dayNumber(calendar, now), minuteOfDay });
    const lc = await request(`/calendar/${hash}/last_changed`).catch(() => null);
    lastChange = lc?.last_dynamic_change ?? lastChange;
  } catch (err) {
    log(1, 'Fantasy-Calendar: falha ao enviar a data', err);
    ui.notifications.warn(`Fantasy-Calendar: ${err.message}`);
  }
}

/* ---------- Eventos (notas) ---------- */

/** Calendário inteiro do site, no formato do export (events + categories). */
async function fetchCalendar() {
  const res = await request(`/calendar/${getHash()}`);
  if (!Array.isArray(res?.events)) throw new Error('a resposta do site não trouxe os eventos');
  fcCalendarId = res.id ?? fcCalendarId;
  return { name: res.name, static_data: res.static_data, dynamic_data: res.dynamic_data, events: res.events, categories: res.event_categories ?? [] };
}

/** Puxa os eventos do site para as notas do calendário ativo (descrição, datas e recorrência). */
async function pullEvents(notify = false) {
  if (!isLeader() || !getHash()) return;
  const calendarId = CalendarManager.getActiveCalendar()?.metadata?.id;
  if (!calendarId) return;
  try {
    const data = await fetchCalendar();
    const signature = `${calendarId}:${data.events.map((e) => `${e.id}@${e.updated_at}`).join(',')}`;
    if (!notify && signature === eventsSignature) return;
    const importer = createImporter('fantasy-calendar');
    await importer.transform(data);
    const notes = await importer.extractNotes(data);
    applyingEvents = true;
    let result;
    try {
      result = await importer.syncNotes(notes, { calendarId });
    } finally {
      setTimeout(() => (applyingEvents = false), 1000);
    }
    eventsSignature = signature;
    if (notify || result.created || result.removed) {
      ui.notifications.info(`Fantasy-Calendar: eventos sincronizados (${result.created} novos, ${result.updated} atualizados, ${result.removed} removidos).`);
    }
    if (result.errors.length) log(2, 'Fantasy-Calendar: erros ao sincronizar eventos', result.errors);
  } catch (err) {
    log(1, 'Fantasy-Calendar: falha ao puxar os eventos', err);
    if (notify) ui.notifications.warn(`Fantasy-Calendar: ${err.message}`);
  }
}

/** Nota do Foundry criada ou editada: vai para o site (só o Mestre ativo, com token). */
let avisouSemToken = false;

function onNoteChanged(page, created, changes = {}) {
  if (applyingEvents || page.type !== NOTE_TYPE || !isLeader() || !get(S.EVENTS) || !getHash()) return;
  if (!getToken()) {
    // Sem token a nota fica só no Foundry: avisa o Mestre uma vez, em vez de não fazer nada calado.
    if (!avisouSemToken) ui.notifications.warn('Fantasy-Calendar: a nota não foi para o site porque não há token salvo. Cole o token na janela do Fantasy-Calendar; as notas pendentes vão quando o mundo abrir de novo ou pelo botão "Enviar pendentes".');
    avisouSemToken = true;
    return;
  }
  if (page.system?.linkedFestival) return;
  const calendarId = CalendarManager.getActiveCalendar()?.metadata?.id;
  if (!calendarId || page.getFlag(MODULE.ID, 'calendarId') !== calendarId) return;
  if (!created) {
    const relevant = 'name' in changes || foundry.utils.hasProperty(changes, 'text.content') || foundry.utils.hasProperty(changes, 'system.startDate');
    if (!relevant) return;
  }
  clearTimeout(pushEventTimers.get(page.id));
  pushEventTimers.set(page.id, setTimeout(() => {
    pushEventTimers.delete(page.id);
    pushEvent(page).catch((err) => {
      log(1, 'Fantasy-Calendar: falha ao enviar o evento', err);
      ui.notifications.warn(`Fantasy-Calendar: o evento "${page.name}" não foi enviado (${err.message}).`);
    });
  }, 1500));
}

/** Data de uma nota no formato do site: [ano, mês (índice), dia (1 em diante)]. */
function fcDate(page) {
  const d = page.system?.startDate ?? {};
  return [Number(d.year) || 0, Number(d.month) || 0, (Number(d.dayOfMonth) || 0) + 1];
}

function oneTimeData(date) {
  return {
    has_duration: false, duration: 1, show_first_last: false, limited_repeat: false, limited_repeat_num: 1,
    conditions: [['Date', '0', date]], connected_events: [], date, search_distance: 0, overrides: { moons: [] }
  };
}

/** Nota sem recorrência nem condições: dá para mandar a data ao site sem perder nada. */
function isOneTime(page) {
  const sys = page.system ?? {};
  return (sys.repeat ?? 'never') === 'never' && !sys.conditions?.length && !(sys.conditionTree?.children?.length ?? 0);
}

async function pushEvent(page) {
  page = NoteManager.getFullNote(page.id) ?? page;
  if (!page?.parent) return;
  const fcId = page.getFlag(MODULE.ID, 'fcEventId');
  const description = page.text?.content ?? '';
  if (fcId) {
    if (String(fcId).includes('#')) return; // evento do site dividido em várias notas: edite no site
    const body = { name: page.name, description };
    if (isOneTime(page)) body.data = oneTimeData(fcDate(page));
    const res = await request(`/event/${fcId}`, { method: 'PUT', auth: true, body });
    if (res?.error) throw new Error(res.message ?? 'o site recusou a edição');
    return;
  }
  if (!fcCalendarId) await fetchCalendar();
  if (!fcCalendarId) throw new Error('não descobri o calendário no site');
  const body = {
    calendar_id: fcCalendarId, name: page.name, description, event_category_id: null,
    data: oneTimeData(fcDate(page)), settings: { color: 'Dark-Solid', text: 'text', hide: escondida(page), print: false }
  };
  const res = await request('/event', { method: 'POST', auth: true, body });
  const id = res?.data?.id ?? res?.id;
  if (!id) throw new Error(res?.message ?? 'o site não devolveu o evento criado');
  applyingEvents = true;
  try {
    await page.setFlag(MODULE.ID, 'fcEventId', String(id));
  } finally {
    setTimeout(() => (applyingEvents = false), 500);
  }
  ui.notifications.info(`Fantasy-Calendar: evento "${page.name}" criado no site.`);
}

/** Nota oculta ou secreta no Calendário vai escondida no site (hide do Fantasy-Calendar). */
function escondida(page) {
  const v = page.system?.visibility;
  return !!v && v !== 'visible';
}

/**
 * Notas criadas no Foundry que ainda não estão no site (sem fcEventId): manda cada uma.
 * Pega o que escapou do envio automático (nota criada antes da sincronização, ou com outro Mestre liderando).
 * Com limite, só envia sozinho se forem poucas; acima disso avisa e espera o botão.
 */
async function enviarPendentes({ limite = Infinity, avisar = false } = {}) {
  // Sozinho só o Mestre que lidera; pelo botão (avisar), qualquer Mestre.
  if (!(avisar ? game.user.isGM : isLeader()) || !get(S.EVENTS) || !getHash() || !getToken()) return 0;
  const calendarId = CalendarManager.getActiveCalendar()?.metadata?.id;
  if (!calendarId) return 0;
  const pendentes = NoteManager.getAllNotes()
    .filter((n) => n.calendarId === calendarId)
    .map((n) => NoteManager.getFullNote(n.id))
    .filter((p) => p && p.type === NOTE_TYPE && !p.getFlag(MODULE.ID, 'fcEventId') && !p.system?.linkedFestival);
  if (!pendentes.length) {
    if (avisar) ui.notifications.info('Fantasy-Calendar: nenhuma nota pendente.');
    return 0;
  }
  if (pendentes.length > limite) {
    ui.notifications.info(`Fantasy-Calendar: ${pendentes.length} notas do Foundry ainda não estão no site. Use "Enviar pendentes" na janela do Fantasy-Calendar.`);
    return 0;
  }
  let n = 0;
  for (const page of pendentes) {
    try {
      await pushEvent(page);
      n++;
    } catch (err) {
      log(1, 'Fantasy-Calendar: falha ao enviar nota pendente', err);
      ui.notifications.warn(`Fantasy-Calendar: o evento "${page.name}" não foi enviado (${err.message}).`);
    }
  }
  return n;
}

function status() {
  return { hash: getHash(), events: get(S.EVENTS), pull: get(S.PULL), push: get(S.PUSH), clock: get(S.CLOCK), hasToken: !!getToken(), lastKnown: get(S.LAST), lastChange, polling: !!pollTimer };
}

/**
 * Monolith fork: one window with everything needed to connect to Fantasy-Calendar.
 * Opened from the Calendaria settings panel (Home tab), from Configure Settings and from the console API.
 * Writing to Fantasy-Calendar requires a Sanctum personal access token, created at
 * app.fantasy-calendar.com/profile/api-tokens (Premium accounts). The legacy api_token returned by
 * /user/login is rejected by the protected routes, so no password is ever asked for.
 */
export class FantasyCalendarApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: 'monolith-fantasy-calendar',
    classes: ['mono', 'monolith-fc'],
    tag: 'form',
    window: { title: 'Fantasy-Calendar', icon: 'fas fa-link', resizable: true },
    position: { width: 520, height: 'auto' },
    form: { handler: FantasyCalendarApp.#onSubmit, closeOnSubmit: false, submitOnChange: false },
    actions: { test: FantasyCalendarApp.#onTest, pullNow: FantasyCalendarApp.#onPull, pullEvents: FantasyCalendarApp.#onPullEvents, pushPending: FantasyCalendarApp.#onPushPending, clearToken: FantasyCalendarApp.#onClearToken }
  };

  #siteDate = null;

  async _prepareContext() {
    const hash = getHash();
    if (hash && this.#siteDate === null) {
      try {
        const res = await request(`/calendar/${hash}/dynamic_data`);
        const dd = readDynamicData(res);
        this.#siteDate = `${dd.day}/${(dd.timespan ?? 0) + 1}/${dd.year}`;
      } catch (err) {
        this.#siteDate = `erro: ${err.message}`;
      }
    }
    return { hash, events: get(S.EVENTS), pull: get(S.PULL), push: get(S.PUSH), clock: get(S.CLOCK), poll: get(S.POLL), hasToken: !!getToken(), siteDate: this.#siteDate };
  }

  async _renderHTML(ctx) {
    const esc = (v) => foundry.utils.escapeHTML(String(v ?? ''));
    const chk = (v) => (v ? 'checked' : '');
    return `<div class="mono-root" style="background:transparent">
      <div class="mono-notice mono-notice--info" style="margin-bottom:var(--space-3)">
        <p class="mono-notice__title">Monolith no Fantasy-Calendar</p>
        <p class="mono-notice__body">Data no site agora: <b>${esc(ctx.siteDate ?? '...')}</b>. O Foundry acompanha o site${ctx.hasToken ? ' e envia os avanços de tempo de volta' : '; para enviar os avanços de volta, cole o token abaixo'}.</p>
      </div>
      <h3 class="mono-heading">Sincronização</h3>
      <label class="mono-field"><span class="mono-field__label">Calendário no site</span><input class="mono-input" type="text" name="hash" autocomplete="off" spellcheck="false" data-1p-ignore data-lpignore="true" value="${esc(ctx.hash)}" placeholder="${MONOLITH_HASH}"><p class="mono-field__hint">Hash ou link do calendário (app.fantasy-calendar.com/calendars/...). Vazio desliga a sincronização.</p></label>
      <label class="mono-field"><span class="mono-field__label">Puxar a data do site</span><input class="mono-toggle" type="checkbox" role="switch" name="pull" ${chk(ctx.pull)}><p class="mono-field__hint">Verifica o site a cada ${esc(ctx.poll)} segundos.</p></label>
      <label class="mono-field"><span class="mono-field__label">Enviar avanços para o site</span><input class="mono-toggle" type="checkbox" role="switch" name="push" ${chk(ctx.push)}><p class="mono-field__hint">Só funciona com o token salvo.</p></label>
      <label class="mono-field"><span class="mono-field__label">Sincronizar os eventos</span><input class="mono-toggle" type="checkbox" role="switch" name="events" ${chk(ctx.events)}><p class="mono-field__hint">Eventos do site viram notas com descrição; notas criadas ou editadas aqui vão para o site (com o token). Apagar uma nota não apaga no site.</p></label>
      <label class="mono-field"><span class="mono-field__label">Sincronizar também a hora</span><input class="mono-check" type="checkbox" name="clock" ${chk(ctx.clock)}><p class="mono-field__hint">Desligado: só o dia muda, a hora do Foundry fica.</p></label>
      <label class="mono-field"><span class="mono-field__label">Token de acesso pessoal</span><input class="mono-input" type="text" name="token" autocomplete="off" spellcheck="false" data-1p-ignore data-lpignore="true" style="-webkit-text-security:disc" placeholder="${ctx.hasToken ? 'token salvo' : 'cole o token aqui'}"><p class="mono-field__hint">Fica salvo no mundo, para o Mestre em qualquer navegador. Vazio mantém o atual.</p></label>
      <input type="hidden" name="poll" value="${esc(ctx.poll)}">
      <footer class="mono-window__footer" style="margin:var(--space-4) calc(-1 * var(--space-4)) calc(-1 * var(--space-4))">
        ${ctx.hasToken ? '<button type="button" class="mono-btn mono-btn--ghost" data-action="clearToken">Apagar token</button>' : ''}
        <button type="button" class="mono-btn" data-action="pullEvents">Atualizar eventos</button>
        <button type="button" class="mono-btn" data-action="pushPending">Enviar pendentes</button>
        <button type="button" class="mono-btn" data-action="pullNow">Puxar agora</button>
        <button type="button" class="mono-btn mono-btn--secondary" data-action="test">Testar</button>
        <button type="submit" class="mono-btn mono-btn--primary">Salvar</button>
      </footer>
    </div>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
  }

  static async #onSubmit(event, form, formData) {
    const d = formData.object;
    if (!game.user.isGM) return ui.notifications.warn('Só o Mestre configura a conexão.');
    if (looksLikeToken(d.hash)) {
      // Token colado (ou preenchido pelo navegador) no campo do calendário: vira o token.
      d.token ||= d.hash;
      d.hash = MONOLITH_HASH;
      ui.notifications.warn('Fantasy-Calendar: aquilo era o token, não o calendário. Salvei como token e voltei ao calendário de Monolith.');
    }
    await set(S.HASH, normalizeHash(d.hash));
    await set(S.PULL, !!d.pull);
    await set(S.CLOCK, !!d.clock);
    await set(S.PUSH, !!d.push);
    await set(S.EVENTS, !!d.events);
    await set(S.POLL, Math.max(15, Number(d.poll) || 60));
    if (String(d.token ?? '').trim()) {
      await set(S.TOKEN_WORLD, String(d.token).trim());
      await set(S.TOKEN, '');
    }
    this.#siteDate = null;
    ui.notifications.info('Fantasy-Calendar: conexão salva.');
    restart();
    this.render();
  }

  static async #onTest() {
    const hash = getHash();
    if (!hash) return ui.notifications.warn('Preencha e salve o hash do calendário primeiro.');
    try {
      const res = await request(`/calendar/${hash}/dynamic_data`);
      const dd = readDynamicData(res);
      ui.notifications.info(`Fantasy-Calendar: leitura ok (${dd.day}/${(dd.timespan ?? 0) + 1}/${dd.year}).`);
    } catch (err) {
      return ui.notifications.error(`Fantasy-Calendar: não consegui ler o calendário (${err.message}).`);
    }
    if (!getToken()) return ui.notifications.info('Fantasy-Calendar: sem token, só a leitura está ativa.');
    try {
      const res = await request(`/calendar/${hash}/changeDate`, { method: 'POST', auth: true, body: { unit: 'days', count: 0 } });
      ui.notifications.info(`Fantasy-Calendar: token válido, envio liberado (${res?.date_string ?? 'ok'}).`);
    } catch (err) {
      ui.notifications.warn(`Fantasy-Calendar: o site recusou o token (${err.message}).`);
    }
  }

  static async #onPull() {
    await pull(true);
    this.#siteDate = null;
    this.render();
  }

  static async #onPushPending() {
    if (!game.user.isGM) return ui.notifications.warn('Só o Mestre envia os eventos.');
    if (!getToken()) return ui.notifications.warn('Fantasy-Calendar: cole o token antes de enviar.');
    await pullEvents(false);
    await enviarPendentes({ avisar: true });
  }

  static async #onPullEvents() {
    if (!game.user.isGM) return ui.notifications.warn('Só o Mestre sincroniza os eventos.');
    await pullEvents(true);
  }

  static async #onClearToken() {
    await set(S.TOKEN, '');
    await set(S.TOKEN_WORLD, '');
    ui.notifications.info('Fantasy-Calendar: token apagado.');
    this.render();
  }
}
