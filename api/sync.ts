
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { Redis } from '@upstash/redis';

export const config = {
  runtime: 'edge',
};

const SHOULD_LOG = typeof process !== 'undefined' && !!process.env && process.env.NODE_ENV !== 'production';
const logger = {
        error: (message: string, error?: unknown) => {
                if (!SHOULD_LOG) return;
                if (error !== undefined) console.error(message, error);
                else console.error(message);
        }
};

const LUA_SHARDED_UPDATE = `
local key = KEYS[1]
local newTs = tonumber(ARGV[1])
local shardsJson = ARGV[2]

local currentTs = tonumber(redis.call("HGET", key, "lastModified") or 0)

if not newTs then
    return { "ERROR", "INVALID_TS" }
end

-- Optimistic Concurrency Control
if newTs < currentTs then
    local all = redis.call("HGETALL", key)
    return { "CONFLICT", all }
end

-- Robust JSON Parsing
local status, shards = pcall(cjson.decode, shardsJson)
if not status then
    return { "ERROR", "INVALID_JSON" }
end

-- Atomic Shard Update
for shardName, shardData in pairs(shards) do
    if type(shardData) == "string" then
        redis.call("HSET", key, shardName, shardData)
    else
        return { "ERROR", "INVALID_SHARD_TYPE", shardName, type(shardData) }
    end
end

redis.call("HSET", key, "lastModified", newTs)
return { "OK" }
`;

const HEADERS_BASE = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*', 
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Key-Hash, Authorization',
};

async function sha256(message: string) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function applyShardsNonLua(kv: Redis, dataKey: string, lastModified: number, shards: Record<string, string>) {
    const currentTsRaw = await kv.hget(dataKey, 'lastModified');
    const currentTs = Number(currentTsRaw || 0);
    if (lastModified < currentTs) {
        const all = await kv.hgetall(dataKey);
        return { type: 'conflict', data: all } as const;
    }

    const entries = Object.entries(shards);
    for (const [shardName, shardData] of entries) {
        await kv.hset(dataKey, { [shardName]: shardData });
    }
    await kv.hset(dataKey, { lastModified: String(lastModified) });
    return { type: 'ok' } as const;
}

export default async function handler(req: Request) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS_BASE });

    const dbUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const dbToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!dbUrl || !dbToken) {
         return new Response(JSON.stringify({ error: 'Server Config Error' }), { status: 500, headers: HEADERS_BASE });
    }

    const kv = new Redis({ url: dbUrl, token: dbToken });

    try {
        let keyHash = req.headers.get('x-sync-key-hash');
        if (!keyHash) {
            const authHeader = req.headers.get('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const rawKey = authHeader.replace('Bearer ', '').trim();
                if (rawKey.length >= 8) keyHash = await sha256(rawKey);
            }
        }

        if (!keyHash || !/^[a-f0-9]{64}$/i.test(keyHash)) {
            return new Response(JSON.stringify({ error: 'Auth Required' }), { status: 401, headers: HEADERS_BASE });
        }
        
        const dataKey = `sync_v3:${keyHash}`;

        if (req.method === 'GET') {
            const allData = await kv.hgetall(dataKey);
            if (!allData) return new Response('null', { status: 200, headers: HEADERS_BASE });
            return new Response(JSON.stringify(allData), { status: 200, headers: HEADERS_BASE });
        }

        if (req.method === 'POST') {
            const body = await req.json();
            const { lastModified, shards } = body;

            if (lastModified === undefined) {
                return new Response(JSON.stringify({ error: 'Missing lastModified' }), { status: 400, headers: HEADERS_BASE });
            }
            if (!shards || typeof shards !== 'object') {
                return new Response(JSON.stringify({ error: 'Invalid or missing shards' }), { status: 400, headers: HEADERS_BASE });
            }

            const lastModifiedNum = Number(lastModified);
            if (!Number.isFinite(lastModifiedNum)) {
                return new Response(JSON.stringify({ error: 'Invalid lastModified', code: 'INVALID_TS' }), { status: 400, headers: HEADERS_BASE });
            }

            for (const [shardName, shardValue] of Object.entries(shards)) {
                if (typeof shardValue !== 'string') {
                    return new Response(JSON.stringify({ error: 'Invalid shard type', code: 'INVALID_SHARD_TYPE', detail: shardName, detailType: typeof shardValue }), { status: 400, headers: HEADERS_BASE });
                }
            }

            let result: any = null;
            for (let attempt = 0; attempt < 2; attempt++) {
                result = await kv.eval(LUA_SHARDED_UPDATE, [dataKey], [String(lastModifiedNum), JSON.stringify(shards)]) as any;
                if (Array.isArray(result)) break;
                await sleep(50);
            }

            if (!Array.isArray(result)) {
                const fallback = await applyShardsNonLua(kv, dataKey, lastModifiedNum, shards);
                if (fallback.type === 'ok') {
                    return new Response('{"success":true,"fallback":true}', { status: 200, headers: HEADERS_BASE });
                }
                // FIX: kv.hgetall returns an Object, not Array.
                const conflictShards = (fallback.data || {}) as Record<string, string>;
                return new Response(JSON.stringify(conflictShards), { status: 409, headers: HEADERS_BASE });
            }
            
            if (result[0] === 'OK') return new Response('{"success":true}', { status: 200, headers: HEADERS_BASE });

            if (typeof result[0] === 'number') {
                const fallback = await applyShardsNonLua(kv, dataKey, lastModifiedNum, shards);
                if (fallback.type === 'ok') {
                    return new Response('{"success":true,"fallback":true}', { status: 200, headers: HEADERS_BASE });
                }
                // FIX: kv.hgetall returns an Object, not Array.
                const conflictShards = (fallback.data || {}) as Record<string, string>;
                return new Response(JSON.stringify(conflictShards), { status: 409, headers: HEADERS_BASE });
            }
            
            if (result[0] === 'CONFLICT') {
                // Lua returns a flat array [key, val, key, val...] for HGETALL
                const rawList = result[1] as string[];
                const conflictShards: Record<string, string> = {};
                for (let i = 0; i < rawList.length; i += 2) {
                    conflictShards[rawList[i]] = rawList[i+1];
                }
                return new Response(JSON.stringify(conflictShards), { status: 409, headers: HEADERS_BASE });
            }
            
            return new Response(JSON.stringify({ error: 'Lua Execution Error', code: result[1] || 'UNKNOWN', detail: result[2], detailType: result[3], raw: result }), { status: 400, headers: HEADERS_BASE });
        }

        return new Response(null, { status: 405 });
    } catch (error: any) {
        logger.error('KV Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500, headers: HEADERS_BASE });
    }
}
