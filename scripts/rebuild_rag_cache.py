#!/usr/bin/env python3
"""
Rebuild RAG Cache Script

Run this after updating data/menu.json or data/facts.json.
Pre-builds the FAISS + BM25 index so the server starts instantly
and no user request ever triggers an index rebuild.

Usage:
    ./scripts/rebuild_rag_cache.py
    ./scripts/rebuild_rag_cache.py --force    # Rebuild even if menu is unchanged
"""

import sys
import os
import time
import argparse
import hashlib

# Ensure project root is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(override=True)

import config


def get_data_hash() -> str:
    """Combined hash of menu.json + facts.json — must match RAGRetriever._get_data_hash()."""
    h = hashlib.md5()
    for path in (config.MENU_PATH, config.FACTS_PATH):
        try:
            with open(path, 'rb') as f:
                h.update(f.read())
        except (FileNotFoundError, IOError):
            pass
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description="Rebuild the GAC RAG cache.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force rebuild even if menu.json is unchanged."
    )
    args = parser.parse_args()

    cache_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "cache", "rag")
    metadata_path = os.path.join(cache_dir, "metadata.json")

    # Check if rebuild is actually needed (unless --force)
    if not args.force and os.path.exists(metadata_path):
        import json
        with open(metadata_path, 'r') as f:
            cached_meta = json.load(f)
        current_hash = get_data_hash()
        if cached_meta.get("data_hash") == current_hash:
            print("✓ Cache is already up-to-date (menu.json and facts.json unchanged).")
            print("  Use --force to rebuild anyway.")
            return

    print("Building RAG cache...")
    print(f"  Menu:  {config.MENU_PATH}")
    print(f"  Facts: {config.FACTS_PATH}")
    print(f"  Cache: {cache_dir}")
    print()

    start = time.time()

    # Wipe existing cache so RAGRetriever is forced to rebuild from scratch
    import shutil
    if os.path.exists(cache_dir):
        shutil.rmtree(cache_dir)
    os.makedirs(cache_dir, exist_ok=True)

    # Import after path setup
    from backend.rag_retriever import RAGRetriever

    retriever = RAGRetriever()
    elapsed = time.time() - start

    menu_items = [i for i in retriever.menu_items if i.get("type") == "menu_item"]
    fact_items = [i for i in retriever.menu_items if i.get("type") == "general_info"]

    print(f"✓ Cache built in {elapsed:.1f}s")
    print(f"  {len(menu_items)} menu items indexed")
    print(f"  {len(fact_items)} fact entries indexed")
    print(f"  Saved to: {cache_dir}")


if __name__ == "__main__":
    main()
