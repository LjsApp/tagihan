import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Check, X, Cloud } from "lucide-react";
import { toast } from "sonner";
import type { Company } from "@/lib/nota";

export const CompanyCard = ({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) => {
  const [list, setList] = useState<Company[]>([]);
  const [adding, setAdding] = useState(false);
  const [nama, setNama] = useState("");
  const [kategori, setKategori] = useState("");
  const [jthHari, setJthHari] = useState<number>(21);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNama, setEditNama] = useState("");
  const [editKategori, setEditKategori] = useState("");
  const [editJth, setEditJth] = useState<number>(21);

  const load = async () => {
    const { data } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false });
    setList((data as unknown as Company[]) || []);
  };
  useEffect(() => {
    load();
  }, []);

  const handleAdd = async () => {
    if (!nama.trim()) return toast.error("Nama perusahaan wajib diisi");
    const { error } = await (supabase.from("companies") as any).insert({
      nama: nama.trim(),
      kategori: kategori.trim() || null,
      jatuh_tempo_hari: Number(jthHari) || 21,
    });
    if (error) return toast.error(error.message);
    setNama("");
    setKategori("");
    setJthHari(21);
    setAdding(false);
    toast.success("Perusahaan ditambahkan");
    load();
  };

  const handleSaveEdit = async (id: string) => {
    if (!editNama.trim()) return toast.error("Nama perusahaan wajib diisi");
    const { error } = await (supabase.from("companies") as any)
      .update({
        nama: editNama.trim(),
        kategori: editKategori.trim() || null,
        jatuh_tempo_hari: Number(editJth) || 21,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    setEditingId(null);
    toast.success("Perusahaan diperbarui");
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus perusahaan ini?")) return;
    const { error } = await supabase.from("companies").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (selectedId === id) onSelect(null);
    load();
  };

  return (
    <div className="paper p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="label">Perusahaan</div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="text-[10px] uppercase tracking-widest font-bold text-ink hover:text-stamp flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Tambah
        </button>
      </div>

      {adding && (
        <div className="space-y-2 mb-3 border-2 border-dashed border-paper-edge p-2">
          <Input
            placeholder="Nama perusahaan"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            className="rounded-none border-2 border-paper-edge bg-paper h-8 text-sm"
          />
          <Input
            placeholder="Kategori (CV, PT, Toko, dll)"
            value={kategori}
            onChange={(e) => setKategori(e.target.value)}
            className="rounded-none border-2 border-paper-edge bg-paper h-8 text-sm"
          />
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Jatuh Tempo (hari)
            </label>
            <Input
              type="number"
              min={1}
              value={jthHari}
              onChange={(e) => setJthHari(Number(e.target.value))}
              className="rounded-none border-2 border-paper-edge bg-paper h-8 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleAdd}
              className="flex-1 bg-ink text-paper hover:bg-ink/90 rounded-none uppercase tracking-widest text-xs font-bold h-8"
            >
              Simpan
            </Button>
            <Button
              onClick={() => {
                setAdding(false);
                setNama("");
                setKategori("");
              }}
              variant="outline"
              className="rounded-none uppercase tracking-widest text-xs font-bold h-8"
            >
              Batal
            </Button>
          </div>
        </div>
      )}

      {list.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground italic">Belum ada perusahaan</p>
      ) : (
        <div className="space-y-1">
          {list.map((c) => {
            const isSelected = selectedId === c.id;
            const isEditing = editingId === c.id;
            if (isEditing) {
              return (
                <div key={c.id} className="border-2 border-dashed border-paper-edge p-2 space-y-2">
                  <Input
                    value={editNama}
                    onChange={(e) => setEditNama(e.target.value)}
                    className="rounded-none border-2 border-paper-edge bg-paper h-8 text-sm"
                  />
                  <Input
                    value={editKategori}
                    onChange={(e) => setEditKategori(e.target.value)}
                    placeholder="Kategori"
                    className="rounded-none border-2 border-paper-edge bg-paper h-8 text-sm"
                  />
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Jatuh Tempo (hari)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={editJth}
                      onChange={(e) => setEditJth(Number(e.target.value))}
                      className="rounded-none border-2 border-paper-edge bg-paper h-8 text-sm"
                    />
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleSaveEdit(c.id)}
                      className="flex-1 text-[10px] uppercase tracking-widest font-bold border-2 border-ink py-1 hover:bg-ink hover:text-paper"
                    >
                      <Check className="w-3 h-3 inline" /> Simpan
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex-1 text-[10px] uppercase tracking-widest font-bold border-2 border-paper-edge py-1"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={c.id}
                className={`flex items-center gap-2 p-2 border-2 cursor-pointer transition ${
                  isSelected
                    ? "border-ink bg-ink/5"
                    : "border-paper-edge hover:border-ink/40"
                }`}
                onClick={() => onSelect(isSelected ? null : c.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold uppercase truncate">{c.nama}</div>
                  {c.kategori && (
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {c.kategori}
                    </div>
                  )}
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
                    Jatuh tempo: {c.jatuh_tempo_hari ?? 21} hari
                  </div>
                </div>
                {isSelected && (
                  <span className="text-[9px] uppercase tracking-widest font-bold text-ink border border-ink px-1">
                    Dipakai
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(c.id);
                    setEditNama(c.nama);
                    setEditKategori(c.kategori || "");
                    setEditJth(c.jatuh_tempo_hari ?? 21);
                  }}
                  className="text-muted-foreground hover:text-ink p-1"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(c.id);
                  }}
                  className="text-muted-foreground hover:text-destructive p-1"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
