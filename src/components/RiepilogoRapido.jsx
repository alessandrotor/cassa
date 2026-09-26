import { formatEuro, formatSecondi } from '../utils/soldi.js';
import { RITMI, ritmo as ritmoDi, PREZZI } from '../utils/lampo.js';

/** Sopra questa precisione il ritmo è diventato comodo: tanto vale stringere. */
const SOGLIA_RITMO_SUCCESSIVO = 0.9;

/**
 * La fine di una sessione di Resto rapido, fatta come una chiusura di cassa:
 * quante volte hai reso giusto, e quanti soldi sono andati via sbagliando in
 * un senso e nell'altro. I due totali restano separati: 2 € in più a un cliente
 * e 2 € in meno a un altro fanno zero sul saldo, ma sono due errori.
 */
export default function RiepilogoRapido({ riepilogo, recordPrecedente, onRigioca, onEsci }) {
  const { ritmo, prezzi, esiti, riassunto } = riepilogo;
  const {
    clienti, esatti, precisione, volteInPiu, volteInMeno,
    totaleInPiu, totaleInMeno, saldoCassa, scaduti, tempoMedio,
  } = riassunto;

  const percentuale = precisione === null ? 0 : Math.round(precisione * 100);
  const sbagliati = esiti.filter(e => !e.esatto);
  const nuovoRecord = recordPrecedente === null
    || esatti / clienti > recordPrecedente.esatti / recordPrecedente.clienti;

  const chiavi = Object.keys(RITMI);
  const prossimoRitmo = chiavi[chiavi.indexOf(ritmo) + 1] ?? null;

  return (
    <div className="app">
      <main className="scena">
        <div className="home__intestazione">
          <h1 className="home__titolo">Resto rapido</h1>
          <p className="home__sottotitolo">
            Ritmo {ritmoDi(ritmo).nome.toLowerCase()} · prezzi {PREZZI[prezzi]?.nome.toLowerCase()}
          </p>
        </div>

        <div className={`feedback feedback--${sbagliati.length === 0 ? 'ok' : (percentuale >= 70 ? 'avviso' : 'errore')}`}>
          <p className="feedback__titolo cifra">
            {esatti} su {clienti} resti giusti
          </p>
          <p className="feedback__testo">
            {sbagliati.length === 0
              ? 'Nessun errore: la cassa quadra al centesimo.'
              : `Hai sbagliato ${sbagliati.length} ${sbagliati.length === 1 ? 'resto' : 'resti'}${scaduti > 0 ? `, ${scaduti} per tempo scaduto` : ''}.`}
            {recordPrecedente && (nuovoRecord
              ? ' Nuovo record per questo ritmo.'
              : ` Il tuo record qui è ${recordPrecedente.esatti} su ${recordPrecedente.clienti}.`)}
          </p>
        </div>

        <div className="metriche">
          <div className="metrica">
            <div className={`metrica__valore cifra ${totaleInPiu > 0 ? 'scarto-su' : ''}`}>
              {formatEuro(totaleInPiu)}
            </div>
            <div className="metrica__etichetta">
              Dato in più{volteInPiu > 0 ? ` · ${volteInPiu} ${volteInPiu === 1 ? 'volta' : 'volte'}` : ''}
            </div>
          </div>
          <div className="metrica">
            <div className={`metrica__valore cifra ${totaleInMeno > 0 ? 'scarto-giu' : ''}`}>
              {formatEuro(totaleInMeno)}
            </div>
            <div className="metrica__etichetta">
              Dato in meno{volteInMeno > 0 ? ` · ${volteInMeno} ${volteInMeno === 1 ? 'volta' : 'volte'}` : ''}
            </div>
          </div>
          <div className="metrica">
            <div className="metrica__valore cifra">{percentuale}%</div>
            <div className="metrica__etichetta">Precisione</div>
          </div>
          <div className="metrica">
            <div className="metrica__valore cifra">
              {tempoMedio === null ? '—' : formatSecondi(tempoMedio)}
            </div>
            <div className="metrica__etichetta">Tempo medio</div>
          </div>
        </div>

        {sbagliati.length > 0 && (
          <p className="nota">
            {saldoCassa === 0
              ? 'Gli errori in più e in meno si compensano, ma restano errori: a due clienti diversi.'
              : saldoCassa < 0
                ? <>In una cassa vera a fine turno mancherebbero <strong className="cifra">{formatEuro(-saldoCassa)}</strong>.</>
                : <>In una cassa vera avanzerebbero <strong className="cifra">{formatEuro(saldoCassa)}</strong>: soldi tolti ai clienti.</>}
          </p>
        )}

        {sbagliati.length > 0 && (
          <div className="scheda">
            <p className="titolo-sezione">Dove hai sbagliato</p>
            {sbagliati.map((e, i) => (
              <div key={i} className="riga-stat">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="riga-stat__nome cifra">
                    {formatEuro(e.ricevuto)} − {formatEuro(e.conto)} = {formatEuro(e.resto)}
                  </div>
                  <div className="riga-stat__dettaglio">
                    {e.scaduto ? 'tempo scaduto · ' : ''}hai dato {formatEuro(e.dato)}
                  </div>
                </div>
                <div className={`riga-stat__numero cifra ${e.differenza > 0 ? 'scarto-su' : 'scarto-giu'}`}>
                  {e.differenza > 0 ? '+' : '−'}{formatEuro(Math.abs(e.differenza))}
                </div>
              </div>
            ))}
          </div>
        )}

        {precisione !== null && precisione >= SOGLIA_RITMO_SUCCESSIVO && prossimoRitmo && (
          <p className="nota">
            Sopra il {Math.round(SOGLIA_RITMO_SUCCESSIVO * 100)}% questo ritmo ti sta stretto:
            prova il ritmo {RITMI[prossimoRitmo].nome.toLowerCase()}.
          </p>
        )}
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
