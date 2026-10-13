ALTER TABLE public.team_members DROP CONSTRAINT team_members_papel_check;
ALTER TABLE public.team_members ADD CONSTRAINT team_members_papel_check CHECK (papel IN ('viewer','editor','vendedor'));