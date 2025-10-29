import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useVoiceInput = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.success('Registrazione avviata', {
        description: 'Parla ora...'
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Errore nell\'accesso al microfono');
    }
  };

  const stopRecording = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorderRef.current) {
        reject(new Error('No recording in progress'));
        return;
      }

      mediaRecorderRef.current.onstop = async () => {
        setIsRecording(false);
        setIsProcessing(true);

        try {
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
          
          // Convert to base64
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            
            // Call edge function
            const { data, error } = await supabase.functions.invoke('voice-to-text', {
              body: { audio: base64Audio }
            });

            setIsProcessing(false);

            if (error) {
              console.error('Error transcribing:', error);
              toast.error('Errore nella trascrizione');
              reject(error);
              return;
            }

            if (data?.text) {
              toast.success('Trascrizione completata!');
              resolve(data.text);
            } else {
              toast.error('Nessun testo rilevato');
              reject(new Error('No text detected'));
            }
          };
        } catch (error) {
          console.error('Error processing audio:', error);
          setIsProcessing(false);
          toast.error('Errore nel processamento audio');
          reject(error);
        }

        // Stop all tracks
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.stop();
    });
  };

  return {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording
  };
};
