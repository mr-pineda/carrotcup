import { useState } from 'react';
import { mockPlayers, Player, tournamentConfig } from './mockData';
import { ImageCropper } from './ImageCropper';

export function Admin() {
  const [players, setPlayers] = useState<Player[]>(mockPlayers);
  
  const [newPlayerName, setNewPlayerName] = useState('');
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setCropImageSrc(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (fullBlob: Blob, thumbBlob: Blob) => {
    const thumbUrl = URL.createObjectURL(thumbBlob);
    
    const newPlayer: Player = {
      id: Math.random().toString(36).substr(2, 9),
      name: newPlayerName || 'Sin Nombre',
      photo_thumb_url: thumbUrl
    };
    
    setPlayers([...players, newPlayer]);
    setNewPlayerName('');
    setCropImageSrc(null);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-12 relative z-10 animate-fade-in">
      <header className="mb-12 flex justify-between items-center">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2 font-['Outfit']">
            Panel de Administración
          </h1>
          <p className="text-white/60">Gestiona jugadores y grupos del torneo.</p>
        </div>
        <a href="#/" className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white backdrop-blur-md border border-white/10 transition-all font-medium">
          Ver Torneo
        </a>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Registrar Jugador */}
        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -z-10 group-hover:bg-purple-500/20 transition-all"></div>
          <h2 className="text-2xl font-bold text-white mb-6 font-['Outfit'] flex items-center gap-3">
            <span className="bg-purple-500/20 text-purple-400 p-2 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </span>
            Registrar Jugador
          </h2>
          
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Nombre</label>
              <input 
                type="text" 
                value={newPlayerName}
                onChange={e => setNewPlayerName(e.target.value)}
                placeholder="Ej. Juan Pérez" 
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Foto de Perfil</label>
              <label className="flex items-center justify-center w-full h-32 px-4 transition bg-black/20 border-2 border-white/10 border-dashed rounded-xl appearance-none cursor-pointer hover:border-purple-400/50 hover:bg-black/40 focus:outline-none group">
                <span className="flex items-center space-x-2 text-white/50 group-hover:text-purple-300">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className="font-medium">Seleccionar imagen...</span>
                </span>
                <input type="file" name="file_upload" className="hidden" accept="image/*" onChange={handleFileChange} />
              </label>
            </div>
          </div>
        </section>

        {/* Placeholder para Registrar Resultados de Grupo */}
        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl -z-10 group-hover:bg-pink-500/20 transition-all"></div>
          <h2 className="text-2xl font-bold text-white mb-6 font-['Outfit'] flex items-center gap-3">
            <span className="bg-pink-500/20 text-pink-400 p-2 rounded-lg">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            Cargar Resultados de Grupo
          </h2>
          
          <div className="space-y-5">
            <p className="text-white/60">
              Esta sección se actualizará para permitir seleccionar un grupo de {tournamentConfig.playersPerGroup} jugadores y cargar sus puntuaciones de una ronda determinada.
            </p>
            <button className="w-full py-4 mt-2 rounded-xl bg-white/5 border border-white/10 text-white/50 font-bold cursor-not-allowed">
              Próximamente
            </button>
          </div>
        </section>
      </div>

      {cropImageSrc && (
        <ImageCropper 
          imageSrc={cropImageSrc}
          onCrop={handleCropComplete}
          onCancel={() => setCropImageSrc(null)}
        />
      )}
    </div>
  );
}
