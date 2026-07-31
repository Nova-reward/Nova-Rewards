export const authenticateUser = (req, _res, next) => {
  req.user = { id: 1, role: 'user' };
  next();
};
export const requireAdmin = (_req, _res, next) => next();
