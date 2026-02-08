# 🧪 Testes do Askesis

## Visão Geral

Esta suíte de testes combina duas abordagens complementares:

1. **Testes de Cenario (Integration-First):** Validam jornadas completas do usuário, combinando múltiplos subsistemas.
2. **Testes Unitários:** Cobertura detalhada de cada módulo crítico do sistema.

**Total: 21 arquivos de teste | 350 testes | 21 suites**

## Os Testes de Cenario

### 🚀 Teste de Cenario 1: Jornada do Novo Usuário
**Arquivo:** `tests/scenario-test-1-user-journey.test.ts`

Simula a experiência completa de um novo usuário desde o primeiro acesso até o uso avançado.

**Valida simultaneamente:**
- ✅ Criação de hábitos (3 turnos diferentes)
- ✅ Marcação de status (feito/adiado/pendente)
- ✅ Adição de notas com emojis e caracteres especiais
- ✅ Navegação no calendário (passado/futuro)
- ✅ Swipe e long-press
- ✅ Persistência após reload
- ✅ Renderização de DOM
- ✅ Acessibilidade básica (tabindex, aria-label)
- ✅ Integridade de dados após múltiplas operações

**Métricas de sucesso:**
- Todos os hábitos criados corretamente
- Status persistidos após reload
- Notas mantêm caracteres especiais
- DOM renderizado sem erros

---

### 🔄 Teste de Cenario 2: Sincronização Conflitante
**Arquivo:** `tests/scenario-test-2-sync-conflicts.test.ts`

Simula conflitos entre dispositivos offline e testa o algoritmo CRDT-lite de merge.

**Valida simultaneamente:**
- ✅ Criptografia AES-GCM (encrypt/decrypt)
- ✅ Web Worker (operações off-main-thread)
- ✅ Merge de conflitos (DONE vs DEFERRED)
- ✅ Resolução de Tombstone (delete vence update)
- ✅ Merge de 3+ dispositivos
- ✅ Integridade de bitmask após 100+ merges
- ✅ Serialização para nuvem
- ✅ Race conditions

**Métricas de sucesso:**
- Conflitos resolvidos semanticamente (DONE > DEFERRED)
- Nenhum dado perdido em merge de múltiplos dispositivos
- Tombstone sempre vence
- Bitmasks mantêm integridade

---

### ⚡ Teste de Cenario 3: Estresse e Performance
**Arquivo:** `tests/scenario-test-3-performance.test.ts`

Testa limites de escalabilidade e performance budgets.

**Valida simultaneamente:**
- ✅ Criação de 100 hábitos < 100ms
- ✅ Popular 3 anos (54,750 registros) < 500ms
- ✅ Leitura de 10,000 status < 50ms (O(1) verificado)
- ✅ Renderização de 100 cartões < 200ms
- ✅ 1,000 toggles consecutivos < 100ms
- ✅ Performance constante com crescimento de dados
- ✅ Ausência de memory leaks
- ✅ Batch de 1,000 operações < 150ms
- ✅ Serialização de 10 anos < 1s

**Performance Budgets:**
```
Operação                  | Budget    | Meta
-------------------------------------------------
Criar 100 hábitos        | 100ms     | < 50ms
Popular 3 anos           | 500ms     | < 300ms
Ler 10k status           | 50ms      | < 20ms
Renderizar 100 cards     | 200ms     | < 100ms
1000 toggles             | 100ms     | < 50ms
Serializar 10 anos       | 1000ms    | < 500ms
```

---

### ♿ Teste de Cenario 4: Acessibilidade Total
**Arquivo:** `tests/scenario-test-4-accessibility.test.ts`

Valida conformidade com WCAG 2.1 AA e navegação completa por teclado.

**Valida simultaneamente:**
- ✅ Navegação completa apenas com Tab/Enter/Space
- ✅ Todos os elementos têm aria-label ou role
- ✅ Estrutura semântica HTML5 (landmarks)
- ✅ Focus trap em modais
- ✅ Fechamento de modal com Escape
- ✅ prefers-reduced-motion respeitado
- ✅ aria-live para anúncios dinâmicos
- ✅ Foco visível em elementos interativos
- ✅ Contraste de cores (WCAG AA)
- ✅ Formulários com feedback acessível
- ✅ Skip links para navegação rápida

