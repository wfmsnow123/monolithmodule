/**
 * Calendário de Monolith: na primeira abertura, o Mestre recebe o calendário de Monolith já importado
 * (o export do Fantasy-Calendar embutido em assets/monolith-fc.json), com todos os eventos, e ele vira o ativo.
 * @module Integrations/MonolithSeed
 */

import { CalendarManager, CalendarRegistry } from '../calendar/_module.mjs';
import { MODULE } from '../constants.mjs';
import { FestivalManager } from '../festivals/_module.mjs';
import { createImporter } from '../importers/_module.mjs';
import { log } from '../utils/_module.mjs';

export const MONOLITH_ID = 'custom-monolith';
const SEMEADO = 'monolithSeeded';

export function registerMonolithSeedSettings() {
  game.settings.register(MODULE.ID, SEMEADO, { scope: 'world', config: false, type: Boolean, default: false });
}

export async function seedMonolithCalendar() {
  if (!game.users.activeGM?.isSelf) return;
  if (game.settings.get(MODULE.ID, SEMEADO) && CalendarRegistry.has(MONOLITH_ID)) return;
  try {
    const res = await fetch(`modules/${MODULE.ID}/assets/monolith-fc.json`);
    const data = await res.json();
    const importer = createImporter('fantasy-calendar');
    if (!CalendarRegistry.has(MONOLITH_ID)) {
      const def = await importer.transform(data);
      def.name = 'Monolith';
      def.metadata = { ...(def.metadata ?? {}), suggestedId: 'monolith' };
      const calendar = await CalendarManager.createCustomCalendar('monolith', def);
      if (!calendar) throw new Error('não foi possível criar o calendário');
      await FestivalManager.seedFestivalNotes(MONOLITH_ID, calendar);
      const notes = await importer.extractNotes(data);
      const result = await importer.importNotes(notes, { calendarId: MONOLITH_ID, calendarName: 'Monolith' });
      log(3, `Monolith: ${result.count} eventos importados`, result.errors);
    }
    await game.settings.set(MODULE.ID, SEMEADO, true);
    if (CalendarManager.getActiveCalendar()?.metadata?.id !== MONOLITH_ID) {
      await CalendarManager.switchCalendar(MONOLITH_ID);
      ui.notifications.info('Calendário de Monolith instalado. O mundo vai recarregar.');
      foundry.utils.debouncedReload();
    }
  } catch (err) {
    log(1, 'Monolith: falha ao instalar o calendário embutido', err);
    ui.notifications.error(`Calendário de Monolith: falha ao instalar o calendário embutido (${err.message}).`);
  }
}
