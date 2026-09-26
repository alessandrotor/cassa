import { useState } from 'react';

import useLocalStorage from '../hooks/useLocalStorage.js';
import { LIVELLI, LIVELLO_MASSIMO, ESERCIZI, DIFFICOLTA } from '../data/livelli.js';
import { OBIETTIVI, OBIETTIVO_PREDEFINITO } from '../data/obiettivi.js';
import { progressoLivello, regolaAvanzamento } from '../utils/statistiche.js';
import { CLIENTI_PER_TURNO } from './Partita.jsx';
import {
  RITMI, RITMO_PREDEFINITO, PREZZI, PREZZI_PREDEFINITI, CLIENTI_PER_SESSIONE_RAPIDA,
} from '../utils/lampo.js';

/** Le scelte del menu restano fra un avvio e l'altro: chi si allena rifà la stessa cosa. */
const CHIAVE_SCELTE = 'cassa:scelte:v1';
const SCELTE_INIZIALI = {
  modalita: 'allenamento',
  obiettivo: OBIETTIVO_PREDEFINITO,
  ritmo: RITMO_PREDEFINITO,
  prezzi: PREZZI_PREDEFINITI,
};

/** Un salvataggio con valori che non esistono più torna ai predefiniti, voce per voce. */
function scelteValide(salvate) {
  const valide = { ...SCELTE_INIZIALI };
  if (['allenamento', 'turno', 'rapido'].includes(salvate?.modalita)) valide.modalita = salvate.modalita;
  if (OBIETTIVI[salvate?.obiettivo]) valide.obiettivo = salvate.obiettivo;
  if (RITMI[salvate?.ritmo]) valide.ritmo = salvate.ritmo;
  if (PREZZI[salvate?.prezzi]) valide.prezzi = salvate.prezzi;
  return valide;
}

