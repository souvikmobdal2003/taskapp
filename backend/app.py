from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import datetime
from apscheduler.schedulers.background import BackgroundScheduler

app = Flask(__name__)
CORS(app)

DB_NAME = "tasks.db"

def parse_time_string(time_str):
    """Parse time string like '14:30' or '2:30 PM' to datetime object for today"""
    try:
        today = datetime.date.today()
        
        # Handle 24-hour format (14:30)
        if ':' in time_str and ('AM' not in time_str.upper() and 'PM' not in time_str.upper()):
            time_obj = datetime.datetime.strptime(time_str, '%H:%M').time()
            return datetime.datetime.combine(today, time_obj)
        
        # Handle 12-hour format (2:30 PM)
        elif 'AM' in time_str.upper() or 'PM' in time_str.upper():
            time_obj = datetime.datetime.strptime(time_str, '%I:%M %p').time()
            return datetime.datetime.combine(today, time_obj)
            
        return None
    except:
        return None

def check_task_completion_status():
    """Check all tasks and log completion status"""
    now = datetime.datetime.now()
    
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, task_name, start_time, end_time, status, created_at 
            FROM tasks 
            WHERE status = 'pending'
        """)
        
        pending_tasks = cursor.fetchall()
        
        for task in pending_tasks:
            task_id, task_name, start_time, end_time, status, created_at = task
            
            end_datetime = parse_time_string(end_time)
            if not end_datetime:
                continue
                
            # Check if task deadline has passed
            if now > end_datetime:
                hours_late = int((now - end_datetime).total_seconds() / 3600)
                
                # Only log once when first detected as overdue
                cursor.execute("""
                    SELECT COUNT(*) FROM task_notifications 
                    WHERE task_id = ? AND notification_type = 'overdue'
                """, (task_id,))
                
                if cursor.fetchone()[0] == 0:  # No overdue log yet
                    print(f"⏰ Task Overdue: '{task_name}' is {hours_late}h late")
                    
                    # Mark as logged
                    cursor.execute("""
                        INSERT INTO task_notifications (task_id, notification_type, sent_at)
                        VALUES (?, 'overdue', ?)
                    """, (task_id, now.isoformat()))
                    conn.commit()

def check_upcoming_tasks():
    """Check for tasks that need 1-hour reminder"""
    now = datetime.datetime.now()
    one_hour_later = now + datetime.timedelta(hours=1)
    
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, task_name, start_time, end_time, status 
            FROM tasks 
            WHERE status = 'pending'
        """)
        
        pending_tasks = cursor.fetchall()
        
        for task in pending_tasks:
            task_id, task_name, start_time, end_time, status = task
            
            end_datetime = parse_time_string(end_time)
            if not end_datetime:
                continue
            
            # Check if task ends within the next hour
            if now <= end_datetime <= one_hour_later:
                # Check if reminder already logged
                cursor.execute("""
                    SELECT COUNT(*) FROM task_notifications 
                    WHERE task_id = ? AND notification_type = 'reminder'
                """, (task_id,))
                
                if cursor.fetchone()[0] == 0:  # No reminder logged yet
                    minutes_left = int((end_datetime - now).total_seconds() / 60)
                    print(f"⏳ Task Reminder: '{task_name}' ends in {minutes_left} minutes")
                    
                    # Mark reminder as logged
                    cursor.execute("""
                        INSERT INTO task_notifications (task_id, notification_type, sent_at)
                        VALUES (?, 'reminder', ?)
                    """, (task_id, now.isoformat()))
                    conn.commit()

def init_db():
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        
        # Create tasks table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_name TEXT,
                start_time TEXT,
                end_time TEXT,
                status TEXT,
                notes TEXT,
                created_at TEXT
            )
        ''')
        
        # Create notifications tracking table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS task_notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER,
                notification_type TEXT,
                sent_at TEXT,
                FOREIGN KEY (task_id) REFERENCES tasks (id)
            )
        ''')
        
        conn.commit()

# Initialize database and scheduler
init_db()
scheduler = BackgroundScheduler()

