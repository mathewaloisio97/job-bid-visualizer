/**
 * @fileoverview Request authentication abstractions and mock adapters.
 */

import { Request } from 'express';

/**
 * Contracts authentication logic for incoming Express requests.
 */
export interface AuthAdapter {
  /**
   * Authenticates an incoming request and returns system metadata,
   * or `null` if authentication fails.
   */
  authenticate(req: Request): Promise<{ systemId: string; role: string } | null>;
}

/**
 * Development mock adapter verifying static bearer tokens for service-to-service calls.
 */
export class MockAuthAdapter implements AuthAdapter {
  /**
   * Authenticates incoming requests against a static bearer token.
   *
   * @returns Authenticated ERP system context if the token matches, otherwise `null`.
   */
  async authenticate(req: Request) {
    const token = req.headers['authorization'];

    if (token === 'Bearer middleware-secure-token') {
      return { systemId: 'erp-upstream-01', role: 'ingestion_service' };
    }
    return null;
  }
}
