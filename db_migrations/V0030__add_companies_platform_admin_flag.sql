ALTER TABLE t_p83864310_fintech_payment_reco.companies
  ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_single_platform_admin
  ON t_p83864310_fintech_payment_reco.companies (is_platform_admin)
  WHERE is_platform_admin = true;

UPDATE t_p83864310_fintech_payment_reco.companies
SET is_platform_admin = true
WHERE id = 1;

COMMENT ON COLUMN t_p83864310_fintech_payment_reco.companies.is_platform_admin IS 'Компания-оператор платформы. Только одна компания может иметь этот флаг. Владельцы/сотрудники этой компании получают доступ к /admin';
