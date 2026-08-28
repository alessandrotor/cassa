import { VALORI_SPICCIOLI } from '../data/valuta.js';
import { sommaPezzi, contaPezzi, descriviPezzi, importoParlato } from './soldi.js';
import { restoOttimale, creaCalcolatoreResto } from './resto.js';
import { eScarso } from './cassetto.js';

/** Un cliente non tira fuori una manciata di monete: al massimo due o tre pezzi. */
const MAX_PEZZI_RICHIESTI = 3;
/** Chiedere più di 2 € di spiccioli non è una richiesta, è un secondo pagamento. */
const MAX_IMPORTO_RICHIESTO = 200;
/** Quanto "costa" al cassiere chiedere un pezzo, misurato in pezzi resi risparmiati. */
const COSTO_PEZZO_CHIESTO = 0.5;
/** Migliorare di meno di questo non vale la frase in più detta al cliente. */
const GUADAGNO_MINIMO = 1;

/**
 * Tutte le manciate di spiccioli che il cliente potrebbe davvero tirare fuori,
 * dato quello che ha in tasca. Include la manciata vuota (= non chiedo niente).
 */
export function combinazioniSpiccioli(portafoglio, {
  maxPezzi = MAX_PEZZI_RICHIESTI,
  maxImporto = MAX_IMPORTO_RICHIESTO,
} = {}) {
  const risultati = [];
  const valori = VALORI_SPICCIOLI.filter(v => (portafoglio?.[v] ?? 0) > 0 && v <= maxImporto);

  // Ogni ramo aggiunge un taglio nuovo e va avanti: i tagli non si ripetono mai
  // lungo un percorso, quindi ogni manciata nasce una volta sola e non serve
  // deduplicare. L'importo e il numero di pezzi se li porta dietro, cosi' chi
  // le valuta non deve risommarli uno per uno.
  const esplora = (indice, corrente, quanti, importo) => {
    risultati.push({ pezzi: corrente, importo, quanti });
    if (indice >= valori.length || quanti >= maxPezzi) return;
    for (let i = indice; i < valori.length; i++) {
      const valore = valori[i];
      const disponibili = Math.min(portafoglio[valore], maxPezzi - quanti);
      for (let k = 1; k <= disponibili; k++) {
        const nuovoImporto = importo + valore * k;
        if (nuovoImporto > maxImporto) break;
        esplora(i + 1, { ...corrente, [valore]: k }, quanti + k, nuovoImporto);
      }
    }
  };

  esplora(0, {}, 0, 0);
  return risultati;
}

/**
 * Conviene chiedere spiccioli al cliente, e quali?
 *
 * Il caso da manuale: conto 12,10 €, il cliente porge 20 €. Il resto è 7,90 €
 * = 5 pezzi (5 + 2 + 0,50 + 0,20 + 0,20). Chiedendo 10 centesimi il resto
 * diventa 8,00 € = 3 pezzi (5 + 2 + 1). Meno pezzi da contare, meno errori,
 * e le monetine restano in cassa per chi viene dopo.
 *
 * @param {number} conto importo da pagare, in centesimi
 * @param {number} ricevuto contanti già porti dal cliente, in centesimi
 * @param {Object} portafoglio cosa ha in tasca il cliente, { valore: quantita }
 * @param {Object|null} cassetto scorte di cassa; null = illimitato
 */
export function suggerisciSpiccioli(conto, ricevuto, portafoglio, cassetto = null) {
  const restoBase = ricevuto - conto;
  // Un solo calcolatore serve il resto base e tutte le varianti con spiccioli,
  // riusando la stessa tabella nel caso in cui debba costruirla.
  const calcolatore = creaCalcolatoreResto(Math.max(0, restoBase) + MAX_IMPORTO_RICHIESTO, cassetto);
  const base = calcolatore.valuta(restoBase);

  const esito = {
    conviene: false,
    daChiedere: null,
    importoChiesto: 0,
    pezziPrima: base.possibile ? base.totalePezzi : null,
    pezziDopo: base.possibile ? base.totalePezzi : null,
    restoPrima: restoBase,
    restoDopo: restoBase,
    composizionePrima: base.pezzi,
    composizioneDopo: base.pezzi,
    motivo: null,
    alternative: [],
  };

  if (restoBase < 0) return esito;

  const punteggioBase = base.possibile ? base.totalePezzi : Number.POSITIVE_INFINITY;
  let migliore = null;

  for (const { pezzi: aggiunta, importo, quanti: pezziChiesti } of combinazioniSpiccioli(portafoglio)) {
    if (pezziChiesti === 0) continue;
    const nuovoResto = restoBase + importo;
    // Per scegliere basta il numero di pezzi: la composizione la ricaviamo solo
    // dove serve davvero, cioe' quando c'e' un cassetto con tagli da risparmiare.
    const pezziDopo = calcolatore.quantiPezzi(nuovoResto);
    if (pezziDopo < 0) continue;
    const composizione = cassetto ? calcolatore.valuta(nuovoResto).pezzi : null;

    const punteggio = pezziDopo + COSTO_PEZZO_CHIESTO * pezziChiesti;
    const candidato = {
      pezzi: aggiunta,
      importo,
      pezziChiesti,
      restoDopo: nuovoResto,
      pezziDopo,
      composizione,
      punteggio,
      salvaScarsi: composizione ? contaTagliScarsiRisparmiati(base.pezzi, composizione, cassetto) : 0,
    };
    esito.alternative.push(candidato);

    if (!migliore || punteggio < migliore.punteggio ||
        (punteggio === migliore.punteggio && pezziChiesti < migliore.pezziChiesti)) {
      migliore = candidato;
    }
  }

  esito.alternative.sort((a, b) => a.punteggio - b.punteggio);

  if (!migliore) return esito;

  const guadagno = punteggioBase - migliore.punteggio;
  const salvaScarsi = migliore.salvaScarsi > 0;
  // Vale la pena aprire bocca solo se si risparmiano pezzi veri, oppure se
  // così si salva un taglio che in cassa sta finendo.
  if (guadagno >= GUADAGNO_MINIMO || (salvaScarsi && guadagno > 0) || !base.possibile) {
    esito.conviene = true;
    esito.daChiedere = migliore.pezzi;
    esito.importoChiesto = migliore.importo;
    esito.pezziDopo = migliore.pezziDopo;
    esito.restoDopo = migliore.restoDopo;
    esito.composizioneDopo = migliore.composizione ?? calcolatore.valuta(migliore.restoDopo).pezzi;
    esito.motivo = !base.possibile
      ? 'resto-impossibile'
      : (salvaScarsi ? 'salva-taglio-scarso' : 'meno-pezzi');
  }

  return esito;
}

