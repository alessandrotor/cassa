# Cassa

Gioco di allenamento per chi sta in cassa: prendere i soldi giusti e dare il resto
giusto, in fretta. Web app installabile, pensata per essere usata dal telefono.

## Come si gioca

Due modalità:

- **Allenamento** — sette livelli che introducono una difficoltà alla volta, con
  timer, punteggio e serie. Si può allenare un singolo esercizio alla volta.
- **Turno di cassa** — quindici clienti di fila con un fondo cassa vero. I tagli
  finiscono davvero, e alla fine la cassa deve quadrare: la differenza è l'errore
  che hai accumulato rendendo male.

Non si digita mai una cifra: si risponde **prendendo i soldi dal cassetto**,
perché in cassa il gesto è quello, e le dita vanno allenate insieme alla testa.

Quattro esercizi:

| Esercizio | Cosa alleni |
|---|---|
| Dai il resto | Il calcolo e la manualità: quali pezzi prendere |
| Conta e rendi | Il totale del mucchio non te lo diciamo: contalo tu, e accorgiti se non basta |
| Il cliente aggiunge spiccioli | Non farti confondere da 20,10 € per un conto di 12,10 € |
| Chiedi gli spiccioli | Decidere *se* e *cosa* chiedere per semplificare il resto |

Il totale ricevuto è scritto in cifre solo quando il cliente paga con un pezzo
solo. Appena i pezzi sono più di uno sparisce: contare il mucchio è metà del
mestiere, e scriverlo toglierebbe proprio la parte da allenare. Che tu l'abbia
contato bene si vede dal resto che rendi.

Sull'ultimo, il caso da manuale: conto **12,10 €**, il cliente porge **20 €**. Il
resto è 7,90 € e sono cinque pezzi (5 + 2 + 0,50 + 0,20 + 0,20). Se chiedi *«Ha 10
centesimi?»* il resto diventa **8,00 €**, cioè tre pezzi netti. Meno pezzi da
contare, meno errori, e le monetine restano in cassa per chi viene dopo.

Quando sbagli il gioco non dice solo «no»: mostra il resto giusto, con quali pezzi
darlo, e come contarlo al cliente col conteggio progressivo — quello che si insegna
davvero dietro il banco: `12,40 € → 12,50 → 13,00 → 15,00 → 20,00`.

## Come si sale di livello

Il **punteggio non c'entra**: serve solo a misurarsi con sé stessi. Per il livello
successivo servono **10 risposte giuste**, ma cosa conta come "10" dipende dalla
difficoltà scelta — che cambia solo questo, non gli esercizi né i tempi:

| | Regola | Cosa succede a un avvio storto |
|---|---|---|
| **Facile** | 10 risposte giuste nelle ultime 15 | Gli errori escono dalla finestra: conta come stai andando adesso |
| **Difficile** | 10 risposte giuste con l'80% di precisione su tutto il livello | Ogni errore pesa fino alla fine |

La differenza si vede su un caso concreto: tre errori all'inizio, poi sette
risposte giuste. In facile ne mancano **3**; in difficile ne mancano **5**, perché
7 su 10 fa 70% e per arrivare all'80% servono altre giuste oltre alle 10.

È la parte che si fraintende, quindi l'app mostra un solo numero — *«ancora N
risposte giuste»* — calcolato simulando risposte giuste finché la regola in vigore
non è soddisfatta. Quel numero è insieme sufficiente e minimo, ed è
`test/avanzamento.test.js` a garantirlo per entrambe le regole su ogni
combinazione di giuste e sbagliate: se l'app dice 3, dopo tre risposte giuste si
sale, e dopo due no.

## Sviluppo

```bash
npm install
npm run dev        # server di sviluppo
npm test           # test dei moduli puri
npm run build      # build di produzione in dist/
npm run preview    # serve la build (utile per provare il service worker)
```

Per provarlo dal telefono sulla rete locale: `npm run dev -- --host`.

## Come è fatto

Vite + React, senza dipendenze runtime oltre a React. Tutto lo stato sta in
`localStorage`; non c'è nessun backend e nessun dato lascia il dispositivo.

```
src/
  data/valuta.js       tagli euro e fondo cassa iniziale
  data/livelli.js      la progressione dei sette livelli
  utils/soldi.js       aritmetica in centesimi e formati (compatto e parlato)
  utils/resto.js       DP del resto ottimale + conteggio progressivo
  utils/spiccioli.js   se e cosa conviene chiedere al cliente
  utils/cassetto.js    scorte, prelievi e chiusura di cassa
  utils/generatore.js  costruisce le transazioni giocabili
  utils/valutazione.js giudica la risposta: è qui che si decide cosa il gioco insegna
  components/          le schermate
```

Due scelte che vale la pena conoscere prima di metterci mano:

**Tutti gli importi sono interi in centesimi.** Mai `float`: in un gioco che
valuta il resto, un centesimo di deriva significa insegnare la cosa sbagliata.

**Il resto si calcola col greedy, con la DP come rete.** L'euro è un sistema
canonico, quindi il greedy è ottimo — e resta ottimo anche a scorte limitate, *se*
arriva in fondo senza sforare le quantità: il numero di pezzi che usa è già il
minimo assoluto. Quando invece si arena serve la programmazione dinamica, perché
il greedy da solo mentirebbe: con una moneta da 50 c e tre da 20 c dichiara
impossibile fare 60 c, mentre la risposta è `3 × 20 c`.

Provare prima il greedy fa la differenza fra 1,4 ms e 0,005 ms per resto — su un
telefono, fra un gioco che scatta e uno che arranca. A tenere onesta la
scorciatoia è `test/resto.test.js`, che confronta le due strade su ogni importo,
cassetti poveri compresi.