# Schedule checks every 3 minutes for task reminders
scheduler.add_job(
    func=check_upcoming_tasks,
    trigger="interval",
    minutes=3,
    id='check_upcoming_tasks'
)

scheduler.add_job(
    func=check_task_completion_status,
    trigger="interval",
    minutes=5,
    id='check_task_completion'
)

scheduler.start()

@app.route("/")
def home():
    return jsonify({
        "message": "Task Companion API is running! 🚀",
        "version": "3.1.0",
        "endpoints": {
            "GET /": "API status",
            "POST /add-task": "Add a new task",
            "GET /get-tasks": "Get all tasks", 
            "DELETE /delete-old-tasks": "Delete tasks older than 24 hours",
            "PUT /update-task/<id>": "Update a specific task",
            "DELETE /delete-task/<id>": "Delete a specific task",
            "GET /check-notifications": "Manually trigger notification checks",
            "GET /task-stats": "Get task statistics"
        },
        "features": {
            "task_management": "Full CRUD operations",
            "automatic_cleanup": "Tasks older than 24 hours are removed",
            "task_tracking": "Logs reminders and overdue status",
            "backend_logging": "Server-side task monitoring"
        },
        "status": "healthy"
    })

@app.route("/check-notifications", methods=["GET"])
def manual_notification_check():
    """Manually trigger notification checks for testing"""
    check_upcoming_tasks()
    check_task_completion_status()
    return jsonify({"message": "Task notification checks completed"})

