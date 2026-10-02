import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/errors.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('No token provided', 'AUTH_TOKEN_EXPIRED', 401));
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.user = payload; // { id, role, email }
    next();
  } catch {
    next(new AppError('Token expired or invalid', 'AUTH_TOKEN_EXPIRED', 401));
  }
}

export function requireRole(...roles) {
  return [
    requireAuth,
    (req, _res, next) => {
      if (!roles.includes(req.user.role)) {
        return next(new AppError('Forbidden', 'AUTH_ROLE_FORBIDDEN', 403));
      }
      next();
    },
  ];
}
