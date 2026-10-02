from __future__ import annotations

import math
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import numpy as np

try:
    import pandas as pd
except Exception:  # pragma: no cover
    pd = None

try:
    import joblib
except Exception:  # pragma: no cover
    joblib = None

try:
    import xgboost  # noqa: F401
except Exception:  # pragma: no cover
    xgboost = None

try:
    import shap
except Exception:  # pragma: no cover
    shap = None

try:
    import pennylane as qml
except Exception:  # pragma: no cover
    qml = None

try:
    import yfinance as yf
except Exception:  # pragma: no cover
    yf = None

from database import market_rows, market_window, save_prediction, upsert_market_rows
from database import normalize_timestamp, DB_PATH

ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "artifacts"

FEATURES = [
    "Daily_Return",
    "Weekly_Return",
    "SMA_Ratio",
    "EMA_Ratio",
    "RSI",
    "MACD",
    "MACD_Signal",
    "ATR_Percent",
    "Rolling_Volatility",
    "BB_Width",
    "Volume_Change",
    "HL_Range_Ratio",
]
CORE_QML_FEATURES = ["RSI", "MACD", "EMA_Ratio", "ATR_Percent"]

SYMBOL_MAP = {
    "XAUUSD": "GC=F",
    "GC=F": "GC=F",
}

TIMEFRAME_INTERVALS = {
    "1d": "1d",
    "1h": "1h",
    "15m": "15m",
}


def _canonical_instrument(instrument: str) -> str:
    return SYMBOL_MAP.get(instrument.upper(), instrument)


