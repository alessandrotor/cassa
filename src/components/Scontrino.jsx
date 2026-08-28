import { formatEuro, contaPezzi } from '../utils/soldi.js';
import { PezziMostrati } from './Tagli.jsx';

/**
 * Il conto e i contanti che il cliente ha posato sul bancone.
 *
 * Il totale ricevuto si scrive solo quando il cliente paga con un pezzo solo,
 * dove sarebbe comunque sotto gli occhi. Appena i pezzi sono più di uno il
 * totale sparisce: contare il mucchio è metà del mestiere, e dirlo in cifre
 * toglierebbe proprio la parte da allenare.
 */
export default function Scontrino({ conto, pezziPorti, ricevuto }) {
  const pezzi = contaPezzi(pezziPorti);
  const daContare = pezzi > 1;

  return (
    <div className="scheda">
      <div className="scontrino__riga">
        <span>Conto</span>
        <span className="cifra scontrino__importo-riga">{formatEuro(conto)}</span>
      </div>
      <div className="scontrino__riga">
        <span>{daContare ? 'Il cliente posa sul bancone' : 'Il cliente ti dà'}</span>
        {!daContare && <span className="cifra scontrino__importo-riga">{formatEuro(ricevuto)}</span>}
      </div>
      <div style={{ marginTop: 8 }}>
        <PezziMostrati pezzi={pezziPorti} />
      </div>
    </div>
  );
}
