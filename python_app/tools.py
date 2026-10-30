"""
tools.py - Approved Python functions for customer support agent
Enforces business logic, policy rules, strict supervisor security, and audit logging.
Part of Hack4Hack AI Customer Support Prototype
"""

import datetime
import json
import time
from typing import Dict, Any, Optional, List
from database import get_connection, get_seller_config

def log_action(
    action_type: str,
    order_id: Optional[str],
    details: str,
    result: str,
    status: str,
    tool_name: Optional[str] = None,
    input_params: Optional[str] = None,
    decision: Optional[str] = None,
    case_id: Optional[int] = None
) -> int:
    """
    Log each lookup, decision, rule check, action, blocked action, and escalation.
    Records timestamp, type, order ID, tool name, params, result, decision, and status in SQLite.
    """
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
    INSERT INTO action_logs (
        timestamp, action_type, order_id, tool_name, input_params, details, result, decision, status, case_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (now_str, action_type, order_id, tool_name, input_params, details, result, decision, status, case_id))
    conn.commit()
    log_id = cursor.lastrowid
    conn.close()
    return log_id

def lookup_order(order_id: str) -> Dict[str, Any]:
    """
    Look up order and verified tracking information from the database.
    This prevents the LLM from inventing order details.
    """
    if not order_id:
        return {"found": False, "message": "Order ID is missing."}

    order_id = order_id.strip().upper()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM orders WHERE UPPER(order_id) = ?", (order_id,))
    row = cursor.fetchone()
    if not row:
        alt_id = order_id.replace("ORD-", "ORD-IND-") if "IND" not in order_id else order_id.replace("ORD-IND-", "ORD-")
        cursor.execute("SELECT * FROM orders WHERE UPPER(order_id) = ?", (alt_id,))
        row = cursor.fetchone()
    conn.close()

    if not row:
        result = {"found": False, "order_id": order_id, "message": f"Order {order_id} could not be found in the store database."}
        log_action(
            action_type="LOOKUP",
            order_id=order_id,
            tool_name="lookup_order",
            input_params=json.dumps({"order_id": order_id}),
            details=f"Customer query lookup for {order_id}",
            result="Order not found in database",
            decision="NOT_FOUND",
            status="NOT_FOUND"
        )
        return result

    order_data = dict(row)
    result = {
        "found": True,
        "order_id": order_data["order_id"],
        "customer_name": order_data["customer_name"],
        "customer_email": order_data["customer_email"],
        "item_name": order_data["item_name"],
        "amount": float(order_data["amount"]),
        "currency": order_data.get("currency", "INR"),
        "shipping_status": order_data["shipping_status"],
        "carrier": order_data["carrier"],
        "tracking_number": order_data["tracking_number"],
        "order_date": order_data["order_date"],
        "delivery_date": order_data["delivery_date"],
        "is_return_eligible": bool(order_data["is_return_eligible"]),
        "return_status": order_data.get("return_status", "None"),
        "refund_status": order_data["refund_status"]
    }
    log_action(
        action_type="LOOKUP",
        order_id=order_id,
        tool_name="lookup_order",
        input_params=json.dumps({"order_id": order_id}),
        details=f"Order status lookup: {order_data['item_name']} (₹{order_data['amount']:.2f})",
        result=f"Status: {order_data['shipping_status']}, Carrier: {order_data['carrier']}, Tracking: {order_data['tracking_number']}",
        decision="FOUND",
        status="SUCCESS"
    )
    return result

