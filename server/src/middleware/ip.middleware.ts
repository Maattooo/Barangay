import { Request, Response, NextFunction } from 'express';
import '../types';

/**
 * Sanitizes and normalizes raw IP strings to clean IPv4 addresses.
 * Strips IPv6 prefixes (e.g., ::ffff:192.168.1.5 -> 192.168.1.5)
 * and maps IPv6 loopbacks (::1) to 127.0.0.1.
 */
export function sanitizeIp(rawIp?: string | string[]): string {
  if (!rawIp) {
    return '127.0.0.1';
  }

  let ipString: string;
  if (Array.isArray(rawIp)) {
    ipString = rawIp[0] || '127.0.0.1';
  } else {
    ipString = rawIp;
  }

  // Handle multiple comma-separated proxy IPs in X-Forwarded-For
  if (ipString.includes(',')) {
    ipString = ipString.split(',')[0].trim();
  }

  ipString = ipString.trim();

  // Strip IPv6-mapped IPv4 prefix (e.g. ::ffff:192.168.1.5 -> 192.168.1.5)
  if (ipString.startsWith('::ffff:')) {
    ipString = ipString.substring(7);
  }

  // Normalize IPv6 loopback or localhost
  if (ipString === '::1' || ipString === 'localhost') {
    return '127.0.0.1';
  }

  return ipString || '127.0.0.1';
}

/**
 * Middleware that extracts the client LAN IPv4 address from headers or socket
 * and attaches the sanitized result to req.clientIp.
 */
export function ipMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = forwarded || req.socket?.remoteAddress || req.ip;

  req.clientIp = sanitizeIp(rawIp as string | string[] | undefined);
  next();
}

export default ipMiddleware;