@app.route("/update-task/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    data = request.json
    now = datetime.datetime.now()
    
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT task_name, status, end_time FROM tasks WHERE id=?", (task_id,))
        current_task = cursor.fetchone()
        
        if not current_task:
            return jsonify({"error": "Task not found"}), 404
        
        old_status = current_task[1]
        new_status = data.get("status")
        task_name = current_task[0]
        end_time = current_task[2]
        
        # Update the task
        cursor.execute('''
            UPDATE tasks 
            SET task_name=?, start_time=?, end_time=?, status=?, notes=?
            WHERE id=?
        ''', (
            data.get("task_name"),
            data.get("start_time"), 
            data.get("end_time"),
            new_status,
            data.get("notes", ""),
            task_id
        ))
        conn.commit()
        
        # Log status changes
        if old_status != new_status and new_status == "completed":
            end_datetime = parse_time_string(end_time)
            
            if end_datetime and now <= end_datetime:
                # Completed on time
                time_saved = int((end_datetime - now).total_seconds() / 60)
                print(f"🎉 Task Completed On Time: '{task_name}' finished {time_saved} minutes early!")
            else:
                # Completed but was overdue
                if end_datetime:
                    hours_late = int((now - end_datetime).total_seconds() / 3600)
                    print(f"✅ Task Completed Late: '{task_name}' finished {hours_late}h after deadline")
                else:
                    print(f"✅ Task Completed: '{task_name}'")
            
        elif new_status == "pending" and old_status == "completed":
            print(f"🔄 Task Reopened: '{task_name}' marked as pending")
            
    return jsonify({"message": "Task updated successfully"})

@app.route("/delete-task/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        
        # Get task details before deletion
        cursor.execute("SELECT task_name FROM tasks WHERE id=?", (task_id,))
        task = cursor.fetchone()
        
        if not task:
            return jsonify({"error": "Task not found"}), 404
            
        task_name = task[0]
        
        # Delete related notifications first
        cursor.execute("DELETE FROM task_notifications WHERE task_id=?", (task_id,))
        
        # Delete the task
        cursor.execute("DELETE FROM tasks WHERE id=?", (task_id,))
        conn.commit()
        
        print(f"🗑️ Task Deleted: '{task_name}'")
            
    return jsonify({"message": "Task deleted successfully"})

@app.route("/add-task", methods=["POST"])
def add_task():
    data = request.json
    task_name = data["task_name"]
    start_time = data["start_time"]
    end_time = data["end_time"]
    
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO tasks (task_name, start_time, end_time, status, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            task_name,
            start_time,
            end_time,
            data["status"],
            data.get("notes", ""),
            str(datetime.datetime.now())
        ))
        conn.commit()
    
    # Calculate time until deadline
    end_datetime = parse_time_string(end_time)
    deadline_info = ""
    if end_datetime:
        now = datetime.datetime.now()
        if end_datetime > now:
            hours_until = int((end_datetime - now).total_seconds() / 3600)
            minutes_until = int(((end_datetime - now).total_seconds() % 3600) / 60)
            deadline_info = f" (Deadline in {hours_until}h {minutes_until}m)"
    
    print(f"📝 New Task Created: '{task_name}' ({start_time} - {end_time}){deadline_info}")
    
    return jsonify({"message": "Task added successfully"}), 201

@app.route("/get-tasks", methods=["GET"])
def get_tasks():
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tasks ORDER BY created_at DESC")
        rows = cursor.fetchall()
        tasks = []
        for row in rows:
            tasks.append({
                "id": row[0],
                "task_name": row[1],
                "start_time": row[2],
                "end_time": row[3],
                "status": row[4],
                "notes": row[5],
                "created_at": row[6]
            })
    return jsonify(tasks)

@app.route("/delete-old-tasks", methods=["DELETE"])
def delete_old_tasks():
    cutoff = datetime.datetime.now() - datetime.timedelta(days=1)
    
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        
        # Get tasks that will be deleted
        cursor.execute("SELECT id, task_name FROM tasks WHERE created_at <= ?", (str(cutoff),))
        old_tasks = cursor.fetchall()
        
        # Delete related notifications first
        for task_id, _ in old_tasks:
            cursor.execute("DELETE FROM task_notifications WHERE task_id = ?", (task_id,))
        
        # Delete old tasks
        cursor.execute("DELETE FROM tasks WHERE created_at <= ?", (str(cutoff),))
        deleted_count = cursor.rowcount
        conn.commit()
    
    if deleted_count > 0:
        if deleted_count == 1:
            task_name = old_tasks[0][1] if old_tasks else "Unknown task"
            print(f"🗑️ Expired Task Removed: '{task_name}' (24+ hours old)")
        else:
            print(f"🗑️ Cleanup Complete: {deleted_count} expired tasks removed")
    
    return jsonify({
        "message": f"Deleted {deleted_count} old tasks",
        "deleted_count": deleted_count
    })

@app.route("/task-stats", methods=["GET"])
def task_stats():
    """Get statistics about task completion times"""
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        
        # Get completion stats
        cursor.execute("""
            SELECT 
                COUNT(*) as total_tasks,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tasks
            FROM tasks
        """)
        
        stats = cursor.fetchone()
        
        # Get recent activity
        cursor.execute("""
            SELECT COUNT(*) as recent_notifications
            FROM task_notifications
            WHERE sent_at >= datetime('now', '-24 hours')
        """)
        
        recent_notifications = cursor.fetchone()[0]
        
        return jsonify({
            "total_tasks": stats[0],
            "completed_tasks": stats[1],
            "pending_tasks": stats[2],
            "completion_rate": round((stats[1] / stats[0] * 100) if stats[0] > 0 else 0, 2),
            "recent_notifications": recent_notifications
        })

@app.route("/recent-activity", methods=["GET"])
def recent_activity():
    """Get recent task activity logs"""
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT tn.notification_type, tn.sent_at, t.task_name
            FROM task_notifications tn
            JOIN tasks t ON tn.task_id = t.id
            WHERE tn.sent_at >= datetime('now', '-24 hours')
            ORDER BY tn.sent_at DESC
            LIMIT 10
        """)
        
        activity = []
        for row in cursor.fetchall():
            activity.append({
                "type": row[0],
                "timestamp": row[1],
                "task_name": row[2]
            })
    
    return jsonify({"recent_activity": activity})

if __name__ == "__main__":
    print("🚀 Starting Task Companion Backend...")
    print(f"📊 Database: {DB_NAME}")
    print("✨ Features: Task management, automatic cleanup, activity logging")
    print("🔔 Notifications: Browser native (frontend handled)")
    
    try:
        app.run(debug=True, use_reloader=False)
    finally:
        scheduler.shutdown()
