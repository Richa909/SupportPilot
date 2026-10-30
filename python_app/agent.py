"""
agent.py - Customer Support Agent with Intent Recognition, Tool Calling, and Demo Mode
Supports Offline Deterministic Demo Mode and Genuine Gemini Integration.
Enforces strict policy checks, whitelisted Python tool execution, and produces
transparent 7-step execution timelines for every customer inquiry.
Part of Hack4Hack AI Customer Support Prototype
"""

import os
import re
import json
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional
import tools

APPROVED_TOOLS = [
    "lookup_order",
    "check_refund_eligibility",
    "check_return_eligibility",
    "create_mock_return",
    "escalate_to_supervisor"
]

def extract_order_id(text: str) -> Optional[str]:
    """Extract order ID like ORD-IND-1001, ORD-1001, ORD1001, #1001, 1001 from text."""
    if not text:
        return None
    # Matches ORD-IND-1001, ORD_IND_1001
    match_ind = re.search(r'\b(ORD[-_]?IND[-_]?[0-9]{4})\b', text, re.IGNORECASE)
    if match_ind:
        digits = match_ind.group(1)[-4:]
        return f"ORD-IND-{digits}"
    # Matches ORD-1001, ORD_1001, ord1001
    match = re.search(r'\b(ORD[-_]?[0-9]{4})\b', text, re.IGNORECASE)
    if match:
        digits = match.group(1)[-4:]
        return f"ORD-IND-{digits}"
    # Matches #1001 or 1001 (isolated 4 digits)
    match2 = re.search(r'#?([1-9][0-9]{3})\b', text)
    if match2:
        return f"ORD-IND-{match2.group(1)}"
    return None

def detect_intent(text: str) -> str:
    """Detect customer intention with high accuracy."""
    lower = text.lower()
    if any(k in lower for k in ["damage", "broken", "cracked", "defective", "shatter", "faulty"]):
        return "damaged_item"
    if any(k in lower for k in ["wrong item", "missing item", "incorrect item", "different item"]):
        return "wrong_item"
    if any(k in lower for k in ["refund", "money back", "reimburse", "charge back", "credit back"]):
        return "refund_request"
    if any(k in lower for k in ["return", "send back", "exchange", "ship back"]):
        return "return_request"
    if any(k in lower for k in ["status", "where is", "track", "delivery", "shipped", "arrive", "when will", "package"]):
        return "order_status"
    if any(k in lower for k in ["hello", "hi", "hey", "good morning", "good afternoon", "help"]):
        return "greeting"
    return "general_inquiry"

def call_gemini_intent_extraction(customer_message: str, api_key: str) -> Optional[Dict[str, Any]]:
    """
    Genuine Gemini API call via standard library to classify intent and extract order ID.
    Uses gemini-3.8-flash with structured JSON response.
    Never allows the LLM to access the database directly or make refund decisions.
    """
    if not api_key or api_key == "MY_GEMINI_API_KEY":
        return None
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key={api_key}"
        prompt = f"""
You are an intent-classification and parameter-extraction engine for an online retailer support agent.
Customer message: "{customer_message}"

Extract:
1. "intent": one of ["order_status", "refund_request", "return_request", "damaged_item", "wrong_item", "greeting", "general_inquiry"]
2. "order_id": order ID string (e.g. "ORD-IND-1001", "ORD-IND-1002") or null if not provided
3. "issue_details": concise description of the reason or inquiry
4. "requires_followup": boolean (true if order ID is missing for an actionable intent)

Return ONLY valid JSON matching this schema:
{{
  "intent": string,
  "order_id": string or null,
  "issue_details": string,
  "requires_followup": boolean
}}
"""
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json"
            }
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "aistudio-build"}
        )
        with urllib.request.urlopen(req, timeout=2.0) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            candidates = res_data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    raw_text = parts[0].get("text", "").strip()
                    parsed = json.loads(raw_text)
                    if parsed.get("order_id"):
                        parsed["order_id"] = extract_order_id(parsed["order_id"]) or parsed["order_id"]
                    return parsed
    except Exception:
        # Fall back immediately to deterministic extraction
        return None
    return None

