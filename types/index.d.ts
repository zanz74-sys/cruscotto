export type UltimaRisposta = number | null

declare module 'claude-code' {
  interface PluginState {
    cruscotto: { ultimaRisposta: UltimaRisposta; tick: number; riga: number; durataUltima: number | null; toolUsati: number }
  }
}
