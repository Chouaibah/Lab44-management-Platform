# Lab44 Management Platform

A Next.js + Tailwind + Prisma management platform for labs, instructors, and students.

<img width="1920" height="968" alt="lab441" src="https://github.com/user-attachments/assets/2cf85771-b4d3-4288-a224-b3d617d4e428" />
## Key features

- Multi-role app: students, instructors, admin
- VM provisioning and monitoring
- Attendance, announcements, grades, exams
- Prisma ORM with PostgreSQL
- API routes (Next.js App Router)
- Docker-ready for production

## Prerequisites

- Node.js 18+ (or Bun)
- npm or pnpm
- PostgreSQL (or a hosted Postgres) for production
- Docker & docker-compose (optional)

## Environment

Create a `.env` file in the project root. Important variables used by the project:

```
DATABASE_URL=postgresql://user:password@host:5432/dbname
NEXTAUTH_SECRET=your_nextauth_secret
NEXT_PUBLIC_BASE_URL=http://localhost:3000
# other secrets used by your deployment (Guacamole, XCP, etc.)
```

Refer to the code under `src/` and `src/lib` for additional env vars required by specific features.

## Development (no production compile)

To run the app locally in development mode (no production compile step required):

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Useful NPM scripts

- `npm run dev` — start Next.js dev server on port 3000
- `npm run build` — build for production (runs `prisma generate` first)
- `npm run start` — start the standalone production server
- `npm run lint` — run ESLint

Prisma helper scripts:

- `npm run db:push` — push Prisma schema to the database
- `npm run db:generate` — generate Prisma client
- `npm run db:migrate` — run `prisma migrate dev` (development)
- `npm run db:migrate:prod` — run `prisma migrate deploy` (production)
- `npm run db:reset` — reset migrations (destructive)

## Database

This project uses Prisma with PostgreSQL (see `prisma/schema.prisma`). Set `DATABASE_URL` to a Postgres database and run:

```bash
npm run db:generate
npm run db:migrate
```

## Docker

A `Dockerfile` and `docker-compose.yml` are included. For a typical Docker workflow:

```bash
# build image
docker build -t lab44-app .
# (optional) run via docker-compose
docker-compose up --build
```

Production build steps (what the repo does when preparing a standalone server):

- `npm run build` runs `prisma generate` and `next build`, then prepares a standalone folder.
- `npm run start` runs the prepared standalone server.

## Project structure (top-level)

- `src/app` — Next.js App Router pages and API routes
- `src/components` — React components and UI
- `src/lib` — utilities, services, and db helpers
- `prisma/` — Prisma schema and migrations

## Contributing

- Follow existing code style and components
- Run `npm run lint` before committing

## Notes

- The Prisma schema uses `postgresql` provider and expects `DATABASE_URL` env var.
- Many features rely on additional services (Guacamole, XCP-NG, vaults). See `src/lib` for integration points.

## Screeshot 

<img width="5760" height="3240" alt="Ins_VM_Monitor" src="https://github.com/user-attachments/assets/8bcd8bf3-43d4-475f-8da8-192c1b2b7944" />
<img width="4608" height="2592" alt="Ins_Attendece" src="https://github.com/user-attachments/assets/d1a7a64a-4036-4530-8ad9-55a29c300079" />
<img width="4608" height="2592" alt="Stu_VM" src="https://github.com/user-attachments/assets/dbefcea2-6abf-4df4-b92a-93cecd0a7d58" />
<img width="5760" height="3240" alt="Ins_Message" src="https://github.com/user-attachments/assets/78daecae-a629-496a-8df7-7ad4de9ddfb3" />
<img width="4608" height="2592" alt="Ins_Students" src="https://github.com/user-attachments/assets/08f710c1-d7df-4e66-b21a-1f8164c91994" />




## License

all copyrights reserved.
