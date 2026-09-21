ALTER TABLE t_p83864310_fintech_payment_reco.companies
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS ogrn VARCHAR(15) NULL;

COMMENT ON COLUMN t_p83864310_fintech_payment_reco.companies.name IS 'Короткое название компании (shortName из Екомкасса API)';
COMMENT ON COLUMN t_p83864310_fintech_payment_reco.companies.full_name IS 'Полное юридическое название компании (name из Екомкасса API)';
COMMENT ON COLUMN t_p83864310_fintech_payment_reco.companies.ogrn IS 'ОГРН компании из Екомкасса API';
COMMENT ON COLUMN t_p83864310_fintech_payment_reco.companies.legal_address IS 'Юридический адрес компании из Екомкасса API';
