import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

export type Divisi = { id: string; nama: string; kode_list: string[] };

export const findDivisiByKode = (list: Divisi[], kode?: string | null): Divisi | null => {
  if (!kode) return null;
  const k = kode.trim().toUpperCase();
  if (!k) return null;
  // Exact match first, then prefix
  let hit = list.find((d) => (d.kode_list || []).some((x) => x.toUpperCase() === k));
  if (hit) return hit;
  hit = list.find((d) =>
    (d.kode_list || []).some((x) => x && k.startsWith(x.toUpperCase())),
  );
  return hit || null;
};

export const fetchDivisiList = async (): Promise<Divisi[]> => {
  const { data } = await supabase.from("divisi").select("*").order("nama");
  return (data as any[] || []).map((d) => ({
    id: d.id,
    nama: d.nama,
    kode_list: d.kode_list || [],
  }));
};

export const DivisiSelect = ({
  value,
  onChange,
  disabled,
}: {
  value: { id: string | null; nama: string | null };
  onChange: (v: { id: string | null; nama: string | null }) => void;
  disabled?: boolean;
}) => {
  const [list, setList] = useState<Divisi[]>([]);
  const [adding, setAdding] = useState(false);
  const [newNama, setNewNama] = useState("");
  const [newKode, setNewKode] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editNama, setEditNama] = useState("");
  const [editKode, setEditKode] = useState("");
  const [showList, setShowList] = useState(false);

  const load = async () => setList(await fetchDivisiList());

  useEffect(() => {
    load();
  }, []);

  const parseKode = (s: string): string[] =>
    s
      .split(/[,\s]+/)
      .map((x) => x.trim().toUpperCase())
      .filter(Boolean);

  const handleAdd = async () => {
    if (!newNama.trim()) return;
    const { data, error } = await (supabase.from("divisi") as any)
      .insert({ nama: newNama.trim(), kode_list: parseKode(newKode) })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setNewNama("");
    setNewKode("");
    setAdding(false);
    await load();
    onChange({ id: data.id, nama: data.nama });
  };

  const handleEdit = async (id: string) => {
    if (!editNama.trim()) return;
    await (supabase.from("divisi") as any)
      .update({ nama: editNama.trim(), kode_list: parseKode(editKode) })
      .eq("id", id);
    setEditId(null);
    setEditNama("");
    setEditKode("");
    await load();
    if (value.id === id) onChange({ id, nama: editNama.trim() });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus divisi ini?")) return;
    await supabase.from("divisi").delete().eq("id", id);
    await load();
    if (value.id === id) onChange({ id: null, nama: null });
  };

  return (
    <div>
      <Label className="label">Divisi</Label>
      <div className="flex gap-1">
        <select
          value={value.id || ""}
          onChange={(e) => {
            const id = e.target.value || null;
            const d = list.find((x) => x.id === id);
            onChange({ id, nama: d?.nama || null });
          }}
          className="flex-1 border-2 border-paper-edge bg-paper px-2 py-2 text-sm uppercase rounded-none disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={disabled}
        >
          <option value="">— Pilih divisi —</option>
          {list.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nama}
              {d.kode_list?.length ? ` (${d.kode_list.join(", ")})` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="border-2 border-paper-edge px-2 hover:border-ink"
          title="Tambah"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setShowList((v) => !v)}
          className="border-2 border-paper-edge px-2 hover:border-ink"
          title={showList ? "Sembunyikan" : "Tampilkan"}
        >
          {showList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {adding && (
        <div className="space-y-1 mt-2 border-2 border-dashed border-paper-edge p-2">
          <Input
            value={newNama}
            onChange={(e) => setNewNama(e.target.value)}
            placeholder="Nama divisi"
            className="rounded-none border-2 border-paper-edge bg-paper h-8 text-xs"
          />
          <Input
            value={newKode}
            onChange={(e) => setNewKode(e.target.value)}
            placeholder="Kode (pisah koma): AA, AAL"
            className="rounded-none border-2 border-paper-edge bg-paper h-8 text-xs uppercase"
          />
          <div className="flex gap-1">
            <button
              onClick={handleAdd}
              className="flex-1 border-2 border-ink bg-ink text-paper text-xs uppercase tracking-widest font-bold py-1"
            >
              <Check className="w-3 h-3 inline" /> Simpan
            </button>
            <button
              onClick={() => {
                setAdding(false);
                setNewNama("");
                setNewKode("");
              }}
              className="border-2 border-paper-edge px-3"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {showList && list.length > 0 && (
        <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
          {list.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-1 text-xs border border-dashed border-paper-edge px-2 py-1"
            >
              {editId === d.id ? (
                <div className="flex-1 space-y-1">
                  <Input
                    value={editNama}
                    onChange={(e) => setEditNama(e.target.value)}
                    className="rounded-none border-2 border-paper-edge bg-paper h-7 text-xs"
                    placeholder="Nama"
                  />
                  <Input
                    value={editKode}
                    onChange={(e) => setEditKode(e.target.value)}
                    className="rounded-none border-2 border-paper-edge bg-paper h-7 text-xs uppercase"
                    placeholder="Kode (pisah koma)"
                  />
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(d.id)} className="p-1 hover:text-ink">
                      <Check className="w-3 h-3" />
                    </button>
                    <button onClick={() => setEditId(null)} className="p-1 hover:text-ink">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <div className="uppercase font-bold">{d.nama}</div>
                    {d.kode_list?.length ? (
                      <div className="text-[10px] text-muted-foreground">
                        {d.kode_list.join(", ")}
                      </div>
                    ) : null}
                  </div>
                  <button
                    onClick={() => {
                      setEditId(d.id);
                      setEditNama(d.nama);
                      setEditKode((d.kode_list || []).join(", "));
                    }}
                    className="p-1 text-muted-foreground hover:text-ink"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
