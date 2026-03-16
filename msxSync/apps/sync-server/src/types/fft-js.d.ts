declare module 'fft.js' {
  export default class FFT {
    constructor(size: number);
    createComplexArray(): Float64Array;
    realTransform(out: Float64Array, data: Float64Array): void;
    completeSpectrum(out: Float64Array): void;
  }
}
