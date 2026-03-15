"""add contact contact details

Revision ID: add_contact_details
Revises: add_companies
Create Date: 2026-03-12

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_contact_details'
down_revision = 'add_companies'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'contact_contact_details',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contact_id', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(20), nullable=False),
        sa.Column('value', sa.String(500), nullable=False),
        sa.Column('label', sa.String(100), nullable=True),
        sa.ForeignKeyConstraint(['contact_id'], ['contacts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_contact_contact_details_contact_id', 'contact_contact_details', ['contact_id'])
    op.create_index('ix_contact_contact_details_id', 'contact_contact_details', ['id'])


def downgrade() -> None:
    op.drop_index('ix_contact_contact_details_contact_id', table_name='contact_contact_details')
    op.drop_index('ix_contact_contact_details_id', table_name='contact_contact_details')
    op.drop_table('contact_contact_details')
