"""Replace priority with an is_hot flag and drop favorites

Hot priority becomes is_hot = true; warm/cold become false.

Revision ID: 20260316_hot_flag
Revises: 20260315_deal_favorites
Create Date: 2026-03-16
"""
from alembic import op
import sqlalchemy as sa

revision = '20260316_hot_flag'
down_revision = '20260315_deal_favorites'
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ('contacts', 'companies'):
        with op.batch_alter_table(table) as batch_op:
            batch_op.add_column(sa.Column('is_hot', sa.Boolean(), nullable=False, server_default=sa.false()))
        op.execute(f"UPDATE {table} SET is_hot = 1 WHERE priority = 'HOT' OR priority = 'hot'")
        with op.batch_alter_table(table) as batch_op:
            batch_op.drop_index(f'ix_{table}_priority')
            batch_op.drop_column('priority')
            batch_op.create_index(f'ix_{table}_is_hot', ['is_hot'], unique=False)

    op.drop_index('ix_user_favorites_entity', table_name='user_favorites')
    op.drop_index('ix_user_favorites_user_id', table_name='user_favorites')
    op.drop_table('user_favorites')


def downgrade() -> None:
    op.create_table(
        'user_favorites',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('entity_type', sa.String(length=10), nullable=False),
        sa.Column('entity_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('user_id', 'entity_type', 'entity_id', name='uq_user_favorite'),
    )
    op.create_index('ix_user_favorites_user_id', 'user_favorites', ['user_id'])
    op.create_index('ix_user_favorites_entity', 'user_favorites', ['entity_type', 'entity_id'])

    for table in ('companies', 'contacts'):
        with op.batch_alter_table(table) as batch_op:
            batch_op.add_column(sa.Column('priority', sa.String(length=10), nullable=True))
        op.execute(f"UPDATE {table} SET priority = 'HOT' WHERE is_hot = 1")
        with op.batch_alter_table(table) as batch_op:
            batch_op.drop_index(f'ix_{table}_is_hot')
            batch_op.drop_column('is_hot')
            batch_op.create_index(f'ix_{table}_priority', ['priority'], unique=False)
