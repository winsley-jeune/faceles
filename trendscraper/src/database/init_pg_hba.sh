#!/bin/bash
# Copy custom pg_hba.conf to PostgreSQL data directory
echo "Installing custom pg_hba.conf for development (TRUST authentication)..."
cp /docker-entrypoint-initdb.d/02-pg_hba.conf /var/lib/postgresql/data/pg_hba.conf
chown postgres:postgres /var/lib/postgresql/data/pg_hba.conf
chmod 600 /var/lib/postgresql/data/pg_hba.conf
echo "pg_hba.conf installed successfully!"
