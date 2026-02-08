from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable, List, Tuple

import pandas as pd
from sqlalchemy.orm import sessionmaker

from db.models import EvidenceUnit


REQUIRED_COLUMNS = {
    "Tickets": ["Ticket_Number", "Conversation_ID", "Script_ID", "KB_Article_ID"],
    "Conversations": ["Ticket_Number", "Conversation_ID"],
    "Scripts_Master": ["Script_ID", "Script_Text_Sanitized", "Script_Purpose"],
    "Placeholder_Dictionary": ["Placeholder", "Meaning", "Example"],
}


@dataclass(frozen=True)
class Chunk:
    text: str
    start: int
    end: int
    index: int


def load_workbook_to_db(workbook_path: str, engine) -> dict[str, int]:
    counts: dict[str, int] = {}
    for sheet_name in REQUIRED_COLUMNS:
        df = pd.read_excel(workbook_path, sheet_name=sheet_name, dtype=str)
        missing = [c for c in REQUIRED_COLUMNS[sheet_name] if c not in df.columns]
        if missing:
            raise ValueError(f"Missing columns in {sheet_name}: {missing}")
        df.to_sql(f"raw_{sheet_name.lower()}", engine, if_exists="replace", index=False)
        counts[sheet_name] = int(df.shape[0])
    return counts


def extract_evidence_units(engine) -> int:
    session = sessionmaker(bind=engine)()
    try:
        session.query(EvidenceUnit).delete()
        session.commit()

        total = 0
        total += _extract_ticket_evidence(session, engine)
        total += _extract_conversation_evidence(session, engine)
        total += _extract_script_evidence(session, engine)
        total += _extract_placeholder_evidence(session, engine)
        session.commit()
        return total
    finally:
        session.close()


def build_evidence_unit_id(
    source_type: str, source_id: str, field_name: str, offset_start: int
) -> str:
    return f"EU-{source_type}-{source_id}-{field_name}-{offset_start}"


def _extract_ticket_evidence(session, engine) -> int:
    df = pd.read_sql_query("SELECT * FROM raw_tickets", engine)
    count = 0
    for _, row in df.iterrows():
        ticket_id = _safe_str(row.get("Ticket_Number"))
        if not ticket_id:
            continue
        fields = {
            "Subject": _safe_str(row.get("Subject")),
            "Description": _safe_str(row.get("Description")),
            "Root_Cause": _safe_str(row.get("Root_Cause")),
            "Resolution": _safe_str(row.get("Resolution")),
        }
        for field_name, value in fields.items():
            if not value:
                continue
            if field_name == "Resolution":
                chunks = _split_resolution(value)
            else:
                chunks = _split_paragraph_then_sentence(value)
            count += _insert_chunks(
                session,
                "TICKET",
                ticket_id,
                field_name,
                value,
                chunks,
            )
    return count


def _extract_conversation_evidence(session, engine) -> int:
    df = pd.read_sql_query("SELECT * FROM raw_conversations", engine)
    count = 0
    for _, row in df.iterrows():
        conv_id = _safe_str(row.get("Conversation_ID"))
        if not conv_id:
            continue
        issue_summary = _safe_str(row.get("Issue_Summary"))
        transcript = _safe_str(row.get("Transcript"))
        if issue_summary:
            chunks = _split_sentenceish(issue_summary)
            count += _insert_chunks(
                session,
                "CONVERSATION",
                conv_id,
                "Issue_Summary",
                issue_summary,
                chunks,
            )
        if transcript:
            chunks = _split_lines(transcript)
            count += _insert_chunks(
                session,
                "CONVERSATION",
                conv_id,
                "Transcript",
                transcript,
                chunks,
            )
    return count


def _extract_script_evidence(session, engine) -> int:
    df = pd.read_sql_query("SELECT * FROM raw_scripts_master", engine)
    count = 0
    for _, row in df.iterrows():
        script_id = _safe_str(row.get("Script_ID"))
        if not script_id:
            continue
        script_text = _safe_str(row.get("Script_Text_Sanitized"))
        script_purpose = _safe_str(row.get("Script_Purpose"))
        if script_text:
            chunks = _split_script_text(script_text)
            count += _insert_chunks(
                session,
                "SCRIPT",
                script_id,
                "Script_Text_Sanitized",
                script_text,
                chunks,
            )
        if script_purpose:
            chunks = _split_sentenceish(script_purpose)
            count += _insert_chunks(
                session,
                "SCRIPT",
                script_id,
                "Script_Purpose",
                script_purpose,
                chunks,
            )
    return count


