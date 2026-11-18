"""Comprehensive ThulasiConnect Backend API, RBAC, Persistence, Escalation, AI & WebSocket Tests.

Runs against the live local PostgreSQL 16 database using isolated synthetic records.
Does NOT write any audio files to disk.
"""

import os
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app  # noqa: E402

TEST_PASSWORD = os.getenv("TEST_DEV_PASSWORD", "ThulasiDev#2026")


@pytest.fixture(scope="module")
def client() -> TestClient:
    with TestClient(app) as tc:
        yield tc


def _login(client: TestClient, email: str, password: str = TEST_PASSWORD) -> tuple[str, dict]:
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
    data = resp.json()
    return data["access_token"], data["user"]


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_health_endpoint(client: TestClient) -> None:
    resp = client.get("/api/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["database_connected"] is True
    assert body["audio_storage_enabled"] is False
    assert body["scheduler"]["running"] is True


def test_authentication_login_invalid_logout_and_reset(client: TestClient) -> None:
    # Unauthenticated request rejected
    assert client.get("/api/auth/me").status_code == 401

    # Invalid password rejected
    bad = client.post("/api/auth/login", json={"email": "admin@thulasipharmacy.local", "password": "WrongPassword123"})
    assert bad.status_code == 401

    # Valid login
    token, user = _login(client, "admin@thulasipharmacy.local")
    assert "system_admin" in user["roles"]

    # Logout revokes token immediately
    out = client.post("/api/auth/logout", headers=_headers(token))
    assert out.status_code == 200
    assert client.get("/api/auth/me", headers=_headers(token)).status_code == 401

    # Password reset request + confirm workflow on a dedicated synthetic pharmacist check
    req_resp = client.post("/api/auth/password-reset/request", json={"email": "pharmacist.madurai@thulasipharmacy.local"})
    assert req_resp.status_code == 200
    dev_token = req_resp.json().get("dev_reset_token")
    assert dev_token
    conf = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": dev_token, "new_password": TEST_PASSWORD},
    )
    assert conf.status_code == 200
    # Reusing same reset token must fail
    conf_again = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": dev_token, "new_password": TEST_PASSWORD},
    )
    assert conf_again.status_code == 400


def test_rbac_hierarchical_isolation_enforced_in_backend(client: TestClient) -> None:
    ph_token, ph_user = _login(client, "pharmacist.rspuram@thulasipharmacy.local")
    bm_token, bm_user = _login(client, "manager.rspuram@thulasipharmacy.local")
    zm_token, zm_user = _login(client, "zonal.west@thulasipharmacy.local")
    owner_token, _ = _login(client, "owner@thulasipharmacy.local")
    admin_token, _ = _login(client, "admin@thulasipharmacy.local")

    # Pharmacist CANNOT access admin users, audit logs, or management reports
    assert client.get("/api/users", headers=_headers(ph_token)).status_code == 403
    assert client.get("/api/audit-logs", headers=_headers(ph_token)).status_code == 403
    assert client.get("/api/reports/daily_calls", headers=_headers(ph_token)).status_code == 403

    # Discover Madurai branch ID via Owner
    all_branches = client.get("/api/branches", headers=_headers(owner_token)).json()
    mdu_branch = next(b for b in all_branches if b["code"] == "MDU-KKN")
    rs_branch = next(b for b in all_branches if b["code"] == "CBE-RSP")

    # Branch Manager RS Puram CANNOT view Madurai branch calls or requests
    assert client.get(f"/api/calls?branch_id={mdu_branch['id']}", headers=_headers(bm_token)).status_code == 403
    assert client.get(f"/api/requests?branch_id={mdu_branch['id']}", headers=_headers(bm_token)).status_code == 403
    assert client.get(f"/api/calls?branch_id={rs_branch['id']}", headers=_headers(bm_token)).status_code == 200

    # Zonal Manager West sees Coimbatore branches ONLY, NOT Madurai
    zm_branches = client.get("/api/branches", headers=_headers(zm_token)).json()
    assert all(b["code"] != "MDU-KKN" for b in zm_branches)
    assert client.get(f"/api/calls?branch_id={mdu_branch['id']}", headers=_headers(zm_token)).status_code == 403

    # Owner sees org-wide dashboard & all branches, but CANNOT manage system users without system_admin role
    owner_dash = client.get("/api/dashboard/overview", headers=_headers(owner_token))
    assert owner_dash.status_code == 200
    assert owner_dash.json()["scope_level"] == "org"
    assert client.get("/api/users", headers=_headers(owner_token)).status_code == 403

    # System Admin CAN view users and audit logs
    assert client.get("/api/users", headers=_headers(admin_token)).status_code == 200
    assert client.get("/api/audit-logs", headers=_headers(admin_token)).status_code == 200
    assert ph_user["scope_level"] == "self"
    assert bm_user["scope_level"] == "branch"
    assert zm_user["scope_level"] == "zone"