**Critérios WCAG:**
- Nível A: ✅ Obrigatório (100% conformidade)
- Nível AA: ✅ Recomendado (100% conformidade)
- Nível AAA: 🎯 Aspiracional (best effort)

---

### 🔥 Teste de Cenario 5: Recuperação de Desastres
**Arquivo:** `tests/scenario-test-5-disaster-recovery.test.ts`

---

### 🔴 Teste de Cenario 6: Segurança (Pentest)
**Arquivo:** `tests/scenario-test-6-security-pentest.test.ts`

Valida resiliência contra XSS, prototype pollution, injection em API, import path traversal e SSRF.

---

### 🟠 Teste de Cenario 7: Cloud e Resiliência de Rede
**Arquivo:** `tests/scenario-test-7-cloud-network-resilience.test.ts`

Valida sync com falhas de rede, debounce de sync, race conditions e merges avançados.

Testa resiliência do sistema sob condições extremas (Chaos Engineering).

**Valida simultaneamente:**
- ✅ Recuperação de localStorage corrompido
- ✅ Dados parcialmente deletados
- ✅ Validação e rejeição de dados inválidos
- ✅ Operação com storage 95% cheio
- ✅ Timestamps negativos ou futuros
- ✅ Detecção de loops infinitos
- ✅ Graceful degradation
- ✅ Consistência durante falhas parciais de escrita
- ✅ Migração de versões antigas
- ✅ Feedback amigável para usuário

**Cenários de Caos:**
1. JSON inválido no localStorage
2. IndexedDB corrompido
3. Storage quota excedido
4. Dados órfãos (logs sem hábitos)
5. Relógio do sistema incorreto
6. Interrupção durante escrita
7. Dados estruturalmente válidos mas semanticamente incorretos

---

## � Testes Unitários (12 suites)

### 🔐 Criptografia AES-GCM (14 testes)
**Arquivo:** `services/crypto.test.ts`

Cobertura completa do módulo de criptografia isomórfica.

**Valida:**
- ✅ Roundtrip encrypt/decrypt (texto, emojis, Unicode)
- ✅ Senhas edge-case (1 char, 64 chars, caracteres especiais)
- ✅ Falha com senha incorreta
- ✅ Rejeição de dados corrompidos (Base64 inválido, payload truncado)
- ✅ Integridade com payloads grandes (10KB+)
- ✅ Saída sempre em Base64 válido

---

### 🔄 Migração de Schema (19 testes)
**Arquivo:** `services/migration.test.ts`

Valida o motor de migração de dados entre versões.

**Valida:**
- ✅ Fresh install → valores default corretos
- ✅ Hidratação de monthlyLogs (Object→Map, Array→Map, BigInt serializado)
- ✅ Tratamento gracioso de BigInt inválidos
- ✅ V8→V9: expansão de bitmask 6-bit → 9-bit
- ✅ Preservação de múltiplos status durante migração
- ✅ Inicialização de quotas e campos AI

---

### 💾 Persistência de Estado (7 testes)
**Arquivo:** `services/persistence.test.ts`

Valida a camada de persistência IndexedDB.

**Valida:**
- ✅ Snapshot serializável (sem Maps/Sets/BigInts raw)
- ✅ Limpeza completa de caches
- ✅ Integridade estrutural do estado CRUD

---

### 🛠️ Utilitários (44 testes)
**Arquivo:** `utils.test.ts`

Cobertura exaustiva das funções utilitárias do sistema.

**Valida:**
- ✅ Sanitização HTML e prevenção XSS (escapeHTML, sanitizeText)
- ✅ Parsing de datas UTC (edge cases: 2025-02-30, null, undefined)
- ✅ Geração UUID v4 (unicidade em 1000 UUIDs, formato RFC4122)
- ✅ Conversão ArrayBuffer ↔ Base64 ↔ Hex
- ✅ Parser Markdown simplificado
- ✅ Debounce com timer
- ✅ Contraste de cores WCAG
- ✅ toUTCIsoDateString, getTodayUTC, addDays, getSafeDate

---

### 📋 Seletores e Scheduling (23 testes)
**Arquivo:** `services/selectors.test.ts`

Valida a camada de leitura otimizada (memoized).

