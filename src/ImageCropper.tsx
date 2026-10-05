import { useState, useRef, useEffect, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';

interface ImageCropperProps {
  imageSrc: string;
  onCrop: (fullBlob: Blob, thumbBlob: Blob) => void;
  onCancel: () => void;
}

export function ImageCropper({ imageSrc, onCrop, onCancel }: ImageCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      imageRef.current = img;
      // Calculate initial scale to cover the 400x400 canvas
      const minScale = Math.max(400 / img.width, 400 / img.height);
      setScale(minScale);
      
      // Center the image
      setPosition({
        x: (400 - img.width * minScale) / 2,
        y: (400 - img.height * minScale) / 2
      });
      draw();
    };
  }, [imageSrc]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background grid/color
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(
      imageRef.current,
      position.x,
      position.y,
      imageRef.current.width * scale,
      imageRef.current.height * scale
    );

    // Overlay to show the 1:1 crop area visually (if we made canvas bigger, but here canvas is 400x400 which is exactly the crop)
  };

  useEffect(() => {
    draw();
  }, [scale, position]);

  const handleMouseDown = (e: ReactMouseEvent | ReactTouchEvent) => {
    setIsDragging(true);
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as ReactMouseEvent).clientX;
      clientY = (e as ReactMouseEvent).clientY;
    }
    setDragStart({
      x: clientX - position.x,
      y: clientY - position.y
    });
  };

  const handleMouseMove = (e: ReactMouseEvent | ReactTouchEvent) => {
    if (!isDragging) return;
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as ReactMouseEvent).clientX;
      clientY = (e as ReactMouseEvent).clientY;
    }
    setPosition({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // The canvas is already 400x400, which is our max full size
    canvas.toBlob((fullBlob) => {
      if (!fullBlob) return;

      // Now create a 100x100 thumbnail
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 100;
      thumbCanvas.height = 100;
      const tCtx = thumbCanvas.getContext('2d');
      if (tCtx) {
        tCtx.drawImage(canvas, 0, 0, 100, 100);
        thumbCanvas.toBlob((thumbBlob) => {
          if (thumbBlob) {
            onCrop(fullBlob, thumbBlob);
          }
        }, 'image/webp', 0.8);
      }
    }, 'image/webp', 0.9);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a1a] p-6 rounded-2xl shadow-2xl border border-white/10 w-full max-w-md flex flex-col items-center">
        <h3 className="text-xl font-bold mb-4 text-white">Recortar Foto</h3>
        
        <div 
          className="relative overflow-hidden cursor-move rounded-xl border-2 border-dashed border-white/30"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        >
          <canvas 
            ref={canvasRef} 
            width={400} 
            height={400}
            className="block touch-none"
            style={{ width: '100%', maxWidth: '400px', height: 'auto', aspectRatio: '1/1' }}
          />
        </div>

        <div className="w-full mt-6">
          <label className="block text-sm font-medium text-white/70 mb-2">Zoom</label>
          <input 
            type="range" 
            min="0.1" 
            max="3" 
            step="0.05" 
            value={scale} 
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>

        <div className="flex gap-4 mt-8 w-full">
          <button 
            onClick={onCancel}
            className="flex-1 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleConfirm}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium transition-colors shadow-lg shadow-blue-500/30"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
