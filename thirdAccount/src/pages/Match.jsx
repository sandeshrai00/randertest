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
        // Default to the first channel.
        if (m.channels && m.channels.length > 0) {
          setActiveChannel(m.channels[0].channel_slug);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  // Reset iframe src when channel switches so it reloads cleanly.
  const embedUrl = activeChannel
    ? `${EMBED_BASE}/embed?ch=${encodeURIComponent(activeChannel)}`
    : null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.back}>← All Matches</Link>
        <img src="/logo.png" alt="SoraScore" className={styles.logo} />
      </header>

      {loading && (
        <div className={styles.center}>
          <div className={styles.spinner} />
        </div>
      )}

      {error && !loading && (
        <div className={styles.center}>
          <p className={styles.errorText}>{error}</p>
          <Link to="/" className={styles.homeLink}>← Back to matches</Link>
        </div>
      )}

      {!loading && !error && match && (
        <main className={styles.main}>
          {/* Match info */}
          <div className={styles.matchInfo}>
            {match.logo_url && (
              <img
                src={match.logo_url}
                alt=""
                className={styles.matchLogo}
                onError={e => { e.target.style.display = 'none'; }}
              />
            )}
            <div>
              <h1 className={styles.matchTitle}>{match.title}</h1>
              <div className={styles.matchMeta}>
                {match.genre && GENRES[match.genre] && (
                  <span className={styles.badge}>{GENRES[match.genre]}</span>
                )}
                {match.event_time && (
                  <span className={styles.time}>{formatTime(match.event_time)}</span>
                )}
              </div>
            </div>
          </div>

          {/* Player */}
          <div className={styles.playerWrap}>
            {embedUrl ? (
              <iframe
                ref={iframeRef}
                key={activeChannel}
                src={embedUrl}
                title={match.title}
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className={styles.iframe}
              />
            ) : (
              <div className={styles.noStream}>No stream available</div>
            )}
          </div>

          {/* Channel switcher — only shown if more than one channel */}
          {match.channels && match.channels.length > 1 && (
            <div className={styles.channels}>
              <span className={styles.channelsLabel}>Streams:</span>
              <div className={styles.channelBtns}>
                {match.channels.map((c, i) => (
                  <button
                    key={c.channel_slug}
                    className={`${styles.channelBtn} ${activeChannel === c.channel_slug ? styles.channelBtnActive : ''}`}
                    onClick={() => setActiveChannel(c.channel_slug)}
                  >
                    {c.label || `Stream ${i + 1}`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
