# 📘 Ziya-Voice
Overview

Ziya-Voice is a voice-related service deployed on Vercel, designed to handle voice processing, APIs, and integrations within the Ziya ecosystem.

Tech Stack

Vercel (Hosting & Deployment)

Node.js / Next.js (if applicable — adjust if different)

REST APIs

Environment-based configuration

Project Structure

/api – Serverless API routes

/lib – Shared utilities

/services – Business logic

/config – Environment & configuration

Local Development
1️⃣ Clone Repository
git clone <repo-url>
cd Ziya-Voice

2️⃣ Install Dependencies
npm install

3️⃣ Setup Environment

Create .env.local file based on:

.env.example

4️⃣ Run Locally
npm run dev

Deployment

Automatic deployment via Vercel

main → Production

develop → Preview environment (if configured)

Feature branches generate preview deployments

Branching Rules

No direct push to main

Work on feature/*, bugfix/*

All changes require PR review
