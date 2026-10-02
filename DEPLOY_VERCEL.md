# Deploy Q-XGB Finance to Vercel

This repository is already arranged as a Vercel Services monorepo:

```text
q-xgb-finance/
├── frontend/   # Next.js
├── backend/    # FastAPI
└── vercel.json
```

## 1. Push to GitHub

```bash
git init
git add .
git commit -m "Build Q-XGB Finance"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

## 2. Import into Vercel

Import the GitHub repository into Vercel without changing the repository root.

Vercel reads `vercel.json` and builds the `frontend` and `backend` services together.

## 3. No database setup

You do not need:

- PostgreSQL
- MySQL
- MongoDB
- Supabase
- Firebase
- Prisma
- SQLite

The app intentionally runs without a database.

## 4. API routing

The same deployment exposes:

```text
https://YOUR-DOMAIN.vercel.app/
https://YOUR-DOMAIN.vercel.app/api/health
https://YOUR-DOMAIN.vercel.app/api/predict
https://YOUR-DOMAIN.vercel.app/api/performance
```

## 5. Demo Mode

The project works immediately without model artifacts.

The backend reports:

```json
{
  "mode": "demo",
  "database": false
}
```

The frontend visibly labels Demo Mode and does not present demo values as research results.

## 6. Real model deployment

To train the actual artifact locally:

```bash
cd backend
python -m venv .venv
# Windows
.venv\\Scripts\\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements-ml.txt
python ml/train_full_pipeline.py
```

The full pipeline saves:

```text
backend/artifacts/xgb_model.joblib
backend/artifacts/logistic_model.joblib
backend/artifacts/meta_model.joblib
backend/artifacts/standard_scaler.joblib
backend/artifacts/quantum_scaler.joblib
backend/artifacts/vqc_weights.npy
backend/artifacts/metadata.json
backend/artifacts/performance.json
```

Remove the corresponding artifact patterns from `.gitignore` before committing trained artifacts if you intentionally want to deploy them with the repository.

## 7. Important Vercel note

The default repository is intentionally deployable without large ML/QML artifacts. Heavy PennyLane/XGBoost inference and trained artifacts can increase Python bundle size and cold-start cost. For a research demo, keep Demo Mode available as a resilience path.
