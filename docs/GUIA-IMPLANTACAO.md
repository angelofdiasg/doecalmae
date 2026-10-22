# Guia de implantação — Calmaê Jovem

Este guia conduz a publicação do site e da API de doações em dois ambientes isolados:

- **HML (homologação):** deployment Preview do projeto Vercel existente, API Railway de teste, banco Neon de teste e credenciais do Asaas Sandbox.
- **PRD (produção):** site Vercel público, API Railway de produção, banco Neon de produção e credenciais live do Asaas.

Não reutilize banco, chave de API ou token de webhook entre HML e PRD. As URLs e os dados de teste também não devem ser usados para receber doações reais.

## 1. Pré-requisitos

Tenha acesso administrativo a:

1. Repositório GitHub `angelofdiasg/doecalmae`.
2. Conta Vercel.
3. Conta Railway.
4. Conta Neon.
5. Conta de pagamentos Asaas da ONG, com os dados cadastrais solicitados pelo provedor.
6. Domínio do site, se já estiver disponível.

Use autenticação com MFA nos provedores. Nunca coloque chaves, tokens, strings de conexão ou dados de doadores no Git, em tickets, prints ou mensagens.

## 2. Como a implantação está configurada

- A raiz do repositório é o front-end estático. `npm run build` grava em `dist/` e incorpora a URL da API recebida pela variável `CALMAE_API_BASE_URL`. Um único projeto Vercel pode usar valores diferentes nos ambientes Production e Preview.
- A pasta `api/` contém o serviço Node.js. O Railway deve configurá-la como Root Directory.
- `npm start` executa a migração SQL antes de iniciar a API (`prestart`).
- A API usa a `DATABASE_URL` do Neon, guarda o estado e os identificadores de cobrança e mantém os dados pessoais somente no Asaas.
- A fatura e o formulário do pagamento são hospedados pelo Asaas. A aplicação não recebe dados de cartão.
- O webhook do Asaas atualiza o estado da cobrança. A volta do navegador ao site não confirma pagamento.

## 3. Criar a estratégia de branches e publicar o código

O branch principal do repositório é `main`. Recomenda-se usar um branch `homologacao` para o ambiente HML e implantar em produção somente depois de aprovar HML.

### 3.1 Criar o branch HML

No GitHub, abra o repositório, selecione o branch `main` e crie o branch `homologacao` a partir dele. Proteja `main` e, se possível, `homologacao`, exigindo Pull Request para merge.

### 3.2 Salvar as alterações locais e enviá-las ao GitHub

**Para esta implantação inicial, as alterações já foram enviadas** para o branch remoto `feat/guia-implantacao-hml-prd` no commit `89df186`. Não repita o comando `git switch -c` para esse branch.

Faça agora:

1. No GitHub, abra `main` e crie o branch `homologacao` a partir dele, caso ainda não exista.
2. Abra um Pull Request de `feat/guia-implantacao-hml-prd` para `homologacao` em <https://github.com/angelofdiasg/doecalmae/pull/new/feat/guia-implantacao-hml-prd>.
3. Revise e aprove o Pull Request. Após o merge, conecte os serviços HML a `homologacao` conforme este guia.
4. Depois de aprovar HML, abra um Pull Request de `homologacao` para `main`.

Para futuras alterações, parta de `main` e use um novo branch com nome próprio. No PowerShell, a partir da raiz:

```powershell
git status
npm ci --prefix api
npm test --prefix api

git switch main
git pull --ff-only origin main
git switch -c feat/minha-alteracao
git add <arquivos-alterados>
git diff --cached --check
git commit -m "feat: descrever alteracao"
git push -u origin feat/minha-alteracao
```

Abra um Pull Request do novo branch para `homologacao`. Depois dos testes e aprovação em HML, faça o merge de `homologacao` para `main`. Não faça push direto para `main`.

## 4. Criar o ambiente HML

### 4.1 Neon — banco de homologação

1. Crie um projeto Neon separado chamado, por exemplo, `doecalmae-hml`.
2. Escolha uma região próxima da região dos serviços Railway para reduzir latência.
3. Crie ou use o banco PostgreSQL padrão do projeto.
4. Copie a connection string **pooled** para Node.js e confirme que usa TLS (`sslmode=require`).
5. Guarde a string como `DATABASE_URL` no serviço HML do Railway. Não a coloque no site Vercel.
6. Não importe dados pessoais ou dados reais de doadores para HML.

### 4.2 Railway — API de homologação

1. Crie um projeto Railway, por exemplo `doecalmae`.
2. Adicione um serviço a partir do repositório GitHub `angelofdiasg/doecalmae`.
3. Configure:
   - **Service name:** `doecalmae-api-hml`
   - **Branch:** `homologacao`
   - **Root Directory:** `/api`
   - **Build command:** deixe o padrão de detecção Node/npm ou use `npm ci`.
   - **Start command:** `npm start`
   - **Health check path:** `/api/health`
