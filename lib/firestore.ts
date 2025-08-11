// Firebase Realtime Database operations for AR Treasure Hunt Volunteer Page

import {
  ref,
  get,
  update,
  onValue,
  off
} from 'firebase/database';
import { db, auth } from './firebase';
import { signInAnonymously } from 'firebase/auth';

// Define the Session interface for team progress
export interface Session {
  // Actual field names from your Firebase structure
  cluesCompleted?: number;
  currentClueNumber?: number;
  started?: boolean;
  
  // Legacy/alternative field names for compatibility
  currentClue?: number;
  cluesSolved?: number;
  totalClues?: number;
  timeStarted?: number;
  lastActivity?: number;
  status?: string;
  progressMetrics?: {
    [key: string]: any;
  };
  currentLevel?: number;
  gameStarted?: boolean;
  isActive?: boolean;
  lastClueTime?: number;
  [key: string]: any; // Allow for any additional fields
}

// Define the Team interface
export interface Team {
  uid: string;
  teamNumber: number;
  teamName: string;
  player1: string;
  player2: string;
  email: string;
  phoneNumber: string;
  score: number;
  physicalScore?: number;
  physicalScoreComment?: string; // Comment field for physical score
  createdAt: number;
  session?: Session; // Session data for progress tracking
}

/**
 * Ensure user is authenticated before database operations
 */
async function ensureAuth(): Promise<void> {
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (error) {
      console.error('Failed to authenticate anonymously:', error);
      throw new Error('Authentication required');
    }
  }
}

/**
 * Get session data for a team
 */
