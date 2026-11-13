# Voyage — API e banco de dados locais

Web e Mobile usam o backend compartilhado em `../../backend/`, implementado com Node.js, Express e PostgreSQL. O navegador e o aplicativo não acessam o PostgreSQL diretamente. Não há dependência de Supabase nem de Docker.

Consulte o `README.md` na raiz do projeto para instalar e iniciar tudo no Windows 11.

## Endpoints

- `GET /api/health` — disponibilidade da API e do banco.
- `POST /api/auth/register` e `POST /api/auth/login` — cadastro e login de passageiros.
- `GET /api/voyage/profile` — consulta a conta autenticada.
- `PATCH /api/auth/me` — atualiza nome e/ou e-mail da conta autenticada.
- `GET /api/voyage/state` — carteira, cartão, passes, histórico, avisos e favoritos.
- `GET /api/voyage/passes` — catálogo de passes.
- `PUT/DELETE /api/voyage/card` e `POST /api/voyage/card/virtual` — vincular, remover ou gerar cartão virtual.
- `POST /api/voyage/wallet/recharge` — recarga demonstrativa.
- `POST /api/voyage/passes/purchase` — compra de passe.
- `POST /api/voyage/transit/board` — embarque.
- `POST /api/voyage/favorites/lines/toggle`, `POST/DELETE /api/voyage/favorites/routes/*` — favoritos.
- `POST /api/voyage/notices/read-all` — marcar avisos como lidos.
- `GET /api/public/news`, `/news/:id`, `/partners`, `/regions`, `/transit` e `/buses` — dados públicos.

As rotas de conta exigem `Authorization: Bearer <token>`. O token é emitido no cadastro/login e armazenado localmente pelo Mobile.

## Banco

`backend/database/schema.sql` cria tabelas de autenticação, perfil, carteira, cartões, passes, transações, avisos, linhas, paradas, ônibus, favoritos, notícias, parceiros e regiões. O script `npm run db:setup` aplica o schema e insere o catálogo de passes e a malha demonstrativa de transporte.

O banco começa sem contas, saldos, cartões, histórico ou conteúdo editorial importado. Não há migração de dados antigos. Notícias, parceiros e regiões começam vazios.

## Administração e limitações

- O painel administrativo permanece desativado. A API responde `403 ADMIN_DISABLED` para qualquer caminho `/api/admin`.
- Recargas são simulações e não representam pagamento real.
- Ônibus são simulados no Mobile enquanto a tabela `transit_buses` estiver vazia.
- O backend foi preparado para execução local e não deve ser publicado na internet sem HTTPS, CORS restrito e gestão segura de segredos.
