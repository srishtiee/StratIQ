INSERT INTO document_chunks (id, customer_id, source_type, source_id, title, content)
VALUES
  ('dc-001', 'c-102', 'customer_note', 'note-001', 'Executive sponsor concern', 'Sponsor asked for dated reliability plan and clear operating owner before renewal.'),
  ('dc-002', 'c-204', 'customer_note', 'note-002', 'Commercial committee context', 'Buying committee requested competitor benchmark and value proof before pricing conversation.'),
  ('dc-003', NULL, 'playbook', 'playbook-001', 'Retention standard', 'Risk/compliance should flag low evidence depth and demand owner accountability before execution.')
ON CONFLICT (id) DO NOTHING;
