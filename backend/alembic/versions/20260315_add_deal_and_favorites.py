"""Add deal fields to contacts/companies and the user_favorites table

Revision ID: 20260315_deal_favorites
Revises: 20260314_add_pipeline_fields
Create Date: 2026-03-15
"""
from alembic import op
import sqlalchemy as sa

revision = '20260315_deal_favorites'
down_revision = '20260314_add_pipeline_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table in ('contacts', 'companies'):
        with op.batch_alter_table(table) as batch_op:
            batch_op.add_column(sa.Column('deal_value', sa.Float(), nullable=True))
            batch_op.add_column(sa.Column('deal_value_period', sa.String(length=20), nullable=True))
            batch_op.add_column(sa.Column('deal_stage', sa.String(length=20), nullable=True))
            batch_op.add_column(sa.Column('waiting_on', sa.String(length=10), nullable=True))
            batch_op.create_index(f'ix_{table}_deal_stage', ['deal_stage'], unique=False)

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


def downgrade() -> None:
    op.drop_index('ix_user_favorites_entity', table_name='user_favorites')
    op.drop_index('ix_user_favorites_user_id', table_name='user_favorites')
    op.drop_table('user_favorites')

    for table in ('companies', 'contacts'):
        with op.batch_alter_table(table) as batch_op:
            batch_op.drop_index(f'ix_{table}_deal_stage')
            batch_op.drop_column('waiting_on')
            batch_op.drop_column('deal_stage')
            batch_op.drop_column('deal_value_period')
            batch_op.drop_column('deal_value')