4. Gere um domínio público HTTPS para o serviço em **Settings → Networking / Public Networking**. Anote a origem, sem caminho. Exemplo: `https://doecalmae-api-hml.up.railway.app`.
5. Cadastre as variáveis HML abaixo em **Variables**. Os valores ilustrativos devem ser substituídos pelos seus:

| Variável | Valor em HML |
|---|---|
| `NODE_ENV` | `production` — o serviço é de produção para o runtime, embora seja ambiente de testes |
| `FRONTEND_ORIGIN` | Origem exata do projeto Vercel HML, por exemplo `https://doecalmae-hml.vercel.app` |
| `DATABASE_URL` | Connection string pooled do projeto Neon **HML** |
| `ASAAS_BASE_URL` | `https://api-sandbox.asaas.com` |
| `ASAAS_API_KEY` | Chave de API da conta/ambiente **Sandbox** do Asaas |
| `ASAAS_WEBHOOK_TOKEN` | Token aleatório longo, exclusivo de HML, igual ao token configurado no webhook HML |
| `PORT` | Não crie manualmente; o Railway fornece esta variável |

Não use aspas em torno dos valores ao cadastrá-los no painel. Depois de salvar, aguarde o deploy e confira os logs e o health check.

### 4.3 Vercel — Preview de homologação

Use o projeto Vercel já conectado ao repositório. O Vercel cria deployments Preview para os branches que não são o branch de produção; não é necessário criar um segundo projeto apenas para HML.

1. Em **Project → Settings → Git**, mantenha `main` como **Production Branch**.
2. Em **Project → Settings → Build and Deployment**, confirme:
   - **Framework Preset:** `Other`
   - **Root Directory:** `./`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm ci`
3. Em **Settings → Environment Variables**, crie `CALMAE_API_BASE_URL` para **Production** com o domínio HTTPS público da API PRD, sem barra final, por exemplo `https://doecalmae-api-prd.up.railway.app`.
4. Crie outra variável `CALMAE_API_BASE_URL` para **Preview** com o domínio HTTPS da API HML, por exemplo `https://doecalmae-api-hml.up.railway.app`. Para esse fluxo simples, todas as Preview builds usam a API Sandbox HML; elas nunca apontam para a API PRD.
5. Salve as variáveis e faça novo deployment, pois mudanças em variáveis só se aplicam a novos builds.
6. No branch `homologacao`, abra o deployment no painel Vercel e copie a **Git Branch URL** (o alias estável que acompanha o último deployment desse branch), não a URL única de um commit. Cadastre essa origem exata em `FRONTEND_ORIGIN` no Railway HML e faça redeploy da API. Se alterar o nome do projeto, do branch ou o domínio, confirme novamente a Branch URL e atualize CORS.
7. Os Preview deployments de branches de feature têm URLs próprias e o CORS da API HML não os aceita por padrão. Use-os para revisar o visual; teste doações no alias estável do branch `homologacao`. Não abra CORS para qualquer origem nem use `*`.

### 4.4 Asaas — Sandbox e webhook HML

1. Entre/crie a conta Sandbox do Asaas e use apenas dados de teste. Se a mesma organização tiver ambientes Sandbox e live sob a mesma conta, mantenha chaves e webhooks de cada ambiente separados.
2. Gere uma chave de API Sandbox no painel do Asaas. Cadastre-a em `ASAAS_API_KEY` no Railway HML.
3. Gere um token secreto exclusivo para o webhook HML. Uma forma de criar um valor forte localmente é:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

4. Cadastre o mesmo token:
   - no campo de autenticação/token do webhook no Asaas Sandbox; e
   - na variável `ASAAS_WEBHOOK_TOKEN` do serviço Railway HML.
5. Cadastre a URL `https://<dominio-api-hml>/api/webhooks/asaas`.
6. Habilite os eventos de cobrança abaixo, se disponíveis no painel:
   - `PAYMENT_CONFIRMED`
   - `PAYMENT_RECEIVED`
   - `PAYMENT_OVERDUE`
   - `PAYMENT_DELETED`
   - `PAYMENT_REFUNDED`
   - `PAYMENT_PARTIALLY_REFUNDED`
   - `PAYMENT_CHARGEBACK_REQUESTED`
7. Salve e confira o histórico de entregas do webhook no Asaas após executar os testes.

## 5. Testar e aprovar HML

Abra o site HML e valide:

