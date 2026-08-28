import { formatEuro, descriviPezzi } from '../utils/soldi.js';
import { etichettaTaglio } from '../data/valuta.js';
import { conteggioProgressivo } from '../utils/resto.js';
import { PezziMostrati } from './Tagli.jsx';

/**
 * Il conteggio progressivo: il metodo che si insegna davvero dietro il banco.
 * Non si sottrae, si risale dal conto al ricevuto posando i pezzi uno alla
 * volta e dicendo il totale ad alta voce.
 */
export function ConteggioProgressivo({ conto, ricevuto, pezzi }) {
  const passi = conteggioProgressivo(conto, ricevuto, pezzi);
  if (passi.length === 0) return null;

  return (
    <div className="conteggio">
      <span className="conteggio__cumulato cifra">{formatEuro(conto)}</span>
      {passi.map((passo, i) => (
        <span key={i} className="conteggio__passo">
          <span className="conteggio__freccia">→</span>
          <span className="conteggio__cumulato cifra">{formatEuro(passo.cumulato)}</span>
          <span className="conteggio__aggiunta">({etichettaTaglio(passo.valore)})</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Il pannello dopo ogni risposta. Quando si sbaglia non basta dire "no": si
 * mostra il resto giusto, con quali pezzi darlo e come contarlo al cliente.
 */
export default function Feedback({ esito, transazione, punti = 0, dettaglioPunti = [] }) {
  const tono = esito.corretta && !esito.parziale ? 'ok' : (esito.parziale ? 'avviso' : 'errore');
  const composizione = esito.composizioneDaMostrare ?? transazione.composizioneResto;
  // Nell'esercizio degli spiccioli il conteggio deve partire da quello che il
  // cliente ha davvero in mano dopo la richiesta, non dal pagamento iniziale.
  const ricevuto = esito.ricevutoEffettivo ?? transazione.ricevuto;
  const resto = ricevuto - transazione.conto;

  return (
    <div className={`feedback feedback--${tono}`}>
      <p className="feedback__titolo">
        <span>{esito.corretta ? '✓' : '✗'}</span>
        {esito.titolo}
      </p>

      {esito.messaggio && <p className="feedback__testo">{esito.messaggio}</p>}

      {punti > 0 && (
        <p className="feedback__testo feedback__punti">
          +{punti} punti
          {dettaglioPunti.length > 1 && (
            <span style={{ fontWeight: 400, color: 'inherit', opacity: 0.8 }}>
              {' '}({dettaglioPunti.map(d => `${d.voce} +${d.punti}`).join(', ')})
            </span>
          )}
        </p>
      )}

      {esito.mostraResto && transazione.bastano && (
        <>
          <p className="titolo-sezione" style={{ marginTop: 12 }}>
            Il resto: {formatEuro(resto)} in {descriviPezzi(composizione)}
          </p>
          <PezziMostrati pezzi={composizione} />

          <p className="titolo-sezione" style={{ marginTop: 12 }}>Come contarlo al cliente</p>
          <ConteggioProgressivo conto={transazione.conto} ricevuto={ricevuto} pezzi={composizione} />
        </>
      )}
    </div>
  );
}
