import { describe, it, expect } from "vitest";

/**
 * ============================================================================
 * iPhone 17 Air (Slim) — Hardware, Display & Touch Geometry Specifications
 * ============================================================================
 * - Display: 6.55" / 6.6" Super Retina XDR OLED (120Hz ProMotion)
 * - Physical Resolution: 2736 × 1260 px @ 460 ppi
 * - Logical CSS Viewport (Portrait): 420 × 912 pt (Scale factor @3x)
 * - Safe Area Insets (Portrait):
 *     - safe-area-inset-top: 59px (Dynamic Island + Sensor cluster)
 *     - safe-area-inset-bottom: 34px (Home Indicator)
 *     - safe-area-inset-left: 0px (1.15mm ultra-thin bezel)
 *     - safe-area-inset-right: 0px (1.15mm ultra-thin bezel)
 * - Dynamic Island Pill Area: Center (x: 147.5pt .. 272.5pt), y: 11pt .. 48pt (Width: 125pt, Height: 37pt)
 * - Under-Camera Anomaly Zone: y: 49pt .. 62pt (Sub-camera active touch zone prone to system gesture swipe down)
 * ============================================================================
 */

export const IPHONE_17_AIR_SPEC = {
  name: "iPhone 17 Air",
  screenDiagonalInches: 6.55,
  physicalWidthPx: 1260,
  physicalHeightPx: 2736,
  logicalWidthPt: 420,
  logicalHeightPt: 912,
  devicePixelRatio: 3,
  aspectRatio: 912 / 420, // ~2.17 (19.5:9)
  safeAreaInsets: {
    top: 59,
    bottom: 34,
    left: 0,
    right: 0,
    landscapeLeft: 59,
    landscapeRight: 59,
    landscapeTop: 0,
    landscapeBottom: 21,
  },
  dynamicIsland: {
    xCenter: 210,
    width: 125,
    height: 37,
    yTop: 11,
    yBottom: 48,
    deadzoneTop: 0,
    deadzoneBottom: 50,
  },
  subCameraAnomalyZone: {
    // Dotyková plocha priamo pod fotoaparátom/Dynamic Islandom
    yStart: 48,
    yEnd: 64,
    xStart: 120,
    xEnd: 300,
    risk: "Swallowed by Notification Center / Dynamic Island system expansion gesture",
  },
  bezelThicknessMm: 1.15,
  minTouchTargetPt: 44, // Apple Human Interface Guidelines
  recommendedTouchTargetPt: 48, // W3C WCAG 2.2 AA
};

export interface TouchPoint {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function isInsideDynamicIsland(point: TouchPoint): boolean {
  const di = IPHONE_17_AIR_SPEC.dynamicIsland;
  const xMin = di.xCenter - di.width / 2;
  const xMax = di.xCenter + di.width / 2;
  return point.x >= xMin && point.x <= xMax && point.y >= di.yTop && point.y <= di.yBottom;
}

export function isInSubCameraAnomalyZone(point: TouchPoint): boolean {
  const zone = IPHONE_17_AIR_SPEC.subCameraAnomalyZone;
  return (
    point.x >= zone.xStart &&
    point.x <= zone.xEnd &&
    point.y >= zone.yStart &&
    point.y <= zone.yEnd
  );
}

export function isInsideHomeIndicatorZone(point: TouchPoint, viewportHeight = 912): boolean {
  const safeBottom = IPHONE_17_AIR_SPEC.safeAreaInsets.bottom;
  return point.y >= viewportHeight - safeBottom;
}

export function evaluateTouchTargetIntegrity(box: BoundingBox, viewport = { width: 420, height: 912 }) {
  const center: TouchPoint = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };

  const collidesWithDynamicIsland =
    box.y < IPHONE_17_AIR_SPEC.dynamicIsland.yBottom &&
    box.x + box.width > (IPHONE_17_AIR_SPEC.dynamicIsland.xCenter - IPHONE_17_AIR_SPEC.dynamicIsland.width / 2) &&
    box.x < (IPHONE_17_AIR_SPEC.dynamicIsland.xCenter + IPHONE_17_AIR_SPEC.dynamicIsland.width / 2);

