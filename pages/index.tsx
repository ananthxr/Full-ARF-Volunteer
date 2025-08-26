// AR Treasure Hunt Volunteer Dashboard
// Main page for volunteers to manage team scores and physical scores

import { useState, useEffect } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { subscribeToTeams, updatePhysicalScore, resetAllTeams, publishVolunteerStart, publishVolunteerEnd, getHuntStatus, subscribeToHuntStatus, savePhysicalScoreEntries, getPhysicalScoreEntries, type Team, type PhysicalScoreEntry } from '@/lib/firestore';

export default function VolunteerDashboard() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [editingPhysicalScore, setEditingPhysicalScore] = useState<{[key: string]: string}>({});
  const [editingComment, setEditingComment] = useState<{[key: string]: string}>({});
  const [savingScore, setSavingScore] = useState<{[key: string]: boolean}>({});
  const [isResetting, setIsResetting] = useState(false);
  const [isStartingHunt, setIsStartingHunt] = useState(false);
  const [huntStatus, setHuntStatus] = useState<boolean>(false);
  const [huntStatusLoading, setHuntStatusLoading] = useState(true);
  
  // Physical game scoring table state
  const [physicalScoreTable, setPhysicalScoreTable] = useState<{[teamUid: string]: PhysicalScoreEntry[]}>({});
  const [showScoreTable, setShowScoreTable] = useState<{[teamUid: string]: boolean}>({});

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

  // Load existing physical score entries when teams are loaded
  useEffect(() => {
    if (teams.length > 0) {
      const loadScoreEntries = async () => {
        const newScoreTable: {[teamUid: string]: PhysicalScoreEntry[]} = {};
        
        for (const team of teams) {
          if (team.physicalScoreEntries && team.physicalScoreEntries.length > 0) {
            newScoreTable[team.uid] = team.physicalScoreEntries;
          }
        }
        
        setPhysicalScoreTable(newScoreTable);
      };
      
      loadScoreEntries();
    }
  }, [teams]);

  // Hunt status listener
  useEffect(() => {
    console.log('Setting up hunt status listener...');
    
    const unsubscribeHuntStatus = subscribeToHuntStatus((status) => {
      console.log('Hunt status received:', status);
      setHuntStatus(status);
      setHuntStatusLoading(false);
    });

    // Initial load of hunt status
    getHuntStatus().then((status) => {
      setHuntStatus(status);
      setHuntStatusLoading(false);
    }).catch((error) => {
      console.error('Error getting initial hunt status:', error);
      setHuntStatusLoading(false);
    });

    return () => {
      if (unsubscribeHuntStatus) {
        unsubscribeHuntStatus();
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

  // Physical scoring table functions
  const addScoreRow = (teamUid: string) => {
    const newId = Date.now().toString();
    setPhysicalScoreTable(prev => ({
      ...prev,
      [teamUid]: [
        ...(prev[teamUid] || []),
        { id: newId, score: 0, volunteer: '', benchmark: '', isAdded: false, timestamp: Date.now() }
      ]
    }));
  };

  const removeScoreRow = async (teamUid: string, rowId: string) => {
    const updatedEntries = (physicalScoreTable[teamUid] || []).filter(row => row.id !== rowId);
    
    // Update local state
    setPhysicalScoreTable(prev => ({
      ...prev,
      [teamUid]: updatedEntries
    }));

    // Save to database
    try {
      await savePhysicalScoreEntries(teamUid, updatedEntries);
    } catch (error) {
      console.error('Error saving score entries:', error);
      alert('Failed to save score entries. Please try again.');
    }
  };

  const updateScoreRow = (teamUid: string, rowId: string, field: 'score' | 'volunteer' | 'benchmark', value: string | number) => {
    const updatedEntries = (physicalScoreTable[teamUid] || []).map(row => 
      row.id === rowId ? { ...row, [field]: value } : row
    );
    
    // Update local state immediately for responsive UI
    setPhysicalScoreTable(prev => ({
      ...prev,
      [teamUid]: updatedEntries
    }));

    // Auto-save changes (only for non-added entries since added entries are finalized)
    const row = updatedEntries.find(r => r.id === rowId);
    if (row && !row.isAdded) {
      // Debounce saves to avoid too many database calls
      clearTimeout((window as any)[`saveTimeout_${teamUid}_${rowId}`]);
      (window as any)[`saveTimeout_${teamUid}_${rowId}`] = setTimeout(async () => {
        try {
          await savePhysicalScoreEntries(teamUid, updatedEntries);
        } catch (error) {
          console.error('Error auto-saving score entries:', error);
        }
      }, 1000); // Save after 1 second of no changes
    }
  };

  const getNetPhysicalScore = (teamUid: string) => {
    const rows = physicalScoreTable[teamUid] || [];
    return rows.reduce((sum, row) => sum + (row.isAdded ? (row.score || 0) : 0), 0);
  };

  const toggleScoreTable = (teamUid: string) => {
    setShowScoreTable(prev => ({
      ...prev,
      [teamUid]: !prev[teamUid]
    }));
  };

  const addScoreEntry = async (teamUid: string, rowId: string) => {
    const row = (physicalScoreTable[teamUid] || []).find(r => r.id === rowId);
    if (!row) return;

    // Validate required fields
    if (!row.volunteer.trim()) {
      alert('Please enter a volunteer name before adding the score.');
      return;
    }
    if (!row.benchmark.trim()) {
      alert('Please enter a benchmark before adding the score.');
      return;
    }

    // Mark the row as added and update timestamp
    const updatedEntries = (physicalScoreTable[teamUid] || []).map(r => 
      r.id === rowId ? { ...r, isAdded: true, timestamp: Date.now() } : r
    );

    // Update local state
    setPhysicalScoreTable(prev => ({
      ...prev,
      [teamUid]: updatedEntries
    }));

    // Save to database
    try {
      await savePhysicalScoreEntries(teamUid, updatedEntries);
    } catch (error) {
      console.error('Error saving score entries:', error);
      alert('Failed to save score entries. Please try again.');
    }
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

  const handleResetAll = async () => {
    const password = prompt('⚠️ DANGER: This will reset ALL team progress and scores to ZERO!\n\nEnter password to confirm:');
    
    if (password !== 'ananthJEE2@') {
      if (password !== null) {
        alert('❌ Incorrect password. Reset cancelled.');
      }
      return;
    }

    const finalConfirm = confirm('🚨 FINAL CONFIRMATION: Are you absolutely sure you want to reset ALL teams?\n\nThis action cannot be undone!');
    
    if (!finalConfirm) {
      return;
    }

    setIsResetting(true);
    
    try {
      await resetAllTeams();
      alert('✅ All teams have been reset successfully!');
    } catch (error) {
      console.error('Error resetting teams:', error);
      alert('❌ Error resetting teams. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleToggleHunt = async () => {
    const action = huntStatus ? 'end' : 'start';
    const actionText = huntStatus ? 'End' : 'Start';
    const emoji = huntStatus ? '🛑' : '🎯';
    
    const password = prompt(`${emoji} ${actionText} the treasure hunt!\n\nEnter password to confirm:`);
    
    if (password !== 'ananthJEE2@') {
      if (password !== null) {
        alert(`❌ Incorrect password. ${actionText} cancelled.`);
      }
      return;
    }

    setIsStartingHunt(true);
    
    try {
      if (huntStatus) {
        await publishVolunteerEnd();
        alert('🛑 Treasure hunt ended successfully! Signal sent to all teams.');
      } else {
        await publishVolunteerStart();
        alert('🚀 Treasure hunt started successfully! Signal sent to all teams.');
      }
    } catch (error) {
      console.error(`Error ${action}ing hunt:`, error);
      alert(`❌ Error ${action}ing hunt. Please try again.`);
    } finally {
      setIsStartingHunt(false);
    }
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

        .admin-controls {
          background: linear-gradient(135deg, rgba(139,69,19,0.9) 0%, rgba(160,82,45,0.9) 100%);
          color: white;
          padding: 1.5rem;
          border-radius: 15px;
          margin-bottom: 2rem;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }

        .admin-buttons {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
          margin-top: 1rem;
        }

        .btn-danger {
          background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
          color: white;
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: bold;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          box-shadow: 0 4px 15px rgba(231, 76, 60, 0.3);
          transition: all 0.3s ease;
        }

        .btn-danger:hover:not(:disabled) {
          background: linear-gradient(135deg, #c0392b 0%, #a93226 100%);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(231, 76, 60, 0.4);
        }

        .btn-danger:disabled {
          background: #95a5a6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .btn-start {
          background: linear-gradient(135deg, #00b894 0%, #00a085 100%);
          color: white;
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: bold;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          box-shadow: 0 4px 15px rgba(0, 184, 148, 0.3);
          transition: all 0.3s ease;
        }

        .btn-start:hover:not(:disabled) {
          background: linear-gradient(135deg, #00a085 0%, #008f72 100%);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 184, 148, 0.4);
        }

        .btn-start:disabled {
          background: #95a5a6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .btn-end {
          background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
          color: white;
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: bold;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          box-shadow: 0 4px 15px rgba(231, 76, 60, 0.3);
          transition: all 0.3s ease;
        }

        .btn-end:hover:not(:disabled) {
          background: linear-gradient(135deg, #c0392b 0%, #a93226 100%);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(231, 76, 60, 0.4);
        }

        .btn-end:disabled {
          background: #95a5a6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .hunt-status-indicator {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
          justify-content: center;
        }

        .status-light {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(0,0,0,0.3);
          animation: pulse 2s infinite;
        }

        .status-light.active {
          background: #00b894;
          box-shadow: 0 0 20px rgba(0, 184, 148, 0.6);
        }

        .status-light.inactive {
          background: #e74c3c;
          box-shadow: 0 0 20px rgba(231, 76, 60, 0.6);
        }

        .status-light.loading {
          background: #fdcb6e;
          box-shadow: 0 0 20px rgba(253, 203, 110, 0.6);
        }

        .status-text {
          font-size: 1.1rem;
          font-weight: bold;
        }

        .status-text.active {
          color: #00b894;
        }

        .status-text.inactive {
          color: #e74c3c;
        }

        .status-text.loading {
          color: #fdcb6e;
        }

        .score-table-container {
          background: #f8f9ff;
          border: 2px solid #667eea;
          border-radius: 10px;
          padding: 1rem;
          margin: 0;
        }

        .score-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .score-table th,
        .score-table td {
          padding: 0.75rem;
          border-bottom: 1px solid #e1e5f2;
          text-align: left;
        }

        .score-table th {
          background: #667eea;
          color: white;
          font-weight: bold;
          font-size: 0.9rem;
          text-transform: uppercase;
        }

        .score-table input {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 0.9rem;
        }

        .score-table input[type="number"] {
          text-align: center;
          width: 80px;
          font-size: 1rem;
          font-weight: bold;
        }

        .table-controls {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
          flex-wrap: wrap;
        }

        .btn-table-toggle {
          background: #667eea;
          color: white;
          padding: 0.75rem 1rem;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 600;
        }

        .btn-table-toggle:hover {
          background: #5a67d8;
        }

        .btn-add-row {
          background: #00b894;
          color: white;
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 600;
        }

        .btn-add-row:hover {
          background: #00a085;
        }

        .btn-remove-row {
          background: #e74c3c;
          color: white;
          padding: 0.25rem 0.5rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.8rem;
        }

        .btn-remove-row:hover {
          background: #c0392b;
        }

        .btn-add-score {
          background: #00b894;
          color: white;
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .btn-add-score:hover {
          background: #00a085;
        }

        .btn-add-score:disabled {
          background: #95a5a6;
          cursor: not-allowed;
        }

        .score-row-added {
          background-color: #d4edda !important;
          border-left: 4px solid #00b894 !important;
        }

        .score-row-added input {
          background-color: #f8f9fa !important;
          cursor: not-allowed;
        }

        .net-score-display {
          background: #00b894;
          color: white;
          padding: 0.75rem;
          border-radius: 8px;
          text-align: center;
          font-weight: bold;
          margin-bottom: 1rem;
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

          {/* Admin Controls */}
          <div className="admin-controls">
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', fontWeight: 'bold', textAlign: 'center' }}>
              🔐 Admin Controls
            </h3>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', opacity: 0.9, textAlign: 'center' }}>
              Password-protected actions for hunt management
            </p>
            
            {/* Hunt Status Indicator */}
            <div className="hunt-status-indicator">
              <div 
                className={`status-light ${
                  huntStatusLoading ? 'loading' : huntStatus ? 'active' : 'inactive'
                }`}
              ></div>
              <div 
                className={`status-text ${
                  huntStatusLoading ? 'loading' : huntStatus ? 'active' : 'inactive'
                }`}
              >
                {huntStatusLoading ? 'Loading hunt status...' : 
                 huntStatus ? '🟢 HUNT IS ACTIVE' : '🔴 HUNT IS INACTIVE'}
              </div>
            </div>
            
            <div className="admin-buttons">
              <button
                onClick={() => window.location.href = '/hide-treasures'}
                className="btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #8B4513 0%, #D2691E 100%)',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 15px rgba(139, 69, 19, 0.3)',
                  transition: 'all 0.3s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(139, 69, 19, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0px)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(139, 69, 19, 0.3)';
                }}
              >
                <span>🗺️</span>
                Hide Treasures
              </button>

              <button
                onClick={() => window.location.href = '/treasure-dashboard'}
                className="btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #228B22 0%, #32CD32 100%)',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 15px rgba(34, 139, 34, 0.3)',
                  transition: 'all 0.3s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(34, 139, 34, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0px)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(34, 139, 34, 0.3)';
                }}
              >
                <span>🏴‍☠️</span>
                Treasure Dashboard
              </button>

              <button
                onClick={handleResetAll}
                className="btn-danger"
                disabled={isResetting || isLoading}
              >
                <span>⚠️</span>
                {isResetting ? 'Resetting...' : 'Reset ALL'}
              </button>
              
              <button
                onClick={handleToggleHunt}
                className={huntStatus ? "btn-end" : "btn-start"}
                disabled={isStartingHunt || isLoading || huntStatusLoading}
              >
                <span>{huntStatus ? '🛑' : '🚀'}</span>
                {isStartingHunt ? 
                  (huntStatus ? 'Starting...' : 'Ending...') : 
                  (huntStatus ? 'End Hunt' : 'Start Hunt')}
              </button>
            </div>
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

                      {/* Conditional content: either team details or scoring table */}
                      {showScoreTable[team.uid] ? (
                        /* Scoring Table View */
                        <div>
                          {/* Table header with back button */}
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            marginBottom: '1rem',
                            paddingBottom: '1rem',
                            borderBottom: '2px solid #f0f0f0'
                          }}>
                            <h4 style={{ margin: 0, color: '#333', fontSize: '1.1rem' }}>
                              📊 Physical Game Scoring
                            </h4>
                            <button
                              onClick={() => toggleScoreTable(team.uid)}
                              className="btn-table-toggle"
                              style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                            >
                              ⬅️ Back to Details
                            </button>
                          </div>

                          {/* Net score display */}
                          <div className="net-score-display" style={{ marginBottom: '1rem' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                              {getNetPhysicalScore(team.uid).toLocaleString()}
                            </div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                              Net Score ({(physicalScoreTable[team.uid] || []).filter(row => row.isAdded).length} added / {(physicalScoreTable[team.uid] || []).length} total)
                            </div>
                          </div>

                          {/* Add Row button */}
                          <div style={{ marginBottom: '1rem' }}>
                            <button
                              onClick={() => addScoreRow(team.uid)}
                              className="btn-add-row"
                            >
                              ➕ Add Row
                            </button>
                          </div>

                          {/* Scoring table */}
                          <div className="score-table-container">
                            <table className="score-table">
                              <thead>
                                <tr>
                                  <th>Score</th>
                                  <th>Volunteer Name</th>
                                  <th>Benchmark</th>
                                  <th>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(physicalScoreTable[team.uid] || []).map((row) => (
                                  <tr key={row.id} className={row.isAdded ? 'score-row-added' : ''}>
                                    <td>
                                      <input
                                        type="number"
                                        value={row.score}
                                        onChange={(e) => updateScoreRow(team.uid, row.id, 'score', parseFloat(e.target.value) || 0)}
                                        placeholder="0"
                                        disabled={row.isAdded}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        type="text"
                                        value={row.volunteer}
                                        onChange={(e) => updateScoreRow(team.uid, row.id, 'volunteer', e.target.value)}
                                        placeholder="Volunteer name"
                                        disabled={row.isAdded}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        type="text"
                                        value={row.benchmark}
                                        onChange={(e) => updateScoreRow(team.uid, row.id, 'benchmark', e.target.value)}
                                        placeholder="Benchmark/notes"
                                        disabled={row.isAdded}
                                      />
                                    </td>
                                    <td>
                                      {row.isAdded ? (
                                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                          <span style={{ color: '#00b894', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                            ✅ Added
                                          </span>
                                          <button
                                            onClick={() => removeScoreRow(team.uid, row.id)}
                                            className="btn-remove-row"
                                          >
                                            ➖
                                          </button>
                                        </div>
                                      ) : (
                                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                                          <button
                                            onClick={() => addScoreEntry(team.uid, row.id)}
                                            className="btn-add-score"
                                          >
                                            ➕ Add
                                          </button>
                                          <button
                                            onClick={() => removeScoreRow(team.uid, row.id)}
                                            className="btn-remove-row"
                                          >
                                            ➖
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                                {(physicalScoreTable[team.uid] || []).length === 0 && (
                                  <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                                      No scores added yet. Click "Add Row" to start tracking scores.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        /* Team Details View */
                        <div>
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
                            <div className="score-item">
                              <div className="score-label">Physical Game</div>
                              
                              {/* Net score display */}
                              <div className="net-score-display">
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                  {getNetPhysicalScore(team.uid).toLocaleString()}
                                </div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                                  Net Score ({(physicalScoreTable[team.uid] || []).filter(row => row.isAdded).length} added / {(physicalScoreTable[team.uid] || []).length} total)
                                </div>
                              </div>

                              {/* Table toggle button */}
                              <div className="table-controls">
                                <button
                                  onClick={() => toggleScoreTable(team.uid)}
                                  className="btn-table-toggle"
                                >
                                  📊 Show Tabular View
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
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
                    {teams.reduce((sum, team) => sum + getNetPhysicalScore(team.uid), 0).toLocaleString()}
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