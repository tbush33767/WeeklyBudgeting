#!/bin/bash
# Script to view the entire database in a readable format

DB_PATH="server/db/budget.db"

echo "=========================================="
echo "DATABASE: $DB_PATH"
echo "=========================================="
echo ""

# Get all table names
TABLES=$(sqlite3 "$DB_PATH" ".tables")

for table in $TABLES; do
    echo "=========================================="
    echo "TABLE: $table"
    echo "=========================================="
    
    # Get row count
    COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM $table;")
    echo "Total rows: $COUNT"
    echo ""
    
    # Show table structure
    echo "Structure:"
    sqlite3 "$DB_PATH" ".schema $table"
    echo ""
    
    # Show all data
    if [ "$COUNT" -gt 0 ]; then
        echo "Data:"
        sqlite3 "$DB_PATH" -header -column "SELECT * FROM $table;"
    else
        echo "Data: (empty)"
    fi
    
    echo ""
    echo ""
done

echo "=========================================="
echo "END OF DATABASE DUMP"
echo "=========================================="