export default function Home({ statistiche, onAvvia, onStatistiche, onDifficolta }) {
  const [scelte, setScelte] = useLocalStorage(CHIAVE_SCELTE, SCELTE_INIZIALI, scelteValide);
  const scegli = (chiave, valore) => setScelte(p => ({ ...p, [chiave]: valore }));
  const { modalita, ritmo, prezzi } = scelte;
  const obiettivoScelto = scelte.obiettivo;
  const setModalita = valore => scegli('modalita', valore);
  const setObiettivoScelto = valore => scegli('obiettivo', valore);
  const [eserciziScelti, setEserciziScelti] = useState([]);
  const rapido = modalita === 'rapido';

  const livelloRaggiunto = statistiche?.livelloRaggiunto ?? 1;
  const [numeroLivello, setNumeroLivello] = useState(livelloRaggiunto);
  const livello = LIVELLI[Math.min(numeroLivello, LIVELLO_MASSIMO) - 1];

  const alterna = chiave => {
    setEserciziScelti(precedenti =>
      precedenti.includes(chiave)
        ? precedenti.filter(c => c !== chiave)
        : [...precedenti, chiave]);
  };

  // Nell'allenamento si scelgono solo gli esercizi che il livello ha già sbloccato.
  const eserciziDisponibili = modalita === 'turno' ? Object.keys(ESERCIZI) : livello.esercizi;
  const filtroValido = eserciziScelti.filter(c => eserciziDisponibili.includes(c));

  const progresso = progressoLivello(statistiche);
  const regola = regolaAvanzamento(statistiche);

  return (
    <div className="app">
      <main className="scena">
        <div className="home__intestazione">
          <h1 className="home__titolo">Cassa</h1>
          <p className="home__sottotitolo">Allenati a prendere i soldi giusti e dare il resto giusto.</p>
        </div>

        <button
          type="button"
          className={`modalita ${modalita === 'allenamento' ? 'modalita--attiva' : ''}`}
          onClick={() => setModalita('allenamento')}
        >
          <span className="modalita__nome">Allenamento</span>
          <span className="modalita__desc">
            Livelli, timer e punteggio. Un cliente dopo l'altro finché vuoi.
          </span>
        </button>

        <button
          type="button"
          className={`modalita ${modalita === 'turno' ? 'modalita--attiva' : ''}`}
          onClick={() => setModalita('turno')}
        >
          <span className="modalita__nome">Turno di cassa</span>
          <span className="modalita__desc">
            {CLIENTI_PER_TURNO} clienti di fila con un fondo cassa vero: i tagli
            finiscono, e alla fine la cassa deve quadrare.
          </span>
        </button>

        <button
          type="button"
          className={`modalita ${rapido ? 'modalita--attiva' : ''}`}
          onClick={() => setModalita('rapido')}
        >
          <span className="modalita__nome">Resto rapido</span>
          <span className="modalita__desc">
            {CLIENTI_PER_SESSIONE_RAPIDA} resti in pochi secondi l'uno. Puoi sbagliare: alla
            fine vedi quanto hai dato in più e quanto in meno.
          </span>
        </button>

        {rapido && (
          <div className="scheda">
            <p className="titolo-sezione">Ritmo</p>
            <div className="chip-riga">
              {Object.values(RITMI).map(voce => (
                <button
                  key={voce.chiave}
                  type="button"
                  className={`chip ${voce.chiave === ritmo ? 'chip--attivo' : ''}`}
                  onClick={() => scegli('ritmo', voce.chiave)}
                >
                  {voce.nome}
                </button>
              ))}
            </div>
            <p className="nota" style={{ marginTop: 8 }}>
              {RITMI[ritmo].descrizione} {String(RITMI[ritmo].base).replace('.', ',')} secondi
              per cliente, più {String(RITMI[ritmo].perPezzo).replace('.', ',')} per ogni pezzo
              da contare.
            </p>

            <p className="titolo-sezione" style={{ marginTop: 14 }}>Prezzi</p>
            <div className="chip-riga">
              {Object.values(PREZZI).map(voce => (
                <button
                  key={voce.chiave}
                  type="button"
                  className={`chip ${voce.chiave === prezzi ? 'chip--attivo' : ''}`}
                  onClick={() => scegli('prezzi', voce.chiave)}
                >
                  {voce.nome}
                </button>
              ))}
            </div>
            <p className="nota" style={{ marginTop: 8 }}>
              Conti come {PREZZI[prezzi].esempio}. Il totale di quello che rendi non è
              scritto da nessuna parte: il conto lo fai tu.
            </p>
          </div>
        )}

        {/* Non è una modalità: è come si giudica il resto, nel turno e nell'allenamento. */}
        {!rapido && <div className="scheda">
          <p className="titolo-sezione">Cosa vuol dire rendere bene</p>
          <div className="chip-riga">
            {Object.values(OBIETTIVI).map(voce => (
              <button
                key={voce.chiave}
                type="button"
                className={`chip ${voce.chiave === obiettivoScelto ? 'chip--attivo' : ''}`}
                onClick={() => setObiettivoScelto(voce.chiave)}
              >
                {voce.nome}
              </button>
            ))}
          </div>
          <p className="nota" style={{ marginTop: 8 }}>
            {OBIETTIVI[obiettivoScelto].descrizione}
          </p>
        </div>}

        {modalita === 'allenamento' && (
          <div className="scheda">
            <p className="titolo-sezione">Livello</p>
            <div className="chip-riga">
              {LIVELLI.map(voce => (
                <button
                  key={voce.numero}
                  type="button"
                  className={`chip ${voce.numero === numeroLivello ? 'chip--attivo' : ''}`}
                  disabled={voce.numero > livelloRaggiunto}
                  onClick={() => { setNumeroLivello(voce.numero); setEserciziScelti([]); }}
                >
                  {voce.numero > livelloRaggiunto ? '🔒 ' : ''}{voce.numero}
                </button>
              ))}
            </div>
            <p className="nota" style={{ marginTop: 10 }}>
              <strong>{livello.nome}.</strong> {livello.sottotitolo}
            </p>
            {!progresso.alMassimo && (
              <>
                <p className="titolo-sezione" style={{ marginTop: 14 }}>Quanto è severo l'avanzamento</p>
                <div className="chip-riga">
                  {Object.values(DIFFICOLTA).map(voce => (
                    <button
                      key={voce.chiave}
                      type="button"
                      className={`chip ${voce.chiave === regola.chiave ? 'chip--attivo' : ''}`}
                      onClick={() => onDifficolta(voce.chiave)}
                    >
                      {voce.nome}
                    </button>
                  ))}
                </div>
                <p className="nota" style={{ marginTop: 8 }}>{regola.descrizione}</p>
              </>
            )}

            {numeroLivello === livelloRaggiunto && (
              <ProgressoLivello progresso={progresso} prossimo={livelloRaggiunto + 1} />
            )}
          </div>
        )}

        {!rapido && <div className="scheda">
          <p className="titolo-sezione">
            Esercizi {filtroValido.length === 0 && <span style={{ textTransform: 'none' }}>· tutti</span>}
          </p>
          <div className="chip-riga">
            {eserciziDisponibili.map(chiave => (
              <button
                key={chiave}
                type="button"
                className={`chip ${filtroValido.includes(chiave) ? 'chip--attivo' : ''}`}
                onClick={() => alterna(chiave)}
              >
                {ESERCIZI[chiave].nome}
              </button>
            ))}
          </div>
          <p className="nota" style={{ marginTop: 8 }}>
            Non scegliere niente li mescola tutti. Sceglierne uno lo allena da solo.
          </p>
        </div>}

        <button type="button" className="pulsante pulsante--fantasma" onClick={onStatistiche}>
          Come sto andando
        </button>

        {/* Serve a rispondere a "che versione sto usando": senza, capire se una
            correzione e' arrivata sul telefono e' un indovinello. */}
        <p className="nota" style={{ textAlign: 'center' }}>versione {__APP_VERSION__}</p>
      </main>

      <div className="azioni">
        <button
          type="button"
          className="pulsante pulsante--principale"
          onClick={() => onAvvia({
            modalita,
            numeroLivello,
            obiettivo: obiettivoScelto,
            eserciziScelti: filtroValido.length > 0 ? filtroValido : null,
            ritmo,
            prezzi,
          })}
        >
          {modalita === 'turno' ? 'Apri la cassa' : (rapido ? 'Via' : 'Comincia')}
        </button>
      </div>
    </div>
  );
}

