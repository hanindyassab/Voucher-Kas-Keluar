document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('trans-date').value = new Date().toISOString().split('T')[0];
    renderRows();
});

async function submitVoucher() {
    const submitButton = document.getElementById('submit-btn');
    submitButton.disabled = true;
    submitButton.textContent = 'Menyimpan...';

    try {
        const response = await fetch('/api/vouchers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(getVoucherPayload())
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.details || result.error || 'Permintaan gagal.');
        }
        document.getElementById('voucher-no').value = result.voucher.id;
        alert(`Voucher ${result.voucher.id} berhasil disimpan ke Supabase.`);
    } catch (error) {
        alert(`Gagal menyimpan voucher: ${error.message}`);
    } finally {
        submitButton.textContent = 'Submit Voucher';
        renderRows();
    }
}
