#!/usr/bin/env python3
"""
Deploy the CRM to production.

Usage:
    python deploy.py
"""
import subprocess
import sys

SERVER = "root@crm.chatnav.ai"
APP_DIR = "/root/chatnav-crm"

REMOTE_COMMANDS = " && ".join([
    f"cd {APP_DIR}",
    "git pull",
    "docker compose -f docker-compose.prod.yml up -d --build",
])

def run(cmd):
    print(f"$ {' '.join(cmd)}")
    result = subprocess.run(cmd)
    if result.returncode != 0:
        print("Command failed.")
        sys.exit(result.returncode)

print(f"Deploying to {SERVER}...")
run(["ssh", SERVER, REMOTE_COMMANDS])
print("Deploy complete.")
