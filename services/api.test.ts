/**
 * @file services/api.test.ts
 * @description Testes para o cliente de API e gerenciamento de chaves de sincronização.
 * P1 - Conectividade: Retry, timeout, validação UUID, limpeza em 401.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    hasLocalSyncKey,
    getSyncKey,
    storeKey,
    clearKey,
    isValidKeyFormat,
    apiFetch,
    initAuth
} from './api';

describe('🌐 Cliente de API (api.ts)', () => {

    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe('Gerenciamento de chaves (localStorage)', () => {
        it('deve retornar false quando não há chave', () => {
            expect(hasLocalSyncKey()).toBe(false);
        });

        it('deve armazenar e recuperar chave', () => {
            const key = '12345678-1234-1234-1234-123456789abc';
            storeKey(key);

            expect(hasLocalSyncKey()).toBe(true);
            expect(getSyncKey()).toBe(key);
        });

        it('deve limpar chave', () => {
            storeKey('some-key');
            clearKey();

            expect(hasLocalSyncKey()).toBe(false);
            expect(getSyncKey()).toBeNull();
        });

        it('não deve armazenar chave vazia', () => {
            storeKey('');
            expect(hasLocalSyncKey()).toBe(false);
        });
    });

    describe('isValidKeyFormat (UUID v4)', () => {
        it('deve validar UUID v4 correto', () => {
            expect(isValidKeyFormat('12345678-1234-1234-1234-123456789abc')).toBe(true);
            expect(isValidKeyFormat('abcdef01-2345-6789-abcd-ef0123456789')).toBe(true);
            expect(isValidKeyFormat('ABCDEF01-2345-6789-ABCD-EF0123456789')).toBe(true);
        });

        it('deve rejeitar formatos inválidos', () => {
            expect(isValidKeyFormat('')).toBe(false);
            expect(isValidKeyFormat('not-a-uuid')).toBe(false);
            expect(isValidKeyFormat('12345678-1234-1234-1234')).toBe(false);
            expect(isValidKeyFormat('12345678_1234_1234_1234_123456789abc')).toBe(false);
            expect(isValidKeyFormat('12345678-1234-1234-1234-123456789abcz')).toBe(false);
            expect(isValidKeyFormat('g2345678-1234-1234-1234-123456789abc')).toBe(false);
        });

        it('deve ser case-insensitive', () => {
            expect(isValidKeyFormat('ABCDEF01-2345-6789-ABCD-EF0123456789')).toBe(true);
            expect(isValidKeyFormat('abcdef01-2345-6789-abcd-ef0123456789')).toBe(true);
        });
    });

    describe('apiFetch (retry e error handling)', () => {
        it('deve fazer fetch com Content-Type padrão JSON', async () => {
            const mockFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
            vi.stubGlobal('fetch', mockFetch);

            await apiFetch('/api/test');

            const call = mockFetch.mock.calls[0];
            expect(call[1].headers.get('Content-Type')).toBe('application/json');
        });

        it('deve limpar chave local em resposta 401', async () => {
            storeKey('test-key-to-clear');
            
            const mockFetch = vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 }));
            vi.stubGlobal('fetch', mockFetch);

            await apiFetch('/api/test');

            expect(hasLocalSyncKey()).toBe(false);
        });

        it('deve fazer retry em caso de erro de rede', async () => {
            const mockFetch = vi.fn()
                .mockRejectedValueOnce(new Error('Network error'))
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce(new Response('ok', { status: 200 }));
            vi.stubGlobal('fetch', mockFetch);

            const response = await apiFetch('/api/test');

            expect(response.status).toBe(200);
            expect(mockFetch).toHaveBeenCalledTimes(3);
        });

        it('deve lançar erro após esgotar retries', async () => {
            const mockFetch = vi.fn().mockRejectedValue(new Error('Persistent error'));
            vi.stubGlobal('fetch', mockFetch);

            await expect(apiFetch('/api/test')).rejects.toThrow('Persistent error');
        });

        it('deve lançar erro quando includeSyncKey=true sem chave', async () => {
            await expect(apiFetch('/api/test', {}, true)).rejects.toThrow();
        });
    });

    describe('initAuth', () => {
        it('não deve falhar quando não há chave', async () => {
            // Simplesmente não deve lançar erro
            await expect(initAuth()).resolves.toBeUndefined();
        });

        it('deve computar hash quando há chave', async () => {
            storeKey('12345678-1234-1234-1234-123456789abc');
            // Não deve lançar erro
            await expect(initAuth()).resolves.toBeUndefined();
        });
    });
});
