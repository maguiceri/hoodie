"use client";

import {
  Suspense, useRef, useState, useMemo,
  useEffect, useLayoutEffect, useCallback,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  useGLTF, Environment, ContactShadows,
  OrbitControls, useProgress,
} from "@react-three/drei";
import * as THREE from "three";

// ── Colores ──────────────────────────────────────────────────────
const COLORS = [
  { label: "Negro",  hex: "#111111" },
  { label: "Blanco", hex: "#eeeeee" },
  { label: "Navy",   hex: "#0f1f3d" },
  { label: "Gris",   hex: "#3a3a3a" },
  { label: "Beige",  hex: "#c8b89a" },
  { label: "Rojo",   hex: "#8b1a1a" },
];

const BLOCK = 16; // px por bloque de pixel

interface MaskData {
  mask: boolean[]; // true = bloque sobre el hoodie
  cols: number;
  rows: number;
}

// ── Captura de máscara (dentro del Canvas) ────────────────────────
// Lee los píxeles del framebuffer de WebGL para saber dónde está el hoodie
function FrameCapture({ onCapture }: { onCapture: (d: MaskData) => void }) {
  const { gl } = useThree();
  const frameCount = useRef(0);
  const captured   = useRef(false);

  useFrame(() => {
    if (captured.current) return;
    // Esperar 3 frames para asegurarse de que el modelo ya se renderizó
    if (++frameCount.current < 3) return;
    captured.current = true;

    const cvs = gl.domElement;
    const W   = cvs.width;
    const H   = cvs.height;
    const dpr = window.devicePixelRatio || 1;
    const cols = Math.ceil((W / dpr) / BLOCK);
    const rows = Math.ceil((H / dpr) / BLOCK);

    // Leer píxeles del framebuffer de WebGL
    const glCtx   = gl.getContext() as WebGLRenderingContext;
    const pixels  = new Uint8Array(W * H * 4);
    glCtx.readPixels(0, 0, W, H, glCtx.RGBA, glCtx.UNSIGNED_BYTE, pixels);

    const mask: boolean[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Centro del bloque en píxeles CSS → píxeles físicos
        const cssPx = c * BLOCK + BLOCK / 2;
        const cssPy = r * BLOCK + BLOCK / 2;
        const px = Math.min(Math.round(cssPx * dpr), W - 1);
        // WebGL usa Y invertido (bottom-left origin)
        const py = Math.min(H - Math.round(cssPy * dpr) - 1, H - 1);
        const idx = (py * W + px) * 4;
        const pR = pixels[idx];
        const pG = pixels[idx + 1];
        const pB = pixels[idx + 2];
        // Fondo = #080808 ≈ (8,8,8). El hoodie (blanco por defecto) es mucho más brillante
        mask.push(pR > 18 || pG > 18 || pB > 18);
      }
    }

    onCapture({ mask, cols, rows });
  });

  return null;
}

// ── Pixel overlay (fuera del Canvas) ─────────────────────────────
function PixelOverlay({ active, maskData }: { active: boolean; maskData: MaskData | null }) {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const rafRef        = useRef<number>(0);
  const revealStarted = useRef(false);

  // Inicializar: cubrir toda la pantalla con color oscuro mientras carga
  useLayoutEffect(() => {
    const cvs = canvasRef.current!;
    cvs.width  = cvs.offsetWidth;
    cvs.height = cvs.offsetHeight;
    const ctx = cvs.getContext("2d")!;
    ctx.fillStyle = "#080808";
    ctx.fillRect(0, 0, cvs.width, cvs.height);
  }, []);

  // Cuando llega la máscara: dibujar bloques solo donde está el hoodie
  useLayoutEffect(() => {
    if (!maskData) return;
    const cvs = canvasRef.current!;
    const ctx  = cvs.getContext("2d")!;
    const { mask, cols } = maskData;

    // Limpiar cobertura total, dejar solo bloques del hoodie
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) continue;
      const c = i % cols;
      const r = Math.floor(i / cols);
      const v = 6 + Math.floor(Math.random() * 16);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(c * BLOCK, r * BLOCK, BLOCK, BLOCK);
    }
  }, [maskData]);

  // Cuando active=true: scatter reveal solo en los bloques del hoodie
  useEffect(() => {
    if (!active || revealStarted.current || !maskData) return;
    revealStarted.current = true;

    const cvs = canvasRef.current!;
    const ctx  = cvs.getContext("2d")!;
    const { mask, cols } = maskData;

    // Solo los índices con hoodie, en orden aleatorio
    const blocks: number[] = [];
    for (let i = 0; i < mask.length; i++) {
      if (mask[i]) blocks.push(i);
    }
    for (let i = blocks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    }

    const N          = blocks.length;
    const flashQueue: number[] = [];
    let revealed     = 0;
    const DURATION   = 1600;
    const start      = performance.now();

    const tick = (now: number) => {
      const t      = Math.min((now - start) / DURATION, 1);
      const eased  = 1 - Math.pow(1 - t, 2.5);
      const target = Math.floor(eased * N);

      // Limpiar los que ya flashearon → revelar hoodie debajo
      for (const idx of flashQueue) {
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        ctx.clearRect(c * BLOCK, r * BLOCK, BLOCK, BLOCK);
      }
      flashQueue.length = 0;

      // Nuevos bloques: micro-flash blanco antes de desaparecer
      while (revealed < target) {
        const idx = blocks[revealed];
        const c   = idx % cols;
        const r   = Math.floor(idx / cols);
        ctx.fillStyle = "rgba(255,255,255,0.42)";
        ctx.fillRect(c * BLOCK, r * BLOCK, BLOCK, BLOCK);
        flashQueue.push(idx);
        revealed++;
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        for (const idx of flashQueue) {
          const c = idx % cols;
          const r = Math.floor(idx / cols);
          ctx.clearRect(c * BLOCK, r * BLOCK, BLOCK, BLOCK);
        }
        cvs.style.transition = "opacity 0.5s ease";
        cvs.style.opacity    = "0";
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, maskData]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute", inset: 0,
        width: "100%", height: "100%",
        zIndex: 20, pointerEvents: "none",
        display: "block",
      }}
    />
  );
}

