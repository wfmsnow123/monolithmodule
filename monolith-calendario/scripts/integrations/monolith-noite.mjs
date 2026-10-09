/**
 * Céu de Monolith: à noite, um degradê vermelho bem fraco nas bordas da tela,
 * lembrando o céu carmesim depois do Morgenrotten. Entra e sai devagar no pôr e no nascer do sol.
 * @module Integrations/MonolithNoite
 */

import { CalendariaAPI } from '../api.mjs';
import { MODULE } from '../constants.mjs';

const ID_EL = 'monolith-noite';
/** Minutos de transição depois do pôr do sol e antes do nascer. */
const TRANSICAO = 60;

export function registerMonolithNightSettings() {
  const atualizar = () => atualizarNoite();
  game.settings.register(MODULE.ID, 'monolithNoite', {
    name: 'Céu carmesim à noite',
    hint: 'Um degradê vermelho bem fraco nas bordas da tela entre o pôr e o nascer do sol.',
    scope: 'client', config: true, type: Boolean, default: true, onChange: atualizar
  });
  game.settings.register(MODULE.ID, 'monolithNoiteIntensidade', {
    name: 'Céu carmesim: intensidade',
    hint: 'Força máxima do degradê no meio da noite (0 a 1). Vale para todos.',
    scope: 'world', config: true, type: Number, default: 0.45,
    range: { min: 0.05, max: 1, step: 0.05 }, onChange: atualizar
  });
  game.settings.register(MODULE.ID, 'monolithNoiteCor', {
    name: 'Céu carmesim: cor',
    scope: 'world', config: true, type: new foundry.data.fields.ColorField({ initial: '#8e0f16' }), default: '#8e0f16', onChange: atualizar
  });
  game.settings.register(MODULE.ID, 'monolithNoitePulso', {
    name: 'Céu carmesim: pulsar devagar',
    hint: 'O degradê respira, quase sem se notar. Desligado em quem prefere menos movimento.',
    scope: 'world', config: true, type: Boolean, default: true, onChange: atualizar
  });
}

/** 0 de dia, 1 no meio da noite, com rampa de TRANSICAO minutos nas pontas. */
export function fatorNoite() {
  const nascer = CalendariaAPI.getSunrise?.();
  const por = CalendariaAPI.getSunset?.();
  if (nascer == null || por == null) return 0;
  const c = game.time.components;
  const mph = CalendariaAPI.calendar?.days?.minutesPerHour ?? 60;
  const hpd = CalendariaAPI.calendar?.days?.hoursPerDay ?? 24;
  const agora = c.hour + c.minute / mph;
  const rampa = TRANSICAO / mph;
  if (agora >= nascer && agora < por) return 0;
  const desdePor = (agora - por + hpd) % hpd;
  const ateNascer = (nascer - agora + hpd) % hpd;
  return Math.min(1, desdePor / rampa, ateNascer / rampa);
}

function elemento() {
  let el = document.getElementById(ID_EL);
  if (!el) {
    el = document.createElement('div');
    el.id = ID_EL;
    el.setAttribute('aria-hidden', 'true');
    const board = document.getElementById('board');
    if (board?.parentElement) board.after(el);
    else document.body.prepend(el);
  }
  return el;
}

export function atualizarNoite() {
  const ligado = game.settings.get(MODULE.ID, 'monolithNoite') && canvas?.scene;
  const f = ligado ? fatorNoite() : 0;
  const el = elemento();
  const max = Number(game.settings.get(MODULE.ID, 'monolithNoiteIntensidade')) || 0.45;
  el.style.setProperty('--mn-cor', String(game.settings.get(MODULE.ID, 'monolithNoiteCor') || '#8e0f16'));
  el.style.setProperty('--mn-alfa', String(Math.round(f * max * 1000) / 1000));
  el.classList.toggle('pulsa', !!game.settings.get(MODULE.ID, 'monolithNoitePulso'));
  el.classList.toggle('ativo', f > 0);
}

export function initializeMonolithNight() {
  atualizarNoite();
  Hooks.on('updateWorldTime', () => atualizarNoite());
  Hooks.on('canvasReady', () => atualizarNoite());
  Hooks.on('updateScene', () => atualizarNoite());
}
