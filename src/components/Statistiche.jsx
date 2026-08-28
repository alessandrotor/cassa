import { riassunto } from '../utils/statistiche.js';
import { LIVELLI, LIVELLO_MASSIMO } from '../data/livelli.js';

export default function Statistiche({ statistiche, onAzzera, onEsci }) {
  const righe = riassunto(statistiche);
  const provati = righe.filter(r => r.tentativi > 0);
  const livello = LIVELLI[Math.min(statistiche.livelloRaggiunto, LIVELLO_MASSIMO) - 1];

  return (
    <div className="app">
      <main className="scena">
        <div className="home__intestazione">
          <h1 className="home__titolo">Come stai andando</h1>
          <p className="home__sottotitolo">
            Livello {statistiche.livelloRaggiunto} · {livello.nome}
          </p>
        </div>

        <div className="metriche">
          <div className="metrica">
            <div className="metrica__valore cifra">{statistiche.migliorPunteggio}</div>
            <div className="metrica__etichetta">Record punti</div>
          </div>
          <div className="metrica">
            <div className="metrica__valore cifra">{statistiche.migliorStreak}</div>
            <div className="metrica__etichetta">Serie migliore</div>
          </div>
          <div className="metrica">
            <div className="metrica__valore cifra">{statistiche.partiteGiocate}</div>
            <div className="metrica__etichetta">Sessioni</div>
          </div>
          <div className="metrica">
            <div className="metrica__valore cifra">
              {provati.reduce((somma, r) => somma + r.tentativi, 0)}
            </div>
            <div className="metrica__etichetta">Clienti serviti</div>
          </div>
        </div>

        <div className="scheda">
          <p className="titolo-sezione">Esercizio per esercizio</p>
          {provati.length === 0 && (
            <p className="nota">Non hai ancora giocato: torna qui dopo la prima sessione.</p>
          )}
          {provati.map(riga => (
            <div key={riga.chiave} className="riga-stat">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="riga-stat__nome">{riga.nome}</div>
                <div className="riga-stat__dettaglio">
                  {riga.corrette}/{riga.tentativi} giuste
                  {riga.tempoMediano !== null && ` · ${(riga.tempoMediano / 1000).toFixed(1)}s`}
                  {riga.erroreRicorrente && ` · di solito: ${riga.erroreRicorrente.etichetta.toLowerCase()}`}
                </div>
                <div className="barra-precisione">
                  <div
                    className="barra-precisione__pieno"
                    style={{ width: `${Math.round((riga.precisione ?? 0) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="riga-stat__numero cifra">
                {Math.round((riga.precisione ?? 0) * 100)}%
              </div>
            </div>
          ))}
        </div>

        {provati.length > 0 && (
          <p className="nota">
            Il primo della lista è quello che ti riesce peggio: nel menu puoi allenare
            solo quello.
          </p>
        )}
      </main>

      <div className="azioni">
        <button type="button" className="pulsante pulsante--fantasma" onClick={onAzzera}>
          Azzera
        </button>
        <button type="button" className="pulsante pulsante--principale" onClick={onEsci}>
          Indietro
        </button>
      </div>
    </div>
  );
}
