"""
app.py - Streamlit Customer Support Agent & Retailer Supervisor Dashboard
Authoritative Python implementation with SQLite persistence, whitelisted tool execution,
and separate return and refund workflows.
Part of Hack4Hack Prototype for Small Online Retailer
Run with: streamlit run python_app/app.py
"""

import streamlit as st
import datetime
import sqlite3
import pandas as pd
from database import init_db, get_connection, get_seller_config, update_seller_config
import tools
import agent

# Set page config
st.set_page_config(
    page_title="Support Pilot Prototype",
    page_icon="🧭",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Ensure database is initialized
init_db()

# Sidebar navigation & configuration
st.sidebar.title("🧭 Support Pilot")
st.sidebar.markdown("**AI Customer Support Agent & Supervisor Dashboard**")

view_mode = st.sidebar.radio(
    "Choose View:",
    ["💬 Customer Chat", "📊 Retailer Dashboard", "🗄️ SQLite Database Viewer", "ℹ️ How to Run & Architecture"],
    index=0
)

st.sidebar.markdown("---")
st.sidebar.subheader("⚙️ Seller Policy Settings")
current_config = get_seller_config()
max_refund_limit = float(current_config.get("max_auto_refund_limit", 50.0))
new_refund_limit = st.sidebar.slider(
    "Max Auto-Refund Limit ($)",
    min_value=10.0,
    max_value=200.0,
    value=max_refund_limit,
    step=5.0,
    help="Refunds above this threshold automatically escalate to a supervisor for human review."
)
if new_refund_limit != max_refund_limit:
    update_seller_config("max_auto_refund_limit", str(new_refund_limit))
    st.sidebar.success(f"Updated auto-refund limit to ${new_refund_limit:.2f}")

return_window = int(current_config.get("return_window_days", 30))
new_window = st.sidebar.number_input(
    "Return Window (Days)",
    min_value=7,
    max_value=90,
    value=return_window,
    step=1
)
if new_window != return_window:
    update_seller_config("return_window_days", str(new_window))
    st.sidebar.success(f"Updated return window to {new_window} days")

st.sidebar.markdown("---")
st.sidebar.subheader("🤖 LLM Engine Mode")
api_key_input = st.sidebar.text_input("Gemini API Key (optional)", type="password", help="Leave blank to run in Demo Mode with zero setup")
if not api_key_input:
    st.sidebar.info("💡 **Demo Mode Active**: Rule-based deterministic extraction & policy evaluation without needing an API key.")
else:
    st.sidebar.success("🔑 Gemini API Key configured.")

# -------------------------------------------------------------
# VIEW 1: CUSTOMER CHAT PAGE
# -------------------------------------------------------------
if view_mode == "💬 Customer Chat":
    st.title("💬 Customer Support Assistant")
    st.caption("Ask questions about your orders, request tracking, or submit return/refund claims. Transparent 7-step execution timeline enabled.")

    # Initialize chat session state
    if "messages" not in st.session_state:
        st.session_state.messages = [
            {
                "role": "assistant",
                "content": "Hello! I am your AI support assistant. I can check order status, look up shipping tracking, or process return requests and mock refunds. How can I assist you today?"
            }
        ]

    # Sample prompt pills for quick testing
    st.markdown("**Try 1-Click Prompt Compliance Scenarios:**")
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        if st.button("📦 1. Order Status (ORD-1001)"):
            st.session_state.prompt_to_send = "Where is my package for order ORD-1001?"
        if st.button("🚚 5. In-Transit (ORD-1005)"):
            st.session_state.prompt_to_send = "Where is my package for order ORD-1005?"
    with c2:
        if st.button("💵 2. Auto-Refund <$50 (ORD-1002)"):
            st.session_state.prompt_to_send = "I want a refund for ORD-1002, changed my mind."
        if st.button("❓ 6. Missing Order ID"):
            st.session_state.prompt_to_send = "I want a refund for my item."
    with c3:
        if st.button("⚠️ 3. Damaged Claim (ORD-1003)"):
            st.session_state.prompt_to_send = "The mug in order ORD-1003 arrived broken and damaged."
        if st.button("🚫 7. Invalid Order ID"):
            st.session_state.prompt_to_send = "Where is order ORD-9999?"
    with c4:
        if st.button("🛑 4. Over $50 Escalation (ORD-1004)"):
            st.session_state.prompt_to_send = "Please refund my order ORD-1004 ($149 bag)."
        if st.button("🔄 9. Return Request (ORD-1001)"):
            st.session_state.prompt_to_send = "I want to return ORD-1001, wrong color."

    # Display chat messages from history
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])
            if "timeline" in msg and msg["timeline"]:
                with st.expander("⏱️ 7-Step Agent Execution Timeline", expanded=False):
                    for step in msg["timeline"]:
                        st.markdown(f"**Step {step['step']}: {step['title']}** — {step.get('details', '')}")
                        if "tool_name" in step:
                            st.caption(f"Tool executed: `{step['tool_name']}()` | Status: `{step.get('status', 'ok')}`")

    # User input
    user_prompt = st.chat_input("Type your message here (e.g. 'What is the status of ORD-1001?')...")
    if getattr(st.session_state, "prompt_to_send", None):
        user_prompt = st.session_state.prompt_to_send
        st.session_state.prompt_to_send = None

    if user_prompt:
        st.session_state.messages.append({"role": "user", "content": user_prompt})
        with st.chat_message("user"):
            st.markdown(user_prompt)

        with st.chat_message("assistant"):
            with st.spinner("Analyzing inquiry and executing whitelisted Python tools..."):
                agent_response = agent.run_agent_turn(
                    customer_message=user_prompt,
                    api_key=api_key_input if api_key_input else None
                )
                st.markdown(agent_response["reply"])

                if agent_response.get("timeline"):
                    with st.expander("⏱️ 7-Step Agent Execution Timeline", expanded=True):
                        for step in agent_response["timeline"]:
                            st.markdown(f"**Step {step['step']}: {step['title']}** — {step.get('details', '')}")
                            if "tool_name" in step:
                                st.caption(f"Tool executed: `{step['tool_name']}()` | Status: `{step.get('status', 'ok')}`")

        st.session_state.messages.append({
            "role": "assistant",
            "content": agent_response["reply"],
            "timeline": agent_response.get("timeline")
        })

