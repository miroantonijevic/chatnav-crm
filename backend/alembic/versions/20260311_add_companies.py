"""add companies

Revision ID: add_companies
Revises: add_entry_type_history
Create Date: 2026-03-11

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_companies'
down_revision = 'add_entry_type_history'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create companies table
    op.create_table(
        'companies',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('industry', sa.String(length=255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('owner_user_id', sa.Integer(), nullable=False),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.Column('current_relationship_status', sa.Enum(
            'new', 'contacted', 'follow-up-needed', 'interested',
            'not-interested', 'customer', 'inactive',
            name='relationshipstatus'
        ), nullable=False),
        sa.Column('last_contacted_at', sa.DateTime(), nullable=True),
        sa.Column('next_contact_due_at', sa.DateTime(), nullable=True),
        sa.Column('reminders_enabled', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['owner_user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_companies_id'), 'companies', ['id'], unique=False)
    op.create_index(op.f('ix_companies_name'), 'companies', ['name'], unique=False)
    op.create_index(op.f('ix_companies_owner_user_id'), 'companies', ['owner_user_id'], unique=False)
    op.create_index(op.f('ix_companies_created_by_user_id'), 'companies', ['created_by_user_id'], unique=False)
    op.create_index(op.f('ix_companies_next_contact_due_at'), 'companies', ['next_contact_due_at'], unique=False)

    # 2. Create company_contact_details table
    op.create_table(
        'company_contact_details',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(length=20), nullable=False),
        sa.Column('value', sa.String(length=500), nullable=False),
        sa.Column('label', sa.String(length=100), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_company_contact_details_id'), 'company_contact_details', ['id'], unique=False)
    op.create_index(op.f('ix_company_contact_details_company_id'), 'company_contact_details', ['company_id'], unique=False)

    # 3. Create company_history table
    op.create_table(
        'company_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('changed_by_user_id', sa.Integer(), nullable=False),
        sa.Column('entry_type', sa.String(length=20), nullable=False, server_default='interaction'),
        sa.Column('status', sa.Enum(
            'new', 'contacted', 'follow-up-needed', 'interested',
            'not-interested', 'customer', 'inactive',
            name='relationshipstatus'
        ), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('interaction_at', sa.DateTime(), nullable=False),
        sa.Column('next_contact_due_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id']),
        sa.ForeignKeyConstraint(['changed_by_user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_company_history_id'), 'company_history', ['id'], unique=False)
    op.create_index(op.f('ix_company_history_company_id'), 'company_history', ['company_id'], unique=False)

    # 4. Modify contacts table: add company_id, drop company string column
    with op.batch_alter_table('contacts', schema=None) as batch_op:
        batch_op.add_column(sa.Column('company_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_contacts_company_id', 'companies', ['company_id'], ['id'])
        batch_op.create_index('ix_contacts_company_id', ['company_id'], unique=False)
        batch_op.drop_column('company')


def downgrade() -> None:
    # 1. Revert contacts table changes
    with op.batch_alter_table('contacts', schema=None) as batch_op:
        batch_op.add_column(sa.Column('company', sa.String(length=255), nullable=True))
        batch_op.drop_index('ix_contacts_company_id')
        batch_op.drop_constraint('fk_contacts_company_id', type_='foreignkey')
        batch_op.drop_column('company_id')

    # 2. Drop company_history table
    op.drop_index(op.f('ix_company_history_company_id'), table_name='company_history')
    op.drop_index(op.f('ix_company_history_id'), table_name='company_history')
    op.drop_table('company_history')

    # 3. Drop company_contact_details table
    op.drop_index(op.f('ix_company_contact_details_company_id'), table_name='company_contact_details')
    op.drop_index(op.f('ix_company_contact_details_id'), table_name='company_contact_details')
    op.drop_table('company_contact_details')

    # 4. Drop companies table
    op.drop_index(op.f('ix_companies_next_contact_due_at'), table_name='companies')
    op.drop_index(op.f('ix_companies_created_by_user_id'), table_name='companies')
    op.drop_index(op.f('ix_companies_owner_user_id'), table_name='companies')
    op.drop_index(op.f('ix_companies_name'), table_name='companies')
    op.drop_index(op.f('ix_companies_id'), table_name='companies')
    op.drop_table('companies')
