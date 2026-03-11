"""add entry_type to relationship_history

Revision ID: add_entry_type_history
Revises: 2bc4d4c31817
Create Date: 2026-03-10

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_entry_type_history'
down_revision = '2bc4d4c31817'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('relationship_history', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('entry_type', sa.String(length=20), nullable=False, server_default='interaction')
        )


def downgrade() -> None:
    with op.batch_alter_table('relationship_history', schema=None) as batch_op:
        batch_op.drop_column('entry_type')
