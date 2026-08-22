/**
 * 3D 地图 — 纯 Three.js（通过 script 标签动态加载，无 npm 依赖冲突）
 */
import { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Plus, X } from "lucide-react";
import { toast } from "sonner";

interface Place {
  id: string; name: string; lat: number; lng: number;
  emoji: string; note?: string; visitedAt: string;
}

// 之前这个Promise只有onload会resolve——CDN被墙/离线/广告拦截器拦截脚本时，
// onload永远不触发，Promise永远pending，页面就一直停在空白canvas，
// 没有任何报错也没有重试入口。现在加上onerror的reject和10秒超时兜底。
function loadThree(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).THREE) { resolve((window as any).THREE); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    const timer = setTimeout(() => reject(new Error("加载地球组件超时，请检查网络")), 10000);
    s.onload = () => { clearTimeout(timer); resolve((window as any).THREE); };
    s.onerror = () => { clearTimeout(timer); reject(new Error("加载地球组件失败，请检查网络后重试")); };
    document.head.appendChild(s);
  });
}

export default function MapPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<any>({});
  const [places, setPlaces] = useState<Place[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newPlace, setNewPlace] = useState({ name: "", lat: "", lng: "", emoji: "📍", note: "" });
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Place | null>(null);
  const [globeError, setGlobeError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_places").select("*").eq("user_id", user.id).order("visited_at", { ascending: false })
      .then(({ data }) => { if (data) setPlaces(data.map((r: any) => ({ id: r.id, name: r.name, lat: r.lat, lng: r.lng, emoji: r.emoji || "📍", note: r.note, visitedAt: r.visited_at }))); });
  }, [user]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;

    loadThree().then((THREE: any) => {
      const W = canvas.clientWidth, H = canvas.clientHeight;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(W, H);
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
      camera.position.set(0, 0, 2.8);

      scene.add(new THREE.AmbientLight(0xffffff, 0.5));
      const dir = new THREE.DirectionalLight(0xffd9a0, 1.2);
      dir.position.set(3, 2, 2); scene.add(dir);

      // Stars
      const sverts: number[] = [];
      for (let i = 0; i < 1500; i++) sverts.push((Math.random()-0.5)*40,(Math.random()-0.5)*40,(Math.random()-0.5)*40);
      const sg = new THREE.BufferGeometry();
      sg.setAttribute("position", new THREE.Float32BufferAttribute(sverts, 3));
      scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.025, transparent: true, opacity: 0.5 })));

      // Ocean
      const ocean = new THREE.Mesh(new THREE.SphereGeometry(0.997, 48, 48), new THREE.MeshPhongMaterial({ color: 0x1a5f8a, shininess: 60 }));
      scene.add(ocean);

      // Globe (land layer - slightly transparent toon style)
      const globe = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 48), new THREE.MeshPhongMaterial({ color: 0x4a9f5a, shininess: 20, transparent: true, opacity: 0.9 }));
      scene.add(globe);

      // Place markers
      const markerGroup = new THREE.Group();
      scene.add(markerGroup);

      stateRef.current = { globe, ocean, markerGroup, scene, camera, renderer, THREE };

      let rot = { x: 0.2, y: 0 };
      let drag = false, lx = 0, ly = 0;

      const onDown = (e: MouseEvent | TouchEvent) => {
        drag = true;
        const p = "touches" in e ? e.touches[0] : e;
        lx = p.clientX; ly = p.clientY;
      };
      const onMove = (e: MouseEvent | TouchEvent) => {
        if (!drag) return;
        const p = "touches" in e ? e.touches[0] : e;
        rot.y += (p.clientX - lx) * 0.008;
        rot.x += (p.clientY - ly) * 0.005;
        rot.x = Math.max(-1.2, Math.min(1.2, rot.x));
        lx = p.clientX; ly = p.clientY;
      };
      const onUp = () => { drag = false; };
      canvas.addEventListener("mousedown", onDown as any);
      canvas.addEventListener("mousemove", onMove as any);
      canvas.addEventListener("mouseup", onUp);
      canvas.addEventListener("touchstart", onDown as any, { passive: true });
      canvas.addEventListener("touchmove", onMove as any, { passive: true });
      canvas.addEventListener("touchend", onUp);

      const animate = () => {
        raf = requestAnimationFrame(animate);
        if (!drag) rot.y += 0.003;
        globe.rotation.set(rot.x, rot.y, 0);
        ocean.rotation.set(rot.x, rot.y, 0);
        markerGroup.rotation.set(rot.x, rot.y, 0);
        renderer.render(scene, camera);
      };
      animate();
    }).catch((e: Error) => {
      console.error("[MapPage] three.js 加载失败:", e);
      setGlobeError(e.message || "地球组件加载失败");
    });

    return () => { cancelAnimationFrame(raf); };
  }, []);

  // Add/update markers when places change
  useEffect(() => {
    const { markerGroup, THREE } = stateRef.current;
    if (!markerGroup || !THREE) return;
    while (markerGroup.children.length) markerGroup.remove(markerGroup.children[0]);
    places.forEach(p => {
      const phi = (90 - p.lat) * (Math.PI / 180);
      const theta = (p.lng + 180) * (Math.PI / 180);
      const x = -1.05 * Math.sin(phi) * Math.cos(theta);
      const y = 1.05 * Math.cos(phi);
      const z = 1.05 * Math.sin(phi) * Math.sin(theta);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.018, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffd700 })
      );
      dot.position.set(x, y, z);
      markerGroup.add(dot);
    });
  }, [places]);

  const addPlace = async () => {
    if (!user || !newPlace.name || !newPlace.lat || !newPlace.lng) return;
    // 之前这里只检查经纬度是否为空字符串，不检查是不是合法数字——用户输入
    // 非数字文本会被parseFloat静默转成NaN，直接存进Supabase，标记点在
    // 地球上位置错乱(NaN参与球面坐标计算)且没有任何提示。
    const lat = parseFloat(newPlace.lat);
    const lng = parseFloat(newPlace.lng);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) { toast.error("纬度需要是 -90 到 90 之间的数字"); return; }
    if (Number.isNaN(lng) || lng < -180 || lng > 180) { toast.error("经度需要是 -180 到 180 之间的数字"); return; }
    setSaving(true);
    const row = { user_id: user.id, name: newPlace.name, lat, lng, emoji: newPlace.emoji, note: newPlace.note, visited_at: new Date().toISOString() };
    const { data, error } = await supabase.from("user_places").insert(row).select().single();
    // 之前这里不检查error，插入失败(网络/RLS)时表单照样清空收起，用户以为
    // 地点已经加上了，实际上云端和地球上都没有这个点。
    if (error) {
      console.error("[MapPage] 添加地点失败:", error);
      toast.error("添加失败，请重试");
      setSaving(false);
      return;
    }
    if (data) setPlaces(p => [{ id: data.id, name: data.name, lat: data.lat, lng: data.lng, emoji: data.emoji, note: data.note, visitedAt: data.visited_at }, ...p]);
    setNewPlace({ name: "", lat: "", lng: "", emoji: "📍", note: "" });
    setShowAdd(false); setSaving(false);
  };

  return (
    <div className="flex flex-col h-full max-w-[900px] mx-auto bg-[#080c14]">
      <div className="flex items-center justify-between px-4 h-[52px] border-b border-border/30 flex-shrink-0 bg-black/40 backdrop-blur-sm z-10">
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(-1)} className="touch-target text-white/70 hover:text-white rounded-xl" style={{transform:"scale(0.85)"}}>
            <ChevronLeft size={22} />
          </button>
          <h1 className="font-serif-sc text-base text-white">我去过的地方</h1>
          <span className="text-caption text-white/40 ml-1">({places.length})</span>
        </div>
        <button onClick={() => setShowAdd(true)} className="touch-target text-gold hover:bg-gold/10 rounded-xl" style={{transform:"scale(0.85)"}}>
          <Plus size={20} />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
        {globeError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-caption text-white/60">{globeError}</p>
            <button
              onClick={() => { setGlobeError(null); window.location.reload(); }}
              className="text-caption text-gold border border-gold/30 rounded-full px-4 py-1.5 hover:bg-gold/10"
            >
              重新加载
            </button>
          </div>
        ) : (
          <p className="absolute bottom-20 left-1/2 -translate-x-1/2 text-label text-white/30 pointer-events-none">拖动旋转 · 金色圆点为已去过的地方</p>
        )}
      </div>

      <div className="border-t border-border/30 bg-black/60 backdrop-blur-sm">
        <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-none">
          {places.length === 0 ? (
            <p className="text-caption text-white/40 py-1">点击 + 添加你去过的地方</p>
          ) : places.slice(0, 10).map(p => (
            <button key={p.id} onClick={() => setSelected(p)}
              className="flex-shrink-0 flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 hover:bg-white/20 transition">
              <span>{p.emoji}</span>
              <span className="text-caption text-white whitespace-nowrap">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="absolute bottom-20 left-4 right-4 bg-surface-1 border border-border rounded-xl p-4 shadow-lg z-30 max-w-[400px] mx-auto">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{selected.emoji}</span>
              <div>
                <p className="text-sm font-semibold text-foreground">{selected.name}</p>
                <p className="text-caption text-muted-foreground">{selected.lat.toFixed(2)}, {selected.lng.toFixed(2)}</p>
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="text-muted-foreground"><X size={14} /></button>
          </div>
          {selected.note && <p className="text-sm text-foreground mt-2">{selected.note}</p>}
          <p className="text-label text-muted-foreground mt-1">{selected.visitedAt.slice(0, 10)}</p>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end">
          <div className="w-full max-w-[600px] mx-auto bg-surface-1 rounded-t-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold font-serif-sc text-foreground">添加地点</p>
              <button onClick={() => setShowAdd(false)} className="text-muted-foreground"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input value={newPlace.emoji} onChange={e => setNewPlace(p => ({...p, emoji: e.target.value}))} className="w-14 bg-surface-2 border border-border rounded-xl text-center text-xl focus:outline-none" maxLength={2} />
                <input value={newPlace.name} onChange={e => setNewPlace(p => ({...p, name: e.target.value}))} placeholder="地点名称" className="flex-1 bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary" />
              </div>
              <div className="flex gap-2">
                <input value={newPlace.lat} onChange={e => setNewPlace(p => ({...p, lat: e.target.value}))} placeholder="纬度 (如 39.9)" className="flex-1 bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary" />
                <input value={newPlace.lng} onChange={e => setNewPlace(p => ({...p, lng: e.target.value}))} placeholder="经度 (如 116.4)" className="flex-1 bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary" />
              </div>
              <input value={newPlace.note} onChange={e => setNewPlace(p => ({...p, note: e.target.value}))} placeholder="备注（选填）" className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary" />
              <button onClick={addPlace} disabled={saving || !newPlace.name || !newPlace.lat} className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-30">
                {saving ? "保存中…" : "添加到地图"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