**Valida:**
- ✅ Resolução de schedule por data (multi-scheduleHistory)
- ✅ Frequência diária, dias específicos da semana, intervalo
- ✅ Cálculo de streaks consecutivos
- ✅ Resumo diário (calculateDaySummary)
- ✅ Visibilidade de hábitos por dia/frequência
- ✅ Limpeza de caches internos

---

### 🌐 Cliente API (14 testes)
**Arquivo:** `services/api.test.ts`

Valida o cliente HTTP com retry e autenticação.

**Valida:**
- ✅ CRUD de chave de sincronização (localStorage)
- ✅ Validação de formato UUID
- ✅ Retry com backoff exponencial (3 tentativas)
- ✅ Auto-limpeza em resposta 401
- ✅ Fetch com headers corretos

---

### 🌍 Internacionalização (22 testes)
**Arquivo:** `i18n.test.ts`

Cobertura do motor de i18n e formatação.

**Valida:**
- ✅ Tradução de chaves (existentes e ausentes)
- ✅ Interpolação de variáveis ({name} → valor)
- ✅ Pluralização CLDR (regra PT: 0 = singular)
- ✅ Formatação de datas (válida, null, undefined, inválida, timestamp)
- ✅ Formatação numérica (inteiros, decimais, evolução)
- ✅ Formatação de listas e comparação collation-aware
- ✅ Troca dinâmica de idioma (PT → EN → PT)
- ✅ Nomes de períodos do dia e dias da semana

---

### 🏛️ Motor de Citações Estoicas (10 testes)
**Arquivo:** `services/quoteEngine.test.ts`

Valida o algoritmo de recomendação contextual.

**Valida:**
- ✅ Seleção básica e erro para array vazio
- ✅ Anti-repetição (penalidade na última citação)
- ✅ Boost de IA (tags alinhadas ao diagnóstico)
- ✅ Determinismo por seed (mesma data → mesma citação)
- ✅ Variação temporal (diversidade em 28 dias)
- ✅ Reação a performance state (defeat → resiliência)
- ✅ Stickiness (tempo mínimo de exibição)

---

### ⚙️ Lógica de Negócios (19 testes)
**Arquivo:** `services/habitActions.test.ts`

### 📦 Importação/Exportação (1 teste)
**Arquivo:** `services/importExport.test.ts`

Valida o round-trip de importação/backup com reidratação de `monthlyLogsSerialized`.

---

### ☁️ Sincronização Cloud (Básico) (2 testes)
**Arquivo:** `services/cloud.test.ts`

Valida envio de shards (core/logs) e merge de estado remoto mais recente.

---

### 🔒 Consistência Estado ↔ UI (35 testes)
**Arquivo:** `services/stateUIConsistency.test.ts`

Testes de invariantes entre bitmask, `scheduleHistory`, `dailyData` e estado visual.

Valida o controlador principal de ações.

**Valida:**
- ✅ Boot lock (operações bloqueadas antes de sync)
- ✅ Ciclo de toggle: NULL→DONE→DEFERRED→NULL
- ✅ Operações batch (markAllDone, markAllDeferred)
- ✅ Graduação de hábitos (21 e 66 dias)
- ✅ Celebrações com interpolação i18n
- ✅ Reordenação e atualização de hábitos
- ✅ Formatação de celebrações multi-hábito

---

## 📊 Métricas de Qualidade

### Coverage Mínimo Exigido
```
Lines:       90%+
Functions:   85%+
Branches:    80%+
Statements:  90%+
```

### Áreas Críticas (100% Coverage)
- `services/dataMerge.ts`
- `services/crypto.ts`
- `services/habitActions.ts`
- `services/HabitService.ts`
- `utils.ts`
- `services/selectors.ts`
- `services/migration.ts`

---

## 🚀 Como Executar

### Todos os testes
```bash
npm test
```

### Apenas os testes de cenario
```bash
npm run test:scenario
```

### Com interface visual
```bash
npm run test:ui
```

### Com coverage
```bash
npm run test:coverage
```

### Watch mode (desenvolvimento)
```bash
npm run test:watch
```

---

## 📈 Relatórios

### Performance Report
Cada teste de performance exibe:
- Tempo médio (avg)
- Tempo mediano (median)
- Percentil 95 (p95)
- Número de amostras

