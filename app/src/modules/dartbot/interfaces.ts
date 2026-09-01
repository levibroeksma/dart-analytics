export interface DartRng {
  uniform(): number;
  gaussianPair(): [number, number];
}
