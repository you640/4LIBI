// Geospatiálny a cestovný motor pre Alibi Forenznú Platformu.
// Vypočítava vzdialenosti medzi slovenskými a európskymi mestami,
// minimálny potrebný čas na presun a deteguje fyzikálne nemožné alibi.
import { parseTimeToMinutes } from './forenzCore';
import type { GeoLocation, TravelFeasibilityResult } from '../types';

export const SLOVAK_LOCATIONS: Record<string, GeoLocation> = {
  bratislava: { lat: 48.1486, lng: 17.1077 },
  kosice: { lat: 48.7164, lng: 21.2611 },
  presov: { lat: 48.9984, lng: 21.2393 },
  zilina: { lat: 49.2231, lng: 18.7394 },
  banskabystrica: { lat: 48.7363, lng: 19.1462 },
  nitra: { lat: 48.3061, lng: 18.0764 },
  trnava: { lat: 48.3774, lng: 17.5883 },
  trencin: { lat: 48.8945, lng: 18.0444 },
  poprad: { lat: 49.0512, lng: 20.2975 },
  martin: { lat: 49.0645, lng: 18.9221 },
  prievidza: { lat: 48.7718, lng: 18.6253 },
  zvolen: { lat: 48.5763, lng: 19.1278 },
  povazskabystrica: { lat: 49.1215, lng: 18.4419 },
  michalovce: { lat: 48.7554, lng: 21.9195 },
  novezamky: { lat: 47.9854, lng: 18.1611 },
  spisskanovaves: { lat: 48.9439, lng: 20.5678 },
  komarno: { lat: 47.7636, lng: 18.1278 },
  humenne: { lat: 48.9378, lng: 21.9084 },
  levice: { lat: 48.2156, lng: 18.6072 },
  bardejov: { lat: 49.2918, lng: 21.2758 },
  liptovskymikulas: { lat: 49.0806, lng: 19.6167 },
  lucenec: { lat: 48.3328, lng: 19.6672 },
  piestany: { lat: 48.5915, lng: 17.8289 },
  ruzomberok: { lat: 49.0748, lng: 19.3039 },
  topolcany: { lat: 48.5606, lng: 18.1758 },
  trebisov: { lat: 48.6286, lng: 21.7194 },
  cadca: { lat: 49.4386, lng: 18.7903 },
  dubnicanadvahom: { lat: 48.9597, lng: 18.1742 },
  rimavskasobota: { lat: 48.3828, lng: 20.0222 },
  partizanske: { lat: 48.6272, lng: 18.3761 },
  vranovnadtoplou: { lat: 48.8883, lng: 21.6847 },
  dunajskastreda: { lat: 47.9936, lng: 17.6186 },
  sala: { lat: 48.1517, lng: 17.8806 },
  hlohovec: { lat: 48.4319, lng: 17.8031 },
  senica: { lat: 48.6792, lng: 17.3669 },
  pezinok: { lat: 48.2892, lng: 17.2667 },
  banovcenadbebravou: { lat: 48.7189, lng: 18.2583 },
  dolnykubin: { lat: 49.2094, lng: 19.2997 },
  senec: { lat: 48.2197, lng: 17.4003 },
  malacky: { lat: 48.4361, lng: 17.0219 },
  roznava: { lat: 48.6606, lng: 20.5375 },
  brezno: { lat: 48.8044, lng: 19.6364 },
  vieden: { lat: 48.2082, lng: 16.3738 },
  vienna: { lat: 48.2082, lng: 16.3738 },
  praha: { lat: 50.0755, lng: 14.4378 },
  prague: { lat: 50.0755, lng: 14.4378 },
  budapest: { lat: 47.4979, lng: 19.0402 },
  krakov: { lat: 50.0647, lng: 19.9450 }
};

export function normalizeLocationName(loc: string): string {
  return String(loc || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^(v meste|okres|mesto|vo|do|pri|na|v)\s+/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

export function resolveLocationCoords(loc: string): GeoLocation | null {
  const norm = normalizeLocationName(loc);
  if (!norm) return null;

  if (SLOVAK_LOCATIONS[norm]) {
    return SLOVAK_LOCATIONS[norm];
  }

  for (const [key, coords] of Object.entries(SLOVAK_LOCATIONS)) {
    if (norm.includes(key) || key.includes(norm)) {
      return coords;
    }
    const stem = key.length > 5 ? key.slice(0, 5) : key.slice(0, 4);
    if (norm.startsWith(stem) || norm.includes(stem)) {
      return coords;
    }
  }

  return null;
}

export function haversineDistanceKm(a: GeoLocation, b: GeoLocation): number {
  const R = 6371; // km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDlat = Math.sin(dLat / 2);
  const sinDlng = Math.sin(dLng / 2);
  const h = sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlng * sinDlng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function getDistanceBetweenLocationsKm(locA: string, locB: string): number | null {
  const coordsA = resolveLocationCoords(locA);
  const coordsB = resolveLocationCoords(locB);

  if (!coordsA || !coordsB) return null;
  const directKm = haversineDistanceKm(coordsA, coordsB);
  // Reálny cestný koeficient (cesty nie sú priamky)
  return Math.round(directKm * 1.25);
}

export function getMinimumTravelMinutes(distanceKm: number, isHighway = true): number {
  const avgSpeedKmh = isHighway ? 105 : 70;
  const hours = distanceKm / avgSpeedKmh;
  const bufferMinutes = 15; // zápchy, semafory, parkovanie
  return Math.round(hours * 60 + bufferMinutes);
}

export function evaluateTravelFeasibility(
  locA: string,
  timeA: string,
  locB: string,
  timeB: string,
  personName = 'Podozrivá osoba'
): TravelFeasibilityResult | null {
  const minutesA = parseTimeToMinutes(timeA);
  const minutesB = parseTimeToMinutes(timeB);

  if (minutesA === null || minutesB === null) return null;

  const diffMinutes = Math.abs(minutesB - minutesA);
  const distanceKm = getDistanceBetweenLocationsKm(locA, locB);

  if (distanceKm === null) return null;
  if (distanceKm < 5) return null;

  const minRequiredMinutes = getMinimumTravelMinutes(distanceKm);
  const requiredSpeedKmh = diffMinutes > 0 ? Math.round((distanceKm / (diffMinutes / 60))) : 999;

  const isFeasible = diffMinutes >= minRequiredMinutes && requiredSpeedKmh <= 130;

  let severity: 'normal' | 'high' | 'critical' = 'normal';
  if (requiredSpeedKmh > 200 || diffMinutes < minRequiredMinutes / 2) {
    severity = 'critical';
  } else if (!isFeasible) {
    severity = 'high';
  }

  let explanation = '';
  if (!isFeasible) {
    explanation = `Fyzikálne nemožný presun: ${personName} by musel(a) prekonať vzdialenosť ${distanceKm} km medzi "${locA}" (${timeA}) a "${locB}" (${timeB}) za ${diffMinutes} minút (potrebná priemerná rýchlosť ${requiredSpeedKmh} km/h). Minimálny realistický čas jazdy je ${minRequiredMinutes} minút.`;
  } else {
    explanation = `Presun je realisticky možný: vzdialenosť ${distanceKm} km, dostupný čas ${diffMinutes} min, minimálny potrebný čas ${minRequiredMinutes} min.`;
  }

  return {
    isFeasible,
    distanceKm,
    travelMinutesAvailable: diffMinutes,
    minTravelMinutesRequired: minRequiredMinutes,
    requiredSpeedKmh,
    severity,
    explanation,
    locationA: locA,
    locationB: locB
  };
}
