import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Folder, FolderPlus, ArrowLeft, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type DriveFolder = { id: string; name: string; parents?: string[] };

export const DriveFolderPicker = ({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (folder: { id: string; name: string } | null) => void;
}) => {
  const [stack, setStack] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: "My Drive" },
  ]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [newFolder, setNewFolder] = useState("");
  const [creating, setCreating] = useState(false);

  const current = stack[stack.length - 1];

  const load = async (parentId: string | null) => {
    setLoading(true);
    try {
      const q = parentId ? `'${parentId}' in parents` : `'root' in parents`;
      const { data, error } = await supabase.functions.invoke("drive-upload", {
        body: { action: "list-folders", query: q },
      });
      if (error) throw error;
      setFolders(data?.files || []);
    } catch (e: any) {
      toast.error("Gagal memuat folder: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const open$ = (folder: DriveFolder) => {
    setStack((s) => [...s, { id: folder.id, name: folder.name }]);
    load(folder.id);
  };

  const back = () => {
    if (stack.length <= 1) return;
    const next = stack.slice(0, -1);
    setStack(next);
    load(next[next.length - 1].id);
  };

  const handleCreate = async () => {
    if (!newFolder.trim()) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("drive-upload", {
        body: {
          action: "create-folder",
          name: newFolder.trim(),
          parentId: current.id,
        },
      });
      if (error) throw error;
      setNewFolder("");
      toast.success("Folder dibuat");
      load(current.id);
    } catch (e: any) {
      toast.error("Gagal: " + (e?.message || ""));
    } finally {
      setCreating(false);
    }
  };

  const handlePickHere = () => {
    if (!current.id) {
      onSelect(null);
    } else {
      onSelect({ id: current.id, name: current.name });
    }
    onOpenChange(false);
  };

  // load on open
  const handleOpenChange = (v: boolean) => {
    onOpenChange(v);
    if (v) {
      setStack([{ id: null, name: "My Drive" }]);
      load(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md paper rounded-none border-2 border-dashed border-paper-edge">
        <DialogHeader>
          <DialogTitle className="uppercase tracking-widest text-center text-sm">
            Pilih Folder Drive
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 text-xs uppercase tracking-widest border-b-2 border-dashed border-paper-edge pb-2">
          <button
            onClick={back}
            disabled={stack.length <= 1}
            className="p-1 disabled:opacity-30"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 truncate font-bold">
            {stack.map((s) => s.name).join(" / ")}
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1">
          {loading ? (
            <div className="text-center py-6">
              <Loader2 className="w-5 h-5 mx-auto animate-spin" />
            </div>
          ) : folders.length === 0 ? (
            <div className="text-xs text-muted-foreground italic text-center py-4">
              (folder kosong)
            </div>
          ) : (
            folders.map((f) => (
              <button
                key={f.id}
                onClick={() => open$(f)}
                className="w-full flex items-center gap-2 p-2 border border-paper-edge hover:border-ink text-left"
              >
                <Folder className="w-4 h-4" />
                <span className="text-sm truncate">{f.name}</span>
              </button>
            ))
          )}
        </div>

        <div className="border-t-2 border-dashed border-paper-edge pt-2 space-y-2">
          <div className="flex gap-1">
            <Input
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              placeholder="Nama folder baru di sini"
              className="rounded-none border-2 border-paper-edge bg-paper h-8 text-sm"
            />
            <Button
              onClick={handleCreate}
              disabled={creating || !newFolder.trim()}
              className="rounded-none bg-ink text-paper h-8 px-2"
            >
              {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <FolderPlus className="w-3 h-3" />}
            </Button>
          </div>
          <Button
            onClick={handlePickHere}
            className="w-full bg-ink text-paper hover:bg-ink/90 rounded-none uppercase tracking-widest text-xs font-bold h-9"
          >
            <Check className="w-4 h-4 mr-1" /> Gunakan folder ini ({current.name})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
