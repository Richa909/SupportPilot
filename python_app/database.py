"""
database.py - SQLite Database setup, schemas, and seeding
Authoritative data storage for RetailAI customer support prototype.
Part of Hack4Hack Online Retailer Support Agent
"""

import sqlite3
import datetime
from typing import List, Dict, Any, Optional

DB_FILE = "support_store.db"

def get_connection():
    """Return a connection to the SQLite database with dictionary-like row access and WAL mode."""
    conn = sqlite3.connect(DB_FILE, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn

def init_db(force_reseed: bool = False):
    """Initialize database tables, ensure column migrations, and seed sample orders."""
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Orders table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        order_id TEXT PRIMARY KEY,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        item_name TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'INR',
        shipping_status TEXT NOT NULL,
        carrier TEXT NOT NULL,
        tracking_number TEXT NOT NULL,
        order_date TEXT NOT NULL,
        delivery_date TEXT,
        is_return_eligible INTEGER DEFAULT 1,
        return_status TEXT DEFAULT 'None', -- 'None', 'Return Requested', 'Return Received'
        refund_status TEXT DEFAULT 'None'  -- 'None', 'Pending Review', 'Refunded', 'Declined'
    )
    """)

    # Ensure return_status column exists if migrating existing table
    cursor.execute("PRAGMA table_info(orders)")
    order_cols = [col[1] for col in cursor.fetchall()]
    if "return_status" not in order_cols:
        cursor.execute("ALTER TABLE orders ADD COLUMN return_status TEXT DEFAULT 'None'")

    # 2. Support cases table (Escalations for human supervisor review)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cases (
        case_id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        issue_type TEXT NOT NULL,
        summary TEXT NOT NULL,
        customer_message TEXT NOT NULL,
        status TEXT DEFAULT 'Awaiting Review', -- 'Awaiting Review', 'Info Requested', 'Approved', 'Declined', 'Completed'
        policy_rule TEXT NOT NULL DEFAULT 'GENERAL_POLICY',
        recommended_action TEXT NOT NULL DEFAULT 'Supervisor review required',
        previous_actions TEXT NOT NULL DEFAULT '[]',
        supervisor_notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)

    # Ensure added columns exist in cases
    cursor.execute("PRAGMA table_info(cases)")
    case_cols = [col[1] for col in cursor.fetchall()]
    if "policy_rule" not in case_cols:
        cursor.execute("ALTER TABLE cases ADD COLUMN policy_rule TEXT NOT NULL DEFAULT 'GENERAL_POLICY'")
    if "recommended_action" not in case_cols:
        cursor.execute("ALTER TABLE cases ADD COLUMN recommended_action TEXT NOT NULL DEFAULT 'Supervisor review required'")
    if "previous_actions" not in case_cols:
        cursor.execute("ALTER TABLE cases ADD COLUMN previous_actions TEXT NOT NULL DEFAULT '[]'")

    # 3. Returns table (Separated from Refunds)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS returns (
        return_id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        item_name TEXT NOT NULL,
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Return Created', -- 'Return Created', 'Label Generated', 'Item Received', 'Completed'
        tracking_number TEXT NOT NULL,
        created_at TEXT NOT NULL
    )
    """)

    # 4. Refunds table (Separated from Returns)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS refunds (
        refund_id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'INR',
        reason TEXT NOT NULL,
        authorized_by TEXT NOT NULL, -- 'AUTO_POLICY_SYSTEM', 'SUPERVISOR'
        status TEXT NOT NULL DEFAULT 'Processed',
        created_at TEXT NOT NULL
    )
    """)

    # 5. Action audit log table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS action_logs (
        log_id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        action_type TEXT NOT NULL, -- 'LOOKUP', 'POLICY_CHECK', 'AUTO_REFUND', 'CREATE_RETURN', 'ESCALATION', 'SUPERVISOR_ACTION', 'RESOLVED_QUERY'
        case_id INTEGER,
        order_id TEXT,
        tool_name TEXT,
        input_params TEXT,
        details TEXT NOT NULL,
        result TEXT NOT NULL,
        decision TEXT,
        status TEXT NOT NULL -- 'SUCCESS', 'BLOCKED', 'ESCALATED', 'PENDING_REVIEW', 'NOT_FOUND', 'FAILED'
    )
    """)

    cursor.execute("PRAGMA table_info(action_logs)")
    log_cols = [col[1] for col in cursor.fetchall()]
    if "case_id" not in log_cols:
        cursor.execute("ALTER TABLE action_logs ADD COLUMN case_id INTEGER")
    if "tool_name" not in log_cols:
        cursor.execute("ALTER TABLE action_logs ADD COLUMN tool_name TEXT")
    if "input_params" not in log_cols:
        cursor.execute("ALTER TABLE action_logs ADD COLUMN input_params TEXT")
    if "decision" not in log_cols:
        cursor.execute("ALTER TABLE action_logs ADD COLUMN decision TEXT")

    # 6. Seller config table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS seller_config (
        config_key TEXT PRIMARY KEY,
        config_value TEXT NOT NULL
    )
    """)

    if force_reseed:
        cursor.execute("DELETE FROM orders")
        cursor.execute("DELETE FROM cases")
        cursor.execute("DELETE FROM returns")
        cursor.execute("DELETE FROM refunds")
        cursor.execute("DELETE FROM action_logs")
        cursor.execute("DELETE FROM seller_config")

    cursor.execute("INSERT OR REPLACE INTO seller_config (config_key, config_value) VALUES ('max_auto_refund_limit', '4150.0')")
    cursor.execute("INSERT OR REPLACE INTO seller_config (config_key, config_value) VALUES ('return_window_days', '30')")
    cursor.execute("INSERT OR REPLACE INTO seller_config (config_key, config_value) VALUES ('escalate_damaged_items', '1')")

    cursor.execute("SELECT COUNT(*) FROM orders")
    if cursor.fetchone()[0] == 0:
        now = datetime.datetime.now()
        sample_orders = [
            (
                "ORD-IND-1001", "John Doe", "john.doe@example.com",
                "Wireless Noise-Canceling Headphones", 7469.00, "INR",
                "Delivered", "FastPost", "TRK-98234-IND",
                (now - datetime.timedelta(days=4)).strftime("%Y-%m-%d"),
                (now - datetime.timedelta(days=2)).strftime("%Y-%m-%d"),
                1, "None", "None"
            ),
            (
                "ORD-IND-1002", "Sarah Connor", "sarah.c@example.com",
                "Organic Cotton T-Shirt", 2365.50, "INR",
                "Delivered", "EcoShip", "TRK-88123-IND",
                (now - datetime.timedelta(days=8)).strftime("%Y-%m-%d"),
                (now - datetime.timedelta(days=5)).strftime("%Y-%m-%d"),
                1, "None", "None"
            ),
            (
                "ORD-IND-1003", "Alex Smith", "alex.s@example.com",
                "Ceramic Coffee Mug Set", 2822.00, "INR",
                "Delivered", "SwiftLog", "TRK-77112-IND",
                (now - datetime.timedelta(days=3)).strftime("%Y-%m-%d"),
                (now - datetime.timedelta(days=1)).strftime("%Y-%m-%d"),
                1, "None", "None"
            ),
            (
                "ORD-IND-1004", "Emily Davis", "emily.d@example.com",
                "Leather Weekend Duffel Bag", 12367.00, "INR",
                "Delivered", "LuxExpress", "TRK-66442-IND",
                (now - datetime.timedelta(days=12)).strftime("%Y-%m-%d"),
                (now - datetime.timedelta(days=9)).strftime("%Y-%m-%d"),
                1, "None", "None"
            ),
            (
                "ORD-IND-1005", "Marcus Vance", "marcus.v@example.com",
                "Ergonomic Mechanical Keyboard", 9877.00, "INR",
                "In Transit", "FastPost", "TRK-55331-IND",
                (now - datetime.timedelta(days=2)).strftime("%Y-%m-%d"),
                None,
                0, "None", "None"
            ),
            (
                "ORD-IND-1006", "Maya Lin", "maya.l@example.com",
                "Smart LED Desk Lamp", 3735.00, "INR",
                "Delivered", "SwiftLog", "TRK-44221-IND",
                (now - datetime.timedelta(days=50)).strftime("%Y-%m-%d"),
                (now - datetime.timedelta(days=46)).strftime("%Y-%m-%d"),
                0, "None", "None"
            ),
        ]
        cursor.executemany("""
        INSERT INTO orders (
            order_id, customer_name, customer_email, item_name, amount, currency,
            shipping_status, carrier, tracking_number, order_date, delivery_date,
            is_return_eligible, return_status, refund_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, sample_orders)

        # Initial seed action log
        now_str = now.strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
        INSERT INTO action_logs (timestamp, action_type, order_id, tool_name, details, result, status)
        VALUES (?, 'POLICY_CHECK', 'SYSTEM', 'init_db', 'Store policy engine initialized with ₹4,150.00 auto-refund threshold and 30-day return window', 'Active', 'SUCCESS')
        """, (now_str,))

    conn.commit()
    conn.close()

def get_seller_config() -> Dict[str, Any]:
    """Retrieve current seller configuration."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT config_key, config_value FROM seller_config")
    rows = cursor.fetchall()
    conn.close()
    cfg = {row["config_key"]: row["config_value"] for row in rows}
    return {
        "max_auto_refund_limit": float(cfg.get("max_auto_refund_limit", 4150.0)),
        "return_window_days": int(cfg.get("return_window_days", 30)),
        "escalate_damaged_items": cfg.get("escalate_damaged_items", "1") == "1",
    }

def update_seller_config(key: str, value: Any):
    """Update seller policy setting."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO seller_config (config_key, config_value) VALUES (?, ?)", (key, str(value)))
    conn.commit()
    conn.close()

def reset_all_data():
    """Reset store database to default initial state."""
    init_db(force_reseed=True)

if __name__ == "__main__":
    init_db()
    print("Database initialization and migration verified.")
