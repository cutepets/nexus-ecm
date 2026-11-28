"use client";

import { useEffect } from "react";
import { useCompanyBranding } from "@/features/settings/api";

export function BrandTitle() {
  const { data: branding } = useCompanyBranding();

  useEffect(() => {
    const companyName = branding?.companyName.trim();
    if (companyName) document.title = companyName;
  }, [branding?.companyName]);

  return null;
}
