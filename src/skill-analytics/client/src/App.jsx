import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Activity, AlertTriangle, Clock, Trash2, Archive, CheckCircle, XCircle, RefreshCw, X } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, Filler);

const API_URL = 'http://localhost:3000/api';

function App() {
  const [stats, setStats] = useState({ skills: [], trend: [] });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPastSchedules, setShowPastSchedules] = useState(false);

  const fetchStats = async () => {
    setIsRefreshing(true);
    try {
      const response = await axios.get(`${API_URL}/skills/stats`);
      setStats(response.data);
    } catch (err) {
      console.error('Failed to fetch stats', err);
    } finally {
      setLoading(false);
      setTimeout(() => setIsRefreshing(false), 500); // UI feedback
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleDeleteSchedule = async (taskId) => {
    if (!window.confirm('Hide this schedule from the list?')) return;
    try {
      await axios.delete(`${API_URL}/schedules`, { data: { task_id: taskId } });
      fetchStats();
    } catch (err) {
      console.error('Failed to hide schedule', err);
    }
  };

  const handleAction = async (skillName, action, skillPath) => {
    if (!window.confirm(`Are you sure you want to ${action} ${skillName}?`)) return;
    try {
      await axios.post(`${API_URL}/skills/${skillName}/action`, { action, skill_path: skillPath });
      fetchStats();
    } catch (err) {
      alert('Action failed: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center text-slate-500 space-y-4">
          <RefreshCw className="animate-spin w-8 h-8 text-blue-500" />
          <p className="text-lg font-medium">Loading Telemetry...</p>
        </div>
      </div>
    );
  }

  const totalRuns = stats.skills.reduce((acc, s) => acc + s.usage_count, 0);
  const totalErrors = stats.skills.reduce((acc, s) => acc + s.error_count, 0);
  const activeSkills = stats.skills.filter(s => s.archived === 0);
  const deadSkills = activeSkills.filter(s => s.usage_count === 0 || (new Date() - new Date(s.last_used)) > 30 * 24 * 60 * 60 * 1000);
  const errorRate = totalRuns > 0 ? ((totalErrors / totalRuns) * 100).toFixed(1) : 0;

  const trendData = {
    labels: stats.trend.map(t => t.date),
    datasets: [
      {
        label: 'Skill Executions',
        data: stats.trend.map(t => t.count),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#3b82f6',
        pointBorderWidth: 2,
        pointRadius: 4,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index', intersect: false, backgroundColor: 'rgba(15, 23, 42, 0.9)' }
    },
    scales: {
      y: { 
        beginAtZero: true, 
        grid: { borderDash: [4, 4], color: '#f1f5f9' },
        ticks: { precision: 0 }
      },
      x: { grid: { display: false } }
    },
    interaction: { mode: 'nearest', axis: 'x', intersect: false }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-blue-600 rounded-lg shadow-sm shadow-blue-200">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Skill Analytics</h1>
            </div>
            <p className="text-slate-500 font-medium ml-12">Antigravity Agent Telemetry Dashboard</p>
          </div>
          <button 
            onClick={fetchStats} 
            disabled={isRefreshing}
            className={`flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-sm font-semibold rounded-lg shadow-sm transition-colors ${isRefreshing ? 'opacity-75 cursor-wait' : 'hover:bg-slate-50'}`}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} /> 
            {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </header>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-500 tracking-wider">TOTAL EXECUTIONS</h3>
              <Activity className="w-5 h-5 text-blue-500 opacity-80" />
            </div>
            <p className="text-4xl font-extrabold text-slate-900 mt-4">{totalRuns}</p>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-16 -mt-16 transition-transform hover:scale-110"></div>
            <div className="flex items-center justify-between relative z-10">
              <h3 className="text-sm font-bold text-slate-500 tracking-wider">ERROR RATE</h3>
              <XCircle className="w-5 h-5 text-red-500 opacity-80" />
            </div>
            <div className="flex items-end gap-2 mt-4 relative z-10">
              <p className="text-4xl font-extrabold text-red-600">{errorRate}%</p>
              <span className="text-sm font-medium text-slate-500 mb-1">{totalErrors} errors</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16"></div>
            <div className="flex items-center justify-between relative z-10">
              <h3 className="text-sm font-bold text-slate-500 tracking-wider">ACTIVE SKILLS</h3>
              <CheckCircle className="w-5 h-5 text-emerald-500 opacity-80" />
            </div>
            <p className="text-4xl font-extrabold text-emerald-600 mt-4 relative z-10">{activeSkills.length}</p>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-2xl shadow-sm border border-amber-100 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-amber-800 tracking-wider">DEAD SKILLS</h3>
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-4xl font-extrabold text-amber-700 mt-4">{deadSkills.length}</p>
            <p className="text-xs font-medium text-amber-600 mt-2">No usage in 30 days</p>
          </div>
        </div>

        {/* Charts & Table Layout */}
        <div className="flex flex-col gap-8">
          
          {/* Schedules */}
          <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-500" /> Schedules
              </h2>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showPastSchedules}
                  onChange={(e) => setShowPastSchedules(e.target.checked)}
                  className="rounded text-indigo-500 focus:ring-indigo-500"
                />
                Show Past/Inactive
              </label>
            </div>
            <div className="p-6">
              {!stats.schedules || stats.schedules.length === 0 ? (
                <div className="text-center py-8 text-slate-400 border-2 border-dashed rounded-xl">
                  <p className="text-sm font-medium">No active schedules or timers found</p>
                  <p className="text-xs mt-1">Try '/schedule' command in chat to add one.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {stats.schedules.filter(schedule => {
                    const isPast = new Date(schedule.created_at) < new Date(Date.now() - 24 * 60 * 60 * 1000); // 24時間以上前
                    return showPastSchedules || !isPast;
                  }).map(schedule => {
                    const isPast = new Date(schedule.created_at) < new Date(Date.now() - 24 * 60 * 60 * 1000);
                    return (
                    <div key={schedule.task_id} className={`p-4 rounded-xl border transition-colors group ${isPast ? 'bg-slate-50/50 border-slate-100 opacity-60 grayscale' : 'border-indigo-100 bg-white hover:bg-indigo-50/30 shadow-sm'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-white border border-slate-200 text-slate-600 shadow-sm">
                          {schedule.cron_expression && schedule.cron_expression !== 'null' && schedule.cron_expression !== '' ? (
                            <><RefreshCw className="w-3 h-3 text-blue-500" /> {schedule.cron_expression}</>
                          ) : (
                            <><Clock className="w-3 h-3 text-orange-500" /> Timer: {schedule.duration_seconds}s</>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-mono bg-white px-2 py-0.5 rounded border border-slate-100">{schedule.task_id.split('/').pop()}</span>
                          <button 
                            onClick={() => handleDeleteSchedule(schedule.task_id)}
                            className="p-1 rounded hover:bg-slate-200/50 text-slate-400 hover:text-red-500 transition-colors"
                            title="Hide this schedule"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-slate-700 line-clamp-2 mt-3">{schedule.prompt}</p>
                      <p className="text-[10px] text-slate-400 mt-3 pt-3 border-t border-slate-200/60">
                        Started: {new Date(schedule.created_at).toLocaleString()}
                      </p>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          {/* Trend Chart */}
          <div className="w-full bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-slate-400" /> Usage Trend (30 Days)
            </h2>
            <div className="h-64 w-full">
              {stats.trend.length > 0 ? (
                <Line data={trendData} options={chartOptions} />
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium border-2 border-dashed rounded-xl">
                  No data points yet
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-base font-bold text-slate-800">Skill Inventory</h2>
            </div>
            <div className="overflow-x-auto flex-1">
              {/* (省略せずに書く必要があるため、元のテーブルコードをそのまま入れる) */}
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white text-slate-500 font-semibold border-b border-slate-100 uppercase text-xs tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Skill Name</th>
                    <th className="px-6 py-4">Calls</th>
                    <th className="px-6 py-4">Latency</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Last Activity</th>
                    <th className="px-6 py-4 text-right">Manage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.skills.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center">
                          <AlertTriangle className="w-8 h-8 mb-2 opacity-50" />
                          <p className="text-base font-medium text-slate-600">No skills tracked yet</p>
                          <p className="text-sm mt-1">Waiting for agent telemetry data...</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    stats.skills.map(skill => {
                      const isDead = skill.usage_count === 0 || (new Date() - new Date(skill.last_used)) > 30 * 24 * 60 * 60 * 1000;
                      return (
                        <tr key={skill.skill_name} className={`transition-colors ${skill.archived ? "bg-slate-50/50 opacity-60 grayscale" : "hover:bg-slate-50"}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${skill.archived ? 'bg-slate-300' : isDead ? 'bg-amber-400' : 'bg-emerald-400'}`}></div>
                              <span className="font-bold text-slate-700">{skill.skill_name}</span>
                              {skill.archived === 1 && <span className="text-[10px] uppercase tracking-wider font-bold bg-slate-200 text-slate-500 px-2 py-0.5 rounded-md">Archived</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-600">{skill.usage_count}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Clock className="w-4 h-4 opacity-70" />
                              <span className="font-medium">{Math.round(skill.avg_latency || 0)} ms</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {skill.error_count > 0 ? (
                              <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-md text-xs font-bold">
                                <XCircle className="w-3 h-3" /> {skill.error_count} Errors
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md text-xs font-bold">
                                <CheckCircle className="w-3 h-3" /> Healthy
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-xs font-medium">
                            {skill.last_used ? new Date(skill.last_used).toLocaleString(undefined, {
                              month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'
                            }) : 'Never'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {!skill.archived && (
                              <div className="flex justify-end gap-1">
                                <button 
                                  onClick={() => handleAction(skill.skill_name, 'archive', skill.skill_path)}
                                  className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" 
                                  title="Archive this skill"
                                >
                                  <Archive className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleAction(skill.skill_name, 'delete', skill.skill_path)}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                                  title="Delete this skill"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
        </div>

      </div>
    </div>
  );
}

export default App;
