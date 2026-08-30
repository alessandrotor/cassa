import { formatEuro, descriviPezzi, sommaPezzi, contaPezzi, contaMonete } from './soldi.js';
import { verificaComposizione, restoOttimale } from './resto.js';
import { valutaRichiesta } from './spiccioli.js';
import { obiettivo as obiettivoDi } from '../data/obiettivi.js';

/**
 * Giudica la risposta del giocatore. Funzione pura e senza React: è qui che
 * si decide cosa il gioco insegna, quindi deve essere leggibile e testabile
 * da sola.
 *
 * @param {Object} transazione quella prodotta da generaTransazione
 * @param {Object} risposta { pezzi, dichiarazione } oppure { chiesti } per gli spiccioli
 * @param {Object|null} cassetto scorte disponibili; null = illimitato
 * @param {{ obiettivo?: string }} opzioni quale idea di "resto ben reso" applicare
 * @returns {{ corretta: boolean, errore: string|null, titolo: string,
 *             messaggio: string, mostraResto: boolean, minima: boolean,
 *             composizioneDaMostrare: Object|null, pezziResi: Object|null }}
 */
export function valutaRisposta(transazione, risposta, cassetto = null, opzioni = {}) {
  return transazione.tipoEsercizio === 'chiedi-spiccioli'
    ? valutaSpiccioli(transazione, risposta, cassetto, opzioni)
    : valutaResto(transazione, risposta, cassetto, opzioni);
}

/**
 * Il resto reso coi pezzi del cassetto. Conta la cifra; i pezzi minimi sono un
 * bonus. Qui vive anche il caso in cui il cliente non ha dato abbastanza: se ne
 * accorge solo chi ha contato davvero il mucchio, quindi e' parte dello stesso
 * giudizio e non di un esercizio a parte.
 */
function valutaResto(transazione, risposta, cassetto, opzioni = {}) {
  const regola = obiettivoDi(opzioni.obiettivo);
  const pezzi = risposta?.pezzi ?? {};
  const dichiarazione = risposta?.dichiarazione ?? null;

  if (dichiarazione === 'non-basta') {
    return transazione.bastano
      ? esito({
          corretta: false,
          errore: 'cifra-sbagliata',
          titolo: 'I soldi bastavano',
          messaggio: transazione.resto === 0
            ? `Ti ha dato ${formatEuro(transazione.ricevuto)}, esattamente il conto: bastavano.`
            : `Ti ha dato ${formatEuro(transazione.ricevuto)} per un conto di ${formatEuro(transazione.conto)}: il resto era ${formatEuro(transazione.resto)}.`,
          mostraResto: transazione.resto > 0,
        })
      : esito({
          corretta: true,
          titolo: 'Giusto, non basta',
          messaggio: `Ti ha dato ${formatEuro(transazione.ricevuto)}: mancano ${formatEuro(transazione.mancano)}, vanno chiesti al cliente.`,
          mostraResto: false,
        });
  }

  if (dichiarazione === 'senza-resto') {
    if (!transazione.bastano) {
      return esito({
        corretta: false,
        errore: 'pagamento-insufficiente',
        titolo: 'Non ha pagato giusto',
        messaggio: `Ti ha dato ${formatEuro(transazione.ricevuto)} per un conto di ${formatEuro(transazione.conto)}: mancano ${formatEuro(transazione.mancano)}.`,
        mostraResto: false,
      });
    }
    return transazione.resto === 0
      ? esito({
          corretta: true,
          titolo: 'Pagamento esatto',
          messaggio: `${formatEuro(transazione.ricevuto)} tondi: non c'è niente da rendere.`,
          mostraResto: false,
        })
      : esito({
          corretta: false,
          errore: 'cifra-sbagliata',
          titolo: "Un resto c'era",
          messaggio: `Ti ha dato ${formatEuro(transazione.ricevuto)} per ${formatEuro(transazione.conto)}: dovevi rendere ${formatEuro(transazione.resto)}.`,
        });
  }

  if (!transazione.bastano) {
    return esito({
      corretta: false,
      errore: 'pagamento-insufficiente',
      titolo: "Non c'era niente da rendere",
      messaggio: `Sul bancone c'erano solo ${formatEuro(transazione.ricevuto)} per un conto di ${formatEuro(transazione.conto)}: mancavano ${formatEuro(transazione.mancano)}.`,
      mostraResto: false,
      pezziResi: pezzi,
    });
  }

  // Da qui in giù il cliente ha coperto il conto e il giocatore ha preso
  // qualcosa dal cassetto (senza pezzi e senza dichiarazione non si conferma).
  if (transazione.resto === 0) {
    return esito({
      corretta: false,
      errore: 'cifra-sbagliata',
      titolo: 'Il cliente aveva pagato giusto',
      messaggio: `${formatEuro(transazione.ricevuto)} per un conto di ${formatEuro(transazione.conto)}: non c'era resto, e tu hai reso ${formatEuro(sommaPezzi(pezzi))}.`,
      mostraResto: false,
      pezziResi: pezzi,
    });
  }

  const verifica = verificaComposizione(pezzi, transazione.resto, cassetto);

  if (contaPezzi(pezzi) === 0) {
    return esito({
      corretta: false,
      errore: 'cifra-sbagliata',
      titolo: 'Non hai reso niente',
      messaggio: `Il resto era ${formatEuro(transazione.resto)}.`,
      pezziResi: pezzi,
    });
  }

  if (verifica.eccedeScorte) {
    return esito({
      corretta: false,
      errore: 'scorte-insufficienti',
      titolo: 'Tagli che non hai',
      messaggio: 'Nel cassetto non ce ne sono così tanti: guarda le scorte sotto ogni taglio.',
      pezziResi: pezzi,
    });
  }

  if (!verifica.esatta) {
    const scarto = verifica.differenza;
    return esito({
      corretta: false,
      errore: 'cifra-sbagliata',
      titolo: scarto > 0 ? 'Hai dato troppo' : 'Hai dato troppo poco',
      messaggio: `Hai composto ${formatEuro(verifica.totale)} invece di ${formatEuro(transazione.resto)}: ${formatEuro(Math.abs(scarto))} di ${scarto > 0 ? 'troppo' : 'meno'}.`,
      pezziResi: pezzi,
    });
  }

  if (!verifica.minima) {
    // Comporre col minimo dei pezzi cede anche il minimo delle monete, quindi
    // il verdetto è lo stesso per i due obiettivi: cambia solo di cosa parla,
    // perché a chi sta salvando le monete «tre pezzi in più» non dice niente.
    const monetePerse = contaMonete(pezzi) - contaMonete(verifica.pezziOttimali);
    const perMonete = regola.misura === 'monete' && monetePerse > 0;
    return esito({
      corretta: true,
      parziale: true,
      errore: perMonete ? 'monete-sprecate' : 'composizione-non-minima',
      minima: false,
      etichettaBonus: regola.bonus,
      titolo: perMonete ? 'Cifra giusta, troppe monete' : 'Cifra giusta, troppi pezzi',
      messaggio: perMonete
        ? `Hai ceduto ${contaMonete(pezzi)} monete invece di ${contaMonete(verifica.pezziOttimali)}: bastava ${descriviPezzi(verifica.pezziOttimali)}.`
        : `Hai usato ${verifica.pezziUsati} pezzi: bastavano ${verifica.totalePezziOttimali} (${descriviPezzi(verifica.pezziOttimali)}).`,
      composizioneDaMostrare: verifica.pezziOttimali,
      pezziResi: pezzi,
    });
  }

  const monete = contaMonete(pezzi);
  return esito({
    corretta: true,
    minima: true,
    etichettaBonus: regola.bonus,
    titolo: 'Perfetto',
    messaggio: regola.misura === 'monete'
      ? (monete === 0
          ? `${formatEuro(transazione.resto)} tutto in banconote: in cassa non è uscita una moneta.`
          : `${formatEuro(transazione.resto)} cedendo solo ${monete === 1 ? 'una moneta' : `${monete} monete`}, il minimo possibile.`)
      : `${formatEuro(transazione.resto)} con il minimo dei pezzi.`,
    composizioneDaMostrare: pezzi,
    pezziResi: pezzi,
  });
}