def check_refund_eligibility(order_id: str, reason: str, customer_message: str) -> Dict[str, Any]:
    """
    Evaluates store policy rules for a refund request.
    Returns whether refund is auto-approved, escalated to supervisor, or blocked.
    """
    order_lookup = lookup_order(order_id)
    if not order_lookup["found"]:
        return {
            "status": "error",
            "action": "none",
            "reason": "Order not found in store database",
            "policy_rule": "RULE_ORDER_EXISTS",
            "message": f"Order {order_id} was not found. Please verify the order number."
        }

    order = order_lookup
    config = get_seller_config()
    max_auto_refund = float(config.get("max_auto_refund_limit", 4150.0))
    return_window_days = int(config.get("return_window_days", 30))
    order_amount = order["amount"]
    shipping_status = order["shipping_status"]
    reason_lower = (reason + " " + customer_message).lower()

    # Rule 1: Check if already refunded
    if order["refund_status"] == "Refunded":
        log_action(
            action_type="POLICY_CHECK",
            order_id=order_id,
            tool_name="check_refund_eligibility",
            input_params=json.dumps({"order_id": order_id, "reason": reason}),
            details="Check refund eligibility: duplicate refund check",
            result="Order has already been refunded in full",
            decision="BLOCKED",
            status="BLOCKED"
        )
        return {
            "status": "blocked",
            "action": "none",
            "policy_rule": "RULE_ALREADY_REFUNDED",
            "reason": "Order already refunded",
            "message": f"Order {order_id} has already been refunded in full. Duplicate refund requests are blocked."
        }

    # Rule 2: Order must be delivered (Orders in transit cannot receive refunds)
    if shipping_status != "Delivered":
        log_action(
            action_type="POLICY_CHECK",
            order_id=order_id,
            tool_name="check_refund_eligibility",
            input_params=json.dumps({"order_id": order_id, "shipping_status": shipping_status}),
            details=f"Check refund eligibility: shipping status is '{shipping_status}'",
            result="Refund blocked because order is not delivered",
            decision="BLOCKED",
            status="BLOCKED"
        )
        return {
            "status": "blocked",
            "action": "none",
            "policy_rule": "RULE_NOT_DELIVERED",
            "reason": f"Order shipping status is '{shipping_status}', not delivered",
            "message": f"Order {order_id} cannot be refunded because it is currently {shipping_status}. Items must be delivered before initiating a refund."
        }

    # Rule 3: Damaged or Wrong Item claims MUST be escalated to supervisor
    is_damaged_or_wrong = any(kw in reason_lower for kw in ["damage", "broken", "defective", "crack", "wrong item", "missing item", "shatter"])
    if is_damaged_or_wrong:
        previous_actions = [
            {"step": "lookup_order", "result": f"Found order {order_id} (₹{order_amount:.2f})"},
            {"step": "policy_check", "rule": "RULE_DAMAGED_OR_WRONG_ITEM", "result": "Damaged/incorrect claim requires supervisor photo/claim review"}
        ]
        case_id = escalate_to_supervisor(
            order_id=order_id,
            customer_name=order["customer_name"],
            issue_type="damaged_or_wrong_item",
            policy_rule="RULE_DAMAGED_OR_WRONG_ITEM",
            summary=f"Customer reported damaged/wrong item ({order['item_name']}, ₹{order_amount:.2f}). Reason: {reason}",
            recommended_action="Supervisor inspect customer claim / damage photos and authorize replacement or refund",
            customer_message=customer_message,
            previous_actions=json.dumps(previous_actions)
        )
        log_action(
            action_type="POLICY_CHECK",
            order_id=order_id,
            tool_name="check_refund_eligibility",
            input_params=json.dumps({"order_id": order_id, "reason": reason}),
            details=f"Damaged or incorrect item claim for {order_id}",
            result=f"Escalated to supervisor (Case #{case_id})",
            decision="ESCALATE",
            status="ESCALATED",
            case_id=case_id
        )
        return {
            "status": "escalated",
            "action": "escalate",
            "case_id": case_id,
            "policy_rule": "RULE_DAMAGED_OR_WRONG_ITEM",
            "reason": "Damaged or incorrect item claim requires supervisor review",
            "order": order,
            "message": f"I have escalated your claim for Order {order_id} to our store supervisor (Case #{case_id}). Because this involves a damaged/wrong item claim, a supervisor will review it shortly."
        }

    # Rule 4: Return window check
    delivery_date_str = order.get("delivery_date")
    if delivery_date_str:
        try:
            delivery_date = datetime.datetime.strptime(delivery_date_str, "%Y-%m-%d")
            # Calculate days since delivery (using current date)
            days_since_delivery = (datetime.datetime.now() - delivery_date).days
            if days_since_delivery > return_window_days:
                previous_actions = [
                    {"step": "lookup_order", "result": f"Found order {order_id} (₹{order_amount:.2f})"},
                    {"step": "policy_check", "rule": "RULE_OUTSIDE_RETURN_WINDOW", "result": f"Delivered {days_since_delivery} days ago (> {return_window_days} days limit)"}
                ]
                case_id = escalate_to_supervisor(
                    order_id=order_id,
                    customer_name=order["customer_name"],
                    issue_type="outside_return_window",
                    policy_rule="RULE_OUTSIDE_RETURN_WINDOW",
                    summary=f"Order delivered {days_since_delivery} days ago (exceeds {return_window_days}-day limit). Amount: ₹{order_amount:.2f}",
                    recommended_action="Supervisor review for late return exception or store credit",
                    customer_message=customer_message,
                    previous_actions=json.dumps(previous_actions)
                )
                log_action(
                    action_type="POLICY_CHECK",
                    order_id=order_id,
                    tool_name="check_refund_eligibility",
                    input_params=json.dumps({"order_id": order_id, "days_since_delivery": days_since_delivery}),
                    details=f"Return window exceeded ({days_since_delivery} > {return_window_days} days)",
                    result=f"Escalated to supervisor (Case #{case_id})",
                    decision="ESCALATE",
                    status="ESCALATED",
                    case_id=case_id
                )
                return {
                    "status": "escalated",
                    "action": "escalate",
                    "case_id": case_id,
                    "policy_rule": "RULE_OUTSIDE_RETURN_WINDOW",
                    "reason": f"Delivery was {days_since_delivery} days ago, outside standard {return_window_days}-day window",
                    "order": order,
                    "message": f"Order {order_id} was delivered {days_since_delivery} days ago, which is outside our standard {return_window_days}-day automated window. I have forwarded this to our supervisor (Case #{case_id}) for manual review."
                }
        except ValueError:
            pass

    # Rule 5: Configurable refund threshold (₹4,150 default)
    if order_amount > max_auto_refund:
        previous_actions = [
            {"step": "lookup_order", "result": f"Found order {order_id} (₹{order_amount:.2f})"},
            {"step": "policy_check", "rule": "RULE_OVER_REFUND_LIMIT", "result": f"Amount ₹{order_amount:.2f} exceeds auto-refund threshold of ₹{max_auto_refund:.2f}"}
        ]
        case_id = escalate_to_supervisor(
            order_id=order_id,
            customer_name=order["customer_name"],
            issue_type="over_refund_limit",
            policy_rule="RULE_OVER_REFUND_LIMIT",
            summary=f"Order amount ₹{order_amount:.2f} exceeds auto-refund threshold of ₹{max_auto_refund:.2f} for {order['item_name']}.",
            recommended_action=f"Supervisor review and approve high-value refund of ₹{order_amount:.2f}",
            customer_message=customer_message,
            previous_actions=json.dumps(previous_actions)
        )
        log_action(
            action_type="POLICY_CHECK",
            order_id=order_id,
            tool_name="check_refund_eligibility",
            input_params=json.dumps({"order_id": order_id, "amount": order_amount, "limit": max_auto_refund}),
            details=f"Amount ₹{order_amount:.2f} exceeds auto-refund limit of ₹{max_auto_refund:.2f}",
            result=f"Escalated to supervisor (Case #{case_id})",
            decision="ESCALATE",
            status="ESCALATED",
            case_id=case_id
        )
        return {
            "status": "escalated",
            "action": "escalate",
            "case_id": case_id,
            "policy_rule": "RULE_OVER_REFUND_LIMIT",
            "reason": f"Order total ₹{order_amount:.2f} exceeds automated threshold of ₹{max_auto_refund:.2f}",
            "order": order,
            "message": f"Because your order total of ₹{order_amount:.2f} exceeds our automated refund limit of ₹{max_auto_refund:.2f}, I have forwarded your request to our store supervisor for approval (Case #{case_id})."
        }

    # Rule 6: All criteria met -> Eligible for auto-refund
    log_action(
        action_type="POLICY_CHECK",
        order_id=order_id,
        tool_name="check_refund_eligibility",
        input_params=json.dumps({"order_id": order_id, "amount": order_amount}),
        details=f"Policy check passed for {order_id}: amount ₹{order_amount:.2f} <= limit ₹{max_auto_refund:.2f}",
        result="Eligible for automated refund",
        decision="ELIGIBLE",
        status="SUCCESS"
    )
    return {
        "status": "eligible",
        "action": "auto_refund",
        "policy_rule": "RULE_AUTO_REFUND_ELIGIBLE",
        "amount": order_amount,
        "order": order,
        "reason": f"Eligible for auto-refund: delivered and within limit ₹{max_auto_refund:.2f}"
    }

