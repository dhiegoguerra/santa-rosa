require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const crypto = require('crypto');
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PORT = Number(process.env.DB_PORT || 3306);
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_SESSION_HOURS = Number(process.env.ADMIN_SESSION_HOURS || 3);
const ADMIN_SESSION_TTL_MS = Math.max(1, ADMIN_SESSION_HOURS) * 60 * 60 * 1000;
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = ['1', 'true', 'yes', 'on'].includes(String(process.env.SMTP_SECURE || '').toLowerCase());
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || 'contato@starosajuridico.com.br';
const LEAD_NOTIFICATION_TO = process.env.LEAD_NOTIFICATION_TO || 'contato@starosajuridico.com.br';
const activeAdminTokens = new Map();
let mailTransporter = null;

// Libera o frontend local e os dominios publicados a consumir a API.
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://santarosaadvogados.com.br',
        'https://www.santarosaadvogados.com.br',
        'https://api.santarosaadvogados.com.br'
    ],
    credentials: true
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve o favicon e outros arquivos publicos pela raiz do dominio.
app.use(express.static('public'));

// Mantem cadastro_cliente.html e os demais arquivos da raiz acessiveis pelo backend.
app.use(express.static('.'));

// Pool de conexoes para reutilizar acessos ao MySQL e evitar abrir uma conexao por request.
const pool = mysql.createPool({
    host: process.env.DB_HOST || '',
    port: DB_PORT,
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Evita que textos vindos do banco sejam interpretados como HTML dentro do painel.
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Padroniza datas no horario de Sao Paulo antes de exibir para o administrador.
function formatDateTime(value) {
    if (!value) {
        return '--';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).format(date);
}

function hasLeadNotificationConfig() {
    return Boolean(SMTP_HOST && SMTP_FROM && LEAD_NOTIFICATION_TO);
}

function getMailTransporter() {
    if (!hasLeadNotificationConfig()) {
        return null;
    }

    if (!mailTransporter) {
        const transportConfig = {
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_SECURE
        };

        if (SMTP_USER || SMTP_PASSWORD) {
            transportConfig.auth = {
                user: SMTP_USER,
                pass: SMTP_PASSWORD
            };
        }

        mailTransporter = nodemailer.createTransport(transportConfig);
    }

    return mailTransporter;
}

function normalizeLeadText(value) {
    return String(value ?? '')
        .replace(/\r\n/g, '\n')
        .trim();
}

function buildLeadNotificationText(lead) {
    return [
        'Lead novo.',
        '',
        `ID: ${lead.leadId}`,
        `Data: ${formatDateTime(lead.createdAt)}`,
        `Nome: ${lead.nome}`,
        `E-mail: ${lead.email}`,
        `Telefone: ${lead.telefone}`,
        `Assunto: ${lead.assunto}`,
        '',
        'Descricao:',
        normalizeLeadText(lead.descricao)
    ].join('\n');
}

function buildLeadNotificationHtml(lead) {
    const descriptionHtml = escapeHtml(normalizeLeadText(lead.descricao)).replace(/\n/g, '<br>');

    return `
        <div style="font-family: Arial, sans-serif; color: #2c241d; line-height: 1.6;">
            <h2 style="margin: 0 0 16px; color: #8c3d2e;">Lead novo.</h2>
            <p style="margin: 0 0 10px;"><strong>ID:</strong> ${escapeHtml(lead.leadId)}</p>
            <p style="margin: 0 0 10px;"><strong>Data:</strong> ${escapeHtml(formatDateTime(lead.createdAt))}</p>
            <p style="margin: 0 0 10px;"><strong>Nome:</strong> ${escapeHtml(lead.nome)}</p>
            <p style="margin: 0 0 10px;"><strong>E-mail:</strong> ${escapeHtml(lead.email)}</p>
            <p style="margin: 0 0 10px;"><strong>Telefone:</strong> ${escapeHtml(lead.telefone)}</p>
            <p style="margin: 0 0 10px;"><strong>Assunto:</strong> ${escapeHtml(lead.assunto)}</p>
            <p style="margin: 18px 0 8px;"><strong>Descricao:</strong></p>
            <p style="margin: 0;">${descriptionHtml || '--'}</p>
        </div>
    `;
}

async function sendLeadNotificationEmail(lead) {
    const transporter = getMailTransporter();

    if (!transporter) {
        console.warn('Notificacao de lead ignorada: SMTP nao configurado.');
        return false;
    }

    await transporter.sendMail({
        from: SMTP_FROM,
        to: LEAD_NOTIFICATION_TO,
        subject: 'Lead novo.',
        text: buildLeadNotificationText(lead),
        html: buildLeadNotificationHtml(lead)
    });

    return true;
}

// Cria um token temporario em memoria para liberar o acesso ao painel administrativo.
function createAdminToken() {
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
    activeAdminTokens.set(token, expiresAt);
    return { token, expiresAt };
}

// Aceita o token tanto no header Authorization quanto no x-admin-token.
function getAdminTokenFromRequest(req) {
    const authHeader = req.headers.authorization || '';

    if (authHeader.startsWith('Bearer ')) {
        return authHeader.slice('Bearer '.length).trim();
    }

    return req.headers['x-admin-token'] || '';
}

// Protege a API administrativa com token de sessao do painel.
function requireAdminSession(req, res, next) {
    if (!ADMIN_PASSWORD) {
        return res.status(503).json({
            sucesso: false,
            erro: 'Configure ADMIN_USERNAME e ADMIN_PASSWORD no arquivo .env para liberar o painel.'
        });
    }

    const token = getAdminTokenFromRequest(req);

    if (!token) {
        return res.status(401).json({
            sucesso: false,
            erro: 'Sessao administrativa invalida ou expirada.'
        });
    }

    const expiresAt = activeAdminTokens.get(token);

    if (!expiresAt || expiresAt <= Date.now()) {
        activeAdminTokens.delete(token);
        return res.status(401).json({
            sucesso: false,
            erro: 'Sessao administrativa invalida ou expirada.'
        });
    }

    next();
}

// Garante que a tabela exista e adiciona dt_cadastro em bases antigas.
async function ensureLeadsSchema() {
    const connection = await pool.getConnection();

    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS leads (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(255),
                tx_email VARCHAR(255),
                telefone VARCHAR(20),
                tx_assunto VARCHAR(255),
                descricao LONGTEXT,
                dt_cadastro DATETIME NULL
            )
        `);

        const [columns] = await connection.query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ?
              AND TABLE_NAME = 'leads'
        `, [process.env.DB_NAME || '']);

        const columnNames = new Set(columns.map((column) => column.COLUMN_NAME));

        if (!columnNames.has('tx_email')) {
            await connection.query(`
                ALTER TABLE leads
                ADD COLUMN tx_email VARCHAR(255) NULL
            `);
            console.log("Coluna 'tx_email' adicionada na tabela 'leads'.");
        }

        if (!columnNames.has('tx_assunto')) {
            await connection.query(`
                ALTER TABLE leads
                ADD COLUMN tx_assunto VARCHAR(255) NULL
            `);
            console.log("Coluna 'tx_assunto' adicionada na tabela 'leads'.");
        }

        if (!columnNames.has('dt_cadastro')) {
            await connection.query(`
                ALTER TABLE leads
                ADD COLUMN dt_cadastro DATETIME NULL
            `);
            console.log("Coluna 'dt_cadastro' adicionada na tabela 'leads'.");
        }

        if (columnNames.has('created_at')) {
            await connection.query(`
                UPDATE leads
                SET dt_cadastro = created_at
                WHERE dt_cadastro IS NULL
            `);
        }

        await connection.query(`
            UPDATE leads
            SET dt_cadastro = NOW()
            WHERE dt_cadastro IS NULL
        `);
    } finally {
        connection.release();
    }
}