1. O formulário aparece e permite selecionar valores fixos e outro valor.
2. A doação única permite Pix, boleto e cartão.
3. Ao selecionar doação mensal, cartão fica indisponível e a página explica que Pix/boleto geram cobranças que o doador precisa pagar.
4. Envie uma doação Sandbox com dados de teste e confirme que o navegador é encaminhado a um endereço HTTPS `www.asaas.com`.
5. Teste um valor inválido, e-mail inválido e falhas de API; a interface deve informar o erro sem indicar sucesso falso.
6. Conclua pagamentos de teste pelos fluxos que a conta Sandbox disponibilizar.
7. Confirme no Railway que os eventos de webhook chegaram e que a API respondeu sucesso.
8. Confirme no banco Neon HML o registro e a mudança de estado. O banco da aplicação não deve conter nome, e-mail, telefone ou CPF/CNPJ.
9. Teste também vencimento/recusa, repetição de webhook e falha de conexão, conforme o Sandbox permitir.
10. Revise o site em desktop e celular, confirme links de privacidade/contato e aprove conteúdo, meta de campanha e termos.

O health check `GET https://<dominio-api-hml>/api/health` deve responder `200` com `{"status":"ok"}`. Um domínio do Railway pode estar ativo mesmo que a integração com Neon ou Asaas esteja incorreta; portanto, faça também o teste real de ponta a ponta no Sandbox.

## 6. Criar o ambiente PRD

Só inicie esta etapa após HML estar aprovada, os dados institucionais conferidos e a conta real da ONG aprovada pelo Asaas.

### 6.1 Neon — banco de produção

1. Crie um projeto Neon **separado** chamado `doecalmae-prd`.
2. Selecione região próxima ao Railway.
3. Copie a connection string pooled, com TLS.
4. Cadastre-a somente como `DATABASE_URL` no serviço API PRD.
5. Confirme que o banco PRD está vazio/isolado e não receberá os dados de HML.

### 6.2 Railway — API de produção

1. No projeto Railway, adicione outro serviço a partir do mesmo repositório.
2. Configure:
   - **Service name:** `doecalmae-api-prd`
   - **Branch:** `main`
   - **Root Directory:** `/api`
   - **Start command:** `npm start`
   - **Health check path:** `/api/health`
3. Gere um domínio público HTTPS e anote a origem, por exemplo `https://doecalmae-api-prd.up.railway.app`.
4. Configure as variáveis:

| Variável | Valor em PRD |
|---|---|
| `NODE_ENV` | `production` |
| `FRONTEND_ORIGIN` | Origem oficial do site, por exemplo `https://doecalmae.org.br` |
| `DATABASE_URL` | Connection string pooled do Neon **PRD** |
| `ASAAS_BASE_URL` | `https://api.asaas.com` |
| `ASAAS_API_KEY` | Chave **live/produção** do Asaas da ONG |
| `ASAAS_WEBHOOK_TOKEN` | Novo token aleatório forte, exclusivo de PRD; não reutilize o token HML |
| `PORT` | Fornecido automaticamente pelo Railway |

5. Configure o domínio, aguarde o deploy e valide `GET /api/health`.

### 6.3 Vercel — site de produção

1. Use o mesmo projeto Vercel já configurado em HML.
2. Configure `main` como **Production Branch** (em **Settings → Git**).
3. Confirme o mesmo comando de build e diretório de saída:
   - **Framework Preset:** `Other`
   - **Root Directory:** `./`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm ci`
4. Atribua ou mantenha o domínio oficial do site nesse projeto Vercel; o domínio de produção continua associado aos deployments de `main`.
5. Em **Settings → Environment Variables**, confirme `CALMAE_API_BASE_URL` em **Production** apontando à API PRD. O valor **Preview** continua apontando à API HML.
6. Faça um novo deployment de produção depois de configurar variáveis ou domínio.
7. Confirme que `FRONTEND_ORIGIN` da API PRD é exatamente a origem do domínio oficial, por exemplo `https://calmaejovem.org.br`, sem caminho nem barra final. Se o domínio mudar, atualize a variável Railway e faça redeploy da API.

### 6.4 Asaas — conta live e webhook PRD

1. Conclua a verificação cadastral da ONG no Asaas e confirme habilitação de Pix, boleto e cartão para a conta de produção.
2. Gere uma chave live no painel de produção. Armazene-a somente na variável `ASAAS_API_KEY` do Railway PRD.
3. Gere um **novo** token secreto para produção; configure o mesmo valor no webhook live do Asaas e em `ASAAS_WEBHOOK_TOKEN` no Railway PRD.
4. Cadastre `https://<dominio-api-prd>/api/webhooks/asaas` como URL de webhook e habilite os mesmos eventos testados em HML.
5. Faça uma doação de produção controlada, autorizada pela ONG, usando valor baixo e forma de pagamento acordada. Confirme a cobrança no painel do Asaas, a entrega do webhook, o registro no banco PRD e o procedimento financeiro de conciliação/estorno antes de divulgar a campanha.

## 7. Variáveis de ambiente — resumo

