import React, { useState } from 'react';
import { Modal, Button, Form, Row, Col, ProgressBar } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTimes, faPlus, faCalendarAlt, faClock, faRepeat, 
  faStickyNote, faTasks, faCheck, faStar, faMagic,
  faRocket, faHeart, faBolt
} from '@fortawesome/free-solid-svg-icons';
import '../Todo.css';

function Todo({ show, onHide, onSave }) {
  const [formData, setFormData] = useState({
    taskName: '',
    startTime: '',
    endTime: '',
    repeatType: 'none',
    customDays: [],
    note: '',
    tag: 'general' // Default category
  });
  
  const [errors, setErrors] = useState({});
  const [showCustomDays, setShowCustomDays] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const weekDays = [
    { value: 'monday', label: 'Mon', fullName: 'Monday', emoji: '🌟' },
    { value: 'tuesday', label: 'Tue', fullName: 'Tuesday', emoji: '🔥' },
    { value: 'wednesday', label: 'Wed', fullName: 'Wednesday', emoji: '⚡' },
    { value: 'thursday', label: 'Thu', fullName: 'Thursday', emoji: '💪' },
    { value: 'friday', label: 'Fri', fullName: 'Friday', emoji: '🎉' },
    { value: 'saturday', label: 'Sat', fullName: 'Saturday', emoji: '🌈' },
    { value: 'sunday', label: 'Sun', fullName: 'Sunday', emoji: '🌙' }
  ];

  // Default tag for styling purposes (since category section is removed)
  const defaultTag = { 
    value: 'general', 
    label: 'General', 
    color: '#6366f1', 
    bgColor: '#f0f0ff', 
    icon: '📝', 
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleRepeatChange = (value) => {
    setFormData(prev => ({ ...prev, repeatType: value, customDays: [] }));
    setShowCustomDays(value === 'custom');
  };

  const handleCustomDayToggle = (day) => {
    setFormData(prev => ({
      ...prev,
      customDays: prev.customDays.includes(day)
        ? prev.customDays.filter(d => d !== day)
        : [...prev.customDays, day]
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.taskName.trim()) {
      newErrors.taskName = 'Task name is required';
    }

    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required';
    }

    if (!formData.endTime) {
      newErrors.endTime = 'End time is required';
    }

    if (formData.startTime && formData.endTime) {
      const start = new Date(`2000-01-01 ${formData.startTime}`);
      const end = new Date(`2000-01-01 ${formData.endTime}`);
      if (start >= end) {
        newErrors.endTime = 'End time must be after start time';
      }
    }

    if (formData.repeatType === 'custom' && formData.customDays.length === 0) {
      newErrors.customDays = 'Please select at least one day for custom repeat';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;

    const newTask = {
      id: Date.now(),
      title: formData.taskName.trim(),
      tag: formData.tag,
      startTime: formatTime(formData.startTime),
      endTime: formatTime(formData.endTime),
      completed: false,
      repeatType: formData.repeatType,
      customDays: formData.customDays,
      note: formData.note.trim(),
      createdAt: new Date().toISOString()
    };

    onSave(newTask);
    handleClose();
  };

  const handleClose = () => {
    setFormData({
      taskName: '',
      startTime: '',
      endTime: '',
      repeatType: 'none',
      customDays: [],
      note: '',
      tag: 'general'
    });
    setErrors({});
    setShowCustomDays(false);
    setCurrentStep(1);
    onHide();
  };

  const formatTime = (timeString) => {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getRepeatLabel = () => {
    switch (formData.repeatType) {
      case 'daily': return '🌅 Every single day';
      case 'weekdays': return '💼 Monday through Friday';
      case 'weekly': return '🔄 Once every week';
      case 'custom':
        return formData.customDays.length > 0 
          ? `✨ Every ${formData.customDays.map(day => weekDays.find(w => w.value === day)?.label).join(', ')}`
          : '⚙️ Choose your days';
      default: return '🚫 Just this once';
    }
  };

  const getProgressPercentage = () => {
    let progress = 0;
    if (formData.taskName.trim()) progress += 40; // Increased weight since category is removed
    if (formData.startTime) progress += 30;
    if (formData.endTime) progress += 30;
    return Math.min(progress, 100);
  };

  const selectedTag = defaultTag; // Use default tag since category section is removed

  return (
    <Modal 
      show={show} 
      onHide={handleClose}
      centered
      className="todo-modal-modern"
      size="lg"
      backdrop="static"
    >
      <div className="modal-glass-effect">
        {/* Progress Header */}
        <div className="progress-header">
          <div className="progress-info">
            <h4>Create Your Perfect Task ✨</h4>
            <p>Let's make productivity fun and rewarding!</p>
          </div>
          <div className="progress-circle-small">
            <svg width="60" height="60" viewBox="0 0 60 60">
              <circle cx="30" cy="30" r="25" stroke="#e5e7eb" strokeWidth="5" fill="none" />
              <circle 
                cx="30" cy="30" r="25" 
                stroke={selectedTag.color}
                strokeWidth="5" 
                fill="none"
                strokeDasharray={157}
                strokeDashoffset={157 - (157 * getProgressPercentage()) / 100}
                className="progress-stroke"
              />
            </svg>
            <span className="progress-text">{getProgressPercentage()}%</span>
          </div>
          <Button variant="link" className="close-button-modern" onClick={handleClose}>
            <FontAwesomeIcon icon={faTimes} />
          </Button>
        </div>

        <Modal.Body className="modal-body-modern">
          <Form>
            {/* Task Name Section */}
            <div className="input-section bouncing-section">
              <div className="section-header">
                <div className="section-icon" style={{ background: selectedTag.gradient }}>
                  <FontAwesomeIcon icon={faRocket} />
                </div>
                <div>
                  <h5>What's your mission? 🎯</h5>
                  <p>Give your task a catchy name that motivates you!</p>
                </div>
              </div>
              
              <div className="floating-input-container">
                <Form.Control
                  type="text"
                  placeholder=""
                  value={formData.taskName}
                  onChange={(e) => handleInputChange('taskName', e.target.value)}
                  className={`floating-input ${formData.taskName ? 'has-content' : ''} ${errors.taskName ? 'error' : ''}`}
                />
                <label className="floating-label">Task Name *</label>
                {errors.taskName && <div className="error-tooltip">{errors.taskName}</div>}
              </div>
            </div>

            {/* Time Section */}
            <div className="input-section">
              <div className="section-header">
                <div className="section-icon" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                  <FontAwesomeIcon icon={faClock} />
                </div>
                <div>
                  <h5>Time to shine ⏰</h5>
                  <p>When will you make this happen?</p>
                </div>
              </div>
              
              <Row className="time-row">
                <Col md={6}>
                  <div className="floating-input-container">
                    <Form.Control
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => handleInputChange('startTime', e.target.value)}
                      className={`floating-input time-input ${formData.startTime ? 'has-content' : ''} ${errors.startTime ? 'error' : ''}`}
                    />
                    <label className="floating-label">Start Time *</label>
                    {errors.startTime && <div className="error-tooltip">{errors.startTime}</div>}
                  </div>
                </Col>
                <Col md={6}>
                  <div className="floating-input-container">
                    <Form.Control
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => handleInputChange('endTime', e.target.value)}
                      className={`floating-input time-input ${formData.endTime ? 'has-content' : ''} ${errors.endTime ? 'error' : ''}`}
                    />
                    <label className="floating-label">End Time *</label>
                    {errors.endTime && <div className="error-tooltip">{errors.endTime}</div>}
                  </div>
                </Col>
              </Row>
            </div>

            {/* Repeat Section */}
            <div className="input-section">
              <div className="section-header">
                <div className="section-icon" style={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' }}>
                  <FontAwesomeIcon icon={faRepeat} />
                </div>
                <div>
                  <h5>Make it a habit? 🔥</h5>
                  <p>Consistency is the key to success!</p>
                </div>
              </div>
              
              <div className="repeat-selector">
                <Form.Select
                  value={formData.repeatType}
                  onChange={(e) => handleRepeatChange(e.target.value)}
                  className="modern-select"
                >
                  <option value="none">🚫 Just once (for now!)</option>
                  <option value="daily">🌅 Daily grind mode</option>
                  <option value="weekdays">💼 Weekday warrior</option>
                  <option value="weekly">🔄 Weekly ritual</option>
                  <option value="custom">⚙️ I'll choose my days</option>
                </Form.Select>
                
                {formData.repeatType !== 'none' && (
                  <div className="repeat-preview-modern">
                    <FontAwesomeIcon icon={faMagic} />
                    <span>{getRepeatLabel()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Custom Days */}
            {showCustomDays && (
              <div className="input-section custom-days-section">
                <div className="section-header">
                  <div className="section-icon" style={{ background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' }}>
                    <FontAwesomeIcon icon={faCalendarAlt} />
                  </div>
                  <div>
                    <h5>Choose your power days! 💪</h5>
                    <p>Select the days when you'll crush this task!</p>
                  </div>
                </div>
                
                <div className="days-grid">
                  {weekDays.map((day, index) => (
                    <div
                      key={day.value}
                      className={`day-card ${formData.customDays.includes(day.value) ? 'selected' : ''}`}
                      onClick={() => handleCustomDayToggle(day.value)}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className="day-emoji">{day.emoji}</div>
                      <div className="day-short">{day.label}</div>
                      <div className="day-full">{day.fullName}</div>
                      {formData.customDays.includes(day.value) && (
                        <div className="selected-overlay">
                          <FontAwesomeIcon icon={faCheck} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {errors.customDays && (
                  <div className="error-message-modern">{errors.customDays}</div>
                )}
              </div>
            )}

            {/* Notes Section */}
            <div className="input-section">
              <div className="section-header">
                <div className="section-icon" style={{ background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' }}>
                  <FontAwesomeIcon icon={faStickyNote} />
                </div>
                <div>
                  <h5>Extra thoughts? 💭</h5>
                  <p>Add any special notes or motivation for yourself!</p>
                </div>
              </div>
              
              <div className="floating-input-container">
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder=""
                  value={formData.note}
                  onChange={(e) => handleInputChange('note', e.target.value)}
                  className={`floating-input textarea-modern ${formData.note ? 'has-content' : ''}`}
                />
                <label className="floating-label">Additional Notes (Optional)</label>
              </div>
            </div>

            {/* Live Preview */}
            {(formData.taskName || formData.startTime || formData.endTime) && (
              <div className="preview-section">
                <div className="preview-header">
                  <FontAwesomeIcon icon={faHeart} className="preview-heart" />
                  <h5>Your task is looking amazing! ✨</h5>
                </div>
                
                <div className="preview-card" style={{ background: selectedTag.gradient }}>
                  <div className="preview-content">
                    <div className="preview-title">
                      {formData.taskName || 'Your Awesome Task'}
                    </div>
                    
                    <div className="preview-details">
                      {(formData.startTime || formData.endTime) && (
                        <div className="preview-time">
                          <FontAwesomeIcon icon={faClock} />
                          <span>
                            {formData.startTime ? formatTime(formData.startTime) : '--:--'} - {formData.endTime ? formatTime(formData.endTime) : '--:--'}
                          </span>
                        </div>
                      )}
                      
                      <div className="preview-category">
                        <span className="category-emoji">{selectedTag.icon}</span>
                        <span>{selectedTag.label}</span>
                      </div>
                      
                      {formData.repeatType !== 'none' && (
                        <div className="preview-repeat">
                          <FontAwesomeIcon icon={faRepeat} />
                          <span>{getRepeatLabel()}</span>
                        </div>
                      )}
                    </div>
                    
                    {formData.note && (
                      <div className="preview-note">
                        <FontAwesomeIcon icon={faStickyNote} />
                        <span>"{formData.note}"</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="preview-sparkles">
                    <FontAwesomeIcon icon={faMagic} className="sparkle spark-1" />
                    <FontAwesomeIcon icon={faMagic} className="sparkle spark-2" />
                    <FontAwesomeIcon icon={faMagic} className="sparkle spark-3" />
                  </div>
                </div>
              </div>
            )}
          </Form>
        </Modal.Body>

        {/* Footer */}
        <div className="modal-footer-modern">
          <div className="footer-progress">
            <ProgressBar 
              now={getProgressPercentage()} 
              className="completion-bar"
              style={{ '--progress-color': selectedTag.color }}
            />
            <span className="progress-label">
              {getProgressPercentage() === 100 ? '🎉 Perfect! Ready to create!' : `${getProgressPercentage()}% complete`}
            </span>
          </div>
          
          <div className="footer-actions">
            <Button 
              variant="outline-secondary" 
              onClick={handleClose}
              className="cancel-btn-modern"
            >
              Maybe Later
            </Button>
            <Button 
              onClick={handleSave}
              className="create-btn-modern"
              disabled={!formData.taskName.trim() || !formData.startTime || !formData.endTime}
              style={{ background: selectedTag.gradient }}
            >
              <FontAwesomeIcon icon={faBolt} className="me-2" />
              Create My Task!
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default Todo;
