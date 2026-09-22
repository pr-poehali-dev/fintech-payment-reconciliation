UPDATE t_p83864310_fintech_payment_reco.webhook_events we
SET external_deal_id = (we.raw_payload -> 'data' -> 'FIELDS' ->> 'ID')
WHERE we.provider_slug = 'bitrix24'
  AND we.external_deal_id IS NULL
  AND we.raw_payload -> 'data' -> 'FIELDS' ->> 'ID' IS NOT NULL;

UPDATE t_p83864310_fintech_payment_reco.webhook_events we
SET external_deal_id = split_part(we.raw_payload -> 'document_id' ->> '2', '_', 2)
WHERE we.provider_slug = 'bitrix24'
  AND we.external_deal_id IS NULL
  AND we.raw_payload -> 'document_id' ->> '2' ILIKE 'DEAL_%';