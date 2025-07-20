from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
import sqlite3
import datetime
import os
from apscheduler.schedulers.background import BackgroundScheduler

# Configure Flask to serve static files
app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)

DB_NAME = "tasks.db"

def parse_time_string(time_str):
    """Parse time string like '14:30' or '2:30 PM' to datetime object for today"""
    try:
        today = datetime.date.today()
        
        if ':' in time_str and ('AM' not in time_str.upper() and 'PM' not in time_str.upper()):
            time_obj = datetime.datetime.strptime(time_str, '%H:%M').time()
            return datetime.datetime.combine(today, time_obj)
        
        elif 'AM' in time_str.upper() or 'PM' in time_str.upper():
            time_obj = datetime.datetime.strptime(time_str, '%I:%M %p').time()
            return datetime.datetime.combine(today, time_obj)
            
        return None
    except:
        return None

def init_db():
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        
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

# Initialize database
init_db()

# ==================== API ROUTES (MUST BE DEFINED FIRST) ====================

@app.route("/api/get-tasks", methods=["GET"])
def get_tasks():
    """Get all tasks"""
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

@app.route("/api/delete-old-tasks", methods=["DELETE"])
def delete_old_tasks():
    """Delete tasks older than 24 hours"""
    cutoff = datetime.datetime.now() - datetime.timedelta(days=1)
    
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, task_name FROM tasks WHERE created_at <= ?", (str(cutoff),))
        old_tasks = cursor.fetchall()
        
        for task_id, _ in old_tasks:
            cursor.execute("DELETE FROM task_notifications WHERE task_id = ?", (task_id,))
        
        cursor.execute("DELETE FROM tasks WHERE created_at <= ?", (str(cutoff),))
        deleted_count = cursor.rowcount
        conn.commit()
    
    print(f"🗑️ Cleanup Complete: {deleted_count} expired tasks removed")
    
    return jsonify({
        "message": f"Deleted {deleted_count} old tasks",
        "deleted_count": deleted_count
    })

@app.route("/api/add-task", methods=["POST"])
def add_task():
    """Add a new task"""
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
    
    print(f"📝 New Task Created: '{task_name}' ({start_time} - {end_time})")
    
    return jsonify({"message": "Task added successfully"}), 201

@app.route("/api/update-task/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    """Update a specific task"""
    data = request.json
    
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT task_name FROM tasks WHERE id=?", (task_id,))
        current_task = cursor.fetchone()
        
        if not current_task:
            return jsonify({"error": "Task not found"}), 404
        
        cursor.execute('''
            UPDATE tasks 
            SET task_name=?, start_time=?, end_time=?, status=?, notes=?
            WHERE id=?
        ''', (
            data.get("task_name"),
            data.get("start_time"),
            data.get("end_time"),
            data.get("status"),
            data.get("notes", ""),
            task_id
        ))
        conn.commit()
        
        print(f"✅ Task Updated: '{data.get('task_name')}'")
            
    return jsonify({"message": "Task updated successfully"})

@app.route("/api/delete-task/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    """Delete a specific task"""
    with sqlite3.connect(DB_NAME) as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT task_name FROM tasks WHERE id=?", (task_id,))
        task = cursor.fetchone()
        
        if not task:
            return jsonify({"error": "Task not found"}), 404
            
        task_name = task[0]
        
        cursor.execute("DELETE FROM task_notifications WHERE task_id=?", (task_id,))
        cursor.execute("DELETE FROM tasks WHERE id=?", (task_id,))
        conn.commit()
        
        print(f"🗑️ Task Deleted: '{task_name}'")
            
    return jsonify({"message": "Task deleted successfully"})

@app.route("/api/status", methods=["GET"])
def api_status():
    """API status endpoint"""
    return jsonify({
        "message": "Task Companion API is running! 🚀",
        "version": "3.1.0",
        "status": "healthy",
        "endpoints": {
            "GET /api/get-tasks": "Get all tasks",
            "POST /api/add-task": "Add a new task",
            "PUT /api/update-task/<id>": "Update a task",
            "DELETE /api/delete-task/<id>": "Delete a task",
            "DELETE /api/delete-old-tasks": "Clean up old tasks"
        }
    })

# ==================== STATIC FILE SERVING ROUTES ====================

@app.route("/")
def serve_react_app():
    """Serve the main React application"""
    try:
        return send_file('static/index.html')
    except FileNotFoundError:
        return jsonify({
            "message": "Task Companion API is running! 🚀",
            "note": "React frontend will be available after build",
            "status": "backend_only"
        })

@app.route('/<path:path>')
def serve_static_files(path):
    """Serve static files or React app for client-side routing"""
    if path.startswith('api/'):
        return jsonify({"error": "API endpoint not found"}), 404
    
    try:
        static_file_path = os.path.join(app.static_folder, path)
        if os.path.exists(static_file_path):
            return send_from_directory('static', path)
        else:
            return send_file('static/index.html')
    except FileNotFoundError:
        return jsonify({"error": "File not found"}), 404

if __name__ == "__main__":
    print("🚀 Starting Task Companion Backend...")
    print(f"📊 Database: {DB_NAME}")
    print("✨ API Endpoints:")
    print("   GET    /api/get-tasks")
    print("   POST   /api/add-task")
    print("   PUT    /api/update-task/<id>")
    print("   DELETE /api/delete-task/<id>")
    print("   DELETE /api/delete-old-tasks")
    print("📱 Static Serving: React frontend integration enabled")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
