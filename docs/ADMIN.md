# Módulo Administrativo e Sistema de Selos (ADMIN.md)

Este documento detalha o funcionamento técnico, endpoints, regras de negócio e fluxo do **Módulo Administrativo (`/api/admin`)**, **Verificação de E-mail via Resend**, **Sistema de Selos (Azul e Dourado)**, **Feedbacks de Usuários** e **Controle de Versão do App**.

---

## 1. Configuração de Variáveis de Ambiente (.env)

Adicione as seguintes variáveis no seu arquivo `.env`:

```env
# Provedor de E-mail Resend (resend.com)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=Tribo <onboarding@resend.dev>

# URLs Públicas e Releases no Cloudflare R2
R2_PUBLIC_URL=https://pub-42c1a5dd1d8e4de4946a82f2fa559aa2.r2.dev
APP_LATEST_VERSION=1.2.0
APP_DOWNLOAD_URL=https://pub-42c1a5dd1d8e4de4946a82f2fa559aa2.r2.dev/releases/tribo-latest.apk
```

---

## 2. Ciclo de Vida dos Selos (Azul e Dourado)

O sistema conta com 3 estados de selo definidos no campo `badge_type` da tabela `users`:
- `'NONE'`: Usuário comum sem e-mail verificado.
- `'BLUE'`: Usuário com e-mail verificado com sucesso pelo código numérico do Resend.
- `'GOLD'`: Selo especial atribuído pelo Administrador através do painel.

### 🔄 Diagrama do Ciclo do Selo:
```
[1. Cadastro do Usuário]
         │
         ▼
[2. Envio de Código (6 dígitos) via Resend para o E-mail]
         │
         ▼
[3. Usuário digita o Código em POST /api/auth/verify-email]
         │
         ▼
[4. E-mail Validado: email_verified=true e badge_type='BLUE' (Selo Azul)]
         │
         ├─── (Se o Admin tentar ativar Selo Dourado para usuário NÃO verificado) ───► [Erro 400 Bad Request]
         │
         ▼
[5. Admin ativa Toggle no Painel: PATCH /api/admin/users/:id/badge { enableGoldBadge: true }]
         │
         ▼
[6. Perfil promovido para badge_type='GOLD' (Selo Dourado)]
         │
         ▼
[7. Admin desativa Toggle no Painel: PATCH /api/admin/users/:id/badge { enableGoldBadge: false }]
         │
         ▼
[8. Perfil retorna AUTOMATICAMENTE para badge_type='BLUE' (Mantém Selo Azul de e-mail verificado)]
```

---

## 3. Endpoints Públicos e de Usuários

### 3.1. Validação de E-mail
- **Método**: `POST`
- **Rota**: `/api/auth/verify-email` (ou `/api/verify-email`)
- **Permissão**: Pública
- **Payload**:
```json
{
  "email": "usuario@exemplo.com",
  "code": "583921"
}
```
- **Resposta de Sucesso (200 OK)**:
```json
{
  "message": "E-mail validado com sucesso! Selo azul ativado no seu perfil.",
  "user": {
    "id": "62bb2e37-44f8-4330-9011-bb06fe4d9006",
    "name": "Maria Silva",
    "email": "usuario@exemplo.com",
    "username": "mariasilva",
    "email_verified": true,
    "badge_type": "BLUE"
  }
}
```

### 3.2. Reenviar Código de Verificação
- **Método**: `POST`
- **Rota**: `/api/auth/resend-code`
- **Permissão**: Pública
- **Payload**: `{ "email": "usuario@exemplo.com" }`
- **Resposta (200 OK)**: `{ "message": "Novo código de verificação enviado para seu e-mail" }`

### 3.3. Enviar Feedback ou Reclamação
- **Método**: `POST`
- **Rota**: `/api/feedback`
- **Permissão**: Usuário Autenticado (`Bearer <token>`)
- **Payload**:
```json
{
  "subject": "Sugestão de funcionalidade",
  "message": "Gostaria de sugerir a criação de comunidades temáticas no app!"
}
```
- **Resposta de Sucesso (201 Created)**:
```json
{
  "message": "Feedback enviado com sucesso! Obrigado por nos ajudar a melhorar a Tribo.",
  "feedback": {
    "id": "7a9b1c2d-3e4f-5a6b-7c8d-9e0f1a2b3c4d",
    "user_id": "62bb2e37-44f8-4330-9011-bb06fe4d9006",
    "subject": "Sugestão de funcionalidade",
    "message": "Gostaria de sugerir a criação de comunidades temáticas no app!",
    "status": "pending",
    "created_at": "2026-08-03T15:20:00.000Z"
  }
}
```

