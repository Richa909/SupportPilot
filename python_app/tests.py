"""
tests.py - Test suite for RetailAI Customer Support Agent and Policy Engine
Covers all 12 required scenarios from prompt with INR / ₹ and ORD-IND-xxxx:
1. ORD-IND-1001: Successful order tracking.
2. ORD-IND-1002: Eligible automatic refund of ₹2,365.50.
3. ORD-IND-1003: Damaged item, escalated to supervisor.
4. ORD-IND-1004: ₹12,367 refund, escalated because it exceeds the ₹4,150 limit.
5. ORD-IND-1005: Order in transit, no automatic refund.
6. Missing order ID: Agent asks for the order ID.
7. Invalid order ID: Agent explains that the order cannot be found.
8. Already-refunded order: Duplicate refund blocked.
9. Return request: Creates a return request rather than immediately refunding.
10. Supervisor approval: Valid approval works.
11. Duplicate supervisor approval: Blocked.
12. Information requested: Case remains accessible.
"""

import unittest
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import database
import tools
import agent

class TestRetailAIPolicyEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        database.init_db(force_reseed=True)

    def setUp(self):
        # Reset data before each test for deterministic assertions
        database.init_db(force_reseed=True)

    def test_01_ord1001_order_tracking(self):
        """Scenario 1: ORD-IND-1001 successful order tracking."""
        res = agent.run_agent_turn("What is the status of ORD-IND-1001?", force_mode="demo")
        self.assertEqual(res["extracted_order_id"], "ORD-IND-1001")
        self.assertEqual(res["intent"], "order_status")
        self.assertEqual(res["tool_called"], "lookup_order")
        self.assertIn("Delivered", res["reply"])
        self.assertIn("FastPost", res["reply"])
        self.assertIn("TRK-98234-IND", res["reply"])
        self.assertFalse(res["requires_followup"])

    def test_02_ord1002_eligible_auto_refund(self):
        """Scenario 2: ORD-IND-1002 eligible automatic refund of ₹2,365.50."""
        res = agent.run_agent_turn("I want a refund for ORD-IND-1002, changed my mind", force_mode="demo")
        self.assertEqual(res["extracted_order_id"], "ORD-IND-1002")
        self.assertEqual(res["tool_called"], "process_mock_refund")
        self.assertIn("REF-", res["reply"])
        self.assertIn("approved", res["reply"].lower())

        # Verify database state
        order = tools.lookup_order("ORD-IND-1002")
        self.assertEqual(order["refund_status"], "Refunded")

    def test_03_ord1003_damaged_item_escalated(self):
        """Scenario 3: ORD-IND-1003 damaged item, escalated to supervisor."""
        res = agent.run_agent_turn("The mug in ORD-IND-1003 arrived broken and damaged", force_mode="demo")
        self.assertEqual(res["extracted_order_id"], "ORD-IND-1003")
        self.assertEqual(res["tool_called"], "escalate_to_supervisor")
        self.assertIn("escalated", res["reply"].lower())
        self.assertIn("supervisor", res["reply"].lower())

        # Verify case in database
        conn = database.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM cases WHERE order_id = 'ORD-IND-1003'")
        case = cursor.fetchone()
        conn.close()
        self.assertIsNotNone(case)
        self.assertEqual(case["issue_type"], "damaged_or_wrong_item")
        self.assertEqual(case["status"], "Awaiting Review")

    def test_04_ord1004_exceeds_refund_limit_escalated(self):
        """Scenario 4: ORD-IND-1004 ₹12,367 refund, escalated because it exceeds ₹4,150 limit."""
        res = agent.run_agent_turn("Please refund my order ORD-IND-1004", force_mode="demo")
        self.assertEqual(res["extracted_order_id"], "ORD-IND-1004")
        self.assertEqual(res["tool_called"], "escalate_to_supervisor")
        self.assertIn("exceeds our automated refund limit", res["reply"])

        # Verify case
        conn = database.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM cases WHERE order_id = 'ORD-IND-1004'")
        case = cursor.fetchone()
        conn.close()
        self.assertIsNotNone(case)
        self.assertEqual(case["issue_type"], "over_refund_limit")

    def test_05_ord1005_in_transit_no_auto_refund(self):
        """Scenario 5: ORD-IND-1005 order in transit, no automatic refund."""
        res = agent.run_agent_turn("I want a refund for ORD-IND-1005", force_mode="demo")
        self.assertEqual(res["extracted_order_id"], "ORD-IND-1005")
        self.assertEqual(res["tool_called"], "check_refund_eligibility")
        self.assertIn("cannot be refunded", res["reply"])
        self.assertIn("In Transit", res["reply"])

        # Verify order was NOT refunded
        order = tools.lookup_order("ORD-IND-1005")
        self.assertEqual(order["refund_status"], "None")

    def test_06_missing_order_id_asks_followup(self):
        """Scenario 6: Missing order ID: Agent asks for the order ID."""
        res = agent.run_agent_turn("I want a refund for my item", force_mode="demo")
        self.assertIsNone(res["extracted_order_id"])
        self.assertTrue(res["requires_followup"])
        self.assertIn("Order ID", res["reply"])

    def test_07_invalid_order_id_graceful_handling(self):
        """Scenario 7: Invalid order ID: Agent explains that order cannot be found."""
        res = agent.run_agent_turn("Where is ORD-IND-9999?", force_mode="demo")
        self.assertEqual(res["extracted_order_id"], "ORD-IND-9999")
        self.assertEqual(res["tool_called"], "lookup_order")
        self.assertIn("could not find a matching order", res["reply"])
        self.assertTrue(res["requires_followup"])

    def test_08_already_refunded_order_blocked(self):
        """Scenario 8: Already-refunded order: Duplicate refund blocked."""
        # Process first refund
        tools.process_mock_refund("ORD-IND-1002", 2365.50, reason="Initial return")
        
        # Second attempt
        res = agent.run_agent_turn("Please refund ORD-IND-1002 again", force_mode="demo")
        self.assertEqual(res["tool_called"], "check_refund_eligibility")
        self.assertIn("already been refunded", res["reply"])

    def test_09_return_request_creates_return_not_refund(self):
        """Scenario 9: Return request: Creates a return request rather than immediately refunding."""
        res = agent.run_agent_turn("I want to return ORD-IND-1001, didn't like color", force_mode="demo")
        self.assertEqual(res["extracted_order_id"], "ORD-IND-1001")
        self.assertEqual(res["tool_called"], "create_mock_return")
        self.assertIn("RET-", res["reply"])
        self.assertIn("Prepaid Return Label", res["reply"])

        # Crucial check: Order must NOT have refund_status == 'Refunded'
        order = tools.lookup_order("ORD-IND-1001")
        self.assertNotEqual(order["refund_status"], "Refunded")
        self.assertEqual(order["return_status"], "Return Requested")

        # Returns table must have record
        conn = database.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM returns WHERE order_id = 'ORD-IND-1001'")
        return_rec = cursor.fetchone()
        conn.close()
        self.assertIsNotNone(return_rec)

    def test_10_supervisor_approval_valid(self):
        """Scenario 10: Supervisor approval: Valid approval works."""
        case_id = tools.escalate_to_supervisor(
            order_id="ORD-IND-1004",
            customer_name="Emily Davis",
            issue_type="over_refund_limit",
            policy_rule="RULE_OVER_REFUND_LIMIT",
            summary="High value order over ₹4,150",
            recommended_action="Approve with caution",
            customer_message="Please refund ORD-IND-1004",
            previous_actions="[]"
        )
        res = tools.supervisor_handle_case(case_id, "Approve", "Approved by manager exception")
        self.assertTrue(res["success"])
        self.assertEqual(res["status"], "Approved")

        # Verify order and refunds table
        order = tools.lookup_order("ORD-IND-1004")
        self.assertEqual(order["refund_status"], "Refunded")

        conn = database.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM refunds WHERE order_id = 'ORD-IND-1004'")
        ref = cursor.fetchone()
        conn.close()
        self.assertIsNotNone(ref)
        self.assertEqual(ref["authorized_by"], "SUPERVISOR")

    def test_11_duplicate_supervisor_approval_blocked(self):
        """Scenario 11: Duplicate supervisor approval: Blocked."""
        case_id = tools.escalate_to_supervisor(
            order_id="ORD-IND-1004",
            customer_name="Emily Davis",
            issue_type="over_refund_limit",
            policy_rule="RULE_OVER_REFUND_LIMIT",
            summary="High value order over ₹4,150",
            recommended_action="Approve with caution",
            customer_message="Please refund ORD-IND-1004",
            previous_actions="[]"
        )
        # First approval succeeds
        first_res = tools.supervisor_handle_case(case_id, "Approve", "Approved")
        self.assertTrue(first_res["success"])

        # Second approval must be blocked!
        second_res = tools.supervisor_handle_case(case_id, "Approve", "Approved second time")
        self.assertFalse(second_res["success"])
        self.assertIn("already", second_res["message"].lower())

    def test_12_information_requested_case_remains_accessible(self):
        """Scenario 12: Information requested: Case remains accessible and reopenable."""
        case_id = tools.escalate_to_supervisor(
            order_id="ORD-IND-1003",
            customer_name="Alex Smith",
            issue_type="damaged_or_wrong_item",
            policy_rule="RULE_DAMAGED_OR_WRONG_ITEM",
            summary="Broken coffee mug",
            recommended_action="Request photo",
            customer_message="My mug was broken",
            previous_actions="[]"
        )
        # Request info
        res = tools.supervisor_handle_case(case_id, "Request Info", "Please upload photo of damaged box")
        self.assertTrue(res["success"])
        self.assertEqual(res["status"], "Info Requested")

        # Case must still exist in database with status 'Info Requested'
        conn = database.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM cases WHERE case_id = ?", (case_id,))
        case = cursor.fetchone()
        conn.close()
        self.assertIsNotNone(case)
        self.assertEqual(case["status"], "Info Requested")

        # Reopen or resume review when information is provided
        reopen_res = tools.reopen_or_update_case(case_id, "Awaiting Review", "Customer uploaded damage photo")
        self.assertTrue(reopen_res["success"])
        self.assertEqual(reopen_res["status"], "Awaiting Review")

    def test_13_bridge_supervisor_handle_case(self):
        """Scenario 13: Bridge supervisor_handle_case and supervisor_decision actions."""
        import subprocess
        import json

        case_id = tools.escalate_to_supervisor(
            order_id="ORD-IND-1003",
            customer_name="Alex Smith",
            issue_type="damaged_or_wrong_item",
            policy_rule="RULE_DAMAGED_OR_WRONG_ITEM",
            summary="Damaged item test",
            recommended_action="Inspect",
            customer_message="Item damaged",
            previous_actions="[]"
        )

        bridge_script = os.path.join(SCRIPT_DIR, "bridge.py")
        payload = json.dumps({"case_id": case_id, "decision": "Info Requested", "notes": "Need photos"})
        proc = subprocess.run(
            [sys.executable, bridge_script, "supervisor_handle_case", payload],
            capture_output=True,
            text=True
        )
        self.assertEqual(proc.returncode, 0)
        data = json.loads(proc.stdout)
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("status"), "Info Requested")

if __name__ == "__main__":
    unittest.main()
