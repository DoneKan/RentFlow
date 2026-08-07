const crypto = require('crypto');
const ApiError = require('../utils/ApiError');

const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000;

// Coerces a payload timestamp field (unix seconds, unix ms, or an ISO/date
// string — providers aren't consistent) to epoch ms, or null if unusable.
function toEpochMs(raw) {
  if (typeof raw === 'number') return raw > 1e12 ? raw : raw * 1000;
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

// Verifies an inbound payment webhook is genuinely from the provider:
// HMAC-SHA256 over the raw request body, keyed by a shared secret, compared
// timing-safely against a signature header. Both the header name and the
// secret's env var are configurable per call since every provider (MTN,
// Airtel, whatever comes next) names and delivers these differently.
//
// Optionally also rejects stale requests if the parsed body carries a
// timestamp field — guards against a captured request being replayed later.
function verifyWebhookSignature({ headerName, secretEnvVar = 'PAYMENT_WEBHOOK_SECRET', timestampField = 'timestamp' }) {
  if (!headerName) throw new Error('verifyWebhookSignature requires a headerName');

  return (req, res, next) => {
    const secret = process.env[secretEnvVar];
    if (!secret) {
      // Misconfigured on our end — fail closed rather than skip verification.
      return next(ApiError.forbidden('Webhook is not configured'));
    }

    const signature = req.get(headerName);
    if (!signature) {
      return next(ApiError.forbidden('Missing webhook signature'));
    }

    if (!req.rawBody) {
      return next(ApiError.forbidden('Missing request body'));
    }

    const expected = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const providedBuf = Buffer.from(signature, 'utf8');

    const isValid = expectedBuf.length === providedBuf.length
      && crypto.timingSafeEqual(expectedBuf, providedBuf);

    if (!isValid) {
      return next(ApiError.forbidden('Invalid webhook signature'));
    }

    const rawTimestamp = req.body?.[timestampField];
    if (rawTimestamp !== undefined) {
      const timestampMs = toEpochMs(rawTimestamp);
      if (timestampMs === null || Math.abs(Date.now() - timestampMs) > MAX_TIMESTAMP_AGE_MS) {
        return next(ApiError.forbidden('Webhook timestamp is too old'));
      }
    }

    next();
  };
}

module.exports = { verifyWebhookSignature };
