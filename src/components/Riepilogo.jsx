import { formatEuro } from '../utils/soldi.js';
import { PezziMostrati } from './Tagli.jsx';

/** Riepilogo di fine sessione. Nel Turno diventa una chiusura di cassa vera. */
export default function Riepilogo({ riepilogo, salitoDiLivello, onRigioca, onEsci }) {
  const { punteggio, streakMassima, clienti, corrette, tempi, chiusura, salvaMonete } = riepilogo;
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

        {chiusura && <ChiusuraCassa chiusura={chiusura} salvaMonete={salvaMonete} />}
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
function ChiusuraCassa({ chiusura, salvaMonete }) {
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

      <LascitoMonete monete={chiusura.monete} inPrimoPiano={salvaMonete} />

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

/**
 * Cosa lascia il turno a chi viene dopo.
 *
 * E' il vero conto della modalita' "salva le monete", e vale la pena mostrarlo
 * anche quando non e' l'obiettivo scelto: il cassetto svuotato di monete e' un
 * problema che si scarica sul collega, e chi gioca deve almeno vederlo.
 */
function LascitoMonete({ monete, inPrimoPiano }) {
  if (!monete) return null;

  const guadagnate = monete.differenza > 0;
  const tono = monete.prosciugati.length > 0
    ? 'errore'
    : (monete.differenza >= 0 ? 'ok' : 'avviso');

  const titolo = monete.prosciugati.length > 0
    ? 'Hai lasciato il collega senza qualche taglio'
    : (guadagnate
        ? 'Lasci più monete di quante ne hai trovate'
        : (monete.differenza === 0 ? 'Monete come le hai trovate' : 'Hai consumato monete'));

  return (
    <>
      <div className={`feedback feedback--${tono}`}>
        <p className="feedback__titolo">
          <span>{tono === 'ok' ? '✓' : (tono === 'errore' ? '✗' : '!')}</span>
          {titolo}
        </p>
        <p className="feedback__testo">
          All'apertura c'erano <strong className="cifra">{monete.prima}</strong> monete, alla
          chiusura ce ne sono <strong className="cifra">{monete.dopo}</strong>
          {monete.differenza !== 0 && <> ({monete.differenza > 0 ? '+' : ''}{monete.differenza})</>}.
          {monete.prosciugati.length > 0 && (
            <> Finite del tutto: {monete.prosciugati.map(t => t.etichetta).join(', ')} — con questi
              a zero chi prende il turno dopo non può dare il resto.</>
          )}
          {monete.prosciugati.length === 0 && !inPrimoPiano && monete.differenza < 0 && (
            <> Le banconote rientrano dai clienti tutto il giorno, le monete no.</>
          )}
        </p>
      </div>

      {inPrimoPiano && (
        <div className="scheda">
          <p className="titolo-sezione">Monete, taglio per taglio</p>
          {monete.perTaglio.map(t => (
            <div key={t.valore} className="riga-stat">
              <div className="riga-stat__nome" style={{ flex: 1 }}>{t.etichetta}</div>
              <div className="riga-stat__dettaglio">{t.prima} → {t.dopo}</div>
              <div
                className="riga-stat__numero cifra"
                style={{ minWidth: 48, textAlign: 'right' }}
              >
                <span className={t.differenza < 0 ? 'monete-giu' : (t.differenza > 0 ? 'monete-su' : '')}>
                  {t.differenza > 0 ? '+' : ''}{t.differenza}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
