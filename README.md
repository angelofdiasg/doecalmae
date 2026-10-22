# Campanha Calmaê Jovem

Site responsivo da campanha do ONN — Os Novos Nordestinos, com API de doações integrada ao Asaas. O front-end pode ser publicado na Vercel; a API Node.js e o PostgreSQL podem ser hospedados no Railway e Neon, respectivamente.

## Estrutura

- `index.html`: conteúdo, formulário de doação e configuração da URL da API.
- `src/css/styles.css`: identidade visual, componentes e estilos responsivos.
- `src/js/main.js`: validação da interação e encaminhamento ao checkout hospedado do Asaas.
- `api/src/`: API, integração com Asaas, validação de entrada e webhook.
- `api/sql/001_init.sql`: tabelas de doações e eventos de webhook.
- `api/test/`: testes unitários da validação e do cliente Asaas.
- `assets/`: logotipo e arquivos de mídia.
- `docs/`: materiais de identidade visual.

## Como funciona a doação

1. O doador escolhe um valor e frequência, informa seus dados e seleciona Pix, boleto ou cartão.
2. A API cria o cliente e a cobrança no Asaas. Para doações mensais, cria uma assinatura mensal de Pix ou boleto.
3. O navegador é redirecionado para a fatura hospedada em `www.asaas.com`; o site não recebe nem armazena dados de cartão.
4. O Asaas notifica a API por webhook. A API verifica o token, registra o evento de forma idempotente e atualiza o estado da doação.

As doações mensais por Pix ou boleto geram novas cobranças para o doador pagar a cada ciclo; **não são débito automático**. Recorrência automática por cartão e Pix Automático não fazem parte desta primeira versão. Doações corporativas continuam sendo tratadas por contato, fora do checkout individual.

## Desenvolvimento local

1. Instale Node.js 20 ou superior.
2. Em `api/`, instale as dependências e crie o arquivo local de configuração:

   ```powershell
   cd api
   npm install
   Copy-Item .env.example .env
   ```

3. Preencha `.env` com a URL do Neon, credenciais de sandbox do Asaas e origem local do site (`FRONTEND_ORIGIN`). Não compartilhe nem envie credenciais ao Git.
4. Execute a migração e a API:

   ```powershell
   npm run migrate
   npm run dev
   ```

5. Sirva a pasta raiz com um servidor HTTP local. Configure a origem usada por esse servidor em `FRONTEND_ORIGIN`. Em localhost, a página usa `http://localhost:3000` por padrão. Para validar o build do front-end, defina `CALMAE_API_BASE_URL` com a origem HTTPS de uma API disponível e rode `npm run build`.
6. Execute os testes com `npm test` dentro da pasta `api`.

Para testar webhooks no ambiente local, é necessário expor a API por HTTPS e cadastrar essa URL no painel do Asaas. Use somente a conta e as chaves de sandbox até concluir os testes.

## Publicação

Para um roteiro completo de homologação e produção, consulte o [Guia de implantação](docs/GUIA-IMPLANTACAO.md).

### Vercel — front-end

- Importe o repositório e publique a raiz do projeto com `npm run build` como comando de build e `dist` como diretório de saída.
- Configure `CALMAE_API_BASE_URL` como variável de build HTTPS com a origem pública da API correspondente ao ambiente.
- Configure no Railway `FRONTEND_ORIGIN` com a origem exata do domínio publicado, por exemplo `https://calmaejovem.org.br`.

### Railway — API

- Crie um serviço a partir do diretório `api/` (root directory `api`).
- Use `npm start`; o `prestart` executa a migração SQL antes de iniciar o servidor.
- Cadastre as variáveis `DATABASE_URL`, `FRONTEND_ORIGIN`, `ASAAS_BASE_URL`, `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN`. O Railway fornece `PORT`.
- Comece com `ASAAS_BASE_URL=https://api-sandbox.asaas.com` e a chave de sandbox. Só mude para `https://api.asaas.com` e uma chave de produção depois de validar o fluxo e a conta da ONG.
- Configure o health check para `GET /api/health`.

### Neon — banco

- Crie um banco PostgreSQL no Neon e use sua connection string com TLS como `DATABASE_URL` do Railway.
- As tabelas são criadas pelo comando de migração do serviço.
- O banco armazena identificadores de pagamento, valor, frequência e estado; nome, CPF/CNPJ, e-mail e telefone não são persistidos nesta aplicação. Os IDs do Asaas ainda podem ser associados ao cadastro mantido pelo provedor e devem ser protegidos como dados operacionais sensíveis.

### Webhook do Asaas

- Cadastre `https://<domínio-da-api>/api/webhooks/asaas` como URL de webhook.
- Configure um token secreto e use o mesmo valor em `ASAAS_WEBHOOK_TOKEN` no Railway.
- Ative eventos de cobrança confirmada/recebida, vencida, removida, estornada parcialmente/totalmente e chargeback.

## Antes de receber doações reais

- Teste valores, formas de pagamento, vencimentos, assinaturas e webhooks no sandbox.
- Confirme com o Asaas a habilitação dos meios de pagamento, taxas, valores mínimos, dados cadastrais da ONG e limites da conta.
- Valide a política de privacidade e o aviso de tratamento de CPF/CNPJ e telefone, conforme a LGPD.
- Cadastre o domínio de produção na conta Asaas e use somente variáveis secretas do Railway para credenciais.
- Revise o comportamento de conciliação e estorno com a equipe financeira. Retorno ao site ou redirecionamento não é prova de pagamento; a confirmação válida vem do webhook.

Consulte a documentação do Asaas sobre [cobranças](https://docs.asaas.com/reference/criar-nova-cobranca), [assinaturas](https://docs.asaas.com/docs/criando-uma-assinatura) e [webhooks](https://docs.asaas.com/docs/webhook-para-cobrancas).