async function getTeamSession(uid: string): Promise<Session | null> {
  try {
    // Try lowercase 'session' first (matches main code)
    const sessionRef = ref(db, `${uid}/session`);
    const snapshot = await get(sessionRef);
    
    if (snapshot.exists()) {
      return snapshot.val() as Session;
    }
    
    // Fallback to uppercase 'Session' for backwards compatibility
    const sessionRefUpper = ref(db, `${uid}/Session`);
    const snapshotUpper = await get(sessionRefUpper);
    
    if (snapshotUpper.exists()) {
      return snapshotUpper.val() as Session;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting team session:', error);
    return null;
  }
}

/**
 * Get all teams for the volunteer interface
 */
export async function getAllTeams(): Promise<Team[]> {
  try {
    await ensureAuth();
    const rootRef = ref(db);
    const snapshot = await get(rootRef);
    
    if (!snapshot.exists()) {
      return [];
    }

    const allData = snapshot.val();
    const teamsArray: Team[] = [];
    
    console.log('Raw Firebase data:', allData);
    
    // Filter only valid team nodes (those with teamName property)
    for (const uid in allData) {
      if (allData[uid] && typeof allData[uid] === 'object' && allData[uid].teamName) {
        const rawTeamData = allData[uid];
        console.log(`Processing team ${uid}:`, rawTeamData);
        
        // Create team data without the Session node first
        const teamData = { ...rawTeamData } as Team;
        teamData.uid = uid; // Ensure UID is set
        
        // Ensure physicalScore and comment are included
        teamData.physicalScore = teamData.physicalScore || 0;
        teamData.physicalScoreComment = teamData.physicalScoreComment || '';
        
        // Check if session data exists as a nested object (try multiple field names)
        if (rawTeamData.session && typeof rawTeamData.session === 'object') {
          console.log(`Found session data for team ${uid}:`, rawTeamData.session);
          teamData.session = rawTeamData.session as Session;
        } else if (rawTeamData.Session && typeof rawTeamData.Session === 'object') {
          console.log(`Found Session data (uppercase) for team ${uid}:`, rawTeamData.Session);
          teamData.session = rawTeamData.Session as Session;
        } else {
          console.log(`No session data found for team ${uid}, checking for alternative session data...`);
          console.log(`Available keys in team data:`, Object.keys(rawTeamData));
          
          // Check if there are any session-related fields directly on the team object
          const potentialSessionFields = ['currentClueNumber', 'cluesCompleted', 'gameStarted', 'started', 'status'];
          const foundFields: any = {};
          let hasSessionData = false;
          
          for (const field of potentialSessionFields) {
            if (rawTeamData[field] !== undefined) {
              foundFields[field] = rawTeamData[field];
              hasSessionData = true;
            }
          }
          
          if (hasSessionData) {
            console.log(`Found session-related fields directly on team ${uid}:`, foundFields);
            teamData.session = foundFields as Session;
          } else {
            // Default session data for teams that haven't started
            teamData.session = {
              cluesCompleted: 0,
              currentClueNumber: 0,
              started: false,
              status: 'not_started'
            };
          }
        }
        
        console.log(`Final processed team data for ${uid}:`, teamData);
        teamsArray.push(teamData);
      } else {
        console.log(`Skipping invalid team data for ${uid}:`, allData[uid]);
      }
    }
    
    // Sort by team number (ascending)
    teamsArray.sort((a, b) => a.teamNumber - b.teamNumber);
    
    return teamsArray;
  } catch (error) {
    console.error('Error getting teams:', error);
    return [];
  }
}

/**
 * Update a team's physical score with comment
 */
export async function updatePhysicalScore(uid: string, physicalScore: number, comment?: string): Promise<boolean> {
  try {
    await ensureAuth();
    const teamRef = ref(db, uid);
    const snapshot = await get(teamRef);
    
    if (!snapshot.exists()) {
      throw new Error('Team not found with the provided UID');
    }

    // Update the physical score and comment
    const updateData: any = {
      physicalScore: physicalScore
    };
    
    if (comment !== undefined) {
      updateData.physicalScoreComment = comment;
    }

    await update(teamRef, updateData);

    return true;
  } catch (error) {
    console.error('Error updating physical score:', error);
    throw error;
  }
}

/**
 * Set up real-time listener for team updates
 */
export function subscribeToTeams(callback: (teams: Team[]) => void): () => void {
  try {
    const rootRef = ref(db);
    
    console.log('Setting up Realtime Database listener for teams...');
    
    const unsubscribe = onValue(rootRef, 
      (snapshot) => {
        console.log('Realtime Database snapshot received');
        
        if (!snapshot.exists()) {
          console.log('No data found');
          callback([]);
          return;
        }

        const allData = snapshot.val();
        const teamsArray: Team[] = [];
        
        // Filter only valid team nodes (those with teamName property)
        for (const uid in allData) {
          if (allData[uid] && typeof allData[uid] === 'object' && allData[uid].teamName) {
            const rawTeamData = allData[uid];
            console.log(`Real-time: Processing team ${uid}:`, rawTeamData);
            
            // Create team data without the Session node first
            const teamData = { ...rawTeamData } as Team;
            teamData.uid = uid; // Ensure UID is set
            
            // Ensure physicalScore and comment are included
            teamData.physicalScore = teamData.physicalScore || 0;
            teamData.physicalScoreComment = teamData.physicalScoreComment || '';
            
            // Handle session data from the snapshot (try multiple field names)
            if (rawTeamData.session && typeof rawTeamData.session === 'object') {
              console.log(`Real-time: Found session data for team ${uid}:`, rawTeamData.session);
              teamData.session = rawTeamData.session as Session;
            } else if (rawTeamData.Session && typeof rawTeamData.Session === 'object') {
              console.log(`Real-time: Found Session data (uppercase) for team ${uid}:`, rawTeamData.Session);
              teamData.session = rawTeamData.Session as Session;
            } else {
              console.log(`Real-time: No session data found for team ${uid}`);
              console.log(`Real-time: Available keys in team data:`, Object.keys(rawTeamData));
              
              // Check if there are any session-related fields directly on the team object
              const potentialSessionFields = ['currentClueNumber', 'cluesCompleted', 'gameStarted', 'started', 'status'];
              const foundFields: any = {};
              let hasSessionData = false;
              
              for (const field of potentialSessionFields) {
                if (rawTeamData[field] !== undefined) {
                  foundFields[field] = rawTeamData[field];
                  hasSessionData = true;
                }
              }
              
              if (hasSessionData) {
                console.log(`Real-time: Found session-related fields directly on team ${uid}:`, foundFields);
                teamData.session = foundFields as Session;
              } else {
                // Default session data for teams that haven't started
                teamData.session = {
                  cluesCompleted: 0,
                  currentClueNumber: 0,
                  started: false,
                  status: 'not_started'
                };
              }
            }
            
            console.log(`Real-time: Final processed team data for ${uid}:`, teamData);
            teamsArray.push(teamData);
          } else {
            console.log(`Real-time: Skipping invalid team data for ${uid}:`, allData[uid]);
          }
        }
        
        console.log('Teams data:', teamsArray);
        
        // Sort by team number (ascending)
        teamsArray.sort((a, b) => a.teamNumber - b.teamNumber);
        
        callback(teamsArray);
      },
      (error) => {
        console.error('Realtime Database listener error:', error);
        callback([]);
      }
    );

    // Return unsubscribe function
    return () => {
      console.log('Unsubscribing from Realtime Database listener');
      off(rootRef, 'value', unsubscribe);
    };
  } catch (error) {
    console.error('Error setting up Realtime Database listener:', error);
    return () => {};
  }
}