/**
 * @file services/crypto.test.ts
 * @description Testes para o módulo de criptografia AES-GCM.
 * P0 - Crítico: Perda de dados se encrypt/decrypt falhar.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { encrypt, decrypt } from './crypto';

describe('🔐 Criptografia AES-GCM (crypto.ts)', () => {

    describe('Roundtrip encrypt → decrypt', () => {
        it('deve criptografar e descriptografar texto simples', async () => {
            const plaintext = 'Hábito concluído com sucesso!';
            const password = 'minha-senha-segura-123';

            const encrypted = await encrypt(plaintext, password);
            const decrypted = await decrypt(encrypted, password);

            expect(decrypted).toBe(plaintext);
        });

        it('deve funcionar com texto vazio', async () => {
            const encrypted = await encrypt('', 'senha');
            const decrypted = await decrypt(encrypted, 'senha');
            expect(decrypted).toBe('');
        });

        it('deve funcionar com caracteres especiais e emojis', async () => {
            const text = '🏛️ Ἄσκησις — "treinamento" (ação & reflexão) <script>alert("xss")</script>';
            const password = 'p@$$w0rd!#€';

            const encrypted = await encrypt(text, password);
            const decrypted = await decrypt(encrypted, password);

            expect(decrypted).toBe(text);
        });

        it('deve funcionar com texto longo (5 anos de dados simulados)', async () => {
            const longText = JSON.stringify({
                habits: Array.from({ length: 50 }, (_, i) => ({
                    id: `habit-${i}`,
                    data: 'x'.repeat(1000)
                }))
            });

            const encrypted = await encrypt(longText, 'long-password');
            const decrypted = await decrypt(encrypted, 'long-password');

            expect(decrypted).toBe(longText);
        });

        it('deve funcionar com caracteres Unicode multibyte', async () => {
            const text = '日本語テスト 中文测试 العربية тест';
            const password = 'unicode-password';

            const encrypted = await encrypt(text, password);
            const decrypted = await decrypt(encrypted, password);

            expect(decrypted).toBe(text);
        });
    });

    describe('Propriedades criptográficas', () => {
        it('deve produzir outputs diferentes para o mesmo input (salt/iv aleatórios)', async () => {
            const text = 'mesmo texto';
            const password = 'mesma-senha';

            const encrypted1 = await encrypt(text, password);
            const encrypted2 = await encrypt(text, password);

            // Salt e IV aleatórios garantem outputs diferentes
            expect(encrypted1).not.toBe(encrypted2);

            // Ambos devem descriptografar corretamente
            expect(await decrypt(encrypted1, password)).toBe(text);
            expect(await decrypt(encrypted2, password)).toBe(text);
        });

        it('deve produzir output Base64 válido', async () => {
            const encrypted = await encrypt('teste', 'senha');
            // Base64 regex
            expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/);
        });

        it('output deve ter tamanho mínimo (SALT + IV + dados)', async () => {
            const encrypted = await encrypt('a', 'b');
            const bytes = atob(encrypted);
            // SALT(16) + IV(12) + pelo menos 1 byte de dados cifrados + tag GCM(16)
            expect(bytes.length).toBeGreaterThanOrEqual(16 + 12 + 1 + 16);
        });
    });

    describe('Segurança: Falhas de descriptografia', () => {
        it('deve falhar com senha incorreta', async () => {
            const encrypted = await encrypt('dados secretos', 'senha-correta');

            await expect(decrypt(encrypted, 'senha-errada')).rejects.toThrow();
        });

        it('deve falhar com dados corrompidos (bit flip)', async () => {
            const encrypted = await encrypt('dados importantes', 'senha');
            // Corrompe um byte no meio (altera o ciphertext)
            const chars = encrypted.split('');
            const mid = Math.floor(chars.length / 2);
            chars[mid] = chars[mid] === 'A' ? 'B' : 'A';
            const corrupted = chars.join('');

            await expect(decrypt(corrupted, 'senha')).rejects.toThrow();
        });

        it('deve falhar com Base64 inválido', async () => {
            await expect(decrypt('!!!não-é-base64!!!', 'senha')).rejects.toThrow();
        });

        it('deve falhar com string muito curta (sem salt/iv)', async () => {
            const tooShort = btoa('abc'); // Menor que SALT_LEN + IV_LEN
            await expect(decrypt(tooShort, 'senha')).rejects.toThrow();
        });
    });

    describe('Consistência e idempotência', () => {
        it('deve descriptografar consistentemente após múltiplas operações', async () => {
            const original = 'consistência é chave';
            const password = 'pass123';

            // Criptografa e descriptografa 10 vezes
            for (let i = 0; i < 10; i++) {
                const encrypted = await encrypt(original, password);
                const decrypted = await decrypt(encrypted, password);
                expect(decrypted).toBe(original);
            }
        });

        it('deve funcionar com senhas de diferentes tamanhos', async () => {
            const text = 'teste de tamanho de senha';

            const passwords = ['a', 'ab', 'senha-media', 'a'.repeat(256), 'a'.repeat(1024)];

            for (const pwd of passwords) {
                const encrypted = await encrypt(text, pwd);
                const decrypted = await decrypt(encrypted, pwd);
                expect(decrypted).toBe(text);
            }
        });
    });
});
