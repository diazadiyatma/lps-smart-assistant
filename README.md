# LPS Smart-Assistant & Intelligent 3T Calculator

**An automated AI-driven financial education platform designed to assist the public in verifying deposit insurance compliance according to Indonesian Deposit Insurance Corporation (LPS) standards.**

---

## 🌟 Executive Summary
Public anxiety surrounding bank health and deposit security can destabilize financial systems. The **LPS Smart-Assistant** mitigates this by providing ordinary citizens with an intuitive, reassuring, and highly intelligent interface to verify the safety of their bank deposits. 

By leveraging automated AI conversational assistants and advanced Document OCR technologies, this platform radically simplifies complex macroeconomic and legal banking jargon into an accessible, interactive digital experience. 

---

## 🚀 Key Features

### 1. Interactive 3T Calculator (Bento Grid Dashboard)
A high-fidelity Next.js interface that allows users to instantly evaluate if their deposit meets the strict 3T criteria (Tercatat, Tepat Bunga, Tidak Merugikan).
- Dynamic modal overlays (Green for *Guaranteed*, Red for *Not Guaranteed*).
- Real-time IDR currency formatting.

### 2. Conversational LPS Smart-Assistant
An asynchronous floating chat widget directly connected to Google's **Gemini 1.5 Flash AI**.
- Acts as the official automated AI representative of LPS.
- Uses polite, clear Indonesian to reassure citizens and guide them seamlessly toward utilizing the calculator.

### 3. Intelligent Bank Book Scanning (OCR)
A dropzone utility allowing users to upload a physical savings book or bank statement.
- Forwards the image to **OCR.space API** for asynchronous parsing.
- Uses advanced internal Regular Expressions (Regex) to extract formatted Account Balances and Interest Rates, automatically populating the form.

### 4. Background Audit Logging
A high-performance database logger that records all query parameters asynchronously into **Supabase (PostgreSQL)** without blocking the user response loop.

---

## 🏗️ Architecture & Technology Stack

The application strictly separates the presentation layer from the business logic layer using a **Monorepo** structure.

### Frontend Layer (`/frontend`)
- **Framework:** Next.js 14 (App Router Architecture)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (Modern, premium glowing aesthetics and dark mode capabilities)
- **Icons & HTTP:** Lucide React & Axios

### Backend Layer (`/backend`)
- **Framework:** Python 3.10 + FastAPI
- **Validation:** Pydantic v2
- **Server:** Uvicorn (ASGI)
- **AI/External APIs:** `httpx` for asynchronous non-blocking requests (Gemini AI, OCR.space)
- **Database:** Supabase Python SDK

### Architectural Workflow
1. Client browser interacts with the React form, chat widget, or file upload components.
2. Data is sent to the FastAPI secure proxy router (`http://localhost:8000/api/v1/...`). *No external API tokens are exposed to the client browser.*
3. FastAPI validates the payload using Pydantic. 
4. The backend communicates asynchronously with external services (Gemini/OCR) or database providers (Supabase).
5. Clean, structured JSON is returned to the Next.js client, dynamically updating the React state and triggering UI animations.

---

## 🛠️ Security & Cloud Readiness
- **Global Exception Middleware:** Intercepts unhandled runtime errors, prevents stack-trace leakage, and formats them into sanitized HTTP 500 JSON responses.
- **Production CORS Configured:** Routes strictly whitelisted.
- **Docker Multi-Stage Build:** Includes an optimized `Dockerfile` leveraging a lightweight Python 3.10 slim-buster environment, drastically reducing cloud memory footprint and image build times on platforms like **Render** or **Railway**.

---

## ⚙️ How to Run Locally

### 1. Clone & Set Environment Variables
Create a `.env` file in the `/backend` directory based on `/backend/.env.example`.

### 2. Run Backend (FastAPI)
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Or .\venv\Scripts\Activate.ps1 on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 3. Run Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```
Visit `http://localhost:3000` to interact with the platform.
