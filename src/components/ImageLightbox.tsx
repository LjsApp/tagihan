import { useEffect, useState } from "react";
import { X } from "lucide-react";

type Ctx = { open: (src: string, alt?: string) => void };
let ctx: Ctx = { open: () => {} };
export const openLightbox = (src: string, alt?: string) => ctx.open(src, alt);

export const ImageLightboxProvider = () => {
  const [src, setSrc] = useState<string | null>(null);
  const [alt, setAlt] = useState<string>("");

  useEffect(() => {
    ctx.open = (s, a) => {
      setSrc(s);
      setAlt(a || "");
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSrc(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!src) return null;
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in"
      onClick={() => setSrc(null)}
    >
      <button
        onClick={() => setSrc(null)}
        className="absolute top-4 right-4 bg-paper text-ink p-2 rounded-none border-2 border-paper hover:bg-stamp hover:text-paper z-10"
        aria-label="Tutup"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

export const ZoomableImg = ({
  src,
  alt,
  className,
  style,
}: {
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}) => (
  <img
    src={src}
    alt={alt}
    className={(className || "") + " cursor-zoom-in"}
    style={style}
    onClick={(e) => {
      e.stopPropagation();
      openLightbox(src, alt);
    }}
  />
);
