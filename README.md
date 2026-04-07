# LastMinutePrep

Your ReviseHub for Every Exam

A student-driven platform where smart notes turn last-minute prep into confident success.

Hero quote:
"Sapna bada ho ya chhota - LastMinutePrep makes it possible."

## What Is LastMinutePrep?

LastMinutePrep helps students quickly find useful exam notes, revise with PDFs, and learn from community-driven contributions.
It is designed for practical exam preparation with filters, search, likes, comments, and a contributor leaderboard.

## Core Features

- Authentication with profile and dashboard
- PDF notes upload with metadata (subject, branch, year, exam type)
- Smart feed with filtering and sorting
- Keyword search using SQL LIKE
- Direct PDF view and download
- Likes and comments support
- Last Minute Mode for quick revision
- Categories by subject
- Leaderboard with contributor badges
- Admin panel for moderation
- Public Admin Note page with usage guidance

## Tech Stack

- Node.js
- Express.js
- EJS
- SQLite for local development
- Supabase Postgres for production
- Multer (PDF uploads)
- express-session + connect-sqlite3 / connect-pg-simple
- Supabase Storage for production PDF uploads

## Project Structure

- src/ - app, routes, middleware, db setup
- views/ - EJS pages
- public/ - css and js assets
- uploads/ - uploaded PDF files
- data/ - SQLite database and session db


## How Users Can Upload Notes

1. Open Upload page from the top navigation.
2. Fill all required fields:
   - Title
   - Subject
   - Branch
   - Year
   - Exam Type
   - Description (optional)
3. Select a PDF file (only .pdf is accepted).
4. Submit upload.
5. The note appears in the feed and becomes available for PDF view, download, likes, and comments.

## Notes Usage Guidance

These materials are for reference and not a guaranteed pass shortcut.
Use these notes along with your own notes and faculty notes.
Write answers in your own words and elaborate based on concepts.

Read full message at:

- /admin-note

## Data Storage

- Uploaded files: uploads/
- Application DB: data/lastminuteprep.db

## Deploying Live

For Vercel and Supabase deployment steps, see:

- [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md)

Production environment variables typically include:

- SESSION_SECRET
- DATABASE_URL
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_BUCKET

## Contribution

Contributions are welcome.

You can help by:

- Improving UI/UX
- Adding better ranking logic
- Enhancing search relevance
- Reporting bugs and suggesting improvements

Lets make this together.
Best wishes and all the best from admin.