def process_mock_refund(order_id: str, amount: float, reason: str, authorized_by: str = "AUTO_POLICY_SYSTEM") -> Dict[str, Any]:
    """
    Process mock refund in SQLite database with transaction safety and duplicate prevention.
    Inserts into refunds table and updates orders table.
    """
    order_id = order_id.strip().upper()
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("BEGIN IMMEDIATE TRANSACTION")
        cursor.execute("SELECT refund_status, amount, item_name FROM orders WHERE UPPER(order_id) = ?", (order_id,))
        row = cursor.fetchone()

        if not row:
            conn.rollback()
            conn.close()
            return {"success": False, "message": f"Order {order_id} not found."}

        if row["refund_status"] == "Refunded":
            conn.rollback()
            conn.close()
            log_action(
                action_type="AUTO_REFUND",
                order_id=order_id,
                tool_name="process_mock_refund",
                input_params=json.dumps({"order_id": order_id, "amount": amount}),
                details="Attempted duplicate refund",
                result="Blocked: Order already refunded",
                decision="BLOCKED",
                status="BLOCKED"
            )
            return {"success": False, "message": f"Order {order_id} is already refunded. Duplicate refund prevented."}

        # Generate unique refund ID
        refund_id = f"REF-{int(time.time() * 1000) % 900000 + 100000}"
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Update order refund_status
        cursor.execute("UPDATE orders SET refund_status = 'Refunded' WHERE UPPER(order_id) = ?", (order_id,))

        # Insert record into refunds table
        cursor.execute("""
        INSERT INTO refunds (refund_id, order_id, amount, currency, reason, authorized_by, status, created_at)
        VALUES (?, ?, ?, 'INR', ?, ?, 'Processed', ?)
        """, (refund_id, order_id, amount, reason, authorized_by, now_str))

        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        return {"success": False, "message": f"Refund transaction failed: {str(e)}"}

    conn.close()

    log_action(
        action_type="AUTO_REFUND" if authorized_by == "AUTO_POLICY_SYSTEM" else "SUPERVISOR_ACTION",
        order_id=order_id,
        tool_name="process_mock_refund",
        input_params=json.dumps({"order_id": order_id, "amount": amount, "authorized_by": authorized_by}),
        details=f"Mock refund of ₹{amount:.2f} processed by {authorized_by}. Reason: {reason}",
        result=f"Refund ID: {refund_id}",
        decision="REFUNDED",
        status="SUCCESS"
    )
    return {
        "success": True,
        "refund_id": refund_id,
        "amount": amount,
        "order_id": order_id,
        "status": "Refunded",
        "message": f"Refund {refund_id} for ₹{amount:.2f} has been processed successfully."
    }

