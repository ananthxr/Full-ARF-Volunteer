// AR Treasure Hunt Volunteer Dashboard
// Main page for volunteers to manage team scores and physical scores

import { useState, useEffect } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { subscribeToTeams, updatePhysicalScore, type Team } from '@/lib/firestore';

export default function VolunteerDashboard() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [editingPhysicalScore, setEditingPhysicalScore] = useState<{[key: string]: string}>({});
  const [editingComment, setEditingComment] = useState<{[key: string]: string}>({});
  const [savingScore, setSavingScore] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;

    const setupListener = () => {
      try {
        console.log('Setting up volunteer dashboard listener...');
        
        const unsubscribe = subscribeToTeams((updatedTeams) => {
          console.log('Teams updated:', updatedTeams);
          
          setTeams(updatedTeams);
          setIsLoading(false);
          setLastUpdated(new Date());
          setError('');
          setConnectionStatus('connected');
          retryCount = 0;
        });

        return unsubscribe;
      } catch (error) {
        console.error('Error setting up listener:', error);
        setConnectionStatus('error');
        
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(setupListener, 2000 * retryCount);
        } else {
          setError('Failed to connect to database. Please refresh the page.');
          setIsLoading(false);
        }
      }
    };

    const unsubscribe = setupListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const handlePhysicalScoreChange = (uid: string, value: string) => {
    setEditingPhysicalScore(prev => ({
      ...prev,
      [uid]: value
    }));
  };

  const handleCommentChange = (uid: string, value: string) => {
    setEditingComment(prev => ({
      ...prev,
      [uid]: value
    }));
  };

  const savePhysicalScore = async (uid: string, teamName: string) => {
    const scoreValue = editingPhysicalScore[uid];
    const commentValue = editingComment[uid];
    
    if (scoreValue === undefined) return;

    const numericScore = parseInt(scoreValue, 10);
    if (isNaN(numericScore) || numericScore < 0) {
      alert('Please enter a valid non-negative number');
      return;
    }

    setSavingScore(prev => ({ ...prev, [uid]: true }));

    try {
      await updatePhysicalScore(uid, numericScore, commentValue || '');
      
      // Clear the editing state
      setEditingPhysicalScore(prev => {
        const newState = { ...prev };
        delete newState[uid];
        return newState;
      });
      
      setEditingComment(prev => {
        const newState = { ...prev };
        delete newState[uid];
        return newState;
      });
      
      alert(`Physical score updated for ${teamName}!`);
    } catch (error) {
      console.error('Error saving physical score:', error);
      alert('Failed to save physical score. Please try again.');
    } finally {
      setSavingScore(prev => ({ ...prev, [uid]: false }));
    }
  };

  const cancelEdit = (uid: string) => {
    setEditingPhysicalScore(prev => {
      const newState = { ...prev };
      delete newState[uid];
      return newState;
    });
    
    setEditingComment(prev => {
      const newState = { ...prev };
      delete newState[uid];
      return newState;
    });
  };

  const getSessionStatusColor = (session: any) => {
    if (!session) return '#74b9ff';
    
    // Check various status indicators using actual field names
    const status = session.status;
    const isActive = session.isActive;
    const gameStarted = session.gameStarted || session.started; // Use 'started' field
    const cluesSolved = session.cluesCompleted || session.cluesSolved || 0; // Use 'cluesCompleted'
    const totalClues = session.totalClues || 0;
    
    // Determine status based on available data
    if (status === 'completed' || (totalClues > 0 && cluesSolved >= totalClues)) {
      return '#6c5ce7'; // Purple for completed
    } else if (status === 'active' || status === 'in_progress' || isActive || gameStarted) {
      return '#00b894'; // Green for active/started
    } else if (status === 'paused') {
      return '#fdcb6e'; // Yellow for paused
    } else if (cluesSolved > 0) {
      return '#00b894'; // Green if they've solved clues (active)
    } else {
      return '#74b9ff'; // Blue for not started
    }
  };

  const formatSessionStatus = (session: any) => {
    if (!session) return '⭕ Not Started';
    
    const status = session.status;
    const isActive = session.isActive;
    const gameStarted = session.gameStarted || session.started; // Use 'started' field
    const cluesSolved = session.cluesCompleted || session.cluesSolved || 0; // Use 'cluesCompleted'
    const totalClues = session.totalClues || 0;
    
    // Determine status text based on available data
    if (status === 'completed' || (totalClues > 0 && cluesSolved >= totalClues)) {
      return '🏆 Completed';
    } else if (status === 'active' || status === 'in_progress' || isActive || gameStarted) {
      return '🎯 In Progress';
    } else if (status === 'paused') {
      return '⏸️ Paused';
    } else if (cluesSolved > 0) {
      return '🎯 In Progress';
    } else {
      return '⭕ Not Started';
    }
  };

  const getSessionData = (session: any) => {
    if (!session) {
      return {
        currentClue: 0,
        cluesSolved: 0,
        totalClues: 0
      };
    }

    // Use the actual field names from your Firebase structure
    const currentClue = session.currentClueNumber || session.currentClue || session.currentLevel || 0;
    const cluesSolved = session.cluesCompleted || session.cluesSolved || 0;
    const totalClues = session.totalClues || 0;

    return {
      currentClue,
      cluesSolved,
      totalClues
    };
  };

  const formatLastUpdated = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="color-scheme" content="light only" />
      </Head>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          padding: 0;
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }

        .header {
          background: linear-gradient(135deg, rgba(139,69,19,0.9) 0%, rgba(160,82,45,0.9) 100%);
          color: white;
          padding: 2rem;
          border-radius: 15px;
          text-align: center;
          margin-bottom: 2rem;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }

        .status-indicator {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          border-radius: 25px;
          font-size: 1rem;
          margin-top: 1rem;
          backdrop-filter: blur(10px);
        }

        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        .teams-grid {
          display: grid;
          gap: 1.5rem;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        }

        .team-card {
          background: white;
          border-radius: 15px;
          padding: 1.5rem;
          box-shadow: 0 8px 25px rgba(0,0,0,0.1);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .team-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 35px rgba(0,0,0,0.15);
        }

        .team-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid #f0f0f0;
        }

        .team-name {
          font-size: 1.25rem;
          font-weight: bold;
          color: #333;
        }

        .team-uid {
          background: #667eea;
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.9rem;
          font-weight: bold;
        }

        .team-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .info-item {
          display: flex;
          flex-direction: column;
        }

        .info-label {
          font-size: 0.8rem;
          color: #666;
          font-weight: 600;
          text-transform: uppercase;
          margin-bottom: 0.25rem;
        }

        .info-value {
          font-size: 1rem;
          color: #333;
          font-weight: 500;
        }

        .scores-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-top: 1rem;
        }

        .score-item {
          background: #f8f9ff;
          padding: 1rem;
          border-radius: 10px;
          text-align: center;
        }

        .score-label {
          font-size: 0.8rem;
          color: #667eea;
          font-weight: 600;
          text-transform: uppercase;
          margin-bottom: 0.5rem;
        }

        .score-value {
          font-size: 1.5rem;
          font-weight: bold;
          color: #333;
        }

        .physical-score-edit {
          background: #fff3cd;
          border: 2px solid #ffeaa7;
        }

        .edit-controls {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-top: 0.75rem;
        }

        .edit-row {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .edit-input {
          flex: 1;
          padding: 0.75rem;
          border: 2px solid #667eea;
          border-radius: 8px;
          font-size: 1rem;
          min-height: 44px; /* Better touch targets */
        }

        .comment-input {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid #667eea;
          border-radius: 8px;
          font-size: 1rem;
          resize: vertical;
          min-height: 80px;
        }

        .session-status {
          background: #f1f3f4;
          padding: 1rem;
          border-radius: 10px;
          margin-bottom: 1rem;
        }

        .session-status-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .session-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: bold;
          color: white;
        }

        .session-metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 0.75rem;
        }

        .session-metric {
          text-align: center;
        }

        .session-metric-value {
          font-size: 1.25rem;
          font-weight: bold;
          color: #333;
        }

        .session-metric-label {
          font-size: 0.75rem;
          color: #666;
          text-transform: uppercase;
          margin-top: 0.25rem;
        }

        .btn {
          padding: 0.75rem 1.25rem;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s ease;
          min-height: 44px; /* Better touch targets for tablets */
        }

        .btn-save {
          background: #00b894;
          color: white;
        }

        .btn-save:hover {
          background: #00a085;
        }

        .btn-save:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }

        .btn-cancel {
          background: #e74c3c;
          color: white;
        }

        .btn-cancel:hover {
          background: #c0392b;
        }

        .btn-edit {
          background: #667eea;
          color: white;
          width: 100%;
          margin-top: 0.5rem;
        }

        .btn-edit:hover {
          background: #5a67d8;
        }

        .loading-container {
          text-align: center;
          padding: 3rem;
          background: white;
          border-radius: 15px;
          box-shadow: 0 8px 25px rgba(0,0,0,0.1);
        }

        .error-container {
          background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
          color: white;
          padding: 2rem;
          border-radius: 15px;
          text-align: center;
        }

        .no-teams {
          background: white;
          padding: 3rem;
          border-radius: 15px;
          text-align: center;
          box-shadow: 0 8px 25px rgba(0,0,0,0.1);
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* Tablet optimized (768px - 1024px) */
        @media (max-width: 1024px) {
          .container {
            padding: 1.5rem;
          }
          
          .header {
            padding: 1.5rem;
          }
          
          .header h1 {
            font-size: 2rem !important;
          }
          
          .teams-grid {
            gap: 1.25rem;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          }
          
          .team-card {
            padding: 1.25rem;
          }
          
          .session-metrics {
            grid-template-columns: repeat(3, 1fr);
            gap: 0.5rem;
          }
          
          .session-metric-value {
            font-size: 1.1rem !important;
          }
          
          .session-metric-label {
            font-size: 0.7rem !important;
          }
        }

        /* Mobile optimized (below 768px) */
        @media (max-width: 768px) {
          .container {
            padding: 1rem;
          }
          
          .header {
            padding: 1.25rem;
          }
          
          .header h1 {
            font-size: 1.75rem !important;
          }
          
          .teams-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
          }
          
          .team-card {
            padding: 1rem;
          }
          
          .team-header {
            flex-direction: column;
            gap: 0.75rem;
            text-align: center;
          }
          
          .team-name {
            font-size: 1.1rem !important;
          }
          
          .team-info {
            grid-template-columns: 1fr;
            gap: 0.75rem;
          }
          
          .scores-section {
            grid-template-columns: 1fr;
            gap: 0.75rem;
          }
          
          .session-metrics {
            grid-template-columns: repeat(3, 1fr);
            gap: 0.5rem;
          }
          
          .session-metric-value {
            font-size: 1rem !important;
          }
          
          .session-metric-label {
            font-size: 0.65rem !important;
          }
          
          .edit-controls {
            gap: 0.5rem;
          }
          
          .edit-row {
            flex-direction: column;
            gap: 0.5rem;
          }
          
          .btn {
            padding: 0.75rem 1rem;
            font-size: 0.95rem;
          }
        }

        /* Large tablets and small desktops */
        @media (min-width: 769px) and (max-width: 1200px) {
          .teams-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>

      <Layout 
        title="AR Treasure Hunt - Volunteer Dashboard" 
        description="Volunteer dashboard for managing team physical scores"
      >
        <div className="container">
          {/* Header */}
          <div className="header">
            <h1 style={{ margin: '0 0 1rem 0', fontSize: '2.5rem', fontWeight: 'bold' }}>
              🎯 AR TREASURE HUNT VOLUNTEER DASHBOARD
            </h1>
            <p style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', opacity: 0.9 }}>
              Manage team physical scores and view team data
            </p>
            
            {/* Connection Status */}
            <div 
              className="status-indicator"
              style={{
                background: connectionStatus === 'connected' ? 
                  'rgba(76, 175, 80, 0.3)' : 
                  connectionStatus === 'error' ? 
                  'rgba(244, 67, 54, 0.3)' : 
                  'rgba(255, 193, 7, 0.3)',
                border: '2px solid rgba(255,255,255,0.3)'
              }}
            >
              <span 
                className="status-dot"
                style={{ 
                  background: connectionStatus === 'connected' ? '#4caf50' : 
                             connectionStatus === 'error' ? '#f44336' : '#ff9800'
                }}
              ></span>
              <span style={{fontWeight: 'bold'}}>
                {connectionStatus === 'connected' && '🔴 LIVE DATABASE CONNECTION'}
                {connectionStatus === 'connecting' && '🟡 CONNECTING TO DATABASE...'}
                {connectionStatus === 'error' && '🔴 CONNECTION ERROR'}
              </span>
            </div>
            
            {!isLoading && connectionStatus === 'connected' && (
              <p style={{ marginTop: '1rem', fontSize: '0.9rem', opacity: 0.8 }}>
                Last updated: <strong>{formatLastUpdated(lastUpdated)}</strong>
              </p>
            )}
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="loading-container">
              <h3 style={{ margin: '0 0 1rem 0', color: '#667eea' }}>Loading team data...</h3>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                border: '4px solid #f3f3f3', 
                borderTop: '4px solid #667eea',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto'
              }}></div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="error-container">
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.5rem' }}>⚠️ Connection Error</h3>
              <p style={{ margin: '0', fontSize: '1.1rem' }}>{error}</p>
            </div>
          )}

          {/* Teams Grid */}
          {!isLoading && !error && (
            <div>
              {teams.length === 0 ? (
                <div className="no-teams">
                  <h3 style={{ margin: '0 0 1rem 0', color: '#667eea', fontSize: '1.8rem' }}>
                    No teams registered yet
                  </h3>
                  <p style={{ margin: '0', color: '#666', fontSize: '1.1rem' }}>
                    Teams will appear here once they register for the treasure hunt.
                  </p>
                </div>
              ) : (
                <div className="teams-grid">
                  {teams.map((team) => (
                    <div key={team.uid} className="team-card">
                      <div className="team-header">
                        <div className="team-name">
                          🏴‍☠️ {team.teamName}
                        </div>
                        <div className="team-uid">
                          UID: {team.uid}
                        </div>
                      </div>

                      <div className="team-info">
                        <div className="info-item">
                          <div className="info-label">Team Number</div>
                          <div className="info-value">#{team.teamNumber}</div>
                        </div>
                        <div className="info-item">
                          <div className="info-label">Captain</div>
                          <div className="info-value">{team.player1}</div>
                        </div>
                        <div className="info-item">
                          <div className="info-label">First Mate</div>
                          <div className="info-value">{team.player2}</div>
                        </div>
                        <div className="info-item">
                          <div className="info-label">Email</div>
                          <div className="info-value">{team.email}</div>
                        </div>
                        <div className="info-item">
                          <div className="info-label">Phone</div>
                          <div className="info-value">{team.phoneNumber}</div>
                        </div>
                        <div className="info-item">
                          <div className="info-label">Registered</div>
                          <div className="info-value">
                            {new Date(team.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {/* Session Status */}
                      <div className="session-status">
                        <div className="session-status-header">
                          <h4 style={{ margin: 0, color: '#333', fontSize: '1rem' }}>
                            🎮 Game Progress
                          </h4>
                          <div 
                            className="session-badge"
                            style={{ background: getSessionStatusColor(team.session) }}
                          >
                            {formatSessionStatus(team.session)}
                          </div>
                        </div>
                        <div className="session-metrics">
                          <div className="session-metric">
                            <div className="session-metric-value">
                              {getSessionData(team.session).currentClue}
                            </div>
                            <div className="session-metric-label">Current Clue</div>
                          </div>
                          <div className="session-metric">
                            <div className="session-metric-value">
                              {getSessionData(team.session).cluesSolved}
                            </div>
                            <div className="session-metric-label">Clues Solved</div>
                          </div>
                          <div className="session-metric">
                            <div className="session-metric-value">
                              {getSessionData(team.session).totalClues}
                            </div>
                            <div className="session-metric-label">Total Clues</div>
                          </div>
                        </div>
                      </div>

                      <div className="scores-section">
                        <div className="score-item">
                          <div className="score-label">AR Game Score</div>
                          <div className="score-value">{team.score.toLocaleString()}</div>
                        </div>
                        <div 
                          className={`score-item ${editingPhysicalScore[team.uid] !== undefined ? 'physical-score-edit' : ''}`}
                        >
                          <div className="score-label">Physical Score</div>
                          {editingPhysicalScore[team.uid] !== undefined ? (
                            <div>
                              <div className="edit-controls">
                                <div className="edit-row">
                                  <input
                                    type="number"
                                    min="0"
                                    value={editingPhysicalScore[team.uid]}
                                    onChange={(e) => handlePhysicalScoreChange(team.uid, e.target.value)}
                                    className="edit-input"
                                    placeholder="Enter physical score"
                                  />
                                  <button
                                    onClick={() => savePhysicalScore(team.uid, team.teamName)}
                                    className="btn btn-save"
                                    disabled={savingScore[team.uid]}
                                  >
                                    {savingScore[team.uid] ? '💾' : '✅'}
                                  </button>
                                  <button
                                    onClick={() => cancelEdit(team.uid)}
                                    className="btn btn-cancel"
                                    disabled={savingScore[team.uid]}
                                  >
                                    ❌
                                  </button>
                                </div>
                                <textarea
                                  value={editingComment[team.uid] || team.physicalScoreComment || ''}
                                  onChange={(e) => handleCommentChange(team.uid, e.target.value)}
                                  className="comment-input"
                                  placeholder="Add performance notes (e.g., 'Finished in 1:30 mins, 3 attempts', 'Great teamwork!')"
                                />
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="score-value">{(team.physicalScore || 0).toLocaleString()}</div>
                              {team.physicalScoreComment && (
                                <div style={{
                                  fontSize: '0.8rem',
                                  color: '#666',
                                  marginTop: '0.5rem',
                                  fontStyle: 'italic',
                                  background: '#f8f9ff',
                                  padding: '0.5rem',
                                  borderRadius: '6px',
                                  border: '1px solid #e1e5f2'
                                }}>
                                  📝 {team.physicalScoreComment}
                                </div>
                              )}
                              <button
                                onClick={() => {
                                  handlePhysicalScoreChange(team.uid, (team.physicalScore || 0).toString());
                                  handleCommentChange(team.uid, team.physicalScoreComment || '');
                                }}
                                className="btn btn-edit"
                              >
                                ✏️ Edit Physical Score
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {!isLoading && teams.length > 0 && (
            <div style={{ 
              marginTop: '2rem', 
              padding: '1.5rem',
              background: 'white',
              borderRadius: '15px',
              textAlign: 'center',
              boxShadow: '0 8px 25px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ margin: '0 0 1rem 0', color: '#667eea' }}>📊 Summary Statistics</h3>
              <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '2rem' }}>
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#667eea' }}>
                    {teams.length}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>Total Teams</div>
                </div>
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#00b894' }}>
                    {teams.reduce((sum, team) => sum + team.score, 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>AR Game Points</div>
                </div>
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#e17055' }}>
                    {teams.reduce((sum, team) => sum + (team.physicalScore || 0), 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>Physical Points</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}