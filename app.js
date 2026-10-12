const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { randomBytes } = require('node:crypto');

const rootDirectory = path.resolve(__dirname, '..');
const frontendDirectory = path.join(rootDirectory, 'Frontend');
const port = Number(process.env.PORT || 3000);
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Atur SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY sebelum menjalankan backend.');
    process.exit(1);
}

function sendJson(response, statusCode, body) {
    response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(body));
}

function readJson(request) {
    return new Promise((resolve, reject) => {
        let body = '';
        request.on('data', (chunk) => {
            body += chunk;
            if (body.length > 1024 * 1024) {
                reject(new Error('Ukuran data melebihi batas 1 MB.'));
                request.destroy();
            }
        });
        request.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch {
                reject(new Error('Format JSON tidak valid.'));
            }
        });
        request.on('error', reject);
    });
}

function validateVoucher(voucher) {
    if (!voucher || typeof voucher !== 'object' || Array.isArray(voucher)) {
        return 'Data voucher tidak valid.';
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(voucher.transaction_date || '')) {
        return 'Tanggal transaksi wajib diisi dengan format yang valid.';
    }
    for (const field of ['prepared_by', 'payee', 'description']) {
        if (typeof voucher[field] !== 'string' || !voucher[field].trim()) {
            return `${field} wajib diisi.`;
        }
    }
    if (!Array.isArray(voucher.lines) || voucher.lines.length < 2) {
        return 'Minimal harus ada dua baris jurnal.';
    }

    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of voucher.lines) {
        if (!line || typeof line.account_code !== 'string' || !line.account_code.trim()
            || typeof line.account_name !== 'string' || !line.account_name.trim()) {
            return 'Setiap baris jurnal harus memiliki akun.';
        }
        const debit = Number(line.debit);
        const credit = Number(line.credit);
        if (!Number.isFinite(debit) || !Number.isFinite(credit)
            || debit < 0 || credit < 0 || (debit > 0 && credit > 0)
            || (debit === 0 && credit === 0)) {
            return 'Nilai debit/kredit pada setiap baris harus valid dan hanya salah satunya yang terisi.';
        }
        totalDebit += debit;
        totalCredit += credit;
    }
    if (totalDebit <= 0 || totalDebit !== totalCredit) {
        return 'Total debit dan kredit harus seimbang dan lebih dari nol.';
    }
    return null;
}

async function createVoucher(voucher) {
    const voucherId = `KK-${voucher.transaction_date.replaceAll('-', '')}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const voucherRecord = {
        id: voucherId,
        transaction_date: voucher.transaction_date,
        prepared_by: voucher.prepared_by.trim(),
        payee: voucher.payee.trim(),
        description: voucher.description.trim(),
        total: voucher.lines.reduce((sum, line) => sum + Number(line.debit), 0),
        status: 'DRAFT'
    };
    const lines = voucher.lines.map((line) => ({
        account_code: line.account_code.trim(),
        account_name: line.account_name.trim(),
        memo: voucher.description.trim(),
        debit: Number(line.debit),
        credit: Number(line.credit)
    }));

    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/create_voucher_with_lines`, {
        method: 'POST',
        headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ p_voucher: voucherRecord, p_lines: lines })
    });
    const responseBody = await response.json();
    if (!response.ok) {
        throw new Error(responseBody.message || responseBody.error || 'Supabase menolak penyimpanan voucher.');
    }
    return { id: voucherId, data: responseBody };
}

function serveFile(response, filePath) {
    fs.readFile(filePath, (error, content) => {
        if (error) {
            sendJson(response, 404, { error: 'File tidak ditemukan.' });
            return;
        }
        const extension = path.extname(filePath);
        const contentTypes = {
            '.html': 'text/html; charset=utf-8',
            '.js': 'text/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8'
        };
        response.writeHead(200, { 'Content-Type': contentTypes[extension] || 'application/octet-stream' });
        response.end(content);
    });
}

const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    if (request.method === 'POST' && requestUrl.pathname === '/api/vouchers') {
        try {
            const voucher = await readJson(request);
            const validationError = validateVoucher(voucher);
            if (validationError) {
                sendJson(response, 400, { error: validationError });
                return;
            }
            const savedVoucher = await createVoucher(voucher);
            sendJson(response, 201, { success: true, voucher: savedVoucher });
        } catch (error) {
            console.error('Gagal menyimpan voucher:', error.message);
            sendJson(response, 500, { error: 'Voucher gagal disimpan ke Supabase.', details: error.message });
        }
        return;
    }

    if (request.method !== 'GET') {
        sendJson(response, 405, { error: 'Metode tidak didukung.' });
        return;
    }

    const files = {
        '/': path.join(frontendDirectory, 'index.html'),
        '/app.js': path.join(frontendDirectory, 'app.js'),
        '/feature.js': path.join(frontendDirectory, 'feature.js'),
        '/style.css': path.join(frontendDirectory, 'style.css')
    };
    const filePath = files[requestUrl.pathname];
    if (!filePath) {
        sendJson(response, 404, { error: 'Halaman tidak ditemukan.' });
        return;
    }
    serveFile(response, filePath);
});

server.listen(port, '127.0.0.1', () => {
    console.log(`Aplikasi berjalan di http://localhost:${port}`);
});
