"""Documented Initial Development Administrator & Synthetic Organization Bootstrap CLI.

Usage (from `backend/`):
    $env:BOOTSTRAP_ADMIN_EMAIL = "admin@thulasipharmacy.local"
    $env:BOOTSTRAP_ADMIN_PASSWORD = "<choose-a-strong-password>"
    python -m app.cli.bootstrap_admin --seed-demo

No production credentials are hardcoded in source code.
"""

import argparse
import getpass
import os
import sys
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.rbac import (
    ROLE_BRANCH_MANAGER,
    ROLE_OWNER,
    ROLE_PHARMACIST,
    ROLE_SYSTEM_ADMIN,
    ROLE_ZONAL_MANAGER,
    ensure_roles_and_permissions_seeded,
)
from app.core.security import hash_password
from app.models.identity import Employee, Role, User, UserRole
from app.models.operations import (
    Call,
    CallOutcome,
    CallTranscript,
    Customer,
    Speaker,
    TranscriptSegment,
)
from app.models.organization import Branch, Zone
from app.models.requests import (
    MedicineRequest,
    MedicineRequestItem,
    RequestStatusHistory,
)
from app.models.workflow import FollowUp
from app.routers.calls import ensure_call_outcomes_seeded
from app.services.escalation_service import evaluate_overdue_followups_and_escalations
from app.services.shopaid_adapter import ensure_shopaid_config
from app.services.telephony_adapter import ensure_telephony_config


def _ensure_user(
    db,
    *,
    email: str,
    full_name: str,
    password: str,
    role_codes: list[str],
    branch_id: int | None = None,
    zone_id: int | None = None,
    emp_code: str | None = None,
    designation: str = "Staff",
) -> User:
    email_norm = email.strip().lower()
    user = db.scalar(select(User).where(User.email == email_norm))
    if not user:
        user = User(
            email=email_norm,
            full_name=full_name,
            password_hash=hash_password(password),
            is_active=True,
            branch_id=branch_id,
            zone_id=zone_id,
        )
        db.add(user)
        db.flush()

    roles = db.scalars(select(Role).where(Role.code.in_(role_codes))).all()
    existing_role_ids = set(db.scalars(select(UserRole.role_id).where(UserRole.user_id == user.id)).all())
    for r in roles:
        if r.id not in existing_role_ids:
            db.add(UserRole(user_id=user.id, role_id=r.id))

    if emp_code:
        emp = db.scalar(select(Employee).where(Employee.user_id == user.id))
        if not emp:
            db.add(
                Employee(
                    user_id=user.id,
                    employee_code=emp_code,
                    branch_id=branch_id,
                    designation=designation,
                    is_active=True,
                )
            )
    db.flush()
    return user


