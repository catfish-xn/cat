import { freezeContent } from './freeze';
/** Adopted balance overrides, official 2024-12-17 14.24 B notice, locally recorded at
 * docs/evidence/g2-3/external-sources.json /groups/8/changes/N (zero-based entries).
 * Raw archives and the archive mirror remain 14.24 evidence. No inferred hash aliases. */
export const CHEM_BARON_B_OVERRIDES:Readonly<Record<string,Readonly<Record<string,number>>>> = freezeContent({
 TFT13_Crime_Silver_DestabilizedChemtank:{InitialPercentShield:0.25}, // N=1
 TFT13_Crime_Gold_DestabilizedChemtank:{InitialPercentShield:0.5}, // N=2
 TFT13_Crime_Prismatic_DestabilizedChemtank:{Health:999,PercentShield:0.2,PrismaticDamagePercent:0.15}, // N=3,4,5
 TFT13_Crime_Prismatic_FleshRipper:{AD:0.6}, // N=6
 TFT13_Crime_Prismatic_PiltovenHexplating:{ArmorPerStack:5}, // N=7; {992e2747} stays unknown/10
 TFT13_Crime_Prismatic_ShimmerBloom:{IncreasedHealShieldPercent:0.5,ShieldAmount:400,PrismaticAllyAP:25,PrismaticAllyAS:0.25}, // N=8,9,10 (two fields)
 TFT13_Crime_Prismatic_UnleashedToxins:{PrismaticWaveDamage:200,PrismaticWaveStunDuration:1}, // N=11,12
 TFT13_Crime_Prismatic_VirulentVirus:{AP:50,PrismaticReducedDamage:0.2,PrismaticZombieHealth:1200}, // N=13,14,15
});