def test_call_registration_transcript_requests_and_followups_lifecycle(client: TestClient) -> None:
    ph_token, ph_user = _login(client, "pharmacist.rspuram@thulasipharmacy.local")

    # Pharmacist cannot spoof verified_telephony_integration
    spoof = client.post(
        "/api/calls",
        headers=_headers(ph_token),
        json={
            "customer_name": "Test Spoof",
            "customer_phone": "9840099999",
            "call_source_type": "verified_telephony_integration",
        },
    )
    assert spoof.status_code == 400

    # Register manual telephone call
    call_resp = client.post(
        "/api/calls",
        headers=_headers(ph_token),
        json={
            "customer_name": "Pytest Synthetic Caller",
            "customer_phone": "9840012345",
            "call_direction": "inbound",
            "call_source_type": "manual_telephone_call",
            "outcome_code": "medicine_inquiry_logged",
            "summary": "Enquired about Metformin 500mg and Amlodipine 5mg pricing.",
        },
    )
    assert call_resp.status_code == 201
    call = call_resp.json()
    call_id = call["id"]
    assert call["call_source_type"] == "manual_telephone_call"

    # Save text-only transcript segments
    tr_resp = client.post(
        f"/api/calls/{call_id}/transcript",
        headers=_headers(ph_token),
        json={
            "language_detected": "ta-en",
            "model_used": "faster-whisper-base-cpu-int8",
            "review_status": "employee_edited",
            "segments": [
                {
                    "sequence_index": 0,
                    "speaker_label": "Speaker 1",
                    "start_seconds": 0.0,
                    "end_seconds": 3.5,
                    "text": "Metformin 500mg 2 strips and Amlodipine 5mg price evlo?",
                    "language": "ta-en",
                    "confidence": 0.91,
                    "is_edited": True,
                }
            ],
        },
    )
    assert tr_resp.status_code == 200
    assert len(tr_resp.json()["segments"]) == 1

    # Create multi-item Medicine Request linked to the call with auto follow-up
    due_past = (datetime.now(UTC) - timedelta(minutes=75)).isoformat()
    req_resp = client.post(
        "/api/requests",
        headers=_headers(ph_token),
        json={
            "call_id": call_id,
            "customer_name": "Pytest Synthetic Caller",
            "customer_phone": "9840012345",
            "priority": "high",
            "employee_notes": "Verify evening stock arrival.",
            "required_followup_at": due_past,
            "create_followup": True,
            "followup_title": "Pytest Overdue Callback Check",
            "items": [
                {
                    "medicine_name": "Metformin",
                    "strength": "500mg",
                    "dosage_form": "tablet",
                    "quantity": "2 strips",
                    "availability_status": "available",
                    "price_inquiry": True,
                    "verification_status": "employee_confirmed",
                },
                {
                    "medicine_name": "Amlodipine",
                    "strength": "5mg",
                    "dosage_form": "tablet",
                    "quantity": "1 strip",
                    "availability_status": "out_of_stock",
                    "price_inquiry": True,
                    "verification_status": "employee_confirmed",
                },
            ],
        },
    )
    assert req_resp.status_code == 201
    med_req = req_resp.json()
    assert len(med_req["items"]) == 2
    assert len(med_req["status_history"]) == 1

    # Cancelling without reason must fail (400)
    bad_cancel = client.patch(
        f"/api/requests/{med_req['id']}",
        headers=_headers(ph_token),
        json={"status": "cancelled"},
    )
    assert bad_cancel.status_code == 400

    # Progress status & verify status history
    upd = client.patch(
        f"/api/requests/{med_req['id']}",
        headers=_headers(ph_token),
        json={"status": "in_progress", "status_note": "Checking counter inventory."},
    )
    assert upd.status_code == 200
    assert len(upd.json()["status_history"]) == 2

    # Ordinary pharmacist MUST be blocked (403) from triggering organization-wide escalation evaluation (DEF-08 fix)
    ph_eval = client.post("/api/followups/evaluate-escalations", headers=_headers(ph_token))
    assert ph_eval.status_code == 403

    # Branch manager evaluates overdue follow-ups twice -> escalation triggers once with NO duplicate alerts
    bm_token, _ = _login(client, "manager.rspuram@thulasipharmacy.local")
    eval1 = client.post("/api/followups/evaluate-escalations", headers=_headers(bm_token))
    assert eval1.status_code == 200
    eval2 = client.post("/api/followups/evaluate-escalations", headers=_headers(bm_token))
    assert eval2.status_code == 200
    assert eval2.json()["reminders_created"] == 0
    assert eval2.json()["escalations_created"] == 0

    escs = client.get("/api/escalations", headers=_headers(bm_token))
    assert escs.status_code == 200
    assert len(escs.json()) >= 1


