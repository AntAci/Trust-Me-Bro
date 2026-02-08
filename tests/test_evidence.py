from __future__ import annotations

import pandas as pd
from sqlalchemy import create_engine

from db import init_db
from ingestion.workbook_loader import extract_evidence_units
from db.models import EvidenceUnit


def test_extract_evidence_units_chunking():
    engine = create_engine("sqlite:///:memory:")
    init_db(engine)

    tickets = pd.DataFrame(
        [
            {
                "Ticket_Number": "CS-1",
                "Subject": "Login fails",
                "Description": "User cannot login.\n\nError says invalid token.",
                "Root_Cause": "Token expired.",
                "Resolution": "1. Reset token\n2. Verify login",
            }
        ]
    )
    conversations = pd.DataFrame(
        [
            {
                "Ticket_Number": "CS-1",
                "Conversation_ID": "CONV-1",
                "Issue_Summary": "Login fails for user.",
                "Transcript": "Agent: Hello\nCustomer: I cannot login",
            }
        ]
    )
    scripts = pd.DataFrame(
        [
            {
                "Script_ID": "SCRIPT-1",
                "Script_Text_Sanitized": "use <DATABASE>\n-- Step\nupdate table set x=1",
                "Script_Purpose": "Fix login token.",
            }
        ]
    )
    placeholders = pd.DataFrame(
        [
            {
                "Placeholder": "<DATABASE>",
                "Meaning": "Database name",
                "Example": "use <DATABASE>",
            }
        ]
    )

    tickets.to_sql("raw_tickets", engine, if_exists="replace", index=False)
    conversations.to_sql("raw_conversations", engine, if_exists="replace", index=False)
    scripts.to_sql("raw_scripts_master", engine, if_exists="replace", index=False)
    placeholders.to_sql("raw_placeholder_dictionary", engine, if_exists="replace", index=False)

    count = extract_evidence_units(engine)
    assert count > 0

    units = pd.read_sql_query("SELECT * FROM evidence_units", engine)
    assert not units.empty
    assert all(units["char_offset_end"] >= units["char_offset_start"])
    assert units["evidence_unit_id"].str.startswith("EU-").all()

