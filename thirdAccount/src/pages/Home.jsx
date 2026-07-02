import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMatches, GENRES } from '../api';
import Footer from '../components/Footer';
import styles from './Home.module.css';

function formatTime(t) {
  if (!t) return null;
  try {
    return new Date(t).toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
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

  const featured = matches[0];
  const rest = matches.slice(1);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.center}>
          <div className={styles.spinner} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.center}>
          <p className={styles.error}>Failed to load matches: {error}</p>
        </div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <img src="/logo.png" alt="" className={styles.logo} />
            <span className={styles.brandText}>oraScore TV</span>
          </div>
        </header>
        <div className={styles.center}>
          <p className={styles.empty}>No live matches right now. Check back soon.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <img src="/logo.png" alt="" className={styles.logo} />
          <span className={styles.brandText}>oraScore TV</span>
        </div>
        <p className={styles.tagline}>Free live sports streams</p>
      </header>

      <main className={styles.main}>
        {/* Hero */}
        {featured && (
          <Link to={`/live/${featured.custom_slug}`} className={styles.hero}>
            <div className={styles.heroBg}>
              {featured.logo_url && (
                <img src={featured.logo_url} alt="" className={styles.heroLogo} />
              )}
            </div>
            <div className={styles.heroBody}>
              <div className={styles.heroMeta}>
                {featured.genre && GENRES[featured.genre] && (
                  <span className={styles.badge}>{GENRES[featured.genre]}</span>
                )}
                {featured.event_time && (
                  <span className={styles.heroTime}>{formatTime(featured.event_time)}</span>
                )}
              </div>
              <h2 className={styles.heroTitle}>{featured.title}</h2>
              <span className={styles.heroCta}>Watch →</span>
            </div>
          </Link>
        )}

        {/* Upcoming divider */}
        {rest.length > 0 && (
          <>
            <div className={styles.divider}>
              <span className={styles.dividerLabel}>Upcoming</span>
            </div>

            <div className={styles.list}>
              {rest.map(m => (
                <Link key={m.id} to={`/live/${m.custom_slug}`} className={styles.item}>
                  {m.logo_url && (
                    <img
                      src={m.logo_url}
                      alt=""
                      className={styles.itemLogo}
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <div className={styles.itemBody}>
                    <div className={styles.itemTitle}>{m.title}</div>
                    <div className={styles.itemMeta}>
                      {m.genre && GENRES[m.genre] && (
                        <span className={styles.badge}>{GENRES[m.genre]}</span>
                      )}
                      <span className={styles.itemDetail}>
                        {m.channel_count} stream{m.channel_count === 1 ? '' : 's'}
                      </span>
                      {m.event_time && (
                        <span className={styles.itemDetail}>{formatTime(m.event_time)}</span>
                      )}
                    </div>
                  </div>
                  <span className={styles.itemArrow}>→</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
