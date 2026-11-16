# Voyage Mobile

Aplicativo React Native com Expo Router, conectado à API local compartilhada do Voyage.

## Configuração

1. Copie `.env.example` para `.env`.
2. Ajuste `EXPO_PUBLIC_API_URL` conforme o dispositivo (Android Emulator: `http://10.0.2.2:3333/api`; iOS Simulator: `http://localhost:3333/api`; celular físico: IP local do computador).
3. Instale as dependências com `npm install`.
4. Inicie o Expo com `npx expo start -c`.

A API e o PostgreSQL precisam estar em execução. Consulte o README da raiz do projeto.

## Sessão e dados

O Mobile armazena o token de sessão localmente (AsyncStorage em Android/iOS e localStorage na versão Web). As senhas são processadas e armazenadas somente no backend usando bcrypt. O aplicativo não se conecta diretamente ao PostgreSQL.

## Limites conhecidos

- A frota exibida é simulada/interpolada e não representa GPS real.
- As recargas são simuladas e não realizam cobrança Pix/cartão.
- O painel administrativo está desativado nesta versão.
