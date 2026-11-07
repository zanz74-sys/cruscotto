# Cruscotto

Mod per Claude Code: un riquadro con lo stato della chat, aggiornato da solo dopo ogni risposta e ogni minuto.

```
🧠 memoria    46%  91 kt  │  🕒 aperta da 2 h 14 min        │  📦 109 kt
⏳ 5 ore      23%         │  🔥 cache calda, ancora 38 min  │  ⏱️ 42 s
📅 settimana  12%         │  🔄 reset 5 ore tra 1 h 20 min  │  🛠️ 37 tool
```

| Voce | Cosa mostra |
|---|---|
| 🧠 memoria | riempimento del contesto e token usati |
| ⏳ 5 ore, 📅 settimana | limiti dell'abbonamento (solo con abbonamento) |
| 🕒 aperta da | da quanto è aperta la sessione |
| 🔥 / 🧊 cache | minuti rimasti: conta 1 ora dall'ultima risposta |
| 🔄 reset | quanto manca al reset del limite di 5 ore (solo con abbonamento) |
| 📦 | spazio rimasto nel contesto |
| ⏱️ | durata dell'ultima risposta |
| 🛠️ | tool usati nella sessione |

Le barre sono verdi, gialle dal 70% e rosse dal 90%.

## Installazione

Al prompt di una sessione nel terminale:

```
/plugin install cruscotto --marketplace zanz74-sys/cruscotto
```

Rispondi `y` per aggiungere il marketplace, poi scegli l'ambito.

Da una shell:

```
claude plugin install cruscotto --marketplace zanz74-sys/cruscotto
```

Nell'app desktop, dove `/plugin` non funziona: clicca **+** accanto al prompt, poi **Plugins**, **Add marketplace** con `zanz74-sys/cruscotto`, poi **Add plugin**.

## Dove compare

- **Terminale e app desktop**: zona fissa sopra il prompt.
- **VS Code e mobile**: ultima riga della chat. Dopo ogni risposta torna in fondo; `/cruscotto` ce lo riporta a mano.

## Limiti

- La cache è una stima: conta 1 ora dall'ultima risposta e non legge lo stato reale.
- Una sessione ripresa conta il tempo dal primo avvio.
- 🛠️ e ⏱️ non si azzerano con `/clear`.

## Test

```
claude plugin validate .
claude plugin test .
```
