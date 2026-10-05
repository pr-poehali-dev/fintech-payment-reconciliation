CREATE TABLE IF NOT EXISTS t_p83864310_fintech_payment_reco.platform_banners (
    page varchar(40) PRIMARY KEY,
    text text NOT NULL DEFAULT '',
    button_text varchar(80) NOT NULL DEFAULT '',
    button_url varchar(500) NOT NULL DEFAULT '',
    variant varchar(20) NOT NULL DEFAULT 'info',
    updated_by integer NULL,
    updated_at timestamp NOT NULL DEFAULT now()
);