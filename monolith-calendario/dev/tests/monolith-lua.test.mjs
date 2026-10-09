/**
 * Monolith fork: aviso de lua cheia. Cada lua fica cheia num único dia por ciclo (o passo do meio,
 * 12 de 24, como no Fantasy-Calendar), e os dias até a cheia contam 3, 2, 1, 0.
 */
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { beforeAll, describe, expect, it } from 'vitest';
import CalendariaCalendar from '../../scripts/data/calendaria-calendar.mjs';
import FantasyCalendarImporter from '../../scripts/importers/fantasy-calendar-importer.mjs';
import { cheia, diasAteCheia } from '../../scripts/integrations/monolith-lua.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fc = JSON.parse(readFileSync(resolve(here, 'fixtures/monolith-fc.json'), 'utf-8'));
let cal, spd, inicio;

beforeAll(async () => {
  const def = await new FantasyCalendarImporter().transform(fc);
  cal = Object.create(CalendariaCalendar.prototype);
  Object.assign(cal, def);
  cal.leapYearConfig ??= null;
  spd = 24 * 60 * 60;
  // 11 de Ashka de 1978, meio-dia: a data atual da campanha.
  inicio = cal.componentsToTime({ year: 1978 - def.years.yearZero, month: 8, dayOfMonth: 10, hour: 12, minute: 0, second: 0 });
});

describe('Monolith: lua cheia', () => {
  for (const [indice, nome, ciclo] of [[0, 'Telunia', 24], [1, 'Pilas', 20]]) {
    it(`${nome} fica cheia em exatamente um dia a cada ${ciclo}`, () => {
      const dias = [];
      for (let d = 0; d < ciclo * 3; d++) if (cheia(cal, indice, inicio + d * spd)) dias.push(d);
      expect(dias.length).toBe(3);
      expect(dias[1] - dias[0]).toBe(ciclo);
      expect(cal.getMoonPhase(indice, inicio + dias[0] * spd).step).toBe(12);
    });
    it(`${nome}: a contagem regressiva é 3, 2, 1, 0 nos dias antes da cheia`, () => {
      let d = 0;
      while (!cheia(cal, indice, inicio + d * spd)) d++;
      const contagem = [3, 2, 1, 0].map((n) => diasAteCheia(cal, indice, inicio + (d - n) * spd, spd));
      expect(contagem).toEqual([3, 2, 1, 0]);
      expect(diasAteCheia(cal, indice, inicio + (d - 4) * spd, spd)).toBeNull();
    });
  }
});
