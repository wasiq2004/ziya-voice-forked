# Ziya Voice Agent Dashboard

The **Ziya Voice Agent Dashboard** is a robust, AI-powered platform designed to manage voice agents, automated calling campaigns, and real-time communication analytics. It leverages state-of-the-art AI models for speech recognition, natural language processing, and text-to-speech synthesis to create seamless voice interactions.

## 🚀 Key Features

*   **AI Agent Management**: Create and configure custom voice agents with specific personalities and instructions.
*   **Campaign Management**: Organize and execute outbound calling campaigns.
*   **Real-time Voice Interactions**: Talk to agents directly via the browser or over the phone (Twilio integration).
*   **Advanced Analytics**: Visual dashboards for call metrics, duration, costs, and sentiment analysis.
*   **Multi-LLM Support**: Integrates with Google Gemini, OpenAI GPT-4, and DeepSeek.
*   **High-Quality Voice**: Utilizes ElevenLabs for natural-sounding speech and Sarvam AI/Deepgram for accurate transcription.
*   **Secure Authentication**: Google OAuth and role-based access control (Admin/User).
*   **Wallet & Billing**: Credit management system for usage-based billing.

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 (Vite)
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand, Context API
- **Routing**: React Router v7
- **Visualization**: Recharts

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MySQL (using `mysql2` and connection pooling)
- **Real-time**: WebSocket (`express-ws`)
- **Authentication**: Passport.js (Google OAuth), Express Session (MySQL store)

### AI and Cloud Services
- **Telephony**: Twilio (Programmable Voice)
- **Speech-to-Text (STT)**: Sarvam AI (Primary for calls), Deepgram
- **Text-to-Speech (TTS)**: ElevenLabs
- **LLM**: Google Gemini, OpenAI

## 📋 Prerequisites

Before running the project, ensure you have the following installed/configured:
*   [Node.js](https://nodejs.org/) (v18+ recommended)
*   [MySQL Server](https://dev.mysql.com/downloads/mysql/)
*   A **Twilio** account with a purchased phone number.
*   API keys for:
    *   **OpenAI**
    *   **Google Gemini**
    *   **ElevenLabs**
    *   **Sarvam AI**
    *   **Deepgram** (Optional fallback)
*   **Google Cloud Console** project for OAuth visuals.

## ⚡ Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd ziya-voice-agent-dashboard
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    npm install --legacy-peer-deps # if you encounter version conflicts
    ```

3.  **Database Setup:**
    *   Ensure your MySQL server is running.
    *   The application creates necessary tables automatically on startup (using `mysql2` and initialization scripts).
    *   *Note: Ensure the database specified in your `.env` exists.*

## ⚙️ Configuration

Create a `.env` file in the root directory (or use `.env.local`). A `server/.env` is also supported but root is recommended for unified config.

```env
# Server Configuration
PORT=5000
NODE_ENV=development
APP_URL=https://your-public-url.com  # Must be HTTPS and public (use Ngrok for local dev)
FRONTEND_URL=http://localhost:5173

# Database (MySQL)
MYSQL_HOST=localhost
MYSQL_USER=your_user
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=ziya_voice_db
MYSQL_PORT=3306

# Authentication (Google OAuth)
SESSION_SECRET=your_super_secret_session_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=/api/auth/google/callback

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# AI Service Keys
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
ELEVEN_LABS_API_KEY=...
SARVAM_API_KEY=...
DEEPGRAM_API_KEY=...

# Admin Setup (Optional)
ADMIN_EMAILS=admin@example.com
```

> **Important**: For Twilio callbacks to work, `APP_URL` must be publicly accessible. During development, use tools like [ngrok](https://ngrok.com/) to tunnel your local server (port 5000).

## 🏃‍♂️ Running the Application

### Development Mode
Run both backend and frontend concurrently:
```bash
npm run dev:full
```
*   **Frontend**: http://localhost:5173
*   **Backend**: http://localhost:5000

### Manual Start
**Backend only:**
```bash
npm run server
```

**Frontend only:**
```bash
npm run dev
```

### Production Build
1.  Build the frontend:
    ```bash
    npm run build
    ```
2.  Start the server (ensure it serves the static build if configured, or run separately):
    ```bash
    npm start
    ```

## 📂 Project Structure

```
ziya-voice-agent-dashboard/
├── public/                 # Static assets
├── server/                 # Backend Node.js/Express application
│   ├── config/             # Database & Auth configuration
│   ├── routes/             # API & Voice routes
│   ├── services/           # Business logic (Campaigns, Agents, Twilio, AI handlers)
│   └── server.js           # Entry point
├── src/                    # Frontend React application
│   ├── components/         # Reusable UI components
│   ├── contexts/           # React Context (Auth, Theme)
│   ├── pages/              # Application pages (Dashboard, Campaigns, etc.)
│   ├── services/           # Frontend API services
│   └── App.tsx             # Main component & Routing
└── ...config files
```

## 🤝 Contributing

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

---
© 2026 Ziya Voice. All rights reserved.
