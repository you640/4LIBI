import { describe, it, expect } from "vitest";
import {
  normalizeLocationName,
  resolveLocationCoords,
  haversineDistanceKm,
  getDistanceBetweenLocationsKm,
  getMinimumTravelMinutes,
  evaluateTravelFeasibility,
} from "../src/lib/geospatialEngine";

describe("Geospatial & Travel Feasibility Engine", () => {
  it("normalizuje názvy miest s diakritikou a predložkami", () => {
    expect(normalizeLocationName("v Bratislave")).toBe("bratislave");
    expect(normalizeLocationName("Košice")).toBe("kosice");
    expect(normalizeLocationName("Banská Bystrica")).toBe("banskabystrica");
    expect(normalizeLocationName("vo Zvolene")).toBe("zvolene");
    expect(normalizeLocationName("do Žiliny")).toBe("ziliny");
  });

  it("správne nájde súradnice pre slovenské mestá", () => {
    const ba = resolveLocationCoords("Bratislava");
    expect(ba).toBeDefined();
    expect(ba?.lat).toBeCloseTo(48.1486, 2);
    expect(ba?.lng).toBeCloseTo(17.1077, 2);

    const ke = resolveLocationCoords("Košice");
    expect(ke).toBeDefined();
    expect(ke?.lat).toBeCloseTo(48.7164, 2);
  });

  it("vráti null pre neznáme/neexistujúce lokality", () => {
    expect(resolveLocationCoords("Atlantída")).toBeNull();
    expect(resolveLocationCoords("")).toBeNull();
  });

  it("vypočíta vzdušnú vzdialenosť Haversine medzi BA a KE (~310-330 km)", () => {
    const ba = resolveLocationCoords("Bratislava")!;
    const ke = resolveLocationCoords("Košice")!;
    const directKm = haversineDistanceKm(ba, ke);

    expect(directKm).toBeGreaterThan(300);
    expect(directKm).toBeLessThan(350);
  });

  it("vypočíta cestnú vzdialenosť medzi BA a KE s cestným koeficientom (~380-430 km)", () => {
    const roadKm = getDistanceBetweenLocationsKm("Bratislava", "Košice");
    expect(roadKm).toBeDefined();
    expect(roadKm).toBeGreaterThan(380);
    expect(roadKm).toBeLessThan(440);
  });

  it("vypočíta minimálny čas jazdy medzi mestami s bezpečnostným bufferom", () => {
    const minutes = getMinimumTravelMinutes(400, true);
    // 400 km pri 105 km/h + 15 min buffer ≈ 243 minút (~4 hodiny)
    expect(minutes).toBeGreaterThan(200);
    expect(minutes).toBeLessThan(300);
  });

  it("deteguje KRITICKY nemožné alibi (Bratislava 20:00 vs Košice 20:30)", () => {
    const result = evaluateTravelFeasibility(
      "Bratislava",
      "20:00",
      "Košice",
      "20:30",
      "Jozef Podozrivý"
    );

    expect(result).not.toBeNull();
    expect(result?.isFeasible).toBe(false);
    expect(result?.severity).toBe("critical");
    expect(result?.requiredSpeedKmh).toBeGreaterThan(700);
    expect(result?.explanation).toContain("Fyzikálne nemožný presun");
  });

  it("schváli realistický presun (Bratislava 08:00 vs Trnava 09:30)", () => {
    const result = evaluateTravelFeasibility(
      "Bratislava",
      "08:00",
      "Trnava",
      "09:30",
      "Peter Svedok"
    );

    expect(result).not.toBeNull();
    expect(result?.isFeasible).toBe(true);
    expect(result?.severity).toBe("normal");
    expect(result?.explanation).toContain("Presun je realisticky možný");
  });

  it("správne odhalí vysoké riziko pri rýchlosti tesne nad limit (140-190 km/h)", () => {
    // BA - Žilina je cca 200km. Za 75 minút = 160 km/h
    const result = evaluateTravelFeasibility(
      "Bratislava",
      "12:00",
      "Žilina",
      "13:15",
      "Milan Rýchly"
    );

    expect(result).not.toBeNull();
    expect(result?.isFeasible).toBe(false);
    expect(result?.severity).toBe("high");
  });

  it("vráti null pri rovnakom mieste alebo vzdialenosti menšej ako 5 km", () => {
    const result = evaluateTravelFeasibility(
      "Bratislava",
      "12:00",
      "Bratislava",
      "12:10"
    );
    expect(result).toBeNull();
  });

  it("podporuje susedné európske metropoly (Viedeň, Praha, Budapešť)", () => {
    const vienna = resolveLocationCoords("Viedeň");
    const prague = resolveLocationCoords("Praha");
    const budapest = resolveLocationCoords("Budapešť");

    expect(vienna).toBeDefined();
    expect(prague).toBeDefined();
    expect(budapest).toBeDefined();

    const distBaVienna = getDistanceBetweenLocationsKm("Bratislava", "Viedeň");
    expect(distBaVienna).toBeGreaterThan(50);
    expect(distBaVienna).toBeLessThan(110);
  });
});
