const NotificationManager = {
  permission: 'default',
  
  // Initialize and check browser support
  async init() {
    if ('Notification' in window) {
      this.permission = Notification.permission;
      console.log('Browser notifications supported');
      return true;
    }
    console.warn('Browser notifications not supported');
    return false;
  },

  // Request permission from user
  async requestPermission() {
    if (!('Notification' in window)) return false;
    
    const permission = await Notification.requestPermission();
    this.permission = permission;
    console.log('Notification permission:', permission);
    return permission === 'granted';
  },

  // Send a notification
  send(title, body, options = {}) {
    if (this.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'task-companion',
        requireInteraction: false,
        silent: false,
        ...options
      });

      // Auto close after 5 seconds
      setTimeout(() => notification.close(), 5000);
      
      // Optional click handler
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      
      return notification;
    } else {
      console.warn('Notification permission not granted');
      return null;
    }
  },

  // Task-specific notification methods
  taskReminder(taskName, minutesLeft) {
    return this.send(
      '⏰ Task Deadline Approaching!',
      `"${taskName}" ends in ${minutesLeft} minutes. Time to focus! 🎯`,
      { tag: 'task-reminder' }
    );
  },

  taskCompleted(taskName, timeSaved = 0) {
    const message = timeSaved > 0 
      ? `Great job finishing "${taskName}" with ${timeSaved} minutes to spare! 🌟`
      : `Excellent work completing "${taskName}"! 🎉`;
    
    return this.send('🎉 Task Completed!', message, { tag: 'task-completed' });
  },

  taskOverdue(taskName, hoursLate) {
    return this.send(
      '⚠️ Task Overdue',
      `"${taskName}" is ${hoursLate}h overdue. Don't worry, you can still finish it! 💪`,
      { tag: 'task-overdue' }
    );
  },

  welcomeMessage() {
    return this.send(
      '🎉 Notifications Enabled!',
      'You\'ll now receive helpful task reminders to stay productive! ✨',
      { tag: 'welcome' }
    );
  }
};

export default NotificationManager;
