import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Badge, ProgressBar } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSun, faMoon, faCloudSun, faCalendarDays, faChartLine, faPlus, faFire, faBell, faBellSlash } from '@fortawesome/free-solid-svg-icons';
import { CheckCircle, Schedule, Assignment, TrendingUp } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import '../TaskCompanion.css'; 
import Todo from './Todo';
import NotificationManager from '../utils/NotificationManager';

// Backend API URL
const API_BASE_URL = 'http://127.0.0.1:5000';

function TaskCompanion() {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);
  const [showTodoModal, setShowTodoModal] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Browser Native Notification states
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationSupported, setNotificationSupported] = useState(false);
  const [requestingNotifications, setRequestingNotifications] = useState(false);

  // Initialize notifications on component mount
  useEffect(() => {
    const initNotifications = async () => {
      const supported = await NotificationManager.init();
      setNotificationSupported(supported);
      
      if (supported && NotificationManager.permission === 'granted') {
        setNotificationsEnabled(true);
      }
    };
    
    initNotifications();
  }, []);

  // Initialize tasks from localStorage AND backend
  useEffect(() => {
    const loadTasks = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/get-tasks`);
        if (response.ok) {
          const backendTasks = await response.json();
          
          const transformedTasks = backendTasks.map(task => ({
            id: task.id,
            title: task.task_name,
            startTime: task.start_time,
            endTime: task.end_time,
            completed: task.status === 'completed',
            note: task.notes,
            tag: 'general',
            createdAt: task.created_at,
            date: new Date(task.created_at).toISOString().split('T')[0],
            repeatType: 'none',
            customDays: []
          }));
          
          setTasks(transformedTasks);
          console.log('Loaded tasks from backend:', transformedTasks.length);
          return;
        }
      } catch (error) {
        console.error('Backend not available, loading from localStorage:', error);
      }
      
      // Fallback to localStorage
      const savedTasks = localStorage.getItem('taskCompanionTasks');
      if (savedTasks) {
        try {
          const parsedTasks = JSON.parse(savedTasks);
          setTasks(parsedTasks);
          console.log('Loaded tasks from localStorage:', parsedTasks.length);
        } catch (error) {
          console.error('Error parsing tasks from localStorage:', error);
          setTasks([]);
        }
      }
    };

    loadTasks();
  }, []);

  // Save tasks to localStorage whenever tasks change
  useEffect(() => {
    if (tasks.length > 0) {
      localStorage.setItem('taskCompanionTasks', JSON.stringify(tasks));
    } else {
      localStorage.removeItem('taskCompanionTasks');
    }
  }, [tasks]);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // Clean up expired tasks
  useEffect(() => {
    const cleanupExpiredTasks = async () => {
      try {
        await fetch(`${API_BASE_URL}/delete-old-tasks`, {
          method: 'DELETE'
        });
        console.log('Cleaned up old tasks from backend');
      } catch (error) {
        console.error('Error cleaning up backend tasks:', error);
      }

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      setTasks(prevTasks => {
        const filteredTasks = prevTasks.filter(task => {
          const taskCreationTime = new Date(task.createdAt || task.date);
          return taskCreationTime > oneDayAgo;
        });
        
        if (filteredTasks.length !== prevTasks.length) {
          console.log(`Removed ${prevTasks.length - filteredTasks.length} expired tasks`);
        }
        
        return filteredTasks;
      });
    };

    cleanupExpiredTasks();
    const cleanupInterval = setInterval(cleanupExpiredTasks, 60 * 60 * 1000);
    
    return () => clearInterval(cleanupInterval);
  }, []);

  // Screen size detection
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Smart task reminders - Check deadlines every minute
  useEffect(() => {
    if (!notificationsEnabled) return;

    const checkTaskDeadlines = () => {
      const now = new Date();
      
      tasks.forEach(task => {
        if (task.completed) return;
        
        const taskEndTime = new Date(`${now.toDateString()} ${task.endTime}`);
        const minutesLeft = Math.floor((taskEndTime - now) / 60000);
        
        // Send reminder 1 hour (60 minutes) before deadline
        if (minutesLeft === 60) {
          NotificationManager.taskReminder(task.title, minutesLeft);
        }
        
        // Send overdue notification 1 hour after deadline
        if (minutesLeft === -60) {
          const hoursLate = Math.floor(Math.abs(minutesLeft) / 60);
          NotificationManager.taskOverdue(task.title, hoursLate);
        }
      });
    };

    // Check every minute
    const interval = setInterval(checkTaskDeadlines, 60000);
    
    return () => clearInterval(interval);
  }, [tasks, notificationsEnabled]);

  // Enable notifications handler with requesting state
  const enableNotifications = async () => {
    if (!notificationSupported) {
      alert('Your browser doesn\'t support notifications');
      return;
    }

    setRequestingNotifications(true);
    
    try {
      const granted = await NotificationManager.requestPermission();
      setNotificationsEnabled(granted);
      
      if (granted) {
        NotificationManager.welcomeMessage();
      } else {
        alert('Please enable notifications in your browser settings to get task reminders');
      }
    } catch (error) {
      console.error('Error requesting notifications:', error);
      alert('There was an error enabling notifications. Please try again.');
    } finally {
      setRequestingNotifications(false);
    }
  };

  // Disable notifications
  const disableNotifications = () => {
    setNotificationsEnabled(false);
    alert('Notifications disabled. You can re-enable them anytime!');
  };

  // Get time-based greeting and icon
  const getTimeBasedGreeting = () => {
    const hour = currentTime.getHours();
    
    if (hour >= 5 && hour < 12) {
      return { greeting: 'Good Morning!', icon: faSun, emoji: '😊' };
    } else if (hour >= 12 && hour < 17) {
      return { greeting: 'Good Afternoon!', icon: faCloudSun, emoji: '☀️' };
    } else if (hour >= 17 && hour < 21) {
      return { greeting: 'Good Evening!', icon: faCloudSun, emoji: '🌇' };
    } else {
      return { greeting: 'Good Night!', icon: faMoon, emoji: '🌙' };
    }
  };

  const { greeting, icon, emoji } = getTimeBasedGreeting();

  const formatCurrentDate = () => {
    return currentTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const completedTasks = tasks.filter(task => task.completed).length;
  const totalTasks = tasks.length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Enhanced task completion with notification
  const toggleTask = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newStatus = !task.completed;
    
    // Update backend
    try {
      await fetch(`${API_BASE_URL}/update-task/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_name: task.title,
          start_time: task.startTime,
          end_time: task.endTime,
          status: newStatus ? 'completed' : 'pending',
          notes: task.note || ''
        })
      });
      console.log('Updated task status in backend');
    } catch (error) {
      console.error('Error updating task in backend:', error);
    }
    
    // Update task state
    setTasks(tasks.map(t => 
      t.id === taskId ? { 
        ...t, 
        completed: newStatus,
        completedAt: newStatus ? new Date().toISOString() : null
      } : t
    ));

    // Send notification if task completed
    if (newStatus && notificationsEnabled) {
      // Calculate time saved if completed early
      const now = new Date();
      const endTime = new Date(`${now.toDateString()} ${task.endTime}`);
      const timeSaved = endTime > now ? Math.floor((endTime - now) / 60000) : 0;
      
      NotificationManager.taskCompleted(task.title, timeSaved);
    }
  };

  // Remove task from both backend and frontend
  const removeTask = async (taskId) => {
    try {
      await fetch(`${API_BASE_URL}/delete-task/${taskId}`, {
        method: 'DELETE'
      });
      console.log('Deleted task from backend');
    } catch (error) {
      console.error('Error deleting task from backend:', error);
    }

    setTasks(tasks.filter(task => task.id !== taskId));
  };

  const addTask = () => {
    setShowTodoModal(true);
  };

  const handleSaveTask = async (newTask) => {
    console.log('Saving new task:', newTask);

    // Prepare task for backend
    const backendTask = {
      task_name: newTask.title,
      start_time: newTask.startTime,
      end_time: newTask.endTime,
      status: 'pending',
      notes: newTask.note || ''
    };

    // Save to backend first
    try {
      const response = await fetch(`${API_BASE_URL}/add-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backendTask)
      });

      if (response.ok) {
        console.log('Task saved to backend successfully');
      } else {
        console.error('Failed to save task to backend');
      }
    } catch (error) {
      console.error('Error saving task to backend:', error);
    }
    
    // Always save to local state for immediate UI update
    const taskWithMetadata = {
      ...newTask,
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      completed: false,
      completedAt: null
    };
    
    setTasks(prevTasks => [...prevTasks, taskWithMetadata]);
    setShowTodoModal(false);

    // Send notification for new task
    if (notificationsEnabled) {
      setTimeout(() => {
        NotificationManager.send(
          '📝 New Task Added!',
          `Task "${newTask.title}" scheduled for ${newTask.startTime} - ${newTask.endTime}`,
          { tag: 'new-task' }
        );
      }, 1000);
    }
  };

  const openDashboard = () => {
    const today = new Date();
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekCounts = weekDays.map(() => Math.floor(Math.random() * 5));
    
    navigate('/dashboard', {
      state: {
        completedTasks,
        totalTasks,
        remaining: totalTasks - completedTasks,
        progressPercentage,
        weekCounts,
        tasks: tasks,
        insights: {
          streak: 7,
          bestDay: 'Monday',
          avgCompletion: progressPercentage,
          totalThisWeek: totalTasks,
          completedThisWeek: completedTasks
        }
      }
    });
  };

  // Get motivational message based on completion rate
  const getMotivationalMessage = () => {
    if (totalTasks === 0) {
      return "Ready to plan your productive day? Add your first task!";
    } else if (completedTasks === totalTasks) {
      return `You've completed all ${completedTasks} tasks today! You're absolutely incredible! 🎉`;
    } else if (progressPercentage >= 75) {
      return `Amazing! You've completed ${completedTasks} out of ${totalTasks} tasks. You're almost there! 🚀`;
    } else if (progressPercentage >= 50) {
      return `Great progress! ${completedTasks} tasks done, ${totalTasks - completedTasks} to go. Keep it up! 💪`;
    } else if (completedTasks > 0) {
      return `You're off to a good start with ${completedTasks} completed tasks! 🌟`;
    } else {
      return "Let's turn your plans into achievements! Start with your first task! ✨";
    }
  };

  // Desktop Layout
  const renderDesktopUI = () => (
    <div className="desktop-layout">
      <Container fluid className="h-100">
        <Row className="min-vh-100 g-0">
          {/* Enhanced Left Sidebar */}
          <Col xxl={2} xl={2} lg={2} className="sidebar-left d-none d-lg-block">
            <div className="sidebar-wrapper">
              <div className="sidebar-content">
                {/* Brand Section */}
                <div className="brand-section">
                  <div className="brand-info">
                    <h3 className="brand-title">Task Companion</h3>
                    <p className="brand-subtitle">Your daily productivity partner</p>
                  </div>
                </div>
                
                {/* Quick Stats */}
                <div className="stats-section">
                  <h6 className="section-title">Today's Overview</h6>
                  <div className="stat-cards">
                    <div className="stat-card">
                      <div className="stat-icon-wrapper">
                        <Assignment className="stat-icon" fontSize="medium" />
                      </div>
                      <div className="stat-info">
                        <div className="stat-number">{totalTasks}</div>
                        <div className="stat-label">Planned</div>
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon-wrapper success">
                        <CheckCircle className="stat-icon" fontSize="medium" />
                      </div>
                      <div className="stat-info">
                        <div className="stat-number">{completedTasks}</div>
                        <div className="stat-label">Completed</div>
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon-wrapper warning">
                        <Schedule className="stat-icon" fontSize="medium" />
                      </div>
                      <div className="stat-info">
                        <div className="stat-number">{totalTasks - completedTasks}</div>
                        <div className="stat-label">Remaining</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="action-section">
                  <Button variant="primary" size="lg" className="primary-action" onClick={addTask}>
                    <FontAwesomeIcon icon={faPlus} className="me-2" />
                    Add New Task
                  </Button>
                  <div className="secondary-actions">
                    <Button variant="outline-secondary" className="secondary-action" onClick={openDashboard}>
                      <TrendingUp className="me-2" fontSize="small" />
                      Dashboard
                    </Button>
                    
                    {/* Browser Native Notification Toggle with requesting state */}
                    <div className="notification-controls">
                      {notificationSupported ? (
                        <Button 
                          variant={notificationsEnabled ? "success" : "outline-secondary"} 
                          className={`secondary-action w-100 ${requestingNotifications ? 'requesting' : ''}`}
                          onClick={notificationsEnabled ? disableNotifications : enableNotifications}
                          disabled={requestingNotifications}
                        >
                          <FontAwesomeIcon 
                            icon={notificationsEnabled ? faBell : faBellSlash} 
                            className="me-2" 
                          />
                          {requestingNotifications ? 'Requesting...' : 
                           notificationsEnabled ? 'Notifications On' : 'Enable Notifications'}
                        </Button>
                      ) : (
                        <small className="text-muted">Notifications not supported</small>
                      )}
                    </div>
                  </div>
                </div>

                {/* Time Display */}
                <div className="time-display">
                  <div className="current-time">
                    {currentTime.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: true 
                    })}
                  </div>
                  <div className="current-date">
                    {currentTime.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </div>
                  {notificationSupported && (
                    <div className="notification-status">
                      <small className={`status-indicator ${notificationsEnabled ? 'enabled' : 'disabled'}`}>
                        🔔 {notificationsEnabled ? 'On' : 'Off'}
                      </small>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Col>

          {/* Enhanced Main Content */}
          <Col xxl={7} xl={7} lg={6} xs={12} className="main-content">
            <div className="main-wrapper">
              {/* Enhanced Greeting Section */}
              <Card className="greeting-card">
                <Card.Body>
                  <div className="greeting-content">
                    <div className="greeting-icon-section">
                      <div className="greeting-icon-bg">
                        <FontAwesomeIcon icon={icon} className="greeting-icon" />
                      </div>
                    </div>
                    <div className="greeting-text-section">
                      <h1 className="greeting-title">{greeting} {emoji}</h1>
                      <p className="greeting-date">{formatCurrentDate()}</p>
                      <div className="greeting-messages">
                        <p className="motivational-message">
                          {getMotivationalMessage()}
                        </p>
                        <p className="consistency-message">Your consistency is building something beautiful! 🌱</p>
                      </div>
                    </div>
                  </div>
                </Card.Body>
              </Card>

              {/* Enhanced Task Companion Header - Desktop Only */}
              <div className="task-header-section d-none d-lg-block">
                <div className="task-header-content">
                  <div className="task-header-info">
                    <h2 className="task-header-title">Your Tasks</h2>
                    <p className="task-header-subtitle">Focus on what matters most ✨</p>
                  </div>
                </div>
              </div>

              {/* Enhanced Tasks Card */}
              <Card className="tasks-card">
                <Card.Header className="tasks-card-header">
                  <div className="tasks-header-content">
                    <h3 className="tasks-title">
                      <FontAwesomeIcon icon={faCalendarDays} className="tasks-icon" />
                      Today's Tasks
                    </h3>
                    <Badge bg={progressPercentage === 100 ? "success" : "warning"} className="completion-badge">
                      {completedTasks}/{totalTasks} completed
                    </Badge>
                  </div>
                </Card.Header>
                <Card.Body className="tasks-card-body">
                  {tasks.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">📝</div>
                      <h4 className="empty-state-title">No tasks yet!</h4>
                      <p className="empty-state-text">Click "Add New Task" to get started on your productive day.</p>
                      <Button variant="primary" onClick={addTask} className="empty-state-btn">
                        <FontAwesomeIcon icon={faPlus} className="me-2" />
                        Add Your First Task
                      </Button>
                    </div>
                  ) : (
                    <div className="tasks-list">
                      {tasks.map(task => {
                        const taskAge = new Date() - new Date(task.createdAt || task.date);
                        const hoursOld = Math.floor(taskAge / (1000 * 60 * 60));
                        
                        return (
                          <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''} ${hoursOld > 20 ? 'expiring' : ''}`}>
                            <div className="task-checkbox-wrapper">
                              <Form.Check 
                                type="checkbox" 
                                checked={task.completed} 
                                className="task-checkbox"
                                onChange={() => toggleTask(task.id)}
                              />
                            </div>
                            <div className="task-main-content">
                              <div className="task-title">{task.title}</div>
                              <div className="task-meta">
                                <Badge bg="success" className="task-tag">{task.tag}</Badge>
                                <span className="task-time">{task.startTime} - {task.endTime}</span>
                                {hoursOld > 20 && (
                                  <Badge bg="danger" className="ms-2">
                                    Expires in {24 - hoursOld}h
                                  </Badge>
                                )}
                              </div>
                              {task.note && (
                                <div className="task-note">
                                  <small className="text-muted">📝 {task.note}</small>
                                </div>
                              )}
                              {task.repeatType && task.repeatType !== 'none' && (
                                <div className="task-repeat">
                                  <small className="text-info">🔄 Repeats {task.repeatType}</small>
                                </div>
                              )}
                            </div>
                            <Button 
                              variant="outline-danger" 
                              size="sm"
                              className="task-remove-btn"
                              onClick={() => removeTask(task.id)}
                            >
                              Remove
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card.Body>
              </Card>
            </div>
          </Col>

          {/* Enhanced Right Sidebar */}
          <Col xxl={3} xl={3} lg={3} className="sidebar-right d-none d-lg-block">
            <div className="sidebar-wrapper">
              <div className="sidebar-content">
                {/* Enhanced Progress Card */}
                <Card className="progress-card">
                  <Card.Body>
                    <div className="progress-header">
                      <h5 className="progress-title">
                        <FontAwesomeIcon icon={faChartLine} className="me-2" />
                        Daily Progress
                      </h5>
                    </div>
                    <div className="progress-display">
                      <div className="progress-circle">
                        <div className="progress-inner">
                          <div className="progress-percentage">{progressPercentage}%</div>
                          <div className="progress-label">Complete</div>
                        </div>
                      </div>
                      <p className="progress-message">
                        <FontAwesomeIcon icon={faFire} className="fire-icon" />
                        {progressPercentage === 100 ? "Perfect day!" : 
                         progressPercentage >= 75 ? "Almost there!" :
                         progressPercentage >= 50 ? "Great progress!" :
                         progressPercentage > 0 ? "Keep going!" : "Let's start!"}
                      </p>
                      <ProgressBar 
                        now={progressPercentage} 
                        variant={progressPercentage === 100 ? "success" : progressPercentage >= 75 ? "info" : progressPercentage >= 50 ? "warning" : "danger"} 
                        className="progress-bar-custom"
                        style={{ height: '8px', borderRadius: '4px' }}
                      />
                    </div>
                  </Card.Body>
                </Card>

                {/* Enhanced Insights Card */}
                <Card className="insights-card">
                  <Card.Body>
                    <h6 className="insights-title">📊 Insights</h6>
                    <div className="insights-list">
                      <div className="insight-item">
                        <div className="insight-info">
                          <span className="insight-label">Active Tasks</span>
                          <span className="insight-description">Currently pending</span>
                        </div>
                        <span className="insight-value">{totalTasks - completedTasks}</span>
                      </div>
                      <div className="insight-item">
                        <div className="insight-info">
                          <span className="insight-label">Completion Rate</span>
                          <span className="insight-description">Today's success</span>
                        </div>
                        <span className="insight-value">{progressPercentage}%</span>
                      </div>
                      <div className="insight-item">
                        <div className="insight-info">
                          <span className="insight-label">Tasks Created</span>
                          <span className="insight-description">Total planned</span>
                        </div>
                        <span className="insight-value">{totalTasks}</span>
                      </div>
                      <div className="insight-item">
                        <div className="insight-info">
                          <span className="insight-label">Notifications</span>
                          <span className="insight-description">Browser alerts</span>
                        </div>
                        <span className="insight-value">
                          {notificationSupported ? (notificationsEnabled ? 'On' : 'Off') : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </div>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );

  // Mobile Layout
  const renderMobileUI = () => (
    <div className="mobile-layout-unified">
      <div className="mobile-unified-container">
        <Card className="mobile-main-card">
          <Card.Body className="p-0">
            
            {/* Header Section with Greeting */}
            <div className="mobile-header-section">
              <div className="mobile-greeting-area">
                <div className="mobile-greeting-content">
                  <div className="mobile-greeting-icon">
                    <FontAwesomeIcon icon={icon} />
                  </div>
                  <div className="mobile-greeting-text">
                    <h2 className="mobile-greeting-title">{greeting} {emoji}</h2>
                    <p className="mobile-greeting-date">{formatCurrentDate()}</p>
                  </div>
                </div>
                <div className="mobile-greeting-message">
                  <p className="mobile-motivational">{getMotivationalMessage()}</p>
                  <p className="mobile-consistency">Your consistency is building something beautiful! 🌱</p>
                </div>
              </div>

              {/* App Title */}
              <div className="mobile-app-title">
                <h3>Task Companion</h3>
                <p>Your encouraging daily partner ✨</p>
                <div className="mobile-time-display">
                  <span className="mobile-current-time">
                    {currentTime.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: true 
                    })}
                  </span>
                  {notificationSupported && (
                    <span className={`mobile-notification-status ${notificationsEnabled ? 'enabled' : 'disabled'}`}>
                      🔔 {notificationsEnabled ? 'On' : 'Off'}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats Row */}
              <div className="mobile-stats-row">
                <div className="mobile-stat-item">
                  <Assignment className="mobile-stat-icon" fontSize="medium" />
                  <div className="mobile-stat-info">
                    <div className="mobile-stat-number">{totalTasks}</div>
                    <div className="mobile-stat-label">Planned</div>
                  </div>
                </div>
                <div className="mobile-stat-item">
                  <CheckCircle className="mobile-stat-icon success" fontSize="medium" />
                  <div className="mobile-stat-info">
                    <div className="mobile-stat-number">{completedTasks}</div>
                    <div className="mobile-stat-label">Completed</div>
                  </div>
                </div>
                <div className="mobile-stat-item">
                  <Schedule className="mobile-stat-icon warning" fontSize="medium" />
                  <div className="mobile-stat-info">
                    <div className="mobile-stat-number">{totalTasks - completedTasks}</div>
                    <div className="mobile-stat-label">Remaining</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tasks Section */}
            <div className="mobile-tasks-section">
              <div className="mobile-tasks-header">
                <h4>
                  <FontAwesomeIcon icon={faCalendarDays} className="me-2" />
                  Today's Tasks
                </h4>
                <Badge bg={progressPercentage === 100 ? "success" : "warning"} className="mobile-completion-badge">
                  {completedTasks}/{totalTasks} completed
                </Badge>
              </div>
              
              <div className="mobile-tasks-list">
                {tasks.length === 0 ? (
                  <div className="mobile-empty-state">
                    <div className="mobile-empty-icon">📝</div>
                    <p>No tasks yet! Add your first task to get started.</p>
                    <Button variant="primary" size="sm" onClick={addTask}>
                      <FontAwesomeIcon icon={faPlus} className="me-1" />
                      Add Task
                    </Button>
                  </div>
                ) : (
                  tasks.map(task => {
                    const taskAge = new Date() - new Date(task.createdAt || task.date);
                    const hoursOld = Math.floor(taskAge / (1000 * 60 * 60));
                    
                    return (
                      <div key={task.id} className={`mobile-task-item ${task.completed ? 'completed' : ''} ${hoursOld > 20 ? 'expiring' : ''}`}>
                        <Form.Check 
                          type="checkbox" 
                          checked={task.completed} 
                          className="mobile-task-checkbox"
                          onChange={() => toggleTask(task.id)}
                        />
                        <div className="mobile-task-content">
                          <div className="mobile-task-title">{task.title}</div>
                          <div className="mobile-task-meta">
                            <Badge bg="success" size="sm" className="mobile-task-tag">{task.tag}</Badge>
                            <span className="mobile-task-time">{task.startTime} - {task.endTime}</span>
                            {hoursOld > 20 && (
                              <Badge bg="danger" size="sm" className="ms-1">
                                {24 - hoursOld}h left
                              </Badge>
                            )}
                          </div>
                          {task.note && (
                            <div className="mobile-task-note">
                              <small className="text-muted">📝 {task.note}</small>
                            </div>
                          )}
                          {task.repeatType && task.repeatType !== 'none' && (
                            <div className="mobile-task-repeat">
                              <small className="text-info">🔄 Repeats {task.repeatType}</small>
                            </div>
                          )}
                        </div>
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="mobile-task-remove"
                          onClick={() => removeTask(task.id)}
                        >
                          ×
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Progress Section */}
            <div className="mobile-progress-section">
              <div className="mobile-progress-header">
                <div className="mobile-progress-title">
                  <FontAwesomeIcon icon={faChartLine} className="me-2" />
                  Daily Progress
                </div>
                <div className="mobile-progress-percentage">{progressPercentage}%</div>
              </div>
              
              <div className="mobile-progress-display">
                <ProgressBar 
                  now={progressPercentage} 
                  variant={progressPercentage === 100 ? "success" : progressPercentage >= 75 ? "info" : progressPercentage >= 50 ? "warning" : "danger"} 
                  className="mobile-progress-bar"
                />
                <p className="mobile-progress-message">
                  <FontAwesomeIcon icon={faFire} className="me-1" />
                  {progressPercentage === 100 ? "Perfect day!" : 
                   progressPercentage >= 75 ? "Almost there!" :
                   progressPercentage >= 50 ? "Great progress!" :
                   progressPercentage > 0 ? "Keep going!" : "Let's start!"}
                </p>
              </div>
            </div>

            {/* Insights Section */}
            <div className="mobile-insights-section">
              <h5 className="mobile-insights-title">📊 Today's Insights</h5>
              <div className="mobile-insights-grid">
                <div className="mobile-insight-item">
                  <span className="mobile-insight-label">Active</span>
                  <span className="mobile-insight-value">{totalTasks - completedTasks}</span>
                </div>
                <div className="mobile-insight-item">
                  <span className="mobile-insight-label">Success Rate</span>
                  <span className="mobile-insight-value">{progressPercentage}%</span>
                </div>
                <div className="mobile-insight-item">
                  <span className="mobile-insight-label">Total</span>
                  <span className="mobile-insight-value">{totalTasks}</span>
                </div>
                <div className="mobile-insight-item">
                  <span className="mobile-insight-label">Notifications</span>
                  <span className="mobile-insight-value">{notificationSupported ? (notificationsEnabled ? 'On' : 'Off') : 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mobile-actions-section">
              <Button variant="primary" size="lg" className="mobile-primary-action" onClick={addTask}>
                <FontAwesomeIcon icon={faPlus} className="me-2" />
                Add New Task
              </Button>
              <div className="mobile-secondary-actions">
                <Button variant="outline-secondary" className="mobile-secondary-action" onClick={openDashboard}>
                  <TrendingUp className="me-2" fontSize="small" />
                  Dashboard
                </Button>
                {notificationSupported && (
                  <Button 
                    variant={notificationsEnabled ? "success" : "outline-secondary"} 
                    className={`mobile-secondary-action ${requestingNotifications ? 'requesting' : ''}`}
                    onClick={notificationsEnabled ? disableNotifications : enableNotifications}
                    disabled={requestingNotifications}
                  >
                    <FontAwesomeIcon 
                      icon={notificationsEnabled ? faBell : faBellSlash} 
                      className="me-2" 
                    />
                    {requestingNotifications ? 'Requesting...' : 
                     notificationsEnabled ? 'Notifications On' : 'Enable Notifications'}
                  </Button>
                )}
              </div>
            </div>

          </Card.Body>
        </Card>
      </div>
    </div>
  );

  return (
    <>
      {isMobile ? renderMobileUI() : renderDesktopUI()}
      
      {/* Todo Modal Component */}
      <Todo 
        show={showTodoModal}
        onHide={() => setShowTodoModal(false)}
        onSave={handleSaveTask}
      />
    </>
  );
}

export default TaskCompanion;