def test_transcription_websocket_in_memory_and_ollama_extraction(client: TestClient) -> None:
    ph_token, _ = _login(client, "pharmacist.rspuram@thulasipharmacy.local")

    # Status check
    st = client.get("/api/transcription/status", headers=_headers(ph_token))
    assert st.status_code == 200
    assert st.json()["privacy_mode"]["audio_recording_storage"] is False

    # WebSocket live transcription session (strictly in-memory 16kHz PCM int16 buffer)
    with client.websocket_connect(f"/api/ws/transcription/live?token={ph_token}&language=auto&sample_rate=16000") as ws:
        ready_msg = ws.receive_json()
        assert ready_msg["type"] == "ready"
        assert ready_msg["audio_retained"] is False

        # Send 0.5s of quiet in-memory PCM int16 bytes (never saved to disk)
        pcm = np.zeros(8000, dtype=np.int16).tobytes()
        ws.send_bytes(pcm)
        ws.send_json({"type": "stop"})

        seen_stopped = False
        for _ in range(6):
            msg = ws.receive_json()
            if msg.get("type") == "stopped":
                assert msg["audio_retained"] is False
                seen_stopped = True
                break
        assert seen_stopped

    # Local Ollama AI text-only extraction
    ext = client.post(
        "/api/transcription/extract",
        headers=_headers(ph_token),
        json={
            "transcript_text": "Vanakkam, Dolo 650mg 2 strips stock irukka? Price evlo aagum?",
            "language_hint": "ta-en",
        },
    )
    assert ext.status_code == 200
    ext_body = ext.json()
    assert "disclaimer" in ext_body
    assert ext_body["source"] in ("ollama", "heuristic_fallback")
    assert all(m["verification_status"] in ("ai_suggested", "missing_info") for m in ext_body["medicines"])


