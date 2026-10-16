# Flow Chat

Flow Chat is a real-time messaging application with a modern purple-and-white interface, secure authentication, private and group chats, status updates, media attachments, and mobile-first navigation.

## Tech stack

- Frontend: React + Vite
- Backend: Node.js + Express + Socket.IO
- Database: PostgreSQL (with Docker Compose for local development)
- Auth: bcrypt + JWT + email verification flow
- Media: S3-compatible storage (config required in production)
- Deployment: Docker and production deployment notes included

## Local development

1. Copy backend/.env.example to backend/.env and update values.
2. Start PostgreSQL locally using Docker Compose:
   - docker compose up -d postgres
3. Start the backend:
   - cd backend && npm install && npm run dev
4. Start the frontend:
   - cd frontend && npm install && npm run dev
5. Open http://localhost:5173

## Production deployment

- Frontend can be deployed to Vercel or Netlify.
- Backend can be deployed to Render, Railway, Heroku, or a VPS.
- PostgreSQL should be managed by a hosted service.
- Media uploads require an S3-compatible bucket and credentials.
- Email verification requires an email provider such as SendGrid or Mailgun.

## Key requirements still needing external configuration

- PostgreSQL connection string and credentials
- S3-compatible storage bucket and credentials for media uploads
- Email provider API key for verification and recovery emails
- AI API keys are intentionally not included because AI was removed from the specification

## Project structure

- backend/ — Express API, auth routes, Socket.IO, DB schema, validation, and environment config
- frontend/ — React app with responsive purple/white messaging UI
- docker-compose.yml — local PostgreSQL setup for development

## Security note

Do not commit real secrets or production credentials. Use local environment files only and keep keys out of source control.