// Descobre qual coluna de data existe hoje na base para evitar quebrar o painel.
async function getLeadDateColumn(connection) {
    const [columns] = await connection.query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = 'leads'
          AND COLUMN_NAME IN ('created_at', 'dt_cadastro')
    `, [process.env.DB_NAME || '']);

    const columnNames = new Set(columns.map((column) => column.COLUMN_NAME));

    if (columnNames.has('dt_cadastro')) {
        return 'dt_cadastro';
    }

    if (columnNames.has('created_at')) {
        return 'created_at';
    }

    return null;
}

// Centraliza a leitura dos leads usados no painel e na rota JSON.
async function fetchLeads() {
    const connection = await pool.getConnection();

    try {
        // Sempre devolve a data com o mesmo alias, mesmo se a base ainda estiver usando created_at.
        const dateColumn = await getLeadDateColumn(connection);
        const selectDateColumn = dateColumn
            ? `${dateColumn} AS dt_cadastro`
            : 'NULL AS dt_cadastro';

        const [rows] = await connection.query(`
            SELECT id, nome, tx_email, telefone, tx_assunto, descricao, ${selectDateColumn}
            FROM leads
            ORDER BY id DESC
        `);
        return rows;
    } finally {
        connection.release();
    }
}

// Monta o HTML do painel administrativo sem depender de um arquivo separado.
function renderLeadsPanel() {
    return `
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <!-- Favicon exibido na aba do navegador. -->
            <link rel="icon" type="image/png" href="/favicon.png">
            <title>Painel de Leads</title>
            <style>
                :root {
                    --bg: #f4efe7;
                    --panel: #fffdf8;
                    --text: #2c241d;
                    --muted: #74675b;
                    --line: #dbcdbb;
                    --brand: #8c3d2e;
                    --brand-soft: #f6e3d4;
                }
                * { box-sizing: border-box; }
                body {
                    margin: 0;
                    font-family: Georgia, "Times New Roman", serif;
                    background:
                        radial-gradient(circle at top right, rgba(140, 61, 46, 0.12), transparent 24%),
                        linear-gradient(180deg, #f8f2ea 0%, var(--bg) 100%);
                    color: var(--text);
                }
                .wrap {
                    width: min(1200px, calc(100% - 32px));
                    margin: 32px auto;
                }
                .hero {
                    background: var(--panel);
                    border: 1px solid var(--line);
                    border-radius: 24px;
                    padding: 28px;
                    box-shadow: 0 18px 60px rgba(44, 36, 29, 0.08);
                }
                h1 {
                    margin: 0 0 10px;
                    font-size: clamp(30px, 5vw, 46px);
                }
                p {
                    margin: 0;
                    color: var(--muted);
                    line-height: 1.5;
                }
                .stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    gap: 16px;
                    margin-top: 22px;
                }
                .card {
                    background: var(--brand-soft);
                    border: 1px solid #ebcbb0;
                    border-radius: 18px;
                    padding: 16px;
                }
                .card strong {
                    display: block;
                    font-size: 28px;
                    margin-bottom: 4px;
                }
                .toolbar {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                    align-items: center;
                    justify-content: space-between;
                    margin: 18px 0;
                }
                .toolbar-main {
                    display: flex;
                    flex: 1;
                    flex-wrap: wrap;
                    gap: 12px;
                    align-items: center;
                }
                .search {
                    width: min(420px, 100%);
                    padding: 12px 14px;
                    border-radius: 14px;
                    border: 1px solid var(--line);
                    background: #fff;
                    color: var(--text);
                    font-size: 16px;
                }
                .search:focus,
                .date-input:focus {
                    outline: none;
                    border-color: var(--brand);
                    box-shadow: 0 0 0 4px rgba(140, 61, 46, 0.12);
                }
                .filters {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 12px;
                    align-items: flex-end;
                }
                .date-field {
                    display: grid;
                    gap: 6px;
                    min-width: 140px;
                }
                .date-field span {
                    font-size: 13px;
                    font-weight: 700;
                    color: var(--muted);
                }
                .date-input {
                    width: 100%;
                    padding: 12px 14px;
                    border-radius: 14px;
                    border: 1px solid var(--line);
                    background: #fff;
                    color: var(--text);
                    font-size: 16px;
                }
                .button {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    padding: 12px 16px;
                    border-radius: 14px;
                    border: 1px solid var(--brand);
                    background: var(--brand);
                    color: #fff;
                    text-decoration: none;
                    font-weight: 700;
                    cursor: pointer;
                }
                .button-secondary {
                    background: transparent;
                    color: var(--brand);
                }
                .table-shell {
                    overflow: auto;
                    background: var(--panel);
                    border: 1px solid var(--line);
                    border-radius: 24px;
                    box-shadow: 0 18px 60px rgba(44, 36, 29, 0.06);
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    min-width: 1180px;
                }
                th, td {
                    padding: 16px;
                    text-align: left;
                    border-bottom: 1px solid var(--line);
                    vertical-align: top;
                }
                th {
                    background: #f8f1e9;
                    color: var(--brand);
                    position: sticky;
                    top: 0;
                }
                tr:hover td {
                    background: #fffaf4;
                }
                td a {
                    color: var(--brand);
                    text-decoration: none;
                    font-weight: 700;
                }
                .col-nome,
                .col-email,
                .col-telefone,
                .col-assunto {
                    white-space: nowrap;
                }
                .col-nome {
                    min-width: 170px;
                }
                .col-email {
                    min-width: 220px;
                }
                .col-telefone {
                    min-width: 140px;
                }
                .col-assunto {
                    min-width: 180px;
                }
                .descricao {
                    min-width: 280px;
                    white-space: pre-wrap;
                }
                .empty {
                    padding: 40px 24px;
                    text-align: center;
                    color: var(--muted);
                }
                .login-shell {
                    max-width: 420px;
                    margin: 10vh auto 0;
                    background: var(--panel);
                    border: 1px solid var(--line);
                    border-radius: 24px;
                    padding: 28px;
                    box-shadow: 0 18px 60px rgba(44, 36, 29, 0.08);
                }
                .login-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 12px;
                    border-radius: 999px;
                    background: var(--brand-soft);
                    border: 1px solid #ebcbb0;
                    color: var(--brand);
                    font-size: 13px;
                    font-weight: 700;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                }
                .login-shell h1 {
                    margin-top: 18px;
                }
                .login-shell p {
                    margin-top: 8px;
                }
                .field {
                    display: grid;
                    gap: 8px;
                    margin-top: 16px;
                }
                .field span {
                    font-size: 14px;
                    font-weight: 700;
                    color: var(--text);
                }
                .field input {
                    width: 100%;
                    padding: 12px 14px;
                    border-radius: 14px;
                    border: 1px solid var(--line);
                    background: #fff;
                    color: var(--text);
                    font-size: 16px;
                }
                .field input:focus {
                    outline: none;
                    border-color: var(--brand);
                    box-shadow: 0 0 0 4px rgba(140, 61, 46, 0.12);
                }
                .actions {
                    display: flex;
                    gap: 12px;
                    margin-top: 18px;
                }
                .message {
                    margin-top: 14px;
                    color: var(--brand);
                    min-height: 20px;
                    font-size: 14px;
                }
                .login-note {
                    margin-top: 18px;
                    padding-top: 18px;
                    border-top: 1px solid var(--line);
                    color: var(--muted);
                    font-size: 14px;
                    line-height: 1.6;
                }
                .footer-note {
                    margin-top: 12px;
                    color: var(--muted);
                    font-size: 14px;
                }
                @media (max-width: 720px) {
                    .wrap {
                        width: min(100% - 20px, 1200px);
                        margin: 20px auto;
                    }
                    .hero, .table-shell {
                        border-radius: 18px;
                    }
                }
            </style>
        </head>
        <body>
            <div id="app"></div>

            <script>
                // Chaves usadas no navegador para guardar a sessao administrativa.
                const TOKEN_KEY = 'painelLeadsToken';
                const TOKEN_EXPIRES_KEY = 'painelLeadsTokenExpiresAt';

                // Protege a tabela contra textos com tags HTML vindos do banco.
                function escapeHtml(value) {
                    return String(value ?? '')
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#39;');
                }

                // Mostra o formulario de login quando nao existe sessao valida.
                function renderLogin(message = '') {
                    document.getElementById('app').innerHTML = \`
                        <div class="login-shell">
                            <div class="login-badge">Area administrativa</div>
                            <h1>Painel de Leads</h1>
                            <p>Entre com o usuario e senha administrativos para consultar os leads cadastrados no site.</p>
                            <form id="loginForm">
                                <label class="field">
                                    <span>Usuario</span>
                                    <input name="username" autocomplete="username" required>
                                </label>
                                <label class="field">
                                    <span>Senha</span>
                                    <input name="password" type="password" autocomplete="current-password" required>
                                </label>
                                <div class="actions">
                                    <button class="button" type="submit">Entrar</button>
                                </div>
                                <div class="message">\${escapeHtml(message)}</div>
                            </form>
                            <div class="login-note">
                                A sessao deste painel fica ativa por ate ${ADMIN_SESSION_HOURS} hora(s).
                            </div>
                        </div>
                    \`;

                    document.getElementById('loginForm').addEventListener('submit', handleLogin);
                }

                // Formata a data recebida da API para o padrao brasileiro.
                function formatDateTime(value) {
                    if (!value) {
                        return '--';
                    }

                    const date = new Date(value);

                    if (Number.isNaN(date.getTime())) {
                        return String(value);
                    }

                    return new Intl.DateTimeFormat('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    }).format(date);
                }

                // Extrai a data de Sao Paulo em YYYY-MM-DD para comparar com os filtros.
                function getFilterDateKey(value) {
                    if (!value) {
                        return '';
                    }

                    const date = new Date(value);

                    if (Number.isNaN(date.getTime())) {
                        return '';
                    }

                    const parts = new Intl.DateTimeFormat('en-GB', {
                        timeZone: 'America/Sao_Paulo',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                    }).formatToParts(date);

                    const day = parts.find((part) => part.type === 'day')?.value;
                    const month = parts.find((part) => part.type === 'month')?.value;
                    const year = parts.find((part) => part.type === 'year')?.value;

                    if (!day || !month || !year) {
                        return '';
                    }

                    return \`\${year}-\${month}-\${day}\`;
                }

                function createLeadViewModel(row) {
                    const formattedDate = formatDateTime(row.dt_cadastro);
                    const filterDateKey = getFilterDateKey(row.dt_cadastro);
                    const searchableText = [
                        row.id,
                        row.nome,
                        row.tx_email,
                        row.telefone,
                        row.tx_assunto,
                        row.descricao,
                        formattedDate,
                        filterDateKey
                    ].join(' ').toLowerCase();

                    return {
                        ...row,
                        formattedDate,
                        filterDateKey,
                        searchableText
                    };
                }

                function buildRowsHtml(leads) {
                    return leads.map((row) => \`
                        <tr>
                            <td>\${escapeHtml(row.id)}</td>
                            <td class="col-nome">\${escapeHtml(row.nome)}</td>
                            <td class="col-email">\${escapeHtml(row.tx_email)}</td>
                            <td class="col-telefone">\${escapeHtml(row.telefone)}</td>
                            <td class="col-assunto">\${escapeHtml(row.tx_assunto)}</td>
                            <td class="descricao">\${escapeHtml(row.descricao)}</td>
                            <td>\${escapeHtml(row.formattedDate)}</td>
                        </tr>
                    \`).join('');
                }

                // Monta os cards, a busca e a tabela com os leads recebidos da API.
                function renderTable(leads) {
                    const viewLeads = leads.map(createLeadViewModel);

                    document.getElementById('app').innerHTML = \`
                        <div class="wrap">
                            <section class="hero">
                                <h1>Painel de Leads</h1>
                                <p>Acesse os cadastros recebidos pelo site sem abrir o banco de dados.</p>
                                <div class="stats">
                                    <div class="card">
                                        <strong id="totalLeadsValue">\${viewLeads.length}</strong>
                                        <span>Total de leads</span>
                                    </div>
                                    <div class="card">
                                        <strong id="visibleLeadsValue">\${viewLeads.length}</strong>
                                        <span>Leads exibidos</span>
                                    </div>
                                    <div class="card">
                                        <strong id="lastLeadValue">\${viewLeads[0] ? escapeHtml(viewLeads[0].formattedDate) : '--'}</strong>
                                        <span>Ultimo cadastro</span>
                                    </div>
                                </div>
                            </section>

                            <div class="toolbar">
                                <div class="toolbar-main">
                                    <input id="searchInput" class="search" type="search" placeholder="Buscar por nome, e-mail, telefone, assunto ou descricao">
                                    <div class="filters">
                                        <label class="date-field">
                                            <span>Data inicial</span>
                                            <input id="startDateInput" class="date-input" type="date">
                                        </label>
                                        <label class="date-field">
                                            <span>Data final</span>
                                            <input id="endDateInput" class="date-input" type="date">
                                        </label>
                                        <button id="clearFiltersButton" class="button button-secondary" type="button">Limpar filtros</button>
                                    </div>
                                </div>
                                <button id="logoutButton" class="button button-secondary" type="button">Sair</button>
                            </div>

                            <section id="resultsShell" class="table-shell"></section>
                            <p id="resultsSummary" class="footer-note"></p>
                            <p class="footer-note">A sessao do painel dura somente enquanto esta aba estiver aberta.</p>
                        </div>
                    \`;

                    const input = document.getElementById('searchInput');
                    const startDateInput = document.getElementById('startDateInput');
                    const endDateInput = document.getElementById('endDateInput');
                    const clearFiltersButton = document.getElementById('clearFiltersButton');
                    const logoutButton = document.getElementById('logoutButton');
                    const resultsShell = document.getElementById('resultsShell');
                    const totalLeadsValue = document.getElementById('totalLeadsValue');
                    const visibleLeadsValue = document.getElementById('visibleLeadsValue');
                    const lastLeadValue = document.getElementById('lastLeadValue');
                    const resultsSummary = document.getElementById('resultsSummary');

                    function renderResults(filteredLeads, hasActiveFilters) {
                        if (totalLeadsValue) {
                            totalLeadsValue.textContent = String(viewLeads.length);
                        }

                        if (visibleLeadsValue) {
                            visibleLeadsValue.textContent = String(filteredLeads.length);
                        }

                        if (lastLeadValue) {
                            lastLeadValue.textContent = filteredLeads[0]?.formattedDate || '--';
                        }

                        if (resultsShell) {
                            if (!filteredLeads.length) {
                                resultsShell.innerHTML = \`
                                    <div class="empty">
                                        \${viewLeads.length
                                            ? 'Nenhum lead encontrado para os filtros informados.'
                                            : 'Nenhum lead cadastrado ainda.'}
                                    </div>
                                \`;
                            } else {
                                resultsShell.innerHTML = \`
                                    <table id="leadsTable">
                                        <thead>
                                            <tr>
                                                <th>ID</th>
                                                <th>Nome</th>
                                                <th>E-mail</th>
                                                <th>Telefone</th>
                                                <th>Assunto</th>
                                                <th>Descricao</th>
                                                <th>Criado em</th>
                                            </tr>
                                        </thead>
                                        <tbody>\${buildRowsHtml(filteredLeads)}</tbody>
                                    </table>
                                \`;
                            }
                        }

                        if (resultsSummary) {
                            resultsSummary.textContent = hasActiveFilters
                                ? \`Mostrando \${filteredLeads.length} de \${viewLeads.length} lead(s) com os filtros aplicados.\`
                                : \`Mostrando \${viewLeads.length} lead(s).\`;
                        }
                    }

                    function applyFilters() {
                        const term = input ? input.value.toLowerCase().trim() : '';
                        const startDate = startDateInput ? startDateInput.value : '';
                        const endDate = endDateInput ? endDateInput.value : '';
                        const hasActiveFilters = Boolean(term || startDate || endDate);

                        if (resultsShell && startDate && endDate && startDate > endDate) {
                            if (visibleLeadsValue) {
                                visibleLeadsValue.textContent = '0';
                            }

                            if (lastLeadValue) {
                                lastLeadValue.textContent = '--';
                            }

                            resultsShell.innerHTML = '<div class="empty">A data inicial nao pode ser maior que a data final.</div>';

                            if (resultsSummary) {
                                resultsSummary.textContent = 'Ajuste o periodo para continuar a busca.';
                            }

                            return;
                        }

                        const filteredLeads = viewLeads.filter((lead) => {
                            const matchesText = !term || lead.searchableText.includes(term);
                            const matchesStartDate = !startDate || (lead.filterDateKey && lead.filterDateKey >= startDate);
                            const matchesEndDate = !endDate || (lead.filterDateKey && lead.filterDateKey <= endDate);
                            return matchesText && matchesStartDate && matchesEndDate;
                        });

                        renderResults(filteredLeads, hasActiveFilters);
                    }

                    if (input) {
                        input.addEventListener('input', applyFilters);
                    }

                    if (startDateInput) {
                        startDateInput.addEventListener('input', applyFilters);
                    }

                    if (endDateInput) {
                        endDateInput.addEventListener('input', applyFilters);
                    }

                    if (clearFiltersButton) {
                        clearFiltersButton.addEventListener('click', () => {
                            if (input) {
                                input.value = '';
                            }

                            if (startDateInput) {
                                startDateInput.value = '';
                            }

                            if (endDateInput) {
                                endDateInput.value = '';
                            }

                            applyFilters();
                        });
                    }

                    if (logoutButton) {
                        logoutButton.addEventListener('click', logout);
                    }

                    renderResults(viewLeads, false);
                }

                // Envia usuario e senha para o backend e salva o token se o login for aceito.
                async function handleLogin(event) {
                    event.preventDefault();

                    const form = new FormData(event.currentTarget);
                    const response = await fetch('/admin/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            username: form.get('username'),
                            password: form.get('password')
                        })
                    });

                    const data = await response.json();

                    if (!response.ok || !data.sucesso) {
                        renderLogin(data.erro || 'Nao foi possivel entrar.');
                        return;
                    }

                    localStorage.setItem(TOKEN_KEY, data.token);
                    localStorage.setItem(TOKEN_EXPIRES_KEY, String(data.expiresAt || ''));
                    await loadLeads();
                }

                // Valida o token salvo e busca a lista de leads protegida pela API.
                async function loadLeads() {
                    const token = localStorage.getItem(TOKEN_KEY);
                    const expiresAt = Number(localStorage.getItem(TOKEN_EXPIRES_KEY) || 0);

                    if (!token || !expiresAt || expiresAt <= Date.now()) {
                        localStorage.removeItem(TOKEN_KEY);
                        localStorage.removeItem(TOKEN_EXPIRES_KEY);
                        renderLogin();
                        return;
                    }

                    const response = await fetch('/api/leads', {
                        headers: {
                            'x-admin-token': token
                        }
                    });

                    const data = await response.json();

                    if (!response.ok || !data.sucesso) {
                        localStorage.removeItem(TOKEN_KEY);
                        localStorage.removeItem(TOKEN_EXPIRES_KEY);
                        renderLogin('Sua sessao expirou. Entre novamente.');
                        return;
                    }

                    renderTable(data.leads || []);
                }

                // Encerra a sessao no navegador e avisa o backend para invalidar o token.
                function logout() {
                    const token = localStorage.getItem(TOKEN_KEY);
                    localStorage.removeItem(TOKEN_KEY);
                    localStorage.removeItem(TOKEN_EXPIRES_KEY);

                    if (token) {
                        navigator.sendBeacon('/admin/logout', new Blob([
                            JSON.stringify({ token })
                        ], { type: 'application/json' }));
                    }

                    renderLogin('Sessao encerrada.');
                }

                loadLeads();
            </script>
        </body>
        </html>
    `;
}

