import React, { useEffect, useState, useRef } from 'react';
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
  const iframeRef = useRef(null);

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

  const embedUrl = activeChannel
    ? `${EMBED_BASE}/embed?ch=${encodeURIComponent(activeChannel)}`
    : null;

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.center}>
          <div className={styles.spinner} />
        </div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className={styles.page}>
        <div className={styles.center}>
          <p className={styles.error}>{error || 'Match not found.'}</p>
          <Link to="/" className={styles.homeLink}>← Back to matches</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.back}>← All Matches</Link>
        <div className={styles.brand}>
          <img src="/logo.png" alt="SoraScore" className={styles.logo} />
          <span className={styles.brandText}>oraScore TV</span>
        </div>
      </header>

      <main className={styles.main}>
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

        {match.channels && match.channels.length > 1 && (
          <div className={styles.streams}>
            {match.channels.map((c, i) => (
              <button
                key={c.channel_slug}
                className={`${styles.streamBtn} ${activeChannel === c.channel_slug ? styles.streamBtnActive : ''}`}
                onClick={() => setActiveChannel(c.channel_slug)}
              >
                {c.label || `Stream ${i + 1}`}
              </button>
            ))}
          </div>
        )}

        <div className={styles.info}>
          {match.genre && GENRES[match.genre] && (
            <span className={styles.badge}>{GENRES[match.genre]}</span>
          )}
          <h1 className={styles.title}>{match.title}</h1>
          {match.event_time && (
            <>
              <span className={styles.dot}>•</span>
              <span className={styles.time}>{formatTime(match.event_time)}</span>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
