/**
 * Puerto: reloj del sistema.
 *
 * El tiempo es un efecto externo; el dominio no lee el reloj directamente. Los
 * casos de uso obtienen el instante actual a través de este puerto, lo que
 * mantiene la lógica determinista y testeable.
 */
export interface Clock {
  now(): Date;
}
