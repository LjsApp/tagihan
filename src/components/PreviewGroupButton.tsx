import { useState } from "react";
import { Loader2, FileCheck2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TandaTerimaGroupModal } from "@/components/TandaTerimaGroupModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatRp, type Transaction, type Nota, type Company, type Bank, type TransactionGroup } from "@/lib/nota";

type Props = {
  group: TransactionGroup;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
  children?: React.ReactNode;
  onFinalized?: () => void;
};

export const PreviewGroupButton = ({ group, disabled, className, variant, children, onFinalized }: Props) => {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  
  const [trxList, setTrxList] = useState<Transaction[]>([]);
  const [notasByTrx, setNotasByTrx] = useState<Record<string, Nota[]>>({});
  const [company, setCompany] = useState<Company | null>(null);
  const [bank, setBank] = useState<Bank | null>(null);
  
  const headerTitle = group.nama || "Tanpa nama";
  const grandTotal = trxList.reduce((acc, t) => acc + Number(t.total_akhir || 0), 0);

  const handlePreview = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    
    setLoading(true);
    try {
      // 1. Ambil transaksi
      const { data: trxs, error: tErr } = await supabase
        .from("transactions")
        .select("*")
        .eq("group_id", group.id)
        .order("created_at", { ascending: true });
        
      if (tErr) throw tErr;
      const transactions = (trxs as unknown as Transaction[]) || [];
      
      // 2. Kumpulkan semua nota_ids
      const allNotaIds = transactions.flatMap((t) => t.nota_ids || []);
      
      // 3. Ambil notas, company, bank secara parallel
      const [resNotas, resComp, resBank] = await Promise.all([
        allNotaIds.length > 0 ? supabase.from("notas").select("*").in("id", allNotaIds) : Promise.resolve({ data: [], error: null }),
        group.company_id ? supabase.from("companies").select("*").eq("id", group.company_id).single() : Promise.resolve({ data: null, error: null }),
        group.bank_id ? supabase.from("banks").select("*").eq("id", group.bank_id).single() : Promise.resolve({ data: null, error: null })
      ]);
      
      if (resNotas.error) throw resNotas.error;
      
      const allNotas = (resNotas.data as any) || [];
      const dict: Record<string, Nota[]> = {};
      transactions.forEach((t) => {
        dict[t.id] = allNotas.filter((n: any) => (t.nota_ids || []).includes(n.id));
      });
      
      setTrxList(transactions);
      setNotasByTrx(dict);
      setCompany(resComp.data as Company | null);
      setBank(resBank.data as Bank | null);
      
      setOpen(true);
    } catch (err: any) {
      toast.error("Gagal memuat data preview group: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        disabled={disabled || loading}
        onClick={handlePreview}
        className={className}
      >
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : children || <><Printer className="w-4 h-4 mr-2" /> Preview Gabungan</>}
      </Button>
      
      {open && (
        <TandaTerimaGroupModal
          open={open}
          onOpenChange={setOpen}
          group={group}
          trxList={trxList}
          notasByTrx={notasByTrx}
          company={company}
          bank={bank}
          headerTitle={headerTitle}
          grandTotal={grandTotal}
          onFinalized={onFinalized}
        />
      )}
    </>
  );
};
