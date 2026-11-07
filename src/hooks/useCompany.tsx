import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface CompanyInfo {
  company_name: string;
  logo_url: string;
  employer_nic_number: string;
  tax_id: string;
  vat_number: string;
  telephone: string;
  website: string;
  address: string;
}

const defaultInfo: CompanyInfo = {
  company_name: "OECS HR & Payroll",
  logo_url: "",
  employer_nic_number: "",
  tax_id: "",
  vat_number: "",
  telephone: "",
  website: "",
  address: "",
};

const CompanyContext = createContext<CompanyInfo>(defaultInfo);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [info, setInfo] = useState<CompanyInfo>(defaultInfo);

  useEffect(() => {
    setInfo(defaultInfo);
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const org = await supabase.rpc('current_org_id');
      if (org.error || !org.data || cancelled) return;
      const { data } = await supabase.from('company_settings').select('*').eq('org_id', org.data).maybeSingle();
      if (data && !cancelled) setInfo({
        company_name: data.company_name || defaultInfo.company_name,
        logo_url: data.logo_url || '', employer_nic_number: data.employer_nic_number || '',
        tax_id: data.tax_id || '', vat_number: data.vat_number || '', telephone: data.telephone || '',
        website: data.website || '', address: data.address || '',
      });
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return (
    <CompanyContext.Provider value={info}>
      {children}
    </CompanyContext.Provider>
  );
}

export const useCompany = () => useContext(CompanyContext);
