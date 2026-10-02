from __future__ import annotations
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

if os.getenv("VERCEL"):
    DB_DIR = Path("/tmp")
elif os.getenv("QXGB_DB_PATH"):
    DB_PATH = Path(os.environ["QXGB_DB_PATH"]).expanduser().resolve()
    DB_DIR = DB_PATH.parent
else:
    DB_DIR = Path(__file__).resolve().parent / "data"

if "DB_PATH" not in globals():
    DB_PATH = DB_DIR / "qxgb_finance.db"

def normalize_timestamp(value: str | datetime) -> str:
    if isinstance(value, datetime):
        dt = value
    else:
        raw = str(value).strip()
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        dt = datetime.fromisoformat(raw)

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt = dt.astimezone(timezone.utc).replace(microsecond=0)
    return dt.isoformat().replace("+00:00", "Z")


def _connect() -> sqlite3.Connection:
    DB_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS market_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asset TEXT NOT NULL,
                timeframe TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                open REAL NOT NULL,
                high REAL NOT NULL,
                low REAL NOT NULL,
                close REAL NOT NULL,
                volume REAL NOT NULL DEFAULT 0,
                UNIQUE(asset, timeframe, timestamp)
            );

            CREATE INDEX IF NOT EXISTS idx_market_lookup
                ON market_data(asset, timeframe, timestamp);

            CREATE TABLE IF NOT EXISTS predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                market_data_id INTEGER,
                asset TEXT NOT NULL,
                timeframe TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                price REAL,
                prediction TEXT NOT NULL,
                confidence REAL NOT NULL,
                risk_score REAL NOT NULL,
                xgb_probability REAL NOT NULL,
                vqc_probability REAL NOT NULL,
                hybrid_probability REAL NOT NULL,
                mode TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(market_data_id) REFERENCES market_data(id) ON DELETE SET NULL
            );

            CREATE INDEX IF NOT EXISTS idx_predictions_time
                ON predictions(asset, timeframe, timestamp DESC);

            CREATE TABLE IF NOT EXISTS indicators (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prediction_id INTEGER,
                market_data_id INTEGER,
                rsi REAL,
                macd REAL,
                atr_percent REAL,
                momentum REAL,
                volume_change REAL,
                rolling_volatility REAL,
                ema_ratio REAL,
                daily_return REAL,
                weekly_return REAL,
                sma_ratio REAL,
                macd_signal REAL,
                bb_width REAL,
                hl_range_ratio REAL,
                FOREIGN KEY(prediction_id) REFERENCES predictions(id) ON DELETE CASCADE,
                FOREIGN KEY(market_data_id) REFERENCES market_data(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS shap_explanations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                prediction_id INTEGER NOT NULL,
                feature TEXT NOT NULL,
                value REAL,
                shap_value REAL,
                direction TEXT,
                importance REAL,
                rank INTEGER,
                FOREIGN KEY(prediction_id) REFERENCES predictions(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_shap_prediction
                ON shap_explanations(prediction_id, rank);
            """
        )


def upsert_market_rows(asset: str, timeframe: str, rows: Iterable[dict[str, Any]]) -> int:
    normalized = []
    for row in rows:
        normalized.append(
            (
                asset,
                timeframe,
                normalize_timestamp(row["timestamp"]),
                float(row["open"]),
                float(row["high"]),
                float(row["low"]),
                float(row["close"]),
                float(row.get("volume", 0) or 0),
            )
        )
    if not normalized:
        return 0

    with _connect() as conn:
        conn.executemany(
            """
            INSERT INTO market_data(asset, timeframe, timestamp, open, high, low, close, volume)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(asset, timeframe, timestamp) DO UPDATE SET
                open=excluded.open,
                high=excluded.high,
                low=excluded.low,
                close=excluded.close,
                volume=excluded.volume
            """,
            normalized,
        )
    return len(normalized)


def market_rows(asset: str, timeframe: str, limit: int = 120) -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT id, asset, timeframe, timestamp, open, high, low, close, volume
            FROM market_data
            WHERE asset = ? AND timeframe = ?
            ORDER BY timestamp DESC
            LIMIT ?
            """,
            (asset, timeframe, int(limit)),
        ).fetchall()
    return [dict(row) for row in reversed(rows)]


def market_window(asset: str, timeframe: str, timestamp: str | None, limit: int = 120) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    with _connect() as conn:
        if timestamp:
            ts = normalize_timestamp(timestamp)
            selected = conn.execute(
                """
                SELECT id, asset, timeframe, timestamp, open, high, low, close, volume
                FROM market_data
                WHERE asset = ? AND timeframe = ? AND timestamp = ?
                LIMIT 1
                """,
                (asset, timeframe, ts),
            ).fetchone()
            if selected is None:
                return None, []
            rows = conn.execute(
                """
                SELECT id, asset, timeframe, timestamp, open, high, low, close, volume
                FROM market_data
                WHERE asset = ? AND timeframe = ? AND timestamp <= ?
                ORDER BY timestamp DESC
                LIMIT ?
                """,
                (asset, timeframe, ts, int(limit)),
            ).fetchall()
        else:
            selected = conn.execute(
                """
                SELECT id, asset, timeframe, timestamp, open, high, low, close, volume
                FROM market_data
                WHERE asset = ? AND timeframe = ?
                ORDER BY timestamp DESC
                LIMIT 1
                """,
                (asset, timeframe),
            ).fetchone()
            if selected is None:
                return None, []
            rows = conn.execute(
                """
                SELECT id, asset, timeframe, timestamp, open, high, low, close, volume
                FROM market_data
                WHERE asset = ? AND timeframe = ? AND timestamp <= ?
                ORDER BY timestamp DESC
                LIMIT ?
                """,
                (asset, timeframe, selected["timestamp"], int(limit)),
            ).fetchall()

    return dict(selected), [dict(row) for row in reversed(rows)]


def save_prediction(
    *,
    market_data_id: int | None,
    asset: str,
    timeframe: str,
    timestamp: str,
    price: float | None,
    prediction: str,
    confidence: float,
    risk_score: float,
    xgb_probability: float,
    vqc_probability: float,
    hybrid_probability: float,
    mode: str,
    indicators: dict[str, float],
    shap_rows: list[dict[str, Any]],
) -> int:
    created_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    with _connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO predictions(
                market_data_id, asset, timeframe, timestamp, price,
                prediction, confidence, risk_score,
                xgb_probability, vqc_probability, hybrid_probability,
                mode, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                market_data_id,
                asset,
                timeframe,
                normalize_timestamp(timestamp),
                price,
                prediction,
                confidence,
                risk_score,
                xgb_probability,
                vqc_probability,
                hybrid_probability,
                mode,
                created_at,
            ),
        )
        prediction_id = int(cur.lastrowid)

        conn.execute(
            """
            INSERT INTO indicators(
                prediction_id, market_data_id, rsi, macd, atr_percent,
                momentum, volume_change, rolling_volatility, ema_ratio,
                daily_return, weekly_return, sma_ratio, macd_signal,
                bb_width, hl_range_ratio
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                prediction_id,
                market_data_id,
                indicators.get("RSI"),
                indicators.get("MACD"),
                indicators.get("ATR_Percent"),
                indicators.get("Momentum"),
                indicators.get("Volume_Change"),
                indicators.get("Rolling_Volatility"),
                indicators.get("EMA_Ratio"),
                indicators.get("Daily_Return"),
                indicators.get("Weekly_Return"),
                indicators.get("SMA_Ratio"),
                indicators.get("MACD_Signal"),
                indicators.get("BB_Width"),
                indicators.get("HL_Range_Ratio"),
            ),
        )

        conn.executemany(
            """
            INSERT INTO shap_explanations(
                prediction_id, feature, value, shap_value, direction, importance, rank
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    prediction_id,
                    row.get("feature", "unknown"),
                    row.get("value"),
                    row.get("shap_value"),
                    row.get("direction"),
                    row.get("importance"),
                    index + 1,
                )
                for index, row in enumerate(shap_rows)
            ],
        )

    return prediction_id


