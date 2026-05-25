import { useState } from "react";
import { Loader2, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TandaTerimaModal } from "@/components/TandaTerimaModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Transaction, Nota, Company, Bank } from "@/lib/nota";

type Props = {
  trx: Transaction;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "link" | "destructive" | "secondary";
  children?: React.ReactNode;
};

export const PreviewTransactionButton = ({ trx, disabled, className, variant, children }: Props) => {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  
  const [notas, setNotas] = useState<Nota[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [bank, setBank] = useState<Bank | null>(null);

  const handlePreview = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    
    setLoading(true);
    try {
      const [resNotas, resComp, resBank] = await Promise.all([
        supabase.from("notas").select("*").in("id", trx.nota_ids || []),
        trx.company_id ? supabase.from("companies").select("*").eq("id", trx.company_id).single() : Promise.resolve({ data: null }),
        trx.bank_id ? supabase.from("banks").select("*").eq("id", trx.bank_id).single() : Promise.resolve({ data: null })
      ]);
      
      if (resNotas.error) throw resNotas.error;
      
      setNotas((resNotas.data as any) || []);
      setCompany(resComp.data as Company | null);
      setBank(resBank.data as Bank | null);
      
      setOpen(true);
    } catch (err: any) {
      toast.error("Gagal memuat data preview: " + err.message);
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
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : children || <><FileCheck2 className="w-4 h-4 mr-2" /> Generate Tanda Terima</>}
      </Button>
      
      <TandaTerimaModal
        open={open}
        onOpenChange={setOpen}
        trx={trx}
        notas={notas}
        company={company}
        bank={bank}
      />
    </>
  );
};