def test_shopaid_csv_fallback_and_reports_csv_export(client: TestClient) -> None:
    admin_token, _ = _login(client, "admin@thulasipharmacy.local")
    bm_token, _ = _login(client, "manager.rspuram@thulasipharmacy.local")

    # Verify ShopAid & Telephony start disconnected / csv_fallback_only
    ints = client.get("/api/integrations", headers=_headers(admin_token)).json()
    keys = {i["integration_key"]: i for i in ints}
    assert keys["shopaid_inventory"]["status"] in ("disconnected", "csv_fallback_only")
    assert keys["telephony_pbx"]["status"] == "disconnected"

    # Upload CSV fallback reference catalog including 1 intentionally invalid row (missing medicine_name)
    csv_bytes = (
        b"sku,medicine_name,strength,dosage_form,manufacturer,mrp_price,stock_status\n"
        b"SHP-001,Dolo 650,650mg,Tablet,Micro Labs,30.00,csv_snapshot_in_stock\n"
        b"SHP-002,Telma 40,40mg,Tablet,Glenmark,225.00,csv_snapshot_low_stock\n"
        b"SHP-BAD,,10mg,Tablet,Unknown,10.00,csv_snapshot_only\n"
    )
    imp = client.post(
        "/api/integrations/shopaid/import-csv",
        headers=_headers(admin_token),
        files={"file": ("shopaid_sample.csv", csv_bytes, "text/csv")},
    )
    assert imp.status_code == 200
    imp_body = imp.json()
    assert imp_body["live_shopaid_connected"] is False
    assert imp_body["failed_count"] == 1
    assert imp_body["failed_rows"][0]["row"] == 4

    # Pharmacist/Manager can search reference catalog
    search = client.get("/api/integrations/shopaid/catalog?q=Telma", headers=_headers(bm_token))
    assert search.status_code == 200
    assert any("Telma" in item["medicine_name"] for item in search.json())

    # Authorized CSV export on reports
    csv_rep = client.get("/api/reports/branch_performance/export.csv", headers=_headers(bm_token))
    assert csv_rep.status_code == 200
    assert "text/csv" in csv_rep.headers["content-type"]
    assert "branch_name" in csv_rep.text


def test_rbac_permission_revocation_and_self_role_guard(client: TestClient) -> None:
    admin_token, admin_user = _login(client, "admin@thulasipharmacy.local")
    ph_token, _ = _login(client, "pharmacist.rspuram@thulasipharmacy.local")

    # Admin cannot modify their own roles
    self_role_upd = client.patch(
        f"/api/users/{admin_user['id']}",
        headers=_headers(admin_token),
        json={"role_codes": ["owner"]},
    )
    assert self_role_upd.status_code == 400

    # Find pharmacist role and test live permission revocation (DEF-01 fix)
    roles = client.get("/api/roles", headers=_headers(admin_token)).json()
    ph_role = next(r for r in roles if r["code"] == "pharmacist")
    original_perms = list(ph_role["permissions"])
    assert "integrations:lookup_catalog" in original_perms

    # Confirm pharmacist can currently look up ShopAid catalog
    assert client.get("/api/integrations/shopaid/catalog?q=Dolo", headers=_headers(ph_token)).status_code == 200

    # Revoke `integrations:lookup_catalog` from pharmacist role in DB
    reduced_perms = [p for p in original_perms if p != "integrations:lookup_catalog"]
    try:
        upd = client.put(
            f"/api/roles/{ph_role['id']}/permissions",
            headers=_headers(admin_token),
            json={"permission_codes": reduced_perms},
        )
        assert upd.status_code == 200

        # Immediately takes effect at runtime -> 403 Forbidden!
        blocked = client.get("/api/integrations/shopaid/catalog?q=Dolo", headers=_headers(ph_token))
        assert blocked.status_code == 403
    finally:
        # Restore original permissions so subsequent tests & demo users remain intact
        restore = client.put(
            f"/api/roles/{ph_role['id']}/permissions",
            headers=_headers(admin_token),
            json={"permission_codes": original_perms},
        )
        assert restore.status_code == 200

    # Verify access restored cleanly
    assert client.get("/api/integrations/shopaid/catalog?q=Dolo", headers=_headers(ph_token)).status_code == 200


