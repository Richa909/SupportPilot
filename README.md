# 🧭 Support Pilot: AI Customer Support Agent & Retailer Supervisor Dashboard

A reliable, policy-enforced AI customer-support prototype designed for an online retailer. Built with **Python**, **Express**, **React / TypeScript**, **Streamlit**, and **SQLite**.

---

## 🌟 Key Upgraded Capabilities

1. **Grounded AI Agent & Whitelisted Execution**:
   - Understands customer intents: `order_status`, `refund_request`, `return_request`, `damaged_item`, `wrong_item`, `greeting`, `general_inquiry`.
   - Extracts Order IDs (`ORD-1001`, `#1002`, `1003`) and asks clarifying follow-up questions when details are missing.
   - Dual-engine support: Offline Deterministic Demo Mode (zero setup required) and Gemini API integration (`gemini-3.8-flash`).
   - The LLM **never** has direct database access and **never** independently decides refund eligibility.

2. **Authoritative Python Seller Policy Engine**:
   - Auto-refund threshold (default: **$50.00**; configurable in dashboard).
   - 30-day return policy check against verified delivery timestamps.
   - Orders in transit are strictly blocked from automated refund.
   - Damaged or incorrect item claims must always be escalated to a human supervisor.
   - Already-refunded orders are blocked from duplicate refunds.

3. **Separated Returns and Refunds Workflows**:
   - **Return Request**: Checks delivery status and return window, generates a mock prepaid return label (`RET-TRK-XXXX`), creates a record in the `returns` table, and sets `orders.return_status = 'Return Requested'`. Items must be received before a refund is issued.
   - **Refund Request**: Checks eligibility and processes a mock refund (`REF-XXXXX`) in the `refunds` table if permitted.
   - Separate ID spaces: `RET-XXXXX` for returns and `REF-XXXXX` for refunds.

4. **Supervisor Security & Case Lifecycle**:
   - Displays Case ID, order value, escalation summary, triggering policy rule, agent recommended action, and attempted previous actions.
   - 1-click **Approve**, **Decline**, or **Request Information**.
   - Backend verification before executing approvals: verifies case exists, case is awaiting review, order is not already refunded, and uses SQLite transactions to prevent duplicate approvals.
   - Cases marked `Info Requested` remain accessible in their dedicated filter and can be reopened.

5. **Accurate Dashboard Analytics**:
   - Separate metrics calculated directly from database records:
     - Total customer conversations
     - Successful order lookups
     - Automatically processed refunds
     - Return requests created
     - Cases awaiting supervisor review
     - Cases awaiting customer information
     - Supervisor-approved cases
     - Completed customer resolutions
     - Blocked actions

6. **Transparent 7-Step Agent Execution Timeline**:
   Every customer interaction outputs an operational breakdown:
   1. Customer request received
   2. Intent identified
   3. Order information retrieved
   4. Relevant policy checked
   5. Approved Python tool executed
   6. Result verified
   7. Customer response generated

---

## 🚀 Environment Variables

Create a `.env` file (or set via AI Studio Secrets):
```env
# GEMINI_API_KEY: Optional. If omitted or invalid, the app automatically runs in deterministic Demo Mode.
GEMINI_API_KEY="your-gemini-api-key"

# PORT: Server port (defaults to 3000)
PORT=3000
```

---

## 🛠️ How to Run

### Method 1: Full-Stack Web App (Express + React + SQLite + Python Bridge)
```bash
# 1. Install dependencies
npm install

# 2. Run dev server (serves React frontend + Express API on port 3000)
npm run dev

# 3. Open in browser at http://localhost:3000
```

### Method 2: Streamlit Python App
```bash
# 1. Create and activate a Python virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 2. Install requirements
pip install -r python_app/requirements.txt

# 3. Launch Streamlit
streamlit run python_app/app.py
```

---

## 🧪 Automated Test Verification

Both the Python backend and TypeScript client-side policy suites cover all 12 test scenarios:

```bash
# Run Python backend unit tests:
python3 -m unittest python_app/tests.py

# Run TypeScript unit tests:
npm test
```

### Test Scenarios Covered (All Passed):
1. `ORD-1001`: Successful order tracking returns carrier & status Delivered.
2. `ORD-1002`: Eligible automatic refund of $28.50 processed under store policy.
3. `ORD-1003`: Damaged item claim escalated to supervisor (Case created).
4. `ORD-1004`: $149 refund escalated because it exceeds the $50 limit.
5. `ORD-1005`: Order in transit blocked from automatic refund.
6. Missing order ID: Agent politely asks for order ID.
7. Invalid order ID: Agent handles nonexistent order gracefully.
8. Already-refunded order: Duplicate refund request blocked.
9. Return request: Creates prepaid return request (`RET-XXXXX`) without premature refund.
10. Supervisor approval: Valid supervisor approval succeeds and completes mock refund.
11. Duplicate supervisor approval: Blocked by transaction validation.
12. Information requested: Case retains status and remains accessible in dashboard filter.
