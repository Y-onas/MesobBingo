import { useEffect, useState } from 'react';

interface UseSpeechSynthesisOptions {
  enabled: boolean;
  text: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
}

/**
 * Custom hook for speech synthesis with proper cleanup and error handling
 * Handles browser compatibility, garbage collection prevention, and utterance lifecycle
 */
export const useSpeechSynthesis = ({
  enabled,
  text,
  rate = 0.9,
  pitch = 1,
  volume = 1,
  lang = 'en-US',
}: UseSpeechSynthesisOptions) => {
  const [speechSupported, setSpeechSupported] = useState(true);

  // Check speech synthesis support
  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setSpeechSupported(false);
      console.warn('Speech Synthesis not supported in this browser');
    }
  }, []);

  // Store utterances globally to prevent garbage collection in some browsers (e.g. Safari)
  useEffect(() => {
    if (!(window as any).utterances) {
      (window as any).utterances = [];
    }
  }, []);

  // Auto-speak when enabled and text changes
  useEffect(() => {
    if (enabled && speechSupported && text && 'speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      // Small delay to ensure cancellation completes
      const timeoutId = setTimeout(() => {
        try {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = rate;
          utterance.pitch = pitch;
          utterance.volume = volume;
          utterance.lang = lang;
          
          // Cleanup helper
          const cleanupUtterance = () => {
            if ((window as any).utterances) {
              const index = (window as any).utterances.indexOf(utterance);
              if (index !== -1) {
                (window as any).utterances.splice(index, 1);
              }
            }
          };
          
          // Event listeners
          utterance.onstart = () => console.log('Speech started:', text);
          utterance.onerror = (e) => {
            console.error('Speech error:', e);
            cleanupUtterance(); // Clean up on error
          };
          utterance.onend = () => {
            console.log('Speech ended');
            cleanupUtterance(); // Clean up on success
          };
          
          // Store reference to prevent garbage collection
          if ((window as any).utterances) {
            (window as any).utterances.push(utterance);
          }
          
          window.speechSynthesis.speak(utterance);
        } catch (error) {
          console.error('Speech synthesis error:', error);
        }
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        // Do not cancel speech synthesis on unmount to avoid cutting it off
      };
    }
  }, [text, enabled, speechSupported, rate, pitch, volume, lang]);

  return { speechSupported };
};

/**
 * Helper function to unlock speech synthesis on mobile devices
 * Must be called in a direct user interaction handler (e.g., click)
 */
export const unlockSpeechSynthesis = () => {
  if ('speechSynthesis' in window) {
    try {
      const unlockUtterance = new SpeechSynthesisUtterance('');
      unlockUtterance.volume = 0;
      window.speechSynthesis.speak(unlockUtterance);
    } catch (e) {
      console.error('Failed to unlock speech synthesis:', e);
    }
  }
};

/**
 * Helper function to cancel all ongoing speech
 */
export const cancelSpeech = () => {
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      console.error('Failed to cancel speech:', e);
    }
  }
};
