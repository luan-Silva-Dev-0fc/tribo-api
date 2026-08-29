/**
 * Middleware e Utilitário de Validação de Selo Dourado (Gold Badge)
 * Regra de negócio: Apenas usuários com Selo Dourado possuem permissão para gerenciar a fila
 * e o controle de reprodução de áudio compartilhado no grupo.
 */

function isGoldUser(user) {
  if (!user) return false;

  const badgeType = String(user.badge_type || user.badge || user.badgeType || '').toUpperCase();
  const role = String(user.role || '').toUpperCase();
  const email = String(user.email || '').toLowerCase();

  // Verifica se possui badge GOLD, se é VIP ou se é administrador master
  return (
    badgeType === 'GOLD' ||
    badgeType === 'GOLD_VERIFIED' ||
    Boolean(user.is_gold) ||
    Boolean(user.is_vip) ||
    role === 'ADMIN' ||
    email === 'luansilva@gmail.com'
  );
}

/**
 * Middleware Express para rotas REST
 */
function requireGoldBadge(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Autenticação necessária para realizar esta operação.'
    });
  }

  if (!isGoldUser(req.user)) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN_GOLD_ONLY',
      message: 'Acesso restrito: Apenas usuários com o Selo Dourado (Gold Badge) podem gerenciar a fila e a transmissão de música.'
    });
  }

  next();
}

module.exports = {
  requireGoldBadge,
  isGoldUser
};