### Accessibility Report
Erros de A11y são listados com:
- Contexto do elemento
- Tipo de violação
- Sugestão de correção

### Recovery Report
Falhas de recuperação mostram:
- Tipo de erro
- Estado antes/depois
- Ações tomadas

---

## ✅ Critérios de Aprovação

Para considerar o sistema **"Production Ready"**, todos os seguintes devem passar:

1. **Todos os testes de cenario passam** (0 falhas)
2. **Coverage mínimo atingido** (80%+ linhas)
3. **Performance budgets respeitados**
4. **Zero erros críticos de A11y**
5. **Recuperação de todos os cenários de desastre**

---

## 🎯 Filosofia dos Testes

> "Um teste que valida 20 coisas é melhor que 20 testes que validam 1 coisa cada"

Cada teste de cenario simula uma **jornada real do usuário**, garantindo que:
- Componentes funcionam **em conjunto** (não apenas isolados)
- Edge cases são testados **em contexto**
- Performance é validada **sob carga real**
- Acessibilidade funciona **na prática**
- Recuperação funciona **em cenários reais**

---

## 📚 Próximos Passos

### Mutation Testing (Avançado)
```bash
npm install -D @stryker-mutator/core
npx stryker run
```
Meta: 70%+ mutation score

### Visual Regression (Opcional)
```bash
npm install -D @percy/cli
npx percy snapshot tests/
```

### E2E com Playwright (Opcional)
```bash
npm install -D playwright
npx playwright test
```

---

## 🤝 Contribuindo

Ao adicionar novos testes:
1. Prefira **adicionar casos aos testes de cenario existentes**
2. Só crie novo arquivo se for funcionalidade completamente nova
3. Mantenha foco em **jornadas do usuário**, não testes unitários isolados
4. Sempre adicione **métricas de performance** quando relevante

---

## 📝 Notas Técnicas

### Por que "Testes de Cenario"?
Testes tradicionais focam em **isolamento** (mocks, stubs). Testes de cenario focam em **integração real**.

**Vantagens:**
- ✅ Detectam bugs de integração
- ✅ Validam fluxos completos
- ✅ Menos manutenção (menos arquivos)
- ✅ Mais confiança (testam o que usuário faz)

**Desvantagens:**
- ⚠️  Mais lentos que unit tests
- ⚠️  Falhas podem ter múltiplas causas
- ⚠️  Requerem setup mais complexo

Para o Askesis, as vantagens superam as desvantagens.

---

## 🏆 Status Atual

```
✅ Teste de Cenario 1: Jornada do Novo Usuário      (3 testes)
✅ Teste de Cenario 2: Sincronização Conflitante    (5 testes)
✅ Teste de Cenario 3: Estresse e Performance       (9 testes)
✅ Teste de Cenario 4: Acessibilidade Total         (12 testes)
✅ Teste de Cenario 5: Recuperação de Desastres     (10 testes)
✅ Teste de Cenario 6: Segurança (Pentest)          (41 testes)
✅ Teste de Cenario 7: Cloud e Resiliência de Rede  (33 testes)
✅ Nuclear QA: HabitService (Fuzzing & Oracle)      (16 testes)
✅ Nuclear QA: dataMerge (Distributed Chaos)        (11 testes)
✅ Unitário: Criptografia AES-GCM                  (14 testes)
✅ Unitário: Migração de Schema                    (19 testes)
✅ Unitário: Persistência de Estado                 (7 testes)
✅ Unitário: Utilitários                            (44 testes)
✅ Unitário: Seletores e Scheduling                 (23 testes)
✅ Unitário: Cliente API                            (14 testes)
✅ Unitário: Internacionalização                    (22 testes)
✅ Unitário: Motor de Citações Estoicas             (10 testes)
✅ Unitário: Lógica de Negócios                     (19 testes)
✅ Unitário: Importação/Exportação                  (1 teste)
✅ Unitário: Sincronização Cloud (Básico)           (2 testes)
✅ Teste: Consistência Estado ↔ UI                  (35 testes)
                                          Total:   350 testes

Cobertura: 90%+
Performance budgets: Todos passando
A11y compliance: WCAG 2.1 AA
Chaos scenarios: 10 cenários
```

**Status:** 🟢 Todos os 350 testes passando
