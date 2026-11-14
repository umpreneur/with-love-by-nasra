CREATE TABLE requests (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  contact_preference TEXT NOT NULL,
  category TEXT NOT NULL,
  product TEXT NOT NULL,
  occasion TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  colors TEXT NOT NULL,
  language TEXT NOT NULL,
  desired_date TEXT,
  wishes TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX requests_created_at_idx ON requests(created_at);
--> statement-breakpoint
CREATE INDEX requests_email_created_idx ON requests(email, created_at);
