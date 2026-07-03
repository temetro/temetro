// Request properties populated by our auth middleware.
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        emailVerified: boolean;
      };
      session?: {
        id: string;
        userId: string;
        activeOrganizationId?: string | null;
      };
      organizationId?: string;
      memberRole?: string;
      // Set by the FHIR bearer-auth middleware (machine-to-machine API key)
      // instead of a Better Auth session; used for org scoping + audit.
      fhirKey?: { id: string; name: string };
    }
  }
}

export {};
