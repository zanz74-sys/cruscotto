import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

const VECCHIO_PANE = 'cruscotto'
const MINUTO = 60_000
const DURATA_CACHE = 60 * MINUTO
const CELLE = 10

const ultimaRisposta = atom(
  { plugin: 'cruscotto', key: 'ultimaRisposta' } as const,
  null,
)
const tick = atom({ plugin: 'cruscotto', key: 'tick' } as const, 0)
// Numero della riga in fondo alla chat: le righe precedenti restano vuote.
const riga = atom({ plugin: 'cruscotto', key: 'riga' } as const, 0)
const durataUltima = atom({ plugin: 'cruscotto', key: 'durataUltima' } as const, null)
const toolUsati = atom({ plugin: 'cruscotto', key: 'toolUsati' } as const, 0)

const colore = (percento: number) =>
  percento >= 90 ? 'error' : percento >= 70 ? 'warning' : 'success'

const celleTerminale = (percento: number) =>
  Math.min(CELLE, Math.max(0, Math.round(percento / CELLE)))

// Un SVG è un'immagine: non legge il tema, quindi colori fissi leggibili su chiaro e scuro.
const ESADECIMALE = { success: '#3FB950', warning: '#D29922', error: '#F85149' }
const BARRA_L = 110
const BARRA_H = 10

const svgBarra = (percento: number) => {
  const piena =
    percento <= 0 ? 0 : Math.max(BARRA_H, Math.min(BARRA_L, (BARRA_L * percento) / 100))
  const riempimento =
    piena === 0
      ? ''
      : `<rect width="${piena}" height="${BARRA_H}" rx="${BARRA_H / 2}" fill="${ESADECIMALE[colore(percento)]}"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BARRA_L}" height="${BARRA_H}" viewBox="0 0 ${BARRA_L} ${BARRA_H}"><rect width="${BARRA_L}" height="${BARRA_H}" rx="${BARRA_H / 2}" fill="#8B8B8B" fill-opacity="0.25"/>${riempimento}</svg>`
}

const formatoToken = (token: number) => `${Math.round(token / 1000)} kt`

const formatoDurata = (ms: number) => {
  const minuti = Math.floor(Math.max(0, ms) / MINUTO)
  const ore = Math.floor(minuti / 60)

  return ore === 0 ? `${minuti} min` : `${ore} h ${minuti % 60} min`
}

const formatoRisposta = (ms: number) => {
  const secondi = Math.round(ms / 1000)

  return secondi < 60 ? `${secondi} s` : formatoDurata(ms)
}

const portaInFondo = async ($: EngineInterface) => {
  await update($, riga, n => n + 1)
  await $.ui.place({ id: `riga-${await read($, riga)}` })
}

