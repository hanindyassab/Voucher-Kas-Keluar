CREATE TABLE vouchers (
    id VARCHAR(50) PRIMARY KEY,
    transaction_date DATE NOT NULL,
    prepared_by VARCHAR(100) NOT NULL,
    payee VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    total DECIMAL(15,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'DRAFT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE voucher_lines (
    id SERIAL PRIMARY KEY,
    voucher_id VARCHAR(50) REFERENCES vouchers(id) ON DELETE CASCADE,
    account_code VARCHAR(20) NOT NULL,
    account_name VARCHAR(150) NOT NULL,
    memo TEXT,
    debit DECIMAL(15,2) DEFAULT 0,
    credit DECIMAL(15,2) DEFAULT 0
);

CREATE OR REPLACE FUNCTION create_voucher_with_lines(p_voucher JSONB, p_lines JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    inserted_voucher vouchers;
BEGIN
    INSERT INTO vouchers (id, transaction_date, prepared_by, payee, description, total, status)
    VALUES (
        p_voucher->>'id',
        (p_voucher->>'transaction_date')::DATE,
        p_voucher->>'prepared_by',
        p_voucher->>'payee',
        p_voucher->>'description',
        (p_voucher->>'total')::DECIMAL(15,2),
        COALESCE(p_voucher->>'status', 'DRAFT')
    )
    RETURNING * INTO inserted_voucher;

    INSERT INTO voucher_lines (voucher_id, account_code, account_name, memo, debit, credit)
    SELECT
        inserted_voucher.id,
        line.account_code,
        line.account_name,
        line.memo,
        line.debit,
        line.credit
    FROM jsonb_to_recordset(p_lines) AS line(
        account_code VARCHAR(20),
        account_name VARCHAR(150),
        memo TEXT,
        debit DECIMAL(15,2),
        credit DECIMAL(15,2)
    );

    RETURN to_jsonb(inserted_voucher);
END;
$$;

REVOKE EXECUTE ON FUNCTION create_voucher_with_lines(JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_voucher_with_lines(JSONB, JSONB) TO service_role;