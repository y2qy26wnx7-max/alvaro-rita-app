import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { initializeApp, getApps } from "firebase/app";
import { doc, getFirestore, onSnapshot, setDoc } from "firebase/firestore";

const ROOM_ID = "alvaro-rita";

const firebaseConfig = {
  apiKey: "AIzaSyBTCddNMyuCYAF_7UN9A2BGoU6zGy0vZ7U",
  authDomain: "alvaro-rita-app.firebaseapp.com",
  projectId: "alvaro-rita-app",
  storageBucket: "alvaro-rita-app.firebasestorage.app",
  messagingSenderId: "392229615718",
  appId: "1:392229615718:web:ec98d295afcdf1b8ec15a7",
  measurementId: "G-X4Q3GEL9L4",
};

function createDb() {
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return getFirestore(app);
}

const defaultState = {
  players: [
    { id: "p1", name: "Álvaro", emoji: "👑", score: 0 },
    { id: "p2", name: "Rita", emoji: "💗", score: 0 },
  ],
  actions: [
    { id: "a1", name: "Llegar tarde", points: -2, type: "negative" },
    { id: "a2", name: "Cancelar plan", points: -3, type: "negative" },
    { id: "a3", name: "Contestar seco", points: -1, type: "negative" },
    { id: "a4", name: "Insulto de coña", points: -2, type: "negative" },
    { id: "a5", name: "Olvidar algo importante", points: -4, type: "negative" },
    { id: "a6", name: "No proponer plan", points: -2, type: "negative" },
    { id: "a7", name: "Invitar a algo", points: 3, type: "positive" },
    { id: "a8", name: "Sorpresa bonita", points: 5, type: "positive" },
    { id: "a9", name: "Mensaje bonito", points: 2, type: "positive" },
    { id: "a10", name: "Organizar plan", points: 2, type: "positive" },
    { id: "a11", name: "Pedir perdón bien", points: 2, type: "positive" },
    { id: "a12", name: "Regalo", points: 4, type: "positive" },
  ],
  logs: [],
  punishments: [
    { threshold: -10, text: "Debe una cena 🍝" },
    { threshold: -20, text: "Debe un plan especial 🎡" },
    { threshold: -30, text: "Debe un regalo 🎁" },
  ],
  rewards: [
    { threshold: 20, text: "Puede elegir el próximo plan 😌" },
    { threshold: 30, text: "Premio especial de pareja 💘" },
  ],
};

function playerNameClass(name) {
  if (name === "Álvaro") return "name-alvaro";
  if (name === "Rita") return "name-rita";
  return "";
}

function pointsClass(points) {
  if (points > 0) return "points-positive";
  if (points < 0) return "points-negative";
  return "points-neutral";
}

