
# 🚀 Next.js Migration & Expansion Guide

This document outlines the architectural strategy for migrating **ProductScene AI** from a client-side Vite application to a **Next.js (App Router)** framework.

## 🎯 Motivation

1.  **Security**: Move sensitive API calls (Gemini/Veo) to the server-side using **Server Actions**, preventing API key exposure.
2.  **Performance**: Leverage React Server Components (RSC) for faster initial page loads.
3.  **Scalability**: Lay the foundation for User Authentication (Auth.js), Database integration (Prisma/PostgreSQL), and Cloud Storage (AWS S3).
4.  **SEO**: Enable dynamic Open Graph images and better metadata management for shared generated content.

---

## 🏗️ Architecture Shift

| Feature | Current (Vite SPA) | Target (Next.js App Router) |
| :--- | :--- | :--- |
| **Rendering** | Client-Side Rendering (CSR) | Server-Side Rendering (SSR) + CSR |
| **API Logic** | Frontend (`services/geminiService.ts`) | **Server Actions** (`app/actions.ts`) |
| **Secrets** | `VITE_API_KEY` (Exposed in bundle) | `process.env.API_KEY` (Server only) |
| **Storage** | IndexedDB (Browser) | IndexedDB (Cache) + PostgreSQL (Persistent) |
| **Routing** | React Router (if needed) | File-system based routing (`app/page.tsx`) |

---

## 🛠️ Migration Steps

### 1. Initialization

Initialize a new Next.js project alongside the existing repo or in a new branch.

```bash
npx create-next-app@latest product-scene-ai
# Select: TypeScript, Tailwind, ESLint, App Router, No src directory (optional)
```

Install required dependencies from the current project:

```bash
npm install @google/genai react-easy-crop lucide-react idb
```

### 2. Directory Mapping

Restructure the files to fit the Next.js conventions.

| Current File | New Location | Notes |
| :--- | :--- | :--- |
| `index.html` | `app/layout.tsx` | Handle Fonts, Metadata, and global styles here. |
| `App.tsx` | `components/MainApp.tsx` | **Mark as `"use client"`**. This contains the core UI logic. |
| `types.ts` | `types/index.ts` | Shared type definitions. |
| `services/storageService.ts` | `lib/storage.ts` | Ensure `window` checks are added (see below). |
| `services/geminiService.ts` | `app/actions.ts` | **Refactor into Server Actions** (see below). |

### 3. Implementing Server Actions (Crucial)

This is the most critical change. Instead of calling Gemini from the browser, we use a Server Action.

**Create `app/actions.ts`:**

```typescript
'use server'; // This directive ensures code runs ONLY on the server

import { GoogleGenAI } from "@google/genai";

// Securely access environment variables
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateSceneAction(base64Image: string, prompt: string, config: any) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: base64Image.split(',')[1], mimeType: 'image/png' } },
          { text: prompt }
        ]
      },
      // ... pass config
    });
    
    // Return data to the client
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("Server Action Error:", error);
    throw new Error("Failed to generate scene");
  }
}
```

**Update `components/MainApp.tsx`:**

```typescript
'use client'; // Required for any component using useState/useEffect

import { generateSceneAction } from '@/app/actions';

// ... inside your component
const handleGenerate = async () => {
  // Call the server function directly like a standard JS function
  const result = await generateSceneAction(selectedImage, prompt, config);
  // ... handle result
};
```

### 4. Handling Client-Side Storage (IndexedDB)

Next.js performs Server-Side Rendering (SSR). Libraries like `idb` or `indexedDB` APIs do not exist on the server and will crash the app if not handled correctly.

**Update `lib/storage.ts`:**

```typescript
const isBrowser = typeof window !== 'undefined';

const openDB = async () => {
  if (!isBrowser) return null; // Return null during SSR
  // ... existing IndexedDB logic
};
```

In your components, wrap data loading in `useEffect`:

```typescript
useEffect(() => {
  // This only runs in the browser
  loadHistoryFromDB();
}, []);
```

---

## 🔮 Future Enterprise Roadmap

Once migrated to Next.js, implement the following to reach "Enterprise" status:

1.  **Authentication**: Integrate **Auth.js (NextAuth)** or **Clerk**.
    *   *Goal*: Allow users to save their "Brand Kits" and "Gallery" to the cloud.
2.  **Database**: Spin up a **PostgreSQL** instance (e.g., Vercel Postgres, Supabase).
    *   *Goal*: Replace IndexedDB for long-term storage. Sync data across devices.
3.  **Object Storage**: Use **AWS S3** or **Vercel Blob**.
    *   *Goal*: Stop storing Base64 strings in the DB. Upload generated images to S3 and store the URL.
4.  **Rate Limiting**: Use **Vercel KV (Redis)**.
    *   *Goal*: Prevent API abuse by limiting free users to 5 generations/day.

