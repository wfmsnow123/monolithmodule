# Monolith: Calendário

Calendário da campanha Monolith para Foundry VTT 13 (13.351+).

**Este módulo é um fork do [Calendaria](https://github.com/Sayshal/Calendaria), de Tyler (Sayshal), versão 1.0.17, licença MIT.** Todo o mérito da base (widgets, notas, clima, escurecimento de cena, editor, API) é do projeto original. O aviso de copyright original está mantido no arquivo LICENSE, como a licença MIT exige.

## O que muda em relação ao Calendaria

- **Luas do Fantasy-Calendar.** Dois modos novos de fase:
  - *Fantasy-Calendar: ciclo personalizado*: uma fase por dia do ciclo, como o "custom cycle" do site (Telunia e Pilas usam este).
  - *Fantasy-Calendar: ciclo e deslocamento*: luas comuns do site, com o mesmo arredondamento de fase.
  Ambos usam a granularidade do site (24 fases). Ícones, nome da fase, escurecimento e eclipses continuam funcionando.
- **Estações periódicas contínuas.** O ciclo de estações corre a partir do dia 0, independente do ano, igual às "periodic seasons" do site. Condições de notas, dia e porcentagem da estação e o gancho de troca de estação passam a concordar com o calendário.
- **Importador do Fantasy-Calendar fiel ao site.** Ano 0, dia da semana, luas, estações periódicas e eventos (mês, dia, estação, lua, "a cada N", grupos "e/ou/não/pelo menos N") caem nos mesmos dias que no site.
- **Sincronização com app.fantasy-calendar.com.** Puxa a data do site periodicamente; opcionalmente envia os avanços feitos no Foundry.
- **Céu carmesim à noite.** Entre o pôr e o nascer do sol, um degradê vermelho bem fraco aparece nas bordas da tela, entrando e saindo devagar em uma hora. Intensidade, cor e pulso nas configurações; cada jogador pode desligar para si.

## Instalação

1. Desative o **Calendaria** original e o **Simple Timekeeping**, se estiverem instalados.
2. Instale pelo manifest e ative no mundo.
3. Na primeira abertura, o Mestre recebe o **calendário de Monolith já importado** (meses, semana, Telunia e Pilas, estações periódicas, eras, constelações e os 87 eventos), e ele vira o calendário ativo. O mundo recarrega uma vez.
4. A sincronização com o Fantasy-Calendar já vem ligada para o calendário de Monolith: o Foundry acompanha a data do site. Para o Foundry também mudar a data do site e enviar eventos, abra **Configurações do Calendário > Início > Fantasy-Calendar** e cole o token de acesso pessoal (fica salvo no mundo).
5. **Eventos nos dois sentidos.** Os eventos do site viram notas do calendário, com descrição, datas e recorrência; o Foundry confere de novo a cada 10 verificações e pelo botão **Atualizar eventos**. Uma nota criada ou editada no Foundry (nome, texto, data) vai para o site. Apagar uma nota no Foundry não apaga o evento no site. Notas que vieram sem texto do importador antigo (como festivais) são trocadas pelas notas certas na primeira sincronização.

## O que foi tirado do Calendaria

Abas de Névoa de Guerra, Macros, Chat, Permissões, Tela, Módulo, Cinemáticas e Cronômetro; importadores de outros módulos (fica o do Fantasy-Calendar e o de backups do próprio calendário); os calendários de exemplo (fica o gregoriano, como reserva interna); links, rodapé e mensagem de novidades. Os temas viraram **Monolith: Abyss** e **Monolith: Ossuary**, do design system de Monolith.

## Limites conhecidos

- A estrutura do calendário (meses, luas, estações, eventos) vem do JSON exportado. A API pública do site só expõe a data atual; se o calendário mudar no site, exporte e importe de novo.
- Enviar avanços ao site usa a rota `changeDate` da API, que não tem documentação oficial e ainda não foi testada com uma conta real.
- Dados de um mundo que já usava o Calendaria original não são migrados (o id do módulo é outro).

## Desenvolvimento

Fonte em `D:\FoundryDev\monolithmodule\monolith-calendario` (monorepo). `npm run build` gera `dist/`; `npm test` roda 1.645 testes, incluindo `dev/tests/monolith-fantasy-calendar.test.mjs`, que compara datas, dias da semana, luas, estações e eventos com os valores calculados pelas fórmulas do próprio Fantasy-Calendar.

---

## Heads-up for the Calendaria authors (upstream notes)

Thank you for Calendaria. While adapting it we found a few issues that also affect the original 1.0.17; feel free to use any of the fixes in this fork (MIT):

1. **Fantasy-Calendar importer shows every date one year ahead when the FC calendar has a year 0.** `years.yearZero` is hardcoded to `1` and `static_data.settings.year_zero_exists` is ignored; `applyCurrentDate` then adds `yearZero` to the FC year. Weekdays only line up because internal year equals the FC year.
2. **FC moons with `custom_phase`/`custom_cycle` break the import.** `cycleLength` is read from `moon.cycle`, which those moons don't have, so validation fails (or the editor silently turns it into 28). Standard FC moons also add `shift` with the wrong sign (Calendaria adds `cycleDayAdjust`; FC subtracts `shift`).
3. **FC periodic seasons are imported as dated seasons.** `periodic_seasons` and `season_offset` are ignored.
4. **Periodic seasons disagree between code paths.** `CalendariaCalendar.getCurrentSeason` cycles from the epoch, but `calendar-math` (`getSeasonIndex`, `getSeasonPercent`, `getSeasonDay`) restarts the cycle every year via `_calculatePeriodicSeasonBounds`, so note conditions and the UI can show different seasons.
5. **`components.season` is never set.** `timeToComponents` returns no `season`, so `api.getCurrentSeason()`, the chat command, the almanac enricher and `TimeTracker`'s season-change hook always see season 0 / undefined.
6. **FC event import:** month conditions compare the 0-based FC timespan index against the 1-based `month` field; season conditions compare a 0-based index against `index + 1`; conditions wrapped in groups are not seen by `#extractDate`, so yearly events get a 1st-of-first-month start date that conflicts with their own conditions; FC "every nth" modulo is anchored at zero plus offset, while the engine anchors at the note start date.
7. **Calendar editor drops unknown moon fields on save** (it rebuilds each moon from the form), which would also discard any future moon mode data.
- **Aviso de lua cheia.** A cada dia que vira no relógio, uma mensagem no chat quando faltam 3, 2 ou 1 dia para a lua cheia de Telunia ou de Pilas, e no próprio dia; as duas cheias juntas são uma convergência. Uma mensagem por dia e por lua. Configurações: para todos, só para o Mestre ou desligado.
