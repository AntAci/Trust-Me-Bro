#!/usr/bin/env python3
"""
Excel → Neon Postgres Ingestion Script

Loads SupportMind__Final_Data.xlsx into Neon Postgres database.
Reads DATABASE_URL from .env file.

Usage:
    python -m ingest.load_excel_to_neon
    
    # Or with explicit path:
    python -m ingest.load_excel_to_neon --excel data/raw/SupportMind__Final_Data.xlsx
"""

import os
import re
import argparse
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Load environment variables
load_dotenv()

# Sheet → Table mapping
SHEET_TABLE_MAPPING = {
    "Tickets": "tickets",
    "Conversations": "conversations",
    "Knowledge_Articles": "knowledge_articles",
    "Existing_Knowledge_Articles": "existing_knowledge_articles",
    "Learning_Events": "learning_events",
    "Scripts_Master": "scripts_master",
    "Placeholder_Dictionary": "placeholder_dictionary",
    "KB_Lineage": "kb_lineage",
}

# Sheets to ignore
IGNORE_SHEETS = {"README", "Questions", "QA_Evaluation_Prompt"}


def normalize_column_name(col: str) -> str:
    """Convert column name to snake_case."""
    # Replace spaces and special chars with underscore
    col = re.sub(r"[^\w]+", "_", col.strip())
    # Convert CamelCase to snake_case
    col = re.sub(r"([a-z])([A-Z])", r"\1_\2", col)
    # Lowercase and remove leading/trailing underscores
    col = col.lower().strip("_")
    return col


def load_excel(excel_path: str) -> dict[str, pd.DataFrame]:
    """Load all relevant sheets from Excel file."""
    print(f"📂 Loading Excel file: {excel_path}")
    xl = pd.ExcelFile(excel_path)
    
    sheets = {}
    for sheet_name in xl.sheet_names:
        if sheet_name in IGNORE_SHEETS:
            print(f"  ⏭️  Skipping sheet: {sheet_name}")
            continue
        if sheet_name not in SHEET_TABLE_MAPPING:
            print(f"  ⚠️  Unknown sheet (skipping): {sheet_name}")
            continue
            
        df = pd.read_excel(xl, sheet_name=sheet_name)
        # Normalize column names
        df.columns = [normalize_column_name(c) for c in df.columns]
        sheets[sheet_name] = df
        print(f"  ✅ Loaded {sheet_name}: {len(df)} rows, {len(df.columns)} columns")
    
    return sheets


def apply_schema(engine) -> None:
    """Apply database schema from schema.sql."""
    schema_path = Path(__file__).parent.parent / "db" / "schema.sql"
    
    if not schema_path.exists():
        raise FileNotFoundError(f"Schema file not found: {schema_path}")
    
    print(f"📋 Applying schema from: {schema_path}")
    schema_sql = schema_path.read_text()
    
    with engine.connect() as conn:
        # Execute schema (handles DROP and CREATE)
        conn.execute(text(schema_sql))
        conn.commit()
    
    print("  ✅ Schema applied successfully")


def insert_dataframe(engine, table_name: str, df: pd.DataFrame) -> int:
    """Insert DataFrame into table. Returns row count."""
    if df.empty:
        print(f"  ⚠️  {table_name}: Empty dataframe, skipping")
        return 0
    
    # Convert all columns to string to avoid type issues
    df = df.astype(str)
    # Replace 'nan' strings with None
    df = df.replace({"nan": None, "NaN": None, "NaT": None})
    
    # Insert using pandas to_sql (append mode, schema already created)
    df.to_sql(
        table_name,
        engine,
        if_exists="append",
        index=False,
        method="multi",  # Batch inserts
    )
    
    return len(df)


def main():
    parser = argparse.ArgumentParser(description="Load Excel data into Neon Postgres")
    parser.add_argument(
        "--excel",
        default="data/raw/SupportMind__Final_Data.xlsx",
        help="Path to Excel file",
    )
    parser.add_argument(
        "--skip-schema",
        action="store_true",
        help="Skip schema application (use existing tables)",
    )
    args = parser.parse_args()
    
    # Get database URL
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL not found in environment. Check .env file.")
    
    print("🚀 Trust-Me-Bro Excel → Neon Ingestion")
    print("=" * 50)
    
    # Create database engine
    engine = create_engine(database_url)
    print(f"🔌 Connected to database")
    
    # Apply schema (drops and recreates tables)
    if not args.skip_schema:
        apply_schema(engine)
    else:
        print("⏭️  Skipping schema application")
    
    # Load Excel sheets
    sheets = load_excel(args.excel)
    
    # Insert data into tables
    print("\n📥 Inserting data into tables...")
    total_rows = 0
    
    for sheet_name, df in sheets.items():
        table_name = SHEET_TABLE_MAPPING[sheet_name]
        try:
            rows = insert_dataframe(engine, table_name, df)
            total_rows += rows
            print(f"  ✅ {table_name}: {rows} rows inserted")
        except Exception as e:
            print(f"  ❌ {table_name}: Error - {e}")
            raise
    
    print("\n" + "=" * 50)
    print(f"✅ Ingestion complete! Total rows: {total_rows}")
    
    # Verify counts
    print("\n📊 Verification (row counts):")
    with engine.connect() as conn:
        for table_name in SHEET_TABLE_MAPPING.values():
            result = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
            count = result.scalar()
            print(f"  {table_name}: {count} rows")


if __name__ == "__main__":
    main()
