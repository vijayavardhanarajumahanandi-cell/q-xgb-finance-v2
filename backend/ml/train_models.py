"""Train Q-XGB artifacts from the uploaded research pipeline.

This script is intentionally separate from the Vercel request path. Run it locally when
all ML/QML dependencies are installed. The generated model_bundle.joblib can then be
placed in backend/artifacts/ and deployed with the application.
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

FEATURES = [
    "Daily_Return", "Weekly_Return", "SMA_Ratio", "EMA_Ratio", "RSI",
    "MACD", "MACD_Signal", "ATR_Percent", "Rolling_Volatility",
    "BB_Width", "Volume_Change", "HL_Range_Ratio"
]
QFEATURES = ["RSI", "MACD", "EMA_Ratio", "ATR_Percent"]


def engineer(df: pd.DataFrame) -> pd.DataFrame:
    x = df.copy()
    x["Daily_Return"] = x["Close"].pct_change(1)
    x["Weekly_Return"] = x["Close"].pct_change(5)
    x["SMA_Ratio"] = x["Close"].rolling(10).mean() / x["Close"].rolling(50).mean()
    ema12 = x["Close"].ewm(span=12, adjust=False).mean()
    ema26 = x["Close"].ewm(span=26, adjust=False).mean()
    x["EMA_Ratio"] = ema12 / ema26
    delta = x["Close"].diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(14).mean()
    avg_loss = loss.rolling(14).mean()
    rs = avg_gain / (avg_loss + 1e-9)
    x["RSI"] = 100 - 100 / (1 + rs)
    x["MACD"] = ema12 - ema26
    x["MACD_Signal"] = x["MACD"].ewm(span=9, adjust=False).mean()
    tr = pd.concat([
        x["High"] - x["Low"],
        (x["High"] - x["Close"].shift(1)).abs(),
        (x["Low"] - x["Close"].shift(1)).abs(),
    ], axis=1).max(axis=1)
    x["ATR_Percent"] = tr.rolling(14).mean() / x["Close"]
    x["Rolling_Volatility"] = x["Daily_Return"].rolling(10).std()
    mid = x["Close"].rolling(20).mean()
    std = x["Close"].rolling(20).std()
    x["BB_Width"] = (4 * std) / mid
    x["Volume_Change"] = x["Volume"].pct_change()
    x["HL_Range_Ratio"] = (x["High"] - x["Low"]) / x["Close"]
    tomorrow = x["Close"].pct_change().shift(-1)
    x["Target"] = (tomorrow > 0).astype(int)
    return x.replace([np.inf, -np.inf], np.nan).dropna()


def main():
    raw = yf.download("GC=F", start="2018-01-01", progress=False, auto_adjust=False)
    if hasattr(raw.columns, "nlevels") and raw.columns.nlevels > 1:
        raw.columns = raw.columns.get_level_values(0)
    raw = raw[["Open", "High", "Low", "Close", "Volume"]].ffill().bfill().sort_index()
    data = engineer(raw)
    n = len(data)
    train_end, val_end = int(n * 0.70), int(n * 0.85)
    train, val, test = data.iloc[:train_end], data.iloc[train_end:val_end], data.iloc[val_end:]

    train_x = train[FEATURES].copy()
    val_x = val[FEATURES].copy()
    test_x = test[FEATURES].copy()
    medians = train_x.median()
    train_x = train_x.fillna(medians)
    val_x = val_x.fillna(medians)
    test_x = test_x.fillna(medians)

    scaler = StandardScaler()
    x_train = scaler.fit_transform(train_x)
    x_val = scaler.transform(val_x)
    x_test = scaler.transform(test_x)
    y_train, y_val, y_test = train.Target, val.Target, test.Target

    xgb_model = XGBClassifier(random_state=42, eval_metric="logloss")
    xgb_model.fit(x_train, y_train)

    # The VQC training path is intentionally isolated. Install PennyLane and extend this
    # script with the exact notebook weights/circuit before creating a non-demo QML artifact.
    # The deployed service will therefore expose the quantum configuration only when an
    # actual artifact exists rather than manufacturing a result.
    xgb_val = xgb_model.predict_proba(x_val)[:, 1]
    xgb_test = xgb_model.predict_proba(x_test)[:, 1]
    meta = LogisticRegression(random_state=42, max_iter=1000)
    meta_val_input = np.column_stack((xgb_val, np.full_like(xgb_val, 0.5)))
    meta.fit(meta_val_input, y_val)

    out = Path(__file__).resolve().parents[1] / "artifacts"
    out.mkdir(parents=True, exist_ok=True)
    bundle = {
        "features": FEATURES,
        "scaler": scaler,
        "xgb_model": xgb_model,
        "meta_model": meta,
        "metadata": {
            "instrument": "GC=F",
            "feature_count": len(FEATURES),
            "split": {"train": 0.70, "validation": 0.15, "test": 0.15},
            "quantum": {
                "available": False,
                "note": "Attach the trained PennyLane VQC artifact after reproducing the notebook circuit exactly.",
            },
        },
        "performance": {
            "mode": "artifact",
            "test_size": len(test),
        },
    }
    joblib.dump(bundle, out / "model_bundle.joblib")
    (out / "metadata.json").write_text(json.dumps(bundle["metadata"], indent=2), encoding="utf-8")
    print(f"Saved artifacts to {out}")


if __name__ == "__main__":
    main()
