import { formatEuro } from '../utils/soldi.js';

/**
 * La riga in alto durante il gioco. Deve rispondere in un colpo d'occhio a
 * "quanto tempo ho", "come sto andando" e "a che punto sono", senza rubare
 * spazio allo scontrino.
 */
export default function BarraStato({
  titolo,
  sottotitolo,
  punteggio,
  streak,
  progresso,
  secondiTimer = 0,
  chiaveRound,
  onEsci,
}) {
  return (
    <header className="barra">
      <div className="barra__righe">
        <button type="button" className="barra__uscita" onClick={onEsci} aria-label="Torna al menu">
          ←
        </button>

        <div className="barra__voce" style={{ flex: 1, minWidth: 0 }}>
          <span className="barra__etichetta">{sottotitolo}</span>
          <span className="barra__valore" style={{ fontSize: 15 }}>{titolo}</span>
        </div>

        {progresso && (
          <div className="barra__voce" style={{ alignItems: 'flex-end' }}>
            <span className="barra__etichetta">Cliente</span>
            <span className="barra__valore cifra">{progresso}</span>
          </div>
        )}

        <div className="barra__voce" style={{ alignItems: 'flex-end' }}>
          <span className="barra__etichetta">Punti</span>
          <span className="barra__valore cifra">{punteggio}</span>
        </div>

        {streak > 1 && (
          <div className="barra__voce" style={{ alignItems: 'flex-end' }}>
            <span className="barra__etichetta">Serie</span>
            <span className="barra__valore barra__valore--serie cifra">{streak}</span>
          </div>
        )}
      </div>

      {secondiTimer > 0 && (
        <div className="timer" role="timer" aria-label="Tempo rimasto">
          {/* La chiave fa ripartire l'animazione a ogni cliente: e' il modo
              piu' economico di riavviare un keyframe. */}
          <div
            key={chiaveRound}
            className="timer__barra"
            style={{ animationDuration: `${secondiTimer}s` }}
          />
        </div>
      )}
    </header>
  );
}

/**
 * Riga discreta col totale in cassa: serve solo nel Turno.
 *
 * Col conteggio delle monete quando l'obiettivo e' salvarle: senza vederle
 * scendere in tempo reale, «lascia monete al collega» resta un buon proposito
 * che si scopre solo alla chiusura, quando non si puo' piu' rimediare.
 */
export function StatoCassetto({ totale, esauriti = [], monete = null, moneteIniziali = null }) {
  const differenza = monete !== null && moneteIniziali !== null ? monete - moneteIniziali : null;
  return (
    <p className="nota">
      In cassa <strong className="cifra">{formatEuro(totale)}</strong>
      {monete !== null && (
        <>
          {' · '}
          <strong className="cifra">{monete}</strong> monete
          {differenza !== null && differenza !== 0 && (
            <span className={differenza < 0 ? 'monete-giu' : 'monete-su'}>
              {' '}({differenza > 0 ? '+' : ''}{differenza})
            </span>
          )}
        </>
      )}
      {esauriti.length > 0 && <> · finiti: {esauriti.map(t => t.etichetta ?? t).join(', ')}</>}
    </p>
  );
}
