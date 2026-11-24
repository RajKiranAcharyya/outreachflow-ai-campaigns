import { Request, Response, NextFunction } from 'express';

export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['x-admin-token'];
  const expectedToken = process.env.ADMIN_TOKEN || 'secret_admin_token';

  if (!token || token !== expectedToken) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or missing admin token' } });
  }

  next();
}
