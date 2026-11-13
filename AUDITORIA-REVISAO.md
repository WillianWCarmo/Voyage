# Relatório de auditoria e revisão — Voyage

## Resultado da revisão do pacote recebido

O ZIP recebido continha as aplicações Web e Mobile já adaptadas para consumir uma API HTTP local, além de documentação que descrevia um backend. Porém, a pasta `backend/` não estava presente no arquivo, embora os comandos e a documentação dependessem dela. Também havia uma senha fixa do PostgreSQL escrita em `comandos-iniciar.txt`. Essa inconsistência impedia a inicialização conforme as instruções e expunha uma credencial que não deveria estar no projeto.

## Correções realizadas nesta revisão

- Criada a pasta `backend/` com servidor Node.js/Express, pool PostgreSQL, autenticação JWT e hash de senha com bcrypt.
- Criado `backend/database/schema.sql` com tabelas de usuários, carteiras, cartões de transporte, catálogo e passes adquiridos, transações, avisos, linhas, paradas, frota, favoritos, notícias, parceiros e regiões.
- Criado `backend/src/setup-db.js` para preparar o schema e inserir o catálogo de seis passes e a rede demonstrativa de transporte.
- Implementados os endpoints consumidos pelo Mobile e pelo Web: saúde da API, cadastro/login, perfil, estado da conta, catálogo, cartão físico/virtual, recarga demonstrativa, compra de passe, embarque, favoritos, leitura de avisos e conteúdo público (notícias, parceiros, regiões, linhas/paradas e ônibus).
- Operações de recarga, compra de passe e embarque usam transações no PostgreSQL. O saldo não pode ficar negativo.
- O painel administrativo permanece bloqueado; `/api/admin/*` responde `403 ADMIN_DISABLED`.
- Atualizadas as instruções para Windows 11/PowerShell, sem Docker e sem senha fixa. Segredos ficam somente em `backend/.env`, ignorado pelo Git.
- Mantidas as telas, os componentes e a identidade visual existentes do Web e Mobile.

## Contrato de dados e comportamento

- Web e Mobile usam a mesma API na porta `3333` e o mesmo banco PostgreSQL.
- O Mobile usa `AsyncStorage` em Android/iOS e `localStorage` na versão Web para o token de sessão.
- O banco novo não importa contas, saldos, cartões, histórico ou conteúdo editorial de bases anteriores.
- São semeados apenas os seis passes e a malha de transporte demonstrativa usada pelo mapa.
- Notícias, parceiros e regiões começam vazios; a interface Web já possui estados vazios para essas listas.
- A frota não representa GPS real: o Mobile mantém a simulação local quando a tabela `transit_buses` está vazia.
- Recargas são créditos demonstrativos e não processam pagamentos reais.

## Verificações executadas nesta revisão

- `node --check` nos arquivos JavaScript do backend: aprovado.
- Conferência estática das rotas usadas pelo cliente Mobile e Web com as rotas implementadas no backend: realizada.
- Busca em código executável por chamadas/SDK Supabase: nenhuma chamada ativa encontrada; as referências históricas/documentais não são integração em execução.
- Busca por senha fixa antiga no projeto: removida; agora existe somente o marcador `SUA_SENHA_LOCAL` no exemplo de configuração.

## Verificações não executadas neste ambiente

- O ambiente não possui `psql`/servidor PostgreSQL, então o schema ainda não foi aplicado a uma instância PostgreSQL real.
- A instalação de dependências npm do backend não concluiu neste ambiente (a tentativa excedeu o tempo disponível). Portanto, o servidor não foi iniciado aqui.
- Não foram executados o typecheck/build Expo, nem testes end-to-end em navegador, emulador ou celular físico.

Essas validações precisam ser feitas no Windows do projeto seguindo o `README.md`. O primeiro teste após a instalação é `http://localhost:3333/api/health`, que deve informar `status: ok` e `database: connected`.

## Limitações e segurança

- A API foi preparada para uso em rede local. Não a publique na internet sem HTTPS, CORS restrito, backups, monitoramento e revisão de segurança.
- A senha do PostgreSQL e o segredo JWT devem ser definidos pelo usuário em `backend/.env`; não compartilhe esse arquivo.
- A área administrativa está desativada e não possui CRUD administrativo nesta versão.
- A rede e a frota são demonstrativas; não há integração com GPS ou operador de transporte real.
