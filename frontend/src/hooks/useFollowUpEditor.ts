/**
 * Change a contact's / company's follow-up date straight from a list row, with an
 * optimistic update and an Undo toast. Used by the Contacts and Companies lists.
 */
import { Dispatch, SetStateAction, useCallback } from 'react';
import { pipelineApi } from '../api';
import { EntityType } from '../types';
import { useToast } from '../contexts/UiContext';

interface HasFollowUp {
  id: number;
  next_contact_due_at?: string | null;
}

export function useFollowUpEditor<T extends HasFollowUp>(
  type: EntityType,
  setItems: Dispatch<SetStateAction<T[]>>,
  refresh: () => void
) {
  const toast = useToast();

  const change = useCallback(
    async (item: T, iso: string | null, message: string, allowUndo = true) => {
      const previous = item.next_contact_due_at ?? null;
      const apply = (value: string | null) =>
        setItems((list) => list.map((x) => (x.id === item.id ? { ...x, next_contact_due_at: value ?? undefined } : x)));

      apply(iso);
      try {
        await pipelineApi.update(type, item.id, { next_contact_due_at: iso });
        toast(
          message,
          'success',
          allowUndo ? { label: 'Undo', run: () => change({ ...item, next_contact_due_at: iso ?? undefined }, previous, 'Change undone', false) } : undefined
        );
        refresh(); // counts, and rows that no longer match the filter leave the list
      } catch (err: any) {
        apply(previous);
        toast(err.message || 'Could not change the follow-up', 'error');
      }
    },
    [type, setItems, refresh, toast]
  );

  return change;
}