# -------------------------------------------------------------
# VIEW 2: RETAILER DASHBOARD
# -------------------------------------------------------------
elif view_mode == "📊 Retailer Dashboard":
    st.title("📊 Retailer Supervisor Dashboard")
    st.caption("Accurate store analytics, supervisor review queue, and policy rule enforcement.")

    metrics = tools.get_store_metrics()

    # Metrics row (Requirement 6)
    m1, m2, m3, m4, m5, m6 = st.columns(6)
    m1.metric("Conversations", metrics["total_customer_conversations"])
    m2.metric("Order Lookups", metrics["successful_order_lookups"])
    m3.metric("Auto-Refunds", metrics["auto_processed_refunds"])
    m4.metric("Returns Created", metrics["return_requests_created"])
    m5.metric("Awaiting Review", metrics["cases_awaiting_review"], delta="Action Needed" if metrics["cases_awaiting_review"] > 0 else "All Clear", delta_color="inverse")
    m6.metric("Resolutions", metrics["completed_customer_resolutions"])

    st.markdown("---")

    # Supervisor Review Queue with Filters (Requirement 5)
    st.subheader("🚨 Supervisor Case Management")
    case_filter = st.radio(
        "Filter Cases by Status:",
        ["Awaiting Review", "Info Requested", "Approved", "Declined", "ALL"],
        horizontal=True
    )

    conn = get_connection()
    cursor = conn.cursor()
    if case_filter == "ALL":
        cursor.execute("SELECT * FROM cases ORDER BY case_id DESC")
    else:
        cursor.execute("SELECT * FROM cases WHERE status = ? ORDER BY case_id DESC", (case_filter,))
    cases = cursor.fetchall()

    if not cases:
        st.info(f"No cases currently matching '{case_filter}'.")
    else:
        for c in cases:
            case = dict(c)
            with st.container():
                st.markdown(f"#### Case #{case['case_id']} — Order: `{case['order_id']}` ({case['customer_name']}) — Status: **{case['status']}**")
                
                # Fetch order details
                cursor.execute("SELECT item_name, amount, shipping_status, refund_status FROM orders WHERE UPPER(order_id) = ?", (case['order_id'].upper(),))
                ord_row = cursor.fetchone()
                if ord_row:
                    st.caption(f"Item: **{ord_row['item_name']}** | Value: **${ord_row['amount']:.2f}** | Shipping: **{ord_row['shipping_status']}** | Refund Status: **{ord_row['refund_status']}**")

                st.markdown(f"**Policy Rule:** `{case.get('policy_rule', 'GENERAL')}` | **Recommended Action:** *{case.get('recommended_action', 'Review')}*")
                st.info(f"**Summary:** {case['summary']}\n\n**Customer Inquiry:** \"{case['customer_message']}\"")

                if case.get("supervisor_notes"):
                    st.caption(f"Supervisor Notes: {case['supervisor_notes']}")

                if case["status"] in ["Awaiting Review", "Info Requested"]:
                    col_app, col_dec, col_req = st.columns(3)
                    with col_app:
                        if st.button(f"✅ Approve Refund #{case['case_id']}", key=f"app_{case['case_id']}"):
                            res = tools.supervisor_handle_case(case['case_id'], "Approve", "Approved by supervisor via Streamlit")
                            if res["success"]:
                                st.success(res["message"])
                            else:
                                st.error(res["message"])
                            st.rerun()

                    with col_dec:
                        if st.button(f"❌ Decline #{case['case_id']}", key=f"dec_{case['case_id']}"):
                            res = tools.supervisor_handle_case(case['case_id'], "Decline", "Declined per policy")
                            st.warning(res["message"])
                            st.rerun()

                    with col_req:
                        if st.button(f"📝 Request Info #{case['case_id']}", key=f"req_{case['case_id']}"):
                            res = tools.supervisor_handle_case(case['case_id'], "Request Info", "Supervisor requested packaging photo")
                            st.info(res["message"])
                            st.rerun()
                else:
                    if st.button(f"🔄 Reopen Case #{case['case_id']}", key=f"reopen_{case['case_id']}"):
                        res = tools.reopen_or_update_case(case['case_id'], "Awaiting Review", "Supervisor reopened case")
                        st.success(res["message"])
                        st.rerun()

                st.markdown("---")

    # Action & Audit Log
    st.subheader("📋 Action & Audit Log (SQLite)")
    df_logs = pd.read_sql_query("SELECT timestamp, action_type, order_id, tool_name, details, result, status FROM action_logs ORDER BY log_id DESC LIMIT 30", conn)
    st.dataframe(df_logs, use_container_width=True)
    conn.close()

