# 💰 Personal Finance Manager

A single-user personal finance tracker — FastAPI + SQLAlchemy backend with a React + MUI v5 frontend. Tracks daily credits/debits, recurring subscriptions, AI-powered transaction parsing (Claude), and automatic reminders.

Built to match the ReplyPilot project standard (FastAPI + repositories/services, React + MUI + Redux Toolkit + axios).

## 🚀 Quick Start

### Prerequisites
- Python 3.14+ (`python`)
- Node.js 18+ (`npm`)

### 1. Backend (FastAPI)
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# or: source venv/bin/activate  (macOS/Linux)
pip install -r requirements.txt
copy .env.example .env         # then add your ANTHROPIC_API_KEY
uvicorn app.main:app --host 127.0.0.1 --port 8001
```
Runs on **http://localhost:8001** (health check at `/health`).

Tables are created automatically on startup (SQLite), and the 12 default categories are seeded.

### 2. Frontend (React + Vite)
```bash
cd client
npm install
npm run dev        # runs on http://localhost:5173
```

Open **http://localhost:5173** in your browser. The Vite dev server proxies `/api` → `http://localhost:8001`.

## ⚙️ AI Setup (Optional)
1. Get a **Claude API key** at [console.anthropic.com](https://console.anthropic.com)
2. Add it to `backend/.env`:
   ```
   ANTHROPIC_API_KEY=your-key-here
   ```
3. Restart the backend.

Without a key, AI features degrade gracefully (the AI page shows a setup notice), but basic transaction/subscription/reminder tracking still works.

## 🧭 Features

### 📊 Dashboard
- This month's balance, spent, received, and subscription total
- 14-day spending/income chart (Recharts)
- Spending breakdown by category (donut chart)
- Pending reminders and upcoming subscriptions

### 🏢 Companies (freelance clients)
- Manage the companies you freelance for (industry, contact, notes, active)
- Link transactions and subscriptions to a company
- See which client paid what

### 📈 Profit
- Per-company income, expenses, subscription cost, and profit for any month
- Overall profit = income − all expenses − subscription costs
- Income vs expenses bar chart per company

### 💸 Transactions
- Add credit (income) / debit (expense)
- 12 default categories (auto-seeded)
- Optionally link each transaction to a company/client
- AI auto-categorization indicator
- Delete transactions

### 🔁 Subscriptions
- Track recurring payments with billing cycles (daily, weekly, monthly, yearly)
- Optionally link each subscription to a company
- Pause/activate and delete
- Shows total monthly subscription cost

### 🤖 AI Assistant (Claude)
- **Natural language input**: "spent $45 on groceries yesterday" → auto-parses amount/type/category/date
- **Review-before-save**: AI result previews, then you approve to create the transaction

### 🔔 Reminders
- Background scheduler (every 15 min) generates reminders for upcoming subscription payments and a daily summary
- Dismiss or delete reminders

## 🗂️ Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, lifespan (create tables, seed, scheduler)
│   │   ├── core/config.py       # pydantic-settings (env, DB, AI)
│   │   ├── db/session.py        # SQLite engine + get_db
│   │   ├── models/              # Transaction, Category, Subscription, Reminder
│   │   ├── schemas/             # Pydantic request/response models
│   │   ├── repositories/        # DB access layer
│   │   ├── services/
│   │   │   ├── ai_service.py    # Claude integration (parse + insights)
│   │   │   └── scheduler_service.py  # 15-min reminder thread
│   │   └── api/routes/          # transactions, subscriptions, reminders, ai, dashboard
│   ├── requirements.txt
│   └── data/finance.db          # SQLite (created at runtime)
└── client/
    ├── src/
    │   ├── theme/tokens.js      # --fm-* design tokens (light/dark)
    │   ├── theme/theme.js       # MUI getTheme(mode)
    │   ├── store/               # Redux Toolkit slices
    │   ├── services/api.js      # axios instance
    │   ├── constants/navigation.js
    │   ├── components/          # Layout, StatCard
    │   └── pages/               # Dashboard, Transactions, Subscriptions, AIAssistant, Reminders
    └── vite.config.js
```

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/dashboard/stats` | Dashboard stats (balance, series, categories) |
| GET | `/api/transactions` | List transactions |
| POST | `/api/transactions` | Add transaction |
| DELETE | `/api/transactions/:id` | Delete transaction |
| GET | `/api/subscriptions` | List subscriptions |
| POST | `/api/subscriptions` | Add subscription |
| PATCH | `/api/subscriptions/:id` | Update subscription (pause/activate) |
| DELETE | `/api/subscriptions/:id` | Delete subscription |
| GET | `/api/companies` | List companies/clients |
| POST | `/api/companies` | Add company |
| PATCH | `/api/companies/:id` | Update company |
| DELETE | `/api/companies/:id` | Delete company |
| GET | `/api/companies/summary/profit` | Per-company profit summary |
| GET | `/api/reminders/all` | List reminders |
| GET | `/api/reminders` | Pending/due reminders |
| PATCH | `/api/reminders/:id/status` | Dismiss reminder |
| DELETE | `/api/reminders/:id` | Delete reminder |
| GET | `/api/ai/status` | AI configured status |
| POST | `/api/ai/parse-transaction` | AI: parse natural language → transaction |
| POST | `/api/ai/insights` | AI: spending insights |

## 📝 Notes
- Data is stored locally in `backend/data/finance.db` (SQLite)
- Tables auto-create + categories seed on startup; no Alembic migrations
- The reminder scheduler runs every 15 minutes (idempotent)
- Frontend uses `--fm-*` CSS variables defined in `client/src/theme/tokens.js`
