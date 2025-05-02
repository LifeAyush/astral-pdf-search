# 📄 PDF Search Application

A full-stack web application to search, preview, and print relevant pages from publicly available PDFs. Built with **Next.js**, **React**, **TypeScript**, **Tailwind CSS**, and **Supabase**. Utilizes **Google Custom Search API** for external indexing and **pdf.js / pdf-lib** for client-side PDF processing.

---

## 🔍 Features

- 🔎 **Search PDFs** using Google Custom Search API (CSE)
- 🧠 **Identify relevant pages** from each PDF using keyword-based content scanning
- 🖼️ **Preview first page** of each PDF result (rendered via `pdf.js`)
- 🖨️ **Print selected pages** from identified PDFs using `pdf-lib`
- ⚡ **Real-time search updates** with streaming API support
- 🕓 **Persistent search history** saved to Supabase PostgreSQL
- 🌐 **Environment-agnostic** deployment (local dev, Vercel-ready)

---

## 🧱 Tech Stack

| Layer        | Stack                                                  |
|--------------|--------------------------------------------------------|
| Frontend     | Next.js (App Router), React 18, Tailwind CSS, TypeScript |
| Backend API  | Next.js API Routes                                     |
| Database     | Supabase (PostgreSQL)                                  |
| PDF Engine   | [pdf.js](https://mozilla.github.io/pdf.js/), [pdf-lib](https://pdf-lib.js.org/) |
| Search API   | Google Programmable Search Engine                      |
| Hosting      | Vercel (or self-hosted)                                |

---

## ⚙️ Prerequisites

1. **Supabase Account** – [Create Supabase Project](https://app.supabase.com/)
2. **Google CSE Key** – [Setup Programmable Search Engine](https://programmablesearchengine.google.com/)
3. *(Optional)* **Vercel Account** – for zero-config deployment

---

## 🚀 Getting Started

### 1. Clone Repository

```bash
git clone <repository-url>
cd pdf-search
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or
bun install
```

### 3. Configure Environment Variables

Copy and edit `.env.local`:

```bash
cp .env.example .env.local
```

| Variable                     | Description                               |
|-----------------------------|-------------------------------------------|
| NEXT_PUBLIC_SUPABASE_URL    | Supabase project URL                      |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase public anon key                 |
| SUPABASE_SERVICE_ROLE_KEY   | Supabase server-side secret key (API use) |
| GOOGLE_CSE_ID               | Google Programmable Search Engine ID      |
| GOOGLE_API_KEY              | Google API Key with Search API enabled    |

---

### 4. Initialize Supabase Schema

Use Supabase SQL Editor and run:

```sql
-- scripts/create-tables.sql
CREATE TABLE searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE search_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID REFERENCES searches(id),
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  total_pages INTEGER,
  relevant_pages JSONB,
  preview_image_url TEXT,
  cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

> ✅ Enable **Row-Level Security** and create appropriate policies for read/write access using the service role key only.

---

### 5. Run the Development Server

```bash
npm run dev
# or
yarn dev
# or
bun dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## 🧩 API Routes

| Endpoint               | Method | Description                                  |
|------------------------|--------|----------------------------------------------|
| `/api/search`          | POST   | Trigger Google CSE with user query           |
| `/api/history`         | GET    | Retrieve user search history                 |
| `/api/results/[id]`    | GET    | Fetch results for a specific search ID       |
| `/api/pdf-preview`     | GET    | Render preview of PDF’s first page           |
| `/api/print`           | POST   | Return a trimmed PDF with selected pages     |

---

## 🛠 PDF Handling Logic

- **Parsing**: PDFs fetched as blob streams, rendered via `pdf.js`
- **Keyword Mapping**: Regex-based scanning in browser
- **Preview**: Rendered to `<canvas>` as thumbnail
- **Print**: Recompiled PDF using selected pages via `pdf-lib`

---

## 📊 Database Overview

### Table: `searches`

| Column      | Type      | Notes                      |
|-------------|-----------|----------------------------|
| id          | UUID      | Primary key                |
| query       | TEXT      | Search string              |
| created_at  | TIMESTAMP | Auto-generated             |

### Table: `search_results`

| Column            | Type      | Notes                                |
|-------------------|-----------|--------------------------------------|
| id                | UUID      | Primary key                          |
| search_id         | UUID      | Foreign key referencing `searches.id`|
| url               | TEXT      | Direct PDF URL                       |
| title             | TEXT      | PDF title                            |
| description       | TEXT      | Snippet or abstract                  |
| total_pages       | INTEGER   | Page count from `pdf.js`             |
| relevant_pages    | JSONB     | List of relevant page indices        |
| preview_image_url | TEXT      | Optional CDN link for preview        |
| cached_at         | TIMESTAMP | Result cache timestamp               |

---

## 🧪 Future Enhancements

- 🔍 **Semantic Search**: Use OpenAI or Pinecone for vector similarity
- 🔐 **User Accounts**: Supabase Auth + OAuth support
- 🧾 **OCR Support**: Tesseract.js for scanned documents
- 🧷 **Batch Print/Download**: Combine or zip multiple PDFs
- 📤 **Export**: Pages/annotations to `.md`, `.txt`, `.csv`
- 📈 **Analytics Dashboard**: Built with Supabase

---

## 🚀 Deployment (Vercel)

1. Push code to GitHub
2. Import repository in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy 🎉

---

## 🔐 Security

- Supabase access is scoped through the **service-role** key for backend API usage only
- **Row-Level Security (RLS)** enforces isolation and safety
- PDF parsing and printing is **client-side only** to reduce server cost and enhance privacy

---x

## 📦 Limitations

- Only **public PDFs indexed by Google** are accessible
- No support for **encrypted/password-protected PDFs**
- No content **deduplication** logic implemented yet

---

## 🧮 TODO

- ✅ Unit tests for page relevance algorithm
- ✅ Supabase function for deduplication
- ✅ Rate-limiting middleware for `/api/search`

---

Made with ❤️ using open web tools by ayush.