/** 'chiedi-spiccioli': conviene chiedere una moneta, e quale? */
function valutaSpiccioli(transazione, risposta, cassetto, opzioni = {}) {
  const regola = obiettivoDi(opzioni.obiettivo);
  const chiesti = risposta?.chiesti ?? {};
  const giudizio = valutaRichiesta(
    chiesti,
    transazione.conto,
    transazione.ricevuto,
    transazione.portafoglioCliente,
    cassetto,
    opzioni,
  );

  const corretta = giudizio.verdetto === 'ottima' || giudizio.verdetto === 'giusto-non-chiedere';
  const parziale = giudizio.verdetto === 'buona';
  const ricevutoFinale = transazione.ricevuto + sommaPezzi(chiesti);
  const composizione = restoOttimale(ricevutoFinale - transazione.conto, cassetto);

  const titoli = {
    ottima: 'Richiesta perfetta',
    'giusto-non-chiedere': 'Giusto non chiedere',
    buona: 'Buona, ma si poteva fare meglio',
    'occasione-persa': 'Occasione persa',
    inutile: 'Richiesta inutile',
    peggiore: 'Così peggiori il resto',
    'non-disponibile': 'Il cliente non ce li ha',
  };

  return esito({
    corretta,
    parziale,
    minima: giudizio.verdetto === 'ottima',
    etichettaBonus: regola.misura === 'monete' ? 'Monete salvate' : 'Richiesta azzeccata',
    errore: corretta ? null : 'spicciolo-sbagliato',
    titolo: titoli[giudizio.verdetto] ?? 'Vediamo',
    messaggio: giudizio.messaggio,
    // Mostriamo il resto che sarebbe uscito dalla scelta del giocatore: è il
    // suo gesto che deve vedere finito, non quello del manuale.
    composizioneDaMostrare: composizione.possibile ? composizione.pezzi : transazione.composizioneResto,
    ricevutoEffettivo: composizione.possibile ? ricevutoFinale : transazione.ricevuto,
  });
}

function esito({
  corretta,
  parziale = false,
  errore = null,
  titolo,
  messaggio = '',
  mostraResto = true,
  minima = false,
  etichettaBonus = 'Meno pezzi possibile',
  composizioneDaMostrare = null,
  pezziResi = null,
  ricevutoEffettivo = null,
}) {
  return {
    corretta, parziale, errore, titolo, messaggio, mostraResto,
    minima, etichettaBonus, composizioneDaMostrare, pezziResi, ricevutoEffettivo,
  };
}
