// Treasure Dashboard - Master page for viewing and managing hidden treasures
// This page allows users to see all hidden treasures, their details, and manage them

import { useState, useEffect } from 'react';
import Head from 'next/head';
import Layout from '@/components/Layout';
import { config } from '@/config';

interface TreasureData {
  imageName: string;
  fileName: string;
  physicalSizeInMeters: number;
  clueIndex: number;
  clueName: string;
  spawnOffset: { x: number; y: number; z: number };
  spawnRotation: { x: number; y: number; z: number };
  clueText: string;
  latitude: number;
  longitude: number;
  hasPhysicalGame: boolean;
  physicalGameInstruction: string;
  physicalGameSecretCode: string;
}

interface TreasureConfig {
  images: TreasureData[];
  lastUpdated: string;
  totalTreasures: number;
}

export default function TreasureDashboard() {
  const [treasures, setTreasures] = useState<TreasureData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [selectedTreasure, setSelectedTreasure] = useState<TreasureData | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchTreasures();
  }, []);

  const fetchTreasures = async () => {
    try {
      setLoading(true);
      setError(null);

      // ONLY use server config - no local fallback for dashboard
      if (!config.server.baseUrl) {
        setError('Server not configured. Please check your config settings.');
        return;
      }

      try {
        console.log('📡 Fetching treasures from server:', `${config.server.baseUrl}/config`);
        const response = await fetch(`${config.server.baseUrl}/config`, {
          headers: config.server.headers,
        });
        
        if (response.ok) {
          const data: TreasureConfig = await response.json();
          console.log('🌐 Server response data:', data);
          console.log('📊 Treasures from server:', data.images?.length);
          console.log('🏴‍☠️ Treasure names:', data.images?.map(t => t.clueName));
          setTreasures(data.images || []);
          setLastUpdated(data.lastUpdated || 'Unknown');
          return;
        } else {
          console.error('Server returned error:', response.status, response.statusText);
          setError(`Server error: ${response.status} ${response.statusText}`);
          return;
        }
      } catch (serverError) {
        console.error('Failed to connect to server:', serverError);
        setError('Cannot connect to treasure server. Make sure it\'s running on ' + config.server.baseUrl);
        return;
      }
      
    } catch (err) {
      console.error('Error fetching treasures:', err);
      setError('Failed to load treasures. Please try again.');
      setTreasures([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteTreasure = async (treasureToDelete: TreasureData) => {
    try {
      console.log('🗑️ Deleting treasure:', treasureToDelete);
      
      // Call the delete API - it now handles both image deletion AND config update
      const deleteResponse = await fetch('/api/delete-treasure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageName: treasureToDelete.imageName,
          fileName: treasureToDelete.fileName
        })
      });

      const result = await deleteResponse.json();
      console.log('🔍 Delete result:', result);

      if (result.success) {
        // Remove from local UI state immediately for responsive UI
        const updatedTreasures = treasures.filter(t => t.imageName !== treasureToDelete.imageName);
        setTreasures(updatedTreasures);
        setShowDeleteConfirm(null);
        setSelectedTreasure(null);
        
        console.log('✅ Treasure deleted successfully');
        alert(`Treasure "${treasureToDelete.clueName}" deleted successfully!\nImage: ${result.imageDeleted ? 'Deleted' : 'Failed'}\nConfig: ${result.configUpdated ? 'Updated' : 'Failed'}`);
        
        // Refresh from server to ensure consistency
        setTimeout(() => {
          fetchTreasures();
        }, 500);
      } else {
        throw new Error(result.message || 'Delete failed');
      }
    } catch (error) {
      console.error('❌ Failed to delete treasure:', error);
      alert('Failed to delete treasure. Please try again.');
    }
  };

  const getImageUrl = (fileName: string) => {
    return config.server.baseUrl ? `${config.server.baseUrl}/images/${fileName}` : `/images/${fileName}`;
  };

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  };

  const formatCoordinates = (lat: number, lng: number) => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
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
          background: linear-gradient(135deg, #8B4513 0%, #D2691E 50%, #CD853F 100%);
          min-height: 100vh;
        }

        .container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 2rem;
        }

        .header {
          background: linear-gradient(135deg, rgba(139,69,19,0.95) 0%, rgba(160,82,45,0.95) 100%);
          color: white;
          padding: 2rem;
          border-radius: 20px;
          text-align: center;
          margin-bottom: 2rem;
          box-shadow: 0 15px 35px rgba(0,0,0,0.3);
          position: relative;
        }

        .nav-buttons {
          position: absolute;
          top: 1rem;
          right: 1rem;
          display: flex;
          gap: 1rem;
        }

        .btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .btn-primary {
          background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
          color: #8B4513;
          box-shadow: 0 6px 20px rgba(255,215,0,0.3);
        }

        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(255,215,0,0.4);
        }

        .btn-danger {
          background: linear-gradient(135deg, #DC143C 0%, #B22222 100%);
          color: white;
          box-shadow: 0 6px 20px rgba(220,20,60,0.3);
        }

        .btn-success {
          background: linear-gradient(135deg, #228B22 0%, #32CD32 100%);
          color: white;
          box-shadow: 0 6px 20px rgba(34,139,34,0.3);
        }

        .main-content {
          background: white;
          border-radius: 20px;
          padding: 2rem;
          box-shadow: 0 10px 30px rgba(0,0,0,0.15);
          margin-bottom: 2rem;
        }

        .loading {
          text-align: center;
          padding: 4rem;
          color: #666;
          font-size: 1.2rem;
        }

        .error {
          text-align: center;
          padding: 4rem;
          color: #DC143C;
          font-size: 1.2rem;
          background: rgba(220,20,60,0.1);
          border-radius: 15px;
          border: 2px solid rgba(220,20,60,0.3);
        }

        .treasures-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 2rem;
          margin-top: 2rem;
        }

        .treasure-card {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-radius: 15px;
          padding: 1.5rem;
          box-shadow: 0 8px 25px rgba(0,0,0,0.1);
          transition: all 0.3s ease;
          border: 2px solid transparent;
        }

        .treasure-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 15px 35px rgba(0,0,0,0.15);
          border-color: #8B4513;
        }

        .treasure-image {
          width: 100%;
          height: 200px;
          object-fit: cover;
          border-radius: 10px;
          margin-bottom: 1rem;
          cursor: pointer;
          transition: transform 0.3s ease;
        }

        .treasure-image:hover {
          transform: scale(1.02);
        }

        .treasure-title {
          font-size: 1.3rem;
          font-weight: bold;
          color: #8B4513;
          margin-bottom: 0.5rem;
        }

        .treasure-clue {
          background: rgba(139,69,19,0.1);
          padding: 1rem;
          border-radius: 10px;
          margin: 1rem 0;
          font-style: italic;
          border-left: 4px solid #8B4513;
        }

        .treasure-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
          margin: 1rem 0;
          font-size: 0.9rem;
        }

        .detail-label {
          font-weight: bold;
          color: #666;
        }

        .detail-value {
          color: #333;
        }

        .physical-game {
          background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
          padding: 1rem;
          border-radius: 10px;
          margin: 1rem 0;
        }

        .secret-code {
          font-family: 'Courier New', monospace;
          font-weight: bold;
          font-size: 1.1rem;
          color: #8B4513;
          background: rgba(255,255,255,0.8);
          padding: 0.5rem;
          border-radius: 5px;
          text-align: center;
          margin-top: 0.5rem;
        }

        .card-actions {
          display: flex;
          gap: 1rem;
          margin-top: 1.5rem;
          justify-content: flex-end;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          padding: 2rem;
          border-radius: 15px;
          max-width: 90vw;
          max-height: 90vh;
          overflow-y: auto;
          position: relative;
        }

        .modal-image {
          max-width: 100%;
          max-height: 70vh;
          object-fit: contain;
          border-radius: 10px;
          margin-bottom: 1rem;
        }

        .close-modal {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: #DC143C;
          color: white;
          border: none;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 1.2rem;
          font-weight: bold;
        }

        .stats-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(139,69,19,0.1);
          padding: 1rem;
          border-radius: 10px;
          margin-bottom: 2rem;
        }

        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
          color: #666;
        }

        .empty-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }

        @media (max-width: 768px) {
          .container {
            padding: 1rem;
          }
          
          .treasures-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
          }

          .nav-buttons {
            position: static;
            justify-content: center;
            margin-top: 1rem;
          }

          .treasure-details {
            grid-template-columns: 1fr;
          }

          .stats-bar {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }
        }
      `}</style>

      <Layout title="Treasure Dashboard - AR Treasure Hunt">
        <div className="container">
          {/* Header */}
          <div className="header">
            <div className="nav-buttons">
              <a href="/hide-treasures" className="btn btn-primary">
                🗺️ Hide Treasures
              </a>
              <button className="btn btn-success" onClick={fetchTreasures}>
                🔄 Refresh
              </button>
            </div>

            <h1 style={{ margin: '0 0 1rem 0', fontSize: '2.5rem', fontWeight: 'bold' }}>
              🏴‍☠️ TREASURE DASHBOARD
            </h1>
            <p style={{ margin: '0', fontSize: '1.2rem', opacity: 0.9 }}>
              Manage your AR treasure hunt collection
            </p>
          </div>

          <div className="main-content">
            {loading ? (
              <div className="loading">
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
                Loading treasures...
              </div>
            ) : error ? (
              <div className="error">
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
                {error}
                <div style={{ marginTop: '1rem' }}>
                  <button className="btn btn-primary" onClick={fetchTreasures}>
                    Try Again
                  </button>
                </div>
              </div>
            ) : treasures.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🗺️</div>
                <h2 style={{ color: '#8B4513', marginBottom: '1rem' }}>No Treasures Hidden Yet</h2>
                <p style={{ marginBottom: '2rem' }}>
                  Start your treasure hunt adventure by hiding your first treasure!
                </p>
                <a href="/hide-treasures" className="btn btn-primary" style={{ fontSize: '1.2rem', padding: '1rem 2rem' }}>
                  🏴‍☠️ Hide Your First Treasure
                </a>
              </div>
            ) : (
              <>
                {/* Stats Bar */}
                <div className="stats-bar">
                  <div>
                    <strong>📊 Total Treasures:</strong> {treasures.length}
                  </div>
                  <div>
                    <strong>🎮 With Physical Games:</strong> {treasures.filter(t => t.hasPhysicalGame).length}
                  </div>
                  <div>
                    <strong>📅 Last Updated:</strong> {formatDate(lastUpdated)}
                  </div>
                </div>

                {/* Treasures Grid */}
                <div className="treasures-grid">
                  {treasures.map((treasure, index) => (
                    <div key={treasure.imageName} className="treasure-card">
                      <img
                        src={getImageUrl(treasure.fileName)}
                        alt={treasure.clueName}
                        className="treasure-image"
                        onClick={() => setSelectedTreasure(treasure)}
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.style.display = 'none';
                          img.nextElementSibling!.textContent = '🖼️ Image not found';
                        }}
                      />
                      <div style={{ display: 'none', textAlign: 'center', padding: '2rem', color: '#666' }}>
                        🖼️ Image not found
                      </div>

                      <div className="treasure-title">
                        #{treasure.clueIndex + 1} - {treasure.clueName}
                      </div>

                      <div className="treasure-clue">
                        💡 "{treasure.clueText}"
                      </div>

                      <div className="treasure-details">
                        <div className="detail-label">📍 Location:</div>
                        <div className="detail-value">{formatCoordinates(treasure.latitude, treasure.longitude)}</div>
                        
                        <div className="detail-label">📏 Size:</div>
                        <div className="detail-value">{treasure.physicalSizeInMeters}m</div>
                        
                        <div className="detail-label">📁 File:</div>
                        <div className="detail-value">{treasure.fileName}</div>
                      </div>

                      {treasure.hasPhysicalGame && (
                        <div className="physical-game">
                          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                            🎮 Physical Game Challenge
                          </div>
                          <div style={{ marginBottom: '0.5rem' }}>
                            {treasure.physicalGameInstruction}
                          </div>
                          <div className="secret-code">
                            🔐 Secret Code: {treasure.physicalGameSecretCode}
                          </div>
                        </div>
                      )}

                      <div className="card-actions">
                        <button 
                          className="btn btn-danger"
                          onClick={() => setShowDeleteConfirm(treasure.imageName)}
                          style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Image Modal */}
        {selectedTreasure && (
          <div className="modal-overlay" onClick={() => setSelectedTreasure(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button 
                className="close-modal"
                onClick={() => setSelectedTreasure(null)}
              >
                ×
              </button>
              <img
                src={getImageUrl(selectedTreasure.fileName)}
                alt={selectedTreasure.clueName}
                className="modal-image"
              />
              <h2 style={{ color: '#8B4513', marginBottom: '1rem' }}>
                {selectedTreasure.clueName}
              </h2>
              <p style={{ fontSize: '1.1rem', fontStyle: 'italic', color: '#666' }}>
                "{selectedTreasure.clueText}"
              </p>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '500px', textAlign: 'center' }}>
              <h2 style={{ color: '#DC143C', marginBottom: '1rem' }}>
                ⚠️ Delete Treasure?
              </h2>
              <p style={{ marginBottom: '2rem' }}>
                Are you sure you want to delete "{treasures.find(t => t.imageName === showDeleteConfirm)?.clueName}"?
                <br /><br />
                <strong>This action cannot be undone!</strong>
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button 
                  className="btn btn-danger"
                  onClick={() => {
                    const treasure = treasures.find(t => t.imageName === showDeleteConfirm);
                    if (treasure) deleteTreasure(treasure);
                  }}
                >
                  🗑️ Yes, Delete
                </button>
                <button 
                  className="btn btn-success"
                  onClick={() => setShowDeleteConfirm(null)}
                >
                  ❌ Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </Layout>
    </>
  );
}