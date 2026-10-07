# Campanha Calmaê Jovem

Site responsivo da campanha de apadrinhamento de jovens estudantes do ONN — Os Novos Nordestinos.

## Estrutura

- `index.html`: conteúdo e estrutura da página.
- `src/css/styles.css`: identidade visual, componentes e estilos responsivos.
- `src/js/main.js`: seleção de contribuições e configuração de vídeo e contato.
- `assets/`: logotipo e arquivos de mídia.
- `docs/`: materiais de identidade visual.

## Visualização local

Abra `index.html` no navegador ou sirva a pasta com qualquer servidor HTTP estático.

## Configuração antes da publicação

- Defina `paymentUrl` e `partnerEmail` em `src/js/main.js` para ativar as integrações de pagamento e contato.
- Preencha `data-video-url` no elemento `.video-frame` em `index.html` com uma URL de vídeo do YouTube ou Vimeo.
- Atualize o progresso da campanha (`327` jovens e `32,7%`) no HTML conforme os dados confirmados pelo projeto.