def check_return_eligibility(order_id: str, reason: str, customer_message: str) -> Dict[str, Any]:
    """
    Evaluates store policy rules for a return request.
    Distinct from refunds: returns check delivery status and return window.
    """
    order_lookup = lookup_order(order_id)
    if not order_lookup["found"]:
        return {
            "status": "error",
            "action": "none",
            "policy_rule": "RULE_ORDER_EXISTS",
            "message": f"Order {order_id} was not found. Please verify the order number."
        }

    order = order_lookup
    config = get_seller_config()
    return_window_days = int(config.get("return_window_days", 30))
    shipping_status = order["shipping_status"]
    reason_lower = (reason + " " + customer_message).lower()

    # Rule 1: Item must be delivered
    if shipping_status != "Delivered":
        log_action(
            action_type="POLICY_CHECK",
            order_id=order_id,
            tool_name="check_return_eligibility",
            input_params=json.dumps({"order_id": order_id, "shipping_status": shipping_status}),
            details=f"Check return eligibility: status '{shipping_status}'",
            result="Return blocked because order is not delivered",
            decision="BLOCKED",
            status="BLOCKED"
        )
        return {
            "status": "blocked",
            "action": "none",
            "policy_rule": "RULE_NOT_DELIVERED",
            "reason": f"Order shipping status is '{shipping_status}', not delivered",
            "message": f"Order {order_id} cannot be returned because it has not yet been delivered (Status: {shipping_status}). Please wait for package arrival."
        }

    # Rule 2: Damaged item in return request -> escalate to supervisor
    is_damaged = any(kw in reason_lower for kw in ["damage", "broken", "defective", "crack", "wrong item", "missing item"])
    if is_damaged:
        previous_actions = [
            {"step": "lookup_order", "result": f"Found order {order_id}"},
            {"step": "check_return_eligibility", "rule": "RULE_DAMAGED_OR_WRONG_ITEM", "result": "Damaged return requires supervisor claim review"}
        ]
        case_id = escalate_to_supervisor(
            order_id=order_id,
            customer_name=order["customer_name"],
            issue_type="damaged_or_wrong_item",
            policy_rule="RULE_DAMAGED_OR_WRONG_ITEM",
            summary=f"Customer requesting return for damaged/wrong item ({order['item_name']}). Reason: {reason}",
            recommended_action="Supervisor inspect damage claim and issue return label or direct replacement",
            customer_message=customer_message,
            previous_actions=json.dumps(previous_actions)
        )
        return {
            "status": "escalated",
            "action": "escalate",
            "case_id": case_id,
            "policy_rule": "RULE_DAMAGED_OR_WRONG_ITEM",
            "reason": "Damaged item return claim requires supervisor review",
            "order": order,
            "message": f"Because your return for Order {order_id} involves a damaged or incorrect item, I have escalated your case to our supervisor (Case #{case_id}) to review and arrange an exchange or return."
        }

    # Rule 3: Check return window
    delivery_date_str = order.get("delivery_date")
    if delivery_date_str:
        try:
            delivery_date = datetime.datetime.strptime(delivery_date_str, "%Y-%m-%d")
            days_since = (datetime.datetime.now() - delivery_date).days
            if days_since > return_window_days:
                previous_actions = [
                    {"step": "lookup_order", "result": f"Found order {order_id}"},
                    {"step": "check_return_eligibility", "rule": "RULE_OUTSIDE_RETURN_WINDOW", "result": f"Delivered {days_since} days ago (> {return_window_days} days)"}
                ]
                case_id = escalate_to_supervisor(
                    order_id=order_id,
                    customer_name=order["customer_name"],
                    issue_type="outside_return_window",
                    policy_rule="RULE_OUTSIDE_RETURN_WINDOW",
                    summary=f"Return requested {days_since} days after delivery (exceeds {return_window_days}-day policy).",
                    recommended_action="Supervisor review for late return exception",
                    customer_message=customer_message,
                    previous_actions=json.dumps(previous_actions)
                )
                return {
                    "status": "escalated",
                    "action": "escalate",
                    "case_id": case_id,
                    "policy_rule": "RULE_OUTSIDE_RETURN_WINDOW",
                    "reason": f"Delivered {days_since} days ago (> {return_window_days} days)",
                    "order": order,
                    "message": f"Order {order_id} was delivered {days_since} days ago, exceeding our standard {return_window_days}-day return window. I have forwarded this to our supervisor (Case #{case_id}) for review."
                }
        except ValueError:
            pass

    # Rule 4: Eligible for return
    log_action(
        action_type="POLICY_CHECK",
        order_id=order_id,
        tool_name="check_return_eligibility",
        input_params=json.dumps({"order_id": order_id, "reason": reason}),
        details=f"Order {order_id} is eligible for return within window",
        result="Eligible for return",
        decision="ELIGIBLE",
        status="SUCCESS"
    )
    return {
        "status": "eligible",
        "action": "create_return",
        "policy_rule": "RULE_RETURN_ELIGIBLE",
        "order": order,
        "reason": "Delivered and within standard return window"
    }