def test_metrics_reconciliation_admin_dashboard_and_customer_crud(client: TestClient) -> None:
    admin_token, _ = _login(client, "admin@thulasipharmacy.local")
    ph_token, _ = _login(client, "pharmacist.rspuram@thulasipharmacy.local")

    # System Admin dashboard includes system_admin_summary, scheduler, and CBE-GP staffing warning
    admin_dash = client.get("/api/dashboard/overview", headers=_headers(admin_token))
    assert admin_dash.status_code == 200
    summary = admin_dash.json()["system_admin_summary"]
    assert summary is not None
    assert summary["database_healthy"] is True
    assert summary["scheduler"]["running"] is True
    assert any(w["branch_code"] == "CBE-GP" for w in summary["org_warnings"])

    # Verify calls_today excludes browser_microphone_test while microphone_tests_today counts it (DEF-02 fix)
    before_dash = client.get("/api/dashboard/overview", headers=_headers(ph_token)).json()["kpis"]
    mic_call = client.post(
        "/api/calls",
        headers=_headers(ph_token),
        json={
            "customer_name": "Mic Test Caller",
            "customer_phone": "9840077777",
            "call_source_type": "browser_microphone_test",
            "summary": "Microphone separation metric verification",
        },
    )
    assert mic_call.status_code == 201
    after_dash = client.get("/api/dashboard/overview", headers=_headers(ph_token)).json()["kpis"]
    assert after_dash["calls_today"] == before_dash["calls_today"]
    assert after_dash["microphone_tests_today"] == before_dash["microphone_tests_today"] + 1

    # Verify Customer CRUD (/api/customers)
    cust = client.post(
        "/api/customers",
        headers=_headers(ph_token),
        json={"full_name": "Customer Directory Test", "phone_number": "9840088881", "preferred_language": "ta-en"},
    )
    assert cust.status_code == 201
    cust_id = cust.json()["id"]
    upd_cust = client.patch(
        f"/api/customers/{cust_id}",
        headers=_headers(ph_token),
        json={"notes": "Updated via API test"},
    )
    assert upd_cust.status_code == 200
    assert upd_cust.json()["notes"] == "Updated via API test"
    search_cust = client.get("/api/customers?search=9840088881", headers=_headers(ph_token))
    assert search_cust.status_code == 200
    assert any(c["id"] == cust_id for c in search_cust.json())

    # Employee performance includes both requests_created and requests_assigned (DEF-03 fix)
    emp_perf = client.get("/api/performance/employees", headers=_headers(ph_token)).json()
    assert len(emp_perf["employees"]) == 1
    assert "requests_created" in emp_perf["employees"][0]
    assert "requests_assigned" in emp_perf["employees"][0]


def test_admin_system_health_endpoint_rbac_and_live_checks(client: TestClient) -> None:
    admin_token, _ = _login(client, "admin@thulasipharmacy.local")
    ph_token, _ = _login(client, "pharmacist.rspuram@thulasipharmacy.local")

    # Unauthenticated and pharmacist must be rejected
    assert client.get("/api/admin/system-health").status_code == 401
    assert client.get("/api/admin/system-health", headers=_headers(ph_token)).status_code == 403

    # System Admin receives live health diagnostics for all 10 monitored components without leaking secrets
    resp = client.get("/api/admin/system-health", headers=_headers(admin_token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["summary"]["total"] == 10
    keys = {c["key"]: c for c in body["components"]}
    assert keys["backend"]["status"] == "CONNECTED AND VERIFIED"
    assert keys["database"]["status"] == "CONNECTED AND VERIFIED"
    assert keys["scheduler"]["status"] == "CONNECTED AND VERIFIED"
    assert keys["telephony"]["status"] == "BLOCKED BY EXTERNAL DEPENDENCY"
    # Ensure no raw connection strings or passwords appear in the response payload
    raw_text = resp.text.lower()
    assert "postgresql+psycopg" not in raw_text
    assert "thulasidev" not in raw_text
