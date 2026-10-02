import { useEffect, useRef, useState, useCallback } from 'react';
import { connectRecognitionSocket } from '../services/recognitionSocket';
import { getSessionRoster } from '../services/sessionService';

// Fully updated hook — handles all Section 8.4 events + C6 reconnect resync
export function useRecognitionSocket(sessionId, initialRoster) {
  const [roster, setRoster] = useState(initialRoster);
  const [connection, setConnection] = useState({ status: 'connecting', attempt: 0 });
  const [reviewQueue, setReviewQueue] = useState([]);        // low-confidence known student
  const [unidentifiedQueue, setUnidentifiedQueue] = useState([]); // ghost faces with no match
  const [processingComplete, setProcessingComplete] = useState(null); // {totalDetected,totalMatched}
  const [indexingStatus, setIndexingStatus] = useState(null);         // {status,progress} C10
  const socketRef = useRef(null);

  // If resumed with empty roster, fetch it immediately
  useEffect(() => {
    if (!initialRoster || initialRoster.length === 0) {
      getSessionRoster(sessionId).then(({ roster: fresh }) => setRoster(fresh)).catch(console.error);
    }
  }, [sessionId, initialRoster]);

  useEffect(() => {
    const socket = connectRecognitionSocket(sessionId);
    socketRef.current = socket;

    // C6: on reconnect transition → replace entire roster from authoritative REST endpoint
    const onStatus = async (e) => {
      const { status, attempt, wasReconnecting } = e.detail;
      setConnection({ status, attempt });
      if (status === 'open' && wasReconnecting) {
        try {
          const { roster: fresh } = await getSessionRoster(sessionId);
          setRoster(fresh); // full replace, never merge
        } catch (err) {
          console.error('[useRecognitionSocket] C6 resync failed:', err.message);
        }
      }
    };

    // FACE_MATCHED — confident deduped match
    const onMatch = (e) => {
      const { studentId, status, confidence } = e.detail;
      setRoster((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, status, confidence } : s))
      );
    };

    // FACE_NEEDS_REVIEW — low confidence or no match at all (C9)
    const onNeedsReview = (e) => {
      const { faceId, cropUrl, confidence, bestGuessStudentId } = e.detail;
      if (bestGuessStudentId) {
        // Low confidence: we have a best-guess student → show in reviewQueue
        setRoster((prev) =>
          prev.map((s) =>
            s.id === bestGuessStudentId ? { ...s, status: 'needs_review', confidence } : s
          )
        );
        setReviewQueue((prev) => [
          ...prev,
          { studentId: bestGuessStudentId, confidence, faceId, cropUrl },
        ]);
      } else {
        // Ghost face: no enrolled student matched → unidentified queue
        setUnidentifiedQueue((prev) => [...prev, { faceId, cropUrl, confidence }]);
      }
    };

    // PROCESSING_COMPLETE — C1 counter hit zero
    const onProcessingComplete = (e) => setProcessingComplete(e.detail);

    // INDEXING_STATUS — C10 gate
    const onIndexingStatus = (e) => setIndexingStatus(e.detail);

    // SESSION_FINALIZED — bubble up so page can clear activeSession
    const onSessionFinalized = (e) => {
      socket.dispatchEvent(new CustomEvent('_sessionFinalized', { detail: e.detail }));
    };

    socket.addEventListener('status', onStatus);
    socket.addEventListener('match', onMatch);
    socket.addEventListener('needsReview', onNeedsReview);
    socket.addEventListener('processingComplete', onProcessingComplete);
    socket.addEventListener('indexingStatus', onIndexingStatus);
    socket.addEventListener('sessionFinalized', onSessionFinalized);

    return () => {
      socket.removeEventListener('status', onStatus);
      socket.removeEventListener('match', onMatch);
      socket.removeEventListener('needsReview', onNeedsReview);
      socket.removeEventListener('processingComplete', onProcessingComplete);
      socket.removeEventListener('indexingStatus', onIndexingStatus);
      socket.removeEventListener('sessionFinalized', onSessionFinalized);
      socket.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const simulateDisconnect = useCallback(() => socketRef.current?.simulateDisconnect(), []);

  const overrideStatus = useCallback((studentId, status) => {
    setRoster((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, status, confidence: undefined } : s))
    );
    setReviewQueue((prev) => prev.filter((r) => r.studentId !== studentId));
  }, []);

  const resolveReview = useCallback(
    (studentId, finalStatus) => overrideStatus(studentId, finalStatus),
    [overrideStatus]
  );

  const resolveUnidentified = useCallback((faceId, assignedStudentId) => {
    setUnidentifiedQueue((prev) => prev.filter((f) => f.faceId !== faceId));
    if (assignedStudentId) {
      setRoster((prev) =>
        prev.map((s) => (s.id === assignedStudentId ? { ...s, status: 'present' } : s))
      );
    }
  }, []);

  // No-op in production — Kafka pipeline drives matching automatically after upload
  const processBatch = useCallback(() => {}, []);

  return {
    roster,
    connection,
    reviewQueue,
    unidentifiedQueue,
    processingComplete,
    indexingStatus,
    processBatch,
    simulateDisconnect,
    overrideStatus,
    resolveReview,
    resolveUnidentified,
    socketRef,
  };
}