def create_mock_return(order_id: str, reason: str) -> Dict[str, Any]:
    """
    Creates a mock return request with a return label ID.
    CRITICAL: Does NOT automatically refund the item. Returns and refunds are separate workflows!
    """
    order_id = order_id.strip().upper()
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("BEGIN IMMEDIATE TRANSACTION")
        cursor.execute("SELECT customer_name, item_name, return_status FROM orders WHERE UPPER(order_id) = ?", (order_id,))
        row = cursor.fetchone()

        if not row:
            conn.rollback()
            conn.close()
            return {"success": False, "message": f"Order {order_id} not found."}

        customer_name = row["customer_name"]
        item_name = row["item_name"]

        return_id = f"RET-{int(time.time() * 1000) % 900000 + 100000}"
        tracking_number = f"RET-TRK-{order_id[-4:]}"
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Update order return_status
        cursor.execute("UPDATE orders SET return_status = 'Return Requested' WHERE UPPER(order_id) = ?", (order_id,))

        # Insert into returns table
        cursor.execute("""
        INSERT INTO returns (return_id, order_id, customer_name, item_name, reason, status, tracking_number, created_at)
        VALUES (?, ?, ?, ?, ?, 'Return Created', ?, ?)
        """, (return_id, order_id, customer_name, item_name, reason, tracking_number, now_str))

        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        return {"success": False, "message": f"Return creation failed: {str(e)}"}

    conn.close()

    log_action(
        action_type="CREATE_RETURN",
        order_id=order_id,
        tool_name="create_mock_return",
        input_params=json.dumps({"order_id": order_id, "reason": reason}),
        details=f"Mock return request created for {order_id} ({item_name})",
        result=f"Return ID: {return_id}, Return Tracking: {tracking_number}",
        decision="RETURN_CREATED",
        status="SUCCESS"
    )
    return {
        "success": True,
        "return_id": return_id,
        "tracking_number": tracking_number,
        "order_id": order_id,
        "item_name": item_name,
        "message": f"Return request {return_id} has been created for Order {order_id}. Prepaid return label: {tracking_number}. Please ship the item back within 14 days. Once received and inspected, your refund will be processed."
    }

