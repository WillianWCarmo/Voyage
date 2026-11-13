# Voyage — execução local

Projeto com Web e Mobile consumindo a mesma API Node.js/Express e o mesmo banco PostgreSQL 18. A interface e as telas existentes foram mantidas; o painel administrativo continua desativado. Não há migração de dados antigos nem dependência de Docker.

## Requisitos

- Windows 11 (instruções abaixo), Node.js 20 ou superior e npm.
- PostgreSQL 18 instalado e iniciado.
- Para o Web: extensão Live Server do VS Code (ou servidor estático equivalente).
- Para o Mobile: Expo Go em um celular ou emulador Android.

## 1. Criar o banco PostgreSQL

No pgAdmin, conecte ao servidor local, clique com o botão direito em **Databases → Create → Database**, crie um banco chamado `voyage` e salve. Use o usuário/senha que você definiu na instalação do PostgreSQL.

Alternativamente, no terminal do PostgreSQL:

```powershell
createdb -U postgres voyage
```

Se o comando `createdb` não estiver no PATH, use o pgAdmin ou abra o SQL Shell (psql) instalado com o PostgreSQL.

## 2. Configurar e iniciar a API

Abra o PowerShell na pasta raiz do projeto:

```powershell
cd .\backend
Copy-Item .env.example .env
node -p "require('crypto').randomBytes(48).toString('hex')"
notepad .env
```

No arquivo `backend/.env`, substitua `SUA_SENHA_LOCAL` pela senha que você definiu para o usuário `postgres` e substitua o valor de `JWT_SECRET` pelo texto aleatório gerado. Se a senha do PostgreSQL contiver caracteres especiais (`@`, `:`, `/`, `#`, `%`), codifique-os para URL antes de colocá-la em `DATABASE_URL`. Nunca compartilhe o `.env`.

Depois, ainda dentro de `backend`:

```powershell
npm install
npm run db:setup
npm run dev
```

A API estará em `http://localhost:3333/api`. Teste em `http://localhost:3333/api/health`; a resposta deve indicar `status: ok` e `database: connected`. Mantenha esse terminal aberto.

## 3. Iniciar o Web

Abra um segundo terminal na raiz do projeto:

```powershell
code .
```

No VS Code, abra `apps/web/index.html` e escolha **Open with Live Server**. O navegador deve abrir a página. O Web usa a API local na porta 3333.

## 4. Iniciar o Mobile

Abra um terceiro terminal:

```powershell
cd .\apps\app\mobile
Copy-Item .env.example .env
npm install
npx expo start -c
```

- **Emulador Android:** o endereço padrão `http://10.0.2.2:3333/api` aponta para o computador.
- **Celular físico:** descubra o IPv4 do computador com `ipconfig`. Edite `apps/app/mobile/.env` e defina `EXPO_PUBLIC_API_URL=http://SEU_IPV4:3333/api`. Celular e computador precisam estar na mesma rede Wi-Fi. Libere a porta 3333 no Firewall do Windows para redes privadas, se solicitado.
- Leia o QR Code com o Expo Go ou pressione `a` para abrir no emulador Android.

Não coloque `JWT_SECRET` no Mobile. O segredo existe somente no `backend/.env`.

## Comandos úteis

```powershell
# Dentro de backend
npm run check       # verifica sintaxe dos arquivos Node
npm run db:setup    # cria/atualiza as tabelas e dados básicos
npm run dev         # inicia a API em modo observação

# Dentro de apps/app/mobile
npm run typecheck   # verifica os tipos TypeScript
npx expo start -c   # limpa o cache e inicia o Expo
```

## Dados e comportamento

- O banco novo começa sem contas pessoais, histórico, recargas, cartões ou conteúdo editorial. Cada pessoa cria uma conta pelo aplicativo.
- São inseridos apenas os seis passes e a rede demonstrativa de linhas/paradas que alimentam o mapa. A frota pode continuar simulada no Mobile quando a tabela `transit_buses` estiver vazia.
- Recargas são demonstrativas: não há integração de pagamento nem cobrança real.
- O painel administrativo está desativado e a API retorna `403 ADMIN_DISABLED` em `/api/admin`.
- Web e Mobile compartilham a mesma API e o mesmo PostgreSQL.
- O banco e a API são locais. Não publique a API na internet sem configurar HTTPS, CORS restrito, backups, monitoramento e gestão segura de segredos.

## Estrutura

```text
backend/                 API Express, autenticação e PostgreSQL
  database/schema.sql    Estrutura do banco
  src/                   Rotas, servidor e configuração inicial
apps/web/                Site Web existente
apps/app/mobile/         Aplicativo Expo existente
```
