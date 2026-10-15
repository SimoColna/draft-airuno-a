#!/usr/bin/env python3
"""Rigenera data.js dalla lista giocatori.

Uso:
  1. Dal Google Sheet: File > Scarica > CSV (colonne Nome, Ruoli, Livello).
  2. python3 tools/genera-dati.py giocatori.csv
  3. Il CSV contiene i livelli in chiaro: NON va committato (è nel .gitignore).

Righe senza ruolo vengono saltate e segnalate. I livelli finiscono in data.js
offuscati, non cifrati: chi apre il codice con un po' di pazienza li ricava.
"""
import base64, csv, json, sys
from pathlib import Path

RUOLI = {"POR", "TD", "DC", "TS", "CC", "ED", "ES", "ATT"}

def main(path):
    giocatori, saltati = [], []
    with open(path, newline="", encoding="utf-8-sig") as f:
        for riga in csv.DictReader(f):
            nome = (riga.get("Nome") or "").strip()
            ruoli = [r.strip().upper() for r in (riga.get("Ruoli") or "").split("/") if r.strip()]
            livello = (riga.get("Livello") or "").strip()
            if not nome:
                continue
            if not ruoli or any(r not in RUOLI for r in ruoli) or livello not in {"1", "2", "3"}:
                saltati.append(nome)
                continue
            giocatori.append((nome, "/".join(ruoli), int(livello)))
    if len(giocatori) > 255:
        sys.exit("Troppi giocatori: il codice squadra ne supporta al massimo 255.")
    nomi = [[n, r] for n, r, _ in giocatori]
    offuscati = bytes(l ^ ((i * 37 + 11) & 255) for i, (_, _, l) in enumerate(giocatori))
    out = Path(__file__).resolve().parent.parent / "data.js"
    out.write_text(
        "/* Generato da tools/genera-dati.py: non modificare a mano. */\n"
        f"const P = {json.dumps(nomi, ensure_ascii=False)};\n"
        f"const K = \"{base64.b64encode(offuscati).decode()}\";\n",
        encoding="utf-8",
    )
    print(f"data.js aggiornato: {len(giocatori)} giocatori.")
    if saltati:
        print("Saltati (ruolo o livello mancante o non valido):", ", ".join(saltati))

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
