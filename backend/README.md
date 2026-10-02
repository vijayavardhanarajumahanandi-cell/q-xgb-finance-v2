# Q-XGB Finance FastAPI backend

The backend now uses SQLite for server-side market data and prediction history.

## Run locally

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The SQLite database is created automatically at:

```text
data/qxgb_finance.db
```

## Optional live market data

Create `backend/.env` or set the environment variable:

```text
QXGB_LIVE_DATA=true
```

When enabled and `yfinance` is installed, the API fetches market data and caches it in SQLite.

Without live data, deterministic demo market data is stored in SQLite so the UI still has real server-side state and different historical bars produce different feature values and demo probabilities.

## Important model note

The included research training pipeline trains the initial artifact on `1d` Gold (`GC=F`) data. The database/API supports `1d`, `1h`, and `15m` market data, but timeframe-specific model artifacts should be trained before treating intraday predictions as research-valid.

## API examples

```text
GET  /api/health
GET  /api/market?instrument=GC%3DF&timeframe=1d&limit=120
GET  /api/market/timestamps?instrument=GC%3DF&timeframe=1d
POST /api/predict
GET  /api/predictions/history
GET  /api/predictions/{id}
```