def prediction_history(limit: int = 200) -> list[dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT
                p.id,
                p.created_at,
                p.timestamp,
                p.asset,
                p.timeframe,
                p.prediction,
                p.confidence,
                p.risk_score,
                p.xgb_probability,
                p.vqc_probability,
                p.hybrid_probability,
                p.mode,
                (
                    SELECT s.feature
                    FROM shap_explanations s
                    WHERE s.prediction_id = p.id
                    ORDER BY s.rank ASC
                    LIMIT 1
                ) AS top_driver
            FROM predictions p
            ORDER BY p.created_at DESC
            LIMIT ?
            """,
            (int(limit),),
        ).fetchall()
    return [dict(row) for row in rows]


def get_prediction(prediction_id: int) -> dict[str, Any] | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM predictions WHERE id = ?",
            (int(prediction_id),),
        ).fetchone()
        if row is None:
            return None
        result = dict(row)
        indicator = conn.execute(
            "SELECT * FROM indicators WHERE prediction_id = ? LIMIT 1",
            (int(prediction_id),),
        ).fetchone()
        shap_rows = conn.execute(
            "SELECT feature, value, shap_value, direction, importance, rank FROM shap_explanations WHERE prediction_id = ? ORDER BY rank",
            (int(prediction_id),),
        ).fetchall()
    result["indicator_row"] = dict(indicator) if indicator else None
    result["shap"] = [dict(item) for item in shap_rows]
    return result
