export const T = {
    // ── Backgrounds (3-layer depth) ──────────────────
    bgBase: "#06090f",      // deepest — root screens
    bgSurface: "#0c1422",   // cards, panels, tab bar
    bgElevated: "#111d30",  // modals, bottom sheets, raised cards
    bgInput: "#091018",     // text inputs / textareas

    // ── Borders ──────────────────────────────────────
    bdDim: "#112030",       // hairline separators
    bdDefault: "#1a2e45",   // card borders
    bdBright: "#253f5e",    // interactive borders, focus rings

    // ── Text ─────────────────────────────────────────
    tx1: "#e8edf5",         // primary text
    tx2: "#8fa4bf",         // secondary / labels
    tx3: "#475e78",         // muted / placeholders / eyebrows

    // ── Semantic Accents ─────────────────────────────
    // Emerald → Success / Verified / Approved / Stream Open
    emerald: "#0dd98c",
    emeraldDim: "rgba(13,217,140,0.10)",
    emeraldBd: "rgba(13,217,140,0.30)",

    // Amber → Pending / HITL / Action Required / Connecting
    amber: "#f5b732",
    amberDim: "rgba(245,183,50,0.10)",
    amberBd: "rgba(245,183,50,0.30)",

    // Crimson → Failure / Crashed / Error / Context Overflow
    crimson: "#f04560",
    crimsonDim: "rgba(240,69,96,0.10)",
    crimsonBd: "rgba(240,69,96,0.30)",

    // Blue → LLM Calls / Info / Stream Polling
    blue: "#4da6ff",
    blueDim: "rgba(77,166,255,0.10)",
    blueBd: "rgba(77,166,255,0.30)",
    blueRgb: "77,166,255", // for chart-kit's (opacity) => rgba(...) callback

    // Emerald RGB for chart callbacks
    emeraldRgb: "13,217,140",
    crimsonRgb: "240,69,96",
    violetRgb: "147,112,240",
    amberRgb: "245,183,50",

    // Violet → Decision / Contract Gate / Rejected
    violet: "#9370f0",
    violetDim: "rgba(147,112,240,0.10)",
    violetBd: "rgba(147,112,240,0.30)",

    // Orange → Recovery / Reconnecting / Graph Cycle
    orange: "#ff7849",
    orangeDim: "rgba(255,120,73,0.10)",
    orangeBd: "rgba(255,120,73,0.30)",

    // Slate → Idle / Initialized / Thinking
    slate: "#8fa4bf",
    slateDim: "rgba(143,164,191,0.08)",
    slateBd: "rgba(143,164,191,0.20)",

    // ── Overlays ─────────────────────────────────────
    scrimBg: "rgba(0,0,0,0.85)",
    scrimAmberTint: "rgba(245,183,50,0.04)",

    // ── Spacing (8px base grid) ───────────────────────
    sp1: 4,
    sp2: 8,
    sp3: 12,
    sp4: 16,
    sp5: 20,
    sp6: 24,

    // ── Border Radius ─────────────────────────────────
    rSm: 6,
    rMd: 10,
    rLg: 14,
    rXl: 20,
    rFull: 999,

    // ── Typography ────────────────────────────────────
    fontMono: "Menlo" as const,

    // ── Shadows ───────────────────────────────────────
    shadowCard: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 4,
    },
    shadowModal: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.7,
        shadowRadius: 24,
        elevation: 12,
    },
} as const;