// Prepara a estrutura minima do banco antes de abrir a API para evitar consultas antes da migracao.
async function startServer() {
    try {
        console.log('\nTentando conectar ao banco de dados...');
        console.log(`   Host: ${process.env.DB_HOST || '(nao configurado)'}`);
        console.log(`   Porta: ${DB_PORT}`);
        console.log(`   Banco: ${process.env.DB_NAME || '(nao configurado)'}`);
        await ensureLeadsSchema();
        console.log('Conexao com banco de dados estabelecida!');
        console.log("Tabela 'leads' pronta para uso!");
        console.log('   Colunas esperadas: id, nome, tx_email, telefone, tx_assunto, descricao, dt_cadastro\n');

        app.listen(PORT, () => {
            console.log('\n========================================');
            console.log('SERVIDOR RODANDO COM SUCESSO!');
            console.log('========================================');
            console.log(`Endereco: http://localhost:${PORT}`);
            console.log(`Lista de cadastros: http://localhost:${PORT}/painel-leads`);
            console.log('Pronto para receber cadastros!');
            console.log('========================================\n');
        });
    } catch (err) {
        console.error('Erro ao conectar/criar tabela:', err?.code || err?.message || err);
        if (err?.sqlMessage) {
            console.error('Detalhe SQL:', err.sqlMessage);
        }
        if (err?.code === 'ETIMEDOUT') {
            console.error('O host do MySQL nao respondeu. Confirme o host remoto do cPanel, a porta e se o seu IP foi liberado em Remote MySQL.');
        }
        if (err?.code === 'ECONNREFUSED') {
            console.error('A conexao foi recusada. Verifique se a porta do MySQL esta correta e se o servidor aceita conexoes remotas.');
        }
        if (err?.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('Usuario ou senha do MySQL invalidos para esse host.');
        }
        console.error('Verifique suas credenciais de banco de dados!');
    }
}

