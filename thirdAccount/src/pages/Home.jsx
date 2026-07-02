import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMatches, GENRES } from '../api';
import styles from './Home.module.css';

function formatTime(t) {
  if (!t) return null;
  try {
    return new Date(t).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return t; }
}

export default function Home() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMatches()
      .then(setMatches)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <img src="/logo.png" alt="SoraScore" className={styles.logo} />
        <p className={styles.tagline}>Free live sports streams</p>
      </header>

      <main className={styles.main}>
        {loading && (
          <div className={styles.center}>
            <div className={styles.spinner} />
          </div>
        )}

        {error && (
          <div className={styles.center}>
            <p className={styles.errorText}>Failed to load matches: {error}</p>
          </div>
        )}

        {!loading && !error && matches.length === 0 && (
          <div className={styles.center}>
            <p className={styles.emptyText}>No live matches right now. Check back soon.</p>
          </div>
        )}

        {!loading && !error && matches.length > 0 && (
          <div className={styles.grid}>
            {matches.map(m => (
              <Link key={m.id} to={`/live/${m.custom_slug}`} className={styles.card}>
                {m.logo_url && (
                  <img
                    src={m.logo_url}
                    alt=""
                    className={styles.cardLogo}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                )}
                <div className={styles.cardBody}>
                  <div className={styles.cardTitle}>{m.title}</div>
                  <div className={styles.cardMeta}>
                    {m.genre && GENRES[m.genre] && (
                      <span className={styles.badge}>{GENRES[m.genre]}</span>
                    )}
                    {m.event_time && (
                      <span className={styles.time}>{formatTime(m.event_time)}</span>
                    )}
                  </div>
                  <div className={styles.cardChannels}>
                    {m.channel_count} stream{m.channel_count === 1 ? '' : 's'} available
                  </div>
                </div>
                <div className={styles.watchBtn}>Watch →</div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
