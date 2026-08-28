import { VALORI_RESTO, etichettaTaglio, eBanconota } from '../data/valuta.js';
import { elencaPezzi } from '../utils/soldi.js';

/**
 * Un singolo taglio: banconota rettangolare, moneta rotonda. La forma e il
 * colore ricalcano quelli veri, perché in cassa si riconoscono a colpo d'occhio
 * prima ancora di leggere la cifra.
 */
export function Taglio({ valore, quantita = 0, scorta = null, scarso = false, disabilitato = false, onTocca }) {
  const banconota = eBanconota(valore);
  return (
    <button
      type="button"
      className={`taglio ${banconota ? 'taglio--banconota' : 'taglio--moneta'} ${scarso ? 'taglio--scarso' : ''}`}
      data-valore={valore}
      disabled={disabilitato}
      onClick={() => onTocca?.(valore)}
      aria-label={`${etichettaTaglio(valore)}${quantita > 0 ? `, ne hai preso ${quantita}` : ''}`}
    >
      {etichettaTaglio(valore)}
      {quantita > 0 && <span className="taglio__contatore">{quantita}</span>}
      {scorta !== null && <span className="taglio__scorta">{scorta}</span>}
    </button>
  );
}

/**
 * Il cassetto: si tocca un taglio per prenderlo. Se c'è un cassetto vero
 * (modalità Turno) i tagli finiti si spengono e quelli agli sgoccioli si
 * segnalano, perché è quella l'informazione che cambia le decisioni.
 */
export default function CassettoTagli({ presi = {}, cassetto = null, scarsi = [], onTocca, valori = VALORI_RESTO }) {
  return (
    <div className="griglia-tagli">
      {valori.map(valore => {
        const disponibili = cassetto ? (cassetto[valore] ?? 0) - (presi[valore] ?? 0) : null;
        return (
          <Taglio
            key={valore}
            valore={valore}
            quantita={presi[valore] ?? 0}
            scorta={cassetto ? disponibili : null}
            scarso={scarsi.includes(valore)}
            disabilitato={cassetto ? disponibili <= 0 : false}
            onTocca={onTocca}
          />
        );
      })}
    </div>
  );
}

/** I pezzi già scelti, in fila: si tocca un gettone per rimetterlo nel cassetto. */
export function Vassoio({ pezzi, onTogli, vuotoTesto = 'Tocca i tagli qui sotto' }) {
  const voci = elencaPezzi(pezzi);
  return (
    <div className="vassoio">
      {voci.length === 0 && <span className="vassoio__vuoto">{vuotoTesto}</span>}
      {voci.flatMap(voce =>
        Array.from({ length: voce.quantita }, (_, i) => (
          <button
            key={`${voce.valore}-${i}`}
            type="button"
            className={`gettone ${eBanconota(voce.valore) ? '' : 'gettone--moneta'}`}
            data-valore={voce.valore}
            onClick={() => onTogli?.(voce.valore)}
            aria-label={`Rimetti ${voce.etichetta} nel cassetto`}
          >
            {voce.etichetta}
          </button>
        )),
      )}
    </div>
  );
}

/** Gli stessi gettoni ma non toccabili: i contanti posati dal cliente. */
export function PezziMostrati({ pezzi }) {
  const voci = elencaPezzi(pezzi);
  return (
    <div className="vassoio">
      {voci.length === 0 && <span className="vassoio__vuoto">Niente</span>}
      {voci.flatMap(voce =>
        Array.from({ length: voce.quantita }, (_, i) => (
          <span
            key={`${voce.valore}-${i}`}
            className={`gettone ${eBanconota(voce.valore) ? '' : 'gettone--moneta'}`}
            data-valore={voce.valore}
          >
            {voce.etichetta}
          </span>
        )),
      )}
    </div>
  );
}
