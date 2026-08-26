<div align="center">
  <img src="https://pub-08d4ac7de5354fadbfe07fcbc70237ba.r2.dev/icon-tribo.png" alt="Tribo Logo" width="128" height="128" style="border-radius: 24px;" />

  # ⚡ Tribo API
  **O Motor Backend em Tempo Real da Rede Social Tribo**

  [![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
  [![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
  [![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io/)
  [![License](https://img.shields.io/badge/License-Proprietary-blue?style=for-the-badge)](LICENSE)

  <p align="center">
    Uma API robusta, escalável e de baixa latência projetada para alimentar feeds dinâmicos, mensagens privadas e em grupos em tempo real, reels personalizados, transmissão de áudio e gestão administrativa da <strong>Tribo</strong>.
  </p>
</div>

---

## 🌟 Sobre a Tribo

A **Tribo** é uma plataforma moderna de conexões autênticas, comunidades ativas (Tribos), compartilhamento de vídeos curtos (Reels calibrados por algoritmo dinâmico), áudio em alta velocidade e mensagens em tempo real com stickers interativos.

A **Tribo API** é a espinha dorsal de todo esse ecossistema, garantindo:
- **Alta Disponibilidade & Baixa Latência:** Respostas rápidas e sincronização em tempo real via WebSockets.
- **Segurança & Moderação Automática:** Filtragem de conteúdo sensível (+18) com Sightengine e autenticação JWT.
- **Algoritmo Inteligente de Reels:** Calibragem comportamental contínua com suporte a temas 2026, memes em alta e preferências personalizadas.
- **Sistema Global de Suspensão:** Controle em tempo real para modos de Manutenção e Ordem Legal com bypass mestre garantido.

---

## 🚀 Principais Módulos & Recursos

### 💬 1. Mensagens & Tribos em Tempo Real
- Chat direto (1-a-1) e canais comunitários (Tribos).
- Áudios de voz com aceleração dinâmica (**1x até 5x**).
- Figurinhas animadas em vídeo com volume espacializado e auto-pause.
- Salas de voz ao vivo integradas (*Live Voice Rooms*).
- Badges e contadores de mensagens não lidas em tempo real.

### 🎬 2. Algoritmo de Reels
- Feed dinâmico de vídeos curtos verticais (Shorts/Reels).
- Mecanismo autônomo e resiliente de busca de tendências e memes de 2026.
- Calibração de preferências por texto livre e categorias de interesse.

### 🛡️ 3. Moderação & Segurança
- Sistema automático de detecção e bloqueio de imagens inadequadas (+18) com **Sightengine**.
- Proteção contra abusos, rate-limiting e suporte a denúncias.
- Controle de banimentos e advertências em tempo real.

### ⚙️ 4. Gestão Administrativa & Suspensão Global
- Middleware global com suporte aos modos **Ativo**, **Manutenção** e **Ordem Legal**.
- Broadcast instantâneo via WebSocket para atualização de todos os clientes em tempo real.
- **Acesso Mestre Exclusivo:** Garantia de operação contínua para a conta administrativa.

---

## 🛠️ Tecnologias Utilizadas

- **Runtime:** Node.js (v18+)
- **Framework Web:** Express.js
- **Banco de Dados:** PostgreSQL (com `postgres.js` / Neon / Supabase)
- **Comunicação em Tempo Real:** Socket.io
- **Autenticação:** JSON Web Tokens (JWT) & Bcrypt
- **Armazenamento de Arquivos:** Cloudflare R2 / AWS S3 SDK
- **Moderação:** Sightengine API

---

## 📦 Como Instalar e Executar

### 1. Clonar o Repositório
```bash
git clone https://github.com/luan-Silva-Dev-0fc/tribo-api.git
cd tribo-api
```

### 2. Instalar as Dependências
```bash
npm install
```

### 3. Configurar as Variáveis de Ambiente
Copie o arquivo de exemplo e preencha suas chaves:
```bash
cp .env.example .env
```

### 4. Executar o Servidor
```bash
# Modo de Desenvolvimento
npm run dev

# Modo de Produção
npm start
```

O servidor estará disponível por padrão em `http://localhost:3000`.

---

## 📂 Estrutura do Projeto

```
tribo-api/
├── src/
│   ├── config/          # Conexão com banco de dados e variáveis de ambiente
│   ├── controllers/     # Controladores de regras de negócio (Auth, Reels, Admin...)
│   ├── middlewares/     # Middlewares de autenticação, upload e suspensão
│   ├── models/          # Modelos de acesso a dados SQL
│   ├── routes/          # Definição das rotas REST
│   ├── services/        # Serviços auxiliares (JWT, Moderação, Reels, Storage)
│   ├── sockets/         # Handlers de WebSockets (Chat, Notificações, Voz)
│   ├── utils/           # Utilitários, formatadores e loggers
│   ├── app.js           # Configuração da aplicação Express
│   └── server.js        # Inicialização do servidor HTTP e Socket.io
├── .gitignore
├── .env.example
├── README.md
└── package.json
```

---

<div align="center">
  <sub>Desenvolvido com dedicação por <strong><a href="https://github.com/luan-Silva-Dev-0fc">Luan Silva</a></strong> para a comunidade Tribo.</sub>
</div>
