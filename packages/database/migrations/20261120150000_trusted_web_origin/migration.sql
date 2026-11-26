ALTER TABLE "company_settings"
ADD COLUMN "trustedWebOrigins" TEXT[] NOT NULL DEFAULT ARRAY['https://chamcong.petshophanoi.com']::TEXT[];
