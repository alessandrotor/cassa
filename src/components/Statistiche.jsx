import { riassunto, recordRapido } from '../utils/statistiche.js';
import { LIVELLI, LIVELLO_MASSIMO } from '../data/livelli.js';
import { RITMI, PREZZI } from '../utils/lampo.js';
import { formatEuro, formatSecondi } from '../utils/soldi.js';

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
                  {riga.tempoMediano !== null && ` · ${formatSecondi(riga.tempoMediano)}`}
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

        <StatisticheRapide statistiche={statistiche} />
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

/** Quante sessioni recenti mostrare: il resto dello storico serve ai record. */
const SESSIONI_MOSTRATE = 5;

/**
 * Il Resto rapido non passa dai livelli: si migliora se sale la precisione a
 * parità di ritmo, e se scendono i soldi sbagliati. Per questo il record è per
 * ritmo e prezzi, e le sessioni recenti mostrano i due totali separati.
 */
function StatisticheRapide({ statistiche }) {
  const storico = statistiche.rapido?.storico ?? [];
  if (storico.length === 0) return null;

  const record = Object.keys(RITMI).flatMap(ritmo => Object.keys(PREZZI).map(prezzi => ({
    ritmo, prezzi, voce: recordRapido(statistiche, ritmo, prezzi),
  }))).filter(r => r.voce);
  const recenti = storico.slice(-SESSIONI_MOSTRATE).reverse();

  return (
    <>
      <div className="scheda">
        <p className="titolo-sezione">Resto rapido · record</p>
        {record.map(({ ritmo, prezzi, voce }) => (
          <div key={`${ritmo}-${prezzi}`} className="riga-stat">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="riga-stat__nome">{RITMI[ritmo].nome} · {PREZZI[prezzi].nome.toLowerCase()}</div>
              <div className="riga-stat__dettaglio">
                {voce.tempoMedio !== null && `${formatSecondi(voce.tempoMedio)} a cliente · `}
                {formatEuro(voce.totaleInPiu)} in più, {formatEuro(voce.totaleInMeno)} in meno
              </div>
            </div>
            <div className="riga-stat__numero cifra">{voce.esatti}/{voce.clienti}</div>
          </div>
        ))}
      </div>

      <div className="scheda">
        <p className="titolo-sezione">Resto rapido · ultime sessioni</p>
        {recenti.map(voce => (
          <div key={voce.data} className="riga-stat">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="riga-stat__nome">
                {new Date(voce.data).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                {' · '}{RITMI[voce.ritmo]?.nome ?? voce.ritmo}
              </div>
              <div className="riga-stat__dettaglio">
                <span className={voce.totaleInPiu > 0 ? 'scarto-su' : ''}>+{formatEuro(voce.totaleInPiu)}</span>
                {' · '}
                <span className={voce.totaleInMeno > 0 ? 'scarto-giu' : ''}>−{formatEuro(voce.totaleInMeno)}</span>
              </div>
            </div>
            <div className="riga-stat__numero cifra">{voce.esatti}/{voce.clienti}</div>
          </div>
        ))}
      </div>
    </>
  );
}
