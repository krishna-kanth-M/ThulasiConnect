"""Modular Telephony & Audio-Source Adapter Interface.

Clearly separates:
1. Browser Microphone Prototype (`browser_microphone_test`) — active for local testing.
2. Manual Telephone Call Registration (`manual_telephone_call`) — active fallback.
3. Verified Pharmacy Telephony Integration (`verified_telephony_integration`) — SIP/PBX/IP Telephony
   adapter stub, clearly marked DISCONNECTED until real authorized telephony hardware/SIP is connected.
"""

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.workflow import IntegrationConfig

TELEPHONY_KEY = "telephony_pbx"


def ensure_telephony_config(db: Session) -> IntegrationConfig:
    cfg = db.scalar(select(IntegrationConfig).where(IntegrationConfig.integration_key == TELEPHONY_KEY))
    if not cfg:
        cfg = IntegrationConfig(
            integration_key=TELEPHONY_KEY,
            display_name="Pharmacy Telephony / SIP / PBX Adapter",
            status="disconnected",
            mode="webhook_listener",
            endpoint_url=None,
            status_message=(
                "Disconnected: No physical PBX, SIP trunk, or IP-telephony stream is connected yet. "
                "Use Browser Microphone mode (prototype) or Manual Call Registration until telephony hardware is integrated."
            ),
            config_json=json.dumps(
                {
                    "supported_future_protocols": ["SIP", "Asterisk AMI/ARI", "FreePBX Webhook", "Cloud IP Telephony"],
                    "audio_recording_retention": "disabled_permanently",
                    "browser_microphone_available": True,
                    "manual_registration_available": True,
                }
            ),
        )
        db.add(cfg)
        db.flush()
    return cfg
