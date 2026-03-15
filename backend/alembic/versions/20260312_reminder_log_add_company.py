"""Add company_id to reminder_logs and make contact_id nullable

Revision ID: 20260312_reminder_log_add_company
Revises: add_contact_details
Create Date: 2026-03-12
"""
from alembic import op
import sqlalchemy as sa

revision = '20260312_reminder_log_add_company'
down_revision = 'add_contact_details'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('reminder_logs') as batch_op:
        batch_op.add_column(sa.Column('company_id', sa.Integer(), nullable=True))
        batch_op.alter_column('contact_id', existing_type=sa.Integer(), nullable=True)
        batch_op.create_foreign_key(
            'fk_reminder_logs_company_id',
            'companies', ['company_id'], ['id']
        )
        batch_op.create_index('ix_reminder_logs_company_id', ['company_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('reminder_logs') as batch_op:
        batch_op.drop_index('ix_reminder_logs_company_id')
        batch_op.drop_constraint('fk_reminder_logs_company_id', type_='foreignkey')
        batch_op.alter_column('contact_id', existing_type=sa.Integer(), nullable=False)
        batch_op.drop_column('company_id')
