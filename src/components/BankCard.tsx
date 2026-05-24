import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import type { Bank } from "@/lib/nota";

export const BankCard = ({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) => {
  const [list, setList] = useState<Bank[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ nama_bank: "", no_rek: "", atas_nama: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ nama_bank: "", no_rek: "", atas_nama: "" });

  const load = async () => {
    const { data } = await supabase
      .from("banks")
      .select("*")
      .order("created_at", { ascending: false });
    setList((data as unknown as Bank[]) || []);
  };
  useEffect(() => {
    load();
  }, []);

  const handleAdd = async () => {
    if (!form.nama_bank.trim() || !form.no_rek.trim() || !form.atas_nama.trim())
      return toast.error("Semua field wajib diisi");
    const { error } = await supabase.from("banks").insert({
      nama_bank: form.nama_bank.trim(),
      no_rek: form.no_rek.trim(),
      atas_nama: form.atas_nama.trim(),
    });
    if (error) return toast.error(error.message);
    setForm({ nama_bank: "", no_rek: "", atas_nama: "" });
    setAdding(false);
    toast.success("Rekening ditambahkan");
    load();
  };

  const handleSaveEdit = async (id: string) => {
    const { error } = await supabase
      .from("banks")
      .update({
        nama_bank: editForm.nama_bank.trim(),
        no_rek: editForm.no_rek.trim(),
        atas_nama: editForm.atas_nama.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    setEditingId(null);
    toast.success("Rekening diperbarui");
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus rekening ini?")) return;
    const { error } = await supabase.from("banks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (selectedId === id) onSelect(null);
    load();
  };

  return (
    <div className="paper p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="label">Informasi Bank</div>
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
            placeholder="Nama bank (BCA, Mandiri, ...)"
            value={form.nama_bank}
            onChange={(e) => setForm({ ...form, nama_bank: e.target.value })}
            className="rounded-none border-2 border-paper-edge bg-paper h-8 text-sm"
          />
          <Input
            placeholder="No. Rekening"
            value={form.no_rek}
            onChange={(e) => setForm({ ...form, no_rek: e.target.value })}
            className="rounded-none border-2 border-paper-edge bg-paper h-8 text-sm num"
          />
          <Input
            placeholder="Atas nama"
            value={form.atas_nama}
            onChange={(e) => setForm({ ...form, atas_nama: e.target.value })}
            className="rounded-none border-2 border-paper-edge bg-paper h-8 text-sm"
          />
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
                setForm({ nama_bank: "", no_rek: "", atas_nama: "" });
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
        <p className="text-xs text-muted-foreground italic">Belum ada rekening</p>
      ) : (
        <div className="space-y-1">
          {list.map((b) => {
            const isSelected = selectedId === b.id;
            const isEditing = editingId === b.id;
            if (isEditing) {
              return (
                <div key={b.id} className="border-2 border-dashed border-paper-edge p-2 space-y-2">
                  <Input
                    value={editForm.nama_bank}
                    onChange={(e) => setEditForm({ ...editForm, nama_bank: e.target.value })}
                    className="rounded-none border-2 border-paper-edge bg-paper h-8 text-sm"
                  />
                  <Input
                    value={editForm.no_rek}
                    onChange={(e) => setEditForm({ ...editForm, no_rek: e.target.value })}
                    className="rounded-none border-2 border-paper-edge bg-paper h-8 text-sm num"
                  />
                  <Input
                    value={editForm.atas_nama}
                    onChange={(e) => setEditForm({ ...editForm, atas_nama: e.target.value })}
                    className="rounded-none border-2 border-paper-edge bg-paper h-8 text-sm"
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleSaveEdit(b.id)}
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
                key={b.id}
                className={`flex items-start gap-2 p-2 border-2 cursor-pointer transition ${
                  isSelected
                    ? "border-ink bg-ink/5"
                    : "border-paper-edge hover:border-ink/40"
                }`}
                onClick={() => onSelect(isSelected ? null : b.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold uppercase">{b.nama_bank}</div>
                  <div className="text-xs num">{b.no_rek}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">
                    a/n {b.atas_nama}
                  </div>
                </div>
                {isSelected && (
                  <span className="text-[9px] uppercase tracking-widest font-bold text-ink border border-ink px-1 self-start">
                    Dipakai
                  </span>
                )}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(b.id);
                      setEditForm({
                        nama_bank: b.nama_bank,
                        no_rek: b.no_rek,
                        atas_nama: b.atas_nama,
                      });
                    }}
                    className="text-muted-foreground hover:text-ink p-1"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(b.id);
                    }}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