  const inSubCameraDanger = box.y < IPHONE_17_AIR_SPEC.subCameraAnomalyZone.yEnd;

  const collidesWithHomeIndicator = box.y + box.height > viewport.height - IPHONE_17_AIR_SPEC.safeAreaInsets.bottom;

  const meetsAppleMinTarget =
    box.width >= IPHONE_17_AIR_SPEC.minTouchTargetPt &&
    box.height >= IPHONE_17_AIR_SPEC.minTouchTargetPt;

  const meetsWcagTarget =
    box.width >= IPHONE_17_AIR_SPEC.recommendedTouchTargetPt &&
    box.height >= IPHONE_17_AIR_SPEC.recommendedTouchTargetPt;

  const isEdgeBezelCollision = box.x < 8 || box.x + box.width > viewport.width - 8;

  return {
    valid: !collidesWithDynamicIsland && !inSubCameraDanger && !collidesWithHomeIndicator,
    center,
    meetsAppleMinTarget,
    meetsWcagTarget,
    collidesWithDynamicIsland,
    inSubCameraDanger,
    collidesWithHomeIndicator,
    isEdgeBezelCollision,
    safeTopRequired: IPHONE_17_AIR_SPEC.safeAreaInsets.top,
    safeBottomRequired: IPHONE_17_AIR_SPEC.safeAreaInsets.bottom,
  };
}

