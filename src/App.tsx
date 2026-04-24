import styles from './App.module.css';

function App() {
  return (
    <div className={styles.layout}>
      <div className={styles.toolbar}>Toolbar</div>
      <div className={styles.main}>
        <div className={styles.graphArea}>Graph</div>
        <div className={styles.panel}>Panel</div>
      </div>
      <div className={styles.statusBar}>Status</div>
    </div>
  );
}

export default App;
