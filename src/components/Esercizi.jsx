import { formatEuro, sommaPezzi, contaPezzi, importoParlato } from '../utils/soldi.js';
import { VALORI_SPICCIOLI, etichettaTaglio } from '../data/valuta.js';
import { tagliInEsaurimento } from '../utils/cassetto.js';
import { frasePerChiedere } from '../utils/spiccioli.js';
import Scontrino from './Scontrino.jsx';
import CassettoTagli, { Vassoio, PezziMostrati } from './Tagli.jsx';

/** La risposta vuota per ciascun esercizio: serve al reset a ogni nuovo cliente. */
export function rispostaIniziale(tipoEsercizio) {
  if (tipoEsercizio === 'chiedi-spiccioli') return { chiesti: {} };
  return { pezzi: {}, nonBasta: false };
}

/** Si può confermare solo quando c'è davvero qualcosa da confermare. */
export function rispostaPronta(tipoEsercizio, risposta) {
  if (tipoEsercizio === 'chiedi-spiccioli') return true; // "non chiedo niente" è una risposta
  return contaPezzi(risposta?.pezzi) > 0 || Boolean(risposta?.nonBasta);
}

export default function Esercizio({ transazione, risposta, onRisposta, cassetto }) {
  const comuni = { transazione, risposta, onRisposta, cassetto };
  if (transazione.tipoEsercizio === 'chiedi-spiccioli') return <ChiediSpiccioli {...comuni} />;
  return <DaiIlResto {...comuni} />;
}

/* ---- Dai il resto ------------------------------------------------------ */
/**
 * L'unico gesto del gioco: prendere dal cassetto i pezzi giusti. Vale per il
 * pagamento con una banconota, per il mucchio da contare e per gli spiccioli
 * aggiunti dal cliente — cambia solo quanto lavoro tocca alla testa prima.
 */
function DaiIlResto({ transazione, risposta, onRisposta, cassetto }) {
  const presi = risposta.pezzi ?? {};
  const totale = sommaPezzi(presi);
  const scarsi = cassetto ? tagliInEsaurimento(cassetto) : [];
  const spiccioli = transazione.tipoEsercizio === 'ricevi-spiccioli';

  const prendi = valore => onRisposta({
    pezzi: { ...presi, [valore]: (presi[valore] ?? 0) + 1 },
    nonBasta: false,
  });
  const rimetti = valore => {
    const quante = (presi[valore] ?? 0) - 1;
    const nuovi = { ...presi };
    if (quante > 0) nuovi[valore] = quante;
    else delete nuovi[valore];
    onRisposta({ pezzi: nuovi, nonBasta: false });
  };

  return (
    <>
      {spiccioli && (
        <p className="battuta">
          «Aspetti, ho {importoParlato(sommaPezzi(transazione.spiccioliAggiunti ?? {}))}.»
        </p>
      )}

      <Scontrino
        conto={transazione.conto}
        ricevuto={transazione.ricevuto}
        pezziPorti={transazione.pezziPorti}
      />

      <div className="scheda">
        <p className="titolo-sezione">Quello che rendi</p>
        <Vassoio pezzi={presi} onTogli={rimetti} vuotoTesto="Tocca i tagli qui sotto" />
        <div className="vassoio__totale">
          <span>Totale reso</span>
          <strong className="cifra">{formatEuro(totale)}</strong>
        </div>
      </div>

      <button
        type="button"
        className={`chip ${risposta.nonBasta ? 'chip--attivo' : ''}`}
        style={{ alignSelf: 'center' }}
        onClick={() => onRisposta({ pezzi: {}, nonBasta: !risposta.nonBasta })}
      >
        Non basta a coprire il conto
      </button>

      <p className="titolo-sezione">Cassetto</p>
      <CassettoTagli presi={presi} cassetto={cassetto} scarsi={scarsi} onTocca={prendi} />
    </>
  );
}

/* ---- Chiedi gli spiccioli ---------------------------------------------- */
function ChiediSpiccioli({ transazione, risposta, onRisposta }) {
  const chiesti = risposta.chiesti ?? {};
  const portafoglio = transazione.portafoglioCliente;
  // Si può chiedere solo quello che il cliente ha davvero in tasca: è la
  // regola che rende l'esercizio una decisione e non un indovinello.
  const disponibili = VALORI_SPICCIOLI.filter(v => (portafoglio[v] ?? 0) > 0);

  const aggiungi = valore => {
    const gia = chiesti[valore] ?? 0;
    if (gia >= (portafoglio[valore] ?? 0)) return;
    onRisposta({ chiesti: { ...chiesti, [valore]: gia + 1 } });
  };
  const togli = valore => {
    const quante = (chiesti[valore] ?? 0) - 1;
    const nuovi = { ...chiesti };
    if (quante > 0) nuovi[valore] = quante;
    else delete nuovi[valore];
    onRisposta({ chiesti: nuovi });
  };

  return (
    <>
      <Scontrino
        conto={transazione.conto}
        ricevuto={transazione.ricevuto}
        pezziPorti={transazione.pezziPorti}
      />

      <div className="scheda">
        <p className="titolo-sezione">Il cliente ha in tasca</p>
        <PezziMostrati pezzi={portafoglio} />
      </div>

      <p className="titolo-sezione">Gli chiedi qualcosa?</p>
      <div className="scheda">
        <Vassoio pezzi={chiesti} onTogli={togli} vuotoTesto="Tocca le monete che vuoi chiedere" />
        <div className="vassoio__totale">
          <span>{frasePerChiedere(chiesti)}</span>
          {contaPezzi(chiesti) > 0 && (
            <strong className="cifra">
              {formatEuro(transazione.ricevuto + sommaPezzi(chiesti) - transazione.conto)} di resto
            </strong>
          )}
        </div>
      </div>

      <div className="chip-riga">
        {disponibili.map(valore => (
          <button
            key={valore}
            type="button"
            className="chip"
            disabled={(chiesti[valore] ?? 0) >= portafoglio[valore]}
            onClick={() => aggiungi(valore)}
          >
            + {etichettaTaglio(valore)}
          </button>
        ))}
      </div>
    </>
  );
}
