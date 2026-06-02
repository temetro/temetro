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
    }
  }
}

export {};