/** Quanti tagli agli sgoccioli evita la composizione alternativa rispetto a quella base. */
function contaTagliScarsiRisparmiati(composizioneBase, composizioneAlternativa, cassetto) {
  if (!cassetto) return 0;
  let risparmiati = 0;
  for (const [valore, quantita] of Object.entries(composizioneBase ?? {})) {
    if (!eScarso(cassetto, Number(valore))) continue;
    const dopo = composizioneAlternativa?.[valore] ?? 0;
    if (dopo < quantita) risparmiati += quantita - dopo;
  }
  return risparmiati;
}

/**
 * Giudica la scelta del giocatore invece di bocciarla e basta: chiedere 60
 * centesimi invece di 10 può comunque migliorare le cose, e va detto.
 *
 * @param {Object|null} scelta i pezzi che il giocatore ha chiesto; null/{} = "non chiedo niente"
 */
export function valutaRichiesta(scelta, conto, ricevuto, portafoglio, cassetto = null) {
  const ottimale = suggerisciSpiccioli(conto, ricevuto, portafoglio, cassetto);
  const pezziChiesti = contaPezzi(scelta);

  if (pezziChiesti === 0) {
    return ottimale.conviene
      ? {
          verdetto: 'occasione-persa',
          messaggio: `Potevi chiedere ${descriviPezzi(ottimale.daChiedere)}: il resto sarebbe passato da ${ottimale.pezziPrima} a ${ottimale.pezziDopo} pezzi.`,
          ottimale,
        }
      : {
          verdetto: 'giusto-non-chiedere',
          messaggio: 'Giusto: qui chiedere spiccioli non semplificava niente.',
          ottimale,
        };
  }

  if (!clientePuoDare(scelta, portafoglio)) {
    return {
      verdetto: 'non-disponibile',
      messaggio: `Il cliente non ha ${descriviPezzi(scelta)} in tasca.`,
      ottimale,
    };
  }

  const importo = sommaPezzi(scelta);
  const composizione = restoOttimale(ricevuto + importo - conto, cassetto);
  if (!composizione.possibile) {
    return {
      verdetto: 'peggiore',
      messaggio: `Chiedendo ${descriviPezzi(scelta)} il resto non è componibile con il cassetto.`,
      ottimale,
    };
  }

  const pezziPrima = ottimale.pezziPrima;
  const pezziDopo = composizione.totalePezzi;

  if (ottimale.conviene && ottimale.importoChiesto === importo && pezziDopo === ottimale.pezziDopo) {
    return {
      verdetto: 'ottima',
      messaggio: `Esatto: il resto passa da ${pezziPrima} a ${pezziDopo} pezzi.`,
      ottimale,
    };
  }
  if (pezziDopo < pezziPrima) {
    return {
      verdetto: 'buona',
      messaggio: `Va bene, migliora (da ${pezziPrima} a ${pezziDopo} pezzi). Il massimo era chiedere ${descriviPezzi(ottimale.daChiedere)}: ${ottimale.pezziDopo} pezzi.`,
      ottimale,
    };
  }
  if (pezziDopo === pezziPrima) {
    return {
      verdetto: 'inutile',
      messaggio: `Il resto resta di ${pezziDopo} pezzi: hai disturbato il cliente per niente.`,
      ottimale,
    };
  }
  return {
    verdetto: 'peggiore',
    messaggio: `Così peggiori: il resto passa da ${pezziPrima} a ${pezziDopo} pezzi.`,
    ottimale,
  };
}

export function clientePuoDare(pezzi, portafoglio) {
  for (const [valore, quantita] of Object.entries(pezzi ?? {})) {
    if (quantita > (portafoglio?.[valore] ?? 0)) return false;
  }
  return true;
}

/** La frase da dire al cliente: «Ha 10 centesimi?» */
export function frasePerChiedere(pezzi) {
  if (contaPezzi(pezzi) === 0) return 'Non chiedo niente';
  return `Ha ${importoParlato(sommaPezzi(pezzi))}?`;
}
