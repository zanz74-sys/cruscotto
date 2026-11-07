import { expect, mock, test } from 'claude-code/testing'
import type { SessionUsage } from 'claude-code'

const riga = (id: string) =>
  ({
    plugin: 'cruscotto',
    component: 'Placed',
    requestId: id,
    props: { id, plugin: 'cruscotto' },
  }) as const

const SOPRA = {
  plugin: 'cruscotto',
  component: 'AbovePrompt',
  requestId: 'above',
  props: { hasSurvey: false, isWorking: false, view: {} },
} as const

const INIZIO = 1_000_000_000
const MIN = 60_000

const usage = (extra: Partial<SessionUsage> = {}): SessionUsage => ({
  startedAt: INIZIO,
  context: { window: 200_000, tokens: 91_000, percent: 46 },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 69.6 },
    { kind: 'seven_day', percentUsed: 90 },
  ],
  cost: { usd: 1.27 },
  ...extra,
})

test('barre, token e limiti: riga in VS Code e mobile, zona fissa altrove', async ($, on) => {
  mock.clock(on, { now: INIZIO + 134 * MIN })
  on('session.usage', () => ({ value: usage() }))

  const prove = [
    { ...riga('riga-0'), surface: 'vscode' },
    { ...riga('riga-0'), surface: 'mobile' },
    { ...SOPRA, surface: 'terminal' },
    { ...SOPRA, surface: 'desktop' },
  ] as const

  for (const prova of prove) {
    const ui = await $.ui.mount(prova)

    expect(await ui.find({ type: 'Text', text: /^46%$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^91 kt$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^70%$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^90%$/ })).toBeDefined()
    if (prova.surface === 'terminal') {
      expect((await ui.find({ type: 'Text', text: /━/ }))?.text).toBe('━━━━━')
      expect((await ui.find({ type: 'Text', text: /─/ }))?.text).toBe('─────')
    } else {
      expect(await ui.findAll({ type: 'Svg' })).toHaveLength(3)
    }
    expect(await ui.find({ type: 'Text', text: /2 h 14 min/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /\$|1,27/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('barre verdi, gialle dal 70%, rosse dal 90%', async ($, on) => {
  mock.clock(on, { now: INIZIO })
  on('session.usage', () => ({
    value: usage({
      context: { window: 200_000, tokens: 138_000, percent: 69 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 70 },
        { kind: 'seven_day', percentUsed: 90 },
      ],
    }),
  }))

  const ui = await $.ui.mount({ ...riga('riga-0'), surface: 'vscode' })

  expect((await ui.find({ type: 'Text', text: /69%/ }))?.props.color).toBe('success')
  expect((await ui.find({ type: 'Text', text: /70%/ }))?.props.color).toBe('warning')
  expect((await ui.find({ type: 'Text', text: /90%/ }))?.props.color).toBe('error')
  const barre = await ui.findAll({ type: 'Svg' })
  expect(String(barre[0]?.props.source)).toContain('#3FB950')
  expect(String(barre[1]?.props.source)).toContain('#D29922')
  expect(String(barre[2]?.props.source)).toContain('#F85149')
  expect(String(barre[0]?.props.source)).toContain('width="75.9"')
  await ui.unmount()
})

test('senza abbonamento le righe dei limiti non ci sono', async ($, on) => {
  mock.clock(on, { now: INIZIO })
  on('session.usage', () => ({ value: usage({ rateLimits: [] }) }))

  const ui = await $.ui.mount({ ...riga('riga-0'), surface: 'vscode' })

  expect(await ui.find({ type: 'Text', text: /5 ore/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /settimana/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /memoria/ })).toBeDefined()
  await ui.unmount()
})

test('prima della prima risposta: trattino e cache fredda', async ($, on) => {
  mock.clock(on, { now: INIZIO })
  on('session.usage', () => ({
    value: usage({ context: { window: 200_000 }, rateLimits: [] }),
  }))

  const ui = await $.ui.mount({ ...riga('riga-0'), surface: 'vscode' })

  expect(await ui.find({ type: 'Text', text: /—/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /cache fredda/ })).toBeDefined()
  await ui.unmount()
})

test('dopo una risposta la riga nuova disegna, la vecchia si svuota; cache fredda a 60 min', async ($, on) => {
  const clock = mock.clock(on, { now: INIZIO })
  const posate: string[] = []
  on('session.usage', () => ({ value: usage() }))
  on('turn.complete', () => ({ text: 'ok' }))
  on('ui.place', (_, e) => {
    posate.push(e.id)

    return { value: { isPlaced: true } } as never
  })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>motore</Text>
  })

  await $.turn.complete({ answer: 'ok', durationMs: 1, reason: 'answer' } as never)
  expect(posate).toEqual(['riga-1'])

  let ui = await $.ui.mount({ ...riga('riga-0'), surface: 'vscode' })
  expect(await ui.find({ type: 'Text', text: /cache/ })).toBeUndefined()
  await ui.unmount()

  await clock.advance(22 * MIN)
  ui = await $.ui.mount({ ...riga('riga-1'), surface: 'vscode' })
  expect((await ui.find({ type: 'Text', text: /cache/ }))?.text).toBe(
    '🔥 cache calda, ancora 38 min',
  )
  await ui.unmount()

  await clock.advance(38 * MIN)
  ui = await $.ui.mount({ ...riga('riga-1'), surface: 'vscode' })
  expect((await ui.find({ type: 'Text', text: /cache/ }))?.text).toBe('🧊 cache fredda')
  await ui.unmount()
})

test('reset 5 ore: conto alla rovescia, sparisce se assente o già passato', async ($, on) => {
  const clock = mock.clock(on, { now: INIZIO })
  const conReset = usage({
    rateLimits: [
      {
        kind: 'five_hour',
        percentUsed: 23,
        resetsAt: new Date(INIZIO + 80 * MIN - 1).toISOString(),
      },
    ],
  })
  let attuale = conReset
  on('session.usage', () => ({ value: attuale }))

  const testo = async () => {
    const ui = await $.ui.mount({ ...riga('riga-0'), surface: 'vscode' })
    const trovato = await ui.find({ type: 'Text', text: /reset 5 ore/ })
    await ui.unmount()

    return trovato?.text
  }

  expect(await testo()).toBe('🔄 reset 5 ore tra 1 h 20 min')

  await clock.advance(80 * MIN)
  expect(await testo()).toBeUndefined()

  attuale = usage()
  expect(await testo()).toBeUndefined()
})

test('terza colonna: spazio, durata risposta, tool', async ($, on) => {
  mock.clock(on, { now: INIZIO })
  on('session.usage', () => ({ value: usage() }))
  on('turn.complete', () => ({ text: 'ok' }))
  on('tool.call', () => ({ result: {} }))
  on('ui.place', () => ({ value: { isPlaced: true } }) as never)

  const testi = async (id: string) => {
    const ui = await $.ui.mount({ ...riga(id), surface: 'vscode' })
    const leggi = async (re: RegExp) => (await ui.find({ type: 'Text', text: re }))?.text
    const trovati = [await leggi(/📦/), await leggi(/⏱️/), await leggi(/🛠️/)]
    await ui.unmount()

    return trovati
  }

  expect(await testi('riga-0')).toEqual(['📦 109 kt', '⏱️ —', '🛠️ 0 tool'])

  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.turn.complete({ answer: 'ok', durationMs: 42_000, reason: 'answer' } as never)
  expect(await testi('riga-1')).toEqual(['📦 109 kt', '⏱️ 42 s', '🛠️ 2 tool'])

  await $.turn.complete({ answer: 'ok', durationMs: 185_000, reason: 'answer' } as never)
  expect((await testi('riga-2'))[1]).toBe('⏱️ 3 min')
})

test('un subagent non scalda la cache e non sposta la riga', async ($, on) => {
  mock.clock(on, { now: INIZIO })
  on('session.usage', () => ({ value: usage() }))
  on('turn.complete', () => ({ text: 'ok' }))

  await $.turn.complete({
    answer: 'ok',
    durationMs: 1,
    reason: 'answer',
    agentId: 'a1',
  } as never)

  const ui = await $.ui.mount({ ...riga('riga-0'), surface: 'vscode' })
  expect(await ui.find({ type: 'Text', text: /cache fredda/ })).toBeDefined()
  await ui.unmount()
})
