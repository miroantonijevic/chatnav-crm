"""Add soft-delete columns to contacts and companies

Revision ID: 20260313_add_soft_delete
Revises: 20260312_reminder_log_add_company
Create Date: 2026-03-13
"""
from alembic import op
import sqlalchemy as sa

revision = '20260313_add_soft_delete'
down_revision = '20260312_reminder_log_add_company'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('contacts') as batch_op:
        batch_op.add_column(sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('deleted_at', sa.DateTime(), nullable=True))
        batch_op.create_index('ix_contacts_is_deleted', ['is_deleted'], unique=False)

    with op.batch_alter_table('companies') as batch_op:
        batch_op.add_column(sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('deleted_at', sa.DateTime(), nullable=True))
        batch_op.create_index('ix_companies_is_deleted', ['is_deleted'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('companies') as batch_op:
        batch_op.drop_index('ix_companies_is_deleted')
        batch_op.drop_column('deleted_at')
        batch_op.drop_column('is_deleted')

    with op.batch_alter_table('contacts') as batch_op:
        batch_op.drop_index('ix_contacts_is_deleted')
        batch_op.drop_column('deleted_at')
        batch_op.drop_column('is_deleted')
