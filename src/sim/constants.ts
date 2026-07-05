// Physical constants (SI). CODATA / IAU nominal values.

export const G = 6.6743e-11; // gravitational constant, m^3 kg^-1 s^-2
export const C = 299_792_458; // speed of light, m s^-1
export const M_SUN = 1.98892e30; // solar mass, kg
export const R_SUN_M = 6.96e8; // solar radius, m (696,000 km)
export const AU_M = 1.495978707e11; // astronomical unit, m
export const LY_M = 9.4607304725808e15; // light year, m
export const PC_M = 3.0856775814913673e16; // parsec, m

export const DAY_S = 86_400;
export const YEAR_S = 365.25 * DAY_S; // Julian year, s

// 4GM/c^2: the length scale of solar lensing (~5.9 km)
export const FOUR_GM_OVER_C2 = (4 * G * M_SUN) / (C * C);
