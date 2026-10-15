# Draft Airuno — istruzioni per Claude

Gioco web statico (GitHub Pages, branch `main`, root) per fare un draft a due con gli ex dell'U.S.O. Airuno Open A. Il proprietario è Simone: rispondigli in italiano, in modo pratico e diretto.

## Aggiornare la lista giocatori ("ho aggiornato la lista")

La fonte è il Google Sheet **"Draft Airuno A - Players"**, ID `1Jpr7OCFI6rmYFw8uw6CEDpjeEODljnOx4grlelRn10k`, privato. Colonne: `Nome`, `Ruoli` (separati da `/`), `Livello` (1–3).

1. Leggi lo sheet con il connettore Google Drive.
2. Scrivi un CSV con le stesse colonne **fuori dal repo** (nello scratchpad). Contiene i livelli in chiaro e non deve mai essere committato.
3. `python3 tools/genera-dati.py <percorso.csv>` rigenera `data.js`. Riferisci a Simone quanti giocatori ci sono e quali righe sono state saltate (ruolo o livello mancante o non valido).
4. `node tests/run.mjs`: devono passare tutti.
5. Commit di `data.js` soltanto, poi push su `main`.
6. Ricorda a Simone che chi ha la pagina aperta deve ricaricarla: telefoni con liste diverse rifiutano il codice squadra.

Non scrivere mai i livelli in chiaro in un file del repo, in un messaggio di commit o in chat.

## Regole di gioco decise con Simone

- Ruoli: `POR TD DC TS CC ED ES ATT`. Niente trequartista: nel 4-2-3-1 il posto centrale è un `CC`.
- Moduli: 4-4-2, 4-3-3, 3-5-2, 4-2-3-1. Il modulo **non pesa** sulla simulazione, decide solo i posti.
- Stile (offensivo, equilibrato, difensivo): è l'unica scelta tattica che pesa.
- Per ogni posto escono 3 giocatori del ruolo, uno a scelta. Un rimescolo per draft.
- Multi-ruolo: nessuna penalità e nessuna etichetta "fuori ruolo". Se nel ruolo restano meno di 3 giocatori escono meno carte; i ruoli affini si usano solo se il ruolo è esaurito.
- Lo stesso giocatore può stare in tutte e due le squadre, mai due volte nella stessa.
- Livelli nascosti all'interfaccia. Offuscati in `data.js`: Simone accetta che uno smanettone possa ricavarli.
- Taratura: con medie 2,5 contro 1,8 la più forte vince circa il **65%** (`B = 1.4`, `k = 1.2` in `simMatch`).
- Sfida: andata e ritorno; passa chi vince più partite. Con una vittoria a testa o due pareggi si va ai rigori: 5 rigoristi in ordine, poi a oltranza ripartendo dal primo.
- Modalità: un telefono (passa-e-gioca) e due telefoni nella stessa stanza (codice squadra via QR). Niente server, niente account: Simone ha scartato Supabase e simili perché troppo complicati.

## Vincoli tecnici

- **Determinismo in modalità due telefoni.** La sfida si calcola da seme + i due codici squadra, e i due telefoni devono ottenere lo stesso risultato. Nella simulazione usa sempre `rnd()`, mai `Math.random`. Niente funzioni trascendenti nuove nel percorso con seme senza arrotondarle (`q6`, `q9`). Se cambi la simulazione o il formato del codice, **alza la versione** (primo byte in `encodeTeam` / controllo in `decodeTeam`).
- Il test "due telefoni calcolano la stessa sfida" deve restare verde.
- Sito statico senza build: `index.html`, `style.css`, `app.js`, `data.js`, librerie in `vendor/`. Font da Google Fonts.
- Interfaccia pensata per il telefono (circa 390 px), tema scuro unico.
- Durante l'animazione della partita aggiorna solo punteggio, minuto e la riga nuova del tabellino: ridisegnare tutta la pagina causa lo sfarfallio già corretto una volta. Ai rigori si aggiorna solo `#shootlive`. In entrambi i casi lo slider della velocità non va ridisegnato, altrimenti si interrompe il trascinamento.
- Velocità: 5 livelli (`SPEEDS`), predefinito "Normale" (300 ms per minuto di gioco); il pulsante "Veloce" porta al livello 5, cioè la velocità originale (110 ms). La scelta resta salvata sul telefono.
