import * as Sentry from '@sentry/node';

require('dotenv').config();

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
}