// Recebe o lead do formulario e salva no banco.
app.post('/cadastrar', async (req, res) => {
    try {
        const { nome, email, telefone, assunto, descricao } = req.body;

        if (!nome || !email || !telefone || !assunto || !descricao) {
            return res.status(400).json({ erro: 'Dados incompletos.' });
        }

        const sql = 'INSERT INTO leads (nome, tx_email, telefone, tx_assunto, descricao, dt_cadastro) VALUES (?, ?, ?, ?, ?, NOW())';
        const connection = await pool.getConnection();
        let result;

        try {
            [result] = await connection.query(sql, [nome, email, telefone, assunto, descricao]);
        } finally {
            connection.release();
        }

        const leadNotification = {
            leadId: result.insertId,
            nome,
            email,
            telefone,
            assunto,
            descricao,
            createdAt: new Date()
        };

        let emailNotificado = false;

        try {
            emailNotificado = await sendLeadNotificationEmail(leadNotification);
        } catch (mailError) {
            console.error('Erro ao enviar notificacao de lead:', mailError?.message || mailError);
        }

        res.status(200).json({
            sucesso: true,
            mensagem: 'Cadastro realizado com sucesso!',
            leadId: result.insertId,
            emailNotificado
        });
    } catch (err) {
        res.status(500).json({
            sucesso: false,
            erro: 'Erro ao cadastrar: ' + err.message
        });
    }
});

