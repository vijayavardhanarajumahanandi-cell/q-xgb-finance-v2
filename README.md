# Q-XGB Finance

Full-stack Next.js + FastAPI research platform for the Q-XGB Gold-market machine-learning project.

## Stack

- Next.js App Router + React + TypeScript
- Tailwind CSS 4
- Recharts
- Lucide React
- FastAPI + Pydantic
- SQLite for server-side market data and prediction history
- Optional XGBoost / SHAP / PennyLane / yfinance model runtime

## Architecture

```text
Next.js frontend
      |
      | HTTP / JSON
      v
FastAPI backend
      |
      +------ SQLite
      |
      +------ Market data
      |
      +------ XGBoost / VQC / Hybrid artifacts
```

The browser does not connect directly to SQLite.

## Local development

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The database is created automatically at:

```text
backend/data/qxgb_finance.db
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Create `frontend/.env.local` for separate local servers:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api
```

When using the Vercel rewrite configuration, the frontend can use the default `/api` base instead.

## Market data modes

The backend supports two data modes:

### Database-backed demo data

Default behavior. Deterministic market data is generated once and stored in SQLite. Selecting different historical bars produces different indicator values and different demo probabilities.

### Live market data

Install the ML/data dependencies and set:

```text
QXGB_LIVE_DATA=true
```

The backend then attempts to fetch Gold data through `yfinance` and cache it in SQLite.

## Prediction behavior

The prediction request contains the selected market bar:

```json
{
  "instrument": "GC=F",
  "timeframe": "1d",
  "timestamp": "2026-09-26T06:00:00Z"
}
```

FastAPI uses that exact candle plus preceding historical candles to calculate the project's engineered features before inference.

Each prediction is saved in SQLite together with:

- selected market bar
- XGBoost probability
- VQC probability
- Hybrid probability
- confidence
- risk score
- indicators
- SHAP/feature contributions

The Prediction History page now reads from SQLite instead of browser-local prediction storage.

## Important model note

The supplied research training pipeline trains the initial artifact on daily (`1d`) Gold (`GC=F`) data. The database and UI can handle `1h` and `15m` market bars, but timeframe-specific model artifacts should be trained before treating intraday predictions as research-valid.

## API

```text
GET  /api/health
GET  /api/market
GET  /api/market/timestamps
GET  /api/indicators
POST /api/predict
POST /api/explain
GET  /api/predictions/history
GET  /api/predictions/{id}
GET  /api/performance
POST /api/backtest
GET  /api/quantum
GET  /api/models
```

## Real model artifacts

For local model work:

```bash
cd backend
pip install -r requirements-ml.txt
python ml/train_full_pipeline.py
```

This writes trained artifacts under `backend/artifacts/`.

The initial training pipeline uses the project's 12 engineered features, chronological 70/15/15 split, XGBoost, a 4-qubit PennyLane VQC, and a Logistic Regression hybrid meta-model.

## SQLite and Vercel

SQLite is excellent for local development and demonstration. A serverless Vercel deployment does not provide the same durable local filesystem semantics as a traditional persistent server. Keep SQLite for local/demo use unless you later move persistent production storage to a hosted database.

## Project behavior

- No direct browser-to-database connection.
- Prediction timestamps are tied to actual stored market bars.
- The API no longer silently replaces an unavailable prediction with a browser-only demo result.
- Demo/model status is explicitly returned by the backend.
- The application does not claim guaranteed profits or quantum advantage.
