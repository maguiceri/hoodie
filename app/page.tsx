"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef, CSSProperties } from "react";

const HoodieViewer = dynamic(() => import("@/components/HoodieViewer"), {
  ssr: false,
  loading: () => <div style={{ height: "100vh", background: "#080808" }} />,
});

// ── IntersectionObserver hook ────────────────────────────────────
function useInView(threshold = 0.08) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          ob.disconnect();
        }
      },
      { threshold }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [threshold]);

  return [ref, visible] as const;
}

// ── Reveal component ─────────────────────────────────────────────
interface RevealProps {
  children: React.ReactNode;
  from?: "left" | "right" | "bottom";
  delay?: number;
  distance?: number;
  style?: CSSProperties;
}

function Reveal({ children, from = "left", delay = 0, distance = 56, style }: RevealProps) {
  const [ref, visible] = useInView();

  const hidden =
    from === "left"   ? `translateX(-${distance}px)` :
    from === "right"  ? `translateX(${distance}px)`  :
                        `translateY(${distance}px)`;

  return (
    <div
      ref={ref}
      style={{
        opacity:    visible ? 1 : 0,
        transform:  visible ? "none" : hidden,
        transition: `opacity 0.7s ease ${delay}ms, transform 0.85s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Cursor ───────────────────────────────────────────────────────
function CursorGlow() {
  const dotRef  = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const seenRef = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!seenRef.current) { seenRef.current = true; setVisible(true); }
      const x = e.clientX + "px";
      const y = e.clientY + "px";
      if (dotRef.current)  { dotRef.current.style.left  = x; dotRef.current.style.top  = y; }
      if (glowRef.current) { glowRef.current.style.left = x; glowRef.current.style.top = y; }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const base: React.CSSProperties = {
    position: "fixed", pointerEvents: "none",
    transform: "translate(-50%, -50%)",
    opacity: visible ? 1 : 0,
  };

  return (
    <>
      {/* Ambient glow */}
      <div ref={glowRef} style={{
        ...base,
        zIndex: 9989,
        width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 45%, transparent 70%)",
        transition: "opacity 0.6s ease",
        mixBlendMode: "screen",
      }} />
      {/* Visible dot */}
      <div ref={dotRef} style={{
        ...base,
        zIndex: 9990,
        width: 8, height: 8, borderRadius: "50%",
        background: "#ffffff",
        boxShadow: "0 0 8px rgba(255,255,255,0.5)",
        transition: "opacity 0.3s ease",
      }} />
    </>
  );
}

// ── Product Card ─────────────────────────────────────────────────
interface Drop { name: string; ref: string; price: string; image: string; }

function ProductCard({ item }: { item: Drop }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ position: "relative", aspectRatio: "3/4", overflow: "hidden", background: "#111" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img
        src={item.image}
        alt={item.name}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover", objectPosition: "center top",
          transform: hovered ? "scale(1.06)" : "scale(1)",
          transition: "transform 0.8s cubic-bezier(0.25,0.46,0.45,0.94)",
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: hovered ? "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.22) 50%, rgba(0,0,0,0.08) 100%)" : "linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)", transition: "background 0.4s" }} />
      <div style={{ position: "absolute", top: 20, right: 20 }}>
        <span style={{ fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: "#ffffff55" }}>Coming Soon</span>
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "24px", transform: hovered ? "translateY(0)" : "translateY(8px)", opacity: hovered ? 1 : 0.75, transition: "transform 0.35s, opacity 0.35s" }}>
        <div style={{ fontSize: 10, letterSpacing: 4, textTransform: "uppercase", color: "#ffffff70", marginBottom: 4 }}>{item.ref}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 16, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{item.name}</div>
          <div style={{ fontSize: 14, fontWeight: 300, color: "#ffffffaa" }}>{item.price}</div>
        </div>
      </div>
    </div>
  );
}

// ── Data ─────────────────────────────────────────────────────────
const SIZES = ["XS", "S", "M", "L", "XL"];

const DROPS: Drop[] = [
  { name: "Knit Sweater", ref: "VS-002", price: "$240", image: "/card1.jpg" },
  { name: "Tech Jacket",  ref: "VS-003", price: "$380", image: "/card2.jpg" },
  { name: "Cargo Pant",   ref: "VS-004", price: "$220", image: "/card3.jpg" },
];

const CARD_DIRS = ["left", "bottom", "right"] as const;

// ── Main Page ────────────────────────────────────────────────────
export default function Home() {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [addedToBag, setAddedToBag]     = useState(false);

  const handleAdd = () => {
    if (!selectedSize) return;
    setAddedToBag(true);
    setTimeout(() => setAddedToBag(false), 2000);
  };

  return (
    <>
      <CursorGlow />

      <div style={{ background: "#080808", minHeight: "100vh", color: "#fff", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>

        {/* ── NAV — CSS animation (siempre visible, no observer) ── */}
        <nav className="nav-pad" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 200, display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(to bottom, rgba(8,8,8,0.95) 0%, transparent 100%)" }}>
          <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 8, textTransform: "uppercase", animation: "slideFromLeft 0.8s cubic-bezier(0.22,1,0.36,1) 0.1s both", opacity: 1 }}>
            VOID
          </div>
          <div className="nav-menu" style={{ fontSize: 10, letterSpacing: 4, textTransform: "uppercase", color: "#ffffff45", animation: "slideFromRight 0.8s cubic-bezier(0.22,1,0.36,1) 0.25s both" }}>
            {["Collection", "Studio", "Archive", "Bag (0)"].map((link) => (
              <span key={link} style={{ transition: "color 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#ffffff45")}
              >
                {link}
              </span>
            ))}
          </div>
        </nav>

        {/* ── HERO ── */}
        <section>
          <HoodieViewer />
        </section>

        {/* ── MARQUEE — sube desde abajo ── */}
        <Reveal from="bottom" distance={40}>
          <div style={{ background: "#d4ff00", color: "#080808", padding: "13px 0", overflow: "hidden", borderTop: "1px solid #c8f000" }}>
            <div style={{ display: "inline-block", whiteSpace: "nowrap", animation: "marquee 28s linear infinite" }}>
              {[0, 1].map((i) => (
                <span key={i} style={{ fontSize: 11, fontWeight: 800, letterSpacing: 5, textTransform: "uppercase" }}>
                  VOID STUDIO &nbsp;—&nbsp; AW 25 COLLECTION &nbsp;—&nbsp; LIMITED TO 50 UNITS &nbsp;—&nbsp; FREE WORLDWIDE SHIPPING &nbsp;—&nbsp; MADE IN PORTUGAL &nbsp;—&nbsp; HEAVY COTTON TERRY 450GSM &nbsp;—&nbsp;&nbsp;&nbsp;&nbsp;
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        {/* ── PRODUCT SECTION ── */}
        <section className="product-section" style={{ borderBottom: "1px solid #ffffff08" }}>

          {/* Col izq — entra desde la izquierda */}
          <Reveal from="left" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 6, color: "#ffffff25", textTransform: "uppercase", marginBottom: 28 }}>
                Drop 001 &nbsp;/&nbsp; Autumn Winter 2025
              </div>
              <h2 style={{ fontSize: "clamp(48px, 7vw, 108px)", fontWeight: 900, textTransform: "uppercase", lineHeight: 0.86, letterSpacing: -3, margin: 0 }}>
                ESSEN<br />TIAL<br />
                <span style={{ WebkitTextStroke: "1.5px #ffffff", color: "transparent", display: "inline-block" }}>HOODIE</span>
              </h2>
            </div>
            <div style={{ marginTop: 56 }}>
              <div style={{ width: 40, height: 1, background: "#ffffff20", marginBottom: 24 }} />
              <p style={{ fontSize: 13, lineHeight: 1.9, color: "#ffffff45", maxWidth: 380, margin: 0 }}>
                Oversized silhouette. 450gsm heavy cotton terry. Unlined hood. Dropped shoulders. Rib-knit cuffs and hem. Garment-dyed finish. Made in Portugal in a single limited run.
              </p>
            </div>
          </Reveal>

          {/* Col der — entra desde la derecha */}
          <Reveal from="right" delay={100} style={{ display: "flex", flexDirection: "column", gap: 40, justifyContent: "center" }}>
            {/* Precio */}
            <div>
              <div style={{ fontSize: 10, letterSpacing: 4, color: "#ffffff25", textTransform: "uppercase", marginBottom: 10 }}>Price</div>
              <div style={{ fontSize: 48, fontWeight: 200, letterSpacing: -2 }}>$280.00</div>
            </div>

            {/* Tallas */}
            <div>
              <div style={{ fontSize: 10, letterSpacing: 4, color: "#ffffff25", textTransform: "uppercase", marginBottom: 16 }}>Size</div>
              <div style={{ display: "flex", gap: 8 }}>
                {SIZES.map((sz) => (
                  <button key={sz} onClick={() => setSelectedSize(sz)}
                    style={{ width: 52, height: 52, border: selectedSize === sz ? "1px solid #fff" : "1px solid #ffffff18", background: selectedSize === sz ? "#fff" : "transparent", color: selectedSize === sz ? "#080808" : "#ffffff40", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", transition: "all 0.18s", fontWeight: selectedSize === sz ? 800 : 400, cursor: "none" }}
                    onMouseEnter={(e) => { if (selectedSize !== sz) { e.currentTarget.style.borderColor = "#ffffff50"; e.currentTarget.style.color = "#ffffff80"; } }}
                    onMouseLeave={(e) => { if (selectedSize !== sz) { e.currentTarget.style.borderColor = "#ffffff18"; e.currentTarget.style.color = "#ffffff40"; } }}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Add to Bag */}
            <button onClick={handleAdd}
              style={{ background: addedToBag ? "#fff" : selectedSize ? "#d4ff00" : "transparent", color: addedToBag ? "#080808" : selectedSize ? "#080808" : "#ffffff25", border: selectedSize ? "none" : "1px solid #ffffff18", padding: "22px 40px", fontSize: 11, fontWeight: 800, letterSpacing: 5, textTransform: "uppercase", transition: "all 0.2s", marginTop: 8, cursor: "none" }}
              onMouseEnter={(e) => { if (selectedSize && !addedToBag) e.currentTarget.style.opacity = "0.85"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              {addedToBag ? "Added ✓" : selectedSize ? `Add to Bag — ${selectedSize}` : "Select a Size"}
            </button>

            <div style={{ fontSize: 10, letterSpacing: 2, color: "#ffffff18", textTransform: "uppercase", lineHeight: 1.8 }}>
              Free shipping worldwide<br />Returns accepted within 14 days
            </div>
          </Reveal>
        </section>

        {/* ── COLLECTION GRID ── */}
        <section className="collection-section">
          {/* Header — izq/der */}
          <div className="collection-head">
            <Reveal from="left">
              <div>
                <div style={{ fontSize: 10, letterSpacing: 6, color: "#ffffff25", textTransform: "uppercase", marginBottom: 12 }}>AW 25 — Full Drop</div>
                <h3 style={{ fontSize: "clamp(24px, 3vw, 40px)", fontWeight: 800, textTransform: "uppercase", letterSpacing: -1, margin: 0 }}>More from the Collection</h3>
              </div>
            </Reveal>
            <Reveal from="right" delay={100}>
              <span style={{ fontSize: 10, letterSpacing: 4, textTransform: "uppercase", color: "#ffffff25", transition: "color 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#ffffff25")}
              >
                View All →
              </span>
            </Reveal>
          </div>

          {/* Cards — izq / abajo / der (staggered) */}
          <div className="drops-grid">
            {DROPS.map((item, i) => (
              <Reveal key={item.ref} from={CARD_DIRS[i]} delay={i * 100}>
                <ProductCard item={item} />
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── STUDIO BAND ── */}
        <div className="studio-section" style={{ borderTop: "1px solid #ffffff08", borderBottom: "1px solid #ffffff08" }}>
          <Reveal from="left" style={{ flex: 1 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 6, color: "#ffffff20", textTransform: "uppercase", marginBottom: 16 }}>About the Studio</div>
              <p style={{ fontSize: 22, fontWeight: 300, lineHeight: 1.5, color: "#ffffff70", maxWidth: 600, margin: 0, letterSpacing: -0.5 }}>
                "We make clothes for people who move through the world quietly but with intention. No logos. No noise. Just material, form, and weight."
              </p>
            </div>
          </Reveal>
          <div className="studio-wordmark">
            <Reveal from="right" delay={150}>
              <div style={{ fontSize: "clamp(48px, 8vw, 120px)", fontWeight: 900, letterSpacing: -4, textTransform: "uppercase", WebkitTextStroke: "1px #ffffff15", color: "transparent", userSelect: "none" }}>
                VOID
              </div>
            </Reveal>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <footer className="footer-bar" style={{ borderTop: "1px solid #ffffff08" }}>
          <Reveal from="left">
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 8, textTransform: "uppercase" }}>VOID</div>
          </Reveal>
          <Reveal from="bottom" delay={80}>
            <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#ffffff18" }}>
              © 2025 Void Studio. All rights reserved.
            </div>
          </Reveal>
          <Reveal from="right" delay={160}>
            <div style={{ display: "flex", gap: 28, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#ffffff28" }}>
              {["Instagram", "Privacy", "Contact"].map((l) => (
                <span key={l} style={{ transition: "color 0.2s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#ffffff28")}
                >
                  {l}
                </span>
              ))}
            </div>
          </Reveal>
        </footer>

      </div>
    </>
  );
}