def _extract_placeholder_evidence(session, engine) -> int:
    df = pd.read_sql_query("SELECT * FROM raw_placeholder_dictionary", engine)
    count = 0
    for _, row in df.iterrows():
        placeholder = _safe_str(row.get("Placeholder"))
        meaning = _safe_str(row.get("Meaning"))
        example = _safe_str(row.get("Example"))
        if not placeholder:
            continue
        if meaning:
            chunks = [Chunk(text=meaning, start=0, end=len(meaning), index=0)]
            count += _insert_chunks(
                session,
                "PLACEHOLDER",
                placeholder,
                "Meaning",
                meaning,
                chunks,
            )
        if example:
            chunks = [Chunk(text=example, start=0, end=len(example), index=0)]
            count += _insert_chunks(
                session,
                "PLACEHOLDER",
                placeholder,
                "Example",
                example,
                chunks,
            )
    return count


def _insert_chunks(
    session,
    source_type: str,
    source_id: str,
    field_name: str,
    original_text: str,
    chunks: Iterable[Chunk],
) -> int:
    inserted = 0
    for chunk in chunks:
        snippet = chunk.text.strip()
        if not snippet:
            continue
        evidence_unit_id = build_evidence_unit_id(
            source_type, source_id, field_name, chunk.start
        )
        unit = EvidenceUnit(
            evidence_unit_id=evidence_unit_id,
            source_type=source_type,
            source_id=source_id,
            field_name=field_name,
            char_offset_start=chunk.start,
            char_offset_end=chunk.end,
            chunk_index=chunk.index,
            snippet_text=snippet,
        )
        session.add(unit)
        inserted += 1
    return inserted


def _safe_str(value) -> str:
    if value is None:
        return ""
    return str(value)


def _split_lines(text: str) -> List[Chunk]:
    chunks: List[Chunk] = []
    offset = 0
    index = 0
    for line in text.splitlines(keepends=True):
        line_text = line.rstrip("\n")
        start = offset
        end = offset + len(line_text)
        if line_text.strip():
            chunks.append(Chunk(text=line_text, start=start, end=end, index=index))
            index += 1
        offset += len(line)
    return chunks


def _split_paragraph_then_sentence(text: str) -> List[Chunk]:
    chunks: List[Chunk] = []
    index = 0
    for para_text, para_start, para_end in _split_by_blank_lines(text):
        for sentence in _split_sentenceish(para_text):
            start = para_start + sentence.start
            end = para_start + sentence.end
            chunks.append(Chunk(text=sentence.text, start=start, end=end, index=index))
            index += 1
    return chunks


def _split_sentenceish(text: str) -> List[Chunk]:
    chunks: List[Chunk] = []
    index = 0
    for match in re.finditer(r"[^.!?\n]+[.!?]?", text):
        segment = match.group(0).strip()
        if len(segment) < 8:
            continue
        start = match.start()
        end = match.start() + len(match.group(0).rstrip())
        chunks.append(Chunk(text=segment, start=start, end=end, index=index))
        index += 1
    if not chunks and text.strip():
        chunks.append(Chunk(text=text.strip(), start=0, end=len(text), index=0))
    return chunks


def _split_resolution(text: str) -> List[Chunk]:
    chunks: List[Chunk] = []
    index = 0
    offset = 0
    for line in text.splitlines(keepends=True):
        line_text = line.rstrip("\n")
        if not line_text.strip():
            offset += len(line)
            continue
        subchunks = _split_numbered_line(line_text, offset)
        for sub in subchunks:
            chunks.append(Chunk(text=sub.text, start=sub.start, end=sub.end, index=index))
            index += 1
        offset += len(line)
    return chunks


def _split_numbered_line(line_text: str, line_start: int) -> List[Chunk]:
    pattern = re.compile(r"(?:^|\s)(?:\d+[\).\]]|[-*•])\s+")
    matches = list(pattern.finditer(line_text))
    if not matches:
        start = line_start
        end = line_start + len(line_text)
        return [Chunk(text=line_text, start=start, end=end, index=0)]
    chunks: List[Chunk] = []
    boundaries: List[int] = [m.start() for m in matches]
    boundaries.append(len(line_text))
    for i in range(len(boundaries) - 1):
        start_in_line = boundaries[i]
        end_in_line = boundaries[i + 1]
        segment = line_text[start_in_line:end_in_line].strip()
        if not segment:
            continue
        start = line_start + start_in_line
        end = line_start + end_in_line
        chunks.append(Chunk(text=segment, start=start, end=end, index=i))
    return chunks


def _split_script_text(text: str) -> List[Chunk]:
    chunks: List[Chunk] = []
    index = 0
    for para_text, para_start, _ in _split_by_blank_lines(text):
        for line in _split_lines(para_text):
            if not line.text.strip():
                continue
            start = para_start + line.start
            end = para_start + line.end
            chunks.append(Chunk(text=line.text, start=start, end=end, index=index))
            index += 1
    return chunks


def _split_by_blank_lines(text: str) -> List[Tuple[str, int, int]]:
    parts: List[Tuple[str, int, int]] = []
    for match in re.finditer(r"(?:[^\n]|\n(?!\n))+", text):
        segment = match.group(0)
        if segment.strip():
            parts.append((segment, match.start(), match.end()))
    return parts