# -------------------------------------------------------------
# VIEW 3: SQLITE DATABASE VIEWER
# -------------------------------------------------------------
elif view_mode == "🗄️ SQLite Database Viewer":
    st.title("🗄️ SQLite Database Browser")
    st.caption("Direct inspection of store tables, returns, refunds, cases, and audit history.")

    conn = get_connection()
    tab1, tab2, tab3, tab4, tab5 = st.tabs(["Orders", "Cases", "Returns", "Refunds", "Audit Logs"])

    with tab1:
        st.subheader("Orders Table")
        st.dataframe(pd.read_sql_query("SELECT * FROM orders", conn), use_container_width=True)

    with tab2:
        st.subheader("Supervisor Cases")
        st.dataframe(pd.read_sql_query("SELECT * FROM cases", conn), use_container_width=True)

    with tab3:
        st.subheader("Returns Table")
        st.dataframe(pd.read_sql_query("SELECT * FROM returns", conn), use_container_width=True)

    with tab4:
        st.subheader("Refunds Table")
        st.dataframe(pd.read_sql_query("SELECT * FROM refunds", conn), use_container_width=True)

    with tab5:
        st.subheader("Action History")
        st.dataframe(pd.read_sql_query("SELECT * FROM action_logs ORDER BY log_id DESC LIMIT 50", conn), use_container_width=True)

    conn.close()

# -------------------------------------------------------------
# VIEW 4: HOW TO RUN & ARCHITECTURE
# -------------------------------------------------------------
elif view_mode == "ℹ️ How to Run & Architecture":
    st.title("ℹ️ Support Pilot Architecture & Documentation")
    st.markdown("""
    ### 🛡️ Core Security Architecture & Whitelisted Execution
    1. **Strict Python Policy Engine**: All policy decisions (e.g. $50 auto-refund threshold, 30-day return window, damaged item escalations) are enforced in Python (`tools.py`), preventing prompt injection or hallucinated refunds.
    2. **Separated Returns and Refunds**: Return requests generate prepaid return labels without issuing premature refunds.
    3. **Duplicate Prevention & Verification**: Supervisor approval functions verify case state and prevent duplicate approvals or duplicate refunds.
    4. **Case Retention**: 'Info Requested' cases remain accessible under their dedicated filter and can be reopened.
    5. **Transparent 7-Step Timeline**: Every customer message outputs a verified operational timeline.
    """)
