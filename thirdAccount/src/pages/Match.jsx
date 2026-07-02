import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchMatch, GENRES } from '../api';
import styles from './Match.module.css';

const EMBED_BASE = import.meta.env.VITE_EMBED_URL || '';

function formatTime(t) {
  if (!t) return null;
  try {
    return new Date(t).toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return t; }
}

export default function Match() {
  const { slug } = useParams();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeChannel, setActiveChannel] = useState(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const iframeRef = useRef(null);
  const idleTimerRef = useRef(null);
  const isTouch = 'ontouchstart' in window;

  useEffect(() => {
    setLoading(true);
    setError(null);
    setMatch(null);
    setActiveChannel(null);

    fetchMatch(slug)
      .then(m => {
        if (!m) { setError('Match not found.'); return; }
        setMatch(m);
        if (m.channels && m.channels.length > 0) {
          setActiveChannel(m.channels[0].channel_slug);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const startIdle = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
  }, []);

  useEffect(() => {
    if (!loading && !error && match) {
      setControlsVisible(true);
      startIdle();
    }
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [loading, error, match, startIdle]);

  const wake = useCallback(() => {
    setControlsVisible(true);
    startIdle();
  }, [startIdle]);

  const handleMouseMove = useCallback(() => {
    if (!isTouch) wake();
  }, [wake, isTouch]);

  const handleMouseLeave = useCallback(() => {
    if (!isTouch) {
      setControlsVisible(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    }
  }, [isTouch]);

  const handlePageClick = useCallback((e) => {
    if (e.target.closest('button') || e.target.closest('a')) return;
    setControlsVisible(prev => !prev);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
  }, []);

  const embedUrl = activeChannel
    ? `${EMBED_BASE}/embed?ch=${encodeURIComponent(activeChannel)}`
    : null;

  const oc = controlsVisible ? styles.ov : styles.oh;

  if (loading) {
    return (
      <div className={styles.page} onMouseMove={handleMouseMove}>
        <div className={styles.centerOverlay}>
          <div className={styles.spinner} />
        </div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className={styles.page} onMouseMove={handleMouseMove}>
        <div className={styles.centerOverlay}>
          <p className={styles.errorText}>{error || 'Match not found.'}</p>
          <Link to="/" className={styles.homeLink}>← Back to matches</Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.page}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handlePageClick}
    >
      {/* Full-viewport player */}
      <div className={styles.playerWrap}>
        {embedUrl ? (
          <iframe
            ref={iframeRef}
            key={activeChannel}
            src={embedUrl}
            title={match.title}
            className={styles.iframe}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <div className={styles.noStream}>No stream available</div>
        )}
      </div>

      {/* Top overlay */}
      <div className={`${styles.top} ${oc}`}>
        <Link to="/" className={styles.back}>← All Matches</Link>
        <img src="/logo.png" alt="SoraScore" className={styles.logo} />
      </div>

      {/* Bottom overlay */}
      <div className={`${styles.bottom} ${oc}`}>
        <div className={styles.info}>
          {match.logo_url && (
            <img
              src={match.logo_url}
              alt=""
              className={styles.matchLogo}
              onError={e => { e.target.style.display = 'none'; }}
            />
          )}
          <div>
            <h1 className={styles.title}>{match.title}</h1>
            <div className={styles.meta}>
              {match.genre && GENRES[match.genre] && (
                <span className={styles.badge}>{GENRES[match.genre]}</span>
              )}
              {match.event_time && (
                <span className={styles.time}>{formatTime(match.event_time)}</span>
              )}
            </div>
          </div>
        </div>

        {match.channels && match.channels.length > 1 && (
          <div className={styles.streams}>
            {match.channels.map((c, i) => (
              <button
                key={c.channel_slug}
                className={`${styles.streamBtn} ${activeChannel === c.channel_slug ? styles.streamBtnActive : ''}`}
                onClick={() => { setActiveChannel(c.channel_slug); wake(); }}
              >
                {c.label || `Stream ${i + 1}`}
              </button>
            ))}
          </div>
        )}

        {(!match.channels || match.channels.length <= 1) && (
          <div className={styles.streams}>
            <span className={styles.streamsLabel}>1 stream available</span>
          </div>
        )}
      </div>
    </div>
  );
}
