"""Initial migration - create all tables

Revision ID: 001
Revises:
Create Date: 2024-01-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('role', sa.Enum('ADMIN', 'USER', name='userrole'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('must_change_password', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)

    # Create contacts table
    op.create_table(
        'contacts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('first_name', sa.String(length=255), nullable=False),
        sa.Column('last_name', sa.String(length=255), nullable=False),
        sa.Column('company', sa.String(length=255), nullable=True),
        sa.Column('job_title', sa.String(length=255), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('owner_user_id', sa.Integer(), nullable=False),
        sa.Column('current_relationship_status',
                  sa.Enum('NEW', 'CONTACTED', 'FOLLOW_UP_NEEDED', 'INTERESTED',
                         'NOT_INTERESTED', 'CUSTOMER', 'INACTIVE', name='relationshipstatus'),
                  nullable=False),
        sa.Column('last_contacted_at', sa.DateTime(), nullable=True),
        sa.Column('next_contact_due_at', sa.DateTime(), nullable=True),
        sa.Column('reminders_enabled', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['owner_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_contacts_email'), 'contacts', ['email'], unique=False)
    op.create_index(op.f('ix_contacts_id'), 'contacts', ['id'], unique=False)
    op.create_index(op.f('ix_contacts_next_contact_due_at'), 'contacts', ['next_contact_due_at'], unique=False)
    op.create_index(op.f('ix_contacts_owner_user_id'), 'contacts', ['owner_user_id'], unique=False)

    # Create relationship_history table
    op.create_table(
        'relationship_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contact_id', sa.Integer(), nullable=False),
        sa.Column('changed_by_user_id', sa.Integer(), nullable=False),
        sa.Column('status',
                  sa.Enum('NEW', 'CONTACTED', 'FOLLOW_UP_NEEDED', 'INTERESTED',
                         'NOT_INTERESTED', 'CUSTOMER', 'INACTIVE', name='relationshipstatus'),
                  nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('interaction_at', sa.DateTime(), nullable=False),
        sa.Column('next_contact_due_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['changed_by_user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['contact_id'], ['contacts.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_relationship_history_contact_id'), 'relationship_history', ['contact_id'], unique=False)
    op.create_index(op.f('ix_relationship_history_id'), 'relationship_history', ['id'], unique=False)

    # Create reminder_logs table
    op.create_table(
        'reminder_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contact_id', sa.Integer(), nullable=False),
        sa.Column('due_at', sa.DateTime(), nullable=False),
        sa.Column('sent_at', sa.DateTime(), nullable=False),
        sa.Column('sent_to', sa.String(length=500), nullable=False),
        sa.ForeignKeyConstraint(['contact_id'], ['contacts.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_reminder_logs_contact_id'), 'reminder_logs', ['contact_id'], unique=False)
    op.create_index(op.f('ix_reminder_logs_due_at'), 'reminder_logs', ['due_at'], unique=False)
    op.create_index(op.f('ix_reminder_logs_id'), 'reminder_logs', ['id'], unique=False)

    # Create settings table
    op.create_table(
        'settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(length=255), nullable=False),
        sa.Column('value', sa.String(length=500), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_settings_id'), 'settings', ['id'], unique=False)
    op.create_index(op.f('ix_settings_key'), 'settings', ['key'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_settings_key'), table_name='settings')
    op.drop_index(op.f('ix_settings_id'), table_name='settings')
    op.drop_table('settings')

    op.drop_index(op.f('ix_reminder_logs_id'), table_name='reminder_logs')
    op.drop_index(op.f('ix_reminder_logs_due_at'), table_name='reminder_logs')
    op.drop_index(op.f('ix_reminder_logs_contact_id'), table_name='reminder_logs')
    op.drop_table('reminder_logs')

    op.drop_index(op.f('ix_relationship_history_id'), table_name='relationship_history')
    op.drop_index(op.f('ix_relationship_history_contact_id'), table_name='relationship_history')
    op.drop_table('relationship_history')

    op.drop_index(op.f('ix_contacts_owner_user_id'), table_name='contacts')
    op.drop_index(op.f('ix_contacts_next_contact_due_at'), table_name='contacts')
    op.drop_index(op.f('ix_contacts_id'), table_name='contacts')
    op.drop_index(op.f('ix_contacts_email'), table_name='contacts')
    op.drop_table('contacts')

    op.drop_index(op.f('ix_users_id'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
