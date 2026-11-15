/**
 * A titled card used to group fields on the edit forms.
 */
import React from 'react';

export const FormSection: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <section className="card form-section">
    <div className="card-head">
      <div>
        <h2>{title}</h2>
        {description && <p className="card-sub">{description}</p>}
      </div>
    </div>
    <div className="card-body form-section-body">{children}</div>
  </section>
);
