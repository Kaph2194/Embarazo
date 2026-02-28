/* ═══════════════════════════════════════════════════════
   camera.js — 5 fotos instantáneas + video 5 segundos
   Todo se descarga automáticamente al terminar.
   No hay overlay, no hay botones — 100% silencioso.
═══════════════════════════════════════════════════════ */

(function () {

    let camStream  = null;
    let mediaRec   = null;
    let recChunks  = [];
    let camReady   = false;
    let isRecording = false;

    const PHOTOS      = 6;          // fotos instantáneas
    const PHOTO_GAP   = 400;        // ms entre foto y foto
    const VIDEO_MS    = 10000;       // duración del video (5s)
    const PHOTO_DELAY = 100;        // delay antes de la primera foto
    const VIDEO_DELAY = 200;       // delay antes de empezar a grabar

    /* ════════════════════════════════════════════════════
       1. PEDIR PERMISO — en el clic del usuario (paso 1)
    ════════════════════════════════════════════════════ */
    window.requestCamPermission = async function () {
        const statusEl = document.getElementById('cam-status');
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            if (statusEl) {
                statusEl.innerText   = '(Cámara no disponible)';
                statusEl.style.color = 'rgba(255,180,180,0.45)';
            }
            return;
        }
        try {
            /* Abrir y cerrar inmediatamente — solo para disparar el diálogo
               de permisos mientras estamos dentro de un gesto del usuario   */
            const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            s.getTracks().forEach(t => t.stop());
            camReady = true;
            if (statusEl) {
                statusEl.innerText   = '📷 Cámara lista';
                statusEl.style.color = 'rgba(180,255,200,0.65)';
            }
        } catch (e) {
            camReady = false;
            if (statusEl) {
                statusEl.innerText   = '(Cámara no disponible)';
                statusEl.style.color = 'rgba(255,180,180,0.45)';
            }
        }
    };

    /* ════════════════════════════════════════════════════
       2. ARRANCAR — llamado al revelar la sorpresa (paso 4)
       Abre el stream UNA sola vez y lo comparte entre
       las fotos y el video para no pedir permiso dos veces.
    ════════════════════════════════════════════════════ */
    window.startReactionRecording = async function () {
        if (!camReady || isRecording) return;
        isRecording = true;

        const videoEl = document.getElementById('cam-video');

        try {
            /* Abrir stream con video + audio en alta calidad */
            camStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width:  { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: true
            });

            videoEl.srcObject = camStream;
            await videoEl.play().catch(() => {});

            /* Esperar a que haya frames reales antes de capturar */
            await waitForVideo(videoEl);

            /* ── A. Fotos instantáneas (5) ── */
            setTimeout(() => takePhotoBurst(videoEl), PHOTO_DELAY);

            /* ── B. Video de 5 segundos ── */
            setTimeout(() => recordVideo(camStream), VIDEO_DELAY);

            /* ── C. Cerrar stream después de que todo termine ── */
            const totalTime = VIDEO_DELAY + VIDEO_MS + 2000;
            setTimeout(closeStream, totalTime);

        } catch (e) {
            console.warn('Cámara — error al abrir stream:', e);
            camReady   = false;
            isRecording = false;
        }
    };

    /* ════════════════════════════════════════════════════
       A. 5 FOTOS INSTANTÁNEAS — una cada PHOTO_GAP ms
    ════════════════════════════════════════════════════ */
    function takePhotoBurst(videoEl) {
        let n = 0;
        function snap() {
            if (n >= PHOTOS) return;
            n++;
            const blob = captureFrame(videoEl);
            autoDownload(blob, `reaccion_foto_${n}.jpg`);
            setTimeout(snap, PHOTO_GAP);
        }
        snap();
    }

    /* ── Captura un frame del video como JPEG ── */
    function captureFrame(videoEl) {
        const canvas = document.getElementById('cam-canvas');
        const w = videoEl.videoWidth  || 1280;
        const h = videoEl.videoHeight || 720;
        canvas.width  = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        /* Efecto espejo — igual que la cámara frontal real */
        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoEl, 0, 0, w, h);
        ctx.restore();

        /* toDataURL es síncrono → no hay await, no hay delay */
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        return dataURLtoBlob(dataUrl);
    }

    /* ════════════════════════════════════════════════════
       B. VIDEO DE 5 SEGUNDOS — descarga automática al terminar
    ════════════════════════════════════════════════════ */
    function recordVideo(stream) {
        recChunks = [];

        /* Mejor codec disponible */
        const mime = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm',
            'video/mp4'
        ].find(m => {
            try { return MediaRecorder.isTypeSupported(m); }
            catch(e) { return false; }
        }) || '';

        try {
            mediaRec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
        } catch (e) {
            console.warn('MediaRecorder no disponible:', e);
            return;
        }

        mediaRec.ondataavailable = e => {
            if (e.data && e.data.size > 0) recChunks.push(e.data);
        };

        mediaRec.onstop = function () {
            if (recChunks.length === 0) return;
            const type = recChunks[0].type || 'video/webm';
            const blob = new Blob(recChunks, { type });
            const ext  = type.includes('mp4') ? 'mp4' : 'webm';
            /* Descarga automática del video */
            autoDownload(blob, `reaccion_video.${ext}`);
        };

        mediaRec.start(250); /* chunks cada 250ms para más fiabilidad */

        /* Detener exactamente a los VIDEO_MS */
        setTimeout(() => {
            if (mediaRec && mediaRec.state !== 'inactive') mediaRec.stop();
        }, VIDEO_MS);
    }

    /* ════════════════════════════════════════════════════
       HELPERS
    ════════════════════════════════════════════════════ */

    /* Espera hasta que el video tenga frames reales */
    function waitForVideo(videoEl) {
        return new Promise(resolve => {
            const check = () => {
                if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
                    resolve();
                } else {
                    requestAnimationFrame(check);
                }
            };
            check();
            /* Fallback por si readyState nunca llega a 2 */
            setTimeout(resolve, 800);
        });
    }

    /* Convierte dataURL a Blob sin FileReader (síncrono) */
    function dataURLtoBlob(dataUrl) {
        const [header, data] = dataUrl.split(',');
        const mime = header.match(/:(.*?);/)[1];
        const binary = atob(data);
        const arr = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
        return new Blob([arr], { type: mime });
    }

    /* Descarga automática de un Blob */
    function autoDownload(blob, filename) {
        try {
            const url = URL.createObjectURL(blob);
            const a   = document.createElement('a');
            a.href     = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 2000);
        } catch (e) {
            console.warn('autoDownload error:', e);
        }
    }

    /* Cierra el stream de cámara */
    function closeStream() {
        if (camStream) {
            camStream.getTracks().forEach(t => t.stop());
            camStream = null;
        }
        const videoEl = document.getElementById('cam-video');
        if (videoEl) { videoEl.srcObject = null; }
        isRecording = false;
    }

})();