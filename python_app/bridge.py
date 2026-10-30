"""
bridge.py - CLI Bridge between full-stack server and Python backend
Allows Node.js / Express or shell to execute authoritative Python functions
and receive JSON responses.
"""

import sys
import os
import json

# Ensure python_app directory is in sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import database
import tools
import agent

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No action specified"}))
        sys.exit(1)

    action = sys.argv[1]

    # Read payload from argument 2 or stdin if piped
    payload = {}
    if len(sys.argv) > 2:
        try:
            payload = json.loads(sys.argv[2])
        except Exception:
            payload = {}
    else:
        # Check if stdin has data ready without blocking
        import select
        if select.select([sys.stdin], [], [], 0.0)[0]:
            try:
                stdin_data = sys.stdin.read()
                if stdin_data.strip():
                    payload = json.loads(stdin_data)
            except Exception:
                payload = {}

    try:
        if action == "get_data":
            data = tools.get_all_data()
            print(json.dumps(data, default=str))

        elif action == "run_agent_turn":
            message = payload.get("message", "")
            api_key = payload.get("api_key") or os.getenv("GEMINI_API_KEY")
            force_mode = payload.get("force_mode")
            result = agent.run_agent_turn(message, api_key=api_key, force_mode=force_mode)
            print(json.dumps(result, default=str))

        elif action in ("supervisor_decision", "supervisor_handle_case"):
            case_id = int(payload.get("case_id"))
            decision = payload.get("decision", "")
            notes = payload.get("notes", "")
            result = tools.supervisor_handle_case(case_id, decision, notes)
            print(json.dumps(result, default=str))

        elif action in ("lookup_order", "check_order"):
            order_id = payload.get("order_id", "")
            result = tools.lookup_order(order_id)
            print(json.dumps(result, default=str))

        elif action == "check_refund_eligibility":
            order_id = payload.get("order_id", "")
            reason = payload.get("reason", "")
            customer_message = payload.get("customer_message", "")
            result = tools.check_refund_eligibility(order_id, reason, customer_message)
            print(json.dumps(result, default=str))

        elif action == "process_mock_refund":
            order_id = payload.get("order_id", "")
            amount = float(payload.get("amount", 0.0))
            reason = payload.get("reason", "")
            authorized_by = payload.get("authorized_by", "AUTO_POLICY_SYSTEM")
            result = tools.process_mock_refund(order_id, amount, reason, authorized_by)
            print(json.dumps(result, default=str))

        elif action == "check_return_eligibility":
            order_id = payload.get("order_id", "")
            reason = payload.get("reason", "")
            customer_message = payload.get("customer_message", "")
            result = tools.check_return_eligibility(order_id, reason, customer_message)
            print(json.dumps(result, default=str))

        elif action == "create_mock_return":
            order_id = payload.get("order_id", "")
            reason = payload.get("reason", "")
            result = tools.create_mock_return(order_id, reason)
            print(json.dumps(result, default=str))

        elif action == "reopen_case":
            case_id = int(payload.get("case_id"))
            new_status = payload.get("new_status", "Awaiting Review")
            notes = payload.get("notes", "")
            result = tools.reopen_or_update_case(case_id, new_status, notes)
            print(json.dumps(result, default=str))

        elif action == "update_config":
            key = payload.get("key")
            value = payload.get("value")
            database.update_seller_config(key, value)
            cfg = database.get_seller_config()
            print(json.dumps({"success": True, "config": cfg}))

        elif action == "resolve_query":
            message_id = payload.get("message_id", "")
            tools.log_action(
                action_type="RESOLVED_QUERY",
                order_id=payload.get("order_id"),
                tool_name="confirm_resolved",
                input_params=json.dumps({"message_id": message_id}),
                details="Customer confirmed inquiry was resolved",
                result="Inquiry closed successfully",
                decision="RESOLVED",
                status="SUCCESS"
            )
            print(json.dumps({"success": True}))

        elif action == "reset_data":
            database.reset_all_data()
            data = tools.get_all_data()
            print(json.dumps({"success": True, "data": data}, default=str))

        else:
            print(json.dumps({"error": f"Unknown action: {action}"}))
            sys.exit(1)

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
