import rateLimit from 'express-rate-limit';

// Throttles login/signup attempts per IP to blunt brute-force/credential-
// stuffing attacks against user accounts.
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});
