/**
 * Che cosa vuol dire «rendere bene» il resto.
 *
 * Comporre il resto col minimo numero di pezzi cede già il minimo numero di
 * monete — la moneta più grande (2 €) vale meno della banconota più piccola
 * (5 €), quindi il greedy usa le banconote finché può. I due obiettivi non
 * possono quindi divergere su *come* si compone un dato resto.
 *
 * Divergono su *quale* resto ti trovi a dare, cioè sulla decisione di chiedere
 * spiccioli al cliente. Con resto 14,55 € chiedere 50 centesimi porta a 15,05 €
 * e riduce i pezzi; chiederne 45 porta a 15,00 €, che si paga con due banconote
 * e zero monete. La seconda è la mossa di chi pensa a chi prende il turno dopo.
 */
export const OBIETTIVI = {
  'meno-pezzi': {
    chiave: 'meno-pezzi',
    nome: 'Meno pezzi',
    breve: 'meno banconote e monete da contare',
    descrizione: 'Rendi il resto col minor numero di pezzi: più veloce da contare, meno errori.',
    // Su cosa si misura il costo del resto reso.
    misura: 'pezzi',
    // Quanto "costa" chiedere un pezzo al cliente, nell'unità della misura.
    costoPezzoChiesto: 0.5,
    // Sotto questo guadagno non vale la frase in più detta al cliente.
    guadagnoMinimo: 1,
    bonus: 'Meno pezzi possibile',
  },
  'salva-monete': {
    chiave: 'salva-monete',
    nome: 'Salva le monete',
    breve: 'lasciare monete a chi viene dopo',
    descrizione:
      'Cedi meno monete possibile. Le banconote rientrano dai clienti tutto il giorno, '
      + 'le monete no: chi prende il turno dopo deve avere di che dare il resto.',
    misura: 'monete',
    /*
     * Le monete incassate non contano come guadagno, anche se in cassa entrano
     * per davvero: se le contassimo, la mossa migliore diventerebbe «chiedi
     * sempre il massimo di spiccioli», che non è una decisione e non è nemmeno
     * realistico. A decidere resta quante monete non escono dal cassetto, col
     * costo qui sotto a rappresentare la pazienza del cliente.
     *
     * Con questi due valori si chiede quando si risparmia almeno una moneta con
     * una richiesta di uno o due pezzi. Su un turno da 15 clienti la simulazione
     * dà 6 monete in meno a fine turno invece di 11: è la differenza fra
     * lasciare il cassetto usabile e lasciarlo secco.
     */
    costoPezzoChiesto: 0.25,
    guadagnoMinimo: 0.5,
    bonus: 'Monete risparmiate',
  },
};

export const OBIETTIVO_PREDEFINITO = 'meno-pezzi';

export function obiettivo(chiave) {
  return OBIETTIVI[chiave] ?? OBIETTIVI[OBIETTIVO_PREDEFINITO];
}
