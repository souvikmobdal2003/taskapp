import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TaskCompanion from './components/TaskCompanion';
import Dashboard from './components/Dashboard';
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // Check if app is already installed
  useEffect(() => {
    const checkInstallStatus = () => {
      // Check if running as PWA
      const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                    window.navigator.standalone || 
                    document.referrer.includes('android-app://');
      setIsInstalled(isPWA);
    };

    checkInstallStatus();
    window.addEventListener('resize', checkInstallStatus);
    return () => window.removeEventListener('resize', checkInstallStatus);
  }, []);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('🌐 Back online - syncing data...');
      // Trigger data sync when back online
      syncOfflineData();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      console.log('📡 Gone offline - enabling offline mode...');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle PWA install prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      console.log('📱 Install prompt available');
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Handle successful installation
    const handleAppInstalled = (e) => {
      console.log('✅ PWA installed successfully');
      setInstallPrompt(null);
      setIsInstalled(true);
      
      // Show success message
      showNotification('🎉 App installed successfully!', 'success');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Handle service worker updates
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setShowUpdatePrompt(true);
      });

      // Listen for service worker messages
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SKIP_WAITING') {
          setShowUpdatePrompt(true);
        }
      });
    }
  }, []);

  // Handle app shortcuts and URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    
    if (action === 'new-task') {
      // Trigger new task modal if opened via shortcut
      setTimeout(() => {
        const event = new CustomEvent('openNewTask');
        window.dispatchEvent(event);
      }, 1000);
    }
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;

    try {
      const result = await installPrompt.prompt();
      console.log('Install prompt result:', result.outcome);
      
      if (result.outcome === 'accepted') {
        showNotification('📱 Installing app...', 'info');
      } else {
        showNotification('❌ Installation cancelled', 'warning');
      }
      
      setInstallPrompt(null);
    } catch (error) {
      console.error('Install error:', error);
      showNotification('❌ Installation failed', 'error');
    }
  };

  const handleUpdateApp = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration && registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          window.location.reload();
        }
      });
    }
    setShowUpdatePrompt(false);
  };

  const syncOfflineData = async () => {
    // Sync any offline data when connection is restored
    try {
      const pendingTasks = localStorage.getItem('pendingTasks');
      if (pendingTasks) {
        const tasks = JSON.parse(pendingTasks);
        
        for (const task of tasks) {
          try {
            await fetch('http://127.0.0.1:5000/add-task', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(task)
            });
          } catch (error) {
            console.error('Failed to sync task:', error);
          }
        }
        
        localStorage.removeItem('pendingTasks');
        showNotification('✅ Offline data synced successfully!', 'success');
      }
    } catch (error) {
      console.error('Sync error:', error);
    }
  };

  const showNotification = (message, type = 'info') => {
    // Create temporary notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: bold;
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
      max-width: 300px;
      background: ${type === 'success' ? '#4CAF50' : 
                  type === 'error' ? '#f44336' : 
                  type === 'warning' ? '#ff9800' : '#2196F3'};
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in forwards';
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  };

  return (
    <div className="App">
      {/* Offline indicator */}
      {!isOnline && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
          color: 'white',
          textAlign: 'center',
          padding: '12px',
          zIndex: 9999,
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
          animation: 'slideDown 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span>📡</span>
            <span>You're offline. Tasks will sync when reconnected.</span>
            <span style={{ 
              background: 'rgba(255,255,255,0.2)', 
              padding: '2px 8px', 
              borderRadius: '12px', 
              fontSize: '12px' 
            }}>
              OFFLINE MODE
            </span>
          </div>
        </div>
      )}

      {/* Update prompt */}
      {showUpdatePrompt && (
        <div style={{
          position: 'fixed',
          top: isOnline ? '60px' : '120px',
          left: '20px',
          right: '20px',
          background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)',
          color: 'white',
          padding: '16px',
          borderRadius: '12px',
          zIndex: 9998,
          boxShadow: '0 4px 20px rgba(76, 175, 80, 0.3)',
          animation: 'slideDown 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>🔄 New Version Available!</div>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>
                Update now to get the latest features and improvements.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowUpdatePrompt(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: 'white',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Later
              </button>
              <button
                onClick={handleUpdateApp}
                style={{
                  background: 'white',
                  border: 'none',
                  color: '#4CAF50',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
              >
                Update Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Install prompt - only show if not already installed */}
      {installPrompt && !isInstalled && (
        <button
          onClick={handleInstallClick}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            padding: '14px 24px',
            borderRadius: '30px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px',
            boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
            zIndex: 1000,
            transition: 'all 0.3s ease',
            animation: 'bounce 2s ease-in-out infinite'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)';
          }}
        >
          <span style={{ marginRight: '8px' }}>📱</span>
          Install App
        </button>
      )}

      {/* PWA Status indicator (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          zIndex: 1000
        }}>
          {isInstalled ? '📱 PWA Mode' : '🌐 Browser Mode'}
        </div>
      )}

      <BrowserRouter>
        <Routes>
          <Route path="/" element={<TaskCompanion />} />
          <Route path="/tasks" element={<TaskCompanion />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>

      {/* Add CSS animations */}
      <style jsx>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
        
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-10px); }
          60% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}

export default App;
