const { sql } = require("../config/database");

async function archiveAndDeleteMessage({ messageId, userId, actionType, ipAddress, userAgent }) {
  if (!messageId) throw new Error("ID da mensagem é obrigatório");
  if (!userId) throw new Error("ID do usuário é obrigatório");

  const action = actionType || 'DELETE_FOR_ME';

  await sql.begin(async (t_sql) => {

    const [msg] = await t_sql`
      SELECT id, sender_id, receiver_id, content, message, media_url, audio_url, created_at, is_deleted, deleted_for_everyone
      FROM messages
      WHERE id = ${messageId}
    `;

    if (!msg) {
      const err = new Error("Mensagem não encontrada");
      err.status = 404;
      throw err;
    }

    if (action === 'DELETE_FOR_ALL' && String(msg.sender_id) !== String(userId)) {
      const err = new Error("Apenas o remetente pode apagar a mensagem para todos");
      err.status = 403;
      throw err;
    }

    const [judicialMsg] = await t_sql`
      INSERT INTO judicial_messages (
        original_message_id, sender_id, recipient_id, content, created_at,
        deleted_by_user_id, ip_address, user_agent
      ) VALUES (
        ${msg.id}, ${msg.sender_id}, ${msg.receiver_id}, ${msg.content || msg.message || ""}, ${msg.created_at},
        ${userId}, ${ipAddress || null}, ${userAgent || null}
      ) RETURNING id
    `;

    if (msg.media_url) {
      await t_sql`
        INSERT INTO judicial_media (
          message_id, media_type, original_url, judicial_archive_url, created_at
        ) VALUES (
          ${judicialMsg.id}, 'IMAGE_OR_VIDEO', ${msg.media_url}, ${msg.media_url}, ${msg.created_at}
        )
      `;
    }

    if (msg.audio_url) {
      await t_sql`
        INSERT INTO judicial_media (
          message_id, media_type, original_url, judicial_archive_url, created_at
        ) VALUES (
          ${judicialMsg.id}, 'AUDIO', ${msg.audio_url}, ${msg.audio_url}, ${msg.created_at}
        )
      `;
    }

    await t_sql`
      INSERT INTO judicial_logs (
        user_id, action_type, payload, ip_address
      ) VALUES (
        ${userId}, ${action}, ${sql.json({ messageId: msg.id, original_content: msg.content || msg.message })}, ${ipAddress || null}
      )
    `;

    if (action === 'DELETE_FOR_ALL') {
      const placeholder = "Esta mensagem foi apagada";
      const deleted_at = new Date().toISOString();
      await t_sql`
        UPDATE messages
        SET content = ${placeholder},
            message = ${placeholder},
            media_url = NULL,
            audio_url = NULL,
            story_id = NULL,
            is_deleted = true,
            deleted_for_everyone = true,
            deleted_at = ${deleted_at}
        WHERE id = ${messageId}
      `;
    } else {

      await t_sql`
        UPDATE messages
        SET deleted_by_users = array_append(COALESCE(deleted_by_users, '{}'), ${userId}::uuid)
        WHERE id = ${messageId} AND NOT (${userId}::uuid = ANY(COALESCE(deleted_by_users, '{}')))
      `;
    }
  });

  return { success: true, messageId };
}

async function archiveAndDeleteGroupMessage({ messageId, userId, actionType, ipAddress, userAgent }) {
  if (!messageId) throw new Error("ID da mensagem de grupo é obrigatório");
  if (!userId) throw new Error("ID do usuário é obrigatório");

  const action = actionType || 'DELETE_FOR_ME';

  await sql.begin(async (t_sql) => {

    const [msg] = await t_sql`
      SELECT id, group_id, user_id, content, media_url, audio_url, created_at, is_deleted, deleted_for_everyone
      FROM group_messages
      WHERE id = ${messageId}
    `;

    if (!msg) {
      const err = new Error("Mensagem de grupo não encontrada");
      err.status = 404;
      throw err;
    }

    if (action === 'DELETE_FOR_ALL' && String(msg.user_id) !== String(userId)) {
      const [member] = await t_sql`
        SELECT role FROM group_members WHERE group_id = ${msg.group_id} AND user_id = ${userId}
      `;
      const [grp] = await t_sql`
        SELECT created_by FROM groups WHERE id = ${msg.group_id}
      `;
      const roleUpper = (member?.role || '').toUpperCase();
      const isAdm = roleUpper === 'ADMIN' || roleUpper === 'OWNER' || roleUpper === 'CRIADOR' || String(grp?.created_by) === String(userId);
      if (!isAdm) {
        const err = new Error("Apenas o autor ou administradores do grupo podem apagar a mensagem para todos");
        err.status = 403;
        throw err;
      }
    }

    const [judicialMsg] = await t_sql`
      INSERT INTO judicial_messages (
        original_message_id, sender_id, group_id, content, created_at,
        deleted_by_user_id, ip_address, user_agent
      ) VALUES (
        ${msg.id}, ${msg.user_id}, ${msg.group_id}, ${msg.content || ""}, ${msg.created_at},
        ${userId}, ${ipAddress || null}, ${userAgent || null}
      ) RETURNING id
    `;

    if (msg.media_url) {
      await t_sql`
        INSERT INTO judicial_media (
          message_id, media_type, original_url, judicial_archive_url, created_at
        ) VALUES (
          ${judicialMsg.id}, 'IMAGE_OR_VIDEO', ${msg.media_url}, ${msg.media_url}, ${msg.created_at}
        )
      `;
    }

    if (msg.audio_url) {
      await t_sql`
        INSERT INTO judicial_media (
          message_id, media_type, original_url, judicial_archive_url, created_at
        ) VALUES (
          ${judicialMsg.id}, 'AUDIO', ${msg.audio_url}, ${msg.audio_url}, ${msg.created_at}
        )
      `;
    }

    await t_sql`
      INSERT INTO judicial_logs (
        user_id, action_type, payload, ip_address
      ) VALUES (
        ${userId}, ${action}, ${sql.json({ messageId: msg.id, original_content: msg.content })}, ${ipAddress || null}
      )
    `;

    if (action === 'DELETE_FOR_ALL') {
      const placeholder = "Esta mensagem foi apagada";
      const deleted_at = new Date().toISOString();
      await t_sql`
        UPDATE group_messages
        SET content = ${placeholder},
            media_url = NULL,
            audio_url = NULL,
            is_deleted = true,
            deleted_for_everyone = true,
            deleted_at = ${deleted_at}
        WHERE id = ${messageId}
      `;
    } else {

      await t_sql`
        UPDATE group_messages
        SET deleted_by_users = array_append(COALESCE(deleted_by_users, '{}'), ${userId}::uuid)
        WHERE id = ${messageId} AND NOT (${userId}::uuid = ANY(COALESCE(deleted_by_users, '{}')))
      `;
    }
  });

  return { success: true, messageId };
}

module.exports = {
  archiveAndDeleteMessage,
  archiveAndDeleteGroupMessage
};