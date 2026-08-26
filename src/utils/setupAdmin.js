const { sql } = require('../config/database');
const bcrypt = require('bcrypt');
const { logger } = require('./logger');

async function setupSuperAdmin() {
  const adminEmails = [
  (process.env.ADMIN_EMAIL || 'luansilva@gmail.com').toLowerCase().trim(),
  'nascimentosilvaluan39@gmail.com'];

  const adminPassword = process.env.ADMIN_PASSWORD || '24250@Ln';

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    for (const adminEmail of adminEmails) {
      const [user] = await sql`
        SELECT id, email, password
        FROM users
        WHERE LOWER(email) = ${adminEmail}
      `;

      if (user) {
        await sql`
          UPDATE users
          SET
            password = ${hashedPassword},
            role = 'ADMIN',
            verified = true,
            email_verified = true,
            badge_type = 'GOLD'
          WHERE id = ${user.id}
        `;
        logger.info(`[Admin Setup] Usuário Super Admin (${adminEmail}) atualizado com sucesso com role ADMIN.`);
      } else if (adminEmail === 'luansilva@gmail.com') {
        const username = 'admin_geral';
        const name = 'Administrador Geral';

        await sql`
          INSERT INTO users (
            username,
            name,
            email,
            password,
            role,
            verified,
            email_verified,
            badge_type,
            created_at,
            updated_at
          ) VALUES (
            ${username},
            ${name},
            ${adminEmail},
            ${hashedPassword},
            'ADMIN',
            true,
            true,
            'GOLD',
            NOW(),
            NOW()
          )
        `;
        logger.info(`[Admin Setup] Usuário Super Admin (${adminEmail}) criado com sucesso.`);
      }
    }
  } catch (error) {
    logger.error(`[Admin Setup] Erro ao configurar o Super Admin: ${error.message}`);
  }
}

module.exports = { setupSuperAdmin };