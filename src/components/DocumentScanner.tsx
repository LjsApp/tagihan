import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw, Check, Wand2 } from "lucide-react";
import {
  type Pt,
  type FilterMode,
  loadImage,
  fileToDataURL,
  warpPerspective,
  applyFilter,
  canvasToBlob,
  defaultCorners,
} from "@/lib/scanProcessing";

type Props = {
  file: File;
  onCancel: () => void;
  onDone: (processed: File, originalDataUrl: string, processedDataUrl: string, warped: HTMLCanvasElement) => void;
};

type Stage = "adjust" | "filter" | "processing";

export const DocumentScanner = ({ file, onCancel, onDone }: Props) => {
  const [stage, setStage] = useState<Stage>("adjust");
  const [imgSrc, setImgSrc] = useState<string>("");
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [corners, setCorners] = useState<Pt[]>([]);
  const [warped, setWarped] = useState<HTMLCanvasElement | null>(null);
  const [filter, setFilter] = useState<FilterMode>("original");
  const [filteredUrl, setFilteredUrl] = useState<string>("");
  const [working, setWorking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragIdx = useRef<number | null>(null);
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 });

  // Load image
  useEffect(() => {
    (async () => {
      const url = await fileToDataURL(file);
      setImgSrc(url);
      const im = await loadImage(url);
      setImg(im);
      setCorners(defaultCorners(im.naturalWidth, im.naturalHeight));
    })();
  }, [file]);

  // Track displayed size for overlay positioning
  useEffect(() => {
    if (!img) return;
    const update = () => {
      const el = containerRef.current?.querySelector("img");
      if (el) setBoxSize({ w: el.clientWidth, h: el.clientHeight });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [img, imgSrc]);

  const scaleX = img ? boxSize.w / img.naturalWidth : 1;
  const scaleY = img ? boxSize.h / img.naturalHeight : 1;

  const startDrag = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragIdx.current = i;
  };
  const onDrag = (e: React.PointerEvent) => {
    if (dragIdx.current === null || !img) return;
    const rect = (containerRef.current!.querySelector("img") as HTMLImageElement).getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    const px = x / scaleX;
    const py = y / scaleY;
    setCorners((cs) => cs.map((c, idx) => (idx === dragIdx.current ? { x: px, y: py } : c)));
  };
  const endDrag = () => {
    dragIdx.current = null;
  };

  const autoDetect = () => {
    if (!img) return;
    setCorners(defaultCorners(img.naturalWidth, img.naturalHeight));
  };

  const applyCrop = async () => {
    if (!img) return;
    setStage("processing");
    setWorking(true);
    try {
      const w = await warpPerspective(img, corners);
      setWarped(w);
      const filtered = applyFilter(w, "original");
      setFilteredUrl(filtered.toDataURL("image/jpeg", 0.95));
      setFilter("original");
      setStage("filter");
    } finally {
      setWorking(false);
    }
  };

  const changeFilter = (f: FilterMode) => {
    if (!warped) return;
    setFilter(f);
    const c = applyFilter(warped, f);
    setFilteredUrl(c.toDataURL("image/jpeg", 0.95));
  };

  const finalize = async () => {
    if (!warped) return;
    setWorking(true);
    try {
      const c = applyFilter(warped, filter);
      const blob = await canvasToBlob(c);
      const out = new File([blob], file.name.replace(/\.\w+$/, "") + "-scan.jpg", { type: "image/jpeg" });
      onDone(out, imgSrc, c.toDataURL("image/jpeg", 0.95), warped);
    } finally {
      setWorking(false);
    }
  };

  // Path for polygon overlay
  const poly = corners
    .map((c) => `${c.x * scaleX},${c.y * scaleY}`)
    .join(" ");

  return (
    <div className="space-y-3">
      {stage === "adjust" && imgSrc && (
        <>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground text-center">
            Geser titik untuk menyesuaikan area dokumen
          </div>
          <div
            ref={containerRef}
            className="relative inline-block w-full select-none touch-none"
            onPointerMove={onDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <img src={imgSrc} alt="raw" className="w-full block" draggable={false} />
            {boxSize.w > 0 && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox={`0 0 ${boxSize.w} ${boxSize.h}`}
              >
                <polygon
                  points={poly}
                  fill="hsl(var(--primary) / 0.15)"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
              </svg>
            )}
            {corners.map((c, i) => (
              <div
                key={i}
                onPointerDown={startDrag(i)}
                className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full bg-paper border-2 border-ink shadow-md cursor-grab active:cursor-grabbing touch-none"
                style={{ left: c.x * scaleX, top: c.y * scaleY }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={autoDetect}
              className="border-2 rounded-none uppercase text-xs tracking-widest font-bold"
            >
              <Wand2 className="w-4 h-4 mr-1" /> Auto
            </Button>
            <Button
              variant="outline"
              onClick={onCancel}
              className="border-2 rounded-none uppercase text-xs tracking-widest font-bold"
            >
              <RotateCcw className="w-4 h-4 mr-1" /> Ulang
            </Button>
            <Button
              onClick={applyCrop}
              className="flex-1 bg-ink text-paper hover:bg-ink/90 rounded-none uppercase text-xs tracking-widest font-bold"
            >
              <Check className="w-4 h-4 mr-1" /> Lanjut
            </Button>
          </div>
        </>
      )}

      {stage === "processing" && (
        <div className="text-center py-10">
          <Loader2 className="w-10 h-10 mx-auto animate-spin text-ink mb-2" />
          <div className="uppercase text-xs tracking-widest font-bold">Memproses...</div>
        </div>
      )}

      {stage === "filter" && filteredUrl && (
        <>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div>
              <div className="label mb-1">Asli</div>
              <img src={imgSrc} alt="orig" className="w-full border-2 border-paper-edge max-h-48 object-contain bg-paper" />
            </div>
            <div>
              <div className="label mb-1">Hasil Scan</div>
              <img src={filteredUrl} alt="scan" className="w-full border-2 border-paper-edge max-h-48 object-contain bg-paper transition-opacity" />
            </div>
          </div>
          <div>
            <div className="label mb-1">Filter</div>
            <div className="grid grid-cols-2 gap-1">
              {(["original", "grayscale"] as FilterMode[]).map((f) => (
                <button
                  key={f}
                  onClick={() => changeFilter(f)}
                  className={`px-1 py-2 text-[10px] uppercase tracking-widest font-bold border-2 transition-all ${
                    filter === f
                      ? "bg-ink text-paper border-ink"
                      : "bg-paper border-paper-edge hover:border-ink"
                  }`}
                >
                  {f === "original" ? "Original" : "Grayscale"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => setStage("adjust")}
              className="border-2 rounded-none uppercase text-xs tracking-widest font-bold"
            >
              <RotateCcw className="w-4 h-4 mr-1" /> Adjust
            </Button>
            <Button
              onClick={finalize}
              disabled={working}
              className="flex-1 bg-ink text-paper hover:bg-ink/90 rounded-none uppercase text-xs tracking-widest font-bold"
            >
              {working ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
              Scan & OCR
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
