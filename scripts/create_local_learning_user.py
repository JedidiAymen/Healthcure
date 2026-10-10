"""Provision one local educator, student or admin account using an interactive password prompt."""
from __future__ import annotations

import argparse
import getpass
import re
import sys
import uuid
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'apps'/'api'))


def main() -> None:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--username',required=True)
    parser.add_argument('--display-name',required=True)
    parser.add_argument('--role',choices=('educator','student','admin'),required=True,
        help='admin can save research evidence and use educator routes; it is not production identity')
    args=parser.parse_args()
    username=args.username.strip()
    if not re.fullmatch(r'[A-Za-z0-9._-]{3,64}',username):
        parser.error('username must be 3–64 letters, numbers, dots, underscores or hyphens')
    if not args.display_name.strip() or len(args.display_name)>100:
        parser.error('display name must contain 1–100 characters')
    # Imported after argument parsing: importing the app initialises the database.
    from app.auth import password_record
    from app.main import _db, init_db
    password=getpass.getpass('Password (12+ characters): ')
    confirmation=getpass.getpass('Confirm password: ')
    if len(password)<12:
        parser.error('password must be at least 12 characters')
    if password!=confirmation:
        parser.error('password entries do not match')
    salt,digest=password_record(password)
    init_db()
    user_id=str(uuid.uuid4())
    try:
        with _db() as conn:
            conn.execute('INSERT INTO users(id,display_name) VALUES(?,?)',(user_id,args.display_name.strip()))
            conn.execute('INSERT INTO local_credentials(user_id,username,salt,password_hash) VALUES(?,?,?,?)',(user_id,username,salt,digest))
            conn.execute('INSERT INTO role_grants(user_id,role,scope) VALUES(?,?,?)',(user_id,args.role,'platform'))
    except Exception as error:
        raise SystemExit(f'Account was not created: {error}') from error
    print(f'Created local {args.role} account {username!r} ({user_id}). The password was not saved or printed.')


if __name__=='__main__':main()
