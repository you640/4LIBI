import { describe, it, expect } from "vitest";

/**
 * ============================================================================
 * 📱 FORENZDETECTIV QA ENGINE — iPhone 17 Air (Slim) E2E & Viewport Test Suite
 * ============================================================================
 * 
 * Hardware Viewport & Touch Surface Profile:
 * - Model: Apple iPhone 17 Air (Codename: Slim / D23)
 * - Display: 6.55" Super Retina XDR OLED (120 Hz ProMotion)
 * - Physical Panel: 2736 × 1260 px @ 460 ppi
 * - Logical CSS Viewport (Portrait): 420 × 912 pt @ 3x DPR
 * - Logical CSS Viewport (Landscape): 912 × 420 pt @ 3x DPR
 * - Border Bezel: 1.15 mm Ultra-Slim
 * 
 * Critical Hardware Zones:
 * 1. Dynamic Island: x: 147.5 .. 272.5 pt, y: 11 .. 48 pt (W: 125 pt, H: 37 pt)
 * 2. Sub-Camera Anomaly Zone: x: 120 .. 300 pt, y: 48 .. 64 pt
 * 3. Home Indicator Zone: y >= 878 pt (Portrait) / y >= 399 pt (Landscape)
 * 4. Palm Rejection Edge Zone: x < 12 pt OR x > 408 pt (Portrait)
 * ============================================================================
 */