def escalate_to_supervisor(
    order_id: str,
    customer_name: str,
    issue_type: str,
    policy_rule: str,
    summary: str,
    recommended_action: str,
    customer_message: str,
    previous_actions: str
) -> int:
    """
    Create a case summary and mark it as awaiting human review in SQLite.
    Includes policy rule, recommended action, and attempted previous actions.
    """
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
    INSERT INTO cases (
        order_id, customer_name, issue_type, summary, customer_message, status,
        policy_rule, recommended_action, previous_actions, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'Awaiting Review', ?, ?, ?, ?, ?)
    """, (
        order_id.upper(), customer_name, issue_type, summary, customer_message,
        policy_rule, recommended_action, previous_actions, now_str, now_str
    ))
    conn.commit()
    case_id = cursor.lastrowid
    conn.close()
    return case_id

def supervisor_handle_case(case_id: int, decision: str, notes: str) -> Dict[str, Any]:
    """
    Supervisor decision from retailer dashboard: 'Approve', 'Decline', or 'Request Info'.
    Security verifications before execution:
    - Case exists
    - Case is awaiting review or info requested
    - Order has not already been refunded
    - Policy and order state permit action
    Prevents duplicate approvals and duplicate refunds using SQLite transactions.
    """
    decision_norm = decision.strip().lower()
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("BEGIN IMMEDIATE TRANSACTION")
        cursor.execute("SELECT * FROM cases WHERE case_id = ?", (case_id,))
        case_row = cursor.fetchone()

        if not case_row:
            conn.rollback()
            conn.close()
            return {"success": False, "message": f"Case #{case_id} not found."}

        case = dict(case_row)
        current_status = case["status"]
        order_id = case["order_id"]
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Verify case is actionable (Awaiting Review or Info Requested)
        if current_status in ["Approved", "Declined", "Completed"]:
            conn.rollback()
            conn.close()
            log_action(
                action_type="SUPERVISOR_ACTION",
                order_id=order_id,
                tool_name="supervisor_handle_case",
                input_params=json.dumps({"case_id": case_id, "decision": decision}),
                details=f"Blocked duplicate action on already-resolved Case #{case_id} ({current_status})",
                result="Action rejected: Case is already resolved",
                decision="BLOCKED",
                status="BLOCKED",
                case_id=case_id
            )
            return {
                "success": False,
                "message": f"Case #{case_id} is already marked as '{current_status}'. Duplicate actions are blocked."
            }

        cursor.execute("SELECT * FROM orders WHERE UPPER(order_id) = ?", (order_id.upper(),))
        order_row = cursor.fetchone()
        if not order_row:
            conn.rollback()
            conn.close()
            return {"success": False, "message": f"Associated order {order_id} could not be found."}

        order = dict(order_row)
        amount = float(order["amount"])

        if decision_norm == "approve":
            # Security verification: Order has not already been refunded
            if order["refund_status"] == "Refunded":
                conn.rollback()
                conn.close()
                log_action(
                    action_type="SUPERVISOR_ACTION",
                    order_id=order_id,
                    tool_name="supervisor_handle_case",
                    input_params=json.dumps({"case_id": case_id, "decision": decision}),
                    details=f"Supervisor attempted approval, but Order {order_id} is already refunded",
                    result="Duplicate refund blocked",
                    decision="BLOCKED",
                    status="BLOCKED",
                    case_id=case_id
                )
                return {
                    "success": False,
                    "message": f"Order {order_id} has already been refunded. Duplicate refund approval is prohibited."
                }

            # Update case and order, insert refund record
            refund_id = f"REF-{int(time.time() * 1000) % 900000 + 100000}"
            cursor.execute("""
            UPDATE cases
            SET status = 'Approved', supervisor_notes = ?, updated_at = ?
            WHERE case_id = ?
            """, (notes, now_str, case_id))

            cursor.execute("UPDATE orders SET refund_status = 'Refunded' WHERE UPPER(order_id) = ?", (order_id.upper(),))

            cursor.execute("""
            INSERT INTO refunds (refund_id, order_id, amount, currency, reason, authorized_by, status, created_at)
            VALUES (?, ?, ?, 'INR', ?, 'SUPERVISOR', 'Processed', ?)
            """, (refund_id, order_id.upper(), amount, f"Supervisor approved Case #{case_id}: {notes}", now_str))

            conn.commit()
            conn.close()

            log_action(
                action_type="SUPERVISOR_ACTION",
                order_id=order_id,
                tool_name="supervisor_handle_case",
                input_params=json.dumps({"case_id": case_id, "decision": "Approve", "notes": notes}),
                details=f"Supervisor approved Case #{case_id}. Notes: {notes}",
                result=f"Refund {refund_id} (₹{amount:.2f}) granted",
                decision="APPROVED",
                status="SUCCESS",
                case_id=case_id
            )
            return {
                "success": True,
                "status": "Approved",
                "refund_id": refund_id,
                "amount": amount,
                "message": f"Case #{case_id} approved. Mock refund {refund_id} for ₹{amount:.2f} recorded."
            }

        elif decision_norm == "decline":
            cursor.execute("""
            UPDATE cases
            SET status = 'Declined', supervisor_notes = ?, updated_at = ?
            WHERE case_id = ?
            """, (notes, now_str, case_id))

            cursor.execute("UPDATE orders SET refund_status = 'Declined' WHERE UPPER(order_id) = ?", (order_id.upper(),))
            conn.commit()
            conn.close()

            log_action(
                action_type="SUPERVISOR_ACTION",
                order_id=order_id,
                tool_name="supervisor_handle_case",
                input_params=json.dumps({"case_id": case_id, "decision": "Decline", "notes": notes}),
                details=f"Supervisor declined Case #{case_id}. Reason: {notes}",
                result="Claim declined by supervisor",
                decision="DECLINED",
                status="BLOCKED",
                case_id=case_id
            )
            return {
                "success": True,
                "status": "Declined",
                "message": f"Case #{case_id} declined. Customer will be notified."
            }

        elif decision_norm in ["request info", "request_info", "info requested"]:
            cursor.execute("""
            UPDATE cases
            SET status = 'Info Requested', supervisor_notes = ?, updated_at = ?
            WHERE case_id = ?
            """, (notes, now_str, case_id))
            conn.commit()
            conn.close()

            log_action(
                action_type="SUPERVISOR_ACTION",
                order_id=order_id,
                tool_name="supervisor_handle_case",
                input_params=json.dumps({"case_id": case_id, "decision": "Request Info", "notes": notes}),
                details=f"Supervisor requested info for Case #{case_id}. Request: {notes}",
                result="Case status updated to 'Info Requested'",
                decision="INFO_REQUESTED",
                status="PENDING_REVIEW",
                case_id=case_id
            )
            return {
                "success": True,
                "status": "Info Requested",
                "message": f"Requested more information from customer for Case #{case_id}. Case remains accessible in 'Information Requested' filter."
            }
        else:
            conn.rollback()
            conn.close()
            return {"success": False, "message": f"Invalid supervisor decision '{decision}'."}

    except Exception as e:
        conn.rollback()
        conn.close()
        return {"success": False, "message": f"Supervisor action failed: {str(e)}"}

def reopen_or_update_case(case_id: int, new_status: str = "Awaiting Review", notes: str = "") -> Dict[str, Any]:
    """
    Allow supervisors or customers to reopen or continue a case when information becomes available.
    """
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    cursor.execute("SELECT * FROM cases WHERE case_id = ?", (case_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return {"success": False, "message": f"Case #{case_id} not found."}

    cursor.execute("""
    UPDATE cases
    SET status = ?, supervisor_notes = COALESCE(supervisor_notes, '') || '\n' || ?, updated_at = ?
    WHERE case_id = ?
    """, (new_status, f"[{now_str}] Reopened/Updated: {notes}", now_str, case_id))
    conn.commit()
    conn.close()

    log_action(
        action_type="SUPERVISOR_ACTION",
        order_id=row["order_id"],
        tool_name="reopen_or_update_case",
        input_params=json.dumps({"case_id": case_id, "new_status": new_status, "notes": notes}),
        details=f"Case #{case_id} reopened/updated to '{new_status}'",
        result=f"Status set to {new_status}",
        decision="REOPENED",
        status="SUCCESS",
        case_id=case_id
    )
    return {"success": True, "status": new_status, "message": f"Case #{case_id} updated to {new_status}."}

def get_store_metrics() -> Dict[str, Any]:
    """
    Calculate accurate dashboard analytics directly from SQLite records.
    Separates lookups, returns, auto refunds, supervisor actions, and verified resolutions.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Total customer queries / conversations recorded
    cursor.execute("SELECT COUNT(*) FROM action_logs WHERE action_type IN ('LOOKUP', 'POLICY_CHECK', 'CREATE_RETURN')")
    total_conversations = cursor.fetchone()[0]

    # Successful order lookups
    cursor.execute("SELECT COUNT(*) FROM action_logs WHERE action_type = 'LOOKUP' AND status = 'SUCCESS'")
    successful_lookups = cursor.fetchone()[0]

    # Automatically processed refunds
    cursor.execute("SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM refunds WHERE authorized_by = 'AUTO_POLICY_SYSTEM'")
    auto_refunds_row = cursor.fetchone()
    auto_refunds_count = auto_refunds_row[0]
    auto_refunds_amount = auto_refunds_row[1]

    # Returns created
    cursor.execute("SELECT COUNT(*) FROM returns")
    returns_created = cursor.fetchone()[0]

    # Cases awaiting supervisor review
    cursor.execute("SELECT COUNT(*) FROM cases WHERE status = 'Awaiting Review'")
    awaiting_review = cursor.fetchone()[0]

    # Cases awaiting customer information
    cursor.execute("SELECT COUNT(*) FROM cases WHERE status = 'Info Requested'")
    info_requested = cursor.fetchone()[0]

    # Supervisor approved cases
    cursor.execute("SELECT COUNT(*) FROM cases WHERE status = 'Approved'")
    supervisor_approved = cursor.fetchone()[0]

    # Completed customer resolutions (customer confirmed or case completed)
    cursor.execute("SELECT COUNT(*) FROM action_logs WHERE action_type = 'RESOLVED_QUERY' AND status = 'SUCCESS'")
    completed_resolutions = cursor.fetchone()[0]

    # Blocked actions (duplicate requests, in-transit attempts, etc.)
    cursor.execute("SELECT COUNT(*) FROM action_logs WHERE status = 'BLOCKED'")
    blocked_actions = cursor.fetchone()[0]

    # Total refunds (all sources)
    cursor.execute("SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM refunds")
    total_refund_row = cursor.fetchone()
    total_refunds_count = total_refund_row[0]
    total_refunds_amount = total_refund_row[1]

    conn.close()

    return {
        "total_customer_conversations": max(total_conversations, 1),
        "successful_order_lookups": successful_lookups,
        "auto_processed_refunds": auto_refunds_count,
        "auto_processed_refunds_amount": auto_refunds_amount,
        "return_requests_created": returns_created,
        "cases_awaiting_review": awaiting_review,
        "cases_info_requested": info_requested,
        "supervisor_approved_cases": supervisor_approved,
        "completed_customer_resolutions": completed_resolutions,
        "blocked_actions": blocked_actions,
        "total_refunds_count": total_refunds_count,
        "total_refunds_amount": total_refunds_amount
    }

def get_all_data() -> Dict[str, Any]:
    """Retrieve full database state for frontend synchronization."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM orders ORDER BY order_id ASC")
    orders = [dict(row) for row in cursor.fetchall()]

    cursor.execute("SELECT * FROM cases ORDER BY case_id DESC")
    cases = [dict(row) for row in cursor.fetchall()]

    cursor.execute("SELECT * FROM returns ORDER BY created_at DESC")
    returns = [dict(row) for row in cursor.fetchall()]

    cursor.execute("SELECT * FROM refunds ORDER BY created_at DESC")
    refunds = [dict(row) for row in cursor.fetchall()]

    cursor.execute("SELECT * FROM action_logs ORDER BY log_id DESC LIMIT 100")
    logs = [dict(row) for row in cursor.fetchall()]

    conn.close()

    config = get_seller_config()
    metrics = get_store_metrics()

    return {
        "orders": orders,
        "cases": cases,
        "returns": returns,
        "refunds": refunds,
        "action_logs": logs,
        "config": config,
        "metrics": metrics
    }