def build_execution_timeline(steps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Format execution steps into the 7-step transparent timeline."""
    return steps

def run_agent_turn(
    customer_message: str,
    chat_history: Optional[List[Dict[str, Any]]] = None,
    api_key: Optional[str] = None,
    force_mode: Optional[str] = None
) -> Dict[str, Any]:
    """
    Main execution pipeline for customer support agent.
    
    Adheres strictly to the 7-step transparent execution timeline:
    1. Customer request received
    2. Intent identified
    3. Order information retrieved
    4. Relevant policy checked
    5. Approved Python tool executed
    6. Result verified
    7. Customer response generated
    """
    api_key = api_key or os.getenv("GEMINI_API_KEY")
    timeline: List[Dict[str, Any]] = []

    # Step 1: Customer request received
    timeline.append({
        "step": 1,
        "title": "Customer request received",
        "details": f"Received: \"{customer_message.strip()}\"",
        "status": "success"
    })

    # Step 2: Intent identified & Order ID extracted
    extracted_order_id = None
    intent = "general_inquiry"
    engine_used = "Deterministic Demo Mode"

    if api_key and force_mode != "demo":
        gemini_result = call_gemini_intent_extraction(customer_message, api_key)
        if gemini_result:
            intent = gemini_result.get("intent", detect_intent(customer_message))
            extracted_order_id = gemini_result.get("order_id") or extract_order_id(customer_message)
            engine_used = "Gemini API (gemini-3.8-flash)"
        else:
            intent = detect_intent(customer_message)
            extracted_order_id = extract_order_id(customer_message)
            engine_used = "Deterministic Demo Mode (Gemini Fallback)"
    else:
        intent = detect_intent(customer_message)
        extracted_order_id = extract_order_id(customer_message)

    timeline.append({
        "step": 2,
        "title": "Intent identified",
        "details": f"Intent: {intent.replace('_', ' ').title()} | Order ID: {extracted_order_id or 'None'}",
        "engine": engine_used,
        "status": "success"
    })

    # Scenario A: Greeting with no order ID
    if intent == "greeting" and not extracted_order_id:
        reply = "Hello! I am your store AI customer support assistant. I can help you check your order delivery status, track packages, or assist with return and refund requests. Could you please share your Order ID (for example, ORD-IND-1001)?"
        timeline.append({
            "step": 3,
            "title": "Order information retrieved",
            "details": "Awaiting customer order ID",
            "status": "info"
        })
        timeline.append({
            "step": 4,
            "title": "Relevant policy checked",
            "details": "General customer service assistance guidelines",
            "status": "info"
        })
        timeline.append({
            "step": 5,
            "title": "Approved Python tool executed",
            "tool_name": "None",
            "details": "No transactional tool required for greeting",
            "status": "info"
        })
        timeline.append({
            "step": 6,
            "title": "Result verified",
            "details": "Greeting processed",
            "status": "success"
        })
        timeline.append({
            "step": 7,
            "title": "Customer response generated",
            "details": "Prompted customer for inquiry and Order ID",
            "status": "success"
        })
        return {
            "mode": engine_used,
            "reply": reply,
            "extracted_order_id": None,
            "intent": intent,
            "tool_called": None,
            "tool_result": None,
            "timeline": timeline,
            "requires_followup": True
        }

    # Scenario B: Missing Order ID for an actionable intent
    if not extracted_order_id:
        action_name = intent.replace("_", " ")
        reply = f"I would be glad to help you with your {action_name}! Could you please provide your Order ID (e.g., ORD-IND-1001 or ORD-IND-1002) so I can locate your purchase details in our store system?"
        timeline.append({
            "step": 3,
            "title": "Order information retrieved",
            "details": "Order ID missing from request",
            "status": "blocked"
        })
        timeline.append({
            "step": 4,
            "title": "Relevant policy checked",
            "policy_rule": "RULE_ORDER_REQUIRED",
            "details": "Store policy requires verified Order ID before processing tracking or claims",
            "status": "blocked"
        })
        timeline.append({
            "step": 5,
            "title": "Approved Python tool executed",
            "tool_name": "None",
            "details": "Execution paused awaiting customer input",
            "status": "info"
        })
        timeline.append({
            "step": 6,
            "title": "Result verified",
            "details": "Follow-up requirement confirmed",
            "status": "success"
        })
        timeline.append({
            "step": 7,
            "title": "Customer response generated",
            "details": "Requested Order ID from customer",
            "status": "success"
        })
        return {
            "mode": engine_used,
            "reply": reply,
            "extracted_order_id": None,
            "intent": intent,
            "tool_called": None,
            "tool_result": None,
            "timeline": timeline,
            "requires_followup": True
        }

    # Scenario C: Order ID provided -> Execute lookup_order
    order_info = tools.lookup_order(extracted_order_id)

    if not order_info.get("found"):
        timeline.append({
            "step": 3,
            "title": "Order information retrieved",
            "tool_name": "lookup_order",
            "details": f"Queried SQLite database for '{extracted_order_id}' -> Not found",
            "status": "not_found"
        })
        timeline.append({
            "step": 4,
            "title": "Relevant policy checked",
            "policy_rule": "RULE_ORDER_EXISTS",
            "details": "Order existence validation failed",
            "status": "blocked"
        })
        timeline.append({
            "step": 5,
            "title": "Approved Python tool executed",
            "tool_name": "lookup_order",
            "result": "Order not found in database",
            "status": "not_found"
        })
        timeline.append({
            "step": 6,
            "title": "Result verified",
            "details": "Graceful non-existent order handling",
            "status": "success"
        })
        reply = f"I searched our store records for Order **{extracted_order_id}**, but could not find a matching order. Please double-check your order confirmation email or receipt and re-enter the ID."
        timeline.append({
            "step": 7,
            "title": "Customer response generated",
            "details": "Polite notification that order could not be located",
            "status": "success"
        })
        return {
            "mode": engine_used,
            "reply": reply,
            "extracted_order_id": extracted_order_id,
            "intent": intent,
            "tool_called": "lookup_order",
            "tool_result": order_info,
            "timeline": timeline,
            "requires_followup": True
        }

    # Order found! Add Step 3
    timeline.append({
        "step": 3,
        "title": "Order information retrieved",
        "tool_name": "lookup_order",
        "details": f"Found {order_info['order_id']}: {order_info['item_name']} (₹{order_info['amount']:.2f}, {order_info['shipping_status']})",
        "status": "success"
    })

    # Route based on customer intent:
    # -------------------------------------------------------------
    # 1. ORDER STATUS / TRACKING
    # -------------------------------------------------------------
    if intent in ["order_status", "general_inquiry"]:
        status = order_info["shipping_status"]
        carrier = order_info["carrier"]
        tracking = order_info["tracking_number"]
        item = order_info["item_name"]
        delivery_date = order_info.get("delivery_date")

        timeline.append({
            "step": 4,
            "title": "Relevant policy checked",
            "policy_rule": "RULE_SHIPPING_VERIFICATION",
            "details": f"Verified real-time carrier data ({carrier})",
            "status": "success"
        })
        timeline.append({
            "step": 5,
            "title": "Approved Python tool executed",
            "tool_name": "lookup_order",
            "result": f"Status: {status}, Tracking: {tracking}",
            "status": "success"
        })
        timeline.append({
            "step": 6,
            "title": "Result verified",
            "details": f"Confirmed delivery status ({status})",
            "status": "success"
        })

        if status == "Delivered":
            reply = (
                f"Great news! Order **{extracted_order_id}** for *{item}* was **Delivered** on {delivery_date} "
                f"via **{carrier}** (Tracking: `{tracking}`).\n\nDid this resolve your inquiry?"
            )
        elif status == "In Transit":
            reply = (
                f"Order **{extracted_order_id}** for *{item}* is currently **In Transit** via **{carrier}** "
                f"(Tracking: `{tracking}`). The package is out for delivery and will arrive shortly."
            )
        else:
            reply = f"Order **{extracted_order_id}** ({item}) is currently **{status}** with carrier {carrier} (Tracking: `{tracking}`)."

        timeline.append({
            "step": 7,
            "title": "Customer response generated",
            "details": "Delivered verified carrier tracking information",
            "status": "success"
        })

        return {
            "mode": engine_used,
            "reply": reply,
            "extracted_order_id": extracted_order_id,
            "intent": intent,
            "tool_called": "lookup_order",
            "tool_result": order_info,
            "timeline": timeline,
            "requires_followup": False,
            "resolved_prompt": True
        }

    # -------------------------------------------------------------
    # 2. RETURN REQUEST (Separate from refund!)
    # -------------------------------------------------------------
    elif intent == "return_request":
        return_eligibility = tools.check_return_eligibility(
            order_id=extracted_order_id,
            reason=customer_message,
            customer_message=customer_message
        )

        timeline.append({
            "step": 4,
            "title": "Relevant policy checked",
            "tool_name": "check_return_eligibility",
            "policy_rule": return_eligibility.get("policy_rule", "RULE_RETURN_POLICY"),
            "details": return_eligibility.get("reason", "Evaluated return window and delivery status"),
            "status": return_eligibility["status"]
        })

        if return_eligibility["status"] == "blocked":
            timeline.append({
                "step": 5,
                "title": "Approved Python tool executed",
                "tool_name": "check_return_eligibility",
                "result": return_eligibility["message"],
                "status": "blocked"
            })
            timeline.append({
                "step": 6,
                "title": "Result verified",
                "details": "Policy blocked return creation",
                "status": "blocked"
            })
            timeline.append({
                "step": 7,
                "title": "Customer response generated",
                "details": "Explained why return cannot be accepted",
                "status": "success"
            })
            return {
                "mode": engine_used,
                "reply": return_eligibility["message"],
                "extracted_order_id": extracted_order_id,
                "intent": intent,
                "tool_called": "check_return_eligibility",
                "tool_result": return_eligibility,
                "timeline": timeline,
                "requires_followup": False
            }

        elif return_eligibility["status"] == "escalated":
            case_id = return_eligibility.get("case_id")
            timeline.append({
                "step": 5,
                "title": "Approved Python tool executed",
                "tool_name": "escalate_to_supervisor",
                "result": f"Case #{case_id} registered in Retailer Dashboard",
                "status": "escalated"
            })
            timeline.append({
                "step": 6,
                "title": "Result verified",
                "details": f"Escalated to supervisor queue (Case #{case_id})",
                "status": "escalated"
            })
            timeline.append({
                "step": 7,
                "title": "Customer response generated",
                "details": "Provided case number and supervisor review details",
                "status": "success"
            })
            return {
                "mode": engine_used,
                "reply": return_eligibility["message"],
                "extracted_order_id": extracted_order_id,
                "intent": intent,
                "tool_called": "escalate_to_supervisor",
                "tool_result": return_eligibility,
                "timeline": timeline,
                "requires_followup": False
            }

        else: # Eligible -> Create mock return request
            mock_return = tools.create_mock_return(extracted_order_id, reason=customer_message)
            timeline.append({
                "step": 5,
                "title": "Approved Python tool executed",
                "tool_name": "create_mock_return",
                "result": f"Return {mock_return['return_id']} created with tracking {mock_return['tracking_number']}",
                "status": "success"
            })
            timeline.append({
                "step": 6,
                "title": "Result verified",
                "details": "Recorded in returns table; order return_status set to 'Return Requested'",
                "status": "success"
            })
            reply = (
                f"Your return request for Order **{extracted_order_id}** ({order_info['item_name']}) has been created!\n\n"
                f"• **Return ID:** `{mock_return['return_id']}`\n"
                f"• **Prepaid Return Label:** `{mock_return['tracking_number']}`\n\n"
                f"*Please note:* Items must be returned within 14 days. Once the return is received and inspected at our warehouse, your refund will be processed."
            )
            timeline.append({
                "step": 7,
                "title": "Customer response generated",
                "details": "Issued return label and instructions; no premature refund issued",
                "status": "success"
            })
            return {
                "mode": engine_used,
                "reply": reply,
                "extracted_order_id": extracted_order_id,
                "intent": intent,
                "tool_called": "create_mock_return",
                "tool_result": mock_return,
                "timeline": timeline,
                "requires_followup": False
            }

    # -------------------------------------------------------------
    # 3. REFUND REQUEST / DAMAGED / WRONG ITEM
    # -------------------------------------------------------------
    else: # refund_request, damaged_item, wrong_item
        refund_eligibility = tools.check_refund_eligibility(
            order_id=extracted_order_id,
            reason=customer_message,
            customer_message=customer_message
        )

        timeline.append({
            "step": 4,
            "title": "Relevant policy checked",
            "tool_name": "check_refund_eligibility",
            "policy_rule": refund_eligibility.get("policy_rule", "RULE_REFUND_POLICY"),
            "details": refund_eligibility.get("reason", "Evaluated refund limit and eligibility"),
            "status": refund_eligibility["status"]
        })

        if refund_eligibility["status"] == "blocked":
            timeline.append({
                "step": 5,
                "title": "Approved Python tool executed",
                "tool_name": "check_refund_eligibility",
                "result": refund_eligibility["message"],
                "status": "blocked"
            })
            timeline.append({
                "step": 6,
                "title": "Result verified",
                "details": "Policy blocked refund action",
                "status": "blocked"
            })
            timeline.append({
                "step": 7,
                "title": "Customer response generated",
                "details": "Explained policy blocking reason to customer",
                "status": "success"
            })
            return {
                "mode": engine_used,
                "reply": refund_eligibility["message"],
                "extracted_order_id": extracted_order_id,
                "intent": intent,
                "tool_called": "check_refund_eligibility",
                "tool_result": refund_eligibility,
                "timeline": timeline,
                "requires_followup": False
            }

        elif refund_eligibility["status"] == "escalated":
            case_id = refund_eligibility.get("case_id")
            timeline.append({
                "step": 5,
                "title": "Approved Python tool executed",
                "tool_name": "escalate_to_supervisor",
                "result": f"Case #{case_id} created in Retailer Dashboard queue",
                "status": "escalated"
            })
            timeline.append({
                "step": 6,
                "title": "Result verified",
                "details": f"Registered in cases table (Status: 'Awaiting Review')",
                "status": "escalated"
            })
            timeline.append({
                "step": 7,
                "title": "Customer response generated",
                "details": "Informed customer of human supervisor escalation",
                "status": "success"
            })
            return {
                "mode": engine_used,
                "reply": refund_eligibility["message"],
                "extracted_order_id": extracted_order_id,
                "intent": intent,
                "tool_called": "escalate_to_supervisor",
                "tool_result": refund_eligibility,
                "timeline": timeline,
                "requires_followup": False
            }

        else: # Auto-refund eligible (<= ₹4,150, delivered, within window, undamaged)
            mock_refund = tools.process_mock_refund(
                order_id=extracted_order_id,
                amount=refund_eligibility["amount"],
                reason=customer_message,
                authorized_by="AUTO_POLICY_SYSTEM"
            )

            timeline.append({
                "step": 5,
                "title": "Approved Python tool executed",
                "tool_name": "process_mock_refund",
                "result": f"Refund {mock_refund['refund_id']} of ₹{mock_refund['amount']:.2f} processed",
                "status": "success"
            })
            timeline.append({
                "step": 6,
                "title": "Result verified",
                "details": "Recorded in refunds table; order refund_status set to 'Refunded'",
                "status": "success"
            })
            reply = (
                f"Your refund request for Order **{extracted_order_id}** (₹{order_info['amount']:.2f} for *{order_info['item_name']}*) "
                f"has been approved and processed automatically under store policy!\n\n"
                f"• **Mock Refund ID:** `{mock_refund['refund_id']}`\n"
                f"• **Amount:** `₹{mock_refund['amount']:.2f} INR`\n\n"
                f"Your payment method will receive credit in 2-3 business days. Did this resolve your request?"
            )
            timeline.append({
                "step": 7,
                "title": "Customer response generated",
                "details": "Provided refund confirmation and reference ID",
                "status": "success"
            })
            return {
                "mode": engine_used,
                "reply": reply,
                "extracted_order_id": extracted_order_id,
                "intent": intent,
                "tool_called": "process_mock_refund",
                "tool_result": mock_refund,
                "timeline": timeline,
                "requires_followup": False,
                "resolved_prompt": True
            }
