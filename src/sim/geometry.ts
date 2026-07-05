// Image cylinder geometry: the lens projects the target planet's image onto
// a cylinder centred on the focal line.

// Cylinder diameter at heliocentric distance z: D = planet diameter x (z / d_source).
// Proxima b (modelled 13,000 km): ~32 km at 650 AU, ~57 km at 1200 AU.
export function imageCylinderDiameterM(
  zM: number,
  planetDiameterM: number,
  sourceDistanceM: number
): number {
  return planetDiameterM * (zM / sourceDistanceM);
}

// Metres of cylinder cross-section per final-image pixel (~31 m at 650 AU
// for a 1000 px map of Proxima b).
export function imagePixelPitchM(
  zM: number,
  planetDiameterM: number,
  sourceDistanceM: number,
  mapPixels = 1000
): number {
  return imageCylinderDiameterM(zM, planetDiameterM, sourceDistanceM) / mapPixels;
}