const disegna = async (
  $: EngineInterface,
  e: Parameters<EngineInterface['ui']['resolve']>[0],
) => {
  const tabella = $.ui.resolve(e)
  const { Box, Text } = tabella
  const Svg = e.surface !== 'terminal' && 'Svg' in tabella ? tabella.Svg : undefined
  await read($, tick)
  const ultima = await read($, ultimaRisposta)
  const adesso = await $.clock.now()
  const { context, rateLimits, startedAt } = await $.session.usage()

  const limite = (kind: string) => {
    const trovato = rateLimits.find(r => r.kind === kind)

    return trovato && Math.round(trovato.percentUsed)
  }
  const righe: { etichetta: string; percento?: number; extra?: string }[] = [
    {
      etichetta: '🧠 memoria',
      percento: context.percent,
      extra: context.tokens === undefined ? undefined : formatoToken(context.tokens),
    },
  ]
  const cinqueOre = limite('five_hour')
  const settimana = limite('seven_day')
  if (cinqueOre !== undefined) righe.push({ etichetta: '⏳ 5 ore', percento: cinqueOre })
  if (settimana !== undefined) righe.push({ etichetta: '📅 settimana', percento: settimana })

  // Una /clear azzera startedAt: una risposta precedente non scalda la nuova chat.
  const trascorso = ultima !== null && ultima >= startedAt ? adesso - ultima : null
  const calda = trascorso !== null && trascorso < DURATA_CACHE
  const restano = calda ? Math.ceil((DURATA_CACHE - trascorso) / MINUTO) : 0
  const resetsAt = rateLimits.find(r => r.kind === 'five_hour')?.resetsAt
  const alReset = resetsAt === undefined ? 0 : Date.parse(resetsAt) - adesso
  // Per eccesso: mai "tra 0 min". Reset già passato o data illeggibile: niente riga.
  const reset = alReset > 0 ? formatoDurata(Math.ceil(alReset / MINUTO) * MINUTO) : undefined
  const durata = await read($, durataUltima)
  const tool = await read($, toolUsati)
  const spazio =
    context.tokens === undefined
      ? '—'
      : formatoToken(Math.max(0, context.window - context.tokens))
  const separatore = (
    <Box flexDirection="column">
      <Text dimColor>│</Text>
      <Text dimColor>│</Text>
      <Text dimColor>│</Text>
    </Box>
  )

  return (
    <Box flexDirection="row" columnGap={2}>
      <Box flexDirection="column">
        {righe.map(r => (
          <Box flexDirection="row" columnGap={1} alignItems="center">
            <Box width={13}>
              <Text>{r.etichetta}</Text>
            </Box>
            {Svg ? (
              <Svg
                source={svgBarra(r.percento ?? 0)}
                alt={r.percento === undefined ? 'nessun dato' : `barra ${r.percento}%`}
                width={BARRA_L}
                height={BARRA_H}
              />
            ) : (
              <Box flexDirection="row">
                <Text color={colore(r.percento ?? 0)}>
                  {'━'.repeat(celleTerminale(r.percento ?? 0))}
                </Text>
                <Text dimColor>{'─'.repeat(CELLE - celleTerminale(r.percento ?? 0))}</Text>
              </Box>
            )}
            <Box width={5}>
              {r.percento === undefined ? (
                <Text dimColor>—</Text>
              ) : (
                <Text color={colore(r.percento)}>{r.percento}%</Text>
              )}
            </Box>
            {r.extra !== undefined && <Text dimColor>{r.extra}</Text>}
          </Box>
        ))}
      </Box>
      {separatore}
      <Box flexDirection="column">
        <Text>🕒 aperta da {formatoDurata(adesso - startedAt)}</Text>
        <Text>{calda ? `🔥 cache calda, ancora ${restano} min` : '🧊 cache fredda'}</Text>
        {reset !== undefined && <Text>🔄 reset 5 ore tra {reset}</Text>}
      </Box>
      {separatore}
      <Box flexDirection="column">
        <Text>📦 {spazio}</Text>
        <Text>⏱️ {durata === null ? '—' : formatoRisposta(durata)}</Text>
        <Text>🛠️ {tool} tool</Text>
      </Box>
    </Box>
  )
}

export const register: Register = on => {
  let timer: Timer | undefined

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'cruscotto',
      description: 'Riporta il Cruscotto in fondo alla chat',
    })
    timer?.cancel()
    timer = $.clock.every(MINUTO, () => {
      void update($, tick, n => n + 1)
    })
    await $.ui.close({ id: VECCHIO_PANE })
    const avviata = await next(e)
    await portaInFondo($)

    return avviata
  })

  on('command.run', { command: 'cruscotto' }, async $ => {
    await portaInFondo($)

    return { text: 'Cruscotto riportato in fondo.' }
  })

  on('turn.complete', async ($, e, next) => {
    // I subagent hanno una cache propria: conta solo la chat principale.
    const principale = e.agentId === undefined
    if (principale) await update($, durataUltima, () => e.durationMs)
    if (principale && e.reason !== 'error') {
      const adesso = await $.clock.now()
      await update($, ultimaRisposta, () => adesso)
    }
    const finito = await next(e)
    if (principale) await portaInFondo($)

    return finito
  })

  on('tool.call', async ($, e, next) => {
    await update($, toolUsati, n => n + 1)

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await update($, tick, n => n + 1)

    return next(e)
  })

  // Terminale e app desktop: la zona fissa sopra il prompt.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    return disegna($, e)
  })

  // VS Code e mobile non hanno quella zona: ultima riga della chat.
  on('ui.render', { component: 'Placed' }, async ($, e, next) => {
    const nostra = e.props.plugin === 'cruscotto'
    const fissa = e.surface === 'terminal' || e.surface === 'desktop'
    if (!nostra || fissa || e.props.id !== `riga-${await read($, riga)}`) return next(e)

    return disegna($, e)
  })
}