describe("iPhone 17 Air (Slim) Display & Touch Integrity Suite", () => {
  describe("1. Hardware & Viewport Geometria", () => {
    it("má presný logický CSS viewport 420 × 912 pt @ 3x", () => {
      expect(IPHONE_17_AIR_SPEC.logicalWidthPt).toBe(420);
      expect(IPHONE_17_AIR_SPEC.logicalHeightPt).toBe(912);
      expect(IPHONE_17_AIR_SPEC.devicePixelRatio).toBe(3);
      expect(IPHONE_17_AIR_SPEC.logicalWidthPt * 3).toBe(IPHONE_17_AIR_SPEC.physicalWidthPx);
      expect(IPHONE_17_AIR_SPEC.logicalHeightPt * 3).toBe(IPHONE_17_AIR_SPEC.physicalHeightPx);
    });

    it("má správny Safe Area Inset pre Dynamic Island (59px)", () => {
      expect(IPHONE_17_AIR_SPEC.safeAreaInsets.top).toBe(59);
      expect(IPHONE_17_AIR_SPEC.safeAreaInsets.bottom).toBe(34);
    });

    it("identifikuje Dynamic Island zónu v strede hornej lišty", () => {
      const centerPoint = { x: 210, y: 25 };
      expect(isInsideDynamicIsland(centerPoint)).toBe(true);

      const safePoint = { x: 50, y: 25 };
      expect(isInsideDynamicIsland(safePoint)).toBe(false);
    });
  });

  describe("2. Anomália dotykovej plochy pod fotoaparátom (Sub-Camera Touch Anomaly)", () => {
    it("deteguje nebezpečnú dotykovú zónu y: 48..64pt priamo pod ostrovčekom kamery", () => {
      const dangerPoint = { x: 210, y: 55 };
      expect(isInSubCameraAnomalyZone(dangerPoint)).toBe(true);

      const clearPoint = { x: 210, y: 80 };
      expect(isInSubCameraAnomalyZone(clearPoint)).toBe(false);
    });

    it("zamietne interaktívny prvok zasahujúci do sub-camera anomálnej zóny", () => {
      const badButton: BoundingBox = { x: 180, y: 45, width: 60, height: 44 };
      const evaluation = evaluateTouchTargetIntegrity(badButton);
      expect(evaluation.valid).toBe(false);
      expect(evaluation.inSubCameraDanger).toBe(true);
    });

    it("akceptuje správne odsadený AppBar (y >= 64pt)", () => {
      // ForenzDetectiv CSS používa var(--content-top) = max(safe-top, 52px) + 10px = 69px
      const safeHeaderButton: BoundingBox = { x: 16, y: 70, width: 44, height: 44 };
      const evaluation = evaluateTouchTargetIntegrity(safeHeaderButton);
      expect(evaluation.valid).toBe(true);
      expect(evaluation.inSubCameraDanger).toBe(false);
      expect(evaluation.collidesWithDynamicIsland).toBe(false);
    });
  });

  describe("3. Home Indicator & Bottom Safe Area", () => {
    it("deteguje dotyky v zóne Home Indicátora (posledných 34px)", () => {
      const touchAtBottom = { x: 210, y: 900 };
      expect(isInsideHomeIndicatorZone(touchAtBottom, 912)).toBe(true);

      const touchAboveSafe = { x: 210, y: 850 };
      expect(isInsideHomeIndicatorZone(touchAboveSafe, 912)).toBe(false);
    });

    it("verifikuje, že navigačná lišta (76px + safe-bottom) nekoliduje s gestom domov", () => {
      const bottomTabButton: BoundingBox = { x: 160, y: 820, width: 64, height: 48 };
      const evaluation = evaluateTouchTargetIntegrity(bottomTabButton);
      expect(evaluation.collidesWithHomeIndicator).toBe(false);
      expect(evaluation.meetsAppleMinTarget).toBe(true);
    });
  });

  describe("4. Touch Target Veľkosť & Bezel Edge Anomálie", () => {
    it("overí minimálnu veľkosť dotykového terča 44x44 pt (Apple HIG)", () => {
      const smallBtn: BoundingBox = { x: 50, y: 100, width: 32, height: 32 };
      const evalSmall = evaluateTouchTargetIntegrity(smallBtn);
      expect(evalSmall.meetsAppleMinTarget).toBe(false);

      const compliantBtn: BoundingBox = { x: 50, y: 100, width: 48, height: 48 };
      const evalCompliant = evaluateTouchTargetIntegrity(compliantBtn);
      expect(evalCompliant.meetsAppleMinTarget).toBe(true);
      expect(evalCompliant.meetsWcagTarget).toBe(true);
    });

    it("deteguje dotyky na ultra-tenkom 1.15mm rámčeku (palm rejection risk)", () => {
      const edgeBtn: BoundingBox = { x: 2, y: 100, width: 44, height: 44 };
      const evalEdge = evaluateTouchTargetIntegrity(edgeBtn);
      expect(evalEdge.isEdgeBezelCollision).toBe(true);

      const paddedBtn: BoundingBox = { x: 16, y: 100, width: 44, height: 44 };
      const evalPadded = evaluateTouchTargetIntegrity(paddedBtn);
      expect(evalPadded.isEdgeBezelCollision).toBe(false);
    });
  });

  describe("5. ForenzDetectiv CSS Tokeny & iPhone 17 Air Kompatibilita", () => {
    it("vypočíta bezpečný offset pre obsah cez --island-band formulu", () => {
      const safeTop = IPHONE_17_AIR_SPEC.safeAreaInsets.top; // 59px
      const islandMin = 52;
      const touchTopGap = 10;
      const calculatedIslandBand = Math.max(safeTop, islandMin) + touchTopGap; // 59 + 10 = 69px

      // 69px je bezpečne nad 64px hranicou anomálie pod kamerou
      expect(calculatedIslandBand).toBe(69);
      expect(calculatedIslandBand).toBeGreaterThan(IPHONE_17_AIR_SPEC.subCameraAnomalyZone.yEnd);
    });

    it("potvrdzuje dostupnú vertikálnu pracovnú výšku pre zoznamy a graf", () => {
      const usableHeight =
        IPHONE_17_AIR_SPEC.logicalHeightPt -
        IPHONE_17_AIR_SPEC.safeAreaInsets.top -
        IPHONE_17_AIR_SPEC.safeAreaInsets.bottom -
        76; // Nav height
      
      // 912 - 59 - 34 - 76 = 743px čistej plochy
      expect(usableHeight).toBe(743);
      expect(usableHeight).toBeGreaterThan(600); // Dostatočný priestor pre plnohodnotný vzťahový graf
    });
  });
});
