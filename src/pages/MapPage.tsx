/**
 * 3D 地图卡片 — Three.js + Toon Shading
 * 显示用户去过的地方，立体地球渲染
 * 对标 Day Lab MapCard
 */
import { useRef, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import * as THREE from "three";
import { ChevronLeft, Plus, MapPin, X, Check } from "lucide-react";

interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  emoji: string;
  note?: string;
  visitedAt: string;
}

function latLngToVec3(lat: number, lng: number, radius = 1): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

export default function MapPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const globeRef = useRef<THREE.Mesh | null>(null);
  const frameRef = useRef<number>(0);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const rotation = useRef({ x: 0.3, y: 0 });

  const [places, setPlaces] = useState<Place[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newPlace, setNewPlace] = useState({ name: "", lat: "", lng: "", emoji: "📍", note: "" });
  const [saving, setSaving] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  // Load places from Supabase
  useEffect(() => {
    if (!user) return;
    supabase.from("user_places").select("*").eq("user_id", user.id).order("visited_at", { ascending: false })
      .then(({ data }) => {
        if (data) setPlaces(data.map((r: any) => ({
          id: r.id, name: r.name, lat: r.lat, lng: r.lng,
          emoji: r.emoji || "📍", note: r.note, visitedAt: r.visited_at,
        })));
      });
  }, [user]);

  // Three.js setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 2.8);
    cameraRef.current = camera;

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffd9a0, 1.2);
    dirLight.position.set(3, 2, 2);
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0x8ab4d4, 0.3);
    fillLight.position.set(-2, -1, -1);
    scene.add(fillLight);

    // Globe — toon-shaded sphere
    const geo = new THREE.SphereGeometry(1, 64, 64);

    // Toon gradient texture (3-step like Day Lab)
    const gradData = new Uint8Array([60, 140, 230]);
    const gradTex = new THREE.DataTexture(gradData, 3, 1, THREE.RedFormat);
    gradTex.minFilter = THREE.NearestFilter;
    gradTex.magFilter = THREE.NearestFilter;
    gradTex.needsUpdate = true;

    const mat = new THREE.MeshToonMaterial({
      color: new THREE.Color(0x4a9f6a),
      gradientMap: gradTex,
    });
    const globe = new THREE.Mesh(geo, mat);
    globeRef.current = globe;
    scene.add(globe);

    // Ocean layer (slightly larger, blue toon)
    const oceanGeo = new THREE.SphereGeometry(0.998, 64, 64);
    const oceanMat = new THREE.MeshToonMaterial({ color: 0x1a6a9f, gradientMap: gradTex });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    scene.add(ocean);

    // Stars background
    const starGeo = new THREE.BufferGeometry();
    const starVerts: number[] = [];
    for (let i = 0; i < 2000; i++) {
      starVerts.push((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40);
    }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starVerts, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.02, transparent: true, opacity: 0.6 }));
    scene.add(stars);

    // Animate
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      globe.rotation.y = rotation.current.y;
      globe.rotation.x = rotation.current.x;
      ocean.rotation.y = rotation.current.y;
      ocean.rotation.x = rotation.current.x;
      // Auto-rotate when not dragging
      if (!isDragging.current) rotation.current.y += 0.003;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameRef.current);
      renderer.dispose();
    };
  }, []);

  // Render place markers as HTML overlays
  const placeMarkers = useMemo(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cameraRef.current) return [];
    return places.map(p => {
      const pos = latLngToVec3(p.lat, p.lng, 1.05);
      const rotated = pos.clone().applyEuler(new THREE.Euler(rotation.current.x, rotation.current.y, 0));
      if (rotated.z < 0) return null; // behind globe
      const projected = rotated.clone().project(cameraRef.current!);
      const x = (projected.x + 1) / 2 * canvas.clientWidth;
      const y = (-projected.y + 1) / 2 * canvas.clientHeight;
      return { ...p, screenX: x, screenY: y };
    }).filter(Boolean);
  }, [places, rotation.current.y]);

  // Mouse/touch handlers
  const onMouseDown = (e: React.MouseEvent) => { isDragging.current = true; lastMouse.current = { x: e.clientX, y: e.clientY }; };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    rotation.current.y += dx * 0.008;
    rotation.current.x += dy * 0.008;
    rotation.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotation.current.x));
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseUp = () => { isDragging.current = false; };

  const addPlace = async () => {
    if (!user || !newPlace.name || !newPlace.lat || !newPlace.lng) return;
    setSaving(true);
    const row = {
      user_id: user.id, name: newPlace.name,
      lat: parseFloat(newPlace.lat), lng: parseFloat(newPlace.lng),
      emoji: newPlace.emoji, note: newPlace.note, visited_at: new Date().toISOString(),
    };
    const { data } = await supabase.from("user_places").insert(row).select().single();
    if (data) setPlaces(p => [{ id: data.id, name: data.name, lat: data.lat, lng: data.lng, emoji: data.emoji, note: data.note, visitedAt: data.visited_at }, ...p]);
    setNewPlace({ name: "", lat: "", lng: "", emoji: "📍", note: "" });
    setShowAdd(false);
    setSaving(false);
  };

  return (
    <div className="flex flex-col h-full max-w-[900px] mx-auto bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-[52px] border-b border-border flex-shrink-0 bg-surface-1/90 backdrop-blur-sm z-10">
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(-1)} className="touch-target text-muted-foreground hover:text-foreground rounded-xl" style={{transform:"scale(0.85)"}}>
            <ChevronLeft size={22} />
          </button>
          <h1 className="font-serif-sc text-base text-foreground">我去过的地方</h1>
          <span className="text-caption text-muted-foreground ml-1">({places.length})</span>
        </div>
        <button onClick={() => setShowAdd(true)} className="touch-target text-primary hover:bg-primary/10 rounded-xl" style={{transform:"scale(0.85)"}}>
          <Plus size={20} />
        </button>
      </div>

      {/* 3D Globe */}
      <div className="relative flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        />

        {/* Place markers */}
        {places.slice(0, 30).map((p, i) => (
          <button key={p.id}
            onClick={() => setSelectedPlace(selectedPlace?.id === p.id ? null : p)}
            className="absolute pointer-events-auto z-20 transform -translate-x-1/2 -translate-y-1/2 transition-all hover:scale-125"
            style={{ left: `${50 + (i % 7) * 7 - 21}%`, top: `${20 + (i % 5) * 15}%` }}>
            <span className="text-lg drop-shadow-lg">{p.emoji}</span>
          </button>
        ))}

        {/* Drag hint */}
        <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-label text-muted-foreground/50 pointer-events-none">
          拖动旋转地球
        </p>
      </div>

      {/* Places list */}
      <div className="border-t border-border bg-surface-1">
        <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-none">
          {places.slice(0, 10).map(p => (
            <button key={p.id} onClick={() => setSelectedPlace(p)}
              className="flex-shrink-0 flex items-center gap-1.5 bg-card border border-border rounded-xl px-3 py-1.5 hover:bg-surface-2 transition">
              <span>{p.emoji}</span>
              <span className="text-caption text-foreground whitespace-nowrap">{p.name}</span>
            </button>
          ))}
          {places.length === 0 && (
            <p className="text-caption text-muted-foreground py-1">点击 + 添加你去过的地方</p>
          )}
        </div>
      </div>

      {/* Place detail popup */}
      {selectedPlace && (
        <div className="absolute bottom-20 left-4 right-4 bg-surface-1 border border-border rounded-xl p-4 shadow-lg z-30 max-w-[400px] mx-auto">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{selectedPlace.emoji}</span>
              <div><p className="text-sm font-semibold text-foreground">{selectedPlace.name}</p>
                <p className="text-caption text-muted-foreground">{selectedPlace.lat.toFixed(2)}, {selectedPlace.lng.toFixed(2)}</p>
              </div>
            </div>
            <button onClick={() => setSelectedPlace(null)} className="text-muted-foreground"><X size={14} /></button>
          </div>
          {selectedPlace.note && <p className="text-sm text-foreground mt-2 leading-relaxed">{selectedPlace.note}</p>}
          <p className="text-label text-muted-foreground mt-1">{selectedPlace.visitedAt.slice(0, 10)}</p>
        </div>
      )}

      {/* Add place sheet */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="w-full max-w-[600px] mx-auto bg-surface-1 rounded-t-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-foreground font-serif-sc">添加地点</p>
              <button onClick={() => setShowAdd(false)} className="text-muted-foreground"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input value={newPlace.emoji} onChange={e => setNewPlace(p => ({...p, emoji: e.target.value}))}
                  className="w-14 bg-surface-2 border border-border rounded-xl text-center text-xl focus:outline-none" maxLength={2} />
                <input value={newPlace.name} onChange={e => setNewPlace(p => ({...p, name: e.target.value}))}
                  placeholder="地点名称" className="flex-1 bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary" />
              </div>
              <div className="flex gap-2">
                <input value={newPlace.lat} onChange={e => setNewPlace(p => ({...p, lat: e.target.value}))}
                  placeholder="纬度 (如 39.9)" className="flex-1 bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                <input value={newPlace.lng} onChange={e => setNewPlace(p => ({...p, lng: e.target.value}))}
                  placeholder="经度 (如 116.4)" className="flex-1 bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary" />
              </div>
              <input value={newPlace.note} onChange={e => setNewPlace(p => ({...p, note: e.target.value}))}
                placeholder="备注（选填）" className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary" />
              <button onClick={addPlace} disabled={saving || !newPlace.name || !newPlace.lat}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-30">
                {saving ? "保存中…" : "添加到地图"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
