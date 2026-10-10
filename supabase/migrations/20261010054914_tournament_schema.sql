-- Tabla de grupos/mesas
CREATE TABLE public.groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phase TEXT NOT NULL,
  round_number INTEGER NOT NULL,
  group_name TEXT NOT NULL,
  is_finished BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.groups FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.groups FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.groups FOR DELETE USING (true);

-- Tabla de intersección: jugadores en un grupo y sus puntajes
CREATE TABLE public.group_players (
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  score INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (group_id, player_id)
);

ALTER TABLE public.group_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.group_players FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.group_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.group_players FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.group_players FOR DELETE USING (true);
