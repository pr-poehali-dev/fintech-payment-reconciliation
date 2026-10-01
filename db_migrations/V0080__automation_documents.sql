CREATE TABLE t_p83864310_fintech_payment_reco.automation_documents (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL,
    job_id INTEGER NULL,
    scenario_id INTEGER NULL,
    payment_row_id INTEGER NULL,
    kassa_integration_id INTEGER NOT NULL,
    doc_kind VARCHAR(20) NOT NULL DEFAULT 'order',
    operation VARCHAR(40) NOT NULL DEFAULT 'sell',
    external_id VARCHAR(128) NOT NULL,
    ecom_uuid VARCHAR(64) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'wait',
    total_sum NUMERIC(15, 2) NULL,
    advance_sum NUMERIC(15, 2) NOT NULL DEFAULT 0,
    receipt_id INTEGER NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (kassa_integration_id, external_id)
);
CREATE INDEX idx_automation_documents_uuid ON t_p83864310_fintech_payment_reco.automation_documents (kassa_integration_id, ecom_uuid);
CREATE INDEX idx_automation_documents_payment ON t_p83864310_fintech_payment_reco.automation_documents (payment_row_id);
CREATE INDEX idx_automation_documents_receipt ON t_p83864310_fintech_payment_reco.automation_documents (receipt_id);

INSERT INTO t_p83864310_fintech_payment_reco.automation_documents
    (company_id, job_id, scenario_id, payment_row_id, kassa_integration_id, doc_kind, operation,
     external_id, ecom_uuid, status, total_sum, advance_sum, receipt_id, created_at)
SELECT j.company_id, j.id, j.scenario_id, j.source_id::int, s.target_integration_id, 'order', 'sell',
       l.details->>'external_id', l.details->'response'->>'uuid',
       COALESCE(ekr.status, 'wait'),
       (l.details->'request'->'receipt'->>'total')::numeric,
       COALESCE((SELECT SUM((p->>'sum')::numeric) FROM jsonb_array_elements(l.details->'request'->'receipt'->'payments') p WHERE p->>'type' = '2'), 0),
       ekr.id, j.created_at
FROM t_p83864310_fintech_payment_reco.automation_jobs j
JOIN t_p83864310_fintech_payment_reco.automation_scenarios s ON s.id = j.scenario_id
JOIN LATERAL (
    SELECT details FROM t_p83864310_fintech_payment_reco.automation_job_log l
    WHERE l.job_id = j.id AND l.details ? 'response' AND l.details ? 'external_id'
    ORDER BY l.id DESC LIMIT 1
) l ON true
LEFT JOIN t_p83864310_fintech_payment_reco.ecomkassa_receipts ekr
    ON ekr.integration_id = s.target_integration_id AND ekr.order_id = l.details->'response'->>'uuid'
WHERE j.source_type = 'payment' AND l.details->'response'->>'uuid' IS NOT NULL
ON CONFLICT (kassa_integration_id, external_id) DO NOTHING;