export default function App() {
  const [state, setState] = useState(defaultState);
  const [selectedPlayer, setSelectedPlayer] = useState("p1");
  const [customName, setCustomName] = useState("");
  const [customPoints, setCustomPoints] = useState("1");
  const [customNote, setCustomNote] = useState("");
  const [newActionName, setNewActionName] = useState("");
  const [newActionPoints, setNewActionPoints] = useState("1");
  const [activeTab, setActiveTab] = useState("negative");
  const [saveStatus, setSaveStatus] = useState("Conectando...");

  useEffect(() => {
    const db = createDb();
    const roomRef = doc(db, "scoreboards", ROOM_ID);

    const unsubscribe = onSnapshot(roomRef, async (snapshot) => {
      if (snapshot.exists()) {
        setState(snapshot.data());
        setSaveStatus("Sincronizado en tiempo real");
      } else {
        await setDoc(roomRef, defaultState);
        setSaveStatus("Base creada y sincronizada");
      }
    });

    return () => unsubscribe();
  }, []);

  async function saveRemote(nextState) {
    setState(nextState);
    const db = createDb();
    const roomRef = doc(db, "scoreboards", ROOM_ID);
    await setDoc(roomRef, nextState);
    setSaveStatus("Cambios guardados");
  }

  const playersById = useMemo(
    () => Object.fromEntries(state.players.map((p) => [p.id, p])),
    [state.players]
  );

  const ranking = useMemo(
    () => [...state.players].sort((a, b) => b.score - a.score),
    [state.players]
  );

  const stats = useMemo(() => {
    const totals = Object.fromEntries(
      state.players.map((p) => [p.id, { positives: 0, negatives: 0, streak: 0 }])
    );

    state.logs.forEach((log) => {
      if (!totals[log.playerId]) return;
      if (log.points > 0) totals[log.playerId].positives += log.points;
      if (log.points < 0) totals[log.playerId].negatives += Math.abs(log.points);
    });

    for (const player of state.players) {
      let streak = 0;
      for (const log of state.logs) {
        if (log.playerId === player.id && log.points > 0) streak += 1;
        if (log.playerId === player.id && log.points < 0) streak = 0;
      }
      totals[player.id].streak = streak;
    }

    return totals;
  }, [state.logs, state.players]);

  async function applyAction(playerId, action) {
    const now = new Date();

    const nextState = {
      ...state,
      players: state.players.map((p) =>
        p.id === playerId ? { ...p, score: p.score + action.points } : p
      ),
      logs: [
        {
          id: crypto.randomUUID(),
          playerId,
          actionName: action.name,
          points: action.points,
          note: action.note || "",
          createdAt: now.toISOString(),
        },
        ...state.logs,
      ],
    };

    await saveRemote(nextState);
  }

  async function createCustomAction() {
    const points = Number(customPoints);
    if (!customName.trim() || Number.isNaN(points)) return;

    await applyAction(selectedPlayer, {
      name: customName.trim(),
      points,
      note: customNote.trim(),
    });

    setCustomName("");
    setCustomPoints("1");
    setCustomNote("");
  }

  async function addPresetAction() {
    const points = Number(newActionPoints);
    if (!newActionName.trim() || Number.isNaN(points)) return;

    const nextState = {
      ...state,
      actions: [
        {
          id: crypto.randomUUID(),
          name: newActionName.trim(),
          points,
          type: points >= 0 ? "positive" : "negative",
        },
        ...state.actions,
      ],
    };

    await saveRemote(nextState);
    setNewActionName("");
    setNewActionPoints("1");
  }

  async function renamePlayer(id, name) {
    const nextState = {
      ...state,
      players: state.players.map((p) => (p.id === id ? { ...p, name } : p)),
    };

    await saveRemote(nextState);
  }

  async function resetAll() {
    const nextState = {
      ...state,
      players: state.players.map((p) => ({ ...p, score: 0 })),
      logs: [],
    };

    await saveRemote(nextState);
  }

  async function removeLog(log) {
    const nextState = {
      ...state,
      players: state.players.map((p) =>
        p.id === log.playerId ? { ...p, score: p.score - log.points } : p
      ),
      logs: state.logs.filter((l) => l.id !== log.id),
    };

    await saveRemote(nextState);
  }

  const filteredActions = state.actions.filter((a) => a.type === activeTab);

  return (
    <div className="app">
      <div className="container">
        <div className="top-grid">
          <section className="card hero-card">
            <div>
              <div className="pill">♡ Modo pareja competitivo</div>
              <h1>Alvaro y Rita</h1>
              <p className="subtitle">que se aman</p>
              <div className="muted status-text">{saveStatus}</div>
            </div>

            <details className="config-box">
              <summary>Configurar</summary>

              <div className="config-section">
                <h3>Nombres</h3>
                {state.players.map((player) => (
                  <div key={player.id} className="field-row">
                    <label>{player.id === "p1" ? "Jugador 1" : "Jugador 2"}</label>
                    <input
                      value={player.name}
                      onChange={(e) => renamePlayer(player.id, e.target.value)}
                    />
                  </div>
                ))}
              </div>

              <div className="config-section">
                <h3>Añadir acción fija</h3>
                <div className="field-row">
                  <label>Nombre</label>
                  <input
                    value={newActionName}
                    onChange={(e) => setNewActionName(e.target.value)}
                    placeholder="Ej: No avisar que ya salió"
                  />
                </div>
                <div className="field-row">
                  <label>Puntos</label>
                  <input
                    value={newActionPoints}
                    onChange={(e) => setNewActionPoints(e.target.value)}
                    placeholder="-2 o 3"
                  />
                </div>
                <button onClick={addPresetAction}>Añadir acción</button>
              </div>

              <button className="danger-button" onClick={resetAll}>
                Resetear marcador e historial
              </button>
            </details>
          </section>

          <section className="card">
            <h2>🏆 Ranking</h2>
            <div className="stack">
              {ranking.map((player) => (
                <div key={player.id} className="rank-row">
                  <div className="rank-left">
                    <div className="avatar">
                      <img
                        src={player.id === "p1" ? "/alvaro.jpg" : "/rita.jpg"}
                        alt={player.name}
                        className="avatar-img"
                      />
                    </div>
                    <div>
                      <div className={`player-name ${playerNameClass(player.name)}`}>
                        {player.name}
                      </div>
                      <div className="muted">
                        Racha positiva: {stats[player.id]?.streak || 0}
                      </div>
                    </div>
                  </div>
                  <div className={`points-badge ${pointsClass(player.score)}`}>
                    {player.score > 0 ? "+" : ""}
                    {player.score} pts
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="main-grid">
          <div className="left-column">
            <section className="card">
              <h2>Acciones rápidas</h2>

              <div className="tab-buttons">
                <button
                  className={activeTab === "negative" ? "active-tab" : ""}
                  onClick={() => setActiveTab("negative")}
                >
                  Negativas
                </button>
                <button
                  className={activeTab === "positive" ? "active-tab" : ""}
                  onClick={() => setActiveTab("positive")}
                >
                  Positivas
                </button>
              </div>

              <div className="player-buttons">
                {state.players.map((p) => (
                  <button
                    key={p.id}
                    className={selectedPlayer === p.id ? "selected-player" : ""}
                    onClick={() => setSelectedPlayer(p.id)}
                  >
                    {p.emoji} {p.name}
                  </button>
                ))}
              </div>

              <div className="actions-grid">
                {filteredActions.map((action) => (
                  <button
                    key={action.id}
                    className="action-card"
                    onClick={() => applyAction(selectedPlayer, action)}
                  >
                    <div className="action-top">
                      <span>Acción</span>
                      <span className={`points-badge ${pointsClass(action.points)}`}>
                        {action.points > 0 ? "+" : ""}
                        {action.points}
                      </span>
                    </div>
                    <div
                      className={
                        action.type === "positive"
                          ? "action-title positive-text"
                          : "action-title negative-text"
                      }
                    >
                      {action.name}
                    </div>
                    <div className="muted small">
                      Se aplica a {playersById[selectedPlayer]?.name}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="card">
              <h2>Acción personalizada</h2>

              <div className="form-grid">
                <select
                  value={selectedPlayer}
                  onChange={(e) => setSelectedPlayer(e.target.value)}
                >
                  {state.players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <input
                  placeholder="Nombre de la acción"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />

                <input
                  placeholder="Puntos, ej: -4 o 3"
                  value={customPoints}
                  onChange={(e) => setCustomPoints(e.target.value)}
                />

                <input
                  placeholder="Nota opcional"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                />
              </div>

              <button onClick={createCustomAction}>Guardar en historial</button>
            </section>

            <section className="card">
              <h2>Historial</h2>

              <div className="stack">
                {state.logs.length === 0 && (
                  <div className="empty-box">
                    Todavía no hay movimientos. Empieza el pique sano 😏
                  </div>
                )}

                {state.logs.map((log) => (
                  <div key={log.id} className="history-row">
                    <div>
                      <div className="history-title">
                        <span className={playerNameClass(playersById[log.playerId]?.name)}>
                          {playersById[log.playerId]?.name}
                        </span>{" "}
                        — {log.actionName}
                      </div>
                      <div className="muted small">
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                      {log.note ? <div className="small">{log.note}</div> : null}
                    </div>

                    <div className="history-right">
                      <span className={`points-badge ${pointsClass(log.points)}`}>
                        {log.points > 0 ? "+" : ""}
                        {log.points} pts
                      </span>
                      <button className="delete-button" onClick={() => removeLog(log)}>
                        Borrar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="right-column">
            <section className="card">
              <h2>Resumen de pareja</h2>
              <div className="stack">
                {state.players.map((player) => (
                  <div key={player.id} className="summary-box">
                    <div className="summary-top">
                      <div className="player-name">
                        <img
                          src={player.id === "p1" ? "/alvaro.jpg" : "/rita.jpg"}
                          alt={player.name}
                          className="mini-avatar"
                        />{" "}
                        <span className={playerNameClass(player.name)}>{player.name}</span>
                      </div>
                      <span className={`points-badge ${pointsClass(player.score)}`}>
                        {player.score > 0 ? "+" : ""}
                        {player.score}
                      </span>
                    </div>

                    <div className="stats-grid">
                      <div className="mini-box">
                        <div className="muted">Positivos</div>
                        <div className="positive-text">
                          +{stats[player.id]?.positives || 0}
                        </div>
                      </div>
                      <div className="mini-box">
                        <div className="muted">Negativos</div>
                        <div className="negative-text">
                          -{stats[player.id]?.negatives || 0}
                        </div>
                      </div>
                      <div className="mini-box">
                        <div className="muted">Racha</div>
                        <div>🔥 {stats[player.id]?.streak || 0}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card">
              <h2>Castigos automáticos</h2>
              <div className="stack">
                {state.players.map((player) => {
                  const activePunishments = state.punishments.filter(
                    (p) => player.score <= p.threshold
                  );

                  return (
                    <div key={player.id} className="summary-box">
                      <div className="player-name">
                        <span className={playerNameClass(player.name)}>{player.name}</span>
                      </div>

                      {activePunishments.length ? (
                        activePunishments.map((p, idx) => (
                          <div key={idx} className="punishment-box">
                            {p.text}
                          </div>
                        ))
                      ) : (
                        <div className="muted">Sin castigos activos.</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="card">
              <h2>Recompensas</h2>
              <div className="stack">
                {state.players.map((player) => {
                  const activeRewards = state.rewards.filter(
                    (r) => player.score >= r.threshold
                  );

                  return (
                    <div key={player.id} className="summary-box">
                      <div className="player-name">
                        <span className={playerNameClass(player.name)}>{player.name}</span>
                      </div>

                      {activeRewards.length ? (
                        activeRewards.map((r, idx) => (
                          <div key={idx} className="reward-box">
                            {r.text}
                          </div>
                        ))
                      ) : (
                        <div className="muted">Todavía sin premio desbloqueado.</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>

        <section className="footer-note">
          Esta versión guarda los datos en este navegador. Cuando ya la veas bien,
          te paso el siguiente paso para dejarla con Firebase compartido y subirla.
        </section>
      </div>
    </div>
  );
}