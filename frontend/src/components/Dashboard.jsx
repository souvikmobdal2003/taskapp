import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Button, ButtonGroup, Table, Accordion, Modal } from 'react-bootstrap';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faDownload, faCalendarWeek, faCalendarAlt, faChartBar, faFileExcel, 
  faArrowLeft, faEye, faEyeSlash, faTimes, faExpand, faCompress,
  faChartPie, faChartLine, faTrophy, faFire, faStar, faCalendarCheck
} from '@fortawesome/free-solid-svg-icons';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement } from 'chart.js';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import '../Dashboard.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement);

// Backend API URL
const API_BASE_URL = 'http://127.0.0.1:5000';

export default function Dashboard() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [viewMode, setViewMode] = useState('weekly');
  const [activeChart, setActiveChart] = useState('doughnut');
  const [showFullscreenChart, setShowFullscreenChart] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [tasksFromBackend, setTasksFromBackend] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Fetch tasks from backend
  useEffect(() => {
    const fetchTasksFromBackend = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/get-tasks`);
        if (response.ok) {
          const backendTasks = await response.json();
          // Transform backend tasks to match frontend format
          const transformedTasks = backendTasks.map(task => ({
            id: task.id,
            title: task.task_name,
            startTime: task.start_time,
            endTime: task.end_time,
            completed: task.status === 'completed',
            note: task.notes,
            tag: 'general', // Default tag since backend doesn't store this
            createdAt: task.created_at,
            date: new Date(task.created_at).toISOString().split('T')[0]
          }));
          setTasksFromBackend(transformedTasks);
        } else {
          console.error('Failed to fetch tasks from backend');
        }
      } catch (error) {
        console.error('Error fetching tasks:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTasksFromBackend();
  }, []);

  // Clean up old tasks from backend
  useEffect(() => {
    const cleanupOldTasks = async () => {
      try {
        await fetch(`${API_BASE_URL}/delete-old-tasks`, {
          method: 'DELETE'
        });
      } catch (error) {
        console.error('Error cleaning up old tasks:', error);
      }
    };

    cleanupOldTasks();
    // Set up interval to clean up every hour
    const cleanupInterval = setInterval(cleanupOldTasks, 60 * 60 * 1000);
    
    return () => clearInterval(cleanupInterval);
  }, []);
  
  // Use backend tasks if available, otherwise fall back to state data
  const realTasks = tasksFromBackend.length > 0 ? tasksFromBackend : (state?.tasks ?? []);
  
  // Get real data (prioritizing backend data)
  const completed = realTasks.filter(task => task.completed).length;
  const total = realTasks.length;
  const remaining = total - completed;
  const insights = state?.insights ?? {
    streak: 0,
    bestDay: 'Monday',
    avgCompletion: 0,
    completedThisWeek: 0,
    totalThisWeek: 0
  };

  // Generate real analytics from actual task data
  const generateAnalyticsFromRealData = () => {
    const today = new Date();
    const currentWeek = [];
    const currentMonth = [];
    
    // Get last 7 days for weekly view
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      currentWeek.push({
        date: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        fullDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      });
    }
    
    // Get last 4 weeks for monthly view
    for (let i = 3; i >= 0; i--) {
      const startDate = new Date();
      startDate.setDate(today.getDate() - (i * 7) - 6);
      const endDate = new Date();
      endDate.setDate(today.getDate() - (i * 7));
      
      currentMonth.push({
        weekNumber: `Week ${4 - i}`,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        dateRange: `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      });
    }

    return { currentWeek, currentMonth };
  };

  const { currentWeek, currentMonth } = generateAnalyticsFromRealData();

  // Process real task data for charts
  const processTaskData = () => {
    if (viewMode === 'weekly') {
      const weeklyData = currentWeek.map(day => {
        const dayTasks = realTasks.filter(task => {
          const taskDate = new Date(task.createdAt || task.date).toISOString().split('T')[0];
          return taskDate === day.date;
        });
        
        const completedTasks = dayTasks.filter(task => task.completed).length;
        const totalTasks = dayTasks.length;
        
        return {
          label: day.dayName,
          date: day.fullDate,
          completed: completedTasks,
          planned: totalTasks,
          tasks: dayTasks
        };
      });
      
      return {
        labels: weeklyData.map(d => d.label),
        completed: weeklyData.map(d => d.completed),
        planned: weeklyData.map(d => d.planned),
        dates: weeklyData.map(d => d.date),
        rawData: weeklyData
      };
    } else {
      const monthlyData = currentMonth.map(week => {
        const weekTasks = realTasks.filter(task => {
          const taskDate = new Date(task.createdAt || task.date).toISOString().split('T')[0];
          return taskDate >= week.startDate && taskDate <= week.endDate;
        });
        
        const completedTasks = weekTasks.filter(task => task.completed).length;
        const totalTasks = weekTasks.length;
        
        return {
          label: week.weekNumber,
          date: week.dateRange,
          completed: completedTasks,
          planned: totalTasks,
          tasks: weekTasks
        };
      });
      
      return {
        labels: monthlyData.map(d => d.label),
        completed: monthlyData.map(d => d.completed),
        planned: monthlyData.map(d => d.planned),
        dates: monthlyData.map(d => d.date),
        rawData: monthlyData
      };
    }
  };

  const currentData = processTaskData();

  // Calculate real insights from task data
  const calculateRealInsights = () => {
    const now = new Date();
    const todayTasks = realTasks.filter(task => {
      const taskDate = new Date(task.createdAt || task.date);
      return taskDate.toDateString() === now.toDateString();
    });

    const thisWeekTasks = realTasks.filter(task => {
      const taskDate = new Date(task.createdAt || task.date);
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      return taskDate >= weekAgo;
    });

    // Calculate completion rate by day of week
    const dayCompletionRates = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    dayNames.forEach(day => {
      const dayTasks = realTasks.filter(task => {
        const taskDate = new Date(task.createdAt || task.date);
        return taskDate.toLocaleDateString('en-US', { weekday: 'long' }) === day;
      });
      
      if (dayTasks.length > 0) {
        const completedCount = dayTasks.filter(task => task.completed).length;
        dayCompletionRates[day] = Math.round((completedCount / dayTasks.length) * 100);
      } else {
        dayCompletionRates[day] = 0;
      }
    });

    const bestDay = Object.keys(dayCompletionRates).reduce((a, b) => 
      dayCompletionRates[a] > dayCompletionRates[b] ? a : b
    );

    // Calculate streak (consecutive days with at least one completed task)
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date();
      checkDate.setDate(now.getDate() - i);
      
      const dayTasks = realTasks.filter(task => {
        const taskDate = new Date(task.createdAt || task.date);
        return taskDate.toDateString() === checkDate.toDateString();
      });
      
      const hasCompletedTask = dayTasks.some(task => task.completed);
      
      if (hasCompletedTask) {
        streak++;
      } else if (i > 0) {
        break; // Break streak if no completed tasks and it's not today
      }
    }

    return {
      todayCompleted: todayTasks.filter(task => task.completed).length,
      todayTotal: todayTasks.length,
      thisWeekCompleted: thisWeekTasks.filter(task => task.completed).length,
      thisWeekTotal: thisWeekTasks.length,
      streak: streak,
      bestDay: bestDay,
      avgCompletion: total > 0 ? Math.round((completed / total) * 100) : 0,
      totalTasks: realTasks.length,
      overallCompleted: realTasks.filter(task => task.completed).length
    };
  };

  const realInsights = calculateRealInsights();

  // Enhanced chart configurations with real data
  const doughnutData = {
    labels: ['Completed', 'Remaining'],
    datasets: [{
      data: [completed, remaining],
      backgroundColor: ['#10b981', '#f3f4f6'],
      borderWidth: 0,
      hoverBackgroundColor: ['#059669', '#e5e7eb'],
      cutout: '65%'
    }]
  };

  const barData = {
    labels: currentData.labels,
    datasets: [
      {
        label: 'Completed Tasks',
        data: currentData.completed,
        backgroundColor: '#10b981',
        borderRadius: isMobile ? 3 : 6,
        borderSkipped: false,
      },
      {
        label: 'Planned Tasks',
        data: currentData.planned,
        backgroundColor: '#3b82f6',
        borderRadius: isMobile ? 3 : 6,
        borderSkipped: false,
      }
    ]
  };

  const lineData = {
    labels: currentData.labels,
    datasets: [{
      label: 'Completion Rate',
      data: currentData.completed.map((comp, idx) => 
        currentData.planned[idx] ? Math.round((comp / currentData.planned[idx]) * 100) : 0
      ),
      borderColor: '#8b5cf6',
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      tension: 0.4,
      fill: true,
      pointBackgroundColor: '#8b5cf6',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 3,
      pointRadius: isMobile ? 4 : 6,
      pointHoverRadius: isMobile ? 6 : 8
    }]
  };

  // Chart options
  const getChartOptions = (type) => {
    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { 
          position: 'bottom',
          labels: { 
            boxWidth: isMobile ? 10 : 12, 
            padding: isMobile ? 10 : 15,
            font: { size: isMobile ? 10 : 12 },
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: '#374151',
          borderWidth: 1,
          cornerRadius: 8,
          titleFont: { size: isMobile ? 11 : 13 },
          bodyFont: { size: isMobile ? 10 : 12 },
          padding: 12
        }
      }
    };

    if (type === 'bar') {
      return {
        ...baseOptions,
        plugins: {
          ...baseOptions.plugins,
          tooltip: {
            ...baseOptions.plugins.tooltip,
            callbacks: {
              afterLabel: (context) => {
                const rate = currentData.planned[context.dataIndex] ? 
                  Math.round((currentData.completed[context.dataIndex] / currentData.planned[context.dataIndex]) * 100) : 0;
                return `Success Rate: ${rate}%`;
              }
            }
          }
        },
        scales: {
          y: { 
            beginAtZero: true, 
            grid: { color: '#f3f4f6', drawBorder: false },
            ticks: { 
              font: { size: isMobile ? 9 : 11 },
              color: '#6b7280'
            }
          },
          x: { 
            grid: { display: false },
            ticks: { 
              font: { size: isMobile ? 9 : 11 },
              color: '#6b7280'
            }
          }
        }
      };
    }

    if (type === 'line') {
      return {
        ...baseOptions,
        plugins: {
          ...baseOptions.plugins,
          legend: { display: false },
          tooltip: {
            ...baseOptions.plugins.tooltip,
            callbacks: {
              label: (context) => `${context.parsed.y}% completion rate`
            }
          }
        },
        scales: {
          y: { 
            beginAtZero: true, 
            max: 100,
            grid: { color: '#f3f4f6', drawBorder: false },
            ticks: { 
              callback: (value) => value + '%',
              font: { size: isMobile ? 9 : 11 },
              color: '#6b7280'
            }
          },
          x: { 
            grid: { display: false },
            ticks: { 
              font: { size: isMobile ? 9 : 11 },
              color: '#6b7280'
            }
          }
        }
      };
    }

    return baseOptions;
  };

  // Export functions with real data
  const exportToExcel = () => {
    const reportData = currentData.labels.map((label, index) => ({
      Period: label,
      Date: currentData.dates[index],
      'Planned Tasks': currentData.planned[index],
      'Completed Tasks': currentData.completed[index],
      'Remaining Tasks': currentData.planned[index] - currentData.completed[index],
      'Completion Rate': currentData.planned[index] ? 
        Math.round((currentData.completed[index] / currentData.planned[index]) * 100) + '%' : '0%'
    }));

    const summaryData = [
      { Metric: 'Total Planned Tasks', Value: total },
      { Metric: 'Total Completed Tasks', Value: completed },
      { Metric: 'Total Remaining Tasks', Value: remaining },
      { Metric: 'Overall Completion Rate', Value: total ? Math.round((completed / total) * 100) + '%' : '0%' },
      { Metric: 'Current Streak', Value: realInsights.streak + ' days' },
      { Metric: 'Best Day', Value: realInsights.bestDay },
      { Metric: 'Average Completion Rate', Value: realInsights.avgCompletion + '%' },
      { Metric: 'This Week Completed', Value: realInsights.thisWeekCompleted },
      { Metric: 'This Week Total', Value: realInsights.thisWeekTotal },
      { Metric: 'Data Source', Value: tasksFromBackend.length > 0 ? 'Backend Database' : 'Frontend State' }
    ];

    const taskDetails = realTasks.length > 0 ? realTasks.map(task => ({
      'Task Name': task.title,
      Category: task.tag,
      'Start Time': task.startTime,
      'End Time': task.endTime,
      Status: task.completed ? 'Completed' : 'Pending',
      'Repeat Type': task.repeatType || 'None',
      Note: task.note || 'No notes',
      'Created Date': new Date(task.createdAt || task.date).toLocaleDateString(),
      'Completed Date': task.completedAt ? new Date(task.completedAt).toLocaleDateString() : 'Not completed'
    })) : [{ 'Task Name': 'No tasks available' }];

    const wb = XLSX.utils.book_new();
    const wsReport = XLSX.utils.json_to_sheet(reportData);
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    const wsTasks = XLSX.utils.json_to_sheet(taskDetails);
    
    XLSX.utils.book_append_sheet(wb, wsReport, `${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} Report`);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
    XLSX.utils.book_append_sheet(wb, wsTasks, 'Task Details');

    const fileName = `TaskCompanion_${viewMode}_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const exportCurrentChart = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.toBlob((blob) => {
        saveAs(blob, `task_chart_${viewMode}_${activeChart}_${Date.now()}.png`);
      });
    }
  };

  const renderChart = () => {
    const chartHeight = isMobile ? 220 : 300;
    
    switch (activeChart) {
      case 'doughnut':
        return (
          <div style={{ height: chartHeight, position: 'relative' }}>
            <Doughnut data={doughnutData} options={getChartOptions('doughnut')} />
            <div className="doughnut-center">
              <div className="center-value">{total ? Math.round((completed / total) * 100) : 0}%</div>
              <div className="center-label">Complete</div>
            </div>
          </div>
        );
      case 'bar':
        return (
          <div style={{ height: chartHeight, position: 'relative' }}>
            <Bar data={barData} options={getChartOptions('bar')} />
          </div>
        );
      case 'line':
        return (
          <div style={{ height: chartHeight, position: 'relative' }}>
            <Line data={lineData} options={getChartOptions('line')} />
          </div>
        );
      default:
        return null;
    }
  };

  // Show loading state
  if (loading) {
    return (
      <Container fluid className="dashboard-container py-4">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading your dashboard data...</p>
        </div>
      </Container>
    );
  }

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="dashboard-mobile-container">
        {/* Mobile Header */}
        <div className="mobile-dashboard-header">
          <div className="header-top">
            <Button variant="link" onClick={() => navigate(-1)} className="back-btn-mobile">
              <FontAwesomeIcon icon={faArrowLeft} />
            </Button>
            <div className="header-title">
              <h4>📊 Performance Dashboard</h4>
              <small>Track your productivity journey</small>
            </div>
            <div className="header-actions">
              <Button 
                variant="link" 
                size="sm"
                onClick={() => setShowFullscreenChart(true)}
                className="action-btn-mobile"
              >
                <FontAwesomeIcon icon={faExpand} />
              </Button>
            </div>
          </div>
          
          <div className="mobile-export-section">
            <Button 
              variant="success" 
              size="sm"
              onClick={exportToExcel}
              className="export-btn-mobile"
            >
              <FontAwesomeIcon icon={faFileExcel} />
              <span>Export Excel</span>
            </Button>
            <Button 
              variant="outline-primary" 
              size="sm"
              onClick={exportCurrentChart}
              className="export-btn-mobile"
            >
              <FontAwesomeIcon icon={faDownload} />
              <span>Save Chart</span>
            </Button>
          </div>

          {/* Data source indicator */}
          <div className="data-source-indicator">
            <small className="text-muted">
              📊 Data from: {tasksFromBackend.length > 0 ? 'Backend Database' : 'Local Storage'}
            </small>
          </div>
        </div>

        <Container fluid className="mobile-dashboard-content">
          {/* View Toggle */}
          <div className="mobile-view-toggle mb-3">
            <ButtonGroup size="sm" className="w-100">
              <Button 
                variant={viewMode === 'weekly' ? 'primary' : 'outline-primary'}
                onClick={() => setViewMode('weekly')}
                className="toggle-btn"
              >
                <FontAwesomeIcon icon={faCalendarWeek} className="me-1" />
                Weekly
              </Button>
              <Button 
                variant={viewMode === 'monthly' ? 'primary' : 'outline-primary'}
                onClick={() => setViewMode('monthly')}
                className="toggle-btn"
              >
                <FontAwesomeIcon icon={faCalendarAlt} className="me-1" />
                Monthly
              </Button>
            </ButtonGroup>
          </div>

          {/* Summary Cards with real data */}
          <Row className="g-2 mb-3">
            <Col xs={6}>
              <Card className="mobile-stat-card stat-planned">
                <Card.Body className="p-3 text-center">
                  <div className="mobile-stat-icon">📋</div>
                  <div className="mobile-stat-number">{total}</div>
                  <div className="mobile-stat-label">Planned</div>
                </Card.Body>
              </Card>
            </Col>
            <Col xs={6}>
              <Card className="mobile-stat-card stat-completed">
                <Card.Body className="p-3 text-center">
                  <div className="mobile-stat-icon">✅</div>
                  <div className="mobile-stat-number text-success">{completed}</div>
                  <div className="mobile-stat-label">Completed</div>
                </Card.Body>
              </Card>
            </Col>
            <Col xs={6}>
              <Card className="mobile-stat-card stat-remaining">
                <Card.Body className="p-3 text-center">
                  <div className="mobile-stat-icon">⏳</div>
                  <div className="mobile-stat-number text-warning">{remaining}</div>
                  <div className="mobile-stat-label">Remaining</div>
                </Card.Body>
              </Card>
            </Col>
            <Col xs={6}>
              <Card className="mobile-stat-card stat-rate">
                <Card.Body className="p-3 text-center">
                  <div className="mobile-stat-icon">📈</div>
                  <div className="mobile-stat-number text-info">
                    {total ? Math.round((completed / total) * 100) : 0}%
                  </div>
                  <div className="mobile-stat-label">Success Rate</div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Chart Card */}
          <Card className="mobile-chart-card mb-3">
            <Card.Header className="mobile-chart-header">
              <div className="chart-title">
                📊 {viewMode === 'weekly' ? 'Weekly' : 'Monthly'} Performance
              </div>
              <div className="chart-selector">
                <Button
                  size="sm"
                  variant={activeChart === 'doughnut' ? 'light' : 'outline-light'}
                  onClick={() => setActiveChart('doughnut')}
                  className="chart-btn"
                >
                  <FontAwesomeIcon icon={faChartPie} />
                </Button>
                <Button
                  size="sm"
                  variant={activeChart === 'bar' ? 'light' : 'outline-light'}
                  onClick={() => setActiveChart('bar')}
                  className="chart-btn"
                >
                  <FontAwesomeIcon icon={faChartBar} />
                </Button>
                <Button
                  size="sm"
                  variant={activeChart === 'line' ? 'light' : 'outline-light'}
                  onClick={() => setActiveChart('line')}
                  className="chart-btn"
                >
                  <FontAwesomeIcon icon={faChartLine} />
                </Button>
              </div>
            </Card.Header>
            <Card.Body className="p-3">
              {renderChart()}
            </Card.Body>
          </Card>

          {/* Insights with real data */}
          <Accordion className="mb-3 insights-accordion">
            <Accordion.Item eventKey="0">
              <Accordion.Header>💡 Key Insights & Achievements</Accordion.Header>
              <Accordion.Body>
                <div className="mobile-insights-grid">
                  <div className="insight-item-mobile streak">
                    <div className="insight-icon">🔥</div>
                    <div className="insight-content">
                      <div className="insight-value">{realInsights.streak} days</div>
                      <div className="insight-label">Current Streak</div>
                    </div>
                  </div>
                  <div className="insight-item-mobile best-day">
                    <div className="insight-icon">⭐</div>
                    <div className="insight-content">
                      <div className="insight-value">{realInsights.bestDay}</div>
                      <div className="insight-label">Best Day</div>
                    </div>
                  </div>
                  <div className="insight-item-mobile avg">
                    <div className="insight-icon">📊</div>
                    <div className="insight-content">
                      <div className="insight-value">{realInsights.avgCompletion}%</div>
                      <div className="insight-label">Avg Success</div>
                    </div>
                  </div>
                  <div className="insight-item-mobile week">
                    <div className="insight-icon">📅</div>
                    <div className="insight-content">
                      <div className="insight-value">{realInsights.thisWeekCompleted}/{realInsights.thisWeekTotal}</div>
                      <div className="insight-label">This Week</div>
                    </div>
                  </div>
                </div>
              </Accordion.Body>
            </Accordion.Item>
          </Accordion>

          {/* Detailed Report with real data */}
          <Accordion className="report-accordion">
            <Accordion.Item eventKey="0">
              <Accordion.Header>📋 Detailed {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} Report</Accordion.Header>
              <Accordion.Body className="p-0">
                <div className="mobile-report-table">
                  {currentData.labels.map((label, index) => {
                    const planned = currentData.planned[index];
                    const completedCount = currentData.completed[index];
                    const rate = planned ? Math.round((completedCount / planned) * 100) : 0;
                    
                    return (
                      <div key={index} className="mobile-report-row">
                        <div className="report-row-header">
                          <strong>{label}</strong>
                          <small className="text-muted">{currentData.dates[index]}</small>
                        </div>
                        <div className="report-row-stats">
                          <div className="stat-item">
                            <span className="stat-label">Planned</span>
                            <span className="stat-value">{planned}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">Done</span>
                            <span className="stat-value text-success">{completedCount}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">Rate</span>
                            <span className={`stat-value ${rate >= 80 ? 'text-success' : rate >= 60 ? 'text-warning' : 'text-danger'}`}>
                              {rate}%
                            </span>
                          </div>
                        </div>
                        <div className="mobile-progress-bar">
                          <div 
                            className="mobile-progress-fill" 
                            style={{ width: `${rate}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Accordion.Body>
            </Accordion.Item>
          </Accordion>
        </Container>

        {/* Fullscreen Chart Modal */}
        <Modal show={showFullscreenChart} onHide={() => setShowFullscreenChart(false)} size="lg" centered>
          <Modal.Header closeButton>
            <Modal.Title>📊 {activeChart.charAt(0).toUpperCase() + activeChart.slice(1)} Chart</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="chart-selector mb-3 text-center">
              <ButtonGroup>
                <Button
                  variant={activeChart === 'doughnut' ? 'primary' : 'outline-primary'}
                  onClick={() => setActiveChart('doughnut')}
                >
                  <FontAwesomeIcon icon={faChartPie} className="me-1" />
                  Pie Chart
                </Button>
                <Button
                  variant={activeChart === 'bar' ? 'primary' : 'outline-primary'}
                  onClick={() => setActiveChart('bar')}
                >
                  <FontAwesomeIcon icon={faChartBar} className="me-1" />
                  Bar Chart
                </Button>
                <Button
                  variant={activeChart === 'line' ? 'primary' : 'outline-primary'}
                  onClick={() => setActiveChart('line')}
                >
                  <FontAwesomeIcon icon={faChartLine} className="me-1" />
                  Line Chart
                </Button>
              </ButtonGroup>
            </div>
            <div style={{ height: '400px', position: 'relative' }}>
              {renderChart()}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-primary" onClick={exportCurrentChart}>
              <FontAwesomeIcon icon={faDownload} className="me-2" />
              Export Chart
            </Button>
            <Button variant="secondary" onClick={() => setShowFullscreenChart(false)}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  }

  // Desktop Layout (rest of the component remains the same but uses realTasks)
  return (
    <Container fluid className="dashboard-container py-4">
      {/* Desktop Header */}
      <div className="desktop-dashboard-header mb-4">
        <Row className="align-items-center">
          <Col>
            <Button variant="outline-secondary" onClick={() => navigate(-1)} className="mb-3">
              <FontAwesomeIcon icon={faArrowLeft} className="me-2" />
              Back to Tasks
            </Button>
            <h2 className="dashboard-title">📊 Performance Dashboard</h2>
            <p className="text-muted mb-0">Track your productivity and celebrate your achievements</p>
            <small className="text-info">
              📊 Data source: {tasksFromBackend.length > 0 ? 'Backend Database' : 'Local Storage'} 
              ({realTasks.length} tasks)
            </small>
          </Col>
          <Col xs="auto">
            <div className="export-section">
              <Button 
                variant="success" 
                onClick={exportToExcel}
                className="me-2"
              >
                <FontAwesomeIcon icon={faFileExcel} className="me-2" />
                Export Excel Report
              </Button>
              <Button 
                variant="outline-primary" 
                onClick={exportCurrentChart}
              >
                <FontAwesomeIcon icon={faDownload} className="me-2" />
                Export Chart
              </Button>
            </div>
          </Col>
        </Row>
      </div>

      {/* View Toggle */}
      <div className="view-toggle mb-4">
        <ButtonGroup>
          <Button 
            variant={viewMode === 'weekly' ? 'primary' : 'outline-primary'}
            onClick={() => setViewMode('weekly')}
            size="lg"
          >
            <FontAwesomeIcon icon={faCalendarWeek} className="me-2" />
            Weekly View
          </Button>
          <Button 
            variant={viewMode === 'monthly' ? 'primary' : 'outline-primary'}
            onClick={() => setViewMode('monthly')}
            size="lg"
          >
            <FontAwesomeIcon icon={faCalendarAlt} className="me-2" />
            Monthly View
          </Button>
        </ButtonGroup>
      </div>

      <Row className="g-4">
        {/* Summary Cards with real data */}
        <Col lg={3} md={6}>
          <Card className="stat-card stat-planned text-center h-100">
            <Card.Body>
              <div className="stat-icon">📋</div>
              <h6 className="text-muted">Total Planned</h6>
              <h2 className="stat-number">{total}</h2>
              <div className="stat-trend">
                <small className="text-info">All time tasks</small>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={3} md={6}>
          <Card className="stat-card stat-completed text-center h-100">
            <Card.Body>
              <div className="stat-icon">✅</div>
              <h6 className="text-muted">Completed</h6>
              <h2 className="stat-number text-success">{completed}</h2>
              <div className="stat-trend">
                <small className="text-success">Great progress!</small>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={3} md={6}>
          <Card className="stat-card stat-remaining text-center h-100">
            <Card.Body>
              <div className="stat-icon">⏳</div>
              <h6 className="text-muted">Remaining</h6>
              <h2 className="stat-number text-warning">{remaining}</h2>
              <div className="stat-trend">
                <small className="text-warning">{remaining > 0 ? 'Keep going!' : 'All done!'}</small>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={3} md={6}>
          <Card className="stat-card stat-rate text-center h-100">
            <Card.Body>
              <div className="stat-icon">📈</div>
              <h6 className="text-muted">Success Rate</h6>
              <h2 className="stat-number text-info">
                {total ? Math.round((completed / total) * 100) : 0}%
              </h2>
              <div className="stat-trend">
                <small className="text-info">
                  {realInsights.avgCompletion >= 80 ? 'Excellent!' : 
                   realInsights.avgCompletion >= 60 ? 'Good job!' : 
                   'Keep improving!'}
                </small>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Charts Section */}
        <Col lg={5}>
          <Card className="chart-card h-100">
            <Card.Header className="chart-header">
              <h5 className="mb-0">📊 Overall Completion</h5>
              <div className="chart-actions">
                <Button 
                  variant="outline-light" 
                  size="sm"
                  onClick={() => setActiveChart(activeChart === 'doughnut' ? 'bar' : 'doughnut')}
                >
                  <FontAwesomeIcon icon={faExpand} />
                </Button>
              </div>
            </Card.Header>
            <Card.Body className="d-flex align-items-center justify-content-center">
              <div style={{ maxWidth: '300px', width: '100%', height: '300px', position: 'relative' }}>
                <Doughnut data={doughnutData} options={getChartOptions('doughnut')} />
                <div className="doughnut-center">
                  <div className="center-value">{total ? Math.round((completed / total) * 100) : 0}%</div>
                  <div className="center-label">Complete</div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={7}>
          <Card className="chart-card h-100">
            <Card.Header className="chart-header">
              <h5 className="mb-0">
                <FontAwesomeIcon icon={faChartBar} className="me-2" />
                {viewMode === 'weekly' ? 'This Week' : 'This Month'} - Task Performance
              </h5>
              <div className="chart-selector">
                <ButtonGroup size="sm">
                  <Button
                    variant={activeChart === 'bar' ? 'light' : 'outline-light'}
                    onClick={() => setActiveChart('bar')}
                  >
                    <FontAwesomeIcon icon={faChartBar} />
                  </Button>
                  <Button
                    variant={activeChart === 'line' ? 'light' : 'outline-light'}
                    onClick={() => setActiveChart('line')}
                  >
                    <FontAwesomeIcon icon={faChartLine} />
                  </Button>
                </ButtonGroup>
              </div>
            </Card.Header>
            <Card.Body>
              <div style={{ height: '300px', position: 'relative' }}>
                {activeChart === 'bar' ? (
                  <Bar data={barData} options={getChartOptions('bar')} />
                ) : (
                  <Line data={lineData} options={getChartOptions('line')} />
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Insights Section with real data */}
        <Col lg={4}>
          <Card className="insights-card h-100">
            <Card.Header className="chart-header">
              <h5 className="mb-0">💡 Key Insights</h5>
            </Card.Header>
            <Card.Body>
              <div className="insights-grid">
                <div className="insight-item streak">
                  <div className="insight-icon">🔥</div>
                  <div className="insight-content">
                    <div className="insight-value">{realInsights.streak} days</div>
                    <div className="insight-label">Current Streak</div>
                    <div className="insight-description">
                      {realInsights.streak >= 7 ? 'Amazing streak!' : 
                       realInsights.streak >= 3 ? 'Great momentum!' : 
                       'Keep building!'}
                    </div>
                  </div>
                </div>
                <div className="insight-item best-day">
                  <div className="insight-icon">⭐</div>
                  <div className="insight-content">
                    <div className="insight-value">{realInsights.bestDay}</div>
                    <div className="insight-label">Best Day</div>
                    <div className="insight-description">Most productive</div>
                  </div>
                </div>
                <div className="insight-item avg">
                  <div className="insight-icon">📊</div>
                  <div className="insight-content">
                    <div className="insight-value">{realInsights.avgCompletion}%</div>
                    <div className="insight-label">Success Rate</div>
                    <div className="insight-description">Overall performance</div>
                  </div>
                </div>
                <div className="insight-item week">
                  <div className="insight-icon">📅</div>
                  <div className="insight-content">
                    <div className="insight-value">{realInsights.thisWeekCompleted}/{realInsights.thisWeekTotal}</div>
                    <div className="insight-label">This Week</div>
                    <div className="insight-description">
                      {realInsights.thisWeekTotal === 0 ? 'Plan your week!' : 
                       realInsights.thisWeekCompleted === realInsights.thisWeekTotal ? 'Perfect week!' : 
                       'Keep going!'}
                    </div>
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Detailed Report Table with real data */}
        <Col lg={8}>
          <Card className="report-card">
            <Card.Header className="chart-header">
              <h5 className="mb-0">📋 Detailed {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} Report</h5>
            </Card.Header>
            <Card.Body>
              <Table striped hover responsive className="report-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Date Range</th>
                    <th>Planned</th>
                    <th>Completed</th>
                    <th>Remaining</th>
                    <th>Success Rate</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {currentData.labels.map((label, index) => {
                    const planned = currentData.planned[index];
                    const completedCount = currentData.completed[index];
                    const rate = planned ? Math.round((completedCount / planned) * 100) : 0;
                    
                    return (
                      <tr key={index}>
                        <td><strong>{label}</strong></td>
                        <td className="text-muted">{currentData.dates[index]}</td>
                        <td>{planned}</td>
                        <td className="text-success">{completedCount}</td>
                        <td className="text-warning">{planned - completedCount}</td>
                        <td>
                          <span className={`badge ${rate >= 80 ? 'bg-success' : rate >= 60 ? 'bg-warning' : 'bg-danger'}`}>
                            {rate}%
                          </span>
                        </td>
                        <td>
                          <div className="progress-mini">
                            <div 
                              className="progress-mini-bar" 
                              style={{ width: `${rate}%` }}
                            ></div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
