# NFS Backend

A NestJS REST API for the Notary File System — a digital case management platform for notary offices. The API handles authentication, user management, client registration, dossier lifecycle, document templates, and notarial services.

---

## Prerequisites

- Node.js 18 or later
- npm 9 or later
- A PostgreSQL database (local or [Neon](https://neon.tech) serverless Postgres — free tier is sufficient)
- A Gmail account with 2-Factor Authentication enabled (for email delivery)

---

## Getting Started

### 1. Clone and install

```bash
git clone <repository-url> bn_divin
cd bn_divin
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://user:password@host/dbname
JWT_SECRET=<random_strong_secret>
JWT_EXPIRES_IN=7d
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=<your_gmail_address>
MAIL_PASS=<16_char_google_app_password>
MAIL_FROM="NFS System <your@gmail.com>"
FRONTEND_URL=http://localhost:3000
```

See the [Environment Variables](#environment-variables) section for details on each variable.

### 3. Run in development

```bash
npm run start:dev
```

The API will be available at [http://localhost:3001](http://localhost:3001).  
Swagger documentation: [http://localhost:3001/api/docs](http://localhost:3001/api/docs).

### 4. Build and run in production

```bash
npm run build
npm run start:prod
```

### 5. Seed the database (optional)

The seed script creates an initial administrator account:

```bash
npm run seed
```

---

## Project Structure

```text
bn_divin/src/
├── auth/                  # JWT authentication, login, password reset, invitation flow
├── users/                 # User CRUD, roles, invitation management, account enable/disable
├── clients/               # Client registration (name, national ID, phone, photo URL)
├── dossiers/              # Dossier creation, status transitions, document attachments, notes
├── notary-services/       # Notarial service types and their official fees
├── template-categories/   # Categories that group document templates
├── document-templates/    # HTML templates with structured field definitions
├── mail/                  # Nodemailer wrapper for transactional emails
├── database/              # TypeORM DataSource configuration and seed script
└── main.ts                # Bootstrap: CORS, validation pipe, Swagger setup
```

---

## API Overview

| Module | Base Path | Description |
| --- | --- | --- |
| Auth | `/auth` | Login, forgot password, reset password, accept invitation |
| Users | `/users` | List, invite, enable/disable user accounts |
| Clients | `/clients` | Register and retrieve clients |
| Dossiers | `/dossiers` | Full dossier lifecycle: create, update status, attach documents |
| Notary Services | `/notary-services` | Service type definitions with official fees |
| Template Categories | `/template-categories` | Category groupings for document templates |
| Document Templates | `/document-templates` | HTML templates with field schemas |

Full request/response schemas are available in Swagger at `http://localhost:3001/api/docs`.

---

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | Port the server listens on. Defaults to `3001` |
| `NODE_ENV` | Yes | `development` or `production`. Controls TypeORM sync behavior |
| `DATABASE_URL` | Yes | Full PostgreSQL connection string. Supports Neon `?sslmode=require` |
| `JWT_SECRET` | Yes | Secret used to sign JWT tokens. Use a long random string |
| `JWT_EXPIRES_IN` | Yes | Token lifetime. Example: `7d`, `24h` |
| `MAIL_HOST` | Yes | SMTP host. Use `smtp.gmail.com` for Gmail |
| `MAIL_PORT` | Yes | SMTP port. Use `587` for Gmail STARTTLS |
| `MAIL_USER` | Yes | Gmail address used as the sending account |
| `MAIL_PASS` | Yes | 16-character Google App Password (not your Gmail login password) |
| `MAIL_FROM` | Yes | Display name and address in the `From` header. Example: `"NFS System <noreply@gmail.com>"` |
| `FRONTEND_URL` | Yes | Base URL of the frontend. Used to construct links in emails. Example: `http://localhost:3000` |

---

## Authentication Flow

### Login

1. Client sends `POST /auth/login` with `{ email, password }`.
2. Server validates credentials, signs a JWT, and returns `{ access_token, user }`.
3. The client stores the token and attaches it as `Authorization: Bearer <token>` on subsequent requests.
4. Protected routes use a JWT Guard that verifies the token and attaches the user to the request.

### Invitation-Based Registration

Notary accounts are not self-registered. The flow is:

1. An administrator calls `POST /users/invite` with the new user's email and role.
2. The server creates a user record with a hashed invitation token and sends an email containing a link to `<FRONTEND_URL>/accept-invitation?token=<raw_token>`.
3. The recipient opens the link and submits their name and chosen password via the frontend.
4. The frontend calls `POST /auth/accept-invitation` with the token and new credentials.
5. The server verifies the token, hashes the password, activates the account, and returns a JWT.

### Forgot / Reset Password

1. User submits their email to `POST /auth/forgot-password`.
2. Server generates a time-limited reset token, stores a hash, and emails a reset link.
3. User follows the link and submits a new password to `POST /auth/reset-password`.

---

## Role Permissions

| Action | Administrator | Notary Public |
| --- | --- | --- |
| Invite users | Yes | No |
| Enable / disable user accounts | Yes | No |
| View all users | Yes | No |
| Define notarial services and fees | Yes | No |
| Create / edit template categories | Yes | No |
| Create / edit document templates | Yes | No |
| Register clients | Yes | Yes |
| View clients | All clients | Own clients only |
| Create dossiers | Yes | Yes |
| View dossiers | All dossiers | Own dossiers only |
| Change dossier status | Yes | Yes |
| Assign notary to dossier | Yes | No |
| Upload documents to dossier | Yes | Yes |
| Archive dossiers | Yes | Yes |

Role values as stored in the database:

| Display Name | Enum Value |
| --- | --- |
| Administrator | `administrator` |
| Notary Public | `notary_public` |

---

## Database

The application uses TypeORM with PostgreSQL. The recommended hosted option is [Neon](https://neon.tech), which provides serverless Postgres with a free tier.

### Connection

Set `DATABASE_URL` to a standard PostgreSQL connection string:

```text
postgresql://user:password@host/dbname?sslmode=require
```

Neon connection strings are available from the Neon dashboard under the project's connection details.

### Schema Synchronization

When `NODE_ENV=development`, TypeORM `synchronize: true` is enabled. This automatically alters the database schema to match entity definitions on every startup — suitable for development, **not for production**.

In production, set `NODE_ENV=production` to disable synchronization and use manual migrations instead.

---

## Gmail SMTP Setup

The application uses Gmail SMTP with App Passwords. Standard Gmail password authentication is not supported.

**Steps to obtain an App Password:**

1. Enable 2-Factor Authentication on the Gmail account at [myaccount.google.com/security](https://myaccount.google.com/security).
2. Go to **Security > 2-Step Verification > App passwords**.
3. Select app: **Mail**, device: **Other**, and enter a label (e.g., `NFS`).
4. Google generates a 16-character password. Copy it immediately — it is only shown once.
5. Set `MAIL_PASS` to this 16-character password (without spaces).

---

## Dossier Numbering

Every dossier is assigned an auto-incremented reference number in the format:

```text
NFS-{YEAR}-{SEQUENCE}
```

Examples: `NFS-2026-00001`, `NFS-2026-00042`.

The sequence resets each calendar year. The year is taken from the creation timestamp, and the sequence is zero-padded to five digits.

---

## Fee Structure

Notarial services have a two-tier fee model:

| Fee Component | Set By | Description |
| --- | --- | --- |
| Official fee | Administrator | The regulated, government-mandated fee for the service type (RWF) |
| Notary fee | Notary Public | The notary's own additional charge, set per dossier |
| **Total fee** | Calculated | Official fee + Notary fee |

When creating a dossier, the notary selects a service and enters their fee. The total is derived automatically and stored on the dossier record.

---

## Swagger Documentation

Interactive API documentation is available at:

```text
http://localhost:3001/api/docs
```

All endpoints are grouped by module and include full request/response schemas, required fields, and authentication requirements. Use the **Authorize** button to supply a Bearer token for testing protected endpoints.
