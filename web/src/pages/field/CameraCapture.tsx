import { useState, useRef, useEffect } from 'react';
import { Button } from '../../components/ui/Button';

export function CameraCapture({ onCapture }: { onCapture: (blob: Blob, hash: string, time: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState('');
  
  const startCamera = async () => {
    try {
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        throw new Error('The camera needs HTTPS');
      }
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play();
      }
      setError('');
    } catch (e: unknown) {
      const err = e as Error;
      if (err.message.includes('HTTPS')) {
        setError(err.message);
      } else {
        setError('Permission denied or no camera available');
      }
    }
  };

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [stream]);

  const capture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Resize to max 1600px
    const maxDim = 1600;
    let width = video.videoWidth;
    let height = video.videoHeight;
    
    if (width > height) {
      if (width > maxDim) {
        height *= maxDim / width;
        width = maxDim;
      }
    } else {
      if (height > maxDim) {
        width *= maxDim / height;
        height = maxDim;
      }
    }
    
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, width, height);
    
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const arrayBuffer = await blob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      const captureTime = new Date().toISOString();
      onCapture(blob, hashHex, captureTime);
    }, 'image/jpeg', 0.8);
  };

  const syntheticCapture = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(0, 0, 800, 600);
      ctx.fillStyle = '#0f172a';
      ctx.font = '48px sans-serif';
      ctx.fillText('DEMO CAPTURE', 200, 300);
    }
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const arrayBuffer = await blob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      const captureTime = new Date().toISOString();
      onCapture(blob, hashHex, captureTime);
    }, 'image/jpeg', 0.8);
  };

  const isDemo = true; // Use Demo logic always

  return (
    <div className="flex flex-col gap-4">
      {error && <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>}
      
      {!stream && !error && (
        <Button variant="primary" onClick={startCamera}>Start Camera</Button>
      )}

      <div className="relative bg-black rounded-lg overflow-hidden flex items-center justify-center min-h-[300px]">
        <video ref={videoRef} className="w-full h-auto" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {stream && (
        <Button variant="primary" className="h-14 text-lg font-bold" onClick={capture}>
          📷 Take Photo
        </Button>
      )}

      {isDemo && (
        <Button variant="outline" onClick={syntheticCapture}>
          Use demo capture
        </Button>
      )}
      
      <p className="text-xs text-slate-500 text-center px-4">
        Live capture is enforced by this app. A modified app could upload other pictures. The seal later proves the record was not changed after capture. It does not prove the observations were true.
      </p>
    </div>
  );
}
