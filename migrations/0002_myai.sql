-- MyAI application schema. Auth users/sessions live in Better Auth tables.

create table if not exists conversations (
  id text primary key,
  user_id text not null,
  title text not null default 'New chat',
  assistant_id text,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived boolean not null default false
);
create index if not exists conversations_user_updated_idx
  on conversations (user_id, updated_at desc);
create index if not exists conversations_user_title_idx
  on conversations (user_id, title);

create table if not exists messages (
  id text primary key,
  conversation_id text not null references conversations(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null default '',
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata text not null default '{}'
);
create index if not exists messages_conversation_created_idx
  on messages (conversation_id, created_at);
create index if not exists messages_user_idx
  on messages (user_id);

create table if not exists attachments (
  id text primary key,
  user_id text not null,
  conversation_id text not null references conversations(id) on delete cascade,
  message_id text references messages(id) on delete set null,
  filename text not null,
  mime text not null,
  size_bytes integer not null default 0,
  extracted_text text not null default '',
  page_count integer,
  image_data text,
  created_at timestamptz not null default now()
);
create index if not exists attachments_conversation_idx
  on attachments (conversation_id);
create index if not exists attachments_message_idx
  on attachments (message_id);
create index if not exists attachments_user_idx
  on attachments (user_id);

create table if not exists document_chunks (
  id text primary key,
  user_id text not null,
  attachment_id text not null references attachments(id) on delete cascade,
  conversation_id text not null references conversations(id) on delete cascade,
  chunk_index integer not null,
  page_number integer,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists document_chunks_attachment_idx
  on document_chunks (attachment_id);
create index if not exists document_chunks_conversation_idx
  on document_chunks (conversation_id);

create table if not exists custom_assistants (
  id text primary key,
  user_id text not null,
  name text not null,
  description text not null default '',
  avatar text not null default 'sparkles',
  system_prompt text not null default '',
  default_model text,
  temperature double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists custom_assistants_user_idx
  on custom_assistants (user_id, updated_at desc);

create table if not exists user_settings (
  user_id text primary key,
  default_model text,
  temperature double precision not null default 0.7,
  custom_instructions text not null default '',
  theme text not null default 'dark',
  send_on_enter boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists api_usage (
  id text primary key,
  user_id text not null,
  conversation_id text,
  model text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists api_usage_user_created_idx
  on api_usage (user_id, created_at desc);

create table if not exists models_cache (
  slug text primary key,
  display_name text not null,
  provider text not null default '',
  context_window integer,
  input_modalities text not null default '["text"]',
  output_modalities text not null default '["text"]',
  promotional boolean not null default false,
  available boolean not null default true,
  pricing_input text,
  pricing_output text,
  raw text,
  updated_at timestamptz not null default now()
);
