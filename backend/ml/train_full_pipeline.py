"""Full offline Q-XGB artifact training pipeline.

This mirrors the research notebook's core implementation:
- GC=F from Yahoo Finance
- 12 engineered features
- next-session binary target
- chronological 70/15/15 split
- StandardScaler + XGBoost
- 4-qubit PennyLane VQC with RY AngleEmbedding + StronglyEntanglingLayers
- Logistic Regression hybrid meta-model trained on validation probabilities
- test metrics + saved artifacts

Run locally, not inside a Vercel request.
"""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
from sklearn.preprocessing import MinMaxScaler, StandardScaler
from xgboost import XGBClassifier

try:
    import pennylane as qml
    from pennylane import numpy as pnp
except Exception as exc:
    raise SystemExit("PennyLane is required. Run: pip install -r requirements-ml.txt") from exc

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
    rs = gain.rolling(14).mean() / (loss.rolling(14).mean() + 1e-9)
    x["RSI"] = 100 - (100 / (1 + rs))
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
    x["Volume_Change"] = x["Volume"].pct_change(1)
    x["HL_Range_Ratio"] = (x["High"] - x["Low"]) / x["Close"]
    x["Target"] = (x["Close"].pct_change(1).shift(-1) > 0).astype(int)
    return x.replace([np.inf, -np.inf], np.nan).dropna()


def metrics(y_true, y_pred, y_prob):
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_true, y_prob)),
    }


def main():
    raw = yf.download("GC=F", start="2018-01-01", progress=False, auto_adjust=False)
    if isinstance(raw.columns, pd.MultiIndex):
        raw.columns = raw.columns.get_level_values(0)
    raw = raw[["Open", "High", "Low", "Close", "Volume"]].ffill().bfill().sort_index()
    data = engineer(raw)

    n = len(data)
    train_end = int(n * 0.70)
    val_end = int(n * 0.85)
    train = data.iloc[:train_end].copy()
    val = data.iloc[train_end:val_end].copy()
    test = data.iloc[val_end:].copy()

    medians = train[FEATURES].median()
    for frame in (train, val, test):
        frame[FEATURES] = frame[FEATURES].replace([np.inf, -np.inf], np.nan).fillna(medians)

    scaler = StandardScaler()
    x_train = scaler.fit_transform(train[FEATURES])
    x_val = scaler.transform(val[FEATURES])
    x_test = scaler.transform(test[FEATURES])

    y_train, y_val, y_test = train.Target.to_numpy(), val.Target.to_numpy(), test.Target.to_numpy()

    lr = LogisticRegression(random_state=42, max_iter=1000)
    xgb = XGBClassifier(random_state=42, eval_metric="logloss")
    lr.fit(x_train, y_train)
    xgb.fit(x_train, y_train)

    lr_val = lr.predict_proba(x_val)[:, 1]
    xgb_val = xgb.predict_proba(x_val)[:, 1]
    lr_test = lr.predict_proba(x_test)[:, 1]
    xgb_test = xgb.predict_proba(x_test)[:, 1]

    # Exact VQC configuration from the research notebook.
    q_scaler = MinMaxScaler(feature_range=(0, np.pi))
    q_train = q_scaler.fit_transform(train[QFEATURES])
    q_val = q_scaler.transform(val[QFEATURES])
    q_test = q_scaler.transform(test[QFEATURES])

    n_qubits = 4
    n_layers = 2
    dev = qml.device("default.qubit", wires=n_qubits)

    @qml.qnode(dev)
    def circuit(weights, x):
        qml.AngleEmbedding(x, wires=range(n_qubits), rotation="Y")
        qml.StronglyEntanglingLayers(weights, wires=range(n_qubits))
        return qml.expval(qml.PauliZ(0))

    shape = qml.StronglyEntanglingLayers.shape(n_layers=n_layers, n_wires=n_qubits)
    pnp.random.seed(42)
    weights = pnp.random.random(size=shape, requires_grad=True)

    def prob(w, x):
        return (circuit(w, x) + 1.0) / 2.0

    def loss(w, xb, yb):
        return sum((prob(w, x) - y) ** 2 for x, y in zip(xb, yb)) / len(xb)

    opt = qml.AdamOptimizer(stepsize=0.05)
    for _epoch in range(5):
        indices = np.arange(len(q_train))
        np.random.seed(_epoch + 42)
        np.random.shuffle(indices)
        shuffled_x = q_train[indices]
        shuffled_y = y_train[indices]
        for start in range(0, min(128, len(shuffled_x)), 32):
            xb = shuffled_x[start:start + 32]
            yb = shuffled_y[start:start + 32]
            weights = opt.step(lambda w: loss(w, xb, yb), weights)

    q_val_prob = np.array([float(prob(weights, x)) for x in q_val])
    q_test_prob = np.array([float(prob(weights, x)) for x in q_test])

    meta = LogisticRegression(random_state=42, fit_intercept=True, max_iter=1000)
    meta.fit(np.column_stack((xgb_val, q_val_prob)), y_val)
    meta_test_prob = meta.predict_proba(np.column_stack((xgb_test, q_test_prob)))[:, 1]

    output = Path(__file__).resolve().parents[1] / "artifacts"
    output.mkdir(parents=True, exist_ok=True)
    joblib.dump(xgb, output / "xgb_model.joblib")
    joblib.dump(lr, output / "logistic_model.joblib")
    joblib.dump(meta, output / "meta_model.joblib")
    joblib.dump(scaler, output / "standard_scaler.joblib")
    joblib.dump(q_scaler, output / "quantum_scaler.joblib")
    np.save(output / "vqc_weights.npy", np.asarray(weights, dtype=float))

    performance = {
        "mode": "artifact",
        "instrument": "GC=F",
        "split": {"train": 0.70, "validation": 0.15, "test": 0.15},
        "models": [
            {"name": "Logistic Regression", **metrics(y_test, (lr_test >= .5).astype(int), lr_test)},
            {"name": "XGBoost", **metrics(y_test, (xgb_test >= .5).astype(int), xgb_test)},
            {"name": "VQC", **metrics(y_test, (q_test_prob >= .5).astype(int), q_test_prob)},
            {"name": "Hybrid", **metrics(y_test, (meta_test_prob >= .5).astype(int), meta_test_prob)},
        ],
    }
    metadata = {
        "instrument": "GC=F",
        "feature_count": len(FEATURES),
        "features": FEATURES,
        "quantum": {
            "available": True,
            "qubits": n_qubits,
            "circuit_depth": n_layers,
            "encoding": "AngleEmbedding",
            "rotation": "Y",
            "entanglement": "StronglyEntanglingLayers",
            "mapped_features": QFEATURES,
            "backend": "default.qubit",
        },
    }
    (output / "performance.json").write_text(json.dumps(performance, indent=2), encoding="utf-8")
    (output / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(output), "performance": performance}, indent=2))


if __name__ == "__main__":
    main()
