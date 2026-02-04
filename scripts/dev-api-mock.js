
/**
 * @file scripts/dev-api-mock.js
 * @description Mock Serverless API handlers for local development.
 * 
 * [SECURITY AUDIT]:
 * - Added Payload Size Limit (DoS Protection).
 * - Added Mutex for Atomic File I/O (Race Condition Protection).
 * - Safe UTF-8 Buffering & Async Error Handling.
 */

const fs = require('fs/promises');

const MOCK_DB_FILE = '.local-kv.json';
const MAX_PAYLOAD_SIZE = 4 * 1024 * 1024; // 4MB Hard Limit
const HEADERS_JSON = { 'Content-Type': 'application/json' };

// --- HELPERS ---
const sendJSON = (res, status, data) => {
    if (!res.headersSent) {
        res.writeHead(status, HEADERS_JSON);
        res.end(JSON.stringify(data));
    }
};

const sendError = (res, status, message) => sendJSON(res, status, { error: message });

// --- MUTEX INFRASTRUCTURE ---
let dbMutex = Promise.resolve();

async function withDbAtomic(operation) {
    const previousMutex = dbMutex;
    let releaseLock;
    dbMutex = new Promise(resolve => releaseLock = resolve);
    
    await previousMutex;
    
    try {
        let db = {};
        try {
            const content = await fs.readFile(MOCK_DB_FILE, 'utf-8');
            if (content.trim()) db = JSON.parse(content);
        } catch (readError) {
            if (readError.code !== 'ENOENT') {
                console.error("⚠️ [MOCK DB] Erro de Leitura. Resetando DB.", readError.message);
            }
        }

        const result = await operation(db);

        if (result && typeof result === 'object') {
            await fs.writeFile(MOCK_DB_FILE, JSON.stringify(result, null, 2));
        }
        return result;
    } catch (err) {
        console.error("⚠️ [MOCK DB] Critical I/O Error:", err);
        throw err;
    } finally {
        releaseLock();
    }
}

async function handleApiSync(req, res) {
    return new Promise((resolve) => {
        // Error Handler Wrapper
        const handleError = (e, context) => {
            console.error(`API Mock Error (${context}):`, e);
            sendError(res, 500, e.message);
            resolve();
        };

        // Socket Error Handler
        req.on('error', (err) => {
            console.error("Socket error on API Mock (Sync):", err);
            if (!res.headersSent) res.end();
            resolve();
        });

        if (req.method === 'GET') {
            const keyHash = req.headers['x-sync-key-hash'];
            if (!keyHash) {
                sendError(res, 401, 'Unauthorized');
                return resolve();
            }

            withDbAtomic(async (db) => {
                const userData = db[keyHash];
                sendJSON(res, 200, userData || null);
                return null; // Read-only
            }).then(() => resolve()).catch(e => handleError(e, 'GET'));

        } else if (req.method === 'POST') {
            const chunks = [];
            let size = 0;
            let aborted = false;

            req.on('data', chunk => {
                if (aborted) return;
                size += chunk.length;
                if (size > MAX_PAYLOAD_SIZE) {
                    aborted = true;
                    sendError(res, 413, 'Payload Too Large');
                    req.destroy();
                    resolve();
                    return;
                }
                chunks.push(chunk);
            });

            req.on('end', async () => {
                if (aborted) return;

                try {
                    const body = Buffer.concat(chunks).toString();
                    const keyHash = req.headers['x-sync-key-hash'];
                    
                    if (!keyHash) {
                        sendError(res, 401, 'Unauthorized');
                        return resolve();
                    }

                    let payload;
                    try {
                        payload = JSON.parse(body);
                    } catch (jsonErr) {
                        sendError(res, 400, 'Invalid JSON');
                        return resolve();
                    }
                    
                    await withDbAtomic(async (db) => {
                        const existingData = db[keyHash];
                        
                        // Optimistic Locking
                        if (existingData && payload.lastModified < existingData.lastModified) {
                            sendJSON(res, 409, existingData);
                            return null;
                        }
                        if (existingData && payload.lastModified === existingData.lastModified) {
                            res.writeHead(304).end();
                            return null;
                        }

                        db[keyHash] = payload;
                        sendJSON(res, 200, { success: true });
                        return db; // Trigger Write
                    });
                    resolve();

                } catch (e) {
                    handleError(e, 'POST');
                }
            });

        } else {
            res.writeHead(405).end();
            resolve();
        }
    });
}

async function handleApiAnalyze(req, res) {
    return new Promise((resolve) => {
        req.on('error', (err) => {
            console.error("Socket error on API Mock (Analyze):", err);
            if (!res.headersSent) res.end();
            resolve();
        });

        if (req.method !== 'POST') {
            res.writeHead(405).end();
            return resolve();
        }
        
        // ROBUSTNESS: Drain the stream to prevent client hanging on large payloads
        req.resume();
        
        const mockResponse = "### Análise Local (Modo Desenvolvimento)\n\n**Estoicismo Simulado:**\n\nVocê está indo bem! A consistência é a chave.";
        
        setTimeout(() => {
            if (!res.writableEnded) {
                res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end(mockResponse);
            }
            resolve();
        }, 1500);
    });
}

module.exports = {
    handleApiSync,
    handleApiAnalyze
};
