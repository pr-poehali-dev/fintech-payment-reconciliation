CREATE TABLE t_p83864310_fintech_payment_reco.automation_scenarios (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES t_p83864310_fintech_payment_reco.companies(id),
    name VARCHAR(200) NOT NULL,
    trigger_type VARCHAR(50) NOT NULL,
    source_integration_id INTEGER REFERENCES t_p83864310_fintech_payment_reco.user_integrations(id),
    action_type VARCHAR(50) NOT NULL,
    action_template VARCHAR(50) NOT NULL,
    target_integration_id INTEGER REFERENCES t_p83864310_fintech_payment_reco.user_integrations(id),
    field_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'stopped',
    removed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_automation_scenarios_company ON t_p83864310_fintech_payment_reco.automation_scenarios(company_id) WHERE removed_at IS NULL;
CREATE INDEX idx_automation_scenarios_source ON t_p83864310_fintech_payment_reco.automation_scenarios(source_integration_id, trigger_type) WHERE removed_at IS NULL AND status = 'active';

CREATE TABLE t_p83864310_fintech_payment_reco.automation_jobs (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES t_p83864310_fintech_payment_reco.companies(id),
    scenario_id INTEGER NOT NULL REFERENCES t_p83864310_fintech_payment_reco.automation_scenarios(id),
    source_type VARCHAR(50) NOT NULL,
    source_id VARCHAR(100) NOT NULL,
    event_id INTEGER NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'new',
    step VARCHAR(50) NOT NULL DEFAULT 'prepare',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    prepared_data JSONB NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NULL,
    next_attempt_at TIMESTAMP NOT NULL DEFAULT NOW(),
    locked_until TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_automation_jobs_scenario_source UNIQUE (scenario_id, source_type, source_id)
);

CREATE INDEX idx_automation_jobs_company_created ON t_p83864310_fintech_payment_reco.automation_jobs(company_id, created_at DESC);
CREATE INDEX idx_automation_jobs_pending ON t_p83864310_fintech_payment_reco.automation_jobs(next_attempt_at) WHERE status IN ('new', 'error');

CREATE TABLE t_p83864310_fintech_payment_reco.automation_job_log (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES t_p83864310_fintech_payment_reco.automation_jobs(id),
    level VARCHAR(10) NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    details JSONB NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_automation_job_log_job ON t_p83864310_fintech_payment_reco.automation_job_log(job_id, created_at);