import type { Database } from "@acme/db";

export type Context = {
  Variables: {
    db: Database;
    // session: Session;
    // teamId: string;
  };
};