class QXGBService:
    def __init__(self) -> None:
        self.model_bundle: dict[str, Any] | None = None
        self._loaded = False

    # ------------------------------------------------------------------
    # Model artifacts
    # ------------------------------------------------------------------
    def _load_artifacts(self) -> None:
        if self._loaded:
            return
        self._loaded = True

        bundle_path = ARTIFACT_DIR / "model_bundle.joblib"
        if joblib and bundle_path.exists():
            try:
                self.model_bundle = joblib.load(bundle_path)
                return
            except Exception:
                self.model_bundle = None

        split_files = [
            "xgb_model.joblib",
            "standard_scaler.joblib",
            "meta_model.joblib",
            "quantum_scaler.joblib",
            "vqc_weights.npy",
        ]
        if joblib and all((ARTIFACT_DIR / name).exists() for name in split_files):
            try:
                self.model_bundle = {
                    "features": FEATURES,
                    "scaler": joblib.load(ARTIFACT_DIR / "standard_scaler.joblib"),
                    "xgb_model": joblib.load(ARTIFACT_DIR / "xgb_model.joblib"),
                    "meta_model": joblib.load(ARTIFACT_DIR / "meta_model.joblib"),
                    "q_scaler": joblib.load(ARTIFACT_DIR / "quantum_scaler.joblib"),
                    "vqc_weights": np.load(ARTIFACT_DIR / "vqc_weights.npy"),
                    "metadata": self._read_json("metadata.json"),
                    "performance": self._read_json("performance.json"),
                }
            except Exception:
                self.model_bundle = None

    @staticmethod
    def _read_json(name: str) -> dict[str, Any]:
        path = ARTIFACT_DIR / name
        if not path.exists():
            return {}
        try:
            import json
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def health(self) -> dict[str, Any]:
        self._load_artifacts()
        return {
            "status": "ok",
            "service": "Q-XGB Finance API",
            "version": "1.1.0",
            "mode": "model" if self.model_bundle else "demo",
            "model_artifacts_loaded": bool(self.model_bundle),
            "xgboost_package": xgboost is not None,
            "shap_package": shap is not None,
            "pennylane_package": qml is not None,
            "yahoo_data_package": yf is not None,
            "database": True,
            "database_path": str(DB_PATH),
            "live_market_data": os.getenv("QXGB_LIVE_DATA", "false").lower() == "true",
        }

    def models(self) -> dict[str, Any]:
        self._load_artifacts()
        metadata = self.model_bundle.get("metadata", {}) if self.model_bundle else {}
        return {
            "mode": "model" if self.model_bundle else "demo",
            "models": [
                {"name": "Logistic Regression", "type": "classical", "available": True},
                {"name": "XGBoost", "type": "classical", "available": bool(self.model_bundle)},
                {"name": "VQC", "type": "quantum", "available": bool(self.model_bundle), "metadata": metadata.get("quantum", {})},
                {"name": "Hybrid", "type": "hybrid", "available": bool(self.model_bundle)},
            ],
            "features": FEATURES,
        }

    def quantum_metadata(self) -> dict[str, Any]:
        self._load_artifacts()
        if self.model_bundle and self.model_bundle.get("metadata", {}).get("quantum"):
            data = dict(self.model_bundle["metadata"]["quantum"])
            data["available"] = True
            return data
        return {
            "available": False,
            "message": "Quantum artifact metadata is not deployed. The application is running in Demo Mode.",
            "architecture": "4-qubit VQC in the research training pipeline; configuration is artifact-driven.",
        }

    # ------------------------------------------------------------------
    # Market data / SQLite cache
    # ------------------------------------------------------------------
    @staticmethod
    def _demo_market(instrument: str, timeframe: str, count: int) -> list[dict[str, Any]]:
        timeframe_delta = {
            "1d": timedelta(days=1),
            "1h": timedelta(hours=1),
            "15m": timedelta(minutes=15),
        }.get(timeframe, timedelta(days=1))

        now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        minutes = 1440 if timeframe == "1d" else (60 if timeframe == "1h" else 15)
        now = now - timedelta(minutes=now.minute % minutes)
        start = now - timeframe_delta * count

        rows: list[dict[str, Any]] = []
        for i in range(count):
            ts = start + timeframe_delta * i
            # Deterministic but non-monotonic demo market so historical bars genuinely
            # produce different technical indicators and demo predictions.
            wave = math.sin(i / 9.0) * 24 + math.sin(i / 23.0) * 12 + math.cos(i / 3.7) * 6
            drift = i * (0.05 if timeframe == "1d" else 0.008)
            close = 2650.0 + drift + wave
            open_price = close - math.sin(i * 1.7) * (3 if timeframe == "1d" else 1.2)
            high = max(open_price, close) + 5 + abs(math.cos(i / 3)) * 3
            low = min(open_price, close) - 5 - abs(math.sin(i / 3)) * 3
            volume = 100000 + abs(math.sin(i / 5.0)) * 90000 + (i % 11) * 700
            rows.append(
                {
                    "timestamp": ts.isoformat().replace("+00:00", "Z"),
                    "open": round(open_price, 4),
                    "high": round(high, 4),
                    "low": round(low, 4),
                    "close": round(close, 4),
                    "volume": round(volume, 2),
                }
            )
            price = close
        return rows

    def _ensure_market_data(self, instrument: str, timeframe: str) -> dict[str, Any]:
        instrument = _canonical_instrument(instrument)
        timeframe = timeframe.lower()
        existing = market_rows(instrument, timeframe, 10)
        live_enabled = os.getenv("QXGB_LIVE_DATA", "false").lower() == "true"

        if live_enabled and yf is not None:
            try:
                interval = TIMEFRAME_INTERVALS.get(timeframe, "1d")
                period = "2y" if interval == "1d" else ("60d" if interval == "1h" else "30d")
                raw = yf.download(
                    instrument,
                    period=period,
                    interval=interval,
                    progress=False,
                    auto_adjust=False,
                )
                if raw is not None and not raw.empty:
                    if hasattr(raw.columns, "levels") and getattr(raw.columns, "nlevels", 1) > 1:
                        raw.columns = raw.columns.get_level_values(0)
                    raw = raw[["Open", "High", "Low", "Close", "Volume"]].dropna()
                    rows: list[dict[str, Any]] = []
                    for idx, row in raw.iterrows():
                        ts = idx.to_pydatetime()
                        if ts.tzinfo is None:
                            ts = ts.replace(tzinfo=timezone.utc)
                        else:
                            ts = ts.astimezone(timezone.utc)
                        rows.append(
                            {
                                "timestamp": ts.isoformat().replace("+00:00", "Z"),
                                "open": float(row["Open"]),
                                "high": float(row["High"]),
                                "low": float(row["Low"]),
                                "close": float(row["Close"]),
                                "volume": float(row["Volume"]),
                            }
                        )
                    upsert_market_rows(instrument, timeframe, rows)
                    return {"mode": "live", "instrument": instrument, "timeframe": timeframe}
            except Exception:
                # Fall through to cached or deterministic data.
                pass

        if not existing:
            count = 720 if timeframe == "1d" else 1200
            rows = self._demo_market(instrument, timeframe, count)
            upsert_market_rows(instrument, timeframe, rows)
            return {"mode": "demo", "instrument": instrument, "timeframe": timeframe}

        return {"mode": "live" if live_enabled else "demo", "instrument": instrument, "timeframe": timeframe}

    def market(self, instrument: str, timeframe: str, limit: int) -> dict[str, Any]:
        info = self._ensure_market_data(instrument, timeframe)
        rows = market_rows(info["instrument"], info["timeframe"], limit)
        return {**info, "data": rows}

    def available_timestamps(self, instrument: str, timeframe: str, limit: int = 60) -> dict[str, Any]:
        info = self._ensure_market_data(instrument, timeframe)
        rows = market_rows(info["instrument"], info["timeframe"], limit)
        return {
            **info,
            "timestamps": [row["timestamp"] for row in reversed(rows)],
        }

    # ------------------------------------------------------------------
    # Feature engineering — mirrors the research training pipeline
    # ------------------------------------------------------------------
    @staticmethod
    def _engineer_frame(rows: list[dict[str, Any]]) -> "pd.DataFrame":
        if pd is None:
            raise RuntimeError("pandas is required for feature engineering")
        frame = pd.DataFrame(rows)
        frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True)
        frame = frame.sort_values("timestamp").reset_index(drop=True)
        for col in ["open", "high", "low", "close", "volume"]:
            frame[col] = pd.to_numeric(frame[col], errors="coerce")

        x = frame.copy()
        x["Daily_Return"] = x["close"].pct_change(1)
        x["Weekly_Return"] = x["close"].pct_change(5)
        x["SMA_Ratio"] = x["close"].rolling(10).mean() / x["close"].rolling(50).mean()
        ema12 = x["close"].ewm(span=12, adjust=False).mean()
        ema26 = x["close"].ewm(span=26, adjust=False).mean()
        x["EMA_Ratio"] = ema12 / ema26
        delta = x["close"].diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        rs = gain.rolling(14).mean() / (loss.rolling(14).mean() + 1e-9)
        x["RSI"] = 100 - (100 / (1 + rs))
        x["MACD"] = ema12 - ema26
        x["MACD_Signal"] = x["MACD"].ewm(span=9, adjust=False).mean()
        tr = pd.concat(
            [
                x["high"] - x["low"],
                (x["high"] - x["close"].shift(1)).abs(),
                (x["low"] - x["close"].shift(1)).abs(),
            ],
            axis=1,
        ).max(axis=1)
        x["ATR_Percent"] = tr.rolling(14).mean() / x["close"]
        x["Rolling_Volatility"] = x["Daily_Return"].rolling(10).std()
        mid = x["close"].rolling(20).mean()
        std = x["close"].rolling(20).std()
        x["BB_Width"] = (4 * std) / mid
        x["Volume_Change"] = x["volume"].pct_change(1)
        x["HL_Range_Ratio"] = (x["high"] - x["low"]) / x["close"]
        x["Momentum"] = x["close"].pct_change(5)
        return x.replace([np.inf, -np.inf], np.nan)

    def _feature_snapshot(
        self, instrument: str, timeframe: str, timestamp: str | None
    ) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, float], dict[str, float], str]:
        info = self._ensure_market_data(instrument, timeframe)
        selected, rows = market_window(info["instrument"], info["timeframe"], timestamp, 140)
        if selected is None:
            raise ValueError(
                f"No market data available for selected timestamp. Choose a timestamp returned by /api/market or /api/market/timestamps."
            )
        if len(rows) < 60:
            raise ValueError("Not enough historical candles to calculate the required 50-period features.")

        engineered = self._engineer_frame(rows)
        ts = normalize_timestamp(selected["timestamp"])
        target = engineered[engineered["timestamp"].map(lambda v: v.isoformat().replace("+00:00", "Z")) == ts]
        if target.empty:
            raise ValueError("Selected market candle could not be aligned with the engineered feature frame.")
        row = target.iloc[-1]

        feature_values: dict[str, float] = {}
        for name in FEATURES:
            value = float(row[name]) if pd.notna(row[name]) else float("nan")
            if math.isfinite(value):
                feature_values[name] = value

        if len(feature_values) != len(FEATURES):
            missing = [name for name in FEATURES if name not in feature_values]
            raise ValueError(f"Selected candle does not have enough historical data for features: {', '.join(missing)}")

        indicators = {
            "RSI": feature_values["RSI"],
            "MACD": feature_values["MACD"],
            "ATR_Percent": feature_values["ATR_Percent"],
            "Momentum": float(row["Momentum"]),
            "Volume_Change": feature_values["Volume_Change"],
            "Rolling_Volatility": feature_values["Rolling_Volatility"],
            "EMA_Ratio": feature_values["EMA_Ratio"],
            "Daily_Return": feature_values["Daily_Return"],
            "Weekly_Return": feature_values["Weekly_Return"],
            "SMA_Ratio": feature_values["SMA_Ratio"],
            "MACD_Signal": feature_values["MACD_Signal"],
            "BB_Width": feature_values["BB_Width"],
            "HL_Range_Ratio": feature_values["HL_Range_Ratio"],
        }
        return selected, rows, feature_values, indicators, info["mode"]

    def indicators(self, instrument: str, timeframe: str, timestamp: str | None = None) -> dict[str, Any]:
        selected, _rows, features, indicators, mode = self._feature_snapshot(instrument, timeframe, timestamp)
        return {
            "mode": mode,
            "instrument": _canonical_instrument(instrument),
            "timeframe": timeframe,
            "timestamp": selected["timestamp"],
            "values": indicators,
            "features": features,
        }

    # ------------------------------------------------------------------
    # Prediction
    # ------------------------------------------------------------------
    @staticmethod
    def _demo_probabilities(features: dict[str, float]) -> tuple[float, float]:
        # Deterministic demo model whose result changes with the selected market row.
        rsi = float(features.get("RSI", 50.0))
        macd = float(features.get("MACD", 0.0))
        ema = float(features.get("EMA_Ratio", 1.0))
        atr = float(features.get("ATR_Percent", 0.01))
        volatility = float(features.get("Rolling_Volatility", 0.01))
        daily_return = float(features.get("Daily_Return", 0.0))
        macd_norm = math.tanh(macd / 12.0)
        ema_signal = math.tanh((ema - 1.0) * 60.0)
        xgb_score = (
            0.50
            + 0.0035 * (rsi - 50)
            + 0.055 * macd_norm
            + 0.055 * ema_signal
            - 1.10 * (atr - 0.004)
            + 0.95 * math.tanh(daily_return * 18.0)
            - 0.12 * math.tanh(volatility * 250.0)
        )
        q_score = (
            0.50
            + 0.0025 * (rsi - 50)
            + 0.045 * macd_norm
            + 0.040 * ema_signal
            - 0.55 * (atr - 0.004)
        )
        return (
            min(0.97, max(0.03, xgb_score)),
            min(0.95, max(0.05, q_score)),
        )

    def _vqc_probability(self, features: dict[str, float], fallback: float) -> float:
        if not self.model_bundle or qml is None or "vqc_weights" not in self.model_bundle or "q_scaler" not in self.model_bundle:
            return fallback
        try:
            q_scaler = self.model_bundle["q_scaler"]
            weights = self.model_bundle["vqc_weights"]
            x = np.array([[float(features[name]) for name in CORE_QML_FEATURES]])
            x_scaled = q_scaler.transform(x)[0]
            metadata = self.model_bundle.get("metadata", {}).get("quantum", {})
            n_qubits = int(metadata.get("qubits", 4))
            dev = qml.device("default.qubit", wires=n_qubits)

            @qml.qnode(dev)
            def circuit(w, values):
                qml.AngleEmbedding(values, wires=range(n_qubits), rotation="Y")
                qml.StronglyEntanglingLayers(w, wires=range(n_qubits))
                return qml.expval(qml.PauliZ(0))

            raw = float(circuit(weights, x_scaled))
            return min(1.0, max(0.0, (raw + 1.0) / 2.0))
        except Exception:
            return fallback

    def _shap_rows(self, features: dict[str, float], hybrid_probability: float) -> list[dict[str, Any]]:
        if self.model_bundle and shap is not None:
            try:
                scaler = self.model_bundle["scaler"]
                xgb_model = self.model_bundle["xgb_model"]
                names = self.model_bundle.get("features", FEATURES)
                row = np.array([[float(features[name]) for name in names]])
                scaled = scaler.transform(row)
                explainer = shap.TreeExplainer(xgb_model)
                values = explainer.shap_values(scaled)
                if isinstance(values, list):
                    values = values[-1]
                values = np.asarray(values)
                if values.ndim == 2:
                    values = values[0]
                rows = []
                for name, value in zip(names, values):
                    rows.append(
                        {
                            "feature": name,
                            "value": round(float(features[name]), 8),
                            "shap_value": round(float(value), 6),
                            "direction": "positive" if value >= 0 else "negative",
                            "importance": round(abs(float(value)), 6),
                        }
                    )
                return sorted(rows, key=lambda item: item["importance"], reverse=True)
            except Exception:
                pass

        drivers = [
            ("RSI", 0.0025 * (features.get("RSI", 50.0) - 50)),
            ("MACD", 0.05 * math.tanh(features.get("MACD", 0.0) * 8)),
            ("EMA_Ratio", 0.45 * (features.get("EMA_Ratio", 1.0) - 1.0)),
            ("ATR_Percent", -0.8 * (features.get("ATR_Percent", 0.01) - 0.012)),
            ("Rolling_Volatility", -0.3 * features.get("Rolling_Volatility", 0.01)),
            ("Volume_Change", 0.05 * math.tanh(features.get("Volume_Change", 0.0))),
        ]
        return [
            {
                "feature": name,
                "value": round(float(features.get(name, 0.0)), 8),
                "shap_value": round(float(value), 6),
                "direction": "positive" if value >= 0 else "negative",
                "importance": round(abs(float(value)), 6),
            }
            for name, value in sorted(drivers, key=lambda x: abs(x[1]), reverse=True)
        ]

    def predict(
        self,
        instrument: str,
        timeframe: str,
        timestamp: str | None,
        features: dict[str, float],
    ) -> dict[str, Any]:
        self._load_artifacts()

        if timestamp or not features:
            selected, _rows, used_features, indicators, data_mode = self._feature_snapshot(instrument, timeframe, timestamp)
            selected_timestamp = selected["timestamp"]
            selected_price = float(selected["close"])
        else:
            used_features = dict(features)
            indicators = dict(features)
            selected_timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            selected_price = None
            data_mode = "manual"

        xgb_p, q_p = self._demo_probabilities(used_features)
        model_warning: str | None = None

        if self.model_bundle:
            if timeframe != "1d":
                model_warning = (
                    "The deployed artifact was trained on 1d data. "
                    "For research-valid intraday inference, train and deploy timeframe-specific artifacts."
                )
            try:
                scaler = self.model_bundle["scaler"]
                xgb_model = self.model_bundle["xgb_model"]
                names = self.model_bundle.get("features", FEATURES)
                row = np.array([[float(used_features.get(name, 0.0)) for name in names]])
                scaled = scaler.transform(row)
                xgb_p = float(xgb_model.predict_proba(scaled)[0, 1])
                q_p = self._vqc_probability(used_features, fallback=q_p)
            except Exception as exc:
                model_warning = f"Trained artifact inference failed; demo probabilities used. {exc}"

        meta_model = self.model_bundle.get("meta_model") if self.model_bundle else None
        if meta_model is not None:
            try:
                hybrid_p = float(meta_model.predict_proba(np.array([[xgb_p, q_p]]))[0, 1])
            except Exception:
                hybrid_p = 0.58 * xgb_p + 0.42 * q_p
        else:
            hybrid_p = 0.58 * xgb_p + 0.42 * q_p

        disagreement = abs(xgb_p - q_p)
        confidence = abs(hybrid_p - 0.5) * 2
        prediction = "UP" if hybrid_p >= 0.5 else "DOWN"
        uncertainty = 1.0 - confidence
        volatility_raw = abs(float(used_features.get("Rolling_Volatility", 0.012)))
        volatility = min(1.0, max(0.0, volatility_raw * 30))
        risk_score = round(min(100.0, max(0.0, 55 * volatility + 25 * uncertainty + 20 * disagreement)))

        shap_rows = self._shap_rows(used_features, hybrid_p)
        mode = "model" if self.model_bundle else "demo"
        prediction_id: int | None = None
        if selected_price is not None:
            prediction_id = save_prediction(
                market_data_id=int(selected["id"]),  # type: ignore[name-defined]
                asset=_canonical_instrument(instrument),
                timeframe=timeframe,
                timestamp=selected_timestamp,
                price=selected_price,
                prediction=prediction,
                confidence=confidence,
                risk_score=risk_score,
                xgb_probability=xgb_p,
                vqc_probability=q_p,
                hybrid_probability=hybrid_p,
                mode=mode,
                indicators=indicators,
                shap_rows=shap_rows,
            )

        return {
            "id": prediction_id,
            "mode": mode,
            "data_mode": data_mode,
            "timestamp": selected_timestamp,
            "instrument": _canonical_instrument(instrument),
            "timeframe": timeframe,
            "price": selected_price,
            "prediction": prediction,
            "confidence": round(confidence, 4),
            "probabilities": {
                "up": round(hybrid_p, 4),
                "down": round(1 - hybrid_p, 4),
            },
            "models": {
                "xgboost": {
                    "prediction": "UP" if xgb_p >= 0.5 else "DOWN",
                    "probability": round(xgb_p, 4),
                    "confidence": round(abs(xgb_p - 0.5) * 2, 4),
                },
                "vqc": {
                    "prediction": "UP" if q_p >= 0.5 else "DOWN",
                    "probability": round(q_p, 4),
                    "confidence": round(abs(q_p - 0.5) * 2, 4),
                    "metadata": self.quantum_metadata(),
                },
                "hybrid": {
                    "prediction": prediction,
                    "probability": round(hybrid_p, 4),
                    "confidence": round(confidence, 4),
                    "weights": {"xgboost": 0.58, "vqc": 0.42} if meta_model is None else None,
                    "meta_model": meta_model is not None,
                },
            },
            "model_disagreement": round(disagreement, 4),
            "risk": {
                "score": risk_score,
                "volatility": round(40 * volatility, 2),
                "prediction_uncertainty": round(40 * uncertainty, 2),
                "model_disagreement": round(20 * disagreement, 2),
                "description": "Composite model-risk indicator. It is not a probability of loss.",
            },
            "features": used_features,
            "indicators": indicators,
            "shap": shap_rows,
            "warning": model_warning,
        }

    def explain(self, instrument: str, timeframe: str, features: dict[str, float], timestamp: str | None = None) -> dict[str, Any]:
        result = self.predict(instrument, timeframe, timestamp, features)
        return {
            "mode": result["mode"],
            "instrument": result["instrument"],
            "timeframe": result["timeframe"],
            "timestamp": result["timestamp"],
            "explanation_type": "feature contribution to model output",
            "features": result["shap"],
            "note": "SHAP contributions describe the model output and are not causal explanations of market movement.",
        }

    def performance(self) -> dict[str, Any]:
        self._load_artifacts()
        if self.model_bundle and self.model_bundle.get("performance"):
            return self.model_bundle["performance"]
        return {
            "mode": "demo",
            "evaluation": "illustrative demo metrics",
            "split": "chronological 70% train / 15% validation / 15% test",
            "models": [
                {"name": "Logistic Regression", "accuracy": 0.52, "precision": 0.53, "recall": 0.49, "f1": 0.51, "roc_auc": 0.54},
                {"name": "XGBoost", "accuracy": 0.57, "precision": 0.58, "recall": 0.54, "f1": 0.56, "roc_auc": 0.59},
                {"name": "VQC", "accuracy": 0.53, "precision": 0.54, "recall": 0.50, "f1": 0.52, "roc_auc": 0.55},
                {"name": "Hybrid", "accuracy": 0.58, "precision": 0.59, "recall": 0.55, "f1": 0.57, "roc_auc": 0.60},
            ],
            "warning": "Demo values. They are not experimental research results.",
        }

    def backtest(self, req: dict[str, Any]) -> dict[str, Any]:
        instrument = _canonical_instrument(req.get("instrument", "GC=F"))
        timeframe = req.get("timeframe", "1d")
        info = self._ensure_market_data(instrument, timeframe)
        rows = market_rows(instrument, timeframe, 180)
        if len(rows) < 30:
            raise ValueError("Not enough market data for backtesting.")
        values = np.array([r["close"] for r in rows], dtype=float)
        rets = np.diff(values) / values[:-1]
        initial_capital = float(req.get("initial_capital", 10000))
        signal = np.where(rets > 0, 1.0, 0.0)
        strategy = rets * signal
        equity = initial_capital * np.cumprod(1 + strategy)
        peak = np.maximum.accumulate(equity)
        drawdown = equity / peak - 1
        total_return = float(equity[-1] / equity[0] - 1)
        max_dd = float(drawdown.min())
        wins = int((strategy > 0).sum())
        losses = int((strategy < 0).sum())
        return {
            "mode": info["mode"],
            "model": req.get("model", "hybrid"),
            "instrument": instrument,
            "timeframe": timeframe,
            "total_return": round(total_return, 4),
            "maximum_drawdown": round(abs(max_dd), 4),
            "number_of_trades": int((signal[1:] != signal[:-1]).sum() + 1),
            "win_rate": round(wins / max(1, wins + losses), 4),
            "profit_factor": round(float(strategy[strategy > 0].sum() / max(1e-9, abs(strategy[strategy < 0].sum()))), 3),
            "sharpe_ratio": round(float(strategy.mean() / (strategy.std() + 1e-9) * math.sqrt(252)), 3),
            "equity_curve": [{"timestamp": rows[i + 1]["timestamp"], "equity": round(float(equity[i]), 2)} for i in range(len(equity))],
            "drawdown_curve": [{"timestamp": rows[i + 1]["timestamp"], "drawdown": round(float(drawdown[i]), 4)} for i in range(len(drawdown))],
            "warning": "Historical simulation only. This backtest is not a forecast and is not evidence of guaranteed future performance.",
        }


model_service = QXGBService()
