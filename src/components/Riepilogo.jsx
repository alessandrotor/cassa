import { formatEuro } from '../utils/soldi.js';
import { PezziMostrati } from './Tagli.jsx';

/** Riepilogo di fine sessione. Nel Turno diventa una chiusura di cassa vera. */
export default function Riepilogo({ riepilogo, salitoDiLivello, onRigioca, onEsci }) {
  const { punteggio, streakMassima, clienti, corrette, tempi, chiusura } = riepilogo;
  const precisione = clienti > 0 ? Math.round((corrette / clienti) * 100) : 0;
  const tempoMedio = tempi.length > 0
    ? Math.round(tempi.reduce((somma, t) => somma + t, 0) / tempi.length / 100) / 10
    : null;

  return (
    <div className="app">
      <main className="scena">
        <div className="home__intestazione">
          <h1 className="home__titolo">{chiusura ? 'Chiusura cassa' : 'Fine sessione'}</h1>
          <p className="home__sottotitolo">
            {clienti} {clienti === 1 ? 'cliente servito' : 'clienti serviti'}
          </p>
        </div>

        {salitoDiLivello && (
          <div className="feedback feedback--ok">
            <p className="feedback__titolo"><span>★</span> Livello sbloccato</p>
            <p className="feedback__testo">Il prossimo livello ti aspetta nel menu.</p>
          </div>
        )}

        <div className="metriche">
          <div className="metrica">
            <div className="metrica__valore cifra">{punteggio}</div>
            <div className="metrica__etichetta">Punti</div>
          </div>
          <div className="metrica">
            <div className="metrica__valore cifra">{precisione}%</div>
            <div className="metrica__etichetta">Precisione</div>
          </div>
          <div className="metrica">
            <div className="metrica__valore cifra">{streakMassima}</div>
            <div className="metrica__etichetta">Serie migliore</div>
          </div>
          <div className="metrica">
            <div className="metrica__valore cifra">{tempoMedio !== null ? `${tempoMedio}s` : '—'}</div>
            <div className="metrica__etichetta">Tempo medio</div>
          </div>
        </div>

        {chiusura && <ChiusuraCassa chiusura={chiusura} />}
      </main>

      <div className="azioni">
        <button type="button" className="pulsante pulsante--fantasma" onClick={onEsci}>
          Menu
        </button>
        <button type="button" className="pulsante pulsante--principale" onClick={onRigioca}>
          Ancora
        </button>
      </div>
    </div>
  );
}

/**
 * La cassa quadra? La differenza è l'errore che il giocatore ha davvero
 * accumulato rendendo male: è il verdetto più onesto di tutto il gioco.
 */
function ChiusuraCassa({ chiusura }) {
  return (
    <>
      <div className={`feedback feedback--${chiusura.quadra ? 'ok' : 'errore'}`}>
        <p className="feedback__titolo">
          <span>{chiusura.quadra ? '✓' : '✗'}</span>
          {chiusura.quadra ? 'La cassa quadra' : 'La cassa non quadra'}
        </p>
        <p className="feedback__testo">
          Incassato {formatEuro(chiusura.incassoEffettivo)} contro i{' '}
          {formatEuro(chiusura.incassoAtteso)} degli scontrini.
          {!chiusura.quadra && (
            <>
              {' '}Differenza <strong className="cifra">{formatEuro(chiusura.differenza)}</strong>:{' '}
              {chiusura.differenza > 0 ? 'hai reso meno del dovuto.' : 'hai reso più del dovuto.'}
            </>
          )}
        </p>
      </div>

      {chiusura.esauriti.length > 0 && (
        <div className="avviso">
          Tagli finiti durante il turno: {chiusura.esauriti.map(t => t.etichetta).join(', ')}.
          Con questi a zero il resto va composto in un altro modo, o si chiedono spiccioli al cliente.
        </div>
      )}

      <div className="scheda">
        <p className="titolo-sezione">Cassetto a fine turno · {formatEuro(chiusura.totaleFinale)}</p>
        <PezziMostrati pezzi={chiusura.residuo} />
        {chiusura.scarsi.length > 0 && (
          <p className="nota" style={{ marginTop: 8 }}>
            Agli sgoccioli: {chiusura.scarsi.map(t => `${t.etichetta} (${t.quantita})`).join(', ')}.
          </p>
        )}
      </div>
    </>
  );
}
