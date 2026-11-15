"""Add pipeline fields (priority, next_action) to contacts and companies

Revision ID: 20260314_add_pipeline_fields
Revises: 20260313_add_soft_delete
Create Date: 2026-03-14
"""
from alembic import op
import sqlalchemy as sa

revision = '20260314_add_pipeline_fields'
down_revision = '20260313_add_soft_delete'
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ('contacts', 'companies'):
        with op.batch_alter_table(table) as batch_op:
            batch_op.add_column(sa.Column('priority', sa.String(length=10), nullable=True))
            batch_op.add_column(sa.Column('next_action', sa.String(length=500), nullable=True))
            batch_op.create_index(f'ix_{table}_priority', ['priority'], unique=False)


def downgrade() -> None:
    for table in ('companies', 'contacts'):
        with op.batch_alter_table(table) as batch_op:
            batch_op.drop_index(f'ix_{table}_priority')
            batch_op.drop_column('next_action')
            batch_op.drop_column('priority')
