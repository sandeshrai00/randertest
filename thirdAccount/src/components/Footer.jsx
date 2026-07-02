import React from 'react';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <img src="/logo.png" alt="" className={styles.logo} />
          <span className={styles.brandText}>oraScore TV</span>
        </div>
        <p className={styles.disclaimer}>
          SoraScore does not host or store any video streams. All streams are publicly
          available links found on the internet. We do not control, endorse, or take
          responsibility for the content of any third-party streams. Content is the sole
          responsibility of the respective owners. If you have any legal concerns, please
          contact the relevant content providers directly.
        </p>
      </div>
    </footer>
  );
}
