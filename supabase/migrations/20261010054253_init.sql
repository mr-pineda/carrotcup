-- Tabla de jugadores
CREATE TABLE public.players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  photo_full_url TEXT,
  photo_thumb_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para lectura y escritura (temporalmente públicas para desarrollo)
CREATE POLICY "Enable read access for all users" ON public.players FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON public.players FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON public.players FOR DELETE USING (true);

-- Tabla para relaciones de parentesco (bidireccional)
CREATE TABLE public.player_relatives (
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  relative_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  PRIMARY KEY (player_id, relative_id)
);

ALTER TABLE public.player_relatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.player_relatives FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON public.player_relatives FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable delete for all users" ON public.player_relatives FOR DELETE USING (true);

-- Trigger para asegurar relación bidireccional (Si A es pariente de B, B es pariente de A)
CREATE OR REPLACE FUNCTION public.insert_reciprocal_relative()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.player_relatives (player_id, relative_id)
  VALUES (NEW.relative_id, NEW.player_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_reciprocal_relative
AFTER INSERT ON public.player_relatives
FOR EACH ROW
EXECUTE FUNCTION public.insert_reciprocal_relative();

-- Creación de bucket de Storage
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true) 
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage (públicas para lectura y escritura)
CREATE POLICY "Avatars are publicly accessible."
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'avatars' );

CREATE POLICY "Anyone can upload an avatar."
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'avatars' );

CREATE POLICY "Anyone can update an avatar."
  ON storage.objects FOR UPDATE
  WITH CHECK ( bucket_id = 'avatars' );

CREATE POLICY "Anyone can delete an avatar."
  ON storage.objects FOR DELETE
  USING ( bucket_id = 'avatars' );