export interface DeviceProfile {
  name: string;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
  safeArea: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export const IPHONE_17_AIR_PORTRAIT: DeviceProfile = {
  name: "iPhone 17 Air (Portrait)",
  viewport: { width: 420, height: 912 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  safeArea: { top: 59, bottom: 34, left: 0, right: 0 },
};

export const IPHONE_17_AIR_LANDSCAPE: DeviceProfile = {
  name: "iPhone 17 Air (Landscape)",
  viewport: { width: 912, height: 420 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  safeArea: { top: 0, bottom: 21, left: 59, right: 59 },
};

export interface DOMRectBounds {
  id: string;
  tagName: string;
  role?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CollisionAuditReport {
  elementId: string;
  passed: boolean;
  violations: string[];
  metrics: {
    touchAreaPx: number;
    meetsAppleHig: boolean;
    meetsWcagAa: boolean;
    distanceFromSubCameraPx: number;
    distanceFromHomeIndicatorPx: number;
    distanceFromBezelPx: number;
  };
}

export class IPhone17AirAuditor {
  constructor(private device: DeviceProfile = IPHONE_17_AIR_PORTRAIT) {}

  public auditElement(elem: DOMRectBounds): CollisionAuditReport {
    const violations: string[] = [];
    const isPortrait = this.device.viewport.width === 420;

    // 1. Apple HIG & WCAG Target Size Audit
    const meetsAppleHig = elem.width >= 44 && elem.height >= 44;
    const meetsWcagAa = elem.width >= 48 && elem.height >= 48;
    if (!meetsAppleHig) {
      violations.push(`CRITICAL_TOUCH_TARGET_TOO_SMALL: ${elem.width}x${elem.height}pt < 44x44pt (Apple HIG)`);
    }

    // 2. Dynamic Island Physical Cutout Collision
    if (isPortrait) {
      const diXMin = 147.5;
      const diXMax = 272.5;
      const diYBottom = 48;

      const collidesWithIsland =
        elem.y < diYBottom &&
        elem.x + elem.width > diXMin &&
        elem.x < diXMax;

      if (collidesWithIsland) {
        violations.push(`DYNAMIC_ISLAND_OCCLUSION: Element overlaps with hardware cutout pill (y < 48pt, x: 147.5..272.5pt)`);
      }
    }

    // 3. Sub-Camera Touch Anomaly Zone (y: 48..64pt, x: 120..300pt)
    let distanceFromSubCamera = 999;
    if (isPortrait) {
      const subCamYStart = 48;
      const subCamYEnd = 64;
      const subCamXStart = 120;
      const subCamXEnd = 300;

      const inDangerZone =
        elem.y < subCamYEnd &&
        elem.y + elem.height > subCamYStart &&
        elem.x + elem.width > subCamXStart &&
        elem.x < subCamXEnd;

      distanceFromSubCamera = elem.y - subCamYEnd;

      if (inDangerZone || elem.y < 65) {
        violations.push(
          `SUB_CAMERA_GESTURE_SWALLOWED: Element is within y: 48..64pt danger zone. Gestures will be intercepted by iOS Notification Center / Dynamic Island expansion.`
        );
      }
    }

    // 4. Home Indicator Swipe Collision (Bottom Safe Area)
    const homeIndicatorThreshold = this.device.viewport.height - this.device.safeArea.bottom;
    const distanceFromHomeIndicator = homeIndicatorThreshold - (elem.y + elem.height);

    if (elem.y + elem.height > homeIndicatorThreshold) {
      violations.push(
        `HOME_INDICATOR_COLLISION: Element bottom (${elem.y + elem.height}pt) encroaches on Home Indicator zone (>= ${homeIndicatorThreshold}pt)`
      );
    }

    // 5. Ultra-Thin Bezel (1.15mm) Palm Rejection Margin
    const leftMargin = elem.x;
    const rightMargin = this.device.viewport.width - (elem.x + elem.width);
    const minBezelDistance = Math.min(leftMargin, rightMargin);

    if (isPortrait && (elem.x < 12 || elem.x + elem.width > this.device.viewport.width - 12)) {
      // Ak prvok nie je full-width kontajner
      if (elem.width < this.device.viewport.width - 24) {
        violations.push(
          `PALM_REJECTION_RISK: Interactive element is within 12pt of screen border (x: ${elem.x}pt). Prone to accidental touch rejection.`
        );
      }
    }

    return {
      elementId: elem.id,
      passed: violations.length === 0,
      violations,
      metrics: {
        touchAreaPx: elem.width * elem.height,
        meetsAppleHig,
        meetsWcagAa,
        distanceFromSubCameraPx: distanceFromSubCamera,
        distanceFromHomeIndicatorPx: distanceFromHomeIndicator,
        distanceFromBezelPx: minBezelDistance,
      },
    };
  }
}

describe("iPhone 17 Air (Slim) Comprehensive E2E QA Test Suite", () => {
  const auditor = new IPhone17AirAuditor(IPHONE_17_AIR_PORTRAIT);
  const landscapeAuditor = new IPhone17AirAuditor(IPHONE_17_AIR_LANDSCAPE);

  // ==========================================================================
  // SECTION 1: Top Navigation Bar & Sub-Camera Touch Anomaly
  // ==========================================================================
  describe("1. Top Bar & Sub-Camera Anomaly Zone Verification", () => {
    it("zlyhá, ak je tlačidlo 'Hľadať' umiestnené v anomálnej zóne y: 52px", () => {
      const flawedSearchButton: DOMRectBounds = {
        id: "btn-search-faulty",
        tagName: "BUTTON",
        role: "button",
        x: 180,
        y: 52, // V ZÓNE ANOMÁLIE (48..64)
        width: 44,
        height: 44,
      };

      const result = auditor.auditElement(flawedSearchButton);
      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.includes("SUB_CAMERA_GESTURE_SWALLOWED"))).toBe(true);
    });

    it("prejde pre produkčný ForenzDetectiv Header s odsadením y: 69px (--island-band)", () => {
      // V index.css: --island-band: calc(max(var(--safe-top), 52px) + 10px) = 59 + 10 = 69px
      const productionHeaderBackButton: DOMRectBounds = {
        id: "btn-header-back",
        tagName: "BUTTON",
        role: "button",
        x: 16,
        y: 70,
        width: 48,
        height: 48,
      };

      const productionHeaderFilter: DOMRectBounds = {
        id: "btn-header-filter",
        tagName: "BUTTON",
        role: "button",
        x: 356,
        y: 70,
        width: 48,
        height: 48,
      };

      const auditBack = auditor.auditElement(productionHeaderBackButton);
      const auditFilter = auditor.auditElement(productionHeaderFilter);

      expect(auditBack.passed).toBe(true);
      expect(auditFilter.passed).toBe(true);
      expect(auditBack.metrics.distanceFromSubCameraPx).toBeGreaterThanOrEqual(6);
      expect(auditFilter.metrics.distanceFromSubCameraPx).toBeGreaterThanOrEqual(6);
    });
  });

  // ==========================================================================
  // SECTION 2: Interactive Force-Directed Graph (GrafTab) on iPhone 17 Air
  // ==========================================================================
  describe("2. Interactive Graph Tab (GrafTab) Touch & Zoom Controls", () => {
    it("overí plávajúce zoom ovládače (+, −, Reset) v pravom dolnom rohu grafu", () => {
      // Zoom toolbar umiestnený nad navigačnou lištou s bezpečným paddingom
      const zoomInBtn: DOMRectBounds = {
        id: "btn-graph-zoom-in",
        tagName: "BUTTON",
        role: "button",
        x: 360,
        y: 700,
        width: 44,
        height: 44,
      };

      const zoomOutBtn: DOMRectBounds = {
        id: "btn-graph-zoom-out",
        tagName: "BUTTON",
        role: "button",
        x: 360,
        y: 750,
        width: 44,
        height: 44,
      };

      const auditIn = auditor.auditElement(zoomInBtn);
      const auditOut = auditor.auditElement(zoomOutBtn);

      expect(auditIn.passed).toBe(true);
      expect(auditOut.passed).toBe(true);
      expect(auditIn.metrics.meetsAppleHig).toBe(true);
      expect(auditOut.metrics.distanceFromHomeIndicatorPx).toBeGreaterThan(50);
    });

    it("overí dotykový terč uzla osoby v grafe (min. radius 24pt = 48x48pt hit box)", () => {
      const suspectGraphNode: DOMRectBounds = {
        id: "node-jan-novak-suspect",
        tagName: "DIV",
        role: "button",
        x: 186,
        y: 350,
        width: 48,
        height: 48,
      };

      const auditNode = auditor.auditElement(suspectGraphNode);
      expect(auditNode.passed).toBe(true);
      expect(auditNode.metrics.meetsAppleHig).toBe(true);
      expect(auditNode.metrics.meetsWcagAa).toBe(true);
    });

    it("verifikuje filtre rolí v grafe (Všetky, Podozriví, Alibi, Svedkovia)", () => {
      const roleChips: DOMRectBounds[] = [
        { id: "chip-all", tagName: "BUTTON", x: 16, y: 130, width: 80, height: 44 },
        { id: "chip-suspects", tagName: "BUTTON", x: 104, y: 130, width: 96, height: 44 },
        { id: "chip-alibi", tagName: "BUTTON", x: 208, y: 130, width: 80, height: 44 },
        { id: "chip-witnesses", tagName: "BUTTON", x: 296, y: 130, width: 96, height: 44 },
      ];

      for (const chip of roleChips) {
        const audit = auditor.auditElement(chip);
        expect(audit.passed).toBe(true);
        expect(audit.metrics.meetsAppleHig).toBe(true);
      }
    });
  });

  // ==========================================================================
  // SECTION 3: Bottom Navigation Bar & Home Indicator Zone
  // ==========================================================================
  describe("3. Bottom Navigation Bar & Home Indicator Swipe Avoidance", () => {
    it("zlyhá, ak navigačné tlačidlo zasahuje pod hranicu y: 878px", () => {
      const misplacedBottomTab: DOMRectBounds = {
        id: "tab-rozpory-misplaced",
        tagName: "BUTTON",
        role: "tab",
        x: 180,
        y: 860, // S výškou 48 končí na 908px -> kolízia s Home Indicatorom (>=878px)
        width: 60,
        height: 48,
      };

      const audit = auditor.auditElement(misplacedBottomTab);
      expect(audit.passed).toBe(false);
      expect(audit.violations.some((v) => v.includes("HOME_INDICATOR_COLLISION"))).toBe(true);
    });

    it("overí, že všetkých 5 tabov ForenzDetectiv rešpektuje Home Indicator padding", () => {
      // Výška nav baru = 76px, spodok je na y: 802px, tlačidlá majú y: 814px
      const navTabs: DOMRectBounds[] = [
        { id: "nav-tab-spis", tagName: "BUTTON", role: "tab", x: 16, y: 814, width: 64, height: 48 },
        { id: "nav-tab-timeline", tagName: "BUTTON", role: "tab", x: 96, y: 814, width: 64, height: 48 },
        { id: "nav-tab-graf", tagName: "BUTTON", role: "tab", x: 178, y: 814, width: 64, height: 48 },
        { id: "nav-tab-rozpory", tagName: "BUTTON", role: "tab", x: 260, y: 814, width: 64, height: 48 },
        { id: "nav-tab-asistent", tagName: "BUTTON", role: "tab", x: 340, y: 814, width: 64, height: 48 },
      ];

      for (const tab of navTabs) {
        const audit = auditor.auditElement(tab);
        expect(audit.passed).toBe(true);
        expect(audit.metrics.distanceFromHomeIndicatorPx).toBeGreaterThanOrEqual(16);
        expect(audit.metrics.meetsAppleHig).toBe(true);
      }
    });
  });

  // ==========================================================================
  // SECTION 4: HITL Contradiction Review & BottomSheet Drawer
  // ==========================================================================
  describe("4. HITL Contradiction Card & BottomSheet Modal Interaction", () => {
    it("overí akčné tlačidlá rozporu 'Potvrdiť rozpor' a 'Zamietnuť'", () => {
      const confirmButton: DOMRectBounds = {
        id: "btn-hitl-confirm",
        tagName: "BUTTON",
        role: "button",
        x: 20,
        y: 420,
        width: 180,
        height: 48,
      };

      const dismissButton: DOMRectBounds = {
        id: "btn-hitl-dismiss",
        tagName: "BUTTON",
        role: "button",
        x: 220,
        y: 420,
        width: 180,
        height: 48,
      };

      const auditConfirm = auditor.auditElement(confirmButton);
      const auditDismiss = auditor.auditElement(dismissButton);

      expect(auditConfirm.passed).toBe(true);
      expect(auditDismiss.passed).toBe(true);
      expect(auditConfirm.metrics.meetsWcagAa).toBe(true);
      expect(auditDismiss.metrics.meetsWcagAa).toBe(true);
    });

    it("overí BottomSheet zatváracie tlačidlo v pravom hornom rohu modálu", () => {
      const modalCloseButton: DOMRectBounds = {
        id: "btn-bottomsheet-close",
        tagName: "BUTTON",
        role: "button",
        x: 356,
        y: 260,
        width: 48,
        height: 48,
      };

      const auditClose = auditor.auditElement(modalCloseButton);
      expect(auditClose.passed).toBe(true);
      expect(auditClose.metrics.distanceFromBezelPx).toBeGreaterThanOrEqual(16);
    });
  });

  // ==========================================================================
  // SECTION 5: Landscape Mode & Dynamic Rotation (912 × 420 pt)
  // ==========================================================================
  describe("5. iPhone 17 Air Landscape Mode (912 × 420 pt) Safe Areas", () => {
    it("rešpektuje bočné Safe Area Insets (59px vľavo aj vpravo) pri otočení na ležato", () => {
      // V landscape móde je Dynamic Island na ľavej alebo pravej strane (safe-left/right: 59px)
      const landscapeLeftButton: DOMRectBounds = {
        id: "btn-landscape-left",
        tagName: "BUTTON",
        x: 70, // >= 59px safe margin
        y: 20,
        width: 48,
        height: 48,
      };

      const landscapeRightButton: DOMRectBounds = {
        id: "btn-landscape-right",
        tagName: "BUTTON",
        x: 790, // <= 912 - 59 = 853px
        y: 20,
        width: 48,
        height: 48,
      };

      const auditLeft = landscapeAuditor.auditElement(landscapeLeftButton);
      const auditRight = landscapeAuditor.auditElement(landscapeRightButton);

      expect(auditLeft.passed).toBe(true);
      expect(auditRight.passed).toBe(true);
    });
  });
});