// ── Modelo 3D ─────────────────────────────────────────────────────
function HoodieModel({ color }: { color: string }) {
  const { scene } = useGLTF("/hoodie.glb");
  const floatRef  = useRef<THREE.Group>(null);

  const [modelScale, modelOffset] = useMemo(() => {
    const box    = new THREE.Box3().setFromObject(scene);
    const size   = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s      = 1.7 / Math.max(size.x, size.y, size.z);
    return [s, [-center.x * s, -center.y * s, -center.z * s] as [number, number, number]];
  }, [scene]);

  useEffect(() => {
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      list.forEach((m) => {
        (m as THREE.MeshStandardMaterial).color.set(color);
        mesh.castShadow    = true;
        mesh.receiveShadow = true;
      });
    });
  }, [scene, color]);

  useFrame(({ clock }) => {
    if (floatRef.current) {
      floatRef.current.position.y = Math.sin(clock.elapsedTime * 0.75) * 0.07;
    }
  });

  return (
    <group ref={floatRef}>
      <primitive object={scene} scale={modelScale} position={modelOffset} />
    </group>
  );
}

// ── Componente principal ──────────────────────────────────────────
export default function HoodieViewer() {
  const [activeColor, setActiveColor] = useState(COLORS[1].hex);
  const { progress } = useProgress();
  const [maskData, setMaskData]       = useState<MaskData | null>(null);
  const onCapture = useCallback((d: MaskData) => setMaskData(d), []);

  const active = progress >= 100 && maskData !== null;

  return (
    <div
      style={{
        width: "100%", height: "100vh",
        background: "#080808",
        position: "relative", overflow: "hidden",
        fontFamily: "'Helvetica Neue', sans-serif",
      }}
    >
      {/* Grain */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
        opacity: 0.35,
      }} />

      {/* Label */}
      <div style={{
        position: "absolute", top: 80, left: "50%",
        transform: "translateX(-50%)",
        zIndex: 25, textAlign: "center", pointerEvents: "none",
      }}>
        <div style={{ color: "#ffffff18", fontSize: 10, letterSpacing: 6, textTransform: "uppercase", marginBottom: 8 }}>
          VS-001 / AW 25
        </div>
        <div style={{ color: "#ffffffbb", fontSize: 20, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase" }}>
          Essential Hoodie
        </div>
      </div>

      {/* Canvas 3D — preserveDrawingBuffer necesario para readPixels */}
      <Canvas
        shadows
        camera={{ position: [0, 0, 3.2], fov: 38 }}
        style={{ position: "absolute", inset: 0, cursor: "none" }}
        gl={{ preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          canvas.style.cursor = "none";
          const observer = new MutationObserver(() => {
            if (canvas.style.cursor !== "none") canvas.style.cursor = "none";
          });
          observer.observe(canvas, { attributes: true, attributeFilter: ["style"] });
        }}
      >
        <Suspense fallback={null}>
          <Environment preset="studio" />
          <ambientLight intensity={0.5} />
          <directionalLight position={[3, 5, 3]} intensity={1.8} castShadow />
          <directionalLight position={[-4, 2, -3]} intensity={0.6} color="#6688ff" />
          <HoodieModel color={activeColor} />
          <ContactShadows position={[0, -1.1, 0]} opacity={0.18} scale={3} blur={4} far={2} />
          <OrbitControls
            enableZoom={false} enablePan={false}
            minPolarAngle={Math.PI * 0.25} maxPolarAngle={Math.PI * 0.75}
            rotateSpeed={0.6} dampingFactor={0.08} enableDamping
          />
          {/* Captura la forma del hoodie desde el framebuffer */}
          <FrameCapture onCapture={onCapture} />
        </Suspense>
      </Canvas>

      {/* Pixel overlay — solo sobre los píxeles del hoodie */}
      <PixelOverlay active={active} maskData={maskData} />

      {/* Color selector */}
      <div style={{
        position: "absolute", bottom: 40, left: "50%",
        transform: "translateX(-50%)",
        zIndex: 25, display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
      }}>
        <div style={{ color: "#ffffff35", fontSize: 10, letterSpacing: 4, textTransform: "uppercase" }}>
          Color
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {COLORS.map((c) => (
            <button
              key={c.hex}
              onClick={() => setActiveColor(c.hex)}
              title={c.label}
              style={{
                width: 28, height: 28, borderRadius: "50%",
                background: c.hex,
                border: activeColor === c.hex ? "2px solid #fff" : "2px solid #ffffff25",
                transition: "transform 0.2s, border 0.2s, box-shadow 0.2s",
                transform: activeColor === c.hex ? "scale(1.25)" : "scale(1)",
                boxShadow: activeColor === c.hex ? `0 0 14px ${c.hex}99` : "none",
                cursor: "none",
              }}
            />
          ))}
        </div>
        <div style={{ color: "#ffffff25", fontSize: 10, letterSpacing: 3, textTransform: "uppercase" }}>
          Arrastrá para rotar
        </div>
      </div>
    </div>
  );
}

useGLTF.preload("/hoodie.glb");