// Valida usuario e senha administrativos e devolve um token temporario ao painel.
app.post('/admin/login', (req, res) => {
    const { username, password } = req.body || {};

    if (!ADMIN_PASSWORD) {
        return res.status(503).json({
            sucesso: false,
            erro: 'Configure ADMIN_USERNAME e ADMIN_PASSWORD no arquivo .env para liberar o painel.'
        });
    }

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        return res.status(401).json({
            sucesso: false,
            erro: 'Usuario ou senha invalidos.'
        });
    }

    res.json({
        sucesso: true,
        ...createAdminToken()
    });
});

// Remove o token atual para impedir novos acessos com a mesma sessao.
app.post('/admin/logout', (req, res) => {
    const token = req.body?.token || getAdminTokenFromRequest(req);

    if (token) {
        activeAdminTokens.delete(token);
    }

    res.status(204).end();
});

// Retorna os leads em JSON para uso administrativo.
app.get('/api/leads', requireAdminSession, async (req, res) => {
    try {
        const leads = await fetchLeads();
        res.json({
            sucesso: true,
            total: leads.length,
            leads
        });
    } catch (err) {
        console.error('Erro ao buscar leads:', err);
        res.status(500).json({
            sucesso: false,
            erro: 'Erro ao buscar leads.'
        });
    }
});

// Exibe o painel administrativo com busca e tabela de leads.
app.get('/painel-leads', async (req, res) => {
    try {
        res.send(renderLeadsPanel());
    } catch (err) {
        console.error('Erro ao listar leads:', err);
        res.status(500).send('Erro ao listar cadastros.');
    }
});

// Mantem um atalho antigo apontando para a rota oficial do painel.
app.get('/lista-leads', (req, res) => {
    res.redirect('/painel-leads');
});

startServer();