| Nome | Onde configurar | Secreto? | Observação |
|---|---|---:|---|
| `CALMAE_API_BASE_URL` | Um projeto Vercel: Production e Preview | Não | Production aponta à API PRD; Preview aponta à API HML |
| `NODE_ENV` | Railway HML e PRD | Não | Use `production` nos serviços hospedados |
| `FRONTEND_ORIGIN` | Railway HML e PRD | Não | Uma origem exata por API; protocolo `https://`, sem caminho/barra final |
| `DATABASE_URL` | Railway HML e PRD | **Sim** | Connection string Neon; usar projeto HML/PRD correspondente |
| `ASAAS_BASE_URL` | Railway HML e PRD | Não | Sandbox: `https://api-sandbox.asaas.com`; live: `https://api.asaas.com` |
| `ASAAS_API_KEY` | Railway HML e PRD | **Sim** | Chave Sandbox em HML; chave live em PRD |
| `ASAAS_WEBHOOK_TOKEN` | Railway e webhook Asaas de cada ambiente | **Sim** | Mesmo valor nos dois lados do mesmo webhook; tokens diferentes entre ambientes |
| `PORT` | Railway | Não | Injetada pelo Railway; não criar manualmente |

No Vercel, crie apenas `CALMAE_API_BASE_URL`; ela é pública no código final do site e serve para o navegador encontrar a API. A chave Asaas, o token do webhook e `DATABASE_URL` ficam exclusivamente no Railway.

### `.env` local (opcional)

Para rodar a API em desenvolvimento, copie `api/.env.example` para `api/.env` e preencha com banco e credenciais de **Sandbox**. O `.env` está no `.gitignore`. Nunca use as credenciais de produção no computador de desenvolvimento.

## 8. Checklist de liberação PRD

- [ ] Pull Request de HML para `main` aprovado e mergeado.
- [ ] Site Vercel PRD usa o branch `main` e o domínio oficial.
- [ ] `CALMAE_API_BASE_URL` do Vercel aponta para a API PRD.
- [ ] `FRONTEND_ORIGIN` do Railway PRD corresponde exatamente ao domínio do site.
- [ ] API PRD usa a URL, a chave e o webhook live do Asaas.
- [ ] `DATABASE_URL` aponta para o projeto Neon PRD.
- [ ] Health check e logs da API estão saudáveis.
- [ ] Webhook live cadastrado e autenticado com token exclusivo.
- [ ] Teste controlado concluído e conciliado pela equipe responsável.
- [ ] Textos de consentimento, privacidade e tratamento de dados revisados.
- [ ] Equipe sabe como identificar pagamento, cobrança vencida, estorno e chargeback.

## 9. Atualizações, rollback e incidentes

- **Atualização:** faça mudanças em branch de feature, abra Pull Request para `homologacao`, teste HML e depois abra Pull Request para `main`.
- **Rollback do front-end:** no Vercel, use a tela de Deployments para promover novamente o deploy PRD previamente aprovado.
- **Rollback da API:** reverta o commit pelo fluxo Git (novo commit/Pull Request) e aguarde o Railway redeployar. Não use `git reset --hard` em branches compartilhados.
- **Banco:** faça backup antes de alterações estruturais. Não restaure, apague ou troque o banco PRD durante uma correção de HML.
- **Chave exposta:** revogue e gere outra chave no Asaas/Railway imediatamente; não tente apenas apagar o valor do commit.
- **Pagamento divergente:** consulte o Asaas e os eventos de webhook antes de qualquer reenvio de cobrança. Não conclua que houve pagamento apenas pelo retorno ao site.

## 10. Links oficiais úteis

- [Vercel — variáveis de ambiente](https://vercel.com/docs/projects/environment-variables)
- [Vercel — ambientes Preview e Production](https://vercel.com/docs/deployments/environments)
- [Vercel — URLs únicas e Git Branch URL](https://vercel.com/docs/deployments/generated-urls)
- [Vercel — variáveis por branch Git](https://vercel.com/changelog/environments-variables-per-git-branch)
- [Vercel — configurações de build e output](https://vercel.com/docs/deployments/configure-a-build)
- [Railway — variáveis de ambiente](https://docs.railway.com/guides/variables)
- [Railway — deploy de aplicação Node.js](https://docs.railway.com/guides/node)
- [Neon — conectar a aplicação](https://neon.tech/docs/connect/connect-from-any-app)
- [Asaas — Sandbox](https://docs.asaas.com/docs/sandbox)
- [Asaas — criar cobrança](https://docs.asaas.com/reference/criar-nova-cobranca)
- [Asaas — criar assinatura](https://docs.asaas.com/docs/criando-uma-assinatura)
- [Asaas — eventos de cobrança e webhooks](https://docs.asaas.com/docs/webhook-para-cobrancas)
