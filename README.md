# Draft Airuno

Un draft a due con gli ex dell'U.S.O. Airuno Open A. Per ogni posto in campo escono tre giocatori a caso e ne scegli uno. Poi si giocano andata e ritorno simulate, con marcatori e minuti, e se serve si va ai rigori.

Si gioca dal browser del telefono: niente app da installare, niente account, niente server.

## Come si gioca

**Un telefono.** Si sceglie modulo e stile per tutte e due le squadre, poi il draft si fa passandosi il telefono. Le rose restano coperte fino alla fine.

**Due telefoni** (nella stessa stanza):
1. Ognuno sceglie nome, modulo e stile, fa il draft sul suo telefono e sceglie 5 rigoristi.
2. Ogni telefono mostra un QR con il codice della propria squadra: ognuno inquadra quello dell'altro. In alternativa il codice si può copiare e incollare.
3. Tutti e due i telefoni calcolano la stessa identica sfida. Per controllare, sui due schermi compare lo stesso "codice partita" di 4 caratteri.

Regole della sfida: andata in casa della prima squadra, ritorno in casa della seconda. Passa chi vince più partite; con una vittoria a testa o due pareggi si va ai rigori.

## Come funziona dentro

- **Forza nascosta.** Ogni giocatore ha un livello da 1 a 3 che pesa sulla simulazione insieme a un po' di fortuna: con medie 2,5 contro 1,8 la squadra più forte vince circa il 65% delle partite. I livelli sono in `data.js` **offuscati, non cifrati**: chi apre il codice con pazienza li ricava.
- **Stile.** Offensivo segna e subisce di più, difensivo il contrario. Il modulo decide solo quanti giocatori servono per ruolo.
- **Multi-ruolo.** Un giocatore con più ruoli può uscire in più pool, ma mai due volte nella stessa squadra. Se in un ruolo restano meno di tre giocatori escono meno carte.
- **Due telefoni senza server.** Il codice squadra contiene modulo, stile, giocatori, rigoristi e nome. Il seme della simulazione si ricava dai due codici, quindi i telefoni arrivano allo stesso risultato senza parlarsi. Lo scanner QR usa la fotocamera del browser (serve HTTPS, che GitHub Pages dà già).

## Aggiornare la lista giocatori

La lista vera, con i livelli in chiaro, sta nel Google Sheet e **non** va nel repo.

1. Dal Google Sheet: *File → Scarica → Valori separati da virgola (.csv)*. Colonne: `Nome`, `Ruoli` (es. `CC/DC`), `Livello` (1–3).
2. Rigenera i dati:
   ```sh
   python3 tools/genera-dati.py ~/Downloads/giocatori.csv
   ```
   Le righe senza ruolo o livello vengono saltate e segnalate. I file `.csv` sono esclusi dal repo dal `.gitignore`.
3. Fai commit e push di `data.js`.

Dopo un aggiornamento della lista, i due telefoni devono ricaricare la pagina: se hanno liste diverse, il codice squadra viene rifiutato con un messaggio.

Ruoli ammessi: `POR`, `TD`, `DC`, `TS`, `CC`, `ED`, `ES`, `ATT`.

## Test

```sh
node tests/run.mjs
```

Verificano il codice squadra, che due telefoni calcolino la stessa sfida, i flussi completi delle due modalità, che il draft non resti mai senza scelte e la taratura della simulazione. Nessuna dipendenza da installare.

Se cambi la simulazione, alza il numero di versione nel codice squadra (`encodeTeam` / `decodeTeam` in `app.js`): due telefoni con versioni diverse calcolerebbero sfide diverse.

## Pubblicazione

Il sito è statico e gira su GitHub Pages dal branch `main`, cartella principale (*Settings → Pages*).

## File

| File | Cosa contiene |
|---|---|
| `index.html` | La pagina |
| `style.css` | Grafica |
| `app.js` | Draft, simulazione, codice squadra, QR |
| `data.js` | Giocatori e livelli offuscati, generato dallo script |
| `tools/genera-dati.py` | Da CSV a `data.js` |
| `tests/run.mjs` | Test |
| `vendor/` | [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT) e [jsQR](https://github.com/cozmo/jsQR) (Apache 2.0) |