/**
 * Cosa serve per salire di livello, coi numeri veri.
 *
 * Il punteggio non c'entra: sale chi risponde giusto abbastanza spesso. E'
 * proprio la parte che si fraintende, perche' i punti sono il numero piu'
 * grande sullo schermo durante il gioco — quindi qui va detto a chiare lettere.
 */
function ProgressoLivello({ progresso, prossimo }) {
  const {
    regola, corrette, tentativi, sbagliate, richieste,
    corretteInFinestra, rispostePesate, precisione, sogliaPrecisione,
    precisioneInRegola, giusteMancanti, alMassimo,
  } = progresso;

  if (alMassimo) {
    return (
      <p className="nota" style={{ marginTop: 10 }}>
        Hai sbloccato tutti i livelli. Da qui si continua per tenersi allenati,
        o si passa al turno di cassa.
      </p>
    );
  }

  const conFinestra = regola.finestra !== null;
  const fatte = conFinestra ? corretteInFinestra : corrette;

  return (
    <div style={{ marginTop: 14 }}>
      <p className="titolo-sezione">Per sbloccare il livello {prossimo}</p>
      <p style={{ margin: '0 0 10px', fontWeight: 700 }}>
        {giusteMancanti === 0
          ? `Ci sei: la prossima risposta giusta ti porta al livello ${prossimo}.`
          : `Ancora ${giusteMancanti} ${giusteMancanti === 1 ? 'risposta giusta' : 'risposte giuste'}.`}
      </p>

      <div className="riga-stat" style={{ paddingTop: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="riga-stat__nome">
            {conFinestra ? `Giuste fra le ultime ${regola.finestra}` : 'Risposte giuste'}
          </div>
          {conFinestra && (
            <div className="riga-stat__dettaglio">
              {rispostePesate === 0
                ? 'nessuna risposta ancora'
                : `${fatte} su ${rispostePesate} risposte recenti · le più vecchie non contano`}
            </div>
          )}
          <div className="barra-precisione">
            <div
              className="barra-precisione__pieno"
              style={{ width: `${Math.min(100, (fatte / richieste) * 100)}%` }}
            />
          </div>
        </div>
        <div className="riga-stat__numero cifra">{fatte}/{richieste}</div>
      </div>

      {!conFinestra && (
        <div className="riga-stat">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="riga-stat__nome">Precisione</div>
            <div className="riga-stat__dettaglio">
              {tentativi === 0
                ? 'nessuna risposta ancora'
                : `${corrette} giuste su ${tentativi} · serve almeno ${Math.round(sogliaPrecisione * 100)}%`}
            </div>
            <div className="barra-precisione">
              <div
                className={`barra-precisione__pieno ${precisioneInRegola ? '' : 'barra-precisione__pieno--sotto'}`}
                style={{ width: `${precisione === null ? 0 : Math.round(precisione * 100)}%` }}
              />
              <div
                className="barra-precisione__soglia"
                style={{ left: `${Math.round(sogliaPrecisione * 100)}%` }}
              />
            </div>
          </div>
          <div className="riga-stat__numero cifra">
            {precisione === null ? '—' : `${Math.round(precisione * 100)}%`}
          </div>
        </div>
      )}

      <p className="nota" style={{ marginTop: 10 }}>
        I punti non contano per salire: conta {regola.regola}.
        {!conFinestra && sbagliate > 0 && " Ogni sbagliata alza un po' l'asticella, perché abbassa la precisione: per questo il numero qui sopra è più alto di quanto ti aspetti."}
        {conFinestra && sbagliate > 0 && ' Gli errori più vecchi sono già usciti dalla finestra: conta come stai andando adesso.'}
      </p>
    </div>
  );
}
