import { VALORI_SPICCIOLI } from '../data/valuta.js';
import { sommaPezzi, contaPezzi, contaMonete, descriviPezzi, importoParlato } from './soldi.js';
import { restoOttimale, creaCalcolatoreResto } from './resto.js';
import { eScarso } from './cassetto.js';
import { obiettivo as obiettivoDi } from '../data/obiettivi.js';

/** Un cliente non tira fuori una manciata di monete: al massimo due o tre pezzi. */
const MAX_PEZZI_RICHIESTI = 3;
/** Chiedere più di 2 € di spiccioli non è una richiesta, è un secondo pagamento. */
const MAX_IMPORTO_RICHIESTO = 200;

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
 * Con l'obiettivo 'salva-monete' cambia la misura: non si contano i pezzi resi
 * ma le monete cedute, e la mossa giusta diventa portare il resto a una cifra
 * pagabile in banconote. Su resto 14,55 € si chiedono 45 centesimi, non 50: il
 * resto diventa 15,00 € e non esce nemmeno una moneta.
 *
 * @param {number} conto importo da pagare, in centesimi
 * @param {number} ricevuto contanti già porti dal cliente, in centesimi
 * @param {Object} portafoglio cosa ha in tasca il cliente, { valore: quantita }
 * @param {Object|null} cassetto scorte di cassa; null = illimitato
 * @param {{ obiettivo?: string }} opzioni quale idea di "resto ben reso" applicare
 */
export function suggerisciSpiccioli(conto, ricevuto, portafoglio, cassetto = null, opzioni = {}) {
  const regola = obiettivoDi(opzioni.obiettivo);
  const misura = regola.misura === 'monete' ? contaMonete : contaPezzi;
  const restoBase = ricevuto - conto;
  // Un solo calcolatore serve il resto base e tutte le varianti con spiccioli,
  // riusando la stessa tabella nel caso in cui debba costruirla.
  const calcolatore = creaCalcolatoreResto(Math.max(0, restoBase) + MAX_IMPORTO_RICHIESTO, cassetto);
  const base = calcolatore.valuta(restoBase);

  const esito = {
    obiettivo: regola.chiave,
    conviene: false,
    daChiedere: null,
    importoChiesto: 0,
    pezziPrima: base.possibile ? base.totalePezzi : null,
    pezziDopo: base.possibile ? base.totalePezzi : null,
    monetePrima: base.possibile ? contaMonete(base.pezzi) : null,
    moneteDopo: base.possibile ? contaMonete(base.pezzi) : null,
    restoPrima: restoBase,
    restoDopo: restoBase,
    composizionePrima: base.pezzi,
    composizioneDopo: base.pezzi,
    motivo: null,
    alternative: [],
  };

  if (restoBase < 0) return esito;

  const costoBase = base.possibile ? misura(base.pezzi) : Number.POSITIVE_INFINITY;
  let migliore = null;

  for (const { pezzi: aggiunta, importo, quanti: pezziChiesti } of combinazioniSpiccioli(portafoglio)) {
    if (pezziChiesti === 0) continue;
    const nuovoResto = restoBase + importo;
    const dopo = calcolatore.valuta(nuovoResto);
    if (!dopo.possibile) continue;

    const costo = misura(dopo.pezzi) + regola.costoPezzoChiesto * pezziChiesti;
    const candidato = {
      pezzi: aggiunta,
      importo,
      pezziChiesti,
      restoDopo: nuovoResto,
      pezziDopo: dopo.totalePezzi,
      moneteDopo: contaMonete(dopo.pezzi),
      composizione: dopo.pezzi,
      punteggio: costo,
      salvaScarsi: contaTagliScarsiRisparmiati(base.pezzi, dopo.pezzi, cassetto),
    };
    esito.alternative.push(candidato);

    if (!migliore || costo < migliore.punteggio ||
        (costo === migliore.punteggio && pezziChiesti < migliore.pezziChiesti)) {
      migliore = candidato;
    }
  }

  esito.alternative.sort((a, b) => a.punteggio - b.punteggio);

  if (!migliore) return esito;

  const guadagno = costoBase - migliore.punteggio;
  const salvaScarsi = migliore.salvaScarsi > 0;
  // Vale la pena aprire bocca solo se si risparmia qualcosa di vero, oppure se
  // così si salva un taglio che in cassa sta finendo.
  if (guadagno >= regola.guadagnoMinimo || (salvaScarsi && guadagno > 0) || !base.possibile) {
    esito.conviene = true;
    esito.daChiedere = migliore.pezzi;
    esito.importoChiesto = migliore.importo;
    esito.pezziDopo = migliore.pezziDopo;
    esito.moneteDopo = migliore.moneteDopo;
    esito.restoDopo = migliore.restoDopo;
    esito.composizioneDopo = migliore.composizione;
    esito.motivo = !base.possibile
      ? 'resto-impossibile'
      : (salvaScarsi ? 'salva-taglio-scarso' : regola.chiave);
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
 * I messaggi parlano nell'unità dell'obiettivo: pezzi resi o monete cedute.
 * Dire «da 5 a 3 pezzi» a chi sta cercando di salvare le monete non spiega
 * niente di quello che gli interessa.
 *
 * @param {Object|null} scelta i pezzi che il giocatore ha chiesto; null/{} = "non chiedo niente"
 */
export function valutaRichiesta(scelta, conto, ricevuto, portafoglio, cassetto = null, opzioni = {}) {
  const regola = obiettivoDi(opzioni.obiettivo);
  const misura = regola.misura === 'monete' ? contaMonete : contaPezzi;
  const unita = quanti => `${quanti} ${regola.misura === 'monete'
    ? (quanti === 1 ? 'moneta' : 'monete')
    : (quanti === 1 ? 'pezzo' : 'pezzi')}`;

  const ottimale = suggerisciSpiccioli(conto, ricevuto, portafoglio, cassetto, opzioni);
  const pezziChiesti = contaPezzi(scelta);
  const prima = misura(ottimale.composizionePrima);
  const alMeglio = ottimale.conviene ? misura(ottimale.composizioneDopo) : prima;

  if (pezziChiesti === 0) {
    return ottimale.conviene
      ? {
          verdetto: 'occasione-persa',
          messaggio: `Potevi chiedere ${descriviPezzi(ottimale.daChiedere)}: il resto sarebbe passato da ${unita(prima)} a ${unita(alMeglio)}.`,
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

  const dopo = misura(composizione.pezzi);

  if (ottimale.conviene && ottimale.importoChiesto === importo && dopo === alMeglio) {
    return {
      verdetto: 'ottima',
      messaggio: `Esatto: il resto passa da ${unita(prima)} a ${unita(dopo)}.`,
      ottimale,
    };
  }
  if (dopo < prima) {
    return {
      verdetto: 'buona',
      messaggio: `Va bene, migliora (da ${unita(prima)} a ${unita(dopo)}). Il massimo era chiedere ${descriviPezzi(ottimale.daChiedere)}: ${unita(alMeglio)}.`,
      ottimale,
    };
  }
  if (dopo === prima) {
    return {
      verdetto: 'inutile',
      messaggio: `Il resto resta di ${unita(dopo)}: hai disturbato il cliente per niente.`,
      ottimale,
    };
  }
  return {
    verdetto: 'peggiore',
    messaggio: `Così peggiori: il resto passa da ${unita(prima)} a ${unita(dopo)}.`,
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