def run_bootstrap(admin_email: str, admin_password: str, seed_demo: bool, demo_password: str | None) -> None:
    db = SessionLocal()
    try:
        ensure_roles_and_permissions_seeded(db)
        ensure_call_outcomes_seeded(db)
        ensure_shopaid_config(db)
        ensure_telephony_config(db)

        admin = _ensure_user(
            db,
            email=admin_email,
            full_name="System Administrator",
            password=admin_password,
            role_codes=[ROLE_SYSTEM_ADMIN],
        )
        print(f"[OK] System Administrator ready: {admin.email}")

        if seed_demo:
            pw = demo_password or admin_password
            # Synthetic Zones (Coimbatore & Madurai zones for realistic multi-branch testing)
            z_west = db.scalar(select(Zone).where(Zone.code == "TN-WEST"))
            if not z_west:
                z_west = Zone(code="TN-WEST", name="West Tamil Nadu Zone", region_description="Coimbatore & Pollachi branches")
                db.add(z_west)
            z_south = db.scalar(select(Zone).where(Zone.code == "TN-SOUTH"))
            if not z_south:
                z_south = Zone(code="TN-SOUTH", name="South Tamil Nadu Zone", region_description="Madurai & Trichy branches")
                db.add(z_south)
            db.flush()

            # Synthetic Branches
            b_rs = db.scalar(select(Branch).where(Branch.code == "CBE-RSP"))
            if not b_rs:
                b_rs = Branch(
                    zone_id=z_west.id,
                    code="CBE-RSP",
                    name="Thulasi Pharmacy — RS Puram",
                    city="Coimbatore",
                    address="DB Road, RS Puram, Coimbatore",
                    phone_number="0422-2540100",
                    operating_hours="08:00 - 22:00",
                    escalation_overdue_minutes=60,
                )
                db.add(b_rs)
            b_gandhi = db.scalar(select(Branch).where(Branch.code == "CBE-GP"))
            if not b_gandhi:
                b_gandhi = Branch(
                    zone_id=z_west.id,
                    code="CBE-GP",
                    name="Thulasi Pharmacy — Gandhipuram",
                    city="Coimbatore",
                    address="Cross Cut Road, Gandhipuram, Coimbatore",
                    phone_number="0422-2490200",
                    operating_hours="08:00 - 22:00",
                    escalation_overdue_minutes=60,
                )
                db.add(b_gandhi)
            b_mdu = db.scalar(select(Branch).where(Branch.code == "MDU-KKN"))
            if not b_mdu:
                b_mdu = Branch(
                    zone_id=z_south.id,
                    code="MDU-KKN",
                    name="Thulasi Pharmacy — KK Nagar",
                    city="Madurai",
                    address="Alagar Kovil Road, KK Nagar, Madurai",
                    phone_number="0452-2580300",
                    operating_hours="08:00 - 21:30",
                    escalation_overdue_minutes=60,
                )
                db.add(b_mdu)
            db.flush()

            # Synthetic Role Users (no real personal data)
            owner = _ensure_user(
                db,
                email="owner@thulasipharmacy.local",
                full_name="Managing Director (Owner)",
                password=pw,
                role_codes=[ROLE_OWNER],
            )
            zm_west = _ensure_user(
                db,
                email="zonal.west@thulasipharmacy.local",
                full_name="Karthik Subramanian (Zonal Mgr - West)",
                password=pw,
                role_codes=[ROLE_ZONAL_MANAGER],
                zone_id=z_west.id,
                emp_code="ZM-W01",
                designation="Zonal Manager",
            )
            zm_south = _ensure_user(
                db,
                email="zonal.south@thulasipharmacy.local",
                full_name="Meenakshi Sundaram (Zonal Mgr - South)",
                password=pw,
                role_codes=[ROLE_ZONAL_MANAGER],
                zone_id=z_south.id,
                emp_code="ZM-S01",
                designation="Zonal Manager",
            )
            bm_rs = _ensure_user(
                db,
                email="manager.rspuram@thulasipharmacy.local",
                full_name="Arun Kumar (Branch Mgr - RS Puram)",
                password=pw,
                role_codes=[ROLE_BRANCH_MANAGER],
                branch_id=b_rs.id,
                zone_id=z_west.id,
                emp_code="BM-RS01",
                designation="Branch Manager",
            )
            bm_mdu = _ensure_user(
                db,
                email="manager.madurai@thulasipharmacy.local",
                full_name="Lakshmi Narayanan (Branch Mgr - Madurai)",
                password=pw,
                role_codes=[ROLE_BRANCH_MANAGER],
                branch_id=b_mdu.id,
                zone_id=z_south.id,
                emp_code="BM-MD01",
                designation="Branch Manager",
            )
            ph_rs_1 = _ensure_user(
                db,
                email="pharmacist.rspuram@thulasipharmacy.local",
                full_name="Priya Dharshini (Pharmacist)",
                password=pw,
                role_codes=[ROLE_PHARMACIST],
                branch_id=b_rs.id,
                zone_id=z_west.id,
                emp_code="PH-RS01",
                designation="Senior Pharmacist",
            )
            ph_mdu_1 = _ensure_user(
                db,
                email="pharmacist.madurai@thulasipharmacy.local",
                full_name="Vignesh Raj (Pharmacist)",
                password=pw,
                role_codes=[ROLE_PHARMACIST],
                branch_id=b_mdu.id,
                zone_id=z_south.id,
                emp_code="PH-MD01",
                designation="Pharmacist",
            )

            z_west.zonal_manager_user_id = zm_west.id
            z_south.zonal_manager_user_id = zm_south.id
            b_rs.branch_manager_user_id = bm_rs.id
            b_gandhi.branch_manager_user_id = bm_rs.id
            b_mdu.branch_manager_user_id = bm_mdu.id
            db.flush()

            # Seed synthetic operational data only if no calls exist yet
            if db.scalar(select(Call.id).limit(1)) is None:
                now = datetime.now(UTC)
                emp_rs = db.scalar(select(Employee).where(Employee.user_id == ph_rs_1.id))
                emp_mdu = db.scalar(select(Employee).where(Employee.user_id == ph_mdu_1.id))
                out_inquiry = db.scalar(select(CallOutcome).where(CallOutcome.code == "medicine_inquiry_logged"))
                out_avail = db.scalar(select(CallOutcome).where(CallOutcome.code == "availability_confirmed"))

                c1 = Customer(branch_id=b_rs.id, full_name="Synthetic Customer A", phone_number="9840000101", preferred_language="ta-en")
                c2 = Customer(branch_id=b_mdu.id, full_name="Synthetic Customer B", phone_number="9840000202", preferred_language="en")
                db.add_all([c1, c2])
                db.flush()

                call1 = Call(
                    call_reference="TC-SYNTH-0001",
                    branch_id=b_rs.id,
                    employee_id=emp_rs.id if emp_rs else None,
                    customer_id=c1.id,
                    customer_name_snapshot=c1.full_name,
                    customer_phone_snapshot=c1.phone_number,
                    call_direction="inbound",
                    call_source_type="manual_telephone_call",
                    attendance_status="attended",
                    registration_status="registered",
                    outcome_id=out_inquiry.id if out_inquiry else None,
                    summary="Customer asked about Telma 40mg stock availability and MRP for 2 strips.",
                    detected_language="ta-en",
                    started_at=now - timedelta(hours=3),
                    ended_at=now - timedelta(hours=2, minutes=56),
                )
                call2 = Call(
                    call_reference="TC-SYNTH-0002",
                    branch_id=b_mdu.id,
                    employee_id=emp_mdu.id if emp_mdu else None,
                    customer_id=c2.id,
                    customer_name_snapshot=c2.full_name,
                    customer_phone_snapshot=c2.phone_number,
                    call_direction="inbound",
                    call_source_type="manual_telephone_call",
                    attendance_status="attended",
                    registration_status="completed",
                    outcome_id=out_avail.id if out_avail else None,
                    summary="Confirmed Dolo 650mg availability for evening branch pickup.",
                    detected_language="en",
                    started_at=now - timedelta(hours=1),
                    ended_at=now - timedelta(minutes=57),
                )
                db.add_all([call1, call2])
                db.flush()

                tr1 = CallTranscript(
                    call_id=call1.id,
                    full_text="Hello, Telma 40mg 2 strips stock irukka? Price evlo aagum?",
                    language_detected="ta-en",
                    model_used="manual-synthetic-seed",
                    review_status="employee_edited",
                )
                db.add(tr1)
                db.flush()
                sp1 = Speaker(transcript_id=tr1.id, speaker_label="Speaker 1", identity_status="unverified")
                db.add(sp1)
                db.flush()
                db.add(
                    TranscriptSegment(
                        transcript_id=tr1.id,
                        speaker_id=sp1.id,
                        speaker_label="Speaker 1",
                        sequence_index=0,
                        start_seconds=0.0,
                        end_seconds=4.5,
                        text="Hello, Telma 40mg 2 strips stock irukka? Price evlo aagum?",
                        language="ta-en",
                        confidence=0.92,
                        is_edited=True,
                    )
                )

                req1 = MedicineRequest(
                    request_reference="REQ-SYNTH-0001",
                    branch_id=b_rs.id,
                    call_id=call1.id,
                    customer_id=c1.id,
                    customer_name_snapshot=c1.full_name,
                    customer_phone_snapshot=c1.phone_number,
                    assigned_employee_id=emp_rs.id if emp_rs else None,
                    created_by_user_id=ph_rs_1.id,
                    status="waiting_for_stock",
                    priority="high",
                    inquiry_type="availability_and_price",
                    employee_notes="Check distributor restock ETA and call customer back.",
                    required_followup_at=now - timedelta(minutes=90),
                )
                req2 = MedicineRequest(
                    request_reference="REQ-SYNTH-0002",
                    branch_id=b_mdu.id,
                    call_id=call2.id,
                    customer_id=c2.id,
                    customer_name_snapshot=c2.full_name,
                    customer_phone_snapshot=c2.phone_number,
                    assigned_employee_id=emp_mdu.id if emp_mdu else None,
                    created_by_user_id=ph_mdu_1.id,
                    status="resolved",
                    priority="normal",
                    inquiry_type="availability",
                    resolution_details="Confirmed in stock at KK Nagar counter.",
                    resolved_at=now - timedelta(minutes=40),
                )
                db.add_all([req1, req2])
                db.flush()

                db.add_all(
                    [
                        MedicineRequestItem(
                            request_id=req1.id,
                            medicine_name="Telma",
                            strength="40mg",
                            dosage_form="tablet",
                            quantity="2 strips",
                            availability_status="order_required",
                            price_inquiry=True,
                            verification_status="employee_confirmed",
                        ),
                        MedicineRequestItem(
                            request_id=req2.id,
                            medicine_name="Dolo",
                            strength="650mg",
                            dosage_form="tablet",
                            quantity="1 strip",
                            availability_status="available",
                            price_inquiry=False,
                            verification_status="employee_confirmed",
                        ),
                        RequestStatusHistory(
                            request_id=req1.id,
                            from_status=None,
                            to_status="new",
                            changed_by_user_id=ph_rs_1.id,
                            note="Created from synthetic call TC-SYNTH-0001.",
                        ),
                        RequestStatusHistory(
                            request_id=req1.id,
                            from_status="new",
                            to_status="waiting_for_stock",
                            changed_by_user_id=ph_rs_1.id,
                            note="Stock check pending with supplier.",
                        ),
                        RequestStatusHistory(
                            request_id=req2.id,
                            from_status="new",
                            to_status="resolved",
                            changed_by_user_id=ph_mdu_1.id,
                            note="Confirmed stock available.",
                        ),
                    ]
                )

                if emp_rs:
                    db.add(
                        FollowUp(
                            branch_id=b_rs.id,
                            call_id=call1.id,
                            request_id=req1.id,
                            customer_id=c1.id,
                            assigned_employee_id=emp_rs.id,
                            created_by_user_id=ph_rs_1.id,
                            title="Callback Synthetic Customer A on Telma 40mg restock",
                            notes="Confirm distributor delivery time and quote MRP.",
                            due_at=now - timedelta(minutes=90),
                            priority="high",
                            status="pending",
                        )
                    )
                    db.flush()
                    evaluate_overdue_followups_and_escalations(db)

            print("[OK] Synthetic demo organization, role accounts, and sample records ready:")
            print(f"     Owner:          {owner.email}")
            print(f"     Zonal West:     {zm_west.email}")
            print(f"     Zonal South:    {zm_south.email}")
            print(f"     Branch RS:      {bm_rs.email}")
            print(f"     Branch Madurai: {bm_mdu.email}")
            print(f"     Pharmacist RS:  {ph_rs_1.email}")
            print(f"     Pharmacist MDU: {ph_mdu_1.email}")

        db.commit()
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Bootstrap ThulasiConnect System Administrator and optional synthetic dev org.")
    parser.add_argument("--email", default=os.getenv("BOOTSTRAP_ADMIN_EMAIL", "admin@thulasipharmacy.local"))
    parser.add_argument("--password", default=os.getenv("BOOTSTRAP_ADMIN_PASSWORD"))
    parser.add_argument("--seed-demo", action="store_true", help="Seed synthetic zones, branches, role accounts, and sample records.")
    parser.add_argument("--demo-password", default=os.getenv("BOOTSTRAP_DEMO_PASSWORD"))
    args = parser.parse_args()

    password = args.password
    if not password:
        if sys.stdin.isatty():
            password = getpass.getpass("Enter password for initial System Administrator (min 8 chars): ")
        else:
            print("ERROR: Provide --password or BOOTSTRAP_ADMIN_PASSWORD environment variable.", file=sys.stderr)
            sys.exit(1)

    if len(password) < 8:
        print("ERROR: Password must be at least 8 characters.", file=sys.stderr)
        sys.exit(1)

    run_bootstrap(args.email, password, args.seed_demo, args.demo_password)


if __name__ == "__main__":
    main()