### 3.4. Consultar Versão do Aplicativo (Cloudflare Release)
- **Método**: `GET`
- **Rota**: `/api/app/version`
- **Permissão**: Pública
- **Resposta (200 OK)**:
```json
{
  "latestVersion": "1.2.0",
  "downloadUrl": "https://pub-42c1a5dd1d8e4de4946a82f2fa559aa2.r2.dev/releases/tribo-latest.apk",
  "forceUpdate": false
}
```

---

## 4. Endpoints Exclusivos do Administrador (`/api/admin/*`)

> **Regra Geral de Segurança**: Todas as rotas abaixo exigem `Authorization: Bearer <token_admin>` onde o usuário possua `role === 'ADMIN'` e `status === 'ACTIVE'`. Caso contrário, a API retornará **403 Forbidden**.

### 4.1. Listar Usuários com Status e Selos
- **Método**: `GET`
- **Rota**: `/api/admin/users`
- **Resposta (200 OK)**:
```json
[
  {
    "id": "62bb2e37-44f8-4330-9011-bb06fe4d9006",
    "name": "Maria Silva",
    "email": "maria@exemplo.com",
    "username": "mariasilva",
    "avatar_url": "https://pub-42c1a5dd1d8e4de4946a82f2fa559aa2.r2.dev/profiles/avatar.jpg",
    "email_verified": true,
    "badge_type": "BLUE",
    "status": "ACTIVE",
    "role": "USER",
    "created_at": "2026-08-01T10:00:00.000Z"
  }
]
```

---

### 4.2. Ativar / Desativar Selo Dourado (Toggle)
- **Método**: `PATCH`
- **Rota**: `/api/admin/users/:id/badge`
- **Payload para Ativar Selo Dourado**:
```json
{
  "enableGoldBadge": true
}
```
- **Caso 1: Sucesso (Usuário com E-mail Verificado):**
  - **Status**: `200 OK`
  - **Resposta**:
  ```json
  {
    "message": "Selo Dourado ativado com sucesso",
    "user": {
      "id": "62bb2e37-44f8-4330-9011-bb06fe4d9006",
      "badge_type": "GOLD",
      "email_verified": true
    }
  }
  ```

- **Caso 2: Erro de Pré-requisito (Usuário com e-mail não verificado):**
  - **Status**: `400 Bad Request`
  - **Resposta**:
  ```json
  {
    "message": "O usuário precisa ter o e-mail verificado para receber o Selo Dourado"
  }
  ```

- **Payload para Desativar Selo Dourado:**
```json
{
  "enableGoldBadge": false
}
```
- **Resposta ao Desativar (200 OK):**
  - O sistema automaticamente retorna o `badge_type` para `'BLUE'`, mantendo o selo de verificação de e-mail intacto.
  ```json
  {
    "message": "Selo Dourado desativado. Selo Azul (e-mail verificado) mantido.",
    "user": {
      "id": "62bb2e37-44f8-4330-9011-bb06fe4d9006",
      "badge_type": "BLUE",
      "email_verified": true
    }
  }
  ```

---

### 4.3. Listar Feedbacks e Reclamações
- **Método**: `GET`
- **Rota**: `/api/admin/feedbacks`
- **Resposta (200 OK)**:
```json
[
  {
    "id": "7a9b1c2d-3e4f-5a6b-7c8d-9e0f1a2b3c4d",
    "subject": "Sugestão de funcionalidade",
    "message": "Gostaria de sugerir a criação de comunidades temáticas no app!",
    "status": "pending",
    "created_at": "2026-08-03T15:20:00.000Z",
    "user": {
      "id": "62bb2e37-44f8-4330-9011-bb06fe4d9006",
      "name": "Maria Silva",
      "username": "mariasilva",
      "email": "maria@exemplo.com",
      "avatar_url": "https://pub-42c1a5dd1d8e4de4946a82f2fa559aa2.r2.dev/profiles/avatar.jpg",
      "badge_type": "BLUE",
      "email_verified": true
    }
  }
]
```

---

### 4.4. Listar Denúncias Detalhadas
- **Método**: `GET`
- **Rota**: `/api/admin/reports`
- **Resposta (200 OK)**: Retorna todas as denúncias registradas com dados de denunciante, denunciado e conteúdo.

---

### 4.5. Moderação Direta de Contas
- `POST /api/admin/users/:id/ban`: Bane o usuário (`status = 'BANNED'`).
- `DELETE /api/admin/users/:id/ban`: Desbane e reativa a conta.
- `PUT /api/admin/users/:id/status`: Altera status (`ACTIVE`, `SUSPENDED`, `BANNED`